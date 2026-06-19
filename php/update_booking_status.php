<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/booking_maintenance.php';
require_once __DIR__ . '/online_consultation_helpers.php';
require_once __DIR__ . '/notification_helpers.php';

header("Content-Type: application/json");

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

if ($status === 'completed') {
    http_response_code(409);
    echo json_encode([
        'message' => 'Bookings can only be completed by the matching service completion workflow so billing and service status stay consistent.'
    ]);
    exit;
}

try {
    runLifecycleMaintenance($pdo);

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
        $stmt = $pdo->prepare("UPDATE bookings SET status = ?, notes = ? WHERE booking_id = ?");
        $stmt->execute([$status, $updatedNotes, $bookingId]);
    } else {
        $stmt = $pdo->prepare("UPDATE bookings SET status = ? WHERE booking_id = ?");
        $stmt->execute([$status, $bookingId]);
    }

    if ($status === 'confirmed') {
        $onlineConsultation = createOnlineConsultationForBooking($pdo, (int)$bookingId);
    } elseif ($status === 'cancelled') {
        cancelOnlineConsultationForBooking($pdo, (int)$bookingId);
    }

    $previousStatus = $booking['status'];

    $pdo->commit();

    if ($status !== $previousStatus && in_array($status, ['confirmed', 'cancelled'], true)) {
        try {
            notification_send_booking_event($pdo, (int)$bookingId, $status === 'confirmed' ? 'confirmed' : 'cancelled', [
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
