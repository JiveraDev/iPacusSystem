<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/notification_helpers.php';
require_once __DIR__ . '/workflow_guard_helpers.php';
require_once __DIR__ . '/branch_helpers.php';
require_once __DIR__ . '/payment_method_helpers.php';

header('Content-Type: application/json');

function record_request_input(): array
{
    return json_decode(file_get_contents('php://input'), true) ?: [];
}

function record_request_error(int $statusCode, string $message): void
{
    global $pdo;

    if ($pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    http_response_code($statusCode);
    echo json_encode(['success' => false, 'message' => $message]);
    exit;
}

function record_request_table_exists(PDO $pdo, string $tableName): bool
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

function record_request_nullable_int($value): ?int
{
    if ($value === null || $value === '') {
        return null;
    }

    return is_numeric($value) ? (int)$value : null;
}

function record_request_nullable_text($value): ?string
{
    $text = trim((string)($value ?? ''));

    return $text === '' ? null : $text;
}

function record_request_resolve_pet_id(PDO $pdo, $petId): int
{
    $rawPetId = trim((string)$petId);
    if ($rawPetId === '') {
        record_request_error(400, 'Pet ID is required.');
    }

    if (strpos($rawPetId, 'PET-') === 0) {
        $stmt = $pdo->prepare("SELECT pet_id FROM pets_information WHERE pet_sharable_ID = ? LIMIT 1");
        $stmt->execute([$rawPetId]);
        $resolved = $stmt->fetchColumn();
        if (!$resolved) {
            record_request_error(404, 'Pet was not found.');
        }

        return (int)$resolved;
    }

    if (!is_numeric($rawPetId)) {
        record_request_error(400, 'Pet ID is invalid.');
    }

    $stmt = $pdo->prepare("SELECT pet_id FROM pets_information WHERE pet_id = ? LIMIT 1");
    $stmt->execute([(int)$rawPetId]);
    $resolved = $stmt->fetchColumn();
    if (!$resolved) {
        record_request_error(404, 'Pet was not found.');
    }

    return (int)$resolved;
}

function record_request_ensure_schema(PDO $pdo): void
{
    if (!record_request_table_exists($pdo, 'pet_record_update_requests')) {
        record_request_error(409, 'Record update request table is missing. No runtime schema changes were attempted.');
    }
}

function record_request_allowed_statuses(): array
{
    return ['pending_admin_review', 'approved', 'rejected', 'assigned', 'in_progress', 'completed', 'cancelled'];
}

function record_request_allowed_payment_statuses(): array
{
    return ['pending', 'submitted', 'verified', 'waived', 'rejected'];
}

function record_request_validate_status(?string $status): ?string
{
    $value = record_request_nullable_text($status);
    if ($value === null) {
        return null;
    }
    if (!in_array($value, record_request_allowed_statuses(), true)) {
        record_request_error(422, 'Invalid record update request status.');
    }

    return $value;
}

function record_request_validate_payment_status(?string $status): ?string
{
    $value = record_request_nullable_text($status);
    if ($value === null) {
        return null;
    }
    if (!in_array($value, record_request_allowed_payment_statuses(), true)) {
        record_request_error(422, 'Invalid record update payment status.');
    }

    return $value;
}

function record_request_payment_is_cleared(array $request): bool
{
    return in_array((string)($request['payment_status'] ?? ''), ['verified', 'waived'], true);
}

function record_request_require_cleared_payment(array $request, string $actionLabel): void
{
    if (!record_request_payment_is_cleared($request)) {
        record_request_error(
            409,
            "Payment must be verified or waived before this request can be {$actionLabel}."
        );
    }
}

function record_request_require_action_status(array $request, string $action, array $allowedStatuses): void
{
    $currentStatus = (string)($request['status'] ?? '');
    if (!in_array($currentStatus, $allowedStatuses, true)) {
        record_request_error(
            409,
            "A request with status {$currentStatus} cannot be {$action}."
        );
    }
}

function record_request_require_veterinarian(PDO $pdo, int $userId): void
{
    if ($userId <= 0) {
        record_request_error(400, 'Select a veterinarian to assign.');
    }

    $hasAccountStatus = ipawcus_guard_column_exists($pdo, 'users', 'account_status');
    $hasVeterinarianProfiles = record_request_table_exists($pdo, 'veterinarian_profiles');
    $hasProfileIsActive = $hasVeterinarianProfiles
        && ipawcus_guard_column_exists($pdo, 'veterinarian_profiles', 'is_active');
    $hasProfileIsAcceptingPatients = $hasVeterinarianProfiles
        && ipawcus_guard_column_exists($pdo, 'veterinarian_profiles', 'is_accepting_patients');
    $stmt = $pdo->prepare("
        SELECT
            u.role,
            " . ($hasAccountStatus ? 'u.account_status' : "'active' AS account_status") . ",
            " . ($hasVeterinarianProfiles ? 'vp.user_id AS profile_user_id' : 'u.user_id AS profile_user_id') . ",
            " . ($hasProfileIsActive ? 'COALESCE(vp.is_active, 1)' : '1') . " AS profile_is_active,
            " . ($hasProfileIsAcceptingPatients ? 'COALESCE(vp.is_accepting_patients, 1)' : '1') . " AS profile_is_accepting_patients
        FROM users u
        " . ($hasVeterinarianProfiles ? 'LEFT JOIN veterinarian_profiles vp ON vp.user_id = u.user_id' : '') . "
        WHERE u.user_id = ?
        LIMIT 1
    ");
    $stmt->execute([$userId]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];
    $role = ipawcus_access_normalize_role((string)($user['role'] ?? ''));
    $accountStatus = strtolower(trim((string)($user['account_status'] ?? 'active')));
    $profileExists = !$hasVeterinarianProfiles || (int)($user['profile_user_id'] ?? 0) === $userId;
    $profileIsActive = (int)($user['profile_is_active'] ?? 0) === 1;
    $profileIsAcceptingPatients = (int)($user['profile_is_accepting_patients'] ?? 0) === 1;
    if (
        $role !== 'veterinarian'
        || !$profileExists
        || !$profileIsActive
        || !$profileIsAcceptingPatients
    ) {
        record_request_error(422, 'Select an active veterinarian who is accepting assignments.');
    }
}

function record_request_write_transition_event(
    PDO $pdo,
    int $requestId,
    string $eventType,
    array $before,
    array $after,
    int $actorUserId,
    ?string $note = null
): void {
    if (!record_request_table_exists($pdo, 'pet_record_update_request_events')) {
        return;
    }

    $stmt = $pdo->prepare("
        INSERT INTO pet_record_update_request_events (
            request_id,
            event_type,
            from_status,
            to_status,
            from_payment_status,
            to_payment_status,
            actor_user_id,
            note
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ");
    $stmt->execute([
        $requestId,
        $eventType,
        $before['status'] ?? null,
        $after['status'] ?? null,
        $before['payment_status'] ?? null,
        $after['payment_status'] ?? null,
        $actorUserId,
        $note,
    ]);
}

function record_request_snapshot_supported(PDO $pdo): bool
{
    static $cache = [];

    $connectionId = spl_object_id($pdo);
    if (array_key_exists($connectionId, $cache)) {
        return $cache[$connectionId];
    }

    $cache[$connectionId] = ipawcus_guard_column_exists($pdo, 'pet_record_update_requests', 'baseline_snapshot_hash')
        && ipawcus_guard_column_exists($pdo, 'pet_record_update_requests', 'completed_snapshot_hash');

    return $cache[$connectionId];
}

function record_request_snapshot_rows(PDO $pdo, string $sql, array $params = []): array
{
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($rows as &$row) {
        foreach (array_keys($row) as $column) {
            if (
                in_array($column, ['created_at', 'updated_at'], true)
                || str_ends_with($column, '_by_user_id')
            ) {
                unset($row[$column]);
            }
        }
        ksort($row);
    }
    unset($row);

    return $rows;
}

function record_request_pet_snapshot_hash(PDO $pdo, int $petId): string
{
    $snapshot = [
        'pet' => record_request_snapshot_rows(
            $pdo,
            "SELECT
                pet_id,
                pet_name,
                pet_species,
                pet_breed,
                pet_BDAY,
                pet_status,
                pet_gender,
                pet_weight,
                pet_microchip,
                pet_allergies,
                pet_color_marking,
                pet_age
             FROM pets_information
             WHERE pet_id = ?
             LIMIT 1",
            [$petId]
        ),
        'allergies' => record_request_table_exists($pdo, 'pet_allergies')
            ? record_request_snapshot_rows(
                $pdo,
                "SELECT * FROM pet_allergies WHERE pet_id = ? ORDER BY allergy_id ASC",
                [$petId]
            )
            : [],
        'vaccinations' => record_request_table_exists($pdo, 'pet_vaccinations')
            ? record_request_snapshot_rows(
                $pdo,
                "SELECT * FROM pet_vaccinations WHERE pet_id = ? ORDER BY vax_id ASC",
                [$petId]
            )
            : [],
        'history' => record_request_table_exists($pdo, 'history_before_registration')
            ? record_request_snapshot_rows(
                $pdo,
                "SELECT *
                 FROM history_before_registration
                 WHERE pet_id = ?
                 ORDER BY
                    COALESCE(last_visit_Date, '1000-01-01') ASC,
                    COALESCE(current_medication, '') ASC,
                    COALESCE(veterinarian_notes, '') ASC",
                [$petId]
            )
            : [],
        'groups' => record_request_table_exists($pdo, 'pet_medical_record_groups')
            ? record_request_snapshot_rows(
                $pdo,
                "SELECT *
                 FROM pet_medical_record_groups
                 WHERE pet_id = ?
                 ORDER BY sort_order ASC, group_id ASC",
                [$petId]
            )
            : [],
        'groupItems' => record_request_table_exists($pdo, 'pet_medical_record_group_items')
            && record_request_table_exists($pdo, 'pet_medical_record_groups')
            ? record_request_snapshot_rows(
                $pdo,
                "SELECT i.*
                 FROM pet_medical_record_group_items i
                 JOIN pet_medical_record_groups g ON g.group_id = i.group_id
                 WHERE g.pet_id = ?
                 ORDER BY g.sort_order ASC, g.group_id ASC, i.sort_order ASC, i.item_id ASC",
                [$petId]
            )
            : [],
    ];

    $encoded = json_encode(
        $snapshot,
        JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRESERVE_ZERO_FRACTION
    );
    if ($encoded === false) {
        throw new RuntimeException('Could not create record update evidence snapshot.');
    }

    return hash('sha256', $encoded);
}

function record_request_number(PDO $pdo): string
{
    do {
        $number = 'RUR-' . date('Ymd') . '-' . strtoupper(substr(bin2hex(random_bytes(3)), 0, 6));
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM pet_record_update_requests WHERE request_number = ?");
        $stmt->execute([$number]);
    } while ((int)$stmt->fetchColumn() > 0);

    return $number;
}

function record_request_row(array $row): array
{
    $ownerName = trim((string)($row['owner_name'] ?? ''));
    $vetName = trim((string)($row['assigned_veterinarian_name'] ?? ''));
    $reviewerName = trim((string)($row['reviewed_by_name'] ?? ''));
    $completedByName = trim((string)($row['completed_by_name'] ?? ''));

    return [
        'id' => (int)$row['request_id'],
        'requestId' => (int)$row['request_id'],
        'requestNumber' => $row['request_number'],
        'shortRequestNumber' => 'RUR-' . str_pad((string)$row['request_id'], 5, '0', STR_PAD_LEFT),
        'petId' => (int)$row['pet_id'],
        'petPublicId' => $row['pet_sharable_ID'] ?? '',
        'petName' => $row['pet_name'] ?? 'Pet',
        'petSpecies' => $row['pet_species'] ?? '',
        'petBreed' => $row['pet_breed'] ?? '',
        'ownerUserId' => $row['owner_user_id'] !== null ? (int)$row['owner_user_id'] : null,
        'ownerName' => $ownerName ?: ($row['pet_Temp_owner'] ?? 'Pet owner'),
        'requestedChanges' => $row['requested_changes'] ?? '',
        'paymentMethod' => $row['payment_method'],
        'paymentAmount' => (float)$row['payment_amount'],
        'paymentStatus' => $row['payment_status'],
        'paymentProofUrl' => $row['payment_proof_url'] ?? '',
        'paymentReference' => $row['payment_reference'] ?? '',
        'status' => $row['status'],
        'adminNotes' => $row['admin_notes'] ?? '',
        'veterinarianNotes' => $row['veterinarian_notes'] ?? '',
        'assignedVeterinarianUserId' => $row['assigned_veterinarian_user_id'] !== null ? (int)$row['assigned_veterinarian_user_id'] : null,
        'assignedVeterinarianName' => $vetName,
        'reviewedByUserId' => $row['reviewed_by_user_id'] !== null ? (int)$row['reviewed_by_user_id'] : null,
        'reviewedByName' => $reviewerName,
        'completedByUserId' => $row['completed_by_user_id'] !== null ? (int)$row['completed_by_user_id'] : null,
        'completedByName' => $completedByName,
        'reviewedAt' => $row['reviewed_at'],
        'completedAt' => $row['completed_at'],
        'createdAt' => $row['created_at'],
        'updatedAt' => $row['updated_at'],
    ];
}

function record_request_fetch(PDO $pdo, array $filters = []): array
{
    $conditions = [];
    $params = [];

    foreach ([
        ['request_id', 'r.request_id'],
        ['pet_id', 'r.pet_id'],
        ['owner_user_id', 'r.owner_user_id'],
        ['assigned_veterinarian_user_id', 'r.assigned_veterinarian_user_id'],
    ] as [$key, $column]) {
        if (isset($filters[$key]) && $filters[$key] !== '' && $filters[$key] !== null) {
            $conditions[] = "{$column} = ?";
            $params[] = (int)$filters[$key];
        }
    }

    if (isset($filters['branch_id']) && $filters['branch_id'] !== '' && $filters['branch_id'] !== null) {
        $conditions[] = 'r.branch_id = ?';
        $params[] = (int)$filters['branch_id'];
    }

    if (!empty($filters['status'])) {
        $statuses = array_values(array_filter(array_map('trim', explode(',', (string)$filters['status']))));
        if ($statuses) {
            foreach ($statuses as $status) {
                record_request_validate_status($status);
            }
            $conditions[] = 'r.status IN (' . implode(',', array_fill(0, count($statuses), '?')) . ')';
            $params = array_merge($params, $statuses);
        }
    }

    if (!empty($filters['vet_visible_user_id'])) {
        $conditions[] = "(r.assigned_veterinarian_user_id = ? OR (r.assigned_veterinarian_user_id IS NULL AND r.status = 'approved'))";
        $params[] = (int)$filters['vet_visible_user_id'];
    }

    $whereSql = $conditions ? 'WHERE ' . implode(' AND ', $conditions) : '';
    $stmt = $pdo->prepare("
        SELECT
            r.*,
            p.pet_sharable_ID,
            p.pet_name,
            p.pet_species,
            p.pet_breed,
            p.pet_Temp_owner,
            CONCAT(owner.first_Name, ' ', owner.last_Name) AS owner_name,
            CONCAT(vet.first_Name, ' ', vet.last_Name) AS assigned_veterinarian_name,
            CONCAT(reviewer.first_Name, ' ', reviewer.last_Name) AS reviewed_by_name,
            CONCAT(completer.first_Name, ' ', completer.last_Name) AS completed_by_name
        FROM pet_record_update_requests r
        JOIN pets_information p ON p.pet_id = r.pet_id
        LEFT JOIN users owner ON owner.user_id = r.owner_user_id
        LEFT JOIN users vet ON vet.user_id = r.assigned_veterinarian_user_id
        LEFT JOIN users reviewer ON reviewer.user_id = r.reviewed_by_user_id
        LEFT JOIN users completer ON completer.user_id = r.completed_by_user_id
        {$whereSql}
        ORDER BY FIELD(r.status, 'pending_admin_review', 'approved', 'assigned', 'in_progress', 'completed', 'rejected', 'cancelled'),
                 r.created_at DESC,
                 r.request_id DESC
        LIMIT 300
    ");
    $stmt->execute($params);

    return array_map('record_request_row', $stmt->fetchAll(PDO::FETCH_ASSOC));
}

function record_request_create(PDO $pdo, array $input): void
{
    $currentUser = ipawcus_guard_current_user($pdo);
    $currentRole = ipawcus_guard_role($currentUser);
    $currentUserId = ipawcus_guard_user_id($currentUser);

    $petId = record_request_resolve_pet_id($pdo, $input['petId'] ?? $input['pet_id'] ?? null);
    $requestedChanges = record_request_nullable_text($input['requestedChanges'] ?? $input['requested_changes'] ?? $input['notes'] ?? null);
    if ($requestedChanges === null) {
        record_request_error(400, 'Please describe what needs to be updated.');
    }

    $paymentMethod = ipawcus_payment_method_key($input['paymentMethod'] ?? $input['payment_method'] ?? 'qrph');
    if (!ipawcus_payment_method_is_allowed($pdo, $paymentMethod)) {
        record_request_error(400, 'Invalid payment method.');
    }
    if ($currentRole === 'pet_owner' && !ipawcus_guard_pet_access($pdo, $petId, $currentUserId)) {
        record_request_error(403, 'You are not allowed to request updates for this pet.');
    }

    $paymentProofUrl = record_request_nullable_text($input['paymentProofUrl'] ?? $input['payment_proof_url'] ?? null);
    $paymentReference = record_request_nullable_text($input['paymentReference'] ?? $input['payment_reference'] ?? null);
    if ($paymentMethod !== 'cash' && $paymentReference === null) {
        record_request_error(400, 'Please enter the payment transaction number.');
    }
    if ($paymentReference !== null && !preg_match('/^\d{18}$/', $paymentReference)) {
        record_request_error(400, 'The payment transaction number must contain exactly 18 digits.');
    }
    $paymentAmount = 200.0;
    $paymentStatus = ($paymentProofUrl && $paymentMethod !== 'cash') ? 'submitted' : 'pending';
    $ownerUserId = $currentRole === 'pet_owner'
        ? $currentUserId
        : record_request_nullable_int($input['ownerUserId'] ?? $input['owner_user_id'] ?? $input['userId'] ?? null);

    $pdo->beginTransaction();
    // Lock the pet row so concurrent submissions for the same pet cannot both
    // pass the active-request check.
    $petLockStmt = $pdo->prepare('SELECT pet_id FROM pets_information WHERE pet_id = ? LIMIT 1 FOR UPDATE');
    $petLockStmt->execute([$petId]);
    if (!$petLockStmt->fetchColumn()) {
        $pdo->rollBack();
        record_request_error(404, 'Pet was not found.');
    }

    $activeRequestStmt = $pdo->prepare("
        SELECT request_id, request_number, status
        FROM pet_record_update_requests
        WHERE pet_id = ?
          AND owner_user_id <=> ?
          AND status NOT IN ('completed', 'rejected', 'cancelled')
        ORDER BY request_id DESC
        LIMIT 1
        FOR UPDATE
    ");
    $activeRequestStmt->execute([$petId, $ownerUserId]);
    $activeRequest = $activeRequestStmt->fetch(PDO::FETCH_ASSOC);
    if ($activeRequest) {
        $pdo->rollBack();
        http_response_code(409);
        echo json_encode([
            'success' => false,
            'message' => 'This pet already has an update request in progress. Wait for it to be completed before submitting another.',
            'activeRequest' => [
                'requestId' => (int)$activeRequest['request_id'],
                'requestNumber' => $activeRequest['request_number'],
                'shortRequestNumber' => 'RUR-' . str_pad((string)$activeRequest['request_id'], 5, '0', STR_PAD_LEFT),
                'status' => $activeRequest['status'],
            ],
        ]);
        exit;
    }
    $stmt = $pdo->prepare("
        INSERT INTO pet_record_update_requests (
            request_number,
            pet_id,
            owner_user_id,
            branch_id,
            requested_changes,
            payment_method,
            payment_amount,
            payment_status,
            payment_proof_url,
            payment_reference,
            status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_admin_review')
    ");
    $stmt->execute([
        record_request_number($pdo),
        $petId,
        $ownerUserId,
        branch_main_id($pdo),
        $requestedChanges,
        $paymentMethod,
        $paymentAmount,
        $paymentStatus,
        $paymentProofUrl,
        $paymentReference,
    ]);

    $requestId = (int)$pdo->lastInsertId();
    record_request_write_transition_event(
        $pdo,
        $requestId,
        'submitted',
        ['status' => null, 'payment_status' => null],
        ['status' => 'pending_admin_review', 'payment_status' => $paymentStatus],
        $currentUserId,
        $requestedChanges
    );
    $record = record_request_fetch($pdo, ['request_id' => $requestId])[0] ?? null;
    $pdo->commit();

    try {
        notification_send_record_update_request_staff_event($pdo, $requestId, 'submitted');
    } catch (Throwable $notificationError) {
        error_log('Record update submission notification failed: ' . $notificationError->getMessage());
    }

    echo json_encode(['success' => true, 'request' => $record, 'requestId' => $requestId]);
}

function record_request_update(PDO $pdo, array $input): void
{
    $requestId = record_request_nullable_int($input['requestId'] ?? $input['request_id'] ?? $_GET['requestId'] ?? null);
    if ($requestId === null) {
        record_request_error(400, 'requestId is required.');
    }

    $action = strtolower(trim((string)($input['action'] ?? 'update')));
    $allowedActions = ['approve', 'reject', 'assign', 'start', 'complete', 'verify_payment', 'update'];
    if (!in_array($action, $allowedActions, true)) {
        record_request_error(422, 'Invalid record update action.');
    }

    $currentUser = ipawcus_guard_current_user($pdo);
    $currentRole = ipawcus_guard_role($currentUser);
    $actorUserId = ipawcus_guard_user_id($currentUser);
    $assignedVetId = record_request_nullable_int($input['assignedVeterinarianUserId'] ?? $input['assigned_veterinarian_user_id'] ?? null);
    $adminNotes = record_request_nullable_text($input['adminNotes'] ?? $input['admin_notes'] ?? null);
    $vetNotes = record_request_nullable_text($input['veterinarianNotes'] ?? $input['veterinarian_notes'] ?? null);
    $notifyAssigned = false;
    $notifyStarted = false;
    $notifyCompleted = false;
    $completionSnapshotHash = null;

    $pdo->beginTransaction();
    $lockStmt = $pdo->prepare("SELECT * FROM pet_record_update_requests WHERE request_id = ? LIMIT 1 FOR UPDATE");
    $lockStmt->execute([$requestId]);
    $locked = $lockStmt->fetch(PDO::FETCH_ASSOC);
    if (!$locked) {
        record_request_error(404, 'Record update request was not found.');
    }

    if ($action === 'approve') {
        if (!ipawcus_guard_is_admin_role($currentRole)) {
            record_request_error(403, 'Only admin users can approve record update requests.');
        }
        record_request_require_action_status($locked, 'approved', ['pending_admin_review', 'approved']);
        record_request_require_cleared_payment($locked, 'approved');
        if ($assignedVetId !== null) {
            record_request_require_veterinarian($pdo, $assignedVetId);
        }

        $stmt = $pdo->prepare("
            UPDATE pet_record_update_requests
            SET status = ?,
                assigned_veterinarian_user_id = COALESCE(?, assigned_veterinarian_user_id),
                admin_notes = COALESCE(?, admin_notes),
                reviewed_by_user_id = ?,
                reviewed_at = NOW()
            WHERE request_id = ?
              AND status IN ('pending_admin_review', 'approved')
        ");
        $stmt->execute([
            $assignedVetId ? 'assigned' : 'approved',
            $assignedVetId,
            $adminNotes,
            $actorUserId,
            $requestId,
        ]);
        if ($stmt->rowCount() === 0) {
            record_request_error(409, 'Only pending review requests can be approved.');
        }
        $notifyAssigned = $assignedVetId !== null;
    } elseif ($action === 'reject') {
        if (!ipawcus_guard_is_admin_role($currentRole)) {
            record_request_error(403, 'Only admin users can reject record update requests.');
        }
        record_request_require_action_status(
            $locked,
            'rejected',
            ['pending_admin_review', 'approved', 'assigned', 'in_progress']
        );
        $paymentStatus = record_request_validate_payment_status($input['paymentStatus'] ?? $input['payment_status'] ?? null);
        $stmt = $pdo->prepare("
            UPDATE pet_record_update_requests
            SET status = 'rejected',
                payment_status = COALESCE(?, payment_status),
                admin_notes = COALESCE(?, admin_notes),
                reviewed_by_user_id = ?,
                reviewed_at = NOW()
            WHERE request_id = ?
              AND status IN ('pending_admin_review', 'approved', 'assigned', 'in_progress')
        ");
        $stmt->execute([
            $paymentStatus,
            $adminNotes,
            $actorUserId,
            $requestId,
        ]);
    } elseif ($action === 'assign') {
        if ($assignedVetId === null) {
            record_request_error(400, 'Select a veterinarian to assign.');
        }
        record_request_require_action_status($locked, 'assigned', ['approved', 'assigned', 'in_progress']);
        record_request_require_cleared_payment($locked, 'assigned');
        $lockedStatus = strtolower(trim((string)($locked['status'] ?? '')));
        $lockedAssignedVetId = (int)($locked['assigned_veterinarian_user_id'] ?? 0);
        $vetIsContinuingOwnRequest = $currentRole === 'veterinarian'
            && $assignedVetId === $actorUserId
            && $lockedAssignedVetId === $actorUserId
            && in_array($lockedStatus, ['assigned', 'in_progress'], true);
        if (!$vetIsContinuingOwnRequest) {
            record_request_require_veterinarian($pdo, $assignedVetId);
        }

        if ($currentRole === 'veterinarian') {
            if ($assignedVetId !== $actorUserId) {
                record_request_error(403, 'Veterinarians can only assign record update requests to themselves.');
            }
            $stmt = $pdo->prepare("
                UPDATE pet_record_update_requests
                SET status = 'assigned',
                    assigned_veterinarian_user_id = ?,
                    veterinarian_notes = COALESCE(?, veterinarian_notes)
                WHERE request_id = ?
                  AND status IN ('approved', 'assigned')
                  AND (assigned_veterinarian_user_id IS NULL OR assigned_veterinarian_user_id = ?)
            ");
            $stmt->execute([$assignedVetId, $vetNotes, $requestId, $assignedVetId]);
        } elseif (ipawcus_guard_is_admin_role($currentRole)) {
            $stmt = $pdo->prepare("
                UPDATE pet_record_update_requests
                SET status = 'assigned',
                    assigned_veterinarian_user_id = ?,
                    admin_notes = COALESCE(?, admin_notes),
                    reviewed_by_user_id = COALESCE(reviewed_by_user_id, ?),
                    reviewed_at = COALESCE(reviewed_at, NOW())
                WHERE request_id = ?
                  AND status IN ('approved', 'assigned', 'in_progress')
            ");
            $stmt->execute([$assignedVetId, $adminNotes, $actorUserId, $requestId]);
        } else {
            record_request_error(403, 'You are not allowed to assign record update requests.');
        }

        if ($stmt->rowCount() === 0 && !$vetIsContinuingOwnRequest) {
            record_request_error(409, 'This record update request is already assigned or is not assignable.');
        }
        $notifyAssigned = !$vetIsContinuingOwnRequest;
    } elseif ($action === 'start') {
        if ($currentRole !== 'veterinarian') {
            record_request_error(403, 'Only the assigned veterinarian can start this record update request.');
        }
        record_request_require_action_status($locked, 'started', ['assigned', 'in_progress']);
        record_request_require_cleared_payment($locked, 'started');

        $stmt = $pdo->prepare("
            UPDATE pet_record_update_requests
            SET status = 'in_progress',
                veterinarian_notes = COALESCE(?, veterinarian_notes)
            WHERE request_id = ?
              AND status IN ('assigned', 'in_progress')
              AND assigned_veterinarian_user_id = ?
        ");
        $stmt->execute([$vetNotes, $requestId, $actorUserId]);
        $alreadyInProgressForActor = strtolower(trim((string)($locked['status'] ?? ''))) === 'in_progress'
            && (int)($locked['assigned_veterinarian_user_id'] ?? 0) === $actorUserId;
        if ($stmt->rowCount() === 0 && !$alreadyInProgressForActor) {
            record_request_error(409, 'This request must be assigned to you before it can be started.');
        }
        $notifyStarted = !$alreadyInProgressForActor;
    } elseif ($action === 'complete') {
        if ($currentRole !== 'veterinarian') {
            record_request_error(403, 'Only the assigned veterinarian can complete this record update request.');
        }
        record_request_require_action_status($locked, 'completed', ['assigned', 'in_progress']);
        record_request_require_cleared_payment($locked, 'completed');

        $completionEvidence = $vetNotes
            ?? record_request_nullable_text($locked['veterinarian_notes'] ?? null);
        if ($completionEvidence === null) {
            record_request_error(
                422,
                'Veterinarian completion notes are required before this request can be completed.'
            );
        }
        if (record_request_snapshot_supported($pdo)) {
            $baselineSnapshotHash = trim((string)($locked['baseline_snapshot_hash'] ?? ''));
            if ($baselineSnapshotHash === '') {
                record_request_error(
                    409,
                    'This request has no baseline record snapshot. Start the request before editing the pet record.'
                );
            }

            $completionSnapshotHash = record_request_pet_snapshot_hash($pdo, (int)$locked['pet_id']);
            if (hash_equals($baselineSnapshotHash, $completionSnapshotHash)) {
                record_request_error(
                    409,
                    'No pet or medical record change was detected. Save the requested update before completing the request.'
                );
            }
        }

        $stmt = $pdo->prepare("
            UPDATE pet_record_update_requests
            SET status = 'completed',
                veterinarian_notes = COALESCE(?, veterinarian_notes),
                completed_by_user_id = ?,
                completed_at = NOW()
            WHERE request_id = ?
              AND status IN ('assigned', 'in_progress')
              AND assigned_veterinarian_user_id = ?
        ");
        $stmt->execute([$completionEvidence, $actorUserId, $requestId, $actorUserId]);
        if ($stmt->rowCount() === 0) {
            record_request_error(409, 'This request must be assigned to you and not already completed.');
        }
        $notifyCompleted = true;
    } elseif ($action === 'verify_payment') {
        if (!ipawcus_guard_is_admin_role($currentRole)) {
            record_request_error(403, 'Only admin users can verify record update payments.');
        }
        record_request_require_action_status(
            $locked,
            'payment-verified',
            ['pending_admin_review', 'approved', 'assigned', 'in_progress']
        );
        $paymentStatus = 'verified';

        $stmt = $pdo->prepare("
            UPDATE pet_record_update_requests
            SET payment_status = ?,
                admin_notes = COALESCE(?, admin_notes),
                reviewed_by_user_id = COALESCE(reviewed_by_user_id, ?),
                reviewed_at = COALESCE(reviewed_at, NOW())
            WHERE request_id = ?
        ");
        $stmt->execute([$paymentStatus, $adminNotes, $actorUserId, $requestId]);
    } else {
        if (!ipawcus_guard_is_admin_role($currentRole)) {
            record_request_error(403, 'Only admin users can perform a generic record update request edit.');
        }
        $status = record_request_validate_status($input['status'] ?? null);
        $paymentStatus = record_request_validate_payment_status($input['paymentStatus'] ?? $input['payment_status'] ?? null);
        $currentStatus = (string)($locked['status'] ?? '');
        $currentPaymentStatus = (string)($locked['payment_status'] ?? '');

        if ($status !== null && $status !== $currentStatus) {
            record_request_error(422, 'Use the matching workflow action to change request status.');
        }
        if ($assignedVetId !== null && $assignedVetId !== (int)($locked['assigned_veterinarian_user_id'] ?? 0)) {
            record_request_error(422, 'Use the assign action to change the assigned veterinarian.');
        }
        if ($paymentStatus === 'verified' && $paymentStatus !== $currentPaymentStatus) {
            record_request_error(422, 'Use the verify_payment action to verify a payment.');
        }
        if (
            $paymentStatus !== null
            && $paymentStatus !== $currentPaymentStatus
            && !in_array($paymentStatus, ['waived', 'rejected'], true)
        ) {
            record_request_error(422, 'That payment status transition is not allowed.');
        }
        if (
            $paymentStatus !== null
            && $paymentStatus !== $currentPaymentStatus
            && in_array($currentStatus, ['completed', 'rejected', 'cancelled'], true)
        ) {
            record_request_error(409, 'Payment status cannot be changed after the request is closed.');
        }
        if (
            $paymentStatus !== null
            && $paymentStatus !== $currentPaymentStatus
            && in_array($currentPaymentStatus, ['verified', 'waived'], true)
        ) {
            record_request_error(409, 'A cleared payment cannot be moved back to an uncleared status.');
        }

        $paymentChanged = $paymentStatus !== null && $paymentStatus !== $currentPaymentStatus;

        $stmt = $pdo->prepare("
            UPDATE pet_record_update_requests
            SET status = COALESCE(?, status),
                payment_status = COALESCE(?, payment_status),
                assigned_veterinarian_user_id = COALESCE(?, assigned_veterinarian_user_id),
                admin_notes = COALESCE(?, admin_notes),
                veterinarian_notes = COALESCE(?, veterinarian_notes),
                reviewed_by_user_id = COALESCE(?, reviewed_by_user_id),
                reviewed_at = CASE
                    WHEN ? = 1 THEN NOW()
                    ELSE reviewed_at
                END
            WHERE request_id = ?
        ");
        $stmt->execute([
            $status,
            $paymentStatus,
            $assignedVetId,
            $adminNotes,
            $vetNotes,
            $paymentChanged ? $actorUserId : null,
            $paymentChanged ? 1 : 0,
            $requestId,
        ]);
    }

    if (
        record_request_snapshot_supported($pdo)
        && trim((string)($locked['baseline_snapshot_hash'] ?? '')) === ''
        && (
            $action === 'assign'
            || $action === 'start'
            || ($action === 'approve' && $assignedVetId !== null)
        )
    ) {
        $baselineSnapshotHash = record_request_pet_snapshot_hash($pdo, (int)$locked['pet_id']);
        $baselineStmt = $pdo->prepare("
            UPDATE pet_record_update_requests
            SET baseline_snapshot_hash = COALESCE(baseline_snapshot_hash, ?)
            WHERE request_id = ?
        ");
        $baselineStmt->execute([$baselineSnapshotHash, $requestId]);
    }

    if ($completionSnapshotHash !== null && record_request_snapshot_supported($pdo)) {
        $completionStmt = $pdo->prepare("
            UPDATE pet_record_update_requests
            SET completed_snapshot_hash = ?
            WHERE request_id = ?
        ");
        $completionStmt->execute([$completionSnapshotHash, $requestId]);
    }

    $afterStmt = $pdo->prepare("
        SELECT status, payment_status
        FROM pet_record_update_requests
        WHERE request_id = ?
        LIMIT 1
    ");
    $afterStmt->execute([$requestId]);
    $after = $afterStmt->fetch(PDO::FETCH_ASSOC) ?: [];
    record_request_write_transition_event(
        $pdo,
        $requestId,
        $action,
        $locked,
        $after,
        $actorUserId,
        $vetNotes ?? $adminNotes
    );

    $record = record_request_fetch($pdo, ['request_id' => $requestId])[0] ?? null;
    $pdo->commit();

    $assignedAfterUpdate = (int)($record['assignedVeterinarianUserId'] ?? 0);
    if (
        $record
        && $assignedAfterUpdate > 0
        && $notifyAssigned
        && ($actorUserId === null || $actorUserId !== $assignedAfterUpdate)
    ) {
        try {
            notification_send_record_update_request_event($pdo, $requestId, $action);
        } catch (Throwable $notificationError) {
            error_log('Record update assignment notification failed: ' . $notificationError->getMessage());
        }
    }

    if ($record && $notifyCompleted) {
        try {
            notification_send_record_update_request_completed_to_owner($pdo, $requestId);
        } catch (Throwable $notificationError) {
            error_log('Record update completion notification failed: ' . $notificationError->getMessage());
        }
    }

    if ($record && $notifyStarted) {
        try {
            notification_send_record_update_request_staff_event($pdo, $requestId, 'in_progress');
        } catch (Throwable $notificationError) {
            error_log('Record update start notification failed: ' . $notificationError->getMessage());
        }
    }

    if ($record && $notifyCompleted) {
        try {
            notification_send_record_update_request_staff_event($pdo, $requestId, 'completed');
        } catch (Throwable $notificationError) {
            error_log('Record update staff completion notification failed: ' . $notificationError->getMessage());
        }
    }

    echo json_encode(['success' => true, 'request' => $record]);
}

try {
    record_request_ensure_schema($pdo);
    $currentUser = ipawcus_guard_current_user($pdo);
    $currentRole = ipawcus_guard_role($currentUser);
    $currentUserId = ipawcus_guard_user_id($currentUser);

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $filters = [
            'request_id' => $_GET['requestId'] ?? $_GET['request_id'] ?? null,
            'pet_id' => $_GET['petId'] ?? $_GET['pet_id'] ?? null,
            'owner_user_id' => $_GET['ownerUserId'] ?? $_GET['owner_user_id'] ?? null,
            'assigned_veterinarian_user_id' => $_GET['vetId'] ?? $_GET['assignedVeterinarianUserId'] ?? null,
            'status' => $_GET['status'] ?? null,
        ];

        if (!empty($filters['pet_id'])) {
            $filters['pet_id'] = record_request_resolve_pet_id($pdo, $filters['pet_id']);
        }

        if ($currentRole === 'pet_owner') {
            if (!empty($filters['owner_user_id']) && (int)$filters['owner_user_id'] !== $currentUserId) {
                record_request_error(403, 'You can only view your own record update requests.');
            }
            $filters['owner_user_id'] = $currentUserId;
        } elseif ($currentRole === 'veterinarian') {
            if (!empty($filters['assigned_veterinarian_user_id']) && (int)$filters['assigned_veterinarian_user_id'] !== $currentUserId) {
                record_request_error(403, 'You can only view record update requests assigned to you.');
            }
            unset($filters['assigned_veterinarian_user_id']);
            $filters['vet_visible_user_id'] = $currentUserId;
        } elseif (!ipawcus_guard_is_admin_role($currentRole)) {
            record_request_error(403, 'You are not allowed to view record update requests.');
        }

        echo json_encode([
            'success' => true,
            'schemaReady' => true,
            'requests' => record_request_fetch($pdo, $filters),
        ]);
        exit;
    }

    $input = record_request_input();

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        record_request_create($pdo, $input);
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] === 'PATCH') {
        record_request_update($pdo, $input);
        exit;
    }

    record_request_error(405, 'Method not allowed.');
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Record update request failed: ' . $e->getMessage(),
    ]);
}
