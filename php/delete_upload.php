<?php
// Delete generated upload files by relative public path.
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");
require_once __DIR__ . '/workflow_guard_helpers.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/upload_receipt_helpers.php';
require_once __DIR__ . '/booking_slot_helpers.php';
require_once __DIR__ . '/runtime_media.php';

$pdo = ipawcus_get_pdo();
$currentUser = ipawcus_guard_current_user($pdo);

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

$allowedExtensions = ['gif', 'jpeg', 'jpg', 'png', 'webp', 'pdf'];
$extension = strtolower(pathinfo($path, PATHINFO_EXTENSION));
if (!in_array($extension, $allowedExtensions, true)) {
    http_response_code(400);
    echo json_encode(['message' => 'Upload file type is not deletable by this endpoint.']);
    exit;
}

$publicRoot = realpath(ipawcus_runtime_media_root());
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

if ($extension === 'pdf') {
    $uploadReceipt = trim((string)($input['upload_receipt'] ?? $input['uploadReceipt'] ?? ''));
    if (!ipawcus_upload_receipt_verify(
        $uploadReceipt,
        $path,
        ipawcus_guard_user_id($currentUser),
        'consent_document'
    )) {
        http_response_code(403);
        echo json_encode(['message' => 'This upload cannot be deleted by the current account.']);
        exit;
    }

    $consentLockName = 'ipawcus_consent_' . md5($path);
    if (!booking_slot_acquire($pdo, $consentLockName)) {
        http_response_code(409);
        echo json_encode(['message' => 'This consent PDF is currently being processed. Please try again.']);
        exit;
    }

    try {
        $fileToken = basename($realTargetPath);
        $referencePattern = '%' . $fileToken . '%';
        $bookingReference = $pdo->prepare("SELECT COUNT(*) FROM bookings WHERE signature_path LIKE ? OR consent_forms LIKE ?");
        $bookingReference->execute([$referencePattern, $referencePattern]);
        $consentReferenceCount = 0;
        if (ipawcus_guard_table_exists($pdo, 'consent_form_records')) {
            $consentReference = $pdo->prepare("SELECT COUNT(*) FROM consent_form_records WHERE signed_file_path LIKE ? OR physical_file_path LIKE ?");
            $consentReference->execute([$referencePattern, $referencePattern]);
            $consentReferenceCount = (int)$consentReference->fetchColumn();
        }
        if ((int)$bookingReference->fetchColumn() > 0 || $consentReferenceCount > 0) {
            booking_slot_release($pdo, $consentLockName);
            http_response_code(409);
            echo json_encode(['message' => 'This PDF is linked to a consent record and cannot be deleted.']);
            exit;
        }

        if (!unlink($realTargetPath)) {
            booking_slot_release($pdo, $consentLockName);
            http_response_code(500);
            echo json_encode(['message' => 'The upload could not be deleted. Please try again.']);
            exit;
        }
    } catch (Throwable $exception) {
        booking_slot_release($pdo, $consentLockName);
        error_log('Consent upload deletion failed: ' . $exception->getMessage());
        http_response_code(500);
        echo json_encode(['message' => 'The upload could not be deleted. Please try again.']);
        exit;
    }

    booking_slot_release($pdo, $consentLockName);
    echo json_encode(['success' => true, 'deleted' => true, 'message' => 'Upload file deleted.']);
    exit;
}

if (!unlink($realTargetPath)) {
    http_response_code(500);
    echo json_encode(['message' => 'The upload could not be deleted. Please try again.']);
    exit;
}

echo json_encode(['success' => true, 'deleted' => true, 'message' => 'Upload file deleted.']);
