<?php
require_once __DIR__ . '/db.php';

$fileId = $_GET['fileId'] ?? null;
$input = json_decode(file_get_contents('php://input'), true);
$content = $input['content'] ?? null;
$category = $input['category'] ?? null;

if (!$fileId || (!$content && !$category)) {
    http_response_code(400);
    echo json_encode(['message' => 'File ID and content/category are required.']);
    exit;
}

try {
    $stmt = $pdo->prepare("UPDATE consent_files SET content = ?, category = ? WHERE file_id = ?");
    $stmt->execute([$content, $category, $fileId]);

    echo json_encode(['message' => 'Consent file updated successfully.']);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['message' => 'Failed to update: ' . $e->getMessage()]);
}
