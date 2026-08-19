<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/notification_helpers.php';
require_once __DIR__ . '/booking_maintenance.php';
require_once __DIR__ . '/booking_daily_guard.php';
require_once __DIR__ . '/consent_record_helpers.php';
require_once __DIR__ . '/phone_number_helpers.php';
require_once __DIR__ . '/reference_number_helpers.php';
require_once __DIR__ . '/workflow_guard_helpers.php';
require_once __DIR__ . '/branch_helpers.php';
require_once __DIR__ . '/booking_payment_helpers.php';
require_once __DIR__ . '/booking_slot_helpers.php';

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

function bookingServiceKey(?string $serviceType, $isHomeService, $isOnlineConsultation): string
{
    if ((int)$isHomeService === 1 || strtolower(trim((string)$serviceType)) === 'home-service') {
        return 'home-service';
    }

    if ((int)$isOnlineConsultation === 1 || strtolower(trim((string)$serviceType)) === 'online-consultation') {
        return 'online-consultation';
    }

    return strtolower(trim((string)$serviceType));
}

function isBookingDateTimeInPast(string $bookingDate, string $bookingTime): bool
{
    $timezone = new DateTimeZone('Asia/Manila');
    $bookingDateTime = DateTimeImmutable::createFromFormat('!Y-m-d H:i:s', "{$bookingDate} {$bookingTime}", $timezone);
    $errors = DateTimeImmutable::getLastErrors();
    $hasErrors = is_array($errors) && ($errors['warning_count'] > 0 || $errors['error_count'] > 0);

    if (!$bookingDateTime || $hasErrors) {
        return true;
    }

    return $bookingDateTime < new DateTimeImmutable('now', $timezone);
}

function requestedBookingPetCount(array $petIds, ?string $registeredStatus, ?string $newPetName): int
{
    if (!empty($petIds)) {
        return count($petIds);
    }

    return strtolower(trim((string)$registeredStatus)) === 'not registered' && trim((string)$newPetName) !== '' ? 1 : 0;
}

function homeServiceActiveBookingCount(PDO $pdo, string $bookingDate): int
{
    $stmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM bookings
        WHERE booking_date = ?
          AND status IN ('pending', 'confirmed')
          AND (is_home_service = 1 OR service_type = 'home-service')
    ");
    $stmt->execute([$bookingDate]);

    return (int)$stmt->fetchColumn();
}

