<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/mail_helpers.php';

const AUTH_OTP_EMAIL_VERIFICATION = 'email_verification';
const AUTH_OTP_PASSWORD_RESET = 'password_reset';
const AUTH_OTP_PASSWORD_CHANGE = 'password_change';
const AUTH_OTP_PAYMENT_SETTINGS_CHANGE = 'payment_settings_change';

function authOtpColumnExists(PDO $pdo, string $tableName, string $columnName): bool
{
    static $cache = [];
    $cacheKey = $tableName . '.' . $columnName;

    if (array_key_exists($cacheKey, $cache)) {
        return $cache[$cacheKey];
    }

    $stmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = ?
          AND column_name = ?
    ");
    $stmt->execute([$tableName, $columnName]);
    $cache[$cacheKey] = (int)$stmt->fetchColumn() > 0;

    return $cache[$cacheKey];
}

function authOtpTableExists(PDO $pdo, string $tableName): bool
{
    static $cache = [];

    if (array_key_exists($tableName, $cache)) {
        return $cache[$tableName];
    }

    $stmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM information_schema.tables
        WHERE table_schema = DATABASE()
          AND table_name = ?
    ");
    $stmt->execute([$tableName]);
    $cache[$tableName] = (int)$stmt->fetchColumn() > 0;

    return $cache[$tableName];
}

function authOtpRequireSchema(PDO $pdo): void
{
    if (!authOtpTableExists($pdo, 'email_otp_tokens') || !authOtpColumnExists($pdo, 'users', 'email_verified_at')) {
        http_response_code(500);
        echo json_encode(['message' => 'Email OTP database migration is required.']);
        exit;
    }
}

function authOtpInput(): array
{
    $input = json_decode(file_get_contents('php://input'), true);

    return is_array($input) ? $input : [];
}

function authOtpNormalizeEmail($email): string
{
    return strtolower(trim((string)$email));
}

function authOtpClientIp(): ?string
{
    $ip = $_SERVER['HTTP_X_CLIENT_PUBLIC_IP'] ?? $_SERVER['REMOTE_ADDR'] ?? null;

    return $ip ? substr((string)$ip, 0, 45) : null;
}

function authOtpUserAgent(): ?string
{
    $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? null;

    return $userAgent ? substr((string)$userAgent, 0, 255) : null;
}

function authOtpSecret(): string
{
    $secret = getenv('OTP_SECRET') ?: getenv('VITE_MASTER_KEY') ?: '';

    if ($secret === '') {
        throw new RuntimeException('OTP secret is not configured.');
    }

    return $secret;
}

function authOtpHash(string $email, string $purpose, string $code): string
{
    return hash_hmac('sha256', authOtpNormalizeEmail($email) . '|' . $purpose . '|' . trim($code), authOtpSecret());
}

function authOtpGenerateCode(): string
{
    return (string)random_int(100000, 999999);
}

