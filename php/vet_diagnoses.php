<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/booking_queue_helpers.php';
require_once __DIR__ . '/queue_assignment_helpers.php';

header('Content-Type: application/json');

function vetDiagnosisTableExists(PDO $pdo): bool
{
    $stmt = $pdo->query("SHOW TABLES LIKE 'vet_diagnoses'");

    return (bool)$stmt->fetchColumn();
}

function vetDiagnosisMigrationMessage(): string
{
    return 'Missing vet_diagnoses table. Please run DDL/vet_diagnosis_migration_20260531.sql before saving diagnoses.';
}

function vetDiagnosisNullableText($value): ?string
{
    if ($value === null) {
        return null;
    }

    $text = trim((string)$value);

    return $text !== '' ? $text : null;
}

function vetDiagnosisNullableInt($value): ?int
{
    if ($value === null || $value === '') {
        return null;
    }

    return is_numeric($value) ? (int)$value : null;
}

function vetDiagnosisDate($value): ?string
{
    $date = vetDiagnosisNullableText($value);

    if ($date === null) {
        return null;
    }

    $parsed = DateTime::createFromFormat('Y-m-d', $date);
    $errors = DateTime::getLastErrors();
    $hasErrors = is_array($errors) && ($errors['warning_count'] > 0 || $errors['error_count'] > 0);

    return $parsed && !$hasErrors ? $parsed->format('Y-m-d') : null;
}

