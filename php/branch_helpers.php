<?php

function branch_table_exists(PDO $pdo, string $tableName): bool
{
    static $cache = [];
    if (array_key_exists($tableName, $cache)) {
        return $cache[$tableName];
    }

    $stmt = $pdo->prepare("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?");
    $stmt->execute([$tableName]);
    $cache[$tableName] = (int)$stmt->fetchColumn() > 0;
    return $cache[$tableName];
}

function branch_column_exists(PDO $pdo, string $tableName, string $columnName): bool
{
    static $cache = [];
    $key = $tableName . '.' . $columnName;
    if (array_key_exists($key, $cache)) {
        return $cache[$key];
    }

    $stmt = $pdo->prepare("SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?");
    $stmt->execute([$tableName, $columnName]);
    $cache[$key] = (int)$stmt->fetchColumn() > 0;
    return $cache[$key];
}

function branch_schema_ready(PDO $pdo): bool
{
    return branch_table_exists($pdo, 'branches')
        && branch_table_exists($pdo, 'branch_service_availability')
        && branch_column_exists($pdo, 'bookings', 'branch_id')
        && branch_column_exists($pdo, 'queues', 'branch_id');
}

function branch_visible_codes(): array
{
    // Operational rollout scope. Other branch rows remain in the database and
    // can be re-enabled later without data loss.
    return ['MAIN', 'ENRIQUEZ'];
}

function branch_is_visible(array $branch): bool
{
    return in_array(strtoupper(trim((string)($branch['branch_code'] ?? ''))), branch_visible_codes(), true);
}

function branch_require_schema(PDO $pdo): void
{
    if (branch_schema_ready($pdo)) {
        return;
    }

    http_response_code(503);
    echo json_encode([
        'message' => 'Multi-branch setup is not installed yet. Run DDL/20260803_01_multi_branch_operations.sql on the deployed database.',
        'code' => 'multi_branch_migration_required',
    ]);
    exit;
}

function branch_normalize_role(?string $role): string
{
    if (function_exists('ipawcus_access_normalize_role')) {
        return ipawcus_access_normalize_role($role);
    }

    $normalized = strtolower(str_replace([' ', '-'], '_', trim((string)$role)));
    return $normalized === 'superadmin' ? 'super_admin' : $normalized;
}

function branch_main_id(PDO $pdo): int
{
    static $mainId = null;
    if ($mainId !== null) {
        return $mainId;
    }

    branch_require_schema($pdo);
    $stmt = $pdo->query("SELECT branch_id FROM branches WHERE is_main = 1 AND status = 'active' ORDER BY branch_id LIMIT 1");
    $mainId = (int)$stmt->fetchColumn();
    if ($mainId <= 0) {
        throw new RuntimeException('The Main Clinic branch is not configured.');
    }

    return $mainId;
}

function branch_service_key(?string $serviceType, $isHomeService = false, $isOnlineConsultation = false): string
{
    if ((int)$isHomeService === 1) {
        return 'home-service';
    }
    if ((int)$isOnlineConsultation === 1) {
        return 'consultation';
    }

    $normalized = strtolower(trim((string)$serviceType));
    return match ($normalized) {
        'online-consultation', 'online consultation' => 'consultation',
        'general check-up', 'general checkup', 'general-checkup', 'general_checkup', 'consultation' => 'General Check-up',
        'home service', 'home_service', 'home-service' => 'home-service',
        'vaccination', 'vaccine', 'vaccines' => 'vaccination',
        'grooming', 'pet grooming' => 'grooming',
        'laboratory', 'laboratory testing', 'lab testing', 'lab_testing' => 'lab-testing',
        'parasite control', 'parasite control or deworming', 'deworming', 'parasite_control' => 'parasite-control',
        'boarding', 'pet boarding', 'pet hotel & boarding', 'pet hotel boarding', 'kennel boarding' => 'boarding',
        'dental services', 'dental check-up', 'dental checkup' => 'dental',
        'surgery', 'surgical services' => 'surgery',
        'kapon', 'spay/neuter', 'spay and neuter' => 'kapon',
        'emergency care', 'emergency' => 'special services',
        'special-services', 'special_services' => 'special services',
        default => trim((string)$serviceType),
    };
}

function branch_fetch(PDO $pdo, int $branchId): ?array
{
    $stmt = $pdo->prepare("SELECT * FROM branches WHERE branch_id = ? AND status = 'active' LIMIT 1");
    $stmt->execute([$branchId]);
    $branch = $stmt->fetch(PDO::FETCH_ASSOC);
    return $branch && branch_is_visible($branch) ? $branch : null;
}

