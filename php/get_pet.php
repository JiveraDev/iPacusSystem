<?php
require_once __DIR__ . '/db.php';

$petId = $_GET['petId'] ?? null;

if (!$petId) {
    http_response_code(400);
    echo json_encode(['message' => 'Pet ID is required.']);
    exit;
}

function getPetColumnExists(PDO $pdo, string $tableName, string $columnName): bool
{
    $stmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = ?
          AND column_name = ?
    ");
    $stmt->execute([$tableName, $columnName]);

    return (int)$stmt->fetchColumn() > 0;
}

try {
    // Check if it's a sharable ID or numeric ID
    $sql = "SELECT p.*, CONCAT(u.first_Name, ' ', u.last_Name) as owner_name 
            FROM pets_information p
            LEFT JOIN pet_ownership po ON p.pet_id = po.pet_id
            LEFT JOIN users u ON po.user_id = u.user_id
            WHERE " . (strpos($petId, 'PET-') === 0 ? "p.pet_sharable_ID" : "p.pet_id") . " = ? 
            LIMIT 1";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([$petId]);
    $pet = $stmt->fetch();

    if (!$pet) {
        http_response_code(404);
        echo json_encode(['message' => 'Pet not found.']);
        exit;
    }

    $vaccinations = [];
    try {
        $hasLicense = getPetColumnExists($pdo, 'pet_vaccinations', 'vax_veterinarian_license');
        $hasNotes = getPetColumnExists($pdo, 'pet_vaccinations', 'vax_notes');
        $hasVetUserId = getPetColumnExists($pdo, 'pet_vaccinations', 'vax_veterinarian_user_id');
        $hasSourceDiagnosis = getPetColumnExists($pdo, 'pet_vaccinations', 'source_diagnosis_id');

        $vaxStmt = $pdo->prepare("
            SELECT
                vax_id as id,
                vax_name as name,
                vax_date as date,
                vax_next_due as nextDue,
                vax_applicator as applicator,
                " . ($hasLicense ? "vax_veterinarian_license" : "NULL") . " as veterinarianLicense,
                " . ($hasNotes ? "vax_notes" : "NULL") . " as notes,
                " . ($hasVetUserId ? "vax_veterinarian_user_id" : "NULL") . " as veterinarianUserId,
                " . ($hasSourceDiagnosis ? "source_diagnosis_id" : "NULL") . " as sourceDiagnosisId,
                vax_status as status
            FROM pet_vaccinations
            WHERE pet_id = ?
            ORDER BY vax_date DESC, vax_id DESC
        ");
        $vaxStmt->execute([(int)$pet['pet_id']]);
        $vaccinations = $vaxStmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (Exception $ignored) {
        $vaccinations = [];
    }

    // Format the pet object for the frontend
    $formattedPet = [
        'id' => $pet['pet_sharable_ID'],
        'db_id' => $pet['pet_id'],
        'name' => $pet['pet_name'],
        'petName' => $pet['pet_name'],
        'species' => $pet['pet_species'],
        'breed' => $pet['pet_breed'],
        'birthDate' => $pet['pet_BDAY'],
        'gender' => $pet['pet_gender'],
        'status' => $pet['pet_status'],
        'age' => $pet['pet_age'],
        'weight' => $pet['pet_weight'],
        'color' => $pet['pet_color_marking'],
        'microchipId' => $pet['pet_microchip'],
        'ownerName' => $pet['owner_name'] ?: $pet['pet_Temp_owner'],
        'profileImage' => $pet['setpetImage_url'],
        'allergies_raw' => $pet['pet_allergies'],
        'allergies' => $pet['pet_allergies'] ? [['allergen' => $pet['pet_allergies'], 'severity' => 'Known']] : [],
        'vaccinations' => $vaccinations
    ];

    echo json_encode($formattedPet);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['message' => 'Failed to fetch pet: ' . $e->getMessage()]);
}
