<?php

require_once __DIR__ . '/notification_helpers.php';
require_once __DIR__ . '/online_consultation_helpers.php';

function maintenance_table_exists(PDO $pdo, string $tableName): bool
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

function maintenance_normalize_day_threshold(int $days): int
{
    return max(1, min(365, $days));
}

function maintenance_append_note(?string $currentNotes, string $note): string
{
    $currentNotes = trim((string)$currentNotes);

    return trim($currentNotes . ($currentNotes !== '' ? "\n\n" : '') . $note);
}

function maintenance_fetch_overdue_booking_ids(PDO $pdo, ?int $petId = null, int $days = 7): array
{
    $days = maintenance_normalize_day_threshold($days);
    $hasBookingPets = maintenance_table_exists($pdo, 'booking_pets');
    $bookingPetsJoin = $hasBookingPets ? 'LEFT JOIN booking_pets bp ON bp.booking_id = b.booking_id' : '';
    $petCondition = '';
    $params = [];

    if ($petId !== null && $petId > 0) {
        $petCondition = $hasBookingPets
            ? ' AND (b.pet_id = ? OR bp.pet_id = ?)'
            : ' AND b.pet_id = ?';
        $params[] = $petId;
        if ($hasBookingPets) {
            $params[] = $petId;
        }
    }

    $stmt = $pdo->prepare("
        SELECT DISTINCT b.booking_id
        FROM bookings b
        {$bookingPetsJoin}
        WHERE LOWER(COALESCE(b.status, '')) IN ('pending', 'confirmed')
          AND LOWER(COALESCE(b.service_type, '')) <> 'boarding'
          {$petCondition}
          AND (
              (
                  b.booking_date IS NOT NULL
                  AND b.booking_date <> ''
                  AND b.booking_date <> '0000-00-00'
                  AND TIMESTAMP(b.booking_date, COALESCE(NULLIF(b.booking_time, ''), '23:59:59')) < DATE_SUB(NOW(), INTERVAL {$days} DAY)
              )
              OR (
                  (b.booking_date IS NULL OR b.booking_date = '' OR b.booking_date = '0000-00-00')
                  AND b.created_at < DATE_SUB(NOW(), INTERVAL {$days} DAY)
              )
          )
        ORDER BY b.booking_id ASC
        LIMIT 500
    ");
    $stmt->execute($params);

    return array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));
}

function maintenance_cancel_booking(PDO $pdo, int $bookingId, string $reason, bool $notify = true): bool
{
    $stmt = $pdo->prepare("
        SELECT booking_id, notes, is_online_consultation
        FROM bookings
        WHERE booking_id = ?
          AND LOWER(COALESCE(status, '')) IN ('pending', 'confirmed')
          AND LOWER(COALESCE(service_type, '')) <> 'boarding'
        LIMIT 1
        FOR UPDATE
    ");
    $stmt->execute([$bookingId]);
    $booking = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$booking) {
        return false;
    }

    $note = '[Auto Cancellation] ' . $reason;
    $update = $pdo->prepare("UPDATE bookings SET status = 'cancelled', notes = ? WHERE booking_id = ?");
    $update->execute([
        maintenance_append_note($booking['notes'] ?? '', $note),
        $bookingId,
    ]);

    if ((int)($booking['is_online_consultation'] ?? 0) === 1) {
        try {
            cancelOnlineConsultationForBooking($pdo, $bookingId);
        } catch (Throwable $error) {
            error_log('Auto-cancel online consultation failed: ' . $error->getMessage());
        }
    }

    if ($notify) {
        try {
            notification_send_booking_event($pdo, $bookingId, 'cancelled', [
                'reason' => $reason,
                'cancellation_message' => $reason,
            ]);
        } catch (Throwable $notificationError) {
            error_log('Overdue booking notification failed: ' . $notificationError->getMessage());
        }
    }

    return true;
}

