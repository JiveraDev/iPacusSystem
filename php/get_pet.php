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

function getPetTableExists(PDO $pdo, string $tableName): bool
{
    $stmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM information_schema.tables
        WHERE table_schema = DATABASE()
          AND table_name = ?
    ");
    $stmt->execute([$tableName]);

    return (int)$stmt->fetchColumn() > 0;
}

function getPetPrescriptionDocuments(PDO $pdo, int $petId): array
{
    if (!getPetTableExists($pdo, 'vet_diagnoses') || !getPetColumnExists($pdo, 'vet_diagnoses', 'attachments')) {
        return [];
    }

    $stmt = $pdo->prepare("
        SELECT diagnosis_id, veterinarian_name, attachments, finalized_at, created_at
        FROM vet_diagnoses
        WHERE pet_id = ?
        ORDER BY finalized_at DESC, created_at DESC, diagnosis_id DESC
    ");
    $stmt->execute([$petId]);
    $documents = [];

    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $attachments = json_decode((string)($row['attachments'] ?? ''), true);
        if (!is_array($attachments)) {
            continue;
        }

        foreach ($attachments as $attachment) {
            if (($attachment['category'] ?? '') !== 'prescription_document') {
                continue;
            }

            $documents[] = [
                'id' => $attachment['id'] ?? ('prescription-' . $row['diagnosis_id']),
                'diagnosisId' => (int)$row['diagnosis_id'],
                'name' => $attachment['name'] ?? 'Prescription document',
                'url' => $attachment['url'] ?? $attachment['relativeUrl'] ?? '',
                'relativeUrl' => $attachment['relativeUrl'] ?? $attachment['url'] ?? '',
                'mimeType' => $attachment['mimeType'] ?? 'image/png',
                'veterinarianName' => $row['veterinarian_name'] ?? '',
                'createdAt' => $attachment['uploadedAt'] ?? $row['finalized_at'] ?? $row['created_at'],
            ];
        }
    }

    return $documents;
}

try {
    // Check if it's a sharable ID or numeric ID
    $sql = "SELECT p.*, po.user_id AS owner_user_id, CONCAT(u.first_Name, ' ', u.last_Name) as owner_name
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
        'ownerName' => $pet['owner_name'] ?: null,
        'ownerUserId' => $pet['owner_user_id'] !== null ? (int)$pet['owner_user_id'] : null,
        'hasOwnership' => $pet['owner_user_id'] !== null,
        'tempOwnerName' => $pet['pet_Temp_owner'] ?: null,
        'profileImage' => $pet['setpetImage_url'],
        'allergies_raw' => $pet['pet_allergies'],
        'allergies' => $pet['pet_allergies'] ? [['allergen' => $pet['pet_allergies'], 'severity' => 'Known']] : [],
        'vaccinations' => $vaccinations,
        'prescriptionDocuments' => getPetPrescriptionDocuments($pdo, (int)$pet['pet_id'])
    ];

    echo json_encode($formattedPet);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['message' => 'Failed to fetch pet: ' . $e->getMessage()]);
}
