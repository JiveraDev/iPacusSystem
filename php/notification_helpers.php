<?php

require_once __DIR__ . '/mail_helpers.php';
require_once __DIR__ . '/reference_number_helpers.php';

function notification_column_exists(PDO $pdo, string $tableName, string $columnName): bool
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

function notification_column_type(PDO $pdo, string $tableName, string $columnName): string
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

function notification_table_exists(PDO $pdo, string $tableName): bool
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

function notification_ensure_schema(PDO $pdo): void
{
    static $validated = false;
    if ($validated) {
        return;
    }

    $requiredTables = ['notification_preferences', 'user_notifications', 'notification_push_subscriptions'];
    $missing = [];
    foreach ($requiredTables as $tableName) {
        if (!notification_table_exists($pdo, $tableName)) {
            $missing[] = $tableName;
        }
    }

    $requiredColumns = [
        'notification_preferences' => [
            'user_id',
            'email_enabled',
            'in_app_enabled',
            'browser_push_enabled',
            'booking_updates',
            'schedule_reminders',
            'payment_updates',
            'diagnosis_updates',
            'queue_updates',
            'boarding_updates',
            'ownership_updates',
            'reminder_24h',
            'reminder_2h',
            'reminder_same_day',
        ],
        'user_notifications' => [
            'notification_id',
            'user_id',
            'type',
            'category',
            'title',
            'message',
            'push_title',
            'push_message',
            'redirect_path',
            'in_app_visible',
            'dedupe_key',
            'email_subject',
            'email_status',
            'email_sent_at',
            'email_error',
            'push_status',
            'push_sent_at',
            'push_error',
            'read_at',
        ],
        'notification_push_subscriptions' => [
            'subscription_id',
            'user_id',
            'endpoint',
            'endpoint_hash',
            'p256dh',
            'auth',
            'content_encoding',
            'user_agent',
            'is_active',
            'last_sent_at',
            'last_error',
        ],
    ];

    foreach ($requiredColumns as $tableName => $columns) {
        if (!notification_table_exists($pdo, $tableName)) {
            continue;
        }

        foreach ($columns as $columnName) {
            if (!notification_column_exists($pdo, $tableName, $columnName)) {
                $missing[] = "{$tableName}.{$columnName}";
            }
        }
    }

    $emailStatusType = notification_column_type($pdo, 'user_notifications', 'email_status');
    if ($emailStatusType !== '' && strpos($emailStatusType, "'queued'") === false) {
        $missing[] = "user_notifications.email_status enum value 'queued'";
    }

    if (!empty($missing)) {
        throw new RuntimeException(
            'Notification database schema is not ready: ' . implode(', ', $missing) . '. Run the approved deployment SQL before using notifications.'
        );
    }

    $validated = true;
}

function notification_bool($value, bool $default = true): int
{
    if ($value === null || $value === '') {
        return $default ? 1 : 0;
    }

    if (is_bool($value)) {
        return $value ? 1 : 0;
    }

    return in_array(strtolower((string)$value), ['1', 'true', 'yes', 'on'], true) ? 1 : 0;
}

function notification_default_preferences(): array
{
    return [
        'email_enabled' => 1,
        'in_app_enabled' => 1,
        'browser_push_enabled' => 0,
        'booking_updates' => 1,
        'schedule_reminders' => 1,
        'payment_updates' => 1,
        'diagnosis_updates' => 1,
        'queue_updates' => 1,
        'boarding_updates' => 1,
        'ownership_updates' => 1,
        'reminder_24h' => 1,
        'reminder_2h' => 1,
        'reminder_same_day' => 1,
    ];
}

function notification_normalize_preferences(array $row): array
{
    $defaults = notification_default_preferences();
    $preferences = [];

    foreach ($defaults as $key => $defaultValue) {
        $preferences[$key] = notification_bool($row[$key] ?? $defaultValue, (bool)$defaultValue);
    }

    return $preferences;
}

