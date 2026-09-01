<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/workflow_guard_helpers.php';
require_once __DIR__ . '/branch_helpers.php';
require_once __DIR__ . '/booking_payment_helpers.php';
require_once __DIR__ . '/notification_helpers.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    ipawcus_guard_error(405, 'Method not allowed.');
}
if (!booking_payment_schema_ready($pdo) || !booking_payment_table_exists($pdo, 'booking_payment_refunds')) {
    ipawcus_guard_error(409, 'Run DDL/20260808_01_payment_integrity.sql before recording booking refunds.');
}

$bookingId = isset($_GET['bookingId']) ? (int)$_GET['bookingId'] : 0;
$input = json_decode(file_get_contents('php://input'), true) ?: [];
$amount = round((float)($input['amount'] ?? 0), 2);
$reason = booking_payment_nullable_text($input['reason'] ?? null);
if ($bookingId <= 0 || $amount <= 0 || $reason === null) {
    ipawcus_guard_error(400, 'Booking, positive refund amount, and reason are required.');
}
if (strlen($reason) > 500) {
    ipawcus_guard_error(400, 'Refund reason must be 500 characters or fewer.');
}

$actor = ipawcus_guard_current_user($pdo);
$actorUserId = ipawcus_guard_user_id($actor);
$refundMethod = ipawcus_payment_method_key($input['refund_method'] ?? $input['refundMethod'] ?? '');
if (!ipawcus_payment_method_is_allowed($pdo, $refundMethod)) {
    ipawcus_guard_error(400, 'Select a valid refund method.');
}
$referenceNumber = booking_payment_nullable_text($input['reference_number'] ?? $input['referenceNumber'] ?? null);
if ($refundMethod !== 'cash' && $referenceNumber === null) {
    ipawcus_guard_error(400, 'A refund reference number is required for non-cash refunds.');
}
if ($referenceNumber !== null && !preg_match('/^\d{18}$/', $referenceNumber)) {
    ipawcus_guard_error(400, 'Refund transaction number must contain exactly 18 digits.');
}

$pdo->beginTransaction();
try {
    $submissionId = isset($input['submission_id']) ? (int)$input['submission_id'] : (int)($input['submissionId'] ?? 0);
    $submissionWhere = $submissionId > 0 ? 'AND submission.submission_id = ?' : '';
    $submissionParams = $submissionId > 0 ? [$bookingId, $submissionId] : [$bookingId];
    $submissionStmt = $pdo->prepare("
        SELECT
            submission.*,
            booking.branch_id,
            booking.booking_number
        FROM booking_payment_submissions submission
        JOIN bookings booking ON booking.booking_id = submission.booking_id
        WHERE submission.booking_id = ?
          {$submissionWhere}
          AND submission.submission_status IN ('verified', 'refunded')
        ORDER BY submission.submission_id DESC
        LIMIT 1
        FOR UPDATE
    ");
    $submissionStmt->execute($submissionParams);
    $submission = $submissionStmt->fetch(PDO::FETCH_ASSOC);
    if (!$submission) {
        ipawcus_guard_error(404, 'A verified booking payment was not found.');
    }
    if (!empty($submission['linked_visit_payment_id'])) {
        ipawcus_guard_error(409, 'This booking payment is already linked to a visit invoice. Record its refund in Point-Of-Sale.');
    }
    if (!branch_user_can_access($pdo, $actor, (int)$submission['branch_id'])) {
        ipawcus_guard_error(403, 'You cannot refund a payment from another clinic location.');
    }

    $refundStmt = $pdo->prepare("
        SELECT amount
        FROM booking_payment_refunds
        WHERE booking_payment_submission_id = ?
          AND refund_status = 'processed'
        FOR UPDATE
    ");
    $refundStmt->execute([(int)$submission['submission_id']]);
    $alreadyRefunded = round(array_sum(array_map('floatval', $refundStmt->fetchAll(PDO::FETCH_COLUMN))), 2);
    $refundable = round((float)$submission['amount'] - $alreadyRefunded, 2);
    if ($refundable <= 0.0001) {
        ipawcus_guard_error(409, 'This booking payment has already been fully refunded.');
    }
    if ($amount - $refundable > 0.0001) {
        ipawcus_guard_error(409, 'Refund exceeds the refundable amount of PHP ' . number_format($refundable, 2, '.', ',') . '.');
    }

    $actorName = trim((string)($actor['full_name'] ?? $actor['name'] ?? '')) ?: 'Clinic Admin';
    $insertStmt = $pdo->prepare("
        INSERT INTO booking_payment_refunds (
            booking_payment_submission_id,
            booking_id,
            amount,
            refund_method,
            reference_number,
            reason,
            refund_status,
            processed_at,
            processed_by_user_id,
            processed_by_name
        ) VALUES (?, ?, ?, ?, ?, ?, 'processed', NOW(), ?, ?)
    ");
    $insertStmt->execute([
        (int)$submission['submission_id'],
        $bookingId,
        $amount,
        $refundMethod,
        $referenceNumber,
        $reason,
        $actorUserId,
        $actorName,
    ]);
    $refundId = (int)$pdo->lastInsertId();
    $fullyRefunded = $amount + $alreadyRefunded + 0.0001 >= (float)$submission['amount'];
    if ($fullyRefunded) {
        $statusStmt = $pdo->prepare("
            UPDATE booking_payment_submissions
            SET submission_status = 'refunded',
                review_notes = CONCAT_WS(' | ', NULLIF(review_notes, ''), ?)
            WHERE submission_id = ?
        ");
        $statusStmt->execute(['Fully refunded through booking refund #' . $refundId, (int)$submission['submission_id']]);
    }

    $pdo->commit();

    try {
        notification_send_booking_event($pdo, $bookingId, 'payment_refunded', [
            'amount' => $amount,
            'reason' => $reason,
        ]);
    } catch (Throwable $notificationError) {
        error_log('Booking refund notification failed: ' . $notificationError->getMessage());
    }

    echo json_encode([
        'success' => true,
        'message' => 'Booking payment refund recorded.',
        'refundId' => $refundId,
        'refundableAmount' => round(max(0, $refundable - $amount), 2),
        'fullyRefunded' => $fullyRefunded,
    ]);
} catch (PDOException $error) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    if ((string)$error->getCode() === '23000') {
        ipawcus_guard_error(409, 'This refund reference has already been used.');
    }
    ipawcus_guard_error(500, 'Failed to record booking refund: ' . $error->getMessage());
} catch (Throwable $error) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    ipawcus_guard_error(500, 'Failed to record booking refund: ' . $error->getMessage());
}
