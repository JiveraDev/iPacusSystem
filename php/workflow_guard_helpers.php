<?php

require_once __DIR__ . '/role_access.php';

function ipawcus_guard_error(int $status, string $message, array $extra = []): void
{
    global $pdo;

    if ($pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode(array_merge(['message' => $message], $extra));
    exit;
}

function ipawcus_guard_current_user(PDO $pdo): array
{
    return ipawcus_require_current_api_user($pdo);
}

function ipawcus_guard_role(array $user): string
{
    return ipawcus_access_normalize_role($user['role'] ?? $user['normalized_role'] ?? '');
}

function ipawcus_guard_user_id(array $user): int
{
    return (int)($user['user_id'] ?? $user['id'] ?? 0);
}

function ipawcus_guard_is_admin_role(string $role): bool
{
    return in_array($role, ['admin', 'super_admin'], true);
}

function ipawcus_guard_is_clinic_role(string $role): bool
{
    return in_array($role, ['admin', 'veterinarian', 'super_admin'], true);
}

function ipawcus_guard_is_vet_role(string $role): bool
{
    return in_array($role, ['veterinarian', 'super_admin'], true);
}

function ipawcus_guard_table_exists(PDO $pdo, string $tableName): bool
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

function ipawcus_guard_column_exists(PDO $pdo, string $tableName, string $columnName): bool
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

function ipawcus_guard_require_columns(PDO $pdo, string $tableName, array $columns): void
{
    $missing = [];
    foreach ($columns as $columnName) {
        if (!ipawcus_guard_column_exists($pdo, $tableName, $columnName)) {
            $missing[] = $columnName;
        }
    }

    if (!empty($missing)) {
        ipawcus_guard_error(
            500,
            'The database is missing required configured columns for this workflow. No schema changes were attempted.',
            ['missingColumns' => $missing, 'table' => $tableName]
        );
    }
}

function ipawcus_guard_pet_access(PDO $pdo, int $petId, int $userId): bool
{
    if ($petId <= 0 || $userId <= 0) {
        return false;
    }

    $stmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM pet_ownership
        WHERE pet_id = ?
          AND user_id = ?
    ");
    $stmt->execute([$petId, $userId]);

    return (int)$stmt->fetchColumn() > 0;
}

function ipawcus_guard_first_forbidden_pet(PDO $pdo, array $petIds, int $userId): ?int
{
    foreach (array_values(array_unique(array_map('intval', $petIds))) as $petId) {
        if ($petId > 0 && !ipawcus_guard_pet_access($pdo, $petId, $userId)) {
            return $petId;
        }
    }

    return null;
}

function ipawcus_guard_booking_access(PDO $pdo, int $bookingId, int $userId): bool
{
    if ($bookingId <= 0 || $userId <= 0) {
        return false;
    }

    $hasBookingPets = ipawcus_guard_table_exists($pdo, 'booking_pets');
    $bookingPetJoin = $hasBookingPets
        ? 'LEFT JOIN booking_pets bp ON bp.booking_id = b.booking_id'
        : '';
    $bookingPetCondition = $hasBookingPets
        ? ' OR EXISTS (
                SELECT 1
                FROM booking_pets bp2
                JOIN pet_ownership po2 ON po2.pet_id = bp2.pet_id
                WHERE bp2.booking_id = b.booking_id
                  AND po2.user_id = ?
            )'
        : '';
    $params = $hasBookingPets
        ? [$bookingId, $userId, $userId, $userId]
        : [$bookingId, $userId, $userId];

    $stmt = $pdo->prepare("
        SELECT COUNT(DISTINCT b.booking_id)
        FROM bookings b
        {$bookingPetJoin}
        WHERE b.booking_id = ?
          AND (
              b.user_id = ?
              OR EXISTS (
                  SELECT 1
                  FROM pet_ownership po
                  WHERE po.pet_id = b.pet_id
                    AND po.user_id = ?
              )
              {$bookingPetCondition}
          )
    ");
    $stmt->execute($params);

    return (int)$stmt->fetchColumn() > 0;
}

function ipawcus_guard_validate_booking_transition(string $currentStatus, string $nextStatus, bool $serviceWorkflow = false): void
{
    $current = strtolower(trim($currentStatus));
    $next = strtolower(trim($nextStatus));

    $allowedStatuses = ['pending', 'confirmed', 'completed', 'cancelled'];
    if (!in_array($next, $allowedStatuses, true)) {
        ipawcus_guard_error(422, 'Invalid booking status.', ['allowedStatuses' => $allowedStatuses]);
    }

    if ($next === 'completed' && !$serviceWorkflow) {
        ipawcus_guard_error(409, 'Bookings can only be completed by the matching service completion workflow.');
    }

    if ($current === 'cancelled' && $next !== 'cancelled') {
        ipawcus_guard_error(409, 'Cancelled bookings cannot be reactivated.');
    }

    $allowedTransitions = [
        'pending' => ['pending', 'confirmed', 'cancelled'],
        'confirmed' => $serviceWorkflow ? ['confirmed', 'cancelled', 'completed'] : ['confirmed', 'cancelled'],
        'completed' => ['completed'],
        'cancelled' => ['cancelled'],
    ];

    if (!in_array($next, $allowedTransitions[$current] ?? [], true)) {
        ipawcus_guard_error(409, "Booking status cannot move from {$current} to {$next}.");
    }
}

function ipawcus_guard_validate_queue_transition(string $currentStatus, string $nextStatus, bool $serviceWorkflow = false): void
{
    $current = strtolower(trim($currentStatus));
    $next = strtolower(trim($nextStatus));

    $allowedStatuses = ['waiting', 'in-progress', 'completed', 'cancelled'];
    if (!in_array($next, $allowedStatuses, true)) {
        ipawcus_guard_error(422, 'Invalid queue status.', ['allowedStatuses' => $allowedStatuses]);
    }

    if ($next === 'completed' && !$serviceWorkflow) {
        ipawcus_guard_error(409, 'Queues can only be completed by the matching service completion workflow.');
    }

    if ($current === 'cancelled' && $next !== 'cancelled') {
        ipawcus_guard_error(409, 'Cancelled queues cannot be reactivated.');
    }

    $allowedTransitions = [
        'waiting' => ['waiting', 'in-progress', 'cancelled'],
        'in-progress' => $serviceWorkflow ? ['in-progress', 'cancelled', 'completed'] : ['in-progress', 'cancelled'],
        'completed' => ['completed'],
        'cancelled' => ['cancelled'],
    ];

    if (!in_array($next, $allowedTransitions[$current] ?? [], true)) {
        ipawcus_guard_error(409, "Queue status cannot move from {$current} to {$next}.");
    }
}
