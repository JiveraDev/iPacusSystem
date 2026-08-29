<?php

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/branch_helpers.php';
require_once __DIR__ . '/booking_slot_helpers.php';

header('Content-Type: application/json');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

// All clinic schedules are stored and displayed in Philippine time. Keep the
// strtotime()/date() calls in this endpoint aligned with booking validation.
date_default_timezone_set('Asia/Manila');

function booking_availability_services(): array
{
    return [
        ['key' => 'general-checkup', 'label' => 'General Check-up', 'serviceType' => 'General Check-up', 'intervalMinutes' => 30],
        ['key' => 'vaccination', 'label' => 'Vaccination', 'serviceType' => 'vaccination', 'intervalMinutes' => 30],
        ['key' => 'parasite-control', 'label' => 'Parasite Control', 'serviceType' => 'parasite-control', 'intervalMinutes' => 30],
        ['key' => 'grooming', 'label' => 'Grooming', 'serviceType' => 'grooming', 'intervalMinutes' => 30],
        ['key' => 'dental', 'label' => 'Dental Check-up', 'serviceType' => 'dental', 'intervalMinutes' => 30],
        ['key' => 'surgery', 'label' => 'Surgery', 'serviceType' => 'surgery', 'intervalMinutes' => 30],
        ['key' => 'lab-testing', 'label' => 'Laboratory Testing', 'serviceType' => 'lab-testing', 'intervalMinutes' => 30],
        ['key' => 'online-consultation', 'label' => 'Online Consultation', 'serviceType' => 'consultation', 'intervalMinutes' => 30, 'requiresVeterinarian' => true],
        ['key' => 'home-service', 'label' => 'Home Service', 'serviceType' => 'home-service', 'intervalMinutes' => 60],
        ['key' => 'special-services', 'label' => 'Special Services', 'serviceType' => 'special services', 'intervalMinutes' => 30],
        ['key' => 'boarding', 'label' => 'Pet Hotel and Boarding', 'serviceType' => 'boarding', 'mode' => 'rooms'],
    ];
}

function booking_availability_date(?string $value): ?string
{
    $parsed = DateTimeImmutable::createFromFormat('!Y-m-d', trim((string)$value));
    $errors = DateTimeImmutable::getLastErrors();
    $hasErrors = is_array($errors) && ($errors['warning_count'] > 0 || $errors['error_count'] > 0);
    return $parsed && !$hasErrors ? $parsed->format('Y-m-d') : null;
}

function booking_availability_month(?string $value): ?string
{
    $parsed = DateTimeImmutable::createFromFormat('!Y-m', trim((string)$value));
    $errors = DateTimeImmutable::getLastErrors();
    $hasErrors = is_array($errors) && ($errors['warning_count'] > 0 || $errors['error_count'] > 0);
    return $parsed && !$hasErrors ? $parsed->format('Y-m') : null;
}

function booking_availability_branch_service_key(array $service): string
{
    return branch_service_key(
        $service['serviceType'],
        $service['key'] === 'home-service',
        $service['key'] === 'online-consultation'
    );
}

function booking_availability_active_veterinarians(PDO $pdo): array
{
    if (!booking_slot_table_exists($pdo, 'users') || !booking_slot_table_exists($pdo, 'veterinarian_profiles')) {
        return [];
    }

    $accountFilter = branch_column_exists($pdo, 'users', 'account_status')
        ? "AND COALESCE(NULLIF(LOWER(u.account_status), ''), 'active') NOT IN ('archived', 'deactivated', 'disabled', 'inactive')"
        : '';
    $stmt = $pdo->query("\n        SELECT u.user_id, u.first_Name, u.last_Name,\n               COALESCE(NULLIF(TRIM(vp.specialization), ''), 'General Practice') AS specialization\n        FROM users u\n        JOIN veterinarian_profiles vp ON vp.user_id = u.user_id\n        WHERE LOWER(REPLACE(REPLACE(TRIM(u.role), ' ', '_'), '-', '_')) IN ('veterinarian', 'vet')\n          AND COALESCE(vp.is_active, 1) = 1\n          AND COALESCE(vp.is_accepting_patients, 1) = 1\n          {$accountFilter}\n        ORDER BY u.last_Name, u.first_Name, u.user_id\n    ");

    return array_map(static function (array $row): array {
        return [
            'id' => (int)$row['user_id'],
            'name' => trim('Dr. ' . $row['first_Name'] . ' ' . $row['last_Name']),
            'specialization' => $row['specialization'],
        ];
    }, $stmt->fetchAll(PDO::FETCH_ASSOC));
}

