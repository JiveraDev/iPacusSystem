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
$returnReason = trim((string)($input['return_reason'] ?? ''));

if ($queueId <= 0 || $veterinarianUserId <= 0) {
    http_response_code(400);
    echo json_encode(['error' => 'queue_id and veterinarian_user_id are required.']);
    exit;
}

try {
    requireVetQueueAssignmentsTable($pdo);

    $pdo->beginTransaction();

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

    if ((int)$assignment['veterinarian_user_id'] !== $veterinarianUserId) {
        $pdo->rollBack();
        http_response_code(403);
        echo json_encode(['error' => 'Only the receiving veterinarian can return this patient to the approved list.']);
        exit;
    }

    $updateStmt = $pdo->prepare("
        UPDATE vet_queue_assignments
        SET status = 'returned',
            returned_at = NOW(),
            return_reason = ?
        WHERE assignment_id = ?
    ");
    $updateStmt->execute([$returnReason !== '' ? $returnReason : null, $assignment['assignment_id']]);

    $pdo->commit();

    echo json_encode([
        'success' => true,
        'queue_id' => $queueId,
        'assignment_id' => (int)$assignment['assignment_id']
    ]);
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    http_response_code(500);
    echo json_encode(['error' => 'Failed to return queue patient: ' . $e->getMessage()]);
}
