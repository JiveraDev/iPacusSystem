<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/booking_queue_helpers.php';
require_once __DIR__ . '/queue_assignment_helpers.php';
require_once __DIR__ . '/booking_maintenance.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['message' => 'Method not allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true) ?: [];
$bookingId = isset($_GET['bookingId']) ? (int)$_GET['bookingId'] : 0;
$veterinarianUserId = isset($input['veterinarian_user_id']) ? (int)$input['veterinarian_user_id'] : 0;
$providedVetName = trim((string)($input['veterinarian_name'] ?? ''));
$providedServiceName = trim((string)($input['service_name'] ?? ''));

if ($bookingId <= 0 || $veterinarianUserId <= 0) {
    http_response_code(400);
    echo json_encode(['message' => 'Booking ID and veterinarian_user_id are required.']);
    exit;
}

try {
    requireVetQueueAssignmentsTable($pdo);
    runLifecycleMaintenance($pdo);

    $pdo->beginTransaction();
    $todayDate = maintenance_today($pdo);

    $bookingStmt = $pdo->prepare("
        SELECT
            b.booking_id,
            b.user_id,
            b.pet_id,
            b.booking_number,
            b.service_type,
            b.booking_date,
            b.booking_time,
            b.status,
            b.notes,
            b.is_home_service,
            b.is_online_consultation,
            b.check_in_date,
            b.hotel_boarding_type,
            b.created_at,
            p.pet_status
        FROM bookings b
        LEFT JOIN pets_information p ON p.pet_id = b.pet_id
        WHERE b.booking_id = ?
        LIMIT 1
        FOR UPDATE
    ");
    $bookingStmt->execute([$bookingId]);
    $booking = $bookingStmt->fetch(PDO::FETCH_ASSOC);

    if (!$booking) {
        throw new RuntimeException('Booking not found.');
    }

    if ($booking['status'] !== 'confirmed') {
        http_response_code(409);
        throw new RuntimeException('Only confirmed bookings can be received.');
    }

    if ((int)($booking['pet_id'] ?? 0) <= 0) {
        http_response_code(409);
        throw new RuntimeException('Register this booking pet before receiving it for diagnosis.');
    }

    if (strtolower(trim((string)($booking['pet_status'] ?? ''))) === 'deceased') {
        http_response_code(409);
        throw new RuntimeException('Cannot receive a booking for a deceased pet.');
    }

    if ((string)$booking['booking_date'] !== $todayDate) {
        http_response_code(409);
        throw new RuntimeException('This booking must be scheduled for today before it can be received.');
    }

    $originalBookingDate = maintenance_booking_original_date($booking);
    if ($originalBookingDate !== null && maintenance_is_after($todayDate, maintenance_date_add($originalBookingDate, 7))) {
        http_response_code(409);
        throw new RuntimeException('This booking is outside the 7-day valid booking lifespan and must be reviewed or cancelled.');
    }

    $vetStmt = $pdo->prepare("SELECT first_Name, last_Name FROM users WHERE user_id = ? LIMIT 1");
    $vetStmt->execute([$veterinarianUserId]);
    $vetUser = $vetStmt->fetch(PDO::FETCH_ASSOC);

    if (!$vetUser) {
        http_response_code(404);
        throw new RuntimeException('Veterinarian account not found.');
    }

    $queueColumns = queueTableColumns($pdo);
    $hasBookingIdColumn = in_array('booking_id', $queueColumns, true);
    $hasQueueSourceColumn = in_array('queue_source', $queueColumns, true);
    $hasVerifiedByAdminColumn = in_array('verified_by_admin', $queueColumns, true);
    $marker = bookingQueueMarker((string)$booking['booking_number']);
    $queue = null;

    if ($hasBookingIdColumn) {
        $queueStmt = $pdo->prepare("
            SELECT *
            FROM queues
            WHERE booking_id = ?
              AND status <> 'cancelled'
            ORDER BY queue_id DESC
            LIMIT 1
            FOR UPDATE
        ");
        $queueStmt->execute([$bookingId]);
        $queue = $queueStmt->fetch(PDO::FETCH_ASSOC) ?: null;
    }

    if (!$queue) {
        $queueStmt = $pdo->prepare("
            SELECT *
            FROM queues
            WHERE complaint LIKE ?
              AND status <> 'cancelled'
            ORDER BY queue_id DESC
            LIMIT 1
            FOR UPDATE
        ");
        $queueStmt->execute(['%' . $marker . '%']);
        $queue = $queueStmt->fetch(PDO::FETCH_ASSOC) ?: null;
    }

    $activeQueueStmt = $pdo->prepare("
        SELECT queue_id, queue_number, status
        FROM queues
        WHERE pet_id = ?
          AND status IN ('waiting', 'in-progress')
          AND DATE(timestamp) = CURDATE()
        ORDER BY timestamp DESC
        LIMIT 1
        FOR UPDATE
    ");
    $activeQueueStmt->execute([(int)$booking['pet_id']]);
    $activeQueue = $activeQueueStmt->fetch(PDO::FETCH_ASSOC);

    if ($activeQueue && (!$queue || (int)$activeQueue['queue_id'] !== (int)$queue['queue_id'])) {
        http_response_code(409);
        throw new RuntimeException("This pet already has an active queue entry today (#{$activeQueue['queue_number']}).");
    }

    $activeServiceStmt = $pdo->prepare("
        SELECT q.queue_id, q.queue_number
        FROM queues q
        JOIN vet_queue_assignments vqa ON vqa.queue_id = q.queue_id
        WHERE q.pet_id = ?
          AND q.status = 'in-progress'
          AND vqa.status = 'received'
        ORDER BY q.timestamp DESC
        LIMIT 1
        FOR UPDATE
    ");
    $activeServiceStmt->execute([(int)$booking['pet_id']]);
    $activeServiceQueue = $activeServiceStmt->fetch(PDO::FETCH_ASSOC);

    if ($activeServiceQueue && (!$queue || (int)$activeServiceQueue['queue_id'] !== (int)$queue['queue_id'])) {
        http_response_code(409);
        throw new RuntimeException("This pet is still in service on queue #{$activeServiceQueue['queue_number']}.");
    }

    if ($queue && $hasBookingIdColumn && empty($queue['booking_id'])) {
        $linkQueue = $pdo->prepare("UPDATE queues SET booking_id = ? WHERE queue_id = ?");
        $linkQueue->execute([$bookingId, (int)$queue['queue_id']]);
        $queue['booking_id'] = $bookingId;
    }

    if (!$queue) {
        $maxStmt = $pdo->query("SELECT MAX(queue_number) AS max_num FROM queues WHERE DATE(timestamp) = CURDATE()");
        $newQueueNumber = ((int)($maxStmt->fetch(PDO::FETCH_ASSOC)['max_num'] ?? 0)) + 1;
        $insertColumns = ['pet_id', 'user_id', 'service_name', 'queue_number', 'status', 'priority', 'complaint', 'timestamp'];
        $insertValues = [
            (int)$booking['pet_id'],
            (int)$booking['user_id'],
            $providedServiceName !== '' ? $providedServiceName : $booking['service_type'],
            $newQueueNumber,
            'in-progress',
            'normal',
            buildBookingQueueComplaint($booking)
        ];
        $placeholders = ['?', '?', '?', '?', '?', '?', '?', 'NOW()'];

        if ($hasQueueSourceColumn) {
            $insertColumns[] = 'queue_source';
            $insertValues[] = 'booking_management';
            $placeholders[] = '?';
        }

        if ($hasVerifiedByAdminColumn) {
            $insertColumns[] = 'verified_by_admin';
            $insertValues[] = 1;
            $placeholders[] = '?';
        }

        if ($hasBookingIdColumn) {
            $insertColumns[] = 'booking_id';
            $insertValues[] = $bookingId;
            $placeholders[] = '?';
        }

        $insertQueue = $pdo->prepare(sprintf(
            "INSERT INTO queues (%s) VALUES (%s)",
            implode(', ', $insertColumns),
            implode(', ', $placeholders)
        ));
        $insertQueue->execute($insertValues);

        $queueStmt = $pdo->prepare("SELECT * FROM queues WHERE queue_id = ? LIMIT 1");
        $queueStmt->execute([(int)$pdo->lastInsertId()]);
        $queue = $queueStmt->fetch(PDO::FETCH_ASSOC);
    } elseif ($queue['status'] !== 'in-progress') {
        $updateQueue = $pdo->prepare("UPDATE queues SET status = 'in-progress', timestamp = NOW() WHERE queue_id = ?");
        $updateQueue->execute([(int)$queue['queue_id']]);
        $queue['status'] = 'in-progress';
        $queue['timestamp'] = date('Y-m-d H:i:s');
    }

    $activeAssignmentStmt = $pdo->prepare("
        SELECT assignment_id, queue_id, veterinarian_user_id, veterinarian_name, status, received_at
        FROM vet_queue_assignments
        WHERE queue_id = ?
          AND status = 'received'
        ORDER BY assignment_id DESC
        LIMIT 1
        FOR UPDATE
    ");
    $activeAssignmentStmt->execute([(int)$queue['queue_id']]);
    $assignment = $activeAssignmentStmt->fetch(PDO::FETCH_ASSOC);

    if ($assignment) {
        http_response_code(409);
        throw new RuntimeException('This booking has already been received by a veterinarian.');
    }

    $veterinarianName = $providedVetName !== '' ? $providedVetName : normalizeVetName($vetUser);
    $insertAssignment = $pdo->prepare("
        INSERT INTO vet_queue_assignments (queue_id, veterinarian_user_id, veterinarian_name, status, received_at)
        VALUES (?, ?, ?, 'received', NOW())
    ");
    $insertAssignment->execute([(int)$queue['queue_id'], $veterinarianUserId, $veterinarianName]);

    $assignmentStmt = $pdo->prepare("
        SELECT assignment_id, queue_id, veterinarian_user_id, veterinarian_name, status, received_at
        FROM vet_queue_assignments
        WHERE assignment_id = ?
        LIMIT 1
    ");
    $assignmentStmt->execute([(int)$pdo->lastInsertId()]);
    $assignment = $assignmentStmt->fetch(PDO::FETCH_ASSOC);

    $pdo->commit();

    $responseQueue = $queue;
    $responseQueue['queue_source'] = $queue['queue_source'] ?? 'booking_management';
    $responseQueue['assignment_id'] = $assignment['assignment_id'] ?? null;
    $responseQueue['veterinarian_user_id'] = $assignment['veterinarian_user_id'] ?? null;
    $responseQueue['veterinarian_name'] = $assignment['veterinarian_name'] ?? null;
    $responseQueue['assignment_status'] = $assignment['status'] ?? null;
    $responseQueue['received_at'] = $assignment['received_at'] ?? null;
    $responseQueue['has_active_assignment'] = $assignment ? 1 : 0;

    echo json_encode([
        'success' => true,
        'queue' => $responseQueue,
        'assignment' => $assignment
    ]);
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    if (http_response_code() < 400) {
        http_response_code(500);
    }

    echo json_encode(['message' => 'Failed to receive booking: ' . $e->getMessage()]);
}
