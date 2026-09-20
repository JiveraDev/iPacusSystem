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

function staff_activity_record(PDO $pdo, array $user, array $event): void
{
    if (!staff_activity_tracked_role($user)) {
        return;
    }

    $branch = staff_activity_branch($pdo, (int)($event['branch_id'] ?? 0));
    $actorName = trim((string)($user['first_Name'] ?? '') . ' ' . (string)($user['last_Name'] ?? ''));
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
        'target_type' => $event['target_type'] ?? null,
        'target_id' => isset($event['target_id']) && (int)$event['target_id'] > 0 ? (int)$event['target_id'] : null,
        'request_method' => $event['method'] ?? null,
        'request_path' => $event['path'] ?? null,
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

function staff_activity_record_sign_in(PDO $pdo, array $user, string $provider): void
{
    if (!staff_activity_tracked_role($user)) return;
    try {
        staff_activity_record($pdo, $user, [
            'kind' => 'sign_in',
            'key' => 'sign_in:' . $provider,
            'label' => $provider === 'google' ? 'Signed in with Google' : 'Signed in',
            'branch_label' => 'Organization-wide',
            'method' => 'POST',
            'path' => $provider === 'google' ? '/auth/google' : '/login',
        ]);
    } catch (Throwable $error) {
        error_log('Staff sign-in activity logging failed: ' . $error->getMessage());
    }
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

function staff_activity_list(PDO $pdo, array $filters, int $limit, int $offset): array
{
    $matches = 0;
    $items = [];
    foreach (staff_activity_entries($pdo, $filters['user_id'] ?? null) as $entry) {
        if (isset($filters['user_id']) && (int)$entry['actor_user_id'] !== (int)$filters['user_id']) continue;
        if (isset($filters['role']) && ($entry['actor_role'] ?? '') !== $filters['role']) continue;
        if (isset($filters['branch_id']) && (int)($entry['branch_id'] ?? 0) !== (int)$filters['branch_id']) continue;
        if (isset($filters['kind']) && ($entry['activity_kind'] ?? '') !== $filters['kind']) continue;
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
    $staffStmt = $pdo->query("
        SELECT user_id, first_Name, last_Name, role FROM users
        WHERE LOWER(REPLACE(REPLACE(TRIM(role), ' ', '_'), '-', '_'))
            IN ('admin', 'veterinarian', 'vet', 'super_admin', 'superadmin')
    ");
    foreach ($staffStmt->fetchAll(PDO::FETCH_ASSOC) as $user) {
        if (!staff_activity_tracked_role($user)) continue;
        $userId = (int)$user['user_id'];
        $name = trim((string)$user['first_Name'] . ' ' . (string)$user['last_Name']);
        $users[$userId] = [
            'user_id' => $userId,
            'name' => $name !== '' ? $name : 'User #' . $userId,
            'role' => ipawcus_access_normalize_role((string)$user['role']),
        ];
    }
    $branchStmt = $pdo->query('SELECT branch_id, branch_name FROM branches ORDER BY branch_name');
    foreach ($branchStmt->fetchAll(PDO::FETCH_ASSOC) as $branch) {
        $branches[(int)$branch['branch_id']] = $branch;
    }
    foreach (staff_activity_entries($pdo) as $entry) {
        $userId = (int)$entry['actor_user_id'];
        if (!isset($users[$userId])) {
            $users[$userId] = [
                'user_id' => $userId,
                'name' => $entry['actor_name'],
                'role' => $entry['actor_role'],
            ];
        }
        $branchId = (int)($entry['branch_id'] ?? 0);
        if ($branchId > 0 && !isset($branches[$branchId])) {
            $branches[$branchId] = ['branch_id' => $branchId, 'branch_name' => $entry['branch_name']];
        }
    }
    $users = array_values($users);
    $branches = array_values($branches);
    usort($users, static fn($first, $second) => strcasecmp($first['name'], $second['name']));
    usort($branches, static fn($first, $second) => strcasecmp((string)$first['branch_name'], (string)$second['branch_name']));
    return ['users' => $users, 'branches' => $branches];
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
        $targetId = staff_activity_input_number($input, ['bookingId', 'booking_id', 'queueId', 'queue_id', 'visitId', 'visit_id', 'itemId', 'item_id']);
    }

    $routePath = (string)preg_replace('#/\d+(?=/|$)#', '/:id', $path);
    $specificLabels = [
        'POST /accounts/create' => 'Created staff account',
        'PATCH /accounts/:id/status' => 'Changed account status',
        'PATCH /accounts/:id/profile' => 'Updated staff profile',
        'DELETE /accounts/:id' => 'Deleted staff account',
        'POST /admin-feature-access' => 'Changed admin feature access',
        'POST /pet_information' => 'Registered pet',
        'PATCH /pet_information/:id' => 'Updated pet record',
        'PATCH /pet_information/:id/status' => 'Changed pet status',
        'POST /bookings' => 'Created booking',
        'PATCH /bookings/:id/status' => 'Changed booking status',
        'PATCH /bookings/:id/schedule' => 'Rescheduled booking',
        'PATCH /bookings/:id/branch' => 'Transferred booking to another branch',
        'POST /bookings/:id/receive' => 'Received booking',
        'POST /queues' => 'Created queue entry',
        'POST /queues/status' => 'Changed queue status',
        'POST /queues/receive' => 'Received queue entry',
        'POST /queues/assign' => 'Assigned queue entry',
        'POST /inventory/items' => 'Added inventory item',
        'PATCH /inventory/items' => 'Updated inventory item',
        'POST /inventory/stock-in' => 'Recorded stock in',
        'POST /inventory/stock-out' => 'Recorded stock out',
        'POST /inventory/transfer' => 'Transferred inventory',
        'POST /inventory/delete' => 'Removed inventory item',
        'POST /grooming' => 'Updated grooming workflow',
        'POST /boarding/direct-check-in' => 'Checked in boarding guest',
        'POST /boarding/bookings/:id/check-in' => 'Checked in boarding guest',
        'POST /boarding/bookings/:id/check-out' => 'Checked out boarding guest',
        'POST /record-update-requests' => 'Submitted record update request',
        'PATCH /record-update-requests/:id' => 'Updated record request',
        'POST /vet-diagnoses' => 'Saved diagnosis',
        'PATCH /vet-diagnoses/:id' => 'Updated diagnosis',
        'POST /online-consultations/:id/start' => 'Started online consultation',
        'POST /online-consultations/:id/end' => 'Ended online consultation',
        'POST /online-consultations/:id/diagnosis' => 'Saved online diagnosis',
        'POST /visits/:id/charges' => 'Updated visit charges',
        'POST /visits/:id/payments' => 'Recorded visit payment',
        'POST /visits/:id/refunds' => 'Recorded visit refund',
        'POST /reports/generate' => 'Generated report',
        'POST /system-backups' => 'Created system backup',
        'POST /vet-presence' => 'Updated vet presence',
        'POST /veterinarian-branch-schedules' => 'Updated branch schedule',
        'POST /account/google' => 'Connected Google account',
    ];
    $label = $specificLabels[$method . ' ' . $routePath] ?? $label;

    return [
        'kind' => 'action',
        'key' => substr($method . ':' . $routePath, 0, 120),
        'label' => substr($label, 0, 180),
        'target_type' => substr($root, 0, 80),
        'target_id' => $targetId ?: null,
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

    register_shutdown_function(static function () use ($pdo, $user, $path, $method, $input, $query): void {
        $status = http_response_code();
        if ($status < 200 || $status >= 300 || $pdo->inTransaction()) {
            return;
        }

        try {
            $event = staff_activity_describe_mutation($path, $method, $input);
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
