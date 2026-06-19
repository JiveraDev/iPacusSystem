<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/online_consultation_helpers.php';
require_once __DIR__ . '/notification_helpers.php';
require_once __DIR__ . '/booking_maintenance.php';

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
$changedByUserId = isset($input['changed_by_user_id']) && $input['changed_by_user_id'] !== ''
    ? (int)$input['changed_by_user_id']
    : null;

if ($bookingId <= 0 || $bookingDate === '' || $bookingTime === '') {
    http_response_code(400);
    echo json_encode(['message' => 'Booking ID, date, and time are required.']);
    exit;
}

try {
    buildOnlineConsultationDateTime($bookingDate, $bookingTime);

    $pdo->beginTransaction();

    $stmt = $pdo->prepare("
        SELECT booking_id, is_online_consultation, status, booking_date, booking_time, service_type, check_in_date, created_at, notes
        FROM bookings
        WHERE booking_id = ?
        LIMIT 1
        FOR UPDATE
    ");
    $stmt->execute([$bookingId]);
    $booking = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$booking) {
        throw new RuntimeException('Booking not found.');
    }

    $lifecycleNote = '[Lifecycle] Manual reschedule from '
        . ($booking['booking_date'] ?? 'unset')
        . ' to '
        . $bookingDate
        . ($reason !== '' ? '. Reason: ' . $reason : '')
        . '. Recorded at: '
        . maintenance_now($pdo);
    $lifecycleNote = maintenance_append_original_booking_note_if_missing($booking, $lifecycleNote);

    $update = $pdo->prepare("UPDATE bookings SET booking_date = ?, booking_time = ?, notes = ? WHERE booking_id = ?");
    $update->execute([
        $bookingDate,
        $bookingTime,
        maintenance_append_note($booking['notes'] ?? '', $lifecycleNote),
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

    $oldBookingDate = $booking['booking_date'] ?? null;
    $oldBookingTime = $booking['booking_time'] ?? null;

    $pdo->commit();

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
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    http_response_code(500);
    echo json_encode(['message' => 'Failed to reschedule booking: ' . $e->getMessage()]);
}
