<?php
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../../php/db.php';
foreach (['service_catalog', 'service_materials', 'inventory_items'] as $table) {
    $stmt = $pdo->prepare('SELECT ENGINE, TABLE_COMMENT FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?');
    $stmt->execute([$table]);
    echo $table . ': ' . json_encode($stmt->fetch(PDO::FETCH_ASSOC)) . "\n";
    try { $pdo->query("SELECT 1 FROM $table LIMIT 0"); echo "Readable\n"; }
    catch (PDOException $error) { echo 'Read failed: ' . $error->getMessage() . "\n"; }
}
