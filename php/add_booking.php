<?php
require_once __DIR__ . '/db.php';

// Get JSON input
$input = json_decode(file_get_contents('php://input'), true);

$userId = $input['user_id'] ?? null;
$petId = $input['pet_id'] ?? null;
$serviceType = $input['service_type'] ?? null;
$bookingDate = $input['booking_date'] ?? null;
$bookingTime = $input['booking_time'] ?? null;
$notes = $input['notes'] ?? null;
$imagePath = $input['Image_Booking_Concern_Path'] ?? null;
$registeredStatus = $input['registered_status'] ?? null;
$petType = $input['petType'] ?? null;

// New pet details if unregistered
$newPetName = $input['new_pet_name'] ?? null;
$newPetBreed = $input['new_pet_breed'] ?? null;
$newPetAge = $input['new_pet_age'] ?? null;
$newPetWeight = $input['new_pet_weight'] ?? null;

if (!$userId || !$serviceType || !$bookingDate || !$bookingTime) {
    http_response_code(400);
    echo json_encode(['message' => 'Missing required booking information.']);
    exit;
}

try {
    // Generate a unique booking number
    $bookingNumber = 'BK-' . strtoupper(bin2hex(random_bytes(4)));

    // For unregistered pets, we might need a placeholder pet_id if the column is NOT NULL
    // If pet_id is 0 or null, it signifies an unregistered pet
    
    $stmt = $pdo->prepare("
        INSERT INTO bookings (
            user_id, 
            pet_id, 
            booking_number, 
            service_type, 
            booking_date, 
            booking_time, 
            notes, 
            Image_Booking_Concern_Path, 
            registered_status, 
            petType,
            status,
            created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())
    ");

    $stmt->execute([
        $userId,
        $petId ?: null, 
        $bookingNumber,
        $serviceType,
        $bookingDate,
        $bookingTime,
        $notes,
        $imagePath,
        $registeredStatus,
        $petType
    ]);

    echo json_encode([
        'message' => 'Booking created successfully.',
        'booking_id' => $pdo->lastInsertId(),
        'booking_number' => $bookingNumber
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['message' => 'Failed to create booking: ' . $e->getMessage()]);
}
