<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/workflow_guard_helpers.php';
require_once __DIR__ . '/branch_helpers.php';
require_once __DIR__ . '/booking_slot_helpers.php';

header('Content-Type: application/json');
header('Cache-Control: no-store');
date_default_timezone_set('Asia/Manila');

function vet_booking_schedule_data(PDO $pdo, int $vetId, bool $canAssign): array
{
    $branches = branch_fetch_catalog($pdo);
    $stmt = $pdo->prepare('SELECT a.branch_id, a.is_primary, COALESCE(c.accepts_bookings, 0) AS accepts_bookings
        FROM user_branch_assignments a LEFT JOIN veterinarian_booking_clinics c
        ON c.veterinarian_user_id = a.user_id AND c.branch_id = a.branch_id
        WHERE a.user_id = ? AND a.is_active = 1');
    $stmt->execute([$vetId]);
    $assigned = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) $assigned[(int)$row['branch_id']] = $row;
    $clinics = [];
    foreach ($branches as $branch) {
        $id = (int)$branch['id'];
        if (!$canAssign && !isset($assigned[$id])) continue;
        $clinics[] = [
            'id' => $id, 'name' => $branch['name'], 'code' => $branch['code'],
            'assigned' => isset($assigned[$id]),
            'isPrimary' => (int)($assigned[$id]['is_primary'] ?? 0) === 1,
            'acceptsBookings' => (int)($assigned[$id]['accepts_bookings'] ?? 0) === 1,
        ];
    }
    $stmt = $pdo->prepare('SELECT working_hours_id AS id, branch_id AS branchId, day_of_week AS dayOfWeek,
        TIME_FORMAT(starts_at, "%H:%i") AS startsAt, TIME_FORMAT(ends_at, "%H:%i") AS endsAt
        FROM veterinarian_working_hours WHERE veterinarian_user_id = ? ORDER BY day_of_week, starts_at');
    $stmt->execute([$vetId]);
    $hours = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $stmt = $pdo->prepare('SELECT time_off_id AS id, starts_at AS startsAt, ends_at AS endsAt, notes
        FROM veterinarian_booking_time_off WHERE veterinarian_user_id = ? AND ends_at > NOW() ORDER BY starts_at');
    $stmt->execute([$vetId]);
    return ['veterinarianId' => $vetId, 'canAssignClinics' => $canAssign, 'clinics' => $clinics, 'weeklyHours' => $hours, 'timeOff' => $stmt->fetchAll(PDO::FETCH_ASSOC)];
}

function vet_booking_valid_datetime($value): ?string
{
    $value = str_replace('T', ' ', trim((string)$value));
    if (strlen($value) === 16) $value .= ':00';
    $date = DateTimeImmutable::createFromFormat('!Y-m-d H:i:s', $value);
    return $date && $date->format('Y-m-d H:i:s') === $value ? $value : null;
}

$calendarLock = null;
try {
    branch_require_schema($pdo);
    clinic_booking_require_schema($pdo);
    $actor = ipawcus_guard_current_user($pdo);
    $role = ipawcus_guard_role($actor);
    if (!in_array($role, ['veterinarian', 'super_admin'], true)) ipawcus_guard_error(403, 'Only veterinarians and Super Admin can manage working schedules.');
    $input = json_decode(file_get_contents('php://input'), true) ?: [];
    $vetId = (int)($input['veterinarianId'] ?? $_GET['veterinarianId'] ?? ipawcus_guard_user_id($actor));
    if ($role === 'veterinarian' && $vetId !== ipawcus_guard_user_id($actor)) ipawcus_guard_error(403, 'You can manage only your own booking schedule.');
    $stmt = $pdo->prepare("SELECT user_id FROM users WHERE user_id = ? AND LOWER(REPLACE(REPLACE(TRIM(role), ' ', '_'), '-', '_')) IN ('veterinarian', 'vet')");
    $stmt->execute([$vetId]);
    if (!$stmt->fetchColumn()) throw new InvalidArgumentException('Select a veterinarian account.');

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $data = vet_booking_schedule_data($pdo, $vetId, $role === 'super_admin');
        if (isset($_GET['from'], $_GET['to'])) {
            $from = substr(vet_booking_valid_datetime($_GET['from'] . ' 00:00:00') ?? '', 0, 10);
            $to = substr(vet_booking_valid_datetime($_GET['to'] . ' 00:00:00') ?? '', 0, 10);
            if (!$from || !$to || $to < $from || (strtotime($to) - strtotime($from)) > 100 * 86400) throw new InvalidArgumentException('Use a working calendar range of up to 100 days.');
            $roster = array_filter(clinic_booking_roster($pdo), static fn($row) => (int)$row['veterinarian_user_id'] === $vetId);
            $leave = clinic_booking_time_off($pdo, $from, $to);
            $occurrences = [];
            $names = array_column($data['clinics'], 'name', 'id');
            for ($date = new DateTimeImmutable($from); $date->format('Y-m-d') <= $to; $date = $date->modify('+1 day')) {
                $day = $date->format('Y-m-d');
                foreach ($roster as $row) {
                    if ((int)$row['day_of_week'] !== (int)$date->format('N')) continue;
                    if (!branch_is_open($pdo, (int)$row['branch_id'], $day, $row['starts_at'])) continue;
                    $start = $day . ' ' . $row['starts_at'];
                    $end = $day . ' ' . $row['ends_at'];
                    $segments = [[$start, $end]];
                    // Split shifts around leave so the work calendar matches booking availability.
                    $dayBreaks = [...$leave, ['veterinarian_user_id' => $vetId, 'starts_at' => $day . ' 12:00:00', 'ends_at' => $day . ' 13:00:00']];
                    foreach ($dayBreaks as $away) {
                        if ((int)$away['veterinarian_user_id'] !== $vetId) continue;
                        $next = [];
                        foreach ($segments as [$a, $b]) {
                            if ($away['starts_at'] >= $b || $away['ends_at'] <= $a) { $next[] = [$a, $b]; continue; }
                            if ($a < $away['starts_at']) $next[] = [$a, $away['starts_at']];
                            if ($away['ends_at'] < $b) $next[] = [$away['ends_at'], $b];
                        }
                        $segments = $next;
                    }
                    foreach ($segments as [$a, $b]) $occurrences[] = [
                        'id' => $row['working_hours_id'] . '-' . $day . '-' . $a,
                        'branchId' => (int)$row['branch_id'], 'branchName' => $names[$row['branch_id']] ?? 'Clinic',
                        'startsAt' => $a, 'endsAt' => $b,
                    ];
                }
            }
            $data['occurrences'] = $occurrences;
        }
        echo json_encode(['success' => true, ...$data]);
        exit;
    }
    if ($_SERVER['REQUEST_METHOD'] !== 'PUT') { http_response_code(405); echo json_encode(['message' => 'Method not allowed.']); exit; }
    $calendarLock = 'ipawcus_shared_medical_calendar';
    if (!booking_slot_acquire($pdo, $calendarLock)) throw new DomainException('Booking schedules are being updated. Try again shortly.');
    $pdo->beginTransaction();
    $beforeRoster = clinic_booking_roster($pdo);
    $beforeLeave = clinic_booking_time_off($pdo, date('Y-m-d'), '9999-12-30');
    $current = vet_booking_schedule_data($pdo, $vetId, true);
    $assignedIds = array_map('intval', array_column(array_filter($current['clinics'], static fn($c) => $c['assigned']), 'id'));
    if (array_key_exists('assignedBranchIds', $input)) {
        if ($role !== 'super_admin') ipawcus_guard_error(403, 'Only Super Admin can assign clinics.');
        $assignedIds = array_values(array_unique(array_map('intval', (array)$input['assignedBranchIds'])));
        $activeIds = array_map('intval', array_column($current['clinics'], 'id'));
        if (!$assignedIds || array_diff($assignedIds, $activeIds)) throw new InvalidArgumentException('Assign at least one active clinic.');
        $primaryId = (int)($input['primaryBranchId'] ?? $assignedIds[0]);
        if (!in_array($primaryId, $assignedIds, true)) throw new InvalidArgumentException('The primary clinic must be assigned to this veterinarian.');
        $stmt = $pdo->prepare('UPDATE user_branch_assignments SET is_active = 0, is_primary = 0, ended_at = NOW() WHERE user_id = ?');
        $stmt->execute([$vetId]);
        $stmt = $pdo->prepare('INSERT INTO user_branch_assignments (user_id, branch_id, is_primary, is_active, assigned_by_user_id, ended_at)
            VALUES (?, ?, ?, 1, ?, NULL) ON DUPLICATE KEY UPDATE is_primary = VALUES(is_primary), is_active = 1, assigned_by_user_id = VALUES(assigned_by_user_id), ended_at = NULL');
        foreach ($assignedIds as $id) $stmt->execute([$vetId, $id, $id === $primaryId ? 1 : 0, ipawcus_guard_user_id($actor)]);
        $pdo->prepare('UPDATE users SET preferred_branch_id = ? WHERE user_id = ?')->execute([$primaryId, $vetId]);
    }
    $preferences = $input['clinics'] ?? null;
    $hours = $input['weeklyHours'] ?? null;
    $leaves = $input['timeOff'] ?? null;
    if (!is_array($preferences) || !is_array($hours) || !is_array($leaves) || count($hours) > 84 || count($leaves) > 100) throw new InvalidArgumentException('Provide clinic booking preferences, weekly working hours, and time off.');
    $accepts = [];
    foreach ($preferences as $clinic) {
        $id = (int)($clinic['id'] ?? 0);
        if (!in_array($id, $assignedIds, true)) throw new InvalidArgumentException('Booking preferences must use your assigned clinics.');
        $accepts[$id] = filter_var($clinic['acceptsBookings'] ?? false, FILTER_VALIDATE_BOOLEAN) ? 1 : 0;
    }
    $normalizedHours = [];
    foreach ($hours as $row) {
        $branchId = (int)($row['branchId'] ?? 0);
        $day = (int)($row['dayOfWeek'] ?? 0);
        $start = booking_slot_normalize_time($row['startsAt'] ?? null);
        $end = booking_slot_normalize_time($row['endsAt'] ?? null);
        if (!in_array($branchId, $assignedIds, true) || $day < 1 || $day > 6 || !$start || !$end
            || $start >= $end || $start < '08:00:00' || $end > '18:00:00'
            || !in_array(substr($start, 3), ['00:00', '30:00'], true) || !in_array(substr($end, 3), ['00:00', '30:00'], true)) {
            throw new InvalidArgumentException('Use an assigned clinic, Monday to Saturday, and half-hour working times between 8:00 AM and 6:00 PM.');
        }
        foreach ($normalizedHours as $other) {
            if ($day === $other['dayOfWeek'] && $start < $other['endsAt'] && $other['startsAt'] < $end) throw new InvalidArgumentException('Working hours overlap. A veterinarian can work at only one clinic at a time.');
        }
        $normalizedHours[] = ['branchId' => $branchId, 'dayOfWeek' => $day, 'startsAt' => $start, 'endsAt' => $end];
    }
    foreach ($assignedIds as $id) {
        if (!empty($accepts[$id]) && !array_filter($normalizedHours, static fn($h) => $h['branchId'] === $id)) throw new InvalidArgumentException('Add working hours for each clinic accepting bookings.');
    }
    $normalizedLeaves = [];
    foreach ($leaves as $leave) {
        $start = vet_booking_valid_datetime($leave['startsAt'] ?? '');
        $end = vet_booking_valid_datetime($leave['endsAt'] ?? '');
        if (!$start || !$end || $start >= $end || strlen((string)($leave['notes'] ?? '')) > 250) throw new InvalidArgumentException('Each time-off entry needs valid start/end dates and times, with the end after the start.');
        $normalizedLeaves[] = [$start, $end, trim((string)($leave['notes'] ?? ''))];
    }
    $pdo->prepare('UPDATE veterinarian_booking_clinics SET accepts_bookings = 0 WHERE veterinarian_user_id = ?')->execute([$vetId]);
    $stmt = $pdo->prepare('INSERT INTO veterinarian_booking_clinics (veterinarian_user_id, branch_id, accepts_bookings) VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE accepts_bookings = VALUES(accepts_bookings)');
    foreach ($assignedIds as $id) $stmt->execute([$vetId, $id, $accepts[$id] ?? 0]);
    $pdo->prepare('DELETE FROM veterinarian_working_hours WHERE veterinarian_user_id = ?')->execute([$vetId]);
    $stmt = $pdo->prepare('INSERT INTO veterinarian_working_hours (veterinarian_user_id, branch_id, day_of_week, starts_at, ends_at) VALUES (?, ?, ?, ?, ?)');
    foreach ($normalizedHours as $row) $stmt->execute([$vetId, $row['branchId'], $row['dayOfWeek'], $row['startsAt'], $row['endsAt']]);
    // Retain past time-off history; replace only upcoming entries.
    $pdo->prepare('DELETE FROM veterinarian_booking_time_off WHERE veterinarian_user_id = ? AND ends_at > NOW()')->execute([$vetId]);
    $stmt = $pdo->prepare('INSERT INTO veterinarian_booking_time_off (veterinarian_user_id, starts_at, ends_at, notes) VALUES (?, ?, ?, ?)');
    foreach ($normalizedLeaves as $row) $stmt->execute([$vetId, ...$row]);

    $afterRoster = clinic_booking_roster($pdo);
    $afterLeave = clinic_booking_time_off($pdo, date('Y-m-d'), '9999-12-30');
    $reservations = clinic_booking_reservations($pdo, date('Y-m-d'), '9999-12-30', true);
    foreach ($reservations as $booking) {
        if (!in_array(strtolower($booking['status']), ['pending', 'confirmed'], true)) continue;
        $interval = clinic_booking_interval($booking);
        if (!$interval || $interval[1] <= time()) continue;
        $key = booking_slot_service_key($booking['service_type'], $booking['is_home_service'], $booking['is_online_consultation']);
        $assignedVet = (int)($booking['veterinarian_id'] ?? 0);
        if ($assignedVet === $vetId) {
            $capacity = clinic_booking_capacity_from_rows($afterRoster, [], $afterLeave, (int)$booking['branch_id'], $booking['booking_date'], $booking['booking_time'], $key, $vetId);
            if ($capacity['availableCount'] === 0) throw new DomainException('This change would remove availability for booking #' . $booking['booking_id'] . '. Reassign or reschedule that appointment first.');
        } elseif ($assignedVet === 0) {
            $before = clinic_booking_capacity_from_rows($beforeRoster, $reservations, $beforeLeave, (int)$booking['branch_id'], $booking['booking_date'], $booking['booking_time'], $key, null, (int)$booking['booking_id']);
            $after = clinic_booking_capacity_from_rows($afterRoster, $reservations, $afterLeave, (int)$booking['branch_id'], $booking['booking_date'], $booking['booking_time'], $key, null, (int)$booking['booking_id']);
            if ($after['availableCount'] === 0 && ($before['availableCount'] > 0 || $after['capacity'] < $before['capacity'])) throw new DomainException('This change would leave an existing appointment without a veterinarian. Assign or reschedule booking #' . $booking['booking_id'] . ' first.');
        }
    }
    $data = vet_booking_schedule_data($pdo, $vetId, $role === 'super_admin');
    $pdo->commit();
    booking_slot_release($pdo, $calendarLock);
    $calendarLock = null;
    echo json_encode(['success' => true, 'message' => 'Clinic booking preferences and working schedule saved.', ...$data]);
} catch (Throwable $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    booking_slot_release($pdo, $calendarLock);
    $status = $error instanceof InvalidArgumentException ? 422 : ($error instanceof DomainException ? 409 : 500);
    if ($status === 500) error_log('Veterinarian booking schedule: ' . $error->getMessage());
    http_response_code($status);
    echo json_encode(['success' => false, 'message' => $status === 500 ? 'The working schedule could not be saved. Try again.' : $error->getMessage()]);
}
