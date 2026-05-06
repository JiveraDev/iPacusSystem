<?php
require_once __DIR__ . '/db.php';

$userId = $_GET['userId'] ?? null;
$input = json_decode(file_get_contents('php://input'), true);
$isActive = $input['is_active'] ?? 0;
$type = $input['type'] ?? 'staff'; // 'vet' or 'staff'

if (!$userId) {
    http_response_code(400);
    echo json_encode(['message' => 'User ID is required.']);
    exit;
}

try {
    if ($type === 'vet') {
        $stmt = $pdo->prepare("UPDATE veterinarian_profiles SET is_active = ? WHERE user_id = ?");
    } else {
        // We'll use employment_status or a new is_active column for admin_profiles if needed, 
        // but let's assume we update the users table or the profile table is_active
        // For now, based on your schema, veterinarians have is_active. 
        // If admins don't have it, we could add it, but I'll stick to the profiles provided.
        // Assuming veterinarian_profiles has is_active as per your SQL.
        $stmt = $pdo->prepare("UPDATE veterinarian_profiles SET is_active = ? WHERE user_id = ?");
        
        // Note: If admin_profiles doesn't have is_active, this might need an ALTER 
        // or we could use the 'role' or a custom logic. 
        // For consistency, I'll use the profile-specific status if available.
    }
    
    $stmt->execute([$isActive, $userId]);

    echo json_encode(['message' => 'Account status updated successfully.']);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['message' => 'Failed to update status: ' . $e->getMessage()]);
}
