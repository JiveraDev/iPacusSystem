<?php
// Handle file upload
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");
require_once __DIR__ . '/workflow_guard_helpers.php';
require_once __DIR__ . '/db.php';

$pdo = ipawcus_get_pdo();
$currentUser = ipawcus_guard_current_user($pdo);
$currentRole = ipawcus_guard_role($currentUser);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['message' => 'Method not allowed.']);
    exit;
}

if (!isset($_FILES['image']) && !isset($_FILES['file'])) {
    http_response_code(400);
    echo json_encode(['message' => 'No file uploaded.']);
    exit;
}

$file = $_FILES['image'] ?? $_FILES['file'];
$type = $_POST['type'] ?? 'user'; // 'user' or 'pet'
$allowedUploadTypesByRole = [
    'pet_owner' => ['user', 'pet', 'booking_signature', 'booking_payment', 'booking_concern', 'consent_document'],
    'veterinarian' => ['user', 'booking_signature', 'booking_concern', 'diagnosis', 'consent_document', 'prescription_document'],
    'admin' => ['user', 'pet', 'booking_signature', 'booking_payment', 'booking_concern', 'payment_qr', 'diagnosis', 'boarding_document', 'inventory_item', 'inventory_receipt', 'consent_document', 'prescription_document', 'invoice_document'],
    'super_admin' => ['user', 'pet', 'booking_signature', 'booking_payment', 'booking_concern', 'payment_qr', 'diagnosis', 'boarding_document', 'inventory_item', 'inventory_receipt', 'consent_document', 'prescription_document', 'invoice_document'],
];
$allowedUploadTypes = $allowedUploadTypesByRole[$currentRole] ?? [];

if (!in_array($type, $allowedUploadTypes, true)) {
    http_response_code(403);
    echo json_encode(['message' => 'Your role is not allowed to upload this file type.']);
    exit;
}

$originalName = (string)($file['name'] ?? 'upload');
$extension = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
$maxBytes = 8 * 1024 * 1024;
$imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
$documentExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf'];
$blockedExtensions = ['php', 'phtml', 'phar', 'cgi', 'pl', 'asp', 'aspx', 'jsp', 'js', 'html', 'htm', 'sh', 'bat', 'cmd', 'exe', 'dll'];

if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(['message' => 'Upload failed before the file reached the server.']);
    exit;
}

if (($file['size'] ?? 0) <= 0 || ($file['size'] ?? 0) > $maxBytes) {
    http_response_code(422);
    echo json_encode(['message' => 'File must be greater than 0 bytes and no larger than 8 MB.']);
    exit;
}

if (in_array($extension, $blockedExtensions, true)) {
    http_response_code(422);
    echo json_encode(['message' => 'Executable uploads are not allowed.']);
    exit;
}

// Use relative paths for better portability
// We store them in the public folder, but for the URL, 
// we exclude 'public/' because Vite serves public content at the root.
if ($type === 'pet') {
    $targetDir = __DIR__ . '/../public/pet_profile_images/';
    $urlPath = "pet_profile_images/";
} elseif ($type === 'booking_signature') {
    $targetDir = __DIR__ . '/../public/signatures/';
    $urlPath = "signatures/";
} elseif ($type === 'booking_payment') {
    $targetDir = __DIR__ . '/../public/payments/';
    $urlPath = "payments/";
} elseif ($type === 'payment_qr') {
    $targetDir = __DIR__ . '/../public/payment_qr/';
    $urlPath = "payment_qr/";
} elseif ($type === 'booking_concern') {
    $targetDir = __DIR__ . '/../public/concerns/';
    $urlPath = "concerns/";
} elseif ($type === 'diagnosis') {
    $targetDir = __DIR__ . '/../public/diagnosis/';
    $urlPath = "diagnosis/";
} elseif ($type === 'consent_document') {
    $targetDir = __DIR__ . '/../public/signatures/';
    $urlPath = "signatures/";
} elseif ($type === 'prescription_document') {
    $targetDir = __DIR__ . '/../public/diagnosis/';
    $urlPath = "diagnosis/";
} elseif ($type === 'invoice_document') {
    $targetDir = __DIR__ . '/../public/invoices/';
    $urlPath = "invoices/";
} elseif ($type === 'boarding_document') {
    $targetDir = __DIR__ . '/../public/boarding_documents/';
    $urlPath = "boarding_documents/";
} elseif ($type === 'inventory_item') {
    $targetDir = __DIR__ . '/../public/inventory_items/';
    $urlPath = "inventory_items/";
} elseif ($type === 'inventory_receipt') {
    $targetDir = __DIR__ . '/../public/inventory_receipts/';
    $urlPath = "inventory_receipts/";
} else {
    $targetDir = __DIR__ . '/../public/uploads/';
    $urlPath = "uploads/";
}

$mixedDocumentUploadTypes = ['boarding_document', 'inventory_receipt', 'booking_payment', 'booking_concern'];
$pdfOnlyUploadTypes = ['consent_document', 'prescription_document', 'invoice_document'];
$allowedExtensions = in_array($type, $pdfOnlyUploadTypes, true)
    ? ['pdf']
    : (in_array($type, $mixedDocumentUploadTypes, true) ? $documentExtensions : $imageExtensions);
if (!in_array($extension, $allowedExtensions, true)) {
    http_response_code(422);
    echo json_encode(['message' => 'Unsupported file extension for this upload type.']);
    exit;
}

$finfo = new finfo(FILEINFO_MIME_TYPE);
$mimeType = $finfo->file($file['tmp_name']) ?: 'application/octet-stream';
$allowedMimes = [
    'jpg' => ['image/jpeg'],
    'jpeg' => ['image/jpeg'],
    'png' => ['image/png'],
    'gif' => ['image/gif'],
    'webp' => ['image/webp'],
    'pdf' => ['application/pdf'],
];

if (!in_array($mimeType, $allowedMimes[$extension] ?? [], true)) {
    http_response_code(422);
    echo json_encode(['message' => 'Uploaded file content does not match its extension.']);
    exit;
}

if (!is_dir($targetDir)) {
    mkdir($targetDir, 0755, true);
}

$targetRoot = realpath($targetDir);
if ($targetRoot === false) {
    http_response_code(500);
    echo json_encode(['message' => 'Upload directory is not available.']);
    exit;
}

$fileName = date('YmdHis') . '_' . bin2hex(random_bytes(12)) . '.' . $extension;
$targetFile = $targetDir . $fileName;

if (move_uploaded_file($file['tmp_name'], $targetFile)) {
    // Return the URL to the uploaded image
    $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'];
    
    // We return a path relative to the PROJECT ROOT (Vite Root)
    $relativeUrl = $urlPath . $fileName;
    $protectedUrl = "/api/uploads/media/" . $relativeUrl;
    
    echo json_encode([
        'message' => 'File uploaded successfully.',
        'url' => $protectedUrl,
        'relative_url' => $relativeUrl,
        'protected_url' => $protectedUrl,
        'full_url' => $protocol . "://" . $host . $protectedUrl
    ]);
} else {
    http_response_code(500);
    echo json_encode(['message' => 'Failed to move uploaded file.']);
}
