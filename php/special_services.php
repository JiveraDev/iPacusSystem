<?php
require_once __DIR__ . '/db.php';

header("Content-Type: application/json");

function tableExists(PDO $pdo, string $tableName): bool
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

function columnExists(PDO $pdo, string $tableName, string $columnName): bool
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

function specialServiceDateColumnsExist(PDO $pdo): bool
{
    return columnExists($pdo, 'special_service_catalog', 'date_restriction_type')
        && columnExists($pdo, 'special_service_catalog', 'date_start')
        && columnExists($pdo, 'special_service_catalog', 'date_end');
}

function normalizeServiceCode(string $value): string
{
    $code = strtolower(trim($value));
    $code = preg_replace('/[^a-z0-9]+/', '-', $code) ?? '';
    $code = trim($code, '-');
    return $code !== '' ? $code : 'special-service';
}

function generateUniqueServiceCode(PDO $pdo, string $title, ?string $requestedCode = null, ?int $excludeServiceId = null): string
{
    $baseCode = normalizeServiceCode($requestedCode ?: $title);
    $candidate = $baseCode;
    $suffix = 2;

    while (true) {
        $sql = "SELECT COUNT(*) FROM special_service_catalog WHERE service_code = ?";
        $params = [$candidate];

        if ($excludeServiceId !== null) {
            $sql .= " AND special_service_id <> ?";
            $params[] = $excludeServiceId;
        }

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        if ((int)$stmt->fetchColumn() === 0) {
            return $candidate;
        }

        $candidate = $baseCode . '-' . $suffix;
        $suffix++;
    }
}

function fetchSpecialService(PDO $pdo, int $serviceId): ?array
{
    $dateColumnsAvailable = specialServiceDateColumnsExist($pdo);
    $dateSelect = $dateColumnsAvailable
        ? 'date_restriction_type, date_start, date_end,'
        : "'none' AS date_restriction_type, NULL AS date_start, NULL AS date_end,";

    $stmt = $pdo->prepare("
        SELECT special_service_id, service_code, service_title, service_description, service_details, price_label, duration_label, max_pets, sort_order, is_active, {$dateSelect} created_by_user_id, created_at
        FROM special_service_catalog
        WHERE special_service_id = ?
        LIMIT 1
    ");
    $stmt->execute([$serviceId]);
    $service = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($service) {
        $service['_date_restriction_supported'] = $dateColumnsAvailable;
    }

    return $service ?: null;
}

function getSpecialServiceBookedPets(PDO $pdo): array
{
    if (!tableExists($pdo, 'special_service_booking_items')) {
        return [];
    }

    $hasBookingPets = tableExists($pdo, 'booking_pets');
    $bookingPetsJoin = $hasBookingPets
        ? "LEFT JOIN (
                SELECT booking_id, COUNT(*) AS pet_count
                FROM booking_pets
                GROUP BY booking_id
           ) bp ON bp.booking_id = b.booking_id"
        : '';
    $petCountExpression = $hasBookingPets
        ? "CASE
                WHEN COALESCE(bp.pet_count, 0) > 0 THEN bp.pet_count
                WHEN b.unregistered_pet_name IS NOT NULL AND TRIM(b.unregistered_pet_name) <> '' THEN 1
                WHEN b.pet_id IS NOT NULL THEN 1
                ELSE 0
           END"
        : "CASE
                WHEN b.unregistered_pet_name IS NOT NULL AND TRIM(b.unregistered_pet_name) <> '' THEN 1
                WHEN b.pet_id IS NOT NULL THEN 1
                ELSE 0
           END";

    $stmt = $pdo->query("
        SELECT
            sbi.special_service_id,
            COALESCE(SUM({$petCountExpression}), 0) AS booked_pets
        FROM special_service_booking_items sbi
        JOIN bookings b ON b.booking_id = sbi.booking_id
        {$bookingPetsJoin}
        WHERE b.status <> 'cancelled'
        GROUP BY sbi.special_service_id
    ");

    $bookedPets = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $bookedPets[(int)$row['special_service_id']] = (int)$row['booked_pets'];
    }

    return $bookedPets;
}

