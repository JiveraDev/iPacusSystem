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

function normalizePetIds($petId, $petIds): array
{
    $normalized = [];

    if (is_array($petIds)) {
        foreach ($petIds as $id) {
            if ($id !== null && $id !== '' && is_numeric($id)) {
                $normalized[] = (int)$id;
            }
        }
    }

    if (empty($normalized) && $petId !== null && $petId !== '' && is_numeric($petId)) {
        $normalized[] = (int)$petId;
    }

    return array_values(array_unique($normalized));
}

function normalizeSpecies(?string $species): string
{
    $value = strtolower(trim((string)$species));

    if (str_contains($value, 'dog') || str_contains($value, 'canine')) return 'dog';
    if (str_contains($value, 'cat') || str_contains($value, 'feline')) return 'cat';
    if (str_contains($value, 'bird') || str_contains($value, 'avian')) return 'bird';

    return $value !== '' ? $value : 'unknown';
}

function getSpeciesPetLimit(string $species): int
{
    return match (normalizeSpecies($species)) {
        'dog' => 2,
        'cat', 'bird' => 3,
        default => 3,
    };
}

function getRoomPetLimit(string $roomSize): int
{
    return match ($roomSize) {
        'small' => 1,
        'medium' => 2,
        'large' => 3,
        default => 3,
    };
}

function getSpeciesLabel(string $species): string
{
    return match (normalizeSpecies($species)) {
        'dog' => 'dogs',
        'cat' => 'cats',
        'bird' => 'birds',
        default => 'pets',
    };
}

$input = json_decode(file_get_contents('php://input'), true) ?: [];

$userId = $input['user_id'] ?? null;
$petId = $input['pet_id'] ?? null;
$petIds = normalizePetIds($petId, $input['pet_ids'] ?? []);
$serviceType = $input['service_type'] ?? null;
$bookingDate = $input['booking_date'] ?? null;
$bookingTime = $input['booking_time'] ?? null;
$notes = $input['notes'] ?? null;
$imagePath = $input['Image_Booking_Concern_Path'] ?? null;
$registeredStatus = $input['registered_status'] ?? null;
$petType = $input['petType'] ?? null;

$newPetName = $input['new_pet_name'] ?? null;
$newPetBreed = $input['new_pet_breed'] ?? null;
$newPetAge = $input['new_pet_age'] ?? null;
$newPetWeight = $input['new_pet_weight'] ?? null;

$isHomeService = $input['is_home_service'] ?? 0;
$address = $input['address'] ?? null;
$specificLocation = $input['specific_location'] ?? null;

if ($specificLocation && $address) {
    $address = $address . " | Specific Location: " . $specificLocation;
}

$signaturePath = $input['signature'] ?? null;
$paymentProofUrl = $input['payment_proof_url'] ?? null;
$price = $input['price'] ?? 0;
$transportFee = $input['transport_fee'] ?? 0;

$isOnlineConsultation = $input['is_online_consultation'] ?? 0;
$veterinarianId = $input['veterinarian_id'] ?? null;

$hotelBoardingType = $input['hotel_boarding_type'] ?? null;
$checkInDate = $input['check_in_date'] ?? null;
$checkOutDate = $input['check_out_date'] ?? null;
$roomSize = $input['room_size'] ?? null;
$addOns = $input['add_ons'] ?? null;
$emergencyContact = $input['emergency_contact'] ?? null;
$isHotelBoarding = $serviceType === 'boarding' && in_array($hotelBoardingType, ['hotel', 'boarding'], true);

if ($isHotelBoarding) {
    $bookingDate = $bookingDate ?: $checkInDate;
    $bookingTime = $bookingTime ?: '09:00:00';
}

if (!$userId || !$serviceType || !$bookingDate || !$bookingTime) {
    http_response_code(400);
    echo json_encode(['message' => 'Missing required booking information.']);
    exit;
}

