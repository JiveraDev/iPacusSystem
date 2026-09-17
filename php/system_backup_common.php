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
const IPAWCUS_BACKUP_STATE_VERSION = 1;

function ipawcus_backup_module_enabled(): bool
{
    return filter_var((string)(getenv('IPAWCUS_SYSTEM_BACKUPS_ENABLED') ?: '1'), FILTER_VALIDATE_BOOLEAN);
}

function ipawcus_backup_begin_local_download_storage(): string
{
    static $shutdownCleanupRegistered = false;
    $root = rtrim(sys_get_temp_dir(), "/\\")
        . DIRECTORY_SEPARATOR . 'ipawcus-local-export-' . bin2hex(random_bytes(12));
    $GLOBALS['ipawcus_backup_temporary_root'] = $root;
    if (!$shutdownCleanupRegistered) {
        register_shutdown_function(static function (): void {
            try {
                ipawcus_backup_cleanup_temporary_root();
            } catch (Throwable $error) {
                error_log('Backup shutdown cleanup failed: ' . $error->getMessage());
            }
        });
        $shutdownCleanupRegistered = true;
    }
    return $root;
}

function ipawcus_backup_base_storage_root(bool $create = false): string
{
    $baseRoot = rtrim(trim((string)($GLOBALS['ipawcus_backup_temporary_root'] ?? '')), "/\\");
    if ($baseRoot === '') {
        throw new RuntimeException('The temporary local-download workspace has not been initialized.');
    }
    if ($create) {
        if (!is_dir($baseRoot) && !mkdir($baseRoot, 0700, true) && !is_dir($baseRoot)) {
            throw new RuntimeException('The temporary local-download workspace could not be created.');
        }
        @chmod($baseRoot, 0700);
    }
    return $baseRoot;
}

function ipawcus_backup_storage_root(bool $create = false): string
{
    $root = ipawcus_backup_base_storage_root($create) . DIRECTORY_SEPARATOR . 'export';
    if ($create) {
        foreach ([$root, $root . DIRECTORY_SEPARATOR . 'archives', $root . DIRECTORY_SEPARATOR . 'states', $root . DIRECTORY_SEPARATOR . 'work'] as $directory) {
            if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) {
                throw new RuntimeException('The temporary backup workspace could not be created.');
            }
            @chmod($directory, 0700);
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
    if (!ipawcus_backup_table_exists($pdo)) {
        throw new RuntimeException('System Backup is not installed yet. Apply DDL/20260915_01_system_backups.sql first.');
    }
}

function ipawcus_backup_relative_path(string $area, string $fileName): string
{
    if (!in_array($area, ['archives', 'states', 'work'], true)) {
        throw new InvalidArgumentException('Unsupported backup storage area.');
    }
    return 'export/' . $area . '/' . basename($fileName);
}

function ipawcus_backup_resolve_stored_path(string $area, string $storedPath): string
{
    $normalized = trim(str_replace('\\', '/', $storedPath), '/ ');
    if ($normalized === '' || str_contains($normalized, '..')) {
        return '';
    }
    if (!in_array($area, ['archives', 'states', 'work'], true)) {
        return '';
    }
    $expectedPrefix = 'export/' . $area . '/';
    if (!str_starts_with($normalized, $expectedPrefix)) {
        return '';
    }
    $base = ipawcus_backup_base_storage_root(true);
    $candidate = $base . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $normalized);
    return $candidate;
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

            if (in_array($table, [IPAWCUS_BACKUP_SCHEMA_TABLE, 'system_backup_settings'], true)) {
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
        'downloadReady' => false,
    ];
}

function ipawcus_backup_list(PDO $pdo): array
{
    ipawcus_backup_require_schema($pdo);
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
    return [
        'backups' => $backups,
        'latestVerified' => $latest,
        'hasRunning' => $hasRunning,
        'localDownloadOnly' => true,
    ];
}

function ipawcus_backup_restore_instructions(string $reference): string
{
    return "iPawcus Backup {$reference}\n\nThis package is a complete recovery baseline.\n\n"
        . "RECOVERY\n1. Use a clean recovery server and preserve the failed server before changing it.\n"
        . "2. Verify the package contents and component SHA-256 checksums recorded in backup-manifest.json.\n"
        . "3. Import database.sql into the intended iPawcus database.\n"
        . "4. Copy the media/ directory into the configured runtime media root.\n"
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
    if ($type !== 'complete') {
        throw new InvalidArgumentException('Local downloads must be complete backups.');
    }
    ignore_user_abort(true);
    @set_time_limit(0);
    ipawcus_backup_begin_local_download_storage();
    $metaPdo = createDatabaseConnection();
    ipawcus_backup_require_schema($metaPdo);
    ipawcus_backup_storage_root(true);

    $lockPath = rtrim(sys_get_temp_dir(), "/\\") . DIRECTORY_SEPARATOR . 'ipawcus-system-backup.lock';
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
        $zip->addString('RESTORE-INSTRUCTIONS.txt', ipawcus_backup_restore_instructions($reference));
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
        @unlink($lockPath);
    }
}

function ipawcus_backup_archive_for_download(PDO $pdo, int $backupId): array
{
    ipawcus_backup_require_schema($pdo);
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

function ipawcus_backup_cleanup_temporary_root(): void
{
    $root = trim((string)($GLOBALS['ipawcus_backup_temporary_root'] ?? ''));
    if ($root === '') {
        return;
    }

    $temporaryBase = rtrim(str_replace('\\', '/', sys_get_temp_dir()), '/');
    $normalizedRoot = rtrim(str_replace('\\', '/', $root), '/');
    if (!str_starts_with($normalizedRoot, $temporaryBase . '/ipawcus-local-export-')) {
        throw new RuntimeException('Refused to remove an unexpected backup workspace path.');
    }

    if (is_dir($root)) {
        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS),
            RecursiveIteratorIterator::CHILD_FIRST
        );
        foreach ($iterator as $entry) {
            $path = $entry->getPathname();
            if ($entry->isLink() || $entry->isFile()) {
                @unlink($path);
            } elseif ($entry->isDir()) {
                @rmdir($path);
            }
        }
        @rmdir($root);
    }
    unset($GLOBALS['ipawcus_backup_temporary_root']);
}

function ipawcus_backup_mark_local_download_finished(PDO $pdo, int $backupId, bool $delivered): void
{
    $stage = $delivered
        ? 'Downloaded locally; no server backup copy retained'
        : 'Local download ended; temporary server files removed';
    $stmt = $pdo->prepare('UPDATE system_backups SET archive_path = NULL, state_path = NULL, progress_stage = ? WHERE backup_id = ?');
    $stmt->execute([$stage, $backupId]);
}