function attachSpecialServiceUsage(array $services, PDO $pdo): array
{
    $bookedPetsByService = getSpecialServiceBookedPets($pdo);

    return array_map(function ($service) use ($bookedPetsByService) {
        $service['_booked_pets'] = $bookedPetsByService[(int)$service['special_service_id']] ?? 0;
        return $service;
    }, $services);
}

function normalizePriceLabel(?string $value): ?string
{
    if ($value === null) {
        return null;
    }

    $label = trim($value);
    if ($label === '') {
        return null;
    }

    $pesoSign = html_entity_decode('&#8369;', ENT_QUOTES, 'UTF-8');
    $label = str_replace([$pesoSign, '$'], 'PHP ', $label);
    $label = preg_replace('/\bphp\b/i', 'PHP', $label) ?? $label;
    $label = preg_replace('/\s*-\s*/', ' - ', $label) ?? $label;
    $label = preg_replace('/\s+/', ' ', $label) ?? $label;
    $label = trim($label);

    return $label !== '' ? $label : null;
}

function serializeSpecialService(array $service): array
{
    $maxPets = max(1, (int)$service['max_pets']);
    $bookedPets = max(0, (int)($service['_booked_pets'] ?? 0));
    $remainingSlots = max(0, $maxPets - $bookedPets);

    return [
        'id' => (int)$service['special_service_id'],
        'serviceCode' => $service['service_code'],
        'serviceTitle' => $service['service_title'],
        'serviceDescription' => $service['service_description'],
        'serviceDetails' => $service['service_details'],
        'priceLabel' => normalizePriceLabel($service['price_label']),
        'durationLabel' => $service['duration_label'],
        'maxPets' => $maxPets,
        'bookedPets' => $bookedPets,
        'remainingSlots' => $remainingSlots,
        'isFullyBooked' => $remainingSlots <= 0,
        'isBookable' => (bool)$service['is_active'] && $remainingSlots > 0,
        'sortOrder' => (int)$service['sort_order'],
        'isActive' => (bool)$service['is_active'],
        'dateRestrictionType' => $service['date_restriction_type'] ?? 'none',
        'dateStart' => $service['date_start'] ?? null,
        'dateEnd' => $service['date_end'] ?? null,
        'dateRestrictionSupported' => (bool)($service['_date_restriction_supported'] ?? false),
        'createdByUserId' => $service['created_by_user_id'] !== null ? (int)$service['created_by_user_id'] : null,
        'createdAt' => $service['created_at'],
    ];
}

function isSpecialServiceAdmin(PDO $pdo, $userId): bool
{
    if (!$userId) {
        return false;
    }

    $userStmt = $pdo->prepare("SELECT role FROM users WHERE user_id = ? LIMIT 1");
    $userStmt->execute([$userId]);
    $role = strtolower(str_replace([' ', '-'], '_', trim((string)$userStmt->fetchColumn())));

    return in_array($role, ['admin', 'super_admin'], true);
}

function nullableTrimmedString(array $input, string $key, ?string $fallback = null): ?string
{
    if (!array_key_exists($key, $input)) {
        return $fallback;
    }

    $value = trim((string)$input[$key]);
    return $value !== '' ? $value : null;
}

function normalizeDateRestrictionType($value): string
{
    $type = strtolower(trim((string)$value));
    return in_array($type, ['none', 'single', 'range'], true) ? $type : 'none';
}

function normalizeDateValue($value): ?string
{
    $date = trim((string)$value);
    if ($date === '') {
        return null;
    }

    $parsed = DateTime::createFromFormat('!Y-m-d', $date);
    $errors = DateTime::getLastErrors();
    $hasErrors = is_array($errors) && ($errors['warning_count'] > 0 || $errors['error_count'] > 0);

    return $parsed && !$hasErrors ? $parsed->format('Y-m-d') : null;
}

function payloadRequestsDateRestriction(array $input): bool
{
    $type = normalizeDateRestrictionType($input['date_restriction_type'] ?? 'none');
    return $type !== 'none'
        || trim((string)($input['date_start'] ?? '')) !== ''
        || trim((string)($input['date_end'] ?? '')) !== '';
}

