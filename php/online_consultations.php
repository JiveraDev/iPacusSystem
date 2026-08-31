<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/online_consultation_helpers.php';
require_once __DIR__ . '/notification_helpers.php';
require_once __DIR__ . '/workflow_guard_helpers.php';
require_once __DIR__ . '/clinical_record_helpers.php';
require_once __DIR__ . '/booking_queue_helpers.php';

if (!defined('VISIT_BILLING_HELPERS_ONLY')) {
    define('VISIT_BILLING_HELPERS_ONLY', true);
}
if (!defined('VISIT_BILLING_THROW_ERRORS')) {
    define('VISIT_BILLING_THROW_ERRORS', true);
}
require_once __DIR__ . '/visit_billing.php';

header("Content-Type: application/json");

function getJsonInput(): array
{
    return json_decode(file_get_contents('php://input'), true) ?: [];
}

function onlineConsultationNullableText($value): ?string
{
    if ($value === null) {
        return null;
    }

    $text = trim((string)$value);
    return $text !== '' ? $text : null;
}

function onlineConsultationCleanJsonValue($value)
{
    if ($value === null) {
        return null;
    }

    if (is_string($value)) {
        $value = trim($value);
        return $value !== '' ? $value : null;
    }

    if (!is_array($value)) {
        return $value;
    }

    $clean = [];
    foreach ($value as $key => $item) {
        $cleanItem = onlineConsultationCleanJsonValue($item);
        if ($cleanItem !== null) {
            $clean[$key] = $cleanItem;
        }
    }

    return $clean !== [] ? $clean : null;
}

