<?php
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
// Read-only deployment preflight. Never installs tables or creates files.
require_once __DIR__ . '/../../php/db.php';
require_once __DIR__ . '/../../php/grooming_media.php';

echo in_array(strtolower(getenv('DB_HOST') ?: 'localhost'), ['localhost', '127.0.0.1', '::1'], true) ? "Database connection: local host.\n" : "Database connection: non-local host (read-only check).\n";
foreach ([
    'bookings' => ['booking_id', 'booking_number', 'branch_id', 'user_id', 'pet_id', 'booking_date', 'booking_time', 'service_type', 'status', 'unregistered_pet_name', 'price'],
    'pets_information' => ['pet_id', 'pet_name', 'pet_allergies', 'pet_status'],
    'branches' => ['branch_id', 'branch_name'],
    'users' => ['user_id', 'first_Name', 'last_Name'],
    'visits' => ['visit_id', 'booking_id', 'visit_status'],
    'visit_charges' => ['visit_id', 'quantity', 'unit_price'],
] as $table => $columns) {
    $pdo->query('SELECT ' . implode(', ', $columns) . ' FROM ' . $table . ' WHERE 1 = 0');
    echo "PASS: $table prerequisite columns.\n";
}
$missing = false;
foreach ([
    'grooming_jobs' => ['booking_id', 'status', 'performed_by', 'details_json', 'version', 'published_at', 'visit_id', 'created_at', 'updated_at', 'updated_by'],
    'grooming_reviews' => ['review_id', 'booking_id', 'veterinarian_id', 'requested_by', 'reason', 'outcome', 'review_notes', 'created_at', 'reviewed_at'],
    'grooming_photos' => ['photo_id', 'booking_id', 'category', 'caption', 'file_path', 'share_with_owner', 'uploaded_by', 'created_at'],
    'grooming_events' => ['event_id', 'booking_id', 'actor_id', 'action', 'details_json', 'created_at'],
] as $table => $columns) {
    try {
        // Check real engine access and every required column, not just metadata.
        $pdo->query('SELECT ' . implode(', ', $columns) . ' FROM ' . $table . ' WHERE 1 = 0');
        echo "PASS: $table is readable with all required columns.\n";
    } catch (PDOException $error) {
        echo "SETUP/REPAIR REQUIRED: $table (database error " . (int)($error->errorInfo[1] ?? 0) . ").\n";
        $missing = true;
    }
}
try {
    $directory = grooming_photo_directory();
    $storageReady = is_dir($directory) && is_writable($directory);
    echo $storageReady ? "PASS: private photo directory is writable.\n" : "SETUP REQUIRED: create the configured private photo directory with PHP write access.\n";
    $missing = $missing || !$storageReady;
} catch (Throwable $error) { echo "SETUP REQUIRED: configure IPAWCUS_GROOMING_MEDIA_ROOT outside the website folder.\n"; $missing = true; }
echo "Read-only preflight finished. Nothing was installed or modified.\n";
exit($missing ? 1 : 0);
