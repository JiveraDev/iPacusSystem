<?php
// Database-backed regression: temporary tables only; run separately from npm test.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../../php/db.php';
require_once __DIR__ . '/../../php/role_access.php';
require_once __DIR__ . '/../../php/clinical_intake_storage.php';

if (!ipawcus_admin_feature_permissions_table_exists($pdo)) {
    throw new RuntimeException('Install the Admin access schema before running this database-backed test.');
}

try {
    $pdo->exec('CREATE TEMPORARY TABLE pet_catalog_options (species VARCHAR(50), breed VARCHAR(80))');
    $pdo->exec("INSERT INTO pet_catalog_options (species, breed) VALUES
        (' Dog ', ' Poodle '), ('dog', 'poodle'), ('Cat', 'Siamese'), ('', 'Unknown'), ('Dog', '')");
    ob_start();
    require __DIR__ . '/../../php/pet_catalog.php';
    $catalog = json_decode(ob_get_clean(), true, 512, JSON_THROW_ON_ERROR);
    if (($catalog['species'] ?? []) !== ['Cat', 'Dog']
        || ($catalog['breedsBySpecies']['Dog'] ?? []) !== ['Poodle']
        || ($catalog['breedsBySpecies']['Cat'] ?? []) !== ['Siamese']) {
        throw new RuntimeException('The catalog must read species/breed, trim values, and exclude blank/duplicate options.');
    }

    $pdo->exec('CREATE TEMPORARY TABLE admin_feature_permissions (user_id INT, feature_key VARCHAR(64), is_allowed TINYINT)');
    $pdo->exec("INSERT INTO admin_feature_permissions (user_id, feature_key, is_allowed) VALUES
        (910001, 'queue', 0), (910002, 'queue', 0), (910002, 'pet_intake', 1),
        (910003, 'queue', 1), (910003, 'pet_intake', 0)");
    $legacy = ipawcus_admin_feature_permissions($pdo, 910001);
    $intakeOnly = ipawcus_admin_feature_permissions($pdo, 910002);
    $queueOnly = ipawcus_admin_feature_permissions($pdo, 910003);
    if ($legacy['pet_intake'] !== false || $legacy['queue'] !== false) {
        throw new RuntimeException('Legacy Queue restrictions must still restrict intake until a separate choice is saved.');
    }
    if ($intakeOnly['pet_intake'] !== true || $intakeOnly['queue'] !== false
        || $queueOnly['pet_intake'] !== false || $queueOnly['queue'] !== true) {
        throw new RuntimeException('Saved Pet Intake and Queue choices must work independently.');
    }
    $pdo->exec("CREATE TEMPORARY TABLE clinical_intakes (
        intake_id INT PRIMARY KEY,
        chief_complaint TEXT, symptoms TEXT, major_symptoms TEXT, physical_exam TEXT,
        vital_signs LONGTEXT CHECK (JSON_VALID(vital_signs)),
        attachments LONGTEXT CHECK (JSON_VALID(attachments)),
        status ENUM('in_progress', 'completed') NOT NULL,
        completed_at DATETIME NULL
    ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci");
    $pdo->exec("INSERT INTO clinical_intakes (intake_id, status) VALUES (1, 'in_progress')");
    $fields = [
        'chief_complaint' => 'Synthetic patient: vomiting & reduced appetite',
        'symptoms' => 'Temperature 38.5°C',
        'major_symptoms' => '',
        'physical_exam' => 'Synthetic findings',
        'vital_signs' => json_encode(['temperature' => '38.5', 'weight' => '10']),
        'attachments' => json_encode([['fieldKey' => 'physicalExam', 'url' => 'diagnosis/synthetic.png']]),
    ];
    $originalCollation = (string)$pdo->query('SELECT @@collation_connection')->fetchColumn();
    if (!preg_match('/^[a-z0-9_]+$/i', $originalCollation)) throw new RuntimeException('Unexpected connection collation');
    try {
        foreach (['utf8mb4_general_ci', 'utf8mb4_unicode_ci'] as $collation) {
            $pdo->exec("SET collation_connection = '{$collation}'");
            clinical_intake_update($pdo, 1, 'in_progress', $fields);
            $draft = $pdo->query('SELECT * FROM clinical_intakes WHERE intake_id = 1')->fetch();
            if ($draft['status'] !== 'in_progress' || $draft['completed_at'] !== null
                || $draft['chief_complaint'] !== $fields['chief_complaint'] || $draft['symptoms'] !== $fields['symptoms']
                || $draft['vital_signs'] !== $fields['vital_signs'] || $draft['attachments'] !== $fields['attachments']) {
                throw new RuntimeException("Draft fields were not saved correctly with {$collation}");
            }
            clinical_intake_update($pdo, 1, 'completed', $fields);
            $completed = $pdo->query('SELECT status, completed_at FROM clinical_intakes WHERE intake_id = 1')->fetch();
            if ($completed['status'] !== 'completed' || !$completed['completed_at']) {
                throw new RuntimeException("Completion was not saved with {$collation}");
            }
            // Re-saving completion must retain its first completion time.
            $pdo->exec("UPDATE clinical_intakes SET completed_at = '2026-01-01 08:00:00' WHERE intake_id = 1");
            clinical_intake_update($pdo, 1, 'completed', $fields);
            if ($pdo->query('SELECT completed_at FROM clinical_intakes WHERE intake_id = 1')->fetchColumn() !== '2026-01-01 08:00:00') {
                throw new RuntimeException('Re-saving completion changed its original timestamp');
            }
        }
    } finally {
        $pdo->exec("SET collation_connection = '{$originalCollation}'");
    }
    echo "PASS: catalog, intake permissions, and draft/completion saves with matching/different collations; temporary tables only.\n";
} finally {
    $pdo->exec('DROP TEMPORARY TABLE IF EXISTS pet_catalog_options');
    $pdo->exec('DROP TEMPORARY TABLE IF EXISTS admin_feature_permissions');
    $pdo->exec('DROP TEMPORARY TABLE IF EXISTS clinical_intakes');
}
