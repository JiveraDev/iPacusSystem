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
        $GLOBALS['pdo'] = $pdo;

        return $pdo;
    }

    function ipawcus_get_pdo(): PDO
    {
        global $pdo;

        if (isset($pdo) && $pdo instanceof PDO) {
            $GLOBALS['pdo'] = $pdo;
            return $pdo;
        }

        if (isset($GLOBALS['pdo']) && $GLOBALS['pdo'] instanceof PDO) {
            $pdo = $GLOBALS['pdo'];
            return $pdo;
        }

        try {
            $pdo = createDatabaseConnection();
            $GLOBALS['pdo'] = $pdo;

            return $pdo;
        } catch (PDOException $e) {
            sendDatabaseConnectionError($e);
        }
    }

    function ipawcus_current_pdo(): ?PDO
    {
        global $pdo;

        if (isset($GLOBALS['pdo']) && $GLOBALS['pdo'] instanceof PDO) {
            return $GLOBALS['pdo'];
        }

        return isset($pdo) && $pdo instanceof PDO ? $pdo : null;
    }

    function ipawcus_rollback_current_transaction(): void
    {
        $connection = ipawcus_current_pdo();

        if ($connection instanceof PDO && $connection->inTransaction()) {
            $connection->rollBack();
        }
    }

    function ipawcus_json_error(int $statusCode, array $payload): void
    {
        http_response_code($statusCode);
        echo json_encode($payload);
        exit;
    }

    function ipawcus_database_unavailable_payload(): array
    {
        return [
            'ok' => false,
            'code' => 'database_unavailable',
            'message' => 'The iPawcus database is temporarily unavailable. The clinic may be performing maintenance. Please try again in a moment.',
        ];
    }

    function ipawcus_send_database_connection_error(PDOException $e): void
    {
        if (function_exists('ipawcus_error_response_log_throwable')) {
            ipawcus_error_response_log_throwable($e, 'Database connection failed');
        } else {
            error_log('Database connection failed: ' . $e->getMessage());
        }

        ipawcus_json_error(503, ipawcus_database_unavailable_payload());
    }

    function ipawcus_recover_pdo(Throwable $e): PDO
    {
        if (!isRecoverableDatabaseConnectionError($e)) {
            throw $e;
        }

        return reconnectDatabase();
    }

    function ipawcus_with_recovered_pdo(callable $callback)
    {
        try {
            return $callback(ipawcus_get_pdo());
        } catch (Throwable $e) {
            $connection = ipawcus_recover_pdo($e);
            return $callback($connection);
        }
    }

    function ipawcus_refresh_pdo_if_needed(): PDO
    {
        $connection = ipawcus_get_pdo();

        try {
            $connection->query('SELECT 1');
            return $connection;
        } catch (Throwable $e) {
            return ipawcus_recover_pdo($e);
        }
    }

    function ipawcus_set_pdo(PDO $connection): PDO
    {
        global $pdo;

        $pdo = $connection;
        $GLOBALS['pdo'] = $connection;

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
        ipawcus_send_database_connection_error($e);
    }
}

$pdo = ipawcus_get_pdo();
