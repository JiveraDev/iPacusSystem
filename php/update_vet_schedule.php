<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/workflow_guard_helpers.php';
require_once __DIR__ . '/branch_helpers.php';
require_once __DIR__ . '/booking_slot_helpers.php';

header('Content-Type: application/json');
header('Cache-Control: no-store');
date_default_timezone_set('Asia/Manila');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['message' => 'Method not allowed.']);
    exit;
}

$calendarLock = null;
try {
    $actor = ipawcus_guard_current_user($pdo);
    $role = ipawcus_guard_role($actor);
    if (!in_array($role, ['veterinarian', 'super_admin'], true)) ipawcus_guard_error(403, 'Only veterinarians and Super Admin can change online availability.');
    $input = json_decode(file_get_contents('php://input'), true);
    if (!is_array($input)) throw new InvalidArgumentException('Provide a valid online schedule.');
    $vetId = (int)($input['user_id'] ?? $input['veterinarianId'] ?? ipawcus_guard_user_id($actor));
    if ($role !== 'super_admin' && $vetId !== ipawcus_guard_user_id($actor)) ipawcus_guard_error(403, 'You can change only your own online schedule.');
    $stmt = $pdo->prepare("SELECT user_id FROM users WHERE user_id = ?
        AND LOWER(REPLACE(REPLACE(TRIM(role), ' ', '_'), '-', '_')) IN ('veterinarian', 'vet')");
    $stmt->execute([$vetId]);
    if (!$stmt->fetchColumn()) throw new InvalidArgumentException('Select a veterinarian account.');
    if (!booking_slot_table_exists($pdo, 'vet_schedules')) throw new DomainException('The online consultation schedule table is not configured.');

    $calendarLock = 'ipawcus_shared_medical_calendar';
    if (!booking_slot_acquire($pdo, $calendarLock)) throw new DomainException('Booking schedules are being updated. Try again shortly.');
    $pdo->beginTransaction();
    $oldSchedules = clinic_booking_online_schedules($pdo);
    $days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    $weekly = array_fill_keys($days, []);
    if (array_key_exists('weeklyAvailability', $input)) {
        if (!is_array($input['weeklyAvailability'])) throw new InvalidArgumentException('Provide online times for each weekday.');
        if (array_diff(array_keys($input['weeklyAvailability']), $days)) throw new InvalidArgumentException('Choose online days from Monday to Saturday.');
        foreach ($input['weeklyAvailability'] as $day => $times) {
            if (!is_array($times) || count($times) > 20) throw new InvalidArgumentException('Provide a list of online start times for each day.');
            $weekly[$day] = $times;
        }
    } else {
        // Keep the former single-slot API working; the profile saves all days
        // atomically so a failed request never leaves a half-updated schedule.
        foreach ($oldSchedules as $row) {
            $day = strtolower(trim((string)$row['day_of_week']));
            if ((int)$row['user_id'] !== $vetId || (int)$row['is_available'] !== 1 || !isset($weekly[$day])) continue;
            $normalized = booking_slot_normalize_time($row['time_slot']);
            if ($normalized) $weekly[$day][] = date('h:i A', strtotime('1970-01-01 ' . $normalized));
        }
        $day = strtolower(trim((string)($input['day_of_week'] ?? '')));
        $normalized = booking_slot_normalize_time($input['time_slot'] ?? null);
        if (!isset($weekly[$day]) || !$normalized) throw new InvalidArgumentException('Choose a valid online weekday and start time.');
        $label = date('h:i A', strtotime('1970-01-01 ' . $normalized));
        $weekly[$day] = array_values(array_filter($weekly[$day], static fn($value) => $value !== $label));
        if (filter_var($input['is_available'] ?? false, FILTER_VALIDATE_BOOLEAN)) $weekly[$day][] = $label;
    }
    $selected = [];
    foreach ($weekly as $day => $times) {
        foreach ($times as $time) {
            if (!is_string($time)) throw new InvalidArgumentException('Select valid online start times.');
            $normalized = booking_slot_normalize_time($time);
            if (!$normalized || $normalized < '08:00:00' || $normalized > '17:30:00'
                || !in_array(substr($normalized, 3), ['00:00', '30:00'], true)) {
                throw new InvalidArgumentException('Choose an online start time between 8:00 AM and 5:30 PM, in 30-minute steps.');
            }
            $label = date('h:i A', strtotime('1970-01-01 ' . $normalized));
            $selected[$day . '|' . $normalized] = ['user_id' => $vetId, 'day_of_week' => $day, 'time_slot' => $label, 'is_available' => 1];
        }
    }
    $proposed = array_values($selected);
    // Online edits cannot remove the selected start of an existing call.
    foreach (clinic_booking_reservations($pdo, date('Y-m-d'), '9999-12-30', true) as $booking) {
        if ((int)($booking['veterinarian_id'] ?? 0) !== $vetId
            || !in_array(strtolower($booking['status']), ['pending', 'confirmed'], true)
            || booking_slot_service_key($booking['service_type'], $booking['is_home_service'], $booking['is_online_consultation']) !== 'online-consultation') continue;
        $interval = clinic_booking_interval($booking);
        if (!$interval || $interval[1] <= time()) continue;
        if (clinic_booking_online_slot_selected($oldSchedules, $vetId, $booking['booking_date'], $booking['booking_time'])
            && !clinic_booking_online_slot_selected($proposed, $vetId, $booking['booking_date'], $booking['booking_time'])) {
            throw new DomainException('This change would remove the online time for booking #' . $booking['booking_id'] . '. Reschedule or cancel that call first.');
        }
    }
    $pdo->prepare('UPDATE vet_schedules SET is_available = 0 WHERE user_id = ?')->execute([$vetId]);
    $update = $pdo->prepare('UPDATE vet_schedules SET is_available = 1 WHERE user_id = ? AND day_of_week = ? AND time_slot = ?');
    $insert = $pdo->prepare('INSERT INTO vet_schedules (user_id, day_of_week, time_slot, is_available) VALUES (?, ?, ?, 1)');
    foreach ($proposed as $row) {
        $values = [$vetId, $row['day_of_week'], $row['time_slot']];
        $update->execute($values);
        if ($update->rowCount() === 0) $insert->execute($values);
    }
    $schedules = array_values(array_filter(clinic_booking_online_schedules($pdo), static fn($row) => (int)$row['user_id'] === $vetId));
    $pdo->commit();
    booking_slot_release($pdo, $calendarLock);
    $calendarLock = null;
    echo json_encode(['success' => true, 'message' => 'Online consultation availability saved.', 'schedules' => $schedules]);
} catch (Throwable $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    booking_slot_release($pdo, $calendarLock);
    $status = $error instanceof InvalidArgumentException ? 422 : ($error instanceof DomainException ? 409 : 500);
    if ($status === 500) error_log('Online schedule update: ' . $error->getMessage());
    http_response_code($status);
    echo json_encode(['success' => false, 'message' => $status === 500 ? 'Online availability could not be saved. Try again.' : $error->getMessage()]);
}