function booking_availability_hours(PDO $pdo, int $branchId, string $date): ?array
{
    static $branchHours = [];
    static $branchClosures = [];
    $timestamp = strtotime($date);
    if ($timestamp === false || (int)date('N', $timestamp) === 7) {
        return null;
    }

    $cacheKey = spl_object_id($pdo) . ':' . $branchId;
    if (!array_key_exists($cacheKey, $branchHours)) {
        $hoursStmt = $pdo->prepare("
            SELECT day_of_week, opens_at, closes_at, is_closed
            FROM branch_operating_hours
            WHERE branch_id = ?
        ");
        $hoursStmt->execute([$branchId]);
        $branchHours[$cacheKey] = [];
        foreach ($hoursStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $branchHours[$cacheKey][(int)$row['day_of_week']] = $row;
        }

        $closureStmt = $pdo->prepare('SELECT closure_date FROM branch_closures WHERE branch_id = ?');
        $closureStmt->execute([$branchId]);
        $branchClosures[$cacheKey] = array_fill_keys(
            array_map(static fn($value): string => substr((string)$value, 0, 10), $closureStmt->fetchAll(PDO::FETCH_COLUMN)),
            true
        );
    }

    if (isset($branchClosures[$cacheKey][$date])) {
        return null;
    }

    $hours = $branchHours[$cacheKey][(int)date('N', $timestamp)] ?? null;
    if (!$hours || (int)$hours['is_closed'] === 1) {
        return null;
    }

    return [
        'opensAt' => booking_slot_normalize_time($hours['opens_at'] ?? null),
        'closesAt' => booking_slot_normalize_time($hours['closes_at'] ?? null),
    ];
}

function booking_availability_base_times(array $hours, int $intervalMinutes): array
{
    $opensAt = booking_slot_normalize_time($hours['opensAt'] ?? null);
    $closesAt = booking_slot_normalize_time($hours['closesAt'] ?? null);
    if ($opensAt === null || $closesAt === null || $intervalMinutes <= 0) {
        return [];
    }

    $cursor = strtotime('1970-01-01 ' . $opensAt);
    $closing = strtotime('1970-01-01 ' . $closesAt);
    $step = $intervalMinutes * 60;
    $times = [];
    while ($cursor !== false && $closing !== false && $cursor + $step <= $closing) {
        $times[] = date('H:i:s', $cursor);
        $cursor += $step;
    }

    return $times;
}

function booking_availability_visit_rows(
    PDO $pdo,
    int $branchId,
    string $serviceKey,
    string $monthStart,
    string $monthEnd
): array {
    if (!booking_slot_table_exists($pdo, 'veterinarian_branch_schedules')) {
        return [];
    }

    $stmt = $pdo->prepare("\n        SELECT schedule.visit_schedule_id, schedule.veterinarian_user_id,\n               schedule.starts_at, schedule.ends_at, schedule.service_keys,\n               CONCAT(u.first_Name, ' ', u.last_Name) AS veterinarian_name\n        FROM veterinarian_branch_schedules schedule\n        JOIN users u ON u.user_id = schedule.veterinarian_user_id\n        WHERE schedule.branch_id = ?\n          AND schedule.status = 'published'\n          AND schedule.ends_at >= ?\n          AND schedule.starts_at < DATE_ADD(?, INTERVAL 1 DAY)\n          AND (\n              schedule.service_keys IS NULL\n              OR TRIM(schedule.service_keys) = ''\n              OR JSON_CONTAINS(schedule.service_keys, JSON_QUOTE(?))\n          )\n        ORDER BY schedule.starts_at, schedule.visit_schedule_id\n    ");
    $stmt->execute([$branchId, $monthStart . ' 00:00:00', $monthEnd, $serviceKey]);
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

function booking_availability_time_in_visit(
    string $date,
    string $time,
    array $visitRows,
    ?int $veterinarianId = null
): ?array {
    $slotStart = strtotime($date . ' ' . $time);
    if ($slotStart === false) {
        return null;
    }

    foreach ($visitRows as $visit) {
        if ($veterinarianId !== null && $veterinarianId > 0
            && (int)$visit['veterinarian_user_id'] !== $veterinarianId) {
            continue;
        }
        $visitStart = strtotime((string)$visit['starts_at']);
        $visitEnd = strtotime((string)$visit['ends_at']);
        if ($visitStart !== false && $visitEnd !== false && $slotStart >= $visitStart && $slotStart + 1800 <= $visitEnd) {
            return $visit;
        }
    }

    return null;
}

function booking_availability_slots_for_date(
    PDO $pdo,
    string $date,
    array $service,
    int $branchId,
    array $reservations,
    string $availabilityMode,
    array $visitRows,
    ?int $veterinarianId,
    ?string $veterinarianName,
    ?int $specialServiceId,
    int $nowTimestamp
): array {
    $hours = booking_availability_hours($pdo, $branchId, $date);
    if ($hours === null) {
        return [];
    }

    $serviceKey = $service['key'];
    $intervalMinutes = (int)($service['intervalMinutes'] ?? booking_slot_duration_minutes($serviceKey));
    $durationMinutes = booking_slot_duration_minutes($serviceKey);
    if ($serviceKey === 'online-consultation') {
        $times = $veterinarianId ? booking_slot_vet_times_for_date($pdo, $veterinarianId, $date) : [];
        $opens = strtotime('1970-01-01 ' . $hours['opensAt']);
        $closes = strtotime('1970-01-01 ' . $hours['closesAt']);
        $times = array_values(array_filter($times, static function (string $time) use ($opens, $closes, $durationMinutes): bool {
            $slot = strtotime('1970-01-01 ' . $time);
            return $slot !== false && $opens !== false && $closes !== false
                && $slot >= $opens && $slot + ($durationMinutes * 60) <= $closes;
        }));
    } else {
        $times = booking_availability_base_times($hours, $intervalMinutes);
    }

    $slots = [];
    foreach ($times as $time) {
        $visit = null;
        if ($availabilityMode === 'vet_visit') {
            $visit = booking_availability_time_in_visit($date, $time, $visitRows, $veterinarianId);
            if ($visit === null) {
                continue;
            }
        }

        $slotTimestamp = strtotime($date . ' ' . $time);
        $conflict = booking_slot_records_find_conflict(
            $reservations,
            $date,
            $time,
            $serviceKey,
            $serviceKey === 'online-consultation' ? $veterinarianId : null,
            0,
            $specialServiceId
        );
        $isPast = $slotTimestamp === false || $slotTimestamp <= $nowTimestamp;
        $status = $isPast ? 'unavailable' : ($conflict ? 'booked' : 'available');
        $slots[] = [
            'time' => substr($time, 0, 5),
            'label' => date('g:i A', strtotime('1970-01-01 ' . $time)),
            'status' => $status,
            'available' => $status === 'available',
            'veterinarianId' => $visit ? (int)$visit['veterinarian_user_id'] : $veterinarianId,
            'veterinarianName' => $visit ? trim((string)$visit['veterinarian_name']) : $veterinarianName,
        ];
    }

    return $slots;
}

function booking_availability_room_configuration(PDO $pdo, int $branchId): array
{
    if (!booking_slot_table_exists($pdo, 'rooms')) {
        return [];
    }

    $retiredJoin = booking_slot_table_exists($pdo, 'room_unit_statuses')
        ? "LEFT JOIN (\n            SELECT branch_id, room_type, COUNT(*) AS unavailable_count\n            FROM room_unit_statuses\n            WHERE status IN ('maintenance', 'retired')\n            GROUP BY branch_id, room_type\n        ) unavailable ON unavailable.branch_id = room.branch_id AND unavailable.room_type = room.room_type"
        : '';
    $retiredValue = booking_slot_table_exists($pdo, 'room_unit_statuses')
        ? 'COALESCE(unavailable.unavailable_count, 0)'
        : '0';
    $stmt = $pdo->prepare("\n        SELECT room.room_type, GREATEST(room.total_capacity - {$retiredValue}, 0) AS total_capacity\n        FROM rooms room\n        {$retiredJoin}\n        WHERE room.branch_id = ?\n        ORDER BY FIELD(room.room_type, 'hotel-small', 'hotel-medium', 'hotel-large', 'boarding-small', 'boarding-medium', 'boarding-large')\n    ");
    $stmt->execute([$branchId]);
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

function booking_availability_boarding_reservations(PDO $pdo, int $branchId, string $monthStart, string $monthEnd): array
{
    $stmt = $pdo->prepare("\n        SELECT booking_id, hotel_boarding_type, room_size, check_in_date, check_out_date, status\n        FROM bookings\n        WHERE branch_id = ?\n          AND LOWER(TRIM(COALESCE(service_type, ''))) = 'boarding'\n          AND status IN ('pending', 'confirmed')\n          AND check_in_date < DATE_ADD(?, INTERVAL 1 DAY)\n          AND check_out_date > ?\n        ORDER BY check_in_date, booking_id\n    ");
    $stmt->execute([$branchId, $monthEnd, $monthStart]);
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

function booking_availability_rooms_for_date(array $configuration, array $reservations, string $date, int $nowTimestamp): array
{
    $nextDate = date('Y-m-d', strtotime($date . ' +1 day'));
    $isPast = strtotime($date . ' 23:59:59') < $nowTimestamp;
    return array_map(static function (array $room) use ($reservations, $date, $nextDate, $isPast): array {
        [$type, $size] = array_pad(explode('-', (string)$room['room_type'], 2), 2, '');
        $booked = count(array_filter($reservations, static function (array $booking) use ($type, $size, $date, $nextDate): bool {
            return strtolower((string)$booking['hotel_boarding_type']) === $type
                && strtolower((string)$booking['room_size']) === $size
                && (string)$booking['check_in_date'] < $nextDate
                && (string)$booking['check_out_date'] > $date;
        }));
        $total = max(0, (int)$room['total_capacity']);
        $available = $isPast ? 0 : max(0, $total - $booked);
        return [
            'roomType' => $room['room_type'],
            'type' => $type,
            'size' => $size,
            'label' => ucfirst($type) . ' - ' . ucfirst($size),
            'total' => $total,
            'booked' => $booked,
            'available' => $available,
        ];
    }, $configuration);
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['message' => 'Method not allowed.']);
    exit;
}

try {
    branch_require_schema($pdo);
    $services = booking_availability_services();
    $requestedService = strtolower(trim((string)($_GET['service'] ?? $_GET['service_type'] ?? 'General Check-up')));
    $requestedKey = booking_slot_service_key(
        $requestedService,
        $requestedService === 'home-service',
        $requestedService === 'online-consultation'
    );
    $service = current(array_filter($services, static fn(array $item): bool => $item['key'] === $requestedKey));
    if (!$service) {
        $service = $services[0];
    }

    $timezone = new DateTimeZone('Asia/Manila');
    $now = new DateTimeImmutable('now', $timezone);
    $selectedDate = booking_availability_date($_GET['date'] ?? null);
    $month = booking_availability_month($_GET['month'] ?? null)
        ?? ($selectedDate ? substr($selectedDate, 0, 7) : $now->format('Y-m'));
    $monthStartObject = new DateTimeImmutable($month . '-01', $timezone);
    $monthStart = $monthStartObject->format('Y-m-d');
    $monthEnd = $monthStartObject->modify('last day of this month')->format('Y-m-d');
    if ($selectedDate === null || substr($selectedDate, 0, 7) !== $month) {
        $selectedDate = $month === $now->format('Y-m') ? $now->format('Y-m-d') : $monthStart;
    }
    $detailsOnly = filter_var($_GET['detailsOnly'] ?? false, FILTER_VALIDATE_BOOLEAN);
    $rangeStartObject = $detailsOnly
        ? new DateTimeImmutable($selectedDate, $timezone)
        : $monthStartObject;
    $rangeStart = $rangeStartObject->format('Y-m-d');
    $rangeEnd = $detailsOnly ? $selectedDate : $monthEnd;

    $branchCatalogKey = booking_availability_branch_service_key($service);
    $branches = branch_fetch_catalog($pdo, $branchCatalogKey, null);
    $mainBranchId = branch_main_id($pdo);
    $mainOnly = in_array($service['key'], ['general-checkup', 'online-consultation', 'home-service', 'dental', 'surgery', 'special-services'], true);
    $requestedBranchId = isset($_GET['branchId']) && is_numeric($_GET['branchId']) ? (int)$_GET['branchId'] : 0;
    $selectedBranch = null;
    foreach ($branches as $branch) {
        if (($mainOnly && (int)$branch['id'] === $mainBranchId)
            || (!$mainOnly && $requestedBranchId > 0 && (int)$branch['id'] === $requestedBranchId)) {
            $selectedBranch = $branch;
            break;
        }
    }
    if ($selectedBranch === null) {
        $selectedBranch = current(array_filter($branches, static fn(array $branch): bool => (int)$branch['id'] === $mainBranchId))
            ?: ($branches[0] ?? null);
    }
    if ($selectedBranch === null) {
        throw new RuntimeException('No active clinic location offers the selected service.');
    }
    $branchId = (int)$selectedBranch['id'];

    $selectedServiceConfiguration = current(array_filter(
        $selectedBranch['services'] ?? [],
        static fn(array $item): bool => (string)$item['key'] === $branchCatalogKey
    ));
    $availabilityMode = (string)($selectedServiceConfiguration['availabilityMode'] ?? 'always');

    $veterinarians = [];
    $selectedVeterinarianId = isset($_GET['veterinarianId']) && is_numeric($_GET['veterinarianId'])
        ? (int)$_GET['veterinarianId']
        : null;
    if ($service['key'] === 'online-consultation') {
        $veterinarians = array_values(array_filter(
            booking_availability_active_veterinarians($pdo),
            static fn(array $vet): bool => !empty(booking_slot_vet_schedule_rows($pdo, (int)$vet['id']))
        ));
        if (!$selectedVeterinarianId || !array_filter($veterinarians, static fn(array $vet): bool => (int)$vet['id'] === $selectedVeterinarianId)) {
            $selectedVeterinarianId = isset($veterinarians[0]) ? (int)$veterinarians[0]['id'] : null;
        }
    }

    // Special-service bookings share one category-level 30-minute slot even
    // when a booking contains more than one catalog item.
    $specialServiceId = null;
    $visitRows = $availabilityMode === 'vet_visit'
        ? booking_availability_visit_rows($pdo, $branchId, $branchCatalogKey, $rangeStart, $rangeEnd)
        : [];
    if ($availabilityMode === 'vet_visit') {
        $visitVets = [];
        foreach ($visitRows as $visit) {
            $vetId = (int)$visit['veterinarian_user_id'];
            $visitVets[$vetId] = [
                'id' => $vetId,
                'name' => trim('Dr. ' . preg_replace('/^Dr\.\s*/i', '', (string)$visit['veterinarian_name'])),
                'specialization' => 'Visiting veterinarian',
            ];
        }
        $veterinarians = array_values($visitVets);
        if ($selectedVeterinarianId && !isset($visitVets[$selectedVeterinarianId])) {
            $selectedVeterinarianId = null;
        }
    }

    $selectedVeterinarianName = null;
    if ($selectedVeterinarianId) {
        foreach ($veterinarians as $veterinarian) {
            if ((int)$veterinarian['id'] === $selectedVeterinarianId) {
                $selectedVeterinarianName = trim((string)$veterinarian['name']);
                break;
            }
        }
    }

    $days = [];
    $selectedSlots = [];
    $selectedRooms = [];
    if ($service['key'] === 'boarding') {
        $configuration = booking_availability_room_configuration($pdo, $branchId);
        $boardingReservations = booking_availability_boarding_reservations($pdo, $branchId, $rangeStart, $rangeEnd);
        for ($cursor = $rangeStartObject; $cursor->format('Y-m-d') <= $rangeEnd; $cursor = $cursor->modify('+1 day')) {
            $date = $cursor->format('Y-m-d');
            $rooms = booking_availability_rooms_for_date($configuration, $boardingReservations, $date, $now->getTimestamp());
            $isOpen = booking_availability_hours($pdo, $branchId, $date) !== null;
            if (!$isOpen) {
                $rooms = array_map(static fn(array $room): array => array_merge($room, ['available' => 0]), $rooms);
            }
            $availableCount = array_sum(array_column($rooms, 'available'));
            $bookedCount = array_sum(array_column($rooms, 'booked'));
            $days[] = [
                'date' => $date,
                'isOpen' => $isOpen,
                'availableCount' => $isOpen ? $availableCount : 0,
                'bookedCount' => $bookedCount,
                'status' => !$isOpen ? 'closed' : ($availableCount > 0 ? 'available' : 'full'),
            ];
            if ($date === $selectedDate) {
                $selectedRooms = $rooms;
            }
        }
    } else {
        $reservations = booking_slot_fetch_reservations($pdo, $rangeStart, $rangeEnd, $branchId);
        for ($cursor = $rangeStartObject; $cursor->format('Y-m-d') <= $rangeEnd; $cursor = $cursor->modify('+1 day')) {
            $date = $cursor->format('Y-m-d');
            $slots = booking_availability_slots_for_date(
                $pdo,
                $date,
                $service,
                $branchId,
                $reservations,
                $availabilityMode,
                $visitRows,
                $selectedVeterinarianId,
                $selectedVeterinarianName,
                $specialServiceId,
                $now->getTimestamp()
            );
            $availableCount = count(array_filter($slots, static fn(array $slot): bool => $slot['status'] === 'available'));
            $bookedCount = count(array_filter($slots, static fn(array $slot): bool => $slot['status'] === 'booked'));
            $isOpen = booking_availability_hours($pdo, $branchId, $date) !== null;
            $days[] = [
                'date' => $date,
                'isOpen' => $isOpen,
                'availableCount' => $availableCount,
                'bookedCount' => $bookedCount,
                'status' => !$isOpen ? 'closed' : ($availableCount > 0 ? 'available' : 'full'),
            ];
            if ($date === $selectedDate) {
                $selectedSlots = $slots;
            }
        }
    }

    echo json_encode([
        'success' => true,
        'generatedAt' => $now->format(DATE_ATOM),
        'month' => $month,
        'selectedDate' => $selectedDate,
        'selected' => [
            'service' => $service['key'],
            'branchId' => $branchId,
            'veterinarianId' => $selectedVeterinarianId,
            'veterinarianName' => $selectedVeterinarianName,
            'specialServiceId' => $specialServiceId,
        ],
        'filters' => [
            'services' => $services,
            'branches' => array_map(static fn(array $branch): array => [
                'id' => (int)$branch['id'],
                'code' => $branch['code'],
                'name' => $branch['name'],
                'isMain' => (bool)$branch['isMain'],
            ], $branches),
            'veterinarians' => $veterinarians,
        ],
        'days' => $days,
        'details' => [
            'date' => $selectedDate,
            'slots' => $selectedSlots,
            'rooms' => $selectedRooms,
        ],
    ]);
} catch (Throwable $e) {
    error_log('Booking availability failed: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Booking availability could not be loaded.',
    ]);
}
