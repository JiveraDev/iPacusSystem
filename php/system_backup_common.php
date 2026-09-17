<?php

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/runtime_media.php';
if (is_file(__DIR__ . '/grooming_media.php')) {
    require_once __DIR__ . '/grooming_media.php';
}
require_once __DIR__ . '/system_backup_zip.php';
require_once __DIR__ . '/system_backup_excel.php';

const IPAWCUS_BACKUP_SCHEMA_TABLE = 'system_backups';
const IPAWCUS_BACKUP_SETTINGS_TABLE = 'system_backup_settings';
const IPAWCUS_BACKUP_STATE_VERSION = 1;

function ipawcus_backup_module_enabled(): bool
{
    return filter_var((string)(getenv('IPAWCUS_SYSTEM_BACKUPS_ENABLED') ?: '1'), FILTER_VALIDATE_BOOLEAN);
}

function ipawcus_backup_is_absolute_path(string $path): bool
{
    return str_starts_with($path, '/') || preg_match('/^[A-Za-z]:[\\\\\/]/', $path) === 1;
}

function ipawcus_backup_validate_storage_directory(string $directory): string
{
    $directory = trim(str_replace('\\', '/', $directory), '/ ');
    if ($directory === '') {
        return 'primary';
    }
    if (strlen($directory) > 160 || ipawcus_backup_is_absolute_path($directory)) {
        throw new InvalidArgumentException('Use a folder name under the private backup root, not an absolute server path.');
    }
    foreach (explode('/', $directory) as $segment) {
        if ($segment === '' || $segment === '.' || $segment === '..' || preg_match('/^[A-Za-z0-9][A-Za-z0-9._-]*$/', $segment) !== 1) {
            throw new InvalidArgumentException('The backup folder can contain letters, numbers, dashes, underscores, dots, and nested folder separators only.');
        }
    }
    return $directory;
}

function ipawcus_backup_configure_storage_directory(string $directory): void
{
    $GLOBALS['ipawcus_backup_storage_directory'] = ipawcus_backup_validate_storage_directory($directory);
}

function ipawcus_backup_base_storage_root(bool $create = false): string
{
    static $baseRoot = null;
    if ($baseRoot === null) {
        $configured = trim((string)(getenv('IPAWCUS_BACKUP_STORAGE_ROOT') ?: ''));
        if ($configured !== '') {
            $baseRoot = ipawcus_backup_is_absolute_path($configured)
                ? $configured
                : dirname(__DIR__) . DIRECTORY_SEPARATOR . $configured;
        } else {
            $projectRoot = str_replace('\\', '/', dirname(__DIR__));
            $publicHtmlPosition = stripos($projectRoot, '/public_html');
            if ($publicHtmlPosition !== false) {
                $publicHtmlRoot = substr($projectRoot, 0, $publicHtmlPosition + strlen('/public_html'));
                $baseRoot = dirname($publicHtmlRoot) . DIRECTORY_SEPARATOR . 'ipawcus_private_backups';
            } else {
                $baseRoot = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'storage' . DIRECTORY_SEPARATOR . 'backups';
            }
        }
        $baseRoot = rtrim($baseRoot, "/\\");
    }

    if ($create) {
        if (!is_dir($baseRoot) && !mkdir($baseRoot, 0700, true) && !is_dir($baseRoot)) {
            throw new RuntimeException('The private backup storage directory could not be created.');
        }
        @chmod($baseRoot, 0700);
        $denyFile = $baseRoot . DIRECTORY_SEPARATOR . '.htaccess';
        if (!is_file($denyFile)) {
            @file_put_contents($denyFile, "Options -Indexes\n<IfModule mod_authz_core.c>\nRequire all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\nDeny from all\n</IfModule>\n", LOCK_EX);
        }
    }
    return $baseRoot;
}

function ipawcus_backup_storage_root(bool $create = false): string
{
    $storageDirectory = ipawcus_backup_validate_storage_directory((string)($GLOBALS['ipawcus_backup_storage_directory'] ?? 'primary'));
    $root = ipawcus_backup_base_storage_root($create) . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $storageDirectory);
    if ($create) {
        foreach ([$root, $root . DIRECTORY_SEPARATOR . 'archives', $root . DIRECTORY_SEPARATOR . 'states', $root . DIRECTORY_SEPARATOR . 'work'] as $directory) {
            if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) {
                throw new RuntimeException('The private backup storage directory could not be created.');
            }
            @chmod($directory, 0700);
        }
        $denyFile = $root . DIRECTORY_SEPARATOR . '.htaccess';
        if (!is_file($denyFile)) {
            @file_put_contents($denyFile, "Options -Indexes\n<IfModule mod_authz_core.c>\nRequire all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\nDeny from all\n</IfModule>\n", LOCK_EX);
        }
    }
    return $root;
}

function ipawcus_backup_path(string $area, string $fileName = ''): string
{
    if (!in_array($area, ['archives', 'states', 'work'], true)) {
        throw new InvalidArgumentException('Unsupported backup storage area.');
    }
    $path = ipawcus_backup_storage_root(true) . DIRECTORY_SEPARATOR . $area;
    return $fileName === '' ? $path : $path . DIRECTORY_SEPARATOR . $fileName;
}

function ipawcus_backup_table_exists(PDO $pdo, string $table = IPAWCUS_BACKUP_SCHEMA_TABLE): bool
{
    $stmt = $pdo->prepare('SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?');
    $stmt->execute([$table]);
    return (int)$stmt->fetchColumn() > 0;
}

function ipawcus_backup_require_schema(PDO $pdo): void
{
    if (!ipawcus_backup_table_exists($pdo) || !ipawcus_backup_table_exists($pdo, IPAWCUS_BACKUP_SETTINGS_TABLE)) {
        throw new RuntimeException('System Backup is not installed yet. Apply DDL/20260915_01_system_backups.sql first.');
    }
}

