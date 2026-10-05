<?php

function prescription_table_exists(PDO $pdo, string $tableName): bool
{
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?");
    $stmt->execute([$tableName]);
    return (int)$stmt->fetchColumn() > 0;
}

function prescription_column_exists(PDO $pdo, string $tableName, string $columnName): bool
{
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?");
    $stmt->execute([$tableName, $columnName]);
    return (int)$stmt->fetchColumn() > 0;
}

function prescription_schema_ready(PDO $pdo): bool
{
    foreach (['prescription_plans', 'prescription_items', 'prescription_occurrences', 'prescription_events'] as $tableName) {
        if (!prescription_table_exists($pdo, $tableName)) {
            return false;
        }
    }
    return true;
}

function prescription_schema_message(): string
{
    return 'The prescription schedule schema is missing. Run DDL/20261005_01_pet_prescription_schedules.sql.';
}

function prescription_json_array($value): array
{
    if (is_array($value)) {
        return array_values($value);
    }
    if (!is_string($value) || trim($value) === '') {
        return [];
    }
    $decoded = json_decode($value, true);
    return is_array($decoded) ? array_values($decoded) : [];
}

function prescription_nullable_text($value): ?string
{
    $text = trim((string)($value ?? ''));
    return $text !== '' ? $text : null;
}

function prescription_schedule_type(array $item): string
{
    $type = strtolower(trim((string)($item['scheduleType'] ?? $item['schedule_type'] ?? '')));
    if (in_array($type, ['times_daily', 'interval_hours', 'weekly', 'monthly', 'as_needed'], true)) {
        return $type;
    }

    $frequency = strtolower(trim((string)($item['frequency'] ?? 'per day')));
    return match ($frequency) {
        'per week' => 'weekly',
        'per month' => 'monthly',
        'as needed' => 'as_needed',
        default => 'times_daily',
    };
}

function prescription_default_time_slots(int $times): array
{
    return match (max(1, $times)) {
        1 => ['08:00'],
        2 => ['08:00', '20:00'],
        3 => ['08:00', '13:00', '20:00'],
        4 => ['08:00', '12:00', '16:00', '20:00'],
        default => array_map(
            static fn(int $index): string => sprintf('%02d:00', min(23, 6 + (int)floor($index * (18 / max(1, $times - 1))))),
            range(0, max(1, $times) - 1)
        ),
    };
}

function prescription_normalize_time_slots($value, int $times): array
{
    $slots = prescription_json_array($value);
    $normalized = [];
    foreach ($slots as $slot) {
        $slot = trim((string)$slot);
        if (preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/', $slot)) {
            $normalized[] = $slot;
        }
    }
    $normalized = array_values(array_unique($normalized));
    sort($normalized);
    return $normalized ?: prescription_default_time_slots($times);
}

function prescription_normalize_days($value): array
{
    $days = array_map('intval', prescription_json_array($value));
    $days = array_values(array_unique(array_filter($days, static fn(int $day): bool => $day >= 0 && $day <= 6)));
    sort($days);
    return $days;
}

