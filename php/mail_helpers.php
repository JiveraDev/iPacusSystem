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
