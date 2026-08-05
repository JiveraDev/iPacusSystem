<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/reports_common.php';
require_once __DIR__ . '/notification_helpers.php';

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
    $report = reports_build_report($pdo, $reportType, $range, $filters, true);
    $report['generated_by'] = trim((string)($payload['generated_by'] ?? 'Super Admin')) ?: 'Super Admin';

    try {
        $reportTitle = trim((string)($report['title'] ?? ucwords(str_replace('_', ' ', $reportType)))) ?: 'Management report';
        $rangeLabel = trim((string)($range['label'] ?? 'selected date range')) ?: 'selected date range';
        notification_send_super_admin_governance_event($pdo, [
            'type' => 'management_report_generated',
            'category' => 'report_updates',
            'title' => 'Management report generated',
            'message' => "{$reportTitle} was generated for {$rangeLabel} by {$report['generated_by']}.",
            'redirect_path' => '/dashboard/reports/export',
            'dedupe_key' => 'report-generated-' . $reportType . '-' . md5($rangeLabel . '|' . date('Y-m-d H:i:s')),
        ]);
    } catch (Throwable $notificationError) {
        error_log('Report generation notification failed: ' . $notificationError->getMessage());
    }

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
