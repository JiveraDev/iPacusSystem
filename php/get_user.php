<?php
require_once __DIR__ . '/db.php';

$userId = $_GET['userId'] ?? null;

if (!$userId) {
    http_response_code(400);
    echo json_encode(['message' => 'User ID is required.']);
    exit;
}

try {
    $stmt = $pdo->prepare("SELECT * FROM users WHERE user_id = ? LIMIT 1");
    $stmt->execute([$userId]);
    $user = $stmt->fetch();

    if (!$user) {
        http_response_code(404);
        echo json_encode(['message' => 'User not found.']);
        exit;
    }

    // Return a comprehensive object with both DB-style and frontend-style keys
    // to ensure maximum compatibility and no data loss during sync.
    echo json_encode([
        'id' => $user['user_id'],
        'user_id' => $user['user_id'],
        'email' => $user['mail_Address'],
        'mail_Address' => $user['mail_Address'],
        'role' => $user['role'],
        'firstName' => $user['first_Name'],
        'first_Name' => $user['first_Name'],
        'lastName' => $user['last_Name'],
        'last_Name' => $user['last_Name'],
        'address' => $user['personal_Address'],
        'personal_Address' => $user['personal_Address'],
        'phoneNumber' => $user['phoneNumber'],
        'phone' => $user['phoneNumber'],
        'emergencyNumber' => $user['emergencyNumber'],
        'profileImage' => $user['setProfilePic_url'],
        'setProfilePic_url' => $user['setProfilePic_url'],
        'birthdate' => $user['birthdate'],
        'dateOfBirth' => $user['birthdate']
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['message' => 'Failed to fetch user: ' . $e->getMessage()]);
}
