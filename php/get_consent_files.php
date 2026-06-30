<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/consent_file_helpers.php';

header("Content-Type: application/json");

try {
    consent_file_ensure_schema($pdo);

    $stmt = $pdo->query("SELECT * FROM consent_files ORDER BY uploaded_at DESC");
    $files = $stmt->fetchAll();

    echo json_encode($files);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['message' => 'Failed to fetch consent files: ' . $e->getMessage()]);
}
