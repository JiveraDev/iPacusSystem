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
$genericResponse = [
    'success' => true,
    'message' => $genericMessage,
    'expiresInSeconds' => authOtpExpiresMinutes() * 60,
];

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['message' => 'Valid email is required.']);
    exit;
}

try {
    $user = authOtpFetchUserByEmail($pdo, $email);

    if ($user) {
        $accountEmail = authOtpNormalizeEmail($user['mail_Address']);

        if (!authOtpCanSend($pdo, (int)$user['user_id'], $accountEmail, AUTH_OTP_PASSWORD_RESET)) {
            echo json_encode($genericResponse);
            exit;
        }

        try {
            authOtpIssueAndSend($pdo, (int)$user['user_id'], $accountEmail, AUTH_OTP_PASSWORD_RESET, $user);
        } catch (Throwable $mailError) {
            // Keep this endpoint indistinguishable for known and unknown emails.
            // authOtpIssueAndSend already retires the failed token so a genuine
            // retry is not trapped behind the resend cooldown.
            error_log('Password reset email delivery failed: ' . $mailError->getMessage());
        }
    }

    echo json_encode($genericResponse);
} catch (Throwable $e) {
    error_log('Password reset request failed: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['message' => 'The password reset request could not be processed. Please try again.']);
}
