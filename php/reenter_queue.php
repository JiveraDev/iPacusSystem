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

    $activeQueueStmt = $pdo->prepare("
        SELECT queue_id, queue_number, status, timestamp
        FROM queues
        WHERE pet_id = ?
          AND status IN ('waiting', 'in-progress')
        ORDER BY timestamp DESC
    ");
    $activeQueueStmt->execute([$source['pet_id']]);
    $activeQueues = $activeQueueStmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($activeQueues as $active) {
        $queueDate = date('Y-m-d', strtotime($active['timestamp']));
        $todayDate = date('Y-m-d');

        if ($queueDate === $todayDate && (int)$active['queue_id'] !== (int)$queue_id) {
            // Block if another record is active for today
            http_response_code(409);
            echo json_encode([
                'message' => "This pet already has an active queue entry for today (#{$active['queue_number']}).",
                'queue_id' => $active['queue_id'],
                'queue_number' => $active['queue_number'],
                'status' => $active['status']
            ]);
            exit;
        }
    }

    // Cancel other old records for this pet
    $cancelOthers = $pdo->prepare("
        UPDATE queues 
        SET status = 'cancelled' 
        WHERE pet_id = ? 
          AND status IN ('waiting', 'in-progress') 
          AND queue_id != ? 
          AND DATE(timestamp) < CURDATE()
    ");
    $cancelOthers->execute([$source['pet_id'], $queue_id]);

    $maxStmt = $pdo->prepare("SELECT MAX(queue_number) AS max_num FROM queues WHERE DATE(timestamp) = CURDATE()");
    $maxStmt->execute();
    $maxResult = $maxStmt->fetch(PDO::FETCH_ASSOC);
    $new_queue_number = ((int)($maxResult['max_num'] ?? 0)) + 1;

    // Update the record to today
    $updateStmt = $pdo->prepare("
        UPDATE queues 
        SET queue_number = ?, 
            status = 'waiting', 
            timestamp = NOW() 
        WHERE queue_id = ?
    ");
    $updateStmt->execute([$new_queue_number, $queue_id]);

    echo json_encode(['success' => true]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['message' => 'Failed to re-enter queue: ' . $e->getMessage()]);
}

