<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/pet_allergy_helpers.php';
require_once __DIR__ . '/workflow_guard_helpers.php';

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
    $currentApiUser = ipawcus_guard_current_user($pdo);
    $currentApiRole = ipawcus_guard_role($currentApiUser);
    $currentApiUserId = ipawcus_guard_user_id($currentApiUser);
    if ($currentApiRole !== 'pet_owner' && !ipawcus_guard_is_clinic_role($currentApiRole)) {
        ipawcus_guard_error(403, 'You are not allowed to view pet records.');
    }

    // Fetch the pet independently from ownership rows. A direct ownership join
    // becomes nondeterministic as soon as an approved co-parent is present.
    $sql = "SELECT p.*
            FROM pets_information p
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

    if (
        $currentApiRole === 'pet_owner'
        && !ipawcus_guard_pet_access($pdo, (int)$pet['pet_id'], $currentApiUserId)
    ) {
        ipawcus_guard_error(403, 'You are not allowed to view this pet record.');
    }

    $hasOwnershipRelationship = getPetColumnExists($pdo, 'pet_ownership', 'relationship');
    $hasPrimaryOwnership = getPetColumnExists($pdo, 'pet_ownership', 'is_primary');
    $relationshipSelect = $hasOwnershipRelationship
        ? 'po.relationship'
        : "'primary' AS relationship";
    $primarySelect = $hasPrimaryOwnership
        ? 'po.is_primary'
        : 'CASE WHEN po.link_id IS NOT NULL THEN 1 ELSE 0 END AS is_primary';
    $primaryOrder = $hasPrimaryOwnership
        ? 'CASE WHEN po.is_primary = 1 THEN 0 ELSE 1 END,'
        : '';
    $relationshipOrder = $hasOwnershipRelationship
        ? "CASE WHEN po.relationship = 'primary' THEN 0 ELSE 1 END,"
        : '';
    $ownershipStmt = $pdo->prepare("
        SELECT
            po.link_id,
            po.user_id,
            {$relationshipSelect},
            {$primarySelect},
            u.first_Name,
            u.last_Name,
            u.mail_Address
        FROM pet_ownership po
        JOIN users u ON u.user_id = po.user_id
        WHERE po.pet_id = ?
        ORDER BY
            {$primaryOrder}
            {$relationshipOrder}
            po.link_id ASC
    ");
    $ownershipStmt->execute([(int)$pet['pet_id']]);
    $ownerships = [];

    foreach ($ownershipStmt->fetchAll(PDO::FETCH_ASSOC) as $index => $ownership) {
        $relationship = strtolower(trim((string)($ownership['relationship'] ?? '')));
        $isPrimary = (int)($ownership['is_primary'] ?? 0) === 1 || $relationship === 'primary';
        if ($index === 0 && !$isPrimary) {
            // Keep legacy rows usable until the approved metadata migration is applied.
            $isPrimary = true;
        }

        $name = trim((string)($ownership['first_Name'] ?? '') . ' ' . (string)($ownership['last_Name'] ?? ''));
        $ownerships[] = [
            'userId' => (int)$ownership['user_id'],
            'name' => $name !== '' ? $name : ((string)($ownership['mail_Address'] ?? '') ?: 'Pet owner'),
            'email' => $ownership['mail_Address'] ?? '',
            'relationship' => $isPrimary ? 'primary' : 'co_parent',
            'isPrimary' => $isPrimary,
        ];
    }

    $primaryOwner = null;
    $coParents = [];
    foreach ($ownerships as $ownership) {
        if ($ownership['isPrimary'] && $primaryOwner === null) {
            $primaryOwner = $ownership;
        } else {
            $coParents[] = array_merge($ownership, [
                'relationship' => 'co_parent',
                'isPrimary' => false,
            ]);
        }
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

    $allergyEntries = pet_allergy_effective_entries($pdo, (int)$pet['pet_id'], $pet['pet_allergies'] ?? null);
    $effectiveAllergyText = pet_allergy_effective_text($pdo, (int)$pet['pet_id'], $pet['pet_allergies'] ?? null);

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
        'ownerName' => $primaryOwner['name'] ?? null,
        'ownerUserId' => isset($primaryOwner['userId']) ? (int)$primaryOwner['userId'] : null,
        'hasOwnership' => !empty($ownerships),
        'primaryOwner' => $primaryOwner,
        'coParents' => $coParents,
        'ownerships' => $ownerships,
        'tempOwnerName' => $pet['pet_Temp_owner'] ?: null,
        'profileImage' => $pet['setpetImage_url'],
        'allergies_raw' => $effectiveAllergyText,
        'allergies' => $allergyEntries,
        'vaccinations' => $vaccinations,
        'prescriptionDocuments' => getPetPrescriptionDocuments($pdo, (int)$pet['pet_id'])
    ];

    echo json_encode($formattedPet);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['message' => 'Failed to fetch pet: ' . $e->getMessage()]);
}
