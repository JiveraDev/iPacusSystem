<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/notification_helpers.php';

$fileId = $_GET['fileId'] ?? null;

if (!$fileId) {
    http_response_code(400);
    echo json_encode(['message' => 'File ID is required.']);
    exit;
}

try {
    $nameStmt = $pdo->prepare('SELECT file_name FROM consent_files WHERE file_id = ? LIMIT 1');
    $nameStmt->execute([(int)$fileId]);
    $fileName = trim((string)$nameStmt->fetchColumn()) ?: 'Consent template';

    $stmt = $pdo->prepare("DELETE FROM consent_files WHERE file_id = ?");
    $stmt->execute([$fileId]);

    try {
        notification_send_super_admin_governance_event($pdo, [
            'type' => 'consent_template_deleted',
            'category' => 'configuration_updates',
            'title' => 'Consent template deleted',
            'message' => "{$fileName} was removed from Consent Management.",
            'redirect_path' => '/dashboard/consent',
            'dedupe_key' => 'consent-template-deleted-' . (int)$fileId . '-' . date('YmdHis'),
        ]);
    } catch (Throwable $notificationError) {
        error_log('Consent template deletion notification failed: ' . $notificationError->getMessage());
    }

    echo json_encode(['message' => 'Consent file deleted successfully.']);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['message' => 'Failed to delete: ' . $e->getMessage()]);
}
