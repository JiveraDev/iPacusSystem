<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/consent_file_helpers.php';
require_once __DIR__ . '/notification_helpers.php';

$fileId = $_GET['fileId'] ?? null;
$input = json_decode(file_get_contents('php://input'), true) ?: [];

if (!$fileId) {
    http_response_code(400);
    echo json_encode(['message' => 'File ID is required.']);
    exit;
}

try {
    consent_file_ensure_schema($pdo);

    $existingStmt = $pdo->prepare('SELECT file_name FROM consent_files WHERE file_id = ? LIMIT 1');
    $existingStmt->execute([(int)$fileId]);
    $existingName = trim((string)$existingStmt->fetchColumn());

    $fields = [];
    $params = [];

    if (array_key_exists('file_name', $input)) {
        $fileName = trim((string)$input['file_name']);
        if ($fileName === '') {
            http_response_code(400);
            echo json_encode(['message' => 'Document title is required.']);
            exit;
        }
        $fields[] = 'file_name = ?';
        $params[] = $fileName;
    }

    if (array_key_exists('content', $input)) {
        $fields[] = 'content = ?';
        $params[] = (string)$input['content'];
    }

    if (array_key_exists('category', $input)) {
        $fields[] = 'category = ?';
        $params[] = $input['category'];
    }

    $normalizedPetOwnerContexts = null;
    if (array_key_exists('pet_owner_contexts', $input)) {
        $normalizedPetOwnerContexts = consent_file_normalize_contexts($input['pet_owner_contexts']);
        $fields[] = 'pet_owner_contexts = ?';
        $params[] = $normalizedPetOwnerContexts;
    }

    if (empty($fields)) {
        http_response_code(400);
        echo json_encode(['message' => 'No valid fields provided for update.']);
        exit;
    }

    $params[] = $fileId;
    $stmt = $pdo->prepare('UPDATE consent_files SET ' . implode(', ', $fields) . ' WHERE file_id = ?');
    $stmt->execute($params);

    if ($normalizedPetOwnerContexts !== null) {
        consent_file_enforce_unique_context($pdo, $normalizedPetOwnerContexts, (int)$fileId);
    }

    $updatedName = trim((string)($input['file_name'] ?? $existingName)) ?: 'Consent template';
    try {
        notification_send_super_admin_governance_event($pdo, [
            'type' => 'consent_template_updated',
            'category' => 'configuration_updates',
            'title' => 'Consent template updated',
            'message' => "{$updatedName} was updated in Consent Management.",
            'redirect_path' => '/dashboard/consent',
            'dedupe_key' => 'consent-template-updated-' . (int)$fileId . '-' . date('YmdHis'),
        ]);
    } catch (Throwable $notificationError) {
        error_log('Consent template update notification failed: ' . $notificationError->getMessage());
    }

    echo json_encode(['message' => 'Consent file updated successfully.']);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['message' => 'Failed to update: ' . $e->getMessage()]);
}
