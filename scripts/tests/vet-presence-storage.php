<?php
// Read-only check of the configured database. Does not change the public sign.
require_once __DIR__ . '/../../php/db.php';

$stmt = $pdo->prepare('SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?');
$stmt->execute(['service_display_settings']);
if ((int)$stmt->fetchColumn() !== 1) {
    fwrite(STDERR, "Vet status storage is missing. Apply DDL/20260830_02_service_display_settings.sql.\n");
    exit(1);
}
$pdo->query("SELECT settings_json, updated_by_user_id, updated_at FROM service_display_settings WHERE settings_key = 'vet_presence' LIMIT 1");
echo "PASS: Vet status storage is available; no data was changed.\n";
