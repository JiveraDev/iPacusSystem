<?php
require_once __DIR__ . '/db.php';

header('Content-Type: application/json');
date_default_timezone_set('Asia/Manila');

function pet_media_json(array $payload, int $statusCode = 200): void
{
    http_response_code($statusCode);
    echo json_encode($payload);
    exit;
}

function pet_media_normalize_role($role): string
{
    return strtolower(str_replace([' ', '-'], '_', trim((string)$role)));
}

function pet_media_payload(): array
{
    $input = json_decode(file_get_contents('php://input'), true);

    return is_array($input) ? array_merge($_GET, $input) : $_GET;
}

function pet_media_require_media_access(array $payload): void
{
    $role = pet_media_normalize_role($payload['role'] ?? $payload['user_role'] ?? ($_SERVER['HTTP_X_USER_ROLE'] ?? ''));

    if (!in_array($role, ['super_admin', 'superadmin', 'veterinarian'], true)) {
        pet_media_json([
            'success' => false,
            'message' => 'Only Super Admin and Veterinarian accounts can access pet media monitoring.',
        ], 403);
    }
}

function pet_media_table_exists(PDO $pdo, string $tableName): bool
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

function pet_media_column_exists(PDO $pdo, string $tableName, string $columnName): bool
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

function pet_media_date_or_null($value): ?DateTimeImmutable
{
    $text = trim((string)$value);
    if ($text === '') {
        return null;
    }

    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $text, new DateTimeZone('Asia/Manila'));

    return $date && $date->format('Y-m-d') === $text ? $date : null;
}

function pet_media_date_range(array $payload): array
{
    $timezone = new DateTimeZone('Asia/Manila');
    $now = new DateTimeImmutable('now', $timezone);
    $range = strtolower((string)($payload['range'] ?? 'this_month'));
    $start = null;
    $end = null;

    if ($range === 'custom' || !empty($payload['start_date']) || !empty($payload['end_date'])) {
        $start = pet_media_date_or_null($payload['start_date'] ?? null);
        $end = pet_media_date_or_null($payload['end_date'] ?? null);
        if (!$start || !$end) {
            pet_media_json([
                'success' => false,
                'message' => 'Use valid YYYY-MM-DD start_date and end_date.',
            ], 422);
        }
        $range = 'custom';
    } elseif ($range === 'today') {
        $start = $now->setTime(0, 0, 0);
        $end = $start;
    } elseif ($range === 'this_week') {
        $start = $now->modify('monday this week')->setTime(0, 0, 0);
        $end = $start->modify('+6 days');
    } elseif ($range === 'this_year') {
        $start = $now->setDate((int)$now->format('Y'), 1, 1)->setTime(0, 0, 0);
        $end = $now->setDate((int)$now->format('Y'), 12, 31)->setTime(0, 0, 0);
    } else {
        $range = 'this_month';
        $start = $now->setDate((int)$now->format('Y'), (int)$now->format('n'), 1)->setTime(0, 0, 0);
        $end = $start->modify('last day of this month');
    }

    if ($start > $end) {
        pet_media_json([
            'success' => false,
            'message' => 'start_date must be before or equal to end_date.',
        ], 422);
    }

    return [
        'range' => $range,
        'start_date' => $start->format('Y-m-d'),
        'end_date' => $end->format('Y-m-d'),
        'start_datetime' => $start->setTime(0, 0, 0)->format('Y-m-d H:i:s'),
        'end_datetime' => $end->setTime(23, 59, 59)->format('Y-m-d H:i:s'),
        'start_ts' => $start->setTime(0, 0, 0)->getTimestamp(),
        'end_ts' => $end->setTime(23, 59, 59)->getTimestamp(),
        'label' => $start->format('M j, Y') . ' to ' . $end->format('M j, Y'),
    ];
}

function pet_media_decode_json($value)
{
    if ($value === null || $value === '') {
        return null;
    }

    if (is_array($value)) {
        return $value;
    }

    $decoded = json_decode((string)$value, true);

    return json_last_error() === JSON_ERROR_NONE ? $decoded : null;
}

