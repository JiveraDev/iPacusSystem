<?php
require_once __DIR__ . '/config.php';

function mail_env_value(string $key, string $default = ''): string
{
    $value = getenv($key);

    if ($value === false || $value === '') {
        return $default;
    }

    return trim((string)$value);
}

function mail_env_bool(string $key, bool $default = false): bool
{
    $value = strtolower(mail_env_value($key, $default ? '1' : '0'));

    return in_array($value, ['1', 'true', 'yes', 'on'], true);
}

function mail_smtp_config(): array
{
    return [
        'host' => mail_env_value('MAIL_HOST', 'smtp.hostinger.com'),
        'port' => (int)mail_env_value('MAIL_PORT', '465'),
        'encryption' => strtolower(mail_env_value('MAIL_ENCRYPTION', 'ssl')),
        'username' => mail_env_value('MAIL_USERNAME'),
        'password' => mail_env_value('MAIL_PASSWORD'),
        'fromAddress' => mail_env_value('MAIL_FROM_ADDRESS', mail_env_value('MAIL_USERNAME')),
        'fromName' => mail_env_value('MAIL_FROM_NAME', 'Vetfocus Care Animal Clinic'),
        'replyTo' => mail_env_value('MAIL_REPLY_TO'),
        'timeout' => max(5, (int)mail_env_value('MAIL_TIMEOUT', '20')),
        'verifyPeer' => mail_env_bool('MAIL_VERIFY_PEER', true),
        'debug' => mail_env_bool('MAIL_DEBUG', false),
    ];
}

function mail_smtp_is_configured(): bool
{
    $config = mail_smtp_config();

    return $config['host'] !== ''
        && $config['port'] > 0
        && $config['username'] !== ''
        && $config['password'] !== ''
        && filter_var($config['fromAddress'], FILTER_VALIDATE_EMAIL);
}

function mail_clean_header(string $value): string
{
    return trim(preg_replace('/[\r\n]+/', ' ', $value));
}

function mail_encode_header(string $value): string
{
    $value = mail_clean_header($value);

    if ($value === '' || preg_match('/^[\x20-\x7E]*$/', $value)) {
        return $value;
    }

    return '=?UTF-8?B?' . base64_encode($value) . '?=';
}

function mail_format_address(string $email, string $name = ''): string
{
    $email = mail_clean_header($email);
    $name = mail_clean_header($name);

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        throw new InvalidArgumentException('Invalid email address.');
    }

    return $name !== '' ? mail_encode_header($name) . ' <' . $email . '>' : '<' . $email . '>';
}

function mail_domain_from_address(string $email): string
{
    $parts = explode('@', $email);

    return count($parts) === 2 && $parts[1] !== '' ? $parts[1] : 'localhost';
}

