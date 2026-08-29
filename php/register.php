<?php
require_once __DIR__ . '/auth_otp_helpers.php';
require_once __DIR__ . '/phone_number_helpers.php';
require_once __DIR__ . '/password_policy_helpers.php';

// Get JSON input
$input = json_decode(file_get_contents('php://input'), true);

$email = authOtpNormalizeEmail($input['email'] ?? '');
$password = $input['password'] ?? null;
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
    echo json_encode(['message' => 'Please accept the Terms of Use and General Service Conditions to register.']);
    exit;
}

if (!ipawcus_password_meets_policy((string)$password)) {
    http_response_code(422);
    echo json_encode(['message' => ipawcus_password_policy_error()]);
    exit;
}

$phoneNumber = rejectInvalidPhilippinePhoneNumber($phoneNumber, 'Phone number');
$emergencyContact = rejectInvalidPhilippinePhoneNumber($emergencyContact, 'Emergency contact', true);

try {
    authOtpRequireSchema($pdo);

    // A previous delivery failure may have already created an unverified
    // self-registration. Never let another unauthenticated registration
    // replace that account's password or profile. Continue to the existing
    // verification flow, where resend cooldowns are enforced separately.
    $stmt = $pdo->prepare("SELECT user_id, role, email_verified_at FROM users WHERE LOWER(mail_Address) = LOWER(?) LIMIT 1");
    $stmt->execute([$email]);
    $existingUser = $stmt->fetch(PDO::FETCH_ASSOC);
    $existingRole = strtolower(str_replace([' ', '-'], '_', trim((string)($existingUser['role'] ?? ''))));
    if ($existingUser && (!empty($existingUser['email_verified_at']) || !in_array($existingRole, ['pet_owner', 'petowner'], true))) {
        http_response_code(409);
        echo json_encode(['message' => 'Email already exists.']);
        exit;
    }

    $verificationResponse = [
        'success' => true,
        'email' => $email,
        'requiresEmailVerification' => true,
        'message' => 'Continue email verification. Check your inbox for your latest code or request a new code from the verification screen.',
    ];

    if ($existingUser) {
        echo json_encode($verificationResponse);
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
        'pet_owner',
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
        'role' => 'pet_owner',
        'email_verified_at' => null,
    ];

    try {
        authOtpIssueAndSend($pdo, $userId, $email, AUTH_OTP_EMAIL_VERIFICATION, $user);
    } catch (Throwable $mailError) {
        // The account still proceeds to verification, where the user may retry.
        // authOtpIssueAndSend retires the failed token so that retry is immediate.
        error_log('Registration verification email delivery failed: ' . $mailError->getMessage());
    }

    echo json_encode($verificationResponse);

} catch (Throwable $e) {
    error_log('Registration request failed: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['message' => 'Registration could not be completed. Please try again.']);
}
