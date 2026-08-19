<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/workflow_guard_helpers.php';
require_once __DIR__ . '/branch_helpers.php';
require_once __DIR__ . '/notification_helpers.php';

header('Content-Type: application/json');

function vet_visit_normalize_services($value): array
{
    if (!is_array($value)) {
        return [];
    }
    $allowed = ['vaccination', 'lab-testing', 'parasite-control'];
    return array_values(array_unique(array_filter(array_map(
        static fn($item) => branch_service_key((string)$item),
        $value
    ), static fn($item) => in_array($item, $allowed, true))));
}

try {
    branch_require_schema($pdo);
    $currentUser = ipawcus_guard_current_user($pdo);
    $role = ipawcus_guard_role($currentUser);
    $currentUserId = ipawcus_guard_user_id($currentUser);

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $branchId = isset($_GET['branchId']) && is_numeric($_GET['branchId']) ? (int)$_GET['branchId'] : null;
        $veterinarianId = isset($_GET['veterinarianId']) && is_numeric($_GET['veterinarianId'])
            ? (int)$_GET['veterinarianId']
            : null;
        $from = trim((string)($_GET['from'] ?? date('Y-m-d')));
        $to = trim((string)($_GET['to'] ?? date('Y-m-d', strtotime('+90 days'))));
        $where = ["DATE(schedule.starts_at) BETWEEN ? AND ?", "b.branch_code IN ('MAIN', 'ENRIQUEZ')"];
        $params = [$from, $to];
        if ($branchId) {
            $where[] = 'schedule.branch_id = ?';
            $params[] = $branchId;
        }
        if ($veterinarianId) {
            $where[] = 'schedule.veterinarian_user_id = ?';
            $params[] = $veterinarianId;
        }
        $stmt = $pdo->prepare("
            SELECT schedule.*, b.branch_code, b.branch_name,
                   CONCAT(u.first_Name, ' ', u.last_Name) AS veterinarian_name
            FROM veterinarian_branch_schedules schedule
            JOIN branches b ON b.branch_id = schedule.branch_id
            JOIN users u ON u.user_id = schedule.veterinarian_user_id
            WHERE " . implode(' AND ', $where) . "
            ORDER BY schedule.starts_at, b.branch_name, veterinarian_name
        ");
        $stmt->execute($params);
        $rows = array_map(static function (array $row): array {
            $services = json_decode((string)($row['service_keys'] ?? ''), true);
            return [
                'id' => (int)$row['visit_schedule_id'],
                'branchId' => (int)$row['branch_id'],
                'branchCode' => $row['branch_code'],
                'branchName' => $row['branch_name'],
                'veterinarianUserId' => (int)$row['veterinarian_user_id'],
                'veterinarianName' => trim((string)$row['veterinarian_name']),
                'startsAt' => $row['starts_at'],
                'endsAt' => $row['ends_at'],
                'serviceKeys' => is_array($services) ? $services : [],
                'appointmentCapacity' => $row['appointment_capacity'] !== null ? (int)$row['appointment_capacity'] : null,
                'notes' => $row['notes'],
                'status' => $row['status'],
            ];
        }, $stmt->fetchAll(PDO::FETCH_ASSOC));
        echo json_encode(['schedules' => $rows]);
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'POST' && $_SERVER['REQUEST_METHOD'] !== 'PATCH') {
        http_response_code(405);
        echo json_encode(['message' => 'Method not allowed.']);
        exit;
    }

    if (!in_array($role, ['veterinarian', 'super_admin'], true)) {
        http_response_code(403);
        echo json_encode(['message' => 'Only veterinarians and Super Admin may publish veterinarian visits.']);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true) ?: [];
    $scheduleId = isset($input['id']) && is_numeric($input['id']) ? (int)$input['id'] : null;
    $wasExisting = $scheduleId !== null;
    $existing = null;
    $status = trim((string)($input['status'] ?? 'published'));
    if (!in_array($status, ['published', 'cancelled', 'completed'], true)) {
        throw new InvalidArgumentException('Invalid visit schedule status.');
    }

    if ($_SERVER['REQUEST_METHOD'] === 'PATCH') {
        if (!$scheduleId) {
            throw new InvalidArgumentException('Visit schedule ID is required.');
        }
        $findStmt = $pdo->prepare('SELECT * FROM veterinarian_branch_schedules WHERE visit_schedule_id = ? LIMIT 1');
        $findStmt->execute([$scheduleId]);
        $existing = $findStmt->fetch(PDO::FETCH_ASSOC);
        if (!$existing) {
            http_response_code(404);
            echo json_encode(['message' => 'Veterinarian visit schedule was not found.']);
            exit;
        }
        if ($role === 'veterinarian' && (int)$existing['veterinarian_user_id'] !== $currentUserId) {
            http_response_code(403);
            echo json_encode(['message' => 'You can update only your own visit schedule.']);
            exit;
        }
    }

    $veterinarianId = $role === 'veterinarian'
        ? $currentUserId
        : (int)($input['veterinarianUserId'] ?? ($existing['veterinarian_user_id'] ?? 0));
    $branchId = (int)($input['branchId'] ?? ($existing['branch_id'] ?? 0));
    $startsAt = trim((string)($input['startsAt'] ?? ($existing['starts_at'] ?? '')));
    $endsAt = trim((string)($input['endsAt'] ?? ($existing['ends_at'] ?? '')));
    $serviceKeys = vet_visit_normalize_services($input['serviceKeys'] ?? json_decode((string)($existing['service_keys'] ?? ''), true));
    $capacity = isset($input['appointmentCapacity']) && $input['appointmentCapacity'] !== ''
        ? max(1, (int)$input['appointmentCapacity'])
        : ($existing['appointment_capacity'] ?? null);
    $notes = trim((string)($input['notes'] ?? ($existing['notes'] ?? '')));

    $branch = branch_fetch($pdo, $branchId);
    if (!$branch || $branch['branch_type'] !== 'pet_corner') {
        throw new InvalidArgumentException('Select an active VFC Pet Corner for the veterinarian visit.');
    }
    if ($veterinarianId <= 0 || strtotime($startsAt) === false || strtotime($endsAt) === false || strtotime($endsAt) <= strtotime($startsAt)) {
        throw new InvalidArgumentException('Veterinarian, start time, and a later end time are required.');
    }
    $vetAccountStmt = $pdo->prepare("
        SELECT u.role, COALESCE(vp.is_active, 0) AS is_active
        FROM users u
        LEFT JOIN veterinarian_profiles vp ON vp.user_id = u.user_id
        WHERE u.user_id = ?
        LIMIT 1
    ");
    $vetAccountStmt->execute([$veterinarianId]);
    $vetAccount = $vetAccountStmt->fetch(PDO::FETCH_ASSOC);
    if (
        !$vetAccount
        || branch_normalize_role($vetAccount['role'] ?? '') !== 'veterinarian'
        || (int)($vetAccount['is_active'] ?? 0) !== 1
    ) {
        throw new InvalidArgumentException('Select an active veterinarian for this branch visit.');
    }
    if (date('Y-m-d', strtotime($startsAt)) !== date('Y-m-d', strtotime($endsAt))) {
        throw new InvalidArgumentException('A branch visit must start and end on the same day.');
    }
    if ((int)date('N', strtotime($startsAt)) === 7) {
        throw new InvalidArgumentException('Veterinarian branch visits cannot be scheduled on Sunday because all clinic locations are closed.');
    }
    if (date('H:i:s', strtotime($startsAt)) < '08:00:00' || date('H:i:s', strtotime($endsAt)) > '18:00:00') {
        throw new InvalidArgumentException('Veterinarian visits must be scheduled between 8:00 AM and 6:00 PM.');
    }
    if ($status === 'published' && strtotime($endsAt) <= time()) {
        throw new InvalidArgumentException('A published veterinarian visit must end in the future.');
    }
    if (!$serviceKeys) {
        $serviceKeys = ['vaccination', 'lab-testing', 'parasite-control'];
    }

    $overlapStmt = $pdo->prepare("
        SELECT visit_schedule_id FROM veterinarian_branch_schedules
        WHERE veterinarian_user_id = ?
          AND status = 'published'
          AND starts_at < ? AND ends_at > ?
          AND visit_schedule_id <> ?
        LIMIT 1
    ");
    $overlapStmt->execute([$veterinarianId, $endsAt, $startsAt, $scheduleId ?: 0]);
    if ($status === 'published' && $overlapStmt->fetchColumn()) {
        http_response_code(409);
        echo json_encode(['message' => 'This veterinarian already has an overlapping branch visit.']);
        exit;
    }

    if ($scheduleId) {
        $stmt = $pdo->prepare("
            UPDATE veterinarian_branch_schedules
            SET branch_id = ?, starts_at = ?, ends_at = ?, service_keys = ?,
                appointment_capacity = ?, notes = ?, status = ?
            WHERE visit_schedule_id = ?
        ");
        $stmt->execute([$branchId, $startsAt, $endsAt, json_encode($serviceKeys), $capacity, $notes ?: null, $status, $scheduleId]);
    } else {
        $stmt = $pdo->prepare("
            INSERT INTO veterinarian_branch_schedules
                (veterinarian_user_id, branch_id, starts_at, ends_at, service_keys,
                 appointment_capacity, notes, status, created_by_user_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([$veterinarianId, $branchId, $startsAt, $endsAt, json_encode($serviceKeys), $capacity, $notes ?: null, $status, $currentUserId]);
        $scheduleId = (int)$pdo->lastInsertId();
    }

    $vetStmt = $pdo->prepare("SELECT CONCAT(first_Name, ' ', last_Name) FROM users WHERE user_id = ?");
    $vetStmt->execute([$veterinarianId]);
    $vetName = trim((string)$vetStmt->fetchColumn()) ?: 'A veterinarian';
    $scheduleLabel = date('M j, Y g:i A', strtotime($startsAt)) . ' - ' . date('g:i A', strtotime($endsAt));
    $eventLabel = $status === 'cancelled' ? 'cancelled' : ($wasExisting ? 'updated' : 'published');
    foreach (branch_admin_recipient_ids($pdo, $branchId, false) as $adminUserId) {
        notification_create_event($pdo, [
            'user_id' => $adminUserId,
            'branch_id' => $branchId,
            'type' => 'veterinarian_branch_visit',
            'category' => 'booking_updates',
            'title' => 'Veterinarian branch visit ' . $eventLabel,
            'message' => "{$vetName} is scheduled at {$branch['branch_name']} on {$scheduleLabel}.",
            'push_message' => "{$vetName}: {$branch['branch_name']}, {$scheduleLabel}.",
            'redirect_path' => '/dashboard/todos',
            'dedupe_key' => "vet-branch-visit-{$scheduleId}-{$status}-" . date('YmdHis'),
            'force_in_app' => true,
        ]);
    }

    echo json_encode(['success' => true, 'id' => $scheduleId, 'message' => 'Veterinarian visit schedule saved and branch admins notified.']);
} catch (Throwable $e) {
    http_response_code($e instanceof InvalidArgumentException ? 422 : 500);
    echo json_encode(['message' => $e->getMessage()]);
}