function prescription_normalize_item(array $item): ?array
{
    $medicine = trim((string)($item['medicine'] ?? $item['name'] ?? ''));
    if ($medicine === '') {
        return null;
    }

    $times = max(1, min(24, (int)($item['times'] ?? $item['timesCount'] ?? $item['times_count'] ?? 1)));
    $durationNumber = max(0, min(3650, (int)($item['durationNumber'] ?? $item['duration_number'] ?? 1)));
    $frequency = strtolower(trim((string)($item['frequency'] ?? 'per day')));
    if (!in_array($frequency, ['per day', 'per week', 'per month', 'as needed'], true)) {
        $frequency = 'per day';
    }
    $durationUnit = strtolower(trim((string)($item['durationUnit'] ?? $item['duration_unit'] ?? 'week')));
    if (!in_array($durationUnit, ['day', 'week', 'month', 'as needed'], true)) {
        $durationUnit = 'week';
    }
    $scheduleType = prescription_schedule_type($item);
    $intervalHours = $scheduleType === 'interval_hours'
        ? max(1, min(168, (int)($item['intervalHours'] ?? $item['interval_hours'] ?? 8)))
        : null;

    return [
        'client_item_key' => prescription_nullable_text($item['id'] ?? $item['clientItemKey'] ?? $item['client_item_key'] ?? null),
        'medicine' => $medicine,
        'dose' => prescription_nullable_text($item['dose'] ?? null),
        'route' => prescription_nullable_text($item['route'] ?? null),
        'times_count' => $times,
        'frequency' => $scheduleType === 'as_needed' ? 'as needed' : $frequency,
        'schedule_type' => $scheduleType,
        'interval_hours' => $intervalHours,
        'time_slots' => $scheduleType === 'interval_hours' || $scheduleType === 'as_needed'
            ? []
            : prescription_normalize_time_slots($item['timeSlots'] ?? $item['time_slots'] ?? [], $times),
        'days_of_week' => $scheduleType === 'weekly'
            ? prescription_normalize_days($item['daysOfWeek'] ?? $item['days_of_week'] ?? [])
            : [],
        'duration_number' => $durationNumber,
        'duration_unit' => $durationUnit,
        'instructions' => prescription_nullable_text($item['instructions'] ?? null),
        'recommended_start_date' => preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)($item['startDate'] ?? $item['recommendedStartDate'] ?? ''))
            ? (string)($item['startDate'] ?? $item['recommendedStartDate'])
            : null,
        'replaces_item_id' => (int)($item['replacesItemId'] ?? $item['replaces_item_id'] ?? 0) ?: null,
    ];
}

function prescription_normalize_items(array $items): array
{
    $normalized = [];
    foreach ($items as $item) {
        if (!is_array($item)) {
            continue;
        }
        $clean = prescription_normalize_item($item);
        if ($clean) {
            $normalized[] = $clean;
        }
    }
    return $normalized;
}

function prescription_flatten_diagnosis_items(array $prescriptions, array $customSections = []): array
{
    $items = $prescriptions;
    foreach ($customSections as $section) {
        if (!is_array($section)) {
            continue;
        }
        foreach (($section['prescriptions'] ?? $section['prescription'] ?? []) as $item) {
            if (is_array($item)) {
                $items[] = $item;
            }
        }
    }
    return prescription_normalize_items($items);
}

function prescription_owner_id(PDO $pdo, int $petId, ?int $preferredOwnerId = null): ?int
{
    if ($preferredOwnerId && $preferredOwnerId > 0) {
        return $preferredOwnerId;
    }
    if (!prescription_table_exists($pdo, 'pet_ownership')) {
        return null;
    }
    $order = prescription_column_exists($pdo, 'pet_ownership', 'is_primary')
        ? 'is_primary DESC, link_id ASC'
        : 'link_id ASC';
    $stmt = $pdo->prepare("SELECT user_id FROM pet_ownership WHERE pet_id = ? ORDER BY {$order} LIMIT 1");
    $stmt->execute([$petId]);
    $ownerId = (int)($stmt->fetchColumn() ?: 0);
    return $ownerId > 0 ? $ownerId : null;
}

function prescription_event(PDO $pdo, int $planId, ?int $itemId, ?int $actorUserId, string $type, array $data = []): void
{
    $stmt = $pdo->prepare("INSERT INTO prescription_events (plan_id, item_id, actor_user_id, event_type, event_data) VALUES (?, ?, ?, ?, ?)");
    $stmt->execute([$planId, $itemId, $actorUserId, $type, $data ? json_encode($data, JSON_UNESCAPED_SLASHES) : null]);
}