function branch_user_ids(PDO $pdo, int $userId): array
{
    if ($userId <= 0 || !branch_table_exists($pdo, 'user_branch_assignments')) {
        return [];
    }

    $stmt = $pdo->prepare("SELECT branch_id FROM user_branch_assignments WHERE user_id = ? AND is_active = 1 ORDER BY is_primary DESC, branch_id");
    $stmt->execute([$userId]);
    return array_values(array_unique(array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN))));
}

function branch_user_primary_id(PDO $pdo, int $userId): int
{
    if ($userId > 0 && branch_column_exists($pdo, 'users', 'preferred_branch_id')) {
        $stmt = $pdo->prepare("SELECT preferred_branch_id FROM users WHERE user_id = ? LIMIT 1");
        $stmt->execute([$userId]);
        $preferred = (int)$stmt->fetchColumn();
        if ($preferred > 0) {
            return $preferred;
        }
    }

    $branchIds = branch_user_ids($pdo, $userId);
    return $branchIds[0] ?? branch_main_id($pdo);
}

function branch_user_can_access(PDO $pdo, array $user, int $branchId): bool
{
    if ($branchId <= 0) {
        return false;
    }

    $role = branch_normalize_role($user['role'] ?? $user['normalized_role'] ?? '');
    if ($role === 'super_admin' || $role === 'pet_owner') {
        return true;
    }

    return in_array($branchId, branch_user_ids($pdo, (int)($user['user_id'] ?? 0)), true);
}

function branch_admin_recipient_ids(PDO $pdo, int $branchId, bool $includeSuperAdmins = true): array
{
    $activeFilter = branch_column_exists($pdo, 'users', 'account_status')
        ? " AND COALESCE(u.account_status, 'active') = 'active'"
        : '';
    $sql = "
        SELECT DISTINCT u.user_id
        FROM users u
        LEFT JOIN user_branch_assignments uba
          ON uba.user_id = u.user_id AND uba.is_active = 1
        WHERE (
            (LOWER(REPLACE(REPLACE(TRIM(u.role), ' ', '_'), '-', '_')) = 'admin' AND uba.branch_id = ?)
    ";
    if ($includeSuperAdmins) {
        $sql .= " OR LOWER(REPLACE(REPLACE(TRIM(u.role), ' ', '_'), '-', '_')) IN ('super_admin', 'superadmin')";
    }
    $sql .= ") {$activeFilter}";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([$branchId]);
    return array_values(array_unique(array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN))));
}

function branch_active_veterinarian_ids(PDO $pdo): array
{
    $activeFilter = branch_column_exists($pdo, 'users', 'account_status')
        ? " AND COALESCE(u.account_status, 'active') = 'active'"
        : '';
    $profileFilter = branch_table_exists($pdo, 'veterinarian_profiles')
        ? " AND EXISTS (SELECT 1 FROM veterinarian_profiles vp WHERE vp.user_id = u.user_id AND COALESCE(vp.is_active, 1) = 1)"
        : '';
    $stmt = $pdo->query("
        SELECT u.user_id
        FROM users u
        WHERE LOWER(REPLACE(REPLACE(TRIM(u.role), ' ', '_'), '-', '_')) IN ('veterinarian', 'vet')
        {$activeFilter}{$profileFilter}
    ");
    return array_values(array_unique(array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN))));
}

