<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/booking_daily_guard.php';
require_once __DIR__ . '/notification_helpers.php';
require_once __DIR__ . '/phone_number_helpers.php';
require_once __DIR__ . '/reference_number_helpers.php';
require_once __DIR__ . '/workflow_guard_helpers.php';
require_once __DIR__ . '/branch_helpers.php';
require_once __DIR__ . '/booking_slot_helpers.php';
require_once __DIR__ . '/consent_record_helpers.php';
require_once __DIR__ . '/consent_file_helpers.php';
require_once __DIR__ . '/upload_receipt_helpers.php';

header('Content-Type: application/json');

date_default_timezone_set('Asia/Manila');

function boarding_table_exists(PDO $pdo, string $tableName): bool
{
    static $cache = [];
    $cacheKey = spl_object_id($pdo) . ':' . $tableName;
    if (array_key_exists($cacheKey, $cache)) {
        return $cache[$cacheKey];
    }

    $stmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM information_schema.tables
        WHERE table_schema = DATABASE()
          AND table_name = ?
    ");
    $stmt->execute([$tableName]);

    $cache[$cacheKey] = (int)$stmt->fetchColumn() > 0;

    return $cache[$cacheKey];
}

function boarding_column_exists(PDO $pdo, string $tableName, string $columnName): bool
{
    static $cache = [];
    $cacheKey = spl_object_id($pdo) . ':' . $tableName . ':' . $columnName;
    if (array_key_exists($cacheKey, $cache)) {
        return $cache[$cacheKey];
    }

    $stmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = ?
          AND column_name = ?
    ");
    $stmt->execute([$tableName, $columnName]);

    $cache[$cacheKey] = (int)$stmt->fetchColumn() > 0;

    return $cache[$cacheKey];
}

function boarding_calculate_overstay_daily_rate(array $booking): float
{
    $storedRate = (float)($booking['boarding_overstay_daily_rate'] ?? 0);
    if ($storedRate > 0) {
        return round($storedRate, 2);
    }

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
    $type = strtolower(trim((string)($booking['hotel_boarding_type'] ?? '')));
    $size = strtolower(trim((string)($booking['room_size'] ?? '')));
    $rate = (float)($roomPrices[$type][$size] ?? 0);
    $addOns = $booking['add_ons'] ?? [];
    if (is_string($addOns)) {
        $decoded = json_decode($addOns, true);
        $addOns = is_array($decoded) ? $decoded : [];
    }
    foreach (is_array($addOns) ? $addOns : [] as $addOn) {
        $addOnId = strtolower(trim((string)($addOn['id'] ?? '')));
        $rate += (float)($dailyAddOnPrices[$addOnId] ?? 0);
    }

    return round(max(0.0, $rate), 2);
}

function boarding_calculate_overdue_days(?string $expectedOutDate, ?string $actualOutDate = null): int
{
    if (!$expectedOutDate) {
        return 0;
    }

    try {
        $expected = new DateTimeImmutable(substr($expectedOutDate, 0, 10));
        $actual = new DateTimeImmutable(substr($actualOutDate ?: date('Y-m-d'), 0, 10));
    } catch (Exception $exception) {
        return 0;
    }

    if ($actual <= $expected) {
        return 0;
    }

    return (int)$expected->diff($actual)->days;
}

function boarding_index_exists(PDO $pdo, string $tableName, string $indexName): bool
{
    static $cache = [];
    $cacheKey = spl_object_id($pdo) . ':' . $tableName . ':' . $indexName;
    if (array_key_exists($cacheKey, $cache)) {
        return $cache[$cacheKey];
    }

    $stmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM information_schema.statistics
        WHERE table_schema = DATABASE()
          AND table_name = ?
          AND index_name = ?
    ");
    $stmt->execute([$tableName, $indexName]);
    $cache[$cacheKey] = (int)$stmt->fetchColumn() > 0;

    return $cache[$cacheKey];
}

function boarding_constraint_exists(PDO $pdo, string $tableName, string $constraintName): bool
{
    static $cache = [];
    $cacheKey = spl_object_id($pdo) . ':' . $tableName . ':' . $constraintName;
    if (array_key_exists($cacheKey, $cache)) {
        return $cache[$cacheKey];
    }

    $stmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM information_schema.table_constraints
        WHERE constraint_schema = DATABASE()
          AND table_name = ?
          AND constraint_name = ?
    ");
    $stmt->execute([$tableName, $constraintName]);
    $cache[$cacheKey] = (int)$stmt->fetchColumn() > 0;

    return $cache[$cacheKey];
}

function boarding_current_actor(PDO $pdo, array $input = []): array
{
    $currentUser = isset($GLOBALS['ipawcus_current_api_user']) && is_array($GLOBALS['ipawcus_current_api_user'])
        ? $GLOBALS['ipawcus_current_api_user']
        : [];
    $userId = (int)($currentUser['user_id'] ?? ($_SERVER['IPAWCUS_USER_ID'] ?? 0));

    if ($userId <= 0) {
        boarding_error(401, 'An authenticated staff account is required for this boarding action.');
    }

    if ((int)($currentUser['user_id'] ?? 0) === $userId) {
        $name = trim(implode(' ', array_filter([
            $currentUser['first_Name'] ?? null,
            $currentUser['last_Name'] ?? null,
        ])));

        return [
            'user_id' => $userId,
            'name' => $name !== '' ? $name : null,
        ];
    }

    $stmt = $pdo->prepare("
        SELECT first_Name, last_Name
        FROM users
        WHERE user_id = ?
        LIMIT 1
    ");
    $stmt->execute([$userId]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$user) {
        boarding_error(401, 'The authenticated staff account could not be verified.');
    }

    $name = trim((string)$user['first_Name'] . ' ' . (string)$user['last_Name']);

    return [
        'user_id' => $userId,
        'name' => $name !== '' ? $name : null,
    ];
}

function boarding_json_input(): array
{
    return json_decode(file_get_contents('php://input'), true) ?: [];
}

function boarding_branch_id(PDO $pdo, array $input = []): int
{
    $currentUser = ipawcus_guard_current_user($pdo);
    $requested = $input['branch_id'] ?? $input['branchId'] ?? $_GET['branch_id'] ?? $_GET['branchId'] ?? null;
    $branchId = is_numeric($requested)
        ? (int)$requested
        : branch_user_primary_id($pdo, ipawcus_guard_user_id($currentUser));
    if (!branch_fetch($pdo, $branchId)) {
        boarding_error(422, 'Select an active boarding branch.');
    }
    if (!branch_user_can_access($pdo, $currentUser, $branchId)) {
        boarding_error(403, 'You cannot manage boarding at another branch.');
    }
    return $branchId;
}

function boarding_assert_booking_branch_access(PDO $pdo, array $booking): void
{
    $currentUser = ipawcus_guard_current_user($pdo);
    if (!branch_user_can_access($pdo, $currentUser, (int)($booking['branch_id'] ?? 0))) {
        boarding_error(403, 'This boarding booking belongs to another branch.');
    }
}

function boarding_error(int $statusCode, string $message, array $details = []): void
{
    global $pdo;

    ipawcus_rollback_current_transaction();
    if ($pdo instanceof PDO) {
        boarding_release_all_named_locks($pdo);
    }

    http_response_code($statusCode);
    echo json_encode(array_merge(['message' => $message], $details));
    exit;
}

function boarding_named_lock_acquire(PDO $pdo, string $lockName, int $timeoutSeconds = 8): bool
{
    if (!booking_slot_acquire($pdo, $lockName, $timeoutSeconds)) return false;
    if (!isset($GLOBALS['ipawcus_boarding_named_locks']) || !is_array($GLOBALS['ipawcus_boarding_named_locks'])) {
        $GLOBALS['ipawcus_boarding_named_locks'] = [];
    }
    $GLOBALS['ipawcus_boarding_named_locks'][$lockName] = true;
    return true;
}

function boarding_named_lock_release(PDO $pdo, ?string $lockName): void
{
    if ($lockName === null || $lockName === '') return;
    booking_slot_release($pdo, $lockName);
    unset($GLOBALS['ipawcus_boarding_named_locks'][$lockName]);
}

function boarding_release_all_named_locks(PDO $pdo): void
{
    $lockNames = array_keys(
        isset($GLOBALS['ipawcus_boarding_named_locks']) && is_array($GLOBALS['ipawcus_boarding_named_locks'])
            ? $GLOBALS['ipawcus_boarding_named_locks']
            : []
    );
    foreach ($lockNames as $lockName) booking_slot_release($pdo, $lockName);
    $GLOBALS['ipawcus_boarding_named_locks'] = [];
}

function boarding_internal_failure(string $context, Throwable $exception, string $publicMessage): void
{
    $reference = bin2hex(random_bytes(6));
    error_log(sprintf(
        '[Boarding:%s] %s: %s in %s:%d',
        $reference,
        $context,
        $exception->getMessage(),
        $exception->getFile(),
        $exception->getLine()
    ));
    boarding_error(500, $publicMessage, ['errorReference' => $reference]);
}

function require_boarding_tables(PDO $pdo, array $tableNames): void
{
    $missingTables = array_values(array_filter($tableNames, fn($tableName) => !boarding_table_exists($pdo, $tableName)));

    if (!empty($missingTables)) {
        error_log('Boarding database schema is missing: ' . implode(', ', $missingTables));
        boarding_error(500, 'Boarding records are temporarily unavailable. Please contact the system administrator.');
    }
}

function ensure_boarding_rooms_schema(PDO $pdo): void
{
    if (!boarding_table_exists($pdo, 'rooms')) {
        error_log('Boarding rooms schema is missing.');
        boarding_error(500, 'Boarding rooms are temporarily unavailable. Please contact the system administrator.');
        return;
    }

    $missingColumns = [];
    foreach (['room_id', 'room_type', 'total_capacity', 'description'] as $columnName) {
        if (!boarding_column_exists($pdo, 'rooms', $columnName)) {
            $missingColumns[] = $columnName;
        }
    }

    if (!empty($missingColumns)) {
        error_log('Boarding rooms schema is missing required columns: ' . implode(', ', $missingColumns));
        boarding_error(500, 'Boarding rooms are temporarily unavailable. Please contact the system administrator.');
    }
}

function normalize_room_type(?string $facilityType, ?string $roomSize): string
{
    $type = strtolower(trim((string)$facilityType));
    $size = strtolower(trim((string)$roomSize));

    if (!in_array($type, ['hotel', 'boarding'], true)) {
        boarding_error(400, 'Invalid hotel or boarding type.');
    }

    if (!in_array($size, ['small', 'medium', 'large'], true)) {
        boarding_error(400, 'Invalid room or kennel size.');
    }

    return $type . '-' . $size;
}

function split_room_type(string $roomType): array
{
    $parts = explode('-', $roomType, 2);

    return [
        'hotel_boarding_type' => $parts[0] ?? '',
        'room_size' => $parts[1] ?? '',
    ];
}

function room_type_label(string $roomType): string
{
    $parts = split_room_type($roomType);
    $facility = $parts['hotel_boarding_type'] === 'hotel' ? 'Hotel Room' : 'Kennel';

    return ucfirst($parts['room_size']) . ' ' . $facility;
}

function normalize_room_type_input(array $input): string
{
    $roomType = strtolower(trim((string)($input['room_type'] ?? '')));

    if ($roomType !== '') {
        $parts = split_room_type($roomType);
        return normalize_room_type($parts['hotel_boarding_type'], $parts['room_size']);
    }

    return normalize_room_type(
        $input['hotel_boarding_type'] ?? $input['type'] ?? null,
        $input['room_size'] ?? $input['size'] ?? null
    );
}

function boarding_count_stay_days(string $checkInDate, string $checkOutDate): int
{
    try {
        $start = new DateTime(substr($checkInDate, 0, 10));
        $end = new DateTime(substr($checkOutDate, 0, 10));
        $days = (int)$start->diff($end)->format('%r%a');

        return $days > 0 ? $days : 1;
    } catch (Exception $e) {
        return 1;
    }
}

function boarding_format_currency(float $amount): string
{
    return 'PHP ' . number_format($amount, 2);
}

function get_room_capacity(PDO $pdo, string $roomType, int $branchId): int
{
    $stmt = $pdo->prepare("SELECT COALESCE(SUM(total_capacity), 0) FROM rooms WHERE branch_id = ? AND room_type = ?");
    $stmt->execute([$branchId, $roomType]);

    return max(0, (int)$stmt->fetchColumn());
}

function get_maintenance_room_numbers(PDO $pdo, string $roomType, int $branchId): array
{
    $stmt = $pdo->prepare("
        SELECT room_number
        FROM room_unit_statuses
        WHERE branch_id = ? AND room_type = ?
          AND status IN ('maintenance', 'retired')
    ");
    $stmt->execute([$branchId, $roomType]);

    return array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));
}

function get_room_unit_status_map(PDO $pdo, string $roomType, int $branchId): array
{
    $stmt = $pdo->prepare("
        SELECT room_number, status
        FROM room_unit_statuses
        WHERE branch_id = ? AND room_type = ?
          AND status IN ('maintenance', 'retired')
    ");
    $stmt->execute([$branchId, $roomType]);
    $statuses = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $statuses[(int)$row['room_number']] = (string)$row['status'];
    }
    return $statuses;
}

function get_unavailable_room_numbers(PDO $pdo, string $roomType, string $checkInDate, string $checkOutDate, int $excludeBookingId, int $branchId): array
{
    $stmt = $pdo->prepare("
        SELECT DISTINCT ba.room_number
        FROM boarding_assignments ba
        JOIN bookings b ON b.booking_id = ba.booking_id
        WHERE ba.branch_id = ? AND ba.room_type = ?
          AND ba.status IN ('reserved', 'occupied')
          AND b.status <> 'cancelled'
          AND ba.booking_id <> ?
          AND COALESCE(DATE(ba.actual_check_in_at), b.check_in_date) < ?
          AND COALESCE(ba.desired_check_out_date, b.check_out_date) > ?
    ");
    $stmt->execute([$branchId, $roomType, $excludeBookingId, $checkOutDate, $checkInDate]);

    return array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));
}

function get_available_room_numbers(PDO $pdo, string $roomType, string $checkInDate, string $checkOutDate, int $excludeBookingId, int $branchId): array
{
    $capacity = get_room_capacity($pdo, $roomType, $branchId);
    if ($capacity <= 0) {
        return [];
    }

    $blocked = array_flip(array_merge(
        get_maintenance_room_numbers($pdo, $roomType, $branchId),
        get_unavailable_room_numbers($pdo, $roomType, $checkInDate, $checkOutDate, $excludeBookingId, $branchId)
    ));

    $available = [];
    for ($roomNumber = 1; $roomNumber <= $capacity; $roomNumber += 1) {
        if (!isset($blocked[$roomNumber])) {
            $available[] = $roomNumber;
        }
    }

    return $available;
}

function fetch_boarding_booking(PDO $pdo, int $bookingId, bool $forUpdate = false): array
{
    $sql = "
        SELECT *
        FROM bookings
        WHERE booking_id = ?
        LIMIT 1
    ";
    if ($forUpdate) {
        $sql .= " FOR UPDATE";
    }

    $stmt = $pdo->prepare($sql);
    $stmt->execute([$bookingId]);
    $booking = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$booking) {
        boarding_error(404, 'Booking not found.');
    }

    if (($booking['service_type'] ?? '') !== 'boarding') {
        boarding_error(400, 'This action is only available for pet hotel or boarding bookings.');
    }

    if (($booking['status'] ?? '') === 'cancelled') {
        boarding_error(409, 'Cancelled bookings cannot be assigned or checked in.');
    }

    boarding_assert_booking_branch_access($pdo, $booking);

    return $booking;
}

function fetch_active_assignment(PDO $pdo, int $bookingId, bool $forUpdate = false): ?array
{
    $sql = "
        SELECT *
        FROM boarding_assignments
        WHERE booking_id = ?
          AND status IN ('reserved', 'occupied')
        ORDER BY assignment_id DESC
        LIMIT 1
    ";
    if ($forUpdate) {
        $sql .= " FOR UPDATE";
    }

    $stmt = $pdo->prepare($sql);
    $stmt->execute([$bookingId]);
    $assignment = $stmt->fetch(PDO::FETCH_ASSOC);

    return $assignment ?: null;
}

function fetch_latest_assignment(PDO $pdo, int $bookingId): ?array
{
    $stmt = $pdo->prepare("
        SELECT *
        FROM boarding_assignments
        WHERE booking_id = ?
        ORDER BY assignment_id DESC
        LIMIT 1
    ");
    $stmt->execute([$bookingId]);
    $assignment = $stmt->fetch(PDO::FETCH_ASSOC);

    return $assignment ?: null;
}

function fetch_booking_pet_ids(PDO $pdo, array $booking): array
{
    $bookingId = (int)($booking['booking_id'] ?? 0);
    $petIds = [];

    if ($bookingId > 0 && boarding_table_exists($pdo, 'booking_pets')) {
        $stmt = $pdo->prepare("
            SELECT pet_id
            FROM booking_pets
            WHERE booking_id = ?
        ");
        $stmt->execute([$bookingId]);
        $petIds = array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));
    }

    if (empty($petIds) && !empty($booking['pet_id'])) {
        $petIds[] = (int)$booking['pet_id'];
    }

    return array_values(array_unique(array_filter($petIds, fn($petId) => $petId > 0)));
}

function boarding_requested_pet_id(array $input): ?int
{
    $value = $input['pet_id'] ?? $input['petId'] ?? null;
    if ($value === null || $value === '') {
        return null;
    }

    $petId = (int)$value;
    if ($petId <= 0) {
        boarding_error(400, 'A valid pet ID is required.');
    }

    return $petId;
}

