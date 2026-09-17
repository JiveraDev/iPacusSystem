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
    ipawcus_access_json(403, 'Only the Super Admin can access system backups.', 'api_role_forbidden');
}

function ipawcus_system_backups_json(int $status, array $payload): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function ipawcus_system_backups_stream(PDO $pdo, int $backupId): never
{
    $archive = ipawcus_backup_archive_for_download($pdo, $backupId);
    header('Content-Type: application/zip');
    header('Content-Disposition: attachment; filename="' . str_replace(['"', "\r", "\n"], '', basename($archive['name'])) . '"');
    header('Content-Length: ' . $archive['size']);
    header('Cache-Control: no-store, no-cache, must-revalidate');
    header('Pragma: no-cache');
    header('X-Content-Type-Options: nosniff');
    $handle = fopen($archive['path'], 'rb');
    if ($handle === false) {
        throw new RuntimeException('The backup archive could not be opened for download.');
    }
    while (!feof($handle)) {
        $chunk = fread($handle, 1024 * 1024);
        if ($chunk === false) {
            fclose($handle);
            exit;
        }
        echo $chunk;
        if (function_exists('fastcgi_finish_request')) {
            // Do not call fastcgi_finish_request here; it would stop the streamed body.
        }
        flush();
    }
    fclose($handle);
    exit;
}

try {
    $method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
    $action = (string)($_GET['action'] ?? '');
    if ($method === 'GET' && $action === 'download') {
        ipawcus_system_backups_stream($pdo, max(0, (int)($_GET['backupId'] ?? 0)));
    }
    if ($method === 'GET') {
        ipawcus_system_backups_json(200, ['success' => true] + ipawcus_backup_list($pdo));
    }
    if ($method === 'POST') {
        $payload = json_decode((string)file_get_contents('php://input'), true);
        if (!is_array($payload)) {
            ipawcus_system_backups_json(400, ['success' => false, 'message' => 'Choose the backup type and try again.', 'code' => 'invalid_backup_request']);
        }
        $name = trim((string)(($currentUser['first_Name'] ?? '') . ' ' . ($currentUser['last_Name'] ?? '')));
        $backup = ipawcus_backup_create((string)($payload['type'] ?? ''), (int)$currentUser['user_id'], $name ?: 'Super Admin');
        ipawcus_system_backups_json(201, [
            'success' => true,
            'message' => $backup['type'] === 'complete' ? 'Complete backup verified and ready.' : 'Recent-changes backup verified and ready.',
            'backup' => $backup,
        ]);
    }
    if ($method === 'PUT' || $method === 'PATCH') {
        $payload = json_decode((string)file_get_contents('php://input'), true);
        if (!is_array($payload)) {
            ipawcus_system_backups_json(400, ['success' => false, 'message' => 'Backup settings are required.', 'code' => 'invalid_backup_settings']);
        }
        $name = trim((string)(($currentUser['first_Name'] ?? '') . ' ' . ($currentUser['last_Name'] ?? '')));
        $settings = ipawcus_backup_update_settings($pdo, $payload, (int)$currentUser['user_id'], $name ?: 'Super Admin');
        ipawcus_system_backups_json(200, [
            'success' => true,
            'message' => $settings['automaticEnabled']
                ? 'Automatic incremental backup settings saved.'
                : 'Automatic incremental backups are off. Manual backup remains available.',
            'settings' => $settings,
        ]);
    }
    ipawcus_system_backups_json(405, ['success' => false, 'message' => 'Method not allowed.', 'code' => 'method_not_allowed']);
} catch (InvalidArgumentException $error) {
    ipawcus_system_backups_json(422, ['success' => false, 'message' => $error->getMessage(), 'code' => 'invalid_backup_request']);
} catch (RuntimeException $error) {
    $message = $error->getMessage();
    $status = str_contains($message, 'already running') ? 409 : 500;
    ipawcus_system_backups_json($status, ['success' => false, 'message' => $message, 'code' => $status === 409 ? 'backup_in_progress' : 'backup_failed']);
} catch (Throwable $error) {
    error_log('System backup endpoint failed: ' . $error->getMessage());
    ipawcus_system_backups_json(500, [
        'success' => false,
        'message' => 'System Backup is temporarily unavailable. No archive was changed.',
        'code' => 'backup_unavailable',
    ]);
}
