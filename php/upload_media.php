<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/role_access.php';
require_once __DIR__ . '/runtime_media.php';

$pdo = ipawcus_get_pdo();

$relativePath = trim((string)($_GET['path'] ?? ''), "/\\");
$relativePath = str_replace('\\', '/', $relativePath);
$pathSegments = explode('/', $relativePath);
$hasInvalidSegment = false;
foreach ($pathSegments as $pathSegment) {
    if ($pathSegment === '' || $pathSegment === '.' || $pathSegment === '..') {
        $hasInvalidSegment = true;
        break;
    }
}

$allowedDirectories = [
    'grooming_photos',
    'boarding_documents',
    'concerns',
    'diagnosis',
    'inventory_items',
    'inventory_receipts',
    'invoices',
    'payment_qr',
    'payments',
    'pet_profile_images',
    'signatures',
    'uploads',
];

if (
    $relativePath === ''
    || strlen($relativePath) > 1024
    || $hasInvalidSegment
    || preg_match('/[\x00-\x1F\x7F]/', $relativePath)
) {
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

if ($directory === 'grooming_photos') {
    require_once __DIR__ . '/grooming_media.php';
    try { $baseDirectory = realpath(grooming_photo_directory()); }
    catch (Throwable $error) { ipawcus_access_json(409, 'Grooming photo storage is unavailable. Please contact the clinic.', 'grooming_storage_unavailable'); }
    $fileRelativePath = substr($relativePath, strlen('grooming_photos/'));
} else {
    $baseDirectory = realpath(ipawcus_runtime_media_root());
    $fileRelativePath = $relativePath;
}
if (!$baseDirectory) {
    http_response_code(404);
    echo json_encode(['success' => false, 'message' => 'Media directory was not found.']);
    exit;
}

$targetPath = realpath($baseDirectory . DIRECTORY_SEPARATOR . $fileRelativePath);

if (!$targetPath || strpos($targetPath, $baseDirectory . DIRECTORY_SEPARATOR) !== 0 || !is_file($targetPath)) {
    http_response_code(404);
    echo json_encode(['success' => false, 'message' => 'Media file was not found.']);
    exit;
}

$mimeType = mime_content_type($targetPath) ?: 'application/octet-stream';
header_remove('Content-Type');
header('Content-Type: ' . $mimeType);
header('X-Content-Type-Options: nosniff');
if ($mimeType === 'application/pdf') {
    $safeFileName = preg_replace('/[^A-Za-z0-9._-]/', '_', basename($targetPath));
    header('Content-Disposition: inline; filename="' . $safeFileName . '"');
}
header('Content-Length: ' . filesize($targetPath));
header($directory === 'grooming_photos' ? 'Cache-Control: private, no-store' : 'Cache-Control: private, max-age=86400');
readfile($targetPath);
