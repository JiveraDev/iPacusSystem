<?php
require_once __DIR__ . '/db.php';

header("Content-Type: application/json");

$userId = $_GET['userId'] ?? null;
$role = $_GET['role'] ?? null;

if (!$userId || !$role) {
    http_response_code(400);
    echo json_encode(['message' => 'User ID and Role are required.']);
    exit;
}

try {
    $normalizedRole = strtolower(str_replace([' ', '-'], '_', trim((string)$role)));

    if ($normalizedRole === 'veterinarian' || $normalizedRole === 'vet') {
        $sql = "SELECT u.*, v.* 
                FROM users u 
                LEFT JOIN veterinarian_profiles v ON u.user_id = v.user_id 
                WHERE u.user_id = ?";
    } elseif ($normalizedRole === 'admin' || $normalizedRole === 'super_admin' || $normalizedRole === 'superadmin') {
        $sql = "SELECT u.*, a.* 
                FROM users u 
                LEFT JOIN admin_profiles a ON u.user_id = a.user_id 
                WHERE u.user_id = ?";
    } else {
        $sql = "SELECT u.*
                FROM users u
                WHERE u.user_id = ?";
    }

    $stmt = $pdo->prepare($sql);
    $stmt->execute([$userId]);
    $profile = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$profile) {
        http_response_code(404);
        echo json_encode(['message' => 'Profile not found.']);
        exit;
    }

    echo json_encode($profile);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['message' => 'Failed to fetch profile: ' . $e->getMessage()]);
}
