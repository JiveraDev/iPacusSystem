<?php
require_once __DIR__ . '/db.php';

$userId = $_GET['userId'] ?? null;
$input = json_decode(file_get_contents('php://input'), true);

if (!$userId) {
    http_response_code(400);
    echo json_encode(['message' => 'User ID is required.']);
    exit;
}

if (!$input) {
    http_response_code(400);
    echo json_encode(['message' => 'No data provided.']);
    exit;
}

$currentPassword = $input['currentPassword'] ?? '';
$newPassword = $input['newPassword'] ?? '';

if (!$currentPassword || !$newPassword) {
    http_response_code(400);
    echo json_encode(['message' => 'Current password and new password are required.']);
    exit;
}

if (strlen($newPassword) < 8) {
    http_response_code(400);
    echo json_encode(['message' => 'New password must be at least 8 characters.']);
    exit;
}

try {
    $stmt = $pdo->prepare('SELECT user_password FROM users WHERE user_id = ? LIMIT 1');
    $stmt->execute([$userId]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user || !password_verify($currentPassword, $user['user_password'])) {
        http_response_code(401);
        echo json_encode(['message' => 'Current password is incorrect.']);
        exit;
    }

    $hashedPassword = password_hash($newPassword, PASSWORD_DEFAULT);
    $stmt = $pdo->prepare('UPDATE users SET user_password = ? WHERE user_id = ?');
    $stmt->execute([$hashedPassword, $userId]);

    echo json_encode(['message' => 'Password changed successfully.']);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['message' => 'Failed to change password: ' . $e->getMessage()]);
}