function authOtpFetchUserByEmail(PDO $pdo, string $email): ?array
{
    $stmt = $pdo->prepare("
        SELECT user_id, mail_Address, first_Name, last_Name, role, email_verified_at
        FROM users
        WHERE LOWER(mail_Address) = LOWER(?)
        LIMIT 1
    ");
    $stmt->execute([$email]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    return $user ?: null;
}

function authOtpDisplayName(?array $user, string $fallback = 'there'): string
{
    if (!$user) {
        return $fallback;
    }

    $name = trim((string)($user['first_Name'] ?? '') . ' ' . (string)($user['last_Name'] ?? ''));

    return $name !== '' ? $name : $fallback;
}

function authOtpInvalidateActive(PDO $pdo, ?int $userId, string $email, string $purpose): void
{
    $stmt = $pdo->prepare("
        UPDATE email_otp_tokens
        SET used_at = NOW()
        WHERE purpose = ?
          AND used_at IS NULL
          AND LOWER(email) = LOWER(?)
          AND (user_id <=> ?)
    ");
    $stmt->execute([$purpose, $email, $userId]);
}

function authOtpCanSend(PDO $pdo, ?int $userId, string $email, string $purpose): bool
{
    $cooldownSeconds = max(15, (int)(getenv('OTP_RESEND_COOLDOWN_SECONDS') ?: 60));
    $stmt = $pdo->prepare("
        SELECT TIMESTAMPDIFF(SECOND, last_sent_at, NOW()) AS seconds_since_sent
        FROM email_otp_tokens
        WHERE purpose = ?
          AND LOWER(email) = LOWER(?)
          AND (user_id <=> ?)
          AND used_at IS NULL
          AND last_sent_at IS NOT NULL
        ORDER BY otp_id DESC
        LIMIT 1
    ");
    $stmt->execute([$purpose, $email, $userId]);
    $secondsSinceSent = $stmt->fetchColumn();

    if ($secondsSinceSent === false || $secondsSinceSent === null) {
        return true;
    }

    return (int)$secondsSinceSent >= $cooldownSeconds;
}

function authOtpCreate(PDO $pdo, ?int $userId, string $email, string $purpose): array
{
    $email = authOtpNormalizeEmail($email);
    $expiresMinutes = max(5, (int)(getenv('OTP_EXPIRES_MINUTES') ?: 10));
    $maxAttempts = max(3, (int)(getenv('OTP_MAX_ATTEMPTS') ?: 5));
    $code = authOtpGenerateCode();
    $tokenHash = authOtpHash($email, $purpose, $code);

    authOtpInvalidateActive($pdo, $userId, $email, $purpose);

    $stmt = $pdo->prepare("
        INSERT INTO email_otp_tokens
            (user_id, email, purpose, token_hash, expires_at, max_attempts, last_sent_at, request_ip, user_agent)
        VALUES
            (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL {$expiresMinutes} MINUTE), ?, NOW(), ?, ?)
    ");
    $stmt->execute([
        $userId,
        $email,
        $purpose,
        $tokenHash,
        $maxAttempts,
        authOtpClientIp(),
        authOtpUserAgent(),
    ]);

    return [
        'otpId' => (int)$pdo->lastInsertId(),
        'code' => $code,
        'expiresMinutes' => $expiresMinutes,
    ];
}

function authOtpVerify(PDO $pdo, string $email, string $purpose, string $code): array
{
    $email = authOtpNormalizeEmail($email);
    $tokenHash = authOtpHash($email, $purpose, $code);
    $stmt = $pdo->prepare("
        SELECT otp_id, user_id, email, purpose, token_hash, expires_at, used_at, attempt_count, max_attempts
        FROM email_otp_tokens
        WHERE purpose = ?
          AND LOWER(email) = LOWER(?)
          AND used_at IS NULL
        ORDER BY otp_id DESC
        LIMIT 1
    ");
    $stmt->execute([$purpose, $email]);
    $otp = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$otp) {
        return ['valid' => false, 'message' => 'Invalid or expired verification code.'];
    }

    if (strtotime((string)$otp['expires_at']) < time()) {
        $markExpired = $pdo->prepare("UPDATE email_otp_tokens SET used_at = NOW() WHERE otp_id = ?");
        $markExpired->execute([(int)$otp['otp_id']]);

        return ['valid' => false, 'message' => 'Verification code expired. Request a new code.'];
    }

    if ((int)$otp['attempt_count'] >= (int)$otp['max_attempts']) {
        return ['valid' => false, 'message' => 'Too many attempts. Request a new code.'];
    }

    if (!hash_equals((string)$otp['token_hash'], $tokenHash)) {
        $increment = $pdo->prepare("UPDATE email_otp_tokens SET attempt_count = attempt_count + 1 WHERE otp_id = ?");
        $increment->execute([(int)$otp['otp_id']]);

        return ['valid' => false, 'message' => 'Invalid verification code.'];
    }

    return ['valid' => true, 'otp' => $otp];
}

function authOtpMarkUsed(PDO $pdo, int $otpId): void
{
    $stmt = $pdo->prepare("UPDATE email_otp_tokens SET used_at = NOW() WHERE otp_id = ?");
    $stmt->execute([$otpId]);
}

function authOtpSendCodeEmail(string $email, string $code, string $purpose, ?array $user = null, int $expiresMinutes = 10): void
{
    $name = htmlspecialchars(authOtpDisplayName($user), ENT_QUOTES, 'UTF-8');
    $safeCode = htmlspecialchars($code, ENT_QUOTES, 'UTF-8');
    $safeMinutes = (int)$expiresMinutes;
    $subject = 'Verify your iPawcus email';
    $heading = 'Email verification code';
    $reason = 'Use this code to verify your email address and activate your iPawcus account.';

    if ($purpose === AUTH_OTP_PASSWORD_RESET) {
        $subject = 'Your iPawcus password reset code';
        $heading = 'Password reset code';
        $reason = 'Use this code to reset your iPawcus password.';
    } elseif ($purpose === AUTH_OTP_PAYMENT_SETTINGS_CHANGE) {
        $subject = 'Confirm payment settings change';
        $heading = 'Payment settings code';
        $reason = 'Use this code to confirm changes to clinic payment account details.';
    }
    $html = "
        <div style=\"font-family: Arial, sans-serif; color: #111827; line-height: 1.5;\">
            <h1 style=\"font-size: 20px; margin: 0 0 12px;\">{$heading}</h1>
            <p>Hello {$name},</p>
            <p>{$reason}</p>
            <div style=\"font-size: 28px; font-weight: 700; letter-spacing: 6px; margin: 20px 0; color: #155dfc;\">{$safeCode}</div>
            <p>This code expires in {$safeMinutes} minutes.</p>
            <p>If you did not request this code, you can ignore this email.</p>
        </div>
    ";
    $text = "{$heading}\n\nHello " . authOtpDisplayName($user) . ",\n\n{$reason}\n\nCode: {$code}\n\nThis code expires in {$safeMinutes} minutes.";

    send_smtp_email($email, $subject, $html, $text);
}

function authOtpSendPasswordChangedEmail(string $email, ?array $user = null): void
{
    $name = htmlspecialchars(authOtpDisplayName($user), ENT_QUOTES, 'UTF-8');
    $html = "
        <div style=\"font-family: Arial, sans-serif; color: #111827; line-height: 1.5;\">
            <h1 style=\"font-size: 20px; margin: 0 0 12px;\">Your password was changed</h1>
            <p>Hello {$name},</p>
            <p>Your iPawcus password was changed successfully.</p>
            <p>If this was not you, contact Vetfocus Animal Care Clinic immediately.</p>
        </div>
    ";
    $text = "Your password was changed.\n\nIf this was not you, contact Vetfocus Animal Care Clinic immediately.";

    send_smtp_email($email, 'Your iPawcus password was changed', $html, $text);
}
