<?php

require_once __DIR__ . '/notification_helpers.php';
require_once __DIR__ . '/online_consultation_helpers.php';

const MAINTENANCE_TIMEZONE = 'Asia/Manila';
const MAINTENANCE_ORIGINAL_BOOKING_NOTE = '[Original Booking Date: %s]';

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

function maintenance_column_exists(PDO $pdo, string $tableName, string $columnName): bool
{
    $stmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = ?
          AND column_name = ?
    ");
    $stmt->execute([$tableName, $columnName]);

    return (int)$stmt->fetchColumn() > 0;
}

function maintenance_use_clinic_timezone(PDO $pdo): void
{
    date_default_timezone_set(MAINTENANCE_TIMEZONE);

    try {
        $pdo->exec("SET time_zone = '+08:00'");
    } catch (Throwable $error) {
        error_log('Could not set database timezone for lifecycle maintenance: ' . $error->getMessage());
    }
}

function maintenance_today(PDO $pdo): string
{
    maintenance_use_clinic_timezone($pdo);

    return date('Y-m-d');
}

function maintenance_now(PDO $pdo): string
{
    maintenance_use_clinic_timezone($pdo);

    return date('Y-m-d H:i:s');
}

function maintenance_date_add(string $date, int $days): string
{
    return (new DateTimeImmutable($date, new DateTimeZone(MAINTENANCE_TIMEZONE)))
        ->modify(($days >= 0 ? '+' : '') . $days . ' days')
        ->format('Y-m-d');
}

function maintenance_is_after(string $leftDate, string $rightDate): bool
{
    return strcmp($leftDate, $rightDate) > 0;
}

function maintenance_append_note(?string $currentNotes, string $note): string
{
    $currentNotes = trim((string)$currentNotes);
    $note = trim($note);

    if ($note === '') {
        return $currentNotes;
    }

    return trim($currentNotes . ($currentNotes !== '' ? "\n\n" : '') . $note);
}

function maintenance_original_booking_date_from_notes(?string $notes): ?string
{
    if (preg_match('/\[Original Booking Date:\s*(\d{4}-\d{2}-\d{2})\]/', (string)$notes, $matches) === 1) {
        return $matches[1];
    }

    return null;
}

function maintenance_booking_start_date(array $booking): ?string
{
    if (
        strtolower((string)($booking['service_type'] ?? '')) === 'boarding'
        && !empty($booking['check_in_date'])
        && $booking['check_in_date'] !== '0000-00-00'
    ) {
        return (string)$booking['check_in_date'];
    }

    if (!empty($booking['booking_date']) && $booking['booking_date'] !== '0000-00-00') {
        return (string)$booking['booking_date'];
    }

    if (!empty($booking['created_at'])) {
        return date('Y-m-d', strtotime((string)$booking['created_at']));
    }

    return null;
}

function maintenance_booking_original_date(array $booking): ?string
{
    return maintenance_original_booking_date_from_notes($booking['notes'] ?? null)
        ?: maintenance_booking_start_date($booking);
}

function maintenance_append_original_booking_note_if_missing(array $booking, string $note): string
{
    if (maintenance_original_booking_date_from_notes($booking['notes'] ?? null) !== null) {
        return $note;
    }

    $originalDate = maintenance_booking_start_date($booking);
    if ($originalDate === null) {
        return $note;
    }

    return maintenance_append_note($note, sprintf(MAINTENANCE_ORIGINAL_BOOKING_NOTE, $originalDate));
}

function maintenance_is_booking_reschedule_excluded(array $booking): bool
{
    $serviceType = strtolower(trim((string)($booking['service_type'] ?? '')));

    if ((int)($booking['is_home_service'] ?? 0) === 1) {
        return true;
    }

    if ((int)($booking['is_online_consultation'] ?? 0) === 1) {
        return true;
    }

    if (in_array($serviceType, ['home-service', 'boarding', 'special services'], true)) {
        return true;
    }

    return str_contains($serviceType, 'boarding')
        || str_contains($serviceType, 'hotel')
        || str_contains($serviceType, 'kennel')
        || str_contains($serviceType, 'special');
}

