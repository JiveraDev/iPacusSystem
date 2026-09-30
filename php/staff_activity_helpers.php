<?php

require_once __DIR__ . '/auth_access_helpers.php';
require_once __DIR__ . '/runtime_media.php';

function staff_activity_tracked_role(array $user): bool
{
    return in_array(
        ipawcus_access_normalize_role((string)($user['role'] ?? $user['normalized_role'] ?? '')),
        ['admin', 'veterinarian', 'super_admin'],
        true
    );
}

function staff_activity_require_column(PDO $pdo): void
{
    try {
        $pdo->query('SELECT activity_log_file FROM users LIMIT 0');
    } catch (Throwable $error) {
        throw new RuntimeException('Run DDL/20260920_01_user_activity_log_file.sql to enable activity history.', 0, $error);
    }
}

function staff_activity_log_directory(bool $create = false): string
{
    $configured = trim((string)(getenv('IPAWCUS_ACTIVITY_LOG_DIR') ?: ''));
    if ($configured !== '') {
        if (!str_starts_with($configured, '/') && preg_match('/^[A-Za-z]:[\\\\\/]/', $configured) !== 1) {
            throw new RuntimeException('IPAWCUS_ACTIVITY_LOG_DIR must be an absolute path.');
        }
        $directory = rtrim($configured, '/\\');
    } elseif (stripos(str_replace('\\', '/', dirname(__DIR__)), '/public_html/') !== false) {
        $directory = ipawcus_runtime_media_root($create) . DIRECTORY_SEPARATOR . 'staff_activity';
    } else {
        $directory = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'storage' . DIRECTORY_SEPARATOR . 'activity';
    }

    if ($create && !is_dir($directory) && !mkdir($directory, 0750, true) && !is_dir($directory)) {
        throw new RuntimeException('The staff activity log directory could not be created.');
    }
    if (is_link($directory)) {
        throw new RuntimeException('The staff activity log directory cannot be a symbolic link.');
    }
    if ($create) {
        $denyFile = $directory . DIRECTORY_SEPARATOR . '.htaccess';
        if (!is_file($denyFile)) {
            file_put_contents($denyFile, "Options -Indexes\nRequire all denied\n", LOCK_EX);
        }
        if (!is_readable($denyFile) || !str_contains((string)file_get_contents($denyFile), 'Require all denied')) {
            throw new RuntimeException('The staff activity log directory is missing its web access protection.');
        }
    }
    return $directory;
}

function staff_activity_branch(PDO $pdo, int $branchId): ?array
{
    if ($branchId <= 0) {
        return null;
    }

    $stmt = $pdo->prepare('SELECT branch_id, branch_name FROM branches WHERE branch_id = ? LIMIT 1');
    $stmt->execute([$branchId]);
    return $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
}

function staff_activity_detail_text($value, string $format = 'text'): ?string
{
    if ($value === null || is_array($value) || is_object($value)) {
        return null;
    }

    if ($format === 'boolean') {
        return filter_var($value, FILTER_VALIDATE_BOOLEAN) ? 'Yes' : 'No';
    }
    if ($format === 'active') {
        return (int)$value === 1 ? 'Active' : 'Archived';
    }
    if ($format === 'number') {
        return is_numeric($value) ? (string)(0 + $value) : null;
    }
    if ($format === 'money') {
        return is_numeric($value) ? 'PHP ' . number_format((float)$value, 2) : null;
    }

    $text = trim((string)$value);
    if ($text === '') {
        return null;
    }
    if ($format === 'enum') {
        $text = ucwords(str_replace(['_', '-'], ' ', strtolower($text)));
    }
    return substr($text, 0, 160);
}

function staff_activity_enrich_inventory_input(PDO $pdo, string $path, array $input): array
{
    if (preg_match('#^/inventory(?:/|$)#', $path) !== 1) {
        return $input;
    }

    $itemIds = [];
    $topLevelItemId = staff_activity_input_number($input, ['item_id', 'itemId']);
    if ($topLevelItemId > 0) {
        $itemIds[] = $topLevelItemId;
    }
    foreach ((array)($input['item_ids'] ?? []) as $itemId) {
        if (is_numeric($itemId) && (int)$itemId > 0) {
            $itemIds[] = (int)$itemId;
        }
    }
    foreach (($input['items'] ?? []) as $item) {
        if (!is_array($item)) continue;
        $itemId = staff_activity_input_number($item, ['item_id', 'itemId']);
        if ($itemId > 0) $itemIds[] = $itemId;
    }

    $itemIds = array_values(array_unique($itemIds));
    if (!$itemIds) {
        return $input;
    }

    $placeholders = implode(', ', array_fill(0, count($itemIds), '?'));
    $stmt = $pdo->prepare("SELECT item_id, item_name FROM inventory_items WHERE item_id IN ({$placeholders})");
    $stmt->execute($itemIds);
    $itemNamesById = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $item) {
        $itemNamesById[(int)$item['item_id']] = trim((string)$item['item_name']);
    }

    if ($topLevelItemId > 0 && isset($itemNamesById[$topLevelItemId])) {
        // Capture the database name before the mutation so the activity entry
        // remains readable even if product visibility changes.
        $input['item_name'] = $itemNamesById[$topLevelItemId];
    }

    $itemNames = [];
    if (isset($input['items']) && is_array($input['items'])) {
        foreach ($input['items'] as $index => $item) {
            if (!is_array($item)) continue;
            $itemId = staff_activity_input_number($item, ['item_id', 'itemId']);
            $itemName = $itemNamesById[$itemId] ?? trim((string)($item['item_name'] ?? ''));
            if ($itemName === '') continue;
            $input['items'][$index]['item_name'] = $itemName;
            $itemNames[] = $itemName;
        }
    }
    if ($itemNames) {
        $input['item_names'] = array_values(array_unique($itemNames));
    }
    if (!$itemNames && isset($input['item_ids']) && is_array($input['item_ids'])) {
        $input['item_names'] = array_values(array_filter(array_map(
            static fn(int $itemId): string => $itemNamesById[$itemId] ?? '',
            $itemIds
        )));
    }

    return $input;
}

