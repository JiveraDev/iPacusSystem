<?php
require_once __DIR__ . '/auth_otp_helpers.php';
require_once __DIR__ . '/phone_number_helpers.php';

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
$termsAccepted = filter_var($input['termsAccepted'] ?? false, FILTER_VALIDATE_BOOLEAN);

if (!$email || !$password || !$firstName || !$lastName || !$address || !$phoneNumber) {
    http_response_code(400);
    echo json_encode(['message' => 'Missing required user fields.']);
    exit;
}

if (!$termsAccepted) {
    http_response_code(400);
    echo json_encode(['message' => 'Please accept the Terms of Use to register.']);
    exit;
}

$phoneNumber = rejectInvalidPhilippinePhoneNumber($phoneNumber, 'Phone number');
$emergencyContact = rejectInvalidPhilippinePhoneNumber($emergencyContact, 'Emergency contact', true);

try {
    authOtpRequireSchema($pdo);

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

    // Insert public self-registration as unverified. Email OTP activates the account.
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

    $userId = (int)$pdo->lastInsertId();
    $user = [
        'user_id' => $userId,
        'mail_Address' => $email,
        'first_Name' => $firstName,
        'last_Name' => $lastName,
        'role' => $role,
        'email_verified_at' => null,
    ];
    $emailSent = true;
    $emailWarning = null;

    try {
        $otp = authOtpCreate($pdo, $userId, $email, AUTH_OTP_EMAIL_VERIFICATION);
        authOtpSendCodeEmail($email, $otp['code'], AUTH_OTP_EMAIL_VERIFICATION, $user, $otp['expiresMinutes']);
    } catch (Throwable $mailError) {
        $emailSent = false;
        $emailWarning = mail_env_bool('MAIL_DEBUG', false)
            ? $mailError->getMessage()
            : 'Account was created, but the verification email could not be sent. Please request a new code.';
    }

    http_response_code(201);
    echo json_encode([
        'id' => $userId,
        'email' => $email,
        'requiresEmailVerification' => true,
        'emailSent' => $emailSent,
        'message' => $emailSent
            ? 'User created successfully. Verification code sent.'
            : $emailWarning,
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['message' => $e->getMessage() ?: 'Failed to create user.']);
}
