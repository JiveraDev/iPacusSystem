<?php
require_once __DIR__ . '/db.php';

header("Content-Type: application/json");

try {
    // Fetch pets and prioritize pet_Temp_owner if user_id is null
    $sql = "SELECT p.pet_id, p.pet_name, p.pet_Temp_owner, u.user_id, u.first_Name, u.last_Name 
            FROM pets_information p
            LEFT JOIN pet_ownership o ON p.pet_id = o.pet_id
            LEFT JOIN users u ON o.user_id = u.user_id
            ORDER BY p.pet_name ASC";
            
    $stmt = $pdo->query($sql);
    $pets = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $registeredNamesStmt = $pdo->query("
        SELECT LOWER(TRIM(CONCAT(COALESCE(first_Name, ''), ' ', COALESCE(last_Name, '')))) AS full_name
        FROM users
        WHERE mail_Address NOT LIKE '%@unregistered.local'
    ");
    $registeredNames = $registeredNamesStmt->fetchAll(PDO::FETCH_COLUMN);
    $registeredNameSet = array_fill_keys(array_filter($registeredNames), true);

    // Format owner name
    $formattedPets = array_map(function($pet) use ($registeredNameSet) {
        $baseOwnerName = !empty($pet['first_Name'])
            ? ($pet['first_Name'] . ' ' . $pet['last_Name'])
            : ($pet['pet_Temp_owner'] ?? 'Unknown');
        $normalizedName = strtolower(trim($baseOwnerName));
        $isRegistered = !empty($normalizedName) && isset($registeredNameSet[$normalizedName]);
        $pet['owner_name'] = $baseOwnerName;
        $pet['owner_status'] = $isRegistered ? 'registered' : 'unregistered';
        $pet['owner_display'] = $baseOwnerName . ' (' . ($isRegistered ? 'Registered' : 'Unregistered') . ')';
        return $pet;
    }, $pets);

    echo json_encode($formattedPets);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['message' => 'Failed to fetch pets with owners: ' . $e->getMessage()]);
}