function ipawcus_backup_settings(PDO $pdo): array
{
    ipawcus_backup_require_schema($pdo);
    $pdo->exec("INSERT IGNORE INTO system_backup_settings (settings_id, automatic_enabled, automatic_time, storage_directory) VALUES (1, 0, '02:00:00', 'primary')");
    $row = $pdo->query('SELECT * FROM system_backup_settings WHERE settings_id = 1 LIMIT 1')->fetch(PDO::FETCH_ASSOC);
    if (!$row) {
        throw new RuntimeException('Backup settings could not be loaded.');
    }
    $directory = ipawcus_backup_validate_storage_directory((string)($row['storage_directory'] ?? 'primary'));
    return [
        'automaticEnabled' => (int)($row['automatic_enabled'] ?? 0) === 1,
        'automaticTime' => substr((string)($row['automatic_time'] ?? '02:00:00'), 0, 5),
        'storageDirectory' => $directory,
        'lastAutomaticAttemptAt' => $row['last_automatic_attempt_at'] ?? null,
        'lastAutomaticStatus' => (string)($row['last_automatic_status'] ?? 'never'),
        'lastAutomaticBackupId' => $row['last_automatic_backup_id'] === null ? null : (int)$row['last_automatic_backup_id'],
        'updatedAt' => $row['updated_at'] ?? null,
        'updatedBy' => (string)($row['updated_by_name'] ?? ''),
    ];
}

function ipawcus_backup_update_settings(PDO $pdo, array $payload, ?int $actorUserId, string $actorName): array
{
    $current = ipawcus_backup_settings($pdo);
    $runningCount = (int)$pdo->query("SELECT COUNT(*) FROM system_backups WHERE status = 'running' AND started_at >= DATE_SUB(NOW(), INTERVAL 2 HOUR)")->fetchColumn();
    if ($runningCount > 0) {
        throw new InvalidArgumentException('Wait for the current backup to finish before changing automatic backup settings.');
    }
    $enabled = filter_var($payload['automaticEnabled'] ?? false, FILTER_VALIDATE_BOOLEAN);
    $time = $enabled ? trim((string)($payload['automaticTime'] ?? '')) : $current['automaticTime'];
    $directory = $enabled
        ? ipawcus_backup_validate_storage_directory((string)($payload['storageDirectory'] ?? ''))
        : $current['storageDirectory'];
    if ($enabled && preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/', $time) !== 1) {
        throw new InvalidArgumentException('Choose a valid daily backup time.');
    }
    if ($enabled) {
        ipawcus_backup_configure_storage_directory($directory);
        ipawcus_backup_storage_root(true);
    }
    $stmt = $pdo->prepare('UPDATE system_backup_settings SET automatic_enabled = ?, automatic_time = ?, storage_directory = ?, updated_by_user_id = ?, updated_by_name = ?, updated_at = NOW() WHERE settings_id = 1');
    $stmt->execute([
        $enabled ? 1 : 0,
        $time . ':00',
        $directory,
        $actorUserId,
        substr(trim($actorName) !== '' ? trim($actorName) : 'Super Admin', 0, 220),
    ]);
    $settings = ipawcus_backup_settings($pdo);
    ipawcus_backup_configure_storage_directory($settings['storageDirectory']);
    return $settings;
}

function ipawcus_backup_relative_path(string $area, string $fileName): string
{
    $directory = ipawcus_backup_validate_storage_directory((string)($GLOBALS['ipawcus_backup_storage_directory'] ?? 'primary'));
    return $directory . '/' . $area . '/' . basename($fileName);
}

function ipawcus_backup_resolve_stored_path(string $area, string $storedPath): string
{
    $normalized = trim(str_replace('\\', '/', $storedPath), '/ ');
    if ($normalized === '' || str_contains($normalized, '..')) {
        return '';
    }
    if (!str_contains($normalized, '/')) {
        $activePath = ipawcus_backup_path($area, basename($normalized));
        $legacyPath = ipawcus_backup_base_storage_root(true) . DIRECTORY_SEPARATOR . $area . DIRECTORY_SEPARATOR . basename($normalized);
        return is_file($activePath) || !is_file($legacyPath) ? $activePath : $legacyPath;
    }
    $base = ipawcus_backup_base_storage_root(true);
    $candidate = $base . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $normalized);
    $expectedPart = DIRECTORY_SEPARATOR . $area . DIRECTORY_SEPARATOR;
    return str_contains($candidate, $expectedPart) ? $candidate : '';
}

function ipawcus_backup_uuid(): string
{
    $bytes = random_bytes(16);
    $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
    $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
    $hex = bin2hex($bytes);
    return substr($hex, 0, 8) . '-' . substr($hex, 8, 4) . '-' . substr($hex, 12, 4) . '-' . substr($hex, 16, 4) . '-' . substr($hex, 20);
}

function ipawcus_backup_quote_identifier(string $identifier): string
{
    if ($identifier === '' || preg_match('/^[A-Za-z0-9_$]+$/', $identifier) !== 1) {
        throw new InvalidArgumentException('Unsafe database identifier encountered during backup.');
    }
    return '`' . str_replace('`', '``', $identifier) . '`';
}

function ipawcus_backup_list_tables(PDO $pdo): array
{
    $stmt = $pdo->query('SHOW FULL TABLES WHERE Table_type = \'BASE TABLE\'');
    $tables = [];
    while (($row = $stmt->fetch(PDO::FETCH_NUM)) !== false) {
        $tables[] = (string)$row[0];
    }
    sort($tables, SORT_STRING);
    return $tables;
}

function ipawcus_backup_table_metadata(PDO $pdo, string $table): array
{
    $quoted = ipawcus_backup_quote_identifier($table);
    $columns = $pdo->query('SHOW COLUMNS FROM ' . $quoted)->fetchAll(PDO::FETCH_ASSOC);
    $primary = [];
    foreach ($pdo->query('SHOW KEYS FROM ' . $quoted . " WHERE Key_name = 'PRIMARY'")->fetchAll(PDO::FETCH_ASSOC) as $key) {
        $primary[(int)$key['Seq_in_index']] = (string)$key['Column_name'];
    }
    ksort($primary);
    $createRow = $pdo->query('SHOW CREATE TABLE ' . $quoted)->fetch(PDO::FETCH_ASSOC);
    $createSql = (string)($createRow['Create Table'] ?? array_values($createRow ?: [])[1] ?? '');
    return [
        'columns' => $columns,
        'primary' => array_values($primary),
        'createSql' => $createSql,
    ];
}

function ipawcus_backup_schema(PDO $pdo, array $tables): array
{
    $schema = [];
    foreach ($tables as $table) {
        $metadata = ipawcus_backup_table_metadata($pdo, $table);
        $schema[$table] = [
            'primary' => $metadata['primary'],
            'createSql' => $metadata['createSql'],
            'columns' => array_map(static fn(array $column): array => [
                'name' => (string)$column['Field'],
                'type' => (string)$column['Type'],
                'null' => (string)$column['Null'],
                'key' => (string)$column['Key'],
                'extra' => (string)$column['Extra'],
            ], $metadata['columns']),
        ];
    }
    return $schema;
}

