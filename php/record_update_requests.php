<?php
require_once __DIR__ . '/db.php';

header('Content-Type: application/json');

function record_request_input(): array
{
    return json_decode(file_get_contents('php://input'), true) ?: [];
}

function record_request_error(int $statusCode, string $message): void
{
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
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS pet_record_update_requests (
            request_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
            request_number VARCHAR(32) NOT NULL UNIQUE,
            pet_id INT NOT NULL,
            owner_user_id INT NULL,
            requested_changes TEXT NULL,
            payment_method VARCHAR(40) NOT NULL DEFAULT 'qrph',
            payment_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            payment_status ENUM('pending', 'submitted', 'verified', 'waived', 'rejected') NOT NULL DEFAULT 'pending',
            payment_proof_url VARCHAR(255) NULL,
            status ENUM('pending_admin_review', 'approved', 'rejected', 'assigned', 'in_progress', 'completed', 'cancelled') NOT NULL DEFAULT 'pending_admin_review',
            admin_notes TEXT NULL,
            veterinarian_notes TEXT NULL,
            assigned_veterinarian_user_id INT NULL,
            reviewed_by_user_id INT NULL,
            completed_by_user_id INT NULL,
            reviewed_at DATETIME NULL,
            completed_at DATETIME NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            KEY record_update_pet_idx (pet_id, status),
            KEY record_update_owner_idx (owner_user_id, created_at),
            KEY record_update_status_idx (status, payment_status),
            KEY record_update_vet_idx (assigned_veterinarian_user_id, status),
            CONSTRAINT record_update_pet_fk
                FOREIGN KEY (pet_id) REFERENCES pets_information(pet_id)
                ON DELETE CASCADE,
            CONSTRAINT record_update_owner_fk
                FOREIGN KEY (owner_user_id) REFERENCES users(user_id)
                ON DELETE SET NULL,
            CONSTRAINT record_update_assigned_vet_fk
                FOREIGN KEY (assigned_veterinarian_user_id) REFERENCES users(user_id)
                ON DELETE SET NULL,
            CONSTRAINT record_update_reviewed_by_fk
                FOREIGN KEY (reviewed_by_user_id) REFERENCES users(user_id)
                ON DELETE SET NULL,
            CONSTRAINT record_update_completed_by_fk
                FOREIGN KEY (completed_by_user_id) REFERENCES users(user_id)
                ON DELETE SET NULL
        )
    ");
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

    if (!empty($filters['status'])) {
        $statuses = array_values(array_filter(array_map('trim', explode(',', (string)$filters['status']))));
        if ($statuses) {
            $conditions[] = 'r.status IN (' . implode(',', array_fill(0, count($statuses), '?')) . ')';
            $params = array_merge($params, $statuses);
        }
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
    $petId = record_request_resolve_pet_id($pdo, $input['petId'] ?? $input['pet_id'] ?? null);
    $requestedChanges = record_request_nullable_text($input['requestedChanges'] ?? $input['requested_changes'] ?? $input['notes'] ?? null);
    if ($requestedChanges === null) {
        record_request_error(400, 'Please describe what needs to be updated.');
    }

    $paymentMethod = strtolower(trim((string)($input['paymentMethod'] ?? $input['payment_method'] ?? 'qrph')));
    if (!in_array($paymentMethod, ['qrph', 'maya', 'gcash', 'bank_transfer'], true)) {
        record_request_error(400, 'Invalid payment method.');
    }
    $paymentProofUrl = record_request_nullable_text($input['paymentProofUrl'] ?? $input['payment_proof_url'] ?? null);
    $paymentAmount = (float)($input['paymentAmount'] ?? $input['payment_amount'] ?? 0);
    $paymentStatus = $paymentProofUrl ? 'submitted' : 'pending';

    $stmt = $pdo->prepare("
        INSERT INTO pet_record_update_requests (
            request_number,
            pet_id,
            owner_user_id,
            requested_changes,
            payment_method,
            payment_amount,
            payment_status,
            payment_proof_url,
            status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending_admin_review')
    ");
    $stmt->execute([
        record_request_number($pdo),
        $petId,
        record_request_nullable_int($input['ownerUserId'] ?? $input['owner_user_id'] ?? $input['userId'] ?? null),
        $requestedChanges,
        $paymentMethod,
        $paymentAmount,
        $paymentStatus,
        $paymentProofUrl,
    ]);

    $requestId = (int)$pdo->lastInsertId();
    $record = record_request_fetch($pdo, ['request_id' => $requestId])[0] ?? null;

    echo json_encode(['success' => true, 'request' => $record, 'requestId' => $requestId]);
}

function record_request_update(PDO $pdo, array $input): void
{
    $requestId = record_request_nullable_int($input['requestId'] ?? $input['request_id'] ?? $_GET['requestId'] ?? null);
    if ($requestId === null) {
        record_request_error(400, 'requestId is required.');
    }

    $action = $input['action'] ?? 'update';
    $actorUserId = record_request_nullable_int($input['userId'] ?? $input['user_id'] ?? $input['actorUserId'] ?? null);
    $assignedVetId = record_request_nullable_int($input['assignedVeterinarianUserId'] ?? $input['assigned_veterinarian_user_id'] ?? null);
    $adminNotes = record_request_nullable_text($input['adminNotes'] ?? $input['admin_notes'] ?? null);
    $vetNotes = record_request_nullable_text($input['veterinarianNotes'] ?? $input['veterinarian_notes'] ?? null);

    if ($action === 'approve') {
        $stmt = $pdo->prepare("
            UPDATE pet_record_update_requests
            SET status = ?,
                payment_status = ?,
                assigned_veterinarian_user_id = COALESCE(?, assigned_veterinarian_user_id),
                admin_notes = COALESCE(?, admin_notes),
                reviewed_by_user_id = ?,
                reviewed_at = NOW()
            WHERE request_id = ?
        ");
        $stmt->execute([
            $assignedVetId ? 'assigned' : 'approved',
            $input['paymentStatus'] ?? $input['payment_status'] ?? 'verified',
            $assignedVetId,
            $adminNotes,
            $actorUserId,
            $requestId,
        ]);
    } elseif ($action === 'reject') {
        $stmt = $pdo->prepare("
            UPDATE pet_record_update_requests
            SET status = 'rejected',
                payment_status = ?,
                admin_notes = COALESCE(?, admin_notes),
                reviewed_by_user_id = ?,
                reviewed_at = NOW()
            WHERE request_id = ?
        ");
        $stmt->execute([
            $input['paymentStatus'] ?? $input['payment_status'] ?? 'rejected',
            $adminNotes,
            $actorUserId,
            $requestId,
        ]);
    } elseif ($action === 'assign') {
        if ($assignedVetId === null) {
            record_request_error(400, 'Select a veterinarian to assign.');
        }

        $stmt = $pdo->prepare("
            UPDATE pet_record_update_requests
            SET status = 'assigned',
                assigned_veterinarian_user_id = ?,
                admin_notes = COALESCE(?, admin_notes),
                reviewed_by_user_id = COALESCE(reviewed_by_user_id, ?),
                reviewed_at = COALESCE(reviewed_at, NOW())
            WHERE request_id = ?
        ");
        $stmt->execute([$assignedVetId, $adminNotes, $actorUserId, $requestId]);
    } elseif ($action === 'start') {
        $stmt = $pdo->prepare("
            UPDATE pet_record_update_requests
            SET status = 'in_progress',
                assigned_veterinarian_user_id = COALESCE(assigned_veterinarian_user_id, ?),
                veterinarian_notes = COALESCE(?, veterinarian_notes)
            WHERE request_id = ?
              AND status IN ('approved', 'assigned', 'in_progress')
        ");
        $stmt->execute([$actorUserId, $vetNotes, $requestId]);
    } elseif ($action === 'complete') {
        $stmt = $pdo->prepare("
            UPDATE pet_record_update_requests
            SET status = 'completed',
                payment_status = CASE WHEN payment_status IN ('pending', 'submitted') THEN 'verified' ELSE payment_status END,
                assigned_veterinarian_user_id = COALESCE(assigned_veterinarian_user_id, ?),
                veterinarian_notes = COALESCE(?, veterinarian_notes),
                completed_by_user_id = ?,
                completed_at = NOW()
            WHERE request_id = ?
              AND status IN ('approved', 'assigned', 'in_progress')
        ");
        $stmt->execute([$actorUserId, $vetNotes, $actorUserId, $requestId]);
    } else {
        $status = record_request_nullable_text($input['status'] ?? null);
        $paymentStatus = record_request_nullable_text($input['paymentStatus'] ?? $input['payment_status'] ?? null);

        $stmt = $pdo->prepare("
            UPDATE pet_record_update_requests
            SET status = COALESCE(?, status),
                payment_status = COALESCE(?, payment_status),
                assigned_veterinarian_user_id = COALESCE(?, assigned_veterinarian_user_id),
                admin_notes = COALESCE(?, admin_notes),
                veterinarian_notes = COALESCE(?, veterinarian_notes)
            WHERE request_id = ?
        ");
        $stmt->execute([$status, $paymentStatus, $assignedVetId, $adminNotes, $vetNotes, $requestId]);
    }

    $record = record_request_fetch($pdo, ['request_id' => $requestId])[0] ?? null;
    echo json_encode(['success' => true, 'request' => $record]);
}

try {
    record_request_ensure_schema($pdo);

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
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Record update request failed: ' . $e->getMessage(),
    ]);
}
