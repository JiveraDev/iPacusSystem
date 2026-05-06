<?php
require_once __DIR__ . '/db.php';

header("Content-Type: application/json");

try {
    // Fetch bookings joined with users and pets for full context
    $sql = "SELECT b.*, 
                   p.pet_name, p.pet_species, p.pet_breed, 
                   u.first_Name, u.last_Name, u.mail_Address
            FROM bookings b
            JOIN pets_information p ON b.pet_id = p.pet_id
            JOIN users u ON b.user_id = u.user_id
            ORDER BY b.created_at DESC";
    
    $stmt = $pdo->query($sql);
    $bookings = $stmt->fetchAll();

    $formattedBookings = array_map(function($b) {
        return [
            'id' => $b['booking_id'],
            'bookingNumber' => $b['booking_number'],
            'petId' => $b['pet_id'],
            'petName' => $b['pet_name'],
            'petSpecies' => $b['pet_species'],
            'petBreed' => $b['pet_breed'],
            'ownerName' => $b['first_Name'] . ' ' . $b['last_Name'],
            'ownerEmail' => $b['mail_Address'],
            'type' => $b['service_type'],
            'service' => $b['service_type'], // Mapping service_type to service
            'date' => $b['booking_date'],
            'time' => $b['booking_time'],
            'status' => $b['status'],
            'price' => $b['price'],
            'notes' => $b['notes'],
            'isHomeService' => (bool)$b['is_home_service'],
            'address' => $b['address'],
            'paymentProof' => $b['payment_proof_url'],
            'isOnlineConsultation' => (bool)$b['is_online_consultation'],
            'veterinarian' => $b['veterinarian_id'],
            'image_Booking_Concern_Path' => $b['Image_Booking_Concern_Path'],
            'isRegistered' => $b['registered_status'] === 'Registered'
        ];
    }, $bookings);

    echo json_encode($formattedBookings);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['message' => 'Failed to fetch bookings: ' . $e->getMessage()]);
}