function pet_media_file_name(string $path): string
{
    $cleanPath = str_replace('\\', '/', explode('?', $path)[0]);
    $parts = array_values(array_filter(explode('/', $cleanPath)));

    return end($parts) ?: 'Image';
}

function pet_media_public_url(string $path): string
{
    $path = trim($path);
    if ($path === '' || preg_match('/^(https?:|data:|blob:)/i', $path)) {
        return $path;
    }

    $path = preg_replace('/^\/?public\//i', '', $path);

    return '/' . ltrim($path, '/');
}

function pet_media_is_image(?string $path, ?string $mimeType = ''): bool
{
    $path = trim((string)$path);
    $mimeType = strtolower(trim((string)$mimeType));

    if ($path === '') {
        return false;
    }

    if (str_starts_with($mimeType, 'image/')) {
        return true;
    }

    if (preg_match('/^data:image\//i', $path)) {
        return true;
    }

    return (bool)preg_match('/\.(png|jpe?g|gif|webp|bmp|avif)(\?.*)?$/i', $path);
}

function pet_media_split_paths($value): array
{
    if ($value === null || $value === '') {
        return [];
    }

    if (is_array($value)) {
        $paths = [];
        foreach ($value as $item) {
            $paths = array_merge($paths, pet_media_split_paths($item));
        }

        return $paths;
    }

    $decoded = pet_media_decode_json($value);
    if (is_array($decoded)) {
        return pet_media_split_paths($decoded);
    }

    return array_values(array_filter(array_map('trim', preg_split('/[\n,]+/', (string)$value))));
}

function pet_media_extract_uploads($value): array
{
    $decoded = pet_media_decode_json($value);
    if ($decoded !== null) {
        $value = $decoded;
    }

    if ($value === null || $value === '') {
        return [];
    }

    if (is_string($value)) {
        return array_map(static fn($path) => ['url' => $path], pet_media_split_paths($value));
    }

    if (!is_array($value)) {
        return [];
    }

    $pathKeys = [
        'url',
        'relativeUrl',
        'relative_url',
        'documentPath',
        'document_path',
        'signedDocumentPath',
        'signed_document_path',
        'physicalConsentPath',
        'physical_consent_path',
        'signatureUrl',
        'signature_url',
        'preview',
    ];
    $uploads = [];
    foreach ($pathKeys as $key) {
        if (!empty($value[$key]) && is_string($value[$key])) {
            $uploads[] = [
                'url' => $value[$key],
                'name' => $value['name'] ?? $value['fileName'] ?? $value['file_name'] ?? $value['title'] ?? null,
                'label' => $value['label'] ?? $value['title'] ?? $value['category'] ?? null,
                'category' => $value['category'] ?? $value['attachmentCategory'] ?? $value['source'] ?? null,
                'mimeType' => $value['mimeType'] ?? $value['mime_type'] ?? $value['type'] ?? null,
                'createdAt' => $value['uploadedAt'] ?? $value['createdAt'] ?? $value['signedAt'] ?? null,
            ];
        }
    }

    foreach ($value as $item) {
        if (is_array($item)) {
            $uploads = array_merge($uploads, pet_media_extract_uploads($item));
        }
    }

    return $uploads;
}

function pet_media_owner_name(array $row): string
{
    $name = trim((string)($row['owner_name'] ?? ''));
    if ($name !== '') {
        return $name;
    }

    $name = trim((string)(($row['owner_first_name'] ?? '') . ' ' . ($row['owner_last_name'] ?? '')));

    return $name !== '' ? $name : 'Unknown Owner';
}

function pet_media_base(array $row): array
{
    return [
        'petId' => ($row['pet_id'] ?? null) !== null ? (int)$row['pet_id'] : null,
        'petName' => $row['pet_name'] ?? 'Unlinked Pet',
        'petSpecies' => $row['pet_species'] ?? '',
        'petBreed' => $row['pet_breed'] ?? '',
        'ownerName' => pet_media_owner_name($row),
        'serviceName' => $row['service_name'] ?? '',
        'bookingId' => ($row['booking_id'] ?? null) !== null ? (int)$row['booking_id'] : null,
        'bookingNumber' => $row['booking_number'] ?? '',
        'queueId' => ($row['queue_id'] ?? null) !== null ? (int)$row['queue_id'] : null,
        'queueNumber' => $row['queue_number'] ?? '',
    ];
}