function normalizeDateRestrictionFields(array $input, ?array $currentService = null): array
{
    $type = array_key_exists('date_restriction_type', $input)
        ? normalizeDateRestrictionType($input['date_restriction_type'])
        : normalizeDateRestrictionType($currentService['date_restriction_type'] ?? 'none');

    $dateStart = array_key_exists('date_start', $input)
        ? normalizeDateValue($input['date_start'])
        : normalizeDateValue($currentService['date_start'] ?? null);
    $dateEnd = array_key_exists('date_end', $input)
        ? normalizeDateValue($input['date_end'])
        : normalizeDateValue($currentService['date_end'] ?? null);

    if ($type === 'none') {
        return [
            'valid' => true,
            'type' => 'none',
            'date_start' => null,
            'date_end' => null,
            'message' => null,
        ];
    }

    if ($type === 'single') {
        if (!$dateStart) {
            return ['valid' => false, 'message' => 'A service date is required for single-date restriction.'];
        }

        return [
            'valid' => true,
            'type' => 'single',
            'date_start' => $dateStart,
            'date_end' => null,
            'message' => null,
        ];
    }

    if (!$dateStart || !$dateEnd) {
        return ['valid' => false, 'message' => 'Start and end dates are required for date-range restriction.'];
    }

    if ($dateEnd < $dateStart) {
        return ['valid' => false, 'message' => 'Date range end must be on or after the start date.'];
    }

    return [
        'valid' => true,
        'type' => 'range',
        'date_start' => $dateStart,
        'date_end' => $dateEnd,
        'message' => null,
    ];
}

