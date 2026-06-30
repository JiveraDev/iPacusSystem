<?php

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

function consent_record_ensure_table(PDO $pdo): bool
{
    if (consent_record_table_exists_raw($pdo)) {
        return true;
    }

    try {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS consent_form_records (
              consent_record_id int(11) NOT NULL AUTO_INCREMENT,
              consent_file_id int(11) DEFAULT NULL,
              consent_type varchar(180) DEFAULT NULL,
              owner_user_id int(11) DEFAULT NULL,
              pet_id int(11) DEFAULT NULL,
              booking_id int(11) DEFAULT NULL,
              queue_id int(11) DEFAULT NULL,
              visit_id int(11) DEFAULT NULL,
              service_name varchar(180) DEFAULT NULL,
              status enum('pending','signed','released','cancelled') NOT NULL DEFAULT 'pending',
              source enum('booking','queue','vet_my_list','diagnosis','manual') NOT NULL DEFAULT 'manual',
              requested_at datetime NOT NULL DEFAULT current_timestamp(),
              signed_at datetime DEFAULT NULL,
              released_at datetime DEFAULT NULL,
              signed_file_path varchar(500) DEFAULT NULL,
              physical_file_path varchar(500) DEFAULT NULL,
              signer_name varchar(180) DEFAULT NULL,
              processed_by_user_id int(11) DEFAULT NULL,
              processed_by_name varchar(180) DEFAULT NULL,
              notes text DEFAULT NULL,
              created_at timestamp NOT NULL DEFAULT current_timestamp(),
              updated_at timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
              PRIMARY KEY (consent_record_id),
              KEY consent_records_file_idx (consent_file_id),
              KEY consent_records_owner_idx (owner_user_id),
              KEY consent_records_pet_idx (pet_id),
              KEY consent_records_booking_idx (booking_id),
              KEY consent_records_queue_idx (queue_id),
              KEY consent_records_visit_idx (visit_id),
              KEY consent_records_status_idx (status, created_at),
              KEY consent_records_requested_idx (requested_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
        ");
    } catch (Throwable $e) {
        error_log('Consent record table creation failed: ' . $e->getMessage());
        return false;
    }

    return consent_record_table_exists_raw($pdo);
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

function consent_record_capture_booking(PDO $pdo, array $data): void
{
    if (!consent_record_table_exists($pdo)) {
        return;
    }

    $bookingId = consent_record_nullable_int($data['booking_id'] ?? null);
    if ($bookingId === null || $bookingId <= 0) {
        return;
    }

    $signaturePath = consent_record_nullable_text($data['signature_path'] ?? null);
    $forms = consent_record_forms_from_value($data['consent_forms'] ?? null);
    if (empty($forms) && $signaturePath === null) {
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

            try {
                consent_record_save($pdo, [
                    'consent_file_id' => $formId,
                    'consent_type' => $title,
                    'owner_user_id' => $data['owner_user_id'] ?? null,
                    'pet_id' => $petId,
                    'booking_id' => $bookingId,
                    'service_name' => $data['service_name'] ?? null,
                    'status' => $signaturePath ? 'signed' : ($data['status'] ?? 'pending'),
                    'source' => 'booking',
                    'signed_file_path' => $signaturePath,
                    'signed_at' => $signaturePath ? date('Y-m-d H:i:s') : null,
                    'notes' => $data['notes'] ?? 'Captured during booking creation.',
                ], false);
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
