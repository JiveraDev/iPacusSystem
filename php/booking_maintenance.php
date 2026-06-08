<?php

function autoCancelOverdueBookings(PDO $pdo): int
{
    $cancelled = 0;

    $stmt = $pdo->prepare("
        UPDATE bookings
        SET status = 'cancelled'
        WHERE status = 'pending'
          AND booking_date IS NOT NULL
          AND booking_time IS NOT NULL
          AND STR_TO_DATE(CONCAT(booking_date, ' ', booking_time), '%Y-%m-%d %H:%i:%s') < NOW()
    ");
    $stmt->execute();
    $cancelled += $stmt->rowCount();

    $ageStmt = $pdo->prepare("
        UPDATE bookings
        SET status = 'cancelled'
        WHERE status = 'pending'
          AND created_at < (NOW() - INTERVAL 7 DAY)
    ");
    $ageStmt->execute();
    $cancelled += $ageStmt->rowCount();

    $duplicateStmt = $pdo->prepare("
        UPDATE bookings old_booking
        JOIN bookings new_booking
          ON new_booking.pet_id = old_booking.pet_id
         AND new_booking.service_type = old_booking.service_type
         AND new_booking.booking_id <> old_booking.booking_id
         AND new_booking.created_at > old_booking.created_at
         AND new_booking.status IN ('pending', 'confirmed')
        SET old_booking.status = 'cancelled'
        WHERE old_booking.status = 'pending'
          AND old_booking.pet_id IS NOT NULL
    ");
    $duplicateStmt->execute();
    $cancelled += $duplicateStmt->rowCount();

    return $cancelled;
}
