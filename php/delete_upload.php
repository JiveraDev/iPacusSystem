<?php
// Delete generated upload files by relative public path.
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] !== 'POST' && $_SERVER['REQUEST_METHOD'] !== 'DELETE') {
    http_response_code(405);
    echo json_encode(['message' => 'Method not allowed.']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    $input = $_POST;
}

$path = trim((string)($input['path'] ?? ''));
if ($path === '') {
    http_response_code(400);
    echo json_encode(['message' => 'Missing upload path.']);
    exit;
}

$parsedPath = parse_url($path, PHP_URL_PATH);
if (is_string($parsedPath) && $parsedPath !== '') {
    $path = $parsedPath;
}

$path = ltrim(str_replace('\\', '/', $path), '/');
$path = preg_replace('/^public\//', '', $path);

if (str_contains($path, '..') || preg_match('/[\x00-\x1F]/', $path)) {
    http_response_code(400);
    echo json_encode(['message' => 'Invalid upload path.']);
    exit;
}

$segments = explode('/', $path);
$allowedRootDirs = ['signatures'];
if (!in_array($segments[0] ?? '', $allowedRootDirs, true)) {
    http_response_code(400);
    echo json_encode(['message' => 'Upload path is not deletable by this endpoint.']);
    exit;
}

$allowedExtensions = ['gif', 'jpeg', 'jpg', 'png', 'webp'];
$extension = strtolower(pathinfo($path, PATHINFO_EXTENSION));
if (!in_array($extension, $allowedExtensions, true)) {
    http_response_code(400);
    echo json_encode(['message' => 'Upload file type is not deletable by this endpoint.']);
    exit;
}

$publicRoot = realpath(__DIR__ . '/../public');
if ($publicRoot === false) {
    http_response_code(500);
    echo json_encode(['message' => 'Public upload root was not found.']);
    exit;
}

$targetPath = $publicRoot . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $path);
$realTargetPath = realpath($targetPath);

if ($realTargetPath === false || !is_file($realTargetPath)) {
    echo json_encode(['success' => true, 'deleted' => false, 'message' => 'Upload file was already missing.']);
    exit;
}

$publicRootWithSeparator = rtrim($publicRoot, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR;
if (strpos($realTargetPath, $publicRootWithSeparator) !== 0) {
    http_response_code(400);
    echo json_encode(['message' => 'Upload path is outside the public upload root.']);
    exit;
}

if (!unlink($realTargetPath)) {
    http_response_code(500);
    echo json_encode(['message' => 'Failed to delete upload file.']);
    exit;
}

echo json_encode(['success' => true, 'deleted' => true, 'message' => 'Upload file deleted.']);
