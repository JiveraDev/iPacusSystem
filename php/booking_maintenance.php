<?php

function autoCancelOverdueBookings(PDO $pdo): int
{
    $stmt = $pdo->prepare("
        UPDATE bookings
        SET status = 'cancelled'
        WHERE status = 'pending'
          AND booking_date IS NOT NULL
          AND booking_time IS NOT NULL
          AND STR_TO_DATE(CONCAT(booking_date, ' ', booking_time), '%Y-%m-%d %H:%i:%s') < NOW()
    ");
    $stmt->execute();

    return $stmt->rowCount();
}
