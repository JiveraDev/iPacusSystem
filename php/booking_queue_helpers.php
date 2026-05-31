<?php

function queueTableColumns(PDO $pdo): array
{
    $stmt = $pdo->query("SHOW COLUMNS FROM queues");

    return $stmt->fetchAll(PDO::FETCH_COLUMN);
}

function bookingQueueMarker(string $bookingNumber): string
{
    return '[Booking: ' . trim($bookingNumber) . ']';
}

function bookingNumberFromQueueComplaint(?string $complaint): ?string
{
    if (!$complaint) {
        return null;
    }

    if (preg_match('/\[Booking:\s*([^\]]+)\]/', $complaint, $matches) !== 1) {
        return null;
    }

    $bookingNumber = trim($matches[1]);

    return $bookingNumber !== '' ? $bookingNumber : null;
}

function bookingIdForQueue(PDO $pdo, array $queue): ?int
{
    if (!empty($queue['booking_id'])) {
        return (int)$queue['booking_id'];
    }

    $bookingNumber = bookingNumberFromQueueComplaint($queue['complaint'] ?? null);

    if (!$bookingNumber) {
        return null;
    }

    $stmt = $pdo->prepare("SELECT booking_id FROM bookings WHERE booking_number = ? LIMIT 1");
    $stmt->execute([$bookingNumber]);
    $bookingId = $stmt->fetchColumn();

    return $bookingId ? (int)$bookingId : null;
}

function buildBookingQueueComplaint(array $booking): string
{
    $parts = [bookingQueueMarker((string)$booking['booking_number'])];
    $notes = trim((string)($booking['notes'] ?? ''));

    if ($notes !== '') {
        $parts[] = $notes;
    }

    return implode("\n", $parts);
}
