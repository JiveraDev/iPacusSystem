<?php
// Explicitly approved recovery of the unreadable local table, never a web endpoint.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../php/db.php';

if (!in_array(strtolower(getenv('DB_HOST') ?: 'localhost'), ['localhost', '127.0.0.1', '::1'], true)
    || $pdo->query('SELECT DATABASE()')->fetchColumn() !== 'ipawcus_system') {
    fwrite(STDERR, "Refusing repair outside the approved local ipawcus_system database.\n"); exit(1);
}
$unreadable = false;
try { $pdo->query('SELECT 1 FROM service_materials LIMIT 0'); }
catch (PDOException $error) {
    if (!in_array((int)($error->errorInfo[1] ?? 0), [1932, 1146], true)) throw $error;
    $unreadable = true;
}
if (!$unreadable) {
    echo "service_materials is readable. No rebuild was performed.\n"; exit;
}
$references = $pdo->query("SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE REFERENCED_TABLE_SCHEMA = 'ipawcus_system' AND REFERENCED_TABLE_NAME = 'service_materials'")->fetchAll(PDO::FETCH_ASSOC);
if ($references) {
    fwrite(STDERR, 'Stopping: other tables reference service_materials: ' . json_encode($references) . "\n"); exit(1);
}
$counts = [];
foreach (['service_catalog', 'inventory_items'] as $table) {
    $counts[$table] = (int)$pdo->query("SELECT COUNT(*) FROM $table")->fetchColumn();
    echo "$table: {$counts[$table]} records; readable.\n";
}
$columns = $pdo->query("SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = 'ipawcus_system' AND ((TABLE_NAME = 'service_catalog' AND COLUMN_NAME = 'service_id') OR (TABLE_NAME = 'inventory_items' AND COLUMN_NAME = 'item_id'))")->fetchAll(PDO::FETCH_ASSOC);
foreach ($columns as $column) {
    if (!preg_match('/^int(?:\(\d+\))?$/i', $column['COLUMN_TYPE'])) {
        fwrite(STDERR, "Parent key type differs from the baseline schema. Stop and review before rebuilding.\n"); exit(1);
    }
}
if (count($columns) !== 2) throw new RuntimeException('Required parent keys are missing.');
echo "Target: ipawcus_system.service_materials only. No incoming foreign keys.\n";
if (($argv[1] ?? '') !== '--recreate-unreadable') {
    echo "Preflight only; nothing changed. Recreating this unreadable table resets its material presets.\n"; exit;
}

// User approved resetting this table. DDL is not transactional; do not disable
// foreign-key checks or broaden this operation to any other database object.
$pdo->exec('DROP TABLE IF EXISTS ipawcus_system.service_materials');
$pdo->exec("CREATE TABLE ipawcus_system.service_materials (
    service_material_id INT NOT NULL AUTO_INCREMENT,
    service_id INT NOT NULL,
    item_id INT DEFAULT NULL,
    material_name VARCHAR(180) NOT NULL,
    qty_used DECIMAL(10,2) NOT NULL DEFAULT 1.00,
    billable_policy ENUM('included','separate','optional') DEFAULT 'included',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (service_material_id),
    KEY service_id (service_id),
    KEY item_id (item_id),
    KEY service_materials_service_item_policy_idx (service_id, item_id, billable_policy),
    CONSTRAINT service_materials_ibfk_1 FOREIGN KEY (service_id) REFERENCES service_catalog (service_id),
    CONSTRAINT service_materials_ibfk_2 FOREIGN KEY (item_id) REFERENCES inventory_items (item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci");
foreach ($counts as $table => $count) {
    if ((int)$pdo->query("SELECT COUNT(*) FROM $table")->fetchColumn() !== $count) throw new RuntimeException('Parent record count changed during repair; review concurrent changes.');
}
$pdo->query('SELECT * FROM service_materials LIMIT 0');
echo "Recreated service_materials with an empty preset list and restored foreign keys/indexes. Service and inventory record counts are unchanged. Old presets require a backup or manual re-entry.\n";
