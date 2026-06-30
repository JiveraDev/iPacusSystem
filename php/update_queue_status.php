<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/booking_queue_helpers.php';
require_once __DIR__ . '/queue_assignment_helpers.php';
require_once __DIR__ . '/notification_helpers.php';
require_once __DIR__ . '/booking_maintenance.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$queue_id = $input['queue_id'] ?? null;
$status = isset($input['status']) ? strtolower(trim((string)$input['status'])) : null;

if (!$queue_id || !$status) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing queue_id or status']);
    exit;
}

$allowedQueueStatuses = ['waiting', 'in-progress', 'completed', 'cancelled'];
if (!in_array($status, $allowedQueueStatuses, true)) {
    http_response_code(400);
    echo json_encode([
        'error' => 'Invalid queue status.',
        'allowedStatuses' => $allowedQueueStatuses
    ]);
    exit;
}

if ($status === 'completed') {
    http_response_code(409);
    echo json_encode([
        'error' => 'Queues can only be completed by saving a veterinarian diagnosis so visit billing is created in the same transaction.'
    ]);
    exit;
}

try {
    runLifecycleMaintenance($pdo);

    $stmt = $pdo->prepare("UPDATE queues SET status = ? WHERE queue_id = ?");
    $stmt->execute([$status, $queue_id]);

    $hasVetQueueAssignments = vetQueueAssignmentsTableExists($pdo);

    if ($hasVetQueueAssignments && $status === 'cancelled') {
        maintenance_return_active_queue_assignment($pdo, (int)$queue_id, 'Queue cancelled');
    } elseif ($hasVetQueueAssignments && $status === 'in-progress') {
        $latestStmt = $pdo->prepare("
            SELECT assignment_id
            FROM vet_queue_assignments
            WHERE queue_id = ?
              AND status = 'completed'
            ORDER BY assignment_id DESC
            LIMIT 1
        ");
        $latestStmt->execute([$queue_id]);
        $latestAssignmentId = $latestStmt->fetchColumn();

        if ($latestAssignmentId) {
            $reopenStmt = $pdo->prepare("
                UPDATE vet_queue_assignments
                SET status = 'received',
                    completed_at = NULL,
                    returned_at = NULL
                WHERE assignment_id = ?
            ");
            $reopenStmt->execute([$latestAssignmentId]);
        }
    }

    if ($status === 'in-progress') {
        $queueStmt = $pdo->prepare("SELECT * FROM queues WHERE queue_id = ? LIMIT 1");
        $queueStmt->execute([$queue_id]);
        $queue = $queueStmt->fetch(PDO::FETCH_ASSOC);
        $bookingId = $queue ? bookingIdForQueue($pdo, $queue) : null;

        if ($bookingId) {
            $bookingStmt = $pdo->prepare("UPDATE bookings SET status = 'confirmed' WHERE booking_id = ? AND status = 'completed'");
            $bookingStmt->execute([$bookingId]);
        }
    }

    if ($status === 'cancelled') {
        $queueStmt = $pdo->prepare("SELECT pet_id FROM queues WHERE queue_id = ? LIMIT 1");
        $queueStmt->execute([$queue_id]);
        $petId = (int)($queueStmt->fetchColumn() ?: 0);

        if ($petId > 0) {
            runLifecycleMaintenance($pdo, $petId);
        }
    }

    try {
        $event = $status === 'in-progress' ? 'in_progress' : $status;
        notification_send_queue_event($pdo, (int)$queue_id, $event);
    } catch (Throwable $notificationError) {
        error_log('Queue status notification failed: ' . $notificationError->getMessage());
    }

    echo json_encode(['success' => true]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
