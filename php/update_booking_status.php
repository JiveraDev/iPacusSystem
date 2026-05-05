<?php
require_once __DIR__ . '/db.php';

header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] !== 'PATCH') {
    http_response_code(405);
    echo json_encode(['message' => 'Method not allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$bookingId = $_GET['bookingId'] ?? null;
$status = $input['status'] ?? null;

if (!$bookingId || !$status) {
    http_response_code(400);
    echo json_encode(['message' => 'Booking ID and Status are required.']);
    exit;
}

try {
    $stmt = $pdo->prepare("UPDATE bookings SET status = ? WHERE booking_id = ?");
    $stmt->execute([$status, $bookingId]);

    echo json_encode(['message' => 'Booking status updated successfully.']);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['message' => 'Failed to update booking status: ' . $e->getMessage()]);
}
