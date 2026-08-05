<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/notification_helpers.php';
require_once __DIR__ . '/branch_helpers.php';

header('Content-Type: application/json');

function visit_billing_input(): array
{
    return json_decode(file_get_contents('php://input'), true) ?: [];
}

function visit_billing_table_exists(PDO $pdo, string $tableName): bool
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

function visit_billing_column_exists(PDO $pdo, string $tableName, string $columnName): bool
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

function visit_billing_api_user(): ?array
{
    $currentUser = $GLOBALS['ipawcus_current_api_user'] ?? null;
    return is_array($currentUser) ? $currentUser : null;
}

function visit_billing_assert_branch_access(PDO $pdo, int $branchId): void
{
    $currentUser = visit_billing_api_user();
    if (!$currentUser) {
        return;
    }

    $role = branch_normalize_role($currentUser['role'] ?? $currentUser['normalized_role'] ?? '');
    if ($role === 'admin' && !branch_user_can_access($pdo, $currentUser, $branchId)) {
        visit_billing_error(403, 'This visit belongs to a different clinic location.');
    }
}

function visit_billing_resolve_branch_id(PDO $pdo, array $input, ?int $queueId, ?int $bookingId): int
{
    $requested = visit_billing_requested_id($input, 'branch_id', 'branchId');
    if ($bookingId !== null && $bookingId > 0) {
        $stmt = $pdo->prepare('SELECT branch_id FROM bookings WHERE booking_id = ? LIMIT 1');
        $stmt->execute([$bookingId]);
        $branchId = (int)$stmt->fetchColumn();
        if ($branchId > 0) {
            visit_billing_assert_branch_access($pdo, $branchId);
            return $branchId;
        }
    }
    if ($queueId !== null && $queueId > 0) {
        $stmt = $pdo->prepare('SELECT branch_id FROM queues WHERE queue_id = ? LIMIT 1');
        $stmt->execute([$queueId]);
        $branchId = (int)$stmt->fetchColumn();
        if ($branchId > 0) {
            visit_billing_assert_branch_access($pdo, $branchId);
            return $branchId;
        }
    }
    if ($requested !== null && $requested > 0 && branch_fetch($pdo, $requested)) {
        visit_billing_assert_branch_access($pdo, $requested);
        return $requested;
    }

    $actor = visit_billing_require_actor($pdo);
    $branchId = branch_user_primary_id($pdo, (int)$actor['user_id']);
    visit_billing_assert_branch_access($pdo, $branchId);
    return $branchId;
}

function visit_billing_single_column_unique_index_exists(
    PDO $pdo,
    string $tableName,
    string $indexName,
    string $columnName
): bool {
    $stmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM information_schema.statistics expected_index
        WHERE expected_index.table_schema = DATABASE()
          AND expected_index.table_name = ?
          AND expected_index.index_name = ?
          AND expected_index.non_unique = 0
          AND expected_index.seq_in_index = 1
          AND expected_index.column_name = ?
          AND NOT EXISTS (
              SELECT 1
              FROM information_schema.statistics extra_column
              WHERE extra_column.table_schema = expected_index.table_schema
                AND extra_column.table_name = expected_index.table_name
                AND extra_column.index_name = expected_index.index_name
                AND extra_column.seq_in_index > 1
          )
    ");
    $stmt->execute([$tableName, $indexName, $columnName]);

    return (int)$stmt->fetchColumn() === 1;
}

function visit_billing_foreign_key_exists(
    PDO $pdo,
    string $tableName,
    string $constraintName,
    string $columnName,
    string $referencedTableName,
    string $referencedColumnName
): bool {
    $stmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM information_schema.key_column_usage
        WHERE constraint_schema = DATABASE()
          AND table_name = ?
          AND constraint_name = ?
          AND column_name = ?
          AND referenced_table_name = ?
          AND referenced_column_name = ?
    ");
    $stmt->execute([
        $tableName,
        $constraintName,
        $columnName,
        $referencedTableName,
        $referencedColumnName,
    ]);

    return (int)$stmt->fetchColumn() === 1;
}

