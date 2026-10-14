<?php
// Read-only validation of the configured database. No records or credentials are printed.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../php/db.php';

$report = ['checkedAt' => date(DATE_ATOM), 'tables' => [], 'missingTables' => [], 'missingColumns' => [], 'missingIndexes' => [], 'missingForeignKeys' => [], 'missingAutoIncrement' => [], 'duplicatePrimaryKeys' => [], 'unreadableTables' => [], 'relationships' => []];
$failed = 0;
$expected = [];
$expectedIndexes = [];
$expectedForeignKeys = [];
$expectedAutoIncrement = [];
$expectedPrimaryKeys = [];
if (isset($argv[1])) {
    $dump = file_get_contents($argv[1]);
    if ($dump === false) throw new RuntimeException('Schema export cannot be read.');
    preg_match_all('/^CREATE TABLE `([^`]+)` \(([\s\S]*?)^\)[^\r\n;]*;/m', $dump, $matches, PREG_SET_ORDER);
    foreach ($matches as $table) {
        preg_match_all('/^\s+`([^`]+)`\s/m', $table[2], $columns);
        $expected[$table[1]] = $columns[1];
    }
    preg_match_all('/^ALTER TABLE `([^`]+)`([\s\S]*?);/m', $dump, $alters, PREG_SET_ORDER);
    foreach ($alters as $alter) {
        if (str_contains($alter[2], 'ADD PRIMARY KEY')) $expectedIndexes[$alter[1]][] = 'PRIMARY';
        preg_match_all('/ADD (?:UNIQUE |FULLTEXT |SPATIAL )?(?:KEY|INDEX) `([^`]+)`/', $alter[2], $indexes);
        foreach ($indexes[1] as $index) $expectedIndexes[$alter[1]][] = $index;
        preg_match_all('/ADD CONSTRAINT `([^`]+)` FOREIGN KEY/', $alter[2], $constraints);
        foreach ($constraints[1] as $constraint) $expectedForeignKeys[$alter[1]][] = $constraint;
        preg_match_all('/MODIFY `([^`]+)`[^\r\n;]*AUTO_INCREMENT/', $alter[2], $autoColumns);
        foreach ($autoColumns[1] as $column) $expectedAutoIncrement[$alter[1]][] = $column;
        if (preg_match('/ADD PRIMARY KEY \(([^)]+)\)/', $alter[2], $primary)) {
            preg_match_all('/`([^`]+)`/', $primary[1], $keys);
            $expectedPrimaryKeys[$alter[1]] = $keys[1];
        }
    }
    if (!isset($expected['users'], $expected['bookings'])) throw new RuntimeException('Export has no complete application schema.');
    unset($dump, $matches);
}

