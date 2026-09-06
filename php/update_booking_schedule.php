<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/booking_daily_guard.php';
require_once __DIR__ . '/online_consultation_helpers.php';
require_once __DIR__ . '/notification_helpers.php';
require_once __DIR__ . '/booking_maintenance.php';
require_once __DIR__ . '/booking_queue_helpers.php';
require_once __DIR__ . '/workflow_guard_helpers.php';
require_once __DIR__ . '/branch_helpers.php';
require_once __DIR__ . '/booking_slot_helpers.php';

header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] !== 'PATCH') {
    http_response_code(405);
    echo json_encode(['message' => 'Method not allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true) ?: [];
$bookingId = isset($_GET['bookingId']) ? (int)$_GET['bookingId'] : 0;
$bookingDate = trim((string)($input['booking_date'] ?? $input['date'] ?? ''));
$bookingTime = trim((string)($input['booking_time'] ?? $input['time'] ?? ''));
$reason = trim((string)($input['reason'] ?? ''));
$currentApiUser = ipawcus_guard_current_user($pdo);
$changedByUserId = ipawcus_guard_user_id($currentApiUser);
$currentApiRole = ipawcus_guard_role($currentApiUser);

if (!ipawcus_guard_is_clinic_role($currentApiRole)) {
    ipawcus_guard_error(403, 'Only authorized clinic users can reschedule bookings.');
}

if ($bookingId <= 0 || $bookingDate === '' || $bookingTime === '') {
    http_response_code(400);
    echo json_encode(['message' => 'Booking ID, date, and time are required.']);
    exit;
}

$slotLockName = null;

try {
    $requestedDateTime = buildOnlineConsultationDateTime($bookingDate, $bookingTime);
    $currentDateTime = new DateTime('now', new DateTimeZone('Asia/Manila'));
    if ($requestedDateTime <= $currentDateTime) {
        throw new InvalidArgumentException('The new booking schedule must be in the future.');
    }
    $bookingDate = $requestedDateTime->format('Y-m-d');
    $bookingTime = $requestedDateTime->format('H:i:s');

    $pdo->beginTransaction();

    $subjectStmt = $pdo->prepare("
        SELECT booking_id, user_id, pet_id, unregistered_pet_name
        FROM bookings
        WHERE booking_id = ?
        LIMIT 1
    ");
    $subjectStmt->execute([$bookingId]);
    $bookingSubject = $subjectStmt->fetch(PDO::FETCH_ASSOC);
    if (!$bookingSubject) {
        throw new OutOfBoundsException('Booking not found.');
    }

    $subjectPetIds = booking_daily_pet_ids_for_booking(
        $pdo,
        (int)$bookingSubject['booking_id'],
        $bookingSubject['pet_id'] ?? null
    );
    booking_daily_lock_subjects(
        $pdo,
        $subjectPetIds,
        (int)($bookingSubject['user_id'] ?? 0),
        $bookingSubject['unregistered_pet_name'] ?? null
    );

    $stmt = $pdo->prepare("
        SELECT booking_id, user_id, pet_id, unregistered_pet_name, veterinarian_id, branch_id,
               is_online_consultation, status, booking_date, booking_time,
               service_type, check_in_date, created_at, notes
        FROM bookings
        WHERE booking_id = ?
        LIMIT 1
        FOR UPDATE
    ");
    $stmt->execute([$bookingId]);
    $booking = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$booking) {
        throw new OutOfBoundsException('Booking not found.');
    }

    if (
        $currentApiRole === 'admin'
        && strtolower(trim((string)($booking['status'] ?? ''))) !== 'pending'
        && !branch_user_can_access($pdo, $currentApiUser, (int)($booking['branch_id'] ?? 0))
    ) {
        ipawcus_guard_error(403, 'This booking belongs to another branch.');
    }

    if (
        $currentApiRole === 'veterinarian'
        && (int)($booking['veterinarian_id'] ?? 0) !== $changedByUserId
    ) {
        ipawcus_guard_error(403, 'You can only reschedule bookings assigned to you.');
    }

    $bookingStatus = strtolower(trim((string)($booking['status'] ?? '')));
    if (ipawcus_guard_table_exists($pdo, 'grooming_jobs')) {
        $groomingStmt = $pdo->prepare('SELECT status FROM grooming_jobs WHERE booking_id = ? FOR UPDATE');
        $groomingStmt->execute([$bookingId]);
        $groomingStatus = $groomingStmt->fetchColumn();
        if ($groomingStatus && $groomingStatus !== 'scheduled') {
            ipawcus_guard_error(409, 'This grooming job has already checked in or closed. Keep its booked date as part of the service history.');
        }
    }
    if (!in_array($bookingStatus, ['pending', 'confirmed'], true)) {
        throw new DomainException("A {$bookingStatus} booking cannot be rescheduled.");
    }

    $serviceKey = booking_slot_service_key(
        $booking['service_type'] ?? null,
        $booking['is_home_service'] ?? 0,
        $booking['is_online_consultation'] ?? 0
    );
    if ($serviceKey === 'boarding') {
        throw new DomainException('Boarding stay dates cannot be changed from the general booking scheduler because check-in, check-out, and room availability must be updated together.');
    }
    if ($serviceKey !== 'boarding') {
        $bookingTime = booking_slot_assert_aligned($serviceKey, $bookingTime);
    }

    try {
        $branchResolution = branch_resolve_booking(
            $pdo,
            $booking['branch_id'] ?? null,
            $booking['service_type'] ?? null,
            $booking['is_home_service'] ?? 0,
            $booking['is_online_consultation'] ?? 0,
            $bookingDate,
            $bookingTime,
            is_numeric($booking['veterinarian_id'] ?? null) ? (int)$booking['veterinarian_id'] : null
        );
    } catch (InvalidArgumentException $e) {
        throw new DomainException($e->getMessage());
    }

    $veterinarianId = is_numeric($booking['veterinarian_id'] ?? null)
        ? (int)$booking['veterinarian_id']
        : null;
    if (!empty($branchResolution['veterinarian_user_id'])) {
        $veterinarianId = (int)$branchResolution['veterinarian_user_id'];
    }
    if ($serviceKey === 'online-consultation'
        && (!$veterinarianId || !booking_slot_online_vet_is_available($pdo, $veterinarianId, $bookingDate, $bookingTime))) {
        throw new DomainException('That veterinarian has not made this online consultation time available. Select another date or time.');
    }

    $oldBookingDate = (string)($booking['booking_date'] ?? '');
    $oldBookingTime = (string)($booking['booking_time'] ?? '');
    $oldDateTime = buildOnlineConsultationDateTime($oldBookingDate, $oldBookingTime);
    if ($oldDateTime->format('Y-m-d H:i:s') === $requestedDateTime->format('Y-m-d H:i:s')) {
        $onlineConsultation = (int)$booking['is_online_consultation'] === 1
            ? onlineConsultationWithReschedules(
                $pdo,
                fetchOnlineConsultationByBooking($pdo, $bookingId)
            )
            : null;
        $pdo->commit();
        echo json_encode([
            'message' => 'Booking schedule is unchanged.',
            'onlineConsultation' => $onlineConsultation,
        ]);
        exit;
    }

    $petIds = booking_daily_pet_ids_for_booking(
        $pdo,
        (int)$booking['booking_id'],
        $booking['pet_id'] ?? null
    );
    booking_daily_lock_subjects(
        $pdo,
        $petIds,
        (int)($booking['user_id'] ?? 0),
        $booking['unregistered_pet_name'] ?? null
    );
    $dailyBookingConflict = booking_daily_find_conflict(
        $pdo,
        $petIds,
        $bookingDate,
        (int)$booking['booking_id'],
        (int)($booking['user_id'] ?? 0),
        $booking['unregistered_pet_name'] ?? null
    );
    if ($dailyBookingConflict) {
        $payload = booking_daily_conflict_payload($dailyBookingConflict);
        ipawcus_guard_error(409, $payload['message'], [
            'code' => $payload['code'],
            'conflict' => $payload['conflict'],
        ]);
    }

    if ($serviceKey !== 'boarding') {
        $specialServiceId = null;
        $slotVeterinarianId = $serviceKey === 'online-consultation' ? $veterinarianId : null;
        $slotLockName = booking_slot_lock_name(
            (int)$booking['branch_id'],
            $serviceKey,
            $bookingDate,
            $bookingTime,
            $slotVeterinarianId,
            $specialServiceId
        );
        if (!booking_slot_acquire($pdo, $slotLockName)) {
            throw new DomainException('This time is being reserved by another booking. Refresh the available times and try again.');
        }
        $slotConflict = booking_slot_find_conflict(
            $pdo,
            (int)$booking['branch_id'],
            $serviceKey,
            $bookingDate,
            $bookingTime,
            $slotVeterinarianId,
            $bookingId,
            $specialServiceId,
            true
        );
        if ($slotConflict) {
            throw new DomainException(booking_slot_conflict_message($serviceKey, $bookingTime));
        }
    }

    $notes = bookingStripLifecycleNotes($booking['notes'] ?? '', false);
    $notes = maintenance_append_original_booking_note_if_missing(
        array_merge($booking, ['notes' => $notes]),
        $notes
    );
    $notes = maintenance_append_note($notes, '[Rescheduled]');

    $update = $pdo->prepare("UPDATE bookings SET booking_date = ?, booking_time = ?, notes = ? WHERE booking_id = ?");
    $update->execute([
        $bookingDate,
        $bookingTime,
        $notes,
        $bookingId
    ]);

    $onlineConsultation = null;
    if ((int)$booking['is_online_consultation'] === 1 && $booking['status'] === 'confirmed') {
        $onlineConsultation = rescheduleOnlineConsultationForBooking(
            $pdo,
            $bookingId,
            $bookingDate,
            $bookingTime,
            $changedByUserId,
            $reason !== '' ? $reason : null
        );
    }

    $pdo->commit();
    booking_slot_release($pdo, $slotLockName);
    $slotLockName = null;

    if ((string)$oldBookingDate !== $bookingDate || (string)$oldBookingTime !== $bookingTime) {
        try {
            notification_send_booking_event($pdo, $bookingId, 'rescheduled', [
                'old_date' => $oldBookingDate,
                'old_time' => $oldBookingTime,
                'reason' => $reason,
            ]);
        } catch (Throwable $notificationError) {
            error_log('Booking schedule notification failed: ' . $notificationError->getMessage());
        }
    }

    echo json_encode([
        'message' => 'Booking rescheduled successfully.',
        'onlineConsultation' => $onlineConsultation,
    ]);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    booking_slot_release($pdo, $slotLockName);

    $statusCode = match (true) {
        $e instanceof InvalidArgumentException => 422,
        $e instanceof OutOfBoundsException => 404,
        $e instanceof DomainException => 409,
        default => 500,
    };
    http_response_code($statusCode);
    echo json_encode([
        'message' => $statusCode === 500
            ? 'Failed to reschedule booking.'
            : $e->getMessage(),
    ]);
}
