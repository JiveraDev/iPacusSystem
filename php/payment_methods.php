<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/role_access.php';
require_once __DIR__ . '/auth_otp_helpers.php';
require_once __DIR__ . '/notification_helpers.php';
require_once __DIR__ . '/payment_method_helpers.php';

header('Content-Type: application/json');

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

function payment_methods_table_exists(PDO $pdo, string $tableName): bool
{
    $stmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM information_schema.tables
        WHERE table_schema = DATABASE()
          AND table_name = ?
    ");
    $stmt->execute([$tableName]);

    return (int)$stmt->fetchColumn() > 0;
}

function payment_methods_column_exists(PDO $pdo, string $tableName, string $columnName): bool
{
    $stmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = ?
          AND column_name = ?
    ");
    $stmt->execute([$tableName, $columnName]);

    return (int)$stmt->fetchColumn() > 0;
}

function payment_methods_ensure_schema(PDO $pdo): void
{
    if (!payment_methods_table_exists($pdo, 'payment_methods')) {
        payment_methods_error(500, 'payment_methods table is missing. Run the approved deployment SQL before managing payment methods.');
    }

    $missingColumns = [];
    foreach ([
        'method_key',
        'label',
        'account_name',
        'account_number',
        'account_number_encrypted',
        'method_type',
        'instructions',
        'qr_image_url',
        'is_active',
        'requires_proof',
        'sort_order',
        'updated_by_user_id',
        'updated_at',
        'created_at',
    ] as $columnName) {
        if (!payment_methods_column_exists($pdo, 'payment_methods', $columnName)) {
            $missingColumns[] = $columnName;
        }
    }

    if (!empty($missingColumns)) {
        payment_methods_error(
            500,
            'payment_methods table is missing required columns: ' . implode(', ', $missingColumns) . '. Run the approved deployment SQL.'
        );
    }

    $defaults = [
        ['qrph', 'QRPH', 'ewallet', 'Vetfocus Animal Care Clinic', '', 'Scan the QRPH code, then upload a clear screenshot of the successful transaction.', 10],
        ['maya', 'Maya', 'ewallet', 'Vetfocus Animal Care Clinic', '', 'Send payment to the Maya account, then upload a clear screenshot of the successful transaction.', 20],
        ['gcash', 'GCash', 'ewallet', 'Vetfocus Animal Care Clinic', '', 'Send payment to the GCash account, then upload a clear screenshot of the successful transaction.', 30],
        ['bank_transfer', 'Bank Transfer', 'bank_transfer', 'Vetfocus Animal Care Clinic', '', 'Transfer to the clinic bank account, then upload a clear screenshot or receipt.', 40],
    ];

    $stmt = $pdo->prepare("
        INSERT IGNORE INTO payment_methods (
            method_key,
            label,
            method_type,
            account_name,
            account_number,
            instructions,
            is_active,
            requires_proof,
            sort_order
        ) VALUES (?, ?, ?, ?, ?, ?, 1, 1, ?)
    ");

    foreach ($defaults as $method) {
        $stmt->execute($method);
    }
}

function payment_methods_encryption_key(): string
{
    $secret = trim((string)(getenv('PAYMENT_DETAILS_KEY') ?: ($_ENV['PAYMENT_DETAILS_KEY'] ?? '')));
    if (strlen($secret) < 32) {
        payment_methods_error(503, 'Payment detail encryption is not configured. Set PAYMENT_DETAILS_KEY to a private value of at least 32 characters.');
    }

    return hash('sha256', $secret, true);
}

function payment_methods_encrypt(?string $plainText): ?string
{
    $plainText = trim((string)$plainText);
    if ($plainText === '') {
        return null;
    }

    $iv = random_bytes(12);
    $tag = '';
    $cipherText = openssl_encrypt(
        $plainText,
        'aes-256-gcm',
        payment_methods_encryption_key(),
        OPENSSL_RAW_DATA,
        $iv,
        $tag,
        'ipawcus-payment-details-v1',
        16
    );
    if ($cipherText === false) {
        throw new RuntimeException('Payment account number could not be encrypted.');
    }

    return 'v1:' . base64_encode($iv . $tag . $cipherText);
}

function payment_methods_decrypt(?string $payload, ?string $legacyPlainText = null): string
{
    $payload = trim((string)$payload);
    if ($payload === '') {
        return preg_replace('/\D+/', '', (string)$legacyPlainText);
    }
    if (!str_starts_with($payload, 'v1:')) {
        return '';
    }

    $decoded = base64_decode(substr($payload, 3), true);
    if ($decoded === false || strlen($decoded) < 29) {
        return '';
    }
    $iv = substr($decoded, 0, 12);
    $tag = substr($decoded, 12, 16);
    $cipherText = substr($decoded, 28);
    $plainText = openssl_decrypt(
        $cipherText,
        'aes-256-gcm',
        payment_methods_encryption_key(),
        OPENSSL_RAW_DATA,
        $iv,
        $tag,
        'ipawcus-payment-details-v1'
    );

    return $plainText === false ? '' : preg_replace('/\D+/', '', $plainText);
}

function payment_methods_type($value): string
{
    $type = strtolower(trim((string)$value));
    return $type === 'bank_transfer' ? 'bank_transfer' : 'ewallet';
}

function payment_methods_validate_account_number(string $type, string $accountNumber, string $label): void
{
    if ($accountNumber === '') {
        return;
    }

    if ($type === 'ewallet' && !preg_match('/^09\d{9}$/', $accountNumber)) {
        payment_methods_error(422, $label . ' must use an 11-digit Philippine mobile number beginning with 09.');
    }
    if ($type === 'bank_transfer' && (strlen($accountNumber) < 6 || strlen($accountNumber) > 17)) {
        payment_methods_error(422, $label . ' bank account number must contain 6 to 17 digits.');
    }
}

function payment_methods_ensure_otp_purpose(PDO $pdo): void
{
    if (!authOtpTableExists($pdo, 'email_otp_tokens')) {
        payment_methods_error(500, 'Email OTP database migration is required.');
    }

    $missingColumns = [];
    foreach ([
        'otp_id',
        'user_id',
        'email',
        'purpose',
        'token_hash',
        'expires_at',
        'used_at',
        'attempt_count',
        'max_attempts',
        'last_sent_at',
        'request_ip',
        'user_agent',
    ] as $columnName) {
        if (!authOtpColumnExists($pdo, 'email_otp_tokens', $columnName)) {
            $missingColumns[] = $columnName;
        }
    }
    if (!empty($missingColumns)) {
        payment_methods_error(
            500,
            'Email OTP table is missing required columns: ' . implode(', ', $missingColumns) . '. Run the approved deployment SQL.'
        );
    }

    $columnType = payment_methods_column_type($pdo, 'email_otp_tokens', 'purpose');
    if ($columnType !== '' && strpos($columnType, AUTH_OTP_PAYMENT_SETTINGS_CHANGE) === false) {
        payment_methods_error(500, 'email_otp_tokens.purpose does not support payment_settings_change. Run the approved deployment SQL before editing payment settings.');
    }
}

function payment_methods_user(PDO $pdo, array $input = []): array
{
    unset($input);

    $currentUser = ipawcus_require_current_api_user($pdo);
    $currentUserId = (int)($currentUser['user_id'] ?? 0);

    if ($currentUserId <= 0) {
        payment_methods_error(401, 'Please log in again to continue.');
    }

    $role = ipawcus_access_normalize_role($currentUser['role'] ?? '');
    if ($role !== 'super_admin') {
        payment_methods_error(403, 'Only Super Admin can change payment methods.');
    }

    $stmt = $pdo->prepare("
        SELECT user_id, mail_Address, first_Name, last_Name, role
        FROM users
        WHERE user_id = ?
        LIMIT 1
    ");
    $stmt->execute([$currentUserId]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        payment_methods_error(404, 'Authenticated Super Admin account was not found.');
    }

    return $user;
}

function payment_methods_row(array $row): array
{
    $accountNumber = payment_methods_decrypt(
        $row['account_number_encrypted'] ?? null,
        $row['account_number'] ?? null
    );
    $maskedAccountNumber = $accountNumber;
    if (strlen($accountNumber) > 6) {
        $maskedAccountNumber = substr($accountNumber, 0, 3)
            . str_repeat('*', max(4, strlen($accountNumber) - 6))
            . substr($accountNumber, -3);
    }

    return [
        'key' => $row['method_key'],
        'methodKey' => $row['method_key'],
        'value' => $row['method_key'],
        'label' => $row['label'],
        'methodType' => payment_methods_type($row['method_type'] ?? null),
        'accountName' => $row['account_name'] ?? '',
        'accountNumber' => $accountNumber,
        'maskedAccountNumber' => $maskedAccountNumber,
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
        ORDER BY sort_order ASC, label ASC, method_key ASC
    ");

    return array_map('payment_methods_row', $stmt->fetchAll(PDO::FETCH_ASSOC));
}

function payment_methods_request_otp(PDO $pdo, array $input): void
{
    payment_methods_ensure_otp_purpose($pdo);

    $user = payment_methods_user($pdo, $input);
    $email = authOtpNormalizeEmail($user['mail_Address'] ?? '');
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        payment_methods_error(422, 'The Super Admin account needs a valid email address before a verification code can be sent.');
    }

    if (!authOtpCanSend($pdo, (int)$user['user_id'], $email, AUTH_OTP_PAYMENT_SETTINGS_CHANGE)) {
        payment_methods_error(429, 'Please wait before requesting another code.');
    }

    $otp = null;
    try {
        $otp = authOtpCreate($pdo, (int)$user['user_id'], $email, AUTH_OTP_PAYMENT_SETTINGS_CHANGE);
        authOtpSendCodeEmail($email, $otp['code'], AUTH_OTP_PAYMENT_SETTINGS_CHANGE, $user, $otp['expiresMinutes']);
    } catch (Throwable $error) {
        if (!empty($otp['otpId'])) {
            authOtpMarkUsed($pdo, (int)$otp['otpId']);
        }
        error_log('Payment settings OTP delivery failed: ' . $error->getMessage());
        payment_methods_error(
            503,
            'Verification email could not be delivered. Check OTP_SECRET and the clinic mail settings, then try again.'
        );
    }

    echo json_encode([
        'success' => true,
        'message' => 'Verification code sent to the Super Admin email.',
        'email' => $email,
        'expiresMinutes' => $otp['expiresMinutes'],
    ]);
}

function payment_methods_save(PDO $pdo, array $input): void
{
    payment_methods_encryption_key();
    $user = payment_methods_user($pdo, $input);
    $email = authOtpNormalizeEmail($input['email'] ?? $user['mail_Address'] ?? '');
    $code = trim((string)($input['code'] ?? $input['otp'] ?? ''));

    payment_methods_ensure_otp_purpose($pdo);

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

    $methods = $input['methods'] ?? [];
    if (!is_array($methods)) {
        payment_methods_error(400, 'Payment methods payload is invalid.');
    }

    $normalizedMethods = [];
    $activeCount = 0;
    foreach ($methods as $index => $method) {
        if (!is_array($method)) {
            continue;
        }

        $label = trim((string)($method['label'] ?? ''));
        $key = ipawcus_payment_method_key($method['methodKey'] ?? $method['key'] ?? $method['value'] ?? $label);
        if ($label === '' || strlen($label) > 100) {
            payment_methods_error(422, 'Every payment method needs a display name of 100 characters or fewer.');
        }
        if ($key === '' || strlen($key) > 64) {
            payment_methods_error(422, $label . ' needs a valid method key of 64 characters or fewer.');
        }
        if (isset($normalizedMethods[$key])) {
            payment_methods_error(422, 'Payment method names must be unique.');
        }

        $type = payment_methods_type($method['methodType'] ?? $method['method_type'] ?? null);
        $accountNumber = preg_replace('/\D+/', '', (string)($method['accountNumber'] ?? $method['account_number'] ?? ''));
        payment_methods_validate_account_number($type, $accountNumber, $label);
        $isActive = !array_key_exists('isActive', $method) || filter_var($method['isActive'], FILTER_VALIDATE_BOOL);
        if ($isActive) {
            $activeCount++;
        }

        $normalizedMethods[$key] = [
            'methodKey' => $key,
            'label' => $label,
            'methodType' => $type,
            'accountName' => trim((string)($method['accountName'] ?? $method['account_name'] ?? '')),
            'accountNumber' => $accountNumber,
            'instructions' => trim((string)($method['instructions'] ?? '')),
            'qrImageUrl' => trim((string)($method['qrImageUrl'] ?? $method['qr_image_url'] ?? '')),
            'isActive' => $isActive,
            'sortOrder' => ($index + 1) * 10,
        ];
    }
    if (!$normalizedMethods || $activeCount === 0) {
        payment_methods_error(422, 'Keep at least one payment method active.');
    }

    $previousMethodsByKey = [];
    foreach (payment_methods_fetch($pdo, true) as $previousMethod) {
        $previousMethodsByKey[$previousMethod['methodKey']] = $previousMethod;
    }
    $changedMethodLabels = [];
    foreach ($normalizedMethods as $key => $method) {
        $previous = $previousMethodsByKey[$key] ?? [];
        $before = [
            'label' => trim((string)($previous['label'] ?? '')),
            'methodType' => payment_methods_type($previous['methodType'] ?? null),
            'accountName' => trim((string)($previous['accountName'] ?? '')),
            'accountNumber' => preg_replace('/\D+/', '', (string)($previous['accountNumber'] ?? '')),
            'instructions' => trim((string)($previous['instructions'] ?? '')),
            'qrImageUrl' => trim((string)($previous['qrImageUrl'] ?? '')),
            'isActive' => (bool)($previous['isActive'] ?? false),
        ];
        $after = array_intersect_key($method, $before);
        if ($before !== $after) {
            $changedMethodLabels[] = $method['label'];
        }
    }

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare("
            INSERT INTO payment_methods (
                method_key, label, method_type, account_name, account_number,
                account_number_encrypted, instructions, qr_image_url, is_active,
                requires_proof, sort_order, updated_by_user_id
            ) VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, 1, ?, ?)
            ON DUPLICATE KEY UPDATE
                label = VALUES(label),
                method_type = VALUES(method_type),
                account_name = VALUES(account_name),
                account_number = NULL,
                account_number_encrypted = VALUES(account_number_encrypted),
                instructions = VALUES(instructions),
                qr_image_url = VALUES(qr_image_url),
                is_active = VALUES(is_active),
                requires_proof = 1,
                sort_order = VALUES(sort_order),
                updated_by_user_id = VALUES(updated_by_user_id)
        ");

        foreach ($normalizedMethods as $method) {
            $stmt->execute([
                $method['methodKey'],
                $method['label'],
                $method['methodType'],
                $method['accountName'] ?: null,
                payment_methods_encrypt($method['accountNumber']),
                $method['instructions'] ?: null,
                $method['qrImageUrl'] ?: null,
                $method['isActive'] ? 1 : 0,
                $method['sortOrder'],
                (int)$user['user_id'],
            ]);
        }

        authOtpMarkUsed($pdo, (int)$otp['otp_id']);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }

    if ($changedMethodLabels) {
        try {
            $actorName = trim((string)(($user['first_Name'] ?? '') . ' ' . ($user['last_Name'] ?? ''))) ?: 'Super Admin';
            $methodList = implode(', ', array_values(array_unique($changedMethodLabels)));
            notification_send_super_admin_governance_event($pdo, [
                'type' => 'payment_methods_updated',
                'category' => 'configuration_updates',
                'title' => 'Payment methods updated',
                'message' => "{$actorName} changed payment settings for: {$methodList}.",
                'push_message' => "Payment settings changed: {$methodList}.",
                'redirect_path' => '/dashboard/payment-methods',
                'dedupe_key' => 'payment-methods-updated-' . date('YmdHis'),
            ]);
        } catch (Throwable $notificationError) {
            error_log('Payment methods governance notification failed: ' . $notificationError->getMessage());
        }
    }

    echo json_encode([
        'success' => true,
        'message' => 'Payment methods updated.',
        'methods' => payment_methods_fetch($pdo, true),
    ]);
}

try {
    payment_methods_ensure_schema($pdo);

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $includeInactive = in_array(strtolower((string)($_GET['includeInactive'] ?? '')), ['1', 'true', 'yes'], true);
        if ($includeInactive) {
            payment_methods_user($pdo);
        }
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