function seedDefaultSpecialServices(PDO $pdo): void
{
    $stmt = $pdo->query("SELECT COUNT(*) FROM special_service_catalog");
    if ((int)$stmt->fetchColumn() > 0) {
        return;
    }

    $defaults = [
        [
            'service_code' => 'kapon',
            'service_title' => 'Kapon (Spay/Neuter)',
            'service_description' => 'Surgical sterilization procedure',
            'service_details' => "Recommended for routine sterilization.\nIncludes pre-assessment, preparation, and post-procedure instructions.",
            'price_label' => 'Free',
            'duration_label' => '2-3 hours',
            'max_pets' => 3,
            'sort_order' => 1,
        ],
        [
            'service_code' => 'special-surgery',
            'service_title' => 'Special Surgery',
            'service_description' => 'Specialized surgical procedures',
            'service_details' => "For advanced or case-specific procedures.\nAdmin will confirm preparation and pricing before the booking is finalized.",
            'price_label' => 'PHP 5,000 - PHP 15,000',
            'duration_label' => '3-5 hours',
            'max_pets' => 2,
            'sort_order' => 2,
        ],
    ];

    $insert = $pdo->prepare("
        INSERT INTO special_service_catalog
            (service_code, service_title, service_description, service_details, price_label, duration_label, max_pets, sort_order, is_active, created_by_user_id)
        VALUES
            (?, ?, ?, ?, ?, ?, ?, ?, 1, NULL)
    ");

    foreach ($defaults as $item) {
        $insert->execute([
            $item['service_code'],
            $item['service_title'],
            $item['service_description'],
            $item['service_details'],
            $item['price_label'],
            $item['duration_label'],
            $item['max_pets'],
            $item['sort_order'],
        ]);
    }
}

if (!tableExists($pdo, 'special_service_catalog')) {
    http_response_code(500);
    echo json_encode(['message' => 'Special service catalog table is missing.']);
    exit;
}

try {
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $includeInactive = isset($_GET['includeInactive']) && (string)$_GET['includeInactive'] === '1';
        $dateColumnsAvailable = specialServiceDateColumnsExist($pdo);
        $dateSelect = $dateColumnsAvailable
            ? 'date_restriction_type, date_start, date_end,'
            : "'none' AS date_restriction_type, NULL AS date_start, NULL AS date_end,";
        $sql = "SELECT special_service_id, service_code, service_title, service_description, service_details, price_label, duration_label, max_pets, sort_order, is_active, {$dateSelect} created_by_user_id, created_at
                FROM special_service_catalog";
        if (!$includeInactive) {
            $sql .= " WHERE is_active = 1";
        }
        $sql .= " ORDER BY sort_order ASC, service_title ASC";

        $stmt = $pdo->query($sql);
        $services = attachSpecialServiceUsage(array_map(function ($service) use ($dateColumnsAvailable) {
            $service['_date_restriction_supported'] = $dateColumnsAvailable;
            return $service;
        }, $stmt->fetchAll(PDO::FETCH_ASSOC)), $pdo);

        echo json_encode(array_map('serializeSpecialService', $services));
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] === 'PATCH') {
        $serviceId = isset($_GET['specialServiceId']) ? (int)$_GET['specialServiceId'] : 0;
        if ($serviceId <= 0) {
            http_response_code(400);
            echo json_encode(['message' => 'Special service ID is required.']);
            exit;
        }

        $input = json_decode(file_get_contents('php://input'), true) ?: [];
        $userId = $input['updated_by_user_id'] ?? $input['created_by_user_id'] ?? $input['user_id'] ?? null;

        if (!isSpecialServiceAdmin($pdo, $userId)) {
            http_response_code(403);
            echo json_encode(['message' => 'Only admin users can update special services.']);
            exit;
        }

        $currentService = fetchSpecialService($pdo, $serviceId);
        if (!$currentService) {
            http_response_code(404);
            echo json_encode(['message' => 'Special service not found.']);
            exit;
        }

        $serviceTitle = array_key_exists('service_title', $input)
            ? trim((string)$input['service_title'])
            : (string)$currentService['service_title'];
        if ($serviceTitle === '') {
            http_response_code(400);
            echo json_encode(['message' => 'Service title is required.']);
            exit;
        }

        $serviceDescription = nullableTrimmedString($input, 'service_description', $currentService['service_description']);
        $serviceDetails = nullableTrimmedString($input, 'service_details', $currentService['service_details']);
        $priceLabel = normalizePriceLabel(nullableTrimmedString($input, 'price_label', $currentService['price_label']));
        $durationLabel = nullableTrimmedString($input, 'duration_label', $currentService['duration_label']);
        $serviceCode = array_key_exists('service_code', $input) ? trim((string)$input['service_code']) : (string)$currentService['service_code'];
        $maxPets = array_key_exists('max_pets', $input) ? (int)$input['max_pets'] : (int)$currentService['max_pets'];
        $sortOrder = array_key_exists('sort_order', $input) ? (int)$input['sort_order'] : (int)$currentService['sort_order'];
        $isActive = array_key_exists('is_active', $input) ? (int)((bool)$input['is_active']) : (int)$currentService['is_active'];
        $dateColumnsAvailable = specialServiceDateColumnsExist($pdo);

        if ($maxPets < 1) {
            $maxPets = 1;
        }

        if (!$dateColumnsAvailable && payloadRequestsDateRestriction($input)) {
            http_response_code(500);
            echo json_encode(['message' => 'Date restriction columns are missing. Please run the special_service_catalog date restriction migration.']);
            exit;
        }

        $dateRestriction = normalizeDateRestrictionFields($input, $currentService);
        if (!$dateRestriction['valid']) {
            http_response_code(400);
            echo json_encode(['message' => $dateRestriction['message']]);
            exit;
        }

        $finalCode = generateUniqueServiceCode($pdo, $serviceTitle, $serviceCode !== '' ? $serviceCode : null, $serviceId);

        $dateUpdateSql = $dateColumnsAvailable
            ? ",
                date_restriction_type = ?,
                date_start = ?,
                date_end = ?"
            : '';
        $updateParams = [
            $finalCode,
            $serviceTitle,
            $serviceDescription,
            $serviceDetails,
            $priceLabel,
            $durationLabel,
            $maxPets,
            $sortOrder,
            $isActive,
        ];

        if ($dateColumnsAvailable) {
            $updateParams[] = $dateRestriction['type'];
            $updateParams[] = $dateRestriction['date_start'];
            $updateParams[] = $dateRestriction['date_end'];
        }

        $updateParams[] = $serviceId;

        $stmt = $pdo->prepare("
            UPDATE special_service_catalog
            SET service_code = ?,
                service_title = ?,
                service_description = ?,
                service_details = ?,
                price_label = ?,
                duration_label = ?,
                max_pets = ?,
                sort_order = ?,
                is_active = ?
                {$dateUpdateSql}
            WHERE special_service_id = ?
        ");
        $stmt->execute($updateParams);

        echo json_encode([
            'message' => 'Special service updated successfully.',
            'service' => serializeSpecialService(attachSpecialServiceUsage([fetchSpecialService($pdo, $serviceId)], $pdo)[0]),
        ]);
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['message' => 'Method not allowed.']);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true) ?: [];
    $userId = $input['created_by_user_id'] ?? $input['user_id'] ?? null;
    $serviceTitle = trim((string)($input['service_title'] ?? ''));
    $serviceDescription = trim((string)($input['service_description'] ?? ''));
    $serviceDetails = trim((string)($input['service_details'] ?? ''));
    $priceLabel = normalizePriceLabel(trim((string)($input['price_label'] ?? ''))) ?? '';
    $durationLabel = trim((string)($input['duration_label'] ?? ''));
    $serviceCode = trim((string)($input['service_code'] ?? ''));
    $maxPets = isset($input['max_pets']) ? (int)$input['max_pets'] : 1;
    $sortOrder = isset($input['sort_order']) ? (int)$input['sort_order'] : 0;
    $isActive = isset($input['is_active']) ? (int)((bool)$input['is_active']) : 1;
    $dateColumnsAvailable = specialServiceDateColumnsExist($pdo);

    if (!$userId) {
        http_response_code(400);
        echo json_encode(['message' => 'Admin user ID is required.']);
        exit;
    }

    if ($serviceTitle === '') {
        http_response_code(400);
        echo json_encode(['message' => 'Service title is required.']);
        exit;
    }

    if (!isSpecialServiceAdmin($pdo, $userId)) {
        http_response_code(403);
        echo json_encode(['message' => 'Only admin users can add special services.']);
        exit;
    }

    if ($maxPets < 1) {
        $maxPets = 1;
    }

    if (!$dateColumnsAvailable && payloadRequestsDateRestriction($input)) {
        http_response_code(500);
        echo json_encode(['message' => 'Date restriction columns are missing. Please run the special_service_catalog date restriction migration.']);
        exit;
    }

    $dateRestriction = normalizeDateRestrictionFields($input);
    if (!$dateRestriction['valid']) {
        http_response_code(400);
        echo json_encode(['message' => $dateRestriction['message']]);
        exit;
    }

    $finalCode = generateUniqueServiceCode($pdo, $serviceTitle, $serviceCode !== '' ? $serviceCode : null);

    $dateInsertColumns = $dateColumnsAvailable ? ', date_restriction_type, date_start, date_end' : '';
    $dateInsertPlaceholders = $dateColumnsAvailable ? ', ?, ?, ?' : '';
    $insertParams = [
        $finalCode,
        $serviceTitle,
        $serviceDescription !== '' ? $serviceDescription : null,
        $serviceDetails !== '' ? $serviceDetails : null,
        $priceLabel !== '' ? $priceLabel : null,
        $durationLabel !== '' ? $durationLabel : null,
        $maxPets,
        $sortOrder,
        $isActive,
        $userId,
    ];

    if ($dateColumnsAvailable) {
        $insertParams[] = $dateRestriction['type'];
        $insertParams[] = $dateRestriction['date_start'];
        $insertParams[] = $dateRestriction['date_end'];
    }

    $stmt = $pdo->prepare("
        INSERT INTO special_service_catalog
            (service_code, service_title, service_description, service_details, price_label, duration_label, max_pets, sort_order, is_active, created_by_user_id{$dateInsertColumns})
        VALUES
            (?, ?, ?, ?, ?, ?, ?, ?, ?, ?{$dateInsertPlaceholders})
    ");
    $stmt->execute($insertParams);

    $serviceId = (int)$pdo->lastInsertId();

    echo json_encode([
        'message' => 'Special service saved successfully.',
        'service' => serializeSpecialService(attachSpecialServiceUsage([fetchSpecialService($pdo, $serviceId)], $pdo)[0]),
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['message' => 'Failed to save special service: ' . $e->getMessage()]);
}
