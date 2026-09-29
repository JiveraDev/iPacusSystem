<?php

/**
 * Shared booking-slot rules.
 *
 * Boarding is intentionally excluded because it is governed by overlapping
 * room-unit availability. Every other booking reserves an appointment slot as
 * soon as it is created, including while its status is still pending.
 */

function booking_slot_table_exists(PDO $pdo, string $tableName): bool
{
    static $cache = [];
    $key = spl_object_id($pdo) . ':' . $tableName;
    if (array_key_exists($key, $cache)) {
        return $cache[$key];
    }

    $stmt = $pdo->prepare("\n        SELECT COUNT(*)\n        FROM information_schema.tables\n        WHERE table_schema = DATABASE() AND table_name = ?\n    ");
    $stmt->execute([$tableName]);
    $cache[$key] = (int)$stmt->fetchColumn() > 0;

    return $cache[$key];
}

function booking_slot_service_key(?string $serviceType, $isHomeService = false, $isOnlineConsultation = false): string
{
    if ((int)$isHomeService === 1) {
        return 'home-service';
    }
    if ((int)$isOnlineConsultation === 1) {
        return 'online-consultation';
    }

    $normalized = strtolower(trim((string)$serviceType));
    return match ($normalized) {
        'online-consultation', 'online consultation' => 'online-consultation',
        'general check-up', 'general checkup', 'general-checkup', 'general_checkup', 'consultation' => 'general-checkup',
        'home service', 'home_service', 'home-service' => 'home-service',
        'vaccination', 'vaccine', 'vaccines' => 'vaccination',
        'grooming', 'pet grooming' => 'grooming',
        'laboratory', 'laboratory testing', 'lab testing', 'lab_testing', 'lab-testing' => 'lab-testing',
        'parasite control', 'parasite control or deworming', 'deworming', 'parasite_control', 'parasite-control' => 'parasite-control',
        'boarding', 'pet boarding', 'pet hotel & boarding', 'pet hotel boarding', 'kennel boarding' => 'boarding',
        'dental services', 'dental check-up', 'dental checkup', 'dental' => 'dental',
        'surgery', 'surgical services' => 'surgery',
        'kapon', 'spay/neuter', 'spay and neuter' => 'special-services',
        'special-services', 'special_services', 'special services', 'emergency care', 'emergency' => 'special-services',
        default => str_replace(' ', '-', $normalized),
    };
}

function booking_slot_duration_minutes(string $serviceKey): int
{
    if ($serviceKey === 'boarding') {
        return 0;
    }

    return in_array($serviceKey, ['home-service', 'online-consultation'], true) ? 60 : 30;
}

function booking_slot_normalize_time(?string $value): ?string
{
    $time = trim((string)$value);
    if ($time === '') {
        return null;
    }

    foreach (['H:i:s', 'H:i', 'g:i A', 'h:i A', 'g:i a', 'h:i a'] as $format) {
        $parsed = DateTimeImmutable::createFromFormat('!' . $format, $time);
        $errors = DateTimeImmutable::getLastErrors();
        $hasErrors = is_array($errors) && ($errors['warning_count'] > 0 || $errors['error_count'] > 0);
        if ($parsed && !$hasErrors) {
            return $parsed->format('H:i:s');
        }
    }

    return null;
}

function booking_slot_overlaps_lunch(string $serviceKey, string $bookingTime): bool
{
    $normalized = booking_slot_normalize_time($bookingTime);
    if ($normalized === null || in_array($serviceKey, ['boarding', 'grooming'], true)) {
        return false;
    }
    [$hour, $minute, $second] = array_map('intval', explode(':', $normalized));
    $start = $hour * 3600 + $minute * 60 + $second;
    $end = $start + booking_slot_duration_minutes($serviceKey) * 60;
    return $start < 13 * 3600 && $end > 12 * 3600;
}

function booking_slot_assert_aligned(string $serviceKey, string $bookingTime): string
{
    $normalized = booking_slot_normalize_time($bookingTime);
    if ($normalized === null) {
        throw new InvalidArgumentException('Select a valid booking time.');
    }
    if ($serviceKey === 'boarding') {
        return $normalized;
    }

    [$hour, $minute, $second] = array_map('intval', explode(':', $normalized));
    $requiresHourlyStart = $serviceKey === 'home-service';
    if ($second !== 0 || ($requiresHourlyStart ? $minute !== 0 : !in_array($minute, [0, 30], true))) {
        throw new InvalidArgumentException(
            $serviceKey === 'home-service'
                ? 'Home service must start on an available one-hour time slot.'
                : 'Bookings must start on an available 30-minute time slot.'
        );
    }

    if (booking_slot_overlaps_lunch($serviceKey, $normalized)) {
        throw new InvalidArgumentException('Lunch period is 12:00–1:00 PM. Choose an appointment that finishes by 12:00 PM or starts at 1:00 PM or later.');
    }

    return sprintf('%02d:%02d:00', $hour, $minute);
}

