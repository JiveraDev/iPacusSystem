<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/notification_helpers.php';

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

function columnExists(PDO $pdo, string $tableName, string $columnName): bool
{
    $stmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = ?
          AND column_name = ?
    ");
    $stmt->execute([$tableName, $columnName]);

    return (int)$stmt->fetchColumn() > 0;
}

function jsonColumnValue($value): ?string
{
    if ($value === null) {
        return null;
    }

    $encoded = json_encode($value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

    if ($encoded === false) {
        throw new Exception('Invalid JSON payload.');
    }

    return $encoded;
}

function specialServiceDateColumnsExist(PDO $pdo): bool
{
    return columnExists($pdo, 'special_service_catalog', 'date_restriction_type')
        && columnExists($pdo, 'special_service_catalog', 'date_start')
        && columnExists($pdo, 'special_service_catalog', 'date_end');
}

function resolvePetId(PDO $pdo, $id): ?int
{
    if ($id === null || $id === '') {
        return null;
    }

    $value = trim((string)$id);
    if ($value === '') {
        return null;
    }

    if (is_numeric($value)) {
        $stmt = $pdo->prepare("SELECT pet_id FROM pets_information WHERE pet_id = ? LIMIT 1");
        $stmt->execute([(int)$value]);
        $resolvedId = $stmt->fetchColumn();
        if ($resolvedId !== false) {
            return (int)$resolvedId;
        }
    }

    $stmt = $pdo->prepare("SELECT pet_id FROM pets_information WHERE pet_sharable_ID = ? LIMIT 1");
    $stmt->execute([$value]);
    $resolvedId = $stmt->fetchColumn();

    return $resolvedId !== false ? (int)$resolvedId : null;
}

function normalizePetIds(PDO $pdo, $petId, $petIds): array
{
    $normalized = [];

    if (is_array($petIds)) {
        foreach ($petIds as $id) {
            $resolvedId = resolvePetId($pdo, $id);
            if ($resolvedId !== null) {
                $normalized[] = $resolvedId;
            }
        }
    }

    if (empty($normalized)) {
        $resolvedId = resolvePetId($pdo, $petId);
        if ($resolvedId !== null) {
            $normalized[] = $resolvedId;
        }
    }

    return array_values(array_unique($normalized));
}

function isDeceasedPetStatus(?string $status): bool
{
    $normalized = strtolower(trim((string)$status));
    return in_array($normalized, ['deceased', 'dead'], true);
}

function getDeceasedPetNames(PDO $pdo, array $petIds): array
{
    if (empty($petIds)) {
        return [];
    }

    $placeholders = implode(',', array_fill(0, count($petIds), '?'));
    $stmt = $pdo->prepare("
        SELECT pet_name, pet_status
        FROM pets_information
        WHERE pet_id IN ({$placeholders})
    ");
    $stmt->execute($petIds);

    $deceasedPets = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $pet) {
        if (isDeceasedPetStatus($pet['pet_status'] ?? null)) {
            $deceasedPets[] = $pet['pet_name'] ?: 'Selected pet';
        }
    }

    return $deceasedPets;
}

function normalizeSpecies(?string $species): string
{
    $value = strtolower(trim((string)$species));

    if (str_contains($value, 'dog') || str_contains($value, 'canine')) return 'dog';
    if (str_contains($value, 'cat') || str_contains($value, 'feline')) return 'cat';
    if (str_contains($value, 'bird') || str_contains($value, 'avian')) return 'bird';

    return $value !== '' ? $value : 'unknown';
}

function normalizeBookingTime($time): ?string
{
    $value = trim((string)$time);
    if ($value === '') {
        return null;
    }

    $formats = ['g:i A', 'h:i A', 'g:i a', 'h:i a', 'H:i:s', 'H:i'];
    foreach ($formats as $format) {
        $date = DateTime::createFromFormat('!' . $format, $value);
        $errors = DateTime::getLastErrors();
        $hasErrors = is_array($errors) && ($errors['warning_count'] > 0 || $errors['error_count'] > 0);

        if ($date && !$hasErrors) {
            return $date->format('H:i:s');
        }
    }

    return null;
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

function hasActiveOnlineConsultation(PDO $pdo, int $petId): bool
{
    if ($petId <= 0) {
        return false;
    }

    if (tableExists($pdo, 'booking_pets')) {
        $stmt = $pdo->prepare("
            SELECT COUNT(*)
            FROM bookings b
            LEFT JOIN booking_pets bp ON bp.booking_id = b.booking_id
            WHERE b.is_online_consultation = 1
              AND bp.pet_id = ?
              AND b.status IN ('pending', 'confirmed')
        ");
        $stmt->execute([$petId]);
        return (int)$stmt->fetchColumn() > 0;
    }

    $stmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM bookings
        WHERE is_online_consultation = 1
          AND pet_id = ?
          AND status IN ('pending', 'confirmed')
    ");
    $stmt->execute([$petId]);

    return (int)$stmt->fetchColumn() > 0;
}

function getSpecialServiceBookedPetCount(PDO $pdo, int $specialServiceId): int
{
    if (!tableExists($pdo, 'special_service_booking_items')) {
        return 0;
    }

    $hasBookingPets = tableExists($pdo, 'booking_pets');
    $bookingPetsJoin = $hasBookingPets
        ? "LEFT JOIN (
                SELECT booking_id, COUNT(*) AS pet_count
                FROM booking_pets
                GROUP BY booking_id
           ) bp ON bp.booking_id = b.booking_id"
        : '';
    $petCountExpression = $hasBookingPets
        ? "CASE
                WHEN COALESCE(bp.pet_count, 0) > 0 THEN bp.pet_count
                WHEN b.unregistered_pet_name IS NOT NULL AND TRIM(b.unregistered_pet_name) <> '' THEN 1
                WHEN b.pet_id IS NOT NULL THEN 1
                ELSE 0
           END"
        : "CASE
                WHEN b.unregistered_pet_name IS NOT NULL AND TRIM(b.unregistered_pet_name) <> '' THEN 1
                WHEN b.pet_id IS NOT NULL THEN 1
                ELSE 0
           END";

    $stmt = $pdo->prepare("
        SELECT COALESCE(SUM({$petCountExpression}), 0)
        FROM special_service_booking_items sbi
        JOIN bookings b ON b.booking_id = sbi.booking_id
        {$bookingPetsJoin}
        WHERE sbi.special_service_id = ?
          AND b.status <> 'cancelled'
    ");
    $stmt->execute([$specialServiceId]);

    return (int)$stmt->fetchColumn();
}

function isSpecialServiceDateAllowed(array $service, string $bookingDate): bool
{
    $restrictionType = $service['date_restriction_type'] ?? 'none';
    $dateStart = $service['date_start'] ?? null;
    $dateEnd = $service['date_end'] ?? null;

    if ($restrictionType === 'none' || $restrictionType === '' || $restrictionType === null) {
        return true;
    }

    if ($restrictionType === 'single') {
        return $dateStart && $bookingDate === $dateStart;
    }

    if ($restrictionType === 'range') {
        return $dateStart && $dateEnd && $bookingDate >= $dateStart && $bookingDate <= $dateEnd;
    }

    return true;
}

function getSpecialServiceDateRestrictionMessage(array $service): string
{
    $title = $service['service_title'] ?? 'This special service';
    $restrictionType = $service['date_restriction_type'] ?? 'none';
    $dateStart = $service['date_start'] ?? null;
    $dateEnd = $service['date_end'] ?? null;

    if ($restrictionType === 'single' && $dateStart) {
        return "{$title} is only available on {$dateStart}.";
    }

    if ($restrictionType === 'range' && $dateStart && $dateEnd) {
        return "{$title} is only available from {$dateStart} to {$dateEnd}.";
    }

    return "{$title} is not available on the selected date.";
}

function hasVetSlotConflict(PDO $pdo, int $veterinarianId, string $bookingDate, string $bookingTime): bool
{
    if ($veterinarianId <= 0 || $bookingDate === '' || $bookingTime === '') {
        return false;
    }

    $stmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM bookings
        WHERE is_online_consultation = 1
          AND veterinarian_id = ?
          AND booking_date = ?
          AND booking_time = ?
          AND status IN ('pending', 'confirmed')
    ");
    $stmt->execute([$veterinarianId, $bookingDate, $bookingTime]);

    return (int)$stmt->fetchColumn() > 0;
}

function normalizeSpecialServiceItemIds($items): array
{
    if (!is_array($items)) {
        return [];
    }

    $normalized = [];
    foreach ($items as $item) {
        $candidate = $item;
        if (is_array($item)) {
            $candidate = $item['special_service_id'] ?? $item['id'] ?? $item['service_id'] ?? null;
        }

        if ($candidate === null || $candidate === '') {
            continue;
        }

        if (is_numeric($candidate)) {
            $normalized[] = (int)$candidate;
        }
    }

    return array_values(array_unique($normalized));
}

$input = json_decode(file_get_contents('php://input'), true) ?: [];

$userId = $input['user_id'] ?? null;
$petId = $input['pet_id'] ?? null;
$petIds = normalizePetIds($pdo, $petId, $input['pet_ids'] ?? []);
$serviceType = $input['service_type'] ?? null;
$bookingDate = $input['booking_date'] ?? null;
$bookingTime = $input['booking_time'] ?? null;
$notes = $input['notes'] ?? null;
$imagePath = $input['Image_Booking_Concern_Path'] ?? null;
$registeredStatus = $input['registered_status'] ?? null;
$petType = $input['petType'] ?? null;
$specialServiceItemIds = normalizeSpecialServiceItemIds($input['special_service_items'] ?? []);

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

$signaturePath = $input['signature'] ?? $input['signature_path'] ?? $input['consent_signature_path'] ?? null;
$consentForms = $input['consent_forms'] ?? $input['consentForms'] ?? null;
$consentStatus = trim((string)($input['consent_status'] ?? $input['consentStatus'] ?? ''));
$consentStatus = $consentStatus !== '' ? $consentStatus : ($signaturePath ? 'signed' : null);
$paymentProofUrl = $input['payment_proof_url'] ?? null;
$allowedPaymentMethods = ['qrph', 'maya', 'gcash', 'bank_transfer'];
$paymentMethod = strtolower(trim((string)($input['payment_method'] ?? $input['paymentMethod'] ?? '')));
if (!in_array($paymentMethod, $allowedPaymentMethods, true)) {
    $paymentMethod = null;
}
$paymentReference = trim((string)($input['payment_reference'] ?? $input['paymentReference'] ?? ''));
$paymentReference = $paymentReference !== '' ? $paymentReference : null;
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

if ($isHotelBoarding && !$signaturePath) {
    http_response_code(400);
    echo json_encode(['message' => 'Pet hotel and boarding bookings require a signed liability consent before payment or activation.']);
    exit;
}

$bookingTime = normalizeBookingTime($bookingTime);

if (!$userId || !$serviceType || !$bookingDate || !$bookingTime) {
    http_response_code(400);
    echo json_encode(['message' => 'Missing required booking information.']);
    exit;
}

if ((int)$isOnlineConsultation === 1 && (!$veterinarianId || !is_numeric($veterinarianId))) {
    http_response_code(400);
    echo json_encode(['message' => 'Please select a veterinarian for online consultation.']);
    exit;
}

if ((int)$isOnlineConsultation === 1 && is_numeric($veterinarianId)) {
    $normalizedVetId = (int)$veterinarianId;
    if (hasVetSlotConflict($pdo, $normalizedVetId, (string)$bookingDate, (string)$bookingTime)) {
        http_response_code(409);
        echo json_encode(['message' => 'The selected consultation date and time is already booked. Please choose another available slot.']);
        exit;
    }
}

if ($registeredStatus === 'Registered' && empty($petIds)) {
    http_response_code(400);
    echo json_encode(['message' => 'The selected pet could not be found. Please go back and choose the pet again.']);
    exit;
}

$deceasedPetNames = getDeceasedPetNames($pdo, $petIds);
if (!empty($deceasedPetNames)) {
    http_response_code(400);
    $uniqueDeceasedPetNames = array_unique($deceasedPetNames);
    $petList = implode(', ', $uniqueDeceasedPetNames);
    echo json_encode(['message' => "Cannot create booking for deceased pet" . (count($uniqueDeceasedPetNames) === 1 ? "" : "s") . ": {$petList}."]);
    exit;
}

if ((int)$isOnlineConsultation === 1 && !empty($petIds)) {
    $consultPetId = (int)$petIds[0];

    if (hasActiveOnlineConsultation($pdo, $consultPetId)) {
        http_response_code(409);
        echo json_encode(['message' => 'This pet already has an active online consultation booking. Please cancel or complete the existing booking first.']);
        exit;
    }
}

if ($serviceType === 'special services') {
    if (!tableExists($pdo, 'special_service_catalog')) {
        http_response_code(500);
        echo json_encode(['message' => 'Special service catalog is missing.']);
        exit;
    }

    if (empty($specialServiceItemIds)) {
        http_response_code(400);
        echo json_encode(['message' => 'Please select at least one special service.']);
        exit;
    }

    $bookingPetCount = !empty($petIds) ? count($petIds) : ((!empty($newPetName) && $registeredStatus === 'Not Registered') ? 1 : 0);
    if ($bookingPetCount <= 0) {
        http_response_code(400);
        echo json_encode(['message' => 'Please select a pet or add new pet information for special services booking.']);
        exit;
    }

    $dateColumnsAvailable = specialServiceDateColumnsExist($pdo);
    $dateSelect = $dateColumnsAvailable
        ? ', date_restriction_type, date_start, date_end'
        : ", 'none' AS date_restriction_type, NULL AS date_start, NULL AS date_end";
    $placeholderList = implode(',', array_fill(0, count($specialServiceItemIds), '?'));
    $catalogStmt = $pdo->prepare("
        SELECT special_service_id, service_title, max_pets, is_active{$dateSelect}
        FROM special_service_catalog
        WHERE special_service_id IN ({$placeholderList})
    ");
    $catalogStmt->execute($specialServiceItemIds);
    $selectedSpecialServices = $catalogStmt->fetchAll(PDO::FETCH_ASSOC);

    if (count($selectedSpecialServices) !== count($specialServiceItemIds)) {
        http_response_code(400);
        echo json_encode(['message' => 'One or more special service selections are invalid.']);
        exit;
    }

    foreach ($selectedSpecialServices as $selectedService) {
        if ((int)$selectedService['is_active'] !== 1) {
            http_response_code(400);
            echo json_encode(['message' => 'One or more selected special services is inactive.']);
            exit;
        }

        if (!isSpecialServiceDateAllowed($selectedService, $bookingDate)) {
            http_response_code(400);
            echo json_encode(['message' => getSpecialServiceDateRestrictionMessage($selectedService)]);
            exit;
        }
    }

    $maxAllowedPets = min(array_map(function ($item) {
        return max(1, (int)($item['max_pets'] ?? 1));
    }, $selectedSpecialServices));

    if ($bookingPetCount > $maxAllowedPets) {
        http_response_code(400);
        echo json_encode(['message' => "The selected special services allow only {$maxAllowedPets} pet" . ($maxAllowedPets === 1 ? '' : 's') . " per booking."]);
        exit;
    }

    foreach ($selectedSpecialServices as $selectedService) {
        $capacity = max(1, (int)($selectedService['max_pets'] ?? 1));
        $bookedPets = getSpecialServiceBookedPetCount($pdo, (int)$selectedService['special_service_id']);
        $remainingSlots = max(0, $capacity - $bookedPets);

        if ($remainingSlots <= 0) {
            http_response_code(409);
            echo json_encode(['message' => "{$selectedService['service_title']} is fully booked."]);
            exit;
        }

        if ($bookingPetCount > $remainingSlots) {
            http_response_code(409);
            echo json_encode(['message' => "{$selectedService['service_title']} has only {$remainingSlots} remaining pet slot" . ($remainingSlots === 1 ? '' : 's') . "."]);
            exit;
        }
    }
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

if (!columnExists($pdo, 'bookings', 'payment_method')) {
    $pdo->exec("ALTER TABLE bookings ADD COLUMN payment_method VARCHAR(40) NULL AFTER payment_proof_url");
}

if (!columnExists($pdo, 'bookings', 'payment_reference')) {
    $pdo->exec("ALTER TABLE bookings ADD COLUMN payment_reference VARCHAR(120) NULL AFTER payment_method");
}

if (!columnExists($pdo, 'bookings', 'consent_forms')) {
    $pdo->exec("ALTER TABLE bookings ADD COLUMN consent_forms LONGTEXT NULL AFTER signature_path");
}

if (!columnExists($pdo, 'bookings', 'consent_status')) {
    $pdo->exec("ALTER TABLE bookings ADD COLUMN consent_status VARCHAR(40) NULL AFTER consent_forms");
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
    $primaryPetId = $petIds[0] ?? null;
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
            consent_forms,
            consent_status,
            payment_proof_url,
            payment_method,
            payment_reference,
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
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
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
        jsonColumnValue($consentForms),
        $consentStatus,
        $paymentProofUrl,
        $paymentMethod,
        $paymentReference,
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

    if ($serviceType === 'special services') {
        if (!tableExists($pdo, 'special_service_booking_items')) {
            throw new Exception('Special service booking items table is missing.');
        }

        $bookingSpecialServiceStmt = $pdo->prepare("
            INSERT INTO special_service_booking_items
                (booking_id, special_service_id, sequence_no)
            VALUES (?, ?, ?)
        ");

        foreach ($specialServiceItemIds as $index => $specialServiceId) {
            $bookingSpecialServiceStmt->execute([
                $bookingId,
                $specialServiceId,
                $index + 1,
            ]);
        }
    }

    $pdo->commit();

    try {
        notification_send_booking_event($pdo, $bookingId, 'submitted');
    } catch (Throwable $notificationError) {
        error_log('Booking submitted notification failed: ' . $notificationError->getMessage());
    }

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
