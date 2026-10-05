<?php

date_default_timezone_set('Asia/Manila');

/** Shared capacity for every medical service, across all clinic locations. */
function clinic_booking_is_medical(string $serviceKey): bool
{
    return !in_array($serviceKey, ['grooming', 'boarding'], true);
}

function clinic_booking_schema_ready(PDO $pdo): bool
{
    foreach (['veterinarian_booking_clinics', 'veterinarian_working_hours', 'veterinarian_booking_time_off'] as $table) {
        if (!booking_slot_table_exists($pdo, $table)) return false;
    }
    return true;
}

function clinic_booking_require_schema(PDO $pdo): void
{
    if (!clinic_booking_schema_ready($pdo)) {
        throw new DomainException('Shared booking schedules are not configured yet. Apply DDL/20261005_02_shared_veterinarian_booking_calendar.sql, then assign clinics and working hours.');
    }
}

function clinic_booking_roster(PDO $pdo): array
{
    if (!clinic_booking_schema_ready($pdo)) return [];
    $accountFilter = branch_column_exists($pdo, 'users', 'account_status')
        ? "AND COALESCE(NULLIF(LOWER(TRIM(u.account_status)), ''), 'active') = 'active'" : '';
    $stmt = $pdo->query("
        SELECT h.*, CONCAT(u.first_Name, ' ', u.last_Name) AS veterinarian_name,
               vp.specialization, vp.prc_license_number
        FROM veterinarian_working_hours h
        JOIN veterinarian_booking_clinics c ON c.veterinarian_user_id = h.veterinarian_user_id
            AND c.branch_id = h.branch_id AND c.accepts_bookings = 1
        JOIN user_branch_assignments a ON a.user_id = h.veterinarian_user_id
            AND a.branch_id = h.branch_id AND a.is_active = 1
        JOIN users u ON u.user_id = h.veterinarian_user_id
        JOIN veterinarian_profiles vp ON vp.user_id = u.user_id
        JOIN branches b ON b.branch_id = h.branch_id AND b.status = 'active'
        WHERE COALESCE(vp.is_active, 1) = 1 AND COALESCE(vp.is_accepting_patients, 1) = 1
          AND LOWER(REPLACE(REPLACE(TRIM(u.role), ' ', '_'), '-', '_')) IN ('veterinarian', 'vet')
          {$accountFilter}
        ORDER BY h.veterinarian_user_id, h.day_of_week, h.starts_at
    ");
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

function clinic_booking_time_off(PDO $pdo, string $startDate, string $endDate): array
{
    if (!clinic_booking_schema_ready($pdo)) return [];
    $stmt = $pdo->prepare('SELECT * FROM veterinarian_booking_time_off WHERE starts_at < DATE_ADD(?, INTERVAL 1 DAY) AND ends_at > ?');
    $stmt->execute([$endDate, $startDate]);
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
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

/** Pure calculation, also used by regression tests and schedule validation. */
function clinic_booking_capacity_from_rows(
    array $roster, array $reservations, array $timeOff,
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
        if ((int)$row['branch_id'] !== $branchId || (int)$row['day_of_week'] !== $weekday) continue;
        $vetId = (int)$row['veterinarian_user_id'];
        $shiftStart = strtotime($date . ' ' . $row['starts_at']);
        $shiftEnd = strtotime($date . ' ' . $row['ends_at']);
        if ($shiftStart === false || $shiftEnd === false || $start < $shiftStart || $end > $shiftEnd) continue;
        $away = false;
        foreach ($timeOff as $leave) {
            if ((int)$leave['veterinarian_user_id'] === $vetId
                && $start < strtotime($leave['ends_at']) && strtotime($leave['starts_at']) < $end) {
                $away = true;
                break;
            }
        }
        if (!$away) $eligible[$vetId] = $row;
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
    $capacity = clinic_booking_capacity_from_rows(
        clinic_booking_roster($pdo), clinic_booking_reservations($pdo, $date, $date, $forUpdate),
        clinic_booking_time_off($pdo, $date, $date), $branchId, $date, $time, $serviceKey, $vetId, $excludeId
    );
    $normalized = booking_slot_normalize_time($time);
    $end = $normalized ? date('H:i:s', strtotime($date . ' ' . $normalized) + booking_slot_duration_minutes($serviceKey) * 60) : '';
    if (!$normalized || !branch_is_open($pdo, $branchId, $date, $normalized)
        || !branch_is_open($pdo, $branchId, $date, $end) || booking_slot_overlaps_lunch($serviceKey, $time)) {
        $capacity['availableCount'] = 0;
        $capacity['availableVeterinarians'] = [];
    }
    return $capacity;
}

function clinic_booking_reserve_vet(PDO $pdo, int $branchId, string $date, string $time, string $serviceKey, ?int $vetId = null, int $excludeId = 0): int
{
    clinic_booking_require_schema($pdo);
    $capacity = clinic_booking_capacity($pdo, $branchId, $date, $time, $serviceKey, $vetId, $excludeId, true);
    if (empty($capacity['availableVeterinarians'])) {
        throw new DomainException($vetId
            ? 'This veterinarian is not available at this clinic for the full appointment. Select another veterinarian, date, or time.'
            : 'All available veterinarians are booked for this time. Select another date or time.');
    }
    return (int)$capacity['availableVeterinarians'][0]['id'];
}
