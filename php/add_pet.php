<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/pet_allergy_helpers.php';
require_once __DIR__ . '/workflow_guard_helpers.php';

// Get JSON input
$input = json_decode(file_get_contents('php://input'), true);

$petName = $input['petName'] ?? null;
$species = $input['species'] ?? null;
$breed = $input['breed'] ?? null;
$birthDate = $input['birthDate'] ?? null;
$gender = $input['gender'] ?? null;
$status = $input['status'] ?? 'Healthy';
$microchipNumber = preg_replace('/\D+/', '', (string)($input['microchipNumber'] ?? ''));
if ($microchipNumber !== (string)($input['microchipNumber'] ?? '') || strlen($microchipNumber) > 15) {
    ipawcus_guard_error(422, 'Microchip number must contain no more than 15 digits.');
}
$microchipNumber = $microchipNumber !== '' ? $microchipNumber : null;
$currentApiUser = ipawcus_guard_current_user($pdo);
$currentApiRole = ipawcus_guard_role($currentApiUser);
$currentApiUserId = ipawcus_guard_user_id($currentApiUser);
$requestedUserId = $input['userId'] ?? null;
$bookingId = $input['bookingId'] ?? null;

if (!in_array($currentApiRole, ['pet_owner', 'admin', 'super_admin'], true)) {
    ipawcus_guard_error(403, 'You are not allowed to register pets.');
}

if ($requestedUserId !== null && $requestedUserId !== '' && (!is_numeric($requestedUserId) || (int)$requestedUserId <= 0)) {
    ipawcus_guard_error(400, 'A valid user ID is required.');
}
if ($bookingId !== null && $bookingId !== '' && (!is_numeric($bookingId) || (int)$bookingId <= 0)) {
    ipawcus_guard_error(400, 'A valid booking ID is required.');
}

$userId = $requestedUserId !== null && $requestedUserId !== '' ? (int)$requestedUserId : null;
$bookingId = $bookingId !== null && $bookingId !== '' ? (int)$bookingId : null;
if ($currentApiRole === 'pet_owner') {
    if ($userId !== null && $userId !== $currentApiUserId) {
        ipawcus_guard_error(403, 'You can only register pets under your own account.');
    }
    $userId = $currentApiUserId;

}

