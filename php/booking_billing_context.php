<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/workflow_guard_helpers.php';
require_once __DIR__ . '/branch_helpers.php';

if (!defined('VISIT_BILLING_HELPERS_ONLY')) {
    define('VISIT_BILLING_HELPERS_ONLY', true);
}
require_once __DIR__ . '/visit_billing.php';

header('Content-Type: application/json');

function booking_billing_context_error(int $statusCode, string $message): void
{
    http_response_code($statusCode);
    echo json_encode(['success' => false, 'message' => $message]);
    exit;
}

function booking_billing_context_table_exists(PDO $pdo, string $tableName): bool
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

function booking_billing_context_submission_amount(array $booking): float
{
    $serviceType = strtolower(trim((string)($booking['service_type'] ?? '')));
    $isHomeService = (int)($booking['is_home_service'] ?? 0) === 1
        || in_array($serviceType, ['home-service', 'home_service', 'home service'], true);

    if ($isHomeService) {
        return round(max(0.0, (float)($booking['transport_fee'] ?? 0)), 2);
    }

    return round(max(0.0, (float)($booking['price'] ?? 0)), 2);
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    booking_billing_context_error(405, 'Method not allowed.');
}

$bookingId = isset($_GET['bookingId']) ? (int)$_GET['bookingId'] : 0;
if ($bookingId <= 0) {
    booking_billing_context_error(400, 'Booking ID is required.');
}

try {
    $currentUser = ipawcus_guard_current_user($pdo);
    $currentRole = ipawcus_guard_role($currentUser);
    if (!ipawcus_guard_is_admin_role($currentRole)) {
        booking_billing_context_error(403, 'Only authorized admin users can review booking billing.');
    }

    $bookingStmt = $pdo->prepare("
        SELECT
            b.*,
            branch.branch_name,
            p.pet_name,
            p.pet_species,
            CONCAT(owner.first_Name, ' ', owner.last_Name) AS owner_name
        FROM bookings b
        LEFT JOIN branches branch ON branch.branch_id = b.branch_id
        LEFT JOIN pets_information p ON p.pet_id = b.pet_id
        LEFT JOIN users owner ON owner.user_id = b.user_id
        WHERE b.booking_id = ?
        LIMIT 1
    ");
    $bookingStmt->execute([$bookingId]);
    $booking = $bookingStmt->fetch(PDO::FETCH_ASSOC);
    if (!$booking) {
        booking_billing_context_error(404, 'Booking was not found.');
    }

    if (
        $currentRole === 'admin'
        && strtolower((string)($booking['status'] ?? '')) !== 'pending'
        && !branch_user_can_access($pdo, $currentUser, (int)($booking['branch_id'] ?? 0))
    ) {
        booking_billing_context_error(403, 'This booking belongs to another branch.');
    }

    $visits = [];
    if (booking_billing_context_table_exists($pdo, 'visits')) {
        $visitStmt = $pdo->prepare("
            SELECT visit_id
            FROM visits
            WHERE booking_id = ?
              AND visit_status <> 'cancelled'
            ORDER BY
                FIELD(billing_status, 'partial', 'unpaid', 'unbilled', 'paid', 'refunded'),
                visit_id DESC
        ");
        $visitStmt->execute([$bookingId]);
        foreach ($visitStmt->fetchAll(PDO::FETCH_COLUMN) as $visitId) {
            $visit = visit_billing_fetch_visit($pdo, (int)$visitId);
            if ($visit) {
                $visits[] = $visit;
            }
        }
    }

    $submission = null;
    $submissionSchemaReady = booking_billing_context_table_exists($pdo, 'booking_payment_submissions');
    if ($submissionSchemaReady) {
        $submissionStmt = $pdo->prepare("
            SELECT
                submission_id,
                purpose,
                amount,
                payment_method,
                reference_number,
                proof_url,
                submission_status,
                submitted_at,
                reviewed_at,
                linked_visit_payment_id
            FROM booking_payment_submissions
            WHERE booking_id = ?
            ORDER BY submission_id DESC
            LIMIT 1
        ");
        $submissionStmt->execute([$bookingId]);
        $row = $submissionStmt->fetch(PDO::FETCH_ASSOC);
        if ($row) {
            $refundedAmount = 0.0;
            if (booking_billing_context_table_exists($pdo, 'booking_payment_refunds')) {
                $refundStmt = $pdo->prepare("
                    SELECT COALESCE(SUM(amount), 0)
                    FROM booking_payment_refunds
                    WHERE booking_payment_submission_id = ?
                      AND refund_status = 'processed'
                ");
                $refundStmt->execute([(int)$row['submission_id']]);
                $refundedAmount = (float)$refundStmt->fetchColumn();
            }
            $submission = [
                'submissionId' => (int)$row['submission_id'],
                'purpose' => $row['purpose'],
                'amount' => (float)$row['amount'],
                'refundedAmount' => round($refundedAmount, 2),
                'refundableAmount' => round(max(0, (float)$row['amount'] - $refundedAmount), 2),
                'paymentMethod' => $row['payment_method'],
                'referenceNumber' => $row['reference_number'],
                'proofUrl' => $row['proof_url'],
                'status' => $row['submission_status'],
                'submittedAt' => $row['submitted_at'],
                'reviewedAt' => $row['reviewed_at'],
                'linkedVisitPaymentId' => $row['linked_visit_payment_id'] !== null
                    ? (int)$row['linked_visit_payment_id']
                    : null,
            ];
        }
    }

    if ($submission === null && !empty($booking['payment_proof_url'])) {
        $submission = [
            'submissionId' => null,
            'purpose' => ((int)($booking['is_home_service'] ?? 0) === 1) ? 'home_transport' : 'booking_payment',
            'amount' => booking_billing_context_submission_amount($booking),
            'refundedAmount' => 0.0,
            'refundableAmount' => 0.0,
            'paymentMethod' => $booking['payment_method'] ?? null,
            'referenceNumber' => $booking['payment_reference'] ?? null,
            'proofUrl' => $booking['payment_proof_url'],
            'status' => 'legacy_submitted',
            'submittedAt' => $booking['created_at'] ?? null,
            'reviewedAt' => null,
            'linkedVisitPaymentId' => null,
        ];
    }

    echo json_encode([
        'success' => true,
        'submissionSchemaReady' => $submissionSchemaReady,
        'booking' => [
            'bookingId' => (int)$booking['booking_id'],
            'bookingNumber' => $booking['booking_number'],
            'branchId' => (int)($booking['branch_id'] ?? 0),
            'branchName' => $booking['branch_name'] ?? '',
            'petId' => $booking['pet_id'] !== null ? (int)$booking['pet_id'] : null,
            'petName' => $booking['pet_name'] ?? $booking['unregistered_pet_name'] ?? 'Booking Patient',
            'petSpecies' => $booking['pet_species'] ?? $booking['petType'] ?? 'Pet',
            'ownerUserId' => (int)$booking['user_id'],
            'ownerName' => trim((string)($booking['owner_name'] ?? '')) ?: 'Pet Owner',
            'serviceType' => $booking['service_type'],
            'status' => $booking['status'],
            'price' => (float)($booking['price'] ?? 0),
            'transportFee' => (float)($booking['transport_fee'] ?? 0),
        ],
        'paymentSubmission' => $submission,
        'visits' => $visits,
        'recommendedVisit' => $visits[0] ?? null,
    ]);
} catch (Throwable $error) {
    booking_billing_context_error(500, 'Booking billing context could not be loaded: ' . $error->getMessage());
}