function branch_is_open(PDO $pdo, int $branchId, string $date, string $time): bool
{
    $dateTime = strtotime(trim($date . ' ' . $time));
    if ($dateTime === false) {
        return false;
    }

    // All VFC locations are closed every Sunday, even if an older database
    // still contains a legacy Sunday operating-hours row marked as open.
    if ((int)date('N', $dateTime) === 7) {
        return false;
    }

    $closureStmt = $pdo->prepare("SELECT COUNT(*) FROM branch_closures WHERE branch_id = ? AND closure_date = ?");
    $closureStmt->execute([$branchId, date('Y-m-d', $dateTime)]);
    if ((int)$closureStmt->fetchColumn() > 0) {
        return false;
    }

    $dayOfWeek = (int)date('N', $dateTime);
    $hoursStmt = $pdo->prepare("
        SELECT opens_at, closes_at, is_closed
        FROM branch_operating_hours
        WHERE branch_id = ? AND day_of_week = ?
        LIMIT 1
    ");
    $hoursStmt->execute([$branchId, $dayOfWeek]);
    $hours = $hoursStmt->fetch(PDO::FETCH_ASSOC);
    if (!$hours || (int)$hours['is_closed'] === 1) {
        return false;
    }

    $normalizedTime = date('H:i:s', $dateTime);
    return $normalizedTime >= (string)$hours['opens_at'] && $normalizedTime <= (string)$hours['closes_at'];
}

function branch_find_vet_visit(
    PDO $pdo,
    int $branchId,
    string $serviceKey,
    string $date,
    string $time,
    ?int $veterinarianUserId = null
): ?array {
    $appointmentAt = date('Y-m-d H:i:s', strtotime(trim($date . ' ' . $time)) ?: 0);
    $params = [$branchId, $appointmentAt, $appointmentAt];
    $vetFilter = '';
    if ($veterinarianUserId !== null && $veterinarianUserId > 0) {
        $vetFilter = ' AND schedule.veterinarian_user_id = ?';
        $params[] = $veterinarianUserId;
    }

    $stmt = $pdo->prepare("
        SELECT schedule.*, CONCAT(u.first_Name, ' ', u.last_Name) AS veterinarian_name
        FROM veterinarian_branch_schedules schedule
        JOIN users u ON u.user_id = schedule.veterinarian_user_id
        WHERE schedule.branch_id = ?
          AND schedule.status = 'published'
          AND schedule.starts_at <= ?
          AND schedule.ends_at >= ?
          {$vetFilter}
          AND (
              schedule.service_keys IS NULL
              OR TRIM(schedule.service_keys) = ''
              OR JSON_CONTAINS(schedule.service_keys, JSON_QUOTE(?))
          )
        ORDER BY schedule.starts_at, schedule.visit_schedule_id
        LIMIT 1
    ");
    $params[] = $serviceKey;
    $stmt->execute($params);
    $schedule = $stmt->fetch(PDO::FETCH_ASSOC);
    return $schedule ?: null;
}

function branch_resolve_booking(
    PDO $pdo,
    $requestedBranchId,
    ?string $serviceType,
    $isHomeService,
    $isOnlineConsultation,
    string $bookingDate,
    string $bookingTime,
    ?int $requestedVeterinarianId = null
): array {
    branch_require_schema($pdo);
    $serviceKey = branch_service_key($serviceType, $isHomeService, $isOnlineConsultation);
    $mainOnly = ['General Check-up', 'consultation', 'home-service', 'dental', 'surgery', 'kapon', 'special services'];
    $branchId = in_array($serviceKey, $mainOnly, true)
        ? branch_main_id($pdo)
        : (is_numeric($requestedBranchId) ? (int)$requestedBranchId : branch_main_id($pdo));

    $branch = branch_fetch($pdo, $branchId);
    if (!$branch) {
        throw new InvalidArgumentException('The selected clinic branch is unavailable.');
    }

    $serviceStmt = $pdo->prepare("
        SELECT * FROM branch_service_availability
        WHERE branch_id = ? AND service_key = ? AND is_active = 1 AND booking_enabled = 1
        LIMIT 1
    ");
    $serviceStmt->execute([$branchId, $serviceKey]);
    $availability = $serviceStmt->fetch(PDO::FETCH_ASSOC);
    if (!$availability) {
        throw new InvalidArgumentException($branch['branch_name'] . ' does not offer this service.');
    }

    if (!branch_is_open($pdo, $branchId, $bookingDate, $bookingTime)) {
        throw new InvalidArgumentException($branch['branch_name'] . ' accepts bookings Monday to Saturday, from 8:00 AM to 6:00 PM. The clinic is closed on Sundays and configured closure dates.');
    }

    $visit = null;
    if (($availability['availability_mode'] ?? '') === 'vet_visit') {
        $visit = branch_find_vet_visit(
            $pdo,
            $branchId,
            $serviceKey,
            $bookingDate,
            $bookingTime,
            $requestedVeterinarianId
        );
        if (!$visit) {
            throw new InvalidArgumentException('This Pet Corner service is available only during a published veterinarian visit. Select a listed visit date and time.');
        }
    }

    return [
        'branch_id' => $branchId,
        'branch' => $branch,
        'service_key' => $serviceKey,
        'availability' => $availability,
        'visit_schedule' => $visit,
        'veterinarian_user_id' => $visit ? (int)$visit['veterinarian_user_id'] : $requestedVeterinarianId,
    ];
}

function branch_fetch_catalog(PDO $pdo, ?string $serviceKey = null, ?string $date = null): array
{
    branch_require_schema($pdo);
    $params = [];
    $serviceFilter = '';
    if ($serviceKey !== null && trim($serviceKey) !== '') {
        $serviceFilter = ' AND bsa.service_key = ?';
        // `consultation` is the stored key for online consultations. Passing
        // that already-canonical key back through branch_service_key() would
        // otherwise reinterpret it as a General Check-up.
        $params[] = strtolower(trim($serviceKey)) === 'consultation'
            ? 'consultation'
            : branch_service_key($serviceKey);
    }

    $stmt = $pdo->prepare("
        SELECT
            b.branch_id,
            b.branch_code,
            b.branch_name,
            b.branch_type,
            b.address,
            b.phone_number,
            b.map_url,
            b.is_main,
            bsa.service_key,
            bsa.service_label,
            bsa.availability_mode,
            hours.day_of_week,
            hours.opens_at,
            hours.closes_at,
            hours.is_closed
        FROM branches b
        LEFT JOIN branch_service_availability bsa
          ON bsa.branch_id = b.branch_id AND bsa.is_active = 1 AND bsa.booking_enabled = 1
        LEFT JOIN branch_operating_hours hours ON hours.branch_id = b.branch_id
        WHERE b.status = 'active'
          AND b.branch_code IN ('MAIN', 'ENRIQUEZ')
          {$serviceFilter}
        ORDER BY b.is_main DESC, b.branch_name, bsa.service_label, hours.day_of_week
    ");
    $stmt->execute($params);

    $branches = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $branchId = (int)$row['branch_id'];
        if (!isset($branches[$branchId])) {
            $branches[$branchId] = [
                'id' => $branchId,
                'code' => $row['branch_code'],
                'name' => $row['branch_name'],
                'type' => $row['branch_type'],
                'address' => $row['address'],
                'phoneNumber' => $row['phone_number'],
                'mapUrl' => $row['map_url'],
                'isMain' => (bool)$row['is_main'],
                'services' => [],
                'operatingHours' => [],
                'vetVisits' => [],
            ];
        }
        if ($row['service_key'] !== null) {
            $branches[$branchId]['services'][$row['service_key']] = [
                'key' => $row['service_key'],
                'label' => $row['service_label'],
                'availabilityMode' => $row['availability_mode'],
            ];
        }
        if ($row['day_of_week'] !== null) {
            $branches[$branchId]['operatingHours'][(int)$row['day_of_week']] = [
                'dayOfWeek' => (int)$row['day_of_week'],
                'opensAt' => $row['opens_at'],
                'closesAt' => $row['closes_at'],
                'isClosed' => (bool)$row['is_closed'],
            ];
        }
    }

    $visitParams = [];
    $visitWhere = "schedule.status = 'published' AND schedule.ends_at >= NOW()";
    if ($date !== null && trim($date) !== '') {
        $visitWhere .= ' AND DATE(schedule.starts_at) = ?';
        $visitParams[] = $date;
    }
    $visitStmt = $pdo->prepare("
        SELECT schedule.*, CONCAT(u.first_Name, ' ', u.last_Name) AS veterinarian_name
        FROM veterinarian_branch_schedules schedule
        JOIN users u ON u.user_id = schedule.veterinarian_user_id
        WHERE {$visitWhere}
        ORDER BY schedule.starts_at, veterinarian_name
    ");
    $visitStmt->execute($visitParams);
    foreach ($visitStmt->fetchAll(PDO::FETCH_ASSOC) as $visit) {
        $branchId = (int)$visit['branch_id'];
        if (!isset($branches[$branchId])) {
            continue;
        }
        $serviceKeys = json_decode((string)($visit['service_keys'] ?? ''), true);
        $branches[$branchId]['vetVisits'][] = [
            'id' => (int)$visit['visit_schedule_id'],
            'veterinarianUserId' => (int)$visit['veterinarian_user_id'],
            'veterinarianName' => trim((string)$visit['veterinarian_name']),
            'startsAt' => $visit['starts_at'],
            'endsAt' => $visit['ends_at'],
            'serviceKeys' => is_array($serviceKeys) ? $serviceKeys : [],
            'appointmentCapacity' => $visit['appointment_capacity'] !== null ? (int)$visit['appointment_capacity'] : null,
            'notes' => $visit['notes'],
        ];
    }

    return array_values(array_map(function (array $branch): array {
        $branch['services'] = array_values($branch['services']);
        $branch['operatingHours'] = array_values($branch['operatingHours']);
        return $branch;
    }, $branches));
}
