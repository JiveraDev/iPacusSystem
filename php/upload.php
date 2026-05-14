<?php
// Handle image upload
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['message' => 'Method not allowed.']);
    exit;
}

if (!isset($_FILES['image'])) {
    http_response_code(400);
    echo json_encode(['message' => 'No image uploaded.']);
    exit;
}

$file = $_FILES['image'];
$type = $_POST['type'] ?? 'user'; // 'user' or 'pet'
$fileName = time() . '_' . basename($file['name']);

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
} elseif ($type === 'booking_concern') {
    $targetDir = __DIR__ . '/../public/concerns/';
    $urlPath = "concerns/";
} else {
    $targetDir = __DIR__ . '/../public/uploads/';
    $urlPath = "uploads/";
}

if (!is_dir($targetDir)) {
    mkdir($targetDir, 0777, true);
}

$targetFile = $targetDir . $fileName;

if (move_uploaded_file($file['tmp_name'], $targetFile)) {
    // Return the URL to the uploaded image
    $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'];
    
    // We return a path relative to the PROJECT ROOT (Vite Root)
    $relativeUrl = $urlPath . $fileName;
    
    echo json_encode([
        'message' => 'Image uploaded successfully.',
        'url' => '/' . $relativeUrl,
        'relative_url' => $relativeUrl,
        'full_url' => $protocol . "://" . $host . '/' . $relativeUrl
    ]);
} else {
    http_response_code(500);
    echo json_encode(['message' => 'Failed to move uploaded file.']);
}
