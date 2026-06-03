<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/queue_assignment_helpers.php';

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

if ($queueId <= 0 || $veterinarianUserId <= 0) {
    http_response_code(400);
    echo json_encode(['error' => 'queue_id and veterinarian_user_id are required.']);
    exit;
}

try {
    requireVetQueueAssignmentsTable($pdo);

    $pdo->beginTransaction();

    $queueStmt = $pdo->prepare("SELECT queue_id, status FROM queues WHERE queue_id = ? FOR UPDATE");
    $queueStmt->execute([$queueId]);
    $queue = $queueStmt->fetch(PDO::FETCH_ASSOC);

    if (!$queue) {
        $pdo->rollBack();
        http_response_code(404);
        echo json_encode(['error' => 'Queue item not found.']);
        exit;
    }

    if (in_array($queue['status'], ['completed', 'done', 'cancelled'], true)) {
        $pdo->rollBack();
        http_response_code(409);
        echo json_encode(['error' => 'Completed or cancelled queue items cannot be assigned.']);
        exit;
    }

    $vetStmt = $pdo->prepare("SELECT first_Name, last_Name FROM users WHERE user_id = ? LIMIT 1");
    $vetStmt->execute([$veterinarianUserId]);
    $vetUser = $vetStmt->fetch(PDO::FETCH_ASSOC);

    if (!$vetUser) {
        $pdo->rollBack();
        http_response_code(404);
        echo json_encode(['error' => 'Veterinarian account not found.']);
        exit;
    }

    $veterinarianName = $providedVetName !== '' ? $providedVetName : normalizeVetName($vetUser);

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

    if ($activeAssignment && (int)$activeAssignment['veterinarian_user_id'] === $veterinarianUserId) {
        $queueUpdate = $pdo->prepare("UPDATE queues SET status = 'in-progress' WHERE queue_id = ?");
        $queueUpdate->execute([$queueId]);
        $pdo->commit();

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

    $pdo->commit();

    echo json_encode([
        'success' => true,
        'assignment' => $assignment
    ]);
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    http_response_code(500);
    echo json_encode(['error' => 'Failed to assign queue veterinarian: ' . $e->getMessage()]);
}
