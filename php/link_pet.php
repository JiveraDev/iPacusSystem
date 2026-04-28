<?php
require_once __DIR__ . '/db.php';

$input = json_decode(file_get_contents('php://input'), true);

$userId = $input['userId'] ?? null;
$sharableId = $input['sharableId'] ?? null;

if (!$userId || !$sharableId) {
    http_response_code(400);
    echo json_encode(['message' => 'User ID and Pet Sharable ID are required.']);
    exit;
}

try {
    $pdo->beginTransaction();

    // 1. Find pet by sharableId
    $stmt = $pdo->prepare("SELECT pet_id FROM pets_information WHERE pet_sharable_ID = ? LIMIT 1");
    $stmt->execute([$sharableId]);
    $pet = $stmt->fetch();

    if (!$pet) {
        $pdo->rollBack();
        http_response_code(404);
        echo json_encode(['message' => 'Pet not found with the provided ID.']);
        exit;
    }

    $petId = $pet['pet_id'];

    // 2. Check if already linked
    $stmt = $pdo->prepare("SELECT link_id FROM pet_ownership WHERE user_id = ? AND pet_id = ? LIMIT 1");
    $stmt->execute([$userId, $petId]);
    if ($stmt->fetch()) {
        $pdo->rollBack();
        http_response_code(409);
        echo json_encode(['message' => 'This pet is already linked to your account.']);
        exit;
    }

    // 3. Link pet
    $stmt = $pdo->prepare("INSERT INTO pet_ownership (user_id, pet_id) VALUES (?, ?)");
    $stmt->execute([$userId, $petId]);

    // 4. Update the pet_Temp_owner in pets_information with the name of the claimant
    // First, fetch the user's full name
    $stmtUser = $pdo->prepare("SELECT first_Name, last_Name FROM users WHERE user_id = ? LIMIT 1");
    $stmtUser->execute([$userId]);
    $user = $stmtUser->fetch();

    if ($user) {
        $fullName = trim($user['first_Name'] . ' ' . $user['last_Name']);
        
        // Update the temporary owner field to reflect the actual owner who claimed the pet
        $stmtUpdatePet = $pdo->prepare("UPDATE pets_information SET pet_Temp_owner = ? WHERE pet_id = ?");
        $stmtUpdatePet->execute([$fullName, $petId]);
    }

    $pdo->commit();

    echo json_encode([
        'message' => 'Pet linked successfully.',
        'ownerName' => $fullName ?? null
    ]);

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['message' => 'Failed to link pet: ' . $e->getMessage()]);
}
