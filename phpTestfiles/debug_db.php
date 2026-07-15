<?php
require_once __DIR__ . '/../php/db.php';
header("Content-Type: application/json");
try {
    $stmt = $pdo->query("DESCRIBE bookings");
    $columns = $stmt->fetchAll();
    echo json_encode($columns);
} catch (Exception $e) {
    echo json_encode(['error' => $e->getMessage()]);
}