function ipawcus_backup_schema_hash(array $schema): string
{
    $stableSchema = $schema;
    $tables = isset($stableSchema['tables']) && is_array($stableSchema['tables'])
        ? $stableSchema['tables']
        : $stableSchema;
    foreach ($tables as &$definition) {
        $definition['createSql'] = preg_replace('/\sAUTO_INCREMENT=\d+/i', ' AUTO_INCREMENT=0', (string)$definition['createSql']);
    }
    unset($definition);
    if (isset($stableSchema['tables'])) {
        $stableSchema['tables'] = $tables;
    } else {
        $stableSchema = $tables;
    }
    return hash('sha256', json_encode($stableSchema, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR));
}

function ipawcus_backup_schema_extras(PDO $pdo): array
{
    $views = [];
    $viewStatement = $pdo->query("SHOW FULL TABLES WHERE Table_type = 'VIEW'");
    while (($row = $viewStatement->fetch(PDO::FETCH_NUM)) !== false) {
        $name = (string)$row[0];
        $createRow = $pdo->query('SHOW CREATE VIEW ' . ipawcus_backup_quote_identifier($name))->fetch(PDO::FETCH_ASSOC);
        $createSql = (string)($createRow['Create View'] ?? array_values($createRow ?: [])[1] ?? '');
        if ($createSql === '') {
            throw new RuntimeException('A database view definition could not be read for backup.');
        }
        $createSql = preg_replace('/\sDEFINER=(?:`[^`]*`@`[^`]*`|[^\s]+)/i', '', $createSql) ?? $createSql;
        $createSql = preg_replace('/SQL SECURITY DEFINER/i', 'SQL SECURITY INVOKER', $createSql) ?? $createSql;
        $views[$name] = $createSql;
    }
    ksort($views, SORT_STRING);

    $triggers = [];
    foreach ($pdo->query('SHOW TRIGGERS')->fetchAll(PDO::FETCH_ASSOC) as $trigger) {
        $name = (string)($trigger['Trigger'] ?? '');
        if ($name === '') {
            continue;
        }
        $triggers[$name] = [
            'timing' => strtoupper((string)($trigger['Timing'] ?? '')),
            'event' => strtoupper((string)($trigger['Event'] ?? '')),
            'table' => (string)($trigger['Table'] ?? ''),
            'statement' => (string)($trigger['Statement'] ?? ''),
        ];
    }
    ksort($triggers, SORT_STRING);
    return ['views' => $views, 'triggers' => $triggers];
}

function ipawcus_backup_binary_columns(array $columns): array
{
    $binary = [];
    foreach ($columns as $column) {
        $type = strtolower((string)($column['Type'] ?? $column['type'] ?? ''));
        if (preg_match('/(?:binary|blob|bit)/', $type)) {
            $binary[(string)($column['Field'] ?? $column['name'] ?? '')] = true;
        }
    }
    return $binary;
}

function ipawcus_backup_sql_value(PDO $pdo, mixed $value, bool $binary = false): string
{
    if ($value === null) {
        return 'NULL';
    }
    if ($binary) {
        return '0x' . bin2hex((string)$value);
    }
    $quoted = $pdo->quote((string)$value);
    if ($quoted === false) {
        throw new RuntimeException('A database value could not be encoded for recovery.');
    }
    return $quoted;
}

function ipawcus_backup_write($handle, string $value): void
{
    $length = strlen($value);
    $offset = 0;
    while ($offset < $length) {
        $written = fwrite($handle, substr($value, $offset));
        if ($written === false || $written === 0) {
            throw new RuntimeException('A backup work file could not be written completely.');
        }
        $offset += $written;
    }
}

function ipawcus_backup_row_key(array $row, array $primary): string
{
    $values = [];
    foreach ($primary as $column) {
        $values[] = $row[$column] ?? null;
    }
    return base64_encode(serialize($values));
}

function ipawcus_backup_row_hash(array $row): string
{
    return hash('sha256', serialize($row));
}

function ipawcus_backup_write_insert(PDO $pdo, $handle, string $verb, string $table, array $row, array $binaryColumns): void
{
    $columns = array_keys($row);
    $values = [];
    foreach ($row as $column => $value) {
        $values[] = ipawcus_backup_sql_value($pdo, $value, isset($binaryColumns[$column]));
    }
    $operation = $verb === 'UPSERT' ? 'INSERT' : $verb;
    $duplicateUpdate = $verb === 'UPSERT'
        ? ' ON DUPLICATE KEY UPDATE ' . implode(', ', array_map(
            static fn(string $column): string => ipawcus_backup_quote_identifier($column) . ' = VALUES(' . ipawcus_backup_quote_identifier($column) . ')',
            $columns
        ))
        : '';
    ipawcus_backup_write(
        $handle,
        $operation . ' INTO ' . ipawcus_backup_quote_identifier($table)
        . ' (' . implode(', ', array_map('ipawcus_backup_quote_identifier', $columns)) . ') VALUES ('
        . implode(', ', $values) . ')' . $duplicateUpdate . ";\n"
    );
}

function ipawcus_backup_write_delete(PDO $pdo, $handle, string $table, array $primary, string $encodedKey): void
{
    $values = @unserialize((string)base64_decode($encodedKey, true), ['allowed_classes' => false]);
    if (!is_array($values) || count($values) !== count($primary)) {
        throw new RuntimeException('A previous incremental state key is invalid. Create a new complete backup.');
    }
    $parts = [];
    foreach ($primary as $index => $column) {
        $value = $values[$index] ?? null;
        $parts[] = ipawcus_backup_quote_identifier($column) . ($value === null ? ' IS NULL' : ' = ' . ipawcus_backup_sql_value($pdo, $value));
    }
    ipawcus_backup_write($handle, 'DELETE FROM ' . ipawcus_backup_quote_identifier($table) . ' WHERE ' . implode(' AND ', $parts) . " LIMIT 1;\n");
}

function ipawcus_backup_previous(PDO $pdo): ?array
{
    $stmt = $pdo->query("SELECT * FROM system_backups WHERE status = 'completed' ORDER BY completed_at DESC, backup_id DESC LIMIT 1");
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return $row ?: null;
}

function ipawcus_backup_base(PDO $pdo): ?array
{
    $stmt = $pdo->query("SELECT * FROM system_backups WHERE status = 'completed' AND backup_type = 'complete' ORDER BY completed_at DESC, backup_id DESC LIMIT 1");
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return $row ?: null;
}

