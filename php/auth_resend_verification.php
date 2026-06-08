<?php
require_once __DIR__ . '/auth_otp_helpers.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['message' => 'Method not allowed.']);
    exit;
}

authOtpRequireSchema($pdo);
$input = authOtpInput();
$email = authOtpNormalizeEmail($input['email'] ?? '');

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['message' => 'Valid email is required.']);
    exit;
}

try {
    $user = authOtpFetchUserByEmail($pdo, $email);

    if (!$user) {
        echo json_encode(['success' => true, 'message' => 'If the account needs verification, a code was sent.']);
        exit;
    }

    if (!empty($user['email_verified_at'])) {
        echo json_encode(['success' => true, 'message' => 'This email is already verified.']);
        exit;
    }

    $accountEmail = authOtpNormalizeEmail($user['mail_Address']);

    if (!authOtpCanSend($pdo, (int)$user['user_id'], $accountEmail, AUTH_OTP_EMAIL_VERIFICATION)) {
        http_response_code(429);
        echo json_encode(['message' => 'Please wait before requesting another verification code.']);
        exit;
    }

    $otp = authOtpCreate($pdo, (int)$user['user_id'], $accountEmail, AUTH_OTP_EMAIL_VERIFICATION);
    authOtpSendCodeEmail($accountEmail, $otp['code'], AUTH_OTP_EMAIL_VERIFICATION, $user, $otp['expiresMinutes']);

    echo json_encode(['success' => true, 'message' => 'Verification code sent.']);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['message' => 'Failed to resend verification code: ' . $e->getMessage()]);
}
