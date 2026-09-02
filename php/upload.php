<?php
// Handle file upload
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");
require_once __DIR__ . '/workflow_guard_helpers.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/upload_receipt_helpers.php';
require_once __DIR__ . '/runtime_media.php';

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
$originalExtension = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
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

if (in_array($originalExtension, $blockedExtensions, true)) {
    http_response_code(422);
    echo json_encode(['message' => 'Executable uploads are not allowed.']);
    exit;
}

// Use relative paths for better portability
// We store them in the public folder, but for the URL, 
// we exclude 'public/' because Vite serves public content at the root.
if ($type === 'pet') {
    $targetDirectoryName = 'pet_profile_images';
    $urlPath = "pet_profile_images/";
} elseif ($type === 'booking_signature') {
    $targetDirectoryName = 'signatures';
    $urlPath = "signatures/";
} elseif ($type === 'booking_payment') {
    $targetDirectoryName = 'payments';
    $urlPath = "payments/";
} elseif ($type === 'payment_qr') {
    $targetDirectoryName = 'payment_qr';
    $urlPath = "payment_qr/";
} elseif ($type === 'booking_concern') {
    $targetDirectoryName = 'concerns';
    $urlPath = "concerns/";
} elseif ($type === 'diagnosis') {
    $targetDirectoryName = 'diagnosis';
    $urlPath = "diagnosis/";
} elseif ($type === 'consent_document') {
    $targetDirectoryName = 'signatures';
    $urlPath = "signatures/";
} elseif ($type === 'prescription_document') {
    $targetDirectoryName = 'diagnosis';
    $urlPath = "diagnosis/";
} elseif ($type === 'invoice_document') {
    $targetDirectoryName = 'invoices';
    $urlPath = "invoices/";
} elseif ($type === 'boarding_document') {
    $targetDirectoryName = 'boarding_documents';
    $urlPath = "boarding_documents/";
} elseif ($type === 'inventory_item') {
    $targetDirectoryName = 'inventory_items';
    $urlPath = "inventory_items/";
} elseif ($type === 'inventory_receipt') {
    $targetDirectoryName = 'inventory_receipts';
    $urlPath = "inventory_receipts/";
} else {
    $targetDirectoryName = 'uploads';
    $urlPath = "uploads/";
}

try {
    $targetDir = ipawcus_runtime_media_directory($targetDirectoryName, true) . DIRECTORY_SEPARATOR;
} catch (Throwable $exception) {
    error_log('Runtime media storage is unavailable: ' . $exception->getMessage());
    http_response_code(503);
    echo json_encode(['message' => 'File storage is temporarily unavailable. Contact the system administrator.']);
    exit;
}

$mixedDocumentUploadTypes = ['boarding_document', 'inventory_receipt', 'booking_payment', 'booking_concern'];
$pdfOnlyUploadTypes = ['consent_document', 'prescription_document', 'invoice_document'];
$allowedExtensions = in_array($type, $pdfOnlyUploadTypes, true)
    ? ['pdf']
    : (in_array($type, $mixedDocumentUploadTypes, true) ? $documentExtensions : $imageExtensions);

$finfo = new finfo(FILEINFO_MIME_TYPE);
$mimeType = $finfo->file($file['tmp_name']) ?: 'application/octet-stream';
$canonicalExtensionByMime = [
    'image/jpeg' => 'jpg',
    'image/pjpeg' => 'jpg',
    'image/png' => 'png',
    'image/x-png' => 'png',
    'image/gif' => 'gif',
    'image/webp' => 'webp',
    'application/pdf' => 'pdf',
    'application/x-pdf' => 'pdf',
];
$extension = $canonicalExtensionByMime[$mimeType] ?? null;
$normalizedAllowedExtensions = array_map(
    static fn(string $allowedExtension): string => $allowedExtension === 'jpeg' ? 'jpg' : $allowedExtension,
    $allowedExtensions
);

if ($extension === null || !in_array($extension, $normalizedAllowedExtensions, true)) {
    http_response_code(422);
    echo json_encode(['message' => 'Unsupported file content. Upload a PNG, JPG, WEBP, GIF, or PDF allowed for this field.']);
    exit;
}

$targetRoot = realpath($targetDir);
if ($targetRoot === false) {
    http_response_code(500);
    echo json_encode(['message' => 'Upload directory is not available.']);
    exit;
}

$fileName = date('YmdHis') . '_' . bin2hex(random_bytes(12)) . '.' . $extension;
$targetFile = $targetDir . $fileName;
$uploadReceipt = null;

if ($type === 'consent_document') {
    try {
        $uploadReceipt = ipawcus_upload_receipt_issue(
            $urlPath . $fileName,
            ipawcus_guard_user_id($currentUser),
            $type,
            null,
            [
                'consent_context' => $_POST['consent_context'] ?? $_POST['consentContext'] ?? null,
                'consent_file_id' => $_POST['consent_file_id'] ?? $_POST['consentFileId'] ?? null,
                'booking_id' => $_POST['booking_id'] ?? $_POST['bookingId'] ?? null,
                'pet_id' => $_POST['pet_id'] ?? $_POST['petId'] ?? null,
            ]
        );
    } catch (Throwable $exception) {
        error_log('Consent upload receipt creation failed: ' . $exception->getMessage());
        http_response_code(503);
        echo json_encode(['message' => 'Consent uploads are temporarily unavailable. Please try again later.']);
        exit;
    }
}

if (move_uploaded_file($file['tmp_name'], $targetFile)) {
    // Return the URL to the uploaded image
    $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'];
    
    // We return a path relative to the PROJECT ROOT (Vite Root)
    $relativeUrl = $urlPath . $fileName;
    $protectedUrl = "/api/uploads/media/" . $relativeUrl;
    
    $response = [
        'message' => 'File uploaded successfully.',
        'url' => $protectedUrl,
        'relative_url' => $relativeUrl,
        'protected_url' => $protectedUrl,
        'full_url' => $protocol . "://" . $host . $protectedUrl
    ];
    if (is_array($uploadReceipt)) {
        $response['upload_receipt'] = $uploadReceipt['receipt'];
        $response['upload_receipt_expires_at'] = date(DATE_ATOM, (int)$uploadReceipt['expires_at']);
    }

    echo json_encode($response);
} else {
    http_response_code(500);
    echo json_encode(['message' => 'Failed to move uploaded file.']);
}
