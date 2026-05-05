<?php
require_once __DIR__ . '/db.php';

$petId = $_GET['petId'] ?? null;

if (!$petId) {
    http_response_code(400);
    echo json_encode(['message' => 'Pet ID is required.']);
    exit;
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
        // Mocking vaccinations/allergies arrays for UI compatibility if they are just text in DB
        'allergies' => $pet['pet_allergies'] ? [['allergen' => $pet['pet_allergies'], 'severity' => 'Known']] : [],
        'vaccinations' => [] // Should be fetched from another table if available
    ];

    echo json_encode($formattedPet);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['message' => 'Failed to fetch pet: ' . $e->getMessage()]);
}
