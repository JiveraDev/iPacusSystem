<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/reports_common.php';

header('Content-Type: application/json');

try {
    $payload = reports_payload();
    reports_require_super_admin($payload);

    $reportType = reports_allowed_type((string)($payload['report_type'] ?? ''));
    if (!$reportType) {
        reports_json([
            'success' => false,
            'message' => 'Invalid report_type.',
        ], 422);
    }

    $range = reports_date_range($payload);
    $filters = reports_filters($payload);
    $report = reports_build_report($pdo, $reportType, $range, $filters);
    $report['generated_by'] = trim((string)($payload['generated_by'] ?? 'Super Admin')) ?: 'Super Admin';

    reports_json([
        'success' => true,
        'report' => $report,
    ]);
} catch (Throwable $e) {
    reports_json([
        'success' => false,
        'message' => 'Report could not be generated.',
    ], 500);
}
