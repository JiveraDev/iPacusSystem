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
    return ['veterinarianId' => $vetId, 'canAssignClinics' => $canAssign, 'clinics' => $clinics];
}

$calendarLock = null;
try {
    branch_require_schema($pdo);
    clinic_booking_require_schema($pdo);
    $actor = ipawcus_guard_current_user($pdo);
    $role = ipawcus_guard_role($actor);
    if (!in_array($role, ['veterinarian', 'super_admin'], true)) ipawcus_guard_error(403, 'Only veterinarians and Super Admin can manage clinic booking preferences.');
    $input = json_decode(file_get_contents('php://input'), true) ?: [];
    $vetId = (int)($input['veterinarianId'] ?? $_GET['veterinarianId'] ?? ipawcus_guard_user_id($actor));
    if ($role === 'veterinarian' && $vetId !== ipawcus_guard_user_id($actor)) ipawcus_guard_error(403, 'You can manage only your own booking schedule.');
    $stmt = $pdo->prepare("SELECT user_id FROM users WHERE user_id = ? AND LOWER(REPLACE(REPLACE(TRIM(role), ' ', '_'), '-', '_')) IN ('veterinarian', 'vet')");
    $stmt->execute([$vetId]);
    if (!$stmt->fetchColumn()) throw new InvalidArgumentException('Select a veterinarian account.');

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $data = vet_booking_schedule_data($pdo, $vetId, $role === 'super_admin');
        echo json_encode(['success' => true, ...$data]);
        exit;
    }
    if ($_SERVER['REQUEST_METHOD'] !== 'PUT') { http_response_code(405); echo json_encode(['message' => 'Method not allowed.']); exit; }
    $calendarLock = 'ipawcus_shared_medical_calendar';
    if (!booking_slot_acquire($pdo, $calendarLock)) throw new DomainException('Booking schedules are being updated. Try again shortly.');
    $pdo->beginTransaction();
    $beforeRoster = clinic_booking_roster($pdo);
    $onlineSchedules = clinic_booking_online_schedules($pdo);
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
    if (!is_array($preferences)) throw new InvalidArgumentException('Provide clinic booking preferences.');
    $accepts = [];
    foreach ($preferences as $clinic) {
        if (!is_array($clinic)) throw new InvalidArgumentException('Each clinic preference must include its clinic and acceptance setting.');
        $id = (int)($clinic['id'] ?? 0);
        if (!in_array($id, $assignedIds, true)) throw new InvalidArgumentException('Booking preferences must use your assigned clinics.');
        $accepts[$id] = filter_var($clinic['acceptsBookings'] ?? false, FILTER_VALIDATE_BOOLEAN) ? 1 : 0;
    }
    $pdo->prepare('UPDATE veterinarian_booking_clinics SET accepts_bookings = 0 WHERE veterinarian_user_id = ?')->execute([$vetId]);
    $stmt = $pdo->prepare('INSERT INTO veterinarian_booking_clinics (veterinarian_user_id, branch_id, accepts_bookings) VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE accepts_bookings = VALUES(accepts_bookings)');
    foreach ($assignedIds as $id) $stmt->execute([$vetId, $id, $accepts[$id] ?? 0]);
    $afterRoster = clinic_booking_roster($pdo);
    $reservations = clinic_booking_reservations($pdo, date('Y-m-d'), '9999-12-30', true);
    foreach ($reservations as $booking) {
        if (!in_array(strtolower($booking['status']), ['pending', 'confirmed'], true)) continue;
        $interval = clinic_booking_interval($booking);
        if (!$interval || $interval[1] <= time()) continue;
        $key = booking_slot_service_key($booking['service_type'], $booking['is_home_service'], $booking['is_online_consultation']);
        if ($key === 'online-consultation') continue; // Independent call schedule.
        $assignedVet = (int)($booking['veterinarian_id'] ?? 0);
        if ($assignedVet === $vetId) {
            $capacity = clinic_booking_capacity_from_rows($afterRoster, [], $onlineSchedules, (int)$booking['branch_id'], $booking['booking_date'], $booking['booking_time'], $key, $vetId);
            if ($capacity['availableCount'] === 0) throw new DomainException('This change would remove availability for booking #' . $booking['booking_id'] . '. Reassign or reschedule that appointment first.');
        } elseif ($assignedVet === 0) {
            $before = clinic_booking_capacity_from_rows($beforeRoster, $reservations, $onlineSchedules, (int)$booking['branch_id'], $booking['booking_date'], $booking['booking_time'], $key, null, (int)$booking['booking_id']);
            $after = clinic_booking_capacity_from_rows($afterRoster, $reservations, $onlineSchedules, (int)$booking['branch_id'], $booking['booking_date'], $booking['booking_time'], $key, null, (int)$booking['booking_id']);
            if ($after['availableCount'] === 0 && ($before['availableCount'] > 0 || $after['capacity'] < $before['capacity'])) throw new DomainException('This change would leave an existing appointment without a veterinarian. Assign or reschedule booking #' . $booking['booking_id'] . ' first.');
        }
    }
    $data = vet_booking_schedule_data($pdo, $vetId, $role === 'super_admin');
    $pdo->commit();
    booking_slot_release($pdo, $calendarLock);
    $calendarLock = null;
    echo json_encode(['success' => true, 'message' => 'Clinic booking preferences saved. In-clinic appointments follow the clinic operating schedule.', ...$data]);
} catch (Throwable $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    booking_slot_release($pdo, $calendarLock);
    $status = $error instanceof InvalidArgumentException ? 422 : ($error instanceof DomainException ? 409 : 500);
    if ($status === 500) error_log('Veterinarian booking schedule: ' . $error->getMessage());
    http_response_code($status);
    echo json_encode(['success' => false, 'message' => $status === 500 ? 'Clinic booking preferences could not be saved. Try again.' : $error->getMessage()]);
}
