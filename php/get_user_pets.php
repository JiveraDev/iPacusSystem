<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/reference_number_helpers.php';

$userId = $_GET['userId'] ?? null;

if (!$userId) {
    http_response_code(400);
    echo json_encode(['message' => 'User ID is required.']);
    exit;
}

function fetchUserPetRows(PDO $pdo, $userId): array
{
    $sql = "SELECT p.*, q.queue_id, q.status AS queue_status, q.queue_number, q.timestamp AS queue_timestamp
            FROM pets_information p
            JOIN pet_ownership o ON p.pet_id = o.pet_id
            LEFT JOIN queues q ON q.queue_id = (
                SELECT q2.queue_id
                FROM queues q2
                WHERE q2.pet_id = p.pet_id
                  AND q2.status IN ('waiting', 'in-progress')
                ORDER BY q2.queue_id DESC
                LIMIT 1
            )
            WHERE o.user_id = ?
            ORDER BY p.pet_id DESC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([$userId]);
    return $stmt->fetchAll();
}

try {
    try {
        $pets = fetchUserPetRows($pdo, $userId);
    } catch (PDOException $e) {
        if (!isRecoverableDatabaseConnectionError($e)) {
            throw $e;
        }

        $pets = fetchUserPetRows(reconnectDatabase(), $userId);
    }

    $formattedPets = array_map(function($pet) {
        return [
            'id' => $pet['pet_sharable_ID'],
            'db_id' => $pet['pet_id'],
            'name' => $pet['pet_name'],
            'petName' => $pet['pet_name'], // Compatibility for Admin
            'species' => $pet['pet_species'],
            'breed' => $pet['pet_breed'],
            'birthDate' => $pet['pet_BDAY'],
            'gender' => $pet['pet_gender'],
            'status' => $pet['pet_status'],
            'age' => $pet['pet_age'],
            'weight' => $pet['pet_weight'],
            'color' => $pet['pet_color_marking'],
            'profileImage' => $pet['setpetImage_url'],
            'active_queue' => $pet['queue_id'] ? [
                'queue_id' => $pet['queue_id'],
                'status' => $pet['queue_status'],
                'queue_number' => $pet['queue_number'],
                'queue_reference' => ipawcus_format_queue_reference($pet['queue_number'], $pet['queue_timestamp'] ?? null)
            ] : null
        ];
    }, $pets);

    echo json_encode($formattedPets);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['message' => 'Failed to fetch user pets: ' . $e->getMessage()]);
}
