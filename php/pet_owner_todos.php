<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/booking_maintenance.php';
require_once __DIR__ . '/workflow_guard_helpers.php';

header('Content-Type: application/json');

function pet_owner_todos_input(): array
{
    return json_decode(file_get_contents('php://input'), true) ?: [];
}

function pet_owner_todos_error(int $status, string $message): void
{
    http_response_code($status);
    echo json_encode(['success' => false, 'message' => $message]);
    exit;
}

function pet_owner_todos_table_exists(PDO $pdo, string $tableName): bool
{
    $stmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM information_schema.tables
        WHERE table_schema = DATABASE()
          AND table_name = ?
    ");
    $stmt->execute([$tableName]);

    return (int)$stmt->fetchColumn() > 0;
}

function pet_owner_todos_ensure_schema(PDO $pdo): void
{
    if (!pet_owner_todos_table_exists($pdo, 'pet_owner_todos')) {
        pet_owner_todos_error(500, 'pet_owner_todos table is missing. Run the approved deployment SQL before using custom todos.');
    }

    $stmt = $pdo->prepare("
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 'pet_owner_todos'
    ");
    $stmt->execute();
    $columns = array_flip(array_map('strval', $stmt->fetchAll(PDO::FETCH_COLUMN) ?: []));
    $missingColumns = [];

    foreach ([
        'todo_id',
        'user_id',
        'title',
        'details',
        'category',
        'start_at',
        'end_at',
        'status',
        'completed_at',
        'created_at',
        'updated_at',
    ] as $columnName) {
        if (!isset($columns[$columnName])) {
            $missingColumns[] = $columnName;
        }
    }

    if (!empty($missingColumns)) {
        pet_owner_todos_error(
            500,
            'pet_owner_todos table is missing required columns: ' . implode(', ', $missingColumns) . '. Run the approved deployment SQL.'
        );
    }
}

function pet_owner_todos_user_id(array $input = []): int
{
    return (int)($_GET['userId'] ?? $_GET['user_id'] ?? $input['userId'] ?? $input['user_id'] ?? 0);
}

function pet_owner_todos_current_user(PDO $pdo): array
{
    static $currentUser = null;

    if (is_array($currentUser)) {
        return $currentUser;
    }

    $currentUser = ipawcus_guard_current_user($pdo);
    return $currentUser;
}

function pet_owner_todos_effective_user_id(PDO $pdo, array $input = []): int
{
    $user = pet_owner_todos_current_user($pdo);
    $currentUserId = ipawcus_guard_user_id($user);
    $role = ipawcus_guard_role($user);
    $requestedUserId = pet_owner_todos_user_id($input);

    if (ipawcus_guard_is_admin_role($role) && $requestedUserId > 0) {
        return $requestedUserId;
    }

    if ($requestedUserId > 0 && $requestedUserId !== $currentUserId) {
        pet_owner_todos_error(403, 'You are not allowed to access another user\'s tasks.');
    }

    return $currentUserId;
}

function pet_owner_todos_normalize_role(?string $role): string
{
    return strtolower(str_replace(['_', '-'], ' ', trim((string)$role)));
}

function pet_owner_todos_user_role(PDO $pdo, int $userId): string
{
    $user = pet_owner_todos_current_user($pdo);
    $currentUserId = ipawcus_guard_user_id($user);
    if ($currentUserId === $userId) {
        return pet_owner_todos_normalize_role($user['role'] ?? $user['normalized_role'] ?? '');
    }

    $stmt = $pdo->prepare("SELECT role FROM users WHERE user_id = ? LIMIT 1");
    $stmt->execute([$userId]);

    return pet_owner_todos_normalize_role($stmt->fetchColumn() ?: '');
}

function pet_owner_todos_is_veterinarian_role(string $role): bool
{
    return $role === 'vet' || str_contains($role, 'veterinarian');
}

function pet_owner_todos_datetime($value): ?string
{
    $text = trim((string)($value ?? ''));
    if ($text === '') {
        return null;
    }

    $timestamp = strtotime($text);
    if ($timestamp === false) {
        return null;
    }

    return date('Y-m-d H:i:s', $timestamp);
}

function pet_owner_todos_range(): array
{
    $rawStart = trim((string)($_GET['start'] ?? ''));
    $rawEnd = trim((string)($_GET['end'] ?? ''));
    $start = pet_owner_todos_datetime($rawStart !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $rawStart) ? "{$rawStart} 00:00:00" : $rawStart) ?: date('Y-m-01 00:00:00');
    $end = pet_owner_todos_datetime($rawEnd !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $rawEnd) ? "{$rawEnd} 23:59:59" : $rawEnd) ?: date('Y-m-t 23:59:59');

    if (strtotime($end) < strtotime($start)) {
        $end = date('Y-m-d 23:59:59', strtotime($start));
    }

    return [$start, $end];
}

