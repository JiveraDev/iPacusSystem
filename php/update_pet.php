<?php
require_once __DIR__ . '/db.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'PATCH') {
    http_response_code(405);
    echo json_encode(['message' => 'Method not allowed']);
    exit;
}

$petId = $_GET['petId'] ?? null;
if (!$petId) {
    http_response_code(400);
    echo json_encode(['message' => 'Pet ID is required.']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    http_response_code(400);
    echo json_encode(['message' => 'Invalid JSON payload.']);
    exit;
}

$allowedFields = [
    'setpetImage_url' => 'setpetImage_url',
];

$setParts = [];
$params = [];

foreach ($allowedFields as $inputKey => $dbColumn) {
    if (array_key_exists($inputKey, $input)) {
        $setParts[] = "{$dbColumn} = ?";
        $params[] = $input[$inputKey];
    }
}

if (empty($setParts)) {
    http_response_code(400);
    echo json_encode(['message' => 'No updatable fields were provided.']);
    exit;
}

$params[] = $petId;

try {
    $sql = "UPDATE pets_information SET " . implode(', ', $setParts) . " WHERE pet_id = ?";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    if ($stmt->rowCount() === 0) {
        $existsStmt = $pdo->prepare("SELECT 1 FROM pets_information WHERE pet_id = ? LIMIT 1");
        $existsStmt->execute([$petId]);
        if (!$existsStmt->fetchColumn()) {
            http_response_code(404);
            echo json_encode(['message' => 'Pet not found.']);
            exit;
        }
    }

    echo json_encode(['message' => 'Pet updated successfully.']);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['message' => 'Failed to update pet: ' . $e->getMessage()]);
}

