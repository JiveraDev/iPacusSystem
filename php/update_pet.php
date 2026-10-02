<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/pet_allergy_helpers.php';
require_once __DIR__ . '/workflow_guard_helpers.php';

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
    'tempOwnerName' => 'pet_Temp_owner',
    'setpetImage_url' => 'setpetImage_url',
    'profileImage' => 'setpetImage_url', // alias
    'age' => 'pet_age'
];

$idColumn = (strpos($petId, 'PET-') === 0) ? "pet_sharable_ID" : "pet_id";
$hasTempOwnerUpdate = array_key_exists('tempOwner', $input) || array_key_exists('tempOwnerName', $input);
$hasAllergyUpdate = array_key_exists('allergies', $input);
$currentApiUser = ipawcus_guard_current_user($pdo);
$currentApiRole = ipawcus_guard_role($currentApiUser);
$currentApiUserId = ipawcus_guard_user_id($currentApiUser);

if ($currentApiRole !== 'pet_owner' && !ipawcus_guard_is_clinic_role($currentApiRole)) {
    ipawcus_guard_error(403, 'You are not allowed to update pet records.');
}

try {
    if ($hasTempOwnerUpdate) {
        if (!ipawcus_guard_is_admin_role($currentApiRole)) {
            http_response_code(403);
            echo json_encode(['message' => 'Only Admin or Super Admin can update a temporary owner name.']);
            exit;
        }

        $ownershipStmt = $pdo->prepare("
            SELECT p.pet_id, po.link_id
            FROM pets_information p
            LEFT JOIN pet_ownership po ON po.pet_id = p.pet_id
            WHERE p.$idColumn = ?
            LIMIT 1
        ");
        $ownershipStmt->execute([$petId]);
        $ownership = $ownershipStmt->fetch(PDO::FETCH_ASSOC);

        if (!$ownership) {
            http_response_code(404);
            echo json_encode(['message' => 'Pet not found.']);
            exit;
        }

        if (!empty($ownership['link_id'])) {
            http_response_code(409);
            echo json_encode(['message' => 'Temporary owner name can only be updated when the pet has no registered owner.']);
            exit;
        }
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['message' => 'Failed to validate pet ownership: ' . $e->getMessage()]);
    exit;
}

$setParts = [];
$params = [];
$textLength = static fn(string $value): int => function_exists('mb_strlen') ? mb_strlen($value, 'UTF-8') : strlen($value);
$namePattern = '/^[\p{L}\p{M} .\'-]+$/u';
$breedPattern = '/^[\p{L}\p{M}\p{N} .,\'’\/&()-]+$/u';
$markingsPattern = '/^[\p{L}\p{M} ]*$/u';

foreach ($allowedFields as $inputKey => $dbColumn) {
    if (array_key_exists($inputKey, $input)) {
        $value = $input[$inputKey];
        if (in_array($inputKey, ['petName', 'species', 'breed'], true)) {
            $value = trim((string)($value ?? ''));
            $maxLength = $inputKey === 'species' ? 50 : 80;
            $label = $inputKey === 'petName' ? 'Pet name' : ucfirst($inputKey);
            $pattern = $inputKey === 'breed' ? $breedPattern : $namePattern;
            if ($value === '' || $textLength($value) > $maxLength || preg_match($pattern, $value) !== 1) {
                ipawcus_guard_error(422, $inputKey === 'breed'
                    ? 'Pet breed contains unsupported characters or exceeds 80 characters.'
                    : "{$label} may contain letters, spaces, periods, apostrophes, and hyphens, up to {$maxLength} characters.");
            }
        }
        if ($inputKey === 'weight') {
            $weight = trim((string)($value ?? ''));
            if ($weight !== '' && (preg_match('/^\d{1,3}(?:\.\d{1,2})?$/', $weight) !== 1 || (float)$weight < 0.1 || (float)$weight > 300)) {
                ipawcus_guard_error(422, 'Pet weight must be between 0.1 and 300 kg with no more than two decimal places.');
            }
            $value = $weight !== '' ? (float)$weight : 0.0;
        }
        if ($inputKey === 'microchipId') {
            $microchip = preg_replace('/\D+/', '', (string)($value ?? ''));
            if ($microchip !== (string)($value ?? '') || strlen($microchip) > 15) {
                ipawcus_guard_error(422, 'Microchip number must contain no more than 15 digits.');
            }
            $value = $microchip !== '' ? $microchip : null;
        }
        if ($inputKey === 'color') {
            $color = trim((string)($value ?? ''));
            if ($textLength($color) > 120 || preg_match($markingsPattern, $color) !== 1) {
                ipawcus_guard_error(422, 'Color and markings must use letters and spaces only, up to 120 characters.');
            }
            $value = $color !== '' ? $color : null;
        }
        if ($dbColumn === 'pet_Temp_owner') {
            $value = trim((string)($value ?? ''));
            $value = $value !== '' ? $value : null;
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

$params[] = $petId;

try {
    $pdo->beginTransaction();

    $petLookup = $pdo->prepare("SELECT pet_id FROM pets_information WHERE $idColumn = ? LIMIT 1 FOR UPDATE");
    $petLookup->execute([$petId]);
    $resolvedPetId = (int)($petLookup->fetchColumn() ?: 0);
    if ($resolvedPetId <= 0) {
        $pdo->rollBack();
        http_response_code(404);
        echo json_encode(['message' => 'Pet not found.']);
        exit;
    }

    if (
        $currentApiRole === 'pet_owner'
        && !ipawcus_guard_pet_access($pdo, $resolvedPetId, $currentApiUserId)
    ) {
        ipawcus_guard_error(403, 'You are not allowed to update this pet record.');
    }

    $sql = "UPDATE pets_information SET " . implode(', ', $setParts) . " WHERE $idColumn = ?";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    if ($hasAllergyUpdate) {
        pet_allergy_merge_from_legacy(
            $pdo,
            $resolvedPetId,
            $input['allergies'] ?? null,
            $currentApiUserId,
            'profile_edit'
        );
    }

    $pdo->commit();
    echo json_encode(['message' => 'Pet updated successfully.', 'success' => true]);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['message' => 'Failed to update pet: ' . $e->getMessage()]);
}
