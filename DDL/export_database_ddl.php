<?php
declare(strict_types=1);

require_once __DIR__ . '/../php/config.php';

function ddlEnv(string $key, ?string $default = null): ?string
{
    $value = getenv($key);
    return $value === false || $value === '' ? $default : $value;
}

function ddlQuoteIdentifier(string $identifier): string
{
    return '`' . str_replace('`', '``', $identifier) . '`';
}

function ddlProjectRoot(): string
{
    return dirname(__DIR__);
}

function ddlResolveOutputPath(?string $outputPath): string
{
    if (!$outputPath) {
        return __DIR__ . '/database_ddl_' . date('Ymd_His') . '.sql';
    }

    $normalizedPath = str_replace('\\', '/', $outputPath);
    if (preg_match('/^[A-Za-z]:\//', $normalizedPath) || str_starts_with($normalizedPath, '/')) {
        return $outputPath;
    }

    return ddlProjectRoot() . '/' . ltrim($outputPath, '/\\');
}

function ddlConnectFromEnv(): PDO
{
    $host = ddlEnv('DB_HOST', 'localhost');
    $port = ddlEnv('DB_PORT', '3306');
    $database = ddlEnv('DB_NAME');
    $user = ddlEnv('DB_USER');
    $password = ddlEnv('DB_PASSWORD', '');

    if (!$database || !$user) {
        throw new RuntimeException('Missing DB_NAME or DB_USER in .env.');
    }

    $dsn = "mysql:host={$host};port={$port};dbname={$database};charset=utf8mb4";

    return new PDO($dsn, $user, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
}

function ddlDatabaseObjects(PDO $pdo, string $database, bool $includeViews = false): array
{
    $types = $includeViews ? "'BASE TABLE', 'VIEW'" : "'BASE TABLE'";
    $statement = $pdo->prepare("
        SELECT TABLE_NAME, TABLE_TYPE
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = :database
          AND TABLE_TYPE IN ({$types})
        ORDER BY
          CASE TABLE_TYPE WHEN 'BASE TABLE' THEN 0 ELSE 1 END,
          TABLE_NAME
    ");
    $statement->execute(['database' => $database]);

    return $statement->fetchAll();
}

function exportDatabaseDdl(PDO $pdo, string $database, bool $includeViews = false): string
{
    $objects = ddlDatabaseObjects($pdo, $database, $includeViews);
    $schemaName = ddlQuoteIdentifier($database);
    $lines = [
        '-- Database DDL export',
        '-- Database: ' . $database,
        '-- Generated: ' . date('c'),
        '-- Tables: ' . count(array_filter($objects, fn ($object) => $object['TABLE_TYPE'] === 'BASE TABLE')),
        '-- Views: ' . count(array_filter($objects, fn ($object) => $object['TABLE_TYPE'] === 'VIEW')),
        '',
        'SET FOREIGN_KEY_CHECKS=0;',
        '',
    ];

    foreach ($objects as $object) {
        $tableName = (string)$object['TABLE_NAME'];
        $tableType = (string)$object['TABLE_TYPE'];
        $qualifiedName = $schemaName . '.' . ddlQuoteIdentifier($tableName);
        $isView = $tableType === 'VIEW';
        $showStatement = $isView ? 'SHOW CREATE VIEW ' : 'SHOW CREATE TABLE ';
        $createStatement = $pdo->query($showStatement . $qualifiedName);
        $createRow = $createStatement->fetch(PDO::FETCH_NUM);
        $ddl = $createRow[1] ?? '';

        if (!$ddl) {
            throw new RuntimeException("Could not read DDL for {$tableName}.");
        }

        $lines[] = '-- --------------------------------------------------------';
        $lines[] = '-- ' . ($isView ? 'View' : 'Table') . ': ' . $tableName;
        $lines[] = '-- --------------------------------------------------------';
        $lines[] = '';
        $lines[] = 'DROP ' . ($isView ? 'VIEW' : 'TABLE') . ' IF EXISTS ' . ddlQuoteIdentifier($tableName) . ';';
        $lines[] = $ddl . ';';
        $lines[] = '';
    }

    $lines[] = 'SET FOREIGN_KEY_CHECKS=1;';
    $lines[] = '';

    return implode(PHP_EOL, $lines);
}

function ddlParseArguments(array $argv): array
{
    $options = [
        'includeViews' => false,
        'outputPath' => null,
    ];

    for ($index = 1; $index < count($argv); $index++) {
        $argument = $argv[$index];

        if ($argument === '--include-views') {
            $options['includeViews'] = true;
            continue;
        }

        if ($argument === '--output' && isset($argv[$index + 1])) {
            $options['outputPath'] = $argv[++$index];
            continue;
        }

        if (str_starts_with($argument, '--output=')) {
            $options['outputPath'] = substr($argument, strlen('--output='));
            continue;
        }

        throw new InvalidArgumentException("Unknown argument: {$argument}");
    }

    return $options;
}

function ddlRun(array $argv): void
{
    $options = ddlParseArguments($argv);
    $database = ddlEnv('DB_NAME');

    if (!$database) {
        throw new RuntimeException('Missing DB_NAME in .env.');
    }

    $pdo = ddlConnectFromEnv();
    $ddl = exportDatabaseDdl($pdo, $database, $options['includeViews']);
    $outputPath = ddlResolveOutputPath($options['outputPath']);
    $outputDir = dirname($outputPath);

    if (!is_dir($outputDir) && !mkdir($outputDir, 0777, true) && !is_dir($outputDir)) {
        throw new RuntimeException("Could not create output directory: {$outputDir}");
    }

    file_put_contents($outputPath, $ddl);

    echo 'DDL exported successfully.' . PHP_EOL;
    echo 'Database: ' . $database . PHP_EOL;
    echo 'Output: ' . $outputPath . PHP_EOL;
}

if (PHP_SAPI === 'cli' && realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {
    try {
        ddlRun($argv);
    } catch (Throwable $error) {
        fwrite(STDERR, 'DDL export failed: ' . $error->getMessage() . PHP_EOL);
        exit(1);
    }
}