function boarding_resolve_assignment_pet_id(PDO $pdo, array $assignment, array $input): ?int
{
    $allowedPetIds = fetch_booking_pet_ids($pdo, [
        'booking_id' => (int)($assignment['booking_id'] ?? 0),
        'pet_id' => $assignment['pet_id'] ?? null,
    ]);
    $requestedPetId = boarding_requested_pet_id($input);

    if ($requestedPetId !== null) {
        if (empty($allowedPetIds) || !in_array($requestedPetId, $allowedPetIds, true)) {
            boarding_error(409, 'The selected pet does not belong to this boarding booking.');
        }

        return $requestedPetId;
    }

    $assignmentPetId = (int)($assignment['pet_id'] ?? 0);
    if ($assignmentPetId > 0 && in_array($assignmentPetId, $allowedPetIds, true)) {
        return $assignmentPetId;
    }

    return count($allowedPetIds) === 1 ? $allowedPetIds[0] : null;
}

function assert_pets_not_in_active_boarding(PDO $pdo, array $petIds, int $excludeBookingId = 0): void
{
    $petIds = array_values(array_unique(array_filter(array_map('intval', $petIds), fn($petId) => $petId > 0)));
    if (empty($petIds)) {
        return;
    }

    $placeholders = implode(',', array_fill(0, count($petIds), '?'));
    $params = $petIds;
    $params[] = $excludeBookingId;

    $bookingPetsJoin = '';
    $petJoinExpression = 'b.pet_id';
    $petCondition = "b.pet_id IN ({$placeholders})";
    if (boarding_table_exists($pdo, 'booking_pets')) {
        $bookingPetsJoin = 'LEFT JOIN booking_pets bp ON bp.booking_id = b.booking_id';
        $petJoinExpression = 'COALESCE(bp.pet_id, b.pet_id)';
        $petCondition = "(bp.pet_id IN ({$placeholders}) OR b.pet_id IN ({$placeholders}))";
        $params = array_merge($petIds, $petIds, [$excludeBookingId]);
    }

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

    if ($conflict) {
        $roomLabel = room_type_label((string)$conflict['room_type']) . ' #' . (int)$conflict['room_number'];
        boarding_error(
            409,
            sprintf(
                '%s already has an active boarding stay in %s (%s). Check out the current stay before assigning another room.',
                $conflict['pet_name'] ?: 'Selected pet',
                $roomLabel,
                $conflict['booking_number'] ?: 'booking'
            )
        );
    }
}

