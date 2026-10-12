<?php
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../../php/prescription_helpers.php';
require_once __DIR__ . '/../../php/role_access.php';

// Exercise the real helpers against disposable SQLite data. Only MySQL lock and
// INSERT IGNORE syntax is adapted; this does not test MySQL concurrency.
class PrescriptionFixturePDO extends Pdo\Sqlite
{
    public function __construct()
    {
        parent::__construct('sqlite::memory:');
        $this->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $this->createFunction('DATABASE', static fn(): string => 'fixture');
        $this->createFunction('CONCAT', static fn(...$parts): string => implode('', $parts));
        $this->exec("ATTACH DATABASE ':memory:' AS information_schema");
        $this->exec('CREATE TABLE information_schema.tables (table_schema TEXT, table_name TEXT)');
        $this->exec('CREATE TABLE information_schema.columns (table_schema TEXT, table_name TEXT, column_name TEXT)');
    }

    public function prepare(string $query, array $options = []): PDOStatement|false
    {
        $query = preg_replace('/\bFOR UPDATE\b/i', '', $query);
        $query = str_replace('INSERT IGNORE INTO', 'INSERT OR IGNORE INTO', $query);
        return parent::prepare($query, $options);
    }
}

$pdo = new PrescriptionFixturePDO();
$pdo->exec("CREATE TABLE pets_information (pet_id INTEGER PRIMARY KEY, pet_name TEXT);
    CREATE TABLE users (user_id INTEGER PRIMARY KEY, first_Name TEXT, last_Name TEXT);
    CREATE TABLE pet_ownership (link_id INTEGER PRIMARY KEY, pet_id INTEGER, user_id INTEGER, is_primary INTEGER);
    CREATE TABLE prescription_plans (
        plan_id INTEGER PRIMARY KEY AUTOINCREMENT, pet_id INTEGER, owner_user_id INTEGER,
        veterinarian_user_id INTEGER, source_type TEXT, source_record_id INTEGER, source_label TEXT,
        version_number INTEGER, status TEXT DEFAULT 'issued', content_hash TEXT, supersedes_plan_id INTEGER,
        issued_at TEXT DEFAULT '2026-10-11 08:00:00', UNIQUE(source_type, source_record_id, version_number));
    CREATE TABLE prescription_items (
        item_id INTEGER PRIMARY KEY AUTOINCREMENT, plan_id INTEGER, client_item_key TEXT,
        medicine TEXT, dose TEXT, route TEXT, times_count INTEGER, frequency TEXT, schedule_type TEXT,
        interval_hours INTEGER, time_slots TEXT, days_of_week TEXT, duration_number INTEGER,
        duration_unit TEXT, instructions TEXT, recommended_start_date TEXT, replaces_item_id INTEGER,
        start_at TEXT, end_at TEXT, status TEXT DEFAULT 'pending_start');
    CREATE TABLE prescription_occurrences (
        occurrence_id INTEGER PRIMARY KEY AUTOINCREMENT, item_id INTEGER, due_at TEXT,
        status TEXT DEFAULT 'pending', completed_at TEXT, completion_notes TEXT, UNIQUE(item_id, due_at));
    CREATE TABLE prescription_events (event_id INTEGER PRIMARY KEY AUTOINCREMENT,
        plan_id INTEGER, item_id INTEGER, actor_user_id INTEGER, event_type TEXT, event_data TEXT);
    INSERT INTO pets_information VALUES (1, 'Milo'), (2, 'Other pet');
    INSERT INTO users VALUES (10, 'Owner', 'One'), (20, 'Vet', 'One');
    INSERT INTO pet_ownership VALUES (1, 1, 10, 1)");
foreach (['prescription_plans', 'prescription_items', 'prescription_occurrences', 'prescription_events', 'pet_ownership'] as $table) {
    $pdo->prepare('INSERT INTO information_schema.tables VALUES (?, ?)')->execute(['fixture', $table]);
}
$pdo->exec("INSERT INTO information_schema.columns VALUES ('fixture', 'pet_ownership', 'is_primary')");
$checks = 0;
function rxcheck(bool $condition, string $label): void
{
    global $checks;
    if (!$condition) throw new RuntimeException('FAIL: ' . $label);
    $checks++;
}
function rxthrows(callable $action, string $type, string $label): void
{
    try {
        $action();
    } catch (Throwable $error) {
        rxcheck($error instanceof $type, $label);
        return;
    }
    throw new RuntimeException('FAIL: ' . $label);
}
function rxitem(PDO $pdo, int $itemId): array
{
    $stmt = $pdo->prepare('SELECT * FROM prescription_items WHERE item_id = ?');
    $stmt->execute([$itemId]);
    return $stmt->fetch(PDO::FETCH_ASSOC);
}

$medicine = ['id' => 'original-a', 'medicine' => 'Medicine A', 'dose' => '1 tablet', 'route' => 'Oral',
    'times' => 2, 'timeSlots' => ['08:00', '20:00'], 'durationNumber' => 2, 'durationUnit' => 'day'];
rxthrows(fn() => prescription_add_plan($pdo, 1, 20, [$medicine]), LogicException::class, 'Issuing requires an enclosing transaction');
$pdo->beginTransaction();
$first = prescription_sync_plan($pdo, 1, 10, 20, 'clinic_diagnosis', 100, [$medicine]);
$same = prescription_sync_plan($pdo, 1, 10, 20, 'clinic_diagnosis', 100, [$medicine]);
rxcheck($same['planId'] === $first['planId'] && !$same['changed'], 'Saving unchanged diagnosis does not duplicate the prescription');
rxthrows(fn() => prescription_sync_plan($pdo, 1, 10, 20, 'clinic_diagnosis', 100, [array_merge($medicine, ['dose' => '2 tablets'])]), DomainException::class, 'Diagnosis cannot overwrite issued directions');
rxthrows(fn() => prescription_sync_plan($pdo, 1, 10, 20, 'clinic_diagnosis', 100, []), DomainException::class, 'Diagnosis cannot remove an issued prescription');
$itemA = (int)$pdo->query('SELECT item_id FROM prescription_items')->fetchColumn();
rxcheck(prescription_generate_occurrences($pdo, rxitem($pdo, $itemA), '2026-10-12', ['08:00', '20:00'], []) === 4, 'Two-day twice-daily course has all four doses');
prescription_refresh_plan_status($pdo, $first['planId']);
$oldItems = $pdo->query('SELECT * FROM prescription_items')->fetchAll(PDO::FETCH_ASSOC);
$oldDoses = $pdo->query('SELECT * FROM prescription_occurrences')->fetchAll(PDO::FETCH_ASSOC);
$newMedicine = ['id' => 'new-b', 'medicine' => 'Medicine B', 'scheduleType' => 'as_needed', 'instructions' => 'Follow clinical directions', 'replacesItemId' => $itemA];
$second = prescription_add_plan($pdo, 1, 20, [$newMedicine]);
rxcheck($second['planId'] !== $first['planId'], 'Vet can issue a separate new prescription');
rxcheck($pdo->query("SELECT status FROM prescription_plans WHERE plan_id = {$first['planId']}")->fetchColumn() === 'active', 'Adding keeps the earlier prescription active');
rxcheck($pdo->query("SELECT * FROM prescription_items WHERE plan_id = {$first['planId']}")->fetchAll(PDO::FETCH_ASSOC) === $oldItems, 'Adding does not alter earlier medicine directions or starts');
rxcheck($pdo->query('SELECT * FROM prescription_occurrences')->fetchAll(PDO::FETCH_ASSOC) === $oldDoses, 'Adding does not cancel or restart earlier doses');
rxcheck($pdo->query("SELECT supersedes_plan_id FROM prescription_plans WHERE plan_id = {$second['planId']}")->fetchColumn() === null, 'New prescription does not supersede the old one');
rxcheck($pdo->query("SELECT replaces_item_id FROM prescription_items WHERE plan_id = {$second['planId']}")->fetchColumn() === null, 'A submitted replacement reference is ignored');
$retry = prescription_add_plan($pdo, 1, 20, [$newMedicine]);
rxcheck($retry['planId'] === $second['planId'] && !$retry['changed'], 'A submission retry does not issue duplicate medicines');
$third = prescription_add_plan($pdo, 1, 20, [array_merge($newMedicine, ['id' => 'another-draft-b'])]);
rxcheck($third['planId'] !== $second['planId'], 'A fresh draft can issue the same medicine as a new course');
$itemB = (int)$pdo->query("SELECT item_id FROM prescription_items WHERE plan_id = {$second['planId']}")->fetchColumn();
rxcheck(prescription_generate_occurrences($pdo, rxitem($pdo, $itemB), '2026-10-12', [], []) === 0, 'As-needed medicine creates no artificial scheduled doses');
prescription_refresh_plan_status($pdo, $second['planId']);
rxcheck(rxitem($pdo, $itemB)['status'] === 'active', 'Starting an as-needed medicine really activates it');
rxcheck($pdo->query("SELECT status FROM prescription_plans WHERE plan_id = {$second['planId']}")->fetchColumn() === 'active', 'As-needed course stays active until explicitly finished');
$pdo->exec("UPDATE prescription_occurrences SET status = 'taken' WHERE item_id = {$itemA} AND occurrence_id <> 4");
prescription_refresh_plan_status($pdo, $first['planId']);
rxcheck(rxitem($pdo, $itemA)['status'] === 'active', 'An unresolved final dose keeps the medicine active');
$pdo->exec("UPDATE prescription_occurrences SET status = 'missed' WHERE occurrence_id = 4");
prescription_refresh_plan_status($pdo, $first['planId']);
rxcheck(rxitem($pdo, $itemA)['status'] === 'active', 'An overdue missed dose does not silently finish a medicine');
$pdo->exec("UPDATE prescription_occurrences SET status = 'skipped' WHERE occurrence_id = 4");
prescription_refresh_plan_status($pdo, $first['planId']);
rxcheck(rxitem($pdo, $itemA)['status'] === 'completed', 'All taken or skipped doses finish the individual medicine');
rxcheck($pdo->query("SELECT status FROM prescription_plans WHERE plan_id = {$first['planId']}")->fetchColumn() === 'completed', 'The final medicine finishes the whole course');
$active = prescription_fetch_plans($pdo, 1, 10, false);
rxcheck(!in_array($first['planId'], array_column($active, 'planId'), true), 'A finished medicine leaves the active API list');
$history = prescription_fetch_plans($pdo, 1, 10, true);
rxcheck(count($history) === 3 && count($history[2]['occurrences']) === 4, 'History retains the old prescription and every recorded dose');
rxcheck(prescription_fetch_plans($pdo, 1, 999, true) === [], 'Another owner cannot read this pet prescription');
$pdo->exec("UPDATE prescription_occurrences SET status = 'pending' WHERE occurrence_id = 4");
prescription_refresh_plan_status($pdo, $first['planId']);
rxcheck(rxitem($pdo, $itemA)['status'] === 'active', 'Reopening a mistaken checklist completion restores the medicine');
$pdo->exec("UPDATE prescription_items SET status = 'completed' WHERE item_id = {$itemB}");
prescription_refresh_plan_status($pdo, $second['planId']);
rxcheck(!in_array($second['planId'], array_column(prescription_fetch_plans($pdo, 1, 10, false), 'planId'), true), 'An explicitly finished as-needed medicine leaves Active');
// Existing records with complete checklists are reconciled when read, too.
$pdo->exec("UPDATE prescription_occurrences SET status = 'taken' WHERE item_id = {$itemA}; UPDATE prescription_items SET status = 'active' WHERE item_id = {$itemA}");
rxcheck(!in_array($first['planId'], array_column(prescription_fetch_plans($pdo, 1, 10, false), 'planId'), true), 'Legacy completed checklists are removed from the active list on read');
rxcheck(count(prescription_fetch_plans($pdo, 1, 10, true)[2]['occurrences']) === 4, 'Reading completion does not delete doses');
rxthrows(fn() => prescription_add_plan($pdo, 999, 20, [$newMedicine]), OutOfBoundsException::class, 'An unknown pet cannot receive a prescription');
rxthrows(fn() => prescription_add_plan($pdo, 1, 20, []), InvalidArgumentException::class, 'An empty prescription is rejected');

$mixed = prescription_add_plan($pdo, 1, 20, [
    array_merge($medicine, ['id' => 'mixed-a', 'times' => 1, 'timeSlots' => ['08:00'], 'durationNumber' => 1]),
    array_merge($medicine, ['id' => 'mixed-b', 'medicine' => 'Medicine B', 'times' => 1, 'timeSlots' => ['08:00']])
]);
$mixedIds = $pdo->query("SELECT item_id FROM prescription_items WHERE plan_id = {$mixed['planId']} ORDER BY item_id")->fetchAll(PDO::FETCH_COLUMN);
foreach ($mixedIds as $id) prescription_generate_occurrences($pdo, rxitem($pdo, (int)$id), '2026-10-12', ['08:00'], []);
$pdo->exec("UPDATE prescription_occurrences SET status = 'taken' WHERE item_id = {$mixedIds[0]}");
prescription_refresh_plan_status($pdo, $mixed['planId']);
$mixedActive = array_values(array_filter(prescription_fetch_plans($pdo, 1, 10, false), static fn(array $plan): bool => $plan['planId'] === $mixed['planId']))[0];
rxcheck(array_column($mixedActive['items'], 'medicine') === ['Medicine B'], 'Finishing Medicine A hides only A within a mixed prescription');
rxcheck(array_unique(array_column($mixedActive['occurrences'], 'itemId')) === [(int)$mixedIds[1]], 'The active API checklist contains only the unfinished medicine');
$mixedHistory = array_values(array_filter(prescription_fetch_plans($pdo, 1, 10, true), static fn(array $plan): bool => $plan['planId'] === $mixed['planId']))[0];
rxcheck(count($mixedHistory['items']) === 2 && count($mixedHistory['occurrences']) === 3, 'Full history retains both medicines from a mixed course');

foreach ([
    ['interval_hours', ['intervalHours' => 8, 'durationNumber' => 2, 'durationUnit' => 'day'], [], 6],
    ['weekly', ['durationNumber' => 1, 'durationUnit' => 'week', 'times' => 1], [1, 3], 2],
    ['monthly', ['durationNumber' => 1, 'durationUnit' => 'month'], [], 2],
] as [$type, $fields, $days, $expectedDoses]) {
    $schedule = prescription_add_plan($pdo, 1, 20, [array_merge($medicine, $fields, ['id' => "schedule-{$type}", 'scheduleType' => $type])]);
    $scheduleItem = (int)$pdo->query("SELECT item_id FROM prescription_items WHERE plan_id = {$schedule['planId']}")->fetchColumn();
    $slots = $type === 'weekly' ? ['08:00'] : ['08:00', '20:00'];
    rxcheck(prescription_generate_occurrences($pdo, rxitem($pdo, $scheduleItem), '2026-10-12', $slots, $days) === $expectedDoses, "{$type} creates the complete prescribed checklist");
}
$tooLong = prescription_add_plan($pdo, 1, 20, [array_merge($medicine, ['id' => 'too-long', 'durationNumber' => 1001, 'times' => 1])]);
$longItem = (int)$pdo->query("SELECT item_id FROM prescription_items WHERE plan_id = {$tooLong['planId']}")->fetchColumn();
rxthrows(fn() => prescription_generate_occurrences($pdo, rxitem($pdo, $longItem), '2026-10-12', ['08:00'], []), DomainException::class, 'A course cannot silently truncate its final doses');
rxcheck((int)$pdo->query("SELECT COUNT(*) FROM prescription_occurrences WHERE item_id = {$longItem}")->fetchColumn() === 0 && rxitem($pdo, $longItem)['status'] === 'pending_start', 'An oversized checklist fails before starting or inserting partial doses');

$pdo->rollBack();
rxcheck((int)$pdo->query('SELECT COUNT(*) FROM prescription_plans')->fetchColumn() === 0, 'Rolling back restores the prescription records');

prescription_assert_unchanged_items([$medicine], [array_merge($medicine, ['id' => 'rehydrated-id'])]);
rxcheck(true, 'Draft IDs do not count as edits to clinical directions');
foreach (['medicine' => 'Different medicine', 'dose' => '2 tablets', 'timeSlots' => ['09:00', '21:00'], 'instructions' => 'Changed directions', 'durationNumber' => 3, 'recommendedStartDate' => '2026-10-13'] as $field => $value) {
    rxthrows(fn() => prescription_assert_unchanged_items([$medicine], [array_merge($medicine, [$field => $value])]), DomainException::class, "Issued {$field} cannot be edited");
}
rxthrows(fn() => prescription_assert_unchanged_items([$medicine], []), DomainException::class, 'Issued medicines cannot be removed from their clinical record');
rxcheck(prescription_item_status(['status' => 'active', 'schedule_type' => 'times_daily'], 0, 0) === 'active', 'An empty or cancelled-only checklist is not a finished course');
rxcheck(prescription_plan_status(['completed', 'active']) === 'active', 'Finishing Medicine A does not finish Medicine B');
rxcheck(prescription_plan_status(['completed', 'pending_start']) === 'issued', 'A medicine still waiting to start remains visible');
rxcheck(prescription_plan_status(['completed', 'active', 'pending_start']) === 'partially_started', 'A mixed course retains its correct state');
rxcheck(ipawcus_route_access_policy('/pets/1/prescriptions', 'POST')['roles'] === ['veterinarian', 'super_admin'], 'Only vet roles can issue a new prescription');
rxcheck(in_array('pet_owner', ipawcus_route_access_policy('/prescription-items/1/complete', 'POST')['roles'], true), 'Owners can finish their own as-needed medicine, with endpoint ownership checks');
echo "PASS: {$checks} prescription checks using disposable in-memory fixtures; no configured database was changed.\n";
