<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/consent_file_helpers.php';

$fileId = $_GET['fileId'] ?? null;
$input = json_decode(file_get_contents('php://input'), true) ?: [];

if (!$fileId) {
    http_response_code(400);
    echo json_encode(['message' => 'File ID is required.']);
    exit;
}

try {
    consent_file_ensure_schema($pdo);

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

    if (array_key_exists('pet_owner_contexts', $input)) {
        $fields[] = 'pet_owner_contexts = ?';
        $params[] = consent_file_normalize_contexts($input['pet_owner_contexts']);
    }

    if (empty($fields)) {
        http_response_code(400);
        echo json_encode(['message' => 'No valid fields provided for update.']);
        exit;
    }

    $params[] = $fileId;
    $stmt = $pdo->prepare('UPDATE consent_files SET ' . implode(', ', $fields) . ' WHERE file_id = ?');
    $stmt->execute($params);

    echo json_encode(['message' => 'Consent file updated successfully.']);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['message' => 'Failed to update: ' . $e->getMessage()]);
}