function assert_pets_no_overlapping_boarding_booking(PDO $pdo, array $petIds, string $checkInDate, string $checkOutDate, int $excludeBookingId = 0): void
{
    $petIds = array_values(array_unique(array_filter(array_map('intval', $petIds), fn($petId) => $petId > 0)));
    if (empty($petIds)) {
        return;
    }

    $placeholders = implode(',', array_fill(0, count($petIds), '?'));
    $bookingPetsJoin = '';
    $petJoinExpression = 'b.pet_id';
    $petCondition = "b.pet_id IN ({$placeholders})";
    $params = $petIds;

    if (boarding_table_exists($pdo, 'booking_pets')) {
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
            b.check_out_date
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

    if ($conflict) {
        boarding_error(
            409,
            sprintf(
                '%s already has a boarding booking that overlaps this stay (%s).',
                $conflict['pet_name'] ?: 'Selected pet',
                $conflict['booking_number'] ?: 'booking'
            )
        );
    }
}

function assignment_response(PDO $pdo, int $bookingId): array
{
    $overstayRateSelect = boarding_column_exists($pdo, 'bookings', 'boarding_overstay_daily_rate')
        ? 'b.boarding_overstay_daily_rate'
        : 'NULL AS boarding_overstay_daily_rate';
    $stmt = $pdo->prepare("
        SELECT
            ba.*,
            b.booking_number,
            b.branch_id,
            b.pet_id,
            b.user_id AS owner_user_id,
            b.check_in_date,
            b.check_out_date,
            b.price,
            b.hotel_boarding_type,
            b.room_size,
            b.add_ons,
            {$overstayRateSelect},
            b.status AS booking_status,
            COALESCE(p.pet_name, b.unregistered_pet_name, 'Pet') AS pet_name,
            COALESCE(p.pet_species, b.petType, 'Pet') AS pet_species,
            CONCAT(u.first_Name, ' ', u.last_Name) AS owner_name
        FROM boarding_assignments ba
        JOIN bookings b ON b.booking_id = ba.booking_id
        LEFT JOIN pets_information p ON p.pet_id = b.pet_id
        JOIN users u ON u.user_id = b.user_id
        WHERE ba.booking_id = ?
        ORDER BY ba.assignment_id DESC
        LIMIT 1
    ");
    $stmt->execute([$bookingId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row) {
        return [];
    }

    $roomParts = split_room_type($row['room_type']);

    return [
        'assignmentId' => (int)$row['assignment_id'],
        'bookingId' => (int)$row['booking_id'],
        'bookingNumber' => $row['booking_number'],
        'branchId' => $row['branch_id'] !== null ? (int)$row['branch_id'] : null,
        'petId' => $row['pet_id'] !== null ? (int)$row['pet_id'] : null,
        'ownerUserId' => $row['owner_user_id'] !== null ? (int)$row['owner_user_id'] : null,
        'roomType' => $row['room_type'],
        'hotelBoardingType' => $roomParts['hotel_boarding_type'],
        'roomSize' => $roomParts['room_size'],
        'roomNumber' => (int)$row['room_number'],
        'roomLabel' => room_type_label($row['room_type']) . ' #' . $row['room_number'],
        'status' => $row['status'],
        'reservedAt' => $row['reserved_at'],
        'actualCheckInAt' => $row['actual_check_in_at'],
        'actualCheckOutAt' => $row['actual_check_out_at'],
        'desiredCheckOutDate' => $row['desired_check_out_date'] ?: $row['check_out_date'],
        'checkInDate' => $row['check_in_date'],
        'checkOutDate' => $row['check_out_date'],
        'price' => $row['price'],
        'overstayDailyRate' => boarding_calculate_overstay_daily_rate($row),
        'petName' => $row['pet_name'],
        'petSpecies' => $row['pet_species'],
        'ownerName' => $row['owner_name'],
        'bookingStatus' => $row['booking_status'],
    ];
}

function upsert_assignment(PDO $pdo, array $booking, string $roomType, int $roomNumber, string $status): void
{
    $bookingId = (int)$booking['booking_id'];
    $assignment = fetch_active_assignment($pdo, $bookingId, true);
    $desiredOut = $booking['check_out_date'] ?? null;

    if ($assignment) {
        if (($assignment['status'] ?? '') === 'occupied' && $status === 'reserved') {
            boarding_error(409, 'This booking is already checked in and cannot be moved back to reserved.');
        }

        $stmt = $pdo->prepare("
            UPDATE boarding_assignments
            SET room_type = ?,
                room_number = ?,
                branch_id = ?,
                status = ?,
                reserved_at = COALESCE(reserved_at, NOW()),
                desired_check_out_date = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE assignment_id = ?
        ");
        $stmt->execute([$roomType, $roomNumber, (int)$booking['branch_id'], $status, $desiredOut, (int)$assignment['assignment_id']]);
        return;
    }

    $stmt = $pdo->prepare("
        INSERT INTO boarding_assignments (
            booking_id,
            branch_id,
            room_type,
            room_number,
            status,
            reserved_at,
            desired_check_out_date
        ) VALUES (?, ?, ?, ?, ?, NOW(), ?)
    ");
    $stmt->execute([$bookingId, (int)$booking['branch_id'], $roomType, $roomNumber, $status, $desiredOut]);
}

function boarding_consent_candidate_path(?string $path): ?string
{
    if ($path === null) {
        return null;
    }

    $parsedPath = parse_url(trim($path), PHP_URL_PATH);
    $cleanPath = ltrim(str_replace('\\', '/', is_string($parsedPath) ? $parsedPath : $path), '/');
    $cleanPath = preg_replace('#^(?:api/uploads/media/|public/)#i', '', $cleanPath);
    if (!preg_match('#^signatures/([A-Za-z0-9._-]+\.pdf)$#i', $cleanPath, $matches)) {
        return null;
    }

    return 'signatures/' . $matches[1];
}

function boarding_consent_pdf_path(?string $path): ?string
{
    $candidatePath = boarding_consent_candidate_path($path);
    if ($candidatePath === null) return null;

    $signatureRoot = realpath(__DIR__ . '/../public/signatures');
    $realPath = realpath(__DIR__ . '/../public/' . $candidatePath);
    if ($signatureRoot === false || $realPath === false || !is_file($realPath)) {
        return null;
    }

    $rootPrefix = rtrim($signatureRoot, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR;
    if (strpos($realPath, $rootPrefix) !== 0) {
        return null;
    }

    $finfo = new finfo(FILEINFO_MIME_TYPE);
    if ($finfo->file($realPath) !== 'application/pdf') {
        return null;
    }

    return 'signatures/' . basename($realPath);
}

function boarding_secure_database_now(PDO $pdo): string
{
    $timestamp = $pdo->query('SELECT NOW()')->fetchColumn();
    return is_string($timestamp) && $timestamp !== '' ? $timestamp : date('Y-m-d H:i:s');
}

function boarding_secure_template_by_id(PDO $pdo, ?int $fileId, bool $requireCurrentContext): ?array
{
    consent_file_ensure_schema($pdo);
    if ($fileId === null || $fileId <= 0) return null;

    $stmt = $pdo->prepare('SELECT file_id, file_name, content, category, pet_owner_contexts FROM consent_files WHERE file_id = ? LIMIT 1');
    $stmt->execute([$fileId]);
    $template = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$template) return null;
    if ($requireCurrentContext && !in_array('boarding', consent_file_context_array($template['pet_owner_contexts'] ?? null), true)) {
        return null;
    }
    return $template;
}

function boarding_secure_selected_template(PDO $pdo, array $input): array
{
    $fileId = consent_record_file_id(
        $input['consent_file_id']
            ?? $input['consentFileId']
            ?? ($input['consent_form']['id'] ?? null)
            ?? ($input['consentForm']['id'] ?? null)
    );
    if ($fileId === null) {
        boarding_error(422, 'Select the assigned boarding consent template.', ['code' => 'boarding_consent_template_required']);
    }
    $template = boarding_secure_template_by_id($pdo, $fileId, true);
    if (!$template) {
        boarding_error(422, 'The selected consent template is not assigned to Boarding.');
    }
    return $template;
}

function boarding_secure_consent_context(PDO $pdo, array $booking): array
{
    $bookingId = (int)($booking['booking_id'] ?? 0);
    $ownerUserId = (int)($booking['user_id'] ?? $booking['owner_user_id'] ?? 0);
    $petIds = fetch_booking_pet_ids($pdo, $booking);
    if ($ownerUserId <= 0) {
        boarding_error(409, 'The boarding booking must be linked to a pet owner before consent can be recorded.');
    }
    if (empty($petIds)) {
        boarding_error(409, 'The boarding booking must include a registered pet before consent can be recorded.');
    }

    $ownerStmt = $pdo->prepare('SELECT first_Name, last_Name FROM users WHERE user_id = ? LIMIT 1');
    $ownerStmt->execute([$ownerUserId]);
    $owner = $ownerStmt->fetch(PDO::FETCH_ASSOC);
    if (!$owner) {
        boarding_error(409, 'The pet owner linked to this boarding booking could not be verified.');
    }

    $ownershipStmt = $pdo->prepare('SELECT COUNT(*) FROM pet_ownership WHERE user_id = ? AND pet_id = ?');
    foreach ($petIds as $petId) {
        $ownershipStmt->execute([$ownerUserId, $petId]);
        if ((int)$ownershipStmt->fetchColumn() <= 0) {
            boarding_error(409, 'The boarding pet and owner linkage could not be verified.');
        }
    }

    $ownerName = trim((string)($owner['first_Name'] ?? '') . ' ' . (string)($owner['last_Name'] ?? ''));
    return [
        'booking_id' => $bookingId,
        'owner_user_id' => $ownerUserId,
        'owner_name' => $ownerName !== '' ? $ownerName : 'Pet owner',
        'pet_ids' => array_values(array_unique(array_map('intval', $petIds))),
    ];
}

function boarding_secure_path_references(PDO $pdo, string $path): array
{
    $pattern = '%' . basename($path) . '%';
    $bookingStmt = $pdo->prepare("\n        SELECT booking_id, user_id, pet_id, signature_path, consent_forms\n        FROM bookings\n        WHERE signature_path LIKE ? OR consent_forms LIKE ?\n        FOR UPDATE\n    ");
    $bookingStmt->execute([$pattern, $pattern]);
    $bookings = [];
    foreach ($bookingStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $paths = [boarding_consent_pdf_path(consent_record_nullable_text($row['signature_path'] ?? null))];
        foreach (consent_record_forms_from_value($row['consent_forms'] ?? null) as $form) {
            if (!is_array($form)) continue;
            $paths[] = boarding_consent_pdf_path(consent_record_form_signed_document_path($form));
            $paths[] = boarding_consent_pdf_path(consent_record_form_physical_document_path($form));
        }
        if (in_array($path, array_filter($paths), true)) $bookings[] = $row;
    }

    $records = [];
    if (consent_record_table_exists($pdo)) {
        $recordStmt = $pdo->prepare("\n            SELECT consent_record_id, consent_file_id, consent_type, owner_user_id, pet_id,\n                   booking_id, service_name, status, signed_at, signed_file_path, physical_file_path\n            FROM consent_form_records\n            WHERE signed_file_path LIKE ? OR physical_file_path LIKE ?\n            ORDER BY consent_record_id DESC\n            FOR UPDATE\n        ");
        $recordStmt->execute([$pattern, $pattern]);
        foreach ($recordStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $signedPath = boarding_consent_pdf_path(consent_record_nullable_text($row['signed_file_path'] ?? null));
            $physicalPath = boarding_consent_pdf_path(consent_record_nullable_text($row['physical_file_path'] ?? null));
            if ($signedPath === $path || $physicalPath === $path) $records[] = $row;
        }
    }
    return ['bookings' => $bookings, 'records' => $records];
}

function boarding_secure_reference_scope_matches(array $references, array $context): bool
{
    $bookingId = (int)$context['booking_id'];
    $ownerUserId = (int)$context['owner_user_id'];
    $petIds = array_map('intval', $context['pet_ids']);
    foreach ($references['bookings'] as $reference) {
        if ($bookingId <= 0 || (int)($reference['booking_id'] ?? 0) !== $bookingId) {
            return false;
        }
        if ((int)($reference['user_id'] ?? 0) !== $ownerUserId) {
            return false;
        }
    }
    foreach ($references['records'] as $reference) {
        if ($bookingId <= 0 || (int)($reference['booking_id'] ?? 0) !== $bookingId) {
            return false;
        }
        $recordPetId = (int)($reference['pet_id'] ?? 0);
        if (
            (int)($reference['owner_user_id'] ?? 0) !== $ownerUserId
            || $recordPetId <= 0
            || !in_array($recordPetId, $petIds, true)
        ) {
            return false;
        }
    }
    return true;
}

function boarding_secure_assert_reference_scope(array $references, array $context, bool $mustBeUnreferenced): void
{
    if ($mustBeUnreferenced && (!empty($references['bookings']) || !empty($references['records']))) {
        boarding_error(409, 'This consent PDF is already linked and cannot be reused for another boarding record.');
    }
    if (!boarding_secure_reference_scope_matches($references, $context)) {
        boarding_error(409, 'This consent PDF belongs to another booking, owner, or pet and cannot be reused.');
    }
}

function boarding_secure_existing_template(PDO $pdo, array $form, array $records): ?array
{
    $fileId = consent_record_file_id($form['id'] ?? $form['file_id'] ?? $form['fileId'] ?? null);
    $template = boarding_secure_template_by_id($pdo, $fileId, true);
    $formDeclaresBoarding = in_array(
        strtolower(trim((string)($form['serviceType'] ?? $form['service_type'] ?? $form['category'] ?? ''))),
        ['boarding', 'pet boarding', 'pet hotel & boarding'],
        true
    );
    $hasBoardingRecord = false;
    foreach ($records as $record) {
        if (strcasecmp(trim((string)($record['service_name'] ?? '')), 'Boarding') === 0) {
            $hasBoardingRecord = true;
            break;
        }
    }
    if ($template && ($formDeclaresBoarding || $hasBoardingRecord)) return $template;

    // Safe legacy policy: an unassigned/deleted historical template is only
    // accepted when a durable record already binds this PDF to Boarding.
    foreach ($records as $record) {
        if (strcasecmp(trim((string)($record['service_name'] ?? '')), 'Boarding') !== 0) continue;
        $recordFileId = consent_record_file_id($record['consent_file_id'] ?? null);
        if ($fileId !== null && $recordFileId !== null && $fileId !== $recordFileId) continue;
        return [
            'file_id' => $recordFileId,
            'file_name' => consent_record_nullable_text($record['consent_type'] ?? null) ?: 'Boarding Consent',
            'content' => '',
            'category' => 'boarding',
        ];
    }
    return null;
}

function boarding_secure_existing_candidate(
    PDO $pdo,
    array $context,
    array $forms,
    array $form,
    string $path,
    bool $physical,
    bool $needsProjectionSync = false
): ?array {
    $references = boarding_secure_path_references($pdo, $path);
    if (!boarding_secure_reference_scope_matches($references, $context)) return null;
    if (empty($references['bookings']) && empty($references['records'])) return null;

    $template = boarding_secure_existing_template($pdo, $form, $references['records']);
    if (!$template) return null;
    $record = $references['records'][0] ?? [];
    $serverRecordedAt = consent_record_datetime_or_null($record['signed_at'] ?? null) ?: boarding_secure_database_now($pdo);
    $recordForm = [
        'id' => consent_record_file_id($template['file_id'] ?? null),
        'title' => $template['file_name'] ?? 'Boarding Consent',
        'category' => $template['category'] ?? 'boarding',
        'content' => $template['content'] ?? '',
        'signerName' => $context['owner_name'],
        'signedAt' => $serverRecordedAt,
        'serviceType' => 'Boarding',
    ];
    if ($physical) $recordForm['physicalConsentPath'] = $path;
    else $recordForm['documentPath'] = $path;
    return [
        'forms' => $forms,
        'record_form' => $recordForm,
        'signed_document_path' => $physical ? null : $path,
        'physical_consent_path' => $physical ? $path : null,
        'is_new' => false,
        'needs_projection_sync' => $needsProjectionSync,
        'context' => $context,
        'lock_name' => null,
    ];
}

function boarding_secure_existing_consent(PDO $pdo, array $booking, array $context): ?array
{
    $forms = consent_record_normalize_booking_forms(
        $booking['consent_forms'] ?? null,
        consent_record_nullable_text($booking['signature_path'] ?? null),
        null
    );
    $bookingSignature = consent_record_nullable_text($booking['signature_path'] ?? null);
    $bookingSignaturePath = boarding_consent_pdf_path($bookingSignature);
    foreach ($forms as $formIndex => $form) {
        if (!is_array($form)) continue;
        $signedPath = boarding_consent_pdf_path(consent_record_form_signed_document_path($form));
        $physicalPath = boarding_consent_pdf_path(consent_record_form_physical_document_path($form));
        if ($signedPath !== null) {
            $needsProjectionSync = $formIndex !== 0
                || ($bookingSignature !== null && $bookingSignaturePath !== $signedPath);
            $candidate = boarding_secure_existing_candidate(
                $pdo,
                $context,
                $forms,
                $form,
                $signedPath,
                false,
                $needsProjectionSync
            );
            if ($candidate) return $candidate;
        }
        if ($physicalPath !== null) {
            $needsProjectionSync = $formIndex !== 0 || $bookingSignature !== null;
            $candidate = boarding_secure_existing_candidate(
                $pdo,
                $context,
                $forms,
                $form,
                $physicalPath,
                true,
                $needsProjectionSync
            );
            if ($candidate) return $candidate;
        }
    }

    if ((int)$context['booking_id'] <= 0 || !consent_record_table_exists($pdo)) return null;
    $stmt = $pdo->prepare("\n        SELECT consent_record_id, consent_file_id, consent_type, owner_user_id, pet_id, booking_id,\n               service_name, status, signed_at, signed_file_path, physical_file_path\n        FROM consent_form_records\n        WHERE booking_id = ? AND status = 'signed'\n          AND LOWER(COALESCE(service_name, '')) = 'boarding'\n        ORDER BY consent_record_id DESC\n    ");
    $stmt->execute([(int)$context['booking_id']]);
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $record) {
        $form = ['id' => $record['consent_file_id'] ?? null, 'title' => $record['consent_type'] ?? 'Boarding Consent'];
        $signedPath = boarding_consent_pdf_path(consent_record_nullable_text($record['signed_file_path'] ?? null));
        $physicalPath = boarding_consent_pdf_path(consent_record_nullable_text($record['physical_file_path'] ?? null));
        $path = $signedPath ?: $physicalPath;
        if ($path === null) continue;
        $candidate = boarding_secure_existing_candidate(
            $pdo,
            $context,
            array_merge($forms, [$form]),
            $form,
            $path,
            $signedPath === null,
            true
        );
        if ($candidate) return $candidate;
    }
    return null;
}

function boarding_secure_input_receipt(array $input, bool $physical): string
{
    $keys = $physical
        ? ['physical_consent_receipt', 'physicalConsentReceipt']
        : ['signed_document_receipt', 'signedDocumentReceipt', 'consent_document_receipt', 'consentDocumentReceipt'];
    $keys = array_merge($keys, ['upload_receipt', 'uploadReceipt']);
    foreach ($keys as $key) {
        $receipt = trim((string)($input[$key] ?? ''));
        if ($receipt !== '') return $receipt;
    }
    return '';
}

function boarding_secure_consent_payload(PDO $pdo, array $input, array $booking, string $requiredMessage): array
{
    $context = boarding_secure_consent_context($pdo, $booking);
    $existing = boarding_secure_existing_consent($pdo, $booking, $context);
    if ($existing) return $existing;

    $signedPath = boarding_consent_candidate_path(consent_record_nullable_text(
        $input['signed_document_path'] ?? $input['signedDocumentPath'] ?? $input['consent_document_path'] ?? null
    ));
    $physicalPath = boarding_consent_candidate_path(consent_record_nullable_text(
        $input['physical_consent_path'] ?? $input['physicalConsentPath'] ?? null
    ));
    if ($signedPath === null && $physicalPath === null) {
        boarding_error(422, $requiredMessage, ['code' => 'boarding_consent_required']);
    }
    if ($signedPath !== null && $physicalPath !== null) {
        boarding_error(422, 'Submit either a signed consent PDF or an uploaded completed consent PDF, not both.');
    }

    $template = boarding_secure_selected_template($pdo, $input);
    $actor = boarding_current_actor($pdo);
    $path = $signedPath ?: $physicalPath;
    $physical = $signedPath === null;
    $receipt = boarding_secure_input_receipt($input, $physical);
    $receiptClaims = [
        'consent_context' => 'boarding',
        'consent_file_id' => (int)$template['file_id'],
    ];
    if ((int)$context['booking_id'] > 0) {
        $receiptClaims['booking_id'] = (int)$context['booking_id'];
    } else {
        $receiptClaims['pet_id'] = (int)($context['pet_ids'][0] ?? 0);
    }
    if (!ipawcus_upload_receipt_verify(
        $receipt,
        $path,
        (int)$actor['user_id'],
        'consent_document',
        null,
        $receiptClaims
    )) {
        boarding_error(422, 'The consent upload authorization is missing or expired. Upload the PDF again.', [
            'code' => 'boarding_consent_upload_receipt_required',
        ]);
    }

    $lockName = 'ipawcus_consent_' . md5($path);
    if (!boarding_named_lock_acquire($pdo, $lockName)) {
        boarding_error(409, 'This consent PDF is currently being processed. Please try again.');
    }

    $verifiedPath = boarding_consent_pdf_path($path);
    if ($verifiedPath === null || !hash_equals($path, $verifiedPath)) {
        boarding_error(422, 'The uploaded consent PDF is no longer available. Upload it again.', [
            'code' => 'boarding_consent_required',
        ]);
    }
    if ($physical) $physicalPath = $verifiedPath;
    else $signedPath = $verifiedPath;
    boarding_secure_assert_reference_scope(boarding_secure_path_references($pdo, $path), $context, true);

    $signedAt = boarding_secure_database_now($pdo);
    $form = [
        'id' => (int)$template['file_id'],
        'title' => $template['file_name'],
        'category' => $template['category'] ?? 'boarding',
        'content' => $template['content'] ?? '',
        'signerName' => $context['owner_name'],
        'signedAt' => $signedAt,
        'serviceType' => 'Boarding',
        'processedByUserId' => (int)$actor['user_id'],
        'processedByName' => $actor['name'],
    ];
    if ($physical) $form['physicalConsentPath'] = $physicalPath;
    else $form['documentPath'] = $signedPath;
    return [
        'forms' => [$form],
        'record_form' => $form,
        'signed_document_path' => $signedPath,
        'physical_consent_path' => $physicalPath,
        'is_new' => true,
        'needs_projection_sync' => false,
        'context' => $context,
        'actor' => $actor,
        'lock_name' => $lockName,
    ];
}

function boarding_secure_save_consent_records(PDO $pdo, array $booking, array $consent, string $notes): void
{
    if (!consent_record_table_exists($pdo)) throw new RuntimeException('Consent record storage is unavailable.');
    $form = $consent['record_form'];
    $context = $consent['context'] ?? boarding_secure_consent_context($pdo, $booking);
    $actor = $consent['actor'] ?? boarding_current_actor($pdo);
    $path = $consent['signed_document_path'] ?: $consent['physical_consent_path'];
    $references = boarding_secure_path_references($pdo, $path);
    boarding_secure_assert_reference_scope($references, $context, false);

    foreach ($context['pet_ids'] as $petId) {
        $alreadyLinked = false;
        foreach ($references['records'] as $reference) {
            if ((int)$reference['booking_id'] === (int)$context['booking_id'] && (int)$reference['pet_id'] === (int)$petId) {
                $alreadyLinked = true;
                break;
            }
        }
        if ($alreadyLinked) continue;
        $stmt = $pdo->prepare("\n            INSERT INTO consent_form_records (\n                consent_file_id, consent_type, owner_user_id, pet_id, booking_id, service_name,\n                status, source, requested_at, signed_at, signed_file_path, physical_file_path,\n                signer_name, processed_by_user_id, processed_by_name, notes\n            ) VALUES (?, ?, ?, ?, ?, 'Boarding', 'signed', 'booking', ?, ?, ?, ?, ?, ?, ?, ?)\n        ");
        $stmt->execute([
            consent_record_file_id($form['id'] ?? null),
            $form['title'] ?? 'Boarding Consent',
            (int)$context['owner_user_id'],
            (int)$petId,
            (int)$context['booking_id'],
            $form['signedAt'],
            $form['signedAt'],
            $consent['signed_document_path'],
            $consent['physical_consent_path'],
            $context['owner_name'],
            (int)$actor['user_id'],
            $actor['name'],
            $notes,
        ]);
        if ((int)$pdo->lastInsertId() <= 0) throw new RuntimeException('Boarding consent linkage failed.');
    }
}

function boarding_secure_preserved_forms(array $booking, array $consent): array
{
    $forms = consent_record_forms_from_value($booking['consent_forms'] ?? null);
    $legacyPath = consent_record_nullable_text($booking['signature_path'] ?? null);
    $legacyCandidatePath = boarding_consent_candidate_path($legacyPath);
    $newPath = $consent['signed_document_path'] ?: $consent['physical_consent_path'];
    $historicalForms = [];
    $legacyPathRepresented = false;
    foreach ($forms as $form) {
        if (!is_array($form)) continue;
        $rawFormPaths = [
            consent_record_form_signed_document_path($form),
            consent_record_form_physical_document_path($form),
            consent_record_form_legacy_signature_path($form),
        ];
        $formPaths = [
            boarding_consent_candidate_path($rawFormPaths[0]),
            boarding_consent_candidate_path($rawFormPaths[1]),
            boarding_consent_candidate_path($rawFormPaths[2]),
        ];
        if (in_array($newPath, $formPaths, true)) continue;
        if (
            $legacyPath !== null
            && (
                in_array($legacyPath, $rawFormPaths, true)
                || ($legacyCandidatePath !== null && in_array($legacyCandidatePath, $formPaths, true))
            )
        ) {
            $legacyPathRepresented = true;
        }
        $historicalForms[] = $form;
    }
    if (
        $legacyPath !== null
        && $legacyCandidatePath !== $newPath
        && !$legacyPathRepresented
    ) {
        $historicalForms[] = [
            'title' => 'Previous boarding consent artifact',
            'legacySignaturePath' => $legacyPath,
        ];
    }
    return consent_record_demote_signature_only_paths(array_merge([$consent['record_form']], $historicalForms));
}

function boarding_secure_store_booking_consent(
    PDO $pdo,
    array $booking,
    array $input,
    string $requiredMessage,
    string $notes
): array {
    $consent = boarding_secure_consent_payload($pdo, $input, $booking, $requiredMessage);
    if ($consent['is_new'] || !empty($consent['needs_projection_sync'])) {
        $forms = boarding_secure_preserved_forms($booking, $consent);
        // signature_path is only the current digital projection. Physical
        // replacements intentionally clear it; older artifacts remain in the
        // immutable forms/record history instead of winning preview priority.
        $signaturePath = $consent['signed_document_path'];
        $stmt = $pdo->prepare("\n            UPDATE bookings\n            SET consent_forms = ?, consent_status = 'signed', signature_path = ?\n            WHERE booking_id = ?\n        ");
        $stmt->execute([
            json_encode($forms, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
            $signaturePath,
            (int)$booking['booking_id'],
        ]);
    }
    boarding_secure_save_consent_records($pdo, $booking, $consent, $notes);
    return $consent;
}

function assign_room_action(PDO $pdo): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        boarding_error(405, 'Method not allowed.');
    }

    $input = boarding_json_input();
    $branchId = boarding_branch_id($pdo, $input);
    $bookingId = isset($_GET['bookingId']) ? (int)$_GET['bookingId'] : 0;
    if ($bookingId <= 0) {
        boarding_error(400, 'Booking ID is required.');
    }

    $roomLockName = null;
    $consentLockName = null;
    $pdo->beginTransaction();
    try {
        $booking = fetch_boarding_booking($pdo, $bookingId, true);
        $consent = boarding_secure_store_booking_consent(
            $pdo,
            $booking,
            $input,
            'A completed boarding consent PDF is required before assigning a room.',
            'Captured and verified during boarding room assignment.'
        );
        $consentLockName = $consent['lock_name'] ?? null;
        $branchId = (int)$booking['branch_id'];
        $roomType = normalize_room_type($booking['hotel_boarding_type'] ?? null, $booking['room_size'] ?? null);
        $checkIn = (string)($booking['check_in_date'] ?? '');
        $checkOut = (string)($booking['check_out_date'] ?? '');

        if ($checkIn === '' || $checkOut === '' || strtotime($checkOut) <= strtotime($checkIn)) {
            boarding_error(400, 'Booking stay dates are invalid.');
        }

        $bookingPetIds = fetch_booking_pet_ids($pdo, $booking);
        assert_pets_not_in_active_boarding($pdo, $bookingPetIds, $bookingId);
        assert_pets_no_overlapping_boarding_booking($pdo, $bookingPetIds, $checkIn, $checkOut, $bookingId);

        $roomLockName = 'ipawcus_room_' . md5($branchId . '|' . $roomType);
        if (!boarding_named_lock_acquire($pdo, $roomLockName)) {
            boarding_error(409, 'Room availability is being updated by another booking. Refresh the rooms and try again.');
        }

        $availableRooms = get_available_room_numbers($pdo, $roomType, $checkIn, $checkOut, $bookingId, $branchId);
        $requestedRoom = isset($input['room_number']) && $input['room_number'] !== ''
            ? (int)$input['room_number']
            : null;
        $roomNumber = $requestedRoom ?: ($availableRooms[0] ?? 0);

        if ($roomNumber <= 0 || !in_array($roomNumber, $availableRooms, true)) {
            boarding_error(409, 'Selected room or kennel is not available for this stay.');
        }

        upsert_assignment($pdo, $booking, $roomType, $roomNumber, 'reserved');

        $stmt = $pdo->prepare("UPDATE bookings SET status = 'confirmed' WHERE booking_id = ?");
        $stmt->execute([$bookingId]);

        $pdo->commit();
        boarding_named_lock_release($pdo, $roomLockName);
        $roomLockName = null;
        boarding_named_lock_release($pdo, $consentLockName);
        $consentLockName = null;

        try {
            notification_send_booking_event($pdo, $bookingId, 'confirmed');
        } catch (Throwable $notificationError) {
            error_log('Boarding approval notification failed: ' . $notificationError->getMessage());
        }

        echo json_encode([
            'message' => 'Booking approved and room reserved.',
            'assignment' => assignment_response($pdo, $bookingId),
        ]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        boarding_named_lock_release($pdo, $roomLockName);
        boarding_named_lock_release($pdo, $consentLockName);
        boarding_internal_failure('assign room failed', $e, 'The room could not be assigned. Please try again.');
    }
}

function check_in_action(PDO $pdo): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        boarding_error(405, 'Method not allowed.');
    }

    $input = boarding_json_input();
    $bookingId = isset($_GET['bookingId']) ? (int)$_GET['bookingId'] : 0;
    if ($bookingId <= 0) {
        boarding_error(400, 'Booking ID is required.');
    }

    $roomLockName = null;
    $consentLockName = null;
    $pdo->beginTransaction();
    try {
        $booking = fetch_boarding_booking($pdo, $bookingId, true);
        $consent = boarding_secure_store_booking_consent(
            $pdo,
            $booking,
            $input,
            'A completed boarding consent PDF is required before check-in.',
            'Verified during boarding check-in.'
        );
        $consentLockName = $consent['lock_name'] ?? null;
        boarding_assert_booking_branch_access($pdo, $booking);
        $branchId = (int)$booking['branch_id'];
        $roomType = normalize_room_type($booking['hotel_boarding_type'] ?? null, $booking['room_size'] ?? null);
        $checkIn = (string)($booking['check_in_date'] ?? date('Y-m-d'));
        $checkOut = (string)($booking['check_out_date'] ?? '');
        if ($checkOut === '') {
            boarding_error(400, 'Check-out date is required before check-in.');
        }

        $bookingPetIds = fetch_booking_pet_ids($pdo, $booking);
        assert_pets_not_in_active_boarding($pdo, $bookingPetIds, $bookingId);
        assert_pets_no_overlapping_boarding_booking($pdo, $bookingPetIds, $checkIn, $checkOut, $bookingId);

        $roomLockName = 'ipawcus_room_' . md5($branchId . '|' . $roomType);
        if (!boarding_named_lock_acquire($pdo, $roomLockName)) {
            boarding_error(409, 'Room availability is being updated by another check-in. Refresh the rooms and try again.');
        }

        $assignment = fetch_active_assignment($pdo, $bookingId, true);
        if (!$assignment) {
            $availableRooms = get_available_room_numbers($pdo, $roomType, $checkIn, $checkOut, $bookingId, $branchId);
            $roomNumber = $availableRooms[0] ?? 0;
            if ($roomNumber <= 0) {
                boarding_error(409, 'No room or kennel is available for this stay.');
            }
            upsert_assignment($pdo, $booking, $roomType, $roomNumber, 'reserved');
            $assignment = fetch_active_assignment($pdo, $bookingId, true);
        }

        if (!$assignment) {
            boarding_error(500, 'Unable to create room assignment.');
        }

        $maintenanceRooms = get_maintenance_room_numbers($pdo, (string)$assignment['room_type'], $branchId);
        if (in_array((int)$assignment['room_number'], $maintenanceRooms, true)) {
            boarding_error(409, 'This room or kennel is under maintenance.');
        }

        $stmt = $pdo->prepare("
            UPDATE boarding_assignments
            SET status = 'occupied',
                actual_check_in_at = COALESCE(actual_check_in_at, NOW()),
                desired_check_out_date = COALESCE(desired_check_out_date, ?),
                updated_at = CURRENT_TIMESTAMP
            WHERE assignment_id = ?
        ");
        $stmt->execute([$checkOut, (int)$assignment['assignment_id']]);

        $bookingStmt = $pdo->prepare("UPDATE bookings SET status = 'confirmed' WHERE booking_id = ?");
        $bookingStmt->execute([$bookingId]);

        $pdo->commit();
        boarding_named_lock_release($pdo, $roomLockName);
        $roomLockName = null;
        boarding_named_lock_release($pdo, $consentLockName);
        $consentLockName = null;

        try {
            notification_send_boarding_event($pdo, $bookingId, 'checked_in', [
                'room_label' => (string)$assignment['room_type'] . ' #' . (int)$assignment['room_number'],
            ]);
        } catch (Throwable $notificationError) {
            error_log('Boarding check-in notification failed: ' . $notificationError->getMessage());
        }

        echo json_encode([
            'message' => 'Pet checked in successfully.',
            'assignment' => assignment_response($pdo, $bookingId),
        ]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        boarding_named_lock_release($pdo, $roomLockName);
        boarding_named_lock_release($pdo, $consentLockName);
        boarding_internal_failure('reserved check-in failed', $e, 'The pet could not be checked in. Please try again.');
    }
}

function desired_check_out_action(PDO $pdo): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'PATCH') {
        boarding_error(405, 'Method not allowed.');
    }

    $input = boarding_json_input();
    $bookingId = isset($_GET['bookingId']) ? (int)$_GET['bookingId'] : 0;
    $newCheckOut = $input['check_out_date'] ?? $input['desired_check_out_date'] ?? null;

    if ($bookingId <= 0 || !$newCheckOut) {
        boarding_error(400, 'Booking ID and check_out_date are required.');
    }

    $roomLockName = null;
    $pdo->beginTransaction();
    try {
        $booking = fetch_boarding_booking($pdo, $bookingId, true);
        $assignment = fetch_active_assignment($pdo, $bookingId, true);
        if (!$assignment) {
            boarding_error(404, 'Room assignment not found.');
        }

        $startDate = $assignment['actual_check_in_at']
            ? substr((string)$assignment['actual_check_in_at'], 0, 10)
            : (string)$booking['check_in_date'];

        if (strtotime((string)$newCheckOut) <= strtotime($startDate)) {
            boarding_error(400, 'Desired out date must be after check-in date.');
        }

        $roomLockName = 'ipawcus_room_' . md5((int)$booking['branch_id'] . '|' . (string)$assignment['room_type']);
        if (!boarding_named_lock_acquire($pdo, $roomLockName)) {
            boarding_error(409, 'Room availability is being updated by another stay. Refresh the rooms and try again.');
        }

        $bookingPetIds = fetch_booking_pet_ids($pdo, $booking);
        assert_pets_not_in_active_boarding($pdo, $bookingPetIds, $bookingId);
        assert_pets_no_overlapping_boarding_booking($pdo, $bookingPetIds, $startDate, (string)$newCheckOut, $bookingId);

        $available = get_available_room_numbers(
            $pdo,
            (string)$assignment['room_type'],
            $startDate,
            (string)$newCheckOut,
            $bookingId,
            (int)$booking['branch_id']
        );

        if (!in_array((int)$assignment['room_number'], $available, true)) {
            boarding_error(409, 'This desired out date conflicts with another room reservation.');
        }

        $stmt = $pdo->prepare("
            UPDATE bookings
            SET check_out_date = ?
            WHERE booking_id = ?
        ");
        $stmt->execute([$newCheckOut, $bookingId]);

        $assignmentStmt = $pdo->prepare("
            UPDATE boarding_assignments
            SET desired_check_out_date = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE assignment_id = ?
        ");
        $assignmentStmt->execute([$newCheckOut, (int)$assignment['assignment_id']]);

        $pdo->commit();
        boarding_named_lock_release($pdo, $roomLockName);
        $roomLockName = null;

        echo json_encode([
            'message' => 'Desired out date updated.',
            'assignment' => assignment_response($pdo, $bookingId),
        ]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        boarding_named_lock_release($pdo, $roomLockName);
        boarding_internal_failure('desired check-out update failed', $e, 'The desired check-out date could not be updated. Please try again.');
    }
}

function boarding_assert_checkout_billing_ready(PDO $pdo, int $bookingId): void
{
    $billingTables = ['visits', 'visit_charges', 'visit_payments'];
    foreach ($billingTables as $tableName) {
        if (!boarding_table_exists($pdo, $tableName)) {
            boarding_error(
                409,
                'Checkout is unavailable until the visit billing migration is installed. Run DDL/20260723_01_backend_integrity_schema.sql.'
            );
        }
    }

    if (!boarding_material_billing_trace_ready($pdo)) {
        boarding_error(
            409,
            'Checkout is unavailable until the boarding material billing trace migration is installed. Run DDL/20260723_01_backend_integrity_schema.sql.'
        );
    }

    $visitStmt = $pdo->prepare("
        SELECT visit_id, billing_status
        FROM visits
        WHERE booking_id = ?
          AND visit_status <> 'cancelled'
        ORDER BY visit_id ASC
        FOR UPDATE
    ");
    $visitStmt->execute([$bookingId]);
    $visitRows = $visitStmt->fetchAll(PDO::FETCH_ASSOC);
    $visitIds = array_map(
        fn(array $visit): int => (int)$visit['visit_id'],
        $visitRows
    );

    if (empty($visitIds)) {
        boarding_error(409, 'Create and settle the boarding invoice before checking this pet out.');
    }
    if (array_filter($visitRows, fn(array $visit): bool => ($visit['billing_status'] ?? '') === 'refunded')) {
        boarding_error(409, 'A refunded boarding invoice must be resolved before checkout.');
    }

    $unbilledMaterialStmt = $pdo->prepare("
        SELECT bmu.usage_id, bmu.item_name
        FROM boarding_material_usages bmu
        LEFT JOIN visit_charges vc
          ON vc.boarding_material_usage_id = bmu.usage_id
        LEFT JOIN visits v
          ON v.visit_id = vc.visit_id
         AND v.booking_id = bmu.booking_id
         AND v.visit_status <> 'cancelled'
        WHERE bmu.booking_id = ?
          AND bmu.status = 'recorded'
          AND (
              vc.charge_id IS NULL
              OR v.visit_id IS NULL
              OR NOT (vc.item_id <=> bmu.item_id)
              OR ABS(vc.quantity - bmu.quantity) > 0.0001
              OR ABS(vc.unit_price - bmu.unit_price) > 0.009
              OR ABS(vc.subtotal - ROUND(bmu.quantity * bmu.unit_price, 2)) > 0.009
          )
        ORDER BY bmu.usage_id ASC
        LIMIT 1
    ");
    $unbilledMaterialStmt->execute([$bookingId]);
    $unbilledMaterial = $unbilledMaterialStmt->fetch(PDO::FETCH_ASSOC);
    if ($unbilledMaterial) {
        boarding_error(
            409,
            'Recorded material "' . ($unbilledMaterial['item_name'] ?: 'Unknown item')
            . '" is not linked to a matching invoice charge. Reopen payment from this boarding stay before checkout.'
        );
    }

    $chargeStmt = $pdo->prepare("
        SELECT COALESCE(SUM(subtotal), 0)
        FROM visit_charges
        WHERE visit_id = ?
    ");
    $refundPaymentSql = boarding_table_exists($pdo, 'visit_payment_refunds')
        ? "- COALESCE((
                SELECT SUM(refund.amount)
                FROM visit_payment_refunds refund
                WHERE refund.visit_id = ?
                  AND refund.refund_status = 'processed'
            ), 0)"
        : '';
    $paymentStmt = $pdo->prepare("
        SELECT GREATEST(COALESCE(SUM(amount), 0) {$refundPaymentSql}, 0)
        FROM visit_payments
        WHERE visit_id = ?
          AND payment_status IN ('verified', 'refunded')
    ");

    $totalCharges = 0.0;
    $unpaidBalance = 0.0;
    foreach ($visitIds as $visitId) {
        $chargeStmt->execute([$visitId]);
        $visitCharges = (float)$chargeStmt->fetchColumn();
        $totalCharges += $visitCharges;

        $paymentStmt->execute(boarding_table_exists($pdo, 'visit_payment_refunds')
            ? [$visitId, $visitId]
            : [$visitId]);
        $visitPayments = (float)$paymentStmt->fetchColumn();
        if ($visitCharges > 0.0001 && $visitPayments + 0.0001 < $visitCharges) {
            $unpaidBalance += $visitCharges - $visitPayments;
        }
    }

    if ($totalCharges <= 0.0001) {
        boarding_error(409, 'The boarding invoice must contain a nonzero charge before checkout.');
    }

    $overstayRateSelect = boarding_column_exists($pdo, 'bookings', 'boarding_overstay_daily_rate')
        ? 'b.boarding_overstay_daily_rate'
        : 'NULL AS boarding_overstay_daily_rate';
    $minimumInvoiceStmt = $pdo->prepare("
        SELECT
            b.price,
            b.check_out_date,
            b.hotel_boarding_type,
            b.room_size,
            b.add_ons,
            {$overstayRateSelect},
            COALESCE((
                SELECT SUM(ROUND(bmu.quantity * bmu.unit_price, 2))
                FROM boarding_material_usages bmu
                WHERE bmu.booking_id = b.booking_id
                  AND bmu.status = 'recorded'
            ), 0) AS material_total
        FROM bookings b
        WHERE b.booking_id = ?
        LIMIT 1
        FOR UPDATE
    ");
    $minimumInvoiceStmt->execute([$bookingId]);
    $minimumBooking = $minimumInvoiceStmt->fetch(PDO::FETCH_ASSOC);
    if (!$minimumBooking) {
        boarding_error(404, 'Boarding booking was not found.');
    }
    $overdueDays = boarding_calculate_overdue_days($minimumBooking['check_out_date'] ?? null);
    $overstayRate = boarding_calculate_overstay_daily_rate($minimumBooking);
    $minimumInvoice = max(0.0, (float)($minimumBooking['price'] ?? 0))
        + max(0.0, (float)($minimumBooking['material_total'] ?? 0))
        + ($overdueDays * $overstayRate);
    if ($totalCharges + 0.009 < $minimumInvoice) {
        boarding_error(
            409,
            'The boarding invoice is below the required stay, overstay, and recorded-material total. Restore the full invoice before checkout.'
        );
    }

    if ($unpaidBalance > 0.0001) {
        boarding_error(
            409,
            'This boarding stay has an unpaid balance of '
            . boarding_format_currency($unpaidBalance)
            . '. Settle every linked invoice before checkout.'
        );
    }
}

function check_out_action(PDO $pdo): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        boarding_error(405, 'Method not allowed.');
    }

    $bookingId = isset($_GET['bookingId']) ? (int)$_GET['bookingId'] : 0;
    if ($bookingId <= 0) {
        boarding_error(400, 'Booking ID is required.');
    }

    $pdo->beginTransaction();
    try {
        fetch_boarding_booking($pdo, $bookingId, true);
        $assignment = fetch_active_assignment($pdo, $bookingId, true);
        if (!$assignment) {
            boarding_error(404, 'Room assignment not found.');
        }
        if (($assignment['status'] ?? '') !== 'occupied') {
            boarding_error(409, 'The pet must be checked in before the boarding stay can be checked out.');
        }

        boarding_assert_checkout_billing_ready($pdo, $bookingId);
        $checkedOutAt = date('Y-m-d H:i:s');

        $stmt = $pdo->prepare("
            UPDATE boarding_assignments
            SET status = 'checked_out',
                actual_check_out_at = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE assignment_id = ?
        ");
        $stmt->execute([$checkedOutAt, (int)$assignment['assignment_id']]);

        $bookingStmt = $pdo->prepare("UPDATE bookings SET status = 'completed' WHERE booking_id = ?");
        $bookingStmt->execute([$bookingId]);

        if (boarding_table_exists($pdo, 'visits')) {
            $visitStmt = $pdo->prepare("
                UPDATE visits
                SET visit_status = 'completed',
                    updated_at = CURRENT_TIMESTAMP
                WHERE booking_id = ?
                  AND visit_status <> 'cancelled'
            ");
            $visitStmt->execute([$bookingId]);
        }

        $pdo->commit();

        try {
            notification_send_boarding_event($pdo, $bookingId, 'checked_out');
        } catch (Throwable $notificationError) {
            error_log('Boarding check-out notification failed: ' . $notificationError->getMessage());
        }

        echo json_encode(['message' => 'Pet checked out successfully.']);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        boarding_internal_failure('check-out failed', $e, 'The pet could not be checked out. Please try again.');
    }
}

function get_active_assignments_by_room(PDO $pdo, int $branchId): array
{
    $multiPetExpression = 'NULL';
    $multiPetJoin = '';
    if (boarding_table_exists($pdo, 'booking_pets')) {
        $multiPetExpression = 'multi.pet_names';
        $multiPetJoin = "
            LEFT JOIN (
                SELECT
                    bp.booking_id,
                    GROUP_CONCAT(p2.pet_name ORDER BY p2.pet_name SEPARATOR ', ') AS pet_names
                FROM booking_pets bp
                JOIN pets_information p2 ON p2.pet_id = bp.pet_id
                GROUP BY bp.booking_id
            ) multi ON multi.booking_id = b.booking_id
        ";
    }

    $overstayRateSelect = boarding_column_exists($pdo, 'bookings', 'boarding_overstay_daily_rate')
        ? 'b.boarding_overstay_daily_rate'
        : 'NULL AS boarding_overstay_daily_rate';
    $stmt = $pdo->prepare("
        SELECT
            ba.*,
            b.booking_number,
            b.branch_id AS booking_branch_id,
            b.pet_id,
            b.user_id AS owner_user_id,
            b.check_in_date,
            b.check_out_date,
            b.price,
            b.hotel_boarding_type,
            b.room_size,
            b.add_ons,
            {$overstayRateSelect},
            b.status AS booking_status,
            COALESCE({$multiPetExpression}, p.pet_name, b.unregistered_pet_name, 'Pet') AS pet_name,
            COALESCE(p.pet_species, b.petType, 'Pet') AS pet_species,
            COALESCE(p.pet_breed, b.unregistered_pet_breed, '') AS pet_breed,
            CONCAT(u.first_Name, ' ', u.last_Name) AS owner_name
        FROM boarding_assignments ba
        JOIN bookings b ON b.booking_id = ba.booking_id
        LEFT JOIN pets_information p ON p.pet_id = b.pet_id
        JOIN users u ON u.user_id = b.user_id
        {$multiPetJoin}
        WHERE ba.branch_id = ?
          AND ba.status IN ('reserved', 'occupied')
          AND b.status <> 'cancelled'
        ORDER BY FIELD(ba.status, 'occupied', 'reserved'), ba.assignment_id DESC
    ");
    $stmt->execute([$branchId]);

    $assignments = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $assignment) {
        $key = $assignment['room_type'] . '-' . $assignment['room_number'];
        if (!isset($assignments[$key])) {
            $assignments[$key] = $assignment;
        }
    }

    return $assignments;
}

function rooms_action(PDO $pdo): void
{
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $branchId = boarding_branch_id($pdo);
        $filterType = $_GET['type'] ?? $_GET['hotel_boarding_type'] ?? null;
        $filterSize = $_GET['size'] ?? $_GET['room_size'] ?? null;
        $checkIn = $_GET['check_in_date'] ?? null;
        $checkOut = $_GET['check_out_date'] ?? null;
        $excludeBookingId = isset($_GET['booking_id']) ? (int)$_GET['booking_id'] : 0;

        $roomTypes = ['hotel-small', 'hotel-medium', 'hotel-large', 'boarding-small', 'boarding-medium', 'boarding-large'];
        if ($filterType && $filterSize) {
            $roomTypes = [normalize_room_type($filterType, $filterSize)];
        } elseif ($filterType && in_array($filterType, ['hotel', 'boarding'], true)) {
            $roomTypes = array_values(array_filter($roomTypes, fn($roomType) => str_starts_with($roomType, $filterType . '-')));
        }

        $activeAssignments = get_active_assignments_by_room($pdo, $branchId);
        $units = [];
        $summaries = [];

        foreach ($roomTypes as $roomType) {
            $capacity = get_room_capacity($pdo, $roomType, $branchId);
            $unitStatusMap = get_room_unit_status_map($pdo, $roomType, $branchId);
            $availableForStay = null;
            if ($checkIn && $checkOut && strtotime($checkOut) > strtotime($checkIn)) {
                $availableForStay = array_flip(get_available_room_numbers($pdo, $roomType, $checkIn, $checkOut, $excludeBookingId, $branchId));
            }

            $parts = split_room_type($roomType);
            $summary = [
                'roomType' => $roomType,
                'roomLabel' => room_type_label($roomType),
                'hotel_boarding_type' => $parts['hotel_boarding_type'],
                'room_size' => $parts['room_size'],
                'total' => $capacity - count(array_filter($unitStatusMap, fn($status) => $status === 'retired')),
                'available' => 0,
                'reserved' => 0,
                'occupied' => 0,
                'maintenance' => 0,
            ];

            for ($roomNumber = 1; $roomNumber <= $capacity; $roomNumber += 1) {
                if (($unitStatusMap[$roomNumber] ?? null) === 'retired') {
                    continue;
                }
                $key = $roomType . '-' . $roomNumber;
                $assignment = $activeAssignments[$key] ?? null;
                $status = 'available';

                if (($unitStatusMap[$roomNumber] ?? null) === 'maintenance') {
                    $status = 'maintenance';
                } elseif ($assignment) {
                    $status = $assignment['status'] === 'occupied' ? 'occupied' : 'reserved';
                }

                $summary[$status] += 1;
                $unit = [
                    'id' => $roomType . '-' . $roomNumber,
                    'roomType' => $roomType,
                    'roomLabel' => room_type_label($roomType) . ' #' . $roomNumber,
                    'hotelBoardingType' => $parts['hotel_boarding_type'],
                    'roomSize' => $parts['room_size'],
                    'roomNumber' => $roomNumber,
                    'status' => $status,
                    'availableForStay' => $availableForStay === null ? $status === 'available' : isset($availableForStay[$roomNumber]),
                    'assignment' => null,
                ];

                if ($assignment) {
                    $unit['assignment'] = [
                        'assignmentId' => (int)$assignment['assignment_id'],
                        'bookingId' => (int)$assignment['booking_id'],
                        'bookingNumber' => $assignment['booking_number'],
                        'branchId' => $assignment['booking_branch_id'] !== null ? (int)$assignment['booking_branch_id'] : null,
                        'status' => $assignment['status'],
                        'petId' => $assignment['pet_id'] !== null ? (int)$assignment['pet_id'] : null,
                        'ownerUserId' => $assignment['owner_user_id'] !== null ? (int)$assignment['owner_user_id'] : null,
                        'petName' => $assignment['pet_name'],
                        'petSpecies' => $assignment['pet_species'],
                        'petBreed' => $assignment['pet_breed'],
                        'ownerName' => $assignment['owner_name'],
                        'checkInDate' => $assignment['check_in_date'],
                        'checkOutDate' => $assignment['check_out_date'],
                        'desiredCheckOutDate' => $assignment['desired_check_out_date'] ?: $assignment['check_out_date'],
                        'actualCheckInAt' => $assignment['actual_check_in_at'],
                        'actualCheckOutAt' => $assignment['actual_check_out_at'],
                        'price' => $assignment['price'],
                        'overstayDailyRate' => boarding_calculate_overstay_daily_rate($assignment),
                        'bookingStatus' => $assignment['booking_status'],
                    ];
                }

                $units[] = $unit;
            }

            $summaries[] = $summary;
        }

        echo json_encode([
            'branchId' => $branchId,
            'rooms' => $summaries,
            'units' => $units,
        ]);
        return;
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = boarding_json_input();
        $branchId = boarding_branch_id($pdo, $input);
        $roomType = normalize_room_type_input($input);
        $quantity = (int)($input['quantity'] ?? 0);
        $description = trim((string)($input['description'] ?? ''));

        if ($quantity <= 0) {
            boarding_error(400, 'Enter a valid room quantity.');
        }

        $pdo->beginTransaction();
        try {
            $hasDescriptionColumn = boarding_column_exists($pdo, 'rooms', 'description');
            $hasRoomIdColumn = boarding_column_exists($pdo, 'rooms', 'room_id');
            $selectSql = $hasRoomIdColumn
                ? "SELECT room_id, total_capacity FROM rooms WHERE branch_id = ? AND room_type = ? ORDER BY room_id ASC LIMIT 1 FOR UPDATE"
                : "SELECT room_type, total_capacity FROM rooms WHERE branch_id = ? AND room_type = ? LIMIT 1 FOR UPDATE";
            $stmt = $pdo->prepare($selectSql);
            $stmt->execute([$branchId, $roomType]);
            $room = $stmt->fetch(PDO::FETCH_ASSOC);
            $oldCapacity = (int)($room['total_capacity'] ?? 0);

            if ($room) {
                $whereColumn = $hasRoomIdColumn ? 'room_id' : 'room_type';
                $whereValue = $hasRoomIdColumn ? (int)$room['room_id'] : $roomType;

                if ($hasDescriptionColumn) {
                    $update = $pdo->prepare("UPDATE rooms SET total_capacity = total_capacity + ?, description = COALESCE(NULLIF(?, ''), description) WHERE {$whereColumn} = ?");
                    $update->execute([$quantity, $description, $whereValue]);
                } else {
                    $update = $pdo->prepare("UPDATE rooms SET total_capacity = total_capacity + ? WHERE {$whereColumn} = ?");
                    $update->execute([$quantity, $whereValue]);
                }
            } else {
                if ($hasDescriptionColumn) {
                    $insert = $pdo->prepare("INSERT INTO rooms (branch_id, room_type, total_capacity, description) VALUES (?, ?, ?, ?)");
                    $insert->execute([$branchId, $roomType, $quantity, $description !== '' ? $description : room_type_label($roomType)]);
                } else {
                    $insert = $pdo->prepare("INSERT INTO rooms (branch_id, room_type, total_capacity) VALUES (?, ?, ?)");
                    $insert->execute([$branchId, $roomType, $quantity]);
                }
            }

            $unitStmt = $pdo->prepare("
                INSERT INTO room_unit_statuses (branch_id, room_type, room_number, status, notes)
                VALUES (?, ?, ?, 'available', NULL)
                ON DUPLICATE KEY UPDATE status = 'available', notes = NULL
            ");
            for ($roomNumber = $oldCapacity + 1; $roomNumber <= $oldCapacity + $quantity; $roomNumber += 1) {
                $unitStmt->execute([$branchId, $roomType, $roomNumber]);
            }

            $pdo->commit();

            echo json_encode([
                'message' => $quantity === 1 ? 'Room added.' : 'Rooms added.',
                'roomType' => $roomType,
                'branchId' => $branchId,
                'totalCapacity' => get_room_capacity($pdo, $roomType, $branchId),
            ]);
        } catch (Exception $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            boarding_internal_failure('room creation failed', $e, 'The room could not be added. Please try again.');
        }
        return;
    }

    if ($_SERVER['REQUEST_METHOD'] === 'PATCH') {
        $input = boarding_json_input();
        $branchId = boarding_branch_id($pdo, $input);
        $roomType = normalize_room_type_input($input);
        $roomNumber = (int)($input['room_number'] ?? 0);
        $status = strtolower(trim((string)($input['status'] ?? '')));
        $notes = trim((string)($input['notes'] ?? ''));

        if ($roomNumber <= 0 || !in_array($status, ['available', 'maintenance', 'retired'], true)) {
            boarding_error(400, 'Room number and a valid status are required.');
        }

        if ($roomNumber > get_room_capacity($pdo, $roomType, $branchId)) {
            boarding_error(404, 'Room or kennel not found.');
        }

        if (in_array($status, ['maintenance', 'retired'], true)) {
            $activeStmt = $pdo->prepare("
                SELECT b.booking_number
                FROM boarding_assignments ba
                JOIN bookings b ON b.booking_id = ba.booking_id
                WHERE ba.branch_id = ? AND ba.room_type = ?
                  AND ba.room_number = ?
                  AND ba.status IN ('reserved', 'occupied')
                  AND b.status <> 'cancelled'
                LIMIT 1
            ");
            $activeStmt->execute([$branchId, $roomType, $roomNumber]);
            $activeBooking = $activeStmt->fetchColumn();
            if ($activeBooking) {
                boarding_error(409, "Room has active booking {$activeBooking} and cannot be marked for maintenance.");
            }

            $stmt = $pdo->prepare("
                INSERT INTO room_unit_statuses (branch_id, room_type, room_number, status, notes)
                VALUES (?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE status = VALUES(status), notes = VALUES(notes)
            ");
            $stmt->execute([$branchId, $roomType, $roomNumber, $status, $notes]);
        } else {
            $stmt = $pdo->prepare("
                INSERT INTO room_unit_statuses (branch_id, room_type, room_number, status, notes)
                VALUES (?, ?, ?, 'available', NULL)
                ON DUPLICATE KEY UPDATE status = 'available', notes = NULL
            ");
            $stmt->execute([$branchId, $roomType, $roomNumber]);
        }

        echo json_encode(['message' => 'Room status updated.']);
        return;
    }

    boarding_error(405, 'Method not allowed.');
}

function resolve_boarding_pet_id(PDO $pdo, $petId): ?int
{
    $value = trim((string)$petId);
    if ($value === '') {
        return null;
    }

    if (is_numeric($value)) {
        $stmt = $pdo->prepare("SELECT pet_id FROM pets_information WHERE pet_id = ? LIMIT 1");
        $stmt->execute([(int)$value]);
        $resolved = $stmt->fetchColumn();
        if ($resolved !== false) {
            return (int)$resolved;
        }
    }

    $stmt = $pdo->prepare("SELECT pet_id FROM pets_information WHERE pet_sharable_ID = ? LIMIT 1");
    $stmt->execute([$value]);
    $resolved = $stmt->fetchColumn();

    return $resolved !== false ? (int)$resolved : null;
}

function direct_check_in_action(PDO $pdo): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        boarding_error(405, 'Method not allowed.');
    }

    $input = boarding_json_input();
    $branchId = boarding_branch_id($pdo, $input);
    $petId = resolve_boarding_pet_id($pdo, $input['pet_id'] ?? null);
    $roomType = normalize_room_type($input['hotel_boarding_type'] ?? $input['type'] ?? null, $input['room_size'] ?? $input['size'] ?? null);
    $checkOut = $input['check_out_date'] ?? $input['desired_check_out_date'] ?? null;
    $rawEmergencyContact = trim((string)($input['emergency_contact'] ?? ''));
    $emergencyContact = $rawEmergencyContact === ''
        ? 'Walk-in check-in'
        : rejectInvalidPhilippinePhoneNumber($rawEmergencyContact, 'Emergency contact');
    $notes = trim((string)($input['notes'] ?? ''));
    $price = isset($input['price']) ? (float)$input['price'] : 0;
    $serviceCatalogId = isset($input['service_catalog_id']) ? (int)$input['service_catalog_id'] : 0;
    $requestedRoom = isset($input['room_number']) && $input['room_number'] !== '' ? (int)$input['room_number'] : null;

    if (!$petId) {
        boarding_error(400, 'Please select a registered pet.');
    }

    $today = (string)$pdo->query("SELECT CURDATE()")->fetchColumn();
    $nowTime = (string)$pdo->query("SELECT CURTIME()")->fetchColumn();
    if (!$checkOut || strtotime((string)$checkOut) <= strtotime($today)) {
        boarding_error(400, 'Desired out date must be after today.');
    }

    if ($serviceCatalogId > 0) {
        if (!boarding_table_exists($pdo, 'service_catalog')) {
            boarding_error(409, 'Service catalog is missing. Add the boarding service catalog before direct check-in.');
        }

        $catalogStmt = $pdo->prepare("
            SELECT service_id, service_code, service_name, base_price
            FROM service_catalog
            WHERE service_id = ?
              AND service_type = 'boarding'
              AND is_active = 1
            LIMIT 1
        ");
        $catalogStmt->execute([$serviceCatalogId]);
        $catalogService = $catalogStmt->fetch(PDO::FETCH_ASSOC);

        if (!$catalogService) {
            boarding_error(400, 'Selected boarding catalog service was not found or is inactive.');
        }

        $stayDays = boarding_count_stay_days($today, (string)$checkOut);
        $unitPrice = (float)$catalogService['base_price'];
        $price = $unitPrice * $stayDays;
        $catalogLabel = trim(($catalogService['service_name'] ?? 'Boarding service') . (($catalogService['service_code'] ?? '') !== '' ? ' (' . $catalogService['service_code'] . ')' : ''));
        $catalogNote = sprintf(
            '[Catalog Price] %s at %s x %d day(s) = %s',
            $catalogLabel,
            boarding_format_currency($unitPrice),
            $stayDays,
            boarding_format_currency($price)
        );
        $notes = trim($notes . "\n" . $catalogNote);
    }

    $ownerStmt = $pdo->prepare("SELECT user_id FROM pet_ownership WHERE pet_id = ? ORDER BY link_id DESC LIMIT 1");
    $ownerStmt->execute([$petId]);
    $ownerId = (int)($ownerStmt->fetchColumn() ?: 0);
    if ($ownerId <= 0 && isset($input['user_id'])) {
        $ownerId = (int)$input['user_id'];
    }
    if ($ownerId <= 0) {
        boarding_error(409, 'This pet has no linked owner account. Link an owner before direct check-in.');
    }

    $roomLockName = null;
    $consentLockName = null;
    $pdo->beginTransaction();
    try {
        $consent = boarding_secure_consent_payload(
            $pdo,
            $input,
            [
                'booking_id' => 0,
                'user_id' => $ownerId,
                'pet_id' => $petId,
                'consent_forms' => null,
                'signature_path' => null,
            ],
            'A completed boarding consent PDF is required before check-in.'
        );
        $consentLockName = $consent['lock_name'] ?? null;
        booking_daily_lock_subjects($pdo, [$petId], $ownerId);
        $dailyBookingConflict = booking_daily_find_conflict(
            $pdo,
            [$petId],
            $today
        );
        if ($dailyBookingConflict) {
            $payload = booking_daily_conflict_payload($dailyBookingConflict);
            boarding_error(
                409,
                $payload['message'],
                [
                    'code' => $payload['code'],
                    'conflict' => $payload['conflict'],
                ]
            );
        }

        assert_pets_not_in_active_boarding($pdo, [$petId]);
        assert_pets_no_overlapping_boarding_booking($pdo, [$petId], $today, (string)$checkOut);

        $roomLockName = 'ipawcus_room_' . md5($branchId . '|' . $roomType);
        if (!boarding_named_lock_acquire($pdo, $roomLockName)) {
            boarding_error(409, 'Room availability is being updated by another check-in. Refresh the rooms and try again.');
        }

        $availableRooms = get_available_room_numbers($pdo, $roomType, $today, (string)$checkOut, 0, $branchId);
        $roomNumber = $requestedRoom ?: ($availableRooms[0] ?? 0);
        if ($roomNumber <= 0 || !in_array($roomNumber, $availableRooms, true)) {
            boarding_error(409, 'Selected room or kennel is not available.');
        }

        $parts = split_room_type($roomType);
        $bookingNumber = ipawcus_generate_booking_number($pdo, $today);
        $fullNotes = trim("[Walk-in Boarding Check-in]\n" . $notes);
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
                registered_status,
                status,
                price,
                check_in_date,
                check_out_date,
                room_size,
                emergency_contact,
                hotel_boarding_type,
                signature_path,
                consent_forms,
                consent_status,
                created_at
            ) VALUES (?, ?, ?, ?, ?, 'boarding', ?, ?, ?, 'Registered', 'confirmed', ?, ?, ?, ?, ?, ?, ?, ?, 'signed', NOW())
        ");
        $stmt->execute([
            $ownerId,
            $petId,
            $bookingNumber,
            $branchId,
            $branchId,
            $today,
            $nowTime,
            $fullNotes,
            $price,
            $today,
            $checkOut,
            $parts['room_size'],
            $emergencyContact,
            $parts['hotel_boarding_type'],
            $consent['signed_document_path'],
            json_encode($consent['forms'], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
        ]);

        $bookingId = (int)$pdo->lastInsertId();
        $consent['context']['booking_id'] = $bookingId;

        if (boarding_table_exists($pdo, 'booking_pets')) {
            $petStmt = $pdo->prepare("INSERT IGNORE INTO booking_pets (booking_id, pet_id) VALUES (?, ?)");
            $petStmt->execute([$bookingId, $petId]);
        }

        boarding_secure_save_consent_records($pdo, [
            'booking_id' => $bookingId,
            'user_id' => $ownerId,
            'pet_id' => $petId,
        ], $consent, 'Captured during direct boarding check-in.');

        $assignmentStmt = $pdo->prepare("
            INSERT INTO boarding_assignments (
                booking_id,
                branch_id,
                room_type,
                room_number,
                status,
                reserved_at,
                actual_check_in_at,
                desired_check_out_date,
                notes
            ) VALUES (?, ?, ?, ?, 'occupied', NOW(), NOW(), ?, ?)
        ");
        $assignmentStmt->execute([$bookingId, $branchId, $roomType, $roomNumber, $checkOut, $notes]);

        $pdo->commit();
        boarding_named_lock_release($pdo, $roomLockName);
        $roomLockName = null;
        boarding_named_lock_release($pdo, $consentLockName);
        $consentLockName = null;

        try {
            notification_send_boarding_event($pdo, $bookingId, 'checked_in', [
                'room_label' => $roomType . ' #' . $roomNumber,
            ]);
        } catch (Throwable $notificationError) {
            error_log('Walk-in boarding check-in notification failed: ' . $notificationError->getMessage());
        }

        echo json_encode([
            'message' => 'Walk-in pet checked in successfully.',
            'bookingId' => $bookingId,
            'bookingNumber' => $bookingNumber,
            'assignment' => assignment_response($pdo, $bookingId),
        ]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        boarding_named_lock_release($pdo, $roomLockName);
        boarding_named_lock_release($pdo, $consentLockName);
        boarding_internal_failure('direct check-in failed', $e, 'The pet could not be checked in. Please try again.');
    }
}

function fetch_assignment_for_monitoring(
    PDO $pdo,
    array $input,
    bool $requireActive = true,
    bool $forUpdate = false
): array
{
    $assignmentId = (int)($input['assignment_id'] ?? $input['assignmentId'] ?? 0);
    $bookingId = (int)($input['booking_id'] ?? $input['bookingId'] ?? 0);

    if ($assignmentId > 0) {
        $sql = "
            SELECT
                ba.*,
                b.pet_id,
                b.branch_id,
                b.service_type,
                b.status AS booking_status
            FROM boarding_assignments ba
            JOIN bookings b ON b.booking_id = ba.booking_id
            WHERE ba.assignment_id = ?
            LIMIT 1
        ";
        if ($forUpdate) {
            $sql .= ' FOR UPDATE';
        }
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$assignmentId]);
    } elseif ($bookingId > 0) {
        $sql = "
            SELECT
                ba.*,
                b.pet_id,
                b.service_type,
                b.status AS booking_status
            FROM boarding_assignments ba
            JOIN bookings b ON b.booking_id = ba.booking_id
            WHERE ba.booking_id = ?
            ORDER BY ba.assignment_id DESC
            LIMIT 1
        ";
        if ($forUpdate) {
            $sql .= ' FOR UPDATE';
        }
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$bookingId]);
    } else {
        boarding_error(400, 'Please select a room or pet assignment.');
    }

    $assignment = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$assignment) {
        boarding_error(404, 'Room assignment not found.');
    }

    if ($bookingId > 0 && (int)$assignment['booking_id'] !== $bookingId) {
        boarding_error(409, 'The selected room assignment does not belong to this boarding booking.');
    }

    if (($assignment['service_type'] ?? '') !== 'boarding') {
        boarding_error(409, 'The selected assignment is not a boarding stay.');
    }

    if (($assignment['booking_status'] ?? '') === 'cancelled' || ($assignment['status'] ?? '') === 'cancelled') {
        boarding_error(409, 'Cancelled boarding assignments cannot be updated.');
    }

    if ($requireActive && !in_array((string)($assignment['status'] ?? ''), ['reserved', 'occupied'], true)) {
        boarding_error(409, 'Monitoring can only be updated while a boarding assignment is reserved or occupied.');
    }

    return $assignment;
}

function boarding_documents_schema_ready(PDO $pdo): bool
{
    return boarding_table_exists($pdo, 'boarding_documents');
}

function boarding_document_missing_message(): string
{
    return 'Boarding document schema is missing. Restore the repository baseline DDL, then run DDL/20260723_01_backend_integrity_schema.sql.';
}

function boarding_document_nullable_text($value): ?string
{
    $text = trim((string)($value ?? ''));
    return $text === '' ? null : $text;
}

function boarding_optional_status(array $input, string $snakeKey, string $camelKey): ?string
{
    $value = $input[$snakeKey] ?? $input[$camelKey] ?? null;
    if ($value === null || trim((string)$value) === '') {
        return null;
    }

    $status = strtolower(trim((string)$value));
    $status = preg_replace('/[\s-]+/', '_', $status);
    if (!preg_match('/^[a-z0-9_]{1,40}$/', $status)) {
        boarding_error(422, str_replace('_', ' ', ucfirst($snakeKey)) . ' is invalid.');
    }

    return $status;
}

function boarding_optional_measurement(
    array $input,
    string $snakeKey,
    string $camelKey,
    float $minimum,
    float $maximum
): ?float {
    $value = $input[$snakeKey] ?? $input[$camelKey] ?? null;
    if ($value === null || $value === '') {
        return null;
    }

    if (!is_numeric($value)) {
        boarding_error(422, str_replace('_', ' ', ucfirst($snakeKey)) . ' must be numeric.');
    }

    $measurement = (float)$value;
    if (!is_finite($measurement) || $measurement < $minimum || $measurement > $maximum) {
        boarding_error(
            422,
            str_replace('_', ' ', ucfirst($snakeKey)) . " must be between {$minimum} and {$maximum}."
        );
    }

    return $measurement;
}

function boarding_optional_boolean(array $input, string $snakeKey, string $camelKey): ?bool
{
    if (!array_key_exists($snakeKey, $input) && !array_key_exists($camelKey, $input)) {
        return null;
    }

    $value = $input[$snakeKey] ?? $input[$camelKey] ?? null;
    if ($value === null || $value === '') {
        return null;
    }

    $normalized = filter_var($value, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
    if ($normalized === null) {
        boarding_error(422, str_replace('_', ' ', ucfirst($snakeKey)) . ' must be true or false.');
    }

    return $normalized;
}

function boarding_normalize_document_path(string $documentPath): string
{
    $path = parse_url(trim($documentPath), PHP_URL_PATH);
    $path = ltrim((string)$path, '/');
    if (str_starts_with($path, 'api/uploads/media/')) {
        $path = substr($path, strlen('api/uploads/media/'));
    }

    if (!preg_match('#^boarding_documents/[A-Za-z0-9][A-Za-z0-9._-]*$#', $path)) {
        boarding_error(400, 'The uploaded boarding document path is invalid.');
    }

    return $path;
}

function boarding_document_file_metadata(string $documentPath, array $input): array
{
    $fileName = boarding_document_nullable_text($input['file_name'] ?? $input['fileName'] ?? null);
    $mimeType = boarding_document_nullable_text($input['mime_type'] ?? $input['mimeType'] ?? null);
    $absolutePath = __DIR__ . '/../public/' . $documentPath;

    if (is_file($absolutePath)) {
        $fileName = $fileName ?: basename($documentPath);
        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $detectedMime = $finfo->file($absolutePath);
        if (is_string($detectedMime) && $detectedMime !== '') {
            $mimeType = $detectedMime;
        }
    }

    return [
        'file_name' => $fileName,
        'mime_type' => $mimeType,
    ];
}

function boarding_cleanup_unstored_document(PDO $pdo, string $documentPath): void
{
    try {
        $stmt = $pdo->prepare("
            SELECT COUNT(*)
            FROM boarding_documents
            WHERE document_path = ?
        ");
        $stmt->execute([$documentPath]);
        if ((int)$stmt->fetchColumn() > 0) {
            return;
        }
    } catch (Throwable $e) {
        // If reference state cannot be verified, preserving the file is safer than deleting it.
        return;
    }

    $documentRoot = realpath(__DIR__ . '/../public/boarding_documents');
    $absolutePath = realpath(__DIR__ . '/../public/' . $documentPath);
    if ($documentRoot === false || $absolutePath === false) {
        return;
    }

    if (dirname($absolutePath) === $documentRoot && is_file($absolutePath)) {
        @unlink($absolutePath);
    }
}

function boarding_fetch_document_subject(PDO $pdo, array $input): array
{
    $assignmentId = (int)($input['assignment_id'] ?? $input['assignmentId'] ?? 0);
    $bookingId = (int)($input['booking_id'] ?? $input['bookingId'] ?? 0);
    $subject = null;

    if ($assignmentId > 0) {
        $stmt = $pdo->prepare("
            SELECT
                ba.assignment_id,
                ba.booking_id,
                ba.status,
                b.pet_id,
                b.service_type,
                b.status AS booking_status
            FROM boarding_assignments ba
            JOIN bookings b ON b.booking_id = ba.booking_id
            WHERE ba.assignment_id = ?
            LIMIT 1
        ");
        $stmt->execute([$assignmentId]);
        $subject = $stmt->fetch(PDO::FETCH_ASSOC);
    } elseif ($bookingId > 0) {
        $stmt = $pdo->prepare("
            SELECT
                ba.assignment_id,
                ba.status,
                b.booking_id,
                b.pet_id,
                b.branch_id,
                b.service_type,
                b.status AS booking_status
            FROM bookings b
            LEFT JOIN boarding_assignments ba ON ba.booking_id = b.booking_id
            WHERE b.booking_id = ?
            ORDER BY ba.assignment_id DESC
            LIMIT 1
        ");
        $stmt->execute([$bookingId]);
        $subject = $stmt->fetch(PDO::FETCH_ASSOC);
    }

    if (!$subject) {
        boarding_error(404, 'Boarding booking or assignment was not found.');
    }

    boarding_assert_booking_branch_access($pdo, $subject);

    if ($bookingId > 0 && (int)$subject['booking_id'] !== $bookingId) {
        boarding_error(409, 'The selected assignment does not belong to this boarding booking.');
    }

    if (($subject['service_type'] ?? '') !== 'boarding') {
        boarding_error(409, 'Documents can only be attached to boarding bookings.');
    }

    if (($subject['booking_status'] ?? '') === 'cancelled' || ($subject['status'] ?? '') === 'cancelled') {
        boarding_error(409, 'Documents cannot be attached to a cancelled boarding stay.');
    }

    $subject['pet_id'] = boarding_resolve_assignment_pet_id($pdo, $subject, $input);

    return $subject;
}

function boarding_format_document(array $document): array
{
    return [
        'documentId' => (int)$document['document_id'],
        'assignmentId' => $document['assignment_id'] !== null ? (int)$document['assignment_id'] : null,
        'bookingId' => (int)$document['booking_id'],
        'bookingNumber' => $document['booking_number'] ?? '',
        'petId' => $document['pet_id'] !== null ? (int)$document['pet_id'] : null,
        'petName' => $document['pet_name'] ?? 'Pet',
        'ownerName' => trim((string)($document['owner_name'] ?? '')),
        'documentType' => $document['document_type'],
        'title' => $document['title'],
        'documentPath' => $document['document_path'],
        'url' => '/' . ltrim((string)$document['document_path'], '/'),
        'fileName' => $document['file_name'] ?? '',
        'mimeType' => $document['mime_type'] ?? '',
        'notes' => $document['notes'] ?? '',
        'uploadedByUserId' => $document['uploaded_by_user_id'] !== null ? (int)$document['uploaded_by_user_id'] : null,
        'uploadedByName' => $document['uploaded_by_name'] ?? '',
        'createdAt' => $document['created_at'],
    ];
}

function boarding_fetch_documents(PDO $pdo, array $filters = []): array
{
    if (!boarding_documents_schema_ready($pdo)) {
        return [];
    }

    $conditions = [];
    $params = [];
    foreach ([
        ['assignment_id', 'bd.assignment_id'],
        ['booking_id', 'bd.booking_id'],
        ['pet_id', 'bd.pet_id'],
        ['branch_id', 'b.branch_id'],
    ] as [$key, $column]) {
        if ((int)($filters[$key] ?? 0) > 0) {
            $conditions[] = "{$column} = ?";
            $params[] = (int)$filters[$key];
        }
    }

    $whereSql = $conditions ? 'WHERE ' . implode(' AND ', $conditions) : '';
    $limitSql = '';
    $requestedLimit = (int)($filters['limit'] ?? 0);
    if ($requestedLimit > 0) {
        $limit = min($requestedLimit, 1000);
        $offset = max(0, (int)($filters['offset'] ?? 0));
        $limitSql = "LIMIT {$limit} OFFSET {$offset}";
    }

    $stmt = $pdo->prepare("
        SELECT
            bd.*,
            b.booking_number,
            COALESCE(p.pet_name, b.unregistered_pet_name, 'Pet') AS pet_name,
            CONCAT(u.first_Name, ' ', u.last_Name) AS owner_name
        FROM boarding_documents bd
        JOIN bookings b ON b.booking_id = bd.booking_id
        LEFT JOIN pets_information p ON p.pet_id = bd.pet_id
        JOIN users u ON u.user_id = b.user_id
        {$whereSql}
        ORDER BY bd.created_at DESC, bd.document_id DESC
        {$limitSql}
    ");
    $stmt->execute($params);

    return array_map('boarding_format_document', $stmt->fetchAll(PDO::FETCH_ASSOC));
}

function boarding_documents_action(PDO $pdo): void
{
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $branchId = boarding_branch_id($pdo);
        if (!boarding_documents_schema_ready($pdo)) {
            echo json_encode([
                'schemaReady' => false,
                'message' => boarding_document_missing_message(),
                'documents' => []
            ]);
            return;
        }

        echo json_encode([
            'schemaReady' => true,
            'documents' => boarding_fetch_documents($pdo, [
                'assignment_id' => $_GET['assignmentId'] ?? $_GET['assignment_id'] ?? null,
                'booking_id' => $_GET['bookingId'] ?? $_GET['booking_id'] ?? null,
                'pet_id' => $_GET['petId'] ?? $_GET['pet_id'] ?? null,
                'branch_id' => $branchId,
                'limit' => $_GET['limit'] ?? $_GET['pageSize'] ?? null,
                'offset' => $_GET['offset'] ?? null,
            ])
        ]);
        return;
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        boarding_error(405, 'Method not allowed.');
    }

    if (!boarding_documents_schema_ready($pdo)) {
        boarding_error(409, boarding_document_missing_message());
    }

    $input = boarding_json_input();
    $documentPath = boarding_document_nullable_text($input['document_path'] ?? $input['documentPath'] ?? null);
    $title = boarding_document_nullable_text($input['title'] ?? null);
    if (!$documentPath || !$title) {
        boarding_error(400, 'Document title and document_path are required.');
    }
    $titleLength = function_exists('mb_strlen') ? mb_strlen($title) : strlen($title);
    if ($titleLength > 180) {
        boarding_error(422, 'Document title must be 180 characters or fewer.');
    }

    $allowedTypes = ['monitoring_report', 'boarding_history', 'checkout_summary', 'diagnosis_reference', 'other'];
    $documentType = strtolower(trim((string)($input['document_type'] ?? $input['documentType'] ?? 'monitoring_report')));
    if (!in_array($documentType, $allowedTypes, true)) {
        $documentType = 'monitoring_report';
    }

    $documentPath = boarding_normalize_document_path($documentPath);
    $fileMetadata = boarding_document_file_metadata($documentPath, $input);
    $subject = boarding_fetch_document_subject($pdo, $input);
    $actor = boarding_current_actor($pdo, $input);
    $uploadedByName = $actor['name']
        ?? boarding_document_nullable_text($input['uploaded_by_name'] ?? $input['uploadedByName'] ?? null);
    try {
        $stmt = $pdo->prepare("
            INSERT INTO boarding_documents (
                assignment_id,
                booking_id,
                pet_id,
                document_type,
                title,
                document_path,
                file_name,
                mime_type,
                notes,
                uploaded_by_user_id,
                uploaded_by_name
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $subject['assignment_id'] !== null ? (int)$subject['assignment_id'] : null,
            (int)$subject['booking_id'],
            $subject['pet_id'] !== null ? (int)$subject['pet_id'] : null,
            $documentType,
            $title,
            $documentPath,
            $fileMetadata['file_name'],
            $fileMetadata['mime_type'],
            boarding_document_nullable_text($input['notes'] ?? null),
            $actor['user_id'],
            $uploadedByName,
        ]);
    } catch (Throwable $e) {
        boarding_cleanup_unstored_document($pdo, $documentPath);
        throw $e;
    }

    echo json_encode([
        'message' => 'Boarding document saved.',
        'documentId' => (int)$pdo->lastInsertId()
    ]);
}

function boarding_monitoring_filters(): array
{
    return [
        'assignment_id' => (int)($_GET['assignmentId'] ?? $_GET['assignment_id'] ?? 0),
        'booking_id' => (int)($_GET['bookingId'] ?? $_GET['booking_id'] ?? 0),
        'pet_id' => (int)($_GET['petId'] ?? $_GET['pet_id'] ?? 0),
    ];
}

function boarding_monitoring_scope(string $alias, array $filters): array
{
    $conditions = [];
    $params = [];
    foreach ([
        'assignment_id' => 'assignment_id',
        'booking_id' => 'booking_id',
        'pet_id' => 'pet_id',
    ] as $filterKey => $columnName) {
        if (($filters[$filterKey] ?? 0) > 0) {
            $conditions[] = "{$alias}.{$columnName} = ?";
            $params[] = (int)$filters[$filterKey];
        }
    }

    return [
        'conditions' => $conditions,
        'params' => $params,
    ];
}

function boarding_monitoring_pagination(): array
{
    $rawLimit = $_GET['limit'] ?? $_GET['pageSize'] ?? null;
    if ($rawLimit === null || $rawLimit === '') {
        return ['limit' => null, 'offset' => 0, 'page' => 1, 'sql' => ''];
    }

    $limit = (int)$rawLimit;
    if ($limit <= 0) {
        boarding_error(400, 'Monitoring limit must be greater than zero.');
    }
    $limit = min($limit, 1000);

    $page = max(1, (int)($_GET['page'] ?? 1));
    $offset = isset($_GET['offset'])
        ? max(0, (int)$_GET['offset'])
        : ($page - 1) * $limit;

    return [
        'limit' => $limit,
        'offset' => $offset,
        'page' => $page,
        'sql' => "LIMIT {$limit} OFFSET {$offset}",
    ];
}

function monitoring_action(PDO $pdo): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        boarding_error(405, 'Method not allowed.');
    }

    $branchId = boarding_branch_id($pdo);
    $filters = boarding_monitoring_filters();
    $pagination = boarding_monitoring_pagination();
    $taskScope = boarding_monitoring_scope('bt', $filters);
    $taskConditions = array_merge(["bt.status <> 'cancelled'", 'b.branch_id = ?'], $taskScope['conditions']);
    $taskWhere = 'WHERE ' . implode(' AND ', $taskConditions);

    $tasksStmt = $pdo->prepare("
        SELECT
            bt.*,
            b.booking_number,
            COALESCE(p.pet_name, b.unregistered_pet_name, 'Pet') AS pet_name,
            COALESCE(p.pet_species, b.petType, 'Pet') AS pet_species,
            CONCAT(u.first_Name, ' ', u.last_Name) AS owner_name,
            CONCAT_WS(' ', creator.first_Name, creator.last_Name) AS created_by_name
        FROM boarding_tasks bt
        JOIN bookings b ON b.booking_id = bt.booking_id
        LEFT JOIN pets_information p ON p.pet_id = bt.pet_id
        JOIN users u ON u.user_id = b.user_id
        LEFT JOIN users creator ON creator.user_id = bt.created_by_user_id
        {$taskWhere}
        ORDER BY
            CASE
                WHEN bt.status = 'pending' AND bt.due_at < NOW() THEN 0
                WHEN bt.status = 'pending' THEN 1
                ELSE 2
            END,
            bt.due_at ASC,
            bt.task_id DESC
        {$pagination['sql']}
    ");
    $tasksStmt->execute(array_merge([$branchId], $taskScope['params']));

    $tasks = array_map(function ($task) {
        $status = $task['status'];
        if ($status === 'pending' && strtotime((string)$task['due_at']) < time()) {
            $status = 'overdue';
        }

        return [
            'taskId' => (int)$task['task_id'],
            'assignmentId' => $task['assignment_id'] !== null ? (int)$task['assignment_id'] : null,
            'bookingId' => (int)$task['booking_id'],
            'bookingNumber' => $task['booking_number'],
            'petId' => $task['pet_id'] !== null ? (int)$task['pet_id'] : null,
            'petName' => $task['pet_name'],
            'petSpecies' => $task['pet_species'],
            'ownerName' => $task['owner_name'],
            'roomType' => $task['room_type'],
            'roomNumber' => (int)$task['room_number'],
            'roomLabel' => room_type_label($task['room_type']) . ' #' . $task['room_number'],
            'taskType' => $task['task_type'],
            'dueAt' => $task['due_at'],
            'status' => $status,
            'assignedTo' => $task['assigned_to'],
            'notes' => $task['notes'],
            'completedAt' => $task['completed_at'],
            'createdByUserId' => $task['created_by_user_id'] !== null ? (int)$task['created_by_user_id'] : null,
            'createdByName' => trim((string)$task['created_by_name']),
            'createdAt' => $task['created_at'],
        ];
    }, $tasksStmt->fetchAll(PDO::FETCH_ASSOC));

    $observationScope = boarding_monitoring_scope('bo', $filters);
    $observationConditions = array_merge(['b.branch_id = ?'], $observationScope['conditions']);
    $observationWhere = 'WHERE ' . implode(' AND ', $observationConditions);
    $observationsStmt = $pdo->prepare("
        SELECT
            bo.*,
            b.booking_number,
            COALESCE(p.pet_name, b.unregistered_pet_name, 'Pet') AS pet_name,
            COALESCE(p.pet_species, b.petType, 'Pet') AS pet_species,
            CONCAT(u.first_Name, ' ', u.last_Name) AS owner_name,
            CONCAT_WS(' ', creator.first_Name, creator.last_Name) AS created_by_name
        FROM boarding_observations bo
        JOIN bookings b ON b.booking_id = bo.booking_id
        LEFT JOIN pets_information p ON p.pet_id = bo.pet_id
        JOIN users u ON u.user_id = b.user_id
        LEFT JOIN users creator ON creator.user_id = bo.created_by_user_id
        {$observationWhere}
        ORDER BY bo.observed_at DESC, bo.observation_id DESC
        {$pagination['sql']}
    ");
    $observationsStmt->execute(array_merge([$branchId], $observationScope['params']));

    $observations = array_map(function ($observation) {
        return [
            'observationId' => (int)$observation['observation_id'],
            'assignmentId' => $observation['assignment_id'] !== null ? (int)$observation['assignment_id'] : null,
            'bookingId' => (int)$observation['booking_id'],
            'bookingNumber' => $observation['booking_number'],
            'petId' => $observation['pet_id'] !== null ? (int)$observation['pet_id'] : null,
            'petName' => $observation['pet_name'],
            'petSpecies' => $observation['pet_species'],
            'ownerName' => $observation['owner_name'],
            'roomType' => $observation['room_type'],
            'roomNumber' => (int)$observation['room_number'],
            'roomLabel' => room_type_label($observation['room_type']) . ' #' . $observation['room_number'],
            'observationType' => $observation['observation_type'],
            'notes' => $observation['notes'],
            'observedAt' => $observation['observed_at'],
            'appetiteStatus' => $observation['appetite_status'] ?? null,
            'waterIntakeStatus' => $observation['water_intake_status'] ?? null,
            'eliminationStatus' => $observation['elimination_status'] ?? null,
            'behaviorStatus' => $observation['behavior_status'] ?? null,
            'temperatureC' => isset($observation['temperature_c']) ? (float)$observation['temperature_c'] : null,
            'weightKg' => isset($observation['weight_kg']) ? (float)$observation['weight_kg'] : null,
            'conditionSeverity' => $observation['condition_severity'] ?? null,
            'requiresVetReview' => isset($observation['requires_vet_review'])
                ? (bool)$observation['requires_vet_review']
                : null,
            'createdByUserId' => $observation['created_by_user_id'] !== null ? (int)$observation['created_by_user_id'] : null,
            'createdByName' => trim((string)$observation['created_by_name']),
            'createdAt' => $observation['created_at'],
        ];
    }, $observationsStmt->fetchAll(PDO::FETCH_ASSOC));

    $documentSchemaReady = boarding_documents_schema_ready($pdo);
    $documentFilters = array_merge($filters, [
        'branch_id' => $branchId,
        'limit' => $pagination['limit'],
        'offset' => $pagination['offset'],
    ]);
    $documents = $documentSchemaReady ? boarding_fetch_documents($pdo, $documentFilters) : [];

    echo json_encode([
        'tasks' => $tasks,
        'observations' => $observations,
        'documentSchemaReady' => $documentSchemaReady,
        'documents' => $documents,
        'pagination' => [
            'limit' => $pagination['limit'],
            'offset' => $pagination['offset'],
            'page' => $pagination['page'],
            'returned' => [
                'tasks' => count($tasks),
                'observations' => count($observations),
                'documents' => count($documents),
            ],
        ],
    ]);
}

function observation_action(PDO $pdo): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        boarding_error(405, 'Method not allowed.');
    }

    $input = boarding_json_input();
    $allowedTypes = ['eating', 'bathing', 'playing', 'behavior', 'other'];
    $type = strtolower(trim((string)($input['observation_type'] ?? '')));
    $notes = trim((string)($input['notes'] ?? ''));

    if (!in_array($type, $allowedTypes, true)) {
        boarding_error(400, 'Invalid observation type.');
    }

    if ($notes === '') {
        boarding_error(400, 'Observation notes are required.');
    }

    $assignment = fetch_assignment_for_monitoring($pdo, $input);
    $petId = boarding_resolve_assignment_pet_id($pdo, $assignment, $input);
    $actor = boarding_current_actor($pdo, $input);
    $observedAt = date('Y-m-d H:i:s');

    $columns = [
        'assignment_id',
        'booking_id',
        'pet_id',
        'room_type',
        'room_number',
        'observation_type',
        'notes',
        'observed_at',
        'created_by_user_id',
    ];
    $values = [
        (int)$assignment['assignment_id'],
        (int)$assignment['booking_id'],
        $petId,
        $assignment['room_type'],
        (int)$assignment['room_number'],
        $type,
        $notes,
        $observedAt,
        $actor['user_id'],
    ];
    $structuredValues = [
        'appetite_status' => boarding_optional_status($input, 'appetite_status', 'appetiteStatus'),
        'water_intake_status' => boarding_optional_status($input, 'water_intake_status', 'waterIntakeStatus'),
        'elimination_status' => boarding_optional_status($input, 'elimination_status', 'eliminationStatus'),
        'behavior_status' => boarding_optional_status($input, 'behavior_status', 'behaviorStatus'),
        'temperature_c' => boarding_optional_measurement($input, 'temperature_c', 'temperatureC', 20, 50),
        'weight_kg' => boarding_optional_measurement($input, 'weight_kg', 'weightKg', 0.01, 1000),
        'condition_severity' => boarding_optional_status($input, 'condition_severity', 'conditionSeverity'),
        'requires_vet_review' => boarding_optional_boolean($input, 'requires_vet_review', 'requiresVetReview'),
    ];

    $storedStructuredFields = [];
    $skippedStructuredFields = [];
    foreach ($structuredValues as $columnName => $value) {
        if ($value === null) {
            continue;
        }

        if (boarding_column_exists($pdo, 'boarding_observations', $columnName)) {
            $columns[] = $columnName;
            $values[] = is_bool($value) ? (int)$value : $value;
            $storedStructuredFields[] = $columnName;
        } else {
            $skippedStructuredFields[] = $columnName;
        }
    }

    $placeholders = implode(', ', array_fill(0, count($columns), '?'));
    $stmt = $pdo->prepare(
        'INSERT INTO boarding_observations (' . implode(', ', $columns) . ") VALUES ({$placeholders})"
    );
    $stmt->execute($values);

    echo json_encode([
        'message' => 'Observation recorded.',
        'structuredFieldsStored' => $storedStructuredFields,
        'structuredFieldsSkipped' => $skippedStructuredFields,
    ]);
}

function task_action(PDO $pdo): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        boarding_error(405, 'Method not allowed.');
    }

    $input = boarding_json_input();
    $allowedTypes = ['feeding', 'bathing', 'playing', 'medication', 'inspection', 'other'];
    $type = strtolower(trim((string)($input['task_type'] ?? '')));
    $dueAt = trim((string)($input['due_at'] ?? ''));
    $assignedTo = trim((string)($input['assigned_to'] ?? ''));
    $notes = trim((string)($input['notes'] ?? ''));

    if (!in_array($type, $allowedTypes, true)) {
        boarding_error(400, 'Invalid task type.');
    }

    if ($dueAt === '' || strtotime($dueAt) === false) {
        boarding_error(400, 'A valid due date and time is required.');
    }

    $assignment = fetch_assignment_for_monitoring($pdo, $input);
    $petId = boarding_resolve_assignment_pet_id($pdo, $assignment, $input);
    $actor = boarding_current_actor($pdo, $input);
    $normalizedDueAt = date('Y-m-d H:i:s', strtotime($dueAt));

    $stmt = $pdo->prepare("
        INSERT INTO boarding_tasks (
            assignment_id,
            booking_id,
            pet_id,
            room_type,
            room_number,
            task_type,
            due_at,
            assigned_to,
            notes,
            created_by_user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");
    $stmt->execute([
        (int)$assignment['assignment_id'],
        (int)$assignment['booking_id'],
        $petId,
        $assignment['room_type'],
        (int)$assignment['room_number'],
        $type,
        $normalizedDueAt,
        $assignedTo !== '' ? $assignedTo : null,
        $notes !== '' ? $notes : null,
        $actor['user_id'],
    ]);

    echo json_encode(['message' => 'Task scheduled.']);
}

function boarding_materials_schema_ready(PDO $pdo): bool
{
    if (!boarding_table_exists($pdo, 'boarding_material_usages')) {
        return false;
    }

    foreach ([
        'usage_id',
        'client_reference',
        'assignment_id',
        'booking_id',
        'pet_id',
        'item_id',
        'item_name',
        'category',
        'unit',
        'quantity',
        'unit_price',
        'notes',
        'status',
        'recorded_by_user_id',
        'recorded_by_name',
        'voided_by_user_id',
        'voided_by_name',
        'voided_at',
        'created_at',
        'updated_at',
    ] as $columnName) {
        if (!boarding_column_exists($pdo, 'boarding_material_usages', $columnName)) {
            return false;
        }
    }

    return boarding_index_exists(
        $pdo,
        'boarding_material_usages',
        'boarding_material_client_reference_unique'
    );
}

function boarding_material_billing_trace_ready(PDO $pdo): bool
{
    return boarding_materials_schema_ready($pdo)
        && boarding_table_exists($pdo, 'visit_charges')
        && boarding_column_exists($pdo, 'visit_charges', 'boarding_material_usage_id')
        && boarding_index_exists($pdo, 'visit_charges', 'visit_charges_boarding_material_unique')
        && boarding_constraint_exists($pdo, 'visit_charges', 'visit_charges_boarding_material_fk');
}

function boarding_materials_missing_message(): string
{
    return 'Boarding material usage schema is not installed. Run DDL/20260723_01_backend_integrity_schema.sql first.';
}

function boarding_lock_visits_and_assert_materials_mutable(PDO $pdo, int $bookingId): void
{
    foreach (['visits', 'visit_payments'] as $tableName) {
        if (!boarding_table_exists($pdo, $tableName)) {
            boarding_error(
                409,
                'Boarding materials cannot be changed until the visit billing migration is installed.'
            );
        }
    }

    $visitLockStmt = $pdo->prepare("
        SELECT visit_id
        FROM visits
        WHERE booking_id = ?
        ORDER BY visit_id ASC
        FOR UPDATE
    ");
    $visitLockStmt->execute([$bookingId]);
    $visitLockStmt->fetchAll(PDO::FETCH_COLUMN);

    $paymentStmt = $pdo->prepare("
        SELECT vp.payment_status
        FROM visit_payments vp
        JOIN visits v ON v.visit_id = vp.visit_id
        WHERE v.booking_id = ?
          AND vp.payment_status IN ('verified', 'refunded')
        ORDER BY vp.payment_id ASC
        LIMIT 1
    ");
    $paymentStmt->execute([$bookingId]);
    $lockedPaymentStatus = (string)($paymentStmt->fetchColumn() ?: '');
    if ($lockedPaymentStatus !== '') {
        boarding_error(
            409,
            'Boarding materials are locked because this stay has a '
            . $lockedPaymentStatus
            . ' payment. Resolve billing through the payment record instead of changing the recorded stay.'
        );
    }
}

function boarding_format_material_usage(array $row): array
{
    $visitChargeId = isset($row['visit_charge_id']) && $row['visit_charge_id'] !== null
        ? (int)$row['visit_charge_id']
        : null;
    $assignmentStatus = (string)($row['assignment_status'] ?? '');
    $hasLockedPayment = !empty($row['has_locked_payment']);

    return [
        'id' => 'material-' . (int)$row['usage_id'],
        'usageId' => (int)$row['usage_id'],
        'clientReference' => $row['client_reference'] ?? null,
        'assignmentId' => (int)$row['assignment_id'],
        'bookingId' => (int)$row['booking_id'],
        'bookingNumber' => $row['booking_number'] ?? '',
        'petId' => $row['pet_id'] !== null ? (int)$row['pet_id'] : null,
        'petName' => $row['pet_name'] ?? 'Pet',
        'roomLabel' => room_type_label((string)$row['room_type']) . ' #' . (int)$row['room_number'],
        'inventoryId' => $row['item_id'] !== null ? (string)$row['item_id'] : null,
        'itemId' => $row['item_id'] !== null ? (int)$row['item_id'] : null,
        'itemName' => $row['item_name'],
        'category' => $row['category'] ?? '',
        'quantity' => (float)$row['quantity'],
        'unit' => $row['unit'],
        'unitPrice' => (float)$row['unit_price'],
        'notes' => $row['notes'] ?? '',
        'status' => $row['status'],
        'assignmentStatus' => $assignmentStatus,
        'visitChargeId' => $visitChargeId,
        'billedVisitId' => isset($row['billed_visit_id']) && $row['billed_visit_id'] !== null
            ? (int)$row['billed_visit_id']
            : null,
        'isBilled' => $visitChargeId !== null,
        'hasLockedPayment' => $hasLockedPayment,
        'canRemove' => ($row['status'] ?? '') === 'recorded'
            && in_array($assignmentStatus, ['reserved', 'occupied'], true)
            && $visitChargeId === null
            && !$hasLockedPayment,
        'createdAt' => $row['created_at'],
        'createdByUserId' => $row['recorded_by_user_id'] !== null ? (int)$row['recorded_by_user_id'] : null,
        'createdByName' => $row['recorded_by_name'] ?? '',
        'voidedAt' => $row['voided_at'],
        'voidedByUserId' => $row['voided_by_user_id'] !== null ? (int)$row['voided_by_user_id'] : null,
        'voidedByName' => $row['voided_by_name'] ?? '',
    ];
}

function boarding_fetch_material_usages(PDO $pdo, array $filters = []): array
{
    $conditions = [];
    $params = [];
    foreach ([
        'usage_id' => 'bmu.usage_id',
        'assignment_id' => 'bmu.assignment_id',
        'booking_id' => 'bmu.booking_id',
        'pet_id' => 'bmu.pet_id',
        'branch_id' => 'b.branch_id',
    ] as $filterKey => $columnName) {
        if ((int)($filters[$filterKey] ?? 0) > 0) {
            $conditions[] = "{$columnName} = ?";
            $params[] = (int)$filters[$filterKey];
        }
    }

    if (empty($filters['include_voided'])) {
        $conditions[] = "bmu.status = 'recorded'";
    }

    $whereSql = $conditions ? 'WHERE ' . implode(' AND ', $conditions) : '';
    $limitSql = '';
    if ((int)($filters['limit'] ?? 0) > 0) {
        $limit = min(1000, (int)$filters['limit']);
        $offset = max(0, (int)($filters['offset'] ?? 0));
        $limitSql = "LIMIT {$limit} OFFSET {$offset}";
    }

    $chargeSelectSql = 'NULL AS visit_charge_id, NULL AS billed_visit_id';
    $chargeJoinSql = '';
    if (boarding_material_billing_trace_ready($pdo)) {
        $chargeSelectSql = 'vc.charge_id AS visit_charge_id, vc.visit_id AS billed_visit_id';
        $chargeJoinSql = '
            LEFT JOIN visit_charges vc
              ON vc.boarding_material_usage_id = bmu.usage_id
        ';
    }

    $lockedPaymentSelectSql = '0 AS has_locked_payment';
    if (boarding_table_exists($pdo, 'visits') && boarding_table_exists($pdo, 'visit_payments')) {
        $lockedPaymentSelectSql = "
            EXISTS (
                SELECT 1
                FROM visits payment_visit
                JOIN visit_payments vp ON vp.visit_id = payment_visit.visit_id
                WHERE payment_visit.booking_id = bmu.booking_id
                  AND vp.payment_status IN ('verified', 'refunded')
            ) AS has_locked_payment
        ";
    }

    $stmt = $pdo->prepare("
        SELECT
            bmu.*,
            ba.room_type,
            ba.room_number,
            ba.status AS assignment_status,
            b.booking_number,
            COALESCE(p.pet_name, b.unregistered_pet_name, 'Pet') AS pet_name,
            {$chargeSelectSql},
            {$lockedPaymentSelectSql}
        FROM boarding_material_usages bmu
        JOIN boarding_assignments ba ON ba.assignment_id = bmu.assignment_id
        JOIN bookings b ON b.booking_id = bmu.booking_id
        LEFT JOIN pets_information p ON p.pet_id = bmu.pet_id
        {$chargeJoinSql}
        {$whereSql}
        ORDER BY bmu.created_at DESC, bmu.usage_id DESC
        {$limitSql}
    ");
    $stmt->execute($params);

    return array_map('boarding_format_material_usage', $stmt->fetchAll(PDO::FETCH_ASSOC));
}

function boarding_materials_action(PDO $pdo): void
{
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $branchId = boarding_branch_id($pdo);
        if (!boarding_materials_schema_ready($pdo)) {
            echo json_encode([
                'schemaReady' => false,
                'billingTraceReady' => false,
                'message' => boarding_materials_missing_message(),
                'materials' => [],
            ]);
            return;
        }

        $includeVoided = filter_var(
            $_GET['includeVoided'] ?? $_GET['include_voided'] ?? false,
            FILTER_VALIDATE_BOOLEAN
        );
        echo json_encode([
            'schemaReady' => true,
            'billingTraceReady' => boarding_material_billing_trace_ready($pdo),
            'materials' => boarding_fetch_material_usages($pdo, [
                'assignment_id' => $_GET['assignmentId'] ?? $_GET['assignment_id'] ?? null,
                'booking_id' => $_GET['bookingId'] ?? $_GET['booking_id'] ?? null,
                'pet_id' => $_GET['petId'] ?? $_GET['pet_id'] ?? null,
                'branch_id' => $branchId,
                'include_voided' => $includeVoided,
                'limit' => $_GET['limit'] ?? $_GET['pageSize'] ?? null,
                'offset' => $_GET['offset'] ?? null,
            ]),
        ]);
        return;
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        boarding_error(405, 'Method not allowed.');
    }

    if (!boarding_materials_schema_ready($pdo)) {
        boarding_error(409, boarding_materials_missing_message());
    }

    $input = boarding_json_input();
    $pdo->beginTransaction();
    $assignment = fetch_assignment_for_monitoring($pdo, $input);
    fetch_boarding_booking($pdo, (int)$assignment['booking_id'], true);
    $lockedAssignment = fetch_active_assignment($pdo, (int)$assignment['booking_id'], true);
    if (
        !$lockedAssignment
        || (int)$lockedAssignment['assignment_id'] !== (int)$assignment['assignment_id']
    ) {
        boarding_error(409, 'The boarding assignment is no longer active. Refresh and try again.');
    }
    $assignment = array_merge($assignment, $lockedAssignment);
    boarding_lock_visits_and_assert_materials_mutable($pdo, (int)$assignment['booking_id']);
    $petId = boarding_resolve_assignment_pet_id($pdo, $assignment, $input);
    $itemId = (int)($input['item_id'] ?? $input['itemId'] ?? $input['inventory_id'] ?? $input['inventoryId'] ?? 0);
    $quantity = (float)($input['quantity'] ?? 0);
    $clientReference = boarding_document_nullable_text(
        $input['client_reference'] ?? $input['clientReference'] ?? null
    );
    $hasClientReference = boarding_column_exists($pdo, 'boarding_material_usages', 'client_reference');

    if ($itemId <= 0) {
        boarding_error(400, 'Select a valid inventory item.');
    }
    if (!is_finite($quantity) || $quantity <= 0 || abs($quantity - round($quantity)) > 0.0001) {
        boarding_error(400, 'Material quantity must be a positive whole number.');
    }
    $clientReferenceLength = $clientReference === null
        ? 0
        : (function_exists('mb_strlen') ? mb_strlen($clientReference) : strlen($clientReference));
    if ($clientReferenceLength > 100) {
        boarding_error(422, 'Material client reference must be 100 characters or fewer.');
    }
    $unitPriceInput = $input['unit_price'] ?? $input['unitPrice'] ?? null;
    if (
        $unitPriceInput !== null
        && $unitPriceInput !== ''
        && (
            !is_numeric($unitPriceInput)
            || !is_finite((float)$unitPriceInput)
            || (float)$unitPriceInput < 0
        )
    ) {
        boarding_error(400, 'Material unit price must be a valid non-negative number.');
    }

    if ($hasClientReference && $clientReference !== null) {
        $existingReferenceStmt = $pdo->prepare("
            SELECT usage_id, item_id, quantity, unit_price, status
            FROM boarding_material_usages
            WHERE assignment_id = ?
              AND client_reference = ?
            LIMIT 1
        ");
        $existingReferenceStmt->execute([(int)$assignment['assignment_id'], $clientReference]);
        $existingUsage = $existingReferenceStmt->fetch(PDO::FETCH_ASSOC);
        $existingUsageId = (int)($existingUsage['usage_id'] ?? 0);
        if ($existingUsageId > 0) {
            if (($existingUsage['status'] ?? '') !== 'recorded') {
                boarding_error(
                    409,
                    'This material client reference belongs to a voided record. Remove the local line and add it again if it is still needed.'
                );
            }
            if (
                (int)$existingUsage['item_id'] !== $itemId
                || abs((float)$existingUsage['quantity'] - $quantity) > 0.0001
                || (
                    $unitPriceInput !== null
                    && $unitPriceInput !== ''
                    && abs((float)$existingUsage['unit_price'] - (float)$unitPriceInput) > 0.009
                )
            ) {
                boarding_error(409, 'This material client reference is already used by a different material record.');
            }
            $materials = boarding_fetch_material_usages($pdo, [
                'usage_id' => $existingUsageId,
                'include_voided' => true,
            ]);
            $pdo->commit();
            echo json_encode([
                'schemaReady' => true,
                'billingTraceReady' => boarding_material_billing_trace_ready($pdo),
                'message' => 'Boarding material already recorded.',
                'material' => $materials[0] ?? null,
            ]);
            return;
        }
    }

    $sellingPriceSelect = boarding_column_exists($pdo, 'inventory_items', 'selling_price')
        ? 'selling_price'
        : 'unit_cost AS selling_price';
    $itemStmt = $pdo->prepare("
        SELECT item_id, item_name, category, unit, unit_cost, {$sellingPriceSelect}, status
        FROM inventory_items
        WHERE item_id = ?
        LIMIT 1
    ");
    $itemStmt->execute([$itemId]);
    $item = $itemStmt->fetch(PDO::FETCH_ASSOC);
    if (!$item || ($item['status'] ?? '') !== 'active') {
        boarding_error(404, 'The selected active inventory item was not found.');
    }

    $assignmentBranchId = (int)($assignment['branch_id'] ?? 0);
    if (boarding_table_exists($pdo, 'inventory_batches')) {
        if ($assignmentBranchId <= 0) {
            boarding_error(409, 'The boarding assignment has no valid branch for inventory deduction.');
        }
        $reservedQuantity = 0.0;
        if (boarding_material_billing_trace_ready($pdo)) {
            $reservedStmt = $pdo->prepare("
                SELECT usage_record.quantity
                FROM boarding_material_usages usage_record
                JOIN bookings reserved_booking
                  ON reserved_booking.booking_id = usage_record.booking_id
                LEFT JOIN visit_charges billed_charge
                  ON billed_charge.boarding_material_usage_id = usage_record.usage_id
                WHERE usage_record.item_id = ?
                  AND reserved_booking.branch_id = ?
                  AND usage_record.status = 'recorded'
                  AND billed_charge.charge_id IS NULL
                ORDER BY usage_record.usage_id ASC
                FOR UPDATE
            ");
            $reservedStmt->execute([$itemId, $assignmentBranchId]);
            $reservedQuantity = array_sum(array_map(
                'floatval',
                $reservedStmt->fetchAll(PDO::FETCH_COLUMN)
            ));
        }
        $stockStmt = $pdo->prepare("
            SELECT batch.quantity
            FROM inventory_batches batch
            JOIN inventory_locations location ON location.location_id = batch.location_id
            WHERE batch.item_id = ?
              AND location.branch_id = ?
              AND location.status = 'active'
              AND (batch.expiry_date IS NULL OR batch.expiry_date >= CURDATE())
            ORDER BY batch.batch_id ASC
            FOR UPDATE
        ");
        $stockStmt->execute([$itemId, $assignmentBranchId]);
        $physicalAvailableQuantity = array_sum(array_map(
            'floatval',
            $stockStmt->fetchAll(PDO::FETCH_COLUMN)
        ));
        $availableQuantity = max(0.0, $physicalAvailableQuantity - $reservedQuantity);
        if ($quantity > $availableQuantity + 0.0001) {
            boarding_error(
                409,
                $item['item_name'] . ' has only ' . number_format($availableQuantity, 2) . ' ' . $item['unit'] . ' available at this branch after recorded boarding use.'
            );
        }
    }

    $unitPrice = (float)($item['selling_price'] ?? $item['unit_cost'] ?? 0);
    if (!is_finite($unitPrice) || $unitPrice < 0) {
        boarding_error(400, 'Material unit price must be a valid non-negative number.');
    }

    $actor = boarding_current_actor($pdo, $input);
    $columns = [
        'assignment_id',
        'booking_id',
        'pet_id',
        'item_id',
        'item_name',
        'category',
        'unit',
        'quantity',
        'unit_price',
        'notes',
        'recorded_by_user_id',
        'recorded_by_name',
    ];
    $values = [
        (int)$assignment['assignment_id'],
        (int)$assignment['booking_id'],
        $petId,
        $itemId,
        $item['item_name'],
        boarding_document_nullable_text($item['category'] ?? null),
        $item['unit'],
        round($quantity, 2),
        round($unitPrice, 2),
        boarding_document_nullable_text($input['notes'] ?? null),
        $actor['user_id'],
        $actor['name'],
    ];
    if ($hasClientReference && $clientReference !== null) {
        array_unshift($columns, 'client_reference');
        array_unshift($values, $clientReference);
    }

    $placeholders = implode(', ', array_fill(0, count($columns), '?'));
    $stmt = $pdo->prepare(
        'INSERT INTO boarding_material_usages (`'
        . implode('`, `', $columns)
        . "`) VALUES ({$placeholders})"
    );
    try {
        $stmt->execute($values);
    } catch (PDOException $e) {
        if ($hasClientReference && $clientReference !== null && $e->getCode() === '23000') {
            $existingReferenceStmt = $pdo->prepare("
                SELECT usage_id, item_id, quantity, unit_price, status
                FROM boarding_material_usages
                WHERE assignment_id = ?
                  AND client_reference = ?
                LIMIT 1
            ");
            $existingReferenceStmt->execute([(int)$assignment['assignment_id'], $clientReference]);
            $existingUsage = $existingReferenceStmt->fetch(PDO::FETCH_ASSOC);
            $existingUsageId = (int)($existingUsage['usage_id'] ?? 0);
            if ($existingUsageId > 0) {
                if (($existingUsage['status'] ?? '') !== 'recorded') {
                    boarding_error(
                        409,
                        'This material client reference belongs to a voided record. Remove the local line and add it again if it is still needed.'
                    );
                }
                if (
                    (int)$existingUsage['item_id'] !== $itemId
                    || abs((float)$existingUsage['quantity'] - $quantity) > 0.0001
                    || abs((float)$existingUsage['unit_price'] - $unitPrice) > 0.009
                ) {
                    boarding_error(409, 'This material client reference is already used by a different material record.');
                }
                $materials = boarding_fetch_material_usages($pdo, [
                    'usage_id' => $existingUsageId,
                    'include_voided' => true,
                ]);
                $pdo->commit();
                echo json_encode([
                    'schemaReady' => true,
                    'billingTraceReady' => boarding_material_billing_trace_ready($pdo),
                    'message' => 'Boarding material already recorded.',
                    'material' => $materials[0] ?? null,
                ]);
                return;
            }
        }
        throw $e;
    }
    $usageId = (int)$pdo->lastInsertId();
    $materials = boarding_fetch_material_usages($pdo, ['usage_id' => $usageId, 'include_voided' => true]);
    $pdo->commit();

    echo json_encode([
        'schemaReady' => true,
        'billingTraceReady' => boarding_material_billing_trace_ready($pdo),
        'message' => 'Boarding material recorded.',
        'material' => $materials[0] ?? null,
    ]);
}

function boarding_material_item_action(PDO $pdo): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'DELETE' && $_SERVER['REQUEST_METHOD'] !== 'PATCH') {
        boarding_error(405, 'Method not allowed.');
    }

    if (!boarding_materials_schema_ready($pdo)) {
        boarding_error(409, boarding_materials_missing_message());
    }

    $usageId = (int)($_GET['usageId'] ?? 0);
    if ($usageId <= 0) {
        boarding_error(400, 'Boarding material usage ID is required.');
    }

    $existingBeforeLock = boarding_fetch_material_usages($pdo, [
        'usage_id' => $usageId,
        'include_voided' => true,
    ]);
    if (empty($existingBeforeLock)) {
        boarding_error(404, 'Boarding material usage was not found.');
    }

    $pdo->beginTransaction();
    $bookingId = (int)$existingBeforeLock[0]['bookingId'];
    fetch_boarding_booking($pdo, $bookingId, true);
    $lockedAssignment = fetch_active_assignment($pdo, $bookingId, true);
    if (
        !$lockedAssignment
        || (int)$lockedAssignment['assignment_id'] !== (int)$existingBeforeLock[0]['assignmentId']
    ) {
        boarding_error(409, 'Boarding materials cannot be removed after checkout or cancellation.');
    }
    boarding_lock_visits_and_assert_materials_mutable($pdo, $bookingId);

    $usageLockStmt = $pdo->prepare("
        SELECT
            bmu.status,
            bmu.booking_id,
            ba.status AS assignment_status
        FROM boarding_material_usages bmu
        JOIN boarding_assignments ba ON ba.assignment_id = bmu.assignment_id
        WHERE bmu.usage_id = ?
        LIMIT 1
        FOR UPDATE
    ");
    $usageLockStmt->execute([$usageId]);
    $existing = $usageLockStmt->fetch(PDO::FETCH_ASSOC);
    if (!$existing) {
        boarding_error(404, 'Boarding material usage was not found.');
    }
    if ((int)$existing['booking_id'] !== $bookingId) {
        boarding_error(409, 'Boarding material usage changed while it was being updated. Refresh and try again.');
    }
    if (!in_array((string)$existing['assignment_status'], ['reserved', 'occupied'], true)) {
        boarding_error(409, 'Boarding materials cannot be removed after checkout or cancellation.');
    }
    if (($existing['status'] ?? '') === 'voided') {
        $pdo->commit();
        echo json_encode(['message' => 'Boarding material removed.']);
        return;
    }

    if (boarding_material_billing_trace_ready($pdo)) {
        $chargeStmt = $pdo->prepare("
            SELECT charge_id
            FROM visit_charges
            WHERE boarding_material_usage_id = ?
            LIMIT 1
            FOR UPDATE
        ");
        $chargeStmt->execute([$usageId]);
        if ((int)($chargeStmt->fetchColumn() ?: 0) > 0) {
            boarding_error(
                409,
                'This material is already linked to an invoice charge. Remove it from the unpaid invoice before removing the usage record.'
            );
        }
    }

    $actor = boarding_current_actor($pdo);
    $stmt = $pdo->prepare("
        UPDATE boarding_material_usages
        SET status = 'voided',
            voided_by_user_id = ?,
            voided_by_name = ?,
            voided_at = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE usage_id = ?
          AND status = 'recorded'
    ");
    $stmt->execute([
        $actor['user_id'],
        $actor['name'],
        date('Y-m-d H:i:s'),
        $usageId,
    ]);
    $pdo->commit();

    echo json_encode(['message' => 'Boarding material removed.']);
}

function task_complete_action(PDO $pdo): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'PATCH' && $_SERVER['REQUEST_METHOD'] !== 'POST') {
        boarding_error(405, 'Method not allowed.');
    }

    $taskId = isset($_GET['taskId']) ? (int)$_GET['taskId'] : 0;
    if ($taskId <= 0) {
        boarding_error(400, 'Task ID is required.');
    }

    $taskStmt = $pdo->prepare("
        SELECT
            bt.status,
            ba.status AS assignment_status,
            b.status AS booking_status,
            b.service_type
        FROM boarding_tasks bt
        LEFT JOIN boarding_assignments ba ON ba.assignment_id = bt.assignment_id
        JOIN bookings b ON b.booking_id = bt.booking_id
        WHERE bt.task_id = ?
        LIMIT 1
    ");
    $taskStmt->execute([$taskId]);
    $task = $taskStmt->fetch(PDO::FETCH_ASSOC);
    if (!$task) {
        boarding_error(404, 'Boarding task not found.');
    }

    if (($task['status'] ?? '') === 'completed') {
        echo json_encode(['message' => 'Task marked complete.']);
        return;
    }

    if (($task['status'] ?? '') === 'cancelled') {
        boarding_error(409, 'Cancelled boarding tasks cannot be completed.');
    }

    if (
        ($task['service_type'] ?? '') !== 'boarding'
        || ($task['booking_status'] ?? '') === 'cancelled'
        || !in_array((string)($task['assignment_status'] ?? ''), ['reserved', 'occupied'], true)
    ) {
        boarding_error(409, 'This task can no longer be completed because the boarding stay is not active.');
    }

    $completedAt = date('Y-m-d H:i:s');
    $stmt = $pdo->prepare("
        UPDATE boarding_tasks
        SET status = 'completed',
            completed_at = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE task_id = ?
          AND status = 'pending'
    ");
    $stmt->execute([$completedAt, $taskId]);

    echo json_encode(['message' => 'Task marked complete.']);
}

try {
    $action = $_GET['action'] ?? '';
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    $requiredTables = ['rooms', 'room_unit_statuses', 'boarding_assignments', 'boarding_observations', 'boarding_tasks'];

    if ($action === 'rooms') {
        ensure_boarding_rooms_schema($pdo);
    }

    if ($action === 'rooms' && $method === 'POST') {
        $requiredTables = ['rooms'];
    }

    require_boarding_tables($pdo, $requiredTables);

    switch ($action) {
        case 'rooms':
            rooms_action($pdo);
            break;
        case 'assign-room':
            assign_room_action($pdo);
            break;
        case 'check-in':
            check_in_action($pdo);
            break;
        case 'check-out':
            check_out_action($pdo);
            break;
        case 'desired-check-out':
            desired_check_out_action($pdo);
            break;
        case 'direct-check-in':
            direct_check_in_action($pdo);
            break;
        case 'monitoring':
            monitoring_action($pdo);
            break;
        case 'documents':
            boarding_documents_action($pdo);
            break;
        case 'materials':
            boarding_materials_action($pdo);
            break;
        case 'material-item':
            boarding_material_item_action($pdo);
            break;
        case 'observation':
            observation_action($pdo);
            break;
        case 'task':
            task_action($pdo);
            break;
        case 'task-complete':
            task_complete_action($pdo);
            break;
        default:
            boarding_error(404, 'Boarding action not found.');
    }
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    boarding_internal_failure('request failed', $e, 'The boarding request could not be completed. Please try again.');
}
