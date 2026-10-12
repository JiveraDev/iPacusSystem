<?php
// Explicit local development setup only. Production uses the reviewed DDL migration.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../php/db.php';
if (!in_array(strtolower(getenv('DB_HOST') ?: 'localhost'), ['localhost', '127.0.0.1', '::1'], true)) {
    fwrite(STDERR, "Refusing automatic setup on a non-local database. Apply the reviewed grooming DDL through your deployment process.\n");
    exit(1);
}
if (($argv[1] ?? '') !== '--apply') {
    fwrite(STDERR, "Use php scripts/setup-grooming.php --apply to add grooming tables to the configured local database.\n");
    exit(1);
}
$migration = file_get_contents(__DIR__ . '/../DDL/20260906_01_grooming_management.sql');
foreach (explode(';', $migration) as $statement) {
    if (trim($statement) !== '') $pdo->exec($statement);
}
echo "Grooming tables are ready in the local database. Existing bookings and other records were not changed.\n";
