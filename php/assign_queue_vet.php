<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/queue_assignment_helpers.php';
require_once __DIR__ . '/notification_helpers.php';
require_once __DIR__ . '/booking_maintenance.php';
require_once __DIR__ . '/workflow_guard_helpers.php';
require_once __DIR__ . '/branch_helpers.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true) ?: [];
$queueId = isset($input['queue_id']) ? (int)$input['queue_id'] : 0;
$veterinarianUserId = isset($input['veterinarian_user_id']) ? (int)$input['veterinarian_user_id'] : 0;
$providedVetName = trim((string)($input['veterinarian_name'] ?? ''));
$reason = trim((string)($input['reason'] ?? 'Assigned by admin from queue management'));
$currentApiUser = ipawcus_guard_current_user($pdo);
$currentApiRole = ipawcus_guard_role($currentApiUser);

if (!ipawcus_guard_is_admin_role($currentApiRole)) {
    http_response_code(403);
    echo json_encode(['error' => 'Only authorized admin users can assign queue veterinarians.']);
    exit;
}

if ($queueId <= 0 || $veterinarianUserId <= 0) {
    http_response_code(400);
    echo json_encode(['error' => 'queue_id and veterinarian_user_id are required.']);
    exit;
}

$calendarLock = null;
try {
    requireVetQueueAssignmentsTable($pdo);
    runLifecycleMaintenance($pdo);

    $calendarLock = booking_slot_lock_name(0, 'general-checkup', '', '');
    if (!booking_slot_acquire($pdo, $calendarLock)) {
        throw new DomainException('The booking calendar is busy. Please try again.');
    }
    $pdo->beginTransaction();

    $queueStmt = $pdo->prepare("SELECT queue_id, booking_id, branch_id, status, service_name FROM queues WHERE queue_id = ? FOR UPDATE");
    $queueStmt->execute([$queueId]);
    $queue = $queueStmt->fetch(PDO::FETCH_ASSOC);

    if (!$queue) {
        $pdo->rollBack();
        http_response_code(404);
        echo json_encode(['error' => 'Queue item not found.']);
        exit;
    }

    if (in_array(strtolower(trim((string)($queue['service_name'] ?? ''))), ['grooming', 'pet grooming'], true)) {
        $pdo->rollBack();
        http_response_code(409);
        echo json_encode(['error' => 'Grooming queues go to Grooming Management and cannot be assigned to a veterinarian.']);
        exit;
    }


    if ($currentApiRole === 'admin' && !branch_user_can_access($pdo, $currentApiUser, (int)($queue['branch_id'] ?? 0))) {
        $pdo->rollBack();
        http_response_code(403);
        echo json_encode(['error' => 'This queue belongs to another branch.']);
        exit;
    }

    if (in_array($queue['status'], ['completed', 'done', 'cancelled'], true)) {
        $pdo->rollBack();
        http_response_code(409);
        echo json_encode(['error' => 'Completed or cancelled queue items cannot be assigned.']);
        exit;
    }

    $vetStmt = $pdo->prepare("SELECT u.first_Name, u.last_Name
        FROM users u
        LEFT JOIN veterinarian_profiles vp ON vp.user_id = u.user_id
        WHERE u.user_id = ?
          AND LOWER(REPLACE(TRIM(u.role), ' ', '_')) = 'veterinarian'
          AND (vp.user_id IS NULL OR vp.is_active = 1)
        LIMIT 1");
    $vetStmt->execute([$veterinarianUserId]);
    $vetUser = $vetStmt->fetch(PDO::FETCH_ASSOC);

    if (!$vetUser) {
        $pdo->rollBack();
        http_response_code(404);
        echo json_encode(['error' => 'Active veterinarian account not found.']);
        exit;
    }

    $veterinarianName = $providedVetName !== '' ? $providedVetName : normalizeVetName($vetUser);

    if (!branch_user_can_access($pdo, ['user_id' => $veterinarianUserId, 'role' => 'veterinarian'], (int)$queue['branch_id'])) {
        throw new DomainException('This veterinarian is not assigned to this clinic.');
    }
    if (!empty($queue['booking_id'])) {
        $bookingStmt = $pdo->prepare('SELECT * FROM bookings WHERE booking_id = ? FOR UPDATE');
        $bookingStmt->execute([(int)$queue['booking_id']]);
        $reservedBooking = $bookingStmt->fetch(PDO::FETCH_ASSOC);
        // Reassigning a future appointment must reserve the replacement vet.
        // Patients already being examined can be handed over by the admin.
        if ($reservedBooking && strtotime($reservedBooking['booking_date'] . ' ' . $reservedBooking['booking_time']) > time()) {
            $serviceKey = booking_slot_service_key($reservedBooking['service_type'], $reservedBooking['is_home_service'] ?? 0, $reservedBooking['is_online_consultation'] ?? 0);
            if (clinic_booking_is_medical($serviceKey)) {
                clinic_booking_reserve_vet($pdo, (int)$reservedBooking['branch_id'], $reservedBooking['booking_date'], $reservedBooking['booking_time'], $serviceKey, $veterinarianUserId, (int)$reservedBooking['booking_id']);
            }
        }
    }

    $activeStmt = $pdo->prepare("
        SELECT assignment_id, veterinarian_user_id, veterinarian_name
        FROM vet_queue_assignments
        WHERE queue_id = ?
          AND status = 'received'
        ORDER BY assignment_id DESC
        LIMIT 1
        FOR UPDATE
    ");
    $activeStmt->execute([$queueId]);
    $activeAssignment = $activeStmt->fetch(PDO::FETCH_ASSOC);

    $previousQueueStatus = (string)$queue['status'];

    if ($activeAssignment && (int)$activeAssignment['veterinarian_user_id'] === $veterinarianUserId) {
        $queueUpdate = $pdo->prepare("UPDATE queues SET status = 'in-progress' WHERE queue_id = ?");
        $queueUpdate->execute([$queueId]);
        if (ipawcus_guard_table_exists($pdo, 'clinical_intakes')) {
            $intakeUpdate = $pdo->prepare('UPDATE clinical_intakes SET assigned_veterinarian_user_id = ? WHERE queue_id = ?');
            $intakeUpdate->execute([$veterinarianUserId, $queueId]);
        }
        if (!empty($queue['booking_id'])) {
            $bookingUpdate = $pdo->prepare('UPDATE bookings SET veterinarian_id = ? WHERE booking_id = ?');
            $bookingUpdate->execute([$veterinarianUserId, (int)$queue['booking_id']]);
        }
        $pdo->commit();
        booking_slot_release($pdo, $calendarLock);

        if ($previousQueueStatus !== 'in-progress') {
            try {
                notification_send_queue_event($pdo, $queueId, 'in_progress', [
                    'reason' => $reason !== '' ? $reason : 'Assigned by admin from queue management',
                ]);
            } catch (Throwable $notificationError) {
                error_log('Queue assignment approval notification failed: ' . $notificationError->getMessage());
            }
        }

        echo json_encode([
            'success' => true,
            'assignment' => $activeAssignment,
            'message' => 'Queue is already assigned to this veterinarian.'
        ]);
        exit;
    }

    if ($activeAssignment) {
        $returnStmt = $pdo->prepare("
            UPDATE vet_queue_assignments
            SET status = 'returned',
                returned_at = NOW(),
                return_reason = ?
            WHERE assignment_id = ?
        ");
        $returnStmt->execute([$reason !== '' ? $reason : 'Reassigned by admin', $activeAssignment['assignment_id']]);
    }

    $queueUpdate = $pdo->prepare("UPDATE queues SET status = 'in-progress' WHERE queue_id = ?");
    $queueUpdate->execute([$queueId]);

    $insertStmt = $pdo->prepare("
        INSERT INTO vet_queue_assignments (queue_id, veterinarian_user_id, veterinarian_name, status, received_at)
        VALUES (?, ?, ?, 'received', NOW())
    ");
    $insertStmt->execute([$queueId, $veterinarianUserId, $veterinarianName]);
    $assignmentId = (int)$pdo->lastInsertId();

    $assignmentStmt = $pdo->prepare("
        SELECT assignment_id, queue_id, veterinarian_user_id, veterinarian_name, status, received_at
        FROM vet_queue_assignments
        WHERE assignment_id = ?
    ");
    $assignmentStmt->execute([$assignmentId]);
    $assignment = $assignmentStmt->fetch(PDO::FETCH_ASSOC);

    if (ipawcus_guard_table_exists($pdo, 'clinical_intakes')) {
        $intakeUpdate = $pdo->prepare('UPDATE clinical_intakes SET assigned_veterinarian_user_id = ? WHERE queue_id = ?');
        $intakeUpdate->execute([$veterinarianUserId, $queueId]);
    }
    if (!empty($queue['booking_id'])) {
        $bookingUpdate = $pdo->prepare('UPDATE bookings SET veterinarian_id = ? WHERE booking_id = ?');
        $bookingUpdate->execute([$veterinarianUserId, (int)$queue['booking_id']]);
    }

    $pdo->commit();
    booking_slot_release($pdo, $calendarLock);

    try {
        if ($previousQueueStatus !== 'in-progress') {
            notification_send_queue_event($pdo, $queueId, 'in_progress', [
                'reason' => $reason !== '' ? $reason : 'Assigned by admin from queue management',
            ]);
        }

        notification_send_queue_event($pdo, $queueId, 'received', [
            'veterinarian_name' => $veterinarianName,
        ]);
        notification_send_queue_assignment_to_vet($pdo, $queueId, $veterinarianUserId, $veterinarianName);
    } catch (Throwable $notificationError) {
        error_log('Queue assignment notification failed: ' . $notificationError->getMessage());
    }

    echo json_encode([
        'success' => true,
        'assignment' => $assignment
    ]);
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    booking_slot_release($pdo, $calendarLock);
    http_response_code($e instanceof DomainException ? 409 : 500);
    if (!($e instanceof DomainException)) error_log('Queue vet assignment failed: ' . $e->getMessage());
    echo json_encode(['error' => $e instanceof DomainException ? $e->getMessage() : 'Failed to assign queue veterinarian.']);
}