function ipawcus_backup_load_state(?array $backup): ?array
{
    if (!$backup || trim((string)($backup['state_path'] ?? '')) === '') {
        return null;
    }
    $path = ipawcus_backup_resolve_stored_path('states', (string)$backup['state_path']);
    if (!is_file($path) || !is_readable($path)) {
        return null;
    }
    $decoded = json_decode((string)file_get_contents($path), true);
    return is_array($decoded) && (int)($decoded['version'] ?? 0) === IPAWCUS_BACKUP_STATE_VERSION ? $decoded : null;
}

function ipawcus_backup_write_database(PDO $pdo, string $type, string $sqlPath, array $previousState, array $tables, array $schema, array $extras, ?callable $onTable = null): array
{
    $handle = fopen($sqlPath, 'wb');
    if ($handle === false) {
        throw new RuntimeException('The database recovery file could not be created.');
    }
    $scanned = 0;
    $changed = 0;
    $tableStates = [];

    try {
        ipawcus_backup_write($handle, "-- iPawcus database recovery file\n-- Generated " . gmdate(DATE_ATOM) . "\nSET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS=0;\n\n");
        if ($type === 'complete') {
            foreach (array_reverse(array_keys($extras['views'] ?? [])) as $viewName) {
                ipawcus_backup_write($handle, 'DROP VIEW IF EXISTS ' . ipawcus_backup_quote_identifier($viewName) . ";\n");
            }
        }
        foreach (array_keys($extras['triggers'] ?? []) as $triggerName) {
            ipawcus_backup_write($handle, 'DROP TRIGGER IF EXISTS ' . ipawcus_backup_quote_identifier($triggerName) . ";\n");
        }
        ipawcus_backup_write($handle, "\n");
        $tableTotal = count($tables);
        foreach ($tables as $tableIndex => $table) {
            $definition = $schema[$table];
            $primary = $definition['primary'];
            $binary = ipawcus_backup_binary_columns($definition['columns']);
            $previousTable = $previousState['tables'][$table] ?? [];
            $currentHashes = [];
            $tableHash = hash_init('sha256');
            $quotedTable = ipawcus_backup_quote_identifier($table);
            $orderBy = $primary ? ' ORDER BY ' . implode(', ', array_map('ipawcus_backup_quote_identifier', $primary)) : '';
            $insertableColumns = array_values(array_filter(
                $definition['columns'],
                static fn(array $column): bool => !str_contains(strtoupper((string)($column['extra'] ?? '')), 'GENERATED')
            ));
            $selectList = implode(', ', array_map(
                static fn(array $column): string => ipawcus_backup_quote_identifier((string)$column['name']),
                $definition['columns']
            ));
            $insertableNames = array_fill_keys(array_map(static fn(array $column): string => (string)$column['name'], $insertableColumns), true);
            if ($selectList === '' || !$insertableNames) {
                throw new RuntimeException('A database table has no restorable columns.');
            }
            $stmt = $pdo->query('SELECT ' . $selectList . ' FROM ' . $quotedTable . $orderBy);

            if ($type === 'complete') {
                ipawcus_backup_write($handle, 'DROP TABLE IF EXISTS ' . $quotedTable . ";\n" . $definition['createSql'] . ";\n");
            }

            if (in_array($table, [IPAWCUS_BACKUP_SCHEMA_TABLE, IPAWCUS_BACKUP_SETTINGS_TABLE], true)) {
                $stmt->closeCursor();
                $tableStates[$table] = ['primary' => $primary, 'rows' => [], 'tableHash' => hash('sha256', '')];
                ipawcus_backup_write($handle, "\n");
                continue;
            }

            while (($row = $stmt->fetch(PDO::FETCH_ASSOC)) !== false) {
                $scanned++;
                $restoreRow = array_intersect_key($row, $insertableNames);
                $rowHash = ipawcus_backup_row_hash($restoreRow);
                hash_update($tableHash, $rowHash);
                if ($primary) {
                    $key = ipawcus_backup_row_key($row, $primary);
                    $currentHashes[$key] = $rowHash;
                    $isChanged = $type === 'complete' || (($previousTable['rows'][$key] ?? null) !== $rowHash);
                } else {
                    $isChanged = $type === 'complete';
                }
                if ($isChanged) {
                    ipawcus_backup_write_insert($pdo, $handle, $type === 'complete' ? 'INSERT' : 'UPSERT', $table, $restoreRow, $binary);
                    $changed++;
                }
            }
            $stmt->closeCursor();
            $currentTableHash = hash_final($tableHash);

            if ($type === 'changes' && !$primary && (($previousTable['tableHash'] ?? null) !== $currentTableHash)) {
                ipawcus_backup_write($handle, "DELETE FROM {$quotedTable};\n");
                $replacementRows = $pdo->query('SELECT ' . $selectList . ' FROM ' . $quotedTable);
                while (($row = $replacementRows->fetch(PDO::FETCH_ASSOC)) !== false) {
                    ipawcus_backup_write_insert($pdo, $handle, 'INSERT', $table, array_intersect_key($row, $insertableNames), $binary);
                    $changed++;
                }
                $replacementRows->closeCursor();
            }

            if ($type === 'changes' && $primary) {
                foreach (array_diff_key($previousTable['rows'] ?? [], $currentHashes) as $deletedKey => $_hash) {
                    ipawcus_backup_write_delete($pdo, $handle, $table, $primary, (string)$deletedKey);
                    $changed++;
                }
            }

            $tableStates[$table] = $primary
                ? ['primary' => $primary, 'rows' => $currentHashes, 'tableHash' => $currentTableHash]
                : ['primary' => [], 'rows' => [], 'tableHash' => $currentTableHash];
            ipawcus_backup_write($handle, "\n");
            if ($onTable !== null) {
                $onTable($tableIndex + 1, $tableTotal, $table);
            }
        }

        foreach ($extras['triggers'] ?? [] as $triggerName => $trigger) {
            if (!in_array($trigger['timing'], ['BEFORE', 'AFTER'], true)
                || !in_array($trigger['event'], ['INSERT', 'UPDATE', 'DELETE'], true)
                || $trigger['table'] === '' || $trigger['statement'] === '') {
                throw new RuntimeException('A database trigger definition could not be encoded for backup.');
            }
            ipawcus_backup_write($handle, "DELIMITER ;;\nCREATE TRIGGER " . ipawcus_backup_quote_identifier($triggerName)
                . ' ' . $trigger['timing'] . ' ' . $trigger['event'] . ' ON ' . ipawcus_backup_quote_identifier($trigger['table'])
                . ' FOR EACH ROW ' . $trigger['statement'] . ";;\nDELIMITER ;\n\n");
        }
        if ($type === 'complete') {
            foreach ($extras['views'] ?? [] as $viewName => $createSql) {
                ipawcus_backup_write($handle, 'DROP VIEW IF EXISTS ' . ipawcus_backup_quote_identifier($viewName) . ";\n" . $createSql . ";\n\n");
            }
        }
        ipawcus_backup_write($handle, "SET FOREIGN_KEY_CHECKS=1;\n");
    } finally {
        fclose($handle);
    }

    return ['scanned' => $scanned, 'changed' => $changed, 'tables' => $tableStates];
}

