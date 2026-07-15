<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/queue_assignment_helpers.php';
require_once __DIR__ . '/notification_helpers.php';
require_once __DIR__ . '/booking_maintenance.php';
require_once __DIR__ . '/workflow_guard_helpers.php';

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
$currentApiUser = ipawcus_guard_current_user($pdo);
$currentApiRole = ipawcus_guard_role($currentApiUser);
$currentApiUserId = ipawcus_guard_user_id($currentApiUser);

if ($currentApiRole === 'veterinarian') {
    if ($veterinarianUserId > 0 && $veterinarianUserId !== $currentApiUserId) {
        http_response_code(403);
        echo json_encode(['error' => 'Veterinarians can only receive queues under their own account.']);
        exit;
    }
    $veterinarianUserId = $currentApiUserId;
}

if ($queueId <= 0 || $veterinarianUserId <= 0) {
    http_response_code(400);
    echo json_encode(['error' => 'queue_id and veterinarian_user_id are required.']);
    exit;
}

try {
    requireVetQueueAssignmentsTable($pdo);
    runLifecycleMaintenance($pdo);

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

    if ($queue['status'] !== 'in-progress') {
        $pdo->rollBack();
        http_response_code(409);
        echo json_encode(['error' => 'Only approved queue patients can be received.']);
        exit;
    }

    $activeStmt = $pdo->prepare("
        SELECT assignment_id, veterinarian_user_id, veterinarian_name
        FROM vet_queue_assignments
        WHERE queue_id = ?
          AND status = 'received'
        ORDER BY assignment_id DESC
        LIMIT 1
    ");
    $activeStmt->execute([$queueId]);
    $activeAssignment = $activeStmt->fetch(PDO::FETCH_ASSOC);

    if ($activeAssignment) {
        $pdo->rollBack();
        http_response_code(409);
        echo json_encode([
            'error' => 'This patient has already been received by a veterinarian.',
            'assignment' => $activeAssignment
        ]);
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

    try {
        notification_send_queue_event($pdo, $queueId, 'received', [
            'veterinarian_name' => $veterinarianName,
        ]);
    } catch (Throwable $notificationError) {
        error_log('Queue receive notification failed: ' . $notificationError->getMessage());
    }

    echo json_encode([
        'success' => true,
        'assignment' => $assignment
    ]);
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    http_response_code(500);
    echo json_encode(['error' => 'Failed to receive queue patient: ' . $e->getMessage()]);
}
