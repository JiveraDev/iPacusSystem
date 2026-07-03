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

function bookingNotesHaveRescheduleTag(?string $notes): bool
{
    $notes = (string)$notes;

    return preg_match('/\[Rescheduled\]/i', $notes) === 1
        || preg_match('/\[Lifecycle\]\s*(Auto-rescheduled|Manual reschedule)/i', $notes) === 1;
}

function bookingNormalizeVisibleNotes(?string $notes): string
{
    $notes = str_replace(["\r\n", "\r"], "\n", (string)$notes);
    $notes = preg_replace('/[ \t]+/', ' ', $notes) ?? $notes;
    $notes = preg_replace('/ *\n+ */', "\n", $notes) ?? $notes;
    $lines = array_values(array_filter(
        array_map('trim', explode("\n", $notes)),
        static fn(string $line): bool => $line !== ''
    ));

    return trim(implode("\n", $lines));
}

function bookingStripLifecycleNotes(?string $notes, bool $removeOriginalBookingDate = true): string
{
    $notes = (string)$notes;
    $patterns = [
        '/\[Lifecycle\]\s*Auto-rescheduled due to missed approved booking.*?Recorded at:\s*\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}/is',
        '/\[Lifecycle\]\s*Manual reschedule from.*?Recorded at:\s*\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}/is',
        '/\[Rescheduled\]/i',
    ];

    if ($removeOriginalBookingDate) {
        $patterns[] = '/\[Original Booking Date:\s*\d{4}-\d{2}-\d{2}\]/i';
    }

    foreach ($patterns as $pattern) {
        $notes = preg_replace($pattern, ' ', $notes) ?? $notes;
    }

    return bookingNormalizeVisibleNotes($notes);
}

function bookingCleanVisibleNotes(?string $notes, bool $includeRescheduledTag = true): string
{
    $wasRescheduled = bookingNotesHaveRescheduleTag($notes);
    $notes = bookingStripLifecycleNotes($notes, true);

    if ($includeRescheduledTag && $wasRescheduled) {
        $notes = bookingNormalizeVisibleNotes($notes . "\n[Rescheduled]");
    }

    return $notes;
}

function cleanBookingQueueComplaint(?string $complaint): string
{
    $complaint = (string)$complaint;
    $marker = '';

    if (preg_match('/\[Booking:\s*[^\]]+\]/', $complaint, $matches) === 1) {
        $marker = trim($matches[0]);
        $complaint = preg_replace('/\[Booking:\s*[^\]]+\]\s*/', '', $complaint, 1) ?? $complaint;
    }

    $notes = bookingCleanVisibleNotes($complaint);

    return bookingNormalizeVisibleNotes($marker . ($notes !== '' ? "\n" . $notes : ''));
}

function buildBookingQueueComplaint(array $booking): string
{
    $parts = [bookingQueueMarker((string)$booking['booking_number'])];
    $notes = bookingCleanVisibleNotes($booking['notes'] ?? '');

    if ($notes !== '') {
        $parts[] = $notes;
    }

    return implode("\n", $parts);
}
