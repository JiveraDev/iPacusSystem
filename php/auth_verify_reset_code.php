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
$code = trim((string)($input['code'] ?? ''));

if (!filter_var($email, FILTER_VALIDATE_EMAIL) || !preg_match('/^\d{6}$/', $code)) {
    http_response_code(400);
    echo json_encode(['message' => 'Email and a 6-digit verification code are required.']);
    exit;
}

try {
    $verification = authOtpVerify($pdo, $email, AUTH_OTP_PASSWORD_RESET, $code);

    if (!$verification['valid']) {
        http_response_code(400);
        echo json_encode(['message' => $verification['message']]);
        exit;
    }

    $otp = $verification['otp'];
    $user = authOtpFetchUserByEmail($pdo, $email);

    if (!$user || (int)$user['user_id'] !== (int)$otp['user_id']) {
        http_response_code(400);
        echo json_encode(['message' => 'Invalid or expired verification code.']);
        exit;
    }

    echo json_encode([
        'success' => true,
        'message' => 'Verification code confirmed. You can now create a new password.',
    ]);
} catch (Throwable $error) {
    http_response_code(500);
    echo json_encode(['message' => 'Failed to verify the password reset code.']);
}
