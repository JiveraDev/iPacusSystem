<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/queue_assignment_helpers.php';
require_once __DIR__ . '/booking_queue_helpers.php';
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
$returnReason = trim((string)($input['return_reason'] ?? ''));
$currentApiUser = ipawcus_guard_current_user($pdo);
$currentApiRole = ipawcus_guard_role($currentApiUser);
$currentApiUserId = ipawcus_guard_user_id($currentApiUser);

if (!in_array($currentApiRole, ['veterinarian', 'admin', 'super_admin'], true)) {
    http_response_code(403);
    echo json_encode(['error' => 'Only veterinarians or authorized administrators can return queue patients.']);
    exit;
}

if ($currentApiRole === 'veterinarian') {
    if ($veterinarianUserId > 0 && $veterinarianUserId !== $currentApiUserId) {
        http_response_code(403);
        echo json_encode(['error' => 'Veterinarians can only return queues assigned to their own account.']);
        exit;
    }
    $veterinarianUserId = $currentApiUserId;
}

if ($queueId <= 0 || ($currentApiRole === 'veterinarian' && $veterinarianUserId <= 0)) {
    http_response_code(400);
    echo json_encode(['error' => $queueId <= 0
        ? 'queue_id is required.'
        : 'A valid veterinarian account is required.']);
    exit;
}

try {
    requireVetQueueAssignmentsTable($pdo);
    runLifecycleMaintenance($pdo);

    $pdo->beginTransaction();

    $queueStmt = $pdo->prepare("
        SELECT *
        FROM queues
        WHERE queue_id = ?
        LIMIT 1
        FOR UPDATE
    ");
    $queueStmt->execute([$queueId]);
    $queue = $queueStmt->fetch(PDO::FETCH_ASSOC);

    if (!$queue) {
        $pdo->rollBack();
        http_response_code(404);
        echo json_encode(['error' => 'Queue item not found.']);
        exit;
    }


    if ($currentApiRole === 'admin' && !branch_user_can_access($pdo, $currentApiUser, (int)($queue['branch_id'] ?? 0))) {
        $pdo->rollBack();
        http_response_code(403);
        echo json_encode(['error' => 'This queue belongs to another branch.']);
        exit;
    }

    $assignmentStmt = $pdo->prepare("
        SELECT assignment_id, veterinarian_user_id, veterinarian_name
        FROM vet_queue_assignments
        WHERE queue_id = ?
          AND status = 'received'
        ORDER BY assignment_id DESC
        LIMIT 1
        FOR UPDATE
    ");
    $assignmentStmt->execute([$queueId]);
    $assignment = $assignmentStmt->fetch(PDO::FETCH_ASSOC);

    if (!$assignment) {
        $pdo->rollBack();
        http_response_code(409);
        echo json_encode(['error' => 'This patient is not currently received by a veterinarian.']);
        exit;
    }

    $assignedVeterinarianUserId = (int)$assignment['veterinarian_user_id'];
    if ($currentApiRole === 'veterinarian' && $assignedVeterinarianUserId !== $veterinarianUserId) {
        $pdo->rollBack();
        http_response_code(403);
        echo json_encode(['error' => 'Only the receiving veterinarian can return this patient to the approved list.']);
        exit;
    }
    // Administrators act on the locked assignment. Never trust a submitted
    // veterinarian identity to select or authorize another veterinarian's work.
    $veterinarianUserId = $assignedVeterinarianUserId;

    $queueDate = date('Y-m-d', strtotime((string)$queue['timestamp']));
    $todayDate = maintenance_today($pdo);
    $relatedBookingId = bookingIdForQueue($pdo, $queue);
    $isBookingQueue = $relatedBookingId !== null
        || strtolower(trim((string)($queue['queue_source'] ?? ''))) === 'booking_management';
    $effectiveReason = $returnReason !== '' ? $returnReason : 'Returned from veterinarian My List';

    if ($queueDate < $todayDate) {
        $effectiveReason = 'Returned after service day ended';
    } elseif ($isBookingQueue) {
        $effectiveReason = 'Returned by veterinarian to confirmed bookings';
    }

    $updateStmt = $pdo->prepare("
        UPDATE vet_queue_assignments
        SET status = 'returned',
            returned_at = NOW(),
            return_reason = ?
        WHERE assignment_id = ?
    ");
    $updateStmt->execute([$effectiveReason, $assignment['assignment_id']]);

    $queueStatus = $queue['status'];
    $notifyQueueCancellationAfterCommit = false;
    if ($queueDate < $todayDate) {
        if (maintenance_cancel_queue($pdo, $queueId, $effectiveReason, false, false)) {
            $queueStatus = 'cancelled';
            $notifyQueueCancellationAfterCommit = true;
        }
    } elseif ($isBookingQueue) {
        // A queue created while receiving a confirmed booking is only a temporary
        // service hand-off. Returning it must expose the original confirmed
        // booking again instead of placing the patient in the standalone queue.
        maintenance_cancel_queue($pdo, $queueId, $effectiveReason, false, false);
        $queueStatus = 'cancelled';
    }

    $pdo->commit();

    if ($notifyQueueCancellationAfterCommit) {
        try {
            notification_send_queue_event($pdo, $queueId, 'cancelled', [
                'reason' => $effectiveReason,
            ]);
        } catch (Throwable $notificationError) {
            error_log('Post-return queue notification failed: ' . $notificationError->getMessage());
        }
    }

    if ($queueStatus === 'cancelled' && !empty($queue['pet_id'])) {
        try {
            runLifecycleMaintenance($pdo, (int)$queue['pet_id']);
        } catch (Throwable $maintenanceError) {
            error_log('Post-return lifecycle maintenance failed: ' . $maintenanceError->getMessage());
        }
    }

    echo json_encode([
        'success' => true,
        'queue_id' => $queueId,
        'assignment_id' => (int)$assignment['assignment_id'],
        'queue_status' => $queueStatus,
        'booking_id' => $relatedBookingId,
        'return_destination' => $isBookingQueue
            ? 'bookings'
            : ($queueStatus === 'cancelled' ? 'queue_history' : 'approved_queue')
    ]);
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    http_response_code(500);
    echo json_encode(['error' => 'Failed to return queue patient: ' . $e->getMessage()]);
}
