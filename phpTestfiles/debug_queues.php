<?php
require_once __DIR__ . '/../php/db.php';

header("Content-Type: application/json");

try {
    $stmt = $pdo->query("DESCRIBE queues");
    $columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode($columns);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
