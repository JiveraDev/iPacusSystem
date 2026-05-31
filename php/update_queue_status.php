<?php
require_once 'db.php';
require_once __DIR__ . '/booking_queue_helpers.php';
require_once __DIR__ . '/queue_assignment_helpers.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$queue_id = $input['queue_id'] ?? null;
$status = $input['status'] ?? null;

if (!$queue_id || !$status) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing queue_id or status']);
    exit;
}

try {
    $stmt = $pdo->prepare("UPDATE queues SET status = ? WHERE queue_id = ?");
    $stmt->execute([$status, $queue_id]);

    $hasVetQueueAssignments = vetQueueAssignmentsTableExists($pdo);

    if ($hasVetQueueAssignments && in_array($status, ['completed', 'done'], true)) {
        $assignmentStmt = $pdo->prepare("
            UPDATE vet_queue_assignments
            SET status = 'completed',
                completed_at = NOW()
            WHERE queue_id = ?
              AND status = 'received'
        ");
        $assignmentStmt->execute([$queue_id]);
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

    if (in_array($status, ['completed', 'done', 'in-progress'], true)) {
        $queueStmt = $pdo->prepare("SELECT * FROM queues WHERE queue_id = ? LIMIT 1");
        $queueStmt->execute([$queue_id]);
        $queue = $queueStmt->fetch(PDO::FETCH_ASSOC);
        $bookingId = $queue ? bookingIdForQueue($pdo, $queue) : null;

        if ($bookingId) {
            if (in_array($status, ['completed', 'done'], true)) {
                $bookingStmt = $pdo->prepare("UPDATE bookings SET status = 'completed' WHERE booking_id = ? AND status <> 'cancelled'");
                $bookingStmt->execute([$bookingId]);
            } elseif ($status === 'in-progress') {
                $bookingStmt = $pdo->prepare("UPDATE bookings SET status = 'confirmed' WHERE booking_id = ? AND status = 'completed'");
                $bookingStmt->execute([$bookingId]);
            }
        }
    }

    echo json_encode(['success' => true]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
