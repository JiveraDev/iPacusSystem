<?php
require_once __DIR__ . '/booking_slot_helpers.php';

/** One calendar task per actual assigned booking, never per pet or queue row. */
function veterinarian_booking_todo(array $booking): ?array
{
    $key = booking_slot_service_key($booking['service_type'] ?? '', $booking['is_home_service'] ?? 0, $booking['is_online_consultation'] ?? 0);
    $status = strtolower(trim((string)($booking['status'] ?? '')));
    if (!clinic_booking_is_medical($key) || !in_array($status, ['pending', 'confirmed'], true)) return null;
    $isOnline = $key === 'online-consultation';
    $consultationStatus = $booking['consultation_status'] ?? null;
    if ($isOnline && $consultationStatus && !in_array($consultationStatus, ['scheduled', 'vet_ready', 'in_progress'], true)) return null;
    $start = $isOnline && !empty($booking['scheduled_start']) ? $booking['scheduled_start']
        : ($booking['booking_date'] ?? '') . ' ' . ($booking['booking_time'] ?? '');
    $timestamp = strtotime($start);
    if ($timestamp === false) return null;
    $duration = booking_slot_duration_minutes($key);
    $endTimestamp = $isOnline && !empty($booking['scheduled_end']) ? strtotime($booking['scheduled_end']) : false;
    if ($endTimestamp === false || $endTimestamp <= $timestamp) $endTimestamp = $timestamp + $duration * 60;
    $id = (int)$booking['booking_id'];
    $petId = (int)($booking['pet_id'] ?? 0);
    $petName = $booking['pet_name'] ?? $booking['unregistered_pet_name'] ?? 'Pet';
    $ownerName = trim((string)($booking['owner_name'] ?? '')) ?: 'Pet owner';
    $branchName = $booking['branch_name'] ?? '';
    $service = $isOnline ? 'Online consultation' : ($key === 'general-checkup' ? 'General Check-up' : ucwords(str_replace('-', ' ', $key)));
    $number = $booking['booking_number'] ?? '#' . $id;
    return [
        'id' => 'vet-booking-' . $id,
        'source' => $isOnline ? 'online_consultation' : 'vet_booking',
        'sourceId' => $isOnline ? (int)($booking['online_consultation_id'] ?? $id) : $id,
        'bookingId' => $id, 'bookingNumber' => $number,
        'branchId' => (int)($booking['branch_id'] ?? 0), 'branchName' => $branchName,
        'ownerName' => $ownerName,
        'title' => $service . ' — ' . $petName,
        'details' => $number . '. Owner: ' . $ownerName . ($branchName ? '. Clinic: ' . $branchName : '') . '. Booking: ' . $status . '.',
        'category' => $isOnline ? 'Online Consultation' : 'Booking',
        'startAt' => date('Y-m-d H:i:s', $timestamp),
        'endAt' => date('Y-m-d H:i:s', $endTimestamp),
        'status' => $isOnline && $consultationStatus ? $consultationStatus : $status,
        'petId' => $petId > 0 ? $petId : null,
        'petShareableId' => $booking['pet_sharable_ID'] ?? null, 'petName' => $petName,
        'redirectPath' => $isOnline ? '/dashboard/vet/online-consultations'
            : '/dashboard/vet/my-list?date=' . date('Y-m-d', $timestamp) . '&booking=' . $id,
        'editable' => false, 'actionable' => false,
    ];
}
