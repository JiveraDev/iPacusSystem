<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/role_access.php';
require_once __DIR__ . '/auth_otp_helpers.php';
require_once __DIR__ . '/notification_helpers.php';
require_once __DIR__ . '/payment_method_helpers.php';

header('Content-Type: application/json');

final class PaymentMethodsApiException extends RuntimeException
{
    public int $statusCode;

    public function __construct(int $statusCode, string $message)
    {
        parent::__construct($message);
        $this->statusCode = $statusCode;
    }
}

function payment_methods_input(): array
{
    $input = json_decode(file_get_contents('php://input'), true);

    return is_array($input) ? $input : [];
}

function payment_methods_error(int $statusCode, string $message, array $extra = []): void
{
    http_response_code($statusCode);
    echo json_encode(array_merge(['success' => false, 'message' => $message], $extra));
    exit;
}

function payment_methods_is_list(array $value): bool
{
    if (function_exists('array_is_list')) {
        return array_is_list($value);
    }

    return $value === [] || array_keys($value) === range(0, count($value) - 1);
}

function payment_methods_throw(int $statusCode, string $message): void
{
    throw new PaymentMethodsApiException($statusCode, $message);
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
        throw new RuntimeException('payment_methods table is missing. Apply the approved payment-method deployment migration.');
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
        throw new RuntimeException(
            'payment_methods table is missing required columns: ' . implode(', ', $missingColumns)
                . '. Apply the approved payment-method deployment migration.'
        );
    }

    $defaults = [
        ['qrph', 'QRPH', 'ewallet', 'Vetfocus Animal Care Clinic', '', 'Scan the QRPH code, then upload a clear screenshot of the successful transaction.', 10],
        ['maya', 'Maya', 'ewallet', 'Vetfocus Animal Care Clinic', '', 'Send payment to the Maya account, then upload a clear screenshot of the successful transaction.', 20],
        ['gcash', 'GCash', 'ewallet', 'Vetfocus Animal Care Clinic', '', 'Send payment to the GCash account, then upload a clear screenshot of the successful transaction.', 30],
        ['bank_transfer', 'Bank Transfer', 'bank_transfer', 'Vetfocus Animal Care Clinic', '', 'Transfer to the clinic bank account, then upload a clear screenshot or receipt.', 40],
    ];

    $methodCount = (int)$pdo->query('SELECT COUNT(*) FROM payment_methods')->fetchColumn();
    if ($methodCount === 0) {
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
}

function payment_methods_text_length(string $value): int
{
    return function_exists('mb_strlen') ? mb_strlen($value, 'UTF-8') : strlen($value);
}

