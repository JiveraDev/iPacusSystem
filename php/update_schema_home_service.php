<?php
require_once __DIR__ . '/db.php';

try {
    // 1. Add signature_path column
    $pdo->exec("ALTER TABLE bookings ADD COLUMN IF NOT EXISTS signature_path TEXT DEFAULT NULL AFTER Image_Booking_Concern_Path");
    
    // 2. Add transport_fee column (optional, but good for tracking)
    $pdo->exec("ALTER TABLE bookings ADD COLUMN IF NOT EXISTS transport_fee DECIMAL(10, 2) DEFAULT 0.00 AFTER price");

    echo json_encode(['message' => 'Database schema updated successfully for Home Services.']);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['message' => 'Failed to update database schema: ' . $e->getMessage()]);
}
