<?php
// Read-only local readiness probe; never prints credentials or writes schema/data.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../php/config.php';

$failed = 0;
function readiness(bool $ok, string $label): void
{
    global $failed;
    echo ($ok ? 'PASS: ' : 'FAIL: ') . $label . PHP_EOL;
    if (!$ok) $failed++;
}

readiness(is_file(__DIR__ . '/../.env'), 'Root .env exists');
$clientId = trim((string)(getenv('GOOGLE_CLIENT_ID') ?: ''));
readiness($clientId !== '' && str_ends_with($clientId, '.apps.googleusercontent.com'), 'Server Google client ID is configured');
readiness($clientId !== '' && $clientId === trim((string)getenv('VITE_GOOGLE_CLIENT_ID')), 'Frontend and server Google client IDs match');
readiness(extension_loaded('openssl') && extension_loaded('curl'), 'PHP OpenSSL and cURL are available');
$testOrigin = getenv('IPAWCUS_GOOGLE_TEST_ORIGIN') ?: 'http://localhost:5173';
readiness(in_array($testOrigin, array_map('trim', explode(',', (string)getenv('FRONTEND_ORIGIN'))), true), 'Trusted origins include the test frontend');
$autoload = __DIR__ . '/../vendor/autoload.php';
if (is_file($autoload)) require_once $autoload;
readiness(class_exists('Google\\Client'), 'Google PHP verifier is installed');

$host = strtolower((string)(getenv('DB_HOST') ?: 'localhost'));
if (!in_array($host, ['localhost', '127.0.0.1', '::1'], true)) {
    echo 'SKIP: Database checks require a local database.' . PHP_EOL;
    exit(1);
}
try {
    $pdo = new PDO(
        'mysql:host=' . $host . ';port=' . (getenv('DB_PORT') ?: '3306') . ';dbname=' . getenv('DB_NAME') . ';charset=utf8mb4',
        getenv('DB_USER'), getenv('DB_PASSWORD'),
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_TIMEOUT => 3]
    );
    readiness(true, 'Local database is reachable');
    foreach (['users', 'user_auth_identities', 'google_auth_onboarding_tokens', 'api_access_tokens'] as $table) {
        $stmt = $pdo->prepare('SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?');
        $stmt->execute([$table]);
        readiness((int)$stmt->fetchColumn() === 1, $table . ' table exists');
    }
    $stmt = $pdo->query("SELECT column_name, is_nullable FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'users'");
    $columns = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);
    readiness(isset($columns['email_verified_at']), 'Email verification column exists');
    readiness(($columns['user_password'] ?? '') === 'YES', 'Password column supports Google-only accounts');
} catch (Throwable $error) {
    readiness(false, 'Local database readiness check failed (connection or schema); details withheld');
}
exit($failed > 0 ? 1 : 0);
