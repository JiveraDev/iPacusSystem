<?php

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/workflow_guard_helpers.php';
require_once __DIR__ . '/branch_helpers.php';
require_once __DIR__ . '/consent_record_helpers.php';

header('Content-Type: application/json');

function clinical_intake_schema_ready(PDO $pdo): bool
{
    return ipawcus_guard_table_exists($pdo, 'clinical_intakes');
}

function clinical_intake_require_schema(PDO $pdo): void
{
    if (!clinical_intake_schema_ready($pdo)) {
        error_log('Pet Intake setup required: apply DDL/20261004_01_clinical_intakes.sql to the application database.');
        ipawcus_guard_error(503, 'Pet Intake setup is incomplete. Ask your clinic administrator to finish setup, then refresh.', [
            'schemaReady' => false,
            'code' => 'clinical_intake_schema_missing',
        ]);
    }
}

function clinical_intake_nullable_int($value): ?int
{
    if ($value === null || $value === '' || !is_numeric($value)) return null;
    $number = (int)$value;
    return $number > 0 ? $number : null;
}

function clinical_intake_text($value, int $maxLength = 10000): string
{
    $text = trim((string)($value ?? ''));
    if (mb_strlen($text) > $maxLength) {
        ipawcus_guard_error(422, "Clinical text cannot exceed {$maxLength} characters.");
    }
    return $text;
}

function clinical_intake_json_array($value): array
{
    if (is_string($value)) {
        $decoded = json_decode($value, true);
        return is_array($decoded) ? $decoded : [];
    }
    return is_array($value) ? $value : [];
}

function clinical_intake_vital_signs($value): array
{
    $source = clinical_intake_json_array($value);
    $allowed = ['temperature', 'heartRate', 'respiratoryRate', 'weight'];
    $result = [];
    foreach ($allowed as $key) {
        $result[$key] = mb_substr(trim((string)($source[$key] ?? '')), 0, 40);
    }
    return $result;
}

function clinical_intake_attachments($value): array
{
    $source = clinical_intake_json_array($value);
    $allowedFields = ['chiefComplaint', 'symptoms', 'majorSymptoms', 'vitalSigns', 'physicalExam'];
    $attachments = [];

    foreach (array_slice($source, 0, 40) as $attachment) {
        if (!is_array($attachment)) continue;
        $url = trim((string)($attachment['url'] ?? $attachment['relativeUrl'] ?? ''));
        $fieldKey = trim((string)($attachment['fieldKey'] ?? $attachment['field_key'] ?? ''));
        if ($url === '' || !in_array($fieldKey, $allowedFields, true)) continue;

        $attachments[] = [
            'id' => mb_substr(trim((string)($attachment['id'] ?? '')), 0, 120) ?: bin2hex(random_bytes(8)),
            'fieldKey' => $fieldKey,
            'url' => mb_substr($url, 0, 1000),
            'relativeUrl' => mb_substr(trim((string)($attachment['relativeUrl'] ?? $url)), 0, 1000),
            'name' => mb_substr(trim((string)($attachment['name'] ?? $attachment['displayName'] ?? 'Examination photo')), 0, 255),
            'mimeType' => mb_substr(trim((string)($attachment['mimeType'] ?? $attachment['mime_type'] ?? 'image/jpeg')), 0, 120),
            'uploadedAt' => mb_substr(trim((string)($attachment['uploadedAt'] ?? date(DATE_ATOM))), 0, 80),
        ];
    }

    return $attachments;
}

function clinical_intake_staff_position(PDO $pdo, int $userId, string $role): string
{
    if ($role === 'super_admin') return 'Super Admin';
    if ($role !== 'admin' || !ipawcus_guard_table_exists($pdo, 'admin_profiles')) return 'Admin';

    $stmt = $pdo->prepare('SELECT postionn FROM admin_profiles WHERE user_id = ? LIMIT 1');
    $stmt->execute([$userId]);
    $position = trim((string)($stmt->fetchColumn() ?: ''));
    return $position !== '' ? $position : 'Admin';
}

function clinical_intake_format(array $row): array
{
    return [
        'intakeId' => (int)$row['intake_id'],
        'queueId' => (int)$row['queue_id'],
        'bookingId' => $row['booking_id'] !== null ? (int)$row['booking_id'] : null,
        'petId' => (int)$row['pet_id'],
        'assignedVeterinarianUserId' => (int)$row['assigned_veterinarian_user_id'],
        'recordedByUserId' => (int)$row['recorded_by_user_id'],
        'recordedByName' => (string)$row['recorded_by_name'],
        'recordedByPosition' => (string)($row['recorded_by_position'] ?? ''),
        'status' => (string)$row['status'],
        'chiefComplaint' => (string)($row['chief_complaint'] ?? ''),
        'symptoms' => (string)($row['symptoms'] ?? ''),
        'majorSymptoms' => (string)($row['major_symptoms'] ?? ''),
        'physicalExam' => (string)($row['physical_exam'] ?? ''),
        'vitalSigns' => clinical_intake_vital_signs($row['vital_signs'] ?? []),
        'attachments' => clinical_intake_attachments($row['attachments'] ?? []),
        'startedAt' => $row['started_at'] ?? null,
        'completedAt' => $row['completed_at'] ?? null,
        'createdAt' => $row['created_at'] ?? null,
        'updatedAt' => $row['updated_at'] ?? null,
    ];
}

