<?php
require_once __DIR__ . '/db.php';

header("Content-Type: application/json");

try {
    // Fetch bookings joined with users and pets for full context
    $sql = "SELECT b.*, 
                   p.pet_name, p.pet_species, p.pet_breed, 
                   u.first_Name, u.last_Name, u.mail_Address
            FROM bookings b
            LEFT JOIN pets_information p ON b.pet_id = p.pet_id
            JOIN users u ON b.user_id = u.user_id
            ORDER BY b.created_at DESC";
    
    $stmt = $pdo->query($sql);
    $bookings = $stmt->fetchAll();

    $formattedBookings = array_map(function($b) {
        $isRegistered = $b['registered_status'] === 'Registered';
        $isHomeService = (bool)$b['is_home_service'];
        $isOnlineConsultation = (bool)$b['is_online_consultation'];
        
        // Extract services/topics from notes
        $serviceName = $b['service_type'];
        if ($b['notes']) {
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
            'petName' => $isRegistered ? $b['pet_name'] : $b['unregistered_pet_name'],
            'petSpecies' => $isRegistered ? $b['pet_species'] : $b['petType'],
            'petBreed' => $isRegistered ? $b['pet_breed'] : $b['unregistered_pet_breed'],
            'petAge' => $b['unregistered_pet_age'],
            'petWeight' => $b['unregistered_pet_weight'],
            'ownerName' => $b['first_Name'] . ' ' . $b['last_Name'],
            'ownerEmail' => $b['mail_Address'],
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
            'veterinarian' => $b['veterinarian_id'],
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
