<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/workflow_guard_helpers.php';
require_once __DIR__ . '/branch_helpers.php';
require_once __DIR__ . '/booking_payment_helpers.php';

if (!defined('VISIT_BILLING_HELPERS_ONLY')) {
    define('VISIT_BILLING_HELPERS_ONLY', true);
}
require_once __DIR__ . '/visit_billing.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    ipawcus_guard_error(405, 'Method not allowed.');
}
if (!booking_payment_schema_ready($pdo)) {
    ipawcus_guard_error(409, 'Run DDL/20260808_01_payment_integrity.sql before reviewing booking payments.');
}

$bookingId = isset($_GET['bookingId']) ? (int)$_GET['bookingId'] : 0;
$input = json_decode(file_get_contents('php://input'), true) ?: [];
$reviewNotes = booking_payment_nullable_text($input['review_notes'] ?? $input['reviewNotes'] ?? null);
if ($bookingId <= 0) {
    ipawcus_guard_error(400, 'Booking ID is required.');
}
if ($reviewNotes !== null && strlen($reviewNotes) > 500) {
    ipawcus_guard_error(400, 'Payment review notes must be 500 characters or fewer.');
}

$actor = ipawcus_guard_current_user($pdo);
$actorRole = ipawcus_guard_role($actor);
$actorUserId = ipawcus_guard_user_id($actor);
if (!ipawcus_guard_is_admin_role($actorRole)) {
    ipawcus_guard_error(403, 'Only authorized admin users can verify booking payments.');
}

$pdo->beginTransaction();
try {
    $bookingStmt = $pdo->prepare("
        SELECT *
        FROM bookings
        WHERE booking_id = ?
        LIMIT 1
        FOR UPDATE
    ");
    $bookingStmt->execute([$bookingId]);
    $booking = $bookingStmt->fetch(PDO::FETCH_ASSOC);
    if (!$booking) {
        ipawcus_guard_error(404, 'Booking was not found.');
    }

    if (
        $actorRole === 'admin'
        && strtolower((string)($booking['status'] ?? '')) !== 'pending'
        && !branch_user_can_access($pdo, $actor, (int)($booking['branch_id'] ?? 0))
    ) {
        ipawcus_guard_error(403, 'This booking belongs to another branch.');
    }

    $latestSubmissionStmt = $pdo->prepare("
        SELECT submission_id, submission_status
        FROM booking_payment_submissions
        WHERE booking_id = ?
        ORDER BY submission_id DESC
        LIMIT 1
        FOR UPDATE
    ");
    $latestSubmissionStmt->execute([$bookingId]);
    $latestSubmission = $latestSubmissionStmt->fetch(PDO::FETCH_ASSOC);
    $latestStatus = strtolower((string)($latestSubmission['submission_status'] ?? ''));

    if ($latestStatus === 'refunded') {
        ipawcus_guard_error(409, 'This booking payment was already refunded and cannot be verified again.');
    }
    if (in_array($latestStatus, ['rejected', 'voided'], true)) {
        ipawcus_guard_error(409, 'This booking payment proof was rejected or voided. A new proof is required.');
    }

    $alreadyVerified = $latestStatus === 'verified';
    $submissionId = $alreadyVerified
        ? (int)$latestSubmission['submission_id']
        : booking_payment_verify_for_booking(
            $pdo,
            $bookingId,
            $actorUserId,
            $reviewNotes ?: 'Verified from Booking Management.'
        );

    if (!$submissionId) {
        ipawcus_guard_error(409, 'This booking has no reviewable payment proof or positive prepaid amount.');
    }

    $linkedVisitPaymentIds = [];
    if (!$alreadyVerified && booking_payment_table_exists($pdo, 'visits') && booking_payment_table_exists($pdo, 'visit_charges')) {
        $billableVisitStmt = $pdo->prepare("
            SELECT visit_record.visit_id
            FROM visits visit_record
            WHERE visit_record.booking_id = ?
              AND visit_record.visit_status <> 'cancelled'
              AND EXISTS (
                  SELECT 1
                  FROM visit_charges charge
                  WHERE charge.visit_id = visit_record.visit_id
              )
            ORDER BY visit_record.visit_id DESC
            LIMIT 1
            FOR UPDATE
        ");
        $billableVisitStmt->execute([$bookingId]);
        $billableVisitId = (int)($billableVisitStmt->fetchColumn() ?: 0);
        if ($billableVisitId > 0) {
            $linkedVisitPaymentIds = booking_payment_apply_verified_to_visit($pdo, $billableVisitId, $bookingId);
        }
    }

    $pdo->commit();

    echo json_encode([
        'success' => true,
        'message' => $alreadyVerified
            ? 'Booking payment was already verified.'
            : 'Booking payment proof verified successfully.',
        'submissionId' => $submissionId,
        'alreadyVerified' => $alreadyVerified,
        'linkedVisitPaymentIds' => $linkedVisitPaymentIds,
    ]);
} catch (Throwable $error) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    if (http_response_code() < 400) {
        http_response_code(500);
    }
    echo json_encode([
        'success' => false,
        'message' => 'Failed to review booking payment: ' . $error->getMessage(),
    ]);
}
