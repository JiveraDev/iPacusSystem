<?php
require_once __DIR__ . '/db.php';

header("Content-Type: application/json");

$petId = $_GET['petId'] ?? null;

if (!$petId) {
    http_response_code(400);
    echo json_encode(['message' => 'Pet ID is required.']);
    exit;
}

try {
    $whereColumn = strpos((string)$petId, 'PET-') === 0 ? 'p.pet_sharable_ID' : 'p.pet_id';
    $columnsStmt = $pdo->query("SHOW COLUMNS FROM queues");
    $columns = $columnsStmt->fetchAll(PDO::FETCH_COLUMN);
    $hasQueueSource = in_array('queue_source', $columns, true);
    $queueSourceSelect = $hasQueueSource ? "q.queue_source" : "'admin'";

    $stmt = $pdo->prepare("
        SELECT
            q.queue_id,
            q.pet_id,
            q.service_name,
            q.queue_number,
            q.status,
            q.priority,
            q.complaint,
            q.timestamp,
            {$queueSourceSelect} AS queue_source
        FROM queues q
        JOIN pets_information p ON q.pet_id = p.pet_id
        WHERE {$whereColumn} = ?
        ORDER BY q.timestamp DESC
    ");
    $stmt->execute([$petId]);

    echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['message' => 'Failed to fetch pet queues: ' . $e->getMessage()]);
}