function homeServiceAfternoonPetCount(PDO $pdo, string $bookingDate): int
{
    if (tableExists($pdo, 'booking_pets')) {
        $stmt = $pdo->prepare("
            SELECT COALESCE(SUM(
                CASE
                    WHEN bp.pet_id IS NOT NULL THEN 1
                    WHEN b.pet_id IS NOT NULL OR TRIM(COALESCE(b.unregistered_pet_name, '')) <> '' THEN 1
                    ELSE 0
                END
            ), 0)
            FROM bookings b
            LEFT JOIN booking_pets bp ON bp.booking_id = b.booking_id
            WHERE b.booking_date = ?
              AND b.booking_time >= '12:00:00'
              AND b.status IN ('pending', 'confirmed')
              AND (b.is_home_service = 1 OR b.service_type = 'home-service')
        ");
        $stmt->execute([$bookingDate]);

        return (int)$stmt->fetchColumn();
    }

    $stmt = $pdo->prepare("
        SELECT COALESCE(SUM(
            CASE
                WHEN pet_id IS NOT NULL OR TRIM(COALESCE(unregistered_pet_name, '')) <> '' THEN 1
                ELSE 0
            END
        ), 0)
        FROM bookings
        WHERE booking_date = ?
          AND booking_time >= '12:00:00'
          AND status IN ('pending', 'confirmed')
          AND (is_home_service = 1 OR service_type = 'home-service')
    ");
    $stmt->execute([$bookingDate]);

    return (int)$stmt->fetchColumn();
}

function getActiveBoardingConflict(PDO $pdo, array $petIds, int $excludeBookingId = 0): ?array
{
    $petIds = array_values(array_unique(array_filter(array_map('intval', $petIds), fn($petId) => $petId > 0)));
    if (empty($petIds) || !tableExists($pdo, 'boarding_assignments')) {
        return null;
    }

    $placeholders = implode(',', array_fill(0, count($petIds), '?'));
    $bookingPetsJoin = '';
    $petJoinExpression = 'b.pet_id';
    $petCondition = "b.pet_id IN ({$placeholders})";
    $params = $petIds;

    if (tableExists($pdo, 'booking_pets')) {
        $bookingPetsJoin = 'LEFT JOIN booking_pets bp ON bp.booking_id = b.booking_id';
        $petJoinExpression = 'COALESCE(bp.pet_id, b.pet_id)';
        $petCondition = "(bp.pet_id IN ({$placeholders}) OR b.pet_id IN ({$placeholders}))";
        $params = array_merge($petIds, $petIds);
    }

    $params[] = $excludeBookingId;
    $stmt = $pdo->prepare("
        SELECT
            b.booking_number,
            COALESCE(p.pet_name, b.unregistered_pet_name, 'Selected pet') AS pet_name,
            ba.room_type,
            ba.room_number,
            ba.status
        FROM boarding_assignments ba
        JOIN bookings b ON b.booking_id = ba.booking_id
        {$bookingPetsJoin}
        LEFT JOIN pets_information p ON p.pet_id = {$petJoinExpression}
        WHERE ba.status = 'occupied'
          AND b.status <> 'cancelled'
          AND {$petCondition}
          AND b.booking_id <> ?
        ORDER BY ba.assignment_id DESC
        LIMIT 1
    ");
    $stmt->execute($params);
    $conflict = $stmt->fetch(PDO::FETCH_ASSOC);

    return $conflict ?: null;
}

function getOverlappingBoardingBookingConflict(PDO $pdo, array $petIds, string $checkInDate, string $checkOutDate, int $excludeBookingId = 0): ?array
{
    $petIds = array_values(array_unique(array_filter(array_map('intval', $petIds), fn($petId) => $petId > 0)));
    if (empty($petIds)) {
        return null;
    }

    $placeholders = implode(',', array_fill(0, count($petIds), '?'));
    $bookingPetsJoin = '';
    $petJoinExpression = 'b.pet_id';
    $petCondition = "b.pet_id IN ({$placeholders})";
    $params = $petIds;

    if (tableExists($pdo, 'booking_pets')) {
        $bookingPetsJoin = 'LEFT JOIN booking_pets bp ON bp.booking_id = b.booking_id';
        $petJoinExpression = 'COALESCE(bp.pet_id, b.pet_id)';
        $petCondition = "(bp.pet_id IN ({$placeholders}) OR b.pet_id IN ({$placeholders}))";
        $params = array_merge($petIds, $petIds);
    }

    $params[] = $excludeBookingId;
    $params[] = $checkOutDate;
    $params[] = $checkInDate;

    $stmt = $pdo->prepare("
        SELECT
            b.booking_number,
            COALESCE(p.pet_name, b.unregistered_pet_name, 'Selected pet') AS pet_name,
            b.check_in_date,
            b.check_out_date,
            b.status
        FROM bookings b
        {$bookingPetsJoin}
        LEFT JOIN pets_information p ON p.pet_id = {$petJoinExpression}
        WHERE b.service_type = 'boarding'
          AND b.status IN ('pending', 'confirmed')
          AND {$petCondition}
          AND b.booking_id <> ?
          AND b.check_in_date < ?
          AND b.check_out_date > ?
        ORDER BY b.check_in_date ASC, b.booking_id ASC
        LIMIT 1
    ");
    $stmt->execute($params);
    $conflict = $stmt->fetch(PDO::FETCH_ASSOC);

    return $conflict ?: null;
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

    $timezone = new DateTimeZone('Asia/Manila');
    $requestedStart = DateTimeImmutable::createFromFormat('!Y-m-d H:i:s', "{$bookingDate} {$bookingTime}", $timezone);
    $errors = DateTimeImmutable::getLastErrors();
    $hasErrors = is_array($errors) && ($errors['warning_count'] > 0 || $errors['error_count'] > 0);

    if (!$requestedStart || $hasErrors) {
        return true;
    }

    $requestedEnd = $requestedStart->modify('+1 hour')->format('H:i:s');
    $requestedStartTime = $requestedStart->format('H:i:s');

    $stmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM bookings
        WHERE is_online_consultation = 1
          AND veterinarian_id = ?
          AND booking_date = ?
          AND booking_time < ?
          AND ADDTIME(booking_time, '01:00:00') > ?
          AND status IN ('pending', 'confirmed')
    ");
    $stmt->execute([$veterinarianId, $bookingDate, $requestedEnd, $requestedStartTime]);

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

function bookingOfficialCatalogPrice(PDO $pdo, string $serviceType): ?float
{
    if (!tableExists($pdo, 'service_catalog')) {
        return null;
    }

    $normalized = strtolower(trim($serviceType));
    $normalized = preg_replace('/[^a-z0-9]+/', '_', $normalized);
    $normalized = trim((string)$normalized, '_');
    if ($normalized === '') {
        return null;
    }

    $aliases = [
        'consultation' => ['consultation', 'general_consultation', 'general_check_up', 'general_checkup'],
        'general_check_up' => ['consultation', 'general_consultation', 'general_check_up', 'general_checkup'],
        'general_checkup' => ['consultation', 'general_consultation', 'general_check_up', 'general_checkup'],
        'online_consultation' => ['online_consultation'],
        'home_service' => ['home_service', 'home_visit', 'home_visit_consultation'],
        'parasite_control' => ['parasite_control', 'deworming'],
        'vaccination' => ['vaccination', 'vaccine'],
        'grooming' => ['grooming'],
        'dental' => ['dental', 'dental_assessment', 'dental_check_up', 'dental_checkup'],
        'dental_check_up' => ['dental', 'dental_assessment', 'dental_check_up', 'dental_checkup'],
        'surgery' => ['surgery'],
        'lab_testing' => ['lab_testing', 'laboratory', 'diagnostic'],
    ];
    $acceptedKeys = $aliases[$normalized] ?? [$normalized];

    $stmt = $pdo->query("
        SELECT service_name, service_code, service_type, base_price
        FROM service_catalog
        WHERE is_active = 1
        ORDER BY service_name ASC
    ");
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $service) {
        foreach (['service_name', 'service_code', 'service_type'] as $field) {
            $candidate = strtolower(trim((string)($service[$field] ?? '')));
            $candidate = preg_replace('/[^a-z0-9]+/', '_', $candidate);
            $candidate = trim((string)$candidate, '_');
            if ($candidate !== '' && in_array($candidate, $acceptedKeys, true)) {
                return max(0.0, (float)$service['base_price']);
            }
        }
    }

    return null;
}

function bookingStayDays(?string $checkInDate, ?string $checkOutDate): int
{
    $start = $checkInDate ? strtotime($checkInDate) : false;
    $end = $checkOutDate ? strtotime($checkOutDate) : false;

    if ($start === false || $end === false || $end <= $start) {
        return 0;
    }

    return max(1, (int)ceil(($end - $start) / 86400));
}

function bookingOfficialBoardingPrice(?string $hotelBoardingType, ?string $roomSize, ?string $checkInDate, ?string $checkOutDate, $addOns): float
{
    $roomPrices = [
        'hotel' => ['small' => 600.0, 'medium' => 1200.0, 'large' => 2000.0],
        'boarding' => ['small' => 400.0, 'medium' => 800.0, 'large' => 1400.0],
    ];
    $addOnPrices = [
        'behavior' => ['price' => 300.0, 'billing' => 'day'],
        'playtime' => ['price' => 200.0, 'billing' => 'day'],
        'training' => ['price' => 500.0, 'billing' => 'stay'],
        'photos' => ['price' => 150.0, 'billing' => 'day'],
        'medication' => ['price' => 200.0, 'billing' => 'day'],
        'special-diet' => ['price' => 250.0, 'billing' => 'day'],
    ];

    $type = strtolower(trim((string)$hotelBoardingType));
    $size = strtolower(trim((string)$roomSize));
    $days = bookingStayDays($checkInDate, $checkOutDate);
    if ($days <= 0 || !isset($roomPrices[$type][$size])) {
        return 0.0;
    }

    $total = $roomPrices[$type][$size] * $days;
    if (is_string($addOns)) {
        $decoded = json_decode($addOns, true);
        $addOns = is_array($decoded) ? $decoded : [];
    }
    if (!is_array($addOns)) {
        $addOns = [];
    }

    foreach ($addOns as $addOn) {
        $id = strtolower(trim((string)($addOn['id'] ?? '')));
        if (!isset($addOnPrices[$id])) {
            continue;
        }
        $config = $addOnPrices[$id];
        $total += $config['price'] * ($config['billing'] === 'day' ? $days : 1);
    }

    return max(0.0, $total);
}

function bookingOfficialBoardingOverstayDailyRate(?string $hotelBoardingType, ?string $roomSize, $addOns): float
{
    $roomPrices = [
        'hotel' => ['small' => 600.0, 'medium' => 1200.0, 'large' => 2000.0],
        'boarding' => ['small' => 400.0, 'medium' => 800.0, 'large' => 1400.0],
    ];
    $dailyAddOnPrices = [
        'behavior' => 300.0,
        'playtime' => 200.0,
        'photos' => 150.0,
        'medication' => 200.0,
        'special-diet' => 250.0,
    ];
    $type = strtolower(trim((string)$hotelBoardingType));
    $size = strtolower(trim((string)$roomSize));
    $rate = (float)($roomPrices[$type][$size] ?? 0);

    if (is_string($addOns)) {
        $decoded = json_decode($addOns, true);
        $addOns = is_array($decoded) ? $decoded : [];
    }
    foreach (is_array($addOns) ? $addOns : [] as $addOn) {
        $id = strtolower(trim((string)($addOn['id'] ?? '')));
        $rate += (float)($dailyAddOnPrices[$id] ?? 0);
    }

    return round(max(0.0, $rate), 2);
}

function bookingOfficialPrice(PDO $pdo, string $serviceType, string $serviceKey, bool $isHotelBoarding, ?string $hotelBoardingType, ?string $roomSize, ?string $checkInDate, ?string $checkOutDate, $addOns): float
{
    if ($serviceKey === 'online-consultation') {
        return 500.0;
    }

    if ($serviceKey === 'home-service') {
        $catalogPrice = bookingOfficialCatalogPrice($pdo, 'home-service');
        return $catalogPrice !== null && $catalogPrice > 0 ? $catalogPrice : 1400.0;
    }

    if ($isHotelBoarding) {
        return bookingOfficialBoardingPrice($hotelBoardingType, $roomSize, $checkInDate, $checkOutDate, $addOns);
    }

    $catalogPrice = bookingOfficialCatalogPrice($pdo, $serviceType);
    return $catalogPrice !== null ? $catalogPrice : 0.0;
}

function bookingExactPriceFromLabel(?string $priceLabel): ?float
{
    $label = trim((string)$priceLabel);
    if ($label === '') {
        return null;
    }

    if (preg_match('/\b(free|complimentary|no\s+charge)\b/i', $label)) {
        return 0.0;
    }

    if (preg_match('/\b(starting|starts|from|up\s+to|estimate(?:d)?|depends|tbd|quote|upon|var(?:y|ies|iable)|minimum|maximum|each|per)\b/i', $label)) {
        return null;
    }

    if (preg_match('/\d[\d,]*(?:\.\d+)?\s*(?:-|\x{2013}|\x{2014}|to)\s*\d/iu', $label)) {
        return null;
    }

    $normalized = str_replace(',', '', $label);
    preg_match_all('/(?<![a-z0-9])\d+(?:\.\d{1,2})?(?![a-z0-9])/i', $normalized, $matches);
    if (count($matches[0] ?? []) !== 1) {
        return null;
    }

    $amount = (float)$matches[0][0];
    if (!is_finite($amount) || $amount < 0 || $amount > 99999999.99) {
        return null;
    }

    return round($amount, 2);
}

function bookingSpecialServicePrice(array $service): float
{
    if (array_key_exists('base_price', $service) && $service['base_price'] !== null) {
        $basePrice = (float)$service['base_price'];
        if (is_finite($basePrice) && $basePrice >= 0 && $basePrice <= 99999999.99) {
            return round($basePrice, 2);
        }
    }

    $labelPrice = bookingExactPriceFromLabel($service['price_label'] ?? null);
    return $labelPrice !== null ? $labelPrice : 0.0;
}

$input = json_decode(file_get_contents('php://input'), true) ?: [];

$currentApiUser = ipawcus_guard_current_user($pdo);
$currentApiRole = ipawcus_guard_role($currentApiUser);
$currentApiUserId = ipawcus_guard_user_id($currentApiUser);
$submittedUserId = $input['user_id'] ?? null;
$userId = null;
$petId = $input['pet_id'] ?? null;
$petIds = normalizePetIds($pdo, $petId, $input['pet_ids'] ?? []);
$serviceType = $input['service_type'] ?? null;
$requestedBranchId = $input['branch_id'] ?? $input['branchId'] ?? null;
$bookingDate = $input['booking_date'] ?? null;
$bookingTime = $input['booking_time'] ?? null;
$notes = $input['notes'] ?? null;
$imagePath = $input['Image_Booking_Concern_Path'] ?? null;
$registeredStatus = $input['registered_status'] ?? null;
$petType = $input['petType'] ?? null;
$specialServiceItemIds = normalizeSpecialServiceItemIds($input['special_service_items'] ?? []);
$selectedSpecialServices = [];

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

$submittedSignaturePath = consent_record_nullable_text(
    $input['signature']
        ?? $input['signature_path']
        ?? $input['consent_signature_path']
        ?? null
);
$consentForms = $input['consent_forms'] ?? $input['consentForms'] ?? null;
$signaturePath = consent_record_nullable_text(
    $input['signed_consent_document_path']
        ?? $input['signedConsentDocumentPath']
        ?? $input['consent_document_path']
        ?? $input['consentDocumentPath']
        ?? null
);
$signaturePath = $signaturePath ?: consent_record_first_signed_document_path($consentForms);
$physicalConsentPath = consent_record_nullable_text(
    $input['physical_consent_path']
        ?? $input['physicalConsentPath']
        ?? $input['physical_file_path']
        ?? $input['physicalFilePath']
        ?? null
);
$physicalConsentPath = $physicalConsentPath ?: consent_record_first_physical_document_path($consentForms);
$consentForms = consent_record_normalize_booking_forms(
    $consentForms,
    $signaturePath,
    $physicalConsentPath
);
$hasCompleteConsentDocument = $signaturePath !== null || $physicalConsentPath !== null;
if (!$hasCompleteConsentDocument && $submittedSignaturePath !== null) {
    if (empty($consentForms)) {
        $consentForms[] = [
            'id' => null,
            'title' => 'Legacy Booking Signature',
        ];
    }
    if (consent_record_form_legacy_signature_path($consentForms[0]) === null) {
        $consentForms[0]['legacySignaturePath'] = $submittedSignaturePath;
    }
}
$consentStatus = trim((string)($input['consent_status'] ?? $input['consentStatus'] ?? ''));
if ($hasCompleteConsentDocument) {
    $consentStatus = 'signed';
} elseif (!empty($consentForms) || $submittedSignaturePath !== null) {
    // A handwritten signature image can help reconstruct a legacy form, but it
    // is not itself a complete signed consent document.
    $consentStatus = 'pending';
} else {
    $consentStatus = $consentStatus !== '' ? $consentStatus : null;
}
$paymentProofUrl = trim((string)($input['payment_proof_url'] ?? $input['paymentProofUrl'] ?? ''));
$paymentProofUrl = $paymentProofUrl !== '' ? $paymentProofUrl : null;
$paymentMethod = ipawcus_payment_method_key($input['payment_method'] ?? $input['paymentMethod'] ?? '');
if (!ipawcus_payment_method_is_allowed($pdo, $paymentMethod, false)) {
    $paymentMethod = null;
}
$submittedPaymentAmountValue = $input['payment_amount'] ?? $input['paymentAmount'] ?? null;
$submittedPaymentAmount = is_numeric($submittedPaymentAmountValue)
    ? round((float)$submittedPaymentAmountValue, 2)
    : null;
$paymentReference = trim((string)($input['payment_reference'] ?? $input['paymentReference'] ?? ''));
$paymentReference = $paymentReference !== '' ? $paymentReference : null;
if ($paymentReference !== null && strlen($paymentReference) > 120) {
    http_response_code(422);
    echo json_encode(['message' => 'Payment reference must be 120 characters or fewer.']);
    exit;
}
if ($paymentProofUrl !== null && strlen($paymentProofUrl) > 500) {
    http_response_code(422);
    echo json_encode(['message' => 'Payment proof path is too long. Upload the proof again.']);
    exit;
}
$price = 0;
$transportFee = 0;

$isOnlineConsultation = $input['is_online_consultation'] ?? 0;
$veterinarianId = $input['veterinarian_id'] ?? null;

$hotelBoardingType = $input['hotel_boarding_type'] ?? null;
$checkInDate = $input['check_in_date'] ?? null;
$checkOutDate = $input['check_out_date'] ?? null;
$roomSize = $input['room_size'] ?? null;
$addOns = $input['add_ons'] ?? null;
$emergencyContact = $input['emergency_contact'] ?? null;
$isHotelBoarding = $serviceType === 'boarding' && in_array($hotelBoardingType, ['hotel', 'boarding'], true);

if ($currentApiRole === 'pet_owner') {
    if ($submittedUserId !== null && $submittedUserId !== '' && (int)$submittedUserId !== $currentApiUserId) {
        http_response_code(403);
        echo json_encode(['message' => 'You cannot submit a booking for another user account.']);
        exit;
    }
    $userId = $currentApiUserId;
} elseif (ipawcus_guard_is_admin_role($currentApiRole)) {
    $userId = is_numeric($submittedUserId) ? (int)$submittedUserId : null;
} else {
    http_response_code(403);
    echo json_encode(['message' => 'Your role is not allowed to create bookings for this workflow.']);
    exit;
}

$homeServiceRequested = (int)$isHomeService === 1 || strtolower(trim((string)$serviceType)) === 'home-service';
$onlineConsultRequested = (int)$isOnlineConsultation === 1 || strtolower(trim((string)$serviceType)) === 'online-consultation';
$boardingRequested = $serviceType === 'boarding' || $isHotelBoarding;
$exclusiveModes = array_filter([$homeServiceRequested, $onlineConsultRequested, $boardingRequested]);

if (count($exclusiveModes) > 1) {
    http_response_code(422);
    echo json_encode(['message' => 'Select only one booking mode: boarding, home service, or online consultation.']);
    exit;
}

$isHomeService = $homeServiceRequested ? 1 : 0;
$isOnlineConsultation = $onlineConsultRequested ? 1 : 0;

if ($isHotelBoarding) {
    $bookingDate = $bookingDate ?: $checkInDate;
    $bookingTime = $bookingTime ?: '09:00:00';
}

if ($isHotelBoarding && !$hasCompleteConsentDocument) {
    http_response_code(400);
    echo json_encode(['message' => 'Pet hotel and boarding bookings require the complete signed liability consent document before payment or activation.']);
    exit;
}

$bookingTime = normalizeBookingTime($bookingTime);

if (!$userId || !$serviceType || !$bookingDate || !$bookingTime) {
    http_response_code(400);
    echo json_encode(['message' => 'Missing required booking information.']);
    exit;
}

$notes = maintenance_append_note($notes, sprintf(MAINTENANCE_ORIGINAL_BOOKING_NOTE, $bookingDate));

if ((int)$isOnlineConsultation === 1 && (!$veterinarianId || !is_numeric($veterinarianId))) {
    http_response_code(400);
    echo json_encode(['message' => 'Please select a veterinarian for online consultation.']);
    exit;
}

if ($registeredStatus === 'Registered' && empty($petIds)) {
    http_response_code(400);
    echo json_encode(['message' => 'The selected pet could not be found. Please go back and choose the pet again.']);
    exit;
}

if ($registeredStatus === 'Registered' && !empty($petIds)) {
    if ($currentApiRole === 'pet_owner') {
        $forbiddenPetId = ipawcus_guard_first_forbidden_pet($pdo, $petIds, $currentApiUserId);
        if ($forbiddenPetId !== null) {
            http_response_code(403);
            echo json_encode(['message' => 'You are not allowed to book one or more selected pets.']);
            exit;
        }
    } else {
        $unlinkedPetId = ipawcus_guard_first_forbidden_pet($pdo, $petIds, (int)$userId);
        if ($unlinkedPetId !== null) {
            http_response_code(422);
            echo json_encode(['message' => 'One or more selected pets is not linked to the selected owner.']);
            exit;
        }
    }
}

$deceasedPetNames = getDeceasedPetNames($pdo, $petIds);
if (!empty($deceasedPetNames)) {
    http_response_code(400);
    $uniqueDeceasedPetNames = array_unique($deceasedPetNames);
    $petList = implode(', ', $uniqueDeceasedPetNames);
    echo json_encode(['message' => "Cannot create booking for deceased pet" . (count($uniqueDeceasedPetNames) === 1 ? "" : "s") . ": {$petList}."]);
    exit;
}

$serviceKey = booking_slot_service_key((string)$serviceType, $isHomeService, $isOnlineConsultation);

if ($serviceKey !== 'boarding') {
    try {
        $bookingTime = booking_slot_assert_aligned($serviceKey, (string)$bookingTime);
    } catch (InvalidArgumentException $e) {
        http_response_code(422);
        echo json_encode(['message' => $e->getMessage()]);
        exit;
    }
}

try {
    $branchResolution = branch_resolve_booking(
        $pdo,
        $requestedBranchId,
        (string)$serviceType,
        $isHomeService,
        $isOnlineConsultation,
        (string)$bookingDate,
        (string)$bookingTime,
        is_numeric($veterinarianId) ? (int)$veterinarianId : null
    );
    $branchId = (int)$branchResolution['branch_id'];
    if (!empty($branchResolution['veterinarian_user_id'])) {
        $veterinarianId = (int)$branchResolution['veterinarian_user_id'];
    }
} catch (InvalidArgumentException $e) {
    http_response_code(422);
    echo json_encode(['message' => $e->getMessage()]);
    exit;
}

if ($currentApiRole === 'admin' && !branch_user_can_access($pdo, $currentApiUser, $branchId)) {
    http_response_code(403);
    echo json_encode(['message' => 'You can create bookings only for your assigned clinic branch.']);
    exit;
}

if ($serviceKey === 'online-consultation') {
    $normalizedVetId = is_numeric($veterinarianId) ? (int)$veterinarianId : 0;
    if ($normalizedVetId <= 0) {
        http_response_code(422);
        echo json_encode(['message' => 'Select a veterinarian for the online consultation.']);
        exit;
    }
    if (!booking_slot_online_vet_is_available($pdo, $normalizedVetId, (string)$bookingDate, (string)$bookingTime)) {
        http_response_code(409);
        echo json_encode(['message' => 'That veterinarian has not made this online consultation time available. Select another date or time.']);
        exit;
    }
}

if (in_array($serviceKey, ['home-service', 'online-consultation'], true) && !$hasCompleteConsentDocument) {
    http_response_code(400);
    echo json_encode(['message' => 'The complete signed owner consent document is required before submitting this booking.']);
    exit;
}

if (!$isHotelBoarding && isBookingDateTimeInPast((string)$bookingDate, (string)$bookingTime)) {
    http_response_code(400);
    echo json_encode(['message' => 'Booking date and time must not be in the past.']);
    exit;
}

if ($serviceKey === 'home-service') {
    if (trim((string)$address) === '') {
        http_response_code(400);
        echo json_encode(['message' => 'Home service address is required.']);
        exit;
    }

    if (!preg_match('/\[Services:\s*[^\]]+\]/', (string)$notes)) {
        http_response_code(400);
        echo json_encode(['message' => 'Select at least one supported home service.']);
        exit;
    }

}

if ($serviceType === 'special services') {
    if (!tableExists($pdo, 'special_service_catalog')) {
        http_response_code(500);
        echo json_encode(['message' => 'Special service catalog is missing.']);
        exit;
    }

    if (count($specialServiceItemIds) !== 1) {
        http_response_code(400);
        echo json_encode(['message' => 'Please select exactly one special service.']);
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
    $basePriceSelect = columnExists($pdo, 'special_service_catalog', 'base_price')
        ? ', base_price'
        : ', NULL AS base_price';
    $placeholderList = implode(',', array_fill(0, count($specialServiceItemIds), '?'));
    $catalogStmt = $pdo->prepare("
        SELECT special_service_id, service_title, price_label, max_pets, is_active{$basePriceSelect}{$dateSelect}
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

    $emergencyContact = rejectInvalidPhilippinePhoneNumber($emergencyContact, 'Emergency contact');

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
        echo json_encode(['message' => 'Room capacity table is missing. Run the room setup SQL from phpTestfiles/rooms_setup.sql first.']);
        exit;
    }

    $activeConflict = getActiveBoardingConflict($pdo, $petIds);
    if ($activeConflict) {
        http_response_code(409);
        $roomLabel = ucfirst(str_replace('-', ' ', (string)$activeConflict['room_type'])) . ' #' . (int)$activeConflict['room_number'];
        echo json_encode(['message' => "{$activeConflict['pet_name']} already has an active boarding stay in {$roomLabel}. Check out the current stay before booking another room."]);
        exit;
    }

    $overlapConflict = getOverlappingBoardingBookingConflict($pdo, $petIds, (string)$checkInDate, (string)$checkOutDate);
    if ($overlapConflict) {
        http_response_code(409);
        echo json_encode(['message' => "{$overlapConflict['pet_name']} already has a boarding booking that overlaps these dates ({$overlapConflict['booking_number']})."]);
        exit;
    }
}

ipawcus_guard_require_columns($pdo, 'bookings', [
    'payment_method',
    'payment_reference',
    'consent_forms',
    'consent_status',
]);

$transportFee = $serviceKey === 'home-service' ? 50.0 : 0.0;
$price = bookingOfficialPrice($pdo, (string)$serviceType, $serviceKey, $isHotelBoarding, $hotelBoardingType, $roomSize, $checkInDate, $checkOutDate, $addOns);
if ($serviceType === 'special services' && count($selectedSpecialServices) === 1) {
    // The exact catalog amount is snapshotted in bookings.price. A variable or
    // ranged display label intentionally remains PHP 0.00 for staff pricing.
    $price = bookingSpecialServicePrice($selectedSpecialServices[0]);
}

$requiresBookingPrepayment = in_array($serviceKey, ['home-service', 'online-consultation'], true);
$expectedBookingPayment = $serviceKey === 'home-service' ? $transportFee : $price;
if ($paymentProofUrl !== null && $paymentMethod === null) {
    http_response_code(422);
    echo json_encode(['message' => 'Select QR Ph, GCash, Maya, or bank transfer for an uploaded booking payment proof.']);
    exit;
}
if ($paymentProofUrl !== null && $paymentReference === null) {
    http_response_code(422);
    echo json_encode(['message' => 'Enter the transaction reference shown on the uploaded payment proof.']);
    exit;
}
if ($requiresBookingPrepayment && ($paymentProofUrl === null || $paymentMethod === null)) {
    http_response_code(422);
    echo json_encode(['message' => $serviceKey === 'home-service'
        ? 'The PHP 50 home-service transport payment proof is required before submitting this booking.'
        : 'Online consultation payment proof is required before submitting this booking.']);
    exit;
}
if ($paymentProofUrl !== null && $expectedBookingPayment <= 0) {
    http_response_code(422);
    echo json_encode(['message' => 'This service does not have a fixed prepayment amount. Complete payment through Point-Of-Sale after staff review.']);
    exit;
}
if (
    $paymentProofUrl !== null
    && $submittedPaymentAmount !== null
    && abs($submittedPaymentAmount - $expectedBookingPayment) > 0.009
) {
    http_response_code(422);
    echo json_encode([
        'message' => 'The submitted amount must match the official booking payment of PHP '
            . number_format($expectedBookingPayment, 2, '.', ',') . '.',
        'expectedPaymentAmount' => $expectedBookingPayment,
    ]);
    exit;
}

$slotLockName = null;

try {
    $pdo->beginTransaction();

    booking_daily_lock_subjects(
        $pdo,
        $petIds,
        (int)$userId,
        $newPetName
    );
    $dailyBookingConflict = booking_daily_find_conflict(
        $pdo,
        $petIds,
        (string)$bookingDate,
        0,
        (int)$userId,
        $newPetName
    );
    if ($dailyBookingConflict) {
        $payload = booking_daily_conflict_payload($dailyBookingConflict);
        $pdo->rollBack();
        http_response_code(409);
        echo json_encode($payload);
        exit;
    }

    if ($isHotelBoarding) {
        $roomType = $hotelBoardingType . '-' . $roomSize;
        $slotLockName = 'ipawcus_room_' . md5($branchId . '|' . $roomType);
        if (!booking_slot_acquire($pdo, $slotLockName)) {
            $pdo->rollBack();
            http_response_code(409);
            echo json_encode(['message' => 'Room availability is being updated by another booking. Refresh the available rooms and try again.']);
            exit;
        }

        $capacityStmt = $pdo->prepare("
            SELECT GREATEST(
                COALESCE(SUM(r.total_capacity), 0) - (
                    SELECT COUNT(*)
                    FROM room_unit_statuses rus
                    WHERE rus.branch_id = ? AND rus.room_type = ?
                      AND rus.status IN ('maintenance', 'retired')
                ),
                0
            )
            FROM rooms r
            WHERE r.branch_id = ? AND r.room_type = ?
        ");
        $capacityStmt->execute([$branchId, $roomType, $branchId, $roomType]);
        $totalCapacity = (int)$capacityStmt->fetchColumn();

        if ($totalCapacity <= 0) {
            $pdo->rollBack();
            booking_slot_release($pdo, $slotLockName);
            $slotLockName = null;
            http_response_code(409);
            echo json_encode(['message' => 'Selected room or kennel type is not configured.']);
            exit;
        }

        $bookedStmt = $pdo->prepare("
            SELECT COUNT(*)
            FROM bookings
            WHERE service_type = 'boarding'
              AND branch_id = ?
              AND hotel_boarding_type = ?
              AND room_size = ?
              AND check_in_date < ?
              AND check_out_date > ?
              AND status IN ('pending', 'confirmed')
        ");
        $bookedStmt->execute([$branchId, $hotelBoardingType, $roomSize, $checkOutDate, $checkInDate]);
        $bookedCount = (int)$bookedStmt->fetchColumn();

        if ($bookedCount >= $totalCapacity) {
            $pdo->rollBack();
            booking_slot_release($pdo, $slotLockName);
            $slotLockName = null;
            http_response_code(409);
            echo json_encode(['message' => 'No rooms or kennels are available for the selected dates.']);
            exit;
        }
    }

    if ($serviceKey !== 'boarding') {
        $slotVeterinarianId = $serviceKey === 'online-consultation' ? (int)$veterinarianId : null;
        $slotSpecialServiceId = null;
        $slotLockName = booking_slot_lock_name(
            $branchId,
            $serviceKey,
            (string)$bookingDate,
            (string)$bookingTime,
            $slotVeterinarianId,
            $slotSpecialServiceId
        );
        if (!booking_slot_acquire($pdo, $slotLockName)) {
            $pdo->rollBack();
            http_response_code(409);
            echo json_encode(['message' => 'This time is being reserved by another booking. Refresh the available times and try again.']);
            exit;
        }

        $slotConflict = booking_slot_find_conflict(
            $pdo,
            $branchId,
            $serviceKey,
            (string)$bookingDate,
            (string)$bookingTime,
            $slotVeterinarianId,
            0,
            $slotSpecialServiceId,
            true
        );
        if ($slotConflict) {
            $pdo->rollBack();
            booking_slot_release($pdo, $slotLockName);
            $slotLockName = null;
            http_response_code(409);
            echo json_encode(['message' => booking_slot_conflict_message($serviceKey, (string)$bookingTime)]);
            exit;
        }
    }

    $bookingNumber = ipawcus_generate_booking_number($pdo, $bookingDate);
    $primaryPetId = $petIds[0] ?? null;
    $addOnsValue = is_array($addOns) ? json_encode(array_values($addOns)) : $addOns;

    $stmt = $pdo->prepare("
        INSERT INTO bookings (
            user_id,
            pet_id,
            booking_number,
            branch_id,
            original_branch_id,
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
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    ");

    $stmt->execute([
        $userId,
        $primaryPetId ?: null,
        $bookingNumber,
        $branchId,
        $branchId,
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

    if ($isHotelBoarding && columnExists($pdo, 'bookings', 'boarding_overstay_daily_rate')) {
        $overstayRateStmt = $pdo->prepare("
            UPDATE bookings
            SET boarding_overstay_daily_rate = ?
            WHERE booking_id = ?
        ");
        $overstayRateStmt->execute([
            bookingOfficialBoardingOverstayDailyRate($hotelBoardingType, $roomSize, $addOns),
            $bookingId,
        ]);
    }

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

        $selectedSpecialServicesById = [];
        foreach ($selectedSpecialServices as $selectedService) {
            $selectedSpecialServicesById[(int)$selectedService['special_service_id']] = $selectedService;
        }

        $bookingSpecialServiceStmt = $pdo->prepare("
            INSERT INTO special_service_booking_items
                (booking_id, special_service_id, custom_service_title, sequence_no)
            VALUES (?, ?, ?, ?)
        ");

        foreach ($specialServiceItemIds as $index => $specialServiceId) {
            $selectedService = $selectedSpecialServicesById[(int)$specialServiceId] ?? null;
            $serviceTitleSnapshot = trim((string)($selectedService['service_title'] ?? ''));
            $bookingSpecialServiceStmt->execute([
                $bookingId,
                $specialServiceId,
                $serviceTitleSnapshot !== '' ? $serviceTitleSnapshot : null,
                $index + 1,
            ]);
        }
    }

    consent_record_capture_booking($pdo, [
        'booking_id' => $bookingId,
        'owner_user_id' => $userId,
        'pet_id' => $primaryPetId,
        'pet_ids' => !empty($petIds) ? $petIds : [$primaryPetId],
        'service_name' => $serviceType,
        'signed_document_path' => $signaturePath,
        'signature_path' => $signaturePath,
        'physical_file_path' => $physicalConsentPath,
        'consent_forms' => $consentForms,
        'status' => $consentStatus,
        'notes' => 'Captured during booking creation.',
    ]);

    booking_payment_record_submission($pdo, [
        'booking_id' => $bookingId,
        'service_type' => $serviceType,
        'is_home_service' => $isHomeService,
        'is_online_consultation' => $isOnlineConsultation,
        'price' => $price,
        'transport_fee' => $transportFee,
        'payment_method' => $paymentMethod,
        'payment_reference' => $paymentReference,
        'payment_proof_url' => $paymentProofUrl,
        'created_at' => date('Y-m-d H:i:s'),
    ]);

    $pdo->commit();
    booking_slot_release($pdo, $slotLockName);
    $slotLockName = null;

    try {
        notification_send_booking_event($pdo, $bookingId, 'submitted');
    } catch (Throwable $notificationError) {
        error_log('Booking submitted notification failed: ' . $notificationError->getMessage());
    }

    echo json_encode([
        'message' => 'Booking created successfully.',
        'booking_id' => $bookingId,
        'booking_number' => $bookingNumber,
        'price' => $price,
        'transport_fee' => $transportFee,
        'branch_id' => $branchId,
        'branch_name' => $branchResolution['branch']['branch_name'] ?? null,
    ]);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    booking_slot_release($pdo, $slotLockName);

    http_response_code(500);
    echo json_encode(['message' => 'Failed to create booking: ' . $e->getMessage()]);
}
