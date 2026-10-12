<?php
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../../php/db.php';
require_once __DIR__ . '/../../php/grooming_helpers.php';
if (!in_array(strtolower(getenv('DB_HOST') ?: 'localhost'), ['localhost', '127.0.0.1', '::1'], true)) {
    fwrite(STDERR, "Run these temporary-table tests only on a local development database.\n"); exit(1);
}

// Temporary tables shadow permanent tables only on this connection. No real
// booking, user, photo, or job is inserted, updated, or deleted by these tests.
$temporarySchema = str_replace('CREATE TABLE IF NOT EXISTS', 'CREATE TEMPORARY TABLE', file_get_contents(__DIR__ . '/../../DDL/20260906_01_grooming_management.sql'));
// MySQL temporary tables cannot have foreign keys; the real migration retains them.
$temporarySchema = preg_replace('/,?\s*CONSTRAINT[^\r\n]+/', '', $temporarySchema);
foreach (explode(';', $temporarySchema) as $statement) {
    if (trim($statement) !== '') $pdo->exec($statement);
}
$pdo->exec('CREATE TEMPORARY TABLE bookings (booking_id INT PRIMARY KEY, user_id INT, branch_id INT, service_type VARCHAR(40), status VARCHAR(40), pet_id INT, unregistered_pet_name VARCHAR(100), notes TEXT)');
$pdo->exec('CREATE TEMPORARY TABLE pets_information (pet_id INT PRIMARY KEY, pet_name VARCHAR(100), pet_allergies VARCHAR(100), pet_status VARCHAR(40))');
$pdo->exec('CREATE TEMPORARY TABLE users (user_id INT PRIMARY KEY, preferred_branch_id INT, first_Name VARCHAR(100), last_Name VARCHAR(100))');
$pdo->exec('CREATE TEMPORARY TABLE user_branch_assignments (user_id INT, branch_id INT, is_active INT, is_primary INT)');
$passed = 0;
function dbcheck(bool $condition, string $label): void {
    global $passed;
    if (!$condition) throw new RuntimeException('FAIL: ' . $label);
    $passed++;
}
try {
    $pdo->beginTransaction();
    $pdo->exec("INSERT INTO bookings VALUES (901, 101, 1, 'grooming', 'confirmed', 201, NULL, 'Owner reference'); INSERT INTO pets_information VALUES (201, 'Test pet', 'Shampoo sensitivity', 'Healthy'); INSERT INTO users VALUES (101, 1, 'Maria', 'Santos'), (301, 1, 'Vet', 'One'), (302, 2, 'Vet', 'Two'), (303, 1, 'Vet', 'Three')");
    $admin = ['user_id' => 401, 'role' => 'super_admin', 'first_Name' => 'Clinic', 'last_Name' => 'Admin'];
    $booking = grooming_booking($pdo, 901, $admin, true);
    dbcheck($booking['grooming_owner_name'] === 'Maria Santos', 'Booking resolves the owner name for automatic pickup');
    dbcheck(grooming_default_pickup_person($booking, $admin) === 'Maria Santos', 'Pickup uses the resolved booking owner');
    $job = grooming_ensure_job($pdo, $booking, 401);
    dbcheck((int)$job['booking_id'] === 901 && $job['status'] === 'scheduled', 'Booking creates one scheduled job');
    $repeat = grooming_ensure_job($pdo, $booking, 401);
    dbcheck((int)$repeat['version'] === (int)$job['version'], 'Opening existing job does not duplicate or increment it');
    dbcheck((int)$pdo->query('SELECT COUNT(*) FROM grooming_jobs')->fetchColumn() === 1, 'Unique job identity');
    dbcheck((int)$pdo->query('SELECT COUNT(*) FROM grooming_events')->fetchColumn() === 1, 'Single creation event');
    dbcheck(json_decode($job['details_json'], true)['allergies'] === 'Shampoo sensitivity', 'Intake retains recorded allergy');
    $pdo->exec("INSERT INTO grooming_photos (booking_id, category, file_path, share_with_owner, uploaded_by) VALUES (901, 'before', 'grooming_photos/test-before.jpg', 1, 401), (901, 'concern', 'grooming_photos/test-concern.jpg', 1, 401), (901, 'after', 'grooming_photos/test-private.jpg', 0, 401)");
    $owner = ['user_id' => 101, 'role' => 'pet_owner'];
    dbcheck(!grooming_media_access($pdo, 'grooming_photos/test-before.jpg', $owner), 'Unpublished shared photo stays private');
    $pdo->exec('UPDATE grooming_jobs SET published_at = CURRENT_TIMESTAMP WHERE booking_id = 901');
    dbcheck(grooming_media_access($pdo, 'grooming_photos/test-before.jpg', $owner), 'Owner can view published shared photo');
    dbcheck(!grooming_media_access($pdo, 'grooming_photos/test-concern.jpg', $owner), 'Concern remains private even with sharing flag');
    dbcheck(!grooming_media_access($pdo, 'grooming_photos/test-private.jpg', $owner), 'Unselected photo remains private');
    dbcheck(!grooming_media_access($pdo, 'grooming_photos/test-before.jpg', ['user_id' => 102, 'role' => 'pet_owner']), 'Other owner denied');
    dbcheck(!grooming_media_access($pdo, 'grooming_photos/missing.jpg', $owner), 'Unknown path denied');
    dbcheck(grooming_media_access($pdo, 'grooming_photos/test-concern.jpg', $admin), 'Super admin can review clinic photo');
    $vet = ['user_id' => 301, 'role' => 'veterinarian'];
    dbcheck(!grooming_media_access($pdo, 'grooming_photos/test-concern.jpg', $vet), 'Branch vet still needs a review assignment');
    $pdo->exec("INSERT INTO grooming_reviews (booking_id, veterinarian_id, requested_by, reason) VALUES (901, 301, 401, 'Test concern'), (901, 302, 401, 'Wrong branch test')");
    dbcheck(grooming_media_access($pdo, 'grooming_photos/test-concern.jpg', $vet), 'Assigned branch vet can review concern');
    dbcheck(!grooming_media_access($pdo, 'grooming_photos/test-concern.jpg', ['user_id' => 302, 'role' => 'veterinarian']), 'Assignment cannot bypass branch boundary');
    dbcheck(!grooming_media_access($pdo, 'grooming_photos/test-concern.jpg', ['user_id' => 303, 'role' => 'veterinarian']), 'Another branch vet cannot access concern');
} finally {
    if ($pdo->inTransaction()) $pdo->rollBack();
}
echo "PASS: $passed grooming database regression checks using temporary tables. Permanent records were not changed.\n";
