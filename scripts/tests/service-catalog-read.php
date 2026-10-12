<?php
// Read-only reproduction of the GET listing. Never prints service or user records.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
$_SERVER['REQUEST_METHOD'] = 'GET';
$_GET = ['includeInactive' => '1'];
ob_start();
try {
    require __DIR__ . '/../../php/service_catalog.php';
    $result = json_decode(ob_get_clean(), true, 512, JSON_THROW_ON_ERROR);
    if (empty($result['success']) || empty($result['schemaReady'])) throw new RuntimeException('Catalog schema is not ready.');
    if (($argv[1] ?? '') === '--require-editable' && (empty($result['materialsReady']) || !empty($result['readOnly']))) {
        throw new RuntimeException('Catalog material storage is not ready for editing.');
    }
    echo 'PASS: service-catalog?includeInactive=1 returned ' . count($result['services']) . " services. No records changed.\n";
    echo !empty($result['readOnly']) ? "Catalog mode: read-only.\n" : "Catalog mode: editing enabled.\n";
} catch (Throwable $error) {
    if (ob_get_level()) ob_end_clean();
    fwrite(STDERR, get_class($error) . ': ' . $error->getMessage() . "\n");
    exit(1);
}
