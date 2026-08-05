<?php
declare(strict_types=1);

header('Content-Type: application/json');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

function tv_env_set(string $name, string $value): void
{
    putenv($name . '=' . $value);
    $_ENV[$name] = $value;
    $_SERVER[$name] = $value;
}

function tv_env_value(string $value): string
{
    $value = trim($value);

    if ($value === '') {
        return '';
    }

    $quote = $value[0];
    if (($quote === '"' || $quote === "'") && substr($value, -1) === $quote) {
        $value = substr($value, 1, -1);

        if ($quote === '"') {
            $value = strtr($value, [
                '\\n' => "\n",
                '\\r' => "\r",
                '\\t' => "\t",
                '\\"' => '"',
                '\\\\' => '\\',
            ]);
        }

        return $value;
    }

    return trim((string)preg_replace('/\s+#.*$/', '', $value));
}

function tv_load_env(string $path, bool $overrideExisting = false): void
{
    if (!is_readable($path)) {
        return;
    }

    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim((string)$line);
        $line = preg_replace('/^\xEF\xBB\xBF/', '', $line);

        if ($line === '' || strpos(ltrim($line), '#') === 0) {
            continue;
        }

        if (strpos($line, 'export ') === 0) {
            $line = trim(substr($line, 7));
        }

        if (strpos($line, '=') === false) {
            continue;
        }

        [$name, $value] = explode('=', $line, 2);
        $name = trim($name);

        if (!preg_match('/^[A-Za-z_][A-Za-z0-9_]*$/', $name)) {
            continue;
        }

        if (!$overrideExisting && getenv($name) !== false) {
            continue;
        }

        tv_env_set($name, tv_env_value($value));
    }
}

tv_load_env(dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . '.env', false);
tv_load_env(__DIR__ . DIRECTORY_SEPARATOR . '.env', true);

$localConfig = __DIR__ . DIRECTORY_SEPARATOR . 'config.php';
if (is_file($localConfig)) {
    require $localConfig;
}

function tv_config_value(string $constantName, string $envName, ?string $fallback = null): ?string
{
    if (defined($constantName)) {
        return (string)constant($constantName);
    }

    $value = getenv($envName);
    if ($value !== false && trim((string)$value) !== '') {
        return (string)$value;
    }

    return $fallback;
}

function tv_database(): PDO
{
    $host = tv_config_value('TV_DB_HOST', 'TV_DB_HOST', tv_config_value('DB_HOST', 'DB_HOST', 'localhost'));
    $port = tv_config_value('TV_DB_PORT', 'TV_DB_PORT', tv_config_value('DB_PORT', 'DB_PORT', '3306'));
    $db = tv_config_value('TV_DB_NAME', 'TV_DB_NAME', tv_config_value('DB_NAME', 'DB_NAME', ''));
    $user = tv_config_value('TV_DB_USER', 'TV_DB_USER', tv_config_value('DB_USER', 'DB_USER', ''));
    $pass = tv_config_value('TV_DB_PASSWORD', 'TV_DB_PASSWORD', tv_config_value('DB_PASSWORD', 'DB_PASSWORD', ''));
    $timeout = (int)tv_config_value('TV_DB_TIMEOUT', 'TV_DB_TIMEOUT', tv_config_value('DB_TIMEOUT', 'DB_TIMEOUT', '5'));

    if ($db === '' || $user === '') {
        throw new RuntimeException('TV display database config is missing. Set DB_NAME and DB_USER in .env or create config.php.');
    }

    if ($timeout < 1) {
        $timeout = 5;
    }

    @ini_set('mysql.connect_timeout', (string)$timeout);
    @ini_set('mysqlnd.net_read_timeout', (string)$timeout);

    $dsn = sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $host, $port, $db);

    return new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
        PDO::ATTR_TIMEOUT => $timeout,
    ]);
}

function tv_table_exists(PDO $pdo, string $tableName): bool
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

