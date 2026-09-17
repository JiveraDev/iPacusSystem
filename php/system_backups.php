<?php

require_once __DIR__ . '/config.php';
if (!filter_var((string)(getenv('IPAWCUS_SYSTEM_BACKUPS_ENABLED') ?: '1'), FILTER_VALIDATE_BOOLEAN)) {
    http_response_code(404);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode([
        'success' => false,
        'message' => 'This feature is not active.',
        'code' => 'feature_not_active',
    ]);
    exit;
}

require_once __DIR__ . '/role_access.php';
require_once __DIR__ . '/system_backup_common.php';

$pdo = ipawcus_get_pdo();
$currentUser = ipawcus_require_current_api_user($pdo);
if (ipawcus_access_normalize_role($currentUser['role'] ?? '') !== 'super_admin') {
    ipawcus_access_json(403, 'Only the Super Admin can download system backups.', 'api_role_forbidden');
}

function ipawcus_system_backups_json(int $status, array $payload): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function ipawcus_system_backups_cleanup_temporary_files(): void
{
    try {
        ipawcus_backup_cleanup_temporary_root();
    } catch (Throwable $cleanupError) {
        error_log('Temporary backup cleanup failed: ' . $cleanupError->getMessage());
    }
}

function ipawcus_system_backups_stream_local_export(PDO $pdo, int $backupId): never
{
    $archive = ipawcus_backup_archive_for_download($pdo, $backupId);
    $handle = fopen($archive['path'], 'rb');
    if ($handle === false) {
        throw new RuntimeException('The temporary backup archive could not be opened for download.');
    }

    $delivered = false;
    try {
        header('Content-Type: application/zip');
        header('Content-Disposition: attachment; filename="' . str_replace(['"', "\r", "\n"], '', basename($archive['name'])) . '"');
        header('Content-Length: ' . $archive['size']);
        header('Cache-Control: no-store, no-cache, must-revalidate');
        header('Pragma: no-cache');
        header('X-Content-Type-Options: nosniff');

        while (!feof($handle)) {
            $chunk = fread($handle, 1024 * 1024);
            if ($chunk === false) {
                throw new RuntimeException('The temporary backup archive could not be read completely.');
            }
            echo $chunk;
            flush();
        }
        $delivered = connection_aborted() === 0;
    } catch (Throwable $error) {
        error_log('Local backup download failed while streaming: ' . $error->getMessage());
    } finally {
        fclose($handle);
        try {
            ipawcus_backup_mark_local_download_finished($pdo, $backupId, $delivered);
        } catch (Throwable $metadataError) {
            error_log('Could not finalize local backup download metadata: ' . $metadataError->getMessage());
        }
        ipawcus_system_backups_cleanup_temporary_files();
    }
    exit;
}

try {
    $method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
    if ($method === 'GET') {
        ipawcus_system_backups_json(200, ['success' => true] + ipawcus_backup_list($pdo));
    }
    if ($method === 'POST') {
        $name = trim((string)(($currentUser['first_Name'] ?? '') . ' ' . ($currentUser['last_Name'] ?? '')));
        $backup = ipawcus_backup_create('complete', (int)$currentUser['user_id'], $name ?: 'Super Admin');
        ipawcus_system_backups_stream_local_export($pdo, $backup['id']);
    }
    ipawcus_system_backups_json(405, ['success' => false, 'message' => 'Method not allowed.', 'code' => 'method_not_allowed']);
} catch (InvalidArgumentException $error) {
    ipawcus_system_backups_cleanup_temporary_files();
    ipawcus_system_backups_json(422, ['success' => false, 'message' => $error->getMessage(), 'code' => 'invalid_backup_request']);
} catch (RuntimeException $error) {
    ipawcus_system_backups_cleanup_temporary_files();
    $message = $error->getMessage();
    $status = str_contains($message, 'already running') ? 409 : 500;
    ipawcus_system_backups_json($status, ['success' => false, 'message' => $message, 'code' => $status === 409 ? 'backup_in_progress' : 'backup_failed']);
} catch (Throwable $error) {
    ipawcus_system_backups_cleanup_temporary_files();
    error_log('System backup endpoint failed: ' . $error->getMessage());
    ipawcus_system_backups_json(500, [
        'success' => false,
        'message' => 'The local backup download is temporarily unavailable. No server backup copy was retained.',
        'code' => 'backup_unavailable',
    ]);
}