function vetDiagnosisJsonValue($value): ?string
{
    if ($value === null) {
        return null;
    }

    $encoded = json_encode($value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

    if ($encoded === false) {
        throw new RuntimeException('Invalid JSON payload.');
    }

    return $encoded;
}

function vetDiagnosisDecodeJson($value)
{
    if ($value === null || $value === '') {
        return null;
    }

    $decoded = json_decode((string)$value, true);

    return json_last_error() === JSON_ERROR_NONE ? $decoded : null;
}

function vetDiagnosisFormatRow(array $row): array
{
    $jsonColumns = ['vital_signs', 'prescriptions', 'custom_sections', 'attachments', 'source_uploads'];

    foreach ($jsonColumns as $column) {
        $row[$column] = vetDiagnosisDecodeJson($row[$column] ?? null);
    }

    return [
        'id' => (int)$row['diagnosis_id'],
        'diagnosisId' => (int)$row['diagnosis_id'],
        'queueId' => $row['queue_id'] !== null ? (int)$row['queue_id'] : null,
        'queueNumber' => $row['queue_number'] !== null ? (int)$row['queue_number'] : null,
        'bookingId' => $row['booking_id'] !== null ? (int)$row['booking_id'] : null,
        'bookingNumber' => $row['booking_number'] ?? null,
        'assignmentId' => $row['assignment_id'] !== null ? (int)$row['assignment_id'] : null,
        'petId' => (int)$row['pet_id'],
        'petName' => $row['pet_name'] ?? null,
        'petSpecies' => $row['pet_species'] ?? null,
        'petBreed' => $row['pet_breed'] ?? null,
        'ownerName' => trim((string)(($row['owner_first_name'] ?? '') . ' ' . ($row['owner_last_name'] ?? ''))) ?: null,
        'veterinarianUserId' => (int)$row['veterinarian_user_id'],
        'veterinarianName' => $row['veterinarian_name'] ?? null,
        'diagnosisType' => $row['diagnosis_type'],
        'serviceName' => $row['service_name'] ?? null,
        'chiefComplaint' => $row['chief_complaint'] ?? '',
        'majorSymptoms' => $row['major_symptoms'] ?? '',
        'symptoms' => $row['symptoms'] ?? '',
        'physicalExam' => $row['physical_exam'] ?? '',
        'diagnosis' => $row['diagnosis'] ?? '',
        'treatment' => $row['treatment'] ?? '',
        'labResults' => $row['lab_results'] ?? '',
        'followUp' => $row['follow_up_date'] ?? '',
        'notes' => $row['notes'] ?? '',
        'vitalSigns' => $row['vital_signs'] ?: [],
        'prescriptions' => $row['prescriptions'] ?: [],
        'customSections' => $row['custom_sections'] ?: [],
        'attachments' => $row['attachments'] ?: [],
        'sourceUploads' => $row['source_uploads'] ?: [],
        'finalizedAt' => $row['finalized_at'] ?? null,
        'createdAt' => $row['created_at'] ?? null,
        'updatedAt' => $row['updated_at'] ?? null,
    ];
}

function vetDiagnosisBookingId(PDO $pdo, ?int $queueId, ?int $bookingId): ?int
{
    if ($bookingId !== null && $bookingId > 0) {
        return $bookingId;
    }

    if ($queueId === null || $queueId <= 0) {
        return null;
    }

    $stmt = $pdo->prepare("SELECT * FROM queues WHERE queue_id = ? LIMIT 1");
    $stmt->execute([$queueId]);
    $queue = $stmt->fetch(PDO::FETCH_ASSOC);

    return $queue ? bookingIdForQueue($pdo, $queue) : null;
}

function vetDiagnosisFetchQueue(PDO $pdo, ?int $queueId, bool $forUpdate = false): ?array
{
    if ($queueId === null || $queueId <= 0) {
        return null;
    }

    $lockSql = $forUpdate ? ' FOR UPDATE' : '';
    $stmt = $pdo->prepare("SELECT * FROM queues WHERE queue_id = ? LIMIT 1{$lockSql}");
    $stmt->execute([$queueId]);
    $queue = $stmt->fetch(PDO::FETCH_ASSOC);

    return $queue ?: null;
}

function vetDiagnosisRecordExists(PDO $pdo, string $tableName, string $idColumn, int $id): bool
{
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM {$tableName} WHERE {$idColumn} = ?");
    $stmt->execute([$id]);

    return (int)$stmt->fetchColumn() > 0;
}

function vetDiagnosisFetchBooking(PDO $pdo, int $bookingId): ?array
{
    $stmt = $pdo->prepare("SELECT * FROM bookings WHERE booking_id = ? LIMIT 1");
    $stmt->execute([$bookingId]);
    $booking = $stmt->fetch(PDO::FETCH_ASSOC);

    return $booking ?: null;
}

function vetDiagnosisResolveAssignment(PDO $pdo, ?int $queueId, int $veterinarianUserId, ?int $assignmentId): ?array
{
    if (!vetQueueAssignmentsTableExists($pdo)) {
        return null;
    }

    if ($assignmentId !== null && $assignmentId > 0) {
        $stmt = $pdo->prepare("
            SELECT *
            FROM vet_queue_assignments
            WHERE assignment_id = ?
            LIMIT 1
        ");
        $stmt->execute([$assignmentId]);
        $assignment = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$assignment) {
            http_response_code(404);
            throw new RuntimeException('Veterinarian queue assignment was not found.');
        }

        if ($queueId !== null && (int)$assignment['queue_id'] !== $queueId) {
            http_response_code(409);
            throw new RuntimeException('Diagnosis assignment does not belong to this queue.');
        }

        if ((int)$assignment['veterinarian_user_id'] !== $veterinarianUserId) {
            http_response_code(403);
            throw new RuntimeException('This queue is assigned to a different veterinarian.');
        }

        return $assignment;
    }

    if ($queueId === null || $queueId <= 0) {
        return null;
    }

    $stmt = $pdo->prepare("
        SELECT *
        FROM vet_queue_assignments
        WHERE queue_id = ?
        ORDER BY
            CASE status
                WHEN 'received' THEN 0
                WHEN 'completed' THEN 1
                ELSE 2
            END,
            assignment_id DESC
        LIMIT 1
    ");
    $stmt->execute([$queueId]);
    $assignment = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$assignment) {
        return null;
    }

    if ((int)$assignment['veterinarian_user_id'] !== $veterinarianUserId) {
        http_response_code(403);
        throw new RuntimeException('This queue is assigned to a different veterinarian.');
    }

    return $assignment;
}

function vetDiagnosisHasCustomContent(array $customSections): bool
{
    foreach ($customSections as $section) {
        if (!is_array($section)) {
            continue;
        }

        $hasText = trim((string)($section['label'] ?? '')) !== ''
            || trim((string)($section['value'] ?? '')) !== ''
            || trim((string)($section['notes'] ?? '')) !== ''
            || trim((string)($section['majorSymptoms'] ?? $section['major_symptoms'] ?? '')) !== '';
        $hasPrescriptions = !empty($section['prescriptions']) || !empty($section['prescription']);
        $hasAttachments = !empty($section['attachments']) || !empty($section['uploads']);

        if ($hasText || $hasPrescriptions || $hasAttachments) {
            return true;
        }
    }

    return false;
}

function vetDiagnosisCompleteQueue(PDO $pdo, ?int $queueId, ?int $assignmentId = null): void
{
    if ($queueId === null || $queueId <= 0) {
        return;
    }

    $queue = vetDiagnosisFetchQueue($pdo, $queueId, true);

    if (!$queue) {
        return;
    }

    $updateQueue = $pdo->prepare("UPDATE queues SET status = 'completed' WHERE queue_id = ?");
    $updateQueue->execute([$queueId]);

    if (vetQueueAssignmentsTableExists($pdo)) {
        if ($assignmentId !== null && $assignmentId > 0) {
            $assignmentStmt = $pdo->prepare("
                UPDATE vet_queue_assignments
                SET status = 'completed',
                    completed_at = NOW()
                WHERE assignment_id = ?
            ");
            $assignmentStmt->execute([$assignmentId]);
        } else {
            $assignmentStmt = $pdo->prepare("
                UPDATE vet_queue_assignments
                SET status = 'completed',
                    completed_at = NOW()
                WHERE queue_id = ?
                  AND status = 'received'
            ");
            $assignmentStmt->execute([$queueId]);
        }
    }

    $bookingId = bookingIdForQueue($pdo, $queue);
    if ($bookingId) {
        $bookingStmt = $pdo->prepare("UPDATE bookings SET status = 'completed' WHERE booking_id = ? AND status <> 'cancelled'");
        $bookingStmt->execute([$bookingId]);
    }
}

try {
    $method = $_SERVER['REQUEST_METHOD'];

    if (!vetDiagnosisTableExists($pdo)) {
        if ($method === 'GET') {
            echo json_encode([
                'success' => true,
                'schemaReady' => false,
                'message' => vetDiagnosisMigrationMessage(),
                'records' => []
            ]);
            exit;
        }

        http_response_code(409);
        echo json_encode(['success' => false, 'message' => vetDiagnosisMigrationMessage()]);
        exit;
    }

    if ($method === 'GET') {
        $diagnosisId = vetDiagnosisNullableInt($_GET['diagnosisId'] ?? $_GET['id'] ?? null);
        $queueId = vetDiagnosisNullableInt($_GET['queueId'] ?? null);
        $bookingId = vetDiagnosisNullableInt($_GET['bookingId'] ?? null);
        $petId = vetDiagnosisNullableInt($_GET['petId'] ?? null);
        $veterinarianUserId = vetDiagnosisNullableInt($_GET['veterinarianUserId'] ?? $_GET['veterinarian_user_id'] ?? null);

        $conditions = [];
        $params = [];

        if ($diagnosisId !== null) {
            $conditions[] = 'vd.diagnosis_id = ?';
            $params[] = $diagnosisId;
        }

        if ($queueId !== null) {
            $conditions[] = 'vd.queue_id = ?';
            $params[] = $queueId;
        }

        if ($bookingId !== null) {
            $conditions[] = 'vd.booking_id = ?';
            $params[] = $bookingId;
        }

        if ($petId !== null) {
            $conditions[] = 'vd.pet_id = ?';
            $params[] = $petId;
        }

        if ($veterinarianUserId !== null) {
            $conditions[] = 'vd.veterinarian_user_id = ?';
            $params[] = $veterinarianUserId;
        }

        $whereSql = $conditions ? 'WHERE ' . implode(' AND ', $conditions) : '';
        $stmt = $pdo->prepare("
            SELECT
                vd.*,
                q.queue_number,
                b.booking_number,
                p.pet_name,
                p.pet_species,
                p.pet_breed,
                owner.first_Name AS owner_first_name,
                owner.last_Name AS owner_last_name
            FROM vet_diagnoses vd
            LEFT JOIN pets_information p ON p.pet_id = vd.pet_id
            LEFT JOIN queues q ON q.queue_id = vd.queue_id
            LEFT JOIN bookings b ON b.booking_id = vd.booking_id
            LEFT JOIN users owner ON owner.user_id = COALESCE(q.user_id, b.user_id)
            {$whereSql}
            ORDER BY vd.finalized_at DESC, vd.created_at DESC, vd.diagnosis_id DESC
        ");
        $stmt->execute($params);
        $records = array_map('vetDiagnosisFormatRow', $stmt->fetchAll(PDO::FETCH_ASSOC));

        echo json_encode([
            'success' => true,
            'schemaReady' => true,
            'records' => $records
        ]);
        exit;
    }

    if ($method !== 'POST') {
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true) ?: [];

    $queueId = vetDiagnosisNullableInt($input['queue_id'] ?? $input['queueId'] ?? null);
    $bookingId = vetDiagnosisNullableInt($input['booking_id'] ?? $input['bookingId'] ?? null);
    $assignmentId = vetDiagnosisNullableInt($input['assignment_id'] ?? $input['assignmentId'] ?? null);
    $petId = vetDiagnosisNullableInt($input['pet_id'] ?? $input['petId'] ?? null);
    $veterinarianUserId = vetDiagnosisNullableInt($input['veterinarian_user_id'] ?? $input['veterinarianUserId'] ?? null);
    $diagnosisType = vetDiagnosisNullableText($input['diagnosis_type'] ?? $input['diagnosisType'] ?? 'general') ?: 'general';

    if (!in_array($diagnosisType, ['general', 'custom'], true)) {
        $diagnosisType = 'general';
    }

    if ($veterinarianUserId === null || $veterinarianUserId <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'veterinarian_user_id is required.']);
        exit;
    }

    $queue = vetDiagnosisFetchQueue($pdo, $queueId);
    if ($queueId !== null && !$queue) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Queue patient was not found.']);
        exit;
    }

    if ($queue) {
        if (strtolower((string)($queue['status'] ?? '')) === 'cancelled') {
            http_response_code(409);
            echo json_encode(['success' => false, 'message' => 'Cancelled queues cannot receive a diagnosis.']);
            exit;
        }

        if ($petId === null) {
            $petId = (int)$queue['pet_id'];
        } elseif ((int)$queue['pet_id'] !== $petId) {
            http_response_code(409);
            echo json_encode(['success' => false, 'message' => 'Diagnosis pet does not match the selected queue.']);
            exit;
        }
    }

    if ($petId === null || $petId <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'pet_id is required.']);
        exit;
    }

    if (!vetDiagnosisRecordExists($pdo, 'pets_information', 'pet_id', $petId)) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Pet was not found.']);
        exit;
    }

    if (!vetDiagnosisRecordExists($pdo, 'users', 'user_id', $veterinarianUserId)) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Veterinarian account was not found.']);
        exit;
    }

    $diagnosisText = vetDiagnosisNullableText($input['diagnosis'] ?? null);
    $customSections = $input['custom_sections'] ?? $input['customSections'] ?? [];
    $customSections = is_array($customSections) ? $customSections : [];
    $prescriptions = $input['prescriptions'] ?? [];
    $prescriptions = is_array($prescriptions) ? $prescriptions : [];
    $attachments = $input['attachments'] ?? [];
    $attachments = is_array($attachments) ? $attachments : [];
    $sourceUploads = $input['source_uploads'] ?? $input['sourceUploads'] ?? [];
    $sourceUploads = is_array($sourceUploads) ? $sourceUploads : [];

    if ($diagnosisType === 'general' && $diagnosisText === null) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Diagnosis is required for general diagnosis records.']);
        exit;
    }

    if ($diagnosisType === 'custom' && !vetDiagnosisHasCustomContent($customSections)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'At least one custom diagnosis section is required.']);
        exit;
    }

    $queueBookingId = $queue ? bookingIdForQueue($pdo, $queue) : null;
    if ($queueBookingId !== null) {
        if ($bookingId !== null && $bookingId !== $queueBookingId) {
            http_response_code(409);
            echo json_encode(['success' => false, 'message' => 'Diagnosis booking does not match the selected queue.']);
            exit;
        }
        $bookingId = $queueBookingId;
    } elseif ($bookingId !== null) {
        $booking = vetDiagnosisFetchBooking($pdo, $bookingId);

        if (!$booking) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Booking was not found.']);
            exit;
        }

        if (!empty($booking['pet_id']) && (int)$booking['pet_id'] !== $petId) {
            http_response_code(409);
            echo json_encode(['success' => false, 'message' => 'Diagnosis pet does not match the selected booking.']);
            exit;
        }
    }

    $assignment = vetDiagnosisResolveAssignment($pdo, $queueId, $veterinarianUserId, $assignmentId);
    if ($assignment) {
        $assignmentId = (int)$assignment['assignment_id'];
    }

    $payload = [
        'queue_id' => $queueId,
        'booking_id' => $bookingId,
        'assignment_id' => $assignmentId,
        'pet_id' => $petId,
        'veterinarian_user_id' => $veterinarianUserId,
        'veterinarian_name' => vetDiagnosisNullableText($input['veterinarian_name'] ?? $input['veterinarianName'] ?? null),
        'diagnosis_type' => $diagnosisType,
        'service_name' => vetDiagnosisNullableText($input['service_name'] ?? $input['serviceName'] ?? null),
        'chief_complaint' => vetDiagnosisNullableText($input['chief_complaint'] ?? $input['chiefComplaint'] ?? null),
        'major_symptoms' => vetDiagnosisNullableText($input['major_symptoms'] ?? $input['majorSymptoms'] ?? null),
        'symptoms' => vetDiagnosisNullableText($input['symptoms'] ?? null),
        'physical_exam' => vetDiagnosisNullableText($input['physical_exam'] ?? $input['physicalExam'] ?? null),
        'diagnosis' => $diagnosisText,
        'treatment' => vetDiagnosisNullableText($input['treatment'] ?? null),
        'lab_results' => vetDiagnosisNullableText($input['lab_results'] ?? $input['labResults'] ?? null),
        'follow_up_date' => vetDiagnosisDate($input['follow_up_date'] ?? $input['followUp'] ?? null),
        'notes' => vetDiagnosisNullableText($input['notes'] ?? null),
        'vital_signs' => vetDiagnosisJsonValue($input['vital_signs'] ?? $input['vitalSigns'] ?? []),
        'prescriptions' => vetDiagnosisJsonValue($prescriptions),
        'custom_sections' => vetDiagnosisJsonValue($customSections),
        'attachments' => vetDiagnosisJsonValue($attachments),
        'source_uploads' => vetDiagnosisJsonValue($sourceUploads),
    ];

    $pdo->beginTransaction();

    $stmt = $pdo->prepare("
        INSERT INTO vet_diagnoses (
            queue_id,
            booking_id,
            assignment_id,
            pet_id,
            veterinarian_user_id,
            veterinarian_name,
            diagnosis_type,
            service_name,
            chief_complaint,
            major_symptoms,
            symptoms,
            physical_exam,
            diagnosis,
            treatment,
            lab_results,
            follow_up_date,
            notes,
            vital_signs,
            prescriptions,
            custom_sections,
            attachments,
            source_uploads,
            finalized_at
        ) VALUES (
            :queue_id,
            :booking_id,
            :assignment_id,
            :pet_id,
            :veterinarian_user_id,
            :veterinarian_name,
            :diagnosis_type,
            :service_name,
            :chief_complaint,
            :major_symptoms,
            :symptoms,
            :physical_exam,
            :diagnosis,
            :treatment,
            :lab_results,
            :follow_up_date,
            :notes,
            :vital_signs,
            :prescriptions,
            :custom_sections,
            :attachments,
            :source_uploads,
            NOW()
        )
        ON DUPLICATE KEY UPDATE
            diagnosis_id = LAST_INSERT_ID(diagnosis_id),
            booking_id = VALUES(booking_id),
            assignment_id = VALUES(assignment_id),
            pet_id = VALUES(pet_id),
            veterinarian_user_id = VALUES(veterinarian_user_id),
            veterinarian_name = VALUES(veterinarian_name),
            diagnosis_type = VALUES(diagnosis_type),
            service_name = VALUES(service_name),
            chief_complaint = VALUES(chief_complaint),
            major_symptoms = VALUES(major_symptoms),
            symptoms = VALUES(symptoms),
            physical_exam = VALUES(physical_exam),
            diagnosis = VALUES(diagnosis),
            treatment = VALUES(treatment),
            lab_results = VALUES(lab_results),
            follow_up_date = VALUES(follow_up_date),
            notes = VALUES(notes),
            vital_signs = VALUES(vital_signs),
            prescriptions = VALUES(prescriptions),
            custom_sections = VALUES(custom_sections),
            attachments = VALUES(attachments),
            source_uploads = VALUES(source_uploads),
            finalized_at = NOW()
    ");
    $stmt->execute($payload);
    $diagnosisId = (int)$pdo->lastInsertId();

    vetDiagnosisCompleteQueue($pdo, $queueId, $assignmentId);

    $pdo->commit();

    $recordStmt = $pdo->prepare("
        SELECT
            vd.*,
            q.queue_number,
            b.booking_number,
            p.pet_name,
            p.pet_species,
            p.pet_breed,
            owner.first_Name AS owner_first_name,
            owner.last_Name AS owner_last_name
        FROM vet_diagnoses vd
        LEFT JOIN pets_information p ON p.pet_id = vd.pet_id
        LEFT JOIN queues q ON q.queue_id = vd.queue_id
        LEFT JOIN bookings b ON b.booking_id = vd.booking_id
        LEFT JOIN users owner ON owner.user_id = COALESCE(q.user_id, b.user_id)
        WHERE vd.diagnosis_id = ?
        LIMIT 1
    ");
    $recordStmt->execute([$diagnosisId]);
    $record = $recordStmt->fetch(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'message' => 'Diagnosis saved.',
        'diagnosis' => $record ? vetDiagnosisFormatRow($record) : null
    ]);
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    if (http_response_code() < 400) {
        http_response_code(500);
    }

    echo json_encode(['success' => false, 'message' => 'Failed to save diagnosis: ' . $e->getMessage()]);
}
