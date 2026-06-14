<?php
require_once __DIR__ . '/config.php';

if (!function_exists('createDatabaseConnection')) {
    function createDatabaseConnection(): PDO
    {
        $host = getenv('DB_HOST') ?: 'localhost';
        $port = getenv('DB_PORT') ?: '3306';
        $db = getenv('DB_NAME');
        $user = getenv('DB_USER');
        $pass = getenv('DB_PASSWORD');
        $charset = 'utf8mb4';
        $timeout = (int)(getenv('DB_TIMEOUT') ?: 5);

        if ($timeout < 1) {
            $timeout = 5;
        }

        @ini_set('mysql.connect_timeout', (string)$timeout);
        @ini_set('mysqlnd.net_read_timeout', (string)$timeout);

        $dsn = "mysql:host=$host;port=$port;dbname=$db;charset=$charset";
        $options = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::ATTR_TIMEOUT => $timeout,
        ];

        return new PDO($dsn, $user, $pass, $options);
    }

    function reconnectDatabase(): PDO
    {
        global $pdo;

        $pdo = createDatabaseConnection();
        return $pdo;
    }

    function isRecoverableDatabaseConnectionError(Throwable $e): bool
    {
        if (!$e instanceof PDOException) {
            return false;
        }

        $driverCode = isset($e->errorInfo[1]) ? (int)$e->errorInfo[1] : 0;
        $message = strtolower($e->getMessage());

        return in_array($driverCode, [2006, 2013], true)
            || strpos($message, 'server has gone away') !== false
            || strpos($message, 'lost connection') !== false;
    }

    function sendDatabaseConnectionError(PDOException $e): void
    {
        http_response_code(503);
        echo json_encode([
            'ok' => false,
            'code' => 'database_unavailable',
            'message' => 'The database is not responding. Please try again later.',
        ]);
        exit;
    }
}

try {
    $pdo = createDatabaseConnection();
} catch (PDOException $e) {
    sendDatabaseConnectionError($e);
}
