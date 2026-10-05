<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/workflow_guard_helpers.php';
require_once __DIR__ . '/notification_helpers.php';
require_once __DIR__ . '/prescription_helpers.php';

header('Content-Type: application/json');

function prescriptions_input(): array
{
    return json_decode(file_get_contents('php://input'), true) ?: [];
}

function prescriptions_error(int $status, string $message): void
{
    ipawcus_guard_error($status, $message);
}

function prescriptions_current_actor(PDO $pdo): array
{
    $user = ipawcus_guard_current_user($pdo);
    return [
        'userId' => ipawcus_guard_user_id($user),
        'role' => ipawcus_guard_role($user),
    ];
}

function prescriptions_plan_row(PDO $pdo, int $planId, bool $lock = false): ?array
{
    $stmt = $pdo->prepare("
        SELECT * FROM prescription_plans
        WHERE plan_id = ?
        LIMIT 1
        " . ($lock ? 'FOR UPDATE' : '')
    );
    $stmt->execute([$planId]);
    return $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
}

function prescriptions_owner_has_pet(PDO $pdo, int $userId, int $petId): bool
{
    $stmt = $pdo->prepare('SELECT COUNT(*) FROM pet_ownership WHERE user_id = ? AND pet_id = ?');
    $stmt->execute([$userId, $petId]);
    return (int)$stmt->fetchColumn() > 0;
}

function prescriptions_assert_access(PDO $pdo, array $actor, array $plan, bool $vetOnly = false): void
{
    if ($vetOnly) {
        if (!ipawcus_guard_is_vet_role($actor['role'])) {
            prescriptions_error(403, 'Only a veterinarian can update or replace clinical prescription directions.');
        }
        return;
    }

    if (ipawcus_guard_is_clinic_role($actor['role'])) {
        return;
    }
    if (!prescriptions_owner_has_pet($pdo, (int)$actor['userId'], (int)$plan['pet_id'])) {
        prescriptions_error(403, 'You are not allowed to access this pet prescription.');
    }
}

function prescriptions_list(PDO $pdo, array $actor): void
{
    $petId = (int)($_GET['petId'] ?? $_GET['pet_id'] ?? 0);
    $includeHistory = !isset($_GET['includeHistory']) || !in_array(strtolower((string)$_GET['includeHistory']), ['0', 'false', 'no'], true);
    $ownerUserId = null;

    if (!ipawcus_guard_is_clinic_role($actor['role'])) {
        $ownerUserId = (int)$actor['userId'];
        if ($petId > 0 && !prescriptions_owner_has_pet($pdo, $ownerUserId, $petId)) {
            prescriptions_error(403, 'You are not allowed to access this pet prescription.');
        }
    }

    echo json_encode([
        'success' => true,
        'schemaReady' => true,
        'plans' => prescription_fetch_plans($pdo, $petId > 0 ? $petId : null, $ownerUserId, $includeHistory),
    ]);
}

function prescriptions_start(PDO $pdo, array $actor, int $planId): void
{
    $input = prescriptions_input();
    $pdo->beginTransaction();
    $plan = prescriptions_plan_row($pdo, $planId, true);
    if (!$plan) {
        prescriptions_error(404, 'Prescription plan was not found.');
    }
    prescriptions_assert_access($pdo, $actor, $plan);
    if (in_array($plan['status'], ['superseded', 'stopped', 'completed'], true)) {
        prescriptions_error(409, 'This prescription plan can no longer be started.');
    }

    $requestedItems = is_array($input['items'] ?? null) ? $input['items'] : [];
    $requestedById = [];
    foreach ($requestedItems as $requested) {
        if (is_array($requested) && (int)($requested['itemId'] ?? 0) > 0) {
            $requestedById[(int)$requested['itemId']] = $requested;
        }
    }
    $itemIds = array_values(array_filter(array_map('intval', $input['itemIds'] ?? [])));
    $startAll = !empty($input['startAll']) || (!$itemIds && !$requestedById);
    $stmt = $pdo->prepare("SELECT * FROM prescription_items WHERE plan_id = ? AND status = 'pending_start' ORDER BY item_id ASC FOR UPDATE");
    $stmt->execute([$planId]);
    $items = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $started = 0;
    $occurrences = 0;
    $today = (new DateTimeImmutable('now', new DateTimeZone('Asia/Manila')))->format('Y-m-d');

    foreach ($items as $item) {
        $itemId = (int)$item['item_id'];
        if (!$startAll && !in_array($itemId, $itemIds, true) && !isset($requestedById[$itemId])) {
            continue;
        }
        $requested = $requestedById[$itemId] ?? [];
        $startDate = trim((string)($requested['startDate'] ?? $input['startDate'] ?? $item['recommended_start_date'] ?? $today));
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $startDate)) {
            prescriptions_error(400, 'Each medication requires a valid start date.');
        }
        $slots = prescription_normalize_time_slots(
            $requested['timeSlots'] ?? prescription_json_array($item['time_slots']),
            (int)$item['times_count']
        );
        $days = prescription_normalize_days($requested['daysOfWeek'] ?? prescription_json_array($item['days_of_week']));
        $occurrences += prescription_generate_occurrences($pdo, $item, $startDate, $slots, $days);
        prescription_event($pdo, $planId, $itemId, (int)$actor['userId'], 'item_started', [
            'startDate' => $startDate,
            'timeSlots' => $slots,
            'daysOfWeek' => $days,
        ]);
        $started++;
    }

    if ($started === 0) {
        prescriptions_error(409, 'No waiting medication items were selected.');
    }
    prescription_refresh_plan_status($pdo, $planId);
    $pdo->commit();

    echo json_encode([
        'success' => true,
        'message' => $started === 1 ? 'Medication schedule started.' : "{$started} medication schedules started.",
        'startedItems' => $started,
        'createdOccurrences' => $occurrences,
        'plans' => prescription_fetch_plans($pdo, (int)$plan['pet_id'], null, true),
    ]);
}

