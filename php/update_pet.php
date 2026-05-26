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

// Map frontend keys to DB columns
$allowedFields = [
    'petName' => 'pet_name',
    'species' => 'pet_species',
    'breed' => 'pet_breed',
    'birthDate' => 'pet_BDAY',
    'status' => 'pet_status',
    'gender' => 'pet_gender',
    'weight' => 'pet_weight',
    'microchipId' => 'pet_microchip',
    'color' => 'pet_color_marking',
    'allergies' => 'pet_allergies',
    'tempOwner' => 'pet_Temp_owner',
    'setpetImage_url' => 'setpetImage_url',
    'profileImage' => 'setpetImage_url', // alias
    'age' => 'pet_age'
];

$setParts = [];
$params = [];

foreach ($allowedFields as $inputKey => $dbColumn) {
    if (array_key_exists($inputKey, $input)) {
        // Handle weight specifically if it's coming as "15 kg" string
        $value = $input[$inputKey];
        if ($inputKey === 'weight' && is_string($value)) {
            $value = floatval(preg_replace('/[^0-9.]/', '', $value));
        }
        
        // Avoid adding the same column twice if both aliases are used
        if (!in_array("{$dbColumn} = ?", $setParts)) {
            $setParts[] = "{$dbColumn} = ?";
            $params[] = $value;
        }
    }
}

if (empty($setParts)) {
    http_response_code(400);
    echo json_encode(['message' => 'No updatable fields were provided.']);
    exit;
}

// Check if it's a sharable ID or numeric ID for the WHERE clause
$idColumn = (strpos($petId, 'PET-') === 0) ? "pet_sharable_ID" : "pet_id";
$params[] = $petId;

try {
    $sql = "UPDATE pets_information SET " . implode(', ', $setParts) . " WHERE $idColumn = ?";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    echo json_encode(['message' => 'Pet updated successfully.', 'success' => true]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['message' => 'Failed to update pet: ' . $e->getMessage()]);
}
