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
    echo json_encode(['message' => 'Email and 6-digit verification code are required.']);
    exit;
}

try {
    $verification = authOtpVerify($pdo, $email, AUTH_OTP_EMAIL_VERIFICATION, $code);

    if (!$verification['valid']) {
        http_response_code(400);
        echo json_encode(['message' => $verification['message']]);
        exit;
    }

    $otp = $verification['otp'];
    $pdo->beginTransaction();
    $stmt = $pdo->prepare("UPDATE users SET email_verified_at = NOW() WHERE user_id = ? AND email_verified_at IS NULL");
    $stmt->execute([(int)$otp['user_id']]);
    authOtpMarkUsed($pdo, (int)$otp['otp_id']);
    $pdo->commit();

    echo json_encode(['success' => true, 'message' => 'Email verified. You can now log in.']);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['message' => 'Failed to verify email: ' . $e->getMessage()]);
}
