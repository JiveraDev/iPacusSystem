<?php
require_once __DIR__ . '/db.php';

header("Content-Type: application/json");

try {
    // 1. Fetch Veterinarians
    $vetSql = "SELECT u.*, v.* 
               FROM users u 
               JOIN veterinarian_profiles v ON u.user_id = v.user_id 
               WHERE u.role = 'Veterinarian'";
    $vetStmt = $pdo->query($vetSql);
    $veterinarians = $vetStmt->fetchAll();

    // 2. Fetch Admin/Staff
    $staffSql = "SELECT u.*, a.* 
                 FROM users u 
                 JOIN admin_profiles a ON u.user_id = a.user_id 
                 WHERE u.role = 'Admin'";
    $staffStmt = $pdo->query($staffSql);
    $staff = $staffStmt->fetchAll();

    echo json_encode([
        'veterinarians' => $veterinarians,
        'staff' => $staff
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['message' => 'Failed to fetch accounts: ' . $e->getMessage()]);
}
