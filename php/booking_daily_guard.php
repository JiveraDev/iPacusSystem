<?php

/**
 * Booking flood protection shared by every workflow that creates, confirms, or
 * reschedules a booking.
 *
 * Call booking_daily_lock_subjects() inside an open transaction before calling
 * booking_daily_find_conflict(). Locking the pet (or owner for an unregistered
 * pet) serializes concurrent requests for the same subject and clinic day.
 */

function booking_daily_table_exists(PDO $pdo, string $tableName): bool
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

function booking_daily_normalize_pet_ids(array $petIds): array
{
    $normalized = array_filter(
        array_map('intval', $petIds),
        static fn(int $petId): bool => $petId > 0
    );
    $normalized = array_values(array_unique($normalized));
    sort($normalized, SORT_NUMERIC);

    return $normalized;
}

function booking_daily_normalize_pet_name(?string $petName): string
{
    $normalized = preg_replace('/\s+/u', ' ', trim((string)$petName));
    $normalized = $normalized !== null ? $normalized : trim((string)$petName);

    return function_exists('mb_strtolower')
        ? mb_strtolower($normalized, 'UTF-8')
        : strtolower($normalized);
}

function booking_daily_pet_ids_for_booking(PDO $pdo, int $bookingId, $primaryPetId = null): array
{
    $petIds = [];
    if ((int)$primaryPetId > 0) {
        $petIds[] = (int)$primaryPetId;
    }

    if ($bookingId > 0 && booking_daily_table_exists($pdo, 'booking_pets')) {
        $stmt = $pdo->prepare("
            SELECT pet_id
            FROM booking_pets
            WHERE booking_id = ?
            ORDER BY pet_id
        ");
        $stmt->execute([$bookingId]);
        $petIds = array_merge($petIds, $stmt->fetchAll(PDO::FETCH_COLUMN));
    }

    return booking_daily_normalize_pet_ids($petIds);
}

function booking_daily_lock_subjects(
    PDO $pdo,
    array $petIds,
    int $ownerUserId = 0,
    ?string $unregisteredPetName = null
): void {
    if (!$pdo->inTransaction()) {
        throw new LogicException('Daily booking subjects must be locked inside a transaction.');
    }

    $petIds = booking_daily_normalize_pet_ids($petIds);
    if (!empty($petIds)) {
        $placeholders = implode(',', array_fill(0, count($petIds), '?'));
        $stmt = $pdo->prepare("
            SELECT pet_id
            FROM pets_information
            WHERE pet_id IN ({$placeholders})
            ORDER BY pet_id
            FOR UPDATE
        ");
        $stmt->execute($petIds);
        $stmt->fetchAll(PDO::FETCH_COLUMN);
        return;
    }

    if ($ownerUserId > 0 && booking_daily_normalize_pet_name($unregisteredPetName) !== '') {
        $stmt = $pdo->prepare("
            SELECT user_id
            FROM users
            WHERE user_id = ?
            LIMIT 1
            FOR UPDATE
        ");
        $stmt->execute([$ownerUserId]);
        $stmt->fetchColumn();
    }
}

function booking_daily_find_conflict(
    PDO $pdo,
    array $petIds,
    string $bookingDate,
    int $excludeBookingId = 0,
    int $ownerUserId = 0,
    ?string $unregisteredPetName = null
): ?array {
    $petIds = booking_daily_normalize_pet_ids($petIds);

    if (!empty($petIds)) {
        $placeholders = implode(',', array_fill(0, count($petIds), '?'));
        if (booking_daily_table_exists($pdo, 'booking_pets')) {
            $bookingPetsJoin = 'LEFT JOIN booking_pets bp ON bp.booking_id = b.booking_id';
            $petRelation = '(p.pet_id = bp.pet_id OR p.pet_id = b.pet_id)';
        } else {
            $bookingPetsJoin = '';
            $petRelation = 'p.pet_id = b.pet_id';
        }

        $stmt = $pdo->prepare("
            SELECT
                b.booking_id,
                b.booking_number,
                p.pet_id,
                COALESCE(p.pet_name, b.unregistered_pet_name, 'Selected pet') AS pet_name,
                b.service_type,
                b.booking_date,
                b.booking_time,
                b.status
            FROM bookings b
            {$bookingPetsJoin}
            JOIN pets_information p ON {$petRelation}
            WHERE b.booking_date = ?
              AND LOWER(COALESCE(b.status, 'pending')) NOT IN ('cancelled', 'rejected')
              AND p.pet_id IN ({$placeholders})
              AND b.booking_id <> ?
            ORDER BY b.booking_time, b.booking_id, p.pet_id
            LIMIT 1
            FOR UPDATE
        ");
        $stmt->execute(array_merge([$bookingDate], $petIds, [$excludeBookingId]));
        $conflict = $stmt->fetch(PDO::FETCH_ASSOC);

        return $conflict ?: null;
    }

    $normalizedPetName = booking_daily_normalize_pet_name($unregisteredPetName);
    if ($ownerUserId <= 0 || $normalizedPetName === '') {
        return null;
    }

    $stmt = $pdo->prepare("
        SELECT
            b.booking_id,
            b.booking_number,
            NULL AS pet_id,
            COALESCE(NULLIF(TRIM(b.unregistered_pet_name), ''), 'Selected pet') AS pet_name,
            b.service_type,
            b.booking_date,
            b.booking_time,
            b.status
        FROM bookings b
        WHERE b.booking_date = ?
          AND LOWER(COALESCE(b.status, 'pending')) NOT IN ('cancelled', 'rejected')
          AND b.user_id = ?
          AND b.pet_id IS NULL
          AND b.booking_id <> ?
        ORDER BY b.booking_time, b.booking_id
        FOR UPDATE
    ");
    $stmt->execute([
        $bookingDate,
        $ownerUserId,
        $excludeBookingId,
    ]);
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $candidate) {
        if (booking_daily_normalize_pet_name($candidate['pet_name'] ?? null) === $normalizedPetName) {
            return $candidate;
        }
    }

    return null;
}

function booking_daily_conflict_payload(array $conflict): array
{
    $petName = trim((string)($conflict['pet_name'] ?? 'Selected pet')) ?: 'Selected pet';
    $bookingNumber = trim((string)($conflict['booking_number'] ?? ''));
    $serviceType = trim((string)($conflict['service_type'] ?? 'booking')) ?: 'booking';
    $bookingDate = trim((string)($conflict['booking_date'] ?? ''));
    $bookingTime = trim((string)($conflict['booking_time'] ?? ''));

    $dateLabel = $bookingDate;
    $parsedDate = DateTimeImmutable::createFromFormat('!Y-m-d', $bookingDate);
    if ($parsedDate) {
        $dateLabel = $parsedDate->format('F j, Y');
    }

    $timeLabel = '';
    $parsedTime = DateTimeImmutable::createFromFormat('!H:i:s', $bookingTime)
        ?: DateTimeImmutable::createFromFormat('!H:i', $bookingTime);
    if ($parsedTime) {
        $timeLabel = $parsedTime->format('g:i A');
    }

    $reference = $bookingNumber !== '' ? " {$bookingNumber}" : '';
    $schedule = trim($dateLabel . ($timeLabel !== '' ? " at {$timeLabel}" : ''));
    $message = "{$petName} already has booking{$reference} for {$serviceType} on {$schedule}. "
        . 'A pet can only have one booking per day. Cancel the existing booking before submitting another for this date, or choose a different date.';

    return [
        'message' => $message,
        'code' => 'pet_daily_booking_conflict',
        'conflict' => [
            'bookingId' => isset($conflict['booking_id']) ? (int)$conflict['booking_id'] : null,
            'bookingNumber' => $bookingNumber !== '' ? $bookingNumber : null,
            'petId' => isset($conflict['pet_id']) && $conflict['pet_id'] !== null
                ? (int)$conflict['pet_id']
                : null,
            'petName' => $petName,
            'serviceType' => $serviceType,
            'bookingDate' => $bookingDate !== '' ? $bookingDate : null,
            'bookingTime' => $bookingTime !== '' ? $bookingTime : null,
            'status' => trim((string)($conflict['status'] ?? '')) ?: null,
        ],
    ];
}
