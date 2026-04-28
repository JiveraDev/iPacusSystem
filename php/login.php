<?php
require_once __DIR__ . '/db.php';

// Get JSON input
$input = json_decode(file_get_contents('php://input'), true);

$email = $input['email'] ?? null;
$password = $input['password'] ?? null;

if (!$email || !$password) {
    http_response_code(400);
    echo json_encode(['message' => 'Email and password are required.']);
    exit;
}

try {
    $stmt = $pdo->prepare("
        SELECT 
            user_id, 
            mail_Address, 
            role, 
            first_Name, 
            last_Name, 
            personal_Address, 
            phoneNumber, 
            emergencyNumber, 
            user_password,
            setProfilePic_url,
            birthdate
        FROM users 
        WHERE mail_Address = ? 
        LIMIT 1
    ");
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['user_password'])) {
        http_response_code(401);
        echo json_encode(['message' => 'Invalid email or password.']);
        exit;
    }

    echo json_encode([
        'message' => 'Login successful.',
        'access_token' => 'dummy-token-' . bin2hex(random_bytes(16)),
        'user' => [
            'id' => $user['user_id'],
            'email' => $user['mail_Address'],
            'role' => $user['role'],
            'firstName' => $user['first_Name'],
            'lastName' => $user['last_Name'],
            'address' => $user['personal_Address'],
            'phoneNumber' => $user['phoneNumber'],
            'emergencyNumber' => $user['emergencyNumber'],
            'profileImage' => $user['setProfilePic_url'],
            'birthdate' => $user['birthdate']
        ]
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['message' => $e->getMessage() ?: 'Failed to find user.']);
}
