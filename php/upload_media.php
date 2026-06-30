<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/role_access.php';

$relativePath = trim((string)($_GET['path'] ?? ''), "/\\");
$relativePath = str_replace('\\', '/', $relativePath);

$allowedDirectories = [
    'boarding_documents',
    'concerns',
    'diagnosis',
    'inventory_items',
    'inventory_receipts',
    'payment_qr',
    'payments',
    'pet_profile_images',
    'signatures',
    'uploads',
];

if ($relativePath === '' || strpos($relativePath, '..') !== false || !preg_match('/^[A-Za-z0-9._\/-]+$/', $relativePath)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid media path.']);
    exit;
}

$directory = explode('/', $relativePath, 2)[0] ?? '';
if (!in_array($directory, $allowedDirectories, true)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Media directory is not allowed.']);
    exit;
}

ipawcus_enforce_media_access($pdo, $relativePath);

$baseDirectory = realpath(__DIR__ . '/../public');
if (!$baseDirectory) {
    http_response_code(404);
    echo json_encode(['success' => false, 'message' => 'Media directory was not found.']);
    exit;
}

$targetPath = realpath($baseDirectory . DIRECTORY_SEPARATOR . $relativePath);

if (!$targetPath || strpos($targetPath, $baseDirectory . DIRECTORY_SEPARATOR) !== 0 || !is_file($targetPath)) {
    http_response_code(404);
    echo json_encode(['success' => false, 'message' => 'Media file was not found.']);
    exit;
}

$mimeType = mime_content_type($targetPath) ?: 'application/octet-stream';
header_remove('Content-Type');
header('Content-Type: ' . $mimeType);
header('Content-Length: ' . filesize($targetPath));
header('Cache-Control: private, max-age=86400');
readfile($targetPath);