function mail_text_from_html(string $html): string
{
    $text = preg_replace('/<br\s*\/?>/i', "\n", $html);
    $text = preg_replace('/<\/p>/i', "\n\n", $text);
    $text = strip_tags($text ?? '');

    return trim(html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8'));
}

function mail_queue_enabled(): bool
{
    return mail_env_bool('MAIL_QUEUE_ENABLED', true);
}

function mail_queue_table_exists(PDO $pdo): bool
{
    $stmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM information_schema.tables
        WHERE table_schema = DATABASE()
          AND table_name = 'mail_queue'
    ");
    $stmt->execute();

    return (int)$stmt->fetchColumn() > 0;
}

function mail_queue_column_exists(PDO $pdo, string $columnName): bool
{
    $stmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 'mail_queue'
          AND column_name = ?
    ");
    $stmt->execute([$columnName]);

    return (int)$stmt->fetchColumn() > 0;
}

function mail_queue_ensure_schema(PDO $pdo): void
{
    static $validated = false;
    if ($validated) {
        return;
    }

    if (!mail_queue_table_exists($pdo)) {
        throw new RuntimeException('Mail queue table is missing. Run the approved deployment SQL before enabling queued mail.');
    }

    $requiredColumns = [
        'queue_id',
        'to_email',
        'to_name',
        'subject',
        'html_body',
        'text_body',
        'options_json',
        'notification_id',
        'status',
        'priority',
        'attempts',
        'max_attempts',
        'available_at',
        'locked_at',
        'lock_token',
        'sent_at',
        'last_error',
        'created_at',
        'updated_at',
    ];

    $missingColumns = [];
    foreach ($requiredColumns as $columnName) {
        if (!mail_queue_column_exists($pdo, $columnName)) {
            $missingColumns[] = $columnName;
        }
    }

    if (!empty($missingColumns)) {
        throw new RuntimeException(
            'Mail queue table is missing required columns: ' . implode(', ', $missingColumns) . '. Run the approved deployment SQL before enabling queued mail.'
        );
    }

    $validated = true;
}

function mail_queue_options(array $options): array
{
    $allowed = ['fromAddress', 'fromName', 'replyTo', 'toName'];
    $filtered = [];

    foreach ($allowed as $key) {
        if (isset($options[$key]) && trim((string)$options[$key]) !== '') {
            $filtered[$key] = trim((string)$options[$key]);
        }
    }

    return $filtered;
}

function mail_queue_email(
    PDO $pdo,
    string $to,
    string $subject,
    string $html,
    ?string $text = null,
    array $options = []
): array {
    if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
        throw new InvalidArgumentException('Recipient email address is invalid.');
    }

    mail_queue_ensure_schema($pdo);

    $text = $text !== null && trim($text) !== '' ? $text : mail_text_from_html($html);
    $queueOptions = mail_queue_options($options);
    $maxAttempts = max(1, (int)($options['maxAttempts'] ?? mail_env_value('MAIL_QUEUE_MAX_ATTEMPTS', '3')));
    $priority = max(-9, min(9, (int)($options['priority'] ?? 0)));
    $notificationId = isset($options['notificationId']) && (int)$options['notificationId'] > 0
        ? (int)$options['notificationId']
        : null;

    $stmt = $pdo->prepare("
        INSERT INTO mail_queue (
            to_email,
            to_name,
            subject,
            html_body,
            text_body,
            options_json,
            notification_id,
            priority,
            max_attempts
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");
    $stmt->execute([
        trim($to),
        $queueOptions['toName'] ?? null,
        trim($subject),
        $html,
        $text,
        json_encode($queueOptions, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
        $notificationId,
        $priority,
        $maxAttempts,
    ]);

    return [
        'success' => true,
        'queued' => true,
        'queueId' => (int)$pdo->lastInsertId(),
    ];
}

function mail_queue_reset_stale(PDO $pdo): void
{
    mail_queue_ensure_schema($pdo);

    $pdo->exec("
        UPDATE mail_queue
        SET status = 'pending',
            locked_at = NULL,
            lock_token = NULL,
            available_at = NOW()
        WHERE status = 'sending'
          AND locked_at < DATE_SUB(NOW(), INTERVAL 10 MINUTE)
          AND attempts < max_attempts
    ");

    $pdo->exec("
        UPDATE mail_queue
        SET status = 'failed',
            locked_at = NULL,
            lock_token = NULL,
            last_error = COALESCE(last_error, 'Mail worker timed out before the message could be sent.')
        WHERE status = 'sending'
          AND locked_at < DATE_SUB(NOW(), INTERVAL 10 MINUTE)
          AND attempts >= max_attempts
    ");
}

function mail_queue_claim(PDO $pdo, int $limit): array
{
    mail_queue_ensure_schema($pdo);
    mail_queue_reset_stale($pdo);

    $limit = max(1, min(100, $limit));
    $lockToken = bin2hex(random_bytes(16));

    $pdo->exec("
        UPDATE mail_queue
        SET status = 'sending',
            attempts = attempts + 1,
            locked_at = NOW(),
            lock_token = '{$lockToken}',
            last_error = NULL
        WHERE status = 'pending'
          AND available_at <= NOW()
          AND attempts < max_attempts
        ORDER BY priority DESC, queue_id ASC
        LIMIT {$limit}
    ");

    $stmt = $pdo->prepare("
        SELECT *
        FROM mail_queue
        WHERE lock_token = ?
          AND status = 'sending'
        ORDER BY priority DESC, queue_id ASC
    ");
    $stmt->execute([$lockToken]);

    return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
}

function mail_queue_mark_sent(PDO $pdo, int $queueId, ?int $notificationId = null): void
{
    $stmt = $pdo->prepare("
        UPDATE mail_queue
        SET status = 'sent',
            sent_at = NOW(),
            locked_at = NULL,
            lock_token = NULL,
            last_error = NULL
        WHERE queue_id = ?
    ");
    $stmt->execute([$queueId]);

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
}

function mail_queue_mark_failed(PDO $pdo, array $row, string $message): void
{
    $queueId = (int)($row['queue_id'] ?? 0);
    $attempts = (int)($row['attempts'] ?? 0);
    $maxAttempts = max(1, (int)($row['max_attempts'] ?? 3));
    $notificationId = (int)($row['notification_id'] ?? 0);
    $finalFailure = $attempts >= $maxAttempts;
    $status = $finalFailure ? 'failed' : 'pending';
    $retryDelaySeconds = min(3600, max(30, $attempts * 60));
    $safeMessage = substr($message, 0, 2000);

    $stmt = $pdo->prepare("
        UPDATE mail_queue
        SET status = ?,
            available_at = " . ($finalFailure ? 'available_at' : "DATE_ADD(NOW(), INTERVAL {$retryDelaySeconds} SECOND)") . ",
            locked_at = NULL,
            lock_token = NULL,
            last_error = ?
        WHERE queue_id = ?
    ");
    $stmt->execute([$status, $safeMessage, $queueId]);

    if ($notificationId > 0) {
        $notificationStatus = $finalFailure ? 'failed' : 'queued';
        $stmt = $pdo->prepare("
            UPDATE user_notifications
            SET email_status = ?,
                email_error = ?
            WHERE notification_id = ?
        ");
        $stmt->execute([$notificationStatus, $safeMessage, $notificationId]);
    }
}

function mail_process_queue(PDO $pdo, int $limit = 25): array
{
    $claimed = mail_queue_claim($pdo, $limit);
    $sent = 0;
    $failed = 0;

    foreach ($claimed as $row) {
        $options = json_decode((string)($row['options_json'] ?? ''), true);
        if (!is_array($options)) {
            $options = [];
        }

        try {
            send_smtp_email(
                (string)$row['to_email'],
                (string)$row['subject'],
                (string)$row['html_body'],
                (string)($row['text_body'] ?? ''),
                $options
            );
            mail_queue_mark_sent(
                $pdo,
                (int)$row['queue_id'],
                isset($row['notification_id']) ? (int)$row['notification_id'] : null
            );
            $sent++;
        } catch (Throwable $e) {
            mail_queue_mark_failed($pdo, $row, $e->getMessage());
            $failed++;
            error_log('Queued email failed: ' . $e->getMessage());
        }
    }

    return [
        'success' => true,
        'claimed' => count($claimed),
        'sent' => $sent,
        'failed' => $failed,
    ];
}

function mail_build_mime_message(
    string $to,
    string $subject,
    string $html,
    string $text,
    array $config,
    array $options = []
): string {
    $fromAddress = $options['fromAddress'] ?? $config['fromAddress'];
    $fromName = $options['fromName'] ?? $config['fromName'];
    $toName = $options['toName'] ?? '';
    $replyTo = $options['replyTo'] ?? $config['replyTo'];
    $domain = mail_domain_from_address($fromAddress);
    $boundary = 'ipawcus_' . bin2hex(random_bytes(12));

    $headers = [
        'Date: ' . date(DATE_RFC2822),
        'From: ' . mail_format_address($fromAddress, $fromName),
        'To: ' . mail_format_address($to, $toName),
        'Subject: ' . mail_encode_header($subject),
        'Message-ID: <' . bin2hex(random_bytes(16)) . '@' . $domain . '>',
        'MIME-Version: 1.0',
        'Content-Type: multipart/alternative; boundary="' . $boundary . '"',
        'X-Mailer: iPawcus Mailer',
    ];

    if ($replyTo !== '') {
        $headers[] = 'Reply-To: ' . mail_format_address($replyTo);
    }

    $body = [
        'This is a multi-part message in MIME format.',
        '',
        '--' . $boundary,
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: base64',
        '',
        chunk_split(base64_encode($text)),
        '--' . $boundary,
        'Content-Type: text/html; charset=UTF-8',
        'Content-Transfer-Encoding: base64',
        '',
        chunk_split(base64_encode($html)),
        '--' . $boundary . '--',
        '',
    ];

    return implode("\r\n", $headers) . "\r\n\r\n" . implode("\r\n", $body);
}

function mail_smtp_read_response($socket): array
{
    $response = '';

    while (!feof($socket)) {
        $line = fgets($socket, 515);

        if ($line === false) {
            break;
        }

        $response .= $line;

        if (strlen($line) >= 4 && $line[3] === ' ') {
            break;
        }
    }

    return [(int)substr($response, 0, 3), trim($response)];
}

function mail_smtp_expect($socket, array $expectedCodes, string $context): string
{
    [$code, $response] = mail_smtp_read_response($socket);

    if (!in_array($code, $expectedCodes, true)) {
        throw new RuntimeException($context . ' failed: ' . ($response ?: 'No SMTP response.'));
    }

    return $response;
}

function mail_smtp_command($socket, string $command, array $expectedCodes, string $context): string
{
    if (fwrite($socket, $command . "\r\n") === false) {
        throw new RuntimeException($context . ' failed: Could not write to SMTP socket.');
    }

    return mail_smtp_expect($socket, $expectedCodes, $context);
}

function mail_smtp_open_socket(array $config)
{
    $host = $config['host'];
    $port = $config['port'];
    $useImplicitSsl = in_array($config['encryption'], ['ssl', 'smtps'], true);
    $remote = ($useImplicitSsl ? 'ssl://' : 'tcp://') . $host . ':' . $port;
    $context = stream_context_create([
        'ssl' => [
            'verify_peer' => $config['verifyPeer'],
            'verify_peer_name' => $config['verifyPeer'],
            'allow_self_signed' => false,
            'peer_name' => $host,
        ],
    ]);

    $socket = @stream_socket_client(
        $remote,
        $errno,
        $errstr,
        $config['timeout'],
        STREAM_CLIENT_CONNECT,
        $context
    );

    if (!$socket) {
        throw new RuntimeException('SMTP connection failed: ' . ($errstr ?: 'Unknown socket error.'));
    }

    stream_set_timeout($socket, $config['timeout']);

    return $socket;
}

function send_smtp_email(string $to, string $subject, string $html, ?string $text = null, array $options = []): array
{
    if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
        throw new InvalidArgumentException('Recipient email address is invalid.');
    }

    $config = mail_smtp_config();

    if (!mail_smtp_is_configured()) {
        throw new RuntimeException('SMTP email is not configured. Check MAIL_HOST, MAIL_USERNAME, MAIL_PASSWORD, and MAIL_FROM_ADDRESS.');
    }

    $text = $text !== null && trim($text) !== '' ? $text : mail_text_from_html($html);
    $message = mail_build_mime_message($to, $subject, $html, $text, $config, $options);
    $socket = mail_smtp_open_socket($config);
    $ehloDomain = mail_domain_from_address($config['fromAddress']);

    try {
        mail_smtp_expect($socket, [220], 'SMTP greeting');
        mail_smtp_command($socket, 'EHLO ' . $ehloDomain, [250], 'SMTP EHLO');

        if (in_array($config['encryption'], ['tls', 'starttls'], true)) {
            mail_smtp_command($socket, 'STARTTLS', [220], 'SMTP STARTTLS');

            if (!stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                throw new RuntimeException('SMTP STARTTLS failed: Could not enable TLS encryption.');
            }

            mail_smtp_command($socket, 'EHLO ' . $ehloDomain, [250], 'SMTP EHLO after STARTTLS');
        }

        mail_smtp_command($socket, 'AUTH LOGIN', [334], 'SMTP authentication start');
        mail_smtp_command($socket, base64_encode($config['username']), [334], 'SMTP username authentication');
        mail_smtp_command($socket, base64_encode($config['password']), [235], 'SMTP password authentication');
        mail_smtp_command($socket, 'MAIL FROM:<' . $config['fromAddress'] . '>', [250], 'SMTP sender');
        mail_smtp_command($socket, 'RCPT TO:<' . $to . '>', [250, 251], 'SMTP recipient');
        mail_smtp_command($socket, 'DATA', [354], 'SMTP DATA');

        $data = preg_replace("/\r\n|\r|\n/", "\r\n", $message);
        $data = preg_replace('/^\./m', '..', $data);

        if (fwrite($socket, $data . "\r\n.\r\n") === false) {
            throw new RuntimeException('SMTP message send failed: Could not write message data.');
        }

        $sendResponse = mail_smtp_expect($socket, [250], 'SMTP message send');
        mail_smtp_command($socket, 'QUIT', [221], 'SMTP quit');

        return ['success' => true, 'smtpResponse' => $sendResponse];
    } finally {
        if (is_resource($socket)) {
            fclose($socket);
        }
    }
}
