<?php
require_once __DIR__ . '/db.php';

try {
    $stmt = $pdo->query("SELECT * FROM pets_information ORDER BY pet_id DESC");
    $pets = $stmt->fetchAll();

    // Mapping to match frontend expectations if necessary
    $formattedPets = array_map(function($pet) {
        return [
            'id' => $pet['pet_sharable_ID'], // Use sharableId as the ID for the frontend list
            'db_id' => $pet['pet_id'],
            'petName' => $pet['pet_name'],
            'species' => $pet['pet_species'],
            'breed' => $pet['pet_breed'],
            'birthDate' => $pet['pet_BDAY'],
            'gender' => $pet['pet_gender'],
            'status' => $pet['pet_status'],
            'age' => $pet['pet_age'],
            'tempOwnerName' => $pet['pet_Temp_owner'],
            'profileImage' => $pet['setpetImage_url']
        ];
    }, $pets);

    echo json_encode($formattedPets);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['message' => 'Failed to fetch pets: ' . $e->getMessage()]);
}
