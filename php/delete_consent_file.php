<?php
require_once __DIR__ . '/db.php';

$fileId = $_GET['fileId'] ?? null;

if (!$fileId) {
    http_response_code(400);
    echo json_encode(['message' => 'File ID is required.']);
    exit;
}

try {
    $stmt = $pdo->prepare("DELETE FROM consent_files WHERE file_id = ?");
    $stmt->execute([$fileId]);

    echo json_encode(['message' => 'Consent file deleted successfully.']);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['message' => 'Failed to delete: ' . $e->getMessage()]);
}
