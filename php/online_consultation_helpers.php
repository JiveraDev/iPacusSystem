<?php

function onlineConsultationTableExists(PDO $pdo, string $tableName): bool
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

function buildOnlineConsultationDateTime(string $date, string $time): DateTime
{
    $dateValue = trim($date);
    $timeValue = trim($time);
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateValue)) {
        throw new InvalidArgumentException('Booking date must use the YYYY-MM-DD format.');
    }
    if (!preg_match('/^\d{1,2}:\d{2}(?::\d{2})?$/', $timeValue)) {
        throw new InvalidArgumentException('Booking time must use the HH:MM format.');
    }

    $timeParts = explode(':', $timeValue);
    $normalizedTime = sprintf(
        '%02d:%02d:%02d',
        (int)($timeParts[0] ?? 0),
        (int)($timeParts[1] ?? 0),
        (int)($timeParts[2] ?? 0)
    );
    $timezone = new DateTimeZone('Asia/Manila');
    $dateTime = DateTime::createFromFormat(
        '!Y-m-d H:i:s',
        $dateValue . ' ' . $normalizedTime,
        $timezone
    );
    $errors = DateTime::getLastErrors();
    if (
        !$dateTime
        || ($errors !== false && ((int)$errors['warning_count'] > 0 || (int)$errors['error_count'] > 0))
        || $dateTime->format('Y-m-d H:i:s') !== $dateValue . ' ' . $normalizedTime
    ) {
        throw new InvalidArgumentException('Booking date or time is invalid.');
    }

    return $dateTime;
}