function pet_media_add(array &$rows, array &$seen, array $base, ?string $path, string $source, string $label, array $meta = []): void
{
    $path = trim((string)$path);
    $mimeType = $meta['mimeType'] ?? $meta['mime_type'] ?? '';
    if (!pet_media_is_image($path, $mimeType)) {
        return;
    }

    $url = pet_media_public_url($path);
    $dedupeKey = ($base['petId'] ?? 'none') . '|' . strtolower($url);
    if (isset($seen[$dedupeKey])) {
        return;
    }
    $seen[$dedupeKey] = true;

    $rows[] = array_merge($base, [
        'id' => md5($dedupeKey . '|' . $source . '|' . $label),
        'source' => $source,
        'label' => $label,
        'name' => $meta['name'] ?? pet_media_file_name($path),
        'path' => $path,
        'url' => $url,
        'mimeType' => $mimeType,
        'createdAt' => $meta['createdAt'] ?? $meta['created_at'] ?? '',
        'recordId' => $meta['recordId'] ?? null,
        'diagnosisId' => $meta['diagnosisId'] ?? null,
        'status' => $meta['status'] ?? '',
        'uploadedBy' => $meta['uploadedBy'] ?? '',
        'notes' => $meta['notes'] ?? '',
    ]);
}

function pet_media_is_within_range(array $item, array $range): bool
{
    $createdAt = trim((string)($item['createdAt'] ?? ''));
    if ($createdAt === '') {
        return false;
    }

    $timestamp = strtotime($createdAt);

    return $timestamp !== false && $timestamp >= $range['start_ts'] && $timestamp <= $range['end_ts'];
}