if ($isHotelBoarding) {
    if (empty($petIds)) {
        http_response_code(400);
        echo json_encode(['message' => 'Please select at least one pet for hotel or boarding.']);
        exit;
    }

    if (!$checkInDate || !$checkOutDate || !$roomSize || !$emergencyContact) {
        http_response_code(400);
        echo json_encode(['message' => 'Missing hotel or boarding stay details.']);
        exit;
    }

    if (strtotime($checkOutDate) <= strtotime($checkInDate)) {
        http_response_code(400);
        echo json_encode(['message' => 'Check-out date must be after check-in date.']);
        exit;
    }

    if (!in_array($roomSize, ['small', 'medium', 'large'], true)) {
        http_response_code(400);
        echo json_encode(['message' => 'Invalid room size.']);
        exit;
    }

    $roomPetLimit = getRoomPetLimit($roomSize);
    if (count($petIds) > $roomPetLimit) {
        http_response_code(400);
        echo json_encode(['message' => "The selected room or kennel allows only {$roomPetLimit} pet" . ($roomPetLimit === 1 ? "." : "s.")]);
        exit;
    }

    $petPlaceholders = implode(',', array_fill(0, count($petIds), '?'));
    $petStmt = $pdo->prepare("
        SELECT pet_id, pet_species
        FROM pets_information
        WHERE pet_id IN ({$petPlaceholders})
    ");
    $petStmt->execute($petIds);
    $selectedPets = $petStmt->fetchAll(PDO::FETCH_ASSOC);

    if (count($selectedPets) !== count($petIds)) {
        http_response_code(400);
        echo json_encode(['message' => 'One or more selected pets could not be found.']);
        exit;
    }

    $selectedSpecies = array_values(array_unique(array_map(function ($pet) {
        return normalizeSpecies($pet['pet_species'] ?? '');
    }, $selectedPets)));

    if (count($selectedSpecies) > 1) {
        http_response_code(400);
        echo json_encode(['message' => 'Pet hotel and boarding bookings must use pets of the same species only.']);
        exit;
    }

    $speciesLimit = getSpeciesPetLimit($selectedSpecies[0] ?? 'unknown');
    if (count($petIds) > $speciesLimit) {
        $speciesLabel = getSpeciesLabel($selectedSpecies[0] ?? 'unknown');
        http_response_code(400);
        echo json_encode(['message' => "Maximum {$speciesLimit} {$speciesLabel} allowed per hotel or boarding booking."]);
        exit;
    }

    if (!tableExists($pdo, 'rooms')) {
        http_response_code(500);
        echo json_encode(['message' => 'Room capacity table is missing. Run php/rooms_setup.sql first.']);
        exit;
    }
}

try {
    $pdo->beginTransaction();

    if ($isHotelBoarding) {
        $roomType = $hotelBoardingType . '-' . $roomSize;
        $capacityStmt = $pdo->prepare("
            SELECT COALESCE(SUM(total_capacity), 0)
            FROM rooms
            WHERE room_type = ?
        ");
        $capacityStmt->execute([$roomType]);
        $totalCapacity = (int)$capacityStmt->fetchColumn();

        if ($totalCapacity <= 0) {
            $pdo->rollBack();
            http_response_code(409);
            echo json_encode(['message' => 'Selected room or kennel type is not configured.']);
            exit;
        }

        $bookedStmt = $pdo->prepare("
            SELECT COUNT(*)
            FROM bookings
            WHERE service_type = 'boarding'
              AND hotel_boarding_type = ?
              AND room_size = ?
              AND check_in_date < ?
              AND check_out_date > ?
              AND status IN ('pending', 'confirmed')
        ");
        $bookedStmt->execute([$hotelBoardingType, $roomSize, $checkOutDate, $checkInDate]);
        $bookedCount = (int)$bookedStmt->fetchColumn();

        if ($bookedCount >= $totalCapacity) {
            $pdo->rollBack();
            http_response_code(409);
            echo json_encode(['message' => 'No rooms or kennels are available for the selected dates.']);
            exit;
        }
    }

    $bookingNumber = 'BK-' . strtoupper(bin2hex(random_bytes(4)));
    $primaryPetId = $petIds[0] ?? ($petId ?: null);
    $addOnsValue = is_array($addOns) ? json_encode(array_values($addOns)) : $addOns;

    $stmt = $pdo->prepare("
        INSERT INTO bookings (
            user_id,
            pet_id,
            booking_number,
            service_type,
            booking_date,
            booking_time,
            notes,
            Image_Booking_Concern_Path,
            registered_status,
            petType,
            unregistered_pet_name,
            unregistered_pet_breed,
            unregistered_pet_age,
            unregistered_pet_weight,
            status,
            is_home_service,
            address,
            signature_path,
            payment_proof_url,
            is_online_consultation,
            veterinarian_id,
            price,
            transport_fee,
            check_in_date,
            check_out_date,
            room_size,
            add_ons,
            emergency_contact,
            hotel_boarding_type,
            created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    ");

    $stmt->execute([
        $userId,
        $primaryPetId ?: null,
        $bookingNumber,
        $serviceType,
        $bookingDate,
        $bookingTime,
        $notes,
        $imagePath,
        $registeredStatus,
        $petType,
        $newPetName,
        $newPetBreed,
        $newPetAge,
        $newPetWeight,
        'pending',
        $isHomeService,
        $address,
        $signaturePath,
        $paymentProofUrl,
        $isOnlineConsultation,
        $veterinarianId,
        $price,
        $transportFee,
        $checkInDate,
        $checkOutDate,
        $roomSize,
        $addOnsValue,
        $emergencyContact,
        $hotelBoardingType,
    ]);

    $bookingId = (int)$pdo->lastInsertId();

    if (!empty($petIds) && tableExists($pdo, 'booking_pets')) {
        $petStmt = $pdo->prepare("
            INSERT IGNORE INTO booking_pets (booking_id, pet_id)
            VALUES (?, ?)
        ");

        foreach ($petIds as $selectedPetId) {
            $petStmt->execute([$bookingId, $selectedPetId]);
        }
    }

    $pdo->commit();

    echo json_encode([
        'message' => 'Booking created successfully.',
        'booking_id' => $bookingId,
        'booking_number' => $bookingNumber,
    ]);
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    http_response_code(500);
    echo json_encode(['message' => 'Failed to create booking: ' . $e->getMessage()]);
}
