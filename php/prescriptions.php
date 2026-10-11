<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/workflow_guard_helpers.php';
require_once __DIR__ . '/notification_helpers.php';
require_once __DIR__ . '/prescription_helpers.php';

header('Content-Type: application/json');
header('Cache-Control: no-store');

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
            prescriptions_error(403, 'Only a veterinarian can add a prescription.');
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
    // All checklist and start actions lock the plan first, then its items/doses.
    $scope = $pdo->prepare('SELECT item_rows.plan_id FROM prescription_occurrences occurrence_rows JOIN prescription_items item_rows ON item_rows.item_id = occurrence_rows.item_id WHERE occurrence_rows.occurrence_id = ?');
    $scope->execute([$occurrenceId]);
    $planId = (int)$scope->fetchColumn();
    // Resolve the ID before the transaction so a waiting request does not keep
    // a repeatable-read snapshot from before the preceding dose action committed.
    $pdo->beginTransaction();
    $plan = prescriptions_plan_row($pdo, $planId, true);
    if (!$plan) {
        prescriptions_error(404, 'Medication occurrence was not found.');
    }
    prescriptions_assert_access($pdo, $actor, $plan);
    if (in_array($plan['status'], ['superseded', 'stopped'], true)) {
        prescriptions_error(409, 'This prescription is archived and its checklist cannot be changed.');
    }
    $stmt = $pdo->prepare("
        SELECT occurrence_rows.*, item_rows.plan_id, plan.pet_id
        FROM prescription_occurrences occurrence_rows
        JOIN prescription_items item_rows ON item_rows.item_id = occurrence_rows.item_id
        JOIN prescription_plans plan ON plan.plan_id = item_rows.plan_id
        WHERE occurrence_rows.occurrence_id = ?
        LIMIT 1
        FOR UPDATE
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
    prescription_refresh_plan_status($pdo, (int)$occurrence['plan_id']);
    $pdo->commit();

    echo json_encode(['success' => true, 'message' => $status === 'pending' ? 'Dose reopened.' : 'Dose marked ' . $status . '.']);
}

function prescriptions_create(PDO $pdo, array $actor, int $petId): void
{
    $input = prescriptions_input();
    prescriptions_assert_access($pdo, $actor, ['pet_id' => $petId], true);
    $items = is_array($input['items'] ?? null) ? $input['items'] : [];
    if (!prescription_normalize_items($items)) {
        prescriptions_error(400, 'Add at least one medication to the new prescription.');
    }
    $pdo->beginTransaction();
    $result = prescription_add_plan($pdo, $petId, (int)$actor['userId'], $items);
    $pdo->commit();
    if (!empty($result['changed'])) {
        try {
            prescription_notify_plan($pdo, (int)$result['planId']);
        } catch (Throwable $notificationError) {
            error_log('New prescription notification failed: ' . $notificationError->getMessage());
        }
    }
    echo json_encode([
        'success' => true,
        'message' => !empty($result['changed']) ? 'New prescription issued.' : 'This prescription was already issued.',
        'planId' => (int)$result['planId'],
        'plans' => prescription_fetch_plans($pdo, $petId, null, true),
    ]);
}

function prescriptions_complete_item(PDO $pdo, array $actor, int $itemId): void
{
    $scope = $pdo->prepare('SELECT plan_id FROM prescription_items WHERE item_id = ?');
    $scope->execute([$itemId]);
    $planId = (int)$scope->fetchColumn();
    $pdo->beginTransaction();
    $plan = prescriptions_plan_row($pdo, $planId, true);
    if (!$plan) {
        prescriptions_error(404, 'Medication was not found.');
    }
    prescriptions_assert_access($pdo, $actor, $plan);
    if (in_array($plan['status'], ['superseded', 'stopped'], true)) {
        prescriptions_error(409, 'This prescription is archived.');
    }
    $stmt = $pdo->prepare('SELECT * FROM prescription_items WHERE item_id = ? FOR UPDATE');
    $stmt->execute([$itemId]);
    $item = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($item['schedule_type'] !== 'as_needed') {
        prescriptions_error(409, 'Scheduled medicines finish when their dose checklist is complete.');
    }
    if (!in_array($item['status'], ['active', 'completed'], true)) {
        prescriptions_error(409, 'Start this medication before marking it finished.');
    }
    if ($item['status'] !== 'completed') {
        $pdo->prepare("UPDATE prescription_items SET status = 'completed', end_at = NOW() WHERE item_id = ?")->execute([$itemId]);
        prescription_event($pdo, (int)$plan['plan_id'], $itemId, (int)$actor['userId'], 'item_completed');
    }
    prescription_refresh_plan_status($pdo, (int)$plan['plan_id']);
    $pdo->commit();
    echo json_encode(['success' => true, 'message' => 'Medication finished and moved to History.']);
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
    $petId = (int)($_GET['petId'] ?? $_GET['pet_id'] ?? 0);
    $itemId = (int)($_GET['itemId'] ?? 0);

    if ($method === 'GET') {
        prescriptions_list($pdo, $actor);
    } elseif ($method === 'POST' && $action === 'start' && $planId > 0) {
        prescriptions_start($pdo, $actor, $planId);
    } elseif ($method === 'POST' && $action === 'amend' && $planId > 0) {
        prescriptions_error(405, 'Prescription editing and replacement are disabled. Use Add prescription to issue a new prescription.');
    } elseif ($method === 'POST' && $action === 'create' && $petId > 0) {
        prescriptions_create($pdo, $actor, $petId);
    } elseif ($method === 'POST' && $action === 'complete' && $itemId > 0) {
        prescriptions_complete_item($pdo, $actor, $itemId);
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
    $errorStatus = $error instanceof DomainException ? 409 : ($error instanceof InvalidArgumentException ? 400 : ($error instanceof OutOfBoundsException ? 404 : 500));
    http_response_code($status >= 400 ? $status : $errorStatus);
    echo json_encode(['success' => false, 'message' => 'Prescription request failed: ' . $error->getMessage()]);
}