function pet_media_fetch(PDO $pdo, array $range): array
{
    $media = [];
    $seen = [];
    $missing = [];

    if (pet_media_table_exists($pdo, 'consent_form_records')) {
        $hasConsentFileId = pet_media_column_exists($pdo, 'consent_form_records', 'consent_file_id');
        $hasConsentType = pet_media_column_exists($pdo, 'consent_form_records', 'consent_type');
        $hasPetId = pet_media_column_exists($pdo, 'consent_form_records', 'pet_id');
        $hasOwnerUserId = pet_media_column_exists($pdo, 'consent_form_records', 'owner_user_id');
        $hasBookingId = pet_media_column_exists($pdo, 'consent_form_records', 'booking_id');
        $hasQueueId = pet_media_column_exists($pdo, 'consent_form_records', 'queue_id');
        $hasServiceName = pet_media_column_exists($pdo, 'consent_form_records', 'service_name');
        $hasStatus = pet_media_column_exists($pdo, 'consent_form_records', 'status');
        $hasSignedPath = pet_media_column_exists($pdo, 'consent_form_records', 'signed_file_path');
        $hasPhysicalPath = pet_media_column_exists($pdo, 'consent_form_records', 'physical_file_path');
        $hasSignedAt = pet_media_column_exists($pdo, 'consent_form_records', 'signed_at');
        $hasCreatedAt = pet_media_column_exists($pdo, 'consent_form_records', 'created_at');
        $hasProcessedByName = pet_media_column_exists($pdo, 'consent_form_records', 'processed_by_name');
        $recordIdSelect = pet_media_column_exists($pdo, 'consent_form_records', 'consent_record_id')
            ? 'cfr.consent_record_id'
            : (pet_media_column_exists($pdo, 'consent_form_records', 'id') ? 'cfr.id' : '0');
        $fileJoin = pet_media_table_exists($pdo, 'consent_files') && $hasConsentFileId
            ? 'LEFT JOIN consent_files cf ON cf.file_id = cfr.consent_file_id'
            : '';
        $petJoin = pet_media_table_exists($pdo, 'pets_information') && $hasPetId
            ? 'LEFT JOIN pets_information p ON p.pet_id = cfr.pet_id'
            : '';
        $ownerJoin = pet_media_table_exists($pdo, 'users') && $hasOwnerUserId
            ? 'LEFT JOIN users owner ON owner.user_id = cfr.owner_user_id'
            : '';
        $bookingJoin = pet_media_table_exists($pdo, 'bookings') && $hasBookingId
            ? 'LEFT JOIN bookings b ON b.booking_id = cfr.booking_id'
            : '';
        $queueJoin = pet_media_table_exists($pdo, 'queues') && $hasQueueId
            ? 'LEFT JOIN queues q ON q.queue_id = cfr.queue_id'
            : '';
        $fileNameSelect = $fileJoin ? "cf.file_name" : "NULL";
        $petSelect = $petJoin
            ? "p.pet_name, p.pet_species, p.pet_breed"
            : "NULL AS pet_name, NULL AS pet_species, NULL AS pet_breed";
        $bookingNumberSelect = $bookingJoin ? "b.booking_number" : "NULL AS booking_number";
        $queueNumberSelect = $queueJoin ? "q.queue_number" : "NULL AS queue_number";
        $serviceSelect = $hasServiceName
            ? "cfr.service_name"
            : ($bookingJoin && $queueJoin
                ? "COALESCE(b.service_type, q.service_name)"
                : ($bookingJoin ? "b.service_type" : ($queueJoin ? "q.service_name" : "NULL")));
        $ownerSelect = $ownerJoin
            ? "COALESCE(NULLIF(TRIM(CONCAT(COALESCE(owner.first_Name, ''), ' ', COALESCE(owner.last_Name, ''))), ''), owner.mail_Address, 'Unknown Owner')"
            : "'Unknown Owner'";
        $consentTypeSelect = $hasConsentType ? "cfr.consent_type" : "NULL";
        $signedPathSelect = $hasSignedPath ? "cfr.signed_file_path" : "NULL";
        $physicalPathSelect = $hasPhysicalPath ? "cfr.physical_file_path" : "NULL";
        $signedAtSelect = $hasSignedAt ? "cfr.signed_at" : "NULL";
        $createdAtSelect = $hasCreatedAt ? "cfr.created_at" : "NULL";
        $statusSelect = $hasStatus ? "cfr.status" : "NULL";
        $processedBySelect = $hasProcessedByName ? "cfr.processed_by_name" : "NULL";
        $petIdSelect = $hasPetId ? "cfr.pet_id" : "NULL";
        $bookingIdSelect = $hasBookingId ? "cfr.booking_id" : "NULL";
        $queueIdSelect = $hasQueueId ? "cfr.queue_id" : "NULL";
        $orderBy = $hasCreatedAt ? "cfr.created_at DESC" : ($recordIdSelect === '0' ? '1 DESC' : "{$recordIdSelect} DESC");
        $stmt = $pdo->query("
            SELECT
                {$recordIdSelect} AS consent_record_id,
                {$petIdSelect} AS pet_id,
                {$bookingIdSelect} AS booking_id,
                {$queueIdSelect} AS queue_id,
                {$fileNameSelect} AS file_name,
                {$consentTypeSelect} AS consent_type,
                {$signedPathSelect} AS signed_file_path,
                {$physicalPathSelect} AS physical_file_path,
                {$signedAtSelect} AS signed_at,
                {$createdAtSelect} AS created_at,
                {$statusSelect} AS status,
                {$processedBySelect} AS processed_by_name,
                {$petSelect},
                {$bookingNumberSelect},
                {$queueNumberSelect},
                {$serviceSelect} AS service_name,
                {$ownerSelect} AS owner_name
            FROM consent_form_records cfr
            {$fileJoin}
            {$petJoin}
            {$ownerJoin}
            {$bookingJoin}
            {$queueJoin}
            ORDER BY {$orderBy}
        ");
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            // Signed consent images are intentionally excluded from media monitoring.
        }
    }

    if (pet_media_table_exists($pdo, 'bookings')) {
        $stmt = $pdo->query("
            SELECT
                b.booking_id,
                b.booking_number,
                b.user_id,
                COALESCE(bp.pet_id, b.pet_id) AS pet_id,
                b.service_type AS service_name,
                b.Image_Booking_Concern_Path,
                b.signature_path,
                b.created_at,
                p.pet_name,
                p.pet_species,
                p.pet_breed,
                COALESCE(NULLIF(TRIM(CONCAT(COALESCE(owner.first_Name, ''), ' ', COALESCE(owner.last_Name, ''))), ''), owner.mail_Address, 'Unknown Owner') AS owner_name
            FROM bookings b
            LEFT JOIN booking_pets bp ON bp.booking_id = b.booking_id
            LEFT JOIN pets_information p ON p.pet_id = COALESCE(bp.pet_id, b.pet_id)
            LEFT JOIN users owner ON owner.user_id = b.user_id
            ORDER BY b.created_at DESC
        ");
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $base = pet_media_base($row);
            foreach (pet_media_split_paths($row['Image_Booking_Concern_Path'] ?? '') as $path) {
                pet_media_add($media, $seen, $base, $path, 'booking', 'Booking Concern Image', [
                    'createdAt' => $row['created_at'] ?? '',
                    'recordId' => (int)$row['booking_id'],
                ]);
            }
        }
    }

    if (pet_media_table_exists($pdo, 'queues')) {
        $stmt = $pdo->query("
            SELECT
                q.queue_id,
                q.queue_number,
                q.pet_id,
                q.user_id,
                q.service_name,
                q.image_path,
                q.signiture_self_service_path,
                q.timestamp AS created_at,
                p.pet_name,
                p.pet_species,
                p.pet_breed,
                COALESCE(NULLIF(TRIM(CONCAT(COALESCE(owner.first_Name, ''), ' ', COALESCE(owner.last_Name, ''))), ''), owner.mail_Address, p.pet_Temp_owner, 'Unknown Owner') AS owner_name
            FROM queues q
            JOIN pets_information p ON p.pet_id = q.pet_id
            LEFT JOIN users owner ON owner.user_id = q.user_id
            ORDER BY q.timestamp DESC
        ");
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $base = pet_media_base($row);
            pet_media_add($media, $seen, $base, $row['image_path'] ?? '', 'queue', 'Queue Concern Image', [
                'createdAt' => $row['created_at'] ?? '',
                'recordId' => (int)$row['queue_id'],
            ]);
        }
    }

    if (pet_media_table_exists($pdo, 'vet_diagnoses')) {
        $stmt = $pdo->query("
            SELECT
                vd.diagnosis_id,
                vd.pet_id,
                vd.queue_id,
                q.queue_number,
                vd.booking_id,
                b.booking_number,
                vd.service_name,
                vd.veterinarian_name,
                vd.attachments,
                vd.source_uploads,
                vd.custom_sections,
                COALESCE(vd.finalized_at, vd.created_at) AS created_at,
                p.pet_name,
                p.pet_species,
                p.pet_breed,
                COALESCE(NULLIF(TRIM(CONCAT(COALESCE(owner.first_Name, ''), ' ', COALESCE(owner.last_Name, ''))), ''), owner.mail_Address, p.pet_Temp_owner, 'Unknown Owner') AS owner_name
            FROM vet_diagnoses vd
            JOIN pets_information p ON p.pet_id = vd.pet_id
            LEFT JOIN queues q ON q.queue_id = vd.queue_id
            LEFT JOIN bookings b ON b.booking_id = vd.booking_id
            LEFT JOIN users owner ON owner.user_id = COALESCE(b.user_id, q.user_id)
            ORDER BY COALESCE(vd.finalized_at, vd.created_at) DESC
        ");
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $base = pet_media_base($row);
            $base['veterinarianName'] = $row['veterinarian_name'] ?? '';
            foreach (['attachments', 'source_uploads', 'custom_sections'] as $column) {
                foreach (pet_media_extract_uploads($row[$column] ?? null) as $upload) {
                    $path = $upload['url'] ?? '';
                    $category = strtolower(trim((string)($upload['category'] ?? '')));
                    if (in_array($category, ['additional_consent', 'consent', 'signed_consent', 'physical_consent'], true)) {
                        continue;
                    }
                    $label = $upload['label'] ?? $upload['name'] ?? 'Diagnosis Upload';
                    if ($category !== '') {
                        $label = ucwords(str_replace(['_', '-'], ' ', $category));
                    }
                    pet_media_add($media, $seen, $base, $path, 'diagnosis', $label, [
                        'name' => $upload['name'] ?? null,
                        'mimeType' => $upload['mimeType'] ?? '',
                        'createdAt' => $upload['createdAt'] ?? $row['created_at'] ?? '',
                        'diagnosisId' => (int)$row['diagnosis_id'],
                        'recordId' => (int)$row['diagnosis_id'],
                        'uploadedBy' => $row['veterinarian_name'] ?? '',
                    ]);
                }
            }
        }
    }

    if (pet_media_table_exists($pdo, 'boarding_documents')) {
        $stmt = $pdo->query("
            SELECT
                bd.*,
                b.booking_number,
                b.service_type AS service_name,
                p.pet_name,
                p.pet_species,
                p.pet_breed,
                COALESCE(NULLIF(TRIM(CONCAT(COALESCE(owner.first_Name, ''), ' ', COALESCE(owner.last_Name, ''))), ''), owner.mail_Address, p.pet_Temp_owner, 'Unknown Owner') AS owner_name
            FROM boarding_documents bd
            JOIN bookings b ON b.booking_id = bd.booking_id
            LEFT JOIN pets_information p ON p.pet_id = bd.pet_id
            LEFT JOIN users owner ON owner.user_id = b.user_id
            ORDER BY bd.created_at DESC
        ");
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $base = pet_media_base($row);
            pet_media_add($media, $seen, $base, $row['document_path'] ?? '', 'boarding', $row['title'] ?? 'Boarding Document', [
                'name' => $row['file_name'] ?? null,
                'mimeType' => $row['mime_type'] ?? '',
                'createdAt' => $row['created_at'] ?? '',
                'recordId' => (int)$row['document_id'],
                'uploadedBy' => $row['uploaded_by_name'] ?? '',
                'notes' => $row['notes'] ?? '',
            ]);
        }
    }

    $media = array_values(array_filter($media, static fn($item) => pet_media_is_within_range($item, $range)));

    usort($media, static function ($a, $b) {
        return strcmp((string)($b['createdAt'] ?? ''), (string)($a['createdAt'] ?? ''));
    });

    $pets = [];
    $sourceCounts = [];
    foreach ($media as $item) {
        $petKey = $item['petId'] !== null ? (string)$item['petId'] : 'unlinked';
        if (!isset($pets[$petKey])) {
            $pets[$petKey] = [
                'petId' => $item['petId'],
                'petName' => $item['petName'],
                'petSpecies' => $item['petSpecies'],
                'petBreed' => $item['petBreed'],
                'ownerName' => $item['ownerName'],
                'mediaCount' => 0,
            ];
        }
        $pets[$petKey]['mediaCount'] += 1;
        $source = $item['source'] ?: 'other';
        $sourceCounts[$source] = ($sourceCounts[$source] ?? 0) + 1;
    }

    uasort($pets, static fn($a, $b) => ($b['mediaCount'] <=> $a['mediaCount']) ?: strcmp($a['petName'], $b['petName']));

    return [
        'success' => true,
        'generated_at' => date('Y-m-d H:i:s'),
        'date_range' => [
            'range' => $range['range'],
            'start_date' => $range['start_date'],
            'end_date' => $range['end_date'],
            'label' => $range['label'],
        ],
        'media' => array_values($media),
        'pets' => array_values($pets),
        'totals' => [
            'images' => count($media),
            'pets' => count($pets),
            'diagnosis' => $sourceCounts['diagnosis'] ?? 0,
            'booking' => $sourceCounts['booking'] ?? 0,
            'queue' => $sourceCounts['queue'] ?? 0,
            'boarding' => $sourceCounts['boarding'] ?? 0,
        ],
        'source_counts' => $sourceCounts,
        'missing_data' => $missing,
    ];
}

try {
    $payload = pet_media_payload();
    pet_media_require_media_access($payload);
    $range = pet_media_date_range($payload);
    pet_media_json(pet_media_fetch($pdo, $range));
} catch (Throwable $e) {
    pet_media_json([
        'success' => false,
        'message' => 'Pet media monitoring could not be loaded: ' . $e->getMessage(),
    ], 500);
}
