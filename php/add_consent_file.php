<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/consent_file_helpers.php';
require_once __DIR__ . '/notification_helpers.php';

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

    try {
        notification_send_super_admin_governance_event($pdo, [
            'type' => 'consent_template_created',
            'category' => 'configuration_updates',
            'title' => 'Consent template created',
            'message' => "{$fileName} was added to Consent Management.",
            'redirect_path' => '/dashboard/consent',
            'dedupe_key' => "consent-template-created-{$fileId}",
        ]);
    } catch (Throwable $notificationError) {
        error_log('Consent template creation notification failed: ' . $notificationError->getMessage());
    }

    echo json_encode([
        'message' => 'Consent file uploaded successfully.',
        'file_id' => $fileId
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['message' => 'Failed to upload: ' . $e->getMessage()]);
}
