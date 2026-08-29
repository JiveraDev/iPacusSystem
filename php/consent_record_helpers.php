<?php

class ConsentDocumentScopeException extends RuntimeException
{
}

function consent_record_table_exists_raw(PDO $pdo): bool
{
    $stmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM information_schema.tables
        WHERE table_schema = DATABASE()
          AND table_name = 'consent_form_records'
    ");
    $stmt->execute();

    return (int)$stmt->fetchColumn() > 0;
}

function consent_record_column_exists(PDO $pdo, string $columnName): bool
{
    $stmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 'consent_form_records'
          AND column_name = ?
    ");
    $stmt->execute([$columnName]);

    return (int)$stmt->fetchColumn() > 0;
}

function consent_record_column_type(PDO $pdo, string $columnName): string
{
    $stmt = $pdo->prepare("
        SELECT COLUMN_TYPE
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 'consent_form_records'
          AND column_name = ?
        LIMIT 1
    ");
    $stmt->execute([$columnName]);

    return (string)($stmt->fetchColumn() ?: '');
}

function consent_record_apply_schema_change(PDO $pdo, string $sql): bool
{
    error_log('Consent record schema update skipped because runtime database schema changes are disabled.');
    return false;
}

function consent_record_ensure_columns(PDO $pdo): bool
{
    $requiredColumns = [
        'consent_file_id',
        'consent_type',
        'owner_user_id',
        'pet_id',
        'booking_id',
        'queue_id',
        'visit_id',
        'service_name',
        'status',
        'source',
        'requested_at',
        'signed_at',
        'released_at',
        'signed_file_path',
        'physical_file_path',
        'signer_name',
        'processed_by_user_id',
        'processed_by_name',
        'notes',
        'created_at',
        'updated_at',
    ];

    $isReady = true;
    foreach ($requiredColumns as $columnName) {
        if (!consent_record_column_exists($pdo, $columnName)) {
            error_log("Consent record schema is missing column: {$columnName}");
            $isReady = false;
        }
    }

    $statusType = consent_record_column_type($pdo, 'status');
    if ($statusType !== '' && stripos($statusType, "'released'") === false) {
        error_log('Consent record status enum is missing released status.');
        $isReady = false;
    }

    $sourceType = consent_record_column_type($pdo, 'source');
    if ($sourceType !== '' && stripos($sourceType, "'vet_my_list'") === false) {
        error_log('Consent record source enum is missing vet_my_list source.');
        $isReady = false;
    }

    return $isReady;
}

function consent_record_ensure_table(PDO $pdo): bool
{
    if (consent_record_table_exists_raw($pdo)) {
        return consent_record_ensure_columns($pdo);
    }

    error_log('Consent record table is missing. Runtime database schema changes are disabled.');
    return false;
}

function consent_record_table_exists(PDO $pdo): bool
{
    return consent_record_ensure_table($pdo);
}

function consent_record_nullable_text($value): ?string
{
    if ($value === null) {
        return null;
    }

    $text = trim((string)$value);

    return $text === '' ? null : $text;
}

function consent_record_nullable_int($value): ?int
{
    if ($value === null || $value === '') {
        return null;
    }

    return is_numeric($value) ? (int)$value : null;
}

function consent_record_datetime_or_null($value): ?string
{
    $text = consent_record_nullable_text($value);
    if ($text === null) {
        return null;
    }

    $timestamp = strtotime($text);

    return $timestamp === false ? null : date('Y-m-d H:i:s', $timestamp);
}

function consent_record_normalize_document_path($path): ?string
{
    $path = consent_record_nullable_text($path);
    if ($path === null) return null;
    $parsedPath = parse_url($path, PHP_URL_PATH);
    $cleanPath = ltrim(str_replace('\\', '/', is_string($parsedPath) ? $parsedPath : $path), '/');
    $cleanPath = preg_replace('#^(?:api/uploads/media/|public/)#i', '', $cleanPath);
    if (
        !is_string($cleanPath)
        || $cleanPath === ''
        || str_contains($cleanPath, '..')
        || preg_match('/[\x00-\x1F]/', $cleanPath)
    ) {
        return null;
    }
    return $cleanPath;
}

function consent_record_acquire_document_lock(PDO $pdo, string $path): void
{
    $normalizedPath = consent_record_normalize_document_path($path);
    if ($normalizedPath === null) throw new ConsentDocumentScopeException('The consent document path is invalid.');
    $cacheKey = spl_object_id($pdo) . ':' . $normalizedPath;
    if (!empty($GLOBALS['ipawcus_consent_document_locks'][$cacheKey])) return;

    $lockName = 'ipawcus_consent_' . md5($normalizedPath);
    $stmt = $pdo->prepare('SELECT GET_LOCK(?, 8)');
    $stmt->execute([$lockName]);
    if ((int)$stmt->fetchColumn() !== 1) {
        throw new ConsentDocumentScopeException('This consent document is currently being processed. Please try again.');
    }
    if (!isset($GLOBALS['ipawcus_consent_document_locks']) || !is_array($GLOBALS['ipawcus_consent_document_locks'])) {
        $GLOBALS['ipawcus_consent_document_locks'] = [];
    }
    $GLOBALS['ipawcus_consent_document_locks'][$cacheKey] = $lockName;
}

function consent_record_document_references(PDO $pdo, string $path): array
{
    $normalizedPath = consent_record_normalize_document_path($path);
    if ($normalizedPath === null) return ['bookings' => [], 'records' => []];
    $pattern = '%' . basename($normalizedPath) . '%';
    $bookingStmt = $pdo->prepare("\n        SELECT booking_id, user_id, pet_id, signature_path, consent_forms\n        FROM bookings\n        WHERE signature_path LIKE ? OR consent_forms LIKE ?\n        FOR UPDATE\n    ");
    $bookingStmt->execute([$pattern, $pattern]);
    $bookings = [];
    foreach ($bookingStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $paths = [consent_record_normalize_document_path($row['signature_path'] ?? null)];
        foreach (consent_record_forms_from_value($row['consent_forms'] ?? null) as $form) {
            if (!is_array($form)) continue;
            $paths[] = consent_record_normalize_document_path(consent_record_form_signed_document_path($form));
            $paths[] = consent_record_normalize_document_path(consent_record_form_physical_document_path($form));
        }
        if (in_array($normalizedPath, array_filter($paths), true)) $bookings[] = $row;
    }

    $records = [];
    if (consent_record_table_exists_raw($pdo)) {
        $recordStmt = $pdo->prepare("\n            SELECT consent_record_id, owner_user_id, pet_id, booking_id, queue_id, visit_id,\n                   signed_file_path, physical_file_path\n            FROM consent_form_records\n            WHERE signed_file_path LIKE ? OR physical_file_path LIKE ?\n            FOR UPDATE\n        ");
        $recordStmt->execute([$pattern, $pattern]);
        foreach ($recordStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $signedPath = consent_record_normalize_document_path($row['signed_file_path'] ?? null);
            $physicalPath = consent_record_normalize_document_path($row['physical_file_path'] ?? null);
            if ($signedPath === $normalizedPath || $physicalPath === $normalizedPath) $records[] = $row;
        }
    }
    return ['bookings' => $bookings, 'records' => $records];
}

function consent_record_assert_document_scope(PDO $pdo, string $path, array $data): void
{
    consent_record_acquire_document_lock($pdo, $path);
    $references = consent_record_document_references($pdo, $path);
    $recordId = consent_record_nullable_int($data['consent_record_id'] ?? $data['consentRecordId'] ?? null);
    $bookingId = consent_record_nullable_int($data['booking_id'] ?? $data['bookingId'] ?? null);
    $queueId = consent_record_nullable_int($data['queue_id'] ?? $data['queueId'] ?? null);
    $visitId = consent_record_nullable_int($data['visit_id'] ?? $data['visitId'] ?? null);
    $ownerId = consent_record_nullable_int($data['owner_user_id'] ?? $data['ownerUserId'] ?? null);

    foreach ($references['bookings'] as $reference) {
        if ($bookingId === null || (int)$reference['booking_id'] !== $bookingId) {
            throw new ConsentDocumentScopeException('This consent document is already linked to another booking.');
        }
        if ($ownerId !== null && (int)($reference['user_id'] ?? 0) !== $ownerId) {
            throw new ConsentDocumentScopeException('This consent document does not match the booking owner.');
        }
    }
    foreach ($references['records'] as $reference) {
        if ($recordId !== null && (int)$reference['consent_record_id'] === $recordId) continue;
        $sameBooking = $bookingId !== null && (int)($reference['booking_id'] ?? 0) === $bookingId;
        $sameQueue = $queueId !== null && (int)($reference['queue_id'] ?? 0) === $queueId;
        $sameVisit = $visitId !== null && (int)($reference['visit_id'] ?? 0) === $visitId;
        if (!$sameBooking && !$sameQueue && !$sameVisit) {
            throw new ConsentDocumentScopeException('This consent document is already linked to another record.');
        }
        if ($ownerId !== null && (int)($reference['owner_user_id'] ?? 0) !== $ownerId) {
            throw new ConsentDocumentScopeException('This consent document does not match the record owner.');
        }
    }
}

function consent_record_status($value, ?string $signedFilePath = null, ?string $physicalFilePath = null): string
{
    $status = strtolower(trim((string)$value));
    $allowed = ['pending', 'signed', 'released', 'cancelled'];

    if (in_array($status, $allowed, true)) {
        return $status;
    }

    return ($signedFilePath || $physicalFilePath) ? 'signed' : 'pending';
}

function consent_record_source($value): string
{
    $source = strtolower(trim((string)$value));
    $allowed = ['booking', 'queue', 'vet_my_list', 'diagnosis', 'manual'];

    return in_array($source, $allowed, true) ? $source : 'manual';
}

function consent_record_file_id($value): ?int
{
    $fileId = consent_record_nullable_int($value);

    return $fileId !== null && $fileId > 0 ? $fileId : null;
}

function consent_record_find_existing(PDO $pdo, array $data): ?int
{
    $recordId = consent_record_nullable_int($data['consent_record_id'] ?? $data['consentRecordId'] ?? null);
    if ($recordId !== null && $recordId > 0) {
        return $recordId;
    }

    $consentFileId = consent_record_file_id($data['consent_file_id'] ?? $data['consentFileId'] ?? null);
    $consentType = consent_record_nullable_text($data['consent_type'] ?? $data['consentType'] ?? null);
    $petId = consent_record_nullable_int($data['pet_id'] ?? $data['petId'] ?? null);
    $bookingId = consent_record_nullable_int($data['booking_id'] ?? $data['bookingId'] ?? null);
    $queueId = consent_record_nullable_int($data['queue_id'] ?? $data['queueId'] ?? null);
    $visitId = consent_record_nullable_int($data['visit_id'] ?? $data['visitId'] ?? null);

    $identity = null;
    $identityValue = null;
    if ($bookingId !== null && $bookingId > 0) {
        $identity = 'booking_id';
        $identityValue = $bookingId;
    } elseif ($queueId !== null && $queueId > 0) {
        $identity = 'queue_id';
        $identityValue = $queueId;
    } elseif ($visitId !== null && $visitId > 0) {
        $identity = 'visit_id';
        $identityValue = $visitId;
    }

    if ($identity === null) {
        return null;
    }

    $where = ["{$identity} = ?"];
    $params = [$identityValue];
    if ($petId !== null && $petId > 0) {
        $where[] = 'pet_id = ?';
        $params[] = $petId;
    }
    if ($consentFileId !== null) {
        $where[] = 'consent_file_id = ?';
        $params[] = $consentFileId;
    } elseif ($consentType !== null) {
        $where[] = 'LOWER(consent_type) = LOWER(?)';
        $params[] = $consentType;
    }

    $stmt = $pdo->prepare("
        SELECT consent_record_id
        FROM consent_form_records
        WHERE " . implode(' AND ', $where) . "
        ORDER BY consent_record_id DESC
        LIMIT 1
    ");
    $stmt->execute($params);
    $existing = $stmt->fetchColumn();

    return $existing ? (int)$existing : null;
}

function consent_record_save(PDO $pdo, array $data, bool $requireTable = true): ?int
{
    if (!consent_record_table_exists($pdo)) {
        if ($requireTable) {
            throw new RuntimeException('Consent record table is missing. Run DDL/20260619_create_consent_form_records.sql first.');
        }

        return null;
    }

    $consentFileId = consent_record_file_id($data['consent_file_id'] ?? $data['consentFileId'] ?? null);
    $consentType = consent_record_nullable_text(
        $data['consent_type']
            ?? $data['consentType']
            ?? $data['file_name']
            ?? $data['fileName']
            ?? null
    );
    $signedFilePath = consent_record_nullable_text($data['signed_file_path'] ?? $data['signedFilePath'] ?? null);
    $physicalFilePath = consent_record_nullable_text($data['physical_file_path'] ?? $data['physicalFilePath'] ?? null);
    $status = consent_record_status($data['status'] ?? null, $signedFilePath, $physicalFilePath);
    $signedAt = consent_record_datetime_or_null($data['signed_at'] ?? $data['signedAt'] ?? null);
    $releasedAt = consent_record_datetime_or_null($data['released_at'] ?? $data['releasedAt'] ?? null);
    $requestedAt = consent_record_datetime_or_null($data['requested_at'] ?? $data['requestedAt'] ?? null) ?: date('Y-m-d H:i:s');

    if ($status === 'signed' && $signedAt === null) {
        $signedAt = date('Y-m-d H:i:s');
    }
    if ($status === 'released' && $releasedAt === null) {
        $releasedAt = date('Y-m-d H:i:s');
    }

    $payload = [
        'consent_file_id' => $consentFileId,
        'consent_type' => $consentType ?: 'Consent Form',
        'owner_user_id' => consent_record_nullable_int($data['owner_user_id'] ?? $data['ownerUserId'] ?? null),
        'pet_id' => consent_record_nullable_int($data['pet_id'] ?? $data['petId'] ?? null),
        'booking_id' => consent_record_nullable_int($data['booking_id'] ?? $data['bookingId'] ?? null),
        'queue_id' => consent_record_nullable_int($data['queue_id'] ?? $data['queueId'] ?? null),
        'visit_id' => consent_record_nullable_int($data['visit_id'] ?? $data['visitId'] ?? null),
        'service_name' => consent_record_nullable_text($data['service_name'] ?? $data['serviceName'] ?? null),
        'status' => $status,
        'source' => consent_record_source($data['source'] ?? null),
        'requested_at' => $requestedAt,
        'signed_at' => $signedAt,
        'released_at' => $releasedAt,
        'signed_file_path' => $signedFilePath,
        'physical_file_path' => $physicalFilePath,
        'signer_name' => consent_record_nullable_text($data['signer_name'] ?? $data['signerName'] ?? null),
        'processed_by_user_id' => consent_record_nullable_int($data['processed_by_user_id'] ?? $data['processedByUserId'] ?? null),
        'processed_by_name' => consent_record_nullable_text($data['processed_by_name'] ?? $data['processedByName'] ?? null),
        'notes' => consent_record_nullable_text($data['notes'] ?? null),
    ];

    foreach (array_filter([$signedFilePath, $physicalFilePath]) as $documentPath) {
        consent_record_assert_document_scope($pdo, $documentPath, array_merge($data, $payload));
    }

    $existingId = consent_record_find_existing($pdo, $data);
    if ($existingId !== null) {
        $fields = [];
        $values = [];
        foreach ($payload as $column => $value) {
            if ($value === null && !in_array($column, ['signed_at', 'released_at', 'signed_file_path', 'physical_file_path', 'notes'], true)) {
                continue;
            }
            $fields[] = "{$column} = ?";
            $values[] = $value;
        }
        $values[] = $existingId;

        $stmt = $pdo->prepare("UPDATE consent_form_records SET " . implode(', ', $fields) . " WHERE consent_record_id = ?");
        $stmt->execute($values);

        return $existingId;
    }

    $columns = array_keys($payload);
    $placeholders = implode(', ', array_fill(0, count($columns), '?'));
    $stmt = $pdo->prepare("
        INSERT INTO consent_form_records (" . implode(', ', $columns) . ")
        VALUES ({$placeholders})
    ");
    $stmt->execute(array_values($payload));

    return (int)$pdo->lastInsertId();
}

function consent_record_forms_from_value($forms): array
{
    if ($forms === null || $forms === '') {
        return [];
    }

    if (is_string($forms)) {
        $decoded = json_decode($forms, true);
        if (json_last_error() === JSON_ERROR_NONE) {
            $forms = $decoded;
        }
    }

    if (!is_array($forms)) {
        return [];
    }

    $isList = function_exists('array_is_list')
        ? array_is_list($forms)
        : array_keys($forms) === range(0, count($forms) - 1);

    if ($isList) {
        return $forms;
    }

    return [$forms];
}

function consent_record_form_path(array $form, array $keys): ?string
{
    foreach ($keys as $key) {
        $path = consent_record_nullable_text($form[$key] ?? null);
        if ($path !== null) {
            return $path;
        }
    }

    return null;
}

function consent_record_form_signed_document_path($form): ?string
{
    if (!is_array($form)) {
        return null;
    }

    return consent_record_form_path($form, [
        'documentPath',
        'document_path',
        'signedDocumentPath',
        'signed_document_path',
        'signedFilePath',
        'signed_file_path',
        'consentDocumentPath',
        'consent_document_path',
    ]);
}

function consent_record_form_physical_document_path($form): ?string
{
    if (!is_array($form)) {
        return null;
    }

    return consent_record_form_path($form, [
        'physicalConsentPath',
        'physical_consent_path',
        'physicalFilePath',
        'physical_file_path',
    ]);
}

function consent_record_form_legacy_signature_path($form): ?string
{
    if (!is_array($form)) {
        return null;
    }

    return consent_record_form_path($form, [
        'legacySignaturePath',
        'legacy_signature_path',
        'signaturePath',
        'signature_path',
        'signatureUrl',
        'signature_url',
    ]);
}

function consent_record_demote_signature_only_paths(array $forms): array
{
    foreach ($forms as &$form) {
        if (!is_array($form)) {
            $form = [];
            continue;
        }

        $legacySignaturePath = consent_record_form_legacy_signature_path($form);
        $signedDocumentPath = consent_record_form_signed_document_path($form);
        if (
            $legacySignaturePath !== null
            && ($signedDocumentPath === null || $legacySignaturePath !== $signedDocumentPath)
        ) {
            $form['legacySignaturePath'] = $legacySignaturePath;
        }

        unset(
            $form['signaturePath'],
            $form['signature_path'],
            $form['signatureUrl'],
            $form['signature_url']
        );
    }
    unset($form);

    return $forms;
}

function consent_record_first_signed_document_path($forms): ?string
{
    foreach (consent_record_forms_from_value($forms) as $form) {
        $path = consent_record_form_signed_document_path($form);
        if ($path !== null) {
            return $path;
        }
    }

    return null;
}

function consent_record_first_physical_document_path($forms): ?string
{
    foreach (consent_record_forms_from_value($forms) as $form) {
        $path = consent_record_form_physical_document_path($form);
        if ($path !== null) {
            return $path;
        }
    }

    return null;
}

function consent_record_first_legacy_signature_path($forms): ?string
{
    foreach (consent_record_forms_from_value($forms) as $form) {
        $path = consent_record_form_legacy_signature_path($form);
        if ($path !== null) {
            return $path;
        }
    }

    return null;
}

function consent_record_normalize_booking_forms(
    $forms,
    ?string $signedDocumentPath = null,
    ?string $physicalDocumentPath = null
): array {
    $normalized = [];
    foreach (consent_record_forms_from_value($forms) as $form) {
        $normalized[] = is_array($form) ? $form : [];
    }

    if (empty($normalized) && ($signedDocumentPath !== null || $physicalDocumentPath !== null)) {
        $normalized[] = [
            'id' => null,
            'title' => 'Booking Consent',
        ];
    }

    // A booking-level artifact can only be assigned safely when it represents
    // the sole consent form. Multiple forms must each provide their own path.
    if (count($normalized) === 1) {
        if (
            $signedDocumentPath !== null
            && consent_record_form_signed_document_path($normalized[0]) === null
        ) {
            $normalized[0]['documentPath'] = $signedDocumentPath;
        }

        if (
            $physicalDocumentPath !== null
            && consent_record_form_physical_document_path($normalized[0]) === null
        ) {
            $normalized[0]['physicalConsentPath'] = $physicalDocumentPath;
        }
    }

    return consent_record_demote_signature_only_paths($normalized);
}

function consent_record_forms_for_response($forms): array
{
    $normalized = [];
    foreach (consent_record_forms_from_value($forms) as $form) {
        if (!is_array($form)) {
            continue;
        }

        $signedDocumentPath = consent_record_form_signed_document_path($form);
        $physicalDocumentPath = consent_record_form_physical_document_path($form);
        if ($signedDocumentPath !== null) {
            $form['documentPath'] = $signedDocumentPath;
        }
        if ($physicalDocumentPath !== null) {
            $form['physicalConsentPath'] = $physicalDocumentPath;
        }

        $normalized[] = $form;
    }

    return consent_record_demote_signature_only_paths($normalized);
}

function consent_record_queue_response_row(array $row): array
{
    $signedDocumentPath = consent_record_nullable_text($row['signed_file_path'] ?? null);
    $physicalDocumentPath = consent_record_nullable_text($row['physical_file_path'] ?? null);

    return [
        'consent_record_id' => consent_record_nullable_int($row['consent_record_id'] ?? null),
        'consent_file_id' => consent_record_file_id($row['consent_file_id'] ?? null),
        'consent_type' => consent_record_nullable_text($row['consent_type'] ?? null),
        'owner_user_id' => consent_record_nullable_int($row['owner_user_id'] ?? null),
        'pet_id' => consent_record_nullable_int($row['pet_id'] ?? null),
        'booking_id' => consent_record_nullable_int($row['booking_id'] ?? null),
        'queue_id' => consent_record_nullable_int($row['queue_id'] ?? null),
        'visit_id' => consent_record_nullable_int($row['visit_id'] ?? null),
        'service_name' => consent_record_nullable_text($row['service_name'] ?? null),
        'status' => consent_record_nullable_text($row['status'] ?? null) ?: 'pending',
        'source' => consent_record_nullable_text($row['source'] ?? null) ?: 'manual',
        'requested_at' => $row['requested_at'] ?? null,
        'signed_at' => $row['signed_at'] ?? null,
        'released_at' => $row['released_at'] ?? null,
        'signed_file_path' => $signedDocumentPath,
        'physical_file_path' => $physicalDocumentPath,
        'signed_consent_document_path' => $signedDocumentPath,
        'physical_consent_path' => $physicalDocumentPath,
        'signer_name' => consent_record_nullable_text($row['signer_name'] ?? null),
        'processed_by_user_id' => consent_record_nullable_int($row['processed_by_user_id'] ?? null),
        'processed_by_name' => consent_record_nullable_text($row['processed_by_name'] ?? null),
        'notes' => consent_record_nullable_text($row['notes'] ?? null),
        'created_at' => $row['created_at'] ?? null,
        'updated_at' => $row['updated_at'] ?? null,
    ];
}

function consent_record_fetch_queue_records(PDO $pdo, array $queueIds): array
{
    $normalizedQueueIds = array_values(array_unique(array_filter(
        array_map('consent_record_nullable_int', $queueIds),
        static fn($queueId) => $queueId !== null && $queueId > 0
    )));
    if (empty($normalizedQueueIds) || !consent_record_table_exists($pdo)) {
        return [];
    }

    $placeholders = implode(', ', array_fill(0, count($normalizedQueueIds), '?'));
    $stmt = $pdo->prepare("
        SELECT
            consent_record_id,
            consent_file_id,
            consent_type,
            owner_user_id,
            pet_id,
            booking_id,
            queue_id,
            visit_id,
            service_name,
            status,
            source,
            requested_at,
            signed_at,
            released_at,
            signed_file_path,
            physical_file_path,
            signer_name,
            processed_by_user_id,
            processed_by_name,
            notes,
            created_at,
            updated_at
        FROM consent_form_records
        WHERE queue_id IN ({$placeholders})
        ORDER BY queue_id ASC, consent_record_id DESC
    ");
    $stmt->execute($normalizedQueueIds);

    $recordsByQueue = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $queueId = consent_record_nullable_int($row['queue_id'] ?? null);
        if ($queueId === null || $queueId <= 0) {
            continue;
        }

        $recordsByQueue[$queueId][] = consent_record_queue_response_row($row);
    }

    return $recordsByQueue;
}

function consent_record_queue_compatibility_fields(array $records): array
{
    $primaryRecord = null;
    $signedDocumentPath = null;
    $physicalDocumentPath = null;

    foreach ($records as $record) {
        if (!is_array($record)) {
            continue;
        }

        $recordSignedPath = consent_record_nullable_text(
            $record['signed_consent_document_path']
                ?? $record['signed_file_path']
                ?? null
        );
        $recordPhysicalPath = consent_record_nullable_text(
            $record['physical_consent_path']
                ?? $record['physical_file_path']
                ?? null
        );
        if ($primaryRecord === null && ($recordSignedPath !== null || $recordPhysicalPath !== null)) {
            $primaryRecord = $record;
        }
        if ($signedDocumentPath === null && $recordSignedPath !== null) {
            $signedDocumentPath = $recordSignedPath;
        }
        if ($physicalDocumentPath === null && $recordPhysicalPath !== null) {
            $physicalDocumentPath = $recordPhysicalPath;
        }
    }

    $primaryRecord = $primaryRecord ?: ($records[0] ?? []);

    return [
        'signed_consent_record_id' => consent_record_nullable_int($primaryRecord['consent_record_id'] ?? null),
        'signed_consent_type' => consent_record_nullable_text($primaryRecord['consent_type'] ?? null),
        'signed_consent_document_path' => $signedDocumentPath,
        'physical_consent_path' => $physicalDocumentPath,
        'signed_consent_at' => $primaryRecord['signed_at'] ?? null,
    ];
}

function consent_record_capture_booking(PDO $pdo, array $data): void
{
    if (!consent_record_table_exists($pdo)) {
        return;
    }

    $bookingId = consent_record_nullable_int($data['booking_id'] ?? null);
    if ($bookingId === null || $bookingId <= 0) {
        return;
    }

    $defaultSignedDocumentPath = consent_record_nullable_text(
        $data['signed_document_path']
            ?? $data['signedDocumentPath']
            ?? $data['consent_document_path']
            ?? $data['consentDocumentPath']
            ?? null
    );
    $defaultPhysicalDocumentPath = consent_record_nullable_text(
        $data['physical_file_path']
            ?? $data['physicalFilePath']
            ?? $data['physical_consent_path']
            ?? $data['physicalConsentPath']
            ?? null
    );
    $forms = consent_record_normalize_booking_forms(
        $data['consent_forms'] ?? null,
        $defaultSignedDocumentPath,
        $defaultPhysicalDocumentPath
    );
    if (empty($forms)) {
        return;
    }

    $petIds = $data['pet_ids'] ?? [];
    if (!is_array($petIds) || empty($petIds)) {
        $petIds = [consent_record_nullable_int($data['pet_id'] ?? null)];
    }
    $petIds = array_values(array_filter(array_map('consent_record_nullable_int', $petIds)));
    if (empty($petIds)) {
        $petIds = [null];
    }

    if (empty($forms)) {
        $forms = [[
            'id' => null,
            'title' => 'Booking Consent',
        ]];
    }

    foreach ($petIds as $petId) {
        foreach ($forms as $form) {
            $form = is_array($form) ? $form : [];
            $formId = $form['id'] ?? $form['file_id'] ?? $form['fileId'] ?? null;
            $title = $form['title'] ?? $form['file_name'] ?? $form['fileName'] ?? $form['name'] ?? 'Booking Consent';
            $signedDocumentPath = consent_record_form_signed_document_path($form);
            $physicalDocumentPath = consent_record_form_physical_document_path($form);
            $hasCompleteConsent = $signedDocumentPath !== null || $physicalDocumentPath !== null;

            try {
                consent_record_save($pdo, [
                    'consent_file_id' => $formId,
                    'consent_type' => $title,
                    'owner_user_id' => $data['owner_user_id'] ?? null,
                    'pet_id' => $petId,
                    'booking_id' => $bookingId,
                    'service_name' => $data['service_name'] ?? null,
                    'status' => $hasCompleteConsent ? 'signed' : 'pending',
                    'source' => 'booking',
                    'signed_file_path' => $signedDocumentPath,
                    'physical_file_path' => $physicalDocumentPath,
                    'signed_at' => $hasCompleteConsent
                        ? ($form['signedAt'] ?? $form['signed_at'] ?? date('Y-m-d H:i:s'))
                        : null,
                    'signer_name' => $form['signerName'] ?? $form['signer_name'] ?? null,
                    'notes' => $data['notes'] ?? 'Captured during booking creation.',
                ], false);
            } catch (ConsentDocumentScopeException $e) {
                throw $e;
            } catch (Throwable $e) {
                error_log('Consent booking capture failed: ' . $e->getMessage());
            }
        }
    }
}

function consent_record_capture_queue(PDO $pdo, array $data): void
{
    if (!consent_record_table_exists($pdo)) {
        return;
    }

    $queueId = consent_record_nullable_int($data['queue_id'] ?? null);
    $signaturePath = consent_record_nullable_text($data['signed_file_path'] ?? null);
    if ($queueId === null || $queueId <= 0 || $signaturePath === null) {
        return;
    }

    try {
        consent_record_save($pdo, [
            'consent_file_id' => $data['consent_file_id'] ?? $data['consentFileId'] ?? null,
            'consent_type' => $data['consent_type'] ?? (($data['service_name'] ?? 'Service') . ' Consent'),
            'owner_user_id' => $data['owner_user_id'] ?? null,
            'pet_id' => $data['pet_id'] ?? null,
            'queue_id' => $queueId,
            'service_name' => $data['service_name'] ?? null,
            'status' => 'signed',
            'source' => 'queue',
            'signed_file_path' => $signaturePath,
            'signed_at' => $data['signed_at'] ?? $data['signedAt'] ?? date('Y-m-d H:i:s'),
            'signer_name' => $data['signer_name'] ?? $data['signerName'] ?? null,
            'notes' => $data['notes'] ?? 'Captured during queue creation.',
        ], false);
    } catch (Throwable $e) {
        error_log('Consent queue capture failed: ' . $e->getMessage());
    }
}
