<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/booking_maintenance.php';
require_once __DIR__ . '/booking_daily_guard.php';
require_once __DIR__ . '/online_consultation_helpers.php';
require_once __DIR__ . '/notification_helpers.php';
require_once __DIR__ . '/phone_number_helpers.php';
require_once __DIR__ . '/workflow_guard_helpers.php';
require_once __DIR__ . '/branch_helpers.php';
require_once __DIR__ . '/booking_payment_helpers.php';
require_once __DIR__ . '/booking_slot_helpers.php';
if (!defined('VISIT_BILLING_HELPERS_ONLY')) {
    define('VISIT_BILLING_HELPERS_ONLY', true);
}
require_once __DIR__ . '/visit_billing.php';

header("Content-Type: application/json");

function booking_status_column_exists(PDO $pdo, string $columnName): bool
{
    $stmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 'bookings'
          AND column_name = ?
    ");
    $stmt->execute([$columnName]);

    return (int)$stmt->fetchColumn() > 0;
}

function booking_status_ensure_payment_columns(PDO $pdo): void
{
    ipawcus_guard_require_columns($pdo, 'bookings', [
        'payment_proof_url',
        'payment_method',
        'payment_reference',
    ]);
}

function booking_status_service_key(array $booking): string
{
    return booking_slot_service_key(
        $booking['service_type'] ?? null,
        $booking['is_home_service'] ?? 0,
        $booking['is_online_consultation'] ?? 0
    );
}

function booking_status_is_deceased_pet(?string $status): bool
{
    return in_array(strtolower(trim((string)$status)), ['deceased', 'dead'], true);
}

function booking_status_pet_ids(PDO $pdo, array $booking): array
{
    $petIds = [];
    if (!empty($booking['pet_id'])) {
        $petIds[] = (int)$booking['pet_id'];
    }

    if (ipawcus_guard_table_exists($pdo, 'booking_pets')) {
        $stmt = $pdo->prepare("SELECT pet_id FROM booking_pets WHERE booking_id = ?");
        $stmt->execute([(int)$booking['booking_id']]);
        foreach ($stmt->fetchAll(PDO::FETCH_COLUMN) as $petId) {
            $petIds[] = (int)$petId;
        }
    }

    return array_values(array_unique(array_filter($petIds, fn($petId) => $petId > 0)));
}

function booking_status_has_online_vet_conflict(PDO $pdo, array $booking): bool
{
    $vetId = (int)($booking['veterinarian_id'] ?? 0);
    if ($vetId <= 0 || empty($booking['booking_date']) || empty($booking['booking_time'])) {
        return false;
    }

    $timezone = new DateTimeZone('Asia/Manila');
    $requestedStart = DateTimeImmutable::createFromFormat('!Y-m-d H:i:s', $booking['booking_date'] . ' ' . $booking['booking_time'], $timezone);
    if (!$requestedStart) {
        return true;
    }

    $stmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM bookings
        WHERE is_online_consultation = 1
          AND veterinarian_id = ?
          AND booking_date = ?
          AND booking_time < ?
          AND ADDTIME(booking_time, '01:00:00') > ?
          AND status IN ('pending', 'confirmed')
          AND booking_id <> ?
    ");
    $stmt->execute([
        $vetId,
        $booking['booking_date'],
        $requestedStart->modify('+1 hour')->format('H:i:s'),
        $requestedStart->format('H:i:s'),
        (int)$booking['booking_id'],
    ]);

    return (int)$stmt->fetchColumn() > 0;
}