function autoCancelOverdueBookingsDetailed(PDO $pdo, ?int $petId = null, bool $notify = true, ?string $reason = null): array
{
    $reason = trim((string)($reason ?: 'This non-boarding booking is more than 7 days overdue.'));
    $bookingIds = maintenance_fetch_overdue_booking_ids($pdo, $petId, 7);
    $cancelledIds = [];

    foreach ($bookingIds as $bookingId) {
        $startedTransaction = false;

        try {
            if (!$pdo->inTransaction()) {
                $pdo->beginTransaction();
                $startedTransaction = true;
            }

            $cancelled = maintenance_cancel_booking($pdo, $bookingId, $reason, $notify);

            if ($startedTransaction) {
                $pdo->commit();
            }

            if ($cancelled) {
                $cancelledIds[] = $bookingId;
            }
        } catch (Throwable $error) {
            if ($startedTransaction && $pdo->inTransaction()) {
                $pdo->rollBack();
            }

            error_log('Overdue booking cancellation failed: ' . $error->getMessage());
        }
    }

    return [
        'count' => count($cancelledIds),
        'bookingIds' => $cancelledIds,
    ];
}

function autoCancelOverdueBookings(PDO $pdo): int
{
    return autoCancelOverdueBookingsDetailed($pdo, null, true)['count'];
}

function maintenance_fetch_stale_queue_ids(PDO $pdo, ?int $petId = null, int $days = 2): array
{
    $days = maintenance_normalize_day_threshold($days);
    $petCondition = '';
    $params = [];

    if ($petId !== null && $petId > 0) {
        $petCondition = ' AND q.pet_id = ?';
        $params[] = $petId;
    }

    $stmt = $pdo->prepare("
        SELECT q.queue_id
        FROM queues q
        WHERE LOWER(COALESCE(q.status, '')) IN ('waiting', 'in-progress', 'in_progress')
          {$petCondition}
          AND q.timestamp < DATE_SUB(NOW(), INTERVAL {$days} DAY)
        ORDER BY q.queue_id ASC
        LIMIT 500
    ");
    $stmt->execute($params);

    return array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));
}

function maintenance_return_active_queue_assignment(PDO $pdo, int $queueId, string $reason): void
{
    if (!maintenance_table_exists($pdo, 'vet_queue_assignments')) {
        return;
    }

    $stmt = $pdo->prepare("
        UPDATE vet_queue_assignments
        SET status = 'returned',
            returned_at = COALESCE(returned_at, NOW()),
            return_reason = ?
        WHERE queue_id = ?
          AND status = 'received'
    ");
    $stmt->execute([$reason, $queueId]);
}

function maintenance_cancel_queue(PDO $pdo, int $queueId, string $reason, bool $notify = true): bool
{
    $stmt = $pdo->prepare("
        SELECT queue_id
        FROM queues
        WHERE queue_id = ?
          AND LOWER(COALESCE(status, '')) IN ('waiting', 'in-progress', 'in_progress')
        LIMIT 1
        FOR UPDATE
    ");
    $stmt->execute([$queueId]);

    if (!$stmt->fetch(PDO::FETCH_ASSOC)) {
        return false;
    }

    $update = $pdo->prepare("UPDATE queues SET status = 'cancelled' WHERE queue_id = ?");
    $update->execute([$queueId]);
    maintenance_return_active_queue_assignment($pdo, $queueId, $reason);

    if ($notify) {
        try {
            notification_send_queue_event($pdo, $queueId, 'cancelled', [
                'reason' => $reason,
            ]);
        } catch (Throwable $notificationError) {
            error_log('Overdue queue notification failed: ' . $notificationError->getMessage());
        }
    }

    return true;
}

function autoCancelStaleQueuesDetailed(PDO $pdo, ?int $petId = null, bool $notify = true, ?string $reason = null): array
{
    $reason = trim((string)($reason ?: 'This queue entry is more than 2 days old and was not completed.'));
    $queueIds = maintenance_fetch_stale_queue_ids($pdo, $petId, 2);
    $cancelledIds = [];

    foreach ($queueIds as $queueId) {
        $startedTransaction = false;

        try {
            if (!$pdo->inTransaction()) {
                $pdo->beginTransaction();
                $startedTransaction = true;
            }

            $cancelled = maintenance_cancel_queue($pdo, $queueId, $reason, $notify);

            if ($startedTransaction) {
                $pdo->commit();
            }

            if ($cancelled) {
                $cancelledIds[] = $queueId;
            }
        } catch (Throwable $error) {
            if ($startedTransaction && $pdo->inTransaction()) {
                $pdo->rollBack();
            }

            error_log('Stale queue cancellation failed: ' . $error->getMessage());
        }
    }

    return [
        'count' => count($cancelledIds),
        'queueIds' => $cancelledIds,
    ];
}

function autoCancelStaleQueues(PDO $pdo): int
{
    return autoCancelStaleQueuesDetailed($pdo, null, true)['count'];
}
