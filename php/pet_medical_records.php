<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/mail_helpers.php';
require_once __DIR__ . '/notification_helpers.php';
require_once __DIR__ . '/reference_number_helpers.php';
require_once __DIR__ . '/workflow_guard_helpers.php';

header('Content-Type: application/json');

function pet_medical_input(): array
{
    return json_decode(file_get_contents('php://input'), true) ?: [];
}

function pet_medical_error(int $statusCode, string $message): void
{
    http_response_code($statusCode);
    echo json_encode(['success' => false, 'message' => $message]);
    exit;
}

function pet_medical_table_exists(PDO $pdo, string $tableName): bool
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

function pet_medical_column_exists(PDO $pdo, string $tableName, string $columnName): bool
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

function pet_medical_decode_json($value)
{
    if ($value === null || $value === '') {
        return null;
    }

    $decoded = json_decode((string)$value, true);

    return json_last_error() === JSON_ERROR_NONE ? $decoded : null;
}

function pet_medical_json($value): ?string
{
    if ($value === null) {
        return null;
    }

    $encoded = json_encode($value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

    return $encoded === false ? null : $encoded;
}

function pet_medical_nullable_int($value): ?int
{
    if ($value === null || $value === '') {
        return null;
    }

    return is_numeric($value) ? (int)$value : null;
}

function pet_medical_nullable_text($value): ?string
{
    $text = trim((string)($value ?? ''));

    return $text === '' ? null : $text;
}

function pet_medical_compare_value($value): string
{
    if ($value === null) {
        return '';
    }

    if (is_bool($value)) {
        return $value ? '1' : '0';
    }

    return trim((string)$value);
}

function pet_medical_changed_fields(array $current, array $next): array
{
    $changed = [];

    foreach ($next as $field => $nextValue) {
        $currentValue = $current[$field] ?? null;
        if (pet_medical_compare_value($currentValue) !== pet_medical_compare_value($nextValue)) {
            $changed[$field] = $nextValue;
        }
    }

    return $changed;
}

function pet_medical_notify_owner_record_updated(
    PDO $pdo,
    int $petId,
    string $scope,
    int $recordId,
    string $recordTitle
): void {
    try {
        $pet = pet_medical_pet_summary($pdo, $petId);
        $ownerUserId = (int)($pet['ownerUserId'] ?? 0);
        if ($ownerUserId <= 0) {
            return;
        }

        $petName = trim((string)($pet['name'] ?? 'Pet')) ?: 'Pet';
        $cleanTitle = trim($recordTitle) ?: 'Medical record';
        $bucket = (int)floor(time() / 600);

        notification_create_event($pdo, [
            'user_id' => $ownerUserId,
            'type' => 'medical_record_updated',
            'category' => 'diagnosis_updates',
            'title' => 'Medical record updated',
            'message' => "{$petName}'s medical record was updated: {$cleanTitle}.",
            'push_title' => 'Medical record updated',
            'push_message' => "{$petName}'s medical record was updated.",
            'redirect_path' => '/dashboard/my-pets/' . (int)$pet['dbId'] . '/medical-records',
            'dedupe_key' => "medical-record-updated-{$petId}-{$scope}-{$recordId}-{$bucket}",
            'force_in_app' => true,
        ]);
    } catch (Throwable $error) {
        error_log('Medical record owner notification failed: ' . $error->getMessage());
    }
}

function pet_medical_ensure_schema(PDO $pdo): void
{
    if (!pet_medical_table_exists($pdo, 'pet_medical_record_groups') || !pet_medical_table_exists($pdo, 'pet_medical_record_group_items')) {
        pet_medical_error(409, 'Medical record organization tables are missing. No runtime schema changes were attempted.');
    }
}

function pet_medical_resolve_pet_id(PDO $pdo, $petId): int
{
    $rawPetId = trim((string)$petId);
    if ($rawPetId === '') {
        pet_medical_error(400, 'Pet ID is required.');
    }

    if (strpos($rawPetId, 'PET-') === 0) {
        $stmt = $pdo->prepare("SELECT pet_id FROM pets_information WHERE pet_sharable_ID = ? LIMIT 1");
        $stmt->execute([$rawPetId]);
        $resolvedId = $stmt->fetchColumn();

        if (!$resolvedId) {
            pet_medical_error(404, 'Pet not found.');
        }

        return (int)$resolvedId;
    }

    if (!is_numeric($rawPetId)) {
        pet_medical_error(400, 'Pet ID is invalid.');
    }

    $stmt = $pdo->prepare("SELECT pet_id FROM pets_information WHERE pet_id = ? LIMIT 1");
    $stmt->execute([(int)$rawPetId]);
    $resolvedId = $stmt->fetchColumn();

    if (!$resolvedId) {
        pet_medical_error(404, 'Pet not found.');
    }

    return (int)$resolvedId;
}

function pet_medical_pet_summary(PDO $pdo, int $petId): array
{
    $stmt = $pdo->prepare("
        SELECT
            p.*,
            po.user_id AS owner_user_id,
            u.mail_Address AS owner_email,
            CONCAT(u.first_Name, ' ', u.last_Name) AS owner_name
        FROM pets_information p
        LEFT JOIN pet_ownership po ON po.pet_id = p.pet_id
        LEFT JOIN users u ON u.user_id = po.user_id
        WHERE p.pet_id = ?
        ORDER BY po.link_id DESC
        LIMIT 1
    ");
    $stmt->execute([$petId]);
    $pet = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$pet) {
        pet_medical_error(404, 'Pet not found.');
    }

    return [
        'id' => $pet['pet_sharable_ID'],
        'dbId' => (int)$pet['pet_id'],
        'db_id' => (int)$pet['pet_id'],
        'name' => $pet['pet_name'],
        'petName' => $pet['pet_name'],
        'species' => $pet['pet_species'],
        'breed' => $pet['pet_breed'],
        'birthDate' => $pet['pet_BDAY'],
        'gender' => $pet['pet_gender'],
        'status' => $pet['pet_status'],
        'age' => $pet['pet_age'],
        'weight' => $pet['pet_weight'],
        'color' => $pet['pet_color_marking'],
        'microchipId' => $pet['pet_microchip'],
        'ownerName' => trim((string)($pet['owner_name'] ?: $pet['pet_Temp_owner'])),
        'ownerUserId' => $pet['owner_user_id'] !== null ? (int)$pet['owner_user_id'] : null,
        'ownerEmail' => $pet['owner_email'] ?? '',
        'profileImage' => $pet['setpetImage_url'],
        'allergiesRaw' => $pet['pet_allergies'],
    ];
}

function pet_medical_fetch_vaccinations(PDO $pdo, int $petId): array
{
    if (!pet_medical_table_exists($pdo, 'pet_vaccinations')) {
        return [];
    }

    $hasLicense = pet_medical_column_exists($pdo, 'pet_vaccinations', 'vax_veterinarian_license');
    $hasNotes = pet_medical_column_exists($pdo, 'pet_vaccinations', 'vax_notes');
    $hasVetUserId = pet_medical_column_exists($pdo, 'pet_vaccinations', 'vax_veterinarian_user_id');
    $hasSourceDiagnosis = pet_medical_column_exists($pdo, 'pet_vaccinations', 'source_diagnosis_id');

    $stmt = $pdo->prepare("
        SELECT
            vax_id AS id,
            vax_name AS name,
            vax_date AS date,
            vax_next_due AS nextDue,
            vax_applicator AS applicator,
            " . ($hasLicense ? 'vax_veterinarian_license' : 'NULL') . " AS veterinarianLicense,
            " . ($hasNotes ? 'vax_notes' : 'NULL') . " AS notes,
            " . ($hasVetUserId ? 'vax_veterinarian_user_id' : 'NULL') . " AS veterinarianUserId,
            " . ($hasSourceDiagnosis ? 'source_diagnosis_id' : 'NULL') . " AS sourceDiagnosisId,
            vax_status AS status
        FROM pet_vaccinations
        WHERE pet_id = ?
        ORDER BY vax_date DESC, vax_id DESC
    ");
    $stmt->execute([$petId]);

    $sourceGroups = pet_medical_source_group_map($pdo, $petId);

    return array_map(function ($row) use ($sourceGroups) {
        $id = (int)$row['id'];
        $addedToGroups = $sourceGroups['vaccination:' . $id] ?? [];

        return [
            'id' => $id,
            'sourceType' => 'vaccination',
            'sourceId' => $id,
            'name' => $row['name'],
            'date' => $row['date'],
            'nextDue' => $row['nextDue'],
            'applicator' => $row['applicator'],
            'veterinarianName' => $row['applicator'],
            'veterinarianLicense' => $row['veterinarianLicense'],
            'notes' => $row['notes'],
            'veterinarianUserId' => $row['veterinarianUserId'] !== null ? (int)$row['veterinarianUserId'] : null,
            'sourceDiagnosisId' => $row['sourceDiagnosisId'] !== null ? (int)$row['sourceDiagnosisId'] : null,
            'status' => $row['status'] ?: 'completed',
            'addedToGroups' => $addedToGroups,
            'isAddedToOrganizedRecord' => !empty($addedToGroups),
        ];
    }, $stmt->fetchAll(PDO::FETCH_ASSOC));
}

function pet_medical_vaccination_record_summary(array $vaccine): string
{
    $lines = [
        'Vaccine: ' . ($vaccine['name'] ?? 'N/A'),
        'Date given: ' . pet_medical_format_date_label($vaccine['date'] ?? ''),
        'Next due: ' . pet_medical_format_date_label($vaccine['nextDue'] ?? ''),
        'Veterinarian: ' . (($vaccine['applicator'] ?? '') ?: ($vaccine['veterinarianName'] ?? 'N/A')),
    ];

    if (!empty($vaccine['notes'])) {
        $lines[] = 'Notes: ' . $vaccine['notes'];
    }

    return implode("\n", $lines);
}

function pet_medical_vaccination_group_record(array $vaccine): array
{
    $summary = pet_medical_vaccination_record_summary($vaccine);

    return [
        'id' => 'vaccination-' . (int)$vaccine['id'],
        'sourceType' => 'vaccination',
        'sourceId' => (int)$vaccine['id'],
        'vaccinationId' => (int)$vaccine['id'],
        'title' => ($vaccine['name'] ?? '') ?: 'Vaccination record',
        'serviceName' => 'Vaccination',
        'serviceDate' => ($vaccine['date'] ?? '') ?: ($vaccine['nextDue'] ?? null),
        'status' => ($vaccine['status'] ?? '') ?: 'completed',
        'billingStatus' => null,
        'veterinarianName' => ($vaccine['applicator'] ?? '') ?: ($vaccine['veterinarianName'] ?? ''),
        'chiefComplaint' => '',
        'majorSymptoms' => '',
        'symptoms' => '',
        'physicalExam' => '',
        'diagnosis' => 'Vaccination record',
        'treatment' => ($vaccine['name'] ?? '') ?: 'Vaccination',
        'labResults' => '',
        'followUp' => $vaccine['nextDue'] ?? '',
        'notes' => $vaccine['notes'] ?? '',
        'summary' => $summary,
        'vitalSigns' => [],
        'prescriptions' => [],
        'customSections' => [
            [
                'label' => 'Vaccination Details',
                'value' => $summary,
            ],
        ],
        'attachments' => [],
        'sourceUploads' => [],
        'charges' => [],
        'totals' => ['charges' => 0, 'paid' => 0, 'balance' => 0],
        'addedToGroups' => $vaccine['addedToGroups'] ?? [],
        'isAddedToOrganizedRecord' => !empty($vaccine['addedToGroups'] ?? []),
    ];
}

function pet_medical_fetch_allergies(PDO $pdo, int $petId, array $pet): array
{
    $allergies = [];

    if (pet_medical_table_exists($pdo, 'pet_allergies')) {
        $stmt = $pdo->prepare("SELECT allergy_id AS id, allergen, severity FROM pet_allergies WHERE pet_id = ? ORDER BY allergy_id DESC");
        $stmt->execute([$petId]);
        $allergies = array_map(function ($row) {
            return [
                'id' => (int)$row['id'],
                'allergen' => $row['allergen'],
                'severity' => $row['severity'] ?: 'Known',
            ];
        }, $stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    if (!$allergies && !empty($pet['allergiesRaw'])) {
        $allergies[] = ['allergen' => $pet['allergiesRaw'], 'severity' => 'Known'];
    }

    return $allergies;
}

function pet_medical_normalize_attachments($value): array
{
    $items = is_array($value) ? $value : [];
    $normalized = [];

    foreach ($items as $index => $attachment) {
        if (!is_array($attachment)) {
            continue;
        }

        $url = trim((string)($attachment['url'] ?? $attachment['relativeUrl'] ?? $attachment['preview'] ?? ''));
        $normalized[] = [
            'id' => $attachment['id'] ?? ('attachment-' . $index),
            'name' => $attachment['name'] ?? basename(parse_url($url, PHP_URL_PATH) ?: 'Attachment'),
            'url' => $url,
            'relativeUrl' => trim((string)($attachment['relativeUrl'] ?? $url)),
            'mimeType' => $attachment['mimeType'] ?? $attachment['type'] ?? '',
            'category' => $attachment['category'] ?? $attachment['attachmentCategory'] ?? 'diagnosis_upload',
            'uploadedAt' => $attachment['uploadedAt'] ?? null,
        ];
    }

    return $normalized;
}

function pet_medical_diagnosis_summary(array $record): string
{
    $parts = [];

    foreach (['diagnosis', 'treatment', 'notes'] as $key) {
        $value = trim((string)($record[$key] ?? ''));
        if ($value !== '') {
            $parts[] = $value;
        }
    }

    $customSections = $record['customSections'] ?? [];
    if (!$parts && is_array($customSections)) {
        foreach ($customSections as $section) {
            if (!is_array($section)) {
                continue;
            }
            $label = trim((string)($section['label'] ?? ''));
            $value = trim((string)($section['value'] ?? $section['notes'] ?? $section['majorSymptoms'] ?? ''));
            if ($label !== '' || $value !== '') {
                $parts[] = trim($label . ': ' . $value, ': ');
            }
        }
    }

    return trim(implode("\n\n", array_filter($parts))) ?: 'Clinical service completed.';
}

function pet_medical_fetch_visit_charges(PDO $pdo, array $visitIds): array
{
    if (!$visitIds || !pet_medical_table_exists($pdo, 'visit_charges')) {
        return [];
    }

    $placeholders = implode(',', array_fill(0, count($visitIds), '?'));
    $stmt = $pdo->prepare("
        SELECT
            vc.*,
            sc.service_name,
            ii.item_name
        FROM visit_charges vc
        LEFT JOIN service_catalog sc ON sc.service_id = vc.service_id
        LEFT JOIN inventory_items ii ON ii.item_id = vc.item_id
        WHERE vc.visit_id IN ({$placeholders})
        ORDER BY vc.visit_id ASC, vc.charge_id ASC
    ");
    $stmt->execute($visitIds);

    $chargesByVisit = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $charge) {
        $visitId = (int)$charge['visit_id'];
        $chargesByVisit[$visitId][] = [
            'chargeId' => (int)$charge['charge_id'],
            'chargeType' => $charge['charge_type'],
            'serviceId' => $charge['service_id'] !== null ? (int)$charge['service_id'] : null,
            'serviceName' => $charge['service_name'] ?? '',
            'itemId' => $charge['item_id'] !== null ? (int)$charge['item_id'] : null,
            'itemName' => $charge['item_name'] ?? '',
            'description' => $charge['description'],
            'quantity' => (float)$charge['quantity'],
            'unitPrice' => (float)$charge['unit_price'],
            'subtotal' => (float)$charge['subtotal'],
        ];
    }

    return $chargesByVisit;
}

function pet_medical_fetch_visit_paid_totals(PDO $pdo, array $visitIds): array
{
    if (!$visitIds || !pet_medical_table_exists($pdo, 'visit_payments')) {
        return [];
    }

    $placeholders = implode(',', array_fill(0, count($visitIds), '?'));
    $stmt = $pdo->prepare("
        SELECT visit_id, COALESCE(SUM(amount), 0) AS total_paid
        FROM visit_payments
        WHERE visit_id IN ({$placeholders})
          AND payment_status = 'verified'
        GROUP BY visit_id
    ");
    $stmt->execute($visitIds);

    $totals = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $totals[(int)$row['visit_id']] = (float)$row['total_paid'];
    }

    return $totals;
}

function pet_medical_fetch_boarding_documents(PDO $pdo, array $bookingIds, int $petId): array
{
    if (!$bookingIds || !pet_medical_table_exists($pdo, 'boarding_documents')) {
        return [];
    }

    $placeholders = implode(',', array_fill(0, count($bookingIds), '?'));
    $params = array_merge($bookingIds, [$petId]);
    $stmt = $pdo->prepare("
        SELECT *
        FROM boarding_documents
        WHERE booking_id IN ({$placeholders})
          AND (pet_id IS NULL OR pet_id = ?)
        ORDER BY created_at DESC, document_id DESC
    ");
    $stmt->execute($params);

    $documentsByBooking = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $document) {
        $bookingId = (int)$document['booking_id'];
        $path = trim((string)$document['document_path']);
        $documentsByBooking[$bookingId][] = [
            'id' => (int)$document['document_id'],
            'name' => $document['title'] ?: ($document['file_name'] ?: 'Boarding document'),
            'url' => '/' . ltrim($path, '/'),
            'relativeUrl' => ltrim($path, '/'),
            'mimeType' => $document['mime_type'] ?? '',
            'category' => 'boarding_document',
            'documentType' => $document['document_type'],
            'notes' => $document['notes'] ?? '',
            'uploadedAt' => $document['created_at'],
        ];
    }

    return $documentsByBooking;
}

function pet_medical_fetch_boarding_activity(PDO $pdo, array $bookingIds, int $petId): array
{
    $activity = [];
    foreach ($bookingIds as $bookingId) {
        $activity[(int)$bookingId] = [
            'observations' => [],
            'tasks' => [],
        ];
    }

    if (!$bookingIds) {
        return $activity;
    }

    $placeholders = implode(',', array_fill(0, count($bookingIds), '?'));

    if (pet_medical_table_exists($pdo, 'boarding_observations')) {
        $params = array_merge($bookingIds, [$petId]);
        $stmt = $pdo->prepare("
            SELECT *
            FROM boarding_observations
            WHERE booking_id IN ({$placeholders})
              AND (pet_id IS NULL OR pet_id = ?)
            ORDER BY observed_at DESC, observation_id DESC
            LIMIT 200
        ");
        $stmt->execute($params);
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $observation) {
            $bookingId = (int)$observation['booking_id'];
            $activity[$bookingId]['observations'][] = [
                'observationId' => (int)$observation['observation_id'],
                'type' => $observation['observation_type'],
                'notes' => $observation['notes'],
                'observedAt' => $observation['observed_at'],
            ];
        }
    }

    if (pet_medical_table_exists($pdo, 'boarding_tasks')) {
        $params = array_merge($bookingIds, [$petId]);
        $stmt = $pdo->prepare("
            SELECT *
            FROM boarding_tasks
            WHERE booking_id IN ({$placeholders})
              AND (pet_id IS NULL OR pet_id = ?)
            ORDER BY COALESCE(completed_at, due_at) DESC, task_id DESC
            LIMIT 200
        ");
        $stmt->execute($params);
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $task) {
            $bookingId = (int)$task['booking_id'];
            $activity[$bookingId]['tasks'][] = [
                'taskId' => (int)$task['task_id'],
                'type' => $task['task_type'],
                'status' => $task['status'],
                'dueAt' => $task['due_at'],
                'completedAt' => $task['completed_at'],
                'notes' => $task['notes'] ?? '',
            ];
        }
    }

    return $activity;
}

function pet_medical_fetch_boarding_history(PDO $pdo, int $petId): array
{
    if (!pet_medical_table_exists($pdo, 'bookings') || !pet_medical_table_exists($pdo, 'boarding_assignments')) {
        return [];
    }

    $hasBookingPets = pet_medical_table_exists($pdo, 'booking_pets');
    $bookingPetJoin = $hasBookingPets
        ? 'LEFT JOIN booking_pets bp ON bp.booking_id = b.booking_id AND bp.pet_id = ?'
        : '';
    $petJoin = $hasBookingPets
        ? 'JOIN pets_information psel ON psel.pet_id = COALESCE(bp.pet_id, b.pet_id)'
        : 'JOIN pets_information psel ON psel.pet_id = b.pet_id';
    $petWhere = $hasBookingPets ? '(b.pet_id = ? OR bp.pet_id = ?)' : 'b.pet_id = ?';
    $params = $hasBookingPets ? [$petId, $petId, $petId] : [$petId];

    $stmt = $pdo->prepare("
        SELECT
            b.booking_id,
            b.booking_number,
            b.user_id,
            b.pet_id,
            b.status,
            b.price,
            b.notes,
            b.payment_proof_url,
            b.hotel_boarding_type,
            b.room_size,
            b.check_in_date,
            b.check_out_date,
            b.add_ons,
            b.emergency_contact,
            b.created_at,
            ba.assignment_id,
            ba.room_type,
            ba.room_number,
            ba.status AS assignment_status,
            ba.actual_check_in_at,
            ba.actual_check_out_at,
            ba.desired_check_out_date,
            ba.notes AS assignment_notes,
            psel.pet_name,
            psel.pet_species,
            psel.pet_breed,
            CONCAT(u.first_Name, ' ', u.last_Name) AS owner_name
        FROM bookings b
        {$bookingPetJoin}
        {$petJoin}
        LEFT JOIN boarding_assignments ba ON ba.assignment_id = (
            SELECT ba2.assignment_id
            FROM boarding_assignments ba2
            WHERE ba2.booking_id = b.booking_id
            ORDER BY ba2.assignment_id DESC
            LIMIT 1
        )
        LEFT JOIN users u ON u.user_id = b.user_id
        WHERE b.service_type = 'boarding'
          AND b.status = 'completed'
          AND {$petWhere}
        ORDER BY COALESCE(ba.actual_check_out_at, b.check_out_date, b.created_at) DESC, b.booking_id DESC
    ");
    $stmt->execute($params);
    $bookings = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $bookingIds = array_map(fn($booking) => (int)$booking['booking_id'], $bookings);
    $documentsByBooking = pet_medical_fetch_boarding_documents($pdo, $bookingIds, $petId);
    $activityByBooking = pet_medical_fetch_boarding_activity($pdo, $bookingIds, $petId);

    $records = [];
    foreach ($bookings as $booking) {
        $bookingId = (int)$booking['booking_id'];
        $facility = $booking['hotel_boarding_type'] === 'hotel' ? 'Pet Hotel Boarding' : 'Kennel Boarding';
        $roomLabel = trim((string)($booking['room_type'] ?? ''));
        if (!empty($booking['room_number'])) {
            $roomLabel .= ' #' . $booking['room_number'];
        }
        $activity = $activityByBooking[$bookingId] ?? ['observations' => [], 'tasks' => []];
        $tasks = $activity['tasks'];
        $completedTasks = array_values(array_filter($tasks, fn($task) => ($task['status'] ?? '') === 'completed'));
        $observations = $activity['observations'];
        $summaryParts = [
            'Stay: ' . trim(($booking['check_in_date'] ?: 'N/A') . ' to ' . ($booking['check_out_date'] ?: 'N/A')),
            $roomLabel ? 'Room/Kennel: ' . $roomLabel : '',
            count($tasks) > 0 ? 'Care tasks completed: ' . count($completedTasks) . ' of ' . count($tasks) : '',
            count($observations) > 0 ? 'Monitoring notes: ' . count($observations) : '',
            trim((string)($booking['assignment_notes'] ?: $booking['notes'] ?: '')),
        ];

        $records[] = [
            'id' => 'boarding-' . $bookingId,
            'sourceType' => 'boarding',
            'sourceId' => $bookingId,
            'bookingId' => $bookingId,
            'bookingNumber' => $booking['booking_number'] ?? null,
            'title' => $facility,
            'serviceName' => $facility,
            'serviceDate' => $booking['actual_check_out_at'] ?: $booking['check_out_date'] ?: $booking['created_at'],
            'status' => $booking['assignment_status'] ?: $booking['status'],
            'billingStatus' => !empty($booking['payment_proof_url']) ? 'submitted' : null,
            'veterinarianName' => '',
            'chiefComplaint' => $facility,
            'majorSymptoms' => '',
            'symptoms' => '',
            'physicalExam' => '',
            'diagnosis' => '',
            'treatment' => implode("\n", array_filter([
                $roomLabel ? 'Boarding location: ' . $roomLabel : '',
                count($completedTasks) > 0 ? 'Completed care tasks: ' . implode(', ', array_slice(array_map(fn($task) => $task['type'], $completedTasks), 0, 6)) : '',
            ])),
            'labResults' => '',
            'followUp' => '',
            'notes' => implode("\n\n", array_filter(array_map(fn($observation) => trim(($observation['type'] ?? 'Observation') . ': ' . ($observation['notes'] ?? '')), array_slice($observations, 0, 5)))),
            'vitalSigns' => [],
            'prescriptions' => [],
            'customSections' => [
                [
                    'label' => $facility . ' Summary',
                    'value' => implode("\n", array_filter($summaryParts)),
                ],
            ],
            'attachments' => $documentsByBooking[$bookingId] ?? [],
            'sourceUploads' => [],
            'charges' => [[
                'chargeType' => 'boarding',
                'description' => $facility,
                'quantity' => 1,
                'unitPrice' => (float)($booking['price'] ?? 0),
                'subtotal' => (float)($booking['price'] ?? 0),
            ]],
            'totals' => [
                'charges' => (float)($booking['price'] ?? 0),
                'paid' => 0,
                'balance' => 0,
            ],
            'boarding' => [
                'facility' => $booking['hotel_boarding_type'],
                'roomSize' => $booking['room_size'],
                'roomLabel' => $roomLabel,
                'checkInDate' => $booking['check_in_date'],
                'checkOutDate' => $booking['check_out_date'],
                'actualCheckInAt' => $booking['actual_check_in_at'],
                'actualCheckOutAt' => $booking['actual_check_out_at'],
                'observations' => $observations,
                'tasks' => $tasks,
            ],
        ];
    }

    return $records;
}

function pet_medical_source_group_map(PDO $pdo, int $petId): array
{
    pet_medical_ensure_schema($pdo);

    $stmt = $pdo->prepare("
        SELECT
            i.source_type,
            i.source_id,
            g.group_id,
            g.title
        FROM pet_medical_record_group_items i
        JOIN pet_medical_record_groups g ON g.group_id = i.group_id
        WHERE g.pet_id = ?
          AND i.source_id IS NOT NULL
    ");
    $stmt->execute([$petId]);

    $map = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $key = $row['source_type'] . ':' . (int)$row['source_id'];
        $map[$key][] = [
            'groupId' => (int)$row['group_id'],
            'title' => $row['title'],
        ];
    }

    return $map;
}

function pet_medical_fetch_service_history(PDO $pdo, int $petId): array
{
    $records = [];
    $diagnosisIdsFromVisits = [];

    if (pet_medical_table_exists($pdo, 'visits')) {
        $stmt = $pdo->prepare("
            SELECT
                v.*,
                vd.diagnosis_id,
                vd.diagnosis_type,
                vd.service_name AS diagnosis_service_name,
                vd.chief_complaint,
                vd.major_symptoms,
                vd.symptoms,
                vd.physical_exam,
                vd.diagnosis,
                vd.treatment,
                vd.lab_results,
                vd.follow_up_date,
                vd.notes,
                vd.vital_signs,
                vd.prescriptions,
                vd.custom_sections,
                vd.attachments,
                vd.source_uploads,
                vd.finalized_at,
                q.queue_number,
                q.timestamp AS queue_timestamp,
                b.booking_number,
                CONCAT(vet.first_Name, ' ', vet.last_Name) AS visit_veterinarian_name
            FROM visits v
            LEFT JOIN vet_diagnoses vd ON vd.diagnosis_id = v.diagnosis_id
            LEFT JOIN queues q ON q.queue_id = v.queue_id
            LEFT JOIN bookings b ON b.booking_id = v.booking_id
            LEFT JOIN users vet ON vet.user_id = v.veterinarian_user_id
            WHERE v.pet_id = ?
              AND (
                v.billing_status IN ('paid', 'partial', 'unpaid')
                OR v.visit_status IN ('treatment_done', 'completed')
              )
            ORDER BY COALESCE(vd.finalized_at, v.updated_at, v.created_at) DESC, v.visit_id DESC
        ");
        $stmt->execute([$petId]);
        $visits = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $visitIds = array_map(fn($visit) => (int)$visit['visit_id'], $visits);
        $chargesByVisit = pet_medical_fetch_visit_charges($pdo, $visitIds);
        $paidByVisit = pet_medical_fetch_visit_paid_totals($pdo, $visitIds);

        foreach ($visits as $visit) {
            $visitId = (int)$visit['visit_id'];
            $diagnosisId = !empty($visit['diagnosis_id']) ? (int)$visit['diagnosis_id'] : null;
            if ($diagnosisId !== null) {
                $diagnosisIdsFromVisits[] = $diagnosisId;
            }

            $charges = $chargesByVisit[$visitId] ?? [];
            $total = array_reduce($charges, fn($sum, $charge) => $sum + (float)$charge['subtotal'], 0.0);
            $paid = $paidByVisit[$visitId] ?? 0.0;
            $customSections = pet_medical_decode_json($visit['custom_sections'] ?? null) ?: [];
            $record = [
                'id' => 'visit-' . $visitId,
                'sourceType' => 'visit',
                'sourceId' => $visitId,
                'visitId' => $visitId,
                'diagnosisId' => $diagnosisId,
                'queueId' => $visit['queue_id'] !== null ? (int)$visit['queue_id'] : null,
                'queueNumber' => $visit['queue_number'] !== null ? (int)$visit['queue_number'] : null,
                'queueReference' => $visit['queue_number'] !== null ? ipawcus_format_queue_reference($visit['queue_number'], $visit['queue_timestamp'] ?? null) : '',
                'bookingId' => $visit['booking_id'] !== null ? (int)$visit['booking_id'] : null,
                'bookingNumber' => $visit['booking_number'] ?? null,
                'title' => $visit['diagnosis_service_name'] ?: ($charges[0]['description'] ?? 'Clinic visit'),
                'serviceName' => $visit['diagnosis_service_name'] ?: ($charges[0]['serviceName'] ?? ''),
                'serviceDate' => $visit['finalized_at'] ?: $visit['updated_at'] ?: $visit['created_at'],
                'status' => $visit['visit_status'],
                'billingStatus' => $visit['billing_status'],
                'veterinarianName' => trim((string)($visit['visit_veterinarian_name'] ?? '')),
                'chiefComplaint' => $visit['chief_complaint'] ?? '',
                'majorSymptoms' => $visit['major_symptoms'] ?? '',
                'symptoms' => $visit['symptoms'] ?? '',
                'physicalExam' => $visit['physical_exam'] ?? '',
                'diagnosis' => $visit['diagnosis'] ?? '',
                'treatment' => $visit['treatment'] ?? '',
                'labResults' => $visit['lab_results'] ?? '',
                'followUp' => $visit['follow_up_date'] ?? '',
                'notes' => $visit['notes'] ?? '',
                'vitalSigns' => pet_medical_decode_json($visit['vital_signs'] ?? null) ?: [],
                'prescriptions' => pet_medical_decode_json($visit['prescriptions'] ?? null) ?: [],
                'customSections' => $customSections,
                'attachments' => pet_medical_normalize_attachments(pet_medical_decode_json($visit['attachments'] ?? null) ?: []),
                'sourceUploads' => pet_medical_normalize_attachments(pet_medical_decode_json($visit['source_uploads'] ?? null) ?: []),
                'charges' => $charges,
                'totals' => [
                    'charges' => round($total, 2),
                    'paid' => round($paid, 2),
                    'balance' => round(max(0, $total - $paid), 2),
                ],
            ];
            $record['summary'] = pet_medical_diagnosis_summary($record);
            $records[] = $record;
        }
    }

    if (pet_medical_table_exists($pdo, 'vet_diagnoses')) {
        $params = [$petId];
        $excludeSql = '';
        $diagnosisIdsFromVisits = array_values(array_unique(array_filter($diagnosisIdsFromVisits)));

        if ($diagnosisIdsFromVisits) {
            $excludeSql = 'AND vd.diagnosis_id NOT IN (' . implode(',', array_fill(0, count($diagnosisIdsFromVisits), '?')) . ')';
            $params = array_merge($params, $diagnosisIdsFromVisits);
        }

        $stmt = $pdo->prepare("
            SELECT
                vd.*,
                q.queue_number,
                q.timestamp AS queue_timestamp,
                b.booking_number
            FROM vet_diagnoses vd
            LEFT JOIN queues q ON q.queue_id = vd.queue_id
            LEFT JOIN bookings b ON b.booking_id = vd.booking_id
            WHERE vd.pet_id = ?
              {$excludeSql}
            ORDER BY vd.finalized_at DESC, vd.created_at DESC, vd.diagnosis_id DESC
        ");
        $stmt->execute($params);

        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $diagnosis) {
            $diagnosisId = (int)$diagnosis['diagnosis_id'];
            $record = [
                'id' => 'diagnosis-' . $diagnosisId,
                'sourceType' => 'diagnosis',
                'sourceId' => $diagnosisId,
                'diagnosisId' => $diagnosisId,
                'queueId' => $diagnosis['queue_id'] !== null ? (int)$diagnosis['queue_id'] : null,
                'queueNumber' => $diagnosis['queue_number'] !== null ? (int)$diagnosis['queue_number'] : null,
                'queueReference' => $diagnosis['queue_number'] !== null ? ipawcus_format_queue_reference($diagnosis['queue_number'], $diagnosis['queue_timestamp'] ?? null) : '',
                'bookingId' => $diagnosis['booking_id'] !== null ? (int)$diagnosis['booking_id'] : null,
                'bookingNumber' => $diagnosis['booking_number'] ?? null,
                'title' => $diagnosis['service_name'] ?: 'Diagnosis record',
                'serviceName' => $diagnosis['service_name'] ?: '',
                'serviceDate' => $diagnosis['finalized_at'] ?: $diagnosis['created_at'],
                'status' => 'completed',
                'billingStatus' => null,
                'veterinarianName' => $diagnosis['veterinarian_name'] ?? '',
                'chiefComplaint' => $diagnosis['chief_complaint'] ?? '',
                'majorSymptoms' => $diagnosis['major_symptoms'] ?? '',
                'symptoms' => $diagnosis['symptoms'] ?? '',
                'physicalExam' => $diagnosis['physical_exam'] ?? '',
                'diagnosis' => $diagnosis['diagnosis'] ?? '',
                'treatment' => $diagnosis['treatment'] ?? '',
                'labResults' => $diagnosis['lab_results'] ?? '',
                'followUp' => $diagnosis['follow_up_date'] ?? '',
                'notes' => $diagnosis['notes'] ?? '',
                'vitalSigns' => pet_medical_decode_json($diagnosis['vital_signs'] ?? null) ?: [],
                'prescriptions' => pet_medical_decode_json($diagnosis['prescriptions'] ?? null) ?: [],
                'customSections' => pet_medical_decode_json($diagnosis['custom_sections'] ?? null) ?: [],
                'attachments' => pet_medical_normalize_attachments(pet_medical_decode_json($diagnosis['attachments'] ?? null) ?: []),
                'sourceUploads' => pet_medical_normalize_attachments(pet_medical_decode_json($diagnosis['source_uploads'] ?? null) ?: []),
                'charges' => [],
                'totals' => ['charges' => 0, 'paid' => 0, 'balance' => 0],
            ];
            $record['summary'] = pet_medical_diagnosis_summary($record);
            $records[] = $record;
        }
    }

    $records = array_merge($records, pet_medical_fetch_boarding_history($pdo, $petId));

    $sourceGroups = pet_medical_source_group_map($pdo, $petId);
    foreach ($records as &$record) {
        $key = $record['sourceType'] . ':' . $record['sourceId'];
        $record['addedToGroups'] = $sourceGroups[$key] ?? [];
        $record['isAddedToOrganizedRecord'] = !empty($record['addedToGroups']);
    }
    unset($record);

    usort($records, fn($left, $right) => strtotime((string)$right['serviceDate']) <=> strtotime((string)$left['serviceDate']));

    return $records;
}

function pet_medical_fetch_prescription_documents(PDO $pdo, int $petId): array
{
    if (!pet_medical_table_exists($pdo, 'vet_diagnoses') || !pet_medical_column_exists($pdo, 'vet_diagnoses', 'attachments')) {
        return [];
    }

    $stmt = $pdo->prepare("
        SELECT diagnosis_id, veterinarian_name, attachments, finalized_at, created_at
        FROM vet_diagnoses
        WHERE pet_id = ?
        ORDER BY finalized_at DESC, created_at DESC, diagnosis_id DESC
    ");
    $stmt->execute([$petId]);
    $documents = [];

    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        foreach (pet_medical_normalize_attachments(pet_medical_decode_json($row['attachments'] ?? null) ?: []) as $attachment) {
            if (($attachment['category'] ?? '') !== 'prescription_document') {
                continue;
            }

            $documents[] = [
                'id' => $attachment['id'] ?? ('prescription-' . $row['diagnosis_id']),
                'diagnosisId' => (int)$row['diagnosis_id'],
                'name' => $attachment['name'] ?? 'Prescription document',
                'url' => $attachment['url'] ?? $attachment['relativeUrl'] ?? '',
                'relativeUrl' => $attachment['relativeUrl'] ?? $attachment['url'] ?? '',
                'mimeType' => $attachment['mimeType'] ?? 'image/png',
                'veterinarianName' => $row['veterinarian_name'] ?? '',
                'createdAt' => $attachment['uploadedAt'] ?? $row['finalized_at'] ?? $row['created_at'],
            ];
        }
    }

    return $documents;
}

function pet_medical_fetch_groups(PDO $pdo, int $petId, bool $ownerVisibleOnly = false): array
{
    pet_medical_ensure_schema($pdo);

    $whereVisible = $ownerVisibleOnly ? 'AND visible_to_owner = 1' : '';
    $stmt = $pdo->prepare("
        SELECT
            g.*,
            CONCAT(created_by.first_Name, ' ', created_by.last_Name) AS created_by_name,
            CONCAT(updated_by.first_Name, ' ', updated_by.last_Name) AS updated_by_name
        FROM pet_medical_record_groups g
        LEFT JOIN users created_by ON created_by.user_id = g.created_by_user_id
        LEFT JOIN users updated_by ON updated_by.user_id = g.updated_by_user_id
        WHERE g.pet_id = ?
          {$whereVisible}
        ORDER BY g.sort_order ASC, g.updated_at DESC, g.group_id DESC
    ");
    $stmt->execute([$petId]);
    $groups = [];
    $groupIds = [];

    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $group) {
        $groupId = (int)$group['group_id'];
        $groupIds[] = $groupId;
        $groups[$groupId] = [
            'groupId' => $groupId,
            'id' => $groupId,
            'petId' => (int)$group['pet_id'],
            'title' => $group['title'],
            'summary' => $group['summary'] ?? '',
            'visibleToOwner' => (int)$group['visible_to_owner'] === 1,
            'sortOrder' => (int)$group['sort_order'],
            'createdByUserId' => $group['created_by_user_id'] !== null ? (int)$group['created_by_user_id'] : null,
            'updatedByUserId' => $group['updated_by_user_id'] !== null ? (int)$group['updated_by_user_id'] : null,
            'createdByName' => trim((string)($group['created_by_name'] ?? '')),
            'updatedByName' => trim((string)($group['updated_by_name'] ?? '')),
            'createdAt' => $group['created_at'],
            'updatedAt' => $group['updated_at'],
            'items' => [],
        ];
    }

    if (!$groupIds) {
        return [];
    }

    $placeholders = implode(',', array_fill(0, count($groupIds), '?'));
    $itemsStmt = $pdo->prepare("
        SELECT
            i.*,
            CONCAT(added_by.first_Name, ' ', added_by.last_Name) AS added_by_name,
            CONCAT(updated_by.first_Name, ' ', updated_by.last_Name) AS updated_by_name
        FROM pet_medical_record_group_items i
        LEFT JOIN users added_by ON added_by.user_id = i.added_by_user_id
        LEFT JOIN users updated_by ON updated_by.user_id = i.updated_by_user_id
        WHERE i.group_id IN ({$placeholders})
        ORDER BY i.sort_order ASC, i.service_date DESC, i.item_id ASC
    ");
    $itemsStmt->execute($groupIds);

    foreach ($itemsStmt->fetchAll(PDO::FETCH_ASSOC) as $item) {
        $groupId = (int)$item['group_id'];
        if (!isset($groups[$groupId])) {
            continue;
        }

        $groups[$groupId]['items'][] = [
            'itemId' => (int)$item['item_id'],
            'id' => (int)$item['item_id'],
            'groupId' => $groupId,
            'sourceType' => $item['source_type'],
            'sourceId' => $item['source_id'] !== null ? (int)$item['source_id'] : null,
            'title' => $item['title'],
            'summary' => $item['summary'] ?? '',
            'revisionNotes' => $item['revision_notes'] ?? '',
            'serviceDate' => $item['service_date'],
            'sortOrder' => (int)$item['sort_order'],
            'sourceSnapshot' => pet_medical_decode_json($item['source_snapshot'] ?? null) ?: null,
            'addedByUserId' => $item['added_by_user_id'] !== null ? (int)$item['added_by_user_id'] : null,
            'updatedByUserId' => $item['updated_by_user_id'] !== null ? (int)$item['updated_by_user_id'] : null,
            'addedByName' => trim((string)($item['added_by_name'] ?? '')),
            'updatedByName' => trim((string)($item['updated_by_name'] ?? '')),
            'createdAt' => $item['created_at'],
            'updatedAt' => $item['updated_at'],
        ];
    }

    return array_values($groups);
}

function pet_medical_escape($value): string
{
    return htmlspecialchars((string)($value ?? ''), ENT_QUOTES, 'UTF-8');
}

function pet_medical_format_date_label($value): string
{
    $text = trim((string)($value ?? ''));
    if ($text === '') {
        return 'N/A';
    }

    $timestamp = strtotime($text);
    return $timestamp === false ? $text : date('F j, Y', $timestamp);
}

function pet_medical_editor_label($name): string
{
    $value = trim((string)($name ?? ''));
    if ($value === '') {
        return '';
    }

    return strpos(strtolower($value), 'dr.') === 0 ? $value : 'Dr. ' . $value;
}

function pet_medical_source_note_rows(array $source): array
{
    $rows = [];
    $fields = [
        'Chief Complaint' => $source['chiefComplaint'] ?? $source['chief_complaint'] ?? '',
        'Major Symptoms' => $source['majorSymptoms'] ?? $source['symptoms'] ?? $source['major_symptoms'] ?? '',
        'Physical Exam' => $source['physicalExam'] ?? $source['physical_exam'] ?? '',
        'Diagnosis' => $source['diagnosis'] ?? '',
        'Treatment' => $source['treatment'] ?? '',
        'Lab Results' => $source['labResults'] ?? $source['lab_results'] ?? '',
        'Doctor Notes' => $source['notes'] ?? '',
        'Follow-up' => $source['followUp'] ?? $source['follow_up_date'] ?? '',
    ];

    foreach ($fields as $label => $value) {
        $text = trim((string)$value);
        if ($text !== '') {
            $rows[] = ['label' => $label, 'value' => $text];
        }
    }

    $customSections = $source['customSections'] ?? $source['custom_sections'] ?? [];
    if (is_array($customSections)) {
        foreach ($customSections as $index => $section) {
            if (!is_array($section)) {
                continue;
            }

            $value = trim((string)($section['value'] ?? $section['notes'] ?? $section['majorSymptoms'] ?? $section['description'] ?? ''));
            if ($value === '') {
                continue;
            }

            $label = trim((string)($section['title'] ?? $section['label'] ?? $section['type'] ?? ''));
            $rows[] = [
                'label' => $label !== '' ? $label : 'Clinical Note ' . ($index + 1),
                'value' => $value,
            ];
        }
    }

    return $rows;
}

function pet_medical_prescription_label(array $prescription): string
{
    $medicine = trim((string)($prescription['medicine'] ?? $prescription['name'] ?? 'Medication'));
    $times = trim((string)($prescription['times'] ?? '1'));
    $frequency = trim((string)($prescription['frequency'] ?? 'per day'));
    $durationNumber = trim((string)($prescription['durationNumber'] ?? $prescription['duration_number'] ?? '1'));
    $durationUnit = trim((string)($prescription['durationUnit'] ?? $prescription['duration_unit'] ?? 'week'));
    $plural = is_numeric($durationNumber) && (float)$durationNumber === 1.0 ? '' : 's';

    return "{$medicine} - {$times} time(s) {$frequency} for {$durationNumber} {$durationUnit}{$plural}";
}

function pet_medical_item_prescriptions(array $source): array
{
    $prescriptions = [];
    if (is_array($source['prescriptions'] ?? null)) {
        $prescriptions = array_merge($prescriptions, $source['prescriptions']);
    }

    $customSections = $source['customSections'] ?? $source['custom_sections'] ?? [];
    if (is_array($customSections)) {
        foreach ($customSections as $section) {
            if (!is_array($section)) {
                continue;
            }

            $sectionPrescriptions = $section['prescriptions'] ?? $section['prescription'] ?? [];
            if (is_array($sectionPrescriptions)) {
                $prescriptions = array_merge($prescriptions, $sectionPrescriptions);
            }
        }
    }

    return array_values(array_filter($prescriptions, 'is_array'));
}

function pet_medical_email_copy_html(array $pet, array $groups, array $vaccinations, array $allergies): string
{
    $petName = pet_medical_escape($pet['name'] ?? $pet['petName'] ?? 'Pet');
    $ownerName = pet_medical_escape($pet['ownerName'] ?? 'Pet Owner');
    $printedAt = pet_medical_escape(date('F j, Y g:i A'));
    $speciesBreed = pet_medical_escape(trim(implode(' / ', array_filter([$pet['species'] ?? '', $pet['breed'] ?? '']))) ?: 'N/A');
    $petId = pet_medical_escape($pet['id'] ?? $pet['dbId'] ?? 'N/A');

    $allergiesHtml = '';
    foreach ($allergies as $allergy) {
        $label = pet_medical_escape(trim((string)($allergy['allergen'] ?? 'Allergy')));
        $severity = trim((string)($allergy['severity'] ?? ''));
        $allergiesHtml .= '<span style="display:inline-block;margin:0 6px 6px 0;border-radius:999px;border:1px solid #fecaca;background:#fff1f2;color:#991b1b;padding:5px 9px;font-size:12px;font-weight:700;">'
            . $label
            . ($severity !== '' ? ' - ' . pet_medical_escape($severity) : '')
            . '</span>';
    }

    $vaccinationHtml = '';
    foreach ($vaccinations as $vaccine) {
        $vaccinationHtml .= '
            <tr>
                <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-weight:700;color:#0f172a;">' . pet_medical_escape($vaccine['name'] ?? 'Unnamed vaccine') . '</td>
                <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;color:#334155;">' . pet_medical_escape(pet_medical_format_date_label($vaccine['date'] ?? null)) . '</td>
                <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;color:#155dfc;font-weight:700;">' . pet_medical_escape(pet_medical_format_date_label($vaccine['nextDue'] ?? null)) . '</td>
                <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;color:#334155;">' . pet_medical_escape($vaccine['applicator'] ?? $vaccine['veterinarianName'] ?? 'N/A') . '</td>
            </tr>
        ';
    }

    if ($vaccinationHtml === '') {
        $vaccinationHtml = '<tr><td colspan="4" style="padding:12px;color:#64748b;font-weight:700;">No vaccination records saved.</td></tr>';
    }

    $groupsHtml = '';
    foreach ($groups as $group) {
        $summary = trim((string)($group['summary'] ?? ''));
        $editedBy = pet_medical_editor_label($group['updatedByName'] ?? '');
        $itemsHtml = '';

        foreach ($group['items'] ?? [] as $item) {
            $source = is_array($item['sourceSnapshot'] ?? null) ? $item['sourceSnapshot'] : [];
            $doctorRows = pet_medical_source_note_rows($source);
            $doctorRowsHtml = '';
            foreach ($doctorRows as $row) {
                $doctorRowsHtml .= '
                    <div style="margin:8px 0 0;border-radius:8px;background:#ffffff;border:1px solid #e2e8f0;padding:9px 10px;">
                        <p style="margin:0 0 4px;color:#64748b;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;">' . pet_medical_escape($row['label']) . '</p>
                        <p style="margin:0;color:#0f172a;font-size:13px;font-weight:600;line-height:1.55;white-space:pre-wrap;">' . nl2br(pet_medical_escape($row['value'])) . '</p>
                    </div>
                ';
            }

            $prescriptionsHtml = '';
            foreach (pet_medical_item_prescriptions($source) as $prescription) {
                $instructions = trim((string)($prescription['instructions'] ?? ''));
                $prescriptionsHtml .= '
                    <li style="margin:0 0 6px;color:#0f172a;font-size:13px;font-weight:700;">
                        ' . pet_medical_escape(pet_medical_prescription_label($prescription)) . '
                        ' . ($instructions !== '' ? '<br><span style="color:#64748b;font-size:12px;font-weight:600;">' . nl2br(pet_medical_escape($instructions)) . '</span>' : '') . '
                    </li>
                ';
            }

            $itemsHtml .= '
                <div style="margin:14px 0 0;border-radius:12px;border:1px solid #e2e8f0;background:#f8fafc;padding:14px;">
                    <p style="margin:0;color:#0f172a;font-size:15px;font-weight:800;">' . pet_medical_escape($item['title'] ?? 'Service record') . '</p>
                    <p style="margin:4px 0 0;color:#64748b;font-size:12px;font-weight:700;">' . pet_medical_escape(pet_medical_format_date_label($item['serviceDate'] ?? ($source['serviceDate'] ?? null))) . '</p>
                    ' . (trim((string)($item['summary'] ?? '')) !== '' ? '<p style="margin:10px 0 0;color:#334155;font-size:13px;font-weight:600;line-height:1.55;white-space:pre-wrap;">' . nl2br(pet_medical_escape($item['summary'])) . '</p>' : '') . '
                    ' . (trim((string)($item['revisionNotes'] ?? '')) !== '' ? '<div style="margin:10px 0 0;border-radius:8px;border:1px solid #fde68a;background:#fffbeb;padding:10px;"><p style="margin:0 0 4px;color:#b45309;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;">Veterinarian Revision</p><p style="margin:0;color:#78350f;font-size:13px;font-weight:700;line-height:1.55;white-space:pre-wrap;">' . nl2br(pet_medical_escape($item['revisionNotes'])) . '</p></div>' : '') . '
                    ' . ($doctorRowsHtml !== '' ? '<div style="margin:12px 0 0;"><p style="margin:0;color:#155dfc;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;">Doctor Notes</p>' . $doctorRowsHtml . '</div>' : '') . '
                    ' . ($prescriptionsHtml !== '' ? '<div style="margin:12px 0 0;border-radius:8px;border:1px solid #bfdbfe;background:#eff6ff;padding:10px;"><p style="margin:0 0 8px;color:#155dfc;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;">Prescriptions</p><ul style="margin:0;padding-left:18px;">' . $prescriptionsHtml . '</ul></div>' : '') . '
                    ' . (trim((string)($item['updatedByName'] ?? '')) !== '' ? '<p style="margin:10px 0 0;color:#64748b;font-size:12px;font-weight:700;">Edited by ' . pet_medical_escape(pet_medical_editor_label($item['updatedByName'])) . '</p>' : '') . '
                </div>
            ';
        }

        if ($itemsHtml === '') {
            $itemsHtml = '<p style="margin:12px 0 0;color:#64748b;font-size:13px;font-weight:700;">No service records added to this group.</p>';
        }

        $groupsHtml .= '
            <section style="margin:18px 0 0;border-radius:14px;border:1px solid #e2e8f0;background:#ffffff;overflow:hidden;">
                <div style="background:#f8fafc;border-bottom:1px solid #e2e8f0;padding:16px;">
                    <h2 style="margin:0;color:#0f172a;font-size:18px;">' . pet_medical_escape($group['title'] ?? 'Organized Record') . '</h2>
                    ' . ($summary !== '' ? '<p style="margin:8px 0 0;color:#334155;font-size:14px;font-weight:600;line-height:1.6;white-space:pre-wrap;">' . nl2br(pet_medical_escape($summary)) . '</p>' : '') . '
                    ' . ($editedBy !== '' ? '<p style="margin:8px 0 0;color:#64748b;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;">Edited by ' . pet_medical_escape($editedBy) . '</p>' : '') . '
                </div>
                <div style="padding:0 16px 16px;">' . $itemsHtml . '</div>
            </section>
        ';
    }

    if ($groupsHtml === '') {
        $groupsHtml = '<div style="margin:18px 0 0;border-radius:12px;border:1px dashed #cbd5e1;background:#f8fafc;padding:18px;color:#64748b;font-weight:700;">No organized records are available yet.</div>';
    }

    return '
        <div style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a;">
            <div style="max-width:760px;margin:0 auto;padding:28px 16px;">
                <div style="border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;background:#ffffff;">
                    <div style="background:#155dfc;padding:24px;">
                        <p style="margin:0;color:#bfdbfe;font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;">iPawcus Veterinary Clinic</p>
                        <h1 style="margin:8px 0 0;color:#ffffff;font-size:24px;line-height:1.25;">Organized Medical Record</h1>
                    </div>
                    <div style="padding:24px;">
                        <p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.6;">Hello ' . $ownerName . ', here is the owner-visible organized medical record copy for ' . $petName . '.</p>
                        <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
                            <tr><td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#64748b;font-weight:700;width:34%;">Pet</td><td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-weight:800;">' . $petName . '</td></tr>
                            <tr><td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#64748b;font-weight:700;">Pet ID</td><td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-weight:700;">' . $petId . '</td></tr>
                            <tr><td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#64748b;font-weight:700;">Species / Breed</td><td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-weight:700;">' . $speciesBreed . '</td></tr>
                            <tr><td style="padding:10px 12px;color:#64748b;font-weight:700;">Generated</td><td style="padding:10px 12px;font-weight:700;">' . $printedAt . '</td></tr>
                        </table>
                        ' . ($allergiesHtml !== '' ? '<div style="margin:16px 0 0;"><p style="margin:0 0 8px;color:#991b1b;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;">Allergies</p>' . $allergiesHtml . '</div>' : '') . '
                        <section style="margin:18px 0 0;border-radius:14px;border:1px solid #e2e8f0;background:#ffffff;overflow:hidden;">
                            <div style="background:#f8fafc;border-bottom:1px solid #e2e8f0;padding:14px 16px;">
                                <h2 style="margin:0;color:#0f172a;font-size:17px;">Vaccination Records</h2>
                            </div>
                            <table style="width:100%;border-collapse:collapse;">
                                <thead><tr><th style="padding:8px 10px;text-align:left;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.08em;">Vaccine</th><th style="padding:8px 10px;text-align:left;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.08em;">Date Given</th><th style="padding:8px 10px;text-align:left;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.08em;">Next Due</th><th style="padding:8px 10px;text-align:left;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.08em;">Veterinarian</th></tr></thead>
                                <tbody>' . $vaccinationHtml . '</tbody>
                            </table>
                        </section>
                        ' . $groupsHtml . '
                        <p style="margin:22px 0 0;color:#64748b;font-size:12px;line-height:1.5;">This copy contains organized owner-visible medical records only. Diagnostic images and private attachments remain view-only inside iPawcus.</p>
                    </div>
                </div>
            </div>
        </div>
    ';
}

function pet_medical_send_email_copy(PDO $pdo, int $petId): void
{
    $pet = pet_medical_pet_summary($pdo, $petId);
    $email = trim((string)($pet['ownerEmail'] ?? ''));

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        pet_medical_error(400, 'The pet owner does not have a valid email address.');
    }

    $groups = pet_medical_fetch_groups($pdo, $petId, true);
    $vaccinations = pet_medical_fetch_vaccinations($pdo, $petId);
    $allergies = pet_medical_fetch_allergies($pdo, $petId, $pet);
    $subject = 'iPawcus organized medical record - ' . ($pet['name'] ?? 'Pet');
    $html = pet_medical_email_copy_html($pet, $groups, $vaccinations, $allergies);

    try {
        if (mail_queue_enabled()) {
            mail_queue_email($pdo, $email, $subject, $html, null, [
                'toName' => $pet['ownerName'] ?? '',
            ]);

            echo json_encode([
                'success' => true,
                'message' => 'Organized medical record copy was queued for email delivery.',
                'email' => $email,
            ]);
            return;
        }

        send_smtp_email($email, $subject, $html, null, [
            'toName' => $pet['ownerName'] ?? '',
        ]);

        echo json_encode([
            'success' => true,
            'message' => 'Organized medical record copy was emailed to the pet owner.',
            'email' => $email,
        ]);
    } catch (Throwable $error) {
        error_log('Medical record email copy failed: ' . $error->getMessage());
        pet_medical_error(409, 'Medical record copy could not be emailed right now. Please check mail queue or SMTP configuration.');
    }
}

function pet_medical_service_record_by_source(PDO $pdo, int $petId, string $sourceType, int $sourceId): ?array
{
    if ($sourceType === 'vaccination') {
        foreach (pet_medical_fetch_vaccinations($pdo, $petId) as $vaccine) {
            if ((int)$vaccine['id'] === $sourceId) {
                return pet_medical_vaccination_group_record($vaccine);
            }
        }

        return null;
    }

    foreach (pet_medical_fetch_service_history($pdo, $petId) as $record) {
        if ($record['sourceType'] === $sourceType && (int)$record['sourceId'] === $sourceId) {
            return $record;
        }
    }

    return null;
}

function pet_medical_create_group(PDO $pdo, int $petId, array $input): void
{
    $title = pet_medical_nullable_text($input['title'] ?? null);
    if ($title === null) {
        pet_medical_error(400, 'Group title is required.');
    }

    $maxStmt = $pdo->prepare("SELECT COALESCE(MAX(sort_order), 0) + 1 FROM pet_medical_record_groups WHERE pet_id = ?");
    $maxStmt->execute([$petId]);
    $sortOrder = pet_medical_nullable_int($input['sortOrder'] ?? $input['sort_order'] ?? null) ?? (int)$maxStmt->fetchColumn();

    $stmt = $pdo->prepare("
        INSERT INTO pet_medical_record_groups (
            pet_id,
            title,
            summary,
            visible_to_owner,
            sort_order,
            created_by_user_id,
            updated_by_user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ");
    $userId = pet_medical_nullable_int($input['userId'] ?? $input['user_id'] ?? $input['veterinarianUserId'] ?? null);
    $visible = array_key_exists('visibleToOwner', $input)
        ? (int)(bool)$input['visibleToOwner']
        : (array_key_exists('visible_to_owner', $input) ? (int)(bool)$input['visible_to_owner'] : 1);

    $stmt->execute([
        $petId,
        $title,
        pet_medical_nullable_text($input['summary'] ?? null),
        $visible,
        $sortOrder,
        $userId,
        $userId,
    ]);

    echo json_encode(['success' => true, 'groupId' => (int)$pdo->lastInsertId()]);
}

function pet_medical_update_group(PDO $pdo, int $petId, array $input): void
{
    $groupId = pet_medical_nullable_int($input['groupId'] ?? $input['group_id'] ?? null);
    if ($groupId === null) {
        pet_medical_error(400, 'groupId is required.');
    }

    $title = pet_medical_nullable_text($input['title'] ?? null);
    if ($title === null) {
        pet_medical_error(400, 'Group title is required.');
    }

    $visible = array_key_exists('visibleToOwner', $input)
        ? (int)(bool)$input['visibleToOwner']
        : (array_key_exists('visible_to_owner', $input) ? (int)(bool)$input['visible_to_owner'] : 1);
    $summary = pet_medical_nullable_text($input['summary'] ?? null);
    $sortOrder = pet_medical_nullable_int($input['sortOrder'] ?? $input['sort_order'] ?? null);
    $userId = pet_medical_nullable_int($input['userId'] ?? $input['user_id'] ?? $input['veterinarianUserId'] ?? null);

    $currentStmt = $pdo->prepare("
        SELECT group_id, title, summary, visible_to_owner, sort_order
        FROM pet_medical_record_groups
        WHERE group_id = ?
          AND pet_id = ?
        LIMIT 1
    ");
    $currentStmt->execute([$groupId, $petId]);
    $current = $currentStmt->fetch(PDO::FETCH_ASSOC);
    if (!$current) {
        pet_medical_error(404, 'Record group was not found.');
    }

    $next = [
        'title' => $title,
        'summary' => $summary,
        'visible_to_owner' => $visible,
        'sort_order' => $sortOrder ?? (int)$current['sort_order'],
    ];
    $changedFields = pet_medical_changed_fields($current, $next);
    if (!$changedFields) {
        echo json_encode(['success' => true, 'changed' => false]);
        return;
    }

    $stmt = $pdo->prepare("
        UPDATE pet_medical_record_groups
        SET title = ?,
            summary = ?,
            visible_to_owner = ?,
            sort_order = COALESCE(?, sort_order),
            updated_by_user_id = ?
        WHERE group_id = ?
          AND pet_id = ?
    ");
    $stmt->execute([
        $title,
        $summary,
        $visible,
        $sortOrder,
        $userId,
        $groupId,
        $petId,
    ]);

    if ($visible === 1 || (int)$current['visible_to_owner'] === 1) {
        pet_medical_notify_owner_record_updated($pdo, $petId, 'group', $groupId, $title);
    }

    echo json_encode(['success' => true, 'changed' => true]);
}

function pet_medical_delete_group(PDO $pdo, int $petId, array $input): void
{
    $groupId = pet_medical_nullable_int($input['groupId'] ?? $input['group_id'] ?? null);
    if ($groupId === null) {
        pet_medical_error(400, 'groupId is required.');
    }

    $stmt = $pdo->prepare("DELETE FROM pet_medical_record_groups WHERE group_id = ? AND pet_id = ?");
    $stmt->execute([$groupId, $petId]);

    echo json_encode(['success' => true]);
}

function pet_medical_add_item(PDO $pdo, int $petId, array $input): void
{
    $groupId = pet_medical_nullable_int($input['groupId'] ?? $input['group_id'] ?? null);
    $sourceType = pet_medical_nullable_text($input['sourceType'] ?? $input['source_type'] ?? null);
    $sourceId = pet_medical_nullable_int($input['sourceId'] ?? $input['source_id'] ?? null);

    if ($groupId === null || $sourceType === null || $sourceId === null) {
        pet_medical_error(400, 'groupId, sourceType, and sourceId are required.');
    }

    $groupStmt = $pdo->prepare("SELECT group_id FROM pet_medical_record_groups WHERE group_id = ? AND pet_id = ? LIMIT 1");
    $groupStmt->execute([$groupId, $petId]);
    if (!$groupStmt->fetchColumn()) {
        pet_medical_error(404, 'Record group was not found.');
    }

    $record = pet_medical_service_record_by_source($pdo, $petId, $sourceType, $sourceId);
    if (!$record) {
        pet_medical_error(404, 'Source medical record was not found.');
    }

    $duplicateStmt = $pdo->prepare("
        SELECT item_id
        FROM pet_medical_record_group_items
        WHERE group_id = ?
          AND source_type = ?
          AND source_id = ?
        LIMIT 1
    ");
    $duplicateStmt->execute([$groupId, $sourceType, $sourceId]);
    $existingItemId = $duplicateStmt->fetchColumn();
    if ($existingItemId) {
        echo json_encode(['success' => true, 'itemId' => (int)$existingItemId, 'duplicate' => true]);
        return;
    }

    $maxStmt = $pdo->prepare("SELECT COALESCE(MAX(sort_order), 0) + 1 FROM pet_medical_record_group_items WHERE group_id = ?");
    $maxStmt->execute([$groupId]);
    $sortOrder = pet_medical_nullable_int($input['sortOrder'] ?? $input['sort_order'] ?? null) ?? (int)$maxStmt->fetchColumn();
    $userId = pet_medical_nullable_int($input['userId'] ?? $input['user_id'] ?? $input['veterinarianUserId'] ?? null);

    $stmt = $pdo->prepare("
        INSERT INTO pet_medical_record_group_items (
            group_id,
            source_type,
            source_id,
            title,
            summary,
            revision_notes,
            service_date,
            sort_order,
            source_snapshot,
            added_by_user_id,
            updated_by_user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");
    $stmt->execute([
        $groupId,
        $sourceType,
        $sourceId,
        pet_medical_nullable_text($input['title'] ?? null) ?: $record['title'],
        pet_medical_nullable_text($input['summary'] ?? null) ?: $record['summary'],
        pet_medical_nullable_text($input['revisionNotes'] ?? $input['revision_notes'] ?? null),
        $record['serviceDate'] ?: null,
        $sortOrder,
        pet_medical_json($record),
        $userId,
        $userId,
    ]);

    echo json_encode(['success' => true, 'itemId' => (int)$pdo->lastInsertId()]);
}

function pet_medical_update_item(PDO $pdo, int $petId, array $input): void
{
    $itemId = pet_medical_nullable_int($input['itemId'] ?? $input['item_id'] ?? null);
    if ($itemId === null) {
        pet_medical_error(400, 'itemId is required.');
    }

    $currentStmt = $pdo->prepare("
        SELECT
            i.item_id,
            i.title,
            i.summary,
            i.revision_notes,
            i.sort_order,
            g.group_id,
            g.title AS group_title,
            g.visible_to_owner
        FROM pet_medical_record_group_items i
        JOIN pet_medical_record_groups g ON g.group_id = i.group_id
        WHERE i.item_id = ?
          AND g.pet_id = ?
        LIMIT 1
    ");
    $currentStmt->execute([$itemId, $petId]);
    $current = $currentStmt->fetch(PDO::FETCH_ASSOC);
    if (!$current) {
        pet_medical_error(404, 'Record item was not found.');
    }

    $title = pet_medical_nullable_text($input['title'] ?? null) ?: 'Clinical record';
    $summary = pet_medical_nullable_text($input['summary'] ?? null);
    $revisionNotes = pet_medical_nullable_text($input['revisionNotes'] ?? $input['revision_notes'] ?? null);
    $sortOrder = pet_medical_nullable_int($input['sortOrder'] ?? $input['sort_order'] ?? null);
    $userId = pet_medical_nullable_int($input['userId'] ?? $input['user_id'] ?? $input['veterinarianUserId'] ?? null);

    $next = [
        'title' => $title,
        'summary' => $summary,
        'revision_notes' => $revisionNotes,
        'sort_order' => $sortOrder ?? (int)$current['sort_order'],
    ];
    $changedFields = pet_medical_changed_fields($current, $next);
    if (!$changedFields) {
        echo json_encode(['success' => true, 'changed' => false]);
        return;
    }

    $stmt = $pdo->prepare("
        UPDATE pet_medical_record_group_items i
        JOIN pet_medical_record_groups g ON g.group_id = i.group_id
        SET i.title = ?,
            i.summary = ?,
            i.revision_notes = ?,
            i.sort_order = COALESCE(?, i.sort_order),
            i.updated_by_user_id = ?
        WHERE i.item_id = ?
          AND g.pet_id = ?
    ");
    $stmt->execute([
        $title,
        $summary,
        $revisionNotes,
        $sortOrder,
        $userId,
        $itemId,
        $petId,
    ]);

    if ((int)$current['visible_to_owner'] === 1) {
        pet_medical_notify_owner_record_updated($pdo, $petId, 'item', $itemId, $title);
    }

    echo json_encode(['success' => true, 'changed' => true]);
}

function pet_medical_remove_item(PDO $pdo, int $petId, array $input): void
{
    $itemId = pet_medical_nullable_int($input['itemId'] ?? $input['item_id'] ?? null);
    if ($itemId === null) {
        pet_medical_error(400, 'itemId is required.');
    }

    $stmt = $pdo->prepare("
        DELETE i
        FROM pet_medical_record_group_items i
        JOIN pet_medical_record_groups g ON g.group_id = i.group_id
        WHERE i.item_id = ?
          AND g.pet_id = ?
    ");
    $stmt->execute([$itemId, $petId]);

    echo json_encode(['success' => true]);
}

function pet_medical_save_vaccination(PDO $pdo, int $petId, array $input): void
{
    $action = $input['action'] ?? 'add';

    if ($action === 'add') {
        if (!pet_medical_table_exists($pdo, 'pet_vaccinations')) {
            pet_medical_error(409, 'Vaccination table is missing.');
        }

        $columns = ['pet_id', 'vax_name', 'vax_date', 'vax_next_due', 'vax_applicator', 'vax_status'];
        $values = [
            $petId,
            $input['name'] ?? '',
            $input['date'] ?? null,
            $input['nextDue'] ?? null,
            $input['applicator'] ?? null,
            $input['status'] ?? 'completed',
        ];

        if (pet_medical_column_exists($pdo, 'pet_vaccinations', 'vax_veterinarian_license')) {
            $columns[] = 'vax_veterinarian_license';
            $values[] = $input['veterinarianLicense'] ?? $input['licenseNumber'] ?? null;
        }

        if (pet_medical_column_exists($pdo, 'pet_vaccinations', 'vax_notes')) {
            $columns[] = 'vax_notes';
            $values[] = $input['notes'] ?? null;
        }

        $placeholders = implode(', ', array_fill(0, count($columns), '?'));
        $stmt = $pdo->prepare('INSERT INTO pet_vaccinations (' . implode(', ', $columns) . ") VALUES ({$placeholders})");
        $stmt->execute($values);
        echo json_encode(['success' => true, 'id' => (int)$pdo->lastInsertId()]);
        return;
    }

    if ($action === 'delete') {
        $stmt = $pdo->prepare("DELETE FROM pet_vaccinations WHERE vax_id = ? AND pet_id = ?");
        $stmt->execute([$input['id'] ?? 0, $petId]);
        echo json_encode(['success' => true]);
        return;
    }

    pet_medical_error(400, 'Invalid vaccination action.');
}

function pet_medical_save_allergy(PDO $pdo, int $petId, array $input): void
{
    $action = $input['action'] ?? 'add';

    if ($action === 'add') {
        if (!pet_medical_table_exists($pdo, 'pet_allergies')) {
            pet_medical_error(409, 'Allergy table is missing.');
        }

        $stmt = $pdo->prepare("INSERT INTO pet_allergies (pet_id, allergen, severity) VALUES (?, ?, ?)");
        $stmt->execute([
            $petId,
            $input['allergen'] ?? '',
            $input['severity'] ?? 'Known',
        ]);
        echo json_encode(['success' => true, 'id' => (int)$pdo->lastInsertId()]);
        return;
    }

    if ($action === 'delete') {
        $stmt = $pdo->prepare("DELETE FROM pet_allergies WHERE allergy_id = ? AND pet_id = ?");
        $stmt->execute([$input['id'] ?? 0, $petId]);
        echo json_encode(['success' => true]);
        return;
    }

    pet_medical_error(400, 'Invalid allergy action.');
}

$petId = $_GET['petId'] ?? null;
$petNumericId = pet_medical_resolve_pet_id($pdo, $petId);
$method = $_SERVER['REQUEST_METHOD'];

try {
    pet_medical_ensure_schema($pdo);
    $currentUser = ipawcus_guard_current_user($pdo);
    $currentRole = ipawcus_guard_role($currentUser);
    $currentUserId = ipawcus_guard_user_id($currentUser);

    if ($currentRole === 'pet_owner' && !ipawcus_guard_pet_access($pdo, $petNumericId, $currentUserId)) {
        pet_medical_error(403, 'You are not allowed to view this pet medical record.');
    }

    if ($method === 'GET') {
        $ownerVisibleOnly = $currentRole === 'pet_owner' || (isset($_GET['owner']) && (int)$_GET['owner'] === 1);
        $pet = pet_medical_pet_summary($pdo, $petNumericId);
        $serviceHistory = pet_medical_fetch_service_history($pdo, $petNumericId);
        $organizedRecords = pet_medical_fetch_groups($pdo, $petNumericId, $ownerVisibleOnly);

        echo json_encode([
            'success' => true,
            'schemaReady' => true,
            'pet' => $pet,
            'vaccinations' => pet_medical_fetch_vaccinations($pdo, $petNumericId),
            'allergies' => pet_medical_fetch_allergies($pdo, $petNumericId, $pet),
            'prescriptionDocuments' => pet_medical_fetch_prescription_documents($pdo, $petNumericId),
            'serviceHistory' => $serviceHistory,
            'organizedRecords' => $organizedRecords,
            'medicalRecords' => [
                'organized' => $organizedRecords,
                'unorganized' => $serviceHistory,
            ],
        ]);
        exit;
    }

    if ($method !== 'POST' && $method !== 'PATCH') {
        pet_medical_error(405, 'Method not allowed.');
    }

    $input = pet_medical_input();
    $action = $input['action'] ?? '';
    $type = $input['type'] ?? null;

    if ($method === 'POST' && $action === 'email_copy') {
        pet_medical_send_email_copy($pdo, $petNumericId);
        exit;
    }

    if (!ipawcus_guard_is_clinic_role($currentRole)) {
        pet_medical_error(403, 'Only authorized clinic users can modify medical records.');
    }

    switch ($action) {
        case 'create_group':
            pet_medical_create_group($pdo, $petNumericId, $input);
            break;
        case 'update_group':
            pet_medical_update_group($pdo, $petNumericId, $input);
            break;
        case 'delete_group':
            pet_medical_delete_group($pdo, $petNumericId, $input);
            break;
        case 'add_item':
            pet_medical_add_item($pdo, $petNumericId, $input);
            break;
        case 'update_item':
            pet_medical_update_item($pdo, $petNumericId, $input);
            break;
        case 'remove_item':
            pet_medical_remove_item($pdo, $petNumericId, $input);
            break;
        default:
            if ($type === 'vaccination') {
                pet_medical_save_vaccination($pdo, $petNumericId, $input);
                break;
            }

            if ($type === 'allergy') {
                pet_medical_save_allergy($pdo, $petNumericId, $input);
                break;
            }

            pet_medical_error(400, 'Invalid medical record action.');
    }
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Medical records request failed: ' . $e->getMessage(),
    ]);
}
