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

// Home service specific fields
$isHomeService = $input['is_home_service'] ?? 0;
$address = $input['address'] ?? null;
$specificLocation = $input['specific_location'] ?? null;

// Combine address and specific location for a "complete address"
if ($specificLocation && $address) {
    $address = $address . " | Specific Location: " . $specificLocation;
}

$signaturePath = $input['signature'] ?? null;
$paymentProofUrl = $input['payment_proof_url'] ?? null;
$price = $input['price'] ?? 0;
$transportFee = $input['transport_fee'] ?? 0;

// Online consultation specific fields
$isOnlineConsultation = $input['is_online_consultation'] ?? 0;
$veterinarianId = $input['veterinarian_id'] ?? null;

if (!$userId || !$serviceType || !$bookingDate || !$bookingTime) {
    http_response_code(400);
    echo json_encode(['message' => 'Missing required booking information.']);
    exit;
}

try {
    // Generate a unique booking number
    $bookingNumber = 'BK-' . strtoupper(bin2hex(random_bytes(4)));

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
            unregistered_pet_name,
            unregistered_pet_breed,
            unregistered_pet_age,
            unregistered_pet_weight,
            status,
            is_home_service,
            address,
            signature_path,
            payment_proof_url,
            is_online_consultation,
            veterinarian_id,
            price,
            transport_fee,
            created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
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
        $petType,
        $newPetName,
        $newPetBreed,
        $newPetAge,
        $newPetWeight,
        'pending',
        $isHomeService,
        $address,
        $signaturePath,
        $paymentProofUrl,
        $isOnlineConsultation,
        $veterinarianId,
        $price,
        $transportFee
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

