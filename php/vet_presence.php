<?php

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/workflow_guard_helpers.php';
require_once __DIR__ . '/vet_presence_helpers.php';

header('Content-Type: application/json');
header('Cache-Control: no-store, max-age=0');
$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
if (!in_array($method, ['GET', 'PATCH'], true)) {
    ipawcus_guard_error(405, 'This action is not available.');
}

// GET is intentionally public. Every write still requires a verified admin.
$currentUser = null;
if ($method === 'PATCH') {
    $currentUser = ipawcus_guard_current_user($pdo);
    if (!ipawcus_guard_is_admin_role(ipawcus_guard_role($currentUser))) {
        ipawcus_guard_error(403, 'Only an administrator can change the vet status.');
    }
}

if (!ipawcus_guard_table_exists($pdo, 'service_display_settings')) {
    ipawcus_guard_error(503, 'Vet status is unavailable. Ask your administrator to complete the clinic settings setup.');
}

if ($method === 'GET') {
    $stmt = $pdo->query("SELECT settings_json FROM service_display_settings WHERE settings_key = 'vet_presence' LIMIT 1");
    $stored = $stmt->fetchColumn();
    $saved = $stored ? json_decode($stored, true) : null;
    echo json_encode(['success' => true] + vet_presence_state(is_array($saved) ? $saved : null));
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input) || !isset($input['isIn']) || !is_bool($input['isIn'])) {
    ipawcus_guard_error(422, 'Choose whether the vet is in or out.');
}
$state = vet_presence_state(null);
$state['isIn'] = $input['isIn'];
$stmt = $pdo->prepare("
    INSERT INTO service_display_settings (settings_key, settings_json, updated_by_user_id)
    VALUES ('vet_presence', ?, ?)
    ON DUPLICATE KEY UPDATE settings_json = VALUES(settings_json),
        updated_by_user_id = VALUES(updated_by_user_id), updated_at = CURRENT_TIMESTAMP
");
$stmt->execute([json_encode(['date' => $state['date'], 'isIn' => $state['isIn']]), ipawcus_guard_user_id($currentUser)]);
echo json_encode(['success' => true] + $state);
