<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/booking_maintenance.php';
require_once __DIR__ . '/online_consultation_helpers.php';

header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] !== 'PATCH') {
    http_response_code(405);
    echo json_encode(['message' => 'Method not allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$bookingId = $_GET['bookingId'] ?? null;
$status = $input['status'] ?? null;
$cancellationMessage = trim((string)($input['cancellation_message'] ?? ''));
$walletNumber = trim((string)($input['wallet_number'] ?? ''));
$transactionNumber = trim((string)($input['transaction_number'] ?? ''));

if (!$bookingId || !$status) {
    http_response_code(400);
    echo json_encode(['message' => 'Booking ID and Status are required.']);
    exit;
}

try {
    autoCancelOverdueBookings($pdo);

    $pdo->beginTransaction();
    $onlineConsultation = null;

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

    $pdo->commit();

    echo json_encode([
        'message' => 'Booking status updated successfully.',
        'onlineConsultation' => $onlineConsultation
    ]);
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    http_response_code(500);
    echo json_encode(['message' => 'Failed to update booking status: ' . $e->getMessage()]);
}
