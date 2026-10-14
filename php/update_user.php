<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/phone_number_helpers.php';

$userId = $_GET['userId'] ?? null;

if (!$userId) {
    http_response_code(400);
    echo json_encode(['message' => 'User ID is required.']);
    exit;
}

// Get JSON input
$input = json_decode(file_get_contents('php://input'), true);

if (!$input) {
    http_response_code(400);
    echo json_encode(['message' => 'No data provided for update.']);
    exit;
}

try {
    // Build the query dynamically based on provided fields
    $fields = [];
    $params = [];

    if (isset($input['firstName'])) {
        $fields[] = "first_Name = ?";
        $params[] = $input['firstName'];
    }
    if (isset($input['lastName'])) {
        $fields[] = "last_Name = ?";
        $params[] = $input['lastName'];
    }
    if (isset($input['phoneNumber'])) {
        $fields[] = "phoneNumber = ?";
        $params[] = rejectInvalidPhilippinePhoneNumber($input['phoneNumber'], 'Phone number', true);
    }
    if (isset($input['address'])) {
        $fields[] = "personal_Address = ?";
        $params[] = $input['address'];
    }
    if (isset($input['dateOfBirth'])) {
        $fields[] = "birthdate = ?";
        $params[] = $input['dateOfBirth'];
    }
    if (isset($input['profileImage'])) {
        $fields[] = "setProfilePic_url = ?";
        $params[] = $input['profileImage'];
    }

    if (empty($fields)) {
        http_response_code(400);
        echo json_encode(['message' => 'No valid fields provided for update.']);
        exit;
    }

    $params[] = $userId;
    $sql = "UPDATE users SET " . implode(', ', $fields) . " WHERE user_id = ?";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    // Fetch the updated user data to return to the frontend
    $stmt = $pdo->prepare("SELECT * FROM users WHERE user_id = ? LIMIT 1");
    $stmt->execute([$userId]);
    $user = $stmt->fetch();

    echo json_encode([
        'message' => 'User profile updated successfully.',
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
    echo json_encode(['message' => 'Failed to update user: ' . $e->getMessage()]);
}