function notification_fetch_preferences(PDO $pdo, int $userId): array
{
    notification_ensure_schema($pdo);

    $stmt = $pdo->prepare("SELECT * FROM notification_preferences WHERE user_id = ? LIMIT 1");
    $stmt->execute([$userId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row) {
        $defaults = notification_default_preferences();
        notification_save_preferences($pdo, $userId, $defaults);
        return $defaults;
    }

    return notification_normalize_preferences($row);
}

function notification_save_preferences(PDO $pdo, int $userId, array $preferences): array
{
    notification_ensure_schema($pdo);

    $defaults = notification_default_preferences();
    $normalized = [];

    foreach ($defaults as $key => $defaultValue) {
        $normalized[$key] = notification_bool($preferences[$key] ?? $defaultValue, (bool)$defaultValue);
    }

    $columns = array_keys($normalized);
    $insertColumns = implode(', ', array_merge(['user_id'], $columns));
    $placeholders = implode(', ', array_fill(0, count($columns) + 1, '?'));
    $updates = implode(', ', array_map(fn($column) => "{$column} = VALUES({$column})", $columns));
    $values = array_merge([$userId], array_values($normalized));

    $stmt = $pdo->prepare("
        INSERT INTO notification_preferences ({$insertColumns})
        VALUES ({$placeholders})
        ON DUPLICATE KEY UPDATE {$updates}
    ");
    $stmt->execute($values);

    return $normalized;
}

function notification_category_enabled(array $preferences, string $category): bool
{
    $categoryKey = in_array($category, array_keys(notification_default_preferences()), true)
        ? $category
        : 'in_app_enabled';

    return notification_bool($preferences[$categoryKey] ?? 1) === 1;
}

function notification_fetch_user(PDO $pdo, int $userId): ?array
{
    $stmt = $pdo->prepare("
        SELECT user_id, mail_Address, first_Name, last_Name
        FROM users
        WHERE user_id = ?
        LIMIT 1
    ");
    $stmt->execute([$userId]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    return $user ?: null;
}

function notification_user_name(?array $user): string
{
    if (!$user) {
        return 'there';
    }

    $name = trim((string)(($user['first_Name'] ?? '') . ' ' . ($user['last_Name'] ?? '')));
    return $name !== '' ? $name : 'there';
}

function notification_normalize_role(?string $role): string
{
    return strtolower(str_replace(['_', '-'], ' ', trim((string)$role)));
}

function notification_fetch_users_by_roles(PDO $pdo, array $roles): array
{
    $wantedRoles = array_values(array_unique(array_map('notification_normalize_role', $roles)));
    if (!$wantedRoles) {
        return [];
    }

    $stmt = $pdo->query("SELECT user_id, role FROM users WHERE role IS NOT NULL");
    $users = [];

    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $user) {
        $role = notification_normalize_role($user['role'] ?? '');
        if (in_array($role, $wantedRoles, true)) {
            $users[] = $user;
        }
    }

    return $users;
}

function notification_create_event_for_roles(PDO $pdo, array $roles, array $payload): void
{
    foreach (notification_fetch_users_by_roles($pdo, $roles) as $user) {
        $userId = (int)($user['user_id'] ?? 0);
        if ($userId <= 0) {
            continue;
        }

        $dedupeKey = trim((string)($payload['dedupe_key'] ?? ''));
        notification_create_event($pdo, [
            ...$payload,
            'user_id' => $userId,
            'dedupe_key' => $dedupeKey !== '' ? "{$dedupeKey}-user-{$userId}" : null,
        ]);
    }
}

function notification_create(PDO $pdo, array $payload): ?int
{
    notification_ensure_schema($pdo);

    $userId = (int)($payload['user_id'] ?? 0);
    if ($userId <= 0) {
        return null;
    }

    $preferences = notification_fetch_preferences($pdo, $userId);
    $category = trim((string)($payload['category'] ?? 'system')) ?: 'system';
    $forceInApp = !empty($payload['force_in_app']);

    if (!$forceInApp && !notification_category_enabled($preferences, $category)) {
        return null;
    }

    $inAppVisible = $forceInApp || notification_bool($preferences['in_app_enabled'] ?? 1) === 1;

    $stmt = $pdo->prepare("
        INSERT INTO user_notifications (
            user_id,
            type,
            category,
            title,
            message,
            push_title,
            push_message,
            redirect_path,
            in_app_visible,
            dedupe_key,
            email_subject,
            read_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            notification_id = LAST_INSERT_ID(notification_id),
            type = VALUES(type),
            category = VALUES(category),
            title = VALUES(title),
            message = VALUES(message),
            push_title = VALUES(push_title),
            push_message = VALUES(push_message),
            redirect_path = VALUES(redirect_path),
            in_app_visible = VALUES(in_app_visible),
            email_subject = VALUES(email_subject),
            read_at = CASE WHEN VALUES(in_app_visible) = 1 THEN read_at ELSE COALESCE(read_at, NOW()) END,
            updated_at = CURRENT_TIMESTAMP
    ");
    $stmt->execute([
        $userId,
        trim((string)($payload['type'] ?? 'system')) ?: 'system',
        $category,
        trim((string)($payload['title'] ?? 'Notification')),
        trim((string)($payload['message'] ?? '')),
        trim((string)($payload['push_title'] ?? '')) ?: null,
        trim((string)($payload['push_message'] ?? '')) ?: null,
        trim((string)($payload['redirect_path'] ?? '')) ?: null,
        $inAppVisible ? 1 : 0,
        trim((string)($payload['dedupe_key'] ?? '')) ?: null,
        trim((string)($payload['email_subject'] ?? '')) ?: null,
        $inAppVisible ? null : date('Y-m-d H:i:s'),
    ]);

    return (int)$pdo->lastInsertId();
}

function notification_email_template(string $title, string $intro, array $rows = [], ?array $cta = null, ?string $summary = null): string
{
    $safeTitle = htmlspecialchars($title, ENT_QUOTES, 'UTF-8');
    $safeIntro = nl2br(htmlspecialchars($intro, ENT_QUOTES, 'UTF-8'));
    $rowsHtml = '';
    $summaryHtml = '';

    if ($summary !== null && trim($summary) !== '') {
        $safeSummary = nl2br(htmlspecialchars(trim($summary), ENT_QUOTES, 'UTF-8'));
        $summaryHtml = "
            <div style=\"margin: 0 0 18px; border-radius: 10px; border: 1px solid #bfdbfe; background: #eff6ff; padding: 14px 16px;\">
                <p style=\"margin: 0 0 4px; color: #1d4ed8; font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase;\">Notification Summary</p>
                <p style=\"margin: 0; color: #0f172a; font-size: 15px; font-weight: 700; line-height: 1.5;\">{$safeSummary}</p>
            </div>
        ";
    }

    foreach ($rows as $label => $value) {
        if ($value === null || $value === '') {
            continue;
        }

        $safeLabel = htmlspecialchars((string)$label, ENT_QUOTES, 'UTF-8');
        $safeValue = nl2br(htmlspecialchars((string)$value, ENT_QUOTES, 'UTF-8'));
        $rowsHtml .= "
            <tr>
                <td style=\"padding: 10px 12px; color: #64748b; font-weight: 700; width: 38%; border-bottom: 1px solid #e2e8f0;\">{$safeLabel}</td>
                <td style=\"padding: 10px 12px; color: #0f172a; font-weight: 600; border-bottom: 1px solid #e2e8f0;\">{$safeValue}</td>
            </tr>
        ";
    }

    $ctaHtml = '';
    if ($cta && !empty($cta['label']) && !empty($cta['url'])) {
        $safeLabel = htmlspecialchars((string)$cta['label'], ENT_QUOTES, 'UTF-8');
        $safeUrl = htmlspecialchars((string)$cta['url'], ENT_QUOTES, 'UTF-8');
        $ctaHtml = "
            <p style=\"margin: 24px 0 0;\">
                <a href=\"{$safeUrl}\" style=\"display: inline-block; border-radius: 8px; background: #155dfc; color: #ffffff; font-weight: 700; padding: 12px 18px; text-decoration: none;\">{$safeLabel}</a>
            </p>
        ";
    }

    return "
        <div style=\"margin: 0; padding: 0; background: #f8fafc; font-family: Arial, sans-serif; color: #0f172a;\">
            <div style=\"max-width: 640px; margin: 0 auto; padding: 28px 16px;\">
                <div style=\"border-radius: 14px; overflow: hidden; border: 1px solid #e2e8f0; background: #ffffff;\">
                    <div style=\"background: #155dfc; padding: 22px 24px;\">
                        <p style=\"margin: 0; color: #bfdbfe; font-size: 12px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase;\">iPawcus Veterinary Clinic</p>
                        <h1 style=\"margin: 8px 0 0; color: #ffffff; font-size: 24px; line-height: 1.25;\">{$safeTitle}</h1>
                    </div>
                    <div style=\"padding: 24px;\">
                        <p style=\"margin: 0 0 18px; color: #334155; font-size: 15px; line-height: 1.6;\">{$safeIntro}</p>
                        {$summaryHtml}
                        <table style=\"width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;\">{$rowsHtml}</table>
                        {$ctaHtml}
                        <p style=\"margin: 24px 0 0; color: #64748b; font-size: 12px; line-height: 1.5;\">This message was sent based on your notification preferences. You can update those preferences in your iPawcus profile.</p>
                    </div>
                </div>
            </div>
        </div>
    ";
}

function notification_send_email_if_enabled(PDO $pdo, int $userId, string $category, string $subject, string $html, string $text, ?int $notificationId = null, bool $force = false): array
{
    $preferences = notification_fetch_preferences($pdo, $userId);

    if (!$force && (notification_bool($preferences['email_enabled'] ?? 1) !== 1 || !notification_category_enabled($preferences, $category))) {
        if ($notificationId) {
            $stmt = $pdo->prepare("UPDATE user_notifications SET email_status = 'skipped' WHERE notification_id = ?");
            $stmt->execute([$notificationId]);
        }
        return ['success' => true, 'skipped' => true];
    }

    $user = notification_fetch_user($pdo, $userId);
    $email = trim((string)($user['mail_Address'] ?? ''));

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        if ($notificationId) {
            $stmt = $pdo->prepare("UPDATE user_notifications SET email_status = 'failed', email_error = ? WHERE notification_id = ?");
            $stmt->execute(['Recipient email is missing or invalid.', $notificationId]);
        }
        return ['success' => false, 'message' => 'Recipient email is missing or invalid.'];
    }

    try {
        if (mail_queue_enabled()) {
            $result = mail_queue_email($pdo, $email, $subject, $html, $text, [
                'toName' => notification_user_name($user),
                'notificationId' => $notificationId,
            ]);

            if ($notificationId) {
                $stmt = $pdo->prepare("
                    UPDATE user_notifications
                    SET email_status = 'queued',
                        email_sent_at = NULL,
                        email_error = NULL
                    WHERE notification_id = ?
                ");
                $stmt->execute([$notificationId]);
            }

            return $result;
        }

        $result = send_smtp_email($email, $subject, $html, $text, ['toName' => notification_user_name($user)]);

        if ($notificationId) {
            $stmt = $pdo->prepare("
                UPDATE user_notifications
                SET email_status = 'sent',
                    email_sent_at = NOW(),
                    email_error = NULL
                WHERE notification_id = ?
            ");
            $stmt->execute([$notificationId]);
        }

        return $result;
    } catch (Throwable $e) {
        if ($notificationId) {
            $stmt = $pdo->prepare("UPDATE user_notifications SET email_status = 'failed', email_error = ? WHERE notification_id = ?");
            $stmt->execute([$e->getMessage(), $notificationId]);
        }

        error_log('Notification email failed: ' . $e->getMessage());
        return ['success' => false, 'message' => $e->getMessage()];
    }
}

function notification_push_env(string $key): string
{
    $value = trim((string)(getenv($key) ?: ''));

    if (
        strlen($value) >= 2
        && (($value[0] === '"' && substr($value, -1) === '"') || ($value[0] === "'" && substr($value, -1) === "'"))
    ) {
        $value = substr($value, 1, -1);
    }

    return trim($value);
}

function notification_push_public_key(): string
{
    return notification_push_env('PUSH_VAPID_PUBLIC_KEY') ?: notification_push_env('VITE_PUSH_PUBLIC_KEY');
}

function notification_push_ca_bundle_path(): string
{
    $candidates = [
        notification_push_env('PUSH_CURL_CA_BUNDLE'),
        notification_push_env('CURL_CA_BUNDLE'),
        notification_push_env('SSL_CERT_FILE'),
        (string)ini_get('curl.cainfo'),
        (string)ini_get('openssl.cafile'),
        'C:\\Program Files\\Git\\mingw64\\etc\\ssl\\certs\\ca-bundle.crt',
        'C:\\Program Files\\Git\\usr\\ssl\\certs\\ca-bundle.crt',
        'C:\\xampp\\apache\\bin\\curl-ca-bundle.crt',
        'C:\\php\\extras\\ssl\\cacert.pem',
    ];

    foreach ($candidates as $candidate) {
        $path = trim((string)$candidate);
        if ($path !== '' && is_file($path) && is_readable($path)) {
            return $path;
        }
    }

    return '';
}

function notification_push_base64url_decode(string $value): string|false
{
    $padding = str_repeat('=', (4 - strlen($value) % 4) % 4);
    return base64_decode(strtr($value . $padding, '-_', '+/'), true);
}

function notification_push_build_ec_private_key_pem(string $privateKey, string $publicKey): string
{
    $der = hex2bin('30770201010420')
        . $privateKey
        . hex2bin('a00a06082a8648ce3d030107a144034200')
        . $publicKey;

    return "-----BEGIN EC PRIVATE KEY-----\n"
        . chunk_split(base64_encode($der), 64, "\n")
        . "-----END EC PRIVATE KEY-----";
}

function notification_push_private_key_pem(): string
{
    $base64Pem = notification_push_env('PUSH_VAPID_PRIVATE_KEY_BASE64');
    if ($base64Pem !== '') {
        $decoded = base64_decode($base64Pem, true);
        if ($decoded !== false && trim($decoded) !== '') {
            return trim($decoded);
        }
    }

    $path = notification_push_env('PUSH_VAPID_PRIVATE_KEY_PATH');
    if ($path !== '' && is_file($path) && is_readable($path)) {
        return trim((string)file_get_contents($path));
    }

    $privateKey = notification_push_env('PUSH_VAPID_PRIVATE_KEY') ?: notification_push_env('PUSH_VAPID_PRIVATE_KEY_PEM');
    if (str_starts_with($privateKey, 'file:')) {
        $filePath = substr($privateKey, 5);
        if ($filePath !== '' && is_file($filePath) && is_readable($filePath)) {
            return trim((string)file_get_contents($filePath));
        }
    }

    if ($privateKey !== '' && is_file($privateKey) && is_readable($privateKey)) {
        return trim((string)file_get_contents($privateKey));
    }

    $privateKey = trim(str_replace('\n', "\n", $privateKey));
    if ($privateKey === '' || str_contains($privateKey, 'BEGIN EC PRIVATE KEY') || str_contains($privateKey, 'BEGIN PRIVATE KEY')) {
        return $privateKey;
    }

    $rawPrivateKey = notification_push_base64url_decode($privateKey);
    $rawPublicKey = notification_push_base64url_decode(notification_push_public_key());

    if (
        $rawPrivateKey !== false
        && $rawPublicKey !== false
        && strlen($rawPrivateKey) === 32
        && strlen($rawPublicKey) === 65
        && $rawPublicKey[0] === "\x04"
    ) {
        return notification_push_build_ec_private_key_pem($rawPrivateKey, $rawPublicKey);
    }

    return $privateKey;
}

function notification_push_subject(): string
{
    $subject = notification_push_env('PUSH_VAPID_SUBJECT');
    if ($subject !== '') {
        return $subject;
    }

    $mailFrom = notification_push_env('MAIL_FROM_ADDRESS');
    if (filter_var($mailFrom, FILTER_VALIDATE_EMAIL)) {
        return 'mailto:' . $mailFrom;
    }

    return 'mailto:notifications@ipawcus.local';
}

function notification_push_is_configured(): bool
{
    return notification_push_public_key() !== ''
        && notification_push_private_key_pem() !== ''
        && function_exists('openssl_sign');
}

function notification_push_config_status(): array
{
    $publicKey = notification_push_public_key();
    $hasPrivateKey = notification_push_private_key_pem() !== '';
    $hasOpenSsl = function_exists('openssl_sign');
    $caBundle = notification_push_ca_bundle_path();

    return [
        'enabled' => $publicKey !== '' && $hasPrivateKey && $hasOpenSsl,
        'publicKey' => $publicKey,
        'caBundle' => $caBundle,
        'needsCaBundle' => $caBundle === '',
        'needsSetup' => $publicKey === '' || !$hasPrivateKey || !$hasOpenSsl,
    ];
}

function notification_push_base64url(string $value): string
{
    return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
}

function notification_push_asn1_length(string $der, int &$offset): int
{
    $length = ord($der[$offset++]);
    if ($length < 0x80) {
        return $length;
    }

    $bytes = $length & 0x7f;
    $length = 0;
    for ($i = 0; $i < $bytes; $i++) {
        $length = ($length << 8) | ord($der[$offset++]);
    }

    return $length;
}

function notification_push_der_signature_to_jose(string $der): string
{
    $offset = 0;
    if (ord($der[$offset++]) !== 0x30) {
        throw new RuntimeException('Invalid VAPID signature.');
    }

    notification_push_asn1_length($der, $offset);

    if (ord($der[$offset++]) !== 0x02) {
        throw new RuntimeException('Invalid VAPID signature.');
    }

    $rLength = notification_push_asn1_length($der, $offset);
    $r = substr($der, $offset, $rLength);
    $offset += $rLength;

    if (ord($der[$offset++]) !== 0x02) {
        throw new RuntimeException('Invalid VAPID signature.');
    }

    $sLength = notification_push_asn1_length($der, $offset);
    $s = substr($der, $offset, $sLength);

    $r = substr(ltrim($r, "\x00"), -32);
    $s = substr(ltrim($s, "\x00"), -32);

    return str_pad($r, 32, "\x00", STR_PAD_LEFT) . str_pad($s, 32, "\x00", STR_PAD_LEFT);
}

function notification_push_audience(string $endpoint): string
{
    $parts = parse_url($endpoint);
    $scheme = strtolower((string)($parts['scheme'] ?? 'https'));
    $host = strtolower((string)($parts['host'] ?? ''));
    $port = $parts['port'] ?? null;

    if ($host === '') {
        throw new RuntimeException('Push endpoint is invalid.');
    }

    $isDefaultPort = ($scheme === 'https' && (int)$port === 443) || ($scheme === 'http' && (int)$port === 80);
    return $scheme . '://' . $host . ($port && !$isDefaultPort ? ':' . $port : '');
}

function notification_push_vapid_jwt(string $endpoint): string
{
    $privateKeyPem = notification_push_private_key_pem();
    $privateKey = openssl_pkey_get_private($privateKeyPem);

    if (!$privateKey) {
        throw new RuntimeException('Browser notification private key is invalid.');
    }

    $header = notification_push_base64url(json_encode(['typ' => 'JWT', 'alg' => 'ES256']));
    $claims = notification_push_base64url(json_encode([
        'aud' => notification_push_audience($endpoint),
        'exp' => time() + 12 * 60 * 60,
        'sub' => notification_push_subject(),
    ]));
    $unsigned = $header . '.' . $claims;

    if (!openssl_sign($unsigned, $signature, $privateKey, OPENSSL_ALGO_SHA256)) {
        throw new RuntimeException('Browser notification signature could not be created.');
    }

    return $unsigned . '.' . notification_push_base64url(notification_push_der_signature_to_jose($signature));
}

function notification_push_post(string $endpoint, string $jwt, string $publicKey): array
{
    $headers = [
        'TTL: 3600',
        'Urgency: normal',
        'Authorization: vapid t=' . $jwt . ', k=' . $publicKey,
        'Content-Length: 0',
    ];

    if (function_exists('curl_init')) {
        $curl = curl_init($endpoint);
        $caBundle = notification_push_ca_bundle_path();
        $options = [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HEADER => true,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_TIMEOUT => 12,
            CURLOPT_POSTFIELDS => '',
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
        ];

        if ($caBundle !== '') {
            $options[CURLOPT_CAINFO] = $caBundle;
        }

        if (defined('CURL_HTTP_VERSION_2TLS')) {
            $options[CURLOPT_HTTP_VERSION] = CURL_HTTP_VERSION_2TLS;
        }

        curl_setopt_array($curl, $options);
        $response = curl_exec($curl);
        $status = (int)curl_getinfo($curl, CURLINFO_HTTP_CODE);
        $error = curl_error($curl);

        if ($response === false) {
            $message = $error ?: 'Browser notification request failed.';
            if (stripos($message, 'certificate') !== false && $caBundle === '') {
                $message .= ' Configure PUSH_CURL_CA_BUNDLE, CURL_CA_BUNDLE, or openssl.cafile/curl.cainfo with a readable CA bundle.';
            }
            throw new RuntimeException($message);
        }

        return ['status' => $status, 'body' => (string)$response];
    }

    $caBundle = notification_push_ca_bundle_path();
    $context = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => implode("\r\n", $headers),
            'content' => '',
            'ignore_errors' => true,
            'timeout' => 12,
        ],
        'ssl' => [
            'verify_peer' => true,
            'verify_peer_name' => true,
            ...($caBundle !== '' ? ['cafile' => $caBundle] : []),
        ],
    ]);
    $body = @file_get_contents($endpoint, false, $context);
    $status = 0;
    $responseHeaders = function_exists('http_get_last_response_headers') ? http_get_last_response_headers() : [];

    if (!empty($responseHeaders[0]) && preg_match('/\s(\d{3})\s/', $responseHeaders[0], $matches)) {
        $status = (int)$matches[1];
    }

    return ['status' => $status, 'body' => (string)$body];
}

function notification_push_deactivate_subscription(PDO $pdo, int $subscriptionId, string $error = ''): void
{
    $stmt = $pdo->prepare("
        UPDATE notification_push_subscriptions
        SET is_active = 0,
            last_error = ?
        WHERE subscription_id = ?
    ");
    $stmt->execute([$error ?: 'Push subscription is no longer active.', $subscriptionId]);
}

function notification_push_save_subscription(PDO $pdo, int $userId, array $subscription, string $userAgent = ''): array
{
    notification_ensure_schema($pdo);

    $endpoint = trim((string)($subscription['endpoint'] ?? ''));
    if ($userId <= 0 || $endpoint === '') {
        throw new InvalidArgumentException('User and browser subscription are required.');
    }

    $keys = is_array($subscription['keys'] ?? null) ? $subscription['keys'] : [];
    $p256dh = trim((string)($keys['p256dh'] ?? $subscription['p256dh'] ?? ''));
    $auth = trim((string)($keys['auth'] ?? $subscription['auth'] ?? ''));
    $contentEncoding = trim((string)($subscription['contentEncoding'] ?? $subscription['content_encoding'] ?? 'aes128gcm')) ?: 'aes128gcm';
    $endpointHash = hash('sha256', $endpoint);

    $stmt = $pdo->prepare("
        INSERT INTO notification_push_subscriptions (
            user_id,
            endpoint,
            endpoint_hash,
            p256dh,
            auth,
            content_encoding,
            user_agent,
            is_active,
            last_error
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, NULL)
        ON DUPLICATE KEY UPDATE
            user_id = VALUES(user_id),
            endpoint = VALUES(endpoint),
            p256dh = VALUES(p256dh),
            auth = VALUES(auth),
            content_encoding = VALUES(content_encoding),
            user_agent = VALUES(user_agent),
            is_active = 1,
            last_error = NULL,
            updated_at = CURRENT_TIMESTAMP
    ");
    $stmt->execute([
        $userId,
        $endpoint,
        $endpointHash,
        $p256dh ?: null,
        $auth ?: null,
        $contentEncoding,
        $userAgent ?: null,
    ]);

    $countStmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM notification_push_subscriptions
        WHERE user_id = ?
          AND is_active = 1
    ");
    $countStmt->execute([$userId]);

    return [
        'activeSubscriptions' => (int)$countStmt->fetchColumn(),
        'endpointHash' => $endpointHash,
    ];
}

function notification_push_disable_subscription(PDO $pdo, int $userId, string $endpoint = ''): array
{
    notification_ensure_schema($pdo);

    if ($endpoint !== '') {
        $stmt = $pdo->prepare("
            UPDATE notification_push_subscriptions
            SET is_active = 0,
                last_error = NULL
            WHERE user_id = ?
              AND endpoint_hash = ?
        ");
        $stmt->execute([$userId, hash('sha256', $endpoint)]);
    } else {
        $stmt = $pdo->prepare("
            UPDATE notification_push_subscriptions
            SET is_active = 0,
                last_error = NULL
            WHERE user_id = ?
        ");
        $stmt->execute([$userId]);
    }

    return notification_push_user_status($pdo, $userId);
}

function notification_push_user_status(PDO $pdo, int $userId): array
{
    notification_ensure_schema($pdo);

    $stmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM notification_push_subscriptions
        WHERE user_id = ?
          AND is_active = 1
    ");
    $stmt->execute([$userId]);
    $config = notification_push_config_status();

    return [
        'configured' => (bool)$config['enabled'],
        'publicKey' => $config['publicKey'],
        'needsSetup' => (bool)$config['needsSetup'],
        'activeSubscriptions' => (int)$stmt->fetchColumn(),
    ];
}

function notification_send_push_to_subscription(PDO $pdo, array $subscription): array
{
    $subscriptionId = (int)($subscription['subscription_id'] ?? 0);
    $endpoint = trim((string)($subscription['endpoint'] ?? ''));
    $publicKey = notification_push_public_key();

    if ($subscriptionId <= 0 || $endpoint === '') {
        return ['success' => false, 'message' => 'Saved browser subscription is incomplete.'];
    }

    try {
        $result = notification_push_post($endpoint, notification_push_vapid_jwt($endpoint), $publicKey);
        $status = (int)$result['status'];

        if (in_array($status, [200, 201, 202, 204], true)) {
            $stmt = $pdo->prepare("
                UPDATE notification_push_subscriptions
                SET last_sent_at = NOW(),
                    last_error = NULL
                WHERE subscription_id = ?
            ");
            $stmt->execute([$subscriptionId]);

            return ['success' => true, 'status' => $status];
        }

        $message = 'Browser notification service returned status ' . ($status ?: 'unknown') . '.';
        if (in_array($status, [401, 403, 404, 410], true)) {
            notification_push_deactivate_subscription($pdo, $subscriptionId, $message);
        } else {
            $stmt = $pdo->prepare("UPDATE notification_push_subscriptions SET last_error = ? WHERE subscription_id = ?");
            $stmt->execute([$message, $subscriptionId]);
        }

        return ['success' => false, 'status' => $status, 'message' => $message];
    } catch (Throwable $error) {
        $message = $error->getMessage();
        $stmt = $pdo->prepare("UPDATE notification_push_subscriptions SET last_error = ? WHERE subscription_id = ?");
        $stmt->execute([$message, $subscriptionId]);

        return ['success' => false, 'message' => $message];
    }
}

function notification_send_push_if_enabled(PDO $pdo, int $userId, string $category, ?int $notificationId = null): array
{
    if ($notificationId === null || $notificationId <= 0) {
        return ['success' => true, 'skipped' => true];
    }

    $preferences = notification_fetch_preferences($pdo, $userId);
    if (
        notification_bool($preferences['browser_push_enabled'] ?? 0, false) !== 1
        || !notification_category_enabled($preferences, $category)
    ) {
        $stmt = $pdo->prepare("UPDATE user_notifications SET push_status = 'skipped' WHERE notification_id = ?");
        $stmt->execute([$notificationId]);
        return ['success' => true, 'skipped' => true];
    }

    if (!notification_push_is_configured()) {
        $stmt = $pdo->prepare("UPDATE user_notifications SET push_status = 'skipped', push_error = ? WHERE notification_id = ?");
        $stmt->execute(['Browser notifications are not configured on this server.', $notificationId]);
        return ['success' => true, 'skipped' => true, 'message' => 'Browser notifications are not configured.'];
    }

    $stmt = $pdo->prepare("
        SELECT subscription_id, endpoint
        FROM notification_push_subscriptions
        WHERE user_id = ?
          AND is_active = 1
    ");
    $stmt->execute([$userId]);
    $subscriptions = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (!$subscriptions) {
        $update = $pdo->prepare("UPDATE user_notifications SET push_status = 'skipped', push_error = ? WHERE notification_id = ?");
        $update->execute(['No active browser subscription for this user.', $notificationId]);
        return ['success' => true, 'skipped' => true];
    }

    $sent = 0;
    $errors = [];

    foreach ($subscriptions as $subscription) {
        $result = notification_send_push_to_subscription($pdo, $subscription);
        if (!empty($result['success'])) {
            $sent++;
        } else {
            $errors[] = (string)($result['message'] ?? 'Browser notification failed.');
        }
    }

    if ($sent > 0) {
        $update = $pdo->prepare("
            UPDATE user_notifications
            SET push_status = 'sent',
                push_sent_at = NOW(),
                push_error = NULL
            WHERE notification_id = ?
        ");
        $update->execute([$notificationId]);

        return ['success' => true, 'sent' => $sent, 'failed' => count($errors)];
    }

    $message = $errors ? implode(' | ', array_slice($errors, 0, 3)) : 'Browser notification failed.';
    $update = $pdo->prepare("UPDATE user_notifications SET push_status = 'failed', push_error = ? WHERE notification_id = ?");
    $update->execute([$message, $notificationId]);
    error_log('Notification browser push failed: ' . $message);

    return ['success' => false, 'message' => $message];
}

function notification_create_event(PDO $pdo, array $payload): ?int
{
    notification_ensure_schema($pdo);

    $existingNotification = null;
    $dedupeKey = trim((string)($payload['dedupe_key'] ?? ''));
    $userId = (int)($payload['user_id'] ?? 0);

    if ($userId > 0 && $dedupeKey !== '') {
        $existingStmt = $pdo->prepare("
            SELECT notification_id, email_status, push_status
            FROM user_notifications
            WHERE user_id = ?
              AND dedupe_key = ?
            LIMIT 1
        ");
        $existingStmt->execute([$userId, $dedupeKey]);
        $existingNotification = $existingStmt->fetch(PDO::FETCH_ASSOC) ?: null;
    }

    $notificationId = notification_create($pdo, $payload);
    $effectiveNotificationId = $notificationId ?: ($existingNotification ? (int)$existingNotification['notification_id'] : null);
    $emailAlreadyHandled = $existingNotification
        && in_array((string)$existingNotification['email_status'], ['queued', 'sent', 'skipped'], true);
    $pushAlreadyHandled = $existingNotification
        && in_array((string)($existingNotification['push_status'] ?? ''), ['sent', 'skipped'], true);
    $forceEmail = !empty($payload['force_email']);

    if (!$emailAlreadyHandled && !empty($payload['email_subject']) && !empty($payload['email_html'])) {
        notification_send_email_if_enabled(
            $pdo,
            (int)$payload['user_id'],
            (string)($payload['category'] ?? 'system'),
            (string)$payload['email_subject'],
            (string)$payload['email_html'],
            (string)($payload['email_text'] ?? ''),
            $effectiveNotificationId,
            $forceEmail
        );
    }

    if (!$pushAlreadyHandled && $effectiveNotificationId) {
        notification_send_push_if_enabled(
            $pdo,
            (int)$payload['user_id'],
            (string)($payload['category'] ?? 'system'),
            $effectiveNotificationId
        );
    }

    return $notificationId;
}

function notification_format_datetime(?string $date, ?string $time): string
{
    $date = trim((string)$date);
    $time = trim((string)$time);

    if ($date === '') {
        return 'Not set';
    }

    $timestamp = strtotime(trim($date . ' ' . $time));
    if ($timestamp === false) {
        return trim($date . ' ' . $time);
    }

    return date('F j, Y', $timestamp) . ($time !== '' ? ' at ' . date('g:i A', $timestamp) : '');
}

function notification_service_name(array $booking): string
{
    $service = trim((string)($booking['service_type'] ?? 'Booking'));
    $normalized = strtolower($service);
    if (in_array($normalized, ['general check-up', 'general checkup', 'general-checkup'], true)) {
        return 'General Check-up';
    }

    if ($service === 'boarding' && !empty($booking['hotel_boarding_type'])) {
        return $booking['hotel_boarding_type'] === 'hotel' ? 'Pet Hotel Boarding' : 'Kennel Boarding';
    }

    return ucwords(str_replace(['_', '-'], ' ', $service));
}

function notification_pet_redirect_path($petId, string $fallback = '/dashboard/todos'): string
{
    $numericPetId = (int)$petId;
    return $numericPetId > 0 ? "/dashboard/my-pets/{$numericPetId}" : $fallback;
}

function notification_task_datetime(?string $value): ?DateTimeImmutable
{
    $value = trim((string)$value);
    if ($value === '') {
        return null;
    }

    try {
        return new DateTimeImmutable($value);
    } catch (Throwable $e) {
        return null;
    }
}

function notification_todo_reminder_slot(?string $startAt, DateTimeImmutable $now): ?array
{
    $scheduledAt = notification_task_datetime($startAt);
    if (!$scheduledAt) {
        return null;
    }

    $secondsUntil = $scheduledAt->getTimestamp() - $now->getTimestamp();
    $sameDay = $scheduledAt->format('Y-m-d') === $now->format('Y-m-d');

    if ($secondsUntil < 0) {
        return [
            'slug' => 'overdue',
            'preference' => 'reminder_same_day',
            'title' => 'Task overdue',
            'lead' => 'is overdue',
            'daily' => true,
        ];
    }

    if ($secondsUntil <= 2 * 60 * 60) {
        return [
            'slug' => '2h',
            'preference' => 'reminder_2h',
            'title' => 'Task due soon',
            'lead' => 'is due within about 2 hours',
            'daily' => false,
        ];
    }

    if ($sameDay) {
        return [
            'slug' => 'same-day',
            'preference' => 'reminder_same_day',
            'title' => 'Task scheduled today',
            'lead' => 'is scheduled today',
            'daily' => false,
        ];
    }

    if ($secondsUntil <= 24 * 60 * 60) {
        return [
            'slug' => '24h',
            'preference' => 'reminder_24h',
            'title' => 'Task due tomorrow',
            'lead' => 'is due in about 24 hours',
            'daily' => false,
        ];
    }

    return null;
}

function notification_todo_reminder_task(array $task): array
{
    $source = trim((string)($task['source'] ?? 'todo')) ?: 'todo';
    $sourceId = (int)($task['source_id'] ?? 0);
    $petId = (int)($task['pet_id'] ?? 0);

    return [
        'source' => $source,
        'source_id' => $sourceId,
        'user_id' => (int)($task['user_id'] ?? 0),
        'title' => trim((string)($task['title'] ?? 'Scheduled task')) ?: 'Scheduled task',
        'details' => trim((string)($task['details'] ?? '')),
        'category' => trim((string)($task['category'] ?? 'Schedule')) ?: 'Schedule',
        'start_at' => trim((string)($task['start_at'] ?? '')),
        'pet_id' => $petId,
        'pet_name' => trim((string)($task['pet_name'] ?? '')),
        'redirect_path' => trim((string)($task['redirect_path'] ?? '')) ?: notification_pet_redirect_path($petId),
    ];
}

function notification_fetch_todo_reminder_tasks(PDO $pdo): array
{
    $tasks = [];

    if (notification_table_exists($pdo, 'pet_owner_todos')) {
        $stmt = $pdo->prepare("
            SELECT
                'personal' AS source,
                todo_id AS source_id,
                user_id,
                title,
                details,
                category,
                start_at,
                NULL AS pet_id,
                '' AS pet_name,
                '/dashboard/todos' AS redirect_path
            FROM pet_owner_todos
            WHERE status = 'pending'
              AND start_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
              AND start_at <= DATE_ADD(NOW(), INTERVAL 24 HOUR)
            ORDER BY start_at ASC
            LIMIT 200
        ");
        $stmt->execute();
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $tasks[] = notification_todo_reminder_task($row);
        }
    }

    if (notification_table_exists($pdo, 'vet_diagnoses')) {
        $stmt = $pdo->prepare("
            SELECT
                'diagnosis-follow-up' AS source,
                vd.diagnosis_id AS source_id,
                COALESCE(b.user_id, q.user_id, po.user_id) AS user_id,
                'Diagnosis follow-up' AS title,
                TRIM(CONCAT(COALESCE(vd.service_name, 'Clinic follow-up'), ': ', COALESCE(vd.diagnosis, ''))) AS details,
                'Follow-up' AS category,
                CONCAT(vd.follow_up_date, ' 09:00:00') AS start_at,
                vd.pet_id,
                COALESCE(p.pet_name, 'Pet') AS pet_name,
                CONCAT('/dashboard/my-pets/', vd.pet_id) AS redirect_path
            FROM vet_diagnoses vd
            JOIN pets_information p ON p.pet_id = vd.pet_id
            LEFT JOIN bookings b ON b.booking_id = vd.booking_id
            LEFT JOIN queues q ON q.queue_id = vd.queue_id
            LEFT JOIN pet_ownership po ON po.pet_id = vd.pet_id
            WHERE vd.follow_up_date IS NOT NULL
              AND COALESCE(b.user_id, q.user_id, po.user_id) IS NOT NULL
              AND CONCAT(vd.follow_up_date, ' 09:00:00') >= DATE_SUB(NOW(), INTERVAL 7 DAY)
              AND CONCAT(vd.follow_up_date, ' 09:00:00') <= DATE_ADD(NOW(), INTERVAL 24 HOUR)
            ORDER BY vd.follow_up_date ASC
            LIMIT 200
        ");
        $stmt->execute();
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $tasks[] = notification_todo_reminder_task($row);
        }
    }

    if (notification_table_exists($pdo, 'online_consultations') && notification_table_exists($pdo, 'bookings')) {
        $stmt = $pdo->prepare("
            SELECT
                'vet-online-consultation' AS source,
                oc.online_consultation_id AS source_id,
                oc.veterinarian_user_id AS user_id,
                'Online consultation appointment' AS title,
                TRIM(CONCAT(COALESCE(b.booking_number, ''), ' ', COALESCE(p.pet_name, b.unregistered_pet_name, 'Pet'))) AS details,
                'Online Consultation' AS category,
                oc.scheduled_start AS start_at,
                b.pet_id,
                COALESCE(p.pet_name, b.unregistered_pet_name, 'Pet') AS pet_name,
                '/dashboard/vet/online-consultations' AS redirect_path
            FROM online_consultations oc
            JOIN bookings b ON b.booking_id = oc.booking_id
            LEFT JOIN pets_information p ON p.pet_id = b.pet_id
            WHERE oc.veterinarian_user_id IS NOT NULL
              AND oc.status IN ('scheduled', 'vet_ready', 'in_progress')
              AND oc.scheduled_start >= DATE_SUB(NOW(), INTERVAL 7 DAY)
              AND oc.scheduled_start <= DATE_ADD(NOW(), INTERVAL 24 HOUR)
            ORDER BY oc.scheduled_start ASC
            LIMIT 200
        ");
        $stmt->execute();
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $tasks[] = notification_todo_reminder_task($row);
        }
    }

    if (notification_table_exists($pdo, 'vet_diagnoses')) {
        $stmt = $pdo->prepare("
            SELECT
                'vet-follow-up-recording' AS source,
                vd.diagnosis_id AS source_id,
                vd.veterinarian_user_id AS user_id,
                'Follow-up recording' AS title,
                TRIM(CONCAT(COALESCE(vd.service_name, 'Clinic follow-up'), ': ', COALESCE(vd.diagnosis, ''))) AS details,
                'Follow-up' AS category,
                CONCAT(vd.follow_up_date, ' 09:00:00') AS start_at,
                vd.pet_id,
                COALESCE(p.pet_name, 'Pet') AS pet_name,
                '/dashboard/vet/histories' AS redirect_path
            FROM vet_diagnoses vd
            JOIN pets_information p ON p.pet_id = vd.pet_id
            WHERE vd.follow_up_date IS NOT NULL
              AND vd.veterinarian_user_id IS NOT NULL
              AND CONCAT(vd.follow_up_date, ' 09:00:00') >= DATE_SUB(NOW(), INTERVAL 7 DAY)
              AND CONCAT(vd.follow_up_date, ' 09:00:00') <= DATE_ADD(NOW(), INTERVAL 24 HOUR)
            ORDER BY vd.follow_up_date ASC
            LIMIT 200
        ");
        $stmt->execute();
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $tasks[] = notification_todo_reminder_task($row);
        }
    }

    if (notification_table_exists($pdo, 'boarding_tasks') && notification_table_exists($pdo, 'bookings')) {
        $stmt = $pdo->prepare("
            SELECT
                'boarding-task' AS source,
                bt.task_id AS source_id,
                b.user_id,
                CONCAT('Boarding ', REPLACE(bt.task_type, '_', ' ')) AS title,
                TRIM(COALESCE(bt.notes, '')) AS details,
                'Boarding' AS category,
                bt.due_at AS start_at,
                COALESCE(bt.pet_id, b.pet_id) AS pet_id,
                COALESCE(p.pet_name, b.unregistered_pet_name, 'Pet') AS pet_name,
                CASE
                    WHEN COALESCE(bt.pet_id, b.pet_id) IS NULL THEN '/dashboard/todos'
                    ELSE CONCAT('/dashboard/my-pets/', COALESCE(bt.pet_id, b.pet_id))
                END AS redirect_path
            FROM boarding_tasks bt
            JOIN bookings b ON b.booking_id = bt.booking_id
            LEFT JOIN pets_information p ON p.pet_id = COALESCE(bt.pet_id, b.pet_id)
            WHERE b.user_id IS NOT NULL
              AND bt.status NOT IN ('completed', 'cancelled')
              AND bt.due_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
              AND bt.due_at <= DATE_ADD(NOW(), INTERVAL 24 HOUR)
            ORDER BY bt.due_at ASC
            LIMIT 200
        ");
        $stmt->execute();
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $tasks[] = notification_todo_reminder_task($row);
        }
    }

    return $tasks;
}

function notification_send_todo_reminder(PDO $pdo, array $task, array $slot, DateTimeImmutable $now): ?int
{
    $ownerUserId = (int)($task['user_id'] ?? 0);
    if ($ownerUserId <= 0) {
        return null;
    }

    $preferences = notification_fetch_preferences($pdo, $ownerUserId);
    if (notification_bool($preferences[$slot['preference']] ?? 1) !== 1) {
        return null;
    }

    $scheduledAt = notification_task_datetime($task['start_at'] ?? null);
    if (!$scheduledAt) {
        return null;
    }

    $source = preg_replace('/[^a-z0-9_-]+/i', '-', (string)($task['source'] ?? 'todo')) ?: 'todo';
    $sourceId = (int)($task['source_id'] ?? 0);
    $sourceKey = $sourceId > 0 ? (string)$sourceId : substr(hash('sha256', $task['title'] . $task['start_at']), 0, 16);
    $timeKey = !empty($slot['daily']) ? $now->format('Ymd') : $scheduledAt->format('YmdHi');
    $dedupeKey = "todo-reminder-{$slot['slug']}-{$source}-{$sourceKey}-{$timeKey}";
    $taskTitle = trim((string)($task['title'] ?? 'Scheduled task')) ?: 'Scheduled task';
    $petName = trim((string)($task['pet_name'] ?? ''));
    $schedule = $scheduledAt->format('F j, Y \a\t g:i A');
    $message = "{$taskTitle} {$slot['lead']}.";

    if ($petName !== '') {
        $message .= " Pet: {$petName}.";
    }

    $message .= " Schedule: {$schedule}.";

    return notification_create_event($pdo, [
        'user_id' => $ownerUserId,
        'type' => 'todo_schedule_reminder',
        'category' => 'schedule_reminders',
        'title' => $slot['title'],
        'message' => $message,
        'redirect_path' => trim((string)($task['redirect_path'] ?? '')) ?: '/dashboard/todos',
        'dedupe_key' => $dedupeKey,
    ]);
}

function notification_run_todo_reminders(PDO $pdo): array
{
    notification_ensure_schema($pdo);

    $now = new DateTimeImmutable('now');
    $checked = 0;
    $processed = 0;
    $skipped = 0;

    foreach (notification_fetch_todo_reminder_tasks($pdo) as $task) {
        $checked++;
        $slot = notification_todo_reminder_slot($task['start_at'] ?? null, $now);

        if (!$slot) {
            $skipped++;
            continue;
        }

        $notificationId = notification_send_todo_reminder($pdo, $task, $slot, $now);
        if ($notificationId) {
            $processed++;
        } else {
            $skipped++;
        }
    }

    return [
        'checked' => $checked,
        'processed' => $processed,
        'skipped' => $skipped,
    ];
}

function notification_fetch_booking(PDO $pdo, int $bookingId): ?array
{
    $stmt = $pdo->prepare("
        SELECT
            b.*,
            u.mail_Address,
            u.first_Name,
            u.last_Name,
            p.pet_name
        FROM bookings b
        JOIN users u ON u.user_id = b.user_id
        LEFT JOIN pets_information p ON p.pet_id = b.pet_id
        WHERE b.booking_id = ?
        LIMIT 1
    ");
    $stmt->execute([$bookingId]);
    $booking = $stmt->fetch(PDO::FETCH_ASSOC);

    return $booking ?: null;
}

function notification_send_booking_event(PDO $pdo, int $bookingId, string $event, array $context = []): void
{
    $booking = notification_fetch_booking($pdo, $bookingId);
    if (!$booking) {
        return;
    }

    $ownerUserId = (int)$booking['user_id'];
    $petName = trim((string)($booking['pet_name'] ?? $booking['unregistered_pet_name'] ?? 'your pet'));
    $bookingNumber = (string)$booking['booking_number'];
    $serviceName = notification_service_name($booking);
    $schedule = notification_format_datetime($booking['booking_date'] ?? null, $booking['booking_time'] ?? null);
    $schedulePhrase = $schedule !== '' ? " for {$schedule}" : '';
    $redirectPath = notification_pet_redirect_path($booking['pet_id'] ?? null);

    $title = 'Booking update';
    $message = "Booking {$bookingNumber} has been updated.";
    $subject = "iPawcus booking update - {$bookingNumber}";
    $intro = "Hello " . notification_user_name($booking) . ", your booking has been updated.";
    $type = 'booking_update';
    $dedupeKey = null;
    $reason = 'There was an update to this booking.';
    $pushMessage = "Your {$serviceName} booking for {$petName} has been updated.";

    if ($event === 'submitted') {
        $title = 'Booking received';
        $message = "{$bookingNumber} for {$petName} was received and is waiting for admin review.";
        $pushMessage = "Your {$serviceName} booking for {$petName} was received and is waiting for admin review.";
        $subject = "We received your iPawcus booking - {$bookingNumber}";
        $intro = "Hello " . notification_user_name($booking) . ", your booking request was received. Clinic staff will review the details and notify you when it is confirmed.";
        $type = 'booking_submitted';
        $dedupeKey = "booking-submitted-{$bookingId}";
        $reason = 'Your booking request was submitted for admin review.';
    } elseif ($event === 'confirmed') {
        $title = 'Booking confirmed';
        $message = "{$bookingNumber} for {$petName} is confirmed for {$schedule}.";
        $pushMessage = "Your {$serviceName} booking for {$petName} is confirmed{$schedulePhrase}.";
        $subject = "Your iPawcus booking is confirmed - {$bookingNumber}";
        $intro = "Hello " . notification_user_name($booking) . ", your appointment has been confirmed. Please arrive 10 minutes before the scheduled time.";
        $type = 'booking_confirmed';
        $dedupeKey = "booking-confirmed-{$bookingId}";
        $reason = 'Clinic staff approved and confirmed this booking.';
    } elseif ($event === 'cancelled') {
        $title = 'Booking cancelled';
        $message = "{$bookingNumber} for {$petName} has been cancelled.";
        $pushMessage = "Your {$serviceName} booking for {$petName} has been cancelled.";
        $subject = "Your iPawcus booking was cancelled - {$bookingNumber}";
        $intro = "Hello " . notification_user_name($booking) . ", your booking has been cancelled. If payment proof was submitted, clinic staff will coordinate the return process manually.";
        $type = 'booking_cancelled';
        $dedupeKey = "booking-cancelled-{$bookingId}-" . time();
        $reason = 'This booking was cancelled.';
    } elseif ($event === 'rescheduled') {
        $oldSchedule = notification_format_datetime($context['old_date'] ?? null, $context['old_time'] ?? null);
        $title = 'Booking rescheduled';
        $message = "{$bookingNumber} for {$petName} moved from {$oldSchedule} to {$schedule}.";
        $pushMessage = $oldSchedule !== '' && $schedule !== ''
            ? "Your {$serviceName} booking for {$petName} moved from {$oldSchedule} to {$schedule}."
            : "Your {$serviceName} booking for {$petName} was rescheduled{$schedulePhrase}.";
        $subject = "Your iPawcus booking was rescheduled - {$bookingNumber}";
        $intro = "Hello " . notification_user_name($booking) . ", your booking schedule was adjusted. Reminders will now follow the updated date and time.";
        $type = 'booking_rescheduled';
        $dedupeKey = "booking-rescheduled-{$bookingId}-" . md5($oldSchedule . '|' . $schedule . '|' . microtime(true));
        $reason = !empty($context['reason']) ? $context['reason'] : 'The clinic adjusted this booking schedule.';
    }

    $rows = [
        'Reason' => $reason,
        'Booking Number' => $bookingNumber,
        'Pet' => $petName,
        'Service' => $serviceName,
        'Schedule' => $schedule,
    ];

    if (!empty($context['reason'])) {
        $rows['Reason'] = $context['reason'];
    }

    if (!empty($context['cancellation_message'])) {
        $rows['Cancellation Note'] = $context['cancellation_message'];
    }

    $emailSummary = "Pet: {$petName} | Booking: {$bookingNumber}";
    $emailHtml = notification_email_template($title, $intro, $rows, null, $emailSummary);
    $emailText = trim($intro . "\n\nSummary: {$emailSummary}\n\n" . implode("\n", array_map(
        fn($key, $value) => "{$key}: {$value}",
        array_keys($rows),
        array_values($rows)
    )));

    notification_create_event($pdo, [
        'user_id' => $ownerUserId,
        'type' => $type,
        'category' => 'booking_updates',
        'title' => $title,
        'message' => $message,
        'push_message' => $pushMessage,
        'redirect_path' => $redirectPath,
        'dedupe_key' => $dedupeKey,
        'email_subject' => $subject,
        'email_html' => $emailHtml,
        'email_text' => $emailText,
    ]);

    if ($event === 'submitted') {
        notification_create_event_for_roles($pdo, ['admin', 'super admin'], [
            'type' => 'clinic_booking_submitted',
            'category' => 'booking_updates',
            'title' => 'Booking waiting for review',
            'message' => "{$bookingNumber} for {$petName} is waiting for admin review.",
            'push_message' => "{$serviceName} booking {$bookingNumber} needs review.",
            'redirect_path' => '/dashboard/bookings',
            'dedupe_key' => "clinic-booking-submitted-{$bookingId}",
            'force_in_app' => true,
        ]);
    }

    if ($event === 'confirmed' && (int)($booking['is_online_consultation'] ?? 0) === 1 && (int)($booking['veterinarian_id'] ?? 0) > 0) {
        $vetUserId = (int)$booking['veterinarian_id'];
        notification_create_event($pdo, [
            'user_id' => $vetUserId,
            'type' => 'online_consultation_appointment',
            'category' => 'schedule_reminders',
            'title' => 'Online consultation appointment',
            'message' => "{$bookingNumber} for {$petName} is confirmed{$schedulePhrase}.",
            'push_message' => "Online consultation for {$petName} is confirmed{$schedulePhrase}.",
            'redirect_path' => '/dashboard/vet/online-consultations',
            'dedupe_key' => "vet-online-consultation-confirmed-{$bookingId}-vet-{$vetUserId}",
            'force_in_app' => true,
        ]);
    }
}

function notification_booking_schedule_datetime(array $booking): ?DateTimeImmutable
{
    $date = trim((string)($booking['booking_date'] ?? ''));
    $time = trim((string)($booking['booking_time'] ?? ''));

    if ($date === '' || $time === '') {
        return null;
    }

    try {
        return new DateTimeImmutable(trim($date . ' ' . $time));
    } catch (Throwable $e) {
        return null;
    }
}

function notification_booking_reminder_slot(array $booking, DateTimeImmutable $now): ?array
{
    $scheduledAt = notification_booking_schedule_datetime($booking);

    if (!$scheduledAt || $scheduledAt <= $now) {
        return null;
    }

    $secondsUntil = $scheduledAt->getTimestamp() - $now->getTimestamp();
    $sameDay = $scheduledAt->format('Y-m-d') === $now->format('Y-m-d');

    if ($secondsUntil <= 2 * 60 * 60) {
        return [
            'slug' => '2h',
            'preference' => 'reminder_2h',
            'title' => 'Appointment starts soon',
            'lead' => 'within about 2 hours',
        ];
    }

    if ($sameDay) {
        return [
            'slug' => 'same-day',
            'preference' => 'reminder_same_day',
            'title' => 'Appointment today',
            'lead' => 'today',
        ];
    }

    if ($secondsUntil <= 24 * 60 * 60) {
        return [
            'slug' => '24h',
            'preference' => 'reminder_24h',
            'title' => 'Appointment tomorrow',
            'lead' => 'in about 24 hours',
        ];
    }

    return null;
}

function notification_send_booking_reminder(PDO $pdo, array $booking, array $slot): ?int
{
    $ownerUserId = (int)($booking['user_id'] ?? 0);
    if ($ownerUserId <= 0) {
        return null;
    }

    $preferences = notification_fetch_preferences($pdo, $ownerUserId);
    if (notification_bool($preferences[$slot['preference']] ?? 1) !== 1) {
        return null;
    }

    $bookingId = (int)$booking['booking_id'];
    $scheduledAt = notification_booking_schedule_datetime($booking);
    if (!$scheduledAt) {
        return null;
    }

    $petName = trim((string)($booking['pet_name'] ?? $booking['unregistered_pet_name'] ?? 'your pet'));
    $bookingNumber = trim((string)($booking['booking_number'] ?? ('Booking #' . $bookingId)));
    $serviceName = notification_service_name($booking);
    $schedule = notification_format_datetime($booking['booking_date'] ?? null, $booking['booking_time'] ?? null);
    $redirectPath = notification_pet_redirect_path($booking['pet_id'] ?? null);
    $title = $slot['title'];
    $message = "{$bookingNumber} for {$petName} is scheduled {$slot['lead']}.";
    $pushMessage = "{$petName}'s {$serviceName} appointment is scheduled {$slot['lead']}.";
    $intro = "Hello " . notification_user_name($booking) . ", this is a reminder for your iPawcus appointment {$slot['lead']}.";
    $reason = "This appointment is scheduled {$slot['lead']}.";
    $rows = [
        'Reason' => $reason,
        'Booking Number' => $bookingNumber,
        'Pet' => $petName,
        'Service' => $serviceName,
        'Schedule' => $schedule,
    ];
    $emailSummary = "Pet: {$petName} | Booking: {$bookingNumber} | Reminder: {$slot['lead']}";
    $emailHtml = notification_email_template($title, $intro, $rows, null, $emailSummary);
    $emailText = trim($intro . "\n\nSummary: {$emailSummary}\n\n" . implode("\n", array_map(
        fn($key, $value) => "{$key}: {$value}",
        array_keys($rows),
        array_values($rows)
    )));

    return notification_create_event($pdo, [
        'user_id' => $ownerUserId,
        'type' => 'booking_schedule_reminder',
        'category' => 'schedule_reminders',
        'title' => $title,
        'message' => $message,
        'push_message' => $pushMessage,
        'redirect_path' => $redirectPath,
        'dedupe_key' => "booking-reminder-{$slot['slug']}-{$bookingId}-" . $scheduledAt->format('YmdHi'),
        'email_subject' => "{$title} - {$bookingNumber}",
        'email_html' => $emailHtml,
        'email_text' => $emailText,
    ]);
}

function notification_run_booking_reminders(PDO $pdo): array
{
    notification_ensure_schema($pdo);

    $stmt = $pdo->prepare("
        SELECT
            b.*,
            u.first_Name,
            u.last_Name,
            u.mail_Address,
            p.pet_name
        FROM bookings b
        JOIN users u ON u.user_id = b.user_id
        LEFT JOIN pets_information p ON p.pet_id = b.pet_id
        WHERE b.status = 'confirmed'
          AND b.booking_date IS NOT NULL
          AND b.booking_time IS NOT NULL
          AND STR_TO_DATE(CONCAT(b.booking_date, ' ', b.booking_time), '%Y-%m-%d %H:%i:%s') > NOW()
          AND STR_TO_DATE(CONCAT(b.booking_date, ' ', b.booking_time), '%Y-%m-%d %H:%i:%s') <= DATE_ADD(NOW(), INTERVAL 24 HOUR)
        ORDER BY b.booking_date ASC, b.booking_time ASC
        LIMIT 200
    ");
    $stmt->execute();

    $now = new DateTimeImmutable('now');
    $checked = 0;
    $processed = 0;
    $skipped = 0;

    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $booking) {
        $checked++;
        $slot = notification_booking_reminder_slot($booking, $now);

        if (!$slot) {
            $skipped++;
            continue;
        }

        $notificationId = notification_send_booking_reminder($pdo, $booking, $slot);
        if ($notificationId) {
            $processed++;
        } else {
            $skipped++;
        }
    }

    return [
        'checked' => $checked,
        'processed' => $processed,
        'skipped' => $skipped,
    ];
}

function notification_fetch_queue(PDO $pdo, int $queueId): ?array
{
    $stmt = $pdo->prepare("
        SELECT
            q.*,
            p.pet_name,
            p.pet_species,
            u.first_Name,
            u.last_Name,
            u.mail_Address
        FROM queues q
        JOIN users u ON u.user_id = q.user_id
        LEFT JOIN pets_information p ON p.pet_id = q.pet_id
        WHERE q.queue_id = ?
        LIMIT 1
    ");
    $stmt->execute([$queueId]);
    $queue = $stmt->fetch(PDO::FETCH_ASSOC);

    return $queue ?: null;
}

function notification_send_queue_event(PDO $pdo, int $queueId, string $event, array $context = []): void
{
    $queue = notification_fetch_queue($pdo, $queueId);
    if (!$queue || empty($queue['user_id'])) {
        return;
    }

    $ownerUserId = (int)$queue['user_id'];
    $petName = trim((string)($queue['pet_name'] ?? 'your pet'));
    $queueNumber = ipawcus_format_queue_reference($queue['queue_number'] ?? 0, $queue['timestamp'] ?? null);
    $serviceName = trim((string)($queue['service_name'] ?? 'Clinic queue')) ?: 'Clinic queue';
    $status = trim((string)($queue['status'] ?? 'waiting'));
    $reason = trim((string)($context['reason'] ?? ''));
    $title = 'Queue update';
    $message = "{$petName} has a queue update for {$queueNumber}.";
    $subject = "Queue update for {$petName} - {$queueNumber}";
    $intro = "Hello " . notification_user_name($queue) . ", there is an update for your pet's clinic queue.";
    $type = 'queue_update';
    $dedupeKey = "queue-update-{$queueId}-{$event}-" . time();
    $pushMessage = "{$petName} has a queue update for {$serviceName}.";

    if ($event === 'created') {
        $title = 'Queue created';
        $message = "{$petName} was added to queue {$queueNumber}.";
        $pushMessage = "{$petName} was added to the clinic queue for {$serviceName}.";
        $subject = "Queue created for {$petName} - {$queueNumber}";
        $intro = "Hello " . notification_user_name($queue) . ", your pet has been added to the clinic queue.";
        $type = 'queue_created';
        $reason = $reason !== '' ? $reason : 'A queue entry was created for clinic service.';
        $dedupeKey = "queue-created-{$queueId}";
    } elseif ($event === 'in_progress') {
        $title = 'Queue approved';
        $message = "{$petName} is now in progress for queue {$queueNumber}.";
        $pushMessage = "{$petName} is now in progress for {$serviceName}.";
        $subject = "Queue approved for {$petName} - {$queueNumber}";
        $intro = "Hello " . notification_user_name($queue) . ", your pet's queue entry is now in progress.";
        $type = 'queue_in_progress';
        $reason = $reason !== '' ? $reason : 'Clinic staff approved this queue entry.';
    } elseif ($event === 'received') {
        $vetName = trim((string)($context['veterinarian_name'] ?? 'the veterinarian'));
        $title = 'Pet received by veterinarian';
        $message = "{$petName} from queue {$queueNumber} was received by {$vetName}.";
        $pushMessage = "{$vetName} received {$petName} for {$serviceName}.";
        $subject = "Veterinarian received {$petName} - {$queueNumber}";
        $intro = "Hello " . notification_user_name($queue) . ", the veterinarian has received your pet from the queue.";
        $type = 'queue_received';
        $reason = $reason !== '' ? $reason : "Your pet was received by {$vetName}.";
    } elseif (in_array($event, ['completed', 'done'], true)) {
        $title = 'Queue completed';
        $message = "{$petName}'s queue {$queueNumber} is completed.";
        $pushMessage = "{$petName}'s {$serviceName} queue service is completed.";
        $subject = "Queue completed for {$petName} - {$queueNumber}";
        $intro = "Hello " . notification_user_name($queue) . ", your pet's queue service has been completed.";
        $type = 'queue_completed';
        $reason = $reason !== '' ? $reason : 'Clinic staff marked this queue service as completed.';
    } elseif ($event === 'cancelled') {
        $title = 'Queue cancelled';
        $message = "{$petName}'s queue {$queueNumber} was cancelled.";
        $pushMessage = "{$petName}'s {$serviceName} queue entry was cancelled.";
        $subject = "Queue cancelled for {$petName} - {$queueNumber}";
        $intro = "Hello " . notification_user_name($queue) . ", your pet's queue entry was cancelled.";
        $type = 'queue_cancelled';
        $reason = $reason !== '' ? $reason : 'Clinic staff cancelled this queue entry.';
    }

    $rows = [
        'Reason' => $reason,
        'Pet' => $petName,
        'Queue ID' => $queueNumber,
        'Service' => $serviceName,
        'Status' => ucwords(str_replace('-', ' ', $status)),
    ];
    $emailSummary = "Pet: {$petName} | Queue: {$queueNumber}";
    $emailHtml = notification_email_template($title, $intro, $rows, null, $emailSummary);
    $emailText = trim($intro . "\n\nSummary: {$emailSummary}\n\n" . implode("\n", array_map(
        fn($key, $value) => "{$key}: {$value}",
        array_keys($rows),
        array_values($rows)
    )));

    notification_create_event($pdo, [
        'user_id' => $ownerUserId,
        'type' => $type,
        'category' => 'queue_updates',
        'title' => $title,
        'message' => $message,
        'push_message' => $pushMessage,
        'redirect_path' => notification_pet_redirect_path($queue['pet_id'] ?? null),
        'dedupe_key' => $dedupeKey,
        'email_subject' => $subject,
        'email_html' => $emailHtml,
        'email_text' => $emailText,
    ]);

    if ($event === 'created') {
        notification_create_event_for_roles($pdo, ['admin', 'super admin'], [
            'type' => 'clinic_queue_created',
            'category' => 'queue_updates',
            'title' => 'New queue entry',
            'message' => "{$petName} was added to queue {$queueNumber} for {$serviceName}.",
            'push_message' => "New queue entry {$queueNumber}: {$petName}.",
            'redirect_path' => '/dashboard/queue',
            'dedupe_key' => "clinic-queue-created-{$queueId}",
            'force_in_app' => true,
        ]);
    }
}

function notification_send_queue_assignment_to_vet(PDO $pdo, int $queueId, int $vetUserId, string $veterinarianName = ''): void
{
    if ($vetUserId <= 0) {
        return;
    }

    $queue = notification_fetch_queue($pdo, $queueId);
    if (!$queue) {
        return;
    }

    $petName = trim((string)($queue['pet_name'] ?? 'Pet')) ?: 'Pet';
    $queueNumber = ipawcus_format_queue_reference($queue['queue_number'] ?? 0, $queue['timestamp'] ?? null);
    $serviceName = trim((string)($queue['service_name'] ?? 'Clinic service')) ?: 'Clinic service';

    notification_create_event($pdo, [
        'user_id' => $vetUserId,
        'type' => 'queue_assigned_to_vet',
        'category' => 'queue_updates',
        'title' => 'Queue assigned to you',
        'message' => "{$petName} from {$queueNumber} was assigned to your My List for {$serviceName}.",
        'push_message' => "{$petName} was assigned to you from {$queueNumber}.",
        'redirect_path' => '/dashboard/vet/my-list',
        'dedupe_key' => "queue-assigned-to-vet-{$queueId}-{$vetUserId}",
        'force_in_app' => true,
    ]);
}

function notification_fetch_record_update_request(PDO $pdo, int $requestId): ?array
{
    $stmt = $pdo->prepare("
        SELECT
            r.*,
            p.pet_name,
            p.pet_species,
            p.pet_breed,
            CONCAT(owner.first_Name, ' ', owner.last_Name) AS owner_name,
            CONCAT(vet.first_Name, ' ', vet.last_Name) AS veterinarian_name
        FROM pet_record_update_requests r
        JOIN pets_information p ON p.pet_id = r.pet_id
        LEFT JOIN users owner ON owner.user_id = r.owner_user_id
        LEFT JOIN users vet ON vet.user_id = r.assigned_veterinarian_user_id
        WHERE r.request_id = ?
        LIMIT 1
    ");
    $stmt->execute([$requestId]);
    $request = $stmt->fetch(PDO::FETCH_ASSOC);

    return $request ?: null;
}

function notification_send_record_update_request_event(PDO $pdo, int $requestId, string $event, array $context = []): void
{
    $request = notification_fetch_record_update_request($pdo, $requestId);
    if (!$request || empty($request['assigned_veterinarian_user_id'])) {
        return;
    }

    $vetUserId = (int)$request['assigned_veterinarian_user_id'];
    if ($vetUserId <= 0) {
        return;
    }

    $petName = trim((string)($request['pet_name'] ?? 'Pet')) ?: 'Pet';
    $requestNumber = trim((string)($request['request_number'] ?? ('Request #' . $requestId)));
    $requestedChanges = trim((string)($request['requested_changes'] ?? ''));
    $paymentStatus = trim((string)($request['payment_status'] ?? 'verified'));
    $paidLabel = in_array($paymentStatus, ['verified', 'waived'], true) ? 'Paid' : 'Payment submitted';
    $redirectPath = '/dashboard/vet/medical-records?petId=' . (int)$request['pet_id'] . '&requestId=' . $requestId;
    $title = $event === 'approved'
        ? 'Record update approved'
        : 'Record update assigned';

    $message = "{$requestNumber} for {$petName} is marked {$paidLabel} and urgent. Open Medical Records to review the owner request.";
    if ($requestedChanges !== '') {
        $message .= ' Request: ' . substr($requestedChanges, 0, 140);
    }

    notification_create_event($pdo, [
        'user_id' => $vetUserId,
        'type' => 'record_update_request_assigned',
        'category' => 'diagnosis_updates',
        'title' => $title,
        'message' => $message,
        'push_message' => "{$requestNumber} for {$petName}: {$paidLabel}, urgent record update.",
        'redirect_path' => $redirectPath,
        'dedupe_key' => "record-update-request-{$event}-{$requestId}-vet-{$vetUserId}",
        'force_in_app' => true,
    ]);
}

function notification_send_record_update_request_completed_to_owner(PDO $pdo, int $requestId): void
{
    $request = notification_fetch_record_update_request($pdo, $requestId);
    if (!$request) {
        return;
    }

    $ownerUserId = (int)($request['owner_user_id'] ?? 0);
    if ($ownerUserId <= 0) {
        return;
    }

    $petId = (int)($request['pet_id'] ?? 0);
    $petName = trim((string)($request['pet_name'] ?? 'Pet')) ?: 'Pet';
    $requestNumber = trim((string)($request['request_number'] ?? ('Request #' . $requestId)));
    $vetName = trim((string)($request['veterinarian_name'] ?? ''));
    $vetLabel = $vetName !== '' ? " by Dr. {$vetName}" : '';

    notification_create_event($pdo, [
        'user_id' => $ownerUserId,
        'type' => 'record_update_request_completed',
        'category' => 'medical_records',
        'title' => 'Record update completed',
        'message' => "{$requestNumber} for {$petName} has been completed{$vetLabel}. You can now review the updated medical record.",
        'push_message' => "{$petName}'s requested record update is complete.",
        'redirect_path' => $petId > 0 ? "/dashboard/my-pets/{$petId}/medical-records" : '/dashboard/my-pets',
        'dedupe_key' => "record-update-request-completed-{$requestId}-owner-{$ownerUserId}",
        'force_in_app' => true,
    ]);
}

function notification_fetch_visit_summary(PDO $pdo, int $visitId): ?array
{
    $stmt = $pdo->prepare("
        SELECT
            v.*,
            p.pet_name,
            p.pet_species,
            u.first_Name,
            u.last_Name,
            u.mail_Address,
            b.booking_number,
            q.queue_number,
            q.timestamp AS queue_timestamp,
            COALESCE(charges.total_charges, 0) AS total_charges,
            COALESCE(payments.total_paid, 0) AS total_paid
        FROM visits v
        JOIN pets_information p ON p.pet_id = v.pet_id
        JOIN users u ON u.user_id = v.owner_user_id
        LEFT JOIN bookings b ON b.booking_id = v.booking_id
        LEFT JOIN queues q ON q.queue_id = v.queue_id
        LEFT JOIN (
            SELECT visit_id, SUM(subtotal) AS total_charges
            FROM visit_charges
            GROUP BY visit_id
        ) charges ON charges.visit_id = v.visit_id
        LEFT JOIN (
            SELECT visit_id, SUM(amount) AS total_paid
            FROM visit_payments
            WHERE payment_status = 'verified'
            GROUP BY visit_id
        ) payments ON payments.visit_id = v.visit_id
        WHERE v.visit_id = ?
        LIMIT 1
    ");
    $stmt->execute([$visitId]);
    $visit = $stmt->fetch(PDO::FETCH_ASSOC);

    return $visit ?: null;
}

function notification_money($amount): string
{
    return 'PHP ' . number_format((float)$amount, 2);
}

function notification_quantity($quantity): string
{
    $number = (float)$quantity;
    return abs($number - round($number)) < 0.0001 ? (string)(int)round($number) : rtrim(rtrim(number_format($number, 2), '0'), '.');
}

function notification_visit_purchase_summary(PDO $pdo, int $visitId): string
{
    if (!notification_table_exists($pdo, 'visit_charges')) {
        return '';
    }

    $stmt = $pdo->prepare("
        SELECT charge_type, description, quantity, unit_price, subtotal
        FROM visit_charges
        WHERE visit_id = ?
        ORDER BY charge_id ASC
    ");
    $stmt->execute([$visitId]);

    $lines = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $charge) {
        $description = trim((string)($charge['description'] ?? 'Item'));
        $type = ucwords(str_replace('_', ' ', (string)($charge['charge_type'] ?? 'charge')));
        $quantity = notification_quantity($charge['quantity'] ?? 1);
        $unitPrice = notification_money($charge['unit_price'] ?? 0);
        $subtotal = notification_money($charge['subtotal'] ?? 0);
        $lines[] = "{$description} ({$type}) x {$quantity} @ {$unitPrice} = {$subtotal}";
    }

    return implode("\n", $lines);
}

function notification_send_visit_event(PDO $pdo, int $visitId, string $event, array $context = []): void
{
    $visit = notification_fetch_visit_summary($pdo, $visitId);
    if (!$visit) {
        return;
    }

    if (strtolower((string)($visit['source_type'] ?? '')) === 'walk_in') {
        return;
    }

    $ownerUserId = (int)$visit['owner_user_id'];
    $petName = (string)($visit['pet_name'] ?? 'your pet');
    $total = (float)($visit['total_charges'] ?? 0);
    $paid = (float)($visit['total_paid'] ?? 0);
    $balance = max(0, $total - $paid);
    $reference = $visit['booking_number'] ?: ($visit['queue_number'] ? ipawcus_format_queue_reference($visit['queue_number'], $visit['queue_timestamp'] ?? null) : 'Visit #' . $visitId);
    $redirectPath = notification_pet_redirect_path($visit['pet_id'] ?? null);
    $hasEmailReceiver = filter_var(trim((string)($visit['mail_Address'] ?? '')), FILTER_VALIDATE_EMAIL);

    if ($event === 'payment_received') {
        $amount = (float)($context['amount'] ?? 0);
        $invoice = trim((string)($context['reference_number'] ?? ''));
        $purchaseSummary = notification_visit_purchase_summary($pdo, $visitId);
        $title = 'Purchase summary';
        $message = notification_money($amount) . " payment was recorded for {$petName}.";
        $subject = "Purchase summary for {$petName}";
        $intro = "Hello " . notification_user_name($visit) . ", your payment has been recorded by the clinic. Here is the purchase summary for this visit.";
        $reason = 'A clinic staff member recorded a payment for this visit.';
        $rows = [
            'Reason' => $reason,
            'Pet' => $petName,
            'Reference' => $reference,
            'Purchase Summary' => $purchaseSummary,
            'Payment Amount' => notification_money($amount),
            'Invoice / Receipt' => $invoice,
            'Remaining Balance' => notification_money($balance),
        ];
        $dedupeKey = !empty($context['payment_id']) ? 'visit-payment-' . (int)$context['payment_id'] : null;
        $type = 'payment_received';
    } else {
        if ($total <= 0) {
            return;
        }

        $title = 'Invoice ready';
        $message = "An invoice for {$petName} is ready. Balance: " . notification_money($balance) . ".";
        $subject = "Invoice ready for {$petName}";
        $intro = "Hello " . notification_user_name($visit) . ", the clinic prepared billing details for the recent visit.";
        $reason = 'Billing details were prepared and there is a remaining balance.';
        $rows = [
            'Reason' => $reason,
            'Pet' => $petName,
            'Reference' => $reference,
            'Total Charges' => notification_money($total),
            'Paid' => notification_money($paid),
            'Balance' => notification_money($balance),
        ];
        $dedupeKey = "visit-invoice-ready-{$visitId}";
        $type = 'invoice_ready';
    }

    $emailSummary = "Pet: {$petName} | Reference: {$reference} | Reason: {$reason}";
    $emailHtml = $hasEmailReceiver ? notification_email_template($title, $intro, $rows, null, $emailSummary) : '';
    $emailText = $hasEmailReceiver ? trim($intro . "\n\nSummary: {$emailSummary}\n\n" . implode("\n", array_map(
        fn($key, $value) => "{$key}: {$value}",
        array_keys($rows),
        array_values($rows)
    ))) : '';

    notification_create_event($pdo, [
        'user_id' => $ownerUserId,
        'type' => $type,
        'category' => 'payment_updates',
        'title' => $title,
        'message' => $message,
        'redirect_path' => $redirectPath,
        'dedupe_key' => $dedupeKey,
        'email_subject' => $hasEmailReceiver ? $subject : '',
        'email_html' => $emailHtml,
        'email_text' => $emailText,
    ]);
}

function notification_fetch_diagnosis_summary(PDO $pdo, int $diagnosisId): ?array
{
    $stmt = $pdo->prepare("
        SELECT
            vd.*,
            p.pet_name,
            p.pet_species,
            owner.user_id AS owner_user_id,
            owner.first_Name,
            owner.last_Name,
            owner.mail_Address,
            b.booking_number,
            q.queue_number,
            q.timestamp AS queue_timestamp
        FROM vet_diagnoses vd
        JOIN pets_information p ON p.pet_id = vd.pet_id
        LEFT JOIN queues q ON q.queue_id = vd.queue_id
        LEFT JOIN bookings b ON b.booking_id = vd.booking_id
        LEFT JOIN users owner ON owner.user_id = COALESCE(q.user_id, b.user_id)
        WHERE vd.diagnosis_id = ?
        LIMIT 1
    ");
    $stmt->execute([$diagnosisId]);
    $diagnosis = $stmt->fetch(PDO::FETCH_ASSOC);

    return $diagnosis ?: null;
}

function notification_send_diagnosis_event(PDO $pdo, int $diagnosisId): void
{
    $diagnosis = notification_fetch_diagnosis_summary($pdo, $diagnosisId);
    if (!$diagnosis || empty($diagnosis['owner_user_id'])) {
        return;
    }

    $ownerUserId = (int)$diagnosis['owner_user_id'];
    $petName = (string)($diagnosis['pet_name'] ?? 'your pet');
    $serviceName = trim((string)($diagnosis['service_name'] ?? 'Clinic visit')) ?: 'Clinic visit';
    $notes = trim((string)($diagnosis['notes'] ?? ''));
    $followUp = trim((string)($diagnosis['follow_up_date'] ?? ''));
    $reference = $diagnosis['booking_number'] ?: ($diagnosis['queue_number'] ? ipawcus_format_queue_reference($diagnosis['queue_number'], $diagnosis['queue_timestamp'] ?? null) : 'Diagnosis #' . $diagnosisId);
    $title = 'Diagnosis completed';
    $message = "A diagnosis record for {$petName} is now available.";

    if ($followUp !== '') {
        $message .= " Follow-up: " . notification_format_datetime($followUp, null) . ".";
    }

    $intro = "Hello " . notification_user_name($diagnosis) . ", the veterinarian completed a diagnosis record for {$petName}.";
    $rows = [
        'Pet' => $petName,
        'Reference' => $reference,
        'Service' => $serviceName,
        'Notes' => $notes !== '' ? $notes : 'No notes were added.',
        'Follow-up Date' => $followUp !== '' ? notification_format_datetime($followUp, null) : '',
    ];
    $emailSummary = "Pet: {$petName} | Reference: {$reference}";
    $emailHtml = notification_email_template($title, $intro, $rows, null, $emailSummary);
    $emailText = trim($intro . "\n\nSummary: {$emailSummary}\n\n" . implode("\n", array_map(
        fn($key, $value) => "{$key}: {$value}",
        array_keys($rows),
        array_values($rows)
    )));

    notification_create_event($pdo, [
        'user_id' => $ownerUserId,
        'type' => 'diagnosis_completed',
        'category' => 'diagnosis_updates',
        'title' => $title,
        'message' => $message,
        'redirect_path' => '/dashboard/my-pets/' . (int)$diagnosis['pet_id'],
        'dedupe_key' => "diagnosis-completed-{$diagnosisId}",
        'email_subject' => "Diagnosis completed for {$petName}",
        'email_html' => $emailHtml,
        'email_text' => $emailText,
    ]);
}
