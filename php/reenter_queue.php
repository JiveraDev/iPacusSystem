<?php
require_once __DIR__ . '/db.php';

header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);
$queue_id = $data['queue_id'] ?? null;

if (!$queue_id) {
    http_response_code(400);
    echo json_encode(['message' => 'queue_id is required']);
    exit;
}

try {
    $sourceStmt = $pdo->prepare("
        SELECT pet_id, user_id, service_name, priority, complaint
        FROM queues
        WHERE queue_id = ?
        LIMIT 1
    ");
    $sourceStmt->execute([$queue_id]);
    $source = $sourceStmt->fetch(PDO::FETCH_ASSOC);

    if (!$source) {
        http_response_code(404);
        echo json_encode(['message' => 'Queue item not found']);
        exit;
    }

    $maxStmt = $pdo->prepare("SELECT MAX(queue_number) AS max_num FROM queues WHERE DATE(timestamp) = CURDATE()");
    $maxStmt->execute();
    $maxResult = $maxStmt->fetch(PDO::FETCH_ASSOC);
    $new_queue_number = ((int)($maxResult['max_num'] ?? 0)) + 1;

    $insertStmt = $pdo->prepare("
        INSERT INTO queues (pet_id, user_id, service_name, queue_number, status, priority, complaint, timestamp)
        VALUES (?, ?, ?, ?, 'waiting', ?, ?, NOW())
    ");
    $insertStmt->execute([
        $source['pet_id'],
        $source['user_id'],
        $source['service_name'],
        $new_queue_number,
        $source['priority'] ?? 'normal',
        $source['complaint'] ?? ''
    ]);

    echo json_encode(['success' => true]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['message' => 'Failed to re-enter queue: ' . $e->getMessage()]);
}

