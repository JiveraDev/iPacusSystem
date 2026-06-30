<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/booking_maintenance.php';
require_once __DIR__ . '/online_consultation_helpers.php';
require_once __DIR__ . '/notification_helpers.php';
require_once __DIR__ . '/phone_number_helpers.php';

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
    if (!booking_status_column_exists($pdo, 'payment_proof_url')) {
        $pdo->exec("ALTER TABLE bookings ADD COLUMN payment_proof_url VARCHAR(255) NULL");
    }

    if (!booking_status_column_exists($pdo, 'payment_method')) {
        $pdo->exec("ALTER TABLE bookings ADD COLUMN payment_method VARCHAR(40) NULL AFTER payment_proof_url");
    }

    if (!booking_status_column_exists($pdo, 'payment_reference')) {
        $pdo->exec("ALTER TABLE bookings ADD COLUMN payment_reference VARCHAR(120) NULL AFTER payment_method");
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
$allowedPaymentMethods = ['cash', 'qrph', 'gcash', 'maya', 'bank_transfer'];
$paymentMethod = strtolower(trim((string)($input['payment_method'] ?? $input['paymentMethod'] ?? '')));
$paymentMethod = in_array($paymentMethod, $allowedPaymentMethods, true) ? $paymentMethod : null;
$hasPaymentReference = array_key_exists('payment_reference', $input) || array_key_exists('paymentReference', $input);
$paymentReference = trim((string)($input['payment_reference'] ?? $input['paymentReference'] ?? ''));
$paymentReference = $paymentReference !== '' ? $paymentReference : null;
$hasPaymentUpdate = $hasPaymentProof || $hasPaymentMethod || $hasPaymentReference;

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
    if ($hasPaymentUpdate) {
        booking_status_ensure_payment_columns($pdo);
    }

    $pdo->beginTransaction();
    $onlineConsultation = null;

    $bookingStmt = $pdo->prepare("SELECT status, service_type, notes FROM bookings WHERE booking_id = ? LIMIT 1 FOR UPDATE");
    $bookingStmt->execute([$bookingId]);
    $booking = $bookingStmt->fetch(PDO::FETCH_ASSOC);

    if (!$booking) {
        throw new Exception('Booking not found.');
    }

    if ($booking['status'] === 'cancelled' && $status !== 'cancelled') {
        http_response_code(409);
        throw new Exception('Cancelled bookings cannot be moved back to an active status without rescheduling/recreating the booking.');
    }

    $hasReviewUpdate = $reviewServiceType !== '' || $hasReviewNotes;
    if ($hasReviewUpdate && in_array($booking['status'], ['confirmed', 'cancelled'], true)) {
        http_response_code(409);
        throw new Exception('Confirmed or cancelled bookings cannot have their service review edited.');
    }

    if ($hasReviewUpdate) {
        $fields = [];
        $values = [];

        if ($reviewServiceType !== '') {
            $fields[] = 'service_type = ?';
            $values[] = $reviewServiceType;
        }

        if ($hasReviewNotes) {
            $fields[] = 'notes = ?';
            $values[] = $reviewNotes;
        }

        if (!empty($fields)) {
            $values[] = $bookingId;
            $reviewStmt = $pdo->prepare("UPDATE bookings SET " . implode(', ', $fields) . " WHERE booking_id = ?");
            $reviewStmt->execute($values);
        }
    }

    $effectiveStatus = ($booking['status'] === 'completed' && $status === 'confirmed' && $hasPaymentUpdate)
        ? 'completed'
        : $status;

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