function payment_methods_encryption_key(): string
{
    $secret = trim((string)(getenv('PAYMENT_DETAILS_KEY') ?: ($_ENV['PAYMENT_DETAILS_KEY'] ?? '')));
    if (strlen($secret) < 32) {
        $secret = trim((string)(getenv('OTP_SECRET') ?: ($_ENV['OTP_SECRET'] ?? '')));
    }
    if (strlen($secret) < 32) {
        throw new RuntimeException('A server-only payment encryption secret of at least 32 characters is required.');
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
        $legacyValue = trim((string)$legacyPlainText);
        if ($legacyValue !== '' && !ctype_digit($legacyValue)) {
            throw new RuntimeException('Legacy payment account data contains non-digit characters.');
        }

        return $legacyValue;
    }
    if (!str_starts_with($payload, 'v1:')) {
        throw new RuntimeException('Payment account ciphertext has an unsupported version.');
    }

    $decoded = base64_decode(substr($payload, 3), true);
    if ($decoded === false || strlen($decoded) < 29) {
        throw new RuntimeException('Payment account ciphertext is malformed.');
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

    if ($plainText === false || $plainText === '' || !ctype_digit($plainText)) {
        throw new RuntimeException('Payment account ciphertext could not be decrypted or produced invalid data.');
    }

    return $plainText;
}

function payment_methods_type($value): string
{
    $type = strtolower(trim((string)$value));
    if (!in_array($type, ['ewallet', 'bank_transfer'], true)) {
        throw new InvalidArgumentException('Payment method type is invalid.');
    }

    return $type;
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
        throw new RuntimeException('email_otp_tokens table is missing for payment settings verification.');
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
        throw new RuntimeException(
            'email_otp_tokens is missing payment-settings columns: ' . implode(', ', $missingColumns)
        );
    }

    $columnType = payment_methods_column_type($pdo, 'email_otp_tokens', 'purpose');
    if ($columnType !== '' && strpos($columnType, AUTH_OTP_PAYMENT_SETTINGS_CHANGE) === false) {
        throw new RuntimeException('email_otp_tokens.purpose does not support payment_settings_change.');
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

function payment_methods_mask_account_number(string $accountNumber): string
{
    if ($accountNumber === '') {
        return '';
    }

    $visibleDigits = min(2, strlen($accountNumber));
    return str_repeat('*', max(4, strlen($accountNumber) - $visibleDigits))
        . substr($accountNumber, -$visibleDigits);
}

function payment_methods_row(array $row): array
{
    $accountNumber = payment_methods_decrypt(
        $row['account_number_encrypted'] ?? null,
        $row['account_number'] ?? null
    );
    $maskedAccountNumber = payment_methods_mask_account_number($accountNumber);
    $qrImageUrl = payment_methods_canonical_qr_path((string)($row['qr_image_url'] ?? ''));
    if ($qrImageUrl === null) {
        throw new RuntimeException('Stored payment QR image path is not canonical.');
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
        'qrImageUrl' => $qrImageUrl,
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

function payment_methods_revision(PDO $pdo): string
{
    $stmt = $pdo->query("
        SELECT
            method_key,
            label,
            method_type,
            account_name,
            account_number,
            account_number_encrypted,
            instructions,
            qr_image_url,
            is_active,
            requires_proof,
            sort_order,
            updated_by_user_id,
            updated_at,
            created_at
        FROM payment_methods
        ORDER BY method_key ASC
    ");
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $encoded = json_encode($rows, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if ($encoded === false) {
        throw new RuntimeException('Payment method configuration revision could not be encoded.');
    }

    return 'pmr_' . hash('sha256', $encoded);
}

function payment_methods_request_otp(PDO $pdo, array $input): void
{
    $user = payment_methods_user($pdo, $input);
    payment_methods_ensure_otp_purpose($pdo);
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
        ipawcus_error_response_log_throwable($error, 'Payment settings OTP delivery failed');
        payment_methods_error(
            503,
            'Verification email could not be delivered right now. Please try again later.',
            ['referenceId' => ipawcus_error_response_reference_id()]
        );
    }

    echo json_encode([
        'success' => true,
        'message' => 'Verification code sent to the Super Admin email.',
        'email' => $email,
        'expiresMinutes' => $otp['expiresMinutes'],
    ]);
}

function payment_methods_acquire_configuration_lock(PDO $pdo): void
{
    $stmt = $pdo->prepare('SELECT GET_LOCK(?, 10)');
    $stmt->execute(['ipawcus_payment_methods_configuration']);
    if ((int)$stmt->fetchColumn() !== 1) {
        payment_methods_throw(409, 'Payment settings are being updated by another administrator. Please try again.');
    }
}

function payment_methods_release_configuration_lock(PDO $pdo): void
{
    try {
        $stmt = $pdo->prepare('SELECT RELEASE_LOCK(?)');
        $stmt->execute(['ipawcus_payment_methods_configuration']);
    } catch (Throwable $error) {
        ipawcus_error_response_log_throwable($error, 'Payment settings lock release failed');
    }
}

function payment_methods_all_rows_by_key(PDO $pdo): array
{
    $stmt = $pdo->query('SELECT * FROM payment_methods ORDER BY method_key ASC');
    $rows = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $rows[(string)$row['method_key']] = $row;
    }

    return $rows;
}

function payment_methods_has_unresolved_references(PDO $pdo, string $methodKey): bool
{
    $checks = [
        ['bookings', 'payment_method', "status IN ('pending', 'confirmed')"],
        ['booking_payment_submissions', 'payment_method', "submission_status IN ('submitted', 'under_review')"],
        ['pet_record_update_requests', 'payment_method', "payment_status IN ('pending', 'submitted') AND status NOT IN ('completed', 'cancelled', 'rejected')"],
        ['visit_payments', 'payment_method', "payment_status = 'pending'"],
    ];

    foreach ($checks as [$tableName, $columnName, $condition]) {
        if (!payment_methods_table_exists($pdo, $tableName)
            || !payment_methods_column_exists($pdo, $tableName, $columnName)) {
            continue;
        }

        if ($tableName === 'bookings'
            && payment_methods_table_exists($pdo, 'booking_payment_submissions')
            && payment_methods_column_exists($pdo, 'booking_payment_submissions', 'submission_status')) {
            $condition .= " AND NOT EXISTS (
                SELECT 1
                FROM booking_payment_submissions resolved_submission
                WHERE resolved_submission.booking_id = bookings.booking_id
                  AND resolved_submission.submission_status IN ('verified', 'refunded')
            )";
        }

        $lockClause = $pdo->inTransaction() ? ' FOR UPDATE' : '';
        $stmt = $pdo->prepare(
            "SELECT 1 FROM {$tableName} WHERE {$columnName} = ? AND {$condition} LIMIT 1{$lockClause}"
        );
        $stmt->execute([$methodKey]);
        if ($stmt->fetchColumn() !== false) {
            return true;
        }
    }

    return false;
}

function payment_methods_canonical_qr_path(string $path): ?string
{
    $path = trim($path);
    if ($path === '') {
        return '';
    }

    if (preg_match('#^https?://#i', $path)) {
        $urlPath = parse_url($path, PHP_URL_PATH);
        if (!is_string($urlPath)) {
            return null;
        }
        $path = $urlPath;
    }

    $path = ltrim(str_replace('\\', '/', $path), '/');
    if (str_starts_with($path, 'api/uploads/media/')) {
        $path = substr($path, strlen('api/uploads/media/'));
    }

    if (!preg_match('#^payment_qr/[0-9]{14}_[a-f0-9]{24}\.(?:jpe?g|png|gif|webp)$#D', $path)) {
        return null;
    }

    return $path;
}

function payment_methods_consume_otp(PDO $pdo, array $otp): void
{
    $stmt = $pdo->prepare("
        UPDATE email_otp_tokens
        SET used_at = NOW()
        WHERE otp_id = ?
          AND used_at IS NULL
          AND expires_at >= NOW()
          AND attempt_count < max_attempts
    ");
    $stmt->execute([(int)$otp['otp_id']]);
    if ($stmt->rowCount() !== 1) {
        payment_methods_throw(409, 'This verification code was already used or expired. Request a new code and try again.');
    }
}

function payment_methods_save(PDO $pdo, array $input): void
{
    $user = payment_methods_user($pdo, $input);
    payment_methods_encryption_key();
    $email = authOtpNormalizeEmail($input['email'] ?? $user['mail_Address'] ?? '');
    $code = trim((string)($input['code'] ?? $input['otp'] ?? ''));
    $clientRevision = trim((string)($input['revision'] ?? ''));

    payment_methods_ensure_otp_purpose($pdo);

    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || !preg_match('/^\d{6}$/', $code)) {
        payment_methods_error(400, 'Super Admin email and 6-digit OTP code are required.');
    }

    if (strtolower($email) !== strtolower((string)$user['mail_Address'])) {
        payment_methods_error(403, 'OTP email must match the Super Admin account email.');
    }

    if (!preg_match('/^pmr_[a-f0-9]{64}$/', $clientRevision)) {
        payment_methods_error(409, 'Payment settings changed or were not fully loaded. Refresh the page before saving.');
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
    if (!is_array($methods) || !payment_methods_is_list($methods)) {
        payment_methods_error(400, 'Payment methods payload is invalid.');
    }

    $normalizedMethods = [];
    $normalizedLabels = [];
    $activeCount = 0;
    foreach ($methods as $index => $method) {
        if (!is_array($method)) {
            payment_methods_error(422, 'Payment method item ' . ($index + 1) . ' must be an object.');
        }
        foreach ([
            'label', 'methodType', 'method_type', 'accountName', 'account_name',
            'accountNumber', 'account_number', 'instructions', 'qrImageUrl', 'qr_image_url',
        ] as $fieldName) {
            if (array_key_exists($fieldName, $method) && !is_string($method[$fieldName])) {
                payment_methods_error(422, 'Payment method item ' . ($index + 1) . ' has an invalid ' . $fieldName . ' value.');
            }
        }
        $methodKeyValue = $method['methodKey'] ?? $method['key'] ?? $method['value'] ?? null;
        if (!is_string($methodKeyValue)) {
            payment_methods_error(422, 'Payment method item ' . ($index + 1) . ' has an invalid method key.');
        }

        $label = trim((string)($method['label'] ?? ''));
        $rawKey = strtolower(trim($methodKeyValue));
        $key = ipawcus_payment_method_key($rawKey);
        if ($label === '' || payment_methods_text_length($label) > 100) {
            payment_methods_error(422, 'Every payment method needs a display name of 100 characters or fewer.');
        }
        if ($key === '' || strlen($key) > 64 || $rawKey !== $key) {
            payment_methods_error(422, $label . ' needs a valid method key of 64 characters or fewer.');
        }
        if (isset($normalizedMethods[$key])) {
            payment_methods_error(422, 'Payment method names must be unique.');
        }
        $labelKey = function_exists('mb_strtolower') ? mb_strtolower($label, 'UTF-8') : strtolower($label);
        if (isset($normalizedLabels[$labelKey])) {
            payment_methods_error(422, 'Payment method display names must be unique.');
        }
        $normalizedLabels[$labelKey] = true;
        $rawType = strtolower(trim((string)($method['methodType'] ?? $method['method_type'] ?? '')));
        if (!in_array($rawType, ['ewallet', 'bank_transfer'], true)) {
            payment_methods_error(422, $label . ' has an invalid payment method type.');
        }
        $type = payment_methods_type($rawType);
        $accountNumber = trim((string)($method['accountNumber'] ?? $method['account_number'] ?? ''));
        if ($accountNumber !== '' && !ctype_digit($accountNumber)) {
            payment_methods_error(422, $label . ' account number must contain digits only.');
        }
        payment_methods_validate_account_number($type, $accountNumber, $label);
        $accountName = trim((string)($method['accountName'] ?? $method['account_name'] ?? ''));
        $instructions = trim((string)($method['instructions'] ?? ''));
        $qrImageUrlInput = trim((string)($method['qrImageUrl'] ?? $method['qr_image_url'] ?? ''));
        $qrImageUrl = payment_methods_canonical_qr_path($qrImageUrlInput);
        if ($accountName === '' || payment_methods_text_length($accountName) > 150) {
            payment_methods_error(422, $label . ' needs an account name of 150 characters or fewer.');
        }
        if (payment_methods_text_length($instructions) > 1000) {
            payment_methods_error(422, $label . ' owner instructions must contain 1,000 characters or fewer.');
        }
        if (payment_methods_text_length($qrImageUrlInput) > 500) {
            payment_methods_error(422, $label . ' QR image path is too long.');
        }
        if ($qrImageUrl === null) {
            payment_methods_error(422, $label . ' has an invalid QR image path. Upload the QR image again.');
        }
        if (array_key_exists('isActive', $method) && !is_bool($method['isActive'])) {
            payment_methods_error(422, $label . ' active status must be true or false.');
        }
        $isActive = !array_key_exists('isActive', $method) || $method['isActive'];
        if ($isActive) {
            $activeCount++;
        }

        $normalizedMethods[$key] = [
            'methodKey' => $key,
            'label' => $label,
            'methodType' => $type,
            'accountName' => $accountName,
            'accountNumber' => $accountNumber,
            'instructions' => $instructions,
            'qrImageUrl' => $type === 'ewallet' ? $qrImageUrl : '',
            'isActive' => $isActive,
            'sortOrder' => ($index + 1) * 10,
        ];
    }
    if (!$normalizedMethods || $activeCount === 0) {
        payment_methods_error(422, 'Keep at least one payment method active.');
    }

    $changedMethodLabels = [];
    $savedMethods = [];
    $savedRevision = '';
    payment_methods_acquire_configuration_lock($pdo);
    try {
        $serverRevision = payment_methods_revision($pdo);
        if (!hash_equals($serverRevision, $clientRevision)) {
            payment_methods_throw(409, 'Payment settings changed in another session. Refresh the page and review your changes.');
        }

        $allRowsByKey = payment_methods_all_rows_by_key($pdo);
        $pdo->beginTransaction();
        $previousMethodsByKey = [];
        foreach (payment_methods_fetch($pdo, true) as $previousMethod) {
            $previousMethodsByKey[$previousMethod['methodKey']] = $previousMethod;
        }

        foreach ($normalizedMethods as $key => $method) {
            if (!isset($previousMethodsByKey[$key]) && isset($allRowsByKey[$key])) {
                payment_methods_throw(409, $method['label'] . ' uses an existing payment method key. Choose a different display name.');
            }
            $methodLabelKey = function_exists('mb_strtolower')
                ? mb_strtolower($method['label'], 'UTF-8')
                : strtolower($method['label']);
            foreach ($allRowsByKey as $existingKey => $existingRow) {
                $existingLabel = trim((string)($existingRow['label'] ?? ''));
                $existingLabelKey = function_exists('mb_strtolower')
                    ? mb_strtolower($existingLabel, 'UTF-8')
                    : strtolower($existingLabel);
                if ($existingKey !== $key && $existingLabelKey === $methodLabelKey) {
                    payment_methods_throw(409, $method['label'] . ' is already used. Choose a different display name.');
                }
            }
            if (!isset($previousMethodsByKey[$key])) {
                if ($method['methodType'] === 'bank_transfer' && $method['accountNumber'] === '') {
                    payment_methods_throw(422, $method['label'] . ' needs a bank account number.');
                }
                if ($method['methodType'] === 'ewallet' && $method['accountNumber'] === '' && $method['qrImageUrl'] === '') {
                    payment_methods_throw(422, $method['label'] . ' needs a Philippine mobile number or QR image.');
                }
            }

            $previous = $previousMethodsByKey[$key] ?? [];
            if (!empty($previous) && !empty($previous['isActive']) && !$method['isActive']
                && payment_methods_has_unresolved_references($pdo, $key)) {
                payment_methods_throw(409, 'Resolve pending payments using ' . $method['label'] . ' before archiving it.');
            }

            $before = [
                'label' => trim((string)($previous['label'] ?? '')),
                'methodType' => !empty($previous) ? payment_methods_type($previous['methodType'] ?? null) : '',
                'accountName' => trim((string)($previous['accountName'] ?? '')),
                'accountNumber' => trim((string)($previous['accountNumber'] ?? '')),
                'instructions' => trim((string)($previous['instructions'] ?? '')),
                'qrImageUrl' => trim((string)($previous['qrImageUrl'] ?? '')),
                'isActive' => (bool)($previous['isActive'] ?? false),
            ];
            $after = array_intersect_key($method, $before);
            if ($before !== $after) {
                $changedMethodLabels[] = $method['label'];
            }
        }
        payment_methods_consume_otp($pdo, $otp);

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

        $remainingActiveCount = (int)$pdo->query(
            'SELECT COUNT(*) FROM payment_methods WHERE is_active = 1'
        )->fetchColumn();
        if ($remainingActiveCount === 0) {
            payment_methods_throw(422, 'Keep at least one payment method active.');
        }

        $pdo->commit();
        $savedMethods = payment_methods_fetch($pdo, true);
        $savedRevision = payment_methods_revision($pdo);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    } finally {
        payment_methods_release_configuration_lock($pdo);
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
        'methods' => $savedMethods,
        'revision' => $savedRevision,
    ]);
}

try {
    ipawcus_require_current_api_user($pdo);
    payment_methods_ensure_schema($pdo);

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $includeInactive = in_array(strtolower((string)($_GET['includeInactive'] ?? '')), ['1', 'true', 'yes'], true);
        $verificationEmail = null;
        if ($includeInactive) {
            $managementUser = payment_methods_user($pdo);
            $verificationEmail = authOtpNormalizeEmail($managementUser['mail_Address'] ?? '');
        }
        $response = [
            'success' => true,
            'methods' => payment_methods_fetch($pdo, $includeInactive),
            'revision' => payment_methods_revision($pdo),
        ];
        if ($includeInactive) {
            $response['verificationEmail'] = $verificationEmail;
        }
        echo json_encode($response);
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
} catch (PaymentMethodsApiException $e) {
    payment_methods_error($e->statusCode, $e->getMessage());
} catch (Throwable $e) {
    ipawcus_error_response_log_throwable($e, 'Payment methods request failed');
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => ipawcus_error_response_public_message(500),
        'referenceId' => ipawcus_error_response_reference_id(),
    ]);
}