function visit_billing_column_type(PDO $pdo, string $tableName, string $columnName): string
{
    $stmt = $pdo->prepare("
        SELECT COLUMN_TYPE
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = ?
          AND column_name = ?
        LIMIT 1
    ");
    $stmt->execute([$tableName, $columnName]);

    return (string)($stmt->fetchColumn() ?: '');
}

function visit_billing_schema_ready(PDO $pdo): bool
{
    foreach (['visits', 'visit_charges', 'visit_payments', 'service_catalog'] as $tableName) {
        if (!visit_billing_table_exists($pdo, $tableName)) {
            return false;
        }
    }

    return true;
}

function visit_billing_missing_message(): string
{
    return 'Visit billing schema is missing. Run DDL/20260723_01_backend_integrity_schema.sql first.';
}

function visit_billing_error(int $statusCode, string $message): void
{
    if (defined('VISIT_BILLING_THROW_ERRORS') && VISIT_BILLING_THROW_ERRORS) {
        http_response_code($statusCode);
        throw new RuntimeException($message);
    }

    ipawcus_rollback_current_transaction();

    http_response_code($statusCode);
    echo json_encode(['success' => false, 'message' => $message]);
    exit;
}

function visit_billing_require_schema(PDO $pdo): void
{
    if (!visit_billing_schema_ready($pdo)) {
        visit_billing_error(409, visit_billing_missing_message());
    }
}

function visit_billing_ensure_payment_method_schema(PDO $pdo): void
{
    $columnType = visit_billing_column_type($pdo, 'visit_payments', 'payment_method');
    if ($columnType === '' || stripos($columnType, "'cash'") !== false) {
        return;
    }

    visit_billing_error(409, 'POS cash payments are not ready in the current database enum. No runtime schema changes were attempted.');
}

function visit_billing_nullable_int($value): ?int
{
    if ($value === null || $value === '') {
        return null;
    }

    return is_numeric($value) ? (int)$value : null;
}

function visit_billing_requested_id(array $input, string $snakeKey, string $camelKey): ?int
{
    $requestedIds = [];
    foreach ([$snakeKey, $camelKey] as $key) {
        if (!array_key_exists($key, $input)) {
            continue;
        }

        $requestedId = visit_billing_nullable_int($input[$key]);
        if ($requestedId !== null && $requestedId > 0) {
            $requestedIds[$requestedId] = true;
        }
    }

    if (count($requestedIds) > 1) {
        visit_billing_error(409, "Conflicting {$snakeKey} values were provided.");
    }

    $requestedId = array_key_first($requestedIds);
    return $requestedId === null ? null : (int)$requestedId;
}

function visit_billing_nullable_text($value): ?string
{
    $text = trim((string)($value ?? ''));
    return $text === '' ? null : $text;
}

function visit_billing_allowed(string $value, array $allowed, string $fallback): string
{
    return in_array($value, $allowed, true) ? $value : $fallback;
}

function visit_billing_require_allowed(string $value, array $allowed, string $label): string
{
    if (!in_array($value, $allowed, true)) {
        visit_billing_error(422, "Invalid {$label}.");
    }

    return $value;
}

function visit_billing_is_duplicate_key(Throwable $error): bool
{
    return $error instanceof PDOException
        && (
            (int)($error->errorInfo[1] ?? 0) === 1062
            || (string)$error->getCode() === '23000'
        );
}

function visit_billing_decode_json($value)
{
    if ($value === null || $value === '') {
        return null;
    }

    $decoded = json_decode((string)$value, true);

    return json_last_error() === JSON_ERROR_NONE ? $decoded : null;
}

function visit_billing_ensure_walk_in_patient(PDO $pdo): array
{
    $ownerEmail = 'pos.walkin@counter.local';
    $petShareId = 'PET-WALK-IN-SALE';

    $stmt = $pdo->prepare("SELECT user_id FROM users WHERE mail_Address = ? LIMIT 1");
    $stmt->execute([$ownerEmail]);
    $ownerUserId = $stmt->fetchColumn();

    if (!$ownerUserId) {
        $stmt = $pdo->prepare("
            INSERT INTO users (first_Name, last_Name, mail_Address, personal_Address, role)
            VALUES (?, ?, ?, ?, ?)
        ");
        $stmt->execute(['Walk-in', 'Counter Sale', $ownerEmail, 'POS counter sale', 'guest']);
        $ownerUserId = (int)$pdo->lastInsertId();
    } else {
        $ownerUserId = (int)$ownerUserId;
    }

    $hasShareId = visit_billing_column_exists($pdo, 'pets_information', 'pet_sharable_ID');
    if ($hasShareId) {
        $stmt = $pdo->prepare("SELECT pet_id FROM pets_information WHERE pet_sharable_ID = ? LIMIT 1");
        $stmt->execute([$petShareId]);
    } else {
        $stmt = $pdo->prepare("
            SELECT pet_id
            FROM pets_information
            WHERE pet_name IN (?, ?)
              AND pet_Temp_owner = ?
            LIMIT 1
        ");
        $stmt->execute(['Walk-in Sale', 'Walk-in Customer', 'Counter Sale']);
    }
    $petId = $stmt->fetchColumn();

    if (!$petId) {
        $columns = [
            'pet_name',
            'pet_species',
            'pet_breed',
            'pet_BDAY',
            'pet_status',
            'pet_gender',
            'pet_weight',
            'pet_Temp_owner',
            'pet_allergies',
            'pet_color_marking',
            'pet_age',
        ];
        $values = [
            'Walk-in Sale',
            'Retail',
            'POS Sale',
            '1970-01-01',
            'Healthy',
            'N/A',
            0,
            'Counter Sale',
            null,
            'POS walk-in sale placeholder',
            'N/A',
        ];

        if ($hasShareId) {
            $columns[] = 'pet_sharable_ID';
            $values[] = $petShareId;
        }

        $placeholders = implode(', ', array_fill(0, count($columns), '?'));
        $stmt = $pdo->prepare('INSERT INTO pets_information (' . implode(', ', $columns) . ") VALUES ({$placeholders})");
        $stmt->execute($values);
        $petId = (int)$pdo->lastInsertId();
    } else {
        $petId = (int)$petId;
        $stmt = $pdo->prepare("
            UPDATE pets_information
            SET pet_name = ?,
                pet_species = ?,
                pet_breed = ?,
                pet_Temp_owner = ?,
                pet_color_marking = ?
            WHERE pet_id = ?
        ");
        $stmt->execute([
            'Walk-in Sale',
            'Retail',
            'POS Sale',
            'Counter Sale',
            'POS walk-in sale placeholder',
            $petId,
        ]);
    }

    $stmt = $pdo->prepare("SELECT link_id FROM pet_ownership WHERE pet_id = ? LIMIT 1");
    $stmt->execute([$petId]);
    if (!$stmt->fetchColumn()) {
        $stmt = $pdo->prepare("INSERT INTO pet_ownership (user_id, pet_id) VALUES (?, ?)");
        $stmt->execute([$ownerUserId, $petId]);
    }

    return [
        'pet_id' => $petId,
        'owner_user_id' => $ownerUserId,
    ];
}

function visit_billing_resolve_visit_context(
    PDO $pdo,
    int $petId,
    ?int $queueId,
    ?int $bookingId,
    ?int $diagnosisId,
    ?int $requestedOwnerUserId,
    ?int $requestedVeterinarianUserId
): array {
    $petStmt = $pdo->prepare("SELECT pet_id FROM pets_information WHERE pet_id = ? LIMIT 1");
    $petStmt->execute([$petId]);
    if (!$petStmt->fetchColumn()) {
        visit_billing_error(404, 'Pet was not found for this visit.');
    }

    $ownerCandidates = [];
    $veterinarianCandidates = [];
    $addOwner = static function ($value) use (&$ownerCandidates): void {
        $id = visit_billing_nullable_int($value);
        if ($id !== null && $id > 0) {
            $ownerCandidates[$id] = true;
        }
    };
    $addVeterinarian = static function ($value) use (&$veterinarianCandidates): void {
        $id = visit_billing_nullable_int($value);
        if ($id !== null && $id > 0) {
            $veterinarianCandidates[$id] = true;
        }
    };

    if ($queueId !== null) {
        $queueStmt = $pdo->prepare("
            SELECT pet_id, user_id, booking_id
            FROM queues
            WHERE queue_id = ?
            LIMIT 1
        ");
        $queueStmt->execute([$queueId]);
        $queue = $queueStmt->fetch(PDO::FETCH_ASSOC);
        if (!$queue) {
            visit_billing_error(404, 'Queue was not found for this visit.');
        }
        if ((int)$queue['pet_id'] !== $petId) {
            visit_billing_error(409, 'Queue patient does not match the visit patient.');
        }
        $queueBookingId = visit_billing_nullable_int($queue['booking_id'] ?? null);
        if ($bookingId !== null && $queueBookingId !== null && $queueBookingId !== $bookingId) {
            visit_billing_error(409, 'Queue booking does not match the requested visit booking.');
        }
        $addOwner($queue['user_id'] ?? null);
    }

    if ($bookingId !== null) {
        $bookingStmt = $pdo->prepare("
            SELECT pet_id, user_id, veterinarian_id
            FROM bookings
            WHERE booking_id = ?
            LIMIT 1
        ");
        $bookingStmt->execute([$bookingId]);
        $booking = $bookingStmt->fetch(PDO::FETCH_ASSOC);
        if (!$booking) {
            visit_billing_error(404, 'Booking was not found for this visit.');
        }
        if (visit_billing_nullable_int($booking['pet_id'] ?? null) !== $petId) {
            visit_billing_error(409, 'Booking patient does not match the visit patient.');
        }
        $addOwner($booking['user_id'] ?? null);
        $addVeterinarian($booking['veterinarian_id'] ?? null);
    }

    if ($diagnosisId !== null) {
        $diagnosisStmt = $pdo->prepare("
            SELECT pet_id, queue_id, booking_id, veterinarian_user_id
            FROM vet_diagnoses
            WHERE diagnosis_id = ?
            LIMIT 1
        ");
        $diagnosisStmt->execute([$diagnosisId]);
        $diagnosis = $diagnosisStmt->fetch(PDO::FETCH_ASSOC);
        if (!$diagnosis) {
            visit_billing_error(404, 'Diagnosis was not found for this visit.');
        }
        if ((int)$diagnosis['pet_id'] !== $petId) {
            visit_billing_error(409, 'Diagnosis patient does not match the visit patient.');
        }

        $diagnosisQueueId = visit_billing_nullable_int($diagnosis['queue_id'] ?? null);
        $diagnosisBookingId = visit_billing_nullable_int($diagnosis['booking_id'] ?? null);
        if ($queueId !== null && $diagnosisQueueId !== null && $diagnosisQueueId !== $queueId) {
            visit_billing_error(409, 'Diagnosis queue does not match the requested visit queue.');
        }
        if ($bookingId !== null && $diagnosisBookingId !== null && $diagnosisBookingId !== $bookingId) {
            visit_billing_error(409, 'Diagnosis booking does not match the requested visit booking.');
        }
        $addVeterinarian($diagnosis['veterinarian_user_id'] ?? null);
    }

    if (empty($ownerCandidates)) {
        $ownershipStmt = $pdo->prepare("
            SELECT user_id
            FROM pet_ownership
            WHERE pet_id = ?
            ORDER BY link_id DESC
            LIMIT 1
        ");
        $ownershipStmt->execute([$petId]);
        $addOwner($ownershipStmt->fetchColumn());
    }

    if (count($ownerCandidates) > 1) {
        visit_billing_error(409, 'Visit sources resolve to different pet owners.');
    }
    $resolvedOwnerUserId = (int)(array_key_first($ownerCandidates) ?? 0);
    if ($requestedOwnerUserId !== null && $requestedOwnerUserId > 0) {
        if ($resolvedOwnerUserId > 0 && $requestedOwnerUserId !== $resolvedOwnerUserId) {
            visit_billing_error(409, 'Requested owner does not match the visit patient or source record.');
        }
        $resolvedOwnerUserId = $requestedOwnerUserId;
    }
    if ($resolvedOwnerUserId <= 0) {
        visit_billing_error(400, 'owner_user_id could not be resolved for this visit.');
    }

    $ownerStmt = $pdo->prepare("SELECT user_id FROM users WHERE user_id = ? LIMIT 1");
    $ownerStmt->execute([$resolvedOwnerUserId]);
    if (!$ownerStmt->fetchColumn()) {
        visit_billing_error(404, 'Visit owner account was not found.');
    }

    if (count($veterinarianCandidates) > 1) {
        visit_billing_error(409, 'Visit sources resolve to different veterinarians.');
    }
    $resolvedVeterinarianUserId = array_key_first($veterinarianCandidates);
    $resolvedVeterinarianUserId = $resolvedVeterinarianUserId === null
        ? null
        : (int)$resolvedVeterinarianUserId;
    if ($requestedVeterinarianUserId !== null && $requestedVeterinarianUserId > 0) {
        if (
            $resolvedVeterinarianUserId !== null
            && $requestedVeterinarianUserId !== $resolvedVeterinarianUserId
        ) {
            visit_billing_error(409, 'Requested veterinarian does not match the visit source record.');
        }
        $resolvedVeterinarianUserId = $requestedVeterinarianUserId;
    }

    return [
        'owner_user_id' => $resolvedOwnerUserId,
        'veterinarian_user_id' => $resolvedVeterinarianUserId,
    ];
}

function visit_billing_fetch_visit_identity(PDO $pdo, int $visitId, bool $forUpdate = false): ?array
{
    $lockSql = $forUpdate && $pdo->inTransaction() ? 'FOR UPDATE' : '';
    $stmt = $pdo->prepare("
        SELECT
            visit_id,
            branch_id,
            pet_id,
            owner_user_id,
            veterinarian_user_id,
            queue_id,
            booking_id,
            diagnosis_id,
            source_type,
            billing_status,
            visit_status
        FROM visits
        WHERE visit_id = ?
        LIMIT 1
        {$lockSql}
    ");
    $stmt->execute([$visitId]);
    $visit = $stmt->fetch(PDO::FETCH_ASSOC);

    return $visit ?: null;
}

function visit_billing_assert_visit_identity(
    PDO $pdo,
    int $visitId,
    array $input,
    bool $allowMissingLinks = false,
    bool $forUpdate = false
): array {
    $visit = visit_billing_fetch_visit_identity($pdo, $visitId, $forUpdate);
    if (!$visit) {
        visit_billing_error(404, 'Visit was not found.');
    }
    visit_billing_assert_branch_access($pdo, (int)$visit['branch_id']);

    $requestedVisitId = visit_billing_requested_id($input, 'visit_id', 'visitId');
    if ($requestedVisitId !== null && $requestedVisitId !== $visitId) {
        visit_billing_error(409, "Visit ID {$visitId} does not match the requested visit_id.");
    }

    foreach ([
        ['pet_id', 'petId'],
        ['queue_id', 'queueId'],
        ['booking_id', 'bookingId'],
        ['diagnosis_id', 'diagnosisId'],
    ] as [$snakeKey, $camelKey]) {
        $requestedId = visit_billing_requested_id($input, $snakeKey, $camelKey);
        if ($requestedId === null) {
            continue;
        }

        $storedId = visit_billing_nullable_int($visit[$snakeKey] ?? null);
        $canAttachMissingLink = $allowMissingLinks
            && $snakeKey !== 'pet_id'
            && $storedId === null;
        if (!$canAttachMissingLink && $storedId !== $requestedId) {
            visit_billing_error(
                409,
                "Visit ID {$visitId} does not match the requested {$snakeKey}."
            );
        }
    }

    return $visit;
}

function visit_billing_fetch_visit_id(PDO $pdo, array $input): ?int
{
    $visitId = visit_billing_requested_id($input, 'visit_id', 'visitId');
    if ($visitId !== null) {
        visit_billing_assert_visit_identity(
            $pdo,
            $visitId,
            $input,
            false,
            $pdo->inTransaction()
        );
        return $visitId;
    }

    $petId = visit_billing_requested_id($input, 'pet_id', 'petId');
    $queueId = visit_billing_requested_id($input, 'queue_id', 'queueId');
    $bookingId = visit_billing_requested_id($input, 'booking_id', 'bookingId');
    $diagnosisId = visit_billing_requested_id($input, 'diagnosis_id', 'diagnosisId');

    if ($diagnosisId !== null && $diagnosisId > 0) {
        $stmt = $pdo->prepare("SELECT visit_id FROM visits WHERE diagnosis_id = ? LIMIT 1");
        $stmt->execute([$diagnosisId]);
        $existing = $stmt->fetchColumn();
        if ($existing) {
            $existingVisitId = (int)$existing;
            visit_billing_assert_visit_identity(
                $pdo,
                $existingVisitId,
                $input,
                true,
                $pdo->inTransaction()
            );
            return $existingVisitId;
        }
    }

    if ($petId !== null && $queueId !== null) {
        $stmt = $pdo->prepare("SELECT visit_id FROM visits WHERE pet_id = ? AND queue_id = ? LIMIT 1");
        $stmt->execute([$petId, $queueId]);
        $existing = $stmt->fetchColumn();
        if ($existing) {
            $existingVisitId = (int)$existing;
            visit_billing_assert_visit_identity(
                $pdo,
                $existingVisitId,
                $input,
                true,
                $pdo->inTransaction()
            );
            return $existingVisitId;
        }
    }

    if ($petId !== null && $bookingId !== null) {
        $stmt = $pdo->prepare("SELECT visit_id FROM visits WHERE pet_id = ? AND booking_id = ? LIMIT 1");
        $stmt->execute([$petId, $bookingId]);
        $existing = $stmt->fetchColumn();
        if ($existing) {
            $existingVisitId = (int)$existing;
            visit_billing_assert_visit_identity(
                $pdo,
                $existingVisitId,
                $input,
                true,
                $pdo->inTransaction()
            );
            return $existingVisitId;
        }
    }

    return null;
}

function visit_billing_update_status(PDO $pdo, int $visitId): void
{
    $chargeStmt = $pdo->prepare("SELECT COALESCE(SUM(subtotal), 0) FROM visit_charges WHERE visit_id = ?");
    $chargeStmt->execute([$visitId]);
    $total = (float)$chargeStmt->fetchColumn();

    $paymentStmt = $pdo->prepare("
        SELECT COALESCE(SUM(amount), 0)
        FROM visit_payments
        WHERE visit_id = ?
          AND payment_status = 'verified'
    ");
    $paymentStmt->execute([$visitId]);
    $paid = (float)$paymentStmt->fetchColumn();

    if ($total <= 0) {
        $status = 'unbilled';
    } elseif ($paid <= 0) {
        $status = 'unpaid';
    } elseif ($paid + 0.0001 < $total) {
        $status = 'partial';
    } else {
        $status = 'paid';
    }

    $stmt = $pdo->prepare("
        UPDATE visits
        SET billing_status = ?
        WHERE visit_id = ?
          AND billing_status <> 'refunded'
    ");
    $stmt->execute([$status, $visitId]);
}

function visit_billing_is_whole_quantity(float $quantity): bool
{
    return abs($quantity - round($quantity)) <= 0.0001;
}

function visit_billing_fetch_user(PDO $pdo, ?int $userId): ?array
{
    if ($userId === null || $userId <= 0) {
        return null;
    }

    $stmt = $pdo->prepare("
        SELECT
            user_id,
            TRIM(CONCAT(COALESCE(first_Name, ''), ' ', COALESCE(last_Name, ''))) AS full_name,
            mail_Address
        FROM users
        WHERE user_id = ?
        LIMIT 1
    ");
    $stmt->execute([$userId]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        return null;
    }

    return [
        'user_id' => (int)$user['user_id'],
        'full_name' => trim((string)($user['full_name'] ?? '')) ?: (string)($user['mail_Address'] ?? 'Clinic Staff'),
    ];
}

function visit_billing_current_actor(PDO $pdo): ?array
{
    $currentUser = $GLOBALS['ipawcus_current_api_user'] ?? null;
    $currentUserId = is_array($currentUser)
        ? visit_billing_nullable_int($currentUser['user_id'] ?? $currentUser['id'] ?? null)
        : null;

    if ($currentUserId === null || $currentUserId <= 0) {
        $currentUserId = visit_billing_nullable_int($_SERVER['IPAWCUS_USER_ID'] ?? null);
    }

    return visit_billing_fetch_user($pdo, $currentUserId);
}

function visit_billing_require_actor(PDO $pdo): array
{
    $actor = visit_billing_current_actor($pdo);
    if (!$actor || (int)($actor['user_id'] ?? 0) <= 0) {
        visit_billing_error(401, 'An authenticated clinic user is required for billing changes.');
    }

    return $actor;
}

function visit_billing_lock_visit(PDO $pdo, int $visitId): array
{
    $stmt = $pdo->prepare("
        SELECT visit_id, billing_status
        FROM visits
        WHERE visit_id = ?
        LIMIT 1
        FOR UPDATE
    ");
    $stmt->execute([$visitId]);
    $visit = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$visit) {
        visit_billing_error(404, 'Visit was not found.');
    }

    return $visit;
}

function visit_billing_assert_charges_mutable(PDO $pdo, int $visitId): array
{
    $visit = visit_billing_lock_visit($pdo, $visitId);
    $totalsStmt = $pdo->prepare("
        SELECT COALESCE(SUM(amount), 0) AS verified_total
        FROM visit_payments
        WHERE visit_id = ?
          AND payment_status = 'verified'
    ");
    $totalsStmt->execute([$visitId]);
    $totals = $totalsStmt->fetch(PDO::FETCH_ASSOC) ?: [];
    $verifiedTotal = (float)($totals['verified_total'] ?? 0);

    if (
        in_array(($visit['billing_status'] ?? ''), ['partial', 'paid', 'refunded'], true)
        || $verifiedTotal > 0.0001
    ) {
        visit_billing_error(409, 'Visit charges are locked after a verified payment and cannot be changed.');
    }

    return $visit;
}

function visit_billing_resolve_stock_performer(PDO $pdo, int $visitId, ?int $preferredUserId = null): array
{
    $preferredUser = visit_billing_fetch_user($pdo, $preferredUserId);
    if ($preferredUser) {
        return $preferredUser;
    }

    $stmt = $pdo->prepare("
        SELECT COALESCE(v.veterinarian_user_id, v.owner_user_id) AS user_id
        FROM visits v
        WHERE v.visit_id = ?
        LIMIT 1
    ");
    $stmt->execute([$visitId]);
    $visitUserId = $stmt->fetchColumn();
    $visitUser = visit_billing_fetch_user($pdo, $visitUserId ? (int)$visitUserId : null);
    if ($visitUser) {
        return $visitUser;
    }

    $fallbackStmt = $pdo->query("
        SELECT
            user_id,
            TRIM(CONCAT(COALESCE(first_Name, ''), ' ', COALESCE(last_Name, ''))) AS full_name,
            mail_Address
        FROM users
        ORDER BY user_id ASC
        LIMIT 1
    ");
    $fallback = $fallbackStmt->fetch(PDO::FETCH_ASSOC);
    if ($fallback) {
        return [
            'user_id' => (int)$fallback['user_id'],
            'full_name' => trim((string)($fallback['full_name'] ?? '')) ?: (string)($fallback['mail_Address'] ?? 'Clinic Staff'),
        ];
    }

    visit_billing_error(409, 'A valid user is required to record inventory movement.');
}

function visit_billing_fetch_inventory_item(PDO $pdo, int $itemId, string $chargeType): array
{
    if (!visit_billing_table_exists($pdo, 'inventory_items')) {
        visit_billing_error(409, 'Inventory schema is missing.');
    }

    $stmt = $pdo->prepare("
        SELECT item_id, item_name, category, status
        FROM inventory_items
        WHERE item_id = ?
        LIMIT 1
    ");
    $stmt->execute([$itemId]);
    $item = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$item) {
        visit_billing_error(404, 'Inventory item was not found for a visit charge.');
    }

    if (($item['status'] ?? '') !== 'active') {
        visit_billing_error(409, 'Inactive inventory items cannot be billed or consumed.');
    }

    $category = strtoupper(trim((string)($item['category'] ?? '')));
    if ($chargeType === 'medication' && $category !== 'MEDICATION') {
        visit_billing_error(400, 'Medication charges must use an inventory item categorized as MEDICATION.');
    }

    if ($chargeType === 'retail_product' && in_array($category, ['MEDICATION', 'CONSUMABLE'], true)) {
        visit_billing_error(400, 'Product charges cannot use medication or internal consumable inventory items.');
    }

    return $item;
}

function visit_billing_consume_inventory_item(
    PDO $pdo,
    int $itemId,
    float $quantity,
    int $chargeId,
    string $description,
    string $chargeType,
    array $performer
): void {
    if ($quantity <= 0) {
        return;
    }

    if (!visit_billing_table_exists($pdo, 'inventory_batches') || !visit_billing_table_exists($pdo, 'inventory_stock_movements')) {
        visit_billing_error(409, 'Inventory batch and movement schema is required before inventory-linked charges can be saved.');
    }

    $item = visit_billing_fetch_inventory_item($pdo, $itemId, $chargeType);
    if (!visit_billing_is_whole_quantity($quantity)) {
        visit_billing_error(400, "Inventory quantity for {$item['item_name']} must be a whole number.");
    }

    $needed = (int)round($quantity);
    if ($needed <= 0) {
        return;
    }

    $batchStmt = $pdo->prepare("
        SELECT batch.batch_id, batch.quantity, batch.location_id
        FROM inventory_batches batch
        JOIN inventory_locations location ON location.location_id = batch.location_id
        JOIN visit_charges charge ON charge.charge_id = ?
        JOIN visits visit ON visit.visit_id = charge.visit_id AND visit.branch_id = location.branch_id
        WHERE batch.item_id = ?
          AND batch.quantity > 0
          AND (batch.expiry_date IS NULL OR batch.expiry_date >= CURDATE())
        ORDER BY batch.expiry_date IS NULL ASC, batch.expiry_date ASC, batch.created_at ASC, batch.batch_id ASC
        FOR UPDATE
    ");
    $batchStmt->execute([$chargeId, $itemId]);
    $batches = $batchStmt->fetchAll(PDO::FETCH_ASSOC);
    $available = array_reduce($batches, fn($sum, $batch) => $sum + (int)$batch['quantity'], 0);

    if ($available < $needed) {
        visit_billing_error(409, "{$item['item_name']} has insufficient stock. Needs {$needed}, available {$available}.");
    }

    $remaining = $needed;
    $updateBatch = $pdo->prepare("UPDATE inventory_batches SET quantity = ? WHERE batch_id = ?");
    $movementStmt = $pdo->prepare("
        INSERT INTO inventory_stock_movements (
            item_id,
            batch_id,
            location_id,
            movement_type,
            quantity_change,
            quantity_before,
            quantity_after,
            reference_type,
            reference_id,
            remarks,
            performed_by_user_id,
            performed_by_name
        ) VALUES (?, ?, ?, 'stock_out', ?, ?, ?, 'visit_charges', ?, ?, ?, ?)
    ");

    foreach ($batches as $batch) {
        if ($remaining <= 0) {
            break;
        }

        $before = (int)$batch['quantity'];
        $deduct = min($before, $remaining);
        $after = $before - $deduct;

        $updateBatch->execute([$after, (int)$batch['batch_id']]);
        $movementStmt->execute([
            $itemId,
            (int)$batch['batch_id'],
            (int)$batch['location_id'],
            -$deduct,
            $before,
            $after,
            $chargeId,
            'Visit charge stock use: ' . substr($description, 0, 180),
            (int)$performer['user_id'],
            $performer['full_name'],
        ]);

        $remaining -= $deduct;
    }
}

function visit_billing_reverse_visit_charge_stock(PDO $pdo, int $visitId, array $performer): void
{
    if (
        !visit_billing_table_exists($pdo, 'inventory_stock_movements')
        || !visit_billing_table_exists($pdo, 'inventory_batches')
    ) {
        return;
    }

    $movementStmt = $pdo->prepare("
        SELECT ism.*
        FROM inventory_stock_movements ism
        JOIN visit_charges vc ON vc.charge_id = ism.reference_id
        WHERE vc.visit_id = ?
          AND ism.reference_type = 'visit_charges'
          AND ism.quantity_change < 0
        ORDER BY ism.movement_id DESC
        FOR UPDATE
    ");
    $movementStmt->execute([$visitId]);
    $movements = $movementStmt->fetchAll(PDO::FETCH_ASSOC);

    if (!$movements) {
        return;
    }

    $batchStmt = $pdo->prepare("
        SELECT quantity
        FROM inventory_batches
        WHERE batch_id = ?
          AND item_id = ?
        LIMIT 1
        FOR UPDATE
    ");
    $updateBatch = $pdo->prepare("UPDATE inventory_batches SET quantity = ? WHERE batch_id = ?");
    $reversalStmt = $pdo->prepare("
        INSERT INTO inventory_stock_movements (
            item_id,
            batch_id,
            location_id,
            movement_type,
            quantity_change,
            quantity_before,
            quantity_after,
            reference_type,
            reference_id,
            remarks,
            performed_by_user_id,
            performed_by_name
        ) VALUES (?, ?, ?, 'adjustment', ?, ?, ?, 'visit_charge_reversal', ?, ?, ?, ?)
    ");

    foreach ($movements as $movement) {
        $batchId = (int)($movement['batch_id'] ?? 0);
        $itemId = (int)$movement['item_id'];
        $restore = abs((int)$movement['quantity_change']);
        if ($batchId <= 0 || $restore <= 0) {
            continue;
        }

        $batchStmt->execute([$batchId, $itemId]);
        $before = $batchStmt->fetchColumn();
        if ($before === false) {
            visit_billing_error(409, 'Cannot reverse inventory movement because the original batch no longer exists.');
        }

        $before = (int)$before;
        $after = $before + $restore;
        $updateBatch->execute([$after, $batchId]);
        $reversalStmt->execute([
            $itemId,
            $batchId,
            isset($movement['location_id']) ? (int)$movement['location_id'] : null,
            $restore,
            $before,
            $after,
            (int)$movement['reference_id'],
            'Reversed visit charge stock use before invoice update.',
            (int)$performer['user_id'],
            $performer['full_name'],
        ]);
    }
}

function visit_billing_fetch_service_materials(PDO $pdo, int $serviceId): array
{
    if (!visit_billing_table_exists($pdo, 'service_materials')) {
        return [];
    }

    $stmt = $pdo->prepare("
        SELECT
            sm.item_id,
            sm.material_name,
            sm.qty_used,
            sm.billable_policy,
            ii.item_name
        FROM service_materials sm
        LEFT JOIN inventory_items ii ON ii.item_id = sm.item_id
        WHERE sm.service_id = ?
          AND sm.item_id IS NOT NULL
        ORDER BY sm.service_material_id ASC
    ");
    $stmt->execute([$serviceId]);

    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

function visit_billing_boarding_material_usage_id(array $charge): ?int
{
    $hasUsageId = array_key_exists('boarding_material_usage_id', $charge)
        || array_key_exists('boardingMaterialUsageId', $charge);
    if (!$hasUsageId) {
        return null;
    }

    $hasNonEmptyUsageId = false;
    foreach (['boarding_material_usage_id', 'boardingMaterialUsageId'] as $key) {
        if (!array_key_exists($key, $charge)) {
            continue;
        }
        $rawUsageId = $charge[$key];
        if ($rawUsageId === null || $rawUsageId === '') {
            continue;
        }
        $hasNonEmptyUsageId = true;
        if (
            !is_numeric($rawUsageId)
            || !is_finite((float)$rawUsageId)
            || (float)$rawUsageId <= 0
            || abs((float)$rawUsageId - round((float)$rawUsageId)) > 0.0001
        ) {
            visit_billing_error(400, 'A valid boarding material usage ID is required for the material charge.');
        }
    }

    if (!$hasNonEmptyUsageId) {
        return null;
    }

    $usageId = visit_billing_requested_id(
        $charge,
        'boarding_material_usage_id',
        'boardingMaterialUsageId'
    );
    if ($usageId === null || $usageId <= 0) {
        visit_billing_error(400, 'A valid boarding material usage ID is required for the material charge.');
    }

    return $usageId;
}

function visit_billing_validate_boarding_material_charge(
    PDO $pdo,
    int $visitId,
    int $usageId,
    string $chargeType,
    ?int $itemId,
    float $quantity,
    float $unitPrice
): void {
    if (
        !visit_billing_table_exists($pdo, 'boarding_material_usages')
        || !visit_billing_column_exists($pdo, 'visit_charges', 'boarding_material_usage_id')
        || !visit_billing_single_column_unique_index_exists(
            $pdo,
            'visit_charges',
            'visit_charges_boarding_material_unique',
            'boarding_material_usage_id'
        )
        || !visit_billing_foreign_key_exists(
            $pdo,
            'visit_charges',
            'visit_charges_boarding_material_fk',
            'boarding_material_usage_id',
            'boarding_material_usages',
            'usage_id'
        )
    ) {
        visit_billing_error(
            409,
            'Boarding material billing trace is not installed. Run DDL/20260723_01_backend_integrity_schema.sql first.'
        );
    }

    if ($chargeType !== 'boarding') {
        visit_billing_error(409, 'A boarding material usage can only be linked to a boarding charge.');
    }
    if ($itemId === null || $itemId <= 0) {
        visit_billing_error(409, 'The boarding material invoice line is missing its inventory item.');
    }

    $visitStmt = $pdo->prepare("
        SELECT booking_id
        FROM visits
        WHERE visit_id = ?
        LIMIT 1
        FOR UPDATE
    ");
    $visitStmt->execute([$visitId]);
    $bookingId = (int)($visitStmt->fetchColumn() ?: 0);
    if ($bookingId <= 0) {
        visit_billing_error(409, 'Boarding material charges require a visit linked to the boarding booking.');
    }

    $usageStmt = $pdo->prepare("
        SELECT
            bmu.booking_id,
            bmu.item_id,
            bmu.quantity,
            bmu.unit_price,
            bmu.status,
            ba.status AS assignment_status
        FROM boarding_material_usages bmu
        JOIN boarding_assignments ba ON ba.assignment_id = bmu.assignment_id
        WHERE bmu.usage_id = ?
        LIMIT 1
        FOR UPDATE
    ");
    $usageStmt->execute([$usageId]);
    $usage = $usageStmt->fetch(PDO::FETCH_ASSOC);
    if (!$usage) {
        visit_billing_error(404, 'The boarding material usage linked to this charge was not found.');
    }
    if (($usage['status'] ?? '') !== 'recorded') {
        visit_billing_error(409, 'Voided boarding material usage cannot be billed.');
    }
    if (!in_array((string)($usage['assignment_status'] ?? ''), ['reserved', 'occupied'], true)) {
        visit_billing_error(409, 'Boarding material usage cannot be billed after checkout or cancellation.');
    }
    if ((int)$usage['booking_id'] !== $bookingId) {
        visit_billing_error(409, 'The boarding material usage belongs to a different booking.');
    }
    if ((int)$usage['item_id'] !== $itemId) {
        visit_billing_error(409, 'The boarding material charge item does not match the recorded usage.');
    }
    if (abs((float)$usage['quantity'] - $quantity) > 0.0001) {
        visit_billing_error(409, 'The boarding material charge quantity does not match the recorded usage.');
    }
    if (abs((float)$usage['unit_price'] - $unitPrice) > 0.009) {
        visit_billing_error(409, 'The boarding material charge price does not match the recorded usage.');
    }

    $duplicateStmt = $pdo->prepare("
        SELECT charge_id
        FROM visit_charges
        WHERE boarding_material_usage_id = ?
        LIMIT 1
        FOR UPDATE
    ");
    $duplicateStmt->execute([$usageId]);
    if ((int)($duplicateStmt->fetchColumn() ?: 0) > 0) {
        visit_billing_error(409, 'This boarding material usage is already linked to an invoice charge.');
    }
}

function visit_billing_assert_boarding_invoice_complete(PDO $pdo, int $visitId): void
{
    $visitStmt = $pdo->prepare("
        SELECT v.booking_id, b.service_type, b.price
        FROM visits v
        LEFT JOIN bookings b ON b.booking_id = v.booking_id
        WHERE v.visit_id = ?
        LIMIT 1
        FOR UPDATE
    ");
    $visitStmt->execute([$visitId]);
    $visit = $visitStmt->fetch(PDO::FETCH_ASSOC);
    $bookingId = visit_billing_nullable_int($visit['booking_id'] ?? null);
    if ($bookingId === null || strtolower(trim((string)($visit['service_type'] ?? ''))) !== 'boarding') {
        return;
    }

    if (
        !visit_billing_table_exists($pdo, 'boarding_material_usages')
        || !visit_billing_column_exists($pdo, 'visit_charges', 'boarding_material_usage_id')
        || !visit_billing_single_column_unique_index_exists(
            $pdo,
            'visit_charges',
            'visit_charges_boarding_material_unique',
            'boarding_material_usage_id'
        )
        || !visit_billing_foreign_key_exists(
            $pdo,
            'visit_charges',
            'visit_charges_boarding_material_fk',
            'boarding_material_usage_id',
            'boarding_material_usages',
            'usage_id'
        )
    ) {
        visit_billing_error(
            409,
            'Boarding material billing trace is incomplete. Run DDL/20260723_01_backend_integrity_schema.sql before accepting payment.'
        );
    }

    $materialStmt = $pdo->prepare("
        SELECT
            bmu.usage_id,
            bmu.item_id,
            bmu.quantity,
            bmu.unit_price,
            vc.charge_id,
            vc.item_id AS charge_item_id,
            vc.quantity AS charge_quantity,
            vc.unit_price AS charge_unit_price,
            vc.subtotal AS charge_subtotal,
            charge_visit.booking_id AS charge_booking_id,
            charge_visit.visit_status AS charge_visit_status
        FROM boarding_material_usages bmu
        LEFT JOIN visit_charges vc
            ON vc.boarding_material_usage_id = bmu.usage_id
        LEFT JOIN visits charge_visit
            ON charge_visit.visit_id = vc.visit_id
        WHERE bmu.booking_id = ?
          AND bmu.status = 'recorded'
        ORDER BY bmu.usage_id ASC
        FOR UPDATE
    ");
    $materialStmt->execute([$bookingId]);
    foreach ($materialStmt->fetchAll(PDO::FETCH_ASSOC) as $material) {
        $expectedSubtotal = round(
            (float)$material['quantity'] * (float)$material['unit_price'],
            2
        );
        if (
            (int)($material['charge_id'] ?? 0) <= 0
            || (int)($material['charge_booking_id'] ?? 0) !== $bookingId
            || ($material['charge_visit_status'] ?? '') === 'cancelled'
            || (int)($material['charge_item_id'] ?? 0) !== (int)$material['item_id']
            || abs((float)$material['charge_quantity'] - (float)$material['quantity']) > 0.0001
            || abs((float)$material['charge_unit_price'] - (float)$material['unit_price']) > 0.009
            || abs((float)$material['charge_subtotal'] - $expectedSubtotal) > 0.009
        ) {
            visit_billing_error(
                409,
                'The boarding invoice is missing or does not match a recorded material. Refresh POS and include every boarding material before payment.'
            );
        }
    }

    $stayChargeStmt = $pdo->prepare("
        SELECT COALESCE(SUM(subtotal), 0)
        FROM visit_charges
        WHERE visit_id = ?
          AND boarding_material_usage_id IS NULL
    ");
    $stayChargeStmt->execute([$visitId]);
    $capturedStayPrice = max(0.0, (float)($visit['price'] ?? 0));
    $invoicedStayCharge = (float)$stayChargeStmt->fetchColumn();
    if ($invoicedStayCharge + 0.009 < $capturedStayPrice) {
        visit_billing_error(
            409,
            'The boarding stay charge is below the booking price. Refresh POS and restore the full stay charge before payment.'
        );
    }
}

function visit_billing_save_charges(PDO $pdo, int $visitId, array $charges, bool $replace = true): void
{
    visit_billing_assert_charges_mutable($pdo, $visitId);

    $authenticatedActor = visit_billing_require_actor($pdo);
    $preferredUserId = (int)$authenticatedActor['user_id'];
    $stockPerformer = visit_billing_resolve_stock_performer($pdo, $visitId, $preferredUserId);

    if ($replace) {
        visit_billing_reverse_visit_charge_stock($pdo, $visitId, $stockPerformer);

        $deleteStmt = $pdo->prepare("DELETE FROM visit_charges WHERE visit_id = ?");
        $deleteStmt->execute([$visitId]);
    }

    $allowedTypes = ['service', 'diagnostic', 'medication', 'consumable', 'retail_product', 'boarding', 'other'];
    $explicitServiceMaterials = [];
    foreach ($charges as $charge) {
        $serviceId = visit_billing_nullable_int($charge['service_id'] ?? $charge['serviceId'] ?? null);
        $itemId = visit_billing_nullable_int($charge['item_id'] ?? $charge['itemId'] ?? null);
        if ($serviceId !== null && $serviceId > 0 && $itemId !== null && $itemId > 0) {
            $explicitServiceMaterials[$serviceId][$itemId] = true;
        }
    }

    $supportsBoardingMaterialTrace = visit_billing_column_exists(
        $pdo,
        'visit_charges',
        'boarding_material_usage_id'
    );
    $boardingMaterialColumnSql = $supportsBoardingMaterialTrace
        ? ",
            boarding_material_usage_id"
        : '';
    $boardingMaterialPlaceholderSql = $supportsBoardingMaterialTrace ? ', ?' : '';
    $insertStmt = $pdo->prepare("
        INSERT INTO visit_charges (
            visit_id,
            charge_type,
            service_id,
            item_id,
            description,
            quantity,
            unit_price,
            subtotal,
            created_by_user_id
            {$boardingMaterialColumnSql}
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?{$boardingMaterialPlaceholderSql})
    ");

    foreach ($charges as $charge) {
        $description = visit_billing_nullable_text($charge['description'] ?? null);
        $quantity = (float)($charge['quantity'] ?? 1);
        $unitPrice = (float)($charge['unit_price'] ?? $charge['unitPrice'] ?? 0);

        if ($description === null) {
            continue;
        }

        if ($quantity <= 0) {
            visit_billing_error(400, 'Charge quantity must be greater than 0.');
        }

        if ($unitPrice < 0) {
            visit_billing_error(400, 'Charge price cannot be negative.');
        }

        $chargeType = visit_billing_allowed(
            trim((string)($charge['charge_type'] ?? $charge['chargeType'] ?? 'service')),
            $allowedTypes,
            'service'
        );
        $serviceId = visit_billing_nullable_int($charge['service_id'] ?? $charge['serviceId'] ?? null);
        $itemId = visit_billing_nullable_int($charge['item_id'] ?? $charge['itemId'] ?? null);
        $createdBy = (int)$authenticatedActor['user_id'];
        $subtotal = round($quantity * $unitPrice, 2);
        $boardingMaterialUsageId = visit_billing_boarding_material_usage_id($charge);

        if ($itemId !== null && $itemId > 0) {
            visit_billing_fetch_inventory_item($pdo, $itemId, $chargeType);
        }
        if ($boardingMaterialUsageId !== null) {
            visit_billing_validate_boarding_material_charge(
                $pdo,
                $visitId,
                $boardingMaterialUsageId,
                $chargeType,
                $itemId,
                $quantity,
                $unitPrice
            );
        }

        $insertValues = [
            $visitId,
            $chargeType,
            $serviceId,
            $itemId,
            $description,
            $quantity,
            $unitPrice,
            $subtotal,
            $createdBy
        ];
        if ($supportsBoardingMaterialTrace) {
            $insertValues[] = $boardingMaterialUsageId;
        }
        $insertStmt->execute($insertValues);
        $chargeId = (int)$pdo->lastInsertId();

        $linePerformer = $createdBy
            ? visit_billing_resolve_stock_performer($pdo, $visitId, $createdBy)
            : $stockPerformer;

        if ($itemId !== null && $itemId > 0) {
            visit_billing_consume_inventory_item(
                $pdo,
                $itemId,
                $quantity,
                $chargeId,
                $description,
                $chargeType,
                $linePerformer
            );
        }

        if ($serviceId !== null && $serviceId > 0 && $itemId === null && in_array($chargeType, ['service', 'diagnostic', 'boarding'], true)) {
            foreach (visit_billing_fetch_service_materials($pdo, $serviceId) as $material) {
                $materialItemId = (int)($material['item_id'] ?? 0);
                if ($materialItemId <= 0 || isset($explicitServiceMaterials[$serviceId][$materialItemId])) {
                    continue;
                }

                $materialQuantity = $quantity * (float)($material['qty_used'] ?? 0);
                $materialName = (string)($material['item_name'] ?? $material['material_name'] ?? $description);
                visit_billing_consume_inventory_item(
                    $pdo,
                    $materialItemId,
                    $materialQuantity,
                    $chargeId,
                    $description . ' - ' . $materialName,
                    'consumable',
                    $linePerformer
                );
            }
        }
    }

    visit_billing_update_status($pdo, $visitId);
}

function visit_billing_catalog_key($value): string
{
    $normalized = strtolower(trim((string)$value));
    $normalized = preg_replace('/[^a-z0-9]+/', '_', $normalized);

    return trim((string)$normalized, '_');
}

function visit_billing_booking_catalog_service(PDO $pdo, string $serviceType): ?array
{
    if (!visit_billing_table_exists($pdo, 'service_catalog')) {
        return null;
    }

    $serviceKey = visit_billing_catalog_key($serviceType);
    $aliases = [
        'consultation' => ['consultation', 'general_consultation', 'general_check_up', 'general_checkup'],
        'general_check_up' => ['consultation', 'general_consultation', 'general_check_up', 'general_checkup'],
        'general_checkup' => ['consultation', 'general_consultation', 'general_check_up', 'general_checkup'],
        'online_consultation' => ['online_consultation'],
        'home_service' => ['home_service', 'home_visit', 'home_visit_consultation'],
        'parasite_control' => ['parasite_control', 'deworming'],
        'vaccination' => ['vaccination', 'vaccine'],
        'grooming' => ['grooming'],
        'dental' => ['dental', 'dental_assessment', 'dental_check_up', 'dental_checkup'],
        'dental_check_up' => ['dental', 'dental_assessment', 'dental_check_up', 'dental_checkup'],
        'surgery' => ['surgery'],
        'lab_testing' => ['lab_testing', 'laboratory', 'diagnostic'],
    ];
    $acceptedKeys = $aliases[$serviceKey] ?? [$serviceKey];

    $stmt = $pdo->query("
        SELECT service_id, service_code, service_name, service_type, base_price
        FROM service_catalog
        WHERE is_active = 1
        ORDER BY service_id ASC
    ");
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $service) {
        foreach (['service_code', 'service_name', 'service_type'] as $field) {
            if (in_array(visit_billing_catalog_key($service[$field] ?? ''), $acceptedKeys, true)) {
                return $service;
            }
        }
    }

    return null;
}

function visit_billing_booking_service_label(array $booking): string
{
    $serviceType = trim((string)($booking['service_type'] ?? ''));
    $isHomeService = (int)($booking['is_home_service'] ?? 0) === 1
        || visit_billing_catalog_key($serviceType) === 'home_service';
    $isOnlineConsultation = (int)($booking['is_online_consultation'] ?? 0) === 1;

    if ($isOnlineConsultation) {
        return 'Online Consultation';
    }

    if ($isHomeService) {
        if (preg_match('/\[Services:\s*(.*?)\]/i', (string)($booking['notes'] ?? ''), $matches)) {
            $selectedServices = trim((string)($matches[1] ?? ''));
            if ($selectedServices !== '') {
                return 'Home Service - ' . $selectedServices;
            }
        }

        return 'Home Visit + Consultation';
    }

    $labels = [
        'general_check_up' => 'General Check-up',
        'general_checkup' => 'General Check-up',
        'consultation' => 'Consultation',
        'parasite_control' => 'Parasite Control',
        'vaccination' => 'Vaccination',
        'grooming' => 'Grooming',
        'dental' => 'Dental Check-up',
        'dental_check_up' => 'Dental Check-up',
        'surgery' => 'Surgery',
        'lab_testing' => 'Lab Testing',
        'special_services' => 'Special Services',
    ];
    $serviceKey = visit_billing_catalog_key($serviceType);

    return $labels[$serviceKey] ?? ($serviceType !== '' ? $serviceType : 'Booked Service');
}

function visit_billing_exact_price_from_label(?string $priceLabel): ?float
{
    $label = trim((string)$priceLabel);
    if ($label === '') {
        return null;
    }

    if (preg_match('/\b(free|complimentary|no\s+charge)\b/i', $label)) {
        return 0.0;
    }

    if (preg_match('/\b(starting|starts|from|up\s+to|estimate(?:d)?|depends|tbd|quote|upon|var(?:y|ies|iable)|minimum|maximum|each|per)\b/i', $label)) {
        return null;
    }

    if (preg_match('/\d[\d,]*(?:\.\d+)?\s*(?:-|\x{2013}|\x{2014}|to)\s*\d/iu', $label)) {
        return null;
    }

    $normalized = str_replace(',', '', $label);
    preg_match_all('/(?<![a-z0-9])\d+(?:\.\d{1,2})?(?![a-z0-9])/i', $normalized, $matches);
    if (count($matches[0] ?? []) !== 1) {
        return null;
    }

    $amount = (float)$matches[0][0];
    if (!is_finite($amount) || $amount < 0 || $amount > 99999999.99) {
        return null;
    }

    return round($amount, 2);
}

function visit_billing_booking_special_service(PDO $pdo, int $bookingId): ?array
{
    if (
        !visit_billing_table_exists($pdo, 'special_service_booking_items')
        || !visit_billing_table_exists($pdo, 'special_service_catalog')
    ) {
        return null;
    }

    $basePriceSelect = visit_billing_column_exists($pdo, 'special_service_catalog', 'base_price')
        ? 'sc.base_price'
        : 'NULL';
    $stmt = $pdo->prepare("
        SELECT
            sbi.special_service_id,
            COALESCE(
                NULLIF(TRIM(sbi.custom_service_title), ''),
                NULLIF(TRIM(sc.service_title), '')
            ) AS service_title,
            sc.price_label,
            {$basePriceSelect} AS base_price
        FROM special_service_booking_items sbi
        LEFT JOIN special_service_catalog sc
            ON sc.special_service_id = sbi.special_service_id
        WHERE sbi.booking_id = ?
        ORDER BY sbi.sequence_no ASC, sbi.booking_special_service_id ASC
        LIMIT 1
    ");
    $stmt->execute([$bookingId]);
    $service = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$service) {
        return null;
    }

    $basePrice = $service['base_price'] !== null
        ? max(0.0, (float)$service['base_price'])
        : visit_billing_exact_price_from_label($service['price_label'] ?? null);

    return [
        'special_service_id' => isset($service['special_service_id'])
            ? (int)$service['special_service_id']
            : null,
        'service_title' => trim((string)($service['service_title'] ?? '')),
        'base_price' => $basePrice,
    ];
}

function visit_billing_default_booking_charges(PDO $pdo, ?int $bookingId): array
{
    if ($bookingId === null || $bookingId <= 0) {
        return [];
    }

    $stmt = $pdo->prepare("
        SELECT
            booking_id,
            service_type,
            notes,
            price,
            transport_fee,
            is_home_service,
            is_online_consultation,
            hotel_boarding_type
        FROM bookings
        WHERE booking_id = ?
        LIMIT 1
    ");
    $stmt->execute([$bookingId]);
    $booking = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$booking) {
        return [];
    }

    $serviceKey = visit_billing_catalog_key($booking['service_type'] ?? '');
    if ($serviceKey === 'boarding' || trim((string)($booking['hotel_boarding_type'] ?? '')) !== '') {
        return [];
    }

    $isHomeService = (int)($booking['is_home_service'] ?? 0) === 1 || $serviceKey === 'home_service';
    $isOnlineConsultation = (int)($booking['is_online_consultation'] ?? 0) === 1;
    $isSpecialService = $serviceKey === 'special_services';
    $specialService = $isSpecialService
        ? visit_billing_booking_special_service($pdo, (int)$booking['booking_id'])
        : null;
    $catalogLookupType = $isHomeService
        ? 'home-service'
        : ($isOnlineConsultation ? 'online-consultation' : (string)($booking['service_type'] ?? ''));
    $catalogService = $isSpecialService
        ? null
        : visit_billing_booking_catalog_service($pdo, $catalogLookupType);
    $servicePrice = max(0.0, (float)($booking['price'] ?? 0));
    $transportFee = max(0.0, (float)($booking['transport_fee'] ?? 0));
    $catalogPrice = max(0.0, (float)($catalogService['base_price'] ?? 0));
    $specialServicePrice = $specialService !== null && $specialService['base_price'] !== null
        ? max(0.0, (float)$specialService['base_price'])
        : null;

    if ($isHomeService && $servicePrice <= max(50.0, $transportFee)) {
        $servicePrice = $catalogPrice > 0 ? $catalogPrice : 1400.0;
    } elseif ($isSpecialService && $servicePrice <= 0 && $specialServicePrice !== null) {
        $servicePrice = $specialServicePrice;
    } elseif ($servicePrice <= 0 && $catalogPrice > 0) {
        $servicePrice = $catalogPrice;
    }

    $serviceDescription = trim((string)($specialService['service_title'] ?? ''));
    if ($serviceDescription === '') {
        $serviceDescription = visit_billing_booking_service_label($booking);
    }

    $charges = [[
        'charge_type' => 'service',
        'service_id' => isset($catalogService['service_id']) ? (int)$catalogService['service_id'] : null,
        'description' => $serviceDescription,
        'quantity' => 1,
        'unit_price' => $servicePrice,
        '_booking_charge_kind' => 'service',
    ]];

    if ($isHomeService && $transportFee > 0) {
        $charges[] = [
            'charge_type' => 'other',
            'service_id' => null,
            'description' => 'Home Service Transport Fee',
            'quantity' => 1,
            'unit_price' => $transportFee,
            '_booking_charge_kind' => 'transport',
        ];
    }

    return $charges;
}

function visit_billing_merge_booking_charges(PDO $pdo, ?int $bookingId, array $charges): array
{
    $defaults = visit_billing_default_booking_charges($pdo, $bookingId);
    if (empty($defaults)) {
        return $charges;
    }

    $merged = $charges;
    foreach (array_reverse($defaults) as $defaultCharge) {
        $kind = $defaultCharge['_booking_charge_kind'] ?? 'service';
        $defaultServiceId = visit_billing_nullable_int($defaultCharge['service_id'] ?? null);
        $defaultDescription = visit_billing_catalog_key($defaultCharge['description'] ?? '');
        $alreadyIncluded = false;

        foreach ($charges as $charge) {
            $chargeServiceId = visit_billing_nullable_int($charge['service_id'] ?? $charge['serviceId'] ?? null);
            $chargeDescription = visit_billing_catalog_key($charge['description'] ?? $charge['name'] ?? '');
            if (
                ($kind === 'transport' && strpos($chargeDescription, 'transport') !== false)
                || ($kind === 'service' && $defaultServiceId !== null && $chargeServiceId === $defaultServiceId)
                || ($kind === 'service' && $defaultDescription !== '' && $chargeDescription === $defaultDescription)
            ) {
                $alreadyIncluded = true;
                break;
            }
        }

        if (!$alreadyIncluded) {
            unset($defaultCharge['_booking_charge_kind']);
            array_unshift($merged, $defaultCharge);
        }
    }

    return $merged;
}

function visit_billing_apply_confirmed_home_transport_payment(
    PDO $pdo,
    int $visitId,
    ?int $bookingId
): ?int {
    if ($bookingId === null || $bookingId <= 0) {
        return null;
    }

    $bookingStmt = $pdo->prepare("
        SELECT
            booking_id,
            booking_number,
            service_type,
            status,
            is_home_service,
            transport_fee,
            payment_proof_url,
            payment_method,
            payment_reference,
            created_at
        FROM bookings
        WHERE booking_id = ?
        LIMIT 1
        FOR UPDATE
    ");
    $bookingStmt->execute([$bookingId]);
    $booking = $bookingStmt->fetch(PDO::FETCH_ASSOC);
    if (!$booking) {
        return null;
    }

    $isHomeService = (int)($booking['is_home_service'] ?? 0) === 1
        || visit_billing_catalog_key($booking['service_type'] ?? '') === 'home_service';
    $bookingStatus = strtolower(trim((string)($booking['status'] ?? '')));
    $transportFee = round(max(0.0, (float)($booking['transport_fee'] ?? 0)), 2);
    $proofUrl = visit_billing_nullable_text($booking['payment_proof_url'] ?? null);
    $paymentMethod = strtolower(trim((string)($booking['payment_method'] ?? '')));
    $referenceNumber = visit_billing_nullable_text($booking['payment_reference'] ?? null);

    if (
        !$isHomeService
        || !in_array($bookingStatus, ['confirmed', 'completed'], true)
        || $transportFee <= 0
        || $proofUrl === null
        || !in_array($paymentMethod, ['qrph', 'gcash', 'maya', 'bank_transfer'], true)
    ) {
        return null;
    }

    $marker = 'Home-service transport fee carried from booking '
        . ((string)($booking['booking_number'] ?? '') ?: '#' . $bookingId);
    $existingMarkerStmt = $pdo->prepare("
        SELECT payment_id
        FROM visit_payments
        WHERE visit_id = ?
          AND payment_status = 'verified'
          AND notes = ?
        ORDER BY payment_id ASC
        LIMIT 1
        FOR UPDATE
    ");
    $existingMarkerStmt->execute([$visitId, $marker]);
    $existingMarkerPaymentId = (int)($existingMarkerStmt->fetchColumn() ?: 0);
    if ($existingMarkerPaymentId > 0) {
        return $existingMarkerPaymentId;
    }

    if ($referenceNumber !== null) {
        $referenceStmt = $pdo->prepare("
            SELECT payment_id, visit_id, payment_status, amount
            FROM visit_payments
            WHERE payment_method = ?
              AND reference_number = ?
            ORDER BY payment_id DESC
            LIMIT 1
            FOR UPDATE
        ");
        $referenceStmt->execute([$paymentMethod, $referenceNumber]);
        $existingReference = $referenceStmt->fetch(PDO::FETCH_ASSOC);
        if ($existingReference) {
            if (
                (int)$existingReference['visit_id'] === $visitId
                && ($existingReference['payment_status'] ?? '') === 'verified'
                && (float)$existingReference['amount'] + 0.0001 >= $transportFee
            ) {
                return (int)$existingReference['payment_id'];
            }

            visit_billing_error(
                409,
                'The home-service transport payment reference is already linked to another payment.'
            );
        }
    }

    $totalStmt = $pdo->prepare("SELECT COALESCE(SUM(subtotal), 0) FROM visit_charges WHERE visit_id = ?");
    $totalStmt->execute([$visitId]);
    $invoiceTotal = round((float)$totalStmt->fetchColumn(), 2);

    $paidStmt = $pdo->prepare("
        SELECT COALESCE(SUM(amount), 0)
        FROM visit_payments
        WHERE visit_id = ?
          AND payment_status = 'verified'
    ");
    $paidStmt->execute([$visitId]);
    $verifiedPaid = round((float)$paidStmt->fetchColumn(), 2);
    $remainingBalance = round($invoiceTotal - $verifiedPaid, 2);
    if ($invoiceTotal > 0 && $remainingBalance <= 0.0001) {
        return null;
    }
    if ($invoiceTotal <= 0 || $remainingBalance + 0.0001 < $transportFee) {
        visit_billing_error(
            409,
            'The verified home-service transport payment cannot be carried because the invoice is missing its matching transport charge.'
        );
    }

    $authenticatedActor = visit_billing_require_actor($pdo);
    $insertStmt = $pdo->prepare("
        INSERT INTO visit_payments (
            visit_id,
            payment_method,
            payment_status,
            amount,
            reference_number,
            proof_url,
            notes,
            paid_at,
            received_by_user_id,
            received_by_name
        ) VALUES (?, ?, 'verified', ?, ?, ?, ?, ?, ?, ?)
    ");
    try {
        $insertStmt->execute([
            $visitId,
            $paymentMethod,
            $transportFee,
            $referenceNumber,
            $proofUrl,
            $marker,
            visit_billing_nullable_text($booking['created_at'] ?? null) ?: date('Y-m-d H:i:s'),
            (int)$authenticatedActor['user_id'],
            $authenticatedActor['full_name'],
        ]);
    } catch (PDOException $error) {
        if (!visit_billing_is_duplicate_key($error) || $referenceNumber === null) {
            throw $error;
        }

        $duplicateStmt = $pdo->prepare("
            SELECT payment_id, visit_id, payment_status, amount
            FROM visit_payments
            WHERE payment_method = ?
              AND reference_number = ?
            ORDER BY payment_id DESC
            LIMIT 1
        ");
        $duplicateStmt->execute([$paymentMethod, $referenceNumber]);
        $duplicate = $duplicateStmt->fetch(PDO::FETCH_ASSOC);
        if (
            $duplicate
            && (int)$duplicate['visit_id'] === $visitId
            && ($duplicate['payment_status'] ?? '') === 'verified'
            && (float)$duplicate['amount'] + 0.0001 >= $transportFee
        ) {
            return (int)$duplicate['payment_id'];
        }

        visit_billing_error(
            409,
            'The home-service transport payment reference is already linked to another payment.'
        );
    }

    $paymentId = (int)$pdo->lastInsertId();
    visit_billing_update_status($pdo, $visitId);

    return $paymentId;
}

function visit_billing_save_visit_payload(PDO $pdo, array $input): array
{
    visit_billing_require_schema($pdo);

    $petId = visit_billing_requested_id($input, 'pet_id', 'petId');
    $queueId = visit_billing_requested_id($input, 'queue_id', 'queueId');
    $bookingId = visit_billing_requested_id($input, 'booking_id', 'bookingId');
    $diagnosisId = visit_billing_requested_id($input, 'diagnosis_id', 'diagnosisId');
    $sourceType = visit_billing_allowed(
        trim((string)($input['source_type'] ?? $input['sourceType'] ?? ($queueId ? 'queue' : ($bookingId ? 'booking' : 'manual')))),
        ['queue', 'booking', 'walk_in', 'boarding', 'manual'],
        'manual'
    );

    if ($petId === null || $petId <= 0) {
        visit_billing_error(400, 'pet_id is required.');
    }

    $requestedOwnerUserId = visit_billing_requested_id($input, 'owner_user_id', 'ownerUserId');
    $requestedVeterinarianUserId = visit_billing_requested_id(
        $input,
        'veterinarian_user_id',
        'veterinarianUserId'
    );
    $resolvedContext = visit_billing_resolve_visit_context(
        $pdo,
        $petId,
        $queueId,
        $bookingId,
        $diagnosisId,
        $requestedOwnerUserId,
        $requestedVeterinarianUserId
    );
    $ownerUserId = (int)$resolvedContext['owner_user_id'];
    $branchId = visit_billing_resolve_branch_id($pdo, $input, $queueId, $bookingId);
    $veterinarianUserId = visit_billing_nullable_int($resolvedContext['veterinarian_user_id'] ?? null);
    if ($queueId !== null) {
        $sourceType = 'queue';
    } elseif ($bookingId !== null && $sourceType !== 'boarding') {
        $sourceType = 'booking';
    }
    $visitStatus = visit_billing_allowed(
        trim((string)($input['visit_status'] ?? $input['visitStatus'] ?? 'treatment_done')),
        ['waiting', 'in_consultation', 'treatment_done', 'completed', 'cancelled'],
        'treatment_done'
    );

    $charges = $input['charges'] ?? [];
    if (!is_array($charges)) {
        visit_billing_error(400, 'charges must be an array.');
    }
    $charges = visit_billing_merge_booking_charges($pdo, $bookingId, $charges);

    $visitLookupInput = array_merge($input, [
        'pet_id' => $petId,
        'queue_id' => $queueId,
        'booking_id' => $bookingId,
        'diagnosis_id' => $diagnosisId,
    ]);
    $visitId = visit_billing_fetch_visit_id($pdo, $visitLookupInput);
    $existingBillingStatus = null;
    $existingVisitStatus = null;

    if ($visitId !== null) {
        $existingVisit = visit_billing_assert_visit_identity(
            $pdo,
            $visitId,
            $visitLookupInput,
            true,
            true
        );
        $existingBillingStatus = $existingVisit['billing_status'] ?? null;
        $existingVisitStatus = $existingVisit['visit_status'] ?? null;
        if ((int)$existingVisit['owner_user_id'] !== $ownerUserId) {
            visit_billing_error(409, 'Existing visit owner does not match the resolved source owner.');
        }
        $existingVeterinarianUserId = visit_billing_nullable_int(
            $existingVisit['veterinarian_user_id'] ?? null
        );
        if (
            $existingVeterinarianUserId !== null
            && $veterinarianUserId !== null
            && $existingVeterinarianUserId !== $veterinarianUserId
        ) {
            visit_billing_error(409, 'Existing visit veterinarian cannot be reassigned.');
        }
        $isExistingChargeLocked = in_array(
            $existingBillingStatus,
            ['partial', 'paid', 'refunded'],
            true
        );
        $preserveVisitStatus = in_array($existingBillingStatus, ['paid', 'refunded'], true);

        $stmt = $pdo->prepare("
            UPDATE visits
            SET veterinarian_user_id = COALESCE(veterinarian_user_id, ?),
                queue_id = COALESCE(?, queue_id),
                booking_id = COALESCE(?, booking_id),
                diagnosis_id = COALESCE(?, diagnosis_id),
                visit_status = ?
            WHERE visit_id = ?
        ");
        $stmt->execute([
            $veterinarianUserId,
            $queueId,
            $bookingId,
            $diagnosisId,
            $preserveVisitStatus ? ($existingVisitStatus ?: $visitStatus) : $visitStatus,
            $visitId
        ]);
    } else {
        $isExistingChargeLocked = false;
        $stmt = $pdo->prepare("
            INSERT INTO visits (
                branch_id,
                pet_id,
                owner_user_id,
                veterinarian_user_id,
                queue_id,
                booking_id,
                diagnosis_id,
                source_type,
                visit_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $branchId,
            $petId,
            $ownerUserId,
            $veterinarianUserId,
            $queueId,
            $bookingId,
            $diagnosisId,
            $sourceType,
            $visitStatus
        ]);
        $visitId = (int)$pdo->lastInsertId();
    }

    if (!empty($charges) && !$isExistingChargeLocked) {
        visit_billing_save_charges($pdo, $visitId, $charges, true);
    } elseif (!$isExistingChargeLocked) {
        visit_billing_update_status($pdo, $visitId);
    }

    $bookingTransportPaymentId = visit_billing_apply_confirmed_home_transport_payment(
        $pdo,
        $visitId,
        $bookingId
    );

    return [
        'visitId' => $visitId,
        'hasCharges' => !empty($charges),
        'bookingTransportPaymentId' => $bookingTransportPaymentId,
        'bookingTransportPaymentApplied' => $bookingTransportPaymentId !== null,
        'visit' => visit_billing_fetch_visit($pdo, $visitId),
    ];
}

function visit_billing_ensure_online_consultation_visit(
    PDO $pdo,
    int $onlineConsultationId,
    ?int $actorUserId = null
): array {
    visit_billing_require_schema($pdo);

    $bookingStmt = $pdo->prepare("
        SELECT
            oc.online_consultation_id,
            oc.owner_user_id,
            oc.veterinarian_user_id,
            b.booking_id,
            b.booking_number,
            b.pet_id,
            b.price AS booking_price
        FROM online_consultations oc
        JOIN bookings b ON b.booking_id = oc.booking_id
        WHERE oc.online_consultation_id = ?
        LIMIT 1
        FOR UPDATE
    ");
    $bookingStmt->execute([$onlineConsultationId]);
    $booking = $bookingStmt->fetch(PDO::FETCH_ASSOC);
    if (!$booking) {
        visit_billing_error(404, 'Online consultation booking was not found for visit billing.');
    }

    $petId = visit_billing_nullable_int($booking['pet_id'] ?? null);
    if ($petId === null || $petId <= 0) {
        error_log(
            'Online consultation visit billing skipped for consultation '
            . $onlineConsultationId
            . ' because the booking has no registered pet_id.'
        );

        return [
            'visitId' => null,
            'hasCharges' => false,
            'chargeCreated' => false,
            'skipped' => true,
            'visit' => null,
        ];
    }

    $serviceStmt = $pdo->query("
        SELECT service_id, service_name, base_price
        FROM service_catalog
        WHERE is_active = 1
          AND (service_code = 'CONSULT-GENERAL' OR service_type = 'consultation')
        ORDER BY
            CASE WHEN service_code = 'CONSULT-GENERAL' THEN 0 ELSE 1 END,
            service_id ASC
        LIMIT 1
    ");
    $service = $serviceStmt->fetch(PDO::FETCH_ASSOC) ?: [];
    $serviceId = visit_billing_nullable_int($service['service_id'] ?? null);
    $serviceName = visit_billing_nullable_text($service['service_name'] ?? null) ?: 'Online Consultation';
    $bookingPrice = $booking['booking_price'] !== null ? (float)$booking['booking_price'] : null;
    $unitPrice = round($bookingPrice ?? (float)($service['base_price'] ?? 0), 2);
    if ($unitPrice < 0) {
        visit_billing_error(409, 'Online consultation price cannot be negative.');
    }

    $visitBilling = visit_billing_save_visit_payload($pdo, [
        'pet_id' => $petId,
        'owner_user_id' => (int)$booking['owner_user_id'],
        'veterinarian_user_id' => visit_billing_nullable_int($booking['veterinarian_user_id'] ?? null),
        'booking_id' => (int)$booking['booking_id'],
        'source_type' => 'booking',
        'visit_status' => 'completed',
        'charges' => [],
    ]);
    $visitId = (int)($visitBilling['visitId'] ?? 0);
    if ($visitId <= 0) {
        visit_billing_error(500, 'Online consultation visit could not be created.');
    }

    $visitState = visit_billing_lock_visit($pdo, $visitId);
    $pdo->prepare("
        UPDATE visits
        SET visit_status = 'completed'
        WHERE visit_id = ?
          AND visit_status <> 'cancelled'
    ")->execute([$visitId]);

    $description = $serviceName . ' (Online Consultation)';
    $chargeSql = "
        SELECT charge_id
        FROM visit_charges
        WHERE visit_id = ?
          AND charge_type = 'service'
          AND ";
    $chargeParams = [$visitId];
    if ($serviceId !== null && $serviceId > 0) {
        $chargeSql .= "(service_id = ? OR description LIKE ? OR description LIKE ?)";
        $chargeParams[] = $serviceId;
        $chargeParams[] = '% (Online Consultation)';
        $chargeParams[] = 'Historical online consultation - %';
    } else {
        $chargeSql .= "(description LIKE ? OR description LIKE ?)";
        $chargeParams[] = '% (Online Consultation)';
        $chargeParams[] = 'Historical online consultation - %';
    }
    $chargeSql .= " ORDER BY charge_id ASC LIMIT 1 FOR UPDATE";

    $existingChargeStmt = $pdo->prepare($chargeSql);
    $existingChargeStmt->execute($chargeParams);
    $existingChargeId = (int)($existingChargeStmt->fetchColumn() ?: 0);

    if (
        $existingChargeId > 0
        || in_array(($visitState['billing_status'] ?? ''), ['partial', 'paid', 'refunded'], true)
    ) {
        return [
            'visitId' => $visitId,
            'hasCharges' => $existingChargeId > 0,
            'chargeCreated' => false,
            'skipped' => false,
            'visit' => visit_billing_fetch_visit($pdo, $visitId),
        ];
    }

    visit_billing_assert_charges_mutable($pdo, $visitId);
    $authenticatedActor = visit_billing_require_actor($pdo);
    $createdByUserId = $authenticatedActor['user_id'] ?? $actorUserId;
    $insertCharge = $pdo->prepare("
        INSERT INTO visit_charges (
            visit_id,
            charge_type,
            service_id,
            item_id,
            description,
            quantity,
            unit_price,
            subtotal,
            created_by_user_id
        ) VALUES (?, 'service', ?, NULL, ?, 1, ?, ?, ?)
    ");
    $insertCharge->execute([
        $visitId,
        $serviceId,
        $description,
        $unitPrice,
        $unitPrice,
        $createdByUserId,
    ]);
    visit_billing_update_status($pdo, $visitId);

    return [
        'visitId' => $visitId,
        'hasCharges' => true,
        'chargeCreated' => true,
        'skipped' => false,
        'visit' => visit_billing_fetch_visit($pdo, $visitId),
    ];
}

function visit_billing_upsert_visit(PDO $pdo): void
{
    visit_billing_require_schema($pdo);

    $input = visit_billing_input();
    $routeVisitId = visit_billing_requested_id($_GET, 'visit_id', 'visitId');
    $bodyVisitId = visit_billing_requested_id($input, 'visit_id', 'visitId');
    if ($routeVisitId !== null) {
        if ($bodyVisitId !== null && $bodyVisitId !== $routeVisitId) {
            visit_billing_error(409, 'Route visitId does not match the request body visitId.');
        }
        $input['visit_id'] = $routeVisitId;
        $bodyVisitId = $routeVisitId;
    }

    $petId = visit_billing_requested_id($input, 'pet_id', 'petId');
    $queueId = visit_billing_requested_id($input, 'queue_id', 'queueId');
    $bookingId = visit_billing_requested_id($input, 'booking_id', 'bookingId');
    $sourceType = visit_billing_allowed(
        trim((string)($input['source_type'] ?? $input['sourceType'] ?? ($queueId ? 'queue' : ($bookingId ? 'booking' : 'manual')))),
        ['queue', 'booking', 'walk_in', 'boarding', 'manual'],
        'manual'
    );
    $walkInPatient = null;

    if (
        ($petId === null || $petId <= 0)
        && $sourceType === 'walk_in'
        && ($bodyVisitId === null || $bodyVisitId <= 0)
    ) {
        $walkInPatient = visit_billing_ensure_walk_in_patient($pdo);
        $petId = $walkInPatient['pet_id'];
    }

    if ($petId === null || $petId <= 0) {
        visit_billing_error(400, 'pet_id is required.');
    }

    $ownerInput = visit_billing_requested_id($input, 'owner_user_id', 'ownerUserId');
    if (($ownerInput === null || $ownerInput <= 0) && $walkInPatient !== null) {
        $ownerInput = $walkInPatient['owner_user_id'];
    }

    $veterinarianInput = visit_billing_requested_id(
        $input,
        'veterinarian_user_id',
        'veterinarianUserId'
    );
    $diagnosisId = visit_billing_requested_id($input, 'diagnosis_id', 'diagnosisId');
    $resolvedContext = visit_billing_resolve_visit_context(
        $pdo,
        $petId,
        $queueId,
        $bookingId,
        $diagnosisId,
        $ownerInput,
        $veterinarianInput
    );
    $ownerUserId = (int)$resolvedContext['owner_user_id'];
    $branchId = visit_billing_resolve_branch_id($pdo, $input, $queueId, $bookingId);
    $veterinarianUserId = visit_billing_nullable_int($resolvedContext['veterinarian_user_id'] ?? null);
    if ($queueId !== null) {
        $sourceType = 'queue';
    } elseif ($bookingId !== null && $sourceType !== 'boarding') {
        $sourceType = 'booking';
    }
    $visitStatus = visit_billing_allowed(
        trim((string)($input['visit_status'] ?? $input['visitStatus'] ?? 'treatment_done')),
        ['waiting', 'in_consultation', 'treatment_done', 'completed', 'cancelled'],
        'treatment_done'
    );

    $charges = $input['charges'] ?? [];
    if (!is_array($charges)) {
        visit_billing_error(400, 'charges must be an array.');
    }
    $charges = visit_billing_merge_booking_charges($pdo, $bookingId, $charges);

    $pdo->beginTransaction();
    try {
        $visitLookupInput = array_merge($input, [
            'pet_id' => $petId,
            'queue_id' => $queueId,
            'booking_id' => $bookingId,
            'diagnosis_id' => $diagnosisId,
        ]);
        $visitId = visit_billing_fetch_visit_id($pdo, $visitLookupInput);
        $existingBillingStatus = null;
        $existingChargeLocked = false;

        if ($visitId !== null) {
            $existingVisit = visit_billing_assert_visit_identity(
                $pdo,
                $visitId,
                $visitLookupInput,
                true,
                true
            );
            $existingBillingStatus = $existingVisit['billing_status'] ?? null;
            if ((int)$existingVisit['owner_user_id'] !== $ownerUserId) {
                visit_billing_error(409, 'Existing visit owner does not match the resolved source owner.');
            }
            $existingVeterinarianUserId = visit_billing_nullable_int(
                $existingVisit['veterinarian_user_id'] ?? null
            );
            if (
                $existingVeterinarianUserId !== null
                && $veterinarianUserId !== null
                && $existingVeterinarianUserId !== $veterinarianUserId
            ) {
                visit_billing_error(409, 'Existing visit veterinarian cannot be reassigned.');
            }
            $existingChargeLocked = in_array(
                $existingBillingStatus,
                ['partial', 'paid', 'refunded'],
                true
            );
            $preserveVisitStatus = in_array(
                $existingBillingStatus,
                ['paid', 'refunded'],
                true
            );

            $stmt = $pdo->prepare("
                UPDATE visits
                SET veterinarian_user_id = COALESCE(veterinarian_user_id, ?),
                    queue_id = COALESCE(?, queue_id),
                    booking_id = COALESCE(?, booking_id),
                    diagnosis_id = COALESCE(?, diagnosis_id),
                    visit_status = ?
                WHERE visit_id = ?
            ");
            $stmt->execute([
                $veterinarianUserId,
                $queueId,
                $bookingId,
                $diagnosisId,
                $preserveVisitStatus
                    ? ((string)($existingVisit['visit_status'] ?? '') ?: $visitStatus)
                    : $visitStatus,
                $visitId
            ]);
        } else {
            $stmt = $pdo->prepare("
                INSERT INTO visits (
                    branch_id,
                    pet_id,
                    owner_user_id,
                    veterinarian_user_id,
                    queue_id,
                    booking_id,
                    diagnosis_id,
                    source_type,
                    visit_status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $branchId,
                $petId,
                $ownerUserId,
                $veterinarianUserId,
                $queueId,
                $bookingId,
                $diagnosisId,
                $sourceType,
                $visitStatus
            ]);
            $visitId = (int)$pdo->lastInsertId();
        }

        $paymentInput = $input['payment'] ?? $input['paymentPayload'] ?? null;
        if (!empty($charges) && !$existingChargeLocked) {
            visit_billing_save_charges($pdo, $visitId, $charges, true);
        } elseif (!$existingChargeLocked) {
            visit_billing_update_status($pdo, $visitId);
        }

        $paymentId = null;
        if (is_array($paymentInput)) {
            $paymentId = visit_billing_insert_payment_payload($pdo, $visitId, $paymentInput);
        }

        $pdo->commit();

        try {
            if (!empty($charges)) {
                notification_send_visit_event($pdo, $visitId, 'invoice_ready');
            }
        } catch (Throwable $notificationError) {
            error_log('Visit invoice notification failed: ' . $notificationError->getMessage());
        }

        try {
            if ($paymentId !== null) {
                notification_send_visit_event($pdo, $visitId, 'payment_received', [
                    'payment_id' => $paymentId,
                    'amount' => (float)($paymentInput['amount'] ?? 0),
                    'reference_number' => visit_billing_nullable_text($paymentInput['reference_number'] ?? $paymentInput['referenceNumber'] ?? null),
                ]);
            }
        } catch (Throwable $notificationError) {
            error_log('Visit payment notification failed: ' . $notificationError->getMessage());
        }

        echo json_encode([
            'success' => true,
            'message' => 'Visit billing saved.',
            'visit' => visit_billing_fetch_visit($pdo, $visitId)
        ]);
    } catch (Exception $e) {
        visit_billing_error(500, 'Failed to save visit billing: ' . $e->getMessage());
    }
}

function visit_billing_fetch_visit(PDO $pdo, int $visitId): ?array
{
    $hasDiagnosisTable = visit_billing_table_exists($pdo, 'vet_diagnoses');
    $diagnosisSelect = $hasDiagnosisTable
        ? ",
            vd.prescriptions AS diagnosis_prescriptions,
            vd.notes AS diagnosis_notes,
            vd.diagnosis AS diagnosis_summary"
        : ",
            NULL AS diagnosis_prescriptions,
            NULL AS diagnosis_notes,
            NULL AS diagnosis_summary";
    $diagnosisJoin = $hasDiagnosisTable
        ? "LEFT JOIN vet_diagnoses vd ON vd.diagnosis_id = v.diagnosis_id"
        : "";

    $stmt = $pdo->prepare("
        SELECT
            v.*,
            p.pet_name,
            p.pet_species,
            CONCAT(owner.first_Name, ' ', owner.last_Name) AS owner_name,
            CONCAT(vet.first_Name, ' ', vet.last_Name) AS veterinarian_name,
            branch.branch_name,
            q.queue_number,
            q.timestamp AS queue_timestamp,
            b.booking_number
            {$diagnosisSelect}
        FROM visits v
        JOIN pets_information p ON p.pet_id = v.pet_id
        JOIN users owner ON owner.user_id = v.owner_user_id
        LEFT JOIN users vet ON vet.user_id = v.veterinarian_user_id
        LEFT JOIN branches branch ON branch.branch_id = v.branch_id
        LEFT JOIN queues q ON q.queue_id = v.queue_id
        LEFT JOIN bookings b ON b.booking_id = v.booking_id
        {$diagnosisJoin}
        WHERE v.visit_id = ?
        LIMIT 1
    ");
    $stmt->execute([$visitId]);
    $visit = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$visit) {
        return null;
    }

    $chargesStmt = $pdo->prepare("
        SELECT
            vc.*,
            sc.service_name,
            ii.item_name
        FROM visit_charges vc
        LEFT JOIN service_catalog sc ON sc.service_id = vc.service_id
        LEFT JOIN inventory_items ii ON ii.item_id = vc.item_id
        WHERE vc.visit_id = ?
        ORDER BY vc.charge_id ASC
    ");
    $chargesStmt->execute([$visitId]);
    $charges = array_map(function ($charge) {
        return [
            'chargeId' => (int)$charge['charge_id'],
            'visitId' => (int)$charge['visit_id'],
            'chargeType' => $charge['charge_type'],
            'serviceId' => $charge['service_id'] !== null ? (int)$charge['service_id'] : null,
            'serviceName' => $charge['service_name'] ?? '',
            'itemId' => $charge['item_id'] !== null ? (int)$charge['item_id'] : null,
            'itemName' => $charge['item_name'] ?? '',
            'boardingMaterialUsageId' => isset($charge['boarding_material_usage_id'])
                && $charge['boarding_material_usage_id'] !== null
                ? (int)$charge['boarding_material_usage_id']
                : null,
            'description' => $charge['description'],
            'quantity' => (float)$charge['quantity'],
            'unitPrice' => (float)$charge['unit_price'],
            'subtotal' => (float)$charge['subtotal'],
            'createdAt' => $charge['created_at'],
        ];
    }, $chargesStmt->fetchAll(PDO::FETCH_ASSOC));

    $paymentsStmt = $pdo->prepare("
        SELECT *
        FROM visit_payments
        WHERE visit_id = ?
        ORDER BY paid_at DESC, payment_id DESC
    ");
    $paymentsStmt->execute([$visitId]);
    $payments = array_map(function ($payment) {
        return [
            'paymentId' => (int)$payment['payment_id'],
            'visitId' => (int)$payment['visit_id'],
            'paymentMethod' => $payment['payment_method'],
            'paymentStatus' => $payment['payment_status'],
            'amount' => (float)$payment['amount'],
            'referenceNumber' => $payment['reference_number'],
            'proofUrl' => $payment['proof_url'],
            'notes' => $payment['notes'],
            'paidAt' => $payment['paid_at'],
            'receivedByUserId' => $payment['received_by_user_id'] !== null ? (int)$payment['received_by_user_id'] : null,
            'receivedByName' => $payment['received_by_name'],
        ];
    }, $paymentsStmt->fetchAll(PDO::FETCH_ASSOC));

    $total = array_reduce($charges, fn($sum, $charge) => $sum + (float)$charge['subtotal'], 0.0);
    $paid = array_reduce($payments, function ($sum, $payment) {
        return $payment['paymentStatus'] === 'verified' ? $sum + (float)$payment['amount'] : $sum;
    }, 0.0);

    return [
        'visitId' => (int)$visit['visit_id'],
        'branchId' => (int)$visit['branch_id'],
        'branchName' => (string)($visit['branch_name'] ?? ''),
        'petId' => (int)$visit['pet_id'],
        'petName' => $visit['pet_name'],
        'petSpecies' => $visit['pet_species'],
        'ownerUserId' => (int)$visit['owner_user_id'],
        'ownerName' => trim((string)$visit['owner_name']),
        'veterinarianUserId' => $visit['veterinarian_user_id'] !== null ? (int)$visit['veterinarian_user_id'] : null,
        'veterinarianName' => trim((string)($visit['veterinarian_name'] ?? '')),
        'queueId' => $visit['queue_id'] !== null ? (int)$visit['queue_id'] : null,
        'queueNumber' => $visit['queue_number'] !== null ? (int)$visit['queue_number'] : null,
        'queueReference' => $visit['queue_number'] !== null ? ipawcus_format_queue_reference($visit['queue_number'], $visit['queue_timestamp'] ?? null) : '',
        'bookingId' => $visit['booking_id'] !== null ? (int)$visit['booking_id'] : null,
        'bookingNumber' => $visit['booking_number'],
        'diagnosisId' => $visit['diagnosis_id'] !== null ? (int)$visit['diagnosis_id'] : null,
        'diagnosisSummary' => $visit['diagnosis_summary'] ?? '',
        'diagnosisNotes' => $visit['diagnosis_notes'] ?? '',
        'prescriptions' => visit_billing_decode_json($visit['diagnosis_prescriptions'] ?? null) ?: [],
        'sourceType' => $visit['source_type'],
        'visitStatus' => $visit['visit_status'],
        'billingStatus' => $visit['billing_status'],
        'createdAt' => $visit['created_at'],
        'updatedAt' => $visit['updated_at'],
        'charges' => $charges,
        'payments' => $payments,
        'totals' => [
            'charges' => round($total, 2),
            'paid' => round($paid, 2),
            'balance' => round(max(0, $total - $paid), 2),
        ],
    ];
}

function visit_billing_list(PDO $pdo): void
{
    if (!visit_billing_schema_ready($pdo)) {
        echo json_encode([
            'success' => true,
            'schemaReady' => false,
            'message' => visit_billing_missing_message(),
            'visits' => []
        ]);
        return;
    }

    $visitId = visit_billing_requested_id($_GET, 'visit_id', 'visitId');
    if ($visitId !== null) {
        visit_billing_assert_visit_identity($pdo, $visitId, $_GET);
        echo json_encode([
            'success' => true,
            'schemaReady' => true,
            'visits' => array_filter([visit_billing_fetch_visit($pdo, $visitId)])
        ]);
        return;
    }

    $conditions = [];
    $params = [];
    $requestedBranchId = visit_billing_requested_id($_GET, 'branch_id', 'branchId');
    $currentUser = visit_billing_api_user();
    $currentRole = branch_normalize_role($currentUser
        ? ($currentUser['role'] ?? $currentUser['normalized_role'] ?? '')
        : '');
    if ($requestedBranchId !== null) {
        if (!branch_fetch($pdo, $requestedBranchId)) {
            visit_billing_error(422, 'Select an active clinic location.');
        }
        visit_billing_assert_branch_access($pdo, $requestedBranchId);
        $conditions[] = 'v.branch_id = ?';
        $params[] = $requestedBranchId;
    } elseif ($currentRole === 'admin') {
        $allowedBranchIds = branch_user_ids($pdo, (int)($currentUser['user_id'] ?? 0));
        if (!$allowedBranchIds) {
            $conditions[] = '1 = 0';
        } else {
            $conditions[] = 'v.branch_id IN (' . implode(', ', array_fill(0, count($allowedBranchIds), '?')) . ')';
            array_push($params, ...$allowedBranchIds);
        }
    }
    foreach ([
        ['petId', 'pet_id', 'v.pet_id'],
        ['queueId', 'queue_id', 'v.queue_id'],
        ['bookingId', 'booking_id', 'v.booking_id'],
        ['diagnosisId', 'diagnosis_id', 'v.diagnosis_id'],
    ] as [$camel, $snake, $column]) {
        $value = visit_billing_nullable_int($_GET[$camel] ?? $_GET[$snake] ?? null);
        if ($value !== null) {
            $conditions[] = "{$column} = ?";
            $params[] = $value;
        }
    }

    $whereSql = $conditions ? 'WHERE ' . implode(' AND ', $conditions) : '';
    $stmt = $pdo->prepare("
        SELECT v.visit_id
        FROM visits v
        {$whereSql}
        ORDER BY v.created_at DESC, v.visit_id DESC
        LIMIT 100
    ");
    $stmt->execute($params);
    $visits = [];
    foreach ($stmt->fetchAll(PDO::FETCH_COLUMN) as $id) {
        $visit = visit_billing_fetch_visit($pdo, (int)$id);
        if ($visit) {
            $visits[] = $visit;
        }
    }

    echo json_encode([
        'success' => true,
        'schemaReady' => true,
        'visits' => $visits
    ]);
}

function visit_billing_replace_charges(PDO $pdo, int $visitId): void
{
    visit_billing_require_schema($pdo);
    if ($visitId <= 0) {
        visit_billing_error(400, 'Visit ID is required.');
    }

    $input = visit_billing_input();
    $charges = $input['charges'] ?? [];
    if (!is_array($charges)) {
        visit_billing_error(400, 'charges must be an array.');
    }

    $pdo->beginTransaction();
    try {
        visit_billing_assert_visit_identity($pdo, $visitId, $input, false, true);
        visit_billing_save_charges($pdo, $visitId, $charges, true);
        $pdo->commit();

        echo json_encode([
            'success' => true,
            'message' => 'Visit charges saved.',
            'visit' => visit_billing_fetch_visit($pdo, $visitId)
        ]);
    } catch (Exception $e) {
        visit_billing_error(500, 'Failed to save visit charges: ' . $e->getMessage());
    }
}

function visit_billing_insert_payment_payload(PDO $pdo, int $visitId, array $input): int
{
    $visitState = visit_billing_lock_visit($pdo, $visitId);
    if (($visitState['billing_status'] ?? '') === 'refunded') {
        visit_billing_error(409, 'Refunded visits cannot receive another payment. Create a new invoice instead.');
    }

    $amount = round((float)($input['amount'] ?? 0), 2);
    if ($amount <= 0) {
        visit_billing_error(400, 'Payment amount must be greater than 0.');
    }

    $paymentMethod = visit_billing_require_allowed(
        trim((string)($input['payment_method'] ?? $input['paymentMethod'] ?? 'gcash')),
        ['cash', 'qrph', 'gcash', 'maya', 'bank_transfer'],
        'payment method'
    );
    if ($paymentMethod === 'cash') {
        visit_billing_ensure_payment_method_schema($pdo);
    }
    $paymentStatus = 'verified';
    $referenceNumber = visit_billing_nullable_text($input['reference_number'] ?? $input['referenceNumber'] ?? null);
    $proofUrl = visit_billing_nullable_text($input['proof_url'] ?? $input['proofUrl'] ?? null);

    visit_billing_assert_boarding_invoice_complete($pdo, $visitId);

    if ($referenceNumber !== null) {
        $duplicateStmt = $pdo->prepare("
            SELECT payment_id, visit_id, payment_method, payment_status, amount
            FROM visit_payments
            WHERE payment_method = ?
              AND reference_number = ?
            ORDER BY payment_id DESC
            LIMIT 1
            FOR UPDATE
        ");
        $duplicateStmt->execute([$paymentMethod, $referenceNumber]);
        $existingPayment = $duplicateStmt->fetch(PDO::FETCH_ASSOC);
        if ($existingPayment) {
            if (
                (int)$existingPayment['visit_id'] === $visitId
                && abs((float)$existingPayment['amount'] - $amount) < 0.0001
                && ($existingPayment['payment_status'] ?? '') === 'verified'
            ) {
                return (int)$existingPayment['payment_id'];
            }

            visit_billing_error(409, 'This payment reference has already been used for another payment.');
        }
    }

    $totalStmt = $pdo->prepare("SELECT COALESCE(SUM(subtotal), 0) FROM visit_charges WHERE visit_id = ?");
    $totalStmt->execute([$visitId]);
    $total = (float)$totalStmt->fetchColumn();

    $paidStmt = $pdo->prepare("
        SELECT COALESCE(SUM(amount), 0)
        FROM visit_payments
        WHERE visit_id = ?
          AND payment_status = 'verified'
    ");
    $paidStmt->execute([$visitId]);
    $verifiedPaid = (float)$paidStmt->fetchColumn();

    if ($total <= 0) {
        visit_billing_error(409, 'This invoice has no billable balance. Add visit charges before recording payment.');
    }

    $remainingBalance = round($total - $verifiedPaid, 2);
    if ($paymentStatus === 'verified' && $remainingBalance <= 0.0001) {
        visit_billing_error(409, 'This invoice is already fully paid. The duplicate payment was not recorded.');
    }

    if ($paymentStatus === 'verified' && $amount - $remainingBalance > 0.0001) {
        visit_billing_error(
            409,
            'Payment exceeds the remaining invoice balance of PHP ' . number_format(max(0, $remainingBalance), 2, '.', ',') . '.'
        );
    }

    $authenticatedActor = visit_billing_require_actor($pdo);
    $stmt = $pdo->prepare("
        INSERT INTO visit_payments (
            visit_id,
            payment_method,
            payment_status,
            amount,
            reference_number,
            proof_url,
            notes,
            paid_at,
            received_by_user_id,
            received_by_name
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");
    try {
        $stmt->execute([
            $visitId,
            $paymentMethod,
            $paymentStatus,
            $amount,
            $referenceNumber,
            $proofUrl,
            visit_billing_nullable_text($input['notes'] ?? null),
            visit_billing_nullable_text($input['paid_at'] ?? $input['paidAt'] ?? null) ?: date('Y-m-d H:i:s'),
            (int)$authenticatedActor['user_id'],
            $authenticatedActor['full_name']
        ]);
    } catch (PDOException $error) {
        if (!visit_billing_is_duplicate_key($error) || $referenceNumber === null) {
            throw $error;
        }

        $existingStmt = $pdo->prepare("
            SELECT payment_id, visit_id, payment_status, amount
            FROM visit_payments
            WHERE payment_method = ?
              AND reference_number = ?
            ORDER BY payment_id DESC
            LIMIT 1
        ");
        $existingStmt->execute([$paymentMethod, $referenceNumber]);
        $existingPayment = $existingStmt->fetch(PDO::FETCH_ASSOC);
        if (
            $existingPayment
            && (int)$existingPayment['visit_id'] === $visitId
            && abs((float)$existingPayment['amount'] - $amount) < 0.0001
            && ($existingPayment['payment_status'] ?? '') === 'verified'
        ) {
            return (int)$existingPayment['payment_id'];
        }

        visit_billing_error(409, 'This payment reference has already been used for another payment.');
    }
    $paymentId = (int)$pdo->lastInsertId();

    visit_billing_update_status($pdo, $visitId);

    return $paymentId;
}

function visit_billing_add_payment(PDO $pdo, int $visitId): void
{
    visit_billing_require_schema($pdo);
    if ($visitId <= 0) {
        visit_billing_error(400, 'Visit ID is required.');
    }

    $input = visit_billing_input();

    $pdo->beginTransaction();
    try {
        $visitState = visit_billing_assert_visit_identity($pdo, $visitId, $input, false, true);
        if (($visitState['billing_status'] ?? '') === 'refunded') {
            visit_billing_error(409, 'Refunded visits cannot receive another payment. Create a new invoice instead.');
        }

        if (array_key_exists('charges', $input)) {
            $charges = $input['charges'];
            if (!is_array($charges)) {
                visit_billing_error(400, 'charges must be an array.');
            }

            $verifiedStmt = $pdo->prepare("
                SELECT COALESCE(SUM(amount), 0)
                FROM visit_payments
                WHERE visit_id = ?
                  AND payment_status = 'verified'
            ");
            $verifiedStmt->execute([$visitId]);
            $hasVerifiedPayment = (float)$verifiedStmt->fetchColumn() > 0.0001;

            if (!$hasVerifiedPayment) {
                visit_billing_save_charges($pdo, $visitId, $charges, true);
            }
        }

        $paymentId = visit_billing_insert_payment_payload($pdo, $visitId, $input);
        $pdo->commit();

        try {
            notification_send_visit_event($pdo, $visitId, 'payment_received', [
                'payment_id' => $paymentId,
                'amount' => (float)($input['amount'] ?? 0),
                'reference_number' => visit_billing_nullable_text($input['reference_number'] ?? $input['referenceNumber'] ?? null),
            ]);
        } catch (Throwable $notificationError) {
            error_log('Visit payment notification failed: ' . $notificationError->getMessage());
        }

        echo json_encode([
            'success' => true,
            'message' => 'Payment recorded.',
            'visit' => visit_billing_fetch_visit($pdo, $visitId)
        ]);
    } catch (Exception $e) {
        visit_billing_error(500, 'Failed to record payment: ' . $e->getMessage());
    }
}

if (!defined('VISIT_BILLING_HELPERS_ONLY') || !VISIT_BILLING_HELPERS_ONLY) {
    $method = $_SERVER['REQUEST_METHOD'];
    $action = $_GET['action'] ?? '';
    $visitId = visit_billing_requested_id($_GET, 'visit_id', 'visitId') ?? 0;

    if ($method === 'GET') {
        visit_billing_list($pdo);
    } elseif ($method === 'POST' && $action === 'charges') {
        visit_billing_replace_charges($pdo, $visitId);
    } elseif ($method === 'POST' && $action === 'payments') {
        visit_billing_add_payment($pdo, $visitId);
    } elseif ($method === 'POST') {
        visit_billing_upsert_visit($pdo);
    } else {
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
    }
}