function staff_activity_booking_subject(PDO $pdo, int $bookingId): ?array
{
    if ($bookingId <= 0) return null;
    $stmt = $pdo->prepare("SELECT
            COALESCE(NULLIF(TRIM(pet.pet_name), ''), NULLIF(TRIM(booking.unregistered_pet_name), ''), 'Unregistered pet') AS subject_name,
            booking.service_type AS subject_description
        FROM bookings booking
        LEFT JOIN pets_information pet ON pet.pet_id = booking.pet_id
        WHERE booking.booking_id = ? LIMIT 1");
    $stmt->execute([$bookingId]);
    $subject = $stmt->fetch(PDO::FETCH_ASSOC);
    return $subject ?: null;
}

function staff_activity_pet_subject(PDO $pdo, int $petId, string $description = ''): ?array
{
    if ($petId <= 0) return null;
    $stmt = $pdo->prepare('SELECT pet_name AS subject_name FROM pets_information WHERE pet_id = ? LIMIT 1');
    $stmt->execute([$petId]);
    $name = trim((string)($stmt->fetchColumn() ?: ''));
    return $name !== '' ? ['subject_name' => $name, 'subject_description' => $description] : null;
}

function staff_activity_apply_subject(array $input, ?array $subject): array
{
    if (!$subject) return $input;
    $name = staff_activity_detail_text($subject['subject_name'] ?? null);
    $description = staff_activity_detail_text($subject['subject_description'] ?? null, 'enum');
    if ($description !== null) {
        $description = (string)preg_replace('/\bPos\b/', 'POS', $description);
    }
    if ($name !== null) $input['_activity_subject_name'] = $name;
    if ($description !== null) $input['_activity_subject_description'] = $description;
    return $input;
}

function staff_activity_enrich_clinical_input(PDO $pdo, string $path, array $input): array
{
    $parts = array_values(array_filter(explode('/', trim($path, '/')), static fn($part) => $part !== ''));
    $root = $parts[0] ?? '';
    $pathId = isset($parts[1]) && ctype_digit((string)$parts[1]) ? (int)$parts[1] : 0;
    $subject = null;

    if ($root === 'bookings') {
        $subject = staff_activity_booking_subject(
            $pdo,
            $pathId ?: staff_activity_input_number($input, ['booking_id', 'bookingId'])
        );
    } elseif ($root === 'queues') {
        $queueId = $pathId ?: staff_activity_input_number($input, ['queue_id', 'queueId']);
        if ($queueId > 0) {
            $stmt = $pdo->prepare('SELECT queue.pet_id, queue.service_name FROM queues queue WHERE queue.queue_id = ? LIMIT 1');
            $stmt->execute([$queueId]);
            $queue = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($queue) $subject = staff_activity_pet_subject($pdo, (int)$queue['pet_id'], (string)$queue['service_name']);
        }
        $subject ??= staff_activity_pet_subject(
            $pdo,
            staff_activity_input_number($input, ['pet_id', 'petId']),
            (string)($input['service_name'] ?? $input['service_type'] ?? 'Queue service')
        );
    } elseif ($root === 'visits') {
        $billingContext = match (true) {
            preg_match('#/charges$#', $path) === 1 => 'POS bill update',
            preg_match('#/payments$#', $path) === 1 => 'POS payment',
            preg_match('#/refunds$#', $path) === 1 => 'POS refund',
            default => 'POS invoice',
        };
        $visitId = $pathId ?: staff_activity_input_number($input, ['visit_id', 'visitId']);
        if ($visitId > 0) {
            $stmt = $pdo->prepare('SELECT pet_id, source_type FROM visits WHERE visit_id = ? LIMIT 1');
            $stmt->execute([$visitId]);
            $visit = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($visit) $subject = staff_activity_pet_subject($pdo, (int)$visit['pet_id'], $billingContext);
        }
        $subject ??= staff_activity_pet_subject(
            $pdo,
            staff_activity_input_number($input, ['pet_id', 'petId']),
            $billingContext
        );

        // A new POS invoice can contain its first payment as a nested object.
        // Copy only the safe audit fields so the payment is visible without
        // retaining transaction references, notes, uploaded files, or IDs.
        $payment = is_array($input['payment'] ?? null) ? $input['payment'] : [];
        if ($payment) {
            if (!array_key_exists('amount', $input) && array_key_exists('amount', $payment)) {
                $input['amount'] = $payment['amount'];
            }
            if (!array_key_exists('payment_method', $input)) {
                $input['payment_method'] = $payment['payment_method'] ?? $payment['paymentMethod'] ?? null;
            }
            if (!array_key_exists('payment_status', $input)) {
                $input['payment_status'] = $payment['payment_status'] ?? $payment['paymentStatus'] ?? 'verified';
            }
        }
    } elseif ($root === 'vet-diagnoses') {
        $diagnosisId = $pathId ?: staff_activity_input_number($input, ['diagnosis_id', 'diagnosisId']);
        if ($diagnosisId > 0) {
            $stmt = $pdo->prepare('SELECT pet_id, service_name FROM vet_diagnoses WHERE diagnosis_id = ? LIMIT 1');
            $stmt->execute([$diagnosisId]);
            $diagnosis = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($diagnosis) $subject = staff_activity_pet_subject($pdo, (int)$diagnosis['pet_id'], (string)($diagnosis['service_name'] ?: 'Diagnosis'));
        }
        $subject ??= staff_activity_pet_subject(
            $pdo,
            staff_activity_input_number($input, ['pet_id', 'petId']),
            (string)($input['service_name'] ?? 'Diagnosis')
        );
    } elseif ($root === 'record-update-requests') {
        $requestId = $pathId ?: staff_activity_input_number($input, ['request_id', 'requestId']);
        if ($requestId > 0) {
            $stmt = $pdo->prepare('SELECT pet_id FROM pet_record_update_requests WHERE request_id = ? LIMIT 1');
            $stmt->execute([$requestId]);
            $subject = staff_activity_pet_subject($pdo, (int)($stmt->fetchColumn() ?: 0), 'Medical record update');
        }
        $subject ??= staff_activity_pet_subject($pdo, staff_activity_input_number($input, ['pet_id', 'petId']), 'Medical record update');
    } elseif ($root === 'online-consultations') {
        $consultationId = $pathId ?: staff_activity_input_number($input, ['online_consultation_id', 'onlineConsultationId']);
        if ($consultationId > 0) {
            $stmt = $pdo->prepare('SELECT booking_id FROM online_consultations WHERE online_consultation_id = ? LIMIT 1');
            $stmt->execute([$consultationId]);
            $subject = staff_activity_booking_subject($pdo, (int)($stmt->fetchColumn() ?: 0));
            if ($subject) $subject['subject_description'] = 'Online consultation';
        }
    } elseif ($root === 'grooming') {
        $subject = staff_activity_booking_subject($pdo, staff_activity_input_number($input, ['booking_id', 'bookingId']));
        if ($subject) $subject['subject_description'] = 'Grooming workflow';
    } elseif ($root === 'boarding') {
        $bookingId = preg_match('#^/boarding/bookings/(\d+)#', $path, $match)
            ? (int)$match[1]
            : staff_activity_input_number($input, ['booking_id', 'bookingId']);
        if ($bookingId <= 0) {
            $assignmentId = staff_activity_input_number($input, ['assignment_id', 'assignmentId']);
            if ($assignmentId > 0) {
                $stmt = $pdo->prepare('SELECT booking_id FROM boarding_assignments WHERE assignment_id = ? LIMIT 1');
                $stmt->execute([$assignmentId]);
                $bookingId = (int)($stmt->fetchColumn() ?: 0);
            }
        }
        if ($bookingId <= 0 && preg_match('#^/boarding/tasks/(\d+)#', $path, $match)) {
            $stmt = $pdo->prepare('SELECT booking_id FROM boarding_tasks WHERE task_id = ? LIMIT 1');
            $stmt->execute([(int)$match[1]]);
            $bookingId = (int)($stmt->fetchColumn() ?: 0);
        }
        $subject = staff_activity_booking_subject($pdo, $bookingId);
        if ($subject) $subject['subject_description'] = 'Boarding or confinement';
    } elseif (in_array($root, ['pets', 'pet_information'], true)) {
        $petId = $pathId ?: staff_activity_input_number($input, ['pet_id', 'petId']);
        $subject = staff_activity_pet_subject($pdo, $petId, str_starts_with($path, '/pets/') ? 'Medical record' : 'Pet record');
    } elseif (in_array($root, ['vet-presence', 'vet_schedules', 'veterinarian-branch-schedules'], true)) {
        $branch = staff_activity_branch($pdo, staff_activity_input_number($input, ['branch_id', 'branchId']));
        if ($branch) {
            $subject = ['subject_name' => $branch['branch_name'], 'subject_description' => 'Veterinarian availability'];
        }
    }

    return staff_activity_apply_subject($input, $subject);
}

function staff_activity_action_details(array $input, string $path = ''): array
{
    // This remains an allow-list. Operational reasons are retained only for
    // inventory, booking, and clinical workflow actions; diagnoses, credentials, payment references,
    // file paths, contact details, and unrelated notes are never copied.
    $details = [];
    $subjectName = staff_activity_detail_text($input['_activity_subject_name'] ?? null);
    $subjectDescription = staff_activity_detail_text($input['_activity_subject_description'] ?? null, 'enum');
    if ($subjectDescription !== null) {
        $subjectDescription = (string)preg_replace('/\bPos\b/', 'POS', $subjectDescription);
    }
    if ($subjectName !== null) $details[] = ['label' => 'Patient', 'value' => $subjectName];
    if ($subjectDescription !== null) $details[] = ['label' => 'Context', 'value' => $subjectDescription];
    $itemNames = [];
    if (isset($input['item_names']) && is_array($input['item_names'])) {
        $itemNames = array_values(array_filter(array_map(
            static fn($value): string => trim((string)$value),
            $input['item_names']
        )));
    }
    $singleItemName = staff_activity_detail_text($input['item_name'] ?? null);
    if ($singleItemName !== null) {
        $details[] = ['label' => 'Product', 'value' => $singleItemName];
    } elseif ($itemNames) {
        $visibleNames = array_slice($itemNames, 0, 4);
        $remaining = count($itemNames) - count($visibleNames);
        $value = implode(', ', $visibleNames) . ($remaining > 0 ? ' +' . $remaining . ' more' : '');
        $details[] = ['label' => count($itemNames) === 1 ? 'Product' : 'Products', 'value' => substr($value, 0, 160)];
    }
    if (preg_match('#^/(inventory|bookings|queues|visits|grooming|boarding|record-update-requests|online-consultations|vet-diagnoses)(?:/|$)#', $path) === 1) {
        $reason = staff_activity_detail_text($input['reason'] ?? $input['remarks'] ?? null);
        if ($reason !== null) {
            $details[] = ['label' => 'Reason', 'value' => $reason];
        }
    }

    $fields = [
        [['status', 'account_status'], 'New status', 'enum'],
        [['is_active'], 'Account state', 'active'],
        [['action'], 'Operation', 'enum'],
        [['service_type'], 'Service', 'enum'],
        [['payment_status'], 'Payment status', 'enum'],
        [['payment_method'], 'Payment method', 'enum'],
        [['refund_method', 'refundMethod'], 'Refund method', 'enum'],
        [['priority'], 'Priority', 'enum'],
        [['observation_type'], 'Observation type', 'enum'],
        [['task_type'], 'Task type', 'enum'],
        [['booking_date', 'new_date', 'receiving_date'], 'Date', 'text'],
        [['booking_time', 'new_time'], 'Time', 'text'],
        [['due_at'], 'Due at', 'text'],
        [['desired_check_out_at', 'desired_checkout_at', 'check_out_at'], 'Check-out', 'text'],
        [['quantity', 'quantity_received', 'quantity_out', 'transfer_quantity'], 'Quantity', 'number'],
        [['amount', 'refund_amount', 'total_amount'], 'Amount', 'money'],
        [['assigned_to'], 'Assigned to', 'text'],
        [['service_name'], 'Service name', 'text'],
        [['location_name'], 'Location', 'text'],
        [['room_name'], 'Room', 'text'],
        [['supplier_name'], 'Supplier', 'text'],
    ];

    foreach ($fields as [$keys, $label, $format]) {
        foreach ($keys as $key) {
            if (!array_key_exists($key, $input)) {
                continue;
            }
            $value = staff_activity_detail_text($input[$key], $format);
            if ($value !== null) {
                $details[] = ['label' => $label, 'value' => $value];
            }
            break;
        }
        if (count($details) >= 10) {
            break;
        }
    }

    $collections = [
        'items' => 'Items',
        'charges' => 'Charges',
        'materials' => 'Materials',
        'rooms' => 'Rooms',
        'special_service_item_ids' => 'Special services',
    ];
    foreach ($collections as $key => $label) {
        if (!isset($input[$key]) || !is_array($input[$key])) {
            continue;
        }
        $count = count($input[$key]);
        if ($count > 0) {
            $details[] = ['label' => $label, 'value' => $count . ($count === 1 ? ' record' : ' records')];
        }
        if (count($details) >= 10) {
            break;
        }
    }

    if (isset($input['items']) && is_array($input['items'])) {
        $quantity = 0.0;
        $foundQuantity = false;
        foreach ($input['items'] as $item) {
            if (!is_array($item)) continue;
            foreach (['quantity_received', 'quantity', 'quantity_out'] as $quantityKey) {
                if (isset($item[$quantityKey]) && is_numeric($item[$quantityKey])) {
                    $quantity += (float)$item[$quantityKey];
                    $foundQuantity = true;
                    break;
                }
            }
        }
        if ($foundQuantity && count($details) < 10) {
            $details[] = ['label' => 'Total quantity', 'value' => (string)(0 + $quantity)];
        }
    }

    return array_slice($details, 0, 10);
}

function staff_activity_action_summary(array $details): ?string
{
    $parts = [];
    foreach (array_slice($details, 0, 3) as $detail) {
        $label = trim((string)($detail['label'] ?? ''));
        $value = trim((string)($detail['value'] ?? ''));
        if ($label !== '' && $value !== '') {
            $parts[] = $label . ': ' . $value;
        }
    }
    return $parts ? substr(implode(' | ', $parts), 0, 360) : null;
}

function staff_activity_target_label(array $details, string $fallback): string
{
    $values = [];
    foreach (['Patient', 'Product', 'Products', 'Context', 'Service', 'Service name', 'Location', 'Room'] as $preferredLabel) {
        foreach ($details as $detail) {
            if (($detail['label'] ?? '') !== $preferredLabel) continue;
            $value = trim((string)($detail['value'] ?? ''));
            if ($value !== '' && !in_array($value, $values, true)) $values[] = $value;
            break;
        }
        if (count($values) >= 2) break;
    }
    return substr($values ? implode(' — ', $values) : $fallback, 0, 240);
}

function staff_activity_planning_status(string $path, array $input, ?DateTimeImmutable $recordedAt = null): array
{
    $clinicTimezone = new DateTimeZone('Asia/Manila');
    $now = ($recordedAt ?? new DateTimeImmutable('now', $clinicTimezone))->setTimezone($clinicTimezone);

    if (array_key_exists('planned_in_advance', $input)) {
        $explicit = filter_var($input['planned_in_advance'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
        if ($explicit !== null) {
            return [
                'status' => $explicit ? 'planned' : 'not_planned',
                'planned_for' => null,
                'basis' => 'Explicitly recorded by the request',
            ];
        }
    }

    $scheduledValues = [];
    $datePairs = [
        ['booking_date', 'booking_time'],
        ['new_date', 'new_time'],
        ['check_in_date', 'check_in_time'],
    ];
    foreach ($datePairs as [$dateKey, $timeKey]) {
        $date = trim((string)($input[$dateKey] ?? ''));
        if ($date === '') continue;
        $time = trim((string)($input[$timeKey] ?? ''));
        $scheduledValues[] = trim($date . ' ' . ($time !== '' ? $time : '00:00:00'));
    }
    foreach (['due_at', 'scheduled_at', 'scheduled_start', 'planned_for', 'desired_check_out_at', 'desired_checkout_at', 'desired_check_out_date'] as $key) {
        $value = trim((string)($input[$key] ?? ''));
        if ($value !== '') $scheduledValues[] = $value;
    }

    foreach ($scheduledValues as $value) {
        try {
            $scheduledAt = new DateTimeImmutable($value, $clinicTimezone);
        } catch (Throwable $error) {
            continue;
        }
        if ($scheduledAt > $now) {
            return [
                'status' => 'planned',
                'planned_for' => $scheduledAt->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d\TH:i:s\Z'),
                'basis' => 'A future schedule was included with the action',
            ];
        }
    }

    if (preg_match('#^/(vet_schedules|veterinarian-branch-schedules)(/|$)#', $path) === 1) {
        return [
            'status' => 'planned',
            'planned_for' => null,
            'basis' => 'The action created or updated a work schedule',
        ];
    }

    return [
        'status' => 'not_planned',
        'planned_for' => null,
        'basis' => 'No future schedule was recorded with the action',
    ];
}

function staff_activity_record(PDO $pdo, array $user, array $event): void
{
    if (!staff_activity_tracked_role($user)) {
        return;
    }

    $branch = staff_activity_branch($pdo, (int)($event['branch_id'] ?? 0));
    $actorName = trim((string)($user['first_Name'] ?? '') . ' ' . (string)($user['last_Name'] ?? ''));
    $details = is_array($event['details'] ?? null) ? array_slice($event['details'], 0, 10) : [];
    $entry = [
        'activity_id' => bin2hex(random_bytes(12)),
        'actor_user_id' => (int)$user['user_id'],
        'actor_name' => $actorName !== '' ? $actorName : 'User #' . (int)$user['user_id'],
        'actor_role' => ipawcus_access_normalize_role((string)$user['role']),
        'branch_id' => $branch ? (int)$branch['branch_id'] : null,
        'branch_name' => $branch['branch_name'] ?? ($event['branch_label'] ?? null),
        'activity_kind' => (string)($event['kind'] ?? 'action'),
        'action_key' => (string)($event['key'] ?? 'updated_record'),
        'action_label' => (string)($event['label'] ?? 'Updated a record'),
        'action_summary' => $event['summary'] ?? staff_activity_action_summary($details),
        'action_details' => $details,
        'target_type' => $event['target_type'] ?? null,
        'target_id' => isset($event['target_id']) && (int)$event['target_id'] > 0 ? (int)$event['target_id'] : null,
        'target_label' => isset($event['target_label']) ? substr(trim((string)$event['target_label']), 0, 240) : null,
        'request_method' => $event['method'] ?? null,
        'request_path' => $event['path'] ?? null,
        'response_status' => isset($event['response_status']) ? (int)$event['response_status'] : null,
        'planning_status' => $event['planning_status'] ?? null,
        'planned_for' => $event['planned_for'] ?? null,
        'planning_basis' => $event['planning_basis'] ?? null,
        'created_at' => (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format('Y-m-d\TH:i:s.u\Z'),
    ];
    $line = json_encode($entry, JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE | JSON_THROW_ON_ERROR) . "\n";
    $directory = staff_activity_log_directory(true);
    $relativePath = 'staff_activity/user-' . (int)$user['user_id'] . '.jsonl';
    $linkStmt = $pdo->prepare('
        UPDATE users SET activity_log_file = ?
        WHERE user_id = ? AND (activity_log_file IS NULL OR activity_log_file <> ?)
    ');
    $linkStmt->execute([$relativePath, (int)$user['user_id'], $relativePath]);
    $file = $directory . DIRECTORY_SEPARATOR . 'user-' . (int)$user['user_id'] . '.jsonl';
    if (file_put_contents($file, $line, FILE_APPEND | LOCK_EX) !== strlen($line)) {
        throw new RuntimeException('The staff activity log could not be written.');
    }
    @chmod($file, 0640);
}

function staff_activity_lines_newest(string $file): Generator
{
    $handle = fopen($file, 'rb');
    if ($handle === false) {
        return;
    }

    try {
        $position = filesize($file);
        $buffer = '';
        while ($position > 0) {
            $size = min(8192, $position);
            $position -= $size;
            fseek($handle, $position);
            $buffer = fread($handle, $size) . $buffer;
            while (($newline = strrpos($buffer, "\n")) !== false) {
                $line = substr($buffer, $newline + 1);
                $buffer = substr($buffer, 0, $newline);
                if ($line !== '') {
                    yield $line;
                }
            }
        }
        if ($buffer !== '') {
            yield $buffer;
        }
    } finally {
        fclose($handle);
    }
}

function staff_activity_entries(PDO $pdo, ?int $userId = null): Generator
{
    $directory = staff_activity_log_directory();
    if ($userId !== null) {
        $linkStmt = $pdo->prepare('SELECT activity_log_file FROM users WHERE user_id = ? LIMIT 1');
        $linkStmt->execute([$userId]);
        $linkedPath = (string)($linkStmt->fetchColumn() ?: '');
        $expectedPath = 'staff_activity/user-' . $userId . '.jsonl';
        $files = ($linkedPath === $expectedPath || $linkedPath === '')
            ? [$directory . DIRECTORY_SEPARATOR . 'user-' . $userId . '.jsonl']
            : [];
    } else {
        // Include files for accounts that were subsequently removed.
        $files = glob($directory . DIRECTORY_SEPARATOR . 'user-*.jsonl') ?: [];
    }

    $streams = [];
    foreach ($files as $file) {
        if (is_link($file) || !is_file($file)) {
            continue;
        }
        $stream = staff_activity_lines_newest($file);
        $stream->rewind();
        if ($stream->valid()) {
            $streams[] = $stream;
        }
    }

    while ($streams) {
        $newestIndex = null;
        $newestEntry = null;
        foreach ($streams as $index => $stream) {
            $entry = json_decode((string)$stream->current(), true);
            if (!is_array($entry) || !isset($entry['actor_user_id'], $entry['created_at'])) {
                $stream->next();
                if (!$stream->valid()) unset($streams[$index]);
                continue;
            }
            if ($newestEntry === null || strcmp($entry['created_at'], $newestEntry['created_at']) > 0) {
                $newestEntry = $entry;
                $newestIndex = $index;
            }
        }
        if ($newestIndex === null) continue;
        yield $newestEntry;
        $streams[$newestIndex]->next();
        if (!$streams[$newestIndex]->valid()) unset($streams[$newestIndex]);
    }
}

function staff_activity_is_major_clinical_entry(array $entry): bool
{
    if (ipawcus_access_normalize_role((string)($entry['actor_role'] ?? '')) !== 'veterinarian') {
        return false;
    }

    $key = (string)($entry['action_key'] ?? '');
    if ($key === '') {
        $key = strtoupper((string)($entry['request_method'] ?? '')) . ':' . (string)($entry['request_path'] ?? '');
    }

    return preg_match('#^(POST|PATCH):/vet-diagnoses(?:/:id)?$#', $key) === 1
        || preg_match('#^POST:/online-consultations/:id/(start|end|diagnosis)$#', $key) === 1
        || preg_match('#^POST:/queues/(receive|return|reenter|status)$#', $key) === 1
        || $key === 'POST:/grooming'
        || $key === 'POST:/boarding/observations'
        || preg_match('#^(POST|PATCH):/record-update-requests(?:/:id)?$#', $key) === 1
        || $key === 'POST:/visits'
        || $key === 'POST:/pets/:id/medical';
}

function staff_activity_is_pos_billing_entry(array $entry): bool
{
    $actorRole = ipawcus_access_normalize_role((string)($entry['actor_role'] ?? ''));
    if (!in_array($actorRole, ['admin', 'super_admin'], true)) {
        return false;
    }

    $key = (string)($entry['action_key'] ?? '');
    if ($key === '') {
        $key = strtoupper((string)($entry['request_method'] ?? '')) . ':' . (string)($entry['request_path'] ?? '');
    }

    return preg_match('#^POST:/visits(?:/:id/(?:charges|payments|refunds))?$#', $key) === 1;
}

function staff_activity_reference_without_id(string $value, string $fallback): string
{
    $value = trim($value);
    if ($value === '') return $fallback;
    if (preg_match('/^#?\s*\d+$/', $value) === 1) return $fallback;

    $cleaned = preg_replace(
        '/\s*[\x{2014}\x{2013}-]\s*(?:(?:booking|grooming|record)(?:\s+id)?\s*)?#?\s*\d+\s*$/iu',
        '',
        $value
    );
    if ($cleaned === null) return $fallback;
    if ($cleaned === $value) {
        $cleaned = preg_replace(
            '/\b(?:booking|grooming|record)(?:\s+id)?\s*#?\s*\d+\s*$/iu',
            '',
            $value
        );
    }
    if ($cleaned === null || $cleaned === $value) return $value;

    $cleaned = trim($cleaned, " \t\n\r\0\x0B-|\xE2\x80\x94\xE2\x80\x93");
    return $cleaned !== '' ? $cleaned : $fallback;
}

function staff_activity_grooming_booking_id(array $entry): int
{
    $targetId = (int)($entry['target_id'] ?? 0);
    if ($targetId > 0) return $targetId;

    foreach ((array)($entry['action_details'] ?? []) as $detail) {
        $label = trim((string)($detail['label'] ?? ''));
        $value = trim((string)($detail['value'] ?? ''));
        if (preg_match('/\b(?:booking|grooming)(?:\s+record)?\s+id\b/i', $label) === 1 && ctype_digit($value)) {
            return (int)$value;
        }
    }

    foreach ([(string)($entry['target_label'] ?? ''), (string)($entry['action_summary'] ?? '')] as $value) {
        if (preg_match('/(?:booking|grooming)(?:\s+record)?(?:\s+id)?\s*#?\s*(\d+)\b/i', $value, $match) === 1) {
            return (int)$match[1];
        }
        if (preg_match('/^#?\s*(\d+)$/', trim($value), $match) === 1) {
            return (int)$match[1];
        }
    }

    return 0;
}

function staff_activity_enrich_list_entry(PDO $pdo, array $entry, array &$groomingSubjects): array
{
    if ((string)($entry['target_type'] ?? '') !== 'grooming') return $entry;

    $bookingId = staff_activity_grooming_booking_id($entry);
    $subject = null;
    if ($bookingId > 0) {
        if (!array_key_exists($bookingId, $groomingSubjects)) {
            try {
                $groomingSubjects[$bookingId] = staff_activity_booking_subject($pdo, $bookingId);
            } catch (Throwable $error) {
                $groomingSubjects[$bookingId] = null;
            }
        }
        $subject = $groomingSubjects[$bookingId];
    }

    $details = array_values(array_filter(
        is_array($entry['action_details'] ?? null) ? $entry['action_details'] : [],
        static fn($detail): bool => is_array($detail)
            && preg_match('/(^|\s)ID$/i', trim((string)($detail['label'] ?? ''))) !== 1
            && !in_array((string)($detail['label'] ?? ''), ['Patient', 'Context'], true)
    ));

    if ($subject) {
        $patientName = staff_activity_detail_text($subject['subject_name'] ?? null) ?? 'Pet';
        $context = 'Grooming workflow';
        $details = array_merge([
            ['label' => 'Patient', 'value' => $patientName],
            ['label' => 'Context', 'value' => $context],
        ], $details);
        $entry['target_label'] = $patientName . ' — ' . $context;
    } else {
        $entry['target_label'] = staff_activity_reference_without_id(
            (string)($entry['target_label'] ?? ''),
            'Grooming workflow'
        );
    }

    $entry['action_details'] = array_slice($details, 0, 10);
    $entry['action_summary'] = staff_activity_action_summary($entry['action_details']);
    return $entry;
}

function staff_activity_list(PDO $pdo, array $filters, int $limit, int $offset): array
{
    $matches = 0;
    $items = [];
    $groomingSubjects = [];
    foreach (staff_activity_entries($pdo, $filters['user_id'] ?? null) as $entry) {
        $entry = staff_activity_enrich_list_entry($pdo, $entry, $groomingSubjects);
        if (isset($filters['user_id']) && (int)$entry['actor_user_id'] !== (int)$filters['user_id']) continue;
        if (isset($filters['role']) && ($entry['actor_role'] ?? '') !== $filters['role']) continue;
        if (isset($filters['branch_id']) && (int)($entry['branch_id'] ?? 0) !== (int)$filters['branch_id']) continue;
        if (($filters['branch_scope'] ?? '') === 'organization' && ($entry['branch_name'] ?? '') !== 'Organization-wide') continue;
        if (($filters['branch_scope'] ?? '') === 'unresolved' && ($entry['branch_name'] ?? '') !== 'Branch not recorded') continue;
        if (isset($filters['kind']) && ($entry['activity_kind'] ?? '') !== $filters['kind']) continue;
        if (isset($filters['module'])) {
            $targetType = (string)($entry['target_type'] ?? '');
            $isMajorClinical = staff_activity_is_major_clinical_entry($entry);
            $isPosBilling = staff_activity_is_pos_billing_entry($entry);
            $matchesModule = match ($filters['module']) {
                'major' => in_array($targetType, ['inventory', 'bookings'], true) || $isMajorClinical || $isPosBilling,
                'operations' => in_array($targetType, ['inventory', 'bookings'], true),
                'inventory' => $targetType === 'inventory',
                'bookings' => $targetType === 'bookings',
                'pos' => $isPosBilling,
                'grooming' => $targetType === 'grooming',
                'clinical' => $isMajorClinical,
                default => true,
            };
            if (!$matchesModule) continue;
        }
        if (isset($filters['planning'])) {
            $planningStatus = (string)($entry['planning_status'] ?? 'not_recorded');
            if ($planningStatus !== $filters['planning']) continue;
        }
        if (isset($filters['from']) && strcmp((string)($entry['created_at'] ?? ''), $filters['from']) < 0) continue;
        if ($matches++ < $offset) continue;
        $items[] = $entry;
        if (count($items) > $limit) break;
    }
    return ['activities' => array_slice($items, 0, $limit), 'hasMore' => count($items) > $limit];
}

function staff_activity_options(PDO $pdo): array
{
    $users = [];
    $branches = [];
    $roles = [];
    $branchStmt = $pdo->query("
        SELECT branch_id, branch_name
        FROM branches
        WHERE status = 'active' AND branch_code IN ('MAIN', 'ENRIQUEZ')
        ORDER BY branch_name
    ");
    foreach ($branchStmt->fetchAll(PDO::FETCH_ASSOC) as $branch) {
        $branches[(int)$branch['branch_id']] = $branch;
    }
    foreach (staff_activity_entries($pdo) as $entry) {
        if (($entry['activity_kind'] ?? '') !== 'action') continue;
        $userId = (int)$entry['actor_user_id'];
        if (!isset($users[$userId])) {
            $users[$userId] = [
                'user_id' => $userId,
                'name' => $entry['actor_name'],
                'role' => $entry['actor_role'],
            ];
        }
        $role = ipawcus_access_normalize_role((string)($entry['actor_role'] ?? ''));
        if (in_array($role, ['admin', 'veterinarian', 'super_admin'], true)) $roles[$role] = true;
    }
    $users = array_values($users);
    $branches = array_values($branches);
    usort($users, static fn($first, $second) => strcasecmp($first['name'], $second['name']));
    usort($branches, static fn($first, $second) => strcasecmp((string)$first['branch_name'], (string)$second['branch_name']));
    $roleOrder = ['admin', 'veterinarian', 'super_admin'];
    return [
        'users' => $users,
        'branches' => $branches,
        'roles' => array_values(array_filter($roleOrder, static fn($value) => isset($roles[$value]))),
    ];
}

function staff_activity_input_number(array $input, array $keys): int
{
    foreach ($keys as $key) {
        if (isset($input[$key]) && filter_var($input[$key], FILTER_VALIDATE_INT) !== false) {
            return max(0, (int)$input[$key]);
        }
    }

    return 0;
}

function staff_activity_lookup_branch(PDO $pdo, string $table, string $idColumn, int $id): int
{
    if ($id <= 0) {
        return 0;
    }

    // The table and column are only passed from the fixed map below.
    $stmt = $pdo->prepare("SELECT branch_id FROM {$table} WHERE {$idColumn} = ? LIMIT 1");
    $stmt->execute([$id]);
    return (int)($stmt->fetchColumn() ?: 0);
}

function staff_activity_is_global_path(string $path): bool
{
    return preg_match('#^/(account|accounts|pet-owner-accounts|users|profile|branches|reports|admin-feature-access|system-backups|payment-methods|notifications)(/|$)#', $path) === 1
        || preg_match('#^/dashboard/(accounts|profile|reports|payment-methods)(/|$)#', $path) === 1;
}

function staff_activity_request_branch(PDO $pdo, string $path, array $input, array $query, array $user): int
{
    if (str_starts_with($path, '/dashboard')
        && ipawcus_access_normalize_role((string)$user['role']) === 'super_admin') {
        return 0;
    }
    $recordSources = [
        'bookings' => ['bookings', 'booking_id', ['bookingId', 'booking_id']],
        'queues' => ['queues', 'queue_id', ['queueId', 'queue_id']],
        'visits' => ['visits', 'visit_id', ['visitId', 'visit_id']],
        'record-update-requests' => ['pet_record_update_requests', 'request_id', ['requestId', 'request_id']],
    ];

    foreach ($recordSources as $route => [$table, $idColumn, $keys]) {
        $id = preg_match('#^/' . $route . '/(\d+)(?:/|$)#', $path, $match)
            ? (int)$match[1]
            : staff_activity_input_number($input, $keys);
        $branchId = staff_activity_lookup_branch($pdo, $table, $idColumn, $id);
        if ($branchId > 0) {
            return $branchId;
        }
    }

    if ($path === '/grooming') {
        $bookingId = staff_activity_input_number($input, ['bookingId', 'booking_id']);
        $branchId = staff_activity_lookup_branch($pdo, 'bookings', 'booking_id', $bookingId);
        if ($branchId > 0) {
            return $branchId;
        }
    }

    if (preg_match('#^/boarding/bookings/(\d+)#', $path, $match)) {
        $branchId = staff_activity_lookup_branch($pdo, 'bookings', 'booking_id', (int)$match[1]);
        if ($branchId > 0) return $branchId;
    }

    if (str_starts_with($path, '/boarding')) {
        $assignmentId = staff_activity_input_number($input, ['assignmentId', 'assignment_id']);
        if ($assignmentId > 0) {
            $stmt = $pdo->prepare('
                SELECT booking.branch_id
                FROM boarding_assignments assignment_record
                JOIN bookings booking ON booking.booking_id = assignment_record.booking_id
                WHERE assignment_record.assignment_id = ? LIMIT 1
            ');
            $stmt->execute([$assignmentId]);
            $branchId = (int)($stmt->fetchColumn() ?: 0);
            if ($branchId > 0) return $branchId;
        }

        if (preg_match('#^/boarding/tasks/(\d+)#', $path, $match)) {
            $stmt = $pdo->prepare('
                SELECT booking.branch_id
                FROM boarding_tasks task_record
                JOIN bookings booking ON booking.booking_id = task_record.booking_id
                WHERE task_record.task_id = ? LIMIT 1
            ');
            $stmt->execute([(int)$match[1]]);
            $branchId = (int)($stmt->fetchColumn() ?: 0);
            if ($branchId > 0) return $branchId;
        }

        if (preg_match('#^/boarding/materials/(\d+)#', $path, $match)) {
            $stmt = $pdo->prepare('
                SELECT booking.branch_id
                FROM boarding_material_usages usage_record
                JOIN bookings booking ON booking.booking_id = usage_record.booking_id
                WHERE usage_record.usage_id = ? LIMIT 1
            ');
            $stmt->execute([(int)$match[1]]);
            $branchId = (int)($stmt->fetchColumn() ?: 0);
            if ($branchId > 0) return $branchId;
        }
    }

    if (preg_match('#^/vet-diagnoses/(\d+)#', $path, $match)) {
        $stmt = $pdo->prepare('
            SELECT COALESCE(queue.branch_id, booking.branch_id)
            FROM vet_diagnoses diagnosis
            LEFT JOIN queues queue ON queue.queue_id = diagnosis.queue_id
            LEFT JOIN bookings booking ON booking.booking_id = diagnosis.booking_id
            WHERE diagnosis.diagnosis_id = ? LIMIT 1
        ');
        $stmt->execute([(int)$match[1]]);
        $branchId = (int)($stmt->fetchColumn() ?: 0);
        if ($branchId > 0) return $branchId;
    }

    if (preg_match('#^/online-consultations/(\d+)#', $path, $match)) {
        $stmt = $pdo->prepare('
            SELECT booking.branch_id
            FROM online_consultations consultation
            JOIN bookings booking ON booking.booking_id = consultation.booking_id
            WHERE consultation.online_consultation_id = ? LIMIT 1
        ');
        $stmt->execute([(int)$match[1]]);
        $branchId = (int)($stmt->fetchColumn() ?: 0);
        if ($branchId > 0) return $branchId;
    }

    if (str_starts_with($path, '/inventory')) {
        $locationId = staff_activity_input_number($input, [
            'destination_location_id', 'location_id', 'locationId', 'source_location_id',
        ]);
        $branchId = staff_activity_lookup_branch($pdo, 'inventory_locations', 'location_id', $locationId);
        if ($branchId > 0) {
            return $branchId;
        }
        $itemId = staff_activity_input_number($input, ['item_id', 'itemId']);
        if ($itemId > 0) {
            $stmt = $pdo->prepare('
                SELECT location.branch_id
                FROM inventory_items item
                JOIN inventory_locations location ON location.location_id = item.location_id
                WHERE item.item_id = ? LIMIT 1
            ');
            $stmt->execute([$itemId]);
            $branchId = (int)($stmt->fetchColumn() ?: 0);
            if ($branchId > 0) return $branchId;
        }
    }

    $branchId = staff_activity_input_number($input, ['branchId', 'branch_id', 'toBranchId', 'to_branch_id']);
    if ($branchId <= 0) {
        $branchId = staff_activity_input_number($query, ['branchId', 'branch_id']);
    }
    if ($branchId > 0 && staff_activity_branch($pdo, $branchId)) {
        return $branchId;
    }

    // Organization settings and account management do not belong to one clinic.
    if (staff_activity_is_global_path($path)) {
        return 0;
    }

    // A single assigned clinic is a reliable fallback for operations without a branch field.
    $stmt = $pdo->prepare('SELECT branch_id FROM user_branch_assignments WHERE user_id = ? AND is_active = 1 LIMIT 2');
    $stmt->execute([(int)$user['user_id']]);
    $assigned = $stmt->fetchAll(PDO::FETCH_COLUMN);
    return count($assigned) === 1 ? (int)$assigned[0] : 0;
}

function staff_activity_describe_mutation(string $path, string $method, array $input): array
{
    $parts = array_values(array_filter(explode('/', trim($path, '/')), static fn($part) => $part !== ''));
    $root = $parts[0] ?? 'record';
    $names = [
        'bookings' => 'booking', 'queues' => 'queue', 'visits' => 'visit',
        'inventory' => 'inventory', 'grooming' => 'grooming', 'pet_information' => 'pet',
        'record-update-requests' => 'record request', 'vet-diagnoses' => 'diagnosis',
        'accounts' => 'account', 'pet-owner-accounts' => 'pet owner account',
        'branches' => 'branch', 'service-catalog' => 'service', 'profile' => 'profile',
        'vet-presence' => 'vet presence', 'veterinarian-branch-schedules' => 'vet schedule',
        'online-consultations' => 'online consultation', 'boarding' => 'boarding',
        'payment-methods' => 'payment method', 'notifications' => 'notification',
        'users' => 'user', 'system-backups' => 'system backup', 'reports' => 'report',
    ];
    $subject = $names[$root] ?? str_replace(['-', '_'], ' ', $root);
    $verb = match ($method) {
        'DELETE' => 'Deleted',
        'POST' => 'Submitted',
        default => 'Updated',
    };
    $operation = count($parts) > 1 && !ctype_digit((string)end($parts))
        ? str_replace(['-', '_'], ' ', (string)end($parts))
        : '';
    $label = trim($verb . ' ' . $subject . ($operation !== '' ? ' ' . $operation : ''));
    $targetId = 0;
    foreach ($parts as $part) {
        if (ctype_digit($part)) {
            $targetId = (int)$part;
            break;
        }
    }
    if ($targetId <= 0) {
        $targetKeys = match ($root) {
            'bookings', 'boarding', 'grooming' => ['bookingId', 'booking_id'],
            'queues' => ['queueId', 'queue_id'],
            'visits' => ['visitId', 'visit_id'],
            'inventory' => ['itemId', 'item_id'],
            'record-update-requests' => ['requestId', 'request_id'],
            'vet-diagnoses' => ['diagnosisId', 'diagnosis_id'],
            'service-catalog' => ['serviceId', 'service_id'],
            'online-consultations' => ['onlineConsultationId', 'online_consultation_id'],
            default => [],
        };
        $targetId = staff_activity_input_number($input, $targetKeys);
    }

    $routePath = (string)preg_replace('#/\d+(?=/|$)#', '/:id', $path);
    $routePath = (string)preg_replace('#^/(pet_information|pets)/[^/]+#', '/$1/:id', $routePath);
    $specificLabels = [
        'POST /accounts/create' => 'Created staff account',
        'PATCH /accounts/:id/status' => 'Changed account status',
        'PATCH /accounts/:id/profile' => 'Updated staff profile',
        'DELETE /accounts/:id' => 'Deleted staff account',
        'PATCH /pet-owner-accounts/:id/status' => 'Changed pet owner account status',
        'DELETE /pet-owner-accounts/:id/pets/:id' => 'Removed pet ownership access',
        'POST /admin-feature-access' => 'Changed admin feature access',
        'POST /pet_information' => 'Registered pet',
        'PATCH /pet_information/:id' => 'Updated pet record',
        'PATCH /pet_information/:id/status' => 'Changed pet status',
        'POST /pets/:id/medical' => 'Updated pet medical record',
        'POST /bookings' => 'Created booking',
        'PATCH /bookings/:id/status' => 'Changed booking status',
        'PATCH /bookings/:id/schedule' => 'Rescheduled booking',
        'PATCH /bookings/:id/branch' => 'Transferred booking to another branch',
        'POST /bookings/:id/receive' => 'Received booking',
        'POST /bookings/:id/payment-review' => 'Reviewed booking payment',
        'POST /bookings/:id/payment-refunds' => 'Recorded booking payment refund',
        'POST /queues' => 'Created queue entry',
        'POST /queues/status' => 'Changed queue status',
        'POST /queues/receive' => 'Received queue entry',
        'POST /queues/assign' => 'Assigned queue entry',
        'POST /queues/return' => 'Returned queue entry',
        'POST /queues/reenter' => 'Returned patient to the queue',
        'POST /inventory/items' => 'Added inventory item',
        'PATCH /inventory/items' => 'Updated inventory item',
        'POST /inventory/stock-in' => 'Recorded stock in',
        'POST /inventory/stock-out' => 'Recorded stock out',
        'POST /inventory/transfer' => 'Transferred inventory',
        'POST /inventory/delete' => 'Removed inventory item',
        'POST /grooming' => 'Updated grooming workflow',
        'POST /boarding/rooms' => 'Added boarding room',
        'PATCH /boarding/rooms' => 'Updated boarding room',
        'POST /boarding/direct-check-in' => 'Checked in boarding guest',
        'POST /boarding/bookings/:id/assign-room' => 'Assigned boarding room',
        'POST /boarding/bookings/:id/check-in' => 'Checked in boarding guest',
        'POST /boarding/bookings/:id/check-out' => 'Checked out boarding guest',
        'PATCH /boarding/bookings/:id/desired-check-out' => 'Updated desired boarding check-out',
        'POST /boarding/observations' => 'Recorded boarding observation',
        'POST /boarding/tasks' => 'Scheduled boarding task',
        'PATCH /boarding/tasks/:id/complete' => 'Completed boarding task',
        'POST /boarding/documents' => 'Added boarding document',
        'POST /boarding/materials' => 'Recorded boarding material use',
        'DELETE /boarding/materials/:id' => 'Removed boarding material use',
        'POST /record-update-requests' => 'Submitted record update request',
        'PATCH /record-update-requests/:id' => 'Updated record request',
        'POST /vet-diagnoses' => 'Saved diagnosis',
        'PATCH /vet-diagnoses/:id' => 'Updated diagnosis',
        'POST /online-consultations/:id/start' => 'Started online consultation',
        'POST /online-consultations/:id/join' => 'Joined online consultation',
        'POST /online-consultations/:id/end' => 'Ended online consultation',
        'POST /online-consultations/:id/diagnosis' => 'Saved online diagnosis',
        'POST /visits' => 'Created POS invoice',
        'POST /visits/:id/charges' => 'Updated POS bill',
        'POST /visits/:id/payments' => 'Recorded POS payment',
        'POST /visits/:id/refunds' => 'Recorded POS refund',
        'POST /service-catalog' => 'Added service catalog item',
        'PATCH /service-catalog/:id' => 'Updated service catalog item',
        'DELETE /service-catalog/:id' => 'Deactivated service catalog item',
        'POST /service-catalog/:id/materials' => 'Updated service materials',
        'PATCH /service-display-settings' => 'Updated service display settings',
        'POST /special_services' => 'Added special service',
        'PATCH /special_services/:id' => 'Updated special service',
        'PATCH /profile' => 'Updated own profile',
        'POST /consent_files' => 'Added consent template',
        'PATCH /consent_files/:id' => 'Updated consent template',
        'DELETE /consent_files/:id' => 'Deleted consent template',
        'POST /consent-form-records' => 'Saved consent form record',
        'PATCH /payment-methods' => 'Updated payment method settings',
        'POST /payment-methods/otp' => 'Requested payment method verification',
        'POST /notifications/preferences' => 'Updated notification preferences',
        'POST /notifications/read-all' => 'Marked all notifications as read',
        'POST /notifications/:id/read' => 'Marked notification as read',
        'POST /reports/generate' => 'Generated report',
        'POST /system-backups' => 'Created system backup',
        'POST /vet-presence' => 'Updated vet presence',
        'POST /vet_schedules' => 'Updated vet schedule',
        'POST /veterinarian-branch-schedules' => 'Updated branch schedule',
        'POST /account/google' => 'Connected Google account',
    ];
    $label = $specificLabels[$method . ' ' . $routePath] ?? $label;
    if ($method === 'POST' && $routePath === '/visits' && is_array($input['payment'] ?? null)) {
        $label = 'Created POS invoice and recorded payment';
    }
    $details = staff_activity_action_details($input, $path);
    $planning = staff_activity_planning_status($path, $input);
    foreach ($details as $detail) {
        if (($detail['label'] ?? '') === 'New status'
            && str_starts_with($label, 'Changed ')
            && str_ends_with($label, ' status')) {
            $label .= ' to ' . $detail['value'];
            break;
        }
    }

    return [
        'kind' => 'action',
        'key' => substr($method . ':' . $routePath, 0, 120),
        'label' => substr($label, 0, 180),
        'summary' => staff_activity_action_summary($details),
        'details' => $details,
        'planning_status' => $planning['status'],
        'planned_for' => $planning['planned_for'],
        'planning_basis' => $planning['basis'],
        'target_type' => substr($root, 0, 80),
        'target_id' => $targetId ?: null,
        'target_label' => staff_activity_target_label($details, $label),
        'method' => $method,
        'path' => substr($routePath, 0, 200),
    ];
}

function staff_activity_register_mutation(PDO $pdo, array $user, string $path, string $method): void
{
    $method = strtoupper($method);
    if (!staff_activity_tracked_role($user)
        || !in_array($method, ['POST', 'PUT', 'PATCH', 'DELETE'], true)
        || str_starts_with($path, '/activity')) {
        return;
    }

    $input = [];
    $contentType = strtolower((string)($_SERVER['CONTENT_TYPE'] ?? ''));
    $contentLength = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
    if (str_contains($contentType, 'application/json') && $contentLength <= 65536) {
        $rawInput = file_get_contents('php://input', false, null, 0, 65537);
        if ($rawInput !== false && strlen($rawInput) <= 65536) {
            $decoded = json_decode($rawInput, true);
            $input = is_array($decoded) ? $decoded : [];
        }
    }
    $query = $_GET;
    try {
        $input = staff_activity_enrich_inventory_input($pdo, $path, $input);
    } catch (Throwable $enrichmentError) {
        error_log('Staff activity inventory detail lookup failed: ' . $enrichmentError->getMessage());
    }
    try {
        $input = staff_activity_enrich_clinical_input($pdo, $path, $input);
    } catch (Throwable $enrichmentError) {
        error_log('Staff activity clinical context lookup failed: ' . $enrichmentError->getMessage());
    }

    register_shutdown_function(static function () use ($pdo, $user, $path, $method, $input, $query): void {
        $status = http_response_code();
        if ($status < 200 || $status >= 300 || $pdo->inTransaction()) {
            return;
        }

        try {
            $event = staff_activity_describe_mutation($path, $method, $input);
            $event['response_status'] = $status;
            try {
                $event['branch_id'] = staff_activity_request_branch($pdo, $path, $input, $query, $user);
            } catch (Throwable $branchError) {
                error_log('Staff activity branch lookup failed: ' . $branchError->getMessage());
                $event['branch_id'] = 0;
            }
            if ($event['branch_id'] <= 0) {
                $event['branch_label'] = staff_activity_is_global_path($path)
                    ? 'Organization-wide'
                    : 'Branch not recorded';
            }
            staff_activity_record($pdo, $user, $event);
        } catch (Throwable $error) {
            error_log('Staff activity logging failed: ' . $error->getMessage());
        }
    });
}
