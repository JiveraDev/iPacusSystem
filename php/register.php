<?php
require_once __DIR__ . '/db.php';

// Get JSON input
$input = json_decode(file_get_contents('php://input'), true);

$email = $input['email'] ?? null;
$password = $input['password'] ?? null;
$role = $input['role'] ?? null;
$firstName = $input['firstName'] ?? null;
$lastName = $input['lastName'] ?? null;
$address = $input['address'] ?? null;
$phoneNumber = $input['phoneNumber'] ?? null;
$emergencyContact = $input['emergencyContact'] ?? null;

if (!$email || !$password || !$firstName || !$lastName || !$address || !$phoneNumber) {
    http_response_code(400);
    echo json_encode(['message' => 'Missing required user fields.']);
    exit;
}

try {
    // Check if email exists
    $stmt = $pdo->prepare("SELECT user_id FROM users WHERE mail_Address = ? LIMIT 1");
    $stmt->execute([$email]);
    if ($stmt->fetch()) {
        http_response_code(409);
        echo json_encode(['message' => 'Email already exists.']);
        exit;
    }

    // Hash password
    $passwordHash = password_hash($password, PASSWORD_BCRYPT);

    // Insert user
    $sql = "INSERT INTO users 
                (mail_Address, user_password, role, first_Name, last_Name, personal_Address, phoneNumber, emergencyNumber) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        $email,
        $passwordHash,
        $role,
        $firstName,
        $lastName,
        $address,
        $phoneNumber,
        $emergencyContact
    ]);

    http_response_code(201);
    echo json_encode([
        'id' => $pdo->lastInsertId(),
        'message' => 'User created successfully.'
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['message' => $e->getMessage() ?: 'Failed to create user.']);
}
