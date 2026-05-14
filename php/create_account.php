<?php
require_once __DIR__ . '/db.php';

// Get JSON input
$input = json_decode(file_get_contents('php://input'), true);

$firstName = $input['firstName'] ?? null;
$lastName = $input['lastName'] ?? null;
$email = $input['email'] ?? null;
$password = $input['password'] ?? null;
$role = $input['role'] ?? null; // 'Veterinarian' or 'Admin'

// Common Profile Fields
$hireDate = $input['hireDate'] ?? date('Y-m-d');

// Vet Specific
$licenseNumber = $input['licenseNumber'] ?? null;
$specialization = $input['specialization'] ?? 'General Practice';

// Staff Specific
$position = $input['position'] ?? 'Staff';
$employmentStatus = $input['employmentStatus'] ?? 'full-time';

if (!$firstName || !$lastName || !$email || !$password || !$role) {
    http_response_code(400);
    echo json_encode(['message' => 'Missing required fields for account creation.']);
    exit;
}

try {
    $pdo->beginTransaction();

    // Hash the password for security
    $hashedPassword = password_hash($password, PASSWORD_DEFAULT);

    // 1. Insert into users table
    // Using default/test values for fields not provided in the admin creation form
    $userStmt = $pdo->prepare("
        INSERT INTO users (first_Name, last_Name, mail_Address, personal_Address, user_password, phoneNumber, role, created_at) 
        VALUES (?, ?, ?, 'Clinic Address Placeholder', ?, '000-000-0000', ?, NOW())
    ");
    $userStmt->execute([$firstName, $lastName, $email, $hashedPassword, $role]);
    $userId = $pdo->lastInsertId();

    if ($role === 'Veterinarian') {
        // 2. Insert into veterinarian_profiles
        $vetId = 'VET-' . strtoupper(bin2hex(random_bytes(3)));
        $vetStmt = $pdo->prepare("
            INSERT INTO veterinarian_profiles (user_id, veterinarian_id, prc_license_number, specialization, hire_date, is_active) 
            VALUES (?, ?, ?, ?, ?, 1)
        ");
        $vetStmt->execute([$userId, $vetId, $licenseNumber, $specialization, $hireDate]);
    } else {
        // 3. Insert into admin_profiles
        $empId = 'EMP-' . strtoupper(bin2hex(random_bytes(3)));
        $adminStmt = $pdo->prepare("
            INSERT INTO admin_profiles (user_id, employee_id, hire_date, employment_status, postionn) 
            VALUES (?, ?, ?, ?, ?)
        ");
        $adminStmt->execute([$userId, $empId, $hireDate, $employmentStatus, $position]);
    }

    $pdo->commit();

    echo json_encode([
        'message' => 'Account created successfully.',
        'user_id' => $userId
    ]);

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['message' => 'Failed to create account: ' . $e->getMessage()]);
}
