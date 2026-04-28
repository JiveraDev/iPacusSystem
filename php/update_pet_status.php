<?php
require_once __DIR__ . '/db.php';

$petId = $_GET['petId'] ?? null;

if (!$petId) {
    http_response_code(400);
    echo json_encode(['message' => 'Pet ID is required.']);
    exit;
}

// Get JSON input
$input = json_decode(file_get_contents('php://input'), true);
$newStatus = $input['status'] ?? null;

if (!$newStatus) {
    http_response_code(400);
    echo json_encode(['message' => 'Status is required.']);
    exit;
}

try {
    // The frontend sends the Sharable ID (e.g., PET-2-IPAWCUS)
    // We update based on that column.
    $stmt = $pdo->prepare("UPDATE pets_information SET pet_status = ? WHERE pet_sharable_ID = ?");
    $stmt->execute([$newStatus, $petId]);

    if ($stmt->rowCount() === 0) {
        // Fallback: try updating by the numeric ID just in case
        $stmt = $pdo->prepare("UPDATE pets_information SET pet_status = ? WHERE pet_id = ?");
        $stmt->execute([$newStatus, $petId]);
    }

    echo json_encode(['message' => 'Pet status updated successfully.']);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['message' => 'Failed to update pet status: ' . $e->getMessage()]);
}