function booking_status_home_service_limit_conflict(PDO $pdo, array $booking): ?string
{
    if (booking_status_service_key($booking) !== 'home-service') {
        return null;
    }

    $countStmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM bookings
        WHERE booking_date = ?
          AND status IN ('pending', 'confirmed')
          AND (is_home_service = 1 OR service_type = 'home-service')
          AND booking_id <> ?
    ");
    $countStmt->execute([$booking['booking_date'], (int)$booking['booking_id']]);
    if ((int)$countStmt->fetchColumn() >= 2) {
        return 'Home service accepts only two active bookings per day.';
    }

    if (($booking['booking_time'] ?? '') >= '12:00:00') {
        $petCountExpression = ipawcus_guard_table_exists($pdo, 'booking_pets')
            ? "COALESCE(bp.pet_count, CASE WHEN b.pet_id IS NOT NULL OR TRIM(COALESCE(b.unregistered_pet_name, '')) <> '' THEN 1 ELSE 0 END)"
            : "CASE WHEN b.pet_id IS NOT NULL OR TRIM(COALESCE(b.unregistered_pet_name, '')) <> '' THEN 1 ELSE 0 END";
        $petCountJoin = ipawcus_guard_table_exists($pdo, 'booking_pets')
            ? "LEFT JOIN (SELECT booking_id, COUNT(*) AS pet_count FROM booking_pets GROUP BY booking_id) bp ON bp.booking_id = b.booking_id"
            : '';
        $petCountStmt = $pdo->prepare("
            SELECT COALESCE(SUM({$petCountExpression}), 0)
            FROM bookings b
            {$petCountJoin}
            WHERE b.booking_date = ?
              AND b.booking_time >= '12:00:00'
              AND b.status IN ('pending', 'confirmed')
              AND (b.is_home_service = 1 OR b.service_type = 'home-service')
              AND b.booking_id <> ?
        ");
        $petCountStmt->execute([$booking['booking_date'], (int)$booking['booking_id']]);
        if ((int)$petCountStmt->fetchColumn() >= 3) {
            return 'Afternoon home service has no remaining pet slots for this date.';
        }
    }

    return null;
}

function booking_status_revalidate_confirmation(PDO $pdo, array $booking): void
{
    if (($booking['status'] ?? '') !== 'pending') {
        ipawcus_guard_error(409, 'Only pending bookings can be confirmed.');
    }

    if (booking_status_is_deceased_pet($booking['pet_status'] ?? null)) {
        ipawcus_guard_error(409, 'This booking cannot be confirmed because the selected pet is marked deceased.');
    }

    $serviceKey = booking_status_service_key($booking);
    try {
        $branchResolution = branch_resolve_booking(
            $pdo,
            $booking['branch_id'] ?? null,
            $booking['service_type'] ?? null,
            $booking['is_home_service'] ?? 0,
            $booking['is_online_consultation'] ?? 0,
            (string)($booking['booking_date'] ?? ''),
            (string)($booking['booking_time'] ?? ''),
            is_numeric($booking['veterinarian_id'] ?? null) ? (int)$booking['veterinarian_id'] : null
        );
        if ((int)$branchResolution['branch_id'] !== (int)($booking['branch_id'] ?? 0)) {
            ipawcus_guard_error(409, 'Relocate this booking to the required branch before confirming it.');
        }
    } catch (InvalidArgumentException $e) {
        ipawcus_guard_error(409, $e->getMessage());
    }
    $requiresConsent = in_array($serviceKey, ['home-service', 'online-consultation', 'boarding'], true);
    if ($requiresConsent && empty($booking['signature_path']) && strtolower((string)($booking['consent_status'] ?? '')) !== 'signed') {
        ipawcus_guard_error(409, 'Required owner consent is missing for this booking.');
    }

    if (in_array($serviceKey, ['home-service', 'online-consultation'], true)) {
        $requiredPayment = $serviceKey === 'home-service'
            ? (float)($booking['transport_fee'] ?? 0)
            : (float)($booking['price'] ?? 0);
        $paymentMethod = strtolower(trim((string)($booking['payment_method'] ?? '')));
        $hasReviewableProof = !empty($booking['payment_proof_url'])
            && ipawcus_payment_method_is_allowed($pdo, $paymentMethod, false);
        $verifiedPosAmount = 0.0;

        if (
            $requiredPayment > 0
            && booking_payment_table_exists($pdo, 'visits')
            && booking_payment_table_exists($pdo, 'visit_payments')
        ) {
            $refundJoin = booking_payment_table_exists($pdo, 'visit_payment_refunds')
                ? "LEFT JOIN (
                    SELECT visit_payment_id AS payment_id, SUM(amount) AS refunded_amount
                    FROM visit_payment_refunds
                    WHERE refund_status = 'processed'
                    GROUP BY visit_payment_id
                ) payment_refunds ON payment_refunds.payment_id = payment.payment_id"
                : '';
            $refundAmount = booking_payment_table_exists($pdo, 'visit_payment_refunds')
                ? 'COALESCE(payment_refunds.refunded_amount, 0)'
                : '0';
            $verifiedPaymentStmt = $pdo->prepare("
                SELECT COALESCE(SUM(payment.amount - {$refundAmount}), 0)
                FROM visits visit_record
                JOIN visit_payments payment ON payment.visit_id = visit_record.visit_id
                {$refundJoin}
                WHERE visit_record.booking_id = ?
                  AND visit_record.visit_status <> 'cancelled'
                  AND payment.payment_status IN ('verified', 'refunded')
            ");
            $verifiedPaymentStmt->execute([(int)$booking['booking_id']]);
            $verifiedPosAmount = max(0.0, (float)$verifiedPaymentStmt->fetchColumn());
        }

        if ($requiredPayment > 0 && !$hasReviewableProof && $verifiedPosAmount + 0.0001 < $requiredPayment) {
            ipawcus_guard_error(
                409,
                $serviceKey === 'home-service'
                    ? 'Review the PHP 50 home-service transport proof or post its payment in Point-Of-Sale before confirming this booking.'
                    : 'Review the online consultation payment proof or post its payment in Point-Of-Sale before confirming this booking.'
            );
        }
    }

    $timezone = new DateTimeZone('Asia/Manila');
    $bookingDateTime = DateTimeImmutable::createFromFormat('!Y-m-d H:i:s', $booking['booking_date'] . ' ' . $booking['booking_time'], $timezone);
    if (!$bookingDateTime || ($serviceKey !== 'boarding' && $bookingDateTime < new DateTimeImmutable('now', $timezone))) {
        ipawcus_guard_error(409, 'Booking date and time are no longer valid.');
    }

    $petIds = booking_status_pet_ids($pdo, $booking);
    booking_daily_lock_subjects(
        $pdo,
        $petIds,
        (int)($booking['user_id'] ?? 0),
        $booking['unregistered_pet_name'] ?? null
    );
    $dailyBookingConflict = booking_daily_find_conflict(
        $pdo,
        $petIds,
        (string)$booking['booking_date'],
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
        try {
            $normalizedTime = booking_slot_assert_aligned($serviceKey, (string)($booking['booking_time'] ?? ''));
        } catch (InvalidArgumentException $e) {
            ipawcus_guard_error(409, $e->getMessage());
        }
        $veterinarianId = $serviceKey === 'online-consultation'
            ? (int)($booking['veterinarian_id'] ?? 0)
            : null;
        if ($serviceKey === 'online-consultation'
            && ($veterinarianId <= 0 || !booking_slot_online_vet_is_available(
                $pdo,
                $veterinarianId,
                (string)$booking['booking_date'],
                $normalizedTime
            ))) {
            ipawcus_guard_error(409, 'That veterinarian has not made this online consultation time available. Select another date or time.');
        }

        $specialServiceId = null;
        $slotConflict = booking_slot_find_conflict(
            $pdo,
            (int)($booking['branch_id'] ?? 0),
            $serviceKey,
            (string)$booking['booking_date'],
            $normalizedTime,
            $veterinarianId,
            (int)$booking['booking_id'],
            $specialServiceId,
            true
        );
        if ($slotConflict) {
            ipawcus_guard_error(409, booking_slot_conflict_message($serviceKey, $normalizedTime));
        }
    }
}

if ($_SERVER['REQUEST_METHOD'] !== 'PATCH') {
    http_response_code(405);
    echo json_encode(['message' => 'Method not allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$bookingId = $_GET['bookingId'] ?? null;
$status = isset($input['status']) ? strtolower(trim((string)$input['status'])) : null;
$cancellationMessage = trim((string)($input['cancellation_message'] ?? ''));
$walletNumber = trim((string)($input['wallet_number'] ?? ''));
$transactionNumber = trim((string)($input['transaction_number'] ?? ''));
$reviewServiceType = trim((string)($input['service_type'] ?? $input['serviceType'] ?? ''));
$hasReviewNotes = array_key_exists('review_notes', $input) || array_key_exists('notes', $input);
$reviewNotes = trim((string)($input['review_notes'] ?? $input['notes'] ?? ''));
$hasPaymentProof = array_key_exists('payment_proof_url', $input) || array_key_exists('paymentProofUrl', $input);
$paymentProofUrl = trim((string)($input['payment_proof_url'] ?? $input['paymentProofUrl'] ?? ''));
$paymentProofUrl = $paymentProofUrl !== '' ? $paymentProofUrl : null;
$hasPaymentMethod = array_key_exists('payment_method', $input) || array_key_exists('paymentMethod', $input);
$paymentMethod = ipawcus_payment_method_key($input['payment_method'] ?? $input['paymentMethod'] ?? '');
$paymentMethod = ipawcus_payment_method_is_allowed($pdo, $paymentMethod) ? $paymentMethod : null;
$hasPaymentReference = array_key_exists('payment_reference', $input) || array_key_exists('paymentReference', $input);
$paymentReference = trim((string)($input['payment_reference'] ?? $input['paymentReference'] ?? ''));
$paymentReference = $paymentReference !== '' ? $paymentReference : null;
$hasPaymentUpdate = $hasPaymentProof || $hasPaymentMethod || $hasPaymentReference;
$hasReviewUpdate = $reviewServiceType !== '' || $hasReviewNotes;

if ($transactionNumber !== '' && !preg_match('/^\d{18}$/', $transactionNumber)) {
    http_response_code(422);
    echo json_encode(['message' => 'Transaction number must contain exactly 18 digits.']);
    exit;
}

if ($paymentReference !== null && !preg_match('/^\d{18}$/', $paymentReference)) {
    http_response_code(422);
    echo json_encode(['message' => 'Payment transaction number must contain exactly 18 digits.']);
    exit;
}

if (!$bookingId || !$status) {
    http_response_code(400);
    echo json_encode(['message' => 'Booking ID and Status are required.']);
    exit;
}

$allowedBookingStatuses = ['pending', 'confirmed', 'completed', 'cancelled'];
if (!in_array($status, $allowedBookingStatuses, true)) {
    http_response_code(400);
    echo json_encode([
        'message' => 'Invalid booking status.',
        'allowedStatuses' => $allowedBookingStatuses
    ]);
    exit;
}

$walletNumber = rejectInvalidPhilippinePhoneNumber($walletNumber, 'Wallet number', true);

if ($status === 'completed') {
    http_response_code(409);
    echo json_encode([
        'message' => 'Bookings can only be completed by the matching service completion workflow so billing and service status stay consistent.'
    ]);
    exit;
}

try {
    runLifecycleMaintenance($pdo);
    $currentApiUser = ipawcus_guard_current_user($pdo);
    $currentApiRole = ipawcus_guard_role($currentApiUser);
    $currentApiUserId = ipawcus_guard_user_id($currentApiUser);
    $currentApiIsAdmin = ipawcus_guard_is_admin_role($currentApiRole);

    if (!$currentApiIsAdmin) {
        if ($status !== 'cancelled') {
            ipawcus_guard_error(403, 'Only authorized admin users can confirm bookings or change non-cancellation statuses.');
        }

        if ($hasPaymentUpdate || $hasReviewUpdate) {
            ipawcus_guard_error(403, 'Only authorized admin users can update booking payment or review details.');
        }
    }

    if ($hasPaymentUpdate) {
        booking_status_ensure_payment_columns($pdo);
    }

    $pdo->beginTransaction();
    $onlineConsultation = null;

    if ($status === 'confirmed') {
        $subjectStmt = $pdo->prepare("
            SELECT booking_id, user_id, pet_id, unregistered_pet_name
            FROM bookings
            WHERE booking_id = ?
            LIMIT 1
        ");
        $subjectStmt->execute([$bookingId]);
        $bookingSubject = $subjectStmt->fetch(PDO::FETCH_ASSOC);
        if (!$bookingSubject) {
            throw new Exception('Booking not found.');
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
    }

    $bookingStmt = $pdo->prepare("
        SELECT b.*, p.pet_status
        FROM bookings b
        LEFT JOIN pets_information p ON p.pet_id = b.pet_id
        WHERE b.booking_id = ?
        LIMIT 1
        FOR UPDATE
    ");
    $bookingStmt->execute([$bookingId]);
    $booking = $bookingStmt->fetch(PDO::FETCH_ASSOC);

    if (!$booking) {
        throw new Exception('Booking not found.');
    }

    if (
        $currentApiRole === 'admin'
        && $booking['status'] !== 'pending'
        && !branch_user_can_access($pdo, $currentApiUser, (int)($booking['branch_id'] ?? 0))
    ) {
        ipawcus_guard_error(403, 'This booking belongs to another branch.');
    }

    $effectiveStatus = ($booking['status'] === 'completed' && $status === 'confirmed' && $hasPaymentUpdate)
        ? 'completed'
        : $status;

    if (!$currentApiIsAdmin && !ipawcus_guard_booking_access($pdo, (int)$bookingId, $currentApiUserId)) {
        ipawcus_guard_error(403, 'You are not allowed to cancel this booking.');
    }

    ipawcus_guard_validate_booking_transition((string)$booking['status'], (string)$effectiveStatus, false);

    if (!$currentApiIsAdmin) {
        if ($status !== 'cancelled' || $effectiveStatus !== 'cancelled') {
            ipawcus_guard_error(403, 'Only authorized admin users can confirm bookings or change non-cancellation statuses.');
        }

        if ($hasPaymentUpdate || $hasReviewUpdate) {
            ipawcus_guard_error(403, 'Only authorized admin users can update booking payment or review details.');
        }
    }

    if ($hasReviewUpdate && in_array($booking['status'], ['confirmed', 'cancelled'], true)) {
        http_response_code(409);
        throw new Exception('Confirmed or cancelled bookings cannot have their service review edited.');
    }

    if ($hasReviewUpdate) {
        $fields = [];
        $values = [];

        if ($reviewServiceType !== '') {
            $isOnlineConsultation = booking_status_service_key($booking) === 'online-consultation';
            if (
                $isOnlineConsultation
                && !in_array(strtolower($reviewServiceType), ['consultation', 'online-consultation'], true)
            ) {
                ipawcus_guard_error(409, 'Online consultation bookings cannot be converted to another service during review.');
            }

            if (!$isOnlineConsultation) {
                $fields[] = 'service_type = ?';
                $values[] = $reviewServiceType;
                $booking['service_type'] = $reviewServiceType;
            }
        }

        if ($hasReviewNotes) {
            $fields[] = 'notes = ?';
            $values[] = bookingMergeReviewNotesPreservingMetadata(
                $booking['notes'] ?? '',
                $reviewNotes
            );
        }

        if (!empty($fields)) {
            $values[] = $bookingId;
            $reviewStmt = $pdo->prepare("UPDATE bookings SET " . implode(', ', $fields) . " WHERE booking_id = ?");
            $reviewStmt->execute($values);
        }
    }

    if ($effectiveStatus === 'confirmed') {
        booking_status_revalidate_confirmation($pdo, $booking);
    }

    if ($status === 'cancelled' && ($cancellationMessage !== '' || $walletNumber !== '' || $transactionNumber !== '')) {
        $notesStmt = $pdo->prepare("SELECT notes FROM bookings WHERE booking_id = ? LIMIT 1");
        $notesStmt->execute([$bookingId]);
        $currentNotes = (string)($notesStmt->fetchColumn() ?: '');

        $parts = ['[Cancellation Request]'];
        if ($cancellationMessage !== '') {
            $parts[] = 'Message: ' . $cancellationMessage;
        }
        if ($walletNumber !== '') {
            $parts[] = 'Wallet Number: ' . $walletNumber;
        }
        if ($transactionNumber !== '') {
            $parts[] = 'Transaction Number: ' . $transactionNumber;
        }
        $parts[] = 'Recorded At: ' . date('Y-m-d H:i:s');

        $updatedNotes = trim($currentNotes !== '' ? $currentNotes . "\n\n" . implode("\n", $parts) : implode("\n", $parts));
        $fields = ['status = ?', 'notes = ?'];
        $values = [$effectiveStatus, $updatedNotes];
        if ($hasPaymentProof) {
            $fields[] = 'payment_proof_url = ?';
            $values[] = $paymentProofUrl;
        }
        if ($hasPaymentMethod) {
            $fields[] = 'payment_method = ?';
            $values[] = $paymentMethod;
        }
        if ($hasPaymentReference) {
            $fields[] = 'payment_reference = ?';
            $values[] = $paymentReference;
        }
        $values[] = $bookingId;
        $stmt = $pdo->prepare("UPDATE bookings SET " . implode(', ', $fields) . " WHERE booking_id = ?");
        $stmt->execute($values);
    } else {
        $fields = ['status = ?'];
        $values = [$effectiveStatus];
        if ($hasPaymentProof) {
            $fields[] = 'payment_proof_url = ?';
            $values[] = $paymentProofUrl;
        }
        if ($hasPaymentMethod) {
            $fields[] = 'payment_method = ?';
            $values[] = $paymentMethod;
        }
        if ($hasPaymentReference) {
            $fields[] = 'payment_reference = ?';
            $values[] = $paymentReference;
        }
        $values[] = $bookingId;
        $stmt = $pdo->prepare("UPDATE bookings SET " . implode(', ', $fields) . " WHERE booking_id = ?");
        $stmt->execute($values);
    }

    if ($effectiveStatus === 'confirmed') {
        $onlineConsultation = createOnlineConsultationForBooking($pdo, (int)$bookingId);
        $latestBookingStmt = $pdo->prepare("SELECT * FROM bookings WHERE booking_id = ? LIMIT 1 FOR UPDATE");
        $latestBookingStmt->execute([(int)$bookingId]);
        $latestBooking = $latestBookingStmt->fetch(PDO::FETCH_ASSOC) ?: [];
        if (!empty($latestBooking['payment_proof_url'])) {
            $matchingPosPaymentId = booking_payment_find_visit_payment_by_credentials(
                $pdo,
                (int)$bookingId,
                $latestBooking['payment_method'] ?? null,
                $latestBooking['payment_reference'] ?? null,
                $latestBooking['payment_proof_url'] ?? null
            );
            if ($matchingPosPaymentId === null) {
                if (!booking_payment_schema_ready($pdo)) {
                    ipawcus_guard_error(
                        409,
                        'Payment review is not installed. Run DDL/20260808_01_payment_integrity.sql before confirming prepaid bookings.'
                    );
                }
                booking_payment_verify_for_booking(
                    $pdo,
                    (int)$bookingId,
                    $currentApiUserId,
                    $reviewNotes !== '' ? $reviewNotes : 'Verified during booking confirmation.'
                );

                // A visit can already exist when an administrator reviews the
                // owner's proof. Link the verified submission only when that
                // visit already has an invoice; otherwise visit creation will
                // apply it after the official charges have been saved.
                $billableVisitStmt = $pdo->prepare("
                    SELECT v.visit_id
                    FROM visits v
                    WHERE v.booking_id = ?
                      AND v.visit_status <> 'cancelled'
                      AND EXISTS (
                          SELECT 1
                          FROM visit_charges vc
                          WHERE vc.visit_id = v.visit_id
                      )
                    ORDER BY v.visit_id DESC
                    LIMIT 1
                    FOR UPDATE
                ");
                $billableVisitStmt->execute([(int)$bookingId]);
                $billableVisitId = (int)($billableVisitStmt->fetchColumn() ?: 0);
                if ($billableVisitId > 0) {
                    booking_payment_apply_verified_to_visit($pdo, $billableVisitId, (int)$bookingId);
                }
            }
        }
    } elseif ($effectiveStatus === 'cancelled') {
        cancelOnlineConsultationForBooking($pdo, (int)$bookingId);
    }

    $previousStatus = $booking['status'];

    $pdo->commit();

    if ($effectiveStatus !== $previousStatus && in_array($effectiveStatus, ['confirmed', 'cancelled'], true)) {
        try {
            notification_send_booking_event($pdo, (int)$bookingId, $effectiveStatus === 'confirmed' ? 'confirmed' : 'cancelled', [
                'cancellation_message' => $cancellationMessage,
                'wallet_number' => $walletNumber,
                'transaction_number' => $transactionNumber,
            ]);
        } catch (Throwable $notificationError) {
            error_log('Booking notification failed: ' . $notificationError->getMessage());
        }
    }

    echo json_encode([
        'message' => 'Booking status updated successfully.',
        'onlineConsultation' => $onlineConsultation
    ]);
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    if (http_response_code() < 400) {
        http_response_code(500);
    }
    echo json_encode(['message' => 'Failed to update booking status: ' . $e->getMessage()]);
}
