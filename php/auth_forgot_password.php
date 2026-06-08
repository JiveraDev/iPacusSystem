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
$genericMessage = 'If this email exists, a password reset code was sent.';

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['message' => 'Valid email is required.']);
    exit;
}

try {
    $user = authOtpFetchUserByEmail($pdo, $email);

    if ($user) {
        $accountEmail = authOtpNormalizeEmail($user['mail_Address']);

        if (authOtpCanSend($pdo, (int)$user['user_id'], $accountEmail, AUTH_OTP_PASSWORD_RESET)) {
            $otp = authOtpCreate($pdo, (int)$user['user_id'], $accountEmail, AUTH_OTP_PASSWORD_RESET);
            authOtpSendCodeEmail($accountEmail, $otp['code'], AUTH_OTP_PASSWORD_RESET, $user, $otp['expiresMinutes']);
        }
    }

    echo json_encode(['success' => true, 'message' => $genericMessage]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['message' => mail_env_bool('MAIL_DEBUG', false) ? $e->getMessage() : $genericMessage]);
}
