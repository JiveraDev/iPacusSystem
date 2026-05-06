<?php
require_once __DIR__ . '/db.php';

// Handle multipart/form-data
$fileName = $_POST['file_name'] ?? null;
$content = $_POST['content'] ?? null;
$fileSize = $_POST['file_size'] ?? null;
$category = $_POST['category'] ?? 'General';

if (!$fileName || !$content) {
    http_response_code(400);
    echo json_encode(['message' => 'File name and content are required.']);
    exit;
}

try {
    $stmt = $pdo->prepare("
        INSERT INTO consent_files (file_name, file_type, file_size, content, category, uploaded_at) 
        VALUES (?, 'TXT', ?, ?, ?, NOW())
    ");

    $stmt->execute([$fileName, $fileSize, $content, $category]);

    echo json_encode([
        'message' => 'Consent file uploaded successfully.',
        'file_id' => $pdo->lastInsertId()
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['message' => 'Failed to upload: ' . $e->getMessage()]);
}
