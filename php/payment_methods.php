<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/auth_otp_helpers.php';

header('Content-Type: application/json');

const PAYMENT_METHOD_KEYS = ['qrph', 'maya', 'gcash', 'bank_transfer'];

function payment_methods_input(): array
{
    $input = json_decode(file_get_contents('php://input'), true);

    return is_array($input) ? $input : [];
}

function payment_methods_error(int $statusCode, string $message): void
{
    http_response_code($statusCode);
    echo json_encode(['success' => false, 'message' => $message]);
    exit;
}

function payment_methods_column_type(PDO $pdo, string $tableName, string $columnName): string
{
    $stmt = $pdo->prepare("
        SELECT COLUMN_TYPE
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = ?
          AND column_name = ?
        LIMIT 1
    ");
    $stmt->execute([$tableName, $columnName]);

    return (string)($stmt->fetchColumn() ?: '');
}

function payment_methods_ensure_schema(PDO $pdo): void
{
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS payment_methods (
            method_key VARCHAR(40) NOT NULL PRIMARY KEY,
            label VARCHAR(80) NOT NULL,
            account_name VARCHAR(140) NULL,
            account_number VARCHAR(140) NULL,
            instructions TEXT NULL,
            qr_image_url VARCHAR(255) NULL,
            is_active TINYINT(1) NOT NULL DEFAULT 1,
            requires_proof TINYINT(1) NOT NULL DEFAULT 1,
            sort_order INT NOT NULL DEFAULT 0,
            updated_by_user_id INT NULL,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            KEY payment_methods_sort_idx (is_active, sort_order),
            KEY payment_methods_updated_by_idx (updated_by_user_id)
        )
    ");

    $defaults = [
        ['qrph', 'QRPH', 'iPawcus Veterinary', '', 'Scan the QRPH code, then upload a clear screenshot of the successful transaction.', 10],
        ['maya', 'Maya', 'iPawcus Veterinary', '', 'Send payment to the Maya account, then upload a clear screenshot of the successful transaction.', 20],
        ['gcash', 'GCash', 'iPawcus Veterinary', '', 'Send payment to the GCash account, then upload a clear screenshot of the successful transaction.', 30],
        ['bank_transfer', 'Bank Transfer', 'iPawcus Veterinary', '', 'Transfer to the clinic bank account, then upload a clear screenshot or receipt.', 40],
    ];

    $stmt = $pdo->prepare("
        INSERT IGNORE INTO payment_methods (
            method_key,
            label,
            account_name,
            account_number,
            instructions,
            is_active,
            requires_proof,
            sort_order
        ) VALUES (?, ?, ?, ?, ?, 1, 1, ?)
    ");

    foreach ($defaults as $method) {
        $stmt->execute($method);
    }
}

function payment_methods_ensure_otp_purpose(PDO $pdo): void
{
    if (!authOtpTableExists($pdo, 'email_otp_tokens')) {
        payment_methods_error(500, 'Email OTP database migration is required.');
    }

    $columnType = payment_methods_column_type($pdo, 'email_otp_tokens', 'purpose');
    if ($columnType !== '' && strpos($columnType, AUTH_OTP_PAYMENT_SETTINGS_CHANGE) === false) {
        $pdo->exec("
            ALTER TABLE email_otp_tokens
            MODIFY purpose ENUM('email_verification','password_reset','password_change','payment_settings_change') NOT NULL
        ");
    }
}

function payment_methods_user(PDO $pdo, array $input): array
{
    $userId = $input['userId'] ?? $input['user_id'] ?? null;
    $email = authOtpNormalizeEmail($input['email'] ?? '');

    if ($userId !== null && $userId !== '' && is_numeric($userId)) {
        $stmt = $pdo->prepare("
            SELECT user_id, mail_Address, first_Name, last_Name, role
            FROM users
            WHERE user_id = ?
            LIMIT 1
        ");
        $stmt->execute([(int)$userId]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
    } elseif ($email !== '') {
        $stmt = $pdo->prepare("
            SELECT user_id, mail_Address, first_Name, last_Name, role
            FROM users
            WHERE LOWER(mail_Address) = LOWER(?)
            LIMIT 1
        ");
        $stmt->execute([$email]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
    } else {
        $user = null;
    }

    if (!$user) {
        payment_methods_error(404, 'Super Admin account was not found.');
    }

    $role = strtolower(str_replace(['_', '-'], ' ', (string)($user['role'] ?? '')));
    if ($role !== 'super admin') {
        payment_methods_error(403, 'Only Super Admin can change payment methods.');
    }

    return $user;
}

function payment_methods_row(array $row): array
{
    return [
        'key' => $row['method_key'],
        'methodKey' => $row['method_key'],
        'value' => $row['method_key'],
        'label' => $row['label'],
        'accountName' => $row['account_name'] ?? '',
        'accountNumber' => $row['account_number'] ?? '',
        'instructions' => $row['instructions'] ?? '',
        'qrImageUrl' => $row['qr_image_url'] ?? '',
        'isActive' => (int)$row['is_active'] === 1,
        'requiresProof' => (int)$row['requires_proof'] === 1,
        'sortOrder' => (int)$row['sort_order'],
        'updatedByUserId' => $row['updated_by_user_id'] !== null ? (int)$row['updated_by_user_id'] : null,
        'updatedAt' => $row['updated_at'],
    ];
}

function payment_methods_fetch(PDO $pdo, bool $includeInactive = false): array
{
    payment_methods_ensure_schema($pdo);

    $where = $includeInactive ? '' : 'WHERE is_active = 1';
    $stmt = $pdo->query("
        SELECT *
        FROM payment_methods
        {$where}
        ORDER BY sort_order ASC, FIELD(method_key, 'qrph', 'maya', 'gcash', 'bank_transfer')
    ");

    return array_map('payment_methods_row', $stmt->fetchAll(PDO::FETCH_ASSOC));
}

function payment_methods_request_otp(PDO $pdo, array $input): void
{
    payment_methods_ensure_otp_purpose($pdo);
    authOtpRequireSchema($pdo);

    $user = payment_methods_user($pdo, $input);
    $email = authOtpNormalizeEmail($user['mail_Address'] ?? '');

    if (!authOtpCanSend($pdo, (int)$user['user_id'], $email, AUTH_OTP_PAYMENT_SETTINGS_CHANGE)) {
        payment_methods_error(429, 'Please wait before requesting another code.');
    }

    $otp = authOtpCreate($pdo, (int)$user['user_id'], $email, AUTH_OTP_PAYMENT_SETTINGS_CHANGE);
    authOtpSendCodeEmail($email, $otp['code'], AUTH_OTP_PAYMENT_SETTINGS_CHANGE, $user, $otp['expiresMinutes']);

    echo json_encode([
        'success' => true,
        'message' => 'Verification code sent to the Super Admin email.',
        'email' => $email,
        'expiresMinutes' => $otp['expiresMinutes'],
    ]);
}

function payment_methods_save(PDO $pdo, array $input): void
{
    $skipOtp = filter_var($input['skipOtp'] ?? $input['disableOtp'] ?? false, FILTER_VALIDATE_BOOLEAN);
    $user = payment_methods_user($pdo, $input);
    $email = authOtpNormalizeEmail($input['email'] ?? $user['mail_Address'] ?? '');
    $code = trim((string)($input['code'] ?? $input['otp'] ?? ''));
    $otp = null;

    if (!$skipOtp) {
        payment_methods_ensure_otp_purpose($pdo);
        authOtpRequireSchema($pdo);

        if (!filter_var($email, FILTER_VALIDATE_EMAIL) || !preg_match('/^\d{6}$/', $code)) {
            payment_methods_error(400, 'Super Admin email and 6-digit OTP code are required.');
        }

        if (strtolower($email) !== strtolower((string)$user['mail_Address'])) {
            payment_methods_error(403, 'OTP email must match the Super Admin account email.');
        }

        $verification = authOtpVerify($pdo, $email, AUTH_OTP_PAYMENT_SETTINGS_CHANGE, $code);
        if (!$verification['valid']) {
            payment_methods_error(400, $verification['message']);
        }

        $otp = $verification['otp'];
        if ((int)$otp['user_id'] !== (int)$user['user_id']) {
            payment_methods_error(403, 'OTP code does not match the Super Admin account.');
        }
    }

    $methods = $input['methods'] ?? [];
    if (!is_array($methods)) {
        payment_methods_error(400, 'Payment methods payload is invalid.');
    }

    $byKey = [];
    foreach ($methods as $method) {
        if (!is_array($method)) {
            continue;
        }

        $key = $method['methodKey'] ?? $method['key'] ?? $method['value'] ?? '';
        if (!in_array($key, PAYMENT_METHOD_KEYS, true)) {
            continue;
        }

        $byKey[$key] = $method;
    }

    foreach (PAYMENT_METHOD_KEYS as $requiredKey) {
        if (!isset($byKey[$requiredKey])) {
            payment_methods_error(400, 'All payment methods must be included.');
        }

        $method = $byKey[$requiredKey];
        $label = trim((string)($method['label'] ?? ''));
        if ($label === '') {
            payment_methods_error(400, 'Payment method label is required.');
        }

        $accountNumber = preg_replace('/\D+/', '', (string)($method['accountNumber'] ?? $method['account_number'] ?? ''));

        $byKey[$requiredKey]['_normalizedLabel'] = $label;
        $byKey[$requiredKey]['_normalizedAccountNumber'] = $accountNumber;
    }

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare("
            UPDATE payment_methods
            SET label = ?,
                account_name = ?,
                account_number = ?,
                instructions = ?,
                qr_image_url = ?,
                is_active = 1,
                requires_proof = 1,
                sort_order = ?,
                updated_by_user_id = ?
            WHERE method_key = ?
        ");

        $sortOrder = 10;
        foreach (PAYMENT_METHOD_KEYS as $key) {
            $method = $byKey[$key];
            $label = $method['_normalizedLabel'];
            $accountNumber = $method['_normalizedAccountNumber'];

            $stmt->execute([
                $label,
                trim((string)($method['accountName'] ?? $method['account_name'] ?? '')) ?: null,
                $accountNumber ?: null,
                trim((string)($method['instructions'] ?? '')) ?: null,
                trim((string)($method['qrImageUrl'] ?? $method['qr_image_url'] ?? '')) ?: null,
                $sortOrder,
                (int)$user['user_id'],
                $key,
            ]);
            $sortOrder += 10;
        }

        if (!$skipOtp && $otp) {
            authOtpMarkUsed($pdo, (int)$otp['otp_id']);
        }
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }

    echo json_encode([
        'success' => true,
        'message' => $skipOtp ? 'Payment methods updated with OTP bypass enabled.' : 'Payment methods updated.',
        'methods' => payment_methods_fetch($pdo, true),
    ]);
}

try {
    payment_methods_ensure_schema($pdo);

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $includeInactive = in_array(strtolower((string)($_GET['includeInactive'] ?? '')), ['1', 'true', 'yes'], true);
        echo json_encode([
            'success' => true,
            'methods' => payment_methods_fetch($pdo, $includeInactive),
        ]);
        exit;
    }

    $input = payment_methods_input();

    if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_GET['action'] ?? '') === 'otp') {
        payment_methods_request_otp($pdo, $input);
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] === 'PATCH' || $_SERVER['REQUEST_METHOD'] === 'POST') {
        payment_methods_save($pdo, $input);
        exit;
    }

    payment_methods_error(405, 'Method not allowed.');
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Payment methods request failed: ' . $e->getMessage(),
    ]);
}
