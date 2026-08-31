<?php
require_once __DIR__ . '/payment_method_helpers.php';

function booking_payment_table_exists(PDO $pdo, string $tableName): bool
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

function booking_payment_schema_ready(PDO $pdo): bool
{
    return booking_payment_table_exists($pdo, 'booking_payment_submissions');
}

function booking_payment_nullable_text($value): ?string
{
    $text = trim((string)($value ?? ''));
    return $text === '' ? null : $text;
}

function booking_payment_purpose(array $booking): string
{
    $serviceType = strtolower(trim((string)($booking['service_type'] ?? '')));
    if (
        (int)($booking['is_home_service'] ?? 0) === 1
        || in_array($serviceType, ['home-service', 'home_service', 'home service'], true)
    ) {
        return 'home_transport';
    }
    if ((int)($booking['is_online_consultation'] ?? 0) === 1) {
        return 'online_consultation';
    }

    return 'booking_payment';
}

function booking_payment_amount(array $booking): float
{
    if (booking_payment_purpose($booking) === 'home_transport') {
        return round(max(0.0, (float)($booking['transport_fee'] ?? 0)), 2);
    }

    return round(max(0.0, (float)($booking['price'] ?? 0)), 2);
}

function booking_payment_record_submission(PDO $pdo, array $booking): ?int
{
    if (!booking_payment_schema_ready($pdo)) {
        return null;
    }

    $bookingId = (int)($booking['booking_id'] ?? 0);
    $paymentMethod = strtolower(trim((string)($booking['payment_method'] ?? '')));
    $proofUrl = booking_payment_nullable_text($booking['payment_proof_url'] ?? null);
    $referenceNumber = booking_payment_nullable_text($booking['payment_reference'] ?? null);
    $amount = booking_payment_amount($booking);
    if (
        $bookingId <= 0
        || $proofUrl === null
        || $amount <= 0
        || !ipawcus_payment_method_is_allowed($pdo, $paymentMethod)
    ) {
        return null;
    }

    $existingStmt = $pdo->prepare("
        SELECT submission_id, submission_status, linked_visit_payment_id
        FROM booking_payment_submissions
        WHERE booking_id = ?
          AND purpose = ?
          AND submission_status NOT IN ('rejected', 'refunded', 'voided')
        ORDER BY submission_id DESC
        LIMIT 1
        FOR UPDATE
    ");
    $purpose = booking_payment_purpose($booking);
    $existingStmt->execute([$bookingId, $purpose]);
    $existing = $existingStmt->fetch(PDO::FETCH_ASSOC);
    if ($existing) {
        if (($existing['submission_status'] ?? '') === 'verified') {
            return (int)$existing['submission_id'];
        }
        $updateStmt = $pdo->prepare("
            UPDATE booking_payment_submissions
            SET amount = ?,
                payment_method = ?,
                reference_number = ?,
                proof_url = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE submission_id = ?
        ");
        $updateStmt->execute([
            $amount,
            $paymentMethod,
            $referenceNumber,
            $proofUrl,
            (int)$existing['submission_id'],
        ]);

        return (int)$existing['submission_id'];
    }

    $insertStmt = $pdo->prepare("
        INSERT INTO booking_payment_submissions (
            booking_id,
            purpose,
            amount,
            payment_method,
            reference_number,
            proof_url,
            submission_status,
            submitted_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'submitted', ?)
    ");
    $insertStmt->execute([
        $bookingId,
        $purpose,
        $amount,
        $paymentMethod,
        $referenceNumber,
        $proofUrl,
        booking_payment_nullable_text($booking['created_at'] ?? null) ?: date('Y-m-d H:i:s'),
    ]);

    return (int)$pdo->lastInsertId();
}

function booking_payment_find_matching_visit_payment(PDO $pdo, int $bookingId, array $submission): ?int
{
    if (!booking_payment_table_exists($pdo, 'visit_payments') || !booking_payment_table_exists($pdo, 'visits')) {
        return null;
    }

    $referenceNumber = booking_payment_nullable_text($submission['reference_number'] ?? null);
    $proofUrl = booking_payment_nullable_text($submission['proof_url'] ?? null);
    if ($referenceNumber === null && $proofUrl === null) {
        return null;
    }

    $where = [];
    $expectedAmount = round(max(0.0, (float)($submission['amount'] ?? 0)), 2);
    $params = [$bookingId, $submission['payment_method'], $expectedAmount];
    if ($referenceNumber !== null) {
        $where[] = 'vp.reference_number = ?';
        $params[] = $referenceNumber;
    }
    if ($proofUrl !== null) {
        $where[] = 'vp.proof_url = ?';
        $params[] = $proofUrl;
    }

    $stmt = $pdo->prepare("
        SELECT vp.payment_id
        FROM visit_payments vp
        JOIN visits v ON v.visit_id = vp.visit_id
        WHERE v.booking_id = ?
          AND vp.payment_method = ?
          AND ABS(vp.amount - ?) < 0.01
          AND vp.payment_status = 'verified'
          AND (" . implode(' OR ', $where) . ")
        ORDER BY vp.payment_id DESC
        LIMIT 1
        FOR UPDATE
    ");
    $stmt->execute($params);
    $paymentId = (int)($stmt->fetchColumn() ?: 0);

    return $paymentId > 0 ? $paymentId : null;
}

function booking_payment_find_visit_payment_by_credentials(
    PDO $pdo,
    int $bookingId,
    ?string $paymentMethod,
    ?string $referenceNumber,
    ?string $proofUrl
): ?int {
    if (
        $bookingId <= 0
        || !booking_payment_table_exists($pdo, 'visit_payments')
        || !booking_payment_table_exists($pdo, 'visits')
    ) {
        return null;
    }

    $paymentMethod = strtolower(trim((string)$paymentMethod));
    $referenceNumber = booking_payment_nullable_text($referenceNumber);
    $proofUrl = booking_payment_nullable_text($proofUrl);
    if (
        !ipawcus_payment_method_is_allowed($pdo, $paymentMethod)
        || ($referenceNumber === null && $proofUrl === null)
    ) {
        return null;
    }

    $matches = [];
    $params = [$bookingId, $paymentMethod];
    if ($referenceNumber !== null) {
        $matches[] = 'payment.reference_number = ?';
        $params[] = $referenceNumber;
    }
    if ($proofUrl !== null) {
        $matches[] = 'payment.proof_url = ?';
        $params[] = $proofUrl;
    }

    $stmt = $pdo->prepare("
        SELECT payment.payment_id
        FROM visit_payments payment
        JOIN visits visit_record ON visit_record.visit_id = payment.visit_id
        WHERE visit_record.booking_id = ?
          AND visit_record.visit_status <> 'cancelled'
          AND payment.payment_method = ?
          AND payment.payment_status = 'verified'
          AND (" . implode(' OR ', $matches) . ")
        ORDER BY payment.payment_id DESC
        LIMIT 1
        FOR UPDATE
    ");
    $stmt->execute($params);
    $paymentId = (int)($stmt->fetchColumn() ?: 0);

    return $paymentId > 0 ? $paymentId : null;
}

function booking_payment_conflict(string $message): void
{
    if (function_exists('visit_billing_error')) {
        visit_billing_error(409, $message);
    }
    if (function_exists('ipawcus_guard_error')) {
        ipawcus_guard_error(409, $message);
    }

    throw new RuntimeException($message);
}

function booking_payment_assert_verification_credentials_unique(
    PDO $pdo,
    int $bookingId,
    array $submission
): void {
    $submissionId = (int)($submission['submission_id'] ?? 0);
    $paymentMethod = strtolower(trim((string)($submission['payment_method'] ?? '')));
    $referenceNumber = booking_payment_nullable_text($submission['reference_number'] ?? null);
    $proofUrl = booking_payment_nullable_text($submission['proof_url'] ?? null);
    if ($submissionId <= 0 || ($referenceNumber === null && $proofUrl === null)) {
        return;
    }

    $matches = [];
    $params = [$submissionId, $bookingId];
    if ($referenceNumber !== null) {
        $matches[] = '(other.payment_method = ? AND other.reference_number = ?)';
        array_push($params, $paymentMethod, $referenceNumber);
    }
    if ($proofUrl !== null) {
        $matches[] = 'other.proof_url = ?';
        $params[] = $proofUrl;
    }
    $submissionStmt = $pdo->prepare("
        SELECT other.submission_id
        FROM booking_payment_submissions other
        WHERE other.submission_id <> ?
          AND other.booking_id <> ?
          AND other.submission_status IN ('verified', 'refunded')
          AND (" . implode(' OR ', $matches) . ")
        LIMIT 1
        FOR UPDATE
    ");
    $submissionStmt->execute($params);
    if ($submissionStmt->fetchColumn()) {
        booking_payment_conflict('This payment reference or proof has already been verified for another booking.');
    }

    if (!booking_payment_table_exists($pdo, 'visit_payments') || !booking_payment_table_exists($pdo, 'visits')) {
        return;
    }

    $visitMatches = [];
    $visitParams = [$bookingId];
    if ($referenceNumber !== null) {
        $visitMatches[] = '(payment.payment_method = ? AND payment.reference_number = ?)';
        array_push($visitParams, $paymentMethod, $referenceNumber);
    }
    if ($proofUrl !== null) {
        $visitMatches[] = 'payment.proof_url = ?';
        $visitParams[] = $proofUrl;
    }
    $visitPaymentStmt = $pdo->prepare("
        SELECT payment.payment_id
        FROM visit_payments payment
        JOIN visits visit_record ON visit_record.visit_id = payment.visit_id
        WHERE (visit_record.booking_id IS NULL OR visit_record.booking_id <> ?)
          AND payment.payment_status IN ('verified', 'refunded')
          AND (" . implode(' OR ', $visitMatches) . ")
        LIMIT 1
        FOR UPDATE
    ");
    $visitPaymentStmt->execute($visitParams);
    if ($visitPaymentStmt->fetchColumn()) {
        booking_payment_conflict('This payment reference or proof is already linked to another POS payment.');
    }
}

function booking_payment_verify_for_booking(
    PDO $pdo,
    int $bookingId,
    int $reviewedByUserId,
    ?string $reviewNotes = null
): ?int {
    if (!booking_payment_schema_ready($pdo)) {
        return null;
    }

    $bookingStmt = $pdo->prepare("SELECT * FROM bookings WHERE booking_id = ? LIMIT 1 FOR UPDATE");
    $bookingStmt->execute([$bookingId]);
    $booking = $bookingStmt->fetch(PDO::FETCH_ASSOC);
    if (!$booking) {
        return null;
    }

    $submissionId = booking_payment_record_submission($pdo, $booking);
    if ($submissionId === null) {
        return null;
    }

    $submissionStmt = $pdo->prepare("
        SELECT *
        FROM booking_payment_submissions
        WHERE submission_id = ?
        LIMIT 1
        FOR UPDATE
    ");
    $submissionStmt->execute([$submissionId]);
    $submission = $submissionStmt->fetch(PDO::FETCH_ASSOC);
    if (!$submission) {
        return null;
    }

    booking_payment_assert_verification_credentials_unique($pdo, $bookingId, $submission);

    $linkedPaymentId = booking_payment_find_matching_visit_payment($pdo, $bookingId, $submission);
    $verifiedAmount = (float)$submission['amount'];
    if ($linkedPaymentId !== null) {
        $paymentAmountStmt = $pdo->prepare("SELECT amount FROM visit_payments WHERE payment_id = ? LIMIT 1 FOR UPDATE");
        $paymentAmountStmt->execute([$linkedPaymentId]);
        $verifiedAmount = (float)$paymentAmountStmt->fetchColumn();
    }
    $updateStmt = $pdo->prepare("
        UPDATE booking_payment_submissions
        SET amount = ?,
            submission_status = 'verified',
            reviewed_at = COALESCE(reviewed_at, NOW()),
            reviewed_by_user_id = ?,
            review_notes = COALESCE(?, review_notes),
            linked_visit_payment_id = COALESCE(linked_visit_payment_id, ?)
        WHERE submission_id = ?
    ");
    $updateStmt->execute([
        $verifiedAmount,
        $reviewedByUserId,
        booking_payment_nullable_text($reviewNotes),
        $linkedPaymentId,
        $submissionId,
    ]);

    return $submissionId;
}

function booking_payment_apply_verified_to_visit(PDO $pdo, int $visitId, ?int $bookingId): array
{
    if ($bookingId === null || $bookingId <= 0 || !booking_payment_schema_ready($pdo)) {
        return [];
    }

    $submissionStmt = $pdo->prepare("
        SELECT *
        FROM booking_payment_submissions
        WHERE booking_id = ?
          AND submission_status = 'verified'
          AND linked_visit_payment_id IS NULL
        ORDER BY submission_id ASC
        FOR UPDATE
    ");
    $submissionStmt->execute([$bookingId]);
    $paymentIds = [];

    foreach ($submissionStmt->fetchAll(PDO::FETCH_ASSOC) as $submission) {
        $netSubmissionAmount = round(max(0.0, (float)$submission['amount']), 2);
        if (booking_payment_table_exists($pdo, 'booking_payment_refunds')) {
            $refundStmt = $pdo->prepare("
                SELECT COALESCE(SUM(amount), 0)
                FROM booking_payment_refunds
                WHERE booking_payment_submission_id = ?
                  AND refund_status = 'processed'
                FOR UPDATE
            ");
            $refundStmt->execute([(int)$submission['submission_id']]);
            $netSubmissionAmount = round(max(0.0, $netSubmissionAmount - (float)$refundStmt->fetchColumn()), 2);
        }
        if ($netSubmissionAmount <= 0.0001) {
            continue;
        }

        $submissionForMatch = $submission;
        $submissionForMatch['amount'] = $netSubmissionAmount;
        $matchingPaymentId = booking_payment_find_matching_visit_payment($pdo, $bookingId, $submissionForMatch);
        if ($matchingPaymentId !== null) {
            $linkStmt = $pdo->prepare("
                UPDATE booking_payment_submissions
                SET linked_visit_payment_id = ?
                WHERE submission_id = ?
                  AND linked_visit_payment_id IS NULL
            ");
            $linkStmt->execute([$matchingPaymentId, (int)$submission['submission_id']]);
            $paymentIds[] = $matchingPaymentId;
            continue;
        }

        $reviewedByActor = null;
        $reviewedByUserId = (int)($submission['reviewed_by_user_id'] ?? 0);
        if ($reviewedByUserId > 0 && function_exists('visit_billing_fetch_user')) {
            $reviewedByActor = visit_billing_fetch_user($pdo, $reviewedByUserId);
        }

        $paymentId = visit_billing_insert_payment_payload($pdo, $visitId, [
            'amount' => $netSubmissionAmount,
            'payment_method' => $submission['payment_method'],
            'reference_number' => booking_payment_nullable_text($submission['reference_number'] ?? null),
            'proof_url' => booking_payment_nullable_text($submission['proof_url'] ?? null),
            'notes' => 'Verified booking payment submission #' . (int)$submission['submission_id'],
            'paid_at' => $submission['reviewed_at'] ?? $submission['submitted_at'] ?? date('Y-m-d H:i:s'),
        ], $reviewedByActor);

        $linkStmt = $pdo->prepare("
            UPDATE booking_payment_submissions
            SET linked_visit_payment_id = ?
            WHERE submission_id = ?
              AND linked_visit_payment_id IS NULL
        ");
        $linkStmt->execute([$paymentId, (int)$submission['submission_id']]);
        $paymentIds[] = $paymentId;
    }

    return $paymentIds;
}
