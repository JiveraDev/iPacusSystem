<?php
require_once __DIR__ . '/db.php';

header("Content-Type: application/json");

function tableExists(PDO $pdo, string $tableName): bool
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

try {
    $userId = $_GET['userId'] ?? null;
    $bookingId = $_GET['bookingId'] ?? null;
    $params = [];
    $hasBookingPets = tableExists($pdo, 'booking_pets');
    $multiPetSelect = $hasBookingPets
        ? "multi.pet_ids AS booked_pet_ids, multi.pet_names AS booked_pet_names,"
        : "NULL AS booked_pet_ids, NULL AS booked_pet_names,";
    $multiPetJoin = $hasBookingPets
        ? "LEFT JOIN (
                SELECT
                    bp.booking_id,
                    GROUP_CONCAT(bp.pet_id ORDER BY bp.pet_id SEPARATOR ',') AS pet_ids,
                    GROUP_CONCAT(p2.pet_name ORDER BY p2.pet_name SEPARATOR ', ') AS pet_names
                FROM booking_pets bp
                JOIN pets_information p2 ON p2.pet_id = bp.pet_id
                GROUP BY bp.booking_id
           ) multi ON multi.booking_id = b.booking_id"
        : "";

    // Fetch bookings joined with users and pets for full context
    $sql = "SELECT b.*, 
                   p.pet_name,
                   p.pet_species,
                   p.pet_breed,
                   p.pet_sharable_ID,
                   p.pet_BDAY,
                   p.pet_gender,
                   p.pet_status,
                   p.pet_age,
                   p.pet_weight,
                   p.pet_microchip,
                   p.pet_Temp_owner,
                   p.pet_allergies,
                   p.pet_color_marking,
                   p.setpetImage_url, 
                   u.first_Name,
                   u.last_Name,
                   u.mail_Address,
                   u.personal_Address,
                   u.phoneNumber,
                   u.emergencyNumber,
                   u.birthdate,
                   u.setProfilePic_url,
                   v.first_Name as vet_first_name, v.last_Name as vet_last_name,
                   {$multiPetSelect}
                   1 as select_marker
            FROM bookings b
            LEFT JOIN pets_information p ON b.pet_id = p.pet_id
            JOIN users u ON b.user_id = u.user_id
            LEFT JOIN users v ON b.veterinarian_id = v.user_id
            {$multiPetJoin}";
    
    if ($userId) {
        $sql .= " WHERE b.user_id = ?";
        $params[] = $userId;
    } elseif ($bookingId) {
        $sql .= " WHERE b.booking_id = ?";
        $params[] = $bookingId;
    }

    $sql .= " ORDER BY b.created_at DESC";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $bookings = $stmt->fetchAll();

    $formattedBookings = array_map(function($b) {
        $isRegistered = $b['registered_status'] === 'Registered' || (!empty($b['pet_id']) && !empty($b['pet_name']));
        $isHomeService = (bool)$b['is_home_service'];
        $isOnlineConsultation = (bool)$b['is_online_consultation'];
        $addOns = null;
        if (!empty($b['add_ons'])) {
            $decodedAddOns = json_decode($b['add_ons'], true);
            $addOns = json_last_error() === JSON_ERROR_NONE ? $decodedAddOns : $b['add_ons'];
        }
        
        // Extract services/topics from notes
        $serviceName = $b['service_type'];
        if ($b['service_type'] === 'boarding' && !empty($b['hotel_boarding_type'])) {
            $serviceName = $b['hotel_boarding_type'] === 'hotel' ? 'Pet Hotel' : 'Pet Boarding';
            if (!empty($b['room_size'])) {
                $roomLabel = ucfirst($b['room_size']);
                $serviceName .= ' - ' . $roomLabel . ($b['hotel_boarding_type'] === 'hotel' ? ' Room' : ' Kennel');
            }
        } elseif ($b['notes']) {
            if ($isHomeService && preg_match('/\[Services: (.*?)\]/', $b['notes'], $matches)) {
                $serviceName = $matches[1];
            } elseif ($isOnlineConsultation && preg_match('/\[Topic: (.*?)\]/', $b['notes'], $matches)) {
                $serviceName = $matches[1];
            }
        }

        return [
            'id' => $b['booking_id'],
            'userId' => $b['user_id'],
            'bookingNumber' => $b['booking_number'],
            'petId' => $b['pet_id'],
            'petShareableId' => $b['pet_sharable_ID'],
            'petIds' => $b['booked_pet_ids'] ? array_map('intval', explode(',', $b['booked_pet_ids'])) : ($b['pet_id'] ? [(int)$b['pet_id']] : []),
            'petName' => $b['booked_pet_names'] ?: ($isRegistered ? $b['pet_name'] : $b['unregistered_pet_name']),
            'petSpecies' => $isRegistered ? $b['pet_species'] : $b['petType'],
            'petBreed' => $isRegistered ? $b['pet_breed'] : $b['unregistered_pet_breed'],
            'petProfileImage' => $b['setpetImage_url'],
            'petBirthDate' => $isRegistered ? $b['pet_BDAY'] : null,
            'petGender' => $isRegistered ? $b['pet_gender'] : null,
            'petStatus' => $isRegistered ? $b['pet_status'] : null,
            'petAge' => $isRegistered ? $b['pet_age'] : $b['unregistered_pet_age'],
            'petWeight' => $isRegistered ? $b['pet_weight'] : $b['unregistered_pet_weight'],
            'petMicrochipId' => $isRegistered ? $b['pet_microchip'] : null,
            'petColor' => $isRegistered ? $b['pet_color_marking'] : null,
            'petAllergies' => $isRegistered ? $b['pet_allergies'] : null,
            'petTempOwner' => $isRegistered ? $b['pet_Temp_owner'] : null,
            'ownerName' => $b['first_Name'] . ' ' . $b['last_Name'],
            'ownerEmail' => $b['mail_Address'],
            'ownerPhone' => $b['phoneNumber'],
            'ownerEmergencyNumber' => $b['emergencyNumber'],
            'ownerAddress' => $b['personal_Address'],
            'ownerBirthdate' => $b['birthdate'],
            'ownerProfileImage' => $b['setProfilePic_url'],
            'type' => $b['service_type'],
            'service' => $serviceName,
            'date' => $b['booking_date'],
            'time' => $b['booking_time'],
            'status' => $b['status'],
            'price' => $b['price'],
            'notes' => $b['notes'],
            'isHomeService' => $isHomeService,
            'address' => $b['address'],
            'paymentProof' => $b['payment_proof_url'],
            'isOnlineConsultation' => $isOnlineConsultation,
            'veterinarianId' => $b['veterinarian_id'],
            'veterinarian' => $b['vet_first_name'] ? "Dr. {$b['vet_first_name']} {$b['vet_last_name']}" : "Unassigned",
            'hotelBoardingType' => $b['hotel_boarding_type'] ?? null,
            'checkInDate' => $b['check_in_date'] ?? null,
            'checkOutDate' => $b['check_out_date'] ?? null,
            'roomSize' => $b['room_size'] ?? null,
            'addOns' => $addOns,
            'emergencyContact' => $b['emergency_contact'] ?? null,
            'image_Booking_Concern_Path' => $b['Image_Booking_Concern_Path'],
            'signaturePath' => $b['signature_path'],
            'isRegistered' => $isRegistered,
            'createdAt' => $b['created_at']
        ];
    }, $bookings);

    echo json_encode($formattedBookings);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['message' => 'Failed to fetch bookings: ' . $e->getMessage()]);
}