function normalizeNullableJson($value): ?string
{
    $cleanValue = onlineConsultationCleanJsonValue($value);
    if ($cleanValue === null) {
        return null;
    }

    $encoded = json_encode($cleanValue, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if ($encoded === false) {
        throw new RuntimeException('Invalid online consultation JSON payload.');
    }

    return $encoded;
}

function onlineConsultationDecodeJson($value)
{
    if ($value === null || $value === '') {
        return null;
    }

    $decoded = json_decode((string)$value, true);
    return json_last_error() === JSON_ERROR_NONE ? $decoded : null;
}

function onlineConsultationImagePaths($value): array
{
    if ($value === null || trim((string)$value) === '') {
        return [];
    }

    return array_values(array_filter(
        array_map('trim', explode(',', (string)$value)),
        static fn(string $path): bool => $path !== ''
    ));
}

function ensureMissingConfirmedOnlineConsultations(PDO $pdo, ?int $bookingId = null, ?int $vetId = null, ?int $ownerId = null): void
{
    $conditions = [
        "b.is_online_consultation = 1",
        "b.status = 'confirmed'",
        "oc.online_consultation_id IS NULL"
    ];
    $params = [];

    if ($bookingId) {
        $conditions[] = "b.booking_id = ?";
        $params[] = $bookingId;
    }
    if ($vetId) {
        $conditions[] = "b.veterinarian_id = ?";
        $params[] = $vetId;
    }
    if ($ownerId) {
        $conditions[] = "b.user_id = ?";
        $params[] = $ownerId;
    }

    $stmt = $pdo->prepare("
        SELECT b.booking_id
        FROM bookings b
        LEFT JOIN online_consultations oc ON oc.booking_id = b.booking_id
        WHERE " . implode(' AND ', $conditions)
    );
    $stmt->execute($params);

    foreach ($stmt->fetchAll(PDO::FETCH_COLUMN) as $missingBookingId) {
        try {
            createOnlineConsultationForBooking($pdo, (int)$missingBookingId);
        } catch (Exception $e) {
            error_log('Failed to auto-create online consultation for booking ' . $missingBookingId . ': ' . $e->getMessage());
        }
    }
}

function formatOnlineConsultation(array $row): array
{
    $isRegistered = ($row['registered_status'] ?? '') === 'Registered' || !empty($row['pet_name']);
    $petName = $isRegistered ? ($row['pet_name'] ?? null) : ($row['unregistered_pet_name'] ?? null);
    $petSpecies = $isRegistered ? ($row['pet_species'] ?? null) : ($row['petType'] ?? null);
    $petBreed = $isRegistered ? ($row['pet_breed'] ?? null) : ($row['unregistered_pet_breed'] ?? null);
    $ownerName = trim(($row['owner_first_name'] ?? '') . ' ' . ($row['owner_last_name'] ?? ''));
    $vetName = trim(($row['vet_first_name'] ?? '') . ' ' . ($row['vet_last_name'] ?? ''));

    if ($vetName !== '') {
        $vetName = 'Dr. ' . $vetName;
    }
    $bookingDetails = bookingOnlineConsultationNoteDetails($row['notes'] ?? '');

    $clinicalFields = clinical_record_sanitize_repeated_fields([
        'diagnosis' => onlineConsultationNullableText($row['diagnosis'] ?? null),
        'recommendations' => onlineConsultationNullableText($row['recommendations'] ?? null),
        'treatment' => onlineConsultationNullableText($row['treatment'] ?? null),
        'medications' => onlineConsultationNullableText($row['medications'] ?? null),
        'diagnosis_notes' => onlineConsultationNullableText($row['diagnosis_notes'] ?? null),
    ]);

    return [
        'id' => (int)$row['online_consultation_id'],
        'onlineConsultationId' => (int)$row['online_consultation_id'],
        'bookingId' => (int)$row['booking_id'],
        'bookingNumber' => $row['booking_number'] ?? null,
        'bookingStatus' => $row['booking_status'] ?? null,
        'ownerUserId' => (int)$row['owner_user_id'],
        'ownerName' => $ownerName,
        'ownerEmail' => $row['owner_email'] ?? null,
        'ownerPhone' => $row['owner_phone'] ?? null,
        'veterinarianUserId' => (int)$row['veterinarian_user_id'],
        'veterinarianName' => $vetName !== '' ? $vetName : 'Assigned Veterinarian',
        'veterinarianEmail' => $row['vet_email'] ?? null,
        'petName' => $petName,
        'petSpecies' => $petSpecies,
        'petBreed' => $petBreed,
        'date' => $row['booking_date'] ?? null,
        'time' => $row['booking_time'] ?? null,
        'scheduledStart' => $row['scheduled_start'],
        'scheduledEnd' => $row['scheduled_end'],
        'meetingProvider' => getJaaSAppId() !== null ? 'jaas' : $row['meeting_provider'],
        'meetingUrl' => resolveJitsiMeetingUrl($row['meeting_code'] ?? null, $row['meeting_url'] ?? null),
        'meetingCode' => $row['meeting_code'],
        'status' => $row['status'],
        'vetStartedAt' => $row['vet_started_at'],
        'ownerJoinedAt' => $row['owner_joined_at'],
        'endedAt' => $row['ended_at'],
        'notes' => $bookingDetails['additionalNotes'],
        'discussionTopic' => $bookingDetails['discussionTopic'],
        'discussionTopics' => $bookingDetails['discussionTopics'],
        'concernImages' => onlineConsultationImagePaths($row['booking_concern_images'] ?? null),
        'diagnosis' => $clinicalFields['diagnosis'],
        'recommendations' => $clinicalFields['recommendations'],
        'treatment' => $clinicalFields['treatment'],
        'medications' => $clinicalFields['medications'],
        'diagnosisNotes' => $clinicalFields['diagnosis_notes'],
        'vitalSigns' => onlineConsultationDecodeJson($row['vital_signs'] ?? null),
        'symptoms' => onlineConsultationDecodeJson($row['diagnosis_symptoms'] ?? null),
        'labTests' => onlineConsultationDecodeJson($row['lab_tests'] ?? null),
        'createdAt' => $row['created_at'],
        'updatedAt' => $row['updated_at'],
    ];
}

function attachOnlineConsultationMeetingAccess(?array $consultation, array $currentUser): ?array
{
    if ($consultation === null) {
        return null;
    }

    $meetingCode = trim((string)($consultation['meetingCode'] ?? ''));
    $meetingJwt = $meetingCode !== '' ? createJaaSMeetingJwt($currentUser, $meetingCode) : null;

    if ($meetingJwt !== null) {
        $consultation['meetingJwt'] = $meetingJwt;
    }

    return $consultation;
}

function fetchOnlineConsultationResponse(PDO $pdo, int $id, array $currentUser): ?array
{
    return attachOnlineConsultationMeetingAccess(
        fetchOnlineConsultations($pdo, ['id' => $id])[0] ?? null,
        $currentUser
    );
}

function fetchOnlineConsultations(PDO $pdo, array $filters = []): array
{
    $conditions = [];
    $params = [];

    if (!empty($filters['id'])) {
        $conditions[] = "oc.online_consultation_id = ?";
        $params[] = (int)$filters['id'];
    }
    if (!empty($filters['bookingId'])) {
        $conditions[] = "oc.booking_id = ?";
        $params[] = (int)$filters['bookingId'];
    }
    if (!empty($filters['vetId'])) {
        $conditions[] = "oc.veterinarian_user_id = ?";
        $params[] = (int)$filters['vetId'];
    }
    if (!empty($filters['ownerId'])) {
        $conditions[] = "oc.owner_user_id = ?";
        $params[] = (int)$filters['ownerId'];
    }

    $where = $conditions ? 'WHERE ' . implode(' AND ', $conditions) : '';
    $diagnosisJoin = onlineConsultationTableExists($pdo, 'online_consultation_diagnoses')
        ? "LEFT JOIN online_consultation_diagnoses d ON d.online_consultation_id = oc.online_consultation_id"
        : "";
    $diagnosisSelect = onlineConsultationTableExists($pdo, 'online_consultation_diagnoses')
        ? "d.diagnosis, d.recommendations, d.treatment, d.medications, d.notes AS diagnosis_notes,
            d.vital_signs, d.symptoms AS diagnosis_symptoms, d.lab_tests,"
        : "NULL AS diagnosis, NULL AS recommendations, NULL AS treatment, NULL AS medications, NULL AS diagnosis_notes,
            NULL AS vital_signs, NULL AS diagnosis_symptoms, NULL AS lab_tests,";

    $stmt = $pdo->prepare("
        SELECT
            oc.*,
            b.booking_number,
            b.booking_date,
            b.booking_time,
            b.status AS booking_status,
            b.notes,
            b.Image_Booking_Concern_Path AS booking_concern_images,
            b.registered_status,
            b.petType,
            b.unregistered_pet_name,
            b.unregistered_pet_breed,
            p.pet_name,
            p.pet_species,
            p.pet_breed,
            owner.first_Name AS owner_first_name,
            owner.last_Name AS owner_last_name,
            owner.mail_Address AS owner_email,
            owner.phoneNumber AS owner_phone,
            vet.first_Name AS vet_first_name,
            vet.last_Name AS vet_last_name,
            vet.mail_Address AS vet_email,
            {$diagnosisSelect}
            1 AS select_marker
        FROM online_consultations oc
        JOIN bookings b ON b.booking_id = oc.booking_id
        LEFT JOIN pets_information p ON p.pet_id = b.pet_id
        JOIN users owner ON owner.user_id = oc.owner_user_id
        JOIN users vet ON vet.user_id = oc.veterinarian_user_id
        {$diagnosisJoin}
        {$where}
        ORDER BY oc.scheduled_start ASC, oc.created_at DESC
    ");
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $historyByConsultation = fetchOnlineConsultationRescheduleHistoryMap(
        $pdo,
        array_column($rows, 'online_consultation_id')
    );

    return array_map(function (array $row) use ($historyByConsultation): array {
        $consultation = formatOnlineConsultation($row);
        $consultation['reschedules'] = $historyByConsultation[(int)$row['online_consultation_id']] ?? [];

        return $consultation;
    }, $rows);
}

function fetchOnlineConsultationActionRow(PDO $pdo, int $id, bool $lock = false): ?array
{
    $stmt = $pdo->prepare("
        SELECT oc.*, b.status AS booking_status
        FROM online_consultations oc
        JOIN bookings b ON b.booking_id = oc.booking_id
        WHERE oc.online_consultation_id = ?
        LIMIT 1
        " . ($lock ? "FOR UPDATE" : "") . "
    ");
    $stmt->execute([$id]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    return $row ?: null;
}

function onlineConsultationEnsureVetActor(array $consultation, string $role, int $userId): void
{
    if ($role === 'veterinarian' && (int)$consultation['veterinarian_user_id'] !== $userId) {
        ipawcus_guard_error(403, 'You are not assigned to this online consultation.');
    }

    if (!in_array($role, ['veterinarian', 'super_admin'], true)) {
        ipawcus_guard_error(403, 'Only the assigned veterinarian can perform this action.');
    }
}

function onlineConsultationEnsureOwnerOrVetActor(array $consultation, string $role, int $userId): void
{
    if ($role === 'pet_owner' && (int)$consultation['owner_user_id'] !== $userId) {
        ipawcus_guard_error(403, 'You are not allowed to join this online consultation.');
    }

    if ($role === 'veterinarian' && (int)$consultation['veterinarian_user_id'] !== $userId) {
        ipawcus_guard_error(403, 'You are not assigned to this online consultation.');
    }
}

function onlineConsultationRejectClosed(array $consultation): void
{
    $status = strtolower((string)($consultation['status'] ?? ''));
    $bookingStatus = strtolower((string)($consultation['booking_status'] ?? ''));
    if (
        in_array($status, ['completed', 'cancelled', 'no_show'], true)
        || in_array($bookingStatus, ['completed', 'cancelled', 'no_show'], true)
    ) {
        ipawcus_guard_error(409, 'This online consultation is already closed.');
    }
}

function onlineConsultationEnsureOwnerJoinWindow(array $consultation, string $role): void
{
    if ($role !== 'pet_owner') {
        return;
    }

    if (strtolower((string)($consultation['booking_status'] ?? '')) !== 'confirmed') {
        ipawcus_guard_error(409, 'This consultation must be confirmed before joining.');
    }

    if (trim((string)($consultation['meeting_url'] ?? '')) === '') {
        ipawcus_guard_error(409, 'The consultation room is not available yet.');
    }

    $status = strtolower((string)($consultation['status'] ?? ''));
    if (!in_array($status, ['vet_ready', 'in_progress'], true)) {
        ipawcus_guard_error(409, 'Please wait for the veterinarian to start the consultation.');
    }

    // Owners can join as soon as the veterinarian marks the room ready. The
    // scheduled time is informational and must not block a live consultation.
}

try {
    if (!onlineConsultationTableExists($pdo, 'online_consultations')) {
        http_response_code(500);
        echo json_encode(['message' => 'online_consultations table does not exist.']);
        exit;
    }

    $method = $_SERVER['REQUEST_METHOD'];
    $action = $_GET['action'] ?? null;
    $id = isset($_GET['onlineConsultationId']) ? (int)$_GET['onlineConsultationId'] : null;
    $currentApiUser = ipawcus_guard_current_user($pdo);
    $currentApiRole = ipawcus_guard_role($currentApiUser);
    $currentApiUserId = ipawcus_guard_user_id($currentApiUser);

    if ($method === 'GET') {
        $bookingId = isset($_GET['bookingId']) ? (int)$_GET['bookingId'] : null;
        $vetId = isset($_GET['vetId']) ? (int)$_GET['vetId'] : null;
        $ownerId = isset($_GET['ownerId']) ? (int)$_GET['ownerId'] : null;

        if ($currentApiRole === 'pet_owner') {
            if ($ownerId && $ownerId !== $currentApiUserId) {
                ipawcus_guard_error(403, 'You can only view your own online consultations.');
            }
            $ownerId = $currentApiUserId;
        } elseif ($currentApiRole === 'veterinarian') {
            if ($vetId && $vetId !== $currentApiUserId) {
                ipawcus_guard_error(403, 'You can only view online consultations assigned to you.');
            }
            $vetId = $currentApiUserId;
        }

        ensureMissingConfirmedOnlineConsultations($pdo, $bookingId, $vetId, $ownerId);
        $consultations = fetchOnlineConsultations($pdo, [
            'id' => $id,
            'bookingId' => $bookingId,
            'vetId' => $vetId,
            'ownerId' => $ownerId,
        ]);
        if ($id && isset($consultations[0])) {
            $consultations[0] = attachOnlineConsultationMeetingAccess($consultations[0], $currentApiUser);
        }
        echo json_encode($consultations);
        exit;
    }

    if (!$id) {
        http_response_code(400);
        echo json_encode(['message' => 'Online consultation ID is required.']);
        exit;
    }

    if ($method === 'POST' && $action === 'start') {
        $consultation = fetchOnlineConsultationActionRow($pdo, $id);
        if (!$consultation) {
            ipawcus_guard_error(404, 'Online consultation not found.');
        }
        onlineConsultationEnsureVetActor($consultation, $currentApiRole, $currentApiUserId);
        onlineConsultationRejectClosed($consultation);

        $stmt = $pdo->prepare("
            UPDATE online_consultations
            SET status = CASE WHEN status = 'in_progress' THEN 'in_progress' ELSE 'vet_ready' END,
                vet_started_at = COALESCE(vet_started_at, NOW())
            WHERE online_consultation_id = ?
              AND status IN ('scheduled', 'vet_ready', 'in_progress')
        ");
        $stmt->execute([$id]);

        try {
            notification_send_online_consultation_event($pdo, $id, 'vet_ready');
        } catch (Throwable $notificationError) {
            error_log('Online consultation ready notification failed: ' . $notificationError->getMessage());
        }

        echo json_encode(fetchOnlineConsultationResponse($pdo, $id, $currentApiUser));
        exit;
    }

    if ($method === 'POST' && $action === 'join') {
        $consultation = fetchOnlineConsultationActionRow($pdo, $id);
        if (!$consultation) {
            ipawcus_guard_error(404, 'Online consultation not found.');
        }
        onlineConsultationEnsureOwnerOrVetActor($consultation, $currentApiRole, $currentApiUserId);
        onlineConsultationRejectClosed($consultation);
        onlineConsultationEnsureOwnerJoinWindow($consultation, $currentApiRole);

        $stmt = $pdo->prepare("
            UPDATE online_consultations
            SET status = CASE WHEN status = 'vet_ready' THEN 'in_progress' ELSE status END,
                owner_joined_at = COALESCE(owner_joined_at, NOW())
            WHERE online_consultation_id = ?
              AND status IN ('vet_ready', 'in_progress')
        ");
        $stmt->execute([$id]);

        if ($currentApiRole === 'pet_owner') {
            try {
                notification_send_online_consultation_event($pdo, $id, 'owner_joined');
            } catch (Throwable $notificationError) {
                error_log('Online consultation join notification failed: ' . $notificationError->getMessage());
            }
        }

        echo json_encode(fetchOnlineConsultationResponse($pdo, $id, $currentApiUser));
        exit;
    }

    if ($method === 'POST' && $action === 'end') {
        $pdo->beginTransaction();
        $consultation = fetchOnlineConsultationActionRow($pdo, $id, true);
        if (!$consultation) {
            throw new RuntimeException('Online consultation not found.');
        }
        onlineConsultationEnsureVetActor($consultation, $currentApiRole, $currentApiUserId);
        onlineConsultationRejectClosed($consultation);

        $stmt = $pdo->prepare("
            UPDATE online_consultations
            SET ended_at = COALESCE(ended_at, NOW())
            WHERE online_consultation_id = ?
        ");
        $stmt->execute([$id]);
        $pdo->commit();

        echo json_encode(fetchOnlineConsultationResponse($pdo, $id, $currentApiUser));
        exit;
    }

    if ($method === 'POST' && $action === 'diagnosis') {
        if (!onlineConsultationTableExists($pdo, 'online_consultation_diagnoses')) {
            throw new RuntimeException('online_consultation_diagnoses table does not exist.');
        }

        $input = getJsonInput();
        $clinicalInput = clinical_record_sanitize_repeated_fields([
            'diagnosis' => onlineConsultationNullableText($input['diagnosis'] ?? null),
            'recommendations' => onlineConsultationNullableText($input['recommendations'] ?? null),
            'treatment' => onlineConsultationNullableText($input['treatment'] ?? null),
            'medications' => onlineConsultationNullableText($input['medications'] ?? null),
            'diagnosis_notes' => onlineConsultationNullableText($input['notes'] ?? null),
        ]);
        $diagnosis = $clinicalInput['diagnosis'];
        if ($diagnosis === null) {
            http_response_code(400);
            echo json_encode(['message' => 'Diagnosis is required.']);
            exit;
        }

        $pdo->beginTransaction();
        $consultation = fetchOnlineConsultationActionRow($pdo, $id, true);
        if (!$consultation) {
            throw new RuntimeException('Online consultation not found.');
        }
        onlineConsultationEnsureVetActor($consultation, $currentApiRole, $currentApiUserId);

        $existingDiagnosisStmt = $pdo->prepare("
            SELECT diagnosis_id
            FROM online_consultation_diagnoses
            WHERE online_consultation_id = ?
            LIMIT 1
            FOR UPDATE
        ");
        $existingDiagnosisStmt->execute([$id]);
        $existingDiagnosisId = (int)($existingDiagnosisStmt->fetchColumn() ?: 0);

        if (strtolower((string)$consultation['status']) === 'completed' && $existingDiagnosisId > 0) {
            $visitBilling = visit_billing_ensure_online_consultation_visit(
                $pdo,
                $id,
                $currentApiUserId
            );
            $pdo->commit();
            try {
                notification_send_online_consultation_event($pdo, $id, 'completed');
            } catch (Throwable $notificationError) {
                error_log('Online consultation completion notification retry failed: ' . $notificationError->getMessage());
            }
            try {
                if (!empty($visitBilling['chargeCreated']) && !empty($visitBilling['visitId'])) {
                    notification_send_visit_event($pdo, (int)$visitBilling['visitId'], 'invoice_ready');
                }
            } catch (Throwable $notificationError) {
                error_log('Online consultation invoice notification retry failed: ' . $notificationError->getMessage());
            }
            echo json_encode(fetchOnlineConsultationResponse($pdo, $id, $currentApiUser));
            exit;
        }

        if (strtolower((string)$consultation['booking_status']) === 'completed' && $existingDiagnosisId <= 0) {
            ipawcus_guard_error(409, 'This booking is already completed without an online diagnosis record.');
        }

        onlineConsultationRejectClosed($consultation);

        $stmt = $pdo->prepare("
            INSERT INTO online_consultation_diagnoses (
                online_consultation_id,
                booking_id,
                veterinarian_user_id,
                diagnosis,
                recommendations,
                treatment,
                medications,
                notes,
                vital_signs,
                symptoms,
                lab_tests,
                finalized_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE
                diagnosis = VALUES(diagnosis),
                recommendations = VALUES(recommendations),
                treatment = VALUES(treatment),
                medications = VALUES(medications),
                notes = VALUES(notes),
                vital_signs = VALUES(vital_signs),
                symptoms = VALUES(symptoms),
                lab_tests = VALUES(lab_tests),
                finalized_at = NOW()
        ");
        $stmt->execute([
            $id,
            (int)$consultation['booking_id'],
            (int)$consultation['veterinarian_user_id'],
            $diagnosis,
            $clinicalInput['recommendations'],
            $clinicalInput['treatment'],
            $clinicalInput['medications'],
            $clinicalInput['diagnosis_notes'],
            normalizeNullableJson($input['vitalSigns'] ?? null),
            normalizeNullableJson($input['symptoms'] ?? null),
            normalizeNullableJson($input['labTests'] ?? null),
        ]);

        $updateConsultation = $pdo->prepare("
            UPDATE online_consultations
            SET status = 'completed',
                ended_at = COALESCE(ended_at, NOW())
            WHERE online_consultation_id = ?
        ");
        $updateConsultation->execute([$id]);

        $updateBooking = $pdo->prepare("UPDATE bookings SET status = 'completed' WHERE booking_id = ? AND status = 'confirmed'");
        $updateBooking->execute([(int)$consultation['booking_id']]);
        if ($updateBooking->rowCount() === 0 && strtolower((string)$consultation['booking_status']) !== 'completed') {
            throw new RuntimeException('Online consultation booking is not in a confirmable state.');
        }

        $visitBilling = visit_billing_ensure_online_consultation_visit(
            $pdo,
            $id,
            $currentApiUserId
        );
        $pdo->commit();

        try {
            notification_send_online_consultation_event($pdo, $id, 'completed');
        } catch (Throwable $notificationError) {
            error_log('Online consultation completion notification failed: ' . $notificationError->getMessage());
        }
        try {
            if (!empty($visitBilling['chargeCreated']) && !empty($visitBilling['visitId'])) {
                notification_send_visit_event($pdo, (int)$visitBilling['visitId'], 'invoice_ready');
            }
        } catch (Throwable $notificationError) {
            error_log('Online consultation invoice notification failed: ' . $notificationError->getMessage());
        }

        echo json_encode(fetchOnlineConsultationResponse($pdo, $id, $currentApiUser));
        exit;
    }

    http_response_code(405);
    echo json_encode(['message' => 'Method or action not allowed.']);
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    $statusCode = http_response_code();
    http_response_code($statusCode >= 400 ? $statusCode : 500);
    echo json_encode(['message' => 'Online consultation error: ' . $e->getMessage()]);
}