$pdo->exec('SET TRANSACTION READ ONLY');
$pdo->beginTransaction();
try {
    $tables = $pdo->query("SELECT table_name FROM information_schema.tables WHERE table_schema=DATABASE() AND table_type='BASE TABLE'")->fetchAll(PDO::FETCH_COLUMN);
    $report['tableCount'] = count($tables);
    foreach ($tables as $table) {
        if (!preg_match('/^[A-Za-z0-9_]+$/', $table)) throw new RuntimeException('Unexpected table identifier.');
        try {
            $pdo->query("SELECT 1 FROM `{$table}` LIMIT 0");
            $report['tables'][$table] = 'readable';
        } catch (PDOException $error) {
            $report['unreadableTables'][] = $table;
            $failed++;
        }
    }
    foreach ($expected as $table => $columns) {
        if (!in_array($table, $tables, true)) {
            $report['missingTables'][] = $table;
            $failed++;
            continue;
        }
        $stmt = $pdo->prepare('SELECT column_name FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=?');
        $stmt->execute([$table]);
        $missing = array_values(array_diff($columns, $stmt->fetchAll(PDO::FETCH_COLUMN)));
        if ($missing) {
            $report['missingColumns'][$table] = $missing;
            $failed++;
        }
    }
    foreach ($expectedIndexes as $table => $indexes) {
        $stmt=$pdo->prepare('SELECT DISTINCT index_name FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name=?');
        $stmt->execute([$table]);
        $missing=array_values(array_diff($indexes,$stmt->fetchAll(PDO::FETCH_COLUMN)));
        if ($missing) { $report['missingIndexes'][$table]=$missing; $failed++; }
    }
    foreach ($expectedForeignKeys as $table => $constraints) {
        $stmt=$pdo->prepare("SELECT constraint_name FROM information_schema.table_constraints WHERE constraint_schema=DATABASE() AND table_name=? AND constraint_type='FOREIGN KEY'");
        $stmt->execute([$table]);
        $missing=array_values(array_diff($constraints,$stmt->fetchAll(PDO::FETCH_COLUMN)));
        if ($missing) { $report['missingForeignKeys'][$table]=$missing; $failed++; }
    }
    foreach ($expectedAutoIncrement as $table => $columns) {
        $stmt=$pdo->prepare("SELECT column_name FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=? AND extra LIKE '%auto_increment%'");
        $stmt->execute([$table]);
        $missing=array_values(array_diff($columns,$stmt->fetchAll(PDO::FETCH_COLUMN)));
        if ($missing) { $report['missingAutoIncrement'][$table]=$missing; $failed++; }
    }
    foreach ($expectedPrimaryKeys as $table => $keys) {
        if (!in_array($table,$tables,true) || !$keys) continue;
        foreach ($keys as $key) if (!preg_match('/^[A-Za-z0-9_]+$/',$key)) throw new RuntimeException('Invalid primary key identifier.');
        $quoted=implode(',',array_map(static fn(string $key):string => '`' . $key . '`',$keys));
        $groups=(int)$pdo->query("SELECT COUNT(*) FROM (SELECT {$quoted} FROM `{$table}` GROUP BY {$quoted} HAVING COUNT(*)>1) duplicates")->fetchColumn();
        if ($groups) { $report['duplicatePrimaryKeys'][$table]=$groups; $failed++; }
    }
    $relationships = [
        'pet ownership -> users' => ['pet_ownership','users','user_id','user_id'],
        'pet ownership -> pets' => ['pet_ownership','pets_information','pet_id','pet_id'],
        'bookings -> users' => ['bookings','users','user_id','user_id'],
        'bookings -> pets' => ['bookings','pets_information','pet_id','pet_id'],
        'bookings -> branches' => ['bookings','branches','branch_id','branch_id'],
        'queues -> users' => ['queues','users','user_id','user_id'],
        'queues -> pets' => ['queues','pets_information','pet_id','pet_id'],
        'queues -> branches' => ['queues','branches','branch_id','branch_id'],
        'Google identities -> users' => ['user_auth_identities','users','user_id','user_id'],
        'API sessions -> users' => ['api_access_tokens','users','user_id','user_id'],
        'branch assignments -> users' => ['user_branch_assignments','users','user_id','user_id'],
        'branch assignments -> branches' => ['user_branch_assignments','branches','branch_id','branch_id'],
        'visit charges -> visits' => ['visit_charges','visits','visit_id','visit_id'],
        'visit payments -> visits' => ['visit_payments','visits','visit_id','visit_id'],
        'inventory batches -> items' => ['inventory_batches','inventory_items','item_id','item_id'],
    ];
    foreach ($relationships as $label => [$child,$parent,$foreign,$key]) {
        if (!in_array($child,$tables,true) || !in_array($parent,$tables,true)) continue;
        $count = (int)$pdo->query("SELECT COUNT(*) FROM `{$child}` c LEFT JOIN `{$parent}` p ON p.`{$key}`=c.`{$foreign}` WHERE c.`{$foreign}` IS NOT NULL AND p.`{$key}` IS NULL")->fetchColumn();
        $report['relationships'][$label] = $count;
        if ($count) $failed++;
    }
    $pdo->rollBack();
} catch (Throwable $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    throw $error;
}

$directory = __DIR__ . '/../tmp/database-readiness';
if (!is_dir($directory)) mkdir($directory, 0750, true);
file_put_contents($directory . '/summary.json', json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL);
echo count($report['tables']) . " tables inspected; " . count($report['unreadableTables']) . " unreadable.\n";
if ($expected) echo count($expected) . " export tables compared; " . count($report['missingTables']) . " missing tables; " . count($report['missingColumns']) . " tables with missing columns.\n";
if ($expected) echo count($report['missingIndexes']) . " tables with missing indexes; " . count($report['missingForeignKeys']) . " tables with missing foreign-key constraints.\n";
if ($expected) echo count($report['missingAutoIncrement']) . " tables with missing auto-increment; " . count($report['duplicatePrimaryKeys']) . " tables with duplicate primary-key values.\n";
foreach ($report['missingTables'] as $table) echo "FAIL: Missing table {$table}\n";
foreach ($report['missingColumns'] as $table => $columns) echo "FAIL: {$table} missing " . implode(', ', $columns) . "\n";
foreach (['users','api_access_tokens','user_auth_identities','bookings','queues'] as $table) {
    if (isset($report['missingIndexes'][$table])) echo "FAIL: {$table} missing exported indexes/primary key\n";
}
foreach ($report['duplicatePrimaryKeys'] as $table => $count) echo "FAIL: {$table} has {$count} duplicate primary-key groups\n";
foreach ($report['relationships'] as $label => $count) echo ($count ? 'FAIL: ' : 'PASS: ') . $label . " ({$count} orphaned rows)\n";
echo "Read-only validation finished. No database records were changed. Report: tmp/database-readiness/summary.json\n";
exit($failed ? 1 : 0);
