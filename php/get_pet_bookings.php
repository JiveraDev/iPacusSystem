<?php
require_once __DIR__ . '/db.php';

header("Content-Type: application/json");

$petId = $_GET['petId'] ?? null;

if (!$petId) {
    http_response_code(400);
    echo json_encode(['message' => 'Pet ID is required.']);
    exit;
}

try {
    $whereColumn = strpos((string)$petId, 'PET-') === 0 ? 'p.pet_sharable_ID' : 'b.pet_id';

    $stmt = $pdo->prepare("
        SELECT
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
            b.created_at
        FROM bookings b
        LEFT JOIN pets_information p ON b.pet_id = p.pet_id
        WHERE {$whereColumn} = ?
        ORDER BY b.booking_date DESC, b.booking_time DESC, b.created_at DESC
    ");
    $stmt->execute([$petId]);
    $bookings = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $formattedBookings = array_map(function($booking) {
        $serviceName = $booking['service_type'];
        if (!empty($booking['notes'])) {
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
            'createdAt' => $booking['created_at']
        ];
    }, $bookings);

    echo json_encode($formattedBookings);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['message' => 'Failed to fetch pet bookings: ' . $e->getMessage()]);
}