function ipawcus_backup_scan_media(): array
{
    $root = ipawcus_runtime_media_root(false);
    $files = [];
    foreach (IPAWCUS_RUNTIME_MEDIA_DIRECTORIES as $directory) {
        $directoryPath = $root . DIRECTORY_SEPARATOR . $directory;
        if (!is_dir($directoryPath)) {
            continue;
        }
        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($directoryPath, FilesystemIterator::SKIP_DOTS),
            RecursiveIteratorIterator::LEAVES_ONLY
        );
        foreach ($iterator as $file) {
            if (!$file->isFile() || $file->isLink() || $file->getFilename() === '.htaccess') {
                continue;
            }
            $realPath = $file->getRealPath();
            if ($realPath === false || !is_readable($realPath)) {
                throw new RuntimeException('A runtime media file could not be read for backup.');
            }
            $relative = $directory . '/' . ltrim(str_replace('\\', '/', substr($realPath, strlen($directoryPath))), '/');
            $hash = hash_file('sha256', $realPath);
            if ($hash === false) {
                throw new RuntimeException('A runtime media file could not be verified for backup.');
            }
            $files[$relative] = ['path' => $realPath, 'hash' => $hash, 'size' => $file->getSize()];
        }
    }

    $groomingRootSetting = trim((string)(getenv('IPAWCUS_GROOMING_MEDIA_ROOT') ?: ''));
    if ($groomingRootSetting !== '' && function_exists('grooming_photo_directory')) {
        $directoryPath = grooming_photo_directory(false);
        if (is_dir($directoryPath)) {
            $iterator = new RecursiveIteratorIterator(
                new RecursiveDirectoryIterator($directoryPath, FilesystemIterator::SKIP_DOTS),
                RecursiveIteratorIterator::LEAVES_ONLY
            );
            foreach ($iterator as $file) {
                if (!$file->isFile() || $file->isLink() || $file->getFilename() === '.htaccess') {
                    continue;
                }
                $realPath = $file->getRealPath();
                if ($realPath === false || !is_readable($realPath)) {
                    throw new RuntimeException('A grooming photo could not be read for backup.');
                }
                $hash = hash_file('sha256', $realPath);
                if ($hash === false) {
                    throw new RuntimeException('A grooming photo could not be verified for backup.');
                }
                $relative = 'grooming_photos/' . ltrim(str_replace('\\', '/', substr($realPath, strlen($directoryPath))), '/');
                $files[$relative] = ['path' => $realPath, 'hash' => $hash, 'size' => $file->getSize()];
            }
        }
    }
    ksort($files, SORT_STRING);
    return $files;
}

function ipawcus_backup_atomic_json(string $path, array $payload): void
{
    $temporary = $path . '.part';
    $json = json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    if (file_put_contents($temporary, $json, LOCK_EX) === false) {
        throw new RuntimeException('Backup metadata could not be written.');
    }
    @chmod($temporary, 0600);
    if (DIRECTORY_SEPARATOR === '\\' && is_file($path)) {
        @unlink($path);
    }
    if (!rename($temporary, $path)) {
        @unlink($temporary);
        throw new RuntimeException('Backup metadata could not be finalized.');
    }
}

function ipawcus_backup_update_progress(PDO $pdo, int $backupId, int $percent, string $stage): void
{
    $stmt = $pdo->prepare('UPDATE system_backups SET progress_percent = ?, progress_stage = ? WHERE backup_id = ?');
    $stmt->execute([max(0, min(99, $percent)), substr($stage, 0, 160), $backupId]);
}

function ipawcus_backup_format_row(array $row): array
{
    $started = strtotime((string)($row['started_at'] ?? '')) ?: time();
    $effectiveStatus = (string)($row['status'] ?? 'failed');
    if ($effectiveStatus === 'running' && $started < time() - 7200) {
        $effectiveStatus = 'interrupted';
    }
    return [
        'id' => (int)$row['backup_id'],
        'reference' => (string)$row['backup_uuid'],
        'type' => (string)$row['backup_type'],
        'status' => $effectiveStatus,
        'progressPercent' => (int)$row['progress_percent'],
        'progressStage' => (string)$row['progress_stage'],
        'parentBackupId' => $row['parent_backup_id'] === null ? null : (int)$row['parent_backup_id'],
        'baseBackupId' => $row['base_backup_id'] === null ? null : (int)$row['base_backup_id'],
        'archiveName' => (string)($row['archive_name'] ?? ''),
        'archiveSize' => $row['archive_size'] === null ? null : (int)$row['archive_size'],
        'checksumSha256' => (string)($row['checksum_sha256'] ?? ''),
        'scannedRows' => (int)$row['scanned_row_count'],
        'changedRows' => (int)$row['changed_row_count'],
        'includedFiles' => (int)$row['included_file_count'],
        'deletedFiles' => (int)$row['deleted_file_count'],
        'createdBy' => (string)$row['created_by_name'],
        'startedAt' => (string)$row['started_at'],
        'completedAt' => $row['completed_at'] === null ? null : (string)$row['completed_at'],
        'errorMessage' => $effectiveStatus === 'failed' || $effectiveStatus === 'interrupted' ? (string)($row['error_message'] ?? '') : '',
        'downloadReady' => $effectiveStatus === 'completed' && trim((string)($row['archive_path'] ?? '')) !== '',
    ];
}

