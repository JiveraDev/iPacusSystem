<?php

if (PHP_SAPI !== 'cli') {
    exit(2);
}

require_once dirname(__DIR__, 2) . '/php/system_backup_excel.php';

$outputPath = (string)($argv[1] ?? '');
if ($outputPath === '' || strtolower(pathinfo($outputPath, PATHINFO_EXTENSION)) !== 'xlsx') {
    fwrite(STDERR, "Usage: php scripts/tests/system-backup-smoke.php <output.xlsx>\n");
    exit(2);
}

$pdo = new PDO('sqlite::memory:');
$backup = [
    'createdAt' => gmdate(DATE_ATOM),
    'type' => 'complete',
    'reference' => 'smoke-test',
];
$sheets = [[
    'title' => 'Read Me',
    'headers' => ['Item', 'Explanation'],
    'rows' => static function (): Generator {
        yield ['Workbook purpose', 'Package and worksheet compatibility smoke test.'];
        yield ['Sensitive information', 'Test data only.'];
    },
    'validations' => [],
], [
    'title' => 'Offline Entries',
    'headers' => ['Entry ID', 'Module', 'Status'],
    'rows' => static function (): Generator {
        yield ['OFF-0001', 'Queue', 'New'];
        yield ['OFF-0002', '', ''];
    },
    'validations' => [
        ['column' => 2, 'from' => 2, 'to' => 3, 'values' => ['Queue', 'Booking', 'Diagnosis']],
        ['column' => 3, 'from' => 2, 'to' => 3, 'values' => ['New', 'Completed']],
    ],
    'editable' => true,
]];
$result = ipawcus_create_workbook_from_definitions($pdo, $outputPath, $backup, $sheets);

fwrite(STDOUT, json_encode([
    'workbook' => $result,
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");