function pet_owner_todos_service_label(array $booking): string
{
    $type = trim((string)($booking['service_type'] ?? 'Booking'));
    $normalized = strtolower($type);
    if (in_array($normalized, ['general-checkup', 'general check-up', 'general checkup'], true)) {
        return 'General Check-up';
    }

    if ($type === 'boarding' && !empty($booking['hotel_boarding_type'])) {
        return $booking['hotel_boarding_type'] === 'hotel' ? 'Pet Hotel Boarding' : 'Kennel Boarding';
    }

    return ucwords(str_replace(['_', '-'], ' ', $type));
}

function pet_owner_todos_format_task(array $task): array
{
    return [
        'id' => (string)$task['id'],
        'source' => $task['source'],
        'sourceId' => $task['sourceId'] ?? null,
        'title' => $task['title'],
        'details' => $task['details'] ?? '',
        'category' => $task['category'] ?? 'General',
        'startAt' => $task['startAt'],
        'endAt' => $task['endAt'] ?? null,
        'status' => $task['status'] ?? 'pending',
        'petId' => isset($task['petId']) ? (int)$task['petId'] : null,
        'petShareableId' => $task['petShareableId'] ?? null,
        'petName' => $task['petName'] ?? '',
        'redirectPath' => $task['redirectPath'] ?? '/dashboard/todos',
        'editable' => !empty($task['editable']),
    ];
}

function pet_owner_todos_booking_tasks(PDO $pdo, int $userId, string $start, string $end): array
{
    $stmt = $pdo->prepare("
        SELECT
            b.*,
            COALESCE(p.pet_name, b.unregistered_pet_name, 'Pet') AS pet_name,
            p.pet_sharable_ID
        FROM bookings b
        LEFT JOIN pets_information p ON p.pet_id = b.pet_id
        WHERE b.user_id = ?
          AND b.status IN ('pending','confirmed')
          AND (
              STR_TO_DATE(CONCAT(b.booking_date, ' ', b.booking_time), '%Y-%m-%d %H:%i:%s') BETWEEN ? AND ?
              OR (b.service_type = 'boarding' AND b.check_in_date IS NOT NULL AND b.check_in_date <= DATE(?) AND COALESCE(b.check_out_date, b.check_in_date) >= DATE(?))
          )
        ORDER BY b.booking_date ASC, b.booking_time ASC
    ");
    $stmt->execute([$userId, $start, $end, $end, $start]);

    $tasks = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $booking) {
        $bookingId = (int)$booking['booking_id'];
        $service = pet_owner_todos_service_label($booking);
        $petName = (string)$booking['pet_name'];
        $scheduledAt = trim((string)$booking['booking_date'] . ' ' . (string)$booking['booking_time']);
        $petId = (int)($booking['pet_id'] ?? 0);
        $redirect = $petId > 0 ? "/dashboard/my-pets/{$petId}" : '/dashboard/todos';

        $tasks[] = pet_owner_todos_format_task([
            'id' => "booking-{$bookingId}",
            'source' => 'booking',
            'sourceId' => $bookingId,
            'title' => "{$service} appointment",
            'details' => trim(($booking['booking_number'] ?? '') . " for {$petName}. Status: " . ($booking['status'] ?? 'pending')),
            'category' => 'Booking',
            'startAt' => date('Y-m-d H:i:s', strtotime($scheduledAt)),
            'endAt' => date('Y-m-d H:i:s', strtotime($scheduledAt . ' +1 hour')),
            'status' => $booking['status'] === 'confirmed' ? 'confirmed' : 'pending',
            'petId' => $petId > 0 ? $petId : null,
            'petShareableId' => $booking['pet_sharable_ID'] ?? null,
            'petName' => $petName,
            'redirectPath' => $redirect,
            'editable' => false,
        ]);

        if ($booking['service_type'] === 'boarding' && !empty($booking['check_in_date'])) {
            $checkInAt = date('Y-m-d H:i:s', strtotime($booking['check_in_date'] . ' ' . ($booking['booking_time'] ?: '09:00:00')));
            $checkOutAt = !empty($booking['check_out_date'])
                ? date('Y-m-d 09:00:00', strtotime($booking['check_out_date']))
                : null;

            $tasks[] = pet_owner_todos_format_task([
                'id' => "boarding-stay-{$bookingId}",
                'source' => 'boarding',
                'sourceId' => $bookingId,
                'title' => "{$service} stay",
                'details' => $checkOutAt ? "Check-out target: " . date('F j, Y', strtotime($checkOutAt)) : 'Check-out date is not set.',
                'category' => 'Boarding',
                'startAt' => $checkInAt,
                'endAt' => $checkOutAt,
                'status' => $booking['status'] === 'confirmed' ? 'confirmed' : 'pending',
                'petId' => $petId > 0 ? $petId : null,
                'petShareableId' => $booking['pet_sharable_ID'] ?? null,
                'petName' => $petName,
                'redirectPath' => $redirect,
                'editable' => false,
            ]);
        }
    }

    return $tasks;
}