function fetchOnlineConsultationRow(PDO $pdo, int $onlineConsultationId): ?array
{
    $stmt = $pdo->prepare("SELECT * FROM online_consultations WHERE online_consultation_id = ? LIMIT 1");
    $stmt->execute([$onlineConsultationId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    return $row ?: null;
}

function fetchOnlineConsultationByBooking(PDO $pdo, int $bookingId): ?array
{
    $stmt = $pdo->prepare("SELECT * FROM online_consultations WHERE booking_id = ? LIMIT 1");
    $stmt->execute([$bookingId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    return $row ?: null;
}

function fetchOnlineConsultationRescheduleHistoryMap(PDO $pdo, array $onlineConsultationIds): array
{
    $ids = array_values(array_unique(array_filter(array_map('intval', $onlineConsultationIds))));
    $historyByConsultation = [];
    foreach ($ids as $id) {
        $historyByConsultation[$id] = [];
    }

    if (!$ids || !onlineConsultationTableExists($pdo, 'online_consultation_reschedules')) {
        return $historyByConsultation;
    }

    $placeholders = implode(', ', array_fill(0, count($ids), '?'));
    $stmt = $pdo->prepare("
        SELECT
            r.online_consultation_id,
            r.reschedule_id,
            r.old_start,
            r.old_end,
            r.new_start,
            r.new_end,
            r.reason,
            r.changed_by_user_id,
            r.created_at,
            CONCAT(u.first_Name, ' ', u.last_Name) AS changed_by_name
        FROM online_consultation_reschedules r
        LEFT JOIN users u ON u.user_id = r.changed_by_user_id
        WHERE r.online_consultation_id IN ({$placeholders})
        ORDER BY r.online_consultation_id ASC, r.created_at DESC, r.reschedule_id DESC
    ");
    $stmt->execute($ids);

    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $onlineConsultationId = (int)$row['online_consultation_id'];
        $historyByConsultation[$onlineConsultationId][] = [
            'rescheduleId' => (int)$row['reschedule_id'],
            'oldStart' => $row['old_start'],
            'oldEnd' => $row['old_end'],
            'newStart' => $row['new_start'],
            'newEnd' => $row['new_end'],
            'reason' => $row['reason'] ?? null,
            'changedByUserId' => $row['changed_by_user_id'] !== null
                ? (int)$row['changed_by_user_id']
                : null,
            'changedByName' => trim((string)($row['changed_by_name'] ?? '')),
            'createdAt' => $row['created_at'],
        ];
    }

    return $historyByConsultation;
}

function fetchOnlineConsultationRescheduleHistory(PDO $pdo, int $onlineConsultationId): array
{
    $historyMap = fetchOnlineConsultationRescheduleHistoryMap($pdo, [$onlineConsultationId]);

    return $historyMap[$onlineConsultationId] ?? [];
}

function onlineConsultationWithReschedules(PDO $pdo, ?array $consultation): ?array
{
    if ($consultation === null) {
        return null;
    }

    $consultation['reschedules'] = fetchOnlineConsultationRescheduleHistory(
        $pdo,
        (int)($consultation['online_consultation_id'] ?? 0)
    );

    return $consultation;
}

function getJitsiBaseUrl(): string
{
    $baseUrl = trim((string)(getenv('JITSI_BASE_URL') ?: 'https://meet.jit.si'));
    if (strtolower($baseUrl) === 'public') {
        $baseUrl = 'https://meet.jit.si';
    }

    return rtrim($baseUrl, '/');
}

function createJitsiRoomForBooking(int $bookingId): array
{
    $token = bin2hex(random_bytes(8));
    $roomName = 'ipawcus-consult-' . $bookingId . '-' . $token;
    $baseUrl = getJitsiBaseUrl();

    return [
        'roomName' => $roomName,
        'meetingUrl' => $baseUrl . '/' . $roomName,
    ];
}

function createOnlineConsultationForBooking(PDO $pdo, int $bookingId): ?array
{
    $stmt = $pdo->prepare("
        SELECT booking_id, user_id, veterinarian_id, booking_date, booking_time, is_online_consultation, status
        FROM bookings
        WHERE booking_id = ?
        LIMIT 1
    ");
    $stmt->execute([$bookingId]);
    $booking = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$booking || (int)$booking['is_online_consultation'] !== 1) {
        return null;
    }

    if (!onlineConsultationTableExists($pdo, 'online_consultations')) {
        throw new RuntimeException('online_consultations table does not exist.');
    }

    $existing = fetchOnlineConsultationByBooking($pdo, $bookingId);
    if ($existing) {
        return $existing;
    }

    $veterinarianId = (int)($booking['veterinarian_id'] ?? 0);
    if ($veterinarianId <= 0) {
        throw new RuntimeException('Online consultation cannot be approved without an assigned veterinarian.');
    }

    $scheduledStart = buildOnlineConsultationDateTime($booking['booking_date'], $booking['booking_time']);
    $scheduledEnd = (clone $scheduledStart)->modify('+1 hour');
    $meeting = createJitsiRoomForBooking($bookingId);

    $insert = $pdo->prepare("
        INSERT INTO online_consultations (
            booking_id,
            owner_user_id,
            veterinarian_user_id,
            scheduled_start,
            scheduled_end,
            meeting_provider,
            meeting_url,
            meeting_code,
            status
        ) VALUES (?, ?, ?, ?, ?, 'jitsi', ?, ?, 'scheduled')
    ");
    $insert->execute([
        $bookingId,
        (int)$booking['user_id'],
        $veterinarianId,
        $scheduledStart->format('Y-m-d H:i:s'),
        $scheduledEnd->format('Y-m-d H:i:s'),
        $meeting['meetingUrl'],
        $meeting['roomName'],
    ]);

    return fetchOnlineConsultationRow($pdo, (int)$pdo->lastInsertId());
}

function rescheduleOnlineConsultationForBooking(PDO $pdo, int $bookingId, string $newDate, string $newTime, ?int $changedByUserId = null, ?string $reason = null): ?array
{
    if (!onlineConsultationTableExists($pdo, 'online_consultations')) {
        return null;
    }

    $consultationStmt = $pdo->prepare("
        SELECT *
        FROM online_consultations
        WHERE booking_id = ?
        LIMIT 1
        FOR UPDATE
    ");
    $consultationStmt->execute([$bookingId]);
    $consultation = $consultationStmt->fetch(PDO::FETCH_ASSOC) ?: null;
    if (!$consultation) {
        return onlineConsultationWithReschedules(
            $pdo,
            createOnlineConsultationForBooking($pdo, $bookingId)
        );
    }

    $currentStatus = strtolower(trim((string)($consultation['status'] ?? '')));
    if (in_array($currentStatus, ['in_progress', 'completed', 'cancelled', 'no_show'], true)) {
        throw new DomainException("An online consultation with status {$currentStatus} cannot be rescheduled.");
    }

    $newStart = buildOnlineConsultationDateTime($newDate, $newTime);
    $newEnd = (clone $newStart)->modify('+1 hour');
    $newStartSql = $newStart->format('Y-m-d H:i:s');
    $newEndSql = $newEnd->format('Y-m-d H:i:s');

    if (
        (string)($consultation['scheduled_start'] ?? '') === $newStartSql
        && (string)($consultation['scheduled_end'] ?? '') === $newEndSql
    ) {
        return onlineConsultationWithReschedules($pdo, $consultation);
    }

    if (onlineConsultationTableExists($pdo, 'online_consultation_reschedules')) {
        $audit = $pdo->prepare("
            INSERT INTO online_consultation_reschedules (
                online_consultation_id,
                old_start,
                old_end,
                new_start,
                new_end,
                reason,
                changed_by_user_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ");
        $audit->execute([
            (int)$consultation['online_consultation_id'],
            $consultation['scheduled_start'],
            $consultation['scheduled_end'],
            $newStartSql,
            $newEndSql,
            $reason,
            $changedByUserId,
        ]);
    }

    $update = $pdo->prepare("
        UPDATE online_consultations
        SET scheduled_start = ?,
            scheduled_end = ?,
            status = 'scheduled',
            vet_started_at = NULL,
            owner_joined_at = NULL,
            ended_at = NULL
        WHERE online_consultation_id = ?
    ");
    $update->execute([
        $newStartSql,
        $newEndSql,
        (int)$consultation['online_consultation_id'],
    ]);

    return onlineConsultationWithReschedules(
        $pdo,
        fetchOnlineConsultationRow($pdo, (int)$consultation['online_consultation_id'])
    );
}

function cancelOnlineConsultationForBooking(PDO $pdo, int $bookingId): void
{
    if (!onlineConsultationTableExists($pdo, 'online_consultations')) {
        return;
    }

    $stmt = $pdo->prepare("
        UPDATE online_consultations
        SET status = 'cancelled',
            ended_at = COALESCE(ended_at, NOW())
        WHERE booking_id = ?
          AND status <> 'completed'
    ");
    $stmt->execute([$bookingId]);
}
