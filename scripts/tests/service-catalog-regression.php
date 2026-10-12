<?php
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
define('SERVICE_CATALOG_HELPERS_ONLY', true);
require_once __DIR__ . '/../../php/service_catalog.php';
if (!in_array(strtolower(getenv('DB_HOST') ?: 'localhost'), ['localhost', '127.0.0.1', '::1'], true)) {
    fwrite(STDERR, "Run these temporary-table checks only on a local database.\n"); exit(1);
}
$checks = 0;
function catalog_check(bool $value, string $label): void {
    global $checks;
    if (!$value) throw new RuntimeException('FAIL: ' . $label);
    $checks++;
}
function read_catalog(PDO $connection, bool $inactive): array {
    $_GET = ['includeInactive' => $inactive ? '1' : '0'];
    ob_start();
    try { service_catalog_list($connection); return json_decode(ob_get_contents(), true, 512, JSON_THROW_ON_ERROR); }
    finally { ob_end_clean(); }
}
class UnavailableCatalogStorage extends PDO {
    public function __construct(private int $driverCode) {}
    public function query(string $query, ?int $fetchMode = null, mixed ...$fetchModeArgs): PDOStatement|false {
        $error = new PDOException('Simulated storage failure');
        $error->errorInfo = ['42S02', $this->driverCode, 'Simulated storage failure'];
        throw $error;
    }
}
foreach ([1146, 1932, 1812] as $code) catalog_check(!service_catalog_table_readable(new UnavailableCatalogStorage($code), 'service_materials'), "Storage code $code is recognized");
try {
    service_catalog_table_readable(new UnavailableCatalogStorage(2006), 'service_materials');
    throw new RuntimeException('Connection failure was incorrectly treated as missing materials');
} catch (PDOException $error) { catalog_check((int)$error->errorInfo[1] === 2006, 'Connection failures propagate'); }
$current = read_catalog($pdo, true);
catalog_check($current['success'] && $current['schemaReady'], 'Real catalog listing returns readable services');
if (!$current['materialsReady']) {
    catalog_check($current['readOnly'] && $current['message'] !== '', 'Unavailable materials are explicitly read-only');
    foreach ($current['services'] as $service) catalog_check($service['materials'] === null, 'Unavailable presets are not misreported as empty');
    catalog_check(!service_catalog_schema_ready($pdo), 'Mutation guard rejects unreadable material storage');
}
// Shadow only on this connection. The inaccessible real table is untouched.
$pdo->exec('CREATE TEMPORARY TABLE service_materials (service_material_id INT PRIMARY KEY, service_id INT, item_id INT NULL, material_name VARCHAR(180), qty_used DECIMAL(10,2), billable_policy VARCHAR(20))');
if ($current['services']) {
    $firstId = (int)$current['services'][0]['serviceId'];
    $stmt = $pdo->prepare("INSERT INTO service_materials VALUES (1, ?, NULL, 'Test typed material', 2, 'included')");
    $stmt->execute([$firstId]);
}
$healthy = read_catalog($pdo, true);
catalog_check($healthy['materialsReady'] && !$healthy['readOnly'], 'Readable materials restore normal mode');
catalog_check(service_catalog_schema_ready($pdo), 'Healthy mutation storage recognized');
catalog_check(count($healthy['services']) === count($current['services']), 'Service records retained in both modes');
if ($healthy['services']) catalog_check($healthy['services'][0]['materials'][0]['materialName'] === 'Test typed material', 'Typed material preset formatted correctly');
foreach (read_catalog($pdo, false)['services'] as $service) catalog_check($service['isActive'], 'Inactive filtering preserved');
echo "PASS: $checks service-catalog regression checks. Permanent records and storage were not changed.\n";
