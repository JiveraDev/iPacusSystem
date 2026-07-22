<?php
require_once __DIR__ . '/mail_helpers.php';

header('Content-Type: application/json');
header('Cache-Control: no-store, max-age=0');
ini_set('display_errors', '0');

const PROBLEM_REPORT_MAX_BODY_BYTES = 16384;
const PROBLEM_REPORT_RATE_LIMIT_COUNT = 3;
const PROBLEM_REPORT_RATE_LIMIT_WINDOW = 900;

function problem_report_response(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function problem_report_text($value, int $maxLength = 240): string
{
    if (!is_scalar($value)) {
        return '';
    }

    $text = strip_tags(trim((string)$value));
    $cleaned = preg_replace('/[\x00-\x1F\x7F]+/u', ' ', $text);
    if ($cleaned === null) {
        return '';
    }

    $text = preg_replace('/\s+/u', ' ', $cleaned) ?? '';

    return substr($text, 0, max(0, $maxLength));
}

function problem_report_path($value): string
{
    $path = problem_report_text($value, 500);
    $path = explode('?', $path, 2)[0];
    $path = explode('#', $path, 2)[0];
    $segments = explode('/', $path);

    foreach ($segments as &$segment) {
        if (preg_match('/^\d+$/', $segment)
            || preg_match('/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i', $segment)
            || strlen($segment) > 48) {
            $segment = ':id';
        }
    }
    unset($segment);

    return substr(implode('/', $segments), 0, 240);
}

function problem_report_id($value): string
{
    $candidate = strtoupper(problem_report_text($value, 80));
    if (preg_match('/^IPW-[A-Z0-9-]{8,70}$/', $candidate)) {
        return $candidate;
    }

    return 'IPW-' . gmdate('YmdHis') . '-' . strtoupper(bin2hex(random_bytes(5)));
}

function problem_report_rate_limit_allowed(): bool
{
    $remoteAddress = problem_report_text($_SERVER['REMOTE_ADDR'] ?? 'unknown', 128);
    $directory = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR)
        . DIRECTORY_SEPARATOR
        . 'ipawcus_problem_report_limits';

    if (!is_dir($directory) && !@mkdir($directory, 0700, true) && !is_dir($directory)) {
        error_log('Problem report rate-limit directory could not be created.');
        return true;
    }

    $path = $directory . DIRECTORY_SEPARATOR . hash('sha256', $remoteAddress) . '.json';
    $handle = @fopen($path, 'c+');
    if ($handle === false) {
        error_log('Problem report rate-limit file could not be opened.');
        return true;
    }

    try {
        if (!flock($handle, LOCK_EX)) {
            return true;
        }

        $raw = stream_get_contents($handle);
        $timestamps = json_decode($raw ?: '[]', true);
        if (!is_array($timestamps)) {
            $timestamps = [];
        }

        $now = time();
        $windowStart = $now - PROBLEM_REPORT_RATE_LIMIT_WINDOW;
        $timestamps = array_values(array_filter(
            $timestamps,
            static fn($timestamp): bool => is_numeric($timestamp) && (int)$timestamp >= $windowStart
        ));

        if (count($timestamps) >= PROBLEM_REPORT_RATE_LIMIT_COUNT) {
            return false;
        }

        $timestamps[] = $now;
        rewind($handle);
        ftruncate($handle, 0);
        fwrite($handle, json_encode($timestamps));
        fflush($handle);

        return true;
    } finally {
        flock($handle, LOCK_UN);
        fclose($handle);
    }
}

