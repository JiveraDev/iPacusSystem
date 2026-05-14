<?php
require_once __DIR__ . '/php/db.php';
header("Content-Type: application/json");
try {
    $stmt = $pdo->query("SELECT * FROM bookings");
    $bookings = $stmt->fetchAll();
    
    $stmtUsers = $pdo->query("SELECT user_id, first_Name, last_Name FROM users");
    $users = $stmtUsers->fetchAll();
    
    echo json_encode([
        'bookings' => $bookings,
        'users' => $users,
        'count' => count($bookings)
    ]);
} catch (Exception $e) {
    echo json_encode(['error' => $e->getMessage()]);
}