function ipawcus_backup_list(PDO $pdo): array
{
    $settings = ipawcus_backup_settings($pdo);
    ipawcus_backup_configure_storage_directory($settings['storageDirectory']);
    $rows = $pdo->query('SELECT * FROM system_backups ORDER BY started_at DESC, backup_id DESC LIMIT 100')->fetchAll(PDO::FETCH_ASSOC);
    $backups = array_map('ipawcus_backup_format_row', $rows);
    $latest = null;
    foreach ($backups as $backup) {
        if ($backup['status'] === 'completed') {
            $latest = $backup;
            break;
        }
    }
    $hasRunning = count(array_filter($backups, static fn(array $backup): bool => $backup['status'] === 'running')) > 0;
    $base = ipawcus_backup_base($pdo);
    $previous = ipawcus_backup_previous($pdo);
    $previousState = ipawcus_backup_load_state($previous);
    $root = ipawcus_backup_storage_root(false);
    $configuredRoot = trim((string)(getenv('IPAWCUS_BACKUP_STORAGE_ROOT') ?: ''));
    return [
        'backups' => $backups,
        'latestVerified' => $latest,
        'canCreateChanges' => !$hasRunning && $base !== null && $previousState !== null,
        'hasRunning' => $hasRunning,
        'settings' => $settings,
        'storage' => [
            'configured' => $configuredRoot !== '',
            'writable' => is_dir($root) ? is_writable($root) : is_writable(dirname($root)),
            'offsiteLabel' => trim((string)(getenv('IPAWCUS_BACKUP_OFFSITE_LABEL') ?: '')),
            'serverPath' => $root,
            'baseConfigured' => $configuredRoot !== '',
        ],
    ];
}

function ipawcus_backup_run_scheduled(): array
{
    if (!ipawcus_backup_module_enabled()) {
        return ['ran' => false, 'reason' => 'System Backup is disabled by the server configuration.'];
    }

    $pdo = createDatabaseConnection();
    $settings = ipawcus_backup_settings($pdo);
    ipawcus_backup_configure_storage_directory($settings['storageDirectory']);
    if (!$settings['automaticEnabled']) {
        return ['ran' => false, 'reason' => 'Automatic incremental backup is turned off.'];
    }

    $timezoneName = trim((string)(getenv('APP_TIMEZONE') ?: 'Asia/Manila'));
    try {
        $timezone = new DateTimeZone($timezoneName);
    } catch (Throwable $error) {
        $timezone = new DateTimeZone('Asia/Manila');
    }
    $now = new DateTimeImmutable('now', $timezone);
    $scheduled = DateTimeImmutable::createFromFormat('!H:i', $settings['automaticTime'], $timezone);
    if (!$scheduled) {
        throw new RuntimeException('The saved automatic backup time is invalid.');
    }
    $todaySchedule = $now->setTime((int)$scheduled->format('H'), (int)$scheduled->format('i'));
    if ($now < $todaySchedule) {
        return ['ran' => false, 'reason' => 'The automatic backup time has not arrived yet.'];
    }

    $todayStart = $now->setTime(0, 0)->format('Y-m-d H:i:s');
    $attemptAt = $now->format('Y-m-d H:i:s');
    $claim = $pdo->prepare("UPDATE system_backup_settings SET last_automatic_attempt_at = ?, last_automatic_status = 'running', last_automatic_backup_id = NULL WHERE settings_id = 1 AND automatic_enabled = 1 AND (last_automatic_attempt_at IS NULL OR last_automatic_attempt_at < ?)");
    $claim->execute([$attemptAt, $todayStart]);
    if ($claim->rowCount() !== 1) {
        return ['ran' => false, 'reason' => 'Today\'s automatic backup was already attempted.'];
    }

    try {
        $previous = ipawcus_backup_previous($pdo);
        $base = ipawcus_backup_base($pdo);
        $type = $base !== null && ipawcus_backup_load_state($previous) !== null ? 'changes' : 'complete';
        $backup = ipawcus_backup_create($type, null, 'Automatic schedule');
        $complete = $pdo->prepare("UPDATE system_backup_settings SET last_automatic_status = 'completed', last_automatic_backup_id = ? WHERE settings_id = 1");
        $complete->execute([$backup['id']]);
        return ['ran' => true, 'reason' => '', 'backup' => $backup];
    } catch (Throwable $error) {
        $failed = $pdo->prepare("UPDATE system_backup_settings SET last_automatic_status = 'failed' WHERE settings_id = 1");
        $failed->execute();
        throw $error;
    }
}

function ipawcus_backup_catalog(PDO $pdo): array
{
    $rows = $pdo->query("SELECT * FROM system_backups WHERE status = 'completed' ORDER BY completed_at ASC, backup_id ASC")->fetchAll(PDO::FETCH_ASSOC);
    return [
        'format' => 'iPawcus Backup Catalog',
        'generatedAt' => gmdate(DATE_ATOM),
        'restoreOrder' => 'Restore the selected complete backup, then every following changes backup in chronological order.',
        'backups' => array_map(static function (array $row): array {
            $item = ipawcus_backup_format_row($row);
            unset($item['errorMessage'], $item['downloadReady'], $item['progressStage'], $item['progressPercent']);
            return $item;
        }, $rows),
    ];
}

function ipawcus_backup_write_catalog(PDO $pdo): void
{
    ipawcus_backup_atomic_json(ipawcus_backup_storage_root(true) . DIRECTORY_SEPARATOR . 'backup-index.json', ipawcus_backup_catalog($pdo));
}

function ipawcus_backup_restore_instructions(string $type, string $reference, ?array $parent, ?array $base): string
{
    $dependency = $type === 'complete'
        ? 'This package is a complete recovery baseline.'
        : 'Restore the complete backup ID ' . (int)($base['backup_id'] ?? 0) . ', then each changes backup through parent ID ' . (int)($parent['backup_id'] ?? 0) . ' before this package.';
    return "iPawcus Backup {$reference}\n\n{$dependency}\n\n"
        . "RECOVERY\n1. Use a clean recovery server and preserve the failed server before changing it.\n"
        . "2. Verify the ZIP SHA-256 checksum against the Super Admin list or the private backup-index.json stored beside the archives.\n"
        . "3. Import database.sql into the intended iPawcus database.\n"
        . "4. Copy the media/ directory into the configured runtime media root. For a changes package, remove paths listed in deleted-files.json.\n"
        . "5. Verify login, pets, queue, bookings, diagnoses, inventory, invoices, and media before reopening the clinic system.\n\n"
        . "EMERGENCY WORKBOOK\nOpen emergency-operations.xlsx to read the saved operational lists. Enter outage work only in its Offline Entries sheet, then reconcile those entries manually after service returns.\n\n"
        . "Do not restore directly over the only production database. A trained IT administrator should perform and test recovery.\n";
}

function ipawcus_backup_safe_failure_message(Throwable $error): string
{
    $message = trim($error->getMessage());
    $safeStarts = [
        'The database structure changed',
        'A runtime media file could not be read',
        'A runtime media file could not be verified',
        'The backup archive is too large',
        'The backup contains too many files',
        'A backup file is larger than',
    ];
    foreach ($safeStarts as $start) {
        if (str_starts_with($message, $start)) {
            return $message;
        }
    }
    return 'Backup failed safely. No completed archive was published. Ask IT to check the server backup log, then try again.';
}

