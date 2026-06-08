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
$newPassword = (string)($input['newPassword'] ?? '');

if (!filter_var($email, FILTER_VALIDATE_EMAIL) || !preg_match('/^\d{6}$/', $code) || strlen($newPassword) < 8) {
    http_response_code(400);
    echo json_encode(['message' => 'Email, 6-digit code, and a new password of at least 8 characters are required.']);
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

    $passwordHash = password_hash($newPassword, PASSWORD_DEFAULT);
    $pdo->beginTransaction();
    $passwordColumnSql = authOtpColumnExists($pdo, 'users', 'password_changed_at')
        ? 'UPDATE users SET user_password = ?, password_changed_at = NOW() WHERE user_id = ?'
        : 'UPDATE users SET user_password = ? WHERE user_id = ?';
    $stmt = $pdo->prepare($passwordColumnSql);
    $stmt->execute([$passwordHash, (int)$user['user_id']]);
    authOtpMarkUsed($pdo, (int)$otp['otp_id']);
    $pdo->commit();

    try {
        authOtpSendPasswordChangedEmail($email, $user);
    } catch (Throwable $mailError) {
        // Password reset succeeded. Do not fail the response because the notification failed.
    }

    echo json_encode(['success' => true, 'message' => 'Password changed. You can now log in.']);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['message' => 'Failed to reset password: ' . $e->getMessage()]);
}
