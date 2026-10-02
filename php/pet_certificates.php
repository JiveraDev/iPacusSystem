<?php

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/workflow_guard_helpers.php';
require_once __DIR__ . '/notification_helpers.php';

header('Content-Type: application/json');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

function pet_certificate_input(): array
{
    return json_decode(file_get_contents('php://input'), true) ?: [];
}

function pet_certificate_error(int $status, string $message, array $extra = []): void
{
    global $pdo;

    if ($pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    http_response_code($status);
    echo json_encode(array_merge([
        'success' => false,
        'message' => $message,
    ], $extra));
    exit;
}

function pet_certificate_resolve_pet(PDO $pdo, $rawPetId): array
{
    $petId = trim((string)$rawPetId);
    if ($petId === '') {
        pet_certificate_error(400, 'Pet ID is required.');
    }

    $column = str_starts_with($petId, 'PET-') ? 'pet_sharable_ID' : 'pet_id';
    if ($column === 'pet_id' && !ctype_digit($petId)) {
        pet_certificate_error(400, 'Pet ID is invalid.');
    }

    $stmt = $pdo->prepare("SELECT * FROM pets_information WHERE {$column} = ? LIMIT 1");
    $stmt->execute([$petId]);
    $pet = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$pet) {
        pet_certificate_error(404, 'Pet was not found.');
    }

    return $pet;
}

function pet_certificate_owner(PDO $pdo, int $petId, array $pet): array
{
    $hasRelationship = ipawcus_guard_column_exists($pdo, 'pet_ownership', 'relationship');
    $hasPrimary = ipawcus_guard_column_exists($pdo, 'pet_ownership', 'is_primary');
    $primaryOrder = $hasPrimary ? 'CASE WHEN po.is_primary = 1 THEN 0 ELSE 1 END,' : '';
    $relationshipOrder = $hasRelationship
        ? "CASE WHEN po.relationship = 'primary' THEN 0 ELSE 1 END,"
        : '';

    $stmt = $pdo->prepare("
        SELECT u.user_id, u.first_Name, u.last_Name, u.mail_Address
        FROM pet_ownership po
        JOIN users u ON u.user_id = po.user_id
        WHERE po.pet_id = ?
        ORDER BY {$primaryOrder} {$relationshipOrder} po.link_id ASC
        LIMIT 1
    ");
    $stmt->execute([$petId]);
    $owner = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];
    $ownerName = trim((string)($owner['first_Name'] ?? '') . ' ' . (string)($owner['last_Name'] ?? ''));

    return [
        'userId' => isset($owner['user_id']) ? (int)$owner['user_id'] : null,
        'name' => $ownerName !== '' ? $ownerName : ((string)($pet['pet_Temp_owner'] ?? '') ?: 'Pet owner'),
        'email' => $owner['mail_Address'] ?? '',
    ];
}