function pet_owner_todos_personal_tasks(PDO $pdo, int $userId, string $start, string $end): array
{
    $stmt = $pdo->prepare("
        SELECT *
        FROM pet_owner_todos
        WHERE user_id = ?
          AND status <> 'cancelled'
          AND start_at BETWEEN ? AND ?
        ORDER BY start_at ASC, todo_id ASC
    ");
    $stmt->execute([$userId, $start, $end]);

    return array_map(function ($todo) {
        return pet_owner_todos_format_task([
            'id' => 'personal-' . (int)$todo['todo_id'],
            'source' => 'personal',
            'sourceId' => (int)$todo['todo_id'],
            'title' => $todo['title'],
            'details' => $todo['details'] ?? '',
            'category' => $todo['category'],
            'startAt' => $todo['start_at'],
            'endAt' => $todo['end_at'],
            'status' => $todo['status'],
            'petName' => '',
            'redirectPath' => '/dashboard/todos',
            'editable' => true,
        ]);
    }, $stmt->fetchAll(PDO::FETCH_ASSOC));
}

function pet_owner_todos_diagnosis_tasks(PDO $pdo, int $userId, string $start, string $end): array
{
    if (!pet_owner_todos_table_exists($pdo, 'vet_diagnoses')) {
        return [];
    }

    $stmt = $pdo->prepare("
        SELECT
            vd.diagnosis_id,
            vd.pet_id,
            vd.follow_up_date,
            vd.service_name,
            vd.diagnosis,
            COALESCE(p.pet_name, 'Pet') AS pet_name,
            p.pet_sharable_ID
        FROM vet_diagnoses vd
        JOIN pets_information p ON p.pet_id = vd.pet_id
        LEFT JOIN bookings b ON b.booking_id = vd.booking_id
        LEFT JOIN queues q ON q.queue_id = vd.queue_id
        LEFT JOIN pet_ownership po ON po.pet_id = vd.pet_id
        WHERE vd.follow_up_date IS NOT NULL
          AND COALESCE(b.user_id, q.user_id, po.user_id) = ?
          AND vd.follow_up_date BETWEEN DATE(?) AND DATE(?)
        ORDER BY vd.follow_up_date ASC
    ");
    $stmt->execute([$userId, $start, $end]);

    return array_map(function ($row) {
        $diagnosisId = (int)$row['diagnosis_id'];
        $petId = (int)$row['pet_id'];
        $followUpAt = date('Y-m-d 09:00:00', strtotime($row['follow_up_date']));

        return pet_owner_todos_format_task([
            'id' => "diagnosis-follow-up-{$diagnosisId}",
            'source' => 'diagnosis',
            'sourceId' => $diagnosisId,
            'title' => 'Diagnosis follow-up',
            'details' => trim((string)($row['service_name'] ?: 'Clinic follow-up') . ': ' . (string)($row['diagnosis'] ?? '')),
            'category' => 'Follow-up',
            'startAt' => $followUpAt,
            'endAt' => date('Y-m-d H:i:s', strtotime($followUpAt . ' +30 minutes')),
            'status' => 'pending',
            'petId' => $petId,
            'petShareableId' => $row['pet_sharable_ID'] ?? null,
            'petName' => $row['pet_name'],
            'redirectPath' => "/dashboard/my-pets/{$petId}",
            'editable' => false,
        ]);
    }, $stmt->fetchAll(PDO::FETCH_ASSOC));
}

function pet_owner_todos_payment_tasks(PDO $pdo, int $userId): array
{
    if (
        !pet_owner_todos_table_exists($pdo, 'visits')
        || !pet_owner_todos_table_exists($pdo, 'visit_charges')
        || !pet_owner_todos_table_exists($pdo, 'visit_payments')
    ) {
        return [];
    }

    $stmt = $pdo->prepare("
        SELECT
            v.visit_id,
            v.pet_id,
            v.created_at,
            COALESCE(p.pet_name, 'Pet') AS pet_name,
            p.pet_sharable_ID,
            b.booking_number,
            COALESCE(charges.total_charges, 0) AS total_charges,
            COALESCE(payments.total_paid, 0) AS total_paid
        FROM visits v
        JOIN pets_information p ON p.pet_id = v.pet_id
        LEFT JOIN bookings b ON b.booking_id = v.booking_id
        LEFT JOIN (
            SELECT visit_id, SUM(subtotal) AS total_charges
            FROM visit_charges
            GROUP BY visit_id
        ) charges ON charges.visit_id = v.visit_id
        LEFT JOIN (
            SELECT visit_id, SUM(amount) AS total_paid
            FROM visit_payments
            WHERE payment_status = 'verified'
            GROUP BY visit_id
        ) payments ON payments.visit_id = v.visit_id
        WHERE v.owner_user_id = ?
          AND v.billing_status IN ('unpaid','partial')
        HAVING total_charges > total_paid
        ORDER BY v.updated_at DESC
        LIMIT 50
    ");
    $stmt->execute([$userId]);

    return array_map(function ($row) {
        $visitId = (int)$row['visit_id'];
        $petId = (int)($row['pet_id'] ?? 0);
        $balance = max(0, (float)$row['total_charges'] - (float)$row['total_paid']);

        return pet_owner_todos_format_task([
            'id' => "payment-{$visitId}",
            'source' => 'payment',
            'sourceId' => $visitId,
            'title' => 'Payment balance due',
            'details' => 'Balance: PHP ' . number_format($balance, 2) . ($row['booking_number'] ? ' for ' . $row['booking_number'] : ''),
            'category' => 'Payment',
            'startAt' => $row['created_at'],
            'endAt' => null,
            'status' => 'pending',
            'petId' => $petId > 0 ? $petId : null,
            'petShareableId' => $row['pet_sharable_ID'] ?? null,
            'petName' => $row['pet_name'],
            'redirectPath' => $petId > 0 ? "/dashboard/my-pets/{$petId}" : '/dashboard/todos',
            'editable' => false,
        ]);
    }, $stmt->fetchAll(PDO::FETCH_ASSOC));
}

function pet_owner_todos_boarding_tasks(PDO $pdo, int $userId, string $start, string $end): array
{
    if (!pet_owner_todos_table_exists($pdo, 'boarding_tasks')) {
        return [];
    }

    $stmt = $pdo->prepare("
        SELECT
            bt.*,
            COALESCE(bt.pet_id, b.pet_id) AS todo_pet_id,
            COALESCE(p.pet_name, b.unregistered_pet_name, 'Pet') AS pet_name,
            p.pet_sharable_ID,
            b.booking_number
        FROM boarding_tasks bt
        JOIN bookings b ON b.booking_id = bt.booking_id
        LEFT JOIN pets_information p ON p.pet_id = COALESCE(bt.pet_id, b.pet_id)
        WHERE b.user_id = ?
          AND bt.status <> 'cancelled'
          AND bt.due_at BETWEEN ? AND ?
        ORDER BY bt.due_at ASC
    ");
    $stmt->execute([$userId, $start, $end]);

    return array_map(function ($row) {
        $taskId = (int)$row['task_id'];
        $petId = (int)($row['todo_pet_id'] ?? 0);
        $type = ucwords(str_replace('_', ' ', (string)$row['task_type']));

        return pet_owner_todos_format_task([
            'id' => "boarding-task-{$taskId}",
            'source' => 'boarding_task',
            'sourceId' => $taskId,
            'title' => "Boarding {$type}",
            'details' => trim((string)($row['booking_number'] ?? '') . ' ' . (string)($row['notes'] ?? '')),
            'category' => 'Boarding',
            'startAt' => $row['due_at'],
            'endAt' => null,
            'status' => $row['status'],
            'petId' => $petId > 0 ? $petId : null,
            'petShareableId' => $row['pet_sharable_ID'] ?? null,
            'petName' => $row['pet_name'],
            'redirectPath' => $petId > 0 ? "/dashboard/my-pets/{$petId}" : '/dashboard/todos',
            'editable' => false,
        ]);
    }, $stmt->fetchAll(PDO::FETCH_ASSOC));
}

function pet_owner_todos_vet_online_consultation_tasks(PDO $pdo, int $userId, string $start, string $end): array
{
    if (
        !pet_owner_todos_table_exists($pdo, 'online_consultations')
        || !pet_owner_todos_table_exists($pdo, 'bookings')
    ) {
        return [];
    }

    $stmt = $pdo->prepare("
        SELECT
            oc.online_consultation_id,
            oc.scheduled_start,
            oc.scheduled_end,
            oc.status,
            b.booking_number,
            COALESCE(p.pet_name, b.unregistered_pet_name, 'Pet') AS pet_name,
            p.pet_sharable_ID,
            b.pet_id,
            CONCAT(owner.first_Name, ' ', owner.last_Name) AS owner_name
        FROM online_consultations oc
        JOIN bookings b ON b.booking_id = oc.booking_id
        LEFT JOIN pets_information p ON p.pet_id = b.pet_id
        LEFT JOIN users owner ON owner.user_id = oc.owner_user_id
        WHERE oc.veterinarian_user_id = ?
          AND oc.status IN ('scheduled', 'vet_ready', 'in_progress')
          AND oc.scheduled_start BETWEEN ? AND ?
        ORDER BY oc.scheduled_start ASC
    ");
    $stmt->execute([$userId, $start, $end]);

    return array_map(function ($row) {
        $consultationId = (int)$row['online_consultation_id'];
        $petId = (int)($row['pet_id'] ?? 0);
        $petName = $row['pet_name'] ?? 'Pet';
        $ownerName = trim((string)($row['owner_name'] ?? 'Pet owner')) ?: 'Pet owner';

        return pet_owner_todos_format_task([
            'id' => "vet-online-consultation-{$consultationId}",
            'source' => 'online_consultation',
            'sourceId' => $consultationId,
            'title' => 'Online consultation appointment',
            'details' => trim(($row['booking_number'] ?? '') . " for {$petName}. Owner: {$ownerName}. Status: " . ($row['status'] ?? 'scheduled')),
            'category' => 'Online Consultation',
            'startAt' => $row['scheduled_start'],
            'endAt' => $row['scheduled_end'],
            'status' => $row['status'] ?? 'scheduled',
            'petId' => $petId > 0 ? $petId : null,
            'petShareableId' => $row['pet_sharable_ID'] ?? null,
            'petName' => $petName,
            'redirectPath' => '/dashboard/vet/online-consultations',
            'editable' => false,
        ]);
    }, $stmt->fetchAll(PDO::FETCH_ASSOC));
}

function pet_owner_todos_vet_follow_up_tasks(PDO $pdo, int $userId, string $start, string $end): array
{
    if (!pet_owner_todos_table_exists($pdo, 'vet_diagnoses')) {
        return [];
    }

    $stmt = $pdo->prepare("
        SELECT
            vd.diagnosis_id,
            vd.pet_id,
            vd.follow_up_date,
            vd.service_name,
            vd.diagnosis,
            COALESCE(p.pet_name, 'Pet') AS pet_name,
            p.pet_sharable_ID
        FROM vet_diagnoses vd
        JOIN pets_information p ON p.pet_id = vd.pet_id
        WHERE vd.veterinarian_user_id = ?
          AND vd.follow_up_date IS NOT NULL
          AND vd.follow_up_date BETWEEN DATE(?) AND DATE(?)
        ORDER BY vd.follow_up_date ASC
    ");
    $stmt->execute([$userId, $start, $end]);

    return array_map(function ($row) {
        $diagnosisId = (int)$row['diagnosis_id'];
        $petId = (int)$row['pet_id'];
        $followUpAt = date('Y-m-d 09:00:00', strtotime($row['follow_up_date']));
        $petName = $row['pet_name'] ?? 'Pet';

        return pet_owner_todos_format_task([
            'id' => "vet-follow-up-{$diagnosisId}",
            'source' => 'vet_follow_up',
            'sourceId' => $diagnosisId,
            'title' => "Follow-up recording for {$petName}",
            'details' => trim((string)($row['service_name'] ?: 'Clinic follow-up') . ': ' . (string)($row['diagnosis'] ?? '')),
            'category' => 'Follow-up',
            'startAt' => $followUpAt,
            'endAt' => date('Y-m-d H:i:s', strtotime($followUpAt . ' +30 minutes')),
            'status' => 'pending',
            'petId' => $petId,
            'petShareableId' => $row['pet_sharable_ID'] ?? null,
            'petName' => $petName,
            'redirectPath' => '/dashboard/vet/histories',
            'editable' => false,
        ]);
    }, $stmt->fetchAll(PDO::FETCH_ASSOC));
}

function pet_owner_todos_summary(array $tasks): array
{
    $now = time();
    $today = date('Y-m-d');
    $summary = [
        'total' => count($tasks),
        'today' => 0,
        'overdue' => 0,
        'upcoming' => 0,
        'personal' => 0,
        'clinic' => 0,
        'payments' => 0,
    ];

    foreach ($tasks as $task) {
        $timestamp = strtotime($task['startAt']);
        $isDone = in_array($task['status'], ['completed', 'cancelled'], true);

        if ($task['source'] === 'personal') {
            $summary['personal']++;
        } else {
            $summary['clinic']++;
        }

        if ($task['source'] === 'payment') {
            $summary['payments']++;
        }

        if (date('Y-m-d', $timestamp) === $today) {
            $summary['today']++;
        }

        if (!$isDone && $timestamp < $now) {
            $summary['overdue']++;
        } elseif (!$isDone && $timestamp >= $now) {
            $summary['upcoming']++;
        }
    }

    return $summary;
}

function pet_owner_todos_list(PDO $pdo): void
{
    pet_owner_todos_ensure_schema($pdo);
    runLifecycleMaintenance($pdo);

    $userId = pet_owner_todos_effective_user_id($pdo);
    if ($userId <= 0) {
        pet_owner_todos_error(400, 'userId is required.');
    }

    [$start, $end] = pet_owner_todos_range();
    $role = pet_owner_todos_user_role($pdo, $userId);

    if (pet_owner_todos_is_veterinarian_role($role)) {
        $tasks = array_merge(
            pet_owner_todos_personal_tasks($pdo, $userId, $start, $end),
            pet_owner_todos_vet_online_consultation_tasks($pdo, $userId, $start, $end),
            pet_owner_todos_vet_follow_up_tasks($pdo, $userId, $start, $end)
        );
    } else {
        $tasks = array_merge(
            pet_owner_todos_booking_tasks($pdo, $userId, $start, $end),
            pet_owner_todos_personal_tasks($pdo, $userId, $start, $end),
            pet_owner_todos_diagnosis_tasks($pdo, $userId, $start, $end),
            pet_owner_todos_payment_tasks($pdo, $userId),
            pet_owner_todos_boarding_tasks($pdo, $userId, $start, $end)
        );
    }

    usort($tasks, fn($left, $right) => strtotime($left['startAt']) <=> strtotime($right['startAt']));

    echo json_encode([
        'success' => true,
        'tasks' => $tasks,
        'summary' => pet_owner_todos_summary($tasks),
    ]);
}

function pet_owner_todos_create(PDO $pdo): void
{
    pet_owner_todos_ensure_schema($pdo);

    $input = pet_owner_todos_input();
    $userId = pet_owner_todos_effective_user_id($pdo, $input);
    $title = trim((string)($input['title'] ?? ''));
    $startAt = pet_owner_todos_datetime($input['start_at'] ?? $input['startAt'] ?? null);
    $endAt = pet_owner_todos_datetime($input['end_at'] ?? $input['endAt'] ?? null);
    $category = trim((string)($input['category'] ?? 'Personal Task')) ?: 'Personal Task';
    $details = trim((string)($input['details'] ?? ''));

    if ($userId <= 0) {
        pet_owner_todos_error(400, 'user_id is required.');
    }

    if ($title === '' || $startAt === null) {
        pet_owner_todos_error(400, 'Title and start date are required.');
    }

    $stmt = $pdo->prepare("
        INSERT INTO pet_owner_todos (user_id, title, details, category, start_at, end_at)
        VALUES (?, ?, ?, ?, ?, ?)
    ");
    $stmt->execute([$userId, $title, $details !== '' ? $details : null, $category, $startAt, $endAt]);

    echo json_encode([
        'success' => true,
        'message' => 'Task added.',
        'todoId' => (int)$pdo->lastInsertId(),
    ]);
}

function pet_owner_todos_update(PDO $pdo): void
{
    pet_owner_todos_ensure_schema($pdo);

    $input = pet_owner_todos_input();
    $userId = pet_owner_todos_effective_user_id($pdo, $input);
    $todoId = (int)($_GET['todoId'] ?? $input['todoId'] ?? $input['todo_id'] ?? 0);

    if ($userId <= 0 || $todoId <= 0) {
        pet_owner_todos_error(400, 'user_id and todo_id are required.');
    }

    $fields = [];
    $params = [];

    foreach ([
        'title' => 'title',
        'details' => 'details',
        'category' => 'category',
    ] as $inputKey => $column) {
        if (array_key_exists($inputKey, $input)) {
            $fields[] = "{$column} = ?";
            $params[] = trim((string)$input[$inputKey]);
        }
    }

    if (array_key_exists('startAt', $input) || array_key_exists('start_at', $input)) {
        $startAt = pet_owner_todos_datetime($input['startAt'] ?? $input['start_at'] ?? null);
        if ($startAt === null) {
            pet_owner_todos_error(400, 'A valid start date is required.');
        }
        $fields[] = 'start_at = ?';
        $params[] = $startAt;
    }

    if (array_key_exists('endAt', $input) || array_key_exists('end_at', $input)) {
        $fields[] = 'end_at = ?';
        $params[] = pet_owner_todos_datetime($input['endAt'] ?? $input['end_at'] ?? null);
    }

    if (array_key_exists('status', $input)) {
        $status = trim((string)$input['status']);
        if (!in_array($status, ['pending', 'completed', 'cancelled'], true)) {
            pet_owner_todos_error(400, 'Invalid task status.');
        }
        $fields[] = 'status = ?';
        $params[] = $status;
        $fields[] = 'completed_at = ?';
        $params[] = $status === 'completed' ? date('Y-m-d H:i:s') : null;
    }

    if (empty($fields)) {
        pet_owner_todos_error(400, 'No task changes were provided.');
    }

    $params[] = $todoId;
    $params[] = $userId;
    $stmt = $pdo->prepare("
        UPDATE pet_owner_todos
        SET " . implode(', ', $fields) . "
        WHERE todo_id = ?
          AND user_id = ?
    ");
    $stmt->execute($params);

    echo json_encode(['success' => true, 'message' => 'Task updated.']);
}

function pet_owner_todos_delete(PDO $pdo): void
{
    pet_owner_todos_ensure_schema($pdo);

    $input = pet_owner_todos_input();
    $userId = pet_owner_todos_effective_user_id($pdo, $input);
    $todoId = (int)($_GET['todoId'] ?? $input['todoId'] ?? $input['todo_id'] ?? 0);

    if ($userId <= 0 || $todoId <= 0) {
        pet_owner_todos_error(400, 'user_id and todo_id are required.');
    }

    $stmt = $pdo->prepare("DELETE FROM pet_owner_todos WHERE todo_id = ? AND user_id = ?");
    $stmt->execute([$todoId, $userId]);

    echo json_encode(['success' => true, 'message' => 'Task deleted.']);
}

try {
    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'GET') {
        pet_owner_todos_list($pdo);
    } elseif ($method === 'POST') {
        pet_owner_todos_create($pdo);
    } elseif ($method === 'PATCH') {
        pet_owner_todos_update($pdo);
    } elseif ($method === 'DELETE') {
        pet_owner_todos_delete($pdo);
    } else {
        pet_owner_todos_error(405, 'Method not allowed.');
    }
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Pet owner TODO request failed: ' . $e->getMessage(),
    ]);
}