function clinical_intake_fetch(PDO $pdo, int $intakeId): ?array
{
    $stmt = $pdo->prepare('SELECT * FROM clinical_intakes WHERE intake_id = ? LIMIT 1');
    $stmt->execute([$intakeId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return $row ?: null;
}

function clinical_intake_assert_branch_access(PDO $pdo, array $currentUser, int $queueId): void
{
    $role = ipawcus_guard_role($currentUser);
    if ($role !== 'admin') return;

    $stmt = $pdo->prepare('SELECT branch_id FROM queues WHERE queue_id = ? LIMIT 1');
    $stmt->execute([$queueId]);
    $branchId = (int)($stmt->fetchColumn() ?: 0);
    if ($branchId <= 0 || !branch_user_can_access($pdo, $currentUser, $branchId)) {
        ipawcus_guard_error(403, 'This patient belongs to another clinic location.');
    }
}

$currentUser = ipawcus_guard_current_user($pdo);
$currentRole = ipawcus_guard_role($currentUser);
$currentUserId = ipawcus_guard_user_id($currentUser);
$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));

clinical_intake_require_schema($pdo);

if ($method === 'GET') {
    $conditions = [];
    $params = [];
    $intakeId = clinical_intake_nullable_int($_GET['intakeId'] ?? $_GET['id'] ?? null);
    $queueId = clinical_intake_nullable_int($_GET['queueId'] ?? null);
    $bookingId = clinical_intake_nullable_int($_GET['bookingId'] ?? null);

    if ($intakeId) {
        $conditions[] = 'ci.intake_id = ?';
        $params[] = $intakeId;
    }
    if ($queueId) {
        $conditions[] = 'ci.queue_id = ?';
        $params[] = $queueId;
    }
    if ($bookingId) {
        $conditions[] = 'ci.booking_id = ?';
        $params[] = $bookingId;
    }
    if ($currentRole === 'veterinarian') {
        $conditions[] = 'ci.assigned_veterinarian_user_id = ?';
        $params[] = $currentUserId;
    } elseif (!ipawcus_guard_is_admin_role($currentRole)) {
        ipawcus_guard_error(403, 'Only clinic staff can view pet intake records.');
    }

    if (($_GET['checkSetup'] ?? '') === '1') {
        echo json_encode(['success' => true, 'schemaReady' => true]);
        exit;
    }

    $where = $conditions ? 'WHERE ' . implode(' AND ', $conditions) : '';
    $stmt = $pdo->prepare("SELECT ci.* FROM clinical_intakes ci {$where} ORDER BY ci.updated_at DESC, ci.intake_id DESC");
    $stmt->execute($params);
    $records = array_map('clinical_intake_format', $stmt->fetchAll(PDO::FETCH_ASSOC));
    echo json_encode(['success' => true, 'schemaReady' => true, 'records' => $records]);
    exit;
}

if (!ipawcus_guard_is_admin_role($currentRole)) {
    ipawcus_guard_error(403, 'Only authorized Admin staff can record a physical examination.');
}

$input = json_decode(file_get_contents('php://input'), true) ?: [];