function booking_slot_reserves_status(?string $status): bool
{
    return !in_array(strtolower(trim((string)$status)), ['cancelled', 'canceled', 'rejected'], true);
}

function booking_slot_vet_schedule_rows(PDO $pdo, int $veterinarianId): array
{
    static $cache = [];
    if ($veterinarianId <= 0 || !booking_slot_table_exists($pdo, 'vet_schedules')) {
        return [];
    }

    $cacheKey = spl_object_id($pdo) . ':' . $veterinarianId;
    if (array_key_exists($cacheKey, $cache)) {
        return $cache[$cacheKey];
    }

    $stmt = $pdo->prepare("\n        SELECT schedule.day_of_week, schedule.time_slot, schedule.is_available\n        FROM vet_schedules schedule\n        INNER JOIN (\n            SELECT MAX(schedule_id) AS schedule_id\n            FROM vet_schedules\n            WHERE user_id = ?\n            GROUP BY day_of_week, time_slot\n        ) latest ON latest.schedule_id = schedule.schedule_id\n        WHERE schedule.user_id = ?\n        ORDER BY schedule.day_of_week, schedule.time_slot\n    ");
    $stmt->execute([$veterinarianId, $veterinarianId]);

    $cache[$cacheKey] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    return $cache[$cacheKey];
}

function booking_slot_vet_times_for_date(PDO $pdo, int $veterinarianId, string $bookingDate): array
{
    $timestamp = strtotime($bookingDate);
    if ($timestamp === false) {
        return [];
    }

    $weekday = strtolower(date('l', $timestamp));
    $times = [];
    foreach (booking_slot_vet_schedule_rows($pdo, $veterinarianId) as $row) {
        if (strtolower(trim((string)$row['day_of_week'])) !== $weekday || (int)$row['is_available'] !== 1) {
            continue;
        }

        $time = booking_slot_normalize_time($row['time_slot'] ?? null);
        if ($time !== null) {
            $times[$time] = $time;
        }
    }

    ksort($times);
    return array_values($times);
}

function booking_slot_online_vet_is_available(PDO $pdo, int $veterinarianId, string $bookingDate, string $bookingTime): bool
{
    $normalized = booking_slot_normalize_time($bookingTime);
    return $normalized !== null
        && in_array($normalized, booking_slot_vet_times_for_date($pdo, $veterinarianId, $bookingDate), true);
}

function booking_slot_special_service_id_for_booking(PDO $pdo, int $bookingId): ?int
{
    if ($bookingId <= 0 || !booking_slot_table_exists($pdo, 'special_service_booking_items')) {
        return null;
    }

    $stmt = $pdo->prepare('SELECT MIN(special_service_id) FROM special_service_booking_items WHERE booking_id = ?');
    $stmt->execute([$bookingId]);
    $value = (int)$stmt->fetchColumn();

    return $value > 0 ? $value : null;
}

