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
    $timeValue = strlen($time) === 5 ? $time . ':00' : $time;
    return new DateTime($date . ' ' . $timeValue);
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

    $consultation = fetchOnlineConsultationByBooking($pdo, $bookingId);
    if (!$consultation) {
        return createOnlineConsultationForBooking($pdo, $bookingId);
    }

    $newStart = buildOnlineConsultationDateTime($newDate, $newTime);
    $newEnd = (clone $newStart)->modify('+1 hour');

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
            $newStart->format('Y-m-d H:i:s'),
            $newEnd->format('Y-m-d H:i:s'),
            $reason,
            $changedByUserId,
        ]);
    }

    $update = $pdo->prepare("
        UPDATE online_consultations
        SET scheduled_start = ?,
            scheduled_end = ?,
            status = CASE
                WHEN status IN ('completed', 'cancelled', 'no_show') THEN status
                ELSE 'scheduled'
            END,
            vet_started_at = NULL,
            owner_joined_at = NULL,
            ended_at = NULL
        WHERE online_consultation_id = ?
    ");
    $update->execute([
        $newStart->format('Y-m-d H:i:s'),
        $newEnd->format('Y-m-d H:i:s'),
        (int)$consultation['online_consultation_id'],
    ]);

    return fetchOnlineConsultationRow($pdo, (int)$consultation['online_consultation_id']);
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