if ($method === 'POST') {
    $queueId = clinical_intake_nullable_int($input['queue_id'] ?? $input['queueId'] ?? null);
    if (!$queueId) ipawcus_guard_error(422, 'Select an assigned queue patient before starting the examination.');
    clinical_intake_assert_branch_access($pdo, $currentUser, $queueId);

    $queueStmt = $pdo->prepare("SELECT q.queue_id, q.booking_id, q.pet_id, q.status,
        vqa.veterinarian_user_id
        FROM queues q
        LEFT JOIN vet_queue_assignments vqa ON vqa.assignment_id = (
            SELECT active.assignment_id FROM vet_queue_assignments active
            WHERE active.queue_id = q.queue_id AND active.status = 'received'
            ORDER BY active.assignment_id DESC LIMIT 1
        )
        WHERE q.queue_id = ? LIMIT 1");
    $queueStmt->execute([$queueId]);
    $queue = $queueStmt->fetch(PDO::FETCH_ASSOC);
    if (!$queue) ipawcus_guard_error(404, 'Queue patient was not found.');
    if ((string)$queue['status'] !== 'in-progress') ipawcus_guard_error(409, 'Approve this patient before starting the examination.');
    $vetId = (int)($queue['veterinarian_user_id'] ?? 0);
    if ($vetId <= 0) ipawcus_guard_error(409, 'Assign a veterinarian before starting the examination.');

    $existingStmt = $pdo->prepare('SELECT * FROM clinical_intakes WHERE queue_id = ? LIMIT 1');
    $existingStmt->execute([$queueId]);
    $existing = $existingStmt->fetch(PDO::FETCH_ASSOC);
    if ($existing) {
        if ((int)($existing['assigned_veterinarian_user_id'] ?? 0) !== $vetId) {
            $syncStmt = $pdo->prepare('UPDATE clinical_intakes SET assigned_veterinarian_user_id = ? WHERE intake_id = ?');
            $syncStmt->execute([$vetId, (int)$existing['intake_id']]);
            $existing = clinical_intake_fetch($pdo, (int)$existing['intake_id']);
        }
        echo json_encode(['success' => true, 'intake' => clinical_intake_format($existing), 'existing' => true]);
        exit;
    }

    $recordedByName = trim((string)($currentUser['first_Name'] ?? '') . ' ' . (string)($currentUser['last_Name'] ?? ''));
    if ($recordedByName === '') $recordedByName = (string)($currentUser['mail_Address'] ?? 'Clinic staff');
    $position = clinical_intake_staff_position($pdo, $currentUserId, $currentRole);
    $bookingId = clinical_intake_nullable_int($queue['booking_id'] ?? $input['booking_id'] ?? $input['bookingId'] ?? null);

    $stmt = $pdo->prepare("INSERT INTO clinical_intakes
        (queue_id, booking_id, pet_id, assigned_veterinarian_user_id, recorded_by_user_id, recorded_by_name, recorded_by_position, status, vital_signs, attachments, started_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'in_progress', ?, ?, NOW())");
    $stmt->execute([
        $queueId,
        $bookingId,
        (int)$queue['pet_id'],
        $vetId,
        $currentUserId,
        $recordedByName,
        $position,
        json_encode(clinical_intake_vital_signs([])),
        json_encode([]),
    ]);
    $record = clinical_intake_fetch($pdo, (int)$pdo->lastInsertId());
    echo json_encode(['success' => true, 'intake' => clinical_intake_format($record), 'existing' => false]);
    exit;
}

if ($method === 'PATCH') {
    $intakeId = clinical_intake_nullable_int($input['intake_id'] ?? $input['intakeId'] ?? null);
    if (!$intakeId) ipawcus_guard_error(422, 'Pet intake ID is required.');
    $record = clinical_intake_fetch($pdo, $intakeId);
    if (!$record) ipawcus_guard_error(404, 'Pet intake was not found.');
    clinical_intake_assert_branch_access($pdo, $currentUser, (int)$record['queue_id']);

    $status = strtolower(trim((string)($input['status'] ?? $record['status'])));
    if (!in_array($status, ['in_progress', 'completed'], true)) {
        ipawcus_guard_error(422, 'Invalid examination status.');
    }

    if ($status === 'completed') {
        $queueConsentRecords = consent_record_fetch_queue_records($pdo, [(int)$record['queue_id']]);
        $consentFields = consent_record_queue_compatibility_fields(
            $queueConsentRecords[(int)$record['queue_id']] ?? []
        );
        if (empty($consentFields['signed_consent_document_path']) && empty($consentFields['physical_consent_path'])) {
            ipawcus_guard_error(409, 'Capture and save the pet owner consent before completing the physical examination.');
        }
    }

    $stmt = $pdo->prepare("UPDATE clinical_intakes SET
        chief_complaint = ?, symptoms = ?, major_symptoms = ?, physical_exam = ?,
        vital_signs = ?, attachments = ?, status = ?,
        completed_at = CASE WHEN ? = 'completed' THEN COALESCE(completed_at, NOW()) ELSE NULL END
        WHERE intake_id = ?");
    $stmt->execute([
        clinical_intake_text($input['chief_complaint'] ?? $input['chiefComplaint'] ?? $record['chief_complaint']),
        clinical_intake_text($input['symptoms'] ?? $record['symptoms']),
        clinical_intake_text($input['major_symptoms'] ?? $input['majorSymptoms'] ?? $record['major_symptoms']),
        clinical_intake_text($input['physical_exam'] ?? $input['physicalExam'] ?? $record['physical_exam']),
        json_encode(clinical_intake_vital_signs($input['vital_signs'] ?? $input['vitalSigns'] ?? $record['vital_signs'])),
        json_encode(clinical_intake_attachments($input['attachments'] ?? $record['attachments'])),
        $status,
        $status,
        $intakeId,
    ]);

    $updated = clinical_intake_fetch($pdo, $intakeId);
    echo json_encode([
        'success' => true,
        'message' => $status === 'completed' ? 'Physical examination completed.' : 'Physical examination saved.',
        'intake' => clinical_intake_format($updated),
    ]);
    exit;
}

ipawcus_guard_error(405, 'Method not allowed.');
