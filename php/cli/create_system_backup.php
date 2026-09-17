<?php

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once dirname(__DIR__) . '/config.php';
if (!filter_var((string)(getenv('IPAWCUS_SYSTEM_BACKUPS_ENABLED') ?: '1'), FILTER_VALIDATE_BOOLEAN)) {
    fwrite(STDERR, "System Backup is disabled by the server configuration.\n");
    exit(3);
}

require_once dirname(__DIR__) . '/system_backup_common.php';

$type = strtolower(trim((string)($argv[1] ?? 'scheduled')));
if (!in_array($type, ['complete', 'changes', 'scheduled'], true)) {
    fwrite(STDERR, "Usage: php create_system_backup.php [scheduled|complete|changes]\n");
    exit(2);
}

try {
    if ($type === 'scheduled') {
        $result = ipawcus_backup_run_scheduled();
        if (!$result['ran']) {
            fwrite(STDOUT, 'No backup created: ' . $result['reason'] . "\n");
            exit(0);
        }
        $backup = $result['backup'];
    } else {
        $backup = ipawcus_backup_create($type, null, 'Server command');
    }
    fwrite(STDOUT, sprintf(
        "Backup %d completed: %s (%s bytes, SHA-256 %s)\n",
        $backup['id'],
        $backup['archiveName'],
        $backup['archiveSize'],
        $backup['checksumSha256']
    ));
    exit(0);
} catch (Throwable $error) {
    fwrite(STDERR, 'Backup failed: ' . $error->getMessage() . "\n");
    exit(1);
}