function problem_report_database_diagnostic(): array
{
    $startedAt = microtime(true);
    $requiredVariables = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
    $missingVariables = array_values(array_filter(
        $requiredVariables,
        static fn(string $name): bool => getenv($name) === false || getenv($name) === ''
    ));

    if (!empty($missingVariables)) {
        return [
            'status' => 'failed',
            'category' => 'database_configuration_missing',
            'reason' => 'Required database environment configuration is missing.',
            'action' => 'Verify the database environment variables in the deployed server configuration.',
            'detailCode' => implode(', ', $missingVariables),
            'durationMs' => (int)round((microtime(true) - $startedAt) * 1000),
        ];
    }

    if (!extension_loaded('pdo_mysql')) {
        return [
            'status' => 'failed',
            'category' => 'pdo_mysql_unavailable',
            'reason' => 'The PHP PDO MySQL extension is unavailable.',
            'action' => 'Enable the PDO MySQL extension for the deployed PHP runtime.',
            'detailCode' => 'pdo_mysql_missing',
            'durationMs' => (int)round((microtime(true) - $startedAt) * 1000),
        ];
    }

    try {
        $host = (string)getenv('DB_HOST');
        $port = (string)getenv('DB_PORT');
        $database = (string)getenv('DB_NAME');
        $username = (string)getenv('DB_USER');
        $password = (string)getenv('DB_PASSWORD');
        $dsn = "mysql:host={$host};port={$port};dbname={$database};charset=utf8mb4";
        $connection = new PDO($dsn, $username, $password, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::ATTR_TIMEOUT => 3,
        ]);
        $connection->query('SELECT 1');

        return [
            'status' => 'healthy',
            'category' => 'database_healthy',
            'reason' => 'The diagnostic endpoint connected to the database successfully.',
            'action' => 'Inspect the failing API route and the server error log for an application-level error.',
            'detailCode' => 'ok',
            'durationMs' => (int)round((microtime(true) - $startedAt) * 1000),
        ];
    } catch (Throwable $error) {
        $driverCode = $error instanceof PDOException && isset($error->errorInfo[1])
            ? (int)$error->errorInfo[1]
            : 0;
        $sqlState = $error instanceof PDOException && isset($error->errorInfo[0])
            ? problem_report_text($error->errorInfo[0], 16)
            : problem_report_text($error->getCode(), 16);
        $message = strtolower($error->getMessage());
        $category = 'database_connection_failed';
        $reason = 'The database diagnostic connection failed.';
        $action = 'Check database availability, deployment configuration, and the hosting control panel logs.';

        if ($driverCode === 1045) {
            $category = 'database_authentication_failed';
            $reason = 'The database rejected the configured account credentials.';
            $action = 'Verify the deployed database username, password, and account permissions.';
        } elseif ($driverCode === 1049) {
            $category = 'database_name_not_found';
            $reason = 'The configured database name was not found.';
            $action = 'Verify the deployed database name and hosting assignment.';
        } elseif (in_array($driverCode, [2002, 2003], true)
            || strpos($message, 'connection refused') !== false
            || strpos($message, 'getaddrinfo') !== false) {
            $category = 'database_host_unreachable';
            $reason = 'The database host could not be reached.';
            $action = 'Verify that the database service is running and that its host, port, and network access are correct.';
        } elseif ($driverCode === 2006 || strpos($message, 'server has gone away') !== false) {
            $category = 'database_server_gone_away';
            $reason = 'The database server closed or lost the connection.';
            $action = 'Check database uptime, connection limits, and timeout settings.';
        } elseif ($driverCode === 2013 || strpos($message, 'lost connection') !== false) {
            $category = 'database_connection_lost';
            $reason = 'The database connection was lost during the diagnostic request.';
            $action = 'Check database uptime, network stability, and hosting resource limits.';
        } elseif (strpos($message, 'could not find driver') !== false) {
            $category = 'pdo_mysql_unavailable';
            $reason = 'The PHP PDO MySQL driver could not be loaded.';
            $action = 'Enable the PDO MySQL extension for the deployed PHP runtime.';
        } elseif (strpos($message, 'timed out') !== false) {
            $category = 'database_connection_timeout';
            $reason = 'The database did not respond before the diagnostic timeout.';
            $action = 'Check database load, network access, and hosting resource limits.';
        }

        $detailParts = [];
        if ($sqlState !== '') {
            $detailParts[] = 'SQLSTATE ' . $sqlState;
        }
        if ($driverCode > 0) {
            $detailParts[] = 'driver ' . $driverCode;
        }

        return [
            'status' => 'failed',
            'category' => $category,
            'reason' => $reason,
            'action' => $action,
            'detailCode' => !empty($detailParts) ? implode(', ', $detailParts) : 'unclassified',
            'durationMs' => (int)round((microtime(true) - $startedAt) * 1000),
        ];
    }
}