function pet_certificate_clinic(PDO $pdo, ?int $branchId = null): array
{
    $clinic = [
        'name' => 'VFC Pharmacy / Main Clinic',
        'address' => 'Lucena City, Quezon, Philippines',
        'phoneNumber' => '',
    ];

    if (!ipawcus_guard_table_exists($pdo, 'branches')) {
        return $clinic;
    }

    $stmt = $branchId
        ? $pdo->prepare("
            SELECT branch_name, address, phone_number
            FROM branches
            WHERE branch_id = ?
            LIMIT 1
        ")
        : $pdo->prepare("
            SELECT branch_name, address, phone_number
            FROM branches
            WHERE status = 'active'
            ORDER BY is_main DESC, branch_id ASC
            LIMIT 1
        ");
    $stmt->execute($branchId ? [$branchId] : []);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($row) {
        $clinic = [
            'name' => $row['branch_name'] ?: $clinic['name'],
            'address' => $row['address'] ?: $clinic['address'],
            'phoneNumber' => $row['phone_number'] ?? '',
        ];
    }

    return $clinic;
}

function pet_certificate_pet_payload(array $pet): array
{
    return [
        'id' => (int)$pet['pet_id'],
        'publicId' => $pet['pet_sharable_ID'] ?? '',
        'name' => $pet['pet_name'] ?? 'Pet',
        'species' => $pet['pet_species'] ?? '',
        'breed' => $pet['pet_breed'] ?? '',
        'birthDate' => $pet['pet_BDAY'] ?? null,
        'age' => $pet['pet_age'] ?? null,
        'gender' => $pet['pet_gender'] ?? '',
        'weight' => $pet['pet_weight'] ?? null,
        'colorMarking' => $pet['pet_color_marking'] ?? '',
        'microchipId' => $pet['pet_microchip'] ?? '',
        'status' => $pet['pet_status'] ?? '',
    ];
}

function pet_certificate_registration(PDO $pdo, array $pet, array $owner): array
{
    $publicId = trim((string)($pet['pet_sharable_ID'] ?? ''));

    return [
        'type' => 'registration',
        'certificateNumber' => $publicId !== '' ? $publicId : str_pad((string)$pet['pet_id'], 6, '0', STR_PAD_LEFT),
        'title' => 'Certificate of Clinic Registration',
        'generatedAt' => date('Y-m-d'),
        'hasExpiration' => false,
        'status' => 'registered',
        'statement' => 'This certificate confirms that the pet named below has an active patient record registered with the clinic. It is proof of clinic registration only and is not a statement of present health, fitness for travel, vaccination status, or freedom from disease.',
        'pet' => pet_certificate_pet_payload($pet),
        'owner' => $owner,
        'clinic' => pet_certificate_clinic($pdo),
    ];
}

function pet_certificate_effective_status(array $row): string
{
    $status = strtolower(trim((string)($row['status'] ?? 'active')));
    if ($status === 'active' && (string)($row['valid_until'] ?? '') < date('Y-m-d')) {
        return 'expired';
    }

    return $status;
}

function pet_certificate_medical_payload(PDO $pdo, array $row, array $pet, array $owner, bool $ownerView): array
{
    $vetName = trim((string)($row['vet_first_name'] ?? '') . ' ' . (string)($row['vet_last_name'] ?? ''));

    return [
        'type' => 'medical',
        'id' => (int)$row['certificate_id'],
        'certificateId' => (int)$row['certificate_id'],
        'certificateNumber' => $row['certificate_number'],
        'title' => 'Veterinary Medical Certificate',
        'requestId' => isset($row['request_id']) ? (int)$row['request_id'] : null,
        'source' => !empty($row['request_id']) ? 'record_update_request' : 'direct_medical_editor',
        'examinationDate' => $row['examination_date'],
        'validUntil' => $row['valid_until'],
        'clinicalFindings' => $row['clinical_findings'] ?? '',
        'statement' => $row['certification_statement'] ?? '',
        'signaturePath' => $row['signature_path'] ?? '',
        'status' => pet_certificate_effective_status($row),
        'isNew' => $ownerView && empty($row['owner_viewed_at']),
        'createdAt' => $row['created_at'] ?? null,
        'pet' => pet_certificate_pet_payload($pet),
        'owner' => $owner,
        'veterinarian' => [
            'userId' => (int)$row['veterinarian_user_id'],
            'name' => $vetName !== '' ? $vetName : 'Clinic veterinarian',
            'licenseNumber' => $row['prc_license_number'] ?? '',
        ],
        'clinic' => pet_certificate_clinic(
            $pdo,
            isset($row['branch_id']) && $row['branch_id'] !== null ? (int)$row['branch_id'] : null
        ),
    ];
}

function pet_certificate_fetch_latest(PDO $pdo, int $petId): ?array
{
    if (!ipawcus_guard_table_exists($pdo, 'pet_medical_certificates')) {
        return null;
    }

    $hasVetProfiles = ipawcus_guard_table_exists($pdo, 'veterinarian_profiles');
    $profileJoin = $hasVetProfiles
        ? 'LEFT JOIN veterinarian_profiles vp ON vp.user_id = c.veterinarian_user_id'
        : '';
    $licenseSelect = $hasVetProfiles ? 'vp.prc_license_number' : 'NULL AS prc_license_number';
    $stmt = $pdo->prepare("
        SELECT
            c.*,
            u.first_Name AS vet_first_name,
            u.last_Name AS vet_last_name,
            {$licenseSelect}
        FROM pet_medical_certificates c
        JOIN users u ON u.user_id = c.veterinarian_user_id
        {$profileJoin}
        WHERE c.pet_id = ?
          AND c.status <> 'revoked'
        ORDER BY
            CASE WHEN c.status = 'active' THEN 0 ELSE 1 END,
            c.certificate_id DESC
        LIMIT 1
    ");
    $stmt->execute([$petId]);

    return $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
}

function pet_certificate_parse_date($value, string $label): DateTimeImmutable
{
    $text = trim((string)$value);
    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $text);
    $errors = DateTimeImmutable::getLastErrors();
    if (!$date || ($errors !== false && ($errors['warning_count'] > 0 || $errors['error_count'] > 0))) {
        pet_certificate_error(422, "{$label} must be a valid date.");
    }

    return $date;
}

function pet_certificate_number(PDO $pdo): string
{
    do {
        $number = 'MED-' . date('Ymd') . '-' . strtoupper(substr(bin2hex(random_bytes(3)), 0, 6));
        $stmt = $pdo->prepare('SELECT COUNT(*) FROM pet_medical_certificates WHERE certificate_number = ?');
        $stmt->execute([$number]);
    } while ((int)$stmt->fetchColumn() > 0);

    return $number;
}

try {
    $pdo = ipawcus_get_pdo();
    $currentUser = ipawcus_guard_current_user($pdo);
    $currentRole = ipawcus_guard_role($currentUser);
    $currentUserId = ipawcus_guard_user_id($currentUser);
    $pet = pet_certificate_resolve_pet($pdo, $_GET['petId'] ?? null);
    $petId = (int)$pet['pet_id'];

    if ($currentRole === 'pet_owner' && !ipawcus_guard_pet_access($pdo, $petId, $currentUserId)) {
        pet_certificate_error(403, 'You are not allowed to view certificates for this pet.');
    }
    if ($currentRole !== 'pet_owner' && !ipawcus_guard_is_clinic_role($currentRole)) {
        pet_certificate_error(403, 'You are not allowed to view pet certificates.');
    }

    $owner = pet_certificate_owner($pdo, $petId, $pet);
    $schemaReady = ipawcus_guard_table_exists($pdo, 'pet_medical_certificates');

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $latest = pet_certificate_fetch_latest($pdo, $petId);
        echo json_encode([
            'success' => true,
            'schemaReady' => $schemaReady,
            'registrationCertificate' => pet_certificate_registration($pdo, $pet, $owner),
            'medicalCertificate' => $latest
                ? pet_certificate_medical_payload($pdo, $latest, $pet, $owner, $currentRole === 'pet_owner')
                : null,
        ]);
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        pet_certificate_error(405, 'Method not allowed.');
    }

    $input = pet_certificate_input();
    $action = strtolower(trim((string)($input['action'] ?? '')));

    if ($action === 'mark_viewed') {
        if ($currentRole !== 'pet_owner') {
            pet_certificate_error(403, 'Only a pet owner can mark a certificate as viewed.');
        }
        if (!$schemaReady) {
            pet_certificate_error(409, 'Medical certificate storage is not installed yet.');
        }

        $certificateId = (int)($input['certificateId'] ?? $input['certificate_id'] ?? 0);
        $stmt = $pdo->prepare("
            UPDATE pet_medical_certificates
            SET owner_viewed_at = COALESCE(owner_viewed_at, NOW())
            WHERE certificate_id = ?
              AND pet_id = ?
        ");
        $stmt->execute([$certificateId, $petId]);
        if ($stmt->rowCount() === 0) {
            $check = $pdo->prepare('SELECT COUNT(*) FROM pet_medical_certificates WHERE certificate_id = ? AND pet_id = ?');
            $check->execute([$certificateId, $petId]);
            if ((int)$check->fetchColumn() === 0) {
                pet_certificate_error(404, 'Medical certificate was not found.');
            }
        }

        echo json_encode(['success' => true]);
        exit;
    }

    if ($action !== 'issue') {
        pet_certificate_error(422, 'Invalid certificate action.');
    }
    if ($currentRole !== 'veterinarian') {
        pet_certificate_error(403, 'Only a veterinarian can issue a medical certificate.');
    }
    if (!$schemaReady) {
        pet_certificate_error(409, 'Run DDL/20261002_03_pet_certificates.sql before issuing a medical certificate.');
    }

    $requestId = (int)($input['requestId'] ?? $input['request_id'] ?? 0);
    $linkedRequestId = null;
    if ($requestId > 0) {
        if (!ipawcus_guard_table_exists($pdo, 'pet_record_update_requests')) {
            pet_certificate_error(409, 'The linked medical-record request is unavailable.');
        }

        $requestStmt = $pdo->prepare("
            SELECT request_id, pet_id, assigned_veterinarian_user_id, status
            FROM pet_record_update_requests
            WHERE request_id = ?
            LIMIT 1
        ");
        $requestStmt->execute([$requestId]);
        $request = $requestStmt->fetch(PDO::FETCH_ASSOC);
        if (!$request || (int)$request['pet_id'] !== $petId) {
            pet_certificate_error(404, 'The medical-record request does not match this pet.');
        }
        if ((int)$request['assigned_veterinarian_user_id'] !== $currentUserId) {
            pet_certificate_error(403, 'Only the veterinarian assigned to this request can link the certificate to it.');
        }
        if (!in_array((string)$request['status'], ['assigned', 'in_progress'], true)) {
            pet_certificate_error(409, 'The linked request must be assigned or in progress before a medical certificate can be issued.');
        }
        $linkedRequestId = $requestId;
    }

    $examinationDate = pet_certificate_parse_date($input['examinationDate'] ?? null, 'Examination date');
    $validUntil = pet_certificate_parse_date($input['validUntil'] ?? null, 'Valid-until date');
    $today = new DateTimeImmutable('today');
    if ($examinationDate > $today) {
        pet_certificate_error(422, 'Examination date cannot be in the future.');
    }
    $validityDays = (int)$examinationDate->diff($validUntil)->format('%r%a');
    if ($validityDays < 1 || $validityDays > 30) {
        pet_certificate_error(422, 'Medical certificate validity must be between 1 and 30 days after the examination date.');
    }

    $clinicalFindings = trim((string)($input['clinicalFindings'] ?? ''));
    $statement = trim((string)($input['certificationStatement'] ?? $input['statement'] ?? ''));
    $signaturePath = trim((string)($input['signaturePath'] ?? ''));
    if ($clinicalFindings === '') {
        pet_certificate_error(422, 'Clinical findings are required.');
    }
    if ($statement === '') {
        pet_certificate_error(422, 'The medical certification statement is required.');
    }
    if (mb_strlen($clinicalFindings) > 5000 || mb_strlen($statement) > 5000) {
        pet_certificate_error(422, 'Certificate notes must be 5,000 characters or fewer.');
    }
    if (!preg_match('#^diagnosis/[A-Za-z0-9._-]+$#', $signaturePath)) {
        pet_certificate_error(422, 'A valid veterinarian signature is required.');
    }

    $pdo->beginTransaction();
    $lockStmt = $pdo->prepare('SELECT pet_id FROM pets_information WHERE pet_id = ? FOR UPDATE');
    $lockStmt->execute([$petId]);
    $supersedeStmt = $pdo->prepare("
        UPDATE pet_medical_certificates
        SET status = 'superseded'
        WHERE pet_id = ?
          AND status = 'active'
    ");
    $supersedeStmt->execute([$petId]);

    $certificateNumber = pet_certificate_number($pdo);
    $insertStmt = $pdo->prepare("
        INSERT INTO pet_medical_certificates (
            certificate_number,
            pet_id,
            request_id,
            veterinarian_user_id,
            branch_id,
            examination_date,
            valid_until,
            clinical_findings,
            certification_statement,
            signature_path,
            status
        ) VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, 'active')
    ");
    $insertStmt->execute([
        $certificateNumber,
        $petId,
        $linkedRequestId,
        $currentUserId,
        $examinationDate->format('Y-m-d'),
        $validUntil->format('Y-m-d'),
        $clinicalFindings,
        $statement,
        $signaturePath,
    ]);
    $certificateId = (int)$pdo->lastInsertId();
    $pdo->commit();

    $issued = pet_certificate_fetch_latest($pdo, $petId);
    if (!$issued || (int)$issued['certificate_id'] !== $certificateId) {
        throw new RuntimeException('The issued medical certificate could not be reloaded.');
    }

    $ownerUserId = (int)($owner['userId'] ?? 0);
    if ($ownerUserId > 0) {
        try {
            $petName = trim((string)($pet['pet_name'] ?? 'Pet')) ?: 'Pet';
            notification_create_event($pdo, [
                'user_id' => $ownerUserId,
                'type' => 'medical_certificate_issued',
                'category' => 'diagnosis_updates',
                'title' => 'Medical certificate available',
                'message' => "A veterinarian issued a medical certificate for {$petName}. Open the pet profile to review or print it.",
                'push_title' => 'Medical certificate available',
                'push_message' => "{$petName}'s medical certificate is ready to review.",
                'redirect_path' => notification_pet_redirect_path($petId),
                'dedupe_key' => "medical-certificate-issued-{$certificateId}-owner-{$ownerUserId}",
                'force_in_app' => true,
            ]);
        } catch (Throwable $notificationError) {
            error_log('Medical certificate owner notification failed: ' . $notificationError->getMessage());
        }
    }

    echo json_encode([
        'success' => true,
        'medicalCertificate' => pet_certificate_medical_payload($pdo, $issued, $pet, $owner, false),
    ]);
} catch (Throwable $error) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    error_log('Pet certificate request failed: ' . $error->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'The pet certificate request could not be completed. Please try again.',
    ]);
}