function booking_slot_fetch_reservations(
    PDO $pdo,
    string $startDate,
    string $endDate,
    int $branchId,
    bool $forUpdate = false
): array {
    $specialSelect = booking_slot_table_exists($pdo, 'special_service_booking_items')
        ? '(SELECT MIN(sbi.special_service_id) FROM special_service_booking_items sbi WHERE sbi.booking_id = b.booking_id) AS special_service_id'
        : 'NULL AS special_service_id';
    $sql = "\n        SELECT b.booking_id, b.booking_number, b.branch_id, b.service_type,\n               b.booking_date, b.booking_time, b.status, b.is_home_service,\n               b.is_online_consultation, b.veterinarian_id, {$specialSelect}\n        FROM bookings b\n        WHERE b.branch_id = ?\n          AND b.booking_date BETWEEN ? AND ?\n          AND LOWER(COALESCE(b.status, 'pending')) NOT IN ('cancelled', 'canceled', 'rejected')\n          AND LOWER(TRIM(COALESCE(b.service_type, ''))) <> 'boarding'\n        ORDER BY b.booking_date, b.booking_time, b.booking_id\n    ";
    if ($forUpdate && $pdo->inTransaction()) {
        $sql .= ' FOR UPDATE';
    }

    $stmt = $pdo->prepare($sql);
    $stmt->execute([$branchId, $startDate, $endDate]);

    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

function booking_slot_record_matches_scope(
    array $record,
    string $serviceKey,
    ?int $veterinarianId = null,
    ?int $specialServiceId = null
): bool {
    $recordKey = booking_slot_service_key(
        $record['service_type'] ?? null,
        $record['is_home_service'] ?? 0,
        $record['is_online_consultation'] ?? 0
    );
    if ($recordKey !== $serviceKey) {
        return false;
    }

    if ($serviceKey === 'online-consultation') {
        return $veterinarianId !== null
            && $veterinarianId > 0
            && (int)($record['veterinarian_id'] ?? 0) === $veterinarianId;
    }

    if ($serviceKey === 'special-services' && $specialServiceId !== null && $specialServiceId > 0) {
        return (int)($record['special_service_id'] ?? 0) === $specialServiceId;
    }

    return true;
}

function booking_slot_records_find_conflict(
    array $records,
    string $bookingDate,
    string $bookingTime,
    string $serviceKey,
    ?int $veterinarianId = null,
    int $excludeBookingId = 0,
    ?int $specialServiceId = null
): ?array {
    $requestedTime = booking_slot_normalize_time($bookingTime);
    if ($requestedTime === null || $serviceKey === 'boarding') {
        return null;
    }

    $requestedStart = strtotime($bookingDate . ' ' . $requestedTime);
    if ($requestedStart === false) {
        return null;
    }
    $requestedEnd = $requestedStart + (booking_slot_duration_minutes($serviceKey) * 60);

    foreach ($records as $record) {
        if ((int)($record['booking_id'] ?? 0) === $excludeBookingId
            || (string)($record['booking_date'] ?? '') !== $bookingDate
            || !booking_slot_reserves_status($record['status'] ?? null)
            || !booking_slot_record_matches_scope($record, $serviceKey, $veterinarianId, $specialServiceId)) {
            continue;
        }

        $existingTime = booking_slot_normalize_time($record['booking_time'] ?? null);
        if ($existingTime === null) {
            continue;
        }
        $existingStart = strtotime($bookingDate . ' ' . $existingTime);
        if ($existingStart === false) {
            continue;
        }
        $existingKey = booking_slot_service_key(
            $record['service_type'] ?? null,
            $record['is_home_service'] ?? 0,
            $record['is_online_consultation'] ?? 0
        );
        $existingEnd = $existingStart + (booking_slot_duration_minutes($existingKey) * 60);
        if ($requestedStart < $existingEnd && $existingStart < $requestedEnd) {
            return $record;
        }
    }

    return null;
}

function booking_slot_find_conflict(
    PDO $pdo,
    int $branchId,
    string $serviceKey,
    string $bookingDate,
    string $bookingTime,
    ?int $veterinarianId = null,
    int $excludeBookingId = 0,
    ?int $specialServiceId = null,
    bool $forUpdate = false
): ?array {
    if ($serviceKey === 'boarding') {
        return null;
    }

    $records = booking_slot_fetch_reservations($pdo, $bookingDate, $bookingDate, $branchId, $forUpdate);
    return booking_slot_records_find_conflict(
        $records,
        $bookingDate,
        $bookingTime,
        $serviceKey,
        $veterinarianId,
        $excludeBookingId,
        $specialServiceId
    );
}

function booking_slot_lock_name(
    int $branchId,
    string $serviceKey,
    string $bookingDate,
    string $bookingTime,
    ?int $veterinarianId = null,
    ?int $specialServiceId = null
): string {
    $timeScope = $serviceKey === 'online-consultation'
        ? 'all-veterinarian-times'
        : (booking_slot_normalize_time($bookingTime) ?? $bookingTime);
    $scope = implode('|', [
        $branchId,
        $serviceKey,
        $bookingDate,
        $timeScope,
        $serviceKey === 'online-consultation' ? (int)$veterinarianId : 0,
        $serviceKey === 'special-services' ? (int)$specialServiceId : 0,
    ]);

    return 'ipawcus_slot_' . md5($scope);
}

function booking_slot_acquire(PDO $pdo, string $lockName, int $timeoutSeconds = 8): bool
{
    $stmt = $pdo->prepare('SELECT GET_LOCK(?, ?)');
    $stmt->execute([$lockName, max(1, $timeoutSeconds)]);
    return (int)$stmt->fetchColumn() === 1;
}

function booking_slot_release(PDO $pdo, ?string $lockName): void
{
    if ($lockName === null || $lockName === '') {
        return;
    }

    try {
        $stmt = $pdo->prepare('SELECT RELEASE_LOCK(?)');
        $stmt->execute([$lockName]);
    } catch (Throwable $e) {
        error_log('Booking slot lock release failed: ' . $e->getMessage());
    }
}

function booking_slot_conflict_message(string $serviceKey, string $bookingTime): string
{
    $normalized = booking_slot_normalize_time($bookingTime);
    $label = $normalized !== null
        ? date('g:i A', strtotime('1970-01-01 ' . $normalized))
        : $bookingTime;

    return match ($serviceKey) {
        'home-service' => "The {$label} home-service time is already reserved. Select another one-hour slot.",
        'online-consultation' => "The {$label} online-consultation time overlaps another one-hour consultation for this veterinarian.",
        default => "The {$label} time is already reserved for this service. Select another 30-minute slot.",
    };
}
