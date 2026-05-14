<?php
require_once 'db.php';

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

    echo json_encode(['success' => true]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