function ipawcus_backup_create(string $type, ?int $actorUserId, string $actorName): array
{
    if (!ipawcus_backup_module_enabled()) {
        throw new RuntimeException('System Backup is disabled by the server configuration.');
    }
    if (!in_array($type, ['complete', 'changes'], true)) {
        throw new InvalidArgumentException('Choose either a complete backup or a recent-changes backup.');
    }
    ignore_user_abort(true);
    @set_time_limit(0);
    $metaPdo = createDatabaseConnection();
    $settings = ipawcus_backup_settings($metaPdo);
    ipawcus_backup_configure_storage_directory($settings['storageDirectory']);
    ipawcus_backup_storage_root(true);

    $lockPath = ipawcus_backup_storage_root(true) . DIRECTORY_SEPARATOR . 'backup.lock';
    $lockHandle = fopen($lockPath, 'c+b');
    if ($lockHandle === false || !flock($lockHandle, LOCK_EX | LOCK_NB)) {
        if (is_resource($lockHandle)) fclose($lockHandle);
        throw new RuntimeException('Another backup is already running. Wait for it to finish before starting another.');
    }

    $reference = ipawcus_backup_uuid();
    $safeActorName = trim($actorName) !== '' ? trim($actorName) : 'Super Admin';
    $parent = $type === 'changes' ? ipawcus_backup_previous($metaPdo) : null;
    $base = $type === 'complete' ? null : ipawcus_backup_base($metaPdo);
    $previousState = $type === 'changes' ? ipawcus_backup_load_state($parent) : [];
    if ($type === 'changes' && (!$parent || !$base || !$previousState)) {
        flock($lockHandle, LOCK_UN);
        fclose($lockHandle);
        throw new RuntimeException('Create a complete backup first. Recent-changes backups require an intact verified baseline and prior state.');
    }

    $insert = $metaPdo->prepare("INSERT INTO system_backups (backup_uuid, backup_type, status, progress_percent, progress_stage, parent_backup_id, base_backup_id, created_by_user_id, created_by_name) VALUES (?, ?, 'running', 1, 'Preparing a consistent snapshot', ?, ?, ?, ?)");
    $insert->execute([
        $reference,
        $type,
        $parent['backup_id'] ?? null,
        $type === 'complete' ? null : ($base['backup_id'] ?? null),
        $actorUserId,
        substr($safeActorName, 0, 220),
    ]);
    $backupId = (int)$metaPdo->lastInsertId();
    $stamp = gmdate('Ymd-His');
    $archiveName = 'ipawcus-' . ($type === 'complete' ? 'complete' : 'changes') . '-' . $stamp . '-' . substr($reference, 0, 8) . '.zip';
    $archivePath = ipawcus_backup_path('archives', $archiveName);
    $partialArchive = $archivePath . '.part';
    $sqlPath = ipawcus_backup_path('work', $reference . '-database.sql');
    $xlsxPath = ipawcus_backup_path('work', $reference . '-emergency-operations.xlsx');
    $stateName = $reference . '.json';
    $statePath = ipawcus_backup_path('states', $stateName);
    $statePartial = $statePath . '.part';
    $snapshotPdo = null;
    $published = false;

    try {
        $snapshotPdo = createDatabaseConnection();
        $snapshotPdo->exec('SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ');
        $snapshotPdo->exec('START TRANSACTION WITH CONSISTENT SNAPSHOT');
        ipawcus_backup_update_progress($metaPdo, $backupId, 8, 'Reading database structure');
        $tables = ipawcus_backup_list_tables($snapshotPdo);
        $schema = ipawcus_backup_schema($snapshotPdo, $tables);
        $extras = ipawcus_backup_schema_extras($snapshotPdo);
        $schemaHash = ipawcus_backup_schema_hash(['tables' => $schema, 'extras' => $extras]);
        if ($type === 'changes' && ($previousState['schemaHash'] ?? '') !== $schemaHash) {
            throw new RuntimeException('The database structure changed after the last backup. Create a new complete backup before backing up recent changes.');
        }

        ipawcus_backup_update_progress($metaPdo, $backupId, 18, 'Writing database recovery data');
        $snapshotPdo->setAttribute(PDO::MYSQL_ATTR_USE_BUFFERED_QUERY, false);
        $database = ipawcus_backup_write_database(
            $snapshotPdo,
            $type,
            $sqlPath,
            $previousState,
            $tables,
            $schema,
            $extras,
            static function (int $current, int $total, string $table) use ($metaPdo, $backupId): void {
                $percent = 18 + (int)floor(($current / max(1, $total)) * 34);
                ipawcus_backup_update_progress($metaPdo, $backupId, $percent, "Saving database table {$current} of {$total}: {$table}");
            }
        );
        ipawcus_backup_update_progress($metaPdo, $backupId, 55, 'Creating the emergency Excel workbook');
        $workbook = ipawcus_create_emergency_workbook($snapshotPdo, $xlsxPath, [
            'createdAt' => gmdate(DATE_ATOM), 'type' => $type, 'reference' => $reference,
        ]);
        $snapshotPdo->commit();

        ipawcus_backup_update_progress($metaPdo, $backupId, 70, 'Comparing saved files');
        $media = ipawcus_backup_scan_media();
        $previousFiles = $previousState['files'] ?? [];
        $fileState = [];
        $included = [];
        foreach ($media as $relative => $details) {
            $fileState[$relative] = $details['hash'];
            if ($type === 'complete' || ($previousFiles[$relative] ?? null) !== $details['hash']) {
                $included[$relative] = $details;
            }
        }
        $deleted = $type === 'changes' ? array_values(array_diff(array_keys($previousFiles), array_keys($fileState))) : [];

        $state = [
            'version' => IPAWCUS_BACKUP_STATE_VERSION,
            'backupId' => $backupId,
            'reference' => $reference,
            'type' => $type,
            'createdAt' => gmdate(DATE_ATOM),
            'schemaHash' => $schemaHash,
            'tables' => $database['tables'],
            'files' => $fileState,
        ];
        $stateJson = json_encode($state, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
        if (file_put_contents($statePartial, $stateJson, LOCK_EX) === false) {
            throw new RuntimeException('The incremental backup state could not be written.');
        }
        @chmod($statePartial, 0600);

        ipawcus_backup_update_progress($metaPdo, $backupId, 80, 'Packing and verifying the archive');
        $databaseHash = hash_file('sha256', $sqlPath);
        $workbookHash = hash_file('sha256', $xlsxPath);
        if ($databaseHash === false || $workbookHash === false) {
            throw new RuntimeException('A recovery component could not be verified before packaging.');
        }
        $manifest = [
            'format' => 'iPawcus System Backup',
            'formatVersion' => 1,
            'backupId' => $backupId,
            'reference' => $reference,
            'type' => $type,
            'createdAt' => gmdate(DATE_ATOM),
            'parentBackupId' => $parent ? (int)$parent['backup_id'] : null,
            'baseBackupId' => $type === 'complete' ? $backupId : (int)$base['backup_id'],
            'contents' => [
                'databaseFile' => 'database.sql',
                'workbookFile' => 'emergency-operations.xlsx',
                'includedMediaFiles' => count($included),
                'deletedMediaFiles' => count($deleted),
                'databaseRowsScanned' => $database['scanned'],
                'databaseRowsWritten' => $database['changed'],
                'workbook' => $workbook,
                'databaseViews' => count($extras['views']),
                'databaseTriggers' => count($extras['triggers']),
            ],
            'componentSha256' => [
                'database.sql' => $databaseHash,
                'emergency-operations.xlsx' => $workbookHash,
                'media' => array_map(static fn(array $details): string => $details['hash'], $included),
            ],
            'dependency' => $type === 'complete'
                ? 'Independent complete baseline'
                : 'Requires its complete baseline and every previous changes backup in chronological order',
        ];
        $zip = new IpawcusStreamingZipWriter($partialArchive);
        $zip->addFile('database.sql', $sqlPath);
        $zip->addFile('emergency-operations.xlsx', $xlsxPath);
        $zip->addString('backup-manifest.json', json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR));
        $zip->addString('deleted-files.json', json_encode($deleted, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));
        $zip->addString('RESTORE-INSTRUCTIONS.txt', ipawcus_backup_restore_instructions($type, $reference, $parent, $base));
        $includedTotal = count($included);
        $packedFiles = 0;
        foreach ($included as $relative => $details) {
            $zip->addFile('media/' . $relative, $details['path']);
            $packedFiles++;
            if ($packedFiles === $includedTotal || $packedFiles % 25 === 0) {
                $percent = 82 + (int)floor(($packedFiles / max(1, $includedTotal)) * 14);
                ipawcus_backup_update_progress($metaPdo, $backupId, $percent, "Packing media file {$packedFiles} of {$includedTotal}");
            }
        }
        $zip->close();
        @chmod($partialArchive, 0600);
        if (!rename($partialArchive, $archivePath)) {
            throw new RuntimeException('The backup archive could not be finalized.');
        }
        if (!rename($statePartial, $statePath)) {
            throw new RuntimeException('The backup change-tracking state could not be finalized.');
        }
        ipawcus_backup_update_progress($metaPdo, $backupId, 98, 'Verifying the final archive checksum');
        $checksum = hash_file('sha256', $archivePath);
        $size = filesize($archivePath);
        if ($checksum === false || $size === false || $size <= 0) {
            throw new RuntimeException('The completed archive could not be verified.');
        }

        $complete = $metaPdo->prepare("UPDATE system_backups SET status = 'completed', progress_percent = 100, progress_stage = 'Verified and ready to download', archive_name = ?, archive_path = ?, state_path = ?, archive_size = ?, checksum_sha256 = ?, scanned_row_count = ?, changed_row_count = ?, included_file_count = ?, deleted_file_count = ?, completed_at = NOW(), error_message = NULL WHERE backup_id = ?");
        $complete->execute([
            $archiveName, ipawcus_backup_relative_path('archives', $archiveName), ipawcus_backup_relative_path('states', $stateName), $size, $checksum,
            $database['scanned'], $database['changed'], count($included), count($deleted), $backupId,
        ]);
        $published = true;
        try {
            ipawcus_backup_write_catalog($metaPdo);
        } catch (Throwable $catalogError) {
            error_log('Backup catalog refresh failed after verified backup ' . $reference . ': ' . $catalogError->getMessage());
        }
        $rowStmt = $metaPdo->prepare('SELECT * FROM system_backups WHERE backup_id = ?');
        $rowStmt->execute([$backupId]);
        return ipawcus_backup_format_row($rowStmt->fetch(PDO::FETCH_ASSOC));
    } catch (Throwable $error) {
        if ($snapshotPdo instanceof PDO && $snapshotPdo->inTransaction()) {
            $snapshotPdo->rollBack();
        }
        error_log('System backup ' . $reference . ' failed: ' . $error->getMessage());
        $message = ipawcus_backup_safe_failure_message($error);
        if ($published) {
            throw new RuntimeException('The backup was verified, but its final response was interrupted. Refresh the backup list before trying again.', 0, $error);
        }
        @unlink($partialArchive);
        @unlink($statePartial);
        @unlink($archivePath);
        @unlink($statePath);
        try {
            $failed = $metaPdo->prepare("UPDATE system_backups SET status = 'failed', progress_stage = 'Backup failed safely', error_message = ?, completed_at = NOW() WHERE backup_id = ?");
            $failed->execute([substr($message, 0, 1000), $backupId]);
        } catch (Throwable $metadataError) {
            error_log('Could not record backup failure: ' . $metadataError->getMessage());
        }
        throw new RuntimeException($message, 0, $error);
    } finally {
        @unlink($sqlPath);
        @unlink($xlsxPath);
        flock($lockHandle, LOCK_UN);
        fclose($lockHandle);
    }
}

function ipawcus_backup_archive_for_download(PDO $pdo, int $backupId): array
{
    $settings = ipawcus_backup_settings($pdo);
    ipawcus_backup_configure_storage_directory($settings['storageDirectory']);
    $stmt = $pdo->prepare("SELECT * FROM system_backups WHERE backup_id = ? AND status = 'completed' LIMIT 1");
    $stmt->execute([$backupId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) {
        throw new RuntimeException('The requested verified backup was not found.');
    }
    $archiveDirectory = realpath(ipawcus_backup_base_storage_root(true));
    $archivePath = realpath(ipawcus_backup_resolve_stored_path('archives', (string)$row['archive_path']));
    if ($archiveDirectory === false || $archivePath === false || !str_starts_with(strtolower($archivePath), strtolower($archiveDirectory . DIRECTORY_SEPARATOR)) || !is_file($archivePath)) {
        throw new RuntimeException('The backup archive is unavailable from private storage.');
    }
    return ['path' => $archivePath, 'name' => (string)$row['archive_name'], 'size' => (int)filesize($archivePath)];
}
