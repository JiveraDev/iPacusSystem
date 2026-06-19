<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/reports_common.php';

header('Content-Type: application/json');

try {
    $payload = reports_payload();
    reports_require_super_admin($payload);
    $range = reports_date_range($payload);

    reports_json(reports_dashboard($pdo, $range));
} catch (Throwable $e) {
    reports_json([
        'success' => false,
        'message' => 'Reports dashboard could not be loaded.',
    ], 500);
}
