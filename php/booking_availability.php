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
        ['key' => 'boarding', 'label' => 'Pet Hotel Boarding', 'serviceType' => 'boarding', 'mode' => 'rooms'],
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

function booking_availability_slots_for_date(
    PDO $pdo,
    string $date,
    array $service,
    int $branchId,
    array $reservations,
    array $roster,
    array $timeOff,
    ?int $veterinarianId,
    ?string $veterinarianName,
    int $excludeBookingId,
    int $nowTimestamp
): array {
    $hours = booking_availability_hours($pdo, $branchId, $date);
    if ($hours === null) {
        return [];
    }

    $serviceKey = $service['key'];
    $intervalMinutes = (int)($service['intervalMinutes'] ?? booking_slot_duration_minutes($serviceKey));
    $durationMinutes = booking_slot_duration_minutes($serviceKey);
    $times = booking_availability_base_times($hours, $intervalMinutes);
    $isMedical = clinic_booking_is_medical($serviceKey);
    $closing = strtotime($date . ' ' . $hours['closesAt']);

    $slots = [];
    foreach ($times as $time) {
        $slotTimestamp = strtotime($date . ' ' . $time);
        if ($slotTimestamp === false || $slotTimestamp + $durationMinutes * 60 > $closing) continue;
        $capacity = $isMedical ? clinic_booking_capacity_from_rows(
            $roster, $reservations, $timeOff, $branchId, $date, $time, $serviceKey, $veterinarianId, $excludeBookingId
        ) : null;
        $conflict = !$isMedical ? booking_slot_records_find_conflict(
            $reservations,
            $date,
            $time,
            $serviceKey,
            $serviceKey === 'online-consultation' ? $veterinarianId : null,
            $excludeBookingId
        ) : null;
        if (!$isMedical) $capacity = ['capacity' => 1, 'availableCount' => $conflict ? 0 : 1, 'bookedCount' => $conflict ? 1 : 0];
        $isPast = $slotTimestamp === false || $slotTimestamp <= $nowTimestamp;
        $isLunch = booking_slot_overlaps_lunch($serviceKey, $time);
        $status = $isLunch ? 'lunch' : ($isPast ? 'unavailable' : ($capacity['availableCount'] > 0 ? 'available' : ($capacity['capacity'] > 0 ? 'booked' : 'unavailable')));
        $slots[] = [
            'time' => substr($time, 0, 5),
            'label' => date('g:i A', strtotime('1970-01-01 ' . $time)),
            'status' => $status,
            'available' => $status === 'available',
            'reason' => $isLunch ? 'Lunch period: 12:00–1:00 PM.' : ($isMedical && $capacity['capacity'] === 0 ? 'No veterinarian is scheduled for the full appointment.' : null),
            'veterinarianId' => $veterinarianId,
            'veterinarianName' => $veterinarianName,
            'capacity' => $capacity['capacity'],
            'availableCount' => $status === 'available' ? $capacity['availableCount'] : 0,
            'bookedCount' => $capacity['bookedCount'],
            'availableVeterinarians' => $status === 'available' ? ($capacity['availableVeterinarians'] ?? []) : [],
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
    $assignmentStatusSelect = booking_slot_table_exists($pdo, 'boarding_assignments')
        ? "(\n            SELECT assignment_status.status\n            FROM boarding_assignments assignment_status\n            WHERE assignment_status.booking_id = bookings.booking_id\n            ORDER BY\n                CASE WHEN assignment_status.status IN ('occupied', 'reserved') THEN 0 ELSE 1 END,\n                assignment_status.assignment_id DESC\n            LIMIT 1\n        ) AS assignment_status"
        : 'NULL AS assignment_status';
    $stmt = $pdo->prepare("\n        SELECT booking_id, hotel_boarding_type, room_size, check_in_date, check_out_date, status, {$assignmentStatusSelect}\n        FROM bookings\n        WHERE branch_id = ?\n          AND LOWER(TRIM(COALESCE(service_type, ''))) = 'boarding'\n          AND status IN ('pending', 'confirmed')\n          AND check_in_date < DATE_ADD(?, INTERVAL 1 DAY)\n          AND check_out_date > ?\n        ORDER BY check_in_date, booking_id\n    ");
    $stmt->execute([$branchId, $monthEnd, $monthStart]);
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

function booking_availability_rooms_for_date(array $configuration, array $reservations, string $date, int $nowTimestamp): array
{
    $nextDate = date('Y-m-d', strtotime($date . ' +1 day'));
    $isPast = strtotime($date . ' 23:59:59') < $nowTimestamp;
    $isToday = $date === date('Y-m-d');
    return array_map(static function (array $room) use ($reservations, $date, $nextDate, $isPast, $isToday): array {
        [$type, $size] = array_pad(explode('-', (string)$room['room_type'], 2), 2, '');
        $matchingReservations = array_values(array_filter($reservations, static function (array $booking) use ($type, $size, $date, $nextDate): bool {
            return strtolower((string)$booking['hotel_boarding_type']) === $type
                && strtolower((string)$booking['room_size']) === $size
                && (string)$booking['check_in_date'] < $nextDate
                && (string)$booking['check_out_date'] > $date;
        }));
        $booked = count($matchingReservations);
        $occupied = $isToday ? count(array_filter(
            $matchingReservations,
            static fn(array $booking): bool => strtolower((string)($booking['assignment_status'] ?? '')) === 'occupied'
        )) : 0;
        $reserved = max(0, $booked - $occupied);
        $total = max(0, (int)$room['total_capacity']);
        $available = $isPast ? 0 : max(0, $total - $booked);
        return [
            'roomType' => $room['room_type'],
            'type' => $type,
            'size' => $size,
            'label' => ucfirst($type) . ' - ' . ucfirst($size),
            'total' => $total,
            'booked' => $booked,
            'reserved' => $reserved,
            'occupied' => $occupied,
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
    $requestedBranchId = isset($_GET['branchId']) && is_numeric($_GET['branchId']) ? (int)$_GET['branchId'] : 0;
    $selectedBranch = null;
    foreach ($branches as $branch) {
        if ($requestedBranchId > 0 && (int)$branch['id'] === $requestedBranchId) {
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

    $roster = clinic_booking_is_medical($service['key']) ? clinic_booking_roster($pdo) : [];
    $timeOff = clinic_booking_is_medical($service['key']) ? clinic_booking_time_off($pdo, $rangeStart, $rangeEnd) : [];
    $veterinarians = [];
    $selectedVeterinarianId = isset($_GET['veterinarianId']) && is_numeric($_GET['veterinarianId'])
        ? (int)$_GET['veterinarianId']
        : null;
    $clinicVets = [];
    foreach ($roster as $row) {
        if ((int)$row['branch_id'] === $branchId) {
            $vetId = (int)$row['veterinarian_user_id'];
            $clinicVets[$vetId] = [
                'id' => $vetId,
                'name' => trim('Dr. ' . preg_replace('/^Dr\.\s*/i', '', (string)$row['veterinarian_name'])),
                'specialization' => $row['specialization'] ?: 'General Practice',
                'licenseNumber' => $row['prc_license_number'] ?? '',
            ];
        }
    }
    $veterinarians = array_values($clinicVets);
    $excludeBookingId = 0;
    // Only staff or the booking owner may exclude an appointment when moving it.
    if ((int)($_GET['excludeBookingId'] ?? 0) > 0) {
        require_once __DIR__ . '/workflow_guard_helpers.php';
        $actor = ipawcus_guard_current_user($pdo);
        $excludeStmt = $pdo->prepare('SELECT user_id, veterinarian_id, branch_id FROM bookings WHERE booking_id = ?');
        $excludeStmt->execute([(int)$_GET['excludeBookingId']]);
        $exclude = $excludeStmt->fetch(PDO::FETCH_ASSOC);
        $actorRole = ipawcus_guard_role($actor);
        if ($exclude && ($actorRole === 'super_admin'
            || ($actorRole === 'admin' && branch_user_can_access($pdo, $actor, (int)$exclude['branch_id']))
            || ($actorRole === 'veterinarian' && (int)$exclude['veterinarian_id'] === ipawcus_guard_user_id($actor))
            || (int)$exclude['user_id'] === ipawcus_guard_user_id($actor))) $excludeBookingId = (int)$_GET['excludeBookingId'];
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
        $requestedBoardingType = strtolower(trim((string)($_GET['hotel_boarding_type'] ?? '')));
        if (in_array($requestedBoardingType, ['hotel', 'boarding'], true)) {
            $configuration = array_values(array_filter(
                $configuration,
                static fn(array $room): bool => str_starts_with(strtolower((string)($room['room_type'] ?? '')), $requestedBoardingType . '-')
            ));
        }
        $boardingReservations = booking_availability_boarding_reservations($pdo, $branchId, $rangeStart, $rangeEnd);
        for ($cursor = $rangeStartObject; $cursor->format('Y-m-d') <= $rangeEnd; $cursor = $cursor->modify('+1 day')) {
            $date = $cursor->format('Y-m-d');
            $isPastDate = $date < $now->format('Y-m-d');
            $rooms = booking_availability_rooms_for_date($configuration, $boardingReservations, $date, $now->getTimestamp());
            $isOpen = !$isPastDate && booking_availability_hours($pdo, $branchId, $date) !== null;
            if (!$isOpen) {
                $rooms = array_map(static fn(array $room): array => array_merge($room, ['available' => 0]), $rooms);
            }
            $availableCount = array_sum(array_column($rooms, 'available'));
            $bookedCount = array_sum(array_column($rooms, 'booked'));
            $isFull = $isOpen && $availableCount === 0 && $bookedCount > 0;
            $days[] = [
                'date' => $date,
                'isOpen' => $isOpen,
                'availableCount' => $isOpen ? $availableCount : 0,
                'bookedCount' => $bookedCount,
                'status' => !$isOpen ? 'closed' : ($availableCount > 0 ? 'available' : ($isFull ? 'full' : 'closed')),
            ];
            if ($date === $selectedDate) {
                $selectedRooms = $rooms;
            }
        }
    } else {
        $reservations = clinic_booking_is_medical($service['key'])
            ? clinic_booking_reservations($pdo, $rangeStart, $rangeEnd)
            : booking_slot_fetch_reservations($pdo, $rangeStart, $rangeEnd, $branchId);
        for ($cursor = $rangeStartObject; $cursor->format('Y-m-d') <= $rangeEnd; $cursor = $cursor->modify('+1 day')) {
            $date = $cursor->format('Y-m-d');
            $isPastDate = $date < $now->format('Y-m-d');
            $slots = booking_availability_slots_for_date(
                $pdo,
                $date,
                $service,
                $branchId,
                $reservations,
                $roster,
                $timeOff,
                $selectedVeterinarianId,
                $selectedVeterinarianName,
                $excludeBookingId,
                $now->getTimestamp()
            );
            $availableCount = array_sum(array_column($slots, 'availableCount'));
            $bookedCount = array_sum(array_column($slots, 'bookedCount'));
            $isOpen = !$isPastDate && booking_availability_hours($pdo, $branchId, $date) !== null;
            $isFull = $isOpen && $availableCount === 0 && $bookedCount > 0;
            $days[] = [
                'date' => $date,
                'isOpen' => $isOpen,
                'availableCount' => $availableCount,
                'bookedCount' => $bookedCount,
                'status' => !$isOpen ? 'closed' : ($availableCount > 0 ? 'available' : ($isFull ? 'full' : 'unavailable')),
            ];
            if ($date === $selectedDate) {
                $selectedSlots = $slots;
            }
        }
    }

    echo json_encode([
        'success' => true,
        'schedulingMode' => clinic_booking_is_medical($service['key']) ? 'shared_veterinarian' : ($service['key'] === 'boarding' ? 'rooms' : 'grooming'),
        'scheduleConfigured' => !clinic_booking_is_medical($service['key']) || clinic_booking_schema_ready($pdo),
        'generatedAt' => $now->format(DATE_ATOM),
        'month' => $month,
        'selectedDate' => $selectedDate,
        'selected' => [
            'service' => $service['key'],
            'branchId' => $branchId,
            'veterinarianId' => $selectedVeterinarianId,
            'veterinarianName' => $selectedVeterinarianName,
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
