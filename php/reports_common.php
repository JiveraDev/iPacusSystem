<?php
require_once __DIR__ . '/consent_record_helpers.php';

date_default_timezone_set('Asia/Manila');

const REPORTS_TIMEZONE = 'Asia/Manila';

function reports_payload(): array
{
    $body = json_decode(file_get_contents('php://input'), true);
    $payload = is_array($body) ? $body : [];

    return array_merge($_GET, $payload);
}

function reports_json(array $payload, int $statusCode = 200): void
{
    http_response_code($statusCode);
    echo json_encode($payload);
    exit;
}

function reports_normalize_role($role): string
{
    return strtolower(str_replace([' ', '-'], '_', trim((string)$role)));
}

function reports_require_super_admin(array $payload): void
{
    $role = $payload['role']
        ?? $payload['user_role']
        ?? ($_SERVER['HTTP_X_USER_ROLE'] ?? '');
    $role = reports_normalize_role($role);

    if (!in_array($role, ['super_admin', 'superadmin'], true)) {
        reports_json([
            'success' => false,
            'message' => 'Only Super Admin can access reports.',
        ], 403);
    }
}

function reports_date_or_null($value): ?DateTimeImmutable
{
    $text = trim((string)$value);
    if ($text === '') {
        return null;
    }

    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $text, new DateTimeZone(REPORTS_TIMEZONE));
    if (!$date || $date->format('Y-m-d') !== $text) {
        return null;
    }

    return $date;
}

function reports_date_range(array $payload): array
{
    $timezone = new DateTimeZone(REPORTS_TIMEZONE);
    $now = new DateTimeImmutable('now', $timezone);
    $quickRange = strtolower((string)($payload['range'] ?? $payload['quick_range'] ?? 'this_month'));
    $start = null;
    $end = null;

    if ($quickRange === 'custom') {
        $start = reports_date_or_null($payload['start_date'] ?? null);
        $end = reports_date_or_null($payload['end_date'] ?? null);
        if (!$start || !$end) {
            reports_json([
                'success' => false,
                'message' => 'Use valid YYYY-MM-DD start_date and end_date for custom reports.',
            ], 422);
        }
    } elseif (!empty($payload['start_date']) || !empty($payload['end_date'])) {
        $start = reports_date_or_null($payload['start_date'] ?? null);
        $end = reports_date_or_null($payload['end_date'] ?? null);
        if (!$start || !$end) {
            reports_json([
                'success' => false,
                'message' => 'Use valid YYYY-MM-DD start_date and end_date.',
            ], 422);
        }
        $quickRange = 'custom';
    } elseif ($quickRange === 'today') {
        $start = $now->setTime(0, 0, 0);
        $end = $start;
    } elseif ($quickRange === 'this_week') {
        $start = $now->modify('monday this week')->setTime(0, 0, 0);
        $end = $start->modify('+6 days');
    } elseif ($quickRange === 'this_quarter') {
        $quarterMonth = (((int)ceil(((int)$now->format('n')) / 3) - 1) * 3) + 1;
        $start = $now->setDate((int)$now->format('Y'), $quarterMonth, 1)->setTime(0, 0, 0);
        $end = $start->modify('+3 months -1 day');
    } elseif ($quickRange === 'this_year') {
        $start = $now->setDate((int)$now->format('Y'), 1, 1)->setTime(0, 0, 0);
        $end = $now->setDate((int)$now->format('Y'), 12, 31)->setTime(0, 0, 0);
    } else {
        $quickRange = 'this_month';
        $start = $now->setDate((int)$now->format('Y'), (int)$now->format('n'), 1)->setTime(0, 0, 0);
        $end = $start->modify('last day of this month');
    }

    if ($start > $end) {
        reports_json([
            'success' => false,
            'message' => 'start_date must be before or equal to end_date.',
        ], 422);
    }

    return [
        'range' => $quickRange,
        'start_date' => $start->format('Y-m-d'),
        'end_date' => $end->format('Y-m-d'),
        'start_datetime' => $start->setTime(0, 0, 0)->format('Y-m-d H:i:s'),
        'end_datetime' => $end->setTime(23, 59, 59)->format('Y-m-d H:i:s'),
        'label' => $start->format('F j, Y') . ' to ' . $end->format('F j, Y'),
    ];
}

function reports_filters(array $payload): array
{
    $filters = $payload['filters'] ?? [];
    if (is_string($filters)) {
        $decoded = json_decode($filters, true);
        $filters = is_array($decoded) ? $decoded : [];
    }

    $flatKeys = [
        'service_type',
        'payment_method',
        'appointment_status',
        'queue_status',
        'consultation_type',
        'veterinarian',
        'pet_type',
        'inventory_category',
        'stock_status',
        'consent_status',
    ];

    foreach ($flatKeys as $key) {
        if (array_key_exists($key, $payload) && !array_key_exists($key, $filters)) {
            $filters[$key] = $payload[$key];
        }
    }

    return array_filter($filters, static function ($value) {
        return $value !== null && trim((string)$value) !== '' && $value !== 'all';
    });
}

function reports_table_exists(PDO $pdo, string $tableName): bool
{
    static $cache = [];
    if (array_key_exists($tableName, $cache)) {
        return $cache[$tableName];
    }

    $stmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM information_schema.tables
        WHERE table_schema = DATABASE()
          AND table_name = ?
    ");
    $stmt->execute([$tableName]);
    $cache[$tableName] = (int)$stmt->fetchColumn() > 0;

    return $cache[$tableName];
}

function reports_column_exists(PDO $pdo, string $tableName, string $columnName): bool
{
    static $cache = [];
    $key = "{$tableName}.{$columnName}";
    if (array_key_exists($key, $cache)) {
        return $cache[$key];
    }

    $stmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = ?
          AND column_name = ?
    ");
    $stmt->execute([$tableName, $columnName]);
    $cache[$key] = (int)$stmt->fetchColumn() > 0;

    return $cache[$key];
}

function reports_has_tables(PDO $pdo, array $tables, array &$missing): bool
{
    $ok = true;
    foreach ($tables as $table) {
        if (!reports_table_exists($pdo, $table)) {
            $missing[] = "Missing table: {$table}";
            $ok = false;
        }
    }

    return $ok;
}

