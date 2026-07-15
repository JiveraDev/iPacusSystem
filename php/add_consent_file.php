<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/consent_file_helpers.php';

// Handle multipart/form-data
$fileName = $_POST['file_name'] ?? null;
$content = $_POST['content'] ?? null;
$fileSize = $_POST['file_size'] ?? null;
$category = $_POST['category'] ?? 'General';
$petOwnerContexts = consent_file_normalize_contexts($_POST['pet_owner_contexts'] ?? '');

if (!$fileName || !$content) {
    http_response_code(400);
    echo json_encode(['message' => 'File name and content are required.']);
    exit;
}

try {
    consent_file_ensure_schema($pdo);

    $stmt = $pdo->prepare("
        INSERT INTO consent_files (file_name, file_type, file_size, content, category, pet_owner_contexts, uploaded_at) 
        VALUES (?, 'TXT', ?, ?, ?, ?, NOW())
    ");

    $stmt->execute([$fileName, $fileSize, $content, $category, $petOwnerContexts]);
    $fileId = (int)$pdo->lastInsertId();
    consent_file_enforce_unique_context($pdo, $petOwnerContexts, $fileId);

    echo json_encode([
        'message' => 'Consent file uploaded successfully.',
        'file_id' => $fileId
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['message' => 'Failed to upload: ' . $e->getMessage()]);
}
