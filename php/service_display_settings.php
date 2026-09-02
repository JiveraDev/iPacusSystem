<?php

/** @var PDO $pdo */
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/workflow_guard_helpers.php';

header('Content-Type: application/json');

function service_display_json(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload);
    exit;
}

function service_display_table_exists(PDO $pdo): bool
{
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'service_display_settings'");
    $stmt->execute();
    return (int)$stmt->fetchColumn() > 0;
}

$currentUser = ipawcus_guard_current_user($pdo);
$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));

if (!service_display_table_exists($pdo)) {
    if ($method === 'GET') {
        service_display_json(['success' => true, 'schemaReady' => false, 'config' => null]);
    }
    service_display_json(['success' => false, 'message' => 'Run DDL/20260830_02_service_display_settings.sql first.'], 409);
}

if ($method === 'GET') {
    $stmt = $pdo->query("SELECT settings_json, updated_at FROM service_display_settings WHERE settings_key = 'booking_display' LIMIT 1");
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    $config = $row ? json_decode((string)$row['settings_json'], true) : null;
    service_display_json([
        'success' => true,
        'schemaReady' => true,
        'config' => is_array($config) ? $config : null,
        'updatedAt' => $row['updated_at'] ?? null,
    ]);
}

if (!in_array($method, ['PUT', 'PATCH', 'POST'], true)) {
    service_display_json(['success' => false, 'message' => 'Method not allowed.'], 405);
}

if (!ipawcus_guard_is_admin_role(ipawcus_guard_role($currentUser))) {
    service_display_json(['success' => false, 'message' => 'Only Admin or Super Admin can update service display content.'], 403);
}

$input = json_decode(file_get_contents('php://input'), true);
$config = is_array($input) && isset($input['config']) && is_array($input['config']) ? $input['config'] : null;
if ($config === null) {
    service_display_json(['success' => false, 'message' => 'A valid service display configuration is required.'], 422);
}

$encoded = json_encode($config, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
if ($encoded === false || strlen($encoded) > 500000) {
    service_display_json(['success' => false, 'message' => 'The service display configuration is too large or invalid.'], 422);
}

$stmt = $pdo->prepare("
    INSERT INTO service_display_settings (settings_key, settings_json, updated_by_user_id)
    VALUES ('booking_display', ?, ?)
    ON DUPLICATE KEY UPDATE
        settings_json = VALUES(settings_json),
        updated_by_user_id = VALUES(updated_by_user_id),
        updated_at = CURRENT_TIMESTAMP
");
$stmt->execute([$encoded, ipawcus_guard_user_id($currentUser)]);

service_display_json(['success' => true, 'message' => 'Service display content updated.', 'config' => $config]);

