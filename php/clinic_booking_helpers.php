<?php

date_default_timezone_set('Asia/Manila');

/** Shared capacity for every medical service, across all clinic locations. */
function clinic_booking_is_medical(string $serviceKey): bool
{
    return !in_array($serviceKey, ['grooming', 'boarding'], true);
}

function clinic_booking_schema_ready(PDO $pdo): bool
{
    foreach (['veterinarian_booking_clinics'] as $table) {
        if (!booking_slot_table_exists($pdo, $table)) return false;
    }
    return true;
}

function clinic_booking_require_schema(PDO $pdo): void
{
    if (!clinic_booking_schema_ready($pdo)) {
        throw new DomainException('Shared booking schedules are not configured yet. Apply DDL/20261005_02_shared_veterinarian_booking_calendar.sql, then assign clinics and enable booking acceptance.');
    }
}

function clinic_booking_roster(PDO $pdo): array
{
    if (!clinic_booking_schema_ready($pdo)) return [];
    $accountFilter = branch_column_exists($pdo, 'users', 'account_status')
        ? "AND COALESCE(NULLIF(LOWER(TRIM(u.account_status)), ''), 'active') = 'active'" : '';
    $stmt = $pdo->query("
        SELECT h.operating_hour_id AS clinic_schedule_id, h.branch_id, h.day_of_week,
               h.opens_at AS starts_at, h.closes_at AS ends_at,
               a.user_id AS veterinarian_user_id,
               CONCAT(u.first_Name, ' ', u.last_Name) AS veterinarian_name,
               vp.specialization, vp.prc_license_number
        FROM branch_operating_hours h
        JOIN veterinarian_booking_clinics c ON c.branch_id = h.branch_id AND c.accepts_bookings = 1
        JOIN user_branch_assignments a ON a.user_id = c.veterinarian_user_id
            AND a.branch_id = h.branch_id AND a.is_active = 1
        JOIN users u ON u.user_id = a.user_id
        JOIN veterinarian_profiles vp ON vp.user_id = u.user_id
        JOIN branches b ON b.branch_id = h.branch_id AND b.status = 'active'
        WHERE h.is_closed = 0 AND h.day_of_week BETWEEN 1 AND 6
          AND h.opens_at IS NOT NULL AND h.closes_at IS NOT NULL
          AND COALESCE(vp.is_active, 1) = 1 AND COALESCE(vp.is_accepting_patients, 1) = 1
          AND LOWER(REPLACE(REPLACE(TRIM(u.role), ' ', '_'), '-', '_')) IN ('veterinarian', 'vet')
          {$accountFilter}
        ORDER BY a.user_id, h.branch_id, h.day_of_week
    ");
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

/** Existing online-consultation selections; no extra working-hours tables. */
function clinic_booking_online_schedules(PDO $pdo): array
{
    if (!booking_slot_table_exists($pdo, 'vet_schedules')) return [];
    $stmt = $pdo->query("SELECT s.* FROM vet_schedules s
        JOIN (SELECT MAX(schedule_id) AS schedule_id FROM vet_schedules
              GROUP BY user_id, day_of_week, time_slot) latest
          ON latest.schedule_id = s.schedule_id");
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

/** Online calls do not depend on clinic assignments or on-site acceptance. */
function clinic_booking_online_veterinarians(PDO $pdo): array
{
    $accountFilter = branch_column_exists($pdo, 'users', 'account_status')
        ? "AND COALESCE(NULLIF(LOWER(TRIM(u.account_status)), ''), 'active') = 'active'" : '';
    return $pdo->query("SELECT u.user_id AS veterinarian_user_id,
        CONCAT(u.first_Name, ' ', u.last_Name) AS veterinarian_name,
        vp.specialization, vp.prc_license_number
        FROM users u JOIN veterinarian_profiles vp ON vp.user_id = u.user_id
        WHERE COALESCE(vp.is_active, 1) = 1
          AND LOWER(REPLACE(REPLACE(TRIM(u.role), ' ', '_'), '-', '_')) IN ('veterinarian', 'vet')
          {$accountFilter}
        ORDER BY u.first_Name, u.last_Name, u.user_id")->fetchAll(PDO::FETCH_ASSOC);
}

function clinic_booking_online_times(array $schedules, string $date, ?int $vetId = null): array
{
    $timestamp = strtotime($date);
    if ($timestamp === false) return [];
    $day = strtolower(date('l', $timestamp));
    $times = [];
    foreach ($schedules as $row) {
        if (($vetId && (int)($row['user_id'] ?? 0) !== $vetId)
            || strtolower(trim((string)($row['day_of_week'] ?? ''))) !== $day
            || (int)($row['is_available'] ?? 0) !== 1) continue;
        $time = booking_slot_normalize_time($row['time_slot'] ?? null);
        if ($time !== null) $times[$time] = true;
    }
    $result = array_keys($times);
    sort($result);
    return $result;
}

function clinic_booking_online_slot_selected(array $schedules, int $vetId, string $date, string $time): bool
{
    $normalized = booking_slot_normalize_time($time);
    $timestamp = strtotime($date);
    if (!$normalized || $timestamp === false) return false;
    $day = strtolower(date('l', $timestamp));
    foreach ($schedules as $row) {
        if ((int)($row['user_id'] ?? 0) === $vetId
            && strtolower(trim((string)($row['day_of_week'] ?? ''))) === $day
            && (int)($row['is_available'] ?? 0) === 1
            && booking_slot_normalize_time($row['time_slot'] ?? null) === $normalized) return true;
    }
    return false;
}

function clinic_booking_reservations(PDO $pdo, string $startDate, string $endDate, bool $forUpdate = false): array
{
    $sql = "SELECT booking_id, branch_id, service_type, booking_date, booking_time,
                   veterinarian_id, is_home_service, is_online_consultation, status
            FROM bookings WHERE booking_date BETWEEN ? AND ?
              AND LOWER(COALESCE(status, 'pending')) NOT IN ('cancelled', 'canceled', 'rejected')
            ORDER BY booking_date, booking_time, booking_id";
    if ($forUpdate && $pdo->inTransaction()) $sql .= ' FOR UPDATE';
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$startDate, $endDate]);
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

function clinic_booking_interval(array $record): ?array
{
    $key = booking_slot_service_key($record['service_type'] ?? '', $record['is_home_service'] ?? 0, $record['is_online_consultation'] ?? 0);
    if (!clinic_booking_is_medical($key) || !booking_slot_reserves_status($record['status'] ?? null)) return null;
    $time = booking_slot_normalize_time($record['booking_time'] ?? null);
    $start = $time ? strtotime(($record['booking_date'] ?? '') . ' ' . $time) : false;
    return $start === false ? null : [$start, $start + booking_slot_duration_minutes($key) * 60];
}

/** Check the remaining booked time when admin hands over an active patient. */
function clinic_booking_handover_conflict(array $booking, array $reservations, int $vetId, int $nowTimestamp): ?array
{
    $interval = clinic_booking_interval($booking);
    if ($vetId <= 0 || !$interval || $interval[1] <= $nowTimestamp) return null;
    $start = max($interval[0], $nowTimestamp);
    foreach ($reservations as $record) {
        if ((int)$record['booking_id'] === (int)$booking['booking_id']
            || (int)($record['veterinarian_id'] ?? 0) !== $vetId) continue;
        $reserved = clinic_booking_interval($record);
        if ($reserved && $start < $reserved[1] && $reserved[0] < $interval[1]) return $record;
    }
    return null;
}

/** Pure calculation, also used by regression tests and schedule validation. */
function clinic_booking_capacity_from_rows(
    array $roster, array $reservations, array $onlineSchedules,
    int $branchId, string $date, string $time, string $serviceKey,
    ?int $veterinarianId = null, int $excludeBookingId = 0
): array {
    $normalized = booking_slot_normalize_time($time);
    $start = $normalized ? strtotime($date . ' ' . $normalized) : false;
    $empty = ['capacity' => 0, 'availableCount' => 0, 'bookedCount' => 0, 'availableVeterinarians' => []];
    if ($start === false || !clinic_booking_is_medical($serviceKey)) return $empty;
    $end = $start + booking_slot_duration_minutes($serviceKey) * 60;
    $weekday = (int)date('N', $start);
    $eligible = [];
    foreach ($roster as $row) {
        $vetId = (int)$row['veterinarian_user_id'];
        if ($serviceKey === 'online-consultation') {
            if (!clinic_booking_online_slot_selected($onlineSchedules, $vetId, $date, $time)) continue;
        } else {
            if ((int)($row['branch_id'] ?? 0) !== $branchId || (int)($row['day_of_week'] ?? 0) !== $weekday) continue;
            $shiftStart = strtotime($date . ' ' . $row['starts_at']);
            $shiftEnd = strtotime($date . ' ' . $row['ends_at']);
            if ($shiftStart === false || $shiftEnd === false || $start < $shiftStart || $end > $shiftEnd) continue;
        }
        $eligible[$vetId] = $row;
    }
    ksort($eligible);
    $free = $eligible;
    $legacyEvents = [];
    foreach ($reservations as $record) {
        if ((int)$record['booking_id'] === $excludeBookingId) continue;
        $interval = clinic_booking_interval($record);
        if (!$interval || $start >= $interval[1] || $interval[0] >= $end) continue;
        $vetId = (int)($record['veterinarian_id'] ?? 0);
        if ($vetId > 0) {
            unset($free[$vetId]); // Includes this vet's appointments at other clinics.
        } elseif ((int)$record['branch_id'] === $branchId) {
            // Legacy unassigned appointments still consume shared capacity.
            $legacyEvents[] = [max($start, $interval[0]), 1];
            $legacyEvents[] = [min($end, $interval[1]), -1];
        }
    }
    usort($legacyEvents, static fn($a, $b) => ($a[0] <=> $b[0]) ?: ($a[1] <=> $b[1]));
    $active = 0;
    $legacyPeak = 0;
    foreach ($legacyEvents as $event) {
        $active += $event[1];
        $legacyPeak = max($legacyPeak, $active);
    }
    // Keep anonymous reservations conservative until staff assign their vets.
    $free = array_slice($free, min($legacyPeak, count($free)), null, true);
    if ($veterinarianId) $free = array_intersect_key($free, [$veterinarianId => true]);
    $capacity = $veterinarianId ? (isset($eligible[$veterinarianId]) ? 1 : 0) : count($eligible);
    return [
        'capacity' => $capacity,
        'availableCount' => count($free),
        'bookedCount' => max(0, $capacity - count($free)),
        'availableVeterinarians' => array_values(array_map(static fn($row) => [
            'id' => (int)$row['veterinarian_user_id'],
            'name' => trim('Dr. ' . preg_replace('/^Dr\.\s*/i', '', $row['veterinarian_name'] ?? 'Veterinarian')),
        ], $free)),
    ];
}

function clinic_booking_capacity(PDO $pdo, int $branchId, string $date, string $time, string $serviceKey, ?int $vetId = null, int $excludeId = 0, bool $forUpdate = false): array
{
    $isOnline = $serviceKey === 'online-consultation';
    $capacity = clinic_booking_capacity_from_rows(
        $isOnline ? clinic_booking_online_veterinarians($pdo) : clinic_booking_roster($pdo),
        clinic_booking_reservations($pdo, $date, $date, $forUpdate),
        $isOnline ? clinic_booking_online_schedules($pdo) : [], $branchId, $date, $time, $serviceKey, $vetId, $excludeId
    );
    $normalized = booking_slot_normalize_time($time);
    $end = $normalized ? date('H:i:s', strtotime($date . ' ' . $normalized) + booking_slot_duration_minutes($serviceKey) * 60) : '';
    if (!$normalized || (!$isOnline && (!branch_is_open($pdo, $branchId, $date, $normalized)
        || !branch_is_open($pdo, $branchId, $date, $end))) || booking_slot_overlaps_lunch($serviceKey, $time)) {
        $capacity['availableCount'] = 0;
        $capacity['availableVeterinarians'] = [];
    }
    return $capacity;
}

function clinic_booking_reserve_vet(PDO $pdo, int $branchId, string $date, string $time, string $serviceKey, ?int $vetId = null, int $excludeId = 0): int
{
    if ($serviceKey !== 'online-consultation') clinic_booking_require_schema($pdo);
    $capacity = clinic_booking_capacity($pdo, $branchId, $date, $time, $serviceKey, $vetId, $excludeId, true);
    if (empty($capacity['availableVeterinarians'])) {
        throw new DomainException($vetId && $serviceKey === 'online-consultation'
            ? 'This veterinarian is not available for this online call. Select another date or time from their online schedule.'
            : ($vetId
            ? 'This veterinarian is not available at this clinic for the full appointment. Select another veterinarian, date, or time.'
            : 'All available veterinarians are booked for this time. Select another date or time.'));
    }
    return (int)$capacity['availableVeterinarians'][0]['id'];
}
