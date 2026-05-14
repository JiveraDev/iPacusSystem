<?php
require_once __DIR__ . '/db.php';

// Get JSON input
$input = json_decode(file_get_contents('php://input'), true);

$petName = $input['petName'] ?? null;
$species = $input['species'] ?? null;
$breed = $input['breed'] ?? null;
$birthDate = $input['birthDate'] ?? null;
$gender = $input['gender'] ?? null;
$status = $input['status'] ?? 'Healthy';

if (!$petName || !$species || !$breed || !$birthDate || !$gender) {
    http_response_code(400);
    echo json_encode(['message' => 'Missing required pet fields.']);
    exit;
}

try {
    $pdo->beginTransaction();

    // 1. Initial Insert (without the sharable ID)
    $sql = "INSERT INTO pets_information 
                (pet_name, pet_species, pet_breed, pet_BDAY, pet_gender, pet_status, pet_age, pet_weight, pet_microchip, pet_Temp_owner, pet_allergies, pet_color_marking, setpetImage_url) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        $petName,
        $species,
        $breed,
        $birthDate,
        $gender,
        $status,
        $input['age'] ?? null,
        $input['weight'] ?? 0,
        $input['microchipNumber'] ?? null,
        $input['tempOwnerName'] ?? null,
        $input['allergies'] ?? null,
        $input['colorMarkings'] ?? null,
        $input['profileImage'] ?? null
    ]);

    $petId = $pdo->lastInsertId();

    // 2. Generate the simplified Sharable ID using the auto-increment ID
    // Format: PET-{pet_id}-IPAWCUS
    $sharableId = "PET-$petId-IPAWCUS";

    // 3. Update the record with the new ID
    $updateStmt = $pdo->prepare("UPDATE pets_information SET pet_sharable_ID = ? WHERE pet_id = ?");
    $updateStmt->execute([$sharableId, $petId]);

    // 4. Insert history
    $sqlHistory = "INSERT INTO history_before_registration (current_medication, veterinarian_notes, pet_id, last_visit_Date) VALUES (?, ?, ?, ?)";
    $stmtHistory = $pdo->prepare($sqlHistory);
    $stmtHistory->execute([
        $input['currentMedication'] ?? null,
        $input['veterinarianNotes'] ?? null,
        $petId,
        $input['lastVisitDate'] ?? null
    ]);

    // 5. Auto-link to user if userId is provided
    $userId = $input['userId'] ?? null;
    if ($userId) {
        $stmtOwnership = $pdo->prepare("INSERT INTO pet_ownership (user_id, pet_id) VALUES (?, ?)");
        $stmtOwnership->execute([$userId, $petId]);

        // Update pet_Temp_owner to the actual owner's name
        $stmtUser = $pdo->prepare("SELECT first_Name, last_Name FROM users WHERE user_id = ? LIMIT 1");
        $stmtUser->execute([$userId]);
        $user = $stmtUser->fetch();
        if ($user) {
            $fullName = trim($user['first_Name'] . ' ' . $user['last_Name']);
            $stmtUpdatePet = $pdo->prepare("UPDATE pets_information SET pet_Temp_owner = ? WHERE pet_id = ?");
            $stmtUpdatePet->execute([$fullName, $petId]);
        }
    }

    $pdo->commit();

    http_response_code(201);
    echo json_encode([
        'id' => $petId,
        'sharableId' => $sharableId,
        'message' => 'Pet registered successfully.'
    ]);

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['message' => $e->getMessage() ?: 'Failed to register pet.']);
}