function prescription_insert_plan_items(PDO $pdo, int $planId, array $items): void
{
    $stmt = $pdo->prepare("
        INSERT INTO prescription_items (
            plan_id, client_item_key, medicine, dose, route, times_count, frequency,
            schedule_type, interval_hours, time_slots, days_of_week, duration_number,
            duration_unit, instructions, recommended_start_date, replaces_item_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");
    foreach ($items as $item) {
        $stmt->execute([
            $planId,
            $item['client_item_key'],
            $item['medicine'],
            $item['dose'],
            $item['route'],
            $item['times_count'],
            $item['frequency'],
            $item['schedule_type'],
            $item['interval_hours'],
            json_encode($item['time_slots']),
            json_encode($item['days_of_week']),
            $item['duration_number'],
            $item['duration_unit'],
            $item['instructions'],
            $item['recommended_start_date'],
            $item['replaces_item_id'],
        ]);
    }
}

function prescription_sync_plan(
    PDO $pdo,
    int $petId,
    ?int $ownerUserId,
    int $veterinarianUserId,
    string $sourceType,
    int $sourceRecordId,
    array $items,
    string $sourceLabel = ''
): array {
    if (!prescription_schema_ready($pdo) || !$items) {
        return ['planId' => null, 'changed' => false];
    }

    $items = prescription_normalize_items($items);
    if (!$items) {
        return ['planId' => null, 'changed' => false];
    }

    $contentHash = hash('sha256', json_encode($items, JSON_UNESCAPED_SLASHES));
    $stmt = $pdo->prepare("
        SELECT plan_id, version_number, content_hash
        FROM prescription_plans
        WHERE source_type = ? AND source_record_id = ?
        ORDER BY version_number DESC, plan_id DESC
        LIMIT 1
        FOR UPDATE
    ");
    $stmt->execute([$sourceType, $sourceRecordId]);
    $previous = $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
    if ($previous && hash_equals((string)$previous['content_hash'], $contentHash)) {
        return ['planId' => (int)$previous['plan_id'], 'changed' => false];
    }

    $previousPlanId = $previous ? (int)$previous['plan_id'] : null;
    $version = $previous ? (int)$previous['version_number'] + 1 : 1;
    if ($previousPlanId) {
        $pdo->prepare("UPDATE prescription_plans SET status = 'superseded' WHERE plan_id = ?")->execute([$previousPlanId]);
        $pdo->prepare("UPDATE prescription_items SET status = CASE WHEN status = 'completed' THEN status ELSE 'replaced' END WHERE plan_id = ?")->execute([$previousPlanId]);
        $pdo->prepare("
            UPDATE prescription_occurrences occurrence_rows
            JOIN prescription_items item_rows ON item_rows.item_id = occurrence_rows.item_id
            SET occurrence_rows.status = 'cancelled'
            WHERE item_rows.plan_id = ? AND occurrence_rows.status = 'pending'
        ")->execute([$previousPlanId]);
    }

    $ownerUserId = prescription_owner_id($pdo, $petId, $ownerUserId);
    $insert = $pdo->prepare("
        INSERT INTO prescription_plans (
            pet_id, owner_user_id, veterinarian_user_id, source_type, source_record_id,
            source_label, version_number, content_hash, supersedes_plan_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");
    $insert->execute([
        $petId,
        $ownerUserId,
        $veterinarianUserId,
        $sourceType,
        $sourceRecordId,
        prescription_nullable_text($sourceLabel),
        $version,
        $contentHash,
        $previousPlanId,
    ]);
    $planId = (int)$pdo->lastInsertId();
    prescription_insert_plan_items($pdo, $planId, $items);
    prescription_event($pdo, $planId, null, $veterinarianUserId, $previousPlanId ? 'plan_replaced' : 'plan_issued', [
        'version' => $version,
        'itemCount' => count($items),
        'supersedesPlanId' => $previousPlanId,
    ]);

    return ['planId' => $planId, 'changed' => true, 'ownerUserId' => $ownerUserId, 'version' => $version];
}

function prescription_notify_plan(PDO $pdo, int $planId, bool $replacement = false): void
{
    if (!function_exists('notification_create_event')) {
        return;
    }
    $stmt = $pdo->prepare("
        SELECT plan.plan_id, plan.owner_user_id, plan.pet_id, plan.version_number, pet.pet_name, COUNT(item_rows.item_id) AS item_count
        FROM prescription_plans plan
        JOIN pets_information pet ON pet.pet_id = plan.pet_id
        LEFT JOIN prescription_items item_rows ON item_rows.plan_id = plan.plan_id
        WHERE plan.plan_id = ?
        GROUP BY plan.plan_id, plan.owner_user_id, plan.pet_id, plan.version_number, pet.pet_name
    ");
    $stmt->execute([$planId]);
    $plan = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$plan || (int)$plan['owner_user_id'] <= 0) {
        return;
    }
    $petName = trim((string)$plan['pet_name']) ?: 'your pet';
    $title = $replacement ? 'Prescription updated' : 'New prescription';
    $message = $replacement
        ? "The veterinarian updated {$petName}'s prescription. Review the new medication plan."
        : "{$petName} has a new prescription with " . (int)$plan['item_count'] . ' medication item(s). Review and start each schedule.';
    notification_create_event($pdo, [
        'user_id' => (int)$plan['owner_user_id'],
        'type' => $replacement ? 'prescription_updated' : 'prescription_issued',
        'category' => 'schedule_reminders',
        'title' => $title,
        'message' => $message,
        'push_title' => $title,
        'push_message' => $message,
        'redirect_path' => '/dashboard/todos?prescription=' . $planId,
        'dedupe_key' => 'prescription-plan-' . $planId . '-v' . (int)$plan['version_number'],
    ]);
}

function prescription_format_item(array $row): array
{
    return [
        'itemId' => (int)$row['item_id'],
        'planId' => (int)$row['plan_id'],
        'clientItemKey' => $row['client_item_key'],
        'medicine' => $row['medicine'],
        'dose' => $row['dose'],
        'route' => $row['route'],
        'times' => (int)$row['times_count'],
        'frequency' => $row['frequency'],
        'scheduleType' => $row['schedule_type'],
        'intervalHours' => $row['interval_hours'] !== null ? (int)$row['interval_hours'] : null,
        'timeSlots' => prescription_json_array($row['time_slots'] ?? null),
        'daysOfWeek' => prescription_json_array($row['days_of_week'] ?? null),
        'durationNumber' => (int)$row['duration_number'],
        'durationUnit' => $row['duration_unit'],
        'instructions' => $row['instructions'],
        'recommendedStartDate' => $row['recommended_start_date'],
        'startAt' => $row['start_at'],
        'endAt' => $row['end_at'],
        'status' => $row['status'],
        'replacesItemId' => $row['replaces_item_id'] !== null ? (int)$row['replaces_item_id'] : null,
    ];
}

function prescription_fetch_plans(PDO $pdo, ?int $petId = null, ?int $ownerUserId = null, bool $includeHistory = true): array
{
    if (!prescription_schema_ready($pdo)) {
        return [];
    }
    $conditions = [];
    $params = [];
    if ($petId && $petId > 0) {
        $conditions[] = 'plan.pet_id = ?';
        $params[] = $petId;
    }
    if ($ownerUserId && $ownerUserId > 0) {
        $conditions[] = 'EXISTS (SELECT 1 FROM pet_ownership scope WHERE scope.pet_id = plan.pet_id AND scope.user_id = ?)';
        $params[] = $ownerUserId;
    }
    if (!$includeHistory) {
        $conditions[] = "plan.status <> 'superseded'";
    }
    $where = $conditions ? 'WHERE ' . implode(' AND ', $conditions) : '';
    $stmt = $pdo->prepare("
        SELECT plan.*, pet.pet_name,
               TRIM(CONCAT(COALESCE(vet.first_Name, ''), ' ', COALESCE(vet.last_Name, ''))) AS veterinarian_name
        FROM prescription_plans plan
        JOIN pets_information pet ON pet.pet_id = plan.pet_id
        LEFT JOIN users vet ON vet.user_id = plan.veterinarian_user_id
        {$where}
        ORDER BY plan.issued_at DESC, plan.plan_id DESC
    ");
    $stmt->execute($params);
    $plans = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $row['items'] = [];
        $row['occurrences'] = [];
        $plans[(int)$row['plan_id']] = $row;
    }
    if (!$plans) {
        return [];
    }

    $ids = array_keys($plans);
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $itemsStmt = $pdo->prepare("SELECT * FROM prescription_items WHERE plan_id IN ({$placeholders}) ORDER BY item_id ASC");
    $itemsStmt->execute($ids);
    foreach ($itemsStmt->fetchAll(PDO::FETCH_ASSOC) as $item) {
        $plans[(int)$item['plan_id']]['items'][] = prescription_format_item($item);
    }
    $occurrenceStmt = $pdo->prepare("
        SELECT occurrence_rows.*, item_rows.plan_id
        FROM prescription_occurrences occurrence_rows
        JOIN prescription_items item_rows ON item_rows.item_id = occurrence_rows.item_id
        WHERE item_rows.plan_id IN ({$placeholders})
          AND occurrence_rows.due_at BETWEEN DATE_SUB(NOW(), INTERVAL 14 DAY) AND DATE_ADD(NOW(), INTERVAL 90 DAY)
        ORDER BY occurrence_rows.due_at ASC
    ");
    $occurrenceStmt->execute($ids);
    foreach ($occurrenceStmt->fetchAll(PDO::FETCH_ASSOC) as $occurrence) {
        $plans[(int)$occurrence['plan_id']]['occurrences'][] = [
            'occurrenceId' => (int)$occurrence['occurrence_id'],
            'itemId' => (int)$occurrence['item_id'],
            'dueAt' => $occurrence['due_at'],
            'status' => $occurrence['status'],
            'completedAt' => $occurrence['completed_at'],
            'completionNotes' => $occurrence['completion_notes'],
        ];
    }

    return array_values(array_map(static function (array $plan): array {
        return [
            'planId' => (int)$plan['plan_id'],
            'petId' => (int)$plan['pet_id'],
            'petName' => $plan['pet_name'],
            'ownerUserId' => $plan['owner_user_id'] !== null ? (int)$plan['owner_user_id'] : null,
            'veterinarianUserId' => (int)$plan['veterinarian_user_id'],
            'veterinarianName' => trim((string)$plan['veterinarian_name']),
            'sourceType' => $plan['source_type'],
            'sourceRecordId' => (int)$plan['source_record_id'],
            'sourceLabel' => $plan['source_label'],
            'version' => (int)$plan['version_number'],
            'status' => $plan['status'],
            'issuedAt' => $plan['issued_at'],
            'supersedesPlanId' => $plan['supersedes_plan_id'] !== null ? (int)$plan['supersedes_plan_id'] : null,
            'items' => $plan['items'],
            'occurrences' => $plan['occurrences'],
        ];
    }, $plans));
}

function prescription_duration_end(DateTimeImmutable $start, int $number, string $unit): DateTimeImmutable
{
    $number = max(1, $number);
    return match ($unit) {
        'day' => $start->modify('+' . $number . ' days')->modify('-1 second'),
        'month' => $start->modify('+' . $number . ' months')->modify('-1 second'),
        'as needed' => $start->modify('+90 days')->modify('-1 second'),
        default => $start->modify('+' . $number . ' weeks')->modify('-1 second'),
    };
}

function prescription_generate_occurrences(PDO $pdo, array $item, string $startDate, array $timeSlots, array $daysOfWeek): int
{
    $timezone = new DateTimeZone('Asia/Manila');
    $scheduleType = (string)$item['schedule_type'];
    if ($scheduleType === 'as_needed') {
        return 0;
    }
    $times = max(1, (int)$item['times_count']);
    $slots = prescription_normalize_time_slots($timeSlots, $times);
    $anchorTime = $slots[0] ?? '08:00';
    $start = new DateTimeImmutable($startDate . ' ' . $anchorTime . ':00', $timezone);
    $end = prescription_duration_end($start, (int)$item['duration_number'], (string)$item['duration_unit']);
    $dueValues = [];

    if ($scheduleType === 'interval_hours') {
        $interval = max(1, (int)($item['interval_hours'] ?? 8));
        for ($cursor = $start; $cursor <= $end && count($dueValues) < 1000; $cursor = $cursor->modify("+{$interval} hours")) {
            $dueValues[] = $cursor->format('Y-m-d H:i:s');
        }
    } elseif ($scheduleType === 'monthly') {
        for ($cursor = $start; $cursor <= $end && count($dueValues) < 1000; $cursor = $cursor->modify('+1 month')) {
            foreach ($slots as $slot) {
                $dueValues[] = $cursor->format('Y-m-d') . ' ' . $slot . ':00';
            }
        }
    } else {
        $wantedDays = $scheduleType === 'weekly' ? array_map('intval', $daysOfWeek) : [];
        if ($scheduleType === 'weekly' && !$wantedDays) {
            $wantedDays = [(int)$start->format('w')];
        }
        for ($day = $start->setTime(0, 0); $day <= $end && count($dueValues) < 1000; $day = $day->modify('+1 day')) {
            if ($scheduleType === 'weekly' && !in_array((int)$day->format('w'), $wantedDays, true)) {
                continue;
            }
            foreach ($slots as $slot) {
                $dueAt = new DateTimeImmutable($day->format('Y-m-d') . ' ' . $slot . ':00', $timezone);
                if ($dueAt >= $start && $dueAt <= $end) {
                    $dueValues[] = $dueAt->format('Y-m-d H:i:s');
                }
            }
        }
    }

    $insert = $pdo->prepare("INSERT IGNORE INTO prescription_occurrences (item_id, due_at) VALUES (?, ?)");
    $created = 0;
    foreach (array_values(array_unique($dueValues)) as $dueAt) {
        $insert->execute([(int)$item['item_id'], $dueAt]);
        $created += $insert->rowCount();
    }
    $pdo->prepare("UPDATE prescription_items SET start_at = ?, end_at = ?, time_slots = ?, days_of_week = ?, status = 'active' WHERE item_id = ?")
        ->execute([
            $start->format('Y-m-d H:i:s'),
            $end->format('Y-m-d H:i:s'),
            json_encode($slots),
            json_encode($daysOfWeek),
            (int)$item['item_id'],
        ]);
    return $created;
}

function prescription_refresh_plan_status(PDO $pdo, int $planId): void
{
    $stmt = $pdo->prepare("SELECT status, COUNT(*) AS total FROM prescription_items WHERE plan_id = ? GROUP BY status");
    $stmt->execute([$planId]);
    $counts = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $counts[$row['status']] = (int)$row['total'];
    }
    if (($counts['active'] ?? 0) > 0 && ($counts['pending_start'] ?? 0) > 0) {
        $status = 'partially_started';
    } elseif (($counts['active'] ?? 0) > 0) {
        $status = 'active';
    } elseif (($counts['pending_start'] ?? 0) > 0) {
        $status = 'issued';
    } elseif (($counts['completed'] ?? 0) > 0) {
        $status = 'completed';
    } else {
        $status = 'stopped';
    }
    $pdo->prepare("UPDATE prescription_plans SET status = ? WHERE plan_id = ? AND status <> 'superseded'")->execute([$status, $planId]);
}

