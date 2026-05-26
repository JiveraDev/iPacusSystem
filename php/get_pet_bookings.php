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

$petId = $_GET['petId'] ?? null;

if (!$petId) {
    http_response_code(400);
    echo json_encode(['message' => 'Pet ID is required.']);
    exit;
}

try {
    $hasBookingPets = tableExists($pdo, 'booking_pets');
    $whereColumn = strpos((string)$petId, 'PET-') === 0 ? 'p.pet_sharable_ID' : 'b.pet_id';
    $bookingPetJoin = $hasBookingPets ? "LEFT JOIN booking_pets bp ON bp.booking_id = b.booking_id" : "";
    $secondaryPetCondition = $hasBookingPets && strpos((string)$petId, 'PET-') !== 0 ? " OR bp.pet_id = ?" : "";
    $params = [$petId];
    if ($secondaryPetCondition) {
        $params[] = $petId;
    }

    $stmt = $pdo->prepare("
        SELECT DISTINCT
            b.booking_id,
            b.booking_number,
            b.pet_id,
            b.service_type,
            b.booking_date,
            b.booking_time,
            b.status,
            b.price,
            b.notes,
            b.is_home_service,
            b.is_online_consultation,
            b.hotel_boarding_type,
            b.check_in_date,
            b.check_out_date,
            b.room_size,
            b.add_ons,
            b.emergency_contact,
            b.created_at
        FROM bookings b
        LEFT JOIN pets_information p ON b.pet_id = p.pet_id
        {$bookingPetJoin}
        WHERE {$whereColumn} = ?{$secondaryPetCondition}
        ORDER BY b.booking_date DESC, b.booking_time DESC, b.created_at DESC
    ");
    $stmt->execute($params);
    $bookings = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $formattedBookings = array_map(function($booking) {
        $serviceName = $booking['service_type'];
        $addOns = null;
        if (!empty($booking['add_ons'])) {
            $decodedAddOns = json_decode($booking['add_ons'], true);
            $addOns = json_last_error() === JSON_ERROR_NONE ? $decodedAddOns : $booking['add_ons'];
        }
        if ($booking['service_type'] === 'boarding' && !empty($booking['hotel_boarding_type'])) {
            $serviceName = $booking['hotel_boarding_type'] === 'hotel' ? 'Pet Hotel' : 'Pet Boarding';
            if (!empty($booking['room_size'])) {
                $serviceName .= ' - ' . ucfirst($booking['room_size']);
            }
        } elseif (!empty($booking['notes'])) {
            if ((bool)$booking['is_home_service'] && preg_match('/\[Services: (.*?)\]/', $booking['notes'], $matches)) {
                $serviceName = $matches[1];
            } elseif ((bool)$booking['is_online_consultation'] && preg_match('/\[Topic: (.*?)\]/', $booking['notes'], $matches)) {
                $serviceName = $matches[1];
            }
        }

        return [
            'id' => $booking['booking_id'],
            'bookingNumber' => $booking['booking_number'],
            'petId' => $booking['pet_id'],
            'type' => $booking['service_type'],
            'service' => $serviceName,
            'date' => $booking['booking_date'],
            'time' => $booking['booking_time'],
            'status' => $booking['status'],
            'price' => $booking['price'],
            'hotelBoardingType' => $booking['hotel_boarding_type'] ?? null,
            'checkInDate' => $booking['check_in_date'] ?? null,
            'checkOutDate' => $booking['check_out_date'] ?? null,
            'roomSize' => $booking['room_size'] ?? null,
            'addOns' => $addOns,
            'emergencyContact' => $booking['emergency_contact'] ?? null,
            'createdAt' => $booking['created_at']
        ];
    }, $bookings);

    echo json_encode($formattedBookings);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['message' => 'Failed to fetch pet bookings: ' . $e->getMessage()]);
}
