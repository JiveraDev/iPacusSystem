<?php

function ipawcus_reference_timestamp(?string $dateTime = null): int
{
    $timestamp = $dateTime ? strtotime($dateTime) : false;
    return $timestamp !== false ? $timestamp : time();
}

function ipawcus_reference_suffix(?string $dateTime = null): string
{
    $timestamp = ipawcus_reference_timestamp($dateTime);
    return strtoupper(date('M', $timestamp)) . date('d', $timestamp);
}

function ipawcus_format_queue_reference($queueNumber, ?string $timestamp = null): string
{
    return 'Q-' . (int)$queueNumber . ipawcus_reference_suffix($timestamp);
}

function ipawcus_reference_sequence(string $reference, string $prefix, string $suffix): int
{
    $pattern = '/^' . preg_quote($prefix . '-', '/') . '(\d+)' . preg_quote($suffix, '/') . '$/i';
    return preg_match($pattern, trim($reference), $matches) === 1 ? (int)$matches[1] : 0;
}

function ipawcus_generate_booking_number(PDO $pdo, ?string $bookingDate = null): string
{
    $suffix = ipawcus_reference_suffix($bookingDate);
    $stmt = $pdo->prepare("SELECT booking_number FROM bookings WHERE booking_number LIKE ?");
    $stmt->execute(['B-%' . $suffix]);
    $maxSequence = 0;

    foreach ($stmt->fetchAll(PDO::FETCH_COLUMN) as $bookingNumber) {
        $maxSequence = max($maxSequence, ipawcus_reference_sequence((string)$bookingNumber, 'B', $suffix));
    }

    $existsStmt = $pdo->prepare("SELECT COUNT(*) FROM bookings WHERE booking_number = ?");
    $sequence = $maxSequence + 1;

    do {
        $bookingNumber = 'B-' . $sequence . $suffix;
        $existsStmt->execute([$bookingNumber]);
        $exists = (int)$existsStmt->fetchColumn() > 0;
        $sequence++;
    } while ($exists);

    return $bookingNumber;
}
