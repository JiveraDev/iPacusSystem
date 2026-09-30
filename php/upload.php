<?php
// Handle file upload
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");
require_once __DIR__ . '/workflow_guard_helpers.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/upload_receipt_helpers.php';
require_once __DIR__ . '/runtime_media.php';

function ipawcus_upload_name_token($value, string $fallback = '', int $maxLength = 48): string
{
    $value = trim((string)$value);
    if ($value === '') {
        return $fallback;
    }

    if (function_exists('iconv')) {
        $asciiValue = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value);
        if ($asciiValue !== false) {
            $value = $asciiValue;
        }
    }

    $value = strtolower($value);
    $value = preg_replace('/[^a-z0-9]+/', '-', $value) ?? '';
    $value = trim($value, '-');
    $value = substr($value, 0, $maxLength);

    return trim($value, '-') ?: $fallback;
}

function ipawcus_upload_readable_file_name(array $file, string $type, string $extension): string
{
    $originalName = (string)($file['name'] ?? 'file');
    $originalBaseName = pathinfo($originalName, PATHINFO_FILENAME);
    $petName = $_POST['pet_name'] ?? $_POST['petName'] ?? '';
    $petId = $_POST['pet_id'] ?? $_POST['petId'] ?? '';
    $recordLabel = $_POST['record_label'] ?? $_POST['recordLabel'] ?? $_POST['service_name'] ?? $_POST['serviceName'] ?? '';
    $category = $_POST['attachment_category'] ?? $_POST['attachmentCategory'] ?? '';

    $parts = [];
    $petToken = ipawcus_upload_name_token($petName, '', 36);
    if ($petToken === '' && trim((string)$petId) !== '') {
        $petToken = 'pet-' . ipawcus_upload_name_token($petId, '', 20);
    }
    if ($petToken !== '') {
        $parts[] = $petToken;
    }

    $recordToken = ipawcus_upload_name_token($recordLabel, '', 40);
    if ($recordToken !== '') {
        $parts[] = $recordToken;
    }

    $categoryToken = ipawcus_upload_name_token($category ?: $type, 'file', 32);
    if (!in_array($categoryToken, $parts, true)) {
        $parts[] = $categoryToken;
    }

    $originalToken = ipawcus_upload_name_token($originalBaseName, 'file', 56);
    if (!in_array($originalToken, $parts, true)) {
        $parts[] = $originalToken;
    }

    $parts[] = date('Ymd-His');
    $parts[] = bin2hex(random_bytes(4));

    return implode('-', array_filter($parts)) . '.' . $extension;
}

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
if ($type === 'grooming_photo') {
    require __DIR__ . '/grooming_upload.php';
    exit;
}
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

$mixedDocumentUploadTypes = ['boarding_document', 'inventory_receipt', 'booking_payment', 'booking_concern', 'diagnosis'];
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

$fileName = ipawcus_upload_readable_file_name($file, $type, $extension);
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
        'full_url' => $protocol . "://" . $host . $protectedUrl,
        'original_name' => $originalName,
        'display_name' => $fileName,
        'stored_file_name' => $fileName,
        'mime_type' => $mimeType,
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