function maintenance_is_booking_auto_cancel_eligible(array $booking): bool
{
    $serviceType = strtolower(trim((string)($booking['service_type'] ?? '')));

    if ((int)($booking['is_online_consultation'] ?? 0) === 1) {
        return false;
    }

    if ((int)($booking['is_home_service'] ?? 0) === 1) {
        return false;
    }

    if ($serviceType === 'special services' || str_contains($serviceType, 'special')) {
        return false;
    }

    return true;
}

function maintenance_booking_reached_service(PDO $pdo, int $bookingId): bool
{
    if ($bookingId <= 0) {
        return false;
    }

    $hasAssignments = maintenance_table_exists($pdo, 'vet_queue_assignments');
    $assignmentJoin = $hasAssignments ? 'LEFT JOIN vet_queue_assignments vqa ON vqa.queue_id = q.queue_id' : '';
    $assignmentCondition = $hasAssignments ? " OR LOWER(COALESCE(vqa.status, '')) IN ('received', 'completed')" : '';

    if (maintenance_table_exists($pdo, 'queues')) {
        $stmt = $pdo->prepare("
            SELECT COUNT(DISTINCT q.queue_id)
            FROM queues q
            {$assignmentJoin}
            WHERE q.booking_id = ?
              AND (
                  LOWER(COALESCE(q.status, '')) = 'completed'
                  {$assignmentCondition}
              )
        ");
        $stmt->execute([$bookingId]);
        if ((int)$stmt->fetchColumn() > 0) {
            return true;
        }
    }

    if (maintenance_table_exists($pdo, 'vet_diagnoses')) {
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM vet_diagnoses WHERE booking_id = ?");
        $stmt->execute([$bookingId]);
        if ((int)$stmt->fetchColumn() > 0) {
            return true;
        }
    }

    if (maintenance_table_exists($pdo, 'visits')) {
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM visits WHERE booking_id = ? AND visit_status <> 'cancelled'");
        $stmt->execute([$bookingId]);
        if ((int)$stmt->fetchColumn() > 0) {
            return true;
        }
    }

    return false;
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

function maintenance_cancel_queue(PDO $pdo, int $queueId, string $reason, bool $notify = true, bool $returnActiveAssignment = false): bool
{
    $stmt = $pdo->prepare("
        SELECT queue_id, complaint
        FROM queues
        WHERE queue_id = ?
          AND LOWER(COALESCE(status, '')) IN ('waiting', 'in-progress')
        LIMIT 1
        FOR UPDATE
    ");
    $stmt->execute([$queueId]);
    $queue = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$queue) {
        return false;
    }

    $note = '[Lifecycle] ' . $reason . ' (' . maintenance_now($pdo) . ')';
    $update = $pdo->prepare("
        UPDATE queues
        SET status = 'cancelled',
            complaint = ?
        WHERE queue_id = ?
    ");
    $update->execute([
        maintenance_append_note($queue['complaint'] ?? '', $note),
        $queueId,
    ]);

    if ($returnActiveAssignment) {
        maintenance_return_active_queue_assignment($pdo, $queueId, $reason);
    }

    if ($notify) {
        try {
            notification_send_queue_event($pdo, $queueId, 'cancelled', [
                'reason' => $reason,
            ]);
        } catch (Throwable $notificationError) {
            error_log('Lifecycle queue notification failed: ' . $notificationError->getMessage());
        }
    }

    return true;
}

function maintenance_fetch_expired_queue_ids(PDO $pdo, ?int $petId = null): array
{
    $today = maintenance_today($pdo);
    $petCondition = '';
    $params = [$today];

    if ($petId !== null && $petId > 0) {
        $petCondition = ' AND q.pet_id = ?';
        $params[] = $petId;
    }

    $activeAssignmentCondition = maintenance_table_exists($pdo, 'vet_queue_assignments')
        ? "AND NOT EXISTS (
                SELECT 1
                FROM vet_queue_assignments vqa
                WHERE vqa.queue_id = q.queue_id
                  AND vqa.status = 'received'
            )"
        : '';

    $stmt = $pdo->prepare("
        SELECT q.queue_id
        FROM queues q
        WHERE LOWER(COALESCE(q.status, '')) IN ('waiting', 'in-progress')
          AND DATE(q.timestamp) < ?
          {$petCondition}
          {$activeAssignmentCondition}
        ORDER BY q.queue_id ASC
        LIMIT 500
    ");
    $stmt->execute($params);

    return array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));
}

function maintenance_cancel_expired_queues(PDO $pdo, ?int $petId = null, bool $notify = true): array
{
    $queueIds = maintenance_fetch_expired_queue_ids($pdo, $petId);
    $cancelledIds = [];
    $reason = 'Cancelled - previous day / re-entry required';

    foreach ($queueIds as $queueId) {
        $startedTransaction = false;

        try {
            if (!$pdo->inTransaction()) {
                $pdo->beginTransaction();
                $startedTransaction = true;
            }

            $cancelled = maintenance_cancel_queue($pdo, $queueId, $reason, $notify, false);

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

            error_log('Lifecycle queue cancellation failed: ' . $error->getMessage());
        }
    }

    return [
        'count' => count($cancelledIds),
        'queueIds' => $cancelledIds,
    ];
}

function maintenance_fetch_active_bookings(PDO $pdo, ?int $petId = null): array
{
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
        SELECT DISTINCT b.*
        FROM bookings b
        {$bookingPetsJoin}
        WHERE LOWER(COALESCE(b.status, '')) IN ('pending', 'confirmed')
          {$petCondition}
        ORDER BY b.booking_date ASC, b.booking_id ASC
        LIMIT 1000
    ");
    $stmt->execute($params);

    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

function maintenance_cancel_booking(PDO $pdo, int $bookingId, string $reason, bool $notify = true): bool
{
    $stmt = $pdo->prepare("
        SELECT *
        FROM bookings
        WHERE booking_id = ?
          AND LOWER(COALESCE(status, '')) IN ('pending', 'confirmed')
        LIMIT 1
        FOR UPDATE
    ");
    $stmt->execute([$bookingId]);
    $booking = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$booking) {
        return false;
    }

    $note = maintenance_append_original_booking_note_if_missing(
        $booking,
        '[Auto Cancellation] ' . $reason . ' (' . maintenance_now($pdo) . ')'
    );
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
            error_log('Lifecycle booking notification failed: ' . $notificationError->getMessage());
        }
    }

    return true;
}