if ($bookingId !== null) {
    $bookingOwnerStmt = $pdo->prepare("
        SELECT user_id, pet_id
        FROM bookings
        WHERE booking_id = ?
        LIMIT 1
    ");
    $bookingOwnerStmt->execute([$bookingId]);
    $bookingContext = $bookingOwnerStmt->fetch(PDO::FETCH_ASSOC);
    if (!$bookingContext) {
        ipawcus_guard_error(404, 'Booking was not found.');
    }

    $bookingOwnerId = (int)$bookingContext['user_id'];
    if ($currentApiRole === 'pet_owner' && $bookingOwnerId !== $currentApiUserId) {
        ipawcus_guard_error(403, 'You can only link a pet to your own booking.');
    }
    if ($userId === null) {
        $userId = $bookingOwnerId;
    } elseif ($userId !== $bookingOwnerId) {
        ipawcus_guard_error(409, 'The selected owner does not match the booking owner.');
    }
    if ((int)($bookingContext['pet_id'] ?? 0) > 0) {
        ipawcus_guard_error(409, 'This booking is already linked to a registered pet.');
    }
}

if ($userId !== null) {
    $userExistsStmt = $pdo->prepare("SELECT user_id FROM users WHERE user_id = ? LIMIT 1");
    $userExistsStmt->execute([$userId]);
    if (!$userExistsStmt->fetchColumn()) {
        ipawcus_guard_error(404, 'Pet owner account was not found.');
    }
}

if (!$petName || !$species || !$breed || !$birthDate || !$gender) {
    http_response_code(400);
    echo json_encode(['message' => 'Missing required pet fields.']);
    exit;
}

try {
    $pdo->beginTransaction();

    // 1. Initial Insert (without the sharable ID)
    $sql = "INSERT INTO pets_information 
                (pet_name, pet_species, pet_breed, pet_BDAY, pet_gender, pet_status, pet_age, pet_weight, pet_microchip, pet_Temp_owner, pet_allergies, pet_color_marking, setpetImage_url) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        $petName,
        $species,
        $breed,
        $birthDate,
        $gender,
        $status,
        $input['age'] ?? null,
        $input['weight'] ?? 0,
        $microchipNumber,
        $input['tempOwnerName'] ?? null,
        $input['allergies'] ?? null,
        $input['colorMarkings'] ?? null,
        $input['profileImage'] ?? null
    ]);

    $petId = (int)$pdo->lastInsertId();

    // Keep the normalized allergy records authoritative while preserving the
    // legacy summary column used by existing booking and queue callers.
    pet_allergy_merge_from_legacy(
        $pdo,
        $petId,
        $input['allergies'] ?? null,
        $currentApiUserId,
        'registration'
    );

    // 2. Generate the simplified Sharable ID using the auto-increment ID
    // Format: PET-{pet_id}-IPAWCUS
    $sharableId = "PET-$petId-IPAWCUS";

    // 3. Update the record with the new ID
    $updateStmt = $pdo->prepare("UPDATE pets_information SET pet_sharable_ID = ? WHERE pet_id = ?");
    $updateStmt->execute([$sharableId, $petId]);

    // 4. Insert history
    $sqlHistory = "INSERT INTO history_before_registration (current_medication, veterinarian_notes, pet_id, last_visit_Date) VALUES (?, ?, ?, ?)";
    $stmtHistory = $pdo->prepare($sqlHistory);
    $stmtHistory->execute([
        $input['currentMedication'] ?? null,
        $input['veterinarianNotes'] ?? null,
        $petId,
        $input['lastVisitDate'] ?? null
    ]);

    // 5. Auto-link to user if userId is provided
    if ($userId) {
        $stmtOwnership = $pdo->prepare("INSERT INTO pet_ownership (user_id, pet_id) VALUES (?, ?)");
        $stmtOwnership->execute([$userId, $petId]);

        // Update pet_Temp_owner to the actual owner's name
        $stmtUser = $pdo->prepare("SELECT first_Name, last_Name FROM users WHERE user_id = ? LIMIT 1");
        $stmtUser->execute([$userId]);
        $user = $stmtUser->fetch();
        if ($user) {
            $fullName = trim($user['first_Name'] . ' ' . $user['last_Name']);
            $stmtUpdatePet = $pdo->prepare("UPDATE pets_information SET pet_Temp_owner = ? WHERE pet_id = ?");
            $stmtUpdatePet->execute([$fullName, $petId]);
        }
    }

    // 6. If this pet came from an unregistered booking, link that booking now.
    if ($bookingId) {
        $sqlBookingUpdate = "UPDATE bookings
                             SET pet_id = ?, registered_status = 'Registered'
                             WHERE booking_id = ?
                               AND pet_id IS NULL";
        $bookingParams = [$petId, $bookingId];

        if ($userId) {
            $sqlBookingUpdate .= " AND user_id = ?";
            $bookingParams[] = $userId;
        }

        $stmtBooking = $pdo->prepare($sqlBookingUpdate);
        $stmtBooking->execute($bookingParams);

        if ($stmtBooking->rowCount() === 0) {
            throw new DomainException('The booking was linked or changed by another request. No pet was registered.');
        }
    }

    $pdo->commit();

    http_response_code(201);
    echo json_encode([
        'id' => $petId,
        'sharableId' => $sharableId,
        'message' => 'Pet registered successfully.'
    ]);

} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    $statusCode = $e instanceof DomainException ? 409 : 500;
    http_response_code($statusCode);
    echo json_encode([
        'message' => $statusCode === 409
            ? $e->getMessage()
            : 'Failed to register pet.',
    ]);
}
