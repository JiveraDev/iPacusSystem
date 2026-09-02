<?php
require_once __DIR__ . '/db.php';

$directorySearch = trim((string)($_GET['search'] ?? ''));
if ($directorySearch !== '') {
    require_once __DIR__ . '/pet_directory_search.php';
    pet_directory_search($pdo, $directorySearch);
    exit;
}

try {
    $includeArchived = in_array(strtolower((string)($_GET['includeArchived'] ?? '')), ['1', 'true', 'yes'], true);
    $archiveFilter = $includeArchived ? '' : 'AND COALESCE(is_archived, 0) = 0';
    $stmt = $pdo->query("
        SELECT
            pets_information.*,
            linked_owner.user_id AS linked_owner_user_id,
            TRIM(CONCAT_WS(' ', linked_owner.first_Name, linked_owner.last_Name)) AS linked_owner_name
        FROM pets_information
        LEFT JOIN users linked_owner ON linked_owner.user_id = (
            SELECT ownership.user_id
            FROM pet_ownership ownership
            WHERE ownership.pet_id = pets_information.pet_id
              AND ownership.user_id IS NOT NULL
            ORDER BY ownership.link_id ASC
            LIMIT 1
        )
        WHERE COALESCE(pet_sharable_ID, '') <> 'PET-WALK-IN-SALE'
          {$archiveFilter}
        ORDER BY pet_id DESC
    ");
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
            'ownerUserId' => $pet['linked_owner_user_id'] !== null ? (int)$pet['linked_owner_user_id'] : null,
            'ownerName' => trim((string)($pet['linked_owner_name'] ?? '')) ?: $pet['pet_Temp_owner'],
            'hasLinkedOwner' => $pet['linked_owner_user_id'] !== null,
            'profileImage' => $pet['setpetImage_url'],
            'isArchived' => (int)($pet['is_archived'] ?? 0) === 1,
            'archivedAt' => $pet['archived_at'] ?? null,
            'archiveReason' => $pet['archive_reason'] ?? '',
        ];
    }, $pets);

    echo json_encode($formattedPets);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['message' => 'Failed to fetch pets: ' . $e->getMessage()]);
}