function problem_report_html_row(string $label, $value): string
{
    $safeLabel = htmlspecialchars($label, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $safeValue = htmlspecialchars(problem_report_text($value, 600), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');

    return '<tr>'
        . '<th style="padding:8px 12px;text-align:left;vertical-align:top;border-bottom:1px solid #e2e8f0;color:#475569;width:190px">'
        . $safeLabel
        . '</th>'
        . '<td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#0f172a">'
        . ($safeValue !== '' ? $safeValue : 'Not available')
        . '</td>'
        . '</tr>';
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    problem_report_response(405, [
        'success' => false,
        'message' => 'Method not allowed.',
        'code' => 'method_not_allowed',
    ]);
}

$contentLength = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
if ($contentLength > PROBLEM_REPORT_MAX_BODY_BYTES) {
    problem_report_response(413, [
        'success' => false,
        'message' => 'The problem report is too large.',
        'code' => 'problem_report_too_large',
    ]);
}

if (!problem_report_rate_limit_allowed()) {
    header('Retry-After: ' . PROBLEM_REPORT_RATE_LIMIT_WINDOW);
    problem_report_response(429, [
        'success' => false,
        'message' => 'A problem report was already submitted recently. Please try again later.',
        'code' => 'problem_report_rate_limited',
    ]);
}

$rawBody = file_get_contents('php://input');
$payload = json_decode($rawBody ?: '', true);
if (!is_array($payload)) {
    problem_report_response(400, [
        'success' => false,
        'message' => 'A valid JSON problem report is required.',
        'code' => 'invalid_problem_report',
    ]);
}

$reportId = problem_report_id($payload['reportId'] ?? '');
$failure = is_array($payload['failure'] ?? null) ? $payload['failure'] : [];
$client = is_array($payload['client'] ?? null) ? $payload['client'] : [];
$failureCode = preg_match('/^[a-z0-9_-]{1,64}$/i', (string)($failure['code'] ?? ''))
    ? strtolower((string)$failure['code'])
    : 'server_unavailable';
$httpStatus = max(0, min(599, (int)($failure['status'] ?? 0)));
$requestMethod = preg_match('/^[A-Z]{3,12}$/', strtoupper((string)($failure['method'] ?? '')))
    ? strtoupper((string)$failure['method'])
    : 'GET';
$apiPath = problem_report_path($failure['apiPath'] ?? '/health');
$pagePath = problem_report_path($client['pagePath'] ?? '');
$databaseDiagnostic = problem_report_database_diagnostic();
$recipient = mail_env_value(
    'MAINTENANCE_REPORT_EMAIL',
    mail_env_value('MAIL_REPLY_TO', mail_env_value('MAIL_FROM_ADDRESS'))
);

if (!filter_var($recipient, FILTER_VALIDATE_EMAIL)) {
    error_log("Problem report recipient is not configured for {$reportId}.");
    problem_report_response(503, [
        'success' => false,
        'message' => 'Automatic problem reporting is not configured.',
        'code' => 'problem_report_not_configured',
        'reportId' => $reportId,
    ]);
}

$serverReportedAt = gmdate('c');
$rows = [
    problem_report_html_row('Report ID', $reportId),
    problem_report_html_row('Server received at', $serverReportedAt),
    problem_report_html_row('Client detected at', $failure['detectedAt'] ?? ''),
    problem_report_html_row('Client reported at', $client['reportedAt'] ?? ''),
    problem_report_html_row('Failure code', $failureCode),
    problem_report_html_row('HTTP status', $httpStatus > 0 ? $httpStatus : 'No HTTP response'),
    problem_report_html_row('Failing API route', $requestMethod . ' ' . ($apiPath ?: '/health')),
    problem_report_html_row('App page', $pagePath),
    problem_report_html_row('Site host', $client['siteHost'] ?? ''),
    problem_report_html_row('Browser', $client['userAgent'] ?? ''),
    problem_report_html_row('Language', $client['language'] ?? ''),
    problem_report_html_row('Time zone', $client['timeZone'] ?? ''),
    problem_report_html_row('Browser network state', !empty($client['online']) ? 'Online' : 'Offline'),
    problem_report_html_row(
        'Viewport',
        max(0, min(20000, (int)($client['viewportWidth'] ?? 0)))
            . ' x '
            . max(0, min(20000, (int)($client['viewportHeight'] ?? 0)))
    ),
    problem_report_html_row('Database diagnostic', $databaseDiagnostic['status']),
    problem_report_html_row('Likely failure category', $databaseDiagnostic['category']),
    problem_report_html_row('Diagnostic reason', $databaseDiagnostic['reason']),
    problem_report_html_row('Diagnostic code', $databaseDiagnostic['detailCode']),
    problem_report_html_row('Diagnostic duration', $databaseDiagnostic['durationMs'] . ' ms'),
    problem_report_html_row('Suggested developer check', $databaseDiagnostic['action']),
    problem_report_html_row('PHP runtime', PHP_MAJOR_VERSION . '.' . PHP_MINOR_VERSION),
];

$html = '<!doctype html><html><body style="margin:0;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a">'
    . '<div style="max-width:760px;margin:0 auto;padding:24px">'
    . '<h1 style="margin:0 0 8px;font-size:24px">iPawcus maintenance problem report</h1>'
    . '<p style="margin:0 0 20px;color:#475569">A user submitted this automatic report from the maintenance screen. It intentionally excludes account details, credentials, patient information, and medical records.</p>'
    . '<table role="presentation" style="width:100%;border-collapse:collapse;background:#ffffff;border:1px solid #e2e8f0">'
    . implode('', $rows)
    . '</table>'
    . '</div></body></html>';

$text = "iPawcus maintenance problem report\n\n"
    . "Report ID: {$reportId}\n"
    . "Server received at: {$serverReportedAt}\n"
    . "Failure code: {$failureCode}\n"
    . 'HTTP status: ' . ($httpStatus > 0 ? $httpStatus : 'No HTTP response') . "\n"
    . 'Failing API route: ' . $requestMethod . ' ' . ($apiPath ?: '/health') . "\n"
    . "App page: {$pagePath}\n"
    . 'Database diagnostic: ' . $databaseDiagnostic['status'] . "\n"
    . 'Likely failure category: ' . $databaseDiagnostic['category'] . "\n"
    . 'Diagnostic reason: ' . $databaseDiagnostic['reason'] . "\n"
    . 'Diagnostic code: ' . $databaseDiagnostic['detailCode'] . "\n"
    . 'Suggested developer check: ' . $databaseDiagnostic['action'] . "\n\n"
    . "This report excludes account details, credentials, patient information, and medical records.\n";

try {
    send_smtp_email(
        $recipient,
        "[iPawcus] Maintenance report {$reportId}: {$databaseDiagnostic['category']}",
        $html,
        $text,
        ['toName' => 'iPawcus Development']
    );

    error_log("Maintenance problem report sent: {$reportId} ({$databaseDiagnostic['category']}).");
    problem_report_response(201, [
        'success' => true,
        'message' => 'Problem report sent.',
        'reportId' => $reportId,
    ]);
} catch (Throwable $error) {
    error_log("Maintenance problem report delivery failed for {$reportId}: " . $error->getMessage());
    problem_report_response(502, [
        'success' => false,
        'message' => 'The automatic problem report could not be delivered.',
        'code' => 'problem_report_delivery_failed',
        'reportId' => $reportId,
    ]);
}