function tv_column_exists(PDO $pdo, string $tableName, string $columnName): bool
{
    $stmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = ?
          AND column_name = ?
    ");
    $stmt->execute([$tableName, $columnName]);

    return (int)$stmt->fetchColumn() > 0;
}

function tv_fetch_branches(PDO $pdo): array
{
    if (!tv_table_exists($pdo, 'branches')) {
        throw new RuntimeException('Multi-branch setup is not installed. Run the multi-branch database migration first.');
    }

    $stmt = $pdo->query("
        SELECT branch_id, branch_code, branch_name, address
        FROM branches
        WHERE status = 'active'
        ORDER BY is_main DESC, branch_name ASC
    ");

    return array_map(static fn(array $branch): array => [
        'id' => (int)$branch['branch_id'],
        'code' => $branch['branch_code'],
        'name' => $branch['branch_name'],
        'address' => $branch['address'],
    ], $stmt->fetchAll());
}

function tv_resolve_branch(PDO $pdo, string $requestedBranch): array
{
    foreach (['bookings', 'queues', 'visits'] as $tableName) {
        if (!tv_column_exists($pdo, $tableName, 'branch_id')) {
            throw new RuntimeException('Multi-branch setup is incomplete. Run the multi-branch database migration first.');
        }
    }

    if ($requestedBranch !== '' && ctype_digit($requestedBranch)) {
        $stmt = $pdo->prepare("SELECT * FROM branches WHERE branch_id = ? AND status = 'active' LIMIT 1");
        $stmt->execute([(int)$requestedBranch]);
    } elseif ($requestedBranch !== '') {
        $stmt = $pdo->prepare("SELECT * FROM branches WHERE branch_code = ? AND status = 'active' LIMIT 1");
        $stmt->execute([strtoupper($requestedBranch)]);
    } else {
        $stmt = $pdo->query("SELECT * FROM branches WHERE is_main = 1 AND status = 'active' ORDER BY branch_id LIMIT 1");
    }

    $branch = $stmt->fetch();
    if (!$branch) {
        throw new InvalidArgumentException('Clinic location was not found.');
    }

    return $branch;
}

function tv_text($value, string $fallback = 'Unknown'): string
{
    $text = trim((string)($value ?? ''));
    return $text === '' ? $fallback : $text;
}

function tv_service_label($value): string
{
    $service = tv_text($value, 'Clinic Service');
    $normalized = strtolower(trim($service));

    if (in_array($normalized, ['general-checkup', 'general check-up', 'general checkup'], true)) {
        return 'General Check-up';
    }

    return ucwords(str_replace(['-', '_'], ' ', $service));
}

function tv_reference(string $prefix, $value): string
{
    $text = trim((string)($value ?? ''));

    if ($text === '') {
        return $prefix . '-';
    }

    if (is_numeric($text)) {
        return $prefix . '-' . str_pad((string)(int)$text, 3, '0', STR_PAD_LEFT);
    }

    return $text;
}

function tv_pet_name(array $row): string
{
    return tv_text($row['pet_name'] ?? $row['unregistered_pet_name'] ?? null, 'Pet');
}

function tv_public_pet(array $row): array
{
    return [
        'petName' => tv_pet_name($row),
        'species' => tv_text($row['pet_species'] ?? null, ''),
        'petStatus' => tv_text($row['pet_status'] ?? null, 'Healthy'),
    ];
}

function tv_queue_stage(array $row): string
{
    $billingStatus = strtolower((string)($row['billing_status'] ?? ''));
    $visitStatus = strtolower((string)($row['visit_status'] ?? ''));
    $queueStatus = strtolower((string)($row['queue_status'] ?? 'waiting'));
    $assignmentStatus = strtolower((string)($row['assignment_status'] ?? ''));
    $hasDiagnosis = !empty($row['diagnosis_id']);

    if ($billingStatus === 'paid') {
        return 'Payment Complete';
    }

    if (in_array($billingStatus, ['unpaid', 'partial'], true)) {
        return 'For Payment';
    }

    if ($visitStatus === 'treatment_done' || $hasDiagnosis) {
        return 'Diagnosis Done';
    }

    if ($queueStatus === 'in-progress' && $assignmentStatus === 'received') {
        return 'In Service';
    }

    if ($queueStatus === 'completed') {
        return 'Completed';
    }

    return 'Waiting';
}

function tv_booking_stage(array $row): string
{
    $status = strtolower((string)($row['booking_status'] ?? 'pending'));
    $hasPayment = !empty($row['payment_proof_url']) || !empty($row['payment_method']) || !empty($row['payment_reference']);

    if ($status === 'confirmed') {
        return $hasPayment ? 'Confirmed' : 'Scheduled';
    }

    if ($status === 'completed') {
        return 'Completed';
    }

    if ($status === 'cancelled') {
        return 'Cancelled';
    }

    return $hasPayment ? 'Payment Submitted' : 'Awaiting Approval';
}

function tv_billing_stage(array $row): string
{
    $billingStatus = strtolower((string)($row['billing_status'] ?? 'unbilled'));
    $visitStatus = strtolower((string)($row['visit_status'] ?? 'waiting'));

    if ($billingStatus === 'paid') {
        return 'Payment Complete';
    }

    if ($billingStatus === 'partial') {
        return 'Partial Payment';
    }

    if ($billingStatus === 'unpaid') {
        return 'For Payment';
    }

    if ($visitStatus === 'completed') {
        return 'Completed';
    }

    return 'Preparing Bill';
}

function tv_queue_item(array $row): array
{
    return array_merge([
        'id' => 'queue-' . (int)$row['queue_id'],
        'reference' => tv_reference('Q', $row['queue_number'] ?? null),
        'type' => 'queue',
        'stage' => tv_queue_stage($row),
        'status' => tv_text($row['queue_status'] ?? null, 'waiting'),
        'service' => tv_service_label($row['service_name'] ?? null),
        'priority' => tv_text($row['priority'] ?? null, 'normal'),
        'time' => $row['timestamp'] ?? null,
        'bookingNumber' => tv_text($row['booking_number'] ?? null, ''),
        'veterinarianName' => tv_text($row['veterinarian_name'] ?? null, ''),
    ], tv_public_pet($row));
}

function tv_booking_item(array $row): array
{
    return array_merge([
        'id' => 'booking-' . (int)$row['booking_id'],
        'reference' => tv_text($row['booking_number'] ?? null, 'Booking'),
        'type' => 'booking',
        'stage' => tv_booking_stage($row),
        'status' => tv_text($row['booking_status'] ?? null, 'pending'),
        'service' => tv_service_label($row['service_type'] ?? null),
        'priority' => 'normal',
        'time' => trim((string)($row['booking_date'] ?? '') . ' ' . (string)($row['booking_time'] ?? '')),
        'bookingNumber' => tv_text($row['booking_number'] ?? null, ''),
    ], tv_public_pet($row));
}

function tv_billing_item(array $row): array
{
    return array_merge([
        'id' => 'visit-' . (int)$row['visit_id'],
        'reference' => tv_text($row['booking_number'] ?? null, tv_reference('V', $row['visit_id'] ?? null)),
        'type' => 'billing',
        'stage' => tv_billing_stage($row),
        'status' => tv_text($row['billing_status'] ?? null, 'unbilled'),
        'service' => tv_service_label($row['service_name'] ?? $row['service_type'] ?? $row['source_type'] ?? null),
        'priority' => 'normal',
        'time' => $row['updated_at'] ?? $row['created_at'] ?? null,
        'bookingNumber' => tv_text($row['booking_number'] ?? null, ''),
        'paidAmount' => (float)($row['paid_amount'] ?? 0),
        'totalAmount' => (float)($row['total_amount'] ?? 0),
    ], tv_public_pet($row));
}

function tv_fetch_queue(PDO $pdo, string $today, int $branchId, array &$completed): array
{
    if (!tv_table_exists($pdo, 'queues') || !tv_table_exists($pdo, 'pets_information')) {
        return [];
    }

    $hasBookings = tv_table_exists($pdo, 'bookings');
    $hasAssignments = tv_table_exists($pdo, 'vet_queue_assignments');
    $hasDiagnoses = tv_table_exists($pdo, 'vet_diagnoses');
    $hasVisits = tv_table_exists($pdo, 'visits');

    $bookingSelect = $hasBookings ? 'b.booking_number,' : 'NULL AS booking_number,';
    $bookingJoin = $hasBookings ? 'LEFT JOIN bookings b ON b.booking_id = q.booking_id' : '';

    $assignmentSelect = $hasAssignments
        ? 'vqa.veterinarian_name, vqa.status AS assignment_status,'
        : 'NULL AS veterinarian_name, NULL AS assignment_status,';
    $assignmentJoin = $hasAssignments ? "
        LEFT JOIN vet_queue_assignments vqa ON vqa.assignment_id = (
            SELECT latest_vqa.assignment_id
            FROM vet_queue_assignments latest_vqa
            WHERE latest_vqa.queue_id = q.queue_id
              AND latest_vqa.status = 'received'
            ORDER BY latest_vqa.assignment_id DESC
            LIMIT 1
        )
    " : '';
    $assignmentWhere = $hasAssignments ? "OR vqa.status = 'received'" : '';

    $diagnosisSelect = $hasDiagnoses ? 'vd.diagnosis_id,' : 'NULL AS diagnosis_id,';
    $diagnosisJoin = $hasDiagnoses ? 'LEFT JOIN vet_diagnoses vd ON vd.queue_id = q.queue_id' : '';

    $visitSelect = $hasVisits
        ? 'v.visit_id, v.visit_status, v.billing_status, v.updated_at AS visit_updated_at'
        : 'NULL AS visit_id, NULL AS visit_status, NULL AS billing_status, NULL AS visit_updated_at';
    $visitBookingMatch = $hasBookings ? "OR (q.booking_id IS NOT NULL AND latest_v.booking_id = q.booking_id)" : '';
    $visitJoin = $hasVisits ? "
        LEFT JOIN visits v ON v.visit_id = (
            SELECT latest_v.visit_id
            FROM visits latest_v
            WHERE latest_v.queue_id = q.queue_id
               {$visitBookingMatch}
            ORDER BY latest_v.visit_id DESC
            LIMIT 1
        )
    " : '';

    $stmt = $pdo->prepare("
        SELECT
            q.queue_id,
            q.queue_number,
            q.status AS queue_status,
            q.priority,
            q.service_name,
            q.timestamp,
            p.pet_name,
            p.pet_species,
            p.pet_status,
            {$bookingSelect}
            {$assignmentSelect}
            {$diagnosisSelect}
            {$visitSelect}
        FROM queues q
        JOIN pets_information p ON p.pet_id = q.pet_id
        {$bookingJoin}
        {$assignmentJoin}
        {$diagnosisJoin}
        {$visitJoin}
        WHERE q.branch_id = ?
          AND ((
                q.status IN ('waiting', 'in-progress')
                AND (
                    DATE(q.timestamp) = ?
                    {$assignmentWhere}
                )
            )
           OR (q.status = 'completed' AND DATE(q.timestamp) = ?))
        ORDER BY
            FIELD(q.status, 'in-progress', 'waiting', 'completed', 'cancelled'),
            q.timestamp ASC
        LIMIT 30
    ");
    $stmt->execute([$branchId, $today, $today]);

    $items = [];
    foreach ($stmt->fetchAll() as $row) {
        $item = tv_queue_item($row);
        if (($row['queue_status'] ?? '') === 'completed') {
            $completed[] = $item;
        } else {
            $items[] = $item;
        }
    }

    return $items;
}

function tv_fetch_bookings(PDO $pdo, string $today, int $branchId): array
{
    if (!tv_table_exists($pdo, 'bookings')) {
        return [];
    }

    $hasPets = tv_table_exists($pdo, 'pets_information');
    $hasQueues = tv_table_exists($pdo, 'queues');

    $petSelect = $hasPets
        ? 'p.pet_name, p.pet_species, p.pet_status'
        : 'NULL AS pet_name, NULL AS pet_species, NULL AS pet_status';
    $petJoin = $hasPets ? 'LEFT JOIN pets_information p ON p.pet_id = b.pet_id' : '';
    $queueExclusion = $hasQueues ? "
        AND NOT EXISTS (
            SELECT 1
            FROM queues q
            WHERE q.booking_id = b.booking_id
              AND q.status IN ('waiting', 'in-progress')
        )
    " : '';

    $stmt = $pdo->prepare("
        SELECT
            b.booking_id,
            b.booking_number,
            b.service_type,
            b.booking_date,
            b.booking_time,
            b.status AS booking_status,
            b.payment_proof_url,
            b.payment_method,
            b.payment_reference,
            b.notes,
            b.unregistered_pet_name,
            {$petSelect}
        FROM bookings b
        {$petJoin}
        WHERE b.status = 'confirmed'
          AND b.branch_id = ?
          AND b.booking_date = ?
          AND COALESCE(b.notes, '') NOT LIKE '%[Lifecycle] Auto-rescheduled due to missed approved booking%'
          {$queueExclusion}
        ORDER BY b.booking_date ASC, b.booking_time ASC, b.booking_id ASC
        LIMIT 18
    ");
    $stmt->execute([$branchId, $today]);

    $items = [];
    foreach ($stmt->fetchAll() as $row) {
        $items[] = tv_booking_item($row);
    }

    return $items;
}

function tv_fetch_billing(PDO $pdo, string $today, int $branchId, array &$completed): array
{
    if (!tv_table_exists($pdo, 'visits') || !tv_table_exists($pdo, 'pets_information')) {
        return [];
    }

    $hasBookings = tv_table_exists($pdo, 'bookings');
    $hasQueues = tv_table_exists($pdo, 'queues');
    $hasDiagnoses = tv_table_exists($pdo, 'vet_diagnoses');
    $hasCharges = tv_table_exists($pdo, 'visit_charges');
    $hasPayments = tv_table_exists($pdo, 'visit_payments');

    $bookingSelect = $hasBookings ? 'b.booking_number, b.service_type,' : 'NULL AS booking_number, NULL AS service_type,';
    $bookingJoin = $hasBookings ? 'LEFT JOIN bookings b ON b.booking_id = v.booking_id' : '';
    $queueSelect = $hasQueues ? 'q.queue_number,' : 'NULL AS queue_number,';
    $queueJoin = $hasQueues ? 'LEFT JOIN queues q ON q.queue_id = v.queue_id' : '';
    $diagnosisSelect = $hasDiagnoses ? 'vd.service_name,' : 'NULL AS service_name,';
    $diagnosisJoin = $hasDiagnoses ? 'LEFT JOIN vet_diagnoses vd ON vd.diagnosis_id = v.diagnosis_id' : '';
    $chargeSelect = $hasCharges ? 'COALESCE(charges.total_amount, 0) AS total_amount,' : '0 AS total_amount,';
    $chargeJoin = $hasCharges ? "
        LEFT JOIN (
            SELECT visit_id, SUM(subtotal) AS total_amount
            FROM visit_charges
            GROUP BY visit_id
        ) charges ON charges.visit_id = v.visit_id
    " : '';
    $paymentSelect = $hasPayments ? 'COALESCE(payments.paid_amount, 0) AS paid_amount' : '0 AS paid_amount';
    $paymentJoin = $hasPayments ? "
        LEFT JOIN (
            SELECT visit_id, SUM(amount) AS paid_amount
            FROM visit_payments
            WHERE payment_status = 'verified'
            GROUP BY visit_id
        ) payments ON payments.visit_id = v.visit_id
    " : '';

    $stmt = $pdo->prepare("
        SELECT
            v.visit_id,
            v.source_type,
            v.visit_status,
            v.billing_status,
            v.created_at,
            v.updated_at,
            p.pet_name,
            p.pet_species,
            p.pet_status,
            {$bookingSelect}
            {$queueSelect}
            {$diagnosisSelect}
            {$chargeSelect}
            {$paymentSelect}
        FROM visits v
        JOIN pets_information p ON p.pet_id = v.pet_id
        {$bookingJoin}
        {$queueJoin}
        {$diagnosisJoin}
        {$chargeJoin}
        {$paymentJoin}
        WHERE v.visit_status <> 'cancelled'
          AND v.branch_id = ?
          AND (
              v.billing_status IN ('unbilled', 'unpaid', 'partial')
              OR (v.billing_status = 'paid' AND DATE(v.updated_at) = ?)
              OR (v.visit_status = 'completed' AND DATE(v.updated_at) = ?)
          )
        ORDER BY
            FIELD(v.billing_status, 'partial', 'unpaid', 'unbilled', 'paid', 'refunded'),
            v.updated_at DESC
        LIMIT 24
    ");
    $stmt->execute([$branchId, $today, $today]);

    $items = [];
    foreach ($stmt->fetchAll() as $row) {
        $item = tv_billing_item($row);
        if (($row['billing_status'] ?? '') === 'paid' || ($row['visit_status'] ?? '') === 'completed') {
            $completed[] = $item;
        } else {
            $items[] = $item;
        }
    }

    return $items;
}

function tv_summary(array $sections): array
{
    $waiting = 0;
    $inService = 0;

    foreach ($sections['queue'] as $item) {
        if (($item['stage'] ?? '') === 'Waiting') {
            $waiting++;
        }

        if (in_array($item['stage'] ?? '', ['In Service', 'Diagnosis Done'], true)) {
            $inService++;
        }
    }

    return [
        'waiting' => $waiting,
        'inService' => $inService,
        'forPayment' => count($sections['billing']),
        'upcoming' => count($sections['bookings']),
        'completedToday' => count($sections['completed']),
    ];
}

try {
    $timezone = tv_config_value('TV_TIMEZONE', 'TV_TIMEZONE', 'Asia/Manila') ?: 'Asia/Manila';
    date_default_timezone_set($timezone);

    $pdo = tv_database();

    try {
        $pdo->exec("SET time_zone = '+08:00'");
    } catch (Throwable $ignored) {
        // The TV display can still run if the database user cannot set the session time zone.
    }

    $today = date('Y-m-d');
    $requestedBranch = trim((string)($_GET['branch'] ?? $_GET['branch_id'] ?? ''));
    $branches = tv_fetch_branches($pdo);
    $branch = tv_resolve_branch($pdo, $requestedBranch);
    $branchId = (int)$branch['branch_id'];
    $sections = [
        'queue' => [],
        'bookings' => [],
        'billing' => [],
        'completed' => [],
    ];

    $sections['queue'] = tv_fetch_queue($pdo, $today, $branchId, $sections['completed']);
    $sections['bookings'] = tv_fetch_bookings($pdo, $today, $branchId);
    $sections['billing'] = tv_fetch_billing($pdo, $today, $branchId, $sections['completed']);

    echo json_encode([
        'success' => true,
        'generatedAt' => date(DATE_ATOM),
        'refreshSeconds' => (int)tv_config_value('TV_REFRESH_SECONDS', 'TV_REFRESH_SECONDS', '8'),
        'branch' => [
            'id' => $branchId,
            'code' => $branch['branch_code'],
            'name' => $branch['branch_name'],
            'address' => $branch['address'],
        ],
        'branches' => $branches,
        'privacy' => [
            'ownerNamesShown' => false,
            'diagnosisTextShown' => false,
            'contactDetailsShown' => false,
        ],
        'summary' => tv_summary($sections),
        'sections' => $sections,
    ]);
} catch (Throwable $error) {
    http_response_code($error instanceof InvalidArgumentException ? 404 : 500);
    echo json_encode([
        'success' => false,
        'message' => $error instanceof RuntimeException || $error instanceof InvalidArgumentException
            ? $error->getMessage()
            : 'Unable to load TV status display.',
    ]);
}