function reports_fetch_all(PDO $pdo, string $sql, array $params, array &$missing, string $note): array
{
    try {
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (Throwable $e) {
        $missing[] = $note;
        return [];
    }
}

function reports_money($value): float
{
    return round((float)$value, 2);
}

function reports_int($value): int
{
    return (int)($value ?? 0);
}

function reports_full_name(?array $row, string $prefix = ''): string
{
    $first = trim((string)($row[$prefix . 'first_Name'] ?? ''));
    $last = trim((string)($row[$prefix . 'last_Name'] ?? ''));
    $email = trim((string)($row[$prefix . 'mail_Address'] ?? ''));
    $name = trim($first . ' ' . $last);

    return $name !== '' ? $name : ($email !== '' ? $email : 'Unknown');
}

function reports_metric(string $label, $value, string $format = 'number'): array
{
    return [
        'label' => $label,
        'value' => $value,
        'format' => $format,
    ];
}

function reports_empty_chart(string $type = 'bar'): array
{
    return [
        'type' => $type,
        'labels' => [],
        'datasets' => [],
    ];
}

function reports_bar_chart(array $rows, string $labelKey, string $valueKey, string $label): array
{
    return [
        'type' => 'bar',
        'labels' => array_map(static fn($row) => (string)($row[$labelKey] ?? ''), $rows),
        'datasets' => [[
            'label' => $label,
            'data' => array_map(static fn($row) => (float)($row[$valueKey] ?? 0), $rows),
        ]],
    ];
}

function reports_line_chart(array $rows, string $labelKey, string $valueKey, string $label): array
{
    return [
        'type' => 'line',
        'labels' => array_map(static fn($row) => (string)($row[$labelKey] ?? ''), $rows),
        'datasets' => [[
            'label' => $label,
            'data' => array_map(static fn($row) => (float)($row[$valueKey] ?? 0), $rows),
        ]],
    ];
}

function reports_doughnut_chart(array $labels, array $values, string $label): array
{
    return [
        'type' => 'doughnut',
        'labels' => array_values($labels),
        'datasets' => [[
            'label' => $label,
            'data' => array_map('floatval', array_values($values)),
        ]],
    ];
}

function reports_revenue_breakdown_trend(PDO $pdo, array $range, array &$missing): array
{
    if (!reports_has_tables($pdo, ['visits', 'visit_charges'], $missing)) {
        return reports_empty_chart('line');
    }

    $period = reports_period_expression('v.created_at', $range);
    $rows = reports_fetch_all($pdo, "
        SELECT
            {$period['expression']} AS period_label,
            COALESCE(SUM(CASE WHEN vc.charge_type IN ('medication', 'retail_product', 'consumable') THEN vc.subtotal ELSE 0 END), 0) AS product_revenue,
            COALESCE(SUM(CASE WHEN vc.charge_type NOT IN ('medication', 'retail_product', 'consumable') THEN vc.subtotal ELSE 0 END), 0) AS service_revenue
        FROM visits v
        LEFT JOIN visit_charges vc ON vc.visit_id = v.visit_id
        WHERE v.created_at BETWEEN ? AND ?
        GROUP BY period_label
        ORDER BY period_label ASC
    ", [$range['start_datetime'], $range['end_datetime']], $missing, 'Revenue breakdown trend data could not be loaded.');

    $services = [];
    $products = [];
    foreach ($rows as $row) {
        $periodLabel = (string)$row['period_label'];
        $services[$periodLabel] = reports_money($row['service_revenue']);
        $products[$periodLabel] = reports_money($row['product_revenue']);
    }

    $merged = reports_merge_period_values([
        ['label' => 'Services', 'values' => $services],
        ['label' => 'Medicine/Product', 'values' => $products],
    ]);

    return [
        'type' => 'line',
        'labels' => $merged['labels'],
        'datasets' => $merged['datasets'],
        'period_label' => $period['label'],
    ];
}

function reports_period_expression(string $column, array $range): array
{
    $start = new DateTimeImmutable($range['start_date'], new DateTimeZone(REPORTS_TIMEZONE));
    $end = new DateTimeImmutable($range['end_date'], new DateTimeZone(REPORTS_TIMEZONE));
    $days = $start->diff($end)->days + 1;

    if ($range['range'] === 'today') {
        return [
            'expression' => "DATE_FORMAT({$column}, '%Y-%m-%d %H:00')",
            'label' => 'Hourly',
        ];
    }

    if ($range['range'] === 'this_year' || $days > 180) {
        return [
            'expression' => "DATE_FORMAT({$column}, '%Y-%m')",
            'label' => 'Monthly',
        ];
    }

    if ($range['range'] === 'this_quarter' || $days > 45) {
        return [
            'expression' => "CONCAT(YEAR({$column}), '-W', LPAD(WEEK({$column}, 1), 2, '0'))",
            'label' => 'Weekly',
        ];
    }

    return [
        'expression' => "DATE({$column})",
        'label' => 'Daily',
    ];
}

function reports_merge_period_values(array $datasets): array
{
    $labels = [];
    foreach ($datasets as $dataset) {
        foreach (array_keys($dataset['values']) as $period) {
            $labels[$period] = true;
        }
    }
    $labels = array_keys($labels);
    sort($labels);

    return [
        'labels' => $labels,
        'datasets' => array_map(static function ($dataset) use ($labels) {
            return [
                'label' => $dataset['label'],
                'data' => array_map(static fn($period) => (float)($dataset['values'][$period] ?? 0), $labels),
            ];
        }, $datasets),
    ];
}

function reports_revenue_diagnosis_trend(PDO $pdo, array $range, array &$missing): array
{
    $revenue = [];
    $diagnoses = [];

    if (reports_has_tables($pdo, ['visits', 'visit_charges'], $missing)) {
        $period = reports_period_expression('v.created_at', $range);
        $rows = reports_fetch_all($pdo, "
            SELECT {$period['expression']} AS period_label, COALESCE(SUM(vc.subtotal), 0) AS total_revenue
            FROM visits v
            LEFT JOIN visit_charges vc ON vc.visit_id = v.visit_id
            WHERE v.created_at BETWEEN ? AND ?
            GROUP BY period_label
            ORDER BY period_label ASC
        ", [$range['start_datetime'], $range['end_datetime']], $missing, 'Revenue trend data could not be loaded.');

        foreach ($rows as $row) {
            $revenue[(string)$row['period_label']] = reports_money($row['total_revenue']);
        }
    }

    if (reports_has_tables($pdo, ['vet_diagnoses'], $missing)) {
        $period = reports_period_expression('COALESCE(vd.finalized_at, vd.created_at)', $range);
        $rows = reports_fetch_all($pdo, "
            SELECT {$period['expression']} AS period_label, COUNT(*) AS diagnosis_count
            FROM vet_diagnoses vd
            WHERE COALESCE(vd.finalized_at, vd.created_at) BETWEEN ? AND ?
            GROUP BY period_label
            ORDER BY period_label ASC
        ", [$range['start_datetime'], $range['end_datetime']], $missing, 'Diagnosis trend data could not be loaded.');

        foreach ($rows as $row) {
            $diagnoses[(string)$row['period_label']] = reports_int($row['diagnosis_count']);
        }
    }

    $merged = reports_merge_period_values([
        ['label' => 'Revenue', 'values' => $revenue],
        ['label' => 'Diagnosis Sessions', 'values' => $diagnoses],
    ]);

    return [
        'type' => 'line',
        'labels' => $merged['labels'],
        'datasets' => $merged['datasets'],
        'period_label' => reports_period_expression('created_at', $range)['label'],
    ];
}

function reports_online_appointment_trend(PDO $pdo, array $range, array &$missing): array
{
    $values = [];
    if (reports_table_exists($pdo, 'online_consultations')) {
        $period = reports_period_expression('oc.scheduled_start', $range);
        $rows = reports_fetch_all($pdo, "
            SELECT {$period['expression']} AS period_label, COUNT(*) AS appointment_count
            FROM online_consultations oc
            WHERE oc.scheduled_start BETWEEN ? AND ?
            GROUP BY period_label
            ORDER BY period_label ASC
        ", [$range['start_datetime'], $range['end_datetime']], $missing, 'Online appointment trend data could not be loaded.');
    } elseif (reports_table_exists($pdo, 'bookings')) {
        $period = reports_period_expression('b.booking_date', $range);
        $rows = reports_fetch_all($pdo, "
            SELECT {$period['expression']} AS period_label, COUNT(*) AS appointment_count
            FROM bookings b
            WHERE b.is_online_consultation = 1
              AND b.booking_date BETWEEN ? AND ?
            GROUP BY period_label
            ORDER BY period_label ASC
        ", [$range['start_date'], $range['end_date']], $missing, 'Online booking trend data could not be loaded.');
        $missing[] = 'online_consultations table is missing; online appointment trend is based on bookings only.';
    } else {
        $missing[] = 'Missing table: online_consultations or bookings';
        $rows = [];
    }

    foreach ($rows as $row) {
        $values[(string)$row['period_label']] = reports_int($row['appointment_count']);
    }

    $merged = reports_merge_period_values([
        ['label' => 'Online Appointments', 'values' => $values],
    ]);

    return [
        'type' => 'line',
        'labels' => $merged['labels'],
        'datasets' => $merged['datasets'],
    ];
}

function reports_queue_booking_trend(PDO $pdo, array $range, array &$missing): array
{
    $queues = [];
    $bookings = [];

    if (reports_has_tables($pdo, ['queues'], $missing)) {
        $period = reports_period_expression('q.`timestamp`', $range);
        $rows = reports_fetch_all($pdo, "
            SELECT {$period['expression']} AS period_label, COUNT(*) AS queue_count
            FROM queues q
            WHERE q.`timestamp` BETWEEN ? AND ?
            GROUP BY period_label
            ORDER BY period_label ASC
        ", [$range['start_datetime'], $range['end_datetime']], $missing, 'Queue trend data could not be loaded.');
        foreach ($rows as $row) {
            $queues[(string)$row['period_label']] = reports_int($row['queue_count']);
        }
    }

    if (reports_has_tables($pdo, ['bookings'], $missing)) {
        $period = reports_period_expression('b.booking_date', $range);
        $rows = reports_fetch_all($pdo, "
            SELECT {$period['expression']} AS period_label, COUNT(*) AS booking_count
            FROM bookings b
            WHERE b.booking_date BETWEEN ? AND ?
            GROUP BY period_label
            ORDER BY period_label ASC
        ", [$range['start_date'], $range['end_date']], $missing, 'Booking trend data could not be loaded.');
        foreach ($rows as $row) {
            $bookings[(string)$row['period_label']] = reports_int($row['booking_count']);
        }
    }

    $merged = reports_merge_period_values([
        ['label' => 'Queue Entries', 'values' => $queues],
        ['label' => 'Bookings', 'values' => $bookings],
    ]);

    return [
        'type' => 'line',
        'labels' => $merged['labels'],
        'datasets' => $merged['datasets'],
    ];
}

function reports_boarding_trend(PDO $pdo, array $range, array &$missing): array
{
    if (!reports_has_tables($pdo, ['bookings'], $missing)) {
        return reports_empty_chart('line');
    }

    $period = reports_period_expression('COALESCE(b.check_in_date, b.booking_date)', $range);
    $rows = reports_fetch_all($pdo, "
        SELECT
            {$period['expression']} AS period_label,
            SUM(CASE WHEN b.hotel_boarding_type = 'hotel' THEN 1 ELSE 0 END) AS hotel_count,
            SUM(CASE WHEN b.hotel_boarding_type = 'boarding' OR b.hotel_boarding_type IS NULL THEN 1 ELSE 0 END) AS kennel_count
        FROM bookings b
        WHERE b.service_type = 'boarding'
          AND COALESCE(b.check_in_date, b.booking_date) BETWEEN ? AND ?
        GROUP BY period_label
        ORDER BY period_label ASC
    ", [$range['start_date'], $range['end_date']], $missing, 'Boarding and pet hotel trend data could not be loaded.');

    $hotel = [];
    $kennel = [];
    foreach ($rows as $row) {
        $hotel[(string)$row['period_label']] = reports_int($row['hotel_count']);
        $kennel[(string)$row['period_label']] = reports_int($row['kennel_count']);
    }

    $merged = reports_merge_period_values([
        ['label' => 'Pet Hotel', 'values' => $hotel],
        ['label' => 'Boarding / Kennel', 'values' => $kennel],
    ]);

    return [
        'type' => 'line',
        'labels' => $merged['labels'],
        'datasets' => $merged['datasets'],
    ];
}

function reports_pet_distribution_chart(PDO $pdo, array &$missing): array
{
    if (!reports_has_tables($pdo, ['pets_information'], $missing)) {
        return reports_empty_chart('pie');
    }

    $rows = reports_fetch_all($pdo, "
        SELECT
            COALESCE(NULLIF(TRIM(pet_species), ''), 'Unknown') AS species,
            COALESCE(NULLIF(TRIM(pet_breed), ''), 'Unspecified') AS breed,
            COUNT(*) AS pet_count
        FROM pets_information
        GROUP BY species, breed
        ORDER BY species ASC, pet_count DESC
    ", [], $missing, 'Animal distribution data could not be loaded.');

    $speciesCounts = [];
    $breedBreakdown = [];
    foreach ($rows as $row) {
        $species = (string)$row['species'];
        $breed = (string)$row['breed'];
        $count = reports_int($row['pet_count']);
        $speciesCounts[$species] = ($speciesCounts[$species] ?? 0) + $count;
        $breedBreakdown[$species][$breed] = ($breedBreakdown[$species][$breed] ?? 0) + $count;
    }

    arsort($speciesCounts);

    return [
        'type' => 'pie',
        'labels' => array_keys($speciesCounts),
        'datasets' => [[
            'label' => 'Animal Type Distribution',
            'data' => array_values($speciesCounts),
            'breedBreakdown' => $breedBreakdown,
        ]],
    ];
}

function reports_staff_monitoring(PDO $pdo, array &$missing): array
{
    if (!reports_has_tables($pdo, ['users'], $missing)) {
        return [
            'title' => 'Staff Monitoring',
            'summary' => 'Staff monitoring is unavailable because users table is missing.',
            'rows' => [],
            'totals' => [],
        ];
    }

    $hasLastSeen = reports_column_exists($pdo, 'users', 'last_seen_at');
    $adminHasActive = reports_column_exists($pdo, 'admin_profiles', 'is_active');
    $hasAdminProfiles = reports_table_exists($pdo, 'admin_profiles');
    $hasVetProfiles = reports_table_exists($pdo, 'veterinarian_profiles');
    $adminJoin = $hasAdminProfiles ? 'LEFT JOIN admin_profiles ap ON ap.user_id = u.user_id' : '';
    $vetJoin = $hasVetProfiles ? 'LEFT JOIN veterinarian_profiles vp ON vp.user_id = u.user_id' : '';
    $adminActive = $adminHasActive ? 'COALESCE(ap.is_active, 1)' : '1';
    $vetActive = $hasVetProfiles ? 'COALESCE(vp.is_active, 1)' : '1';
    $presenceSelect = $hasLastSeen
        ? "CASE WHEN u.last_seen_at >= DATE_SUB(NOW(), INTERVAL 10 MINUTE) THEN 'online' ELSE 'offline' END"
        : "'not tracked'";

    if (!$hasLastSeen) {
        $missing[] = 'Real online presence is not tracked yet. Add users.last_seen_at and update it from authenticated requests to show live online/offline status.';
    }

    $rows = reports_fetch_all($pdo, "
        SELECT
            u.user_id,
            COALESCE(NULLIF(TRIM(CONCAT(COALESCE(u.first_Name, ''), ' ', COALESCE(u.last_Name, ''))), ''), u.mail_Address, 'Unknown') AS name,
            u.role,
            {$presenceSelect} AS presence_status,
            CASE
                WHEN LOWER(u.role) = 'veterinarian' THEN {$vetActive}
                WHEN LOWER(u.role) = 'admin' THEN {$adminActive}
                ELSE 1
            END AS profile_active
        FROM users u
        {$adminJoin}
        {$vetJoin}
        WHERE LOWER(u.role) IN ('admin', 'veterinarian')
        ORDER BY u.role ASC, name ASC
    ", [], $missing, 'Staff monitoring data could not be loaded.');

    $totals = [
        'admins' => 0,
        'veterinarians' => 0,
        'online' => 0,
        'offline' => 0,
        'active_profiles' => 0,
        'inactive_profiles' => 0,
    ];

    foreach ($rows as &$row) {
        $role = reports_normalize_role($row['role']);
        if ($role === 'admin') {
            $totals['admins'] += 1;
        }
        if ($role === 'veterinarian') {
            $totals['veterinarians'] += 1;
        }
        if ($row['presence_status'] === 'online') {
            $totals['online'] += 1;
        }
        if ($row['presence_status'] === 'offline') {
            $totals['offline'] += 1;
        }
        if ((int)$row['profile_active'] === 1) {
            $totals['active_profiles'] += 1;
        } else {
            $totals['inactive_profiles'] += 1;
        }
        $row['profile_status'] = (int)$row['profile_active'] === 1 ? 'active' : 'inactive';
    }

    return [
        'title' => 'Vet and Admin Monitoring',
        'summary' => $hasLastSeen
            ? 'Online status is based on users active in the last 10 minutes.'
            : 'Live online status is not tracked yet; showing profile availability and account activity.',
        'columns' => [
            ['key' => 'name', 'label' => 'Name'],
            ['key' => 'role', 'label' => 'Role'],
            ['key' => 'presence_status', 'label' => 'Online Status'],
            ['key' => 'profile_status', 'label' => 'Profile Status'],
        ],
        'rows' => $rows,
        'totals' => $totals,
        'has_live_presence' => $hasLastSeen,
    ];
}

function reports_title_map(): array
{
    return [
        'sales' => 'Sales Report',
        'billing' => 'Billing Report',
        'invoice_receipt' => 'Invoice and Receipt Report',
        'service_utilization' => 'Service Utilization Report',
        'appointment' => 'Appointment Report',
        'queue' => 'Queue Report',
        'consultation' => 'Consultation Report',
        'follow_up' => 'Follow-Up Check-Up Report',
        'emr_request' => 'EMR Request Report',
        'inventory_status' => 'Inventory Status Report',
        'stock_movement' => 'Stock Movement Report',
        'medicine_product_sales' => 'Medicine/Product Sales Report',
        'confinement_pet_hotel' => 'Confinement and Pet Hotel Report',
        'consent_form' => 'Consent Form Report',
        'categorized_pet_cases' => 'Categorized Pet Cases Report',
        'veterinarian_activity' => 'Veterinarian Activity Report',
    ];
}

function reports_allowed_type(string $type): ?string
{
    $normalized = strtolower(trim($type));
    $normalized = str_replace(['-', ' '], '_', $normalized);
    $aliases = [
        'invoice_and_receipt' => 'invoice_receipt',
        'followup' => 'follow_up',
        'follow_up_check_up' => 'follow_up',
        'emr' => 'emr_request',
        'inventory' => 'inventory_status',
        'stock' => 'stock_movement',
        'product_sales' => 'medicine_product_sales',
        'medicine_sales' => 'medicine_product_sales',
        'pet_hotel' => 'confinement_pet_hotel',
        'confinement' => 'confinement_pet_hotel',
        'consent' => 'consent_form',
        'cases' => 'categorized_pet_cases',
        'vet_activity' => 'veterinarian_activity',
    ];
    $normalized = $aliases[$normalized] ?? $normalized;

    return array_key_exists($normalized, reports_title_map()) ? $normalized : null;
}

function reports_financial_visit_rows(PDO $pdo, array $range, array $filters, array &$missing): array
{
    if (!reports_has_tables($pdo, ['visits', 'visit_charges', 'visit_payments', 'pets_information', 'users'], $missing)) {
        return [];
    }

    $where = ['v.created_at BETWEEN ? AND ?'];
    $params = [$range['start_datetime'], $range['end_datetime']];

    if (!empty($filters['payment_method'])) {
        $where[] = "EXISTS (
            SELECT 1
            FROM visit_payments pm_filter
            WHERE pm_filter.visit_id = v.visit_id
              AND pm_filter.payment_method = ?
        )";
        $params[] = $filters['payment_method'];
    }

    $sql = "
        SELECT
            v.visit_id,
            DATE(v.created_at) AS visit_date,
            v.created_at,
            v.source_type,
            v.visit_status,
            v.billing_status,
            COALESCE(p.pet_name, 'Unknown Pet') AS pet_name,
            COALESCE(p.pet_species, '') AS pet_species,
            COALESCE(NULLIF(TRIM(CONCAT(COALESCE(owner.first_Name, ''), ' ', COALESCE(owner.last_Name, ''))), ''), owner.mail_Address, 'Unknown Owner') AS owner_name,
            COALESCE(NULLIF(TRIM(CONCAT(COALESCE(vet.first_Name, ''), ' ', COALESCE(vet.last_Name, ''))), ''), vet.mail_Address, 'Unassigned') AS veterinarian_name,
            COALESCE(SUM(vc.subtotal), 0) AS total_bill,
            COALESCE(SUM(CASE WHEN vc.charge_type IN ('medication', 'retail_product', 'consumable') THEN vc.subtotal ELSE 0 END), 0) AS product_sales,
            COALESCE(SUM(CASE WHEN vc.charge_type NOT IN ('medication', 'retail_product', 'consumable') THEN vc.subtotal ELSE 0 END), 0) AS service_sales,
            GROUP_CONCAT(DISTINCT vc.description ORDER BY vc.description SEPARATOR ', ') AS charges_summary,
            COALESCE(pay.paid_amount, 0) AS paid_amount,
            COALESCE(pay.payment_methods, '') AS payment_methods,
            pay.last_paid_at
        FROM visits v
        LEFT JOIN pets_information p ON p.pet_id = v.pet_id
        LEFT JOIN users owner ON owner.user_id = v.owner_user_id
        LEFT JOIN users vet ON vet.user_id = v.veterinarian_user_id
        LEFT JOIN visit_charges vc ON vc.visit_id = v.visit_id
        LEFT JOIN (
            SELECT
                visit_id,
                SUM(CASE WHEN payment_status = 'verified' THEN amount ELSE 0 END) AS paid_amount,
                GROUP_CONCAT(DISTINCT payment_method ORDER BY payment_method SEPARATOR ', ') AS payment_methods,
                MAX(paid_at) AS last_paid_at
            FROM visit_payments
            WHERE payment_status NOT IN ('voided', 'failed')
            GROUP BY visit_id
        ) pay ON pay.visit_id = v.visit_id
        WHERE " . implode(' AND ', $where) . "
        GROUP BY
            v.visit_id,
            DATE(v.created_at),
            v.created_at,
            v.source_type,
            v.visit_status,
            v.billing_status,
            p.pet_name,
            p.pet_species,
            owner.first_Name,
            owner.last_Name,
            owner.mail_Address,
            vet.first_Name,
            vet.last_Name,
            vet.mail_Address,
            pay.paid_amount,
            pay.payment_methods,
            pay.last_paid_at
        ORDER BY v.created_at DESC
    ";

    $rows = reports_fetch_all($pdo, $sql, $params, $missing, 'Financial visit data could not be loaded.');
    foreach ($rows as &$row) {
        $row['total_bill'] = reports_money($row['total_bill']);
        $row['service_sales'] = reports_money($row['service_sales']);
        $row['product_sales'] = reports_money($row['product_sales']);
        $row['paid_amount'] = reports_money($row['paid_amount']);
        $row['balance'] = reports_money(max(0, $row['total_bill'] - $row['paid_amount']));
    }

    return $rows;
}

function reports_financial_totals(array $visitRows): array
{
    $totals = [
        'total_sales' => 0,
        'service_sales' => 0,
        'product_sales' => 0,
        'paid_amount' => 0,
        'unpaid_balance' => 0,
        'unpaid_or_partial_count' => 0,
    ];

    foreach ($visitRows as $row) {
        $totals['total_sales'] += (float)$row['total_bill'];
        $totals['service_sales'] += (float)$row['service_sales'];
        $totals['product_sales'] += (float)$row['product_sales'];
        $totals['paid_amount'] += (float)$row['paid_amount'];
        $totals['unpaid_balance'] += (float)$row['balance'];
        if (in_array($row['billing_status'], ['unpaid', 'partial'], true) || (float)$row['balance'] > 0) {
            $totals['unpaid_or_partial_count'] += 1;
        }
    }

    foreach (['total_sales', 'service_sales', 'product_sales', 'paid_amount', 'unpaid_balance'] as $key) {
        $totals[$key] = reports_money($totals[$key]);
    }

    return $totals;
}

function reports_sales_report(PDO $pdo, array $range, array $filters): array
{
    $missing = [];
    $visitRows = reports_financial_visit_rows($pdo, $range, $filters, $missing);
    $daily = [];
    $paymentCounts = [];

    foreach ($visitRows as $row) {
        $date = $row['visit_date'];
        if (!isset($daily[$date])) {
            $daily[$date] = [
                'date' => $date,
                'service_sales' => 0,
                'product_sales' => 0,
                'total_sales' => 0,
                'paid_amount' => 0,
                'balance' => 0,
            ];
        }

        $daily[$date]['service_sales'] += (float)$row['service_sales'];
        $daily[$date]['product_sales'] += (float)$row['product_sales'];
        $daily[$date]['total_sales'] += (float)$row['total_bill'];
        $daily[$date]['paid_amount'] += (float)$row['paid_amount'];
        $daily[$date]['balance'] += (float)$row['balance'];

        foreach (array_filter(array_map('trim', explode(',', (string)$row['payment_methods']))) as $method) {
            $paymentCounts[$method] = ($paymentCounts[$method] ?? 0) + 1;
        }
    }

    ksort($daily);
    foreach ($daily as &$day) {
        foreach (['service_sales', 'product_sales', 'total_sales', 'paid_amount', 'balance'] as $key) {
            $day[$key] = reports_money($day[$key]);
        }
    }

    $totals = reports_financial_totals($visitRows);
    arsort($paymentCounts);
    $topPaymentMethod = array_key_first($paymentCounts) ?: 'No verified payment yet';
    $dominantCategory = $totals['service_sales'] >= $totals['product_sales'] ? 'service sales' : 'medicine/product sales';

    return [
        'type' => 'sales',
        'title' => 'Sales Report',
        'columns' => [
            ['key' => 'date', 'label' => 'Date'],
            ['key' => 'service_sales', 'label' => 'Service Sales'],
            ['key' => 'product_sales', 'label' => 'Medicine/Product Sales'],
            ['key' => 'total_sales', 'label' => 'Total Sales'],
            ['key' => 'paid_amount', 'label' => 'Paid Amount'],
            ['key' => 'balance', 'label' => 'Balance'],
        ],
        'rows' => array_values($daily),
        'totals' => $totals + ['most_used_payment_method' => $topPaymentMethod],
        'summary' => [
            'text' => "Total charges reached {$totals['total_sales']} with {$dominantCategory} contributing the larger share. The most used payment method is {$topPaymentMethod}.",
            'bullets' => [
                "Total sales: {$totals['total_sales']}",
                "Paid amount: {$totals['paid_amount']}",
                "Unpaid balance: {$totals['unpaid_balance']}",
            ],
        ],
        'chart' => [
            'type' => 'line',
            'labels' => array_map(static fn($row) => $row['date'], array_values($daily)),
            'datasets' => [[
                'label' => 'Total Sales',
                'data' => array_map(static fn($row) => $row['total_sales'], array_values($daily)),
            ]],
        ],
        'missing_data' => $missing,
    ];
}

function reports_billing_report(PDO $pdo, array $range, array $filters): array
{
    $missing = [];
    $rows = reports_financial_visit_rows($pdo, $range, $filters, $missing);
    $totals = reports_financial_totals($rows);

    return [
        'type' => 'billing',
        'title' => 'Billing Report',
        'columns' => [
            ['key' => 'visit_id', 'label' => 'Visit ID'],
            ['key' => 'visit_date', 'label' => 'Visit Date'],
            ['key' => 'owner_name', 'label' => 'Client'],
            ['key' => 'pet_name', 'label' => 'Pet'],
            ['key' => 'charges_summary', 'label' => 'Services / Items'],
            ['key' => 'total_bill', 'label' => 'Total Bill'],
            ['key' => 'paid_amount', 'label' => 'Paid'],
            ['key' => 'balance', 'label' => 'Balance'],
            ['key' => 'billing_status', 'label' => 'Billing Status'],
        ],
        'rows' => $rows,
        'totals' => $totals,
        'summary' => [
            'text' => "Billed amount is {$totals['total_sales']}; paid amount is {$totals['paid_amount']}; outstanding balance is {$totals['unpaid_balance']}.",
            'bullets' => [
                "Unpaid or partial visits: {$totals['unpaid_or_partial_count']}",
            ],
        ],
        'chart' => reports_doughnut_chart(['Paid', 'Balance'], [$totals['paid_amount'], $totals['unpaid_balance']], 'Billing'),
        'missing_data' => $missing,
    ];
}

function reports_invoice_receipt_report(PDO $pdo, array $range, array $filters): array
{
    $missing = [];
    if (!reports_has_tables($pdo, ['visit_payments', 'visits', 'pets_information', 'users'], $missing)) {
        return reports_blank_report('invoice_receipt', $missing);
    }

    $where = ['vp.paid_at BETWEEN ? AND ?'];
    $params = [$range['start_datetime'], $range['end_datetime']];
    if (!empty($filters['payment_method'])) {
        $where[] = 'vp.payment_method = ?';
        $params[] = $filters['payment_method'];
    }

    $rows = reports_fetch_all($pdo, "
        SELECT
            CONCAT('INV-', LPAD(v.visit_id, 6, '0')) AS invoice_number,
            CONCAT('OR-', LPAD(vp.payment_id, 6, '0')) AS receipt_number,
            DATE(vp.paid_at) AS payment_date,
            COALESCE(p.pet_name, 'Unknown Pet') AS pet_name,
            COALESCE(NULLIF(TRIM(CONCAT(COALESCE(owner.first_Name, ''), ' ', COALESCE(owner.last_Name, ''))), ''), owner.mail_Address, 'Unknown Owner') AS client_name,
            vp.payment_method,
            vp.payment_status,
            vp.reference_number,
            vp.amount AS amount_paid,
            COALESCE(vp.received_by_name, 'Unassigned') AS processed_by
        FROM visit_payments vp
        JOIN visits v ON v.visit_id = vp.visit_id
        LEFT JOIN pets_information p ON p.pet_id = v.pet_id
        LEFT JOIN users owner ON owner.user_id = v.owner_user_id
        WHERE " . implode(' AND ', $where) . "
        ORDER BY vp.paid_at DESC
    ", $params, $missing, 'Payment receipt data could not be loaded.');

    $totalPaid = 0;
    foreach ($rows as &$row) {
        $row['amount_paid'] = reports_money($row['amount_paid']);
        $totalPaid += (float)$row['amount_paid'];
    }

    $missing[] = 'No dedicated invoice/receipt tables were found; invoice and receipt numbers are derived from visit and payment IDs.';

    return [
        'type' => 'invoice_receipt',
        'title' => 'Invoice and Receipt Report',
        'columns' => [
            ['key' => 'invoice_number', 'label' => 'Invoice No.'],
            ['key' => 'receipt_number', 'label' => 'Receipt No.'],
            ['key' => 'payment_date', 'label' => 'Payment Date'],
            ['key' => 'client_name', 'label' => 'Client'],
            ['key' => 'pet_name', 'label' => 'Pet'],
            ['key' => 'payment_method', 'label' => 'Method'],
            ['key' => 'amount_paid', 'label' => 'Amount Paid'],
            ['key' => 'processed_by', 'label' => 'Processed By'],
        ],
        'rows' => $rows,
        'totals' => [
            'total_records' => count($rows),
            'total_paid' => reports_money($totalPaid),
        ],
        'summary' => [
            'text' => count($rows) . " payment receipt records were found with total paid amount " . reports_money($totalPaid) . '.',
            'bullets' => [],
        ],
        'chart' => reports_empty_chart('bar'),
        'missing_data' => $missing,
    ];
}

function reports_service_utilization_report(PDO $pdo, array $range, array $filters): array
{
    $missing = [];
    if (!reports_has_tables($pdo, ['visit_charges'], $missing)) {
        return reports_blank_report('service_utilization', $missing);
    }

    if (reports_table_exists($pdo, 'service_catalog')) {
        $catalogWhere = ['sc.is_active = 1'];
        $manualWhere = ["vc.created_at BETWEEN ? AND ?", "vc.charge_type IN ('service', 'diagnostic', 'boarding', 'other')", 'vc.service_id IS NULL'];
        $params = [$range['start_datetime'], $range['end_datetime']];

        if (!empty($filters['service_type'])) {
            $catalogWhere[] = 'sc.service_type = ?';
            $manualWhere[] = 'vc.charge_type = ?';
            $params[] = $filters['service_type'];
        }

        $manualParams = [$range['start_datetime'], $range['end_datetime']];
        if (!empty($filters['service_type'])) {
            $manualParams[] = $filters['service_type'];
        }

        $rows = reports_fetch_all($pdo, "
            SELECT *
            FROM (
                SELECT
                    sc.service_name,
                    sc.service_type,
                    COUNT(vc.charge_id) AS usage_count,
                    COALESCE(SUM(vc.quantity), 0) AS total_quantity,
                    COALESCE(SUM(vc.subtotal), 0) AS total_revenue
                FROM service_catalog sc
                LEFT JOIN visit_charges vc ON vc.service_id = sc.service_id
                    AND vc.created_at BETWEEN ? AND ?
                    AND vc.charge_type IN ('service', 'diagnostic', 'boarding', 'other')
                WHERE " . implode(' AND ', $catalogWhere) . "
                GROUP BY sc.service_id, sc.service_name, sc.service_type
                UNION ALL
                SELECT
                    vc.description AS service_name,
                    vc.charge_type AS service_type,
                    COUNT(*) AS usage_count,
                    COALESCE(SUM(vc.quantity), 0) AS total_quantity,
                    COALESCE(SUM(vc.subtotal), 0) AS total_revenue
                FROM visit_charges vc
                WHERE " . implode(' AND ', $manualWhere) . "
                GROUP BY vc.description, vc.charge_type
            ) service_usage
            ORDER BY usage_count DESC, total_revenue DESC, service_name ASC
        ", array_merge($params, $manualParams), $missing, 'Service catalog utilization data could not be loaded.');
    } else {
        $where = ["vc.created_at BETWEEN ? AND ?", "vc.charge_type IN ('service', 'diagnostic', 'boarding', 'other')"];
        $params = [$range['start_datetime'], $range['end_datetime']];
        if (!empty($filters['service_type'])) {
            $where[] = "vc.charge_type = ?";
            $params[] = $filters['service_type'];
        }

        $rows = reports_fetch_all($pdo, "
            SELECT
                vc.description AS service_name,
                vc.charge_type AS service_type,
                COUNT(*) AS usage_count,
                SUM(vc.quantity) AS total_quantity,
                SUM(vc.subtotal) AS total_revenue
            FROM visit_charges vc
            WHERE " . implode(' AND ', $where) . "
            GROUP BY vc.description, vc.charge_type
            ORDER BY usage_count DESC, total_revenue DESC
        ", $params, $missing, 'Service utilization data could not be loaded.');
    }

    foreach ($rows as &$row) {
        $row['usage_count'] = reports_int($row['usage_count']);
        $row['total_quantity'] = reports_money($row['total_quantity']);
        $row['total_revenue'] = reports_money($row['total_revenue']);
    }

    $mostUsed = $rows[0]['service_name'] ?? 'No service';
    $leastUsed = !empty($rows) ? $rows[count($rows) - 1]['service_name'] : 'No service';

    return [
        'type' => 'service_utilization',
        'title' => 'Service Utilization Report',
        'columns' => [
            ['key' => 'service_name', 'label' => 'Service'],
            ['key' => 'service_type', 'label' => 'Type'],
            ['key' => 'usage_count', 'label' => 'Times Used'],
            ['key' => 'total_quantity', 'label' => 'Quantity'],
            ['key' => 'total_revenue', 'label' => 'Revenue'],
        ],
        'rows' => $rows,
        'totals' => [
            'total_services' => array_sum(array_column($rows, 'usage_count')),
            'unique_services' => count($rows),
            'most_used_service' => $mostUsed,
            'least_used_service' => $leastUsed,
        ],
        'summary' => [
            'text' => "The most used service is {$mostUsed}. The least used service in the selected period is {$leastUsed}.",
            'bullets' => [],
        ],
        'chart' => reports_line_chart(array_slice($rows, 0, 10), 'service_name', 'usage_count', 'Usage'),
        'missing_data' => $missing,
    ];
}

function reports_appointment_report(PDO $pdo, array $range, array $filters): array
{
    $missing = [];
    if (!reports_has_tables($pdo, ['bookings', 'users'], $missing)) {
        return reports_blank_report('appointment', $missing);
    }

    $petJoin = reports_table_exists($pdo, 'pets_information') ? 'LEFT JOIN pets_information p ON p.pet_id = b.pet_id' : '';
    $petSelect = reports_table_exists($pdo, 'pets_information')
        ? "COALESCE(p.pet_name, b.unregistered_pet_name, 'Unregistered Pet') AS pet_name, COALESCE(p.pet_species, b.petType, '') AS pet_species,"
        : "COALESCE(b.unregistered_pet_name, 'Unregistered Pet') AS pet_name, COALESCE(b.petType, '') AS pet_species,";
    $where = ['b.booking_date BETWEEN ? AND ?'];
    $params = [$range['start_date'], $range['end_date']];
    if (!empty($filters['appointment_status'])) {
        $where[] = 'b.status = ?';
        $params[] = $filters['appointment_status'];
    }
    if (!empty($filters['service_type'])) {
        $where[] = "CASE WHEN b.is_online_consultation = 1 THEN 'online-consultation' ELSE b.service_type END = ?";
        $params[] = $filters['service_type'];
    }

    $rows = reports_fetch_all($pdo, "
        SELECT
            b.booking_id,
            b.booking_number,
            CASE WHEN b.is_online_consultation = 1 THEN 'online-consultation' ELSE b.service_type END AS service_type,
            b.booking_date,
            b.booking_time,
            b.status,
            b.payment_method,
            b.price,
            b.notes,
            {$petSelect}
            COALESCE(NULLIF(TRIM(CONCAT(COALESCE(u.first_Name, ''), ' ', COALESCE(u.last_Name, ''))), ''), u.mail_Address, 'Unknown Owner') AS client_name
        FROM bookings b
        JOIN users u ON u.user_id = b.user_id
        {$petJoin}
        WHERE " . implode(' AND ', $where) . "
        ORDER BY b.booking_date DESC, b.booking_time DESC
    ", $params, $missing, 'Appointment data could not be loaded.');

    $counts = ['pending' => 0, 'confirmed' => 0, 'completed' => 0, 'cancelled' => 0, 'missed_rescheduled' => 0];
    foreach ($rows as &$row) {
        $row['price'] = reports_money($row['price']);
        $status = $row['status'] ?: 'pending';
        if (isset($counts[$status])) {
            $counts[$status] += 1;
        }
        if (stripos((string)$row['notes'], 'missed') !== false || stripos((string)$row['notes'], 'rescheduled') !== false) {
            $counts['missed_rescheduled'] += 1;
        }
    }

    $total = count($rows);
    $completionRate = $total > 0 ? round(($counts['completed'] / $total) * 100, 1) : 0;

    return [
        'type' => 'appointment',
        'title' => 'Appointment Report',
        'columns' => [
            ['key' => 'booking_number', 'label' => 'Booking No.'],
            ['key' => 'booking_date', 'label' => 'Date'],
            ['key' => 'booking_time', 'label' => 'Time'],
            ['key' => 'client_name', 'label' => 'Client'],
            ['key' => 'pet_name', 'label' => 'Pet'],
            ['key' => 'service_type', 'label' => 'Service'],
            ['key' => 'status', 'label' => 'Status'],
        ],
        'rows' => $rows,
        'totals' => $counts + [
            'total_appointments' => $total,
            'completion_rate' => $completionRate,
        ],
        'summary' => [
            'text' => "There are {$total} appointments in this date range with a {$completionRate}% completion rate.",
            'bullets' => [
                "Completed: {$counts['completed']}",
                "Confirmed: {$counts['confirmed']}",
                "Cancelled: {$counts['cancelled']}",
            ],
        ],
        'chart' => reports_doughnut_chart(
            ['Pending', 'Confirmed', 'Completed', 'Cancelled', 'Missed/Rescheduled'],
            [$counts['pending'], $counts['confirmed'], $counts['completed'], $counts['cancelled'], $counts['missed_rescheduled']],
            'Appointments'
        ),
        'missing_data' => $missing,
    ];
}

function reports_queue_report(PDO $pdo, array $range, array $filters): array
{
    $missing = [];
    if (!reports_has_tables($pdo, ['queues', 'pets_information'], $missing)) {
        return reports_blank_report('queue', $missing);
    }

    $assignmentJoin = reports_table_exists($pdo, 'vet_queue_assignments')
        ? "LEFT JOIN vet_queue_assignments vqa ON vqa.assignment_id = (
              SELECT latest.assignment_id
              FROM vet_queue_assignments latest
              WHERE latest.queue_id = q.queue_id
              ORDER BY latest.assignment_id DESC
              LIMIT 1
          )"
        : '';
    $assignmentSelect = reports_table_exists($pdo, 'vet_queue_assignments')
        ? "vqa.veterinarian_name, vqa.status AS assignment_status, vqa.received_at, TIMESTAMPDIFF(MINUTE, q.`timestamp`, vqa.received_at) AS waiting_minutes,"
        : "NULL AS veterinarian_name, NULL AS assignment_status, NULL AS received_at, NULL AS waiting_minutes,";
    $userJoin = reports_table_exists($pdo, 'users') ? 'LEFT JOIN users u ON u.user_id = q.user_id' : '';
    $ownerSelect = reports_table_exists($pdo, 'users')
        ? "COALESCE(NULLIF(TRIM(CONCAT(COALESCE(u.first_Name, ''), ' ', COALESCE(u.last_Name, ''))), ''), u.mail_Address, 'Unknown Owner') AS client_name,"
        : "'Unknown Owner' AS client_name,";

    $where = ['q.`timestamp` BETWEEN ? AND ?'];
    $params = [$range['start_datetime'], $range['end_datetime']];
    if (!empty($filters['queue_status'])) {
        $where[] = 'q.status = ?';
        $params[] = $filters['queue_status'];
    }

    $rows = reports_fetch_all($pdo, "
        SELECT
            q.queue_id,
            q.queue_number,
            DATE(q.`timestamp`) AS queue_date,
            q.`timestamp` AS queued_at,
            q.service_name,
            q.status,
            q.priority,
            q.verified_by_admin,
            {$assignmentSelect}
            {$ownerSelect}
            p.pet_name,
            p.pet_species
        FROM queues q
        JOIN pets_information p ON p.pet_id = q.pet_id
        {$userJoin}
        {$assignmentJoin}
        WHERE " . implode(' AND ', $where) . "
        ORDER BY q.`timestamp` DESC
    ", $params, $missing, 'Queue data could not be loaded.');

    $counts = ['waiting' => 0, 'in-progress' => 0, 'completed' => 0, 'cancelled' => 0];
    $waitingTotal = 0;
    $waitingCount = 0;
    foreach ($rows as &$row) {
        if (isset($counts[$row['status']])) {
            $counts[$row['status']] += 1;
        }
        if ($row['waiting_minutes'] !== null && (int)$row['waiting_minutes'] >= 0) {
            $waitingTotal += (int)$row['waiting_minutes'];
            $waitingCount += 1;
        }
    }
    $averageWaiting = $waitingCount > 0 ? round($waitingTotal / $waitingCount, 1) : null;

    return [
        'type' => 'queue',
        'title' => 'Queue Report',
        'columns' => [
            ['key' => 'queue_number', 'label' => 'Queue No.'],
            ['key' => 'queue_date', 'label' => 'Date'],
            ['key' => 'client_name', 'label' => 'Client'],
            ['key' => 'pet_name', 'label' => 'Pet'],
            ['key' => 'service_name', 'label' => 'Service'],
            ['key' => 'status', 'label' => 'Status'],
            ['key' => 'veterinarian_name', 'label' => 'Veterinarian'],
            ['key' => 'waiting_minutes', 'label' => 'Waiting Minutes'],
        ],
        'rows' => $rows,
        'totals' => $counts + [
            'total_queue_entries' => count($rows),
            'average_waiting_minutes' => $averageWaiting,
        ],
        'summary' => [
            'text' => "Queue entries total " . count($rows) . "; completed {$counts['completed']} and cancelled {$counts['cancelled']}.",
            'bullets' => $averageWaiting === null ? [] : ["Average waiting time: {$averageWaiting} minutes"],
        ],
        'chart' => reports_doughnut_chart(
            ['Waiting', 'In Progress', 'Completed', 'Cancelled'],
            [$counts['waiting'], $counts['in-progress'], $counts['completed'], $counts['cancelled']],
            'Queue Flow'
        ),
        'missing_data' => $missing,
    ];
}

function reports_consultation_report(PDO $pdo, array $range, array $filters): array
{
    $missing = [];
    $rows = [];
    $typeFilter = strtolower((string)($filters['consultation_type'] ?? ''));
    $vetFilter = trim((string)($filters['veterinarian'] ?? ''));

    if (($typeFilter === '' || $typeFilter === 'face_to_face' || $typeFilter === 'face-to-face') && reports_has_tables($pdo, ['vet_diagnoses', 'pets_information'], $missing)) {
        $where = ['COALESCE(vd.finalized_at, vd.created_at) BETWEEN ? AND ?'];
        $params = [$range['start_datetime'], $range['end_datetime']];
        if ($vetFilter !== '' && ctype_digit($vetFilter)) {
            $where[] = 'vd.veterinarian_user_id = ?';
            $params[] = (int)$vetFilter;
        }
        $faceRows = reports_fetch_all($pdo, "
            SELECT
                'Face-to-face' AS consultation_type,
                COALESCE(vd.finalized_at, vd.created_at) AS consultation_date,
                p.pet_name,
                p.pet_species,
                COALESCE(vd.veterinarian_name, 'Unassigned') AS veterinarian_name,
                vd.service_name,
                vd.diagnosis,
                vd.treatment,
                vd.follow_up_date,
                vd.notes
            FROM vet_diagnoses vd
            JOIN pets_information p ON p.pet_id = vd.pet_id
            WHERE " . implode(' AND ', $where) . "
        ", $params, $missing, 'Face-to-face consultation data could not be loaded.');
        $rows = array_merge($rows, $faceRows);
    }

    if (($typeFilter === '' || $typeFilter === 'online') && reports_has_tables($pdo, ['online_consultations', 'online_consultation_diagnoses', 'bookings', 'pets_information', 'users'], $missing)) {
        $where = ['COALESCE(ocd.finalized_at, oc.ended_at, oc.scheduled_start, ocd.created_at) BETWEEN ? AND ?'];
        $params = [$range['start_datetime'], $range['end_datetime']];
        if ($vetFilter !== '' && ctype_digit($vetFilter)) {
            $where[] = 'ocd.veterinarian_user_id = ?';
            $params[] = (int)$vetFilter;
        }
        $onlineRows = reports_fetch_all($pdo, "
            SELECT
                'Online' AS consultation_type,
                COALESCE(ocd.finalized_at, oc.ended_at, oc.scheduled_start, ocd.created_at) AS consultation_date,
                COALESCE(p.pet_name, b.unregistered_pet_name, 'Unregistered Pet') AS pet_name,
                COALESCE(p.pet_species, b.petType, '') AS pet_species,
                COALESCE(NULLIF(TRIM(CONCAT(COALESCE(v.first_Name, ''), ' ', COALESCE(v.last_Name, ''))), ''), v.mail_Address, 'Unassigned') AS veterinarian_name,
                'online consultation' AS service_name,
                ocd.diagnosis,
                ocd.treatment,
                NULL AS follow_up_date,
                ocd.notes
            FROM online_consultation_diagnoses ocd
            JOIN online_consultations oc ON oc.online_consultation_id = ocd.online_consultation_id
            JOIN bookings b ON b.booking_id = ocd.booking_id
            LEFT JOIN pets_information p ON p.pet_id = b.pet_id
            LEFT JOIN users v ON v.user_id = ocd.veterinarian_user_id
            WHERE " . implode(' AND ', $where) . "
        ", $params, $missing, 'Online consultation data could not be loaded.');
        $rows = array_merge($rows, $onlineRows);
    }

    usort($rows, static fn($a, $b) => strcmp((string)$b['consultation_date'], (string)$a['consultation_date']));
    $faceCount = count(array_filter($rows, static fn($row) => $row['consultation_type'] === 'Face-to-face'));
    $onlineCount = count(array_filter($rows, static fn($row) => $row['consultation_type'] === 'Online'));

    return [
        'type' => 'consultation',
        'title' => 'Consultation Report',
        'columns' => [
            ['key' => 'consultation_date', 'label' => 'Date'],
            ['key' => 'consultation_type', 'label' => 'Type'],
            ['key' => 'pet_name', 'label' => 'Pet'],
            ['key' => 'pet_species', 'label' => 'Animal Type'],
            ['key' => 'veterinarian_name', 'label' => 'Veterinarian'],
            ['key' => 'service_name', 'label' => 'Service'],
            ['key' => 'diagnosis', 'label' => 'Diagnosis / Remarks'],
            ['key' => 'treatment', 'label' => 'Treatment'],
            ['key' => 'follow_up_date', 'label' => 'Follow-Up'],
        ],
        'rows' => $rows,
        'totals' => [
            'total_consultations' => count($rows),
            'face_to_face' => $faceCount,
            'online' => $onlineCount,
        ],
        'summary' => [
            'text' => "Consultations total " . count($rows) . ": {$faceCount} face-to-face and {$onlineCount} online.",
            'bullets' => [],
        ],
        'chart' => reports_doughnut_chart(['Face-to-face', 'Online'], [$faceCount, $onlineCount], 'Consultation Type'),
        'missing_data' => $missing,
    ];
}

function reports_follow_up_report(PDO $pdo, array $range, array $filters): array
{
    $missing = [];
    if (!reports_has_tables($pdo, ['vet_diagnoses', 'pets_information'], $missing)) {
        return reports_blank_report('follow_up', $missing);
    }

    $today = (new DateTimeImmutable('today', new DateTimeZone(REPORTS_TIMEZONE)))->format('Y-m-d');
    $where = ['vd.follow_up_date BETWEEN ? AND ?'];
    $params = [$range['start_date'], $range['end_date']];
    if (!empty($filters['veterinarian']) && ctype_digit((string)$filters['veterinarian'])) {
        $where[] = 'vd.veterinarian_user_id = ?';
        $params[] = (int)$filters['veterinarian'];
    }

    $rows = reports_fetch_all($pdo, "
        SELECT
            vd.diagnosis_id,
            vd.follow_up_date,
            p.pet_name,
            p.pet_species,
            COALESCE(vd.veterinarian_name, 'Unassigned') AS veterinarian_name,
            COALESCE(vd.notes, vd.diagnosis, vd.treatment, 'Follow-up check-up') AS reason,
            CASE
                WHEN vd.follow_up_date < ? THEN 'missed'
                WHEN vd.follow_up_date = ? THEN 'due today'
                ELSE 'pending'
            END AS reminder_status
        FROM vet_diagnoses vd
        JOIN pets_information p ON p.pet_id = vd.pet_id
        WHERE " . implode(' AND ', $where) . "
        ORDER BY vd.follow_up_date ASC
    ", array_merge([$today, $today], $params), $missing, 'Follow-up data could not be loaded.');

    $counts = ['pending' => 0, 'missed' => 0, 'due today' => 0];
    foreach ($rows as $row) {
        $counts[$row['reminder_status']] = ($counts[$row['reminder_status']] ?? 0) + 1;
    }

    return [
        'type' => 'follow_up',
        'title' => 'Follow-Up Check-Up Report',
        'columns' => [
            ['key' => 'follow_up_date', 'label' => 'Follow-Up Date'],
            ['key' => 'pet_name', 'label' => 'Pet'],
            ['key' => 'pet_species', 'label' => 'Animal Type'],
            ['key' => 'veterinarian_name', 'label' => 'Veterinarian'],
            ['key' => 'reason', 'label' => 'Reason'],
            ['key' => 'reminder_status', 'label' => 'Reminder Status'],
        ],
        'rows' => $rows,
        'totals' => [
            'total_follow_ups' => count($rows),
            'pending' => $counts['pending'] ?? 0,
            'missed' => $counts['missed'] ?? 0,
            'due_today' => $counts['due today'] ?? 0,
        ],
        'summary' => [
            'text' => count($rows) . " follow-up records were found. Pending: " . ($counts['pending'] ?? 0) . '; missed: ' . ($counts['missed'] ?? 0) . '.',
            'bullets' => [],
        ],
        'chart' => reports_empty_chart('bar'),
        'missing_data' => $missing,
    ];
}

function reports_emr_request_report(PDO $pdo, array $range, array $filters): array
{
    $missing = [];
    if (!reports_has_tables($pdo, ['pet_record_update_requests', 'pets_information'], $missing)) {
        return reports_blank_report('emr_request', $missing);
    }

    $where = ['r.created_at BETWEEN ? AND ?'];
    $params = [$range['start_datetime'], $range['end_datetime']];

    $rows = reports_fetch_all($pdo, "
        SELECT
            r.request_number,
            DATE(r.created_at) AS requested_date,
            p.pet_name,
            p.pet_species,
            r.status,
            r.payment_status,
            COALESCE(NULLIF(TRIM(CONCAT(COALESCE(owner.first_Name, ''), ' ', COALESCE(owner.last_Name, ''))), ''), owner.mail_Address, 'Unknown Owner') AS owner_name,
            COALESCE(NULLIF(TRIM(CONCAT(COALESCE(vet.first_Name, ''), ' ', COALESCE(vet.last_Name, ''))), ''), vet.mail_Address, 'Unassigned') AS assigned_veterinarian,
            r.reviewed_at,
            r.completed_at
        FROM pet_record_update_requests r
        JOIN pets_information p ON p.pet_id = r.pet_id
        LEFT JOIN users owner ON owner.user_id = r.owner_user_id
        LEFT JOIN users vet ON vet.user_id = r.assigned_veterinarian_user_id
        WHERE " . implode(' AND ', $where) . "
        ORDER BY r.created_at DESC
    ", $params, $missing, 'EMR request data could not be loaded.');

    $counts = [];
    foreach ($rows as $row) {
        $counts[$row['status']] = ($counts[$row['status']] ?? 0) + 1;
    }

    return [
        'type' => 'emr_request',
        'title' => 'EMR Request Report',
        'columns' => [
            ['key' => 'request_number', 'label' => 'Request No.'],
            ['key' => 'requested_date', 'label' => 'Requested'],
            ['key' => 'owner_name', 'label' => 'Owner'],
            ['key' => 'pet_name', 'label' => 'Pet'],
            ['key' => 'status', 'label' => 'Status'],
            ['key' => 'payment_status', 'label' => 'Payment'],
            ['key' => 'assigned_veterinarian', 'label' => 'Assigned Vet'],
            ['key' => 'completed_at', 'label' => 'Released / Completed'],
        ],
        'rows' => $rows,
        'totals' => ['total_requests' => count($rows)] + $counts,
        'summary' => [
            'text' => count($rows) . ' EMR update requests were found in the selected period.',
            'bullets' => [],
        ],
        'chart' => reports_empty_chart('bar'),
        'missing_data' => $missing,
    ];
}

function reports_inventory_status_report(PDO $pdo, array $range, array $filters): array
{
    $missing = [];
    if (!reports_has_tables($pdo, ['inventory_items'], $missing)) {
        return reports_blank_report('inventory_status', $missing);
    }

    $hasBatches = reports_table_exists($pdo, 'inventory_batches');
    $stockJoin = $hasBatches
        ? "LEFT JOIN (
              SELECT
                  item_id,
                  SUM(quantity) AS total_stock,
                  MIN(CASE WHEN quantity > 0 THEN expiry_date ELSE NULL END) AS nearest_expiry
              FROM inventory_batches
              GROUP BY item_id
          ) stock ON stock.item_id = ii.item_id"
        : '';
    $stockSelect = $hasBatches
        ? "COALESCE(stock.total_stock, 0) AS stock_level, stock.nearest_expiry,"
        : "0 AS stock_level, NULL AS nearest_expiry,";
    $stockStatusSelect = $hasBatches
        ? "CASE
                WHEN COALESCE(stock.total_stock, 0) <= 0 THEN 'out_of_stock'
                WHEN COALESCE(stock.total_stock, 0) <= ii.reorder_level THEN 'low_stock'
                WHEN stock.nearest_expiry IS NOT NULL AND stock.nearest_expiry < ? THEN 'expired'
                WHEN stock.nearest_expiry IS NOT NULL AND stock.nearest_expiry <= DATE_ADD(?, INTERVAL ii.expiry_warning_days DAY) THEN 'near_expiry'
                ELSE 'ok'
            END AS stock_status"
        : "'unknown' AS stock_status";

    $where = ['ii.status = ?'];
    $params = ['active'];
    if (!empty($filters['inventory_category'])) {
        $where[] = 'ii.category = ?';
        $params[] = $filters['inventory_category'];
    }

    $today = (new DateTimeImmutable('today', new DateTimeZone(REPORTS_TIMEZONE)))->format('Y-m-d');
    $rows = reports_fetch_all($pdo, "
        SELECT
            ii.item_id,
            ii.item_name,
            ii.category,
            ii.sku,
            ii.unit,
            ii.reorder_level,
            ii.expiry_warning_days,
            {$stockSelect}
            {$stockStatusSelect}
        FROM inventory_items ii
        {$stockJoin}
        WHERE " . implode(' AND ', $where) . "
        ORDER BY stock_status DESC, ii.item_name ASC
    ", $hasBatches ? array_merge([$today, $today], $params) : $params, $missing, 'Inventory status data could not be loaded.');

    if (!$hasBatches) {
        $missing[] = 'inventory_batches table is missing; stock and expiry status cannot be calculated.';
    }

    if (!empty($filters['stock_status'])) {
        $rows = array_values(array_filter($rows, static fn($row) => $row['stock_status'] === $filters['stock_status']));
    }

    $counts = ['low_stock' => 0, 'out_of_stock' => 0, 'near_expiry' => 0, 'expired' => 0, 'ok' => 0];
    foreach ($rows as &$row) {
        $row['stock_level'] = reports_int($row['stock_level']);
        $row['reorder_level'] = reports_int($row['reorder_level']);
        $counts[$row['stock_status']] = ($counts[$row['stock_status']] ?? 0) + 1;
    }

    return [
        'type' => 'inventory_status',
        'title' => 'Inventory Status Report',
        'columns' => [
            ['key' => 'item_name', 'label' => 'Item'],
            ['key' => 'category', 'label' => 'Category'],
            ['key' => 'sku', 'label' => 'SKU'],
            ['key' => 'stock_level', 'label' => 'Stock'],
            ['key' => 'reorder_level', 'label' => 'Reorder Level'],
            ['key' => 'nearest_expiry', 'label' => 'Nearest Expiry'],
            ['key' => 'stock_status', 'label' => 'Status'],
        ],
        'rows' => $rows,
        'totals' => [
            'total_items' => count($rows),
            'low_stock' => $counts['low_stock'] ?? 0,
            'out_of_stock' => $counts['out_of_stock'] ?? 0,
            'near_expiry' => $counts['near_expiry'] ?? 0,
            'expired' => $counts['expired'] ?? 0,
        ],
        'summary' => [
            'text' => "Inventory has " . count($rows) . " active items; low stock " . ($counts['low_stock'] ?? 0) . ', out of stock ' . ($counts['out_of_stock'] ?? 0) . ', near expiry ' . ($counts['near_expiry'] ?? 0) . '.',
            'bullets' => [],
        ],
        'chart' => reports_doughnut_chart(
            ['Low Stock', 'Out of Stock', 'Near Expiry', 'Expired'],
            [$counts['low_stock'] ?? 0, $counts['out_of_stock'] ?? 0, $counts['near_expiry'] ?? 0, $counts['expired'] ?? 0],
            'Inventory Alerts'
        ),
        'missing_data' => $missing,
    ];
}

function reports_stock_movement_report(PDO $pdo, array $range, array $filters): array
{
    $missing = [];
    if (!reports_has_tables($pdo, ['inventory_stock_movements', 'inventory_items'], $missing)) {
        return reports_blank_report('stock_movement', $missing);
    }

    $where = ['m.created_at BETWEEN ? AND ?'];
    $params = [$range['start_datetime'], $range['end_datetime']];
    if (!empty($filters['inventory_category'])) {
        $where[] = 'ii.category = ?';
        $params[] = $filters['inventory_category'];
    }

    $rows = reports_fetch_all($pdo, "
        SELECT
            m.movement_id,
            DATE(m.created_at) AS movement_date,
            ii.item_name,
            ii.category,
            m.movement_type,
            m.quantity_change,
            m.quantity_before,
            m.quantity_after,
            m.reference_type,
            m.reference_id,
            m.performed_by_name,
            m.remarks
        FROM inventory_stock_movements m
        JOIN inventory_items ii ON ii.item_id = m.item_id
        WHERE " . implode(' AND ', $where) . "
        ORDER BY m.created_at DESC
    ", $params, $missing, 'Stock movement data could not be loaded.');

    $stockIn = 0;
    $stockOut = 0;
    foreach ($rows as $row) {
        $qty = (int)$row['quantity_change'];
        if ($qty > 0) {
            $stockIn += $qty;
        } else {
            $stockOut += abs($qty);
        }
    }

    return [
        'type' => 'stock_movement',
        'title' => 'Stock Movement Report',
        'columns' => [
            ['key' => 'movement_date', 'label' => 'Date'],
            ['key' => 'item_name', 'label' => 'Item'],
            ['key' => 'category', 'label' => 'Category'],
            ['key' => 'movement_type', 'label' => 'Movement'],
            ['key' => 'quantity_change', 'label' => 'Qty Change'],
            ['key' => 'quantity_before', 'label' => 'Before'],
            ['key' => 'quantity_after', 'label' => 'After'],
            ['key' => 'performed_by_name', 'label' => 'Processed By'],
            ['key' => 'remarks', 'label' => 'Remarks'],
        ],
        'rows' => $rows,
        'totals' => [
            'total_movements' => count($rows),
            'received_items' => $stockIn,
            'used_sold_adjusted_out' => $stockOut,
        ],
        'summary' => [
            'text' => "Stock movements total " . count($rows) . "; stock-in quantity {$stockIn}, stock-out/adjustment quantity {$stockOut}.",
            'bullets' => [],
        ],
        'chart' => reports_empty_chart('bar'),
        'missing_data' => $missing,
    ];
}

function reports_medicine_product_sales_report(PDO $pdo, array $range, array $filters): array
{
    $missing = [];
    if (!reports_has_tables($pdo, ['visit_charges'], $missing)) {
        return reports_blank_report('medicine_product_sales', $missing);
    }

    $itemJoin = reports_table_exists($pdo, 'inventory_items') ? 'LEFT JOIN inventory_items ii ON ii.item_id = vc.item_id' : '';
    $batchJoin = reports_table_exists($pdo, 'inventory_batches')
        ? "LEFT JOIN (
              SELECT item_id, SUM(quantity) AS remaining_stock
              FROM inventory_batches
              GROUP BY item_id
          ) stock ON stock.item_id = vc.item_id"
        : '';
    $itemName = reports_table_exists($pdo, 'inventory_items') ? "COALESCE(ii.item_name, vc.description)" : 'vc.description';
    $category = reports_table_exists($pdo, 'inventory_items') ? "COALESCE(ii.category, vc.charge_type)" : 'vc.charge_type';
    $stock = reports_table_exists($pdo, 'inventory_batches') ? 'COALESCE(stock.remaining_stock, 0)' : '0';
    $where = ["vc.created_at BETWEEN ? AND ?", "vc.charge_type IN ('medication', 'retail_product', 'consumable')"];
    $params = [$range['start_datetime'], $range['end_datetime']];
    if (!empty($filters['inventory_category']) && reports_table_exists($pdo, 'inventory_items')) {
        $where[] = 'ii.category = ?';
        $params[] = $filters['inventory_category'];
    }

    $rows = reports_fetch_all($pdo, "
        SELECT
            {$itemName} AS item_name,
            {$category} AS category,
            SUM(vc.quantity) AS quantity_sold,
            SUM(vc.subtotal) AS total_sales,
            {$stock} AS remaining_stock
        FROM visit_charges vc
        {$itemJoin}
        {$batchJoin}
        WHERE " . implode(' AND ', $where) . "
        GROUP BY {$itemName}, {$category}, {$stock}
        ORDER BY total_sales DESC, quantity_sold DESC
    ", $params, $missing, 'Medicine/product sales data could not be loaded.');

    $totalQty = 0;
    $totalSales = 0;
    foreach ($rows as &$row) {
        $row['quantity_sold'] = reports_money($row['quantity_sold']);
        $row['total_sales'] = reports_money($row['total_sales']);
        $row['remaining_stock'] = reports_int($row['remaining_stock']);
        $totalQty += (float)$row['quantity_sold'];
        $totalSales += (float)$row['total_sales'];
    }

    $topItem = $rows[0]['item_name'] ?? 'No sold item';

    return [
        'type' => 'medicine_product_sales',
        'title' => 'Medicine/Product Sales Report',
        'columns' => [
            ['key' => 'item_name', 'label' => 'Medicine/Product'],
            ['key' => 'category', 'label' => 'Category'],
            ['key' => 'quantity_sold', 'label' => 'Quantity Sold'],
            ['key' => 'total_sales', 'label' => 'Total Sales'],
            ['key' => 'remaining_stock', 'label' => 'Remaining Stock'],
        ],
        'rows' => $rows,
        'totals' => [
            'top_selling_item' => $topItem,
            'total_quantity_sold' => reports_money($totalQty),
            'total_product_revenue' => reports_money($totalSales),
        ],
        'summary' => [
            'text' => "Top-selling item is {$topItem}. Total product/medicine revenue is " . reports_money($totalSales) . '.',
            'bullets' => [],
        ],
        'chart' => reports_bar_chart(array_slice($rows, 0, 10), 'item_name', 'total_sales', 'Sales'),
        'missing_data' => $missing,
    ];
}

function reports_confinement_pet_hotel_report(PDO $pdo, array $range, array $filters): array
{
    $missing = [];
    if (!reports_has_tables($pdo, ['bookings'], $missing)) {
        return reports_blank_report('confinement_pet_hotel', $missing);
    }

    $petJoin = reports_table_exists($pdo, 'pets_information') ? 'LEFT JOIN pets_information p ON p.pet_id = b.pet_id' : '';
    $assignmentJoin = reports_table_exists($pdo, 'boarding_assignments') ? 'LEFT JOIN boarding_assignments ba ON ba.booking_id = b.booking_id' : '';
    $petSelect = reports_table_exists($pdo, 'pets_information')
        ? "COALESCE(p.pet_name, b.unregistered_pet_name, 'Unregistered Pet') AS pet_name, COALESCE(p.pet_species, b.petType, '') AS pet_species,"
        : "COALESCE(b.unregistered_pet_name, 'Unregistered Pet') AS pet_name, COALESCE(b.petType, '') AS pet_species,";
    $assignmentSelect = reports_table_exists($pdo, 'boarding_assignments')
        ? "ba.room_type, ba.room_number, ba.status AS stay_status, COALESCE(ba.actual_check_in_at, ba.reserved_at, b.check_in_date) AS admission_date, COALESCE(ba.actual_check_out_at, b.check_out_date) AS release_date,"
        : "b.room_size AS room_type, NULL AS room_number, b.status AS stay_status, b.check_in_date AS admission_date, b.check_out_date AS release_date,";
    $durationSelect = reports_table_exists($pdo, 'boarding_assignments')
        ? "DATEDIFF(COALESCE(DATE(ba.actual_check_out_at), b.check_out_date, b.check_in_date), COALESCE(DATE(ba.actual_check_in_at), b.check_in_date)) + 1"
        : "DATEDIFF(COALESCE(b.check_out_date, b.check_in_date, b.booking_date), COALESCE(b.check_in_date, b.booking_date)) + 1";

    $rows = reports_fetch_all($pdo, "
        SELECT
            b.booking_number,
            b.hotel_boarding_type,
            {$petSelect}
            {$assignmentSelect}
            {$durationSelect} AS duration_days,
            b.price AS total_charge,
            b.status AS booking_status
        FROM bookings b
        {$petJoin}
        {$assignmentJoin}
        WHERE b.service_type = 'boarding'
          AND COALESCE(b.check_in_date, b.booking_date) <= ?
          AND COALESCE(b.check_out_date, b.check_in_date, b.booking_date) >= ?
        ORDER BY COALESCE(b.check_in_date, b.booking_date) DESC
    ", [$range['end_date'], $range['start_date']], $missing, 'Confinement and pet hotel data could not be loaded.');

    foreach ($rows as &$row) {
        $row['duration_days'] = max(1, reports_int($row['duration_days']));
        $row['total_charge'] = reports_money($row['total_charge']);
    }

    return [
        'type' => 'confinement_pet_hotel',
        'title' => 'Confinement and Pet Hotel Report',
        'columns' => [
            ['key' => 'booking_number', 'label' => 'Booking No.'],
            ['key' => 'pet_name', 'label' => 'Pet'],
            ['key' => 'pet_species', 'label' => 'Animal Type'],
            ['key' => 'hotel_boarding_type', 'label' => 'Stay Type'],
            ['key' => 'admission_date', 'label' => 'Admission'],
            ['key' => 'release_date', 'label' => 'Release'],
            ['key' => 'duration_days', 'label' => 'Duration'],
            ['key' => 'room_type', 'label' => 'Room/Cage'],
            ['key' => 'total_charge', 'label' => 'Charge'],
            ['key' => 'stay_status', 'label' => 'Status'],
        ],
        'rows' => $rows,
        'totals' => [
            'total_stays' => count($rows),
            'total_charge' => reports_money(array_sum(array_column($rows, 'total_charge'))),
        ],
        'summary' => [
            'text' => count($rows) . ' confinement/pet hotel stays overlap with this date range.',
            'bullets' => [],
        ],
        'chart' => reports_empty_chart('bar'),
        'missing_data' => $missing,
    ];
}

function reports_consent_record_date_expression(PDO $pdo): ?string
{
    $hasStatus = reports_column_exists($pdo, 'consent_form_records', 'status');
    $hasSignedAt = reports_column_exists($pdo, 'consent_form_records', 'signed_at');
    $hasReleasedAt = reports_column_exists($pdo, 'consent_form_records', 'released_at');
    $hasRequestedAt = reports_column_exists($pdo, 'consent_form_records', 'requested_at');
    $hasCreatedAt = reports_column_exists($pdo, 'consent_form_records', 'created_at');
    $parts = [];

    if ($hasStatus && $hasReleasedAt) {
        $parts[] = "CASE WHEN cfr.status = 'released' THEN cfr.released_at ELSE NULL END";
    }
    if ($hasStatus && $hasSignedAt) {
        $parts[] = "CASE WHEN cfr.status = 'signed' THEN cfr.signed_at ELSE NULL END";
    }
    if ($hasSignedAt) {
        $parts[] = 'cfr.signed_at';
    }
    if ($hasReleasedAt) {
        $parts[] = 'cfr.released_at';
    }
    if ($hasRequestedAt) {
        $parts[] = 'cfr.requested_at';
    }
    if ($hasCreatedAt) {
        $parts[] = 'cfr.created_at';
    }

    if (empty($parts)) {
        return null;
    }

    return 'COALESCE(' . implode(', ', $parts) . ')';
}

function reports_consent_legacy_booking_rows(PDO $pdo, array $range, array &$missing, bool $hasRecordTable): array
{
    if (!reports_table_exists($pdo, 'bookings') || !reports_column_exists($pdo, 'bookings', 'signature_path')) {
        return [];
    }

    $hasUsers = reports_table_exists($pdo, 'users');
    $hasPets = reports_table_exists($pdo, 'pets_information');
    $dateExpression = reports_column_exists($pdo, 'bookings', 'created_at')
        ? 'b.created_at'
        : 'CAST(b.booking_date AS DATETIME)';
    $userJoin = $hasUsers ? 'LEFT JOIN users owner ON owner.user_id = b.user_id' : '';
    $petJoin = $hasPets ? 'LEFT JOIN pets_information p ON p.pet_id = b.pet_id' : '';
    $ownerSelect = $hasUsers
        ? "COALESCE(NULLIF(TRIM(CONCAT(COALESCE(owner.first_Name, ''), ' ', COALESCE(owner.last_Name, ''))), ''), owner.mail_Address, 'Unknown Owner') AS client_name,"
        : "'Unknown Owner' AS client_name,";
    $petSelect = $hasPets
        ? "COALESCE(p.pet_name, b.unregistered_pet_name, 'Unknown Pet') AS pet_name,"
        : "COALESCE(b.unregistered_pet_name, 'Unknown Pet') AS pet_name,";
    $excludeTracked = $hasRecordTable && reports_column_exists($pdo, 'consent_form_records', 'booking_id')
        ? 'AND NOT EXISTS (SELECT 1 FROM consent_form_records tracked WHERE tracked.booking_id = b.booking_id)'
        : '';

    return reports_fetch_all($pdo, "
        SELECT
            CONCAT('legacy-booking-', b.booking_id) AS consent_record_id,
            'Booking Consent' AS consent_type,
            {$ownerSelect}
            {$petSelect}
            b.service_type AS service,
            'signed' AS status,
            'legacy_booking' AS source,
            DATE({$dateExpression}) AS requested_date,
            {$dateExpression} AS signed_at,
            NULL AS released_at
        FROM bookings b
        {$userJoin}
        {$petJoin}
        WHERE b.signature_path IS NOT NULL
          AND TRIM(b.signature_path) <> ''
          AND {$dateExpression} BETWEEN ? AND ?
          {$excludeTracked}
        ORDER BY {$dateExpression} DESC
    ", [$range['start_datetime'], $range['end_datetime']], $missing, 'Legacy booking consent signatures could not be loaded.');
}

function reports_consent_legacy_queue_rows(PDO $pdo, array $range, array &$missing, bool $hasRecordTable): array
{
    if (!reports_table_exists($pdo, 'queues') || !reports_column_exists($pdo, 'queues', 'signiture_self_service_path')) {
        return [];
    }

    $hasUsers = reports_table_exists($pdo, 'users');
    $hasPets = reports_table_exists($pdo, 'pets_information');
    $dateExpression = reports_column_exists($pdo, 'queues', 'timestamp')
        ? 'q.timestamp'
        : 'NOW()';
    $userJoin = $hasUsers ? 'LEFT JOIN users owner ON owner.user_id = q.user_id' : '';
    $petJoin = $hasPets ? 'LEFT JOIN pets_information p ON p.pet_id = q.pet_id' : '';
    $ownerSelect = $hasUsers
        ? "COALESCE(NULLIF(TRIM(CONCAT(COALESCE(owner.first_Name, ''), ' ', COALESCE(owner.last_Name, ''))), ''), owner.mail_Address, 'Unknown Owner') AS client_name,"
        : "'Unknown Owner' AS client_name,";
    $petSelect = $hasPets ? "COALESCE(p.pet_name, 'Unknown Pet') AS pet_name," : "'Unknown Pet' AS pet_name,";
    $excludeTracked = $hasRecordTable && reports_column_exists($pdo, 'consent_form_records', 'queue_id')
        ? 'AND NOT EXISTS (SELECT 1 FROM consent_form_records tracked WHERE tracked.queue_id = q.queue_id)'
        : '';

    return reports_fetch_all($pdo, "
        SELECT
            CONCAT('legacy-queue-', q.queue_id) AS consent_record_id,
            COALESCE(NULLIF(TRIM(q.service_name), ''), 'Queue Consent') AS consent_type,
            {$ownerSelect}
            {$petSelect}
            q.service_name AS service,
            'signed' AS status,
            'legacy_queue' AS source,
            DATE({$dateExpression}) AS requested_date,
            {$dateExpression} AS signed_at,
            NULL AS released_at
        FROM queues q
        {$userJoin}
        {$petJoin}
        WHERE q.signiture_self_service_path IS NOT NULL
          AND TRIM(q.signiture_self_service_path) <> ''
          AND {$dateExpression} BETWEEN ? AND ?
          {$excludeTracked}
        ORDER BY {$dateExpression} DESC
    ", [$range['start_datetime'], $range['end_datetime']], $missing, 'Legacy queue consent signatures could not be loaded.');
}

function reports_consent_record_response(array $rows, array $missing): array
{
    $counts = ['signed' => 0, 'pending' => 0, 'released' => 0, 'cancelled' => 0];
    foreach ($rows as $row) {
        $status = strtolower((string)$row['status']);
        if (isset($counts[$status])) {
            $counts[$status] += 1;
        }
    }

    usort($rows, static function ($first, $second) {
        $firstDate = strtotime((string)($first['signed_at'] ?? $first['requested_date'] ?? '')) ?: 0;
        $secondDate = strtotime((string)($second['signed_at'] ?? $second['requested_date'] ?? '')) ?: 0;

        return $secondDate <=> $firstDate;
    });

    return [
        'type' => 'consent_form',
        'title' => 'Consent Form Report',
        'columns' => [
            ['key' => 'consent_type', 'label' => 'Consent Type'],
            ['key' => 'client_name', 'label' => 'Client'],
            ['key' => 'pet_name', 'label' => 'Pet'],
            ['key' => 'service', 'label' => 'Service'],
            ['key' => 'status', 'label' => 'Status'],
            ['key' => 'source', 'label' => 'Source'],
            ['key' => 'requested_date', 'label' => 'Requested'],
            ['key' => 'signed_at', 'label' => 'Signed'],
            ['key' => 'released_at', 'label' => 'Released'],
        ],
        'rows' => $rows,
        'totals' => [
            'total_records' => count($rows),
            'signed' => $counts['signed'],
            'pending' => $counts['pending'],
            'released' => $counts['released'],
            'cancelled' => $counts['cancelled'],
        ],
        'summary' => [
            'text' => "Consent records total " . count($rows) . "; signed {$counts['signed']} and pending {$counts['pending']}.",
            'bullets' => [],
        ],
        'chart' => reports_doughnut_chart(
            ['Signed', 'Pending', 'Released', 'Cancelled'],
            [$counts['signed'], $counts['pending'], $counts['released'], $counts['cancelled']],
            'Consent Status'
        ),
        'missing_data' => $missing,
    ];
}

function reports_consent_form_report(PDO $pdo, array $range, array $filters): array
{
    $missing = [];
    consent_record_table_exists($pdo);
    $recordTableExists = reports_table_exists($pdo, 'consent_form_records');
    $rows = [];

    if ($recordTableExists) {
        $hasFiles = reports_table_exists($pdo, 'consent_files');
        $hasPets = reports_table_exists($pdo, 'pets_information');
        $hasUsers = reports_table_exists($pdo, 'users');
        $hasConsentFileId = reports_column_exists($pdo, 'consent_form_records', 'consent_file_id');
        $hasConsentType = reports_column_exists($pdo, 'consent_form_records', 'consent_type');
        $hasOwnerUserId = reports_column_exists($pdo, 'consent_form_records', 'owner_user_id');
        $hasPetId = reports_column_exists($pdo, 'consent_form_records', 'pet_id');
        $hasServiceName = reports_column_exists($pdo, 'consent_form_records', 'service_name');
        $hasStatus = reports_column_exists($pdo, 'consent_form_records', 'status');
        $hasSource = reports_column_exists($pdo, 'consent_form_records', 'source');
        $hasSignedAt = reports_column_exists($pdo, 'consent_form_records', 'signed_at');
        $hasReleasedAt = reports_column_exists($pdo, 'consent_form_records', 'released_at');
        $recordIdSelect = reports_column_exists($pdo, 'consent_form_records', 'consent_record_id')
            ? 'cfr.consent_record_id'
            : (reports_column_exists($pdo, 'consent_form_records', 'id') ? 'cfr.id' : '0');
        $dateColumn = reports_consent_record_date_expression($pdo);

        $fileJoin = $hasFiles && $hasConsentFileId ? 'LEFT JOIN consent_files cf ON cf.file_id = cfr.consent_file_id' : '';
        $petJoin = $hasPets && $hasPetId ? 'LEFT JOIN pets_information p ON p.pet_id = cfr.pet_id' : '';
        $userJoin = $hasUsers && $hasOwnerUserId ? 'LEFT JOIN users owner ON owner.user_id = cfr.owner_user_id' : '';
        $fileSelect = $hasFiles && $hasConsentFileId && $hasConsentType
            ? "COALESCE(cf.file_name, cfr.consent_type, 'Consent Form') AS consent_type,"
            : ($hasFiles && $hasConsentFileId
                ? "COALESCE(cf.file_name, 'Consent Form') AS consent_type,"
                : ($hasConsentType ? "COALESCE(cfr.consent_type, 'Consent Form') AS consent_type," : "'Consent Form' AS consent_type,"));
        $petSelect = $hasPets && $hasPetId ? "COALESCE(p.pet_name, 'Unknown Pet') AS pet_name," : "'Unknown Pet' AS pet_name,";
        $ownerSelect = $hasUsers && $hasOwnerUserId
            ? "COALESCE(NULLIF(TRIM(CONCAT(COALESCE(owner.first_Name, ''), ' ', COALESCE(owner.last_Name, ''))), ''), owner.mail_Address, 'Unknown Owner') AS client_name,"
            : "'Unknown Owner' AS client_name,";
        $serviceSelect = $hasServiceName ? "cfr.service_name AS service," : "NULL AS service,";
        $statusSelect = $hasStatus ? "COALESCE(cfr.status, 'signed') AS status," : "'signed' AS status,";
        $sourceSelect = $hasSource ? "COALESCE(cfr.source, 'manual') AS source," : "'manual' AS source,";
        $requestedDateSelect = $dateColumn ? "DATE({$dateColumn}) AS requested_date," : "NULL AS requested_date,";
        $signedAtSelect = $hasSignedAt ? "cfr.signed_at," : "NULL AS signed_at,";
        $releasedAtSelect = $hasReleasedAt ? "cfr.released_at" : "NULL AS released_at";
        $where = $dateColumn ? "WHERE {$dateColumn} BETWEEN ? AND ?" : '';
        $params = $dateColumn ? [$range['start_datetime'], $range['end_datetime']] : [];
        $orderBy = $dateColumn ? "{$dateColumn} DESC" : ($recordIdSelect === '0' ? '1 DESC' : "{$recordIdSelect} DESC");

        $rows = reports_fetch_all($pdo, "
            SELECT
                {$recordIdSelect} AS consent_record_id,
                {$fileSelect}
                {$ownerSelect}
                {$petSelect}
                {$serviceSelect}
                {$statusSelect}
                {$sourceSelect}
                {$requestedDateSelect}
                {$signedAtSelect}
                {$releasedAtSelect}
            FROM consent_form_records cfr
            {$fileJoin}
            {$petJoin}
            {$userJoin}
            {$where}
            ORDER BY {$orderBy}
        ", $params, $missing, 'Signed consent record data could not be loaded.');
    }

    $legacyRows = array_merge(
        reports_consent_legacy_booking_rows($pdo, $range, $missing, $recordTableExists),
        reports_consent_legacy_queue_rows($pdo, $range, $missing, $recordTableExists)
    );
    $rows = array_merge($rows, $legacyRows);

    if ($recordTableExists || !empty($rows)) {
        return reports_consent_record_response($rows, $missing);
    }

    if (!reports_has_tables($pdo, ['consent_files'], $missing)) {
        return reports_blank_report('consent_form', $missing);
    }

    $rows = reports_fetch_all($pdo, "
        SELECT
            file_id,
            file_name,
            file_type,
            file_size,
            category,
            DATE(uploaded_at) AS uploaded_date,
            'template_available' AS consent_status
        FROM consent_files
        WHERE uploaded_at BETWEEN ? AND ?
        ORDER BY uploaded_at DESC
    ", [$range['start_datetime'], $range['end_datetime']], $missing, 'Consent file data could not be loaded.');

    $missing[] = 'consent_files stores uploaded consent templates only; signed/pending client consent events are not available in the current schema.';

    return [
        'type' => 'consent_form',
        'title' => 'Consent Form Report',
        'columns' => [
            ['key' => 'file_name', 'label' => 'Consent File'],
            ['key' => 'category', 'label' => 'Category'],
            ['key' => 'file_type', 'label' => 'Type'],
            ['key' => 'file_size', 'label' => 'Size'],
            ['key' => 'uploaded_date', 'label' => 'Uploaded'],
            ['key' => 'consent_status', 'label' => 'Status'],
        ],
        'rows' => $rows,
        'totals' => [
            'total_files' => count($rows),
            'signed' => null,
            'pending' => null,
        ],
        'summary' => [
            'text' => count($rows) . ' consent file templates were uploaded in the selected date range. Signed and pending consent counts require a signed-consent tracking table.',
            'bullets' => [],
        ],
        'chart' => reports_empty_chart('bar'),
        'missing_data' => $missing,
    ];
}

function reports_categorized_pet_cases_report(PDO $pdo, array $range, array $filters): array
{
    $missing = [];
    if (!reports_has_tables($pdo, ['vet_diagnoses', 'pets_information'], $missing)) {
        return reports_blank_report('categorized_pet_cases', $missing);
    }

    $bookingJoin = reports_table_exists($pdo, 'bookings') ? 'LEFT JOIN bookings b ON b.booking_id = vd.booking_id' : '';
    $bookingService = reports_table_exists($pdo, 'bookings') ? "COALESCE(vd.service_name, b.service_type, 'Uncategorized')" : "COALESCE(vd.service_name, 'Uncategorized')";
    $where = ['COALESCE(vd.finalized_at, vd.created_at) BETWEEN ? AND ?'];
    $params = [$range['start_datetime'], $range['end_datetime']];
    if (!empty($filters['pet_type'])) {
        $where[] = 'p.pet_species = ?';
        $params[] = $filters['pet_type'];
    }

    $rows = reports_fetch_all($pdo, "
        SELECT
            {$bookingService} AS case_category,
            p.pet_species AS animal_type,
            COUNT(*) AS visit_frequency,
            COUNT(DISTINCT vd.pet_id) AS unique_pets,
            GROUP_CONCAT(DISTINCT COALESCE(vd.service_name, 'Unspecified') ORDER BY vd.service_name SEPARATOR ', ') AS service_type
        FROM vet_diagnoses vd
        JOIN pets_information p ON p.pet_id = vd.pet_id
        {$bookingJoin}
        WHERE " . implode(' AND ', $where) . "
        GROUP BY {$bookingService}, p.pet_species
        ORDER BY visit_frequency DESC
    ", $params, $missing, 'Categorized case data could not be loaded.');

    foreach ($rows as &$row) {
        $row['visit_frequency'] = reports_int($row['visit_frequency']);
        $row['unique_pets'] = reports_int($row['unique_pets']);
    }

    return [
        'type' => 'categorized_pet_cases',
        'title' => 'Categorized Pet Cases Report',
        'columns' => [
            ['key' => 'case_category', 'label' => 'Case Category'],
            ['key' => 'animal_type', 'label' => 'Animal Type'],
            ['key' => 'visit_frequency', 'label' => 'Visit Frequency'],
            ['key' => 'unique_pets', 'label' => 'Unique Pets'],
            ['key' => 'service_type', 'label' => 'Service Type'],
        ],
        'rows' => $rows,
        'totals' => [
            'total_cases' => array_sum(array_column($rows, 'visit_frequency')),
            'unique_categories' => count($rows),
        ],
        'summary' => [
            'text' => "Case categories total " . count($rows) . ' groups in the selected period.',
            'bullets' => [],
        ],
        'chart' => reports_bar_chart(array_slice($rows, 0, 10), 'case_category', 'visit_frequency', 'Cases'),
        'missing_data' => $missing,
    ];
}

function reports_veterinarian_activity_report(PDO $pdo, array $range, array $filters): array
{
    $missing = [];
    $activity = [];

    if (reports_has_tables($pdo, ['vet_diagnoses'], $missing)) {
        $rows = reports_fetch_all($pdo, "
            SELECT
                vd.veterinarian_user_id,
                COALESCE(vd.veterinarian_name, 'Unassigned') AS veterinarian_name,
                COUNT(*) AS completed_cases
            FROM vet_diagnoses vd
            WHERE COALESCE(vd.finalized_at, vd.created_at) BETWEEN ? AND ?
            GROUP BY vd.veterinarian_user_id, vd.veterinarian_name
        ", [$range['start_datetime'], $range['end_datetime']], $missing, 'Veterinarian diagnosis activity could not be loaded.');

        foreach ($rows as $row) {
            $key = (string)($row['veterinarian_user_id'] ?? $row['veterinarian_name']);
            $activity[$key] = [
                'veterinarian_name' => $row['veterinarian_name'],
                'face_to_face_consultations' => reports_int($row['completed_cases']),
                'online_consultations' => 0,
                'follow_ups' => 0,
                'completed_cases' => reports_int($row['completed_cases']),
            ];
        }
    }

    if (reports_has_tables($pdo, ['online_consultation_diagnoses', 'users'], $missing)) {
        $rows = reports_fetch_all($pdo, "
            SELECT
                ocd.veterinarian_user_id,
                COALESCE(NULLIF(TRIM(CONCAT(COALESCE(u.first_Name, ''), ' ', COALESCE(u.last_Name, ''))), ''), u.mail_Address, 'Unassigned') AS veterinarian_name,
                COUNT(*) AS online_count
            FROM online_consultation_diagnoses ocd
            LEFT JOIN users u ON u.user_id = ocd.veterinarian_user_id
            WHERE COALESCE(ocd.finalized_at, ocd.created_at) BETWEEN ? AND ?
            GROUP BY ocd.veterinarian_user_id, u.first_Name, u.last_Name, u.mail_Address
        ", [$range['start_datetime'], $range['end_datetime']], $missing, 'Online consultation activity could not be loaded.');

        foreach ($rows as $row) {
            $key = (string)($row['veterinarian_user_id'] ?? $row['veterinarian_name']);
            if (!isset($activity[$key])) {
                $activity[$key] = [
                    'veterinarian_name' => $row['veterinarian_name'],
                    'face_to_face_consultations' => 0,
                    'online_consultations' => 0,
                    'follow_ups' => 0,
                    'completed_cases' => 0,
                ];
            }
            $activity[$key]['online_consultations'] += reports_int($row['online_count']);
            $activity[$key]['completed_cases'] += reports_int($row['online_count']);
        }
    }

    if (reports_has_tables($pdo, ['vet_diagnoses'], $missing)) {
        $rows = reports_fetch_all($pdo, "
            SELECT
                veterinarian_user_id,
                COALESCE(veterinarian_name, 'Unassigned') AS veterinarian_name,
                COUNT(*) AS follow_up_count
            FROM vet_diagnoses
            WHERE follow_up_date BETWEEN ? AND ?
            GROUP BY veterinarian_user_id, veterinarian_name
        ", [$range['start_date'], $range['end_date']], $missing, 'Follow-up activity could not be loaded.');

        foreach ($rows as $row) {
            $key = (string)($row['veterinarian_user_id'] ?? $row['veterinarian_name']);
            if (!isset($activity[$key])) {
                $activity[$key] = [
                    'veterinarian_name' => $row['veterinarian_name'],
                    'face_to_face_consultations' => 0,
                    'online_consultations' => 0,
                    'follow_ups' => 0,
                    'completed_cases' => 0,
                ];
            }
            $activity[$key]['follow_ups'] += reports_int($row['follow_up_count']);
        }
    }

    $rows = array_values($activity);
    usort($rows, static fn($a, $b) => $b['completed_cases'] <=> $a['completed_cases']);
    $topVet = $rows[0]['veterinarian_name'] ?? 'No veterinarian activity';

    return [
        'type' => 'veterinarian_activity',
        'title' => 'Veterinarian Activity Report',
        'columns' => [
            ['key' => 'veterinarian_name', 'label' => 'Veterinarian'],
            ['key' => 'face_to_face_consultations', 'label' => 'Face-to-Face'],
            ['key' => 'online_consultations', 'label' => 'Online'],
            ['key' => 'follow_ups', 'label' => 'Follow-Ups'],
            ['key' => 'completed_cases', 'label' => 'Completed Cases'],
        ],
        'rows' => $rows,
        'totals' => [
            'most_active_veterinarian' => $topVet,
            'total_consultations_handled' => array_sum(array_column($rows, 'completed_cases')),
        ],
        'summary' => [
            'text' => "Most active veterinarian is {$topVet}.",
            'bullets' => [],
        ],
        'chart' => reports_bar_chart(array_slice($rows, 0, 10), 'veterinarian_name', 'completed_cases', 'Completed Cases'),
        'missing_data' => $missing,
    ];
}

function reports_blank_report(string $type, array $missing): array
{
    $titles = reports_title_map();

    return [
        'type' => $type,
        'title' => $titles[$type] ?? 'Report',
        'columns' => [],
        'rows' => [],
        'totals' => ['total_records' => 0],
        'summary' => [
            'text' => 'This report cannot be generated from the currently available data.',
            'bullets' => [],
        ],
        'chart' => reports_empty_chart('bar'),
        'missing_data' => $missing,
    ];
}

function reports_build_report(PDO $pdo, string $type, array $range, array $filters = []): array
{
    $reportType = reports_allowed_type($type);
    if (!$reportType) {
        reports_json([
            'success' => false,
            'message' => 'Invalid report_type.',
        ], 422);
    }

    $report = match ($reportType) {
        'sales' => reports_sales_report($pdo, $range, $filters),
        'billing' => reports_billing_report($pdo, $range, $filters),
        'invoice_receipt' => reports_invoice_receipt_report($pdo, $range, $filters),
        'service_utilization' => reports_service_utilization_report($pdo, $range, $filters),
        'appointment' => reports_appointment_report($pdo, $range, $filters),
        'queue' => reports_queue_report($pdo, $range, $filters),
        'consultation' => reports_consultation_report($pdo, $range, $filters),
        'follow_up' => reports_follow_up_report($pdo, $range, $filters),
        'emr_request' => reports_emr_request_report($pdo, $range, $filters),
        'inventory_status' => reports_inventory_status_report($pdo, $range, $filters),
        'stock_movement' => reports_stock_movement_report($pdo, $range, $filters),
        'medicine_product_sales' => reports_medicine_product_sales_report($pdo, $range, $filters),
        'confinement_pet_hotel' => reports_confinement_pet_hotel_report($pdo, $range, $filters),
        'consent_form' => reports_consent_form_report($pdo, $range, $filters),
        'categorized_pet_cases' => reports_categorized_pet_cases_report($pdo, $range, $filters),
        'veterinarian_activity' => reports_veterinarian_activity_report($pdo, $range, $filters),
        default => reports_blank_report($reportType, ['Report type is not implemented.']),
    };

    $report['date_range'] = [
        'start_date' => $range['start_date'],
        'end_date' => $range['end_date'],
        'label' => $range['label'],
    ];
    $report['generated_at'] = (new DateTimeImmutable('now', new DateTimeZone(REPORTS_TIMEZONE)))->format('Y-m-d H:i:s');

    return $report;
}

function reports_consent_file_count(PDO $pdo, array $range, array &$missing): int
{
    if (!reports_table_exists($pdo, 'consent_files')) {
        $missing[] = 'Missing table: consent_files';
        return 0;
    }

    $dateColumn = reports_column_exists($pdo, 'consent_files', 'uploaded_at') ? 'uploaded_at' : null;
    if ($dateColumn === null) {
        return reports_int($pdo->query('SELECT COUNT(*) FROM consent_files')->fetchColumn());
    }

    try {
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM consent_files WHERE {$dateColumn} BETWEEN ? AND ?");
        $stmt->execute([$range['start_datetime'], $range['end_datetime']]);

        return reports_int($stmt->fetchColumn());
    } catch (Throwable $e) {
        $missing[] = 'Consent file count could not be loaded.';
        return 0;
    }
}

function reports_dashboard(PDO $pdo, array $range): array
{
    $sales = reports_build_report($pdo, 'sales', $range);
    $billing = reports_build_report($pdo, 'billing', $range);
    $appointments = reports_build_report($pdo, 'appointment', $range);
    $queue = reports_build_report($pdo, 'queue', $range);
    $consultations = reports_build_report($pdo, 'consultation', $range);
    $followUps = reports_build_report($pdo, 'follow_up', $range);
    $inventory = reports_build_report($pdo, 'inventory_status', $range);
    $productSales = reports_build_report($pdo, 'medicine_product_sales', $range);
    $serviceUtilization = reports_build_report($pdo, 'service_utilization', $range);
    $vetActivity = reports_build_report($pdo, 'veterinarian_activity', $range);
    $consent = reports_build_report($pdo, 'consent_form', $range);
    $dashboardMissing = [];
    $revenueDiagnosisTrend = reports_revenue_diagnosis_trend($pdo, $range, $dashboardMissing);
    $revenueBreakdownTrend = reports_revenue_breakdown_trend($pdo, $range, $dashboardMissing);
    $onlineAppointmentTrend = reports_online_appointment_trend($pdo, $range, $dashboardMissing);
    $queueBookingTrend = reports_queue_booking_trend($pdo, $range, $dashboardMissing);
    $boardingTrend = reports_boarding_trend($pdo, $range, $dashboardMissing);
    $animalDistribution = reports_pet_distribution_chart($pdo, $dashboardMissing);
    $staffMonitoring = reports_staff_monitoring($pdo, $dashboardMissing);
    $consentFileCount = reports_consent_file_count($pdo, $range, $dashboardMissing);

    $salesTotals = $sales['totals'] ?? [];
    $billingTotals = $billing['totals'] ?? [];
    $appointmentTotals = $appointments['totals'] ?? [];
    $queueTotals = $queue['totals'] ?? [];
    $consultationTotals = $consultations['totals'] ?? [];
    $followUpTotals = $followUps['totals'] ?? [];
    $inventoryTotals = $inventory['totals'] ?? [];

    $kpis = [
        reports_metric('Total Sales', $salesTotals['total_sales'] ?? 0, 'currency'),
        reports_metric('Total Paid Amount', $salesTotals['paid_amount'] ?? 0, 'currency'),
        reports_metric('Total Unpaid Balance', $billingTotals['unpaid_balance'] ?? 0, 'currency'),
        reports_metric('Total Appointments', $appointmentTotals['total_appointments'] ?? 0),
        reports_metric('Completed Appointments', $appointmentTotals['completed'] ?? 0),
        reports_metric('Missed / Rescheduled', $appointmentTotals['missed_rescheduled'] ?? 0),
        reports_metric('Total Queue Visits', $queueTotals['total_queue_entries'] ?? 0),
        reports_metric('Total Consultations', $consultationTotals['total_consultations'] ?? 0),
        reports_metric('Online Consultations', $consultationTotals['online'] ?? 0),
        reports_metric('Face-to-Face Consultations', $consultationTotals['face_to_face'] ?? 0),
        reports_metric('Low Stock Items', $inventoryTotals['low_stock'] ?? 0),
        reports_metric('Near Expiry Items', $inventoryTotals['near_expiry'] ?? 0),
        reports_metric('Pending Follow-Ups', $followUpTotals['pending'] ?? 0),
        reports_metric('Consent Files', $consentFileCount),
    ];

    $charts = [
        [
            'id' => 'sales_trend',
            'title' => 'Sales Trend',
            'summary' => $sales['summary']['text'] ?? '',
            'chart' => $sales['chart'],
        ],
        [
            'id' => 'revenue_diagnosis_trend',
            'title' => 'Revenue and Diagnosis Sessions',
            'summary' => 'Revenue is shown beside diagnosis/session volume for the selected period.',
            'chart' => $revenueDiagnosisTrend,
        ],
        [
            'id' => 'revenue_breakdown',
            'title' => 'Revenue Breakdown',
            'summary' => 'Service revenue compared with medicine and product revenue over the selected period.',
            'chart' => $revenueBreakdownTrend,
        ],
        [
            'id' => 'service_utilization',
            'title' => 'Service Utilization',
            'summary' => $serviceUtilization['summary']['text'] ?? '',
            'chart' => $serviceUtilization['chart'],
        ],
        [
            'id' => 'animal_distribution',
            'title' => 'Animal Type Distribution',
            'summary' => 'Distribution of registered pets by animal type. Hover a slice to see breed counts.',
            'chart' => $animalDistribution,
        ],
        [
            'id' => 'appointment_status',
            'title' => 'Appointment Status',
            'summary' => $appointments['summary']['text'] ?? '',
            'chart' => $appointments['chart'],
        ],
        [
            'id' => 'online_appointment_trend',
            'title' => 'Online Appointment Trend',
            'summary' => 'Online appointment volume over the selected period.',
            'chart' => $onlineAppointmentTrend,
        ],
        [
            'id' => 'queue_booking_trend',
            'title' => 'Queue and Booking Trend',
            'summary' => 'Compares walk-in/service queue entries with appointment bookings.',
            'chart' => $queueBookingTrend,
        ],
        [
            'id' => 'consultation_type',
            'title' => 'Consultation Type',
            'summary' => $consultations['summary']['text'] ?? '',
            'chart' => $consultations['chart'],
        ],
        [
            'id' => 'boarding_trend',
            'title' => 'Pet Hotel and Boarding/Kennel Trend',
            'summary' => 'Tracks hotel and boarding/kennel check-ins by the selected period.',
            'chart' => $boardingTrend,
        ],
        [
            'id' => 'inventory_alerts',
            'title' => 'Inventory Alerts',
            'summary' => $inventory['summary']['text'] ?? '',
            'chart' => $inventory['chart'],
        ],
        [
            'id' => 'medicine_product_sales',
            'title' => 'Top Medicine/Product Sales',
            'summary' => $productSales['summary']['text'] ?? '',
            'chart' => $productSales['chart'],
        ],
        [
            'id' => 'veterinarian_activity',
            'title' => 'Veterinarian Activity',
            'summary' => $vetActivity['summary']['text'] ?? '',
            'chart' => $vetActivity['chart'],
        ],
    ];

    $missing = [];
    foreach ([$sales, $billing, $appointments, $queue, $consultations, $followUps, $inventory, $productSales, $serviceUtilization, $vetActivity, $consent] as $report) {
        $missing = array_merge($missing, $report['missing_data'] ?? []);
    }
    $missing = array_values(array_unique($missing));

    return [
        'success' => true,
        'date_range' => [
            'start_date' => $range['start_date'],
            'end_date' => $range['end_date'],
            'label' => $range['label'],
            'range' => $range['range'],
        ],
        'generated_at' => (new DateTimeImmutable('now', new DateTimeZone(REPORTS_TIMEZONE)))->format('Y-m-d H:i:s'),
        'kpis' => $kpis,
        'charts' => $charts,
        'summary_tables' => [
            [
                'title' => 'Pending Billing',
                'columns' => $billing['columns'],
                'rows' => array_values(array_slice(array_filter($billing['rows'], static fn($row) => (float)($row['balance'] ?? 0) > 0), 0, 6)),
            ],
            [
                'title' => 'Inventory Attention',
                'columns' => $inventory['columns'],
                'rows' => array_values(array_slice(array_filter($inventory['rows'], static fn($row) => in_array($row['stock_status'] ?? '', ['low_stock', 'out_of_stock', 'near_expiry', 'expired'], true)), 0, 6)),
            ],
            [
                'title' => 'Upcoming Follow-Ups',
                'columns' => $followUps['columns'],
                'rows' => array_values(array_slice($followUps['rows'], 0, 6)),
            ],
        ],
        'monitoring' => $staffMonitoring,
        'missing_data' => array_values(array_unique(array_merge($missing, $dashboardMissing))),
    ];
}