function prescriptions_update_occurrence(PDO $pdo, array $actor, int $occurrenceId): void
{
    $input = prescriptions_input();
    $status = strtolower(trim((string)($input['status'] ?? '')));
    if (!in_array($status, ['pending', 'taken', 'skipped'], true)) {
        prescriptions_error(400, 'Occurrence status must be pending, taken, or skipped.');
    }
    $stmt = $pdo->prepare("
        SELECT occurrence_rows.*, item_rows.plan_id, plan.pet_id
        FROM prescription_occurrences occurrence_rows
        JOIN prescription_items item_rows ON item_rows.item_id = occurrence_rows.item_id
        JOIN prescription_plans plan ON plan.plan_id = item_rows.plan_id
        WHERE occurrence_rows.occurrence_id = ?
        LIMIT 1
    ");
    $stmt->execute([$occurrenceId]);
    $occurrence = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$occurrence) {
        prescriptions_error(404, 'Medication occurrence was not found.');
    }
    prescriptions_assert_access($pdo, $actor, $occurrence);
    if ($occurrence['status'] === 'cancelled') {
        prescriptions_error(409, 'A cancelled medication occurrence cannot be changed.');
    }

    $completedAt = $status === 'pending' ? null : date('Y-m-d H:i:s');
    $completedBy = $status === 'pending' ? null : (int)$actor['userId'];
    $notes = prescription_nullable_text($input['notes'] ?? null);
    $update = $pdo->prepare("
        UPDATE prescription_occurrences
        SET status = ?, completed_at = ?, completed_by_user_id = ?, completion_notes = ?
        WHERE occurrence_id = ?
    ");
    $update->execute([$status, $completedAt, $completedBy, $notes, $occurrenceId]);
    prescription_event($pdo, (int)$occurrence['plan_id'], (int)$occurrence['item_id'], (int)$actor['userId'], 'occurrence_' . $status, [
        'occurrenceId' => $occurrenceId,
        'dueAt' => $occurrence['due_at'],
        'notes' => $notes,
    ]);

    echo json_encode(['success' => true, 'message' => $status === 'pending' ? 'Dose reopened.' : 'Dose marked ' . $status . '.']);
}

function prescriptions_amend(PDO $pdo, array $actor, int $planId): void
{
    $input = prescriptions_input();
    $items = prescription_normalize_items(is_array($input['items'] ?? null) ? $input['items'] : []);
    if (!$items) {
        prescriptions_error(400, 'Add at least one medication to the replacement prescription.');
    }
    $pdo->beginTransaction();
    $plan = prescriptions_plan_row($pdo, $planId, true);
    if (!$plan) {
        prescriptions_error(404, 'Prescription plan was not found.');
    }
    prescriptions_assert_access($pdo, $actor, $plan, true);
    $result = prescription_sync_plan(
        $pdo,
        (int)$plan['pet_id'],
        $plan['owner_user_id'] !== null ? (int)$plan['owner_user_id'] : null,
        (int)$actor['userId'],
        (string)$plan['source_type'],
        (int)$plan['source_record_id'],
        $items,
        trim((string)($input['sourceLabel'] ?? $plan['source_label'] ?? 'Prescription update'))
    );
    $pdo->commit();
    if (empty($result['changed'])) {
        echo json_encode(['success' => true, 'message' => 'No prescription changes were detected.', 'planId' => $result['planId']]);
        return;
    }
    prescription_notify_plan($pdo, (int)$result['planId'], true);
    echo json_encode([
        'success' => true,
        'message' => 'Replacement prescription issued. Previous completed doses were preserved.',
        'planId' => (int)$result['planId'],
        'plans' => prescription_fetch_plans($pdo, (int)$plan['pet_id'], null, true),
    ]);
}

try {
    if (!prescription_schema_ready($pdo)) {
        prescriptions_error(503, prescription_schema_message());
    }
    $actor = prescriptions_current_actor($pdo);
    $method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
    $action = strtolower(trim((string)($_GET['action'] ?? 'list')));
    $planId = (int)($_GET['planId'] ?? $_GET['plan_id'] ?? 0);
    $occurrenceId = (int)($_GET['occurrenceId'] ?? $_GET['occurrence_id'] ?? 0);

    if ($method === 'GET') {
        prescriptions_list($pdo, $actor);
    } elseif ($method === 'POST' && $action === 'start' && $planId > 0) {
        prescriptions_start($pdo, $actor, $planId);
    } elseif ($method === 'POST' && $action === 'amend' && $planId > 0) {
        prescriptions_amend($pdo, $actor, $planId);
    } elseif ($method === 'PATCH' && $action === 'occurrence' && $occurrenceId > 0) {
        prescriptions_update_occurrence($pdo, $actor, $occurrenceId);
    } else {
        prescriptions_error(405, 'Prescription method or action is not allowed.');
    }
} catch (Throwable $error) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    $status = http_response_code();
    http_response_code($status >= 400 ? $status : 500);
    echo json_encode(['success' => false, 'message' => 'Prescription request failed: ' . $error->getMessage()]);
}