function maintenance_auto_reschedule_booking(PDO $pdo, array $booking, string $today, bool $notify = true): bool
{
    $bookingId = (int)$booking['booking_id'];
    $previousDate = (string)$booking['booking_date'];
    $note = '[Lifecycle] Auto-rescheduled due to missed approved booking / not reached during scheduled date. Previous date: '
        . $previousDate
        . '. Recorded at: '
        . maintenance_now($pdo);
    $note = maintenance_append_original_booking_note_if_missing($booking, $note);

    $stmt = $pdo->prepare("
        UPDATE bookings
        SET booking_date = ?,
            notes = ?
        WHERE booking_id = ?
          AND status = 'confirmed'
    ");
    $stmt->execute([
        $today,
        maintenance_append_note($booking['notes'] ?? '', $note),
        $bookingId,
    ]);

    if ($stmt->rowCount() <= 0) {
        return false;
    }

    if ($notify) {
        try {
            notification_send_booking_event($pdo, $bookingId, 'rescheduled', [
                'old_date' => $previousDate,
                'new_date' => $today,
                'reason' => 'Auto-rescheduled due to missed approved booking / not reached during scheduled date.',
            ]);
        } catch (Throwable $notificationError) {
            error_log('Lifecycle booking reschedule notification failed: ' . $notificationError->getMessage());
        }
    }

    return true;
}

function maintenance_process_bookings(PDO $pdo, ?int $petId = null, bool $notify = true): array
{
    $today = maintenance_today($pdo);
    $cancelledIds = [];
    $rescheduledIds = [];

    foreach (maintenance_fetch_active_bookings($pdo, $petId) as $booking) {
        $bookingId = (int)$booking['booking_id'];
        $status = strtolower((string)($booking['status'] ?? ''));
        $currentDate = maintenance_booking_start_date($booking);
        $originalDate = maintenance_booking_original_date($booking);

        if ($currentDate === null || $originalDate === null) {
            continue;
        }

        $startedService = maintenance_booking_reached_service($pdo, $bookingId);
        $lifespanEnd = maintenance_date_add($originalDate, 7);

        if (
            !$startedService
            && maintenance_is_booking_auto_cancel_eligible($booking)
            && maintenance_is_after($today, $lifespanEnd)
        ) {
            $startedTransaction = false;

            try {
                if (!$pdo->inTransaction()) {
                    $pdo->beginTransaction();
                    $startedTransaction = true;
                }

                $reason = 'Booking expired after 7 days from original desired date (' . $originalDate . ').';
                if (maintenance_cancel_booking($pdo, $bookingId, $reason, $notify)) {
                    $cancelledIds[] = $bookingId;
                }

                if ($startedTransaction) {
                    $pdo->commit();
                }
            } catch (Throwable $error) {
                if ($startedTransaction && $pdo->inTransaction()) {
                    $pdo->rollBack();
                }

                error_log('Lifecycle booking cancellation failed: ' . $error->getMessage());
            }

            continue;
        }

        if (
            $status === 'confirmed'
            && !$startedService
            && !maintenance_is_booking_reschedule_excluded($booking)
            && strcmp((string)$booking['booking_date'], $today) < 0
            && !maintenance_is_after($today, $lifespanEnd)
        ) {
            $startedTransaction = false;

            try {
                if (!$pdo->inTransaction()) {
                    $pdo->beginTransaction();
                    $startedTransaction = true;
                }

                if (maintenance_auto_reschedule_booking($pdo, $booking, $today, $notify)) {
                    $rescheduledIds[] = $bookingId;
                }

                if ($startedTransaction) {
                    $pdo->commit();
                }
            } catch (Throwable $error) {
                if ($startedTransaction && $pdo->inTransaction()) {
                    $pdo->rollBack();
                }

                error_log('Lifecycle booking auto-reschedule failed: ' . $error->getMessage());
            }
        }
    }

    return [
        'cancelledCount' => count($cancelledIds),
        'cancelledBookingIds' => $cancelledIds,
        'rescheduledCount' => count($rescheduledIds),
        'rescheduledBookingIds' => $rescheduledIds,
    ];
}

function runLifecycleMaintenance(PDO $pdo, ?int $petId = null, bool $notify = true): array
{
    maintenance_use_clinic_timezone($pdo);
    $queueResult = maintenance_cancel_expired_queues($pdo, $petId, $notify);
    $bookingResult = maintenance_process_bookings($pdo, $petId, $notify);

    return [
        'queuesCancelled' => (int)$queueResult['count'],
        'queueIds' => $queueResult['queueIds'],
        'bookingsCancelled' => (int)$bookingResult['cancelledCount'],
        'bookingIds' => $bookingResult['cancelledBookingIds'],
        'bookingsRescheduled' => (int)$bookingResult['rescheduledCount'],
        'rescheduledBookingIds' => $bookingResult['rescheduledBookingIds'],
    ];
}

function autoCancelOverdueBookingsDetailed(PDO $pdo, ?int $petId = null, bool $notify = true, ?string $reason = null): array
{
    $result = runLifecycleMaintenance($pdo, $petId, $notify);

    return [
        'count' => (int)$result['bookingsCancelled'],
        'bookingIds' => $result['bookingIds'],
        'rescheduledCount' => (int)$result['bookingsRescheduled'],
        'rescheduledBookingIds' => $result['rescheduledBookingIds'],
    ];
}

function autoCancelOverdueBookings(PDO $pdo): int
{
    return autoCancelOverdueBookingsDetailed($pdo, null, true)['count'];
}

function autoCancelStaleQueuesDetailed(PDO $pdo, ?int $petId = null, bool $notify = true, ?string $reason = null): array
{
    $result = runLifecycleMaintenance($pdo, $petId, $notify);

    return [
        'count' => (int)$result['queuesCancelled'],
        'queueIds' => $result['queueIds'],
    ];
}

function autoCancelStaleQueues(PDO $pdo): int
{
    return autoCancelStaleQueuesDetailed($pdo, null, true)['count'];
}
