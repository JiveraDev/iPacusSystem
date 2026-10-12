<?php

require_once __DIR__ . '/../../php/staff_activity_helpers.php';

function expect_activity(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

$directory = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'ipawcus-activity-test-' . bin2hex(random_bytes(6));
putenv('IPAWCUS_ACTIVITY_LOG_DIR=' . $directory);

try {
    $pdo = new PDO('sqlite::memory:');
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec('CREATE TABLE users (user_id INTEGER PRIMARY KEY, first_Name TEXT, last_Name TEXT, role TEXT, activity_log_file TEXT)');
    $pdo->exec('CREATE TABLE branches (branch_id INTEGER PRIMARY KEY, branch_name TEXT, status TEXT, branch_code TEXT)');
    $pdo->exec('CREATE TABLE user_branch_assignments (user_id INTEGER, branch_id INTEGER, is_active INTEGER)');
    $pdo->exec('CREATE TABLE pets_information (pet_id INTEGER PRIMARY KEY, pet_name TEXT)');
    $pdo->exec('CREATE TABLE bookings (booking_id INTEGER PRIMARY KEY, branch_id INTEGER, pet_id INTEGER, service_type TEXT, unregistered_pet_name TEXT)');
    $pdo->exec('CREATE TABLE visits (visit_id INTEGER PRIMARY KEY, branch_id INTEGER, pet_id INTEGER, source_type TEXT)');
    $pdo->exec('CREATE TABLE inventory_items (item_id INTEGER PRIMARY KEY, item_name TEXT)');
    $pdo->exec("INSERT INTO users VALUES (1, 'Ada', 'Admin', 'Admin', NULL), (2, 'Vera', 'Vet', 'Veterinarian', NULL), (3, 'Sam', 'Supervisor', 'Super Admin', NULL)");
    $pdo->exec("INSERT INTO branches VALUES (10, 'Main Clinic', 'active', 'MAIN'), (20, 'Enriquez', 'active', 'ENRIQUEZ')");
    $pdo->exec('INSERT INTO user_branch_assignments VALUES (1, 10, 1), (2, 20, 1)');
    $pdo->exec("INSERT INTO pets_information VALUES (5, 'Mochi')");
    $pdo->exec("INSERT INTO bookings VALUES (19, 20, 5, 'General Check-up', NULL)");
    $pdo->exec("INSERT INTO visits VALUES (31, 10, 5, 'manual')");
    $pdo->exec("INSERT INTO inventory_items VALUES (77, 'Rabies Vaccine'), (78, 'Surgical Gloves')");

    $admin = ['user_id' => 1, 'first_Name' => 'Ada', 'last_Name' => 'Admin', 'role' => 'Admin'];
    $vet = ['user_id' => 2, 'first_Name' => 'Vera', 'last_Name' => 'Vet', 'role' => 'Veterinarian'];
    $superAdmin = ['user_id' => 3, 'first_Name' => 'Sam', 'last_Name' => 'Supervisor', 'role' => 'Super Admin'];
    staff_activity_record($pdo, $admin, [
        'kind' => 'action',
        'key' => 'booking',
        'label' => 'Updated booking',
        'branch_id' => 10,
        'details' => [['label' => 'New status', 'value' => 'Confirmed']],
        'response_status' => 200,
        'planning_status' => 'planned',
        'planned_for' => '2099-01-02T02:00:00Z',
        'planning_basis' => 'Test future schedule',
    ]);
    usleep(1000);
    staff_activity_record($pdo, $vet, ['kind' => 'action', 'key' => 'booking', 'label' => 'Updated booking', 'branch_id' => 20]);
    usleep(1000);
    staff_activity_record($pdo, $superAdmin, [
        'kind' => 'action',
        'key' => 'accounts',
        'label' => 'Updated account',
        'branch_label' => 'Organization-wide',
    ]);

    $linkedPath = $pdo->query('SELECT activity_log_file FROM users WHERE user_id = 1')->fetchColumn();
    expect_activity($linkedPath === 'staff_activity/user-1.jsonl', 'The user must link to their own log file.');
    expect_activity(is_file($directory . DIRECTORY_SEPARATOR . '.htaccess'), 'The log directory must deny web access.');

    $own = staff_activity_list($pdo, ['user_id' => 1], 25, 0);
    expect_activity(
        count($own['activities']) === 1
        && $own['activities'][0]['branch_name'] === 'Main Clinic'
        && $own['activities'][0]['action_summary'] === 'New status: Confirmed'
        && $own['activities'][0]['response_status'] === 200,
        'The user history must be scoped, branch-aware, and retain safe action detail.'
    );
    $all = staff_activity_list($pdo, [], 1, 0);
    expect_activity(count($all['activities']) === 1 && $all['activities'][0]['actor_user_id'] === 3 && $all['hasMore'], 'The newest global event must include Super Admin activity and paginate.');
    expect_activity(count(staff_activity_list($pdo, ['user_id' => 3], 25, 0)['activities']) === 1, 'Super Admin must have personal history.');
    $branch = staff_activity_list($pdo, ['branch_id' => 20], 25, 0);
    expect_activity(count($branch['activities']) === 1 && $branch['activities'][0]['actor_user_id'] === 2, 'The branch filter must isolate events.');
    expect_activity(
        count(staff_activity_list($pdo, ['branch_scope' => 'organization'], 25, 0)['activities']) === 1,
        'The organization-wide filter must stay separate from clinic branch records.'
    );
    expect_activity(
        count(staff_activity_list($pdo, ['planning' => 'planned'], 25, 0)['activities']) === 1,
        'The planning filter must isolate actions recorded as planned in advance.'
    );
    $options = staff_activity_options($pdo);
    expect_activity(count($options['users']) === 3 && count($options['branches']) === 2, 'Filters must include all staff and branches.');
    expect_activity(staff_activity_request_branch($pdo, '/bookings/19/status', [], [], $vet) === 20, 'Booking actions must resolve the record branch.');
    $description = staff_activity_describe_mutation('/bookings/19/status', 'PATCH', []);
    expect_activity(
        $description['target_id'] === 19 && $description['path'] === '/bookings/:id/status'
        && $description['label'] === 'Changed booking status',
        'The action must have a useful label while hiding record IDs in its path.'
    );
    $detailedDescription = staff_activity_describe_mutation('/bookings/19/status', 'PATCH', [
        'status' => 'in-progress',
        'reason' => 'Private free-text explanation',
        'payment_reference' => 'PRIVATE-REFERENCE',
    ]);
    expect_activity(
        $detailedDescription['label'] === 'Changed booking status to In Progress'
        && $detailedDescription['summary'] === 'Reason: Private free-text explanation | New status: In Progress'
        && count($detailedDescription['details']) === 2
        && $detailedDescription['details'][0]['label'] === 'Reason',
        'Booking reasons must be visible while unrelated sensitive fields remain excluded.'
    );
    $inventoryInput = staff_activity_enrich_inventory_input($pdo, '/inventory/delete', [
        'item_id' => 77,
        'reason' => 'Duplicate catalog item',
    ]);
    $inventoryDescription = staff_activity_describe_mutation('/inventory/delete', 'POST', $inventoryInput);
    expect_activity(
        $inventoryDescription['summary'] === 'Product: Rabies Vaccine | Reason: Duplicate catalog item'
        && $inventoryDescription['details'][0]['label'] === 'Product'
        && $inventoryDescription['details'][1]['label'] === 'Reason',
        'Inventory activity must show the database product name and the confirmed reason.'
    );
    $bulkInventoryInput = staff_activity_enrich_inventory_input($pdo, '/inventory/delete', [
        'item_ids' => [77, 78],
        'reason' => 'Reset active inventory catalog',
    ]);
    $bulkInventoryDescription = staff_activity_describe_mutation('/inventory/delete', 'POST', $bulkInventoryInput);
    expect_activity(
        $bulkInventoryDescription['summary'] === 'Products: Rabies Vaccine, Surgical Gloves | Reason: Reset active inventory catalog',
        'Bulk inventory removal must record readable product names and the confirmed reason.'
    );
    $clinicalInput = staff_activity_enrich_clinical_input($pdo, '/bookings/19/status', ['status' => 'confirmed']);
    $clinicalDescription = staff_activity_describe_mutation('/bookings/19/status', 'PATCH', $clinicalInput);
    expect_activity(
        $clinicalDescription['summary'] === 'Patient: Mochi | Context: General Check Up | New status: Confirmed'
        && $clinicalDescription['target_label'] === 'Mochi — General Check Up'
        && count(array_filter($clinicalDescription['details'], static fn($detail) => str_contains((string)$detail['label'], 'ID'))) === 0,
        'Clinical activity must use a patient name and readable context without exposing record IDs.'
    );
    staff_activity_record($pdo, $admin, [
        'kind' => 'action',
        'key' => 'POST:/inventory/delete',
        'label' => 'Removed inventory item',
        'target_type' => 'inventory',
        'target_id' => 77,
        'branch_id' => 10,
    ]);
    expect_activity(
        count(staff_activity_list($pdo, ['module' => 'inventory'], 25, 0)['activities']) === 1,
        'The inventory module filter must focus the view without removing other recorded actions.'
    );
    staff_activity_record($pdo, $vet, [
        'kind' => 'action',
        'key' => 'POST:/vet-diagnoses',
        'label' => 'Saved diagnosis',
        'target_type' => 'vet-diagnoses',
        'target_label' => 'Mochi — General Check Up',
        'branch_id' => 20,
    ]);
    expect_activity(
        count(staff_activity_list($pdo, ['module' => 'diagnosis'], 25, 0)['activities']) === 1,
        'The diagnosis module filter must include diagnosis actions.'
    );
    $posInput = staff_activity_enrich_clinical_input($pdo, '/visits/31/payments', [
        'amount' => 850,
        'payment_method' => 'cash',
        'reference_number' => 'PRIVATE-PAYMENT-REFERENCE',
    ]);
    $posDescription = staff_activity_describe_mutation('/visits/31/payments', 'POST', $posInput);
    expect_activity(
        $posDescription['label'] === 'Recorded POS payment'
        && str_contains((string)$posDescription['target_label'], 'Mochi')
        && str_contains((string)$posDescription['target_label'], 'POS Payment')
        && str_contains((string)$posDescription['summary'], 'Patient: Mochi')
        && str_contains((string)$posDescription['summary'], 'Payment method: Cash')
        && !str_contains(json_encode($posDescription, JSON_THROW_ON_ERROR), 'PRIVATE-PAYMENT-REFERENCE'),
        'POS payment activity must use the patient name and safe payment details without storing a payment reference.'
    );
    staff_activity_record($pdo, $admin, $posDescription + ['branch_id' => 10]);
    expect_activity(
        count(staff_activity_list($pdo, ['module' => 'pos'], 25, 0)['activities']) === 1
        && count(staff_activity_list($pdo, ['module' => 'major'], 25, 0)['activities']) === 3,
        'Admin POS billing actions must appear in both the POS and major-operation filters.'
    );
    staff_activity_record($pdo, $vet, $posDescription + ['branch_id' => 20]);
    expect_activity(
        count(staff_activity_list($pdo, ['module' => 'pos'], 25, 0)['activities']) === 1,
        'Veterinarian POS mutations must stay outside the Admin and Super Admin POS audit focus.'
    );
    staff_activity_record($pdo, $superAdmin, $posDescription + ['branch_id' => 10]);
    expect_activity(
        count(staff_activity_list($pdo, ['module' => 'pos'], 25, 0)['activities']) === 2
        && count(staff_activity_list($pdo, ['module' => 'major'], 25, 0)['activities']) === 4,
        'Super Admin POS billing actions must appear in both the POS and major-operation filters.'
    );
    $groomingInput = staff_activity_enrich_clinical_input($pdo, '/grooming', [
        'bookingId' => 19,
        'action' => 'save',
        'status' => 'in_progress',
    ]);
    $groomingDescription = staff_activity_describe_mutation('/grooming', 'POST', $groomingInput);
    expect_activity(
        $groomingDescription['target_id'] === 19
        && str_contains((string)$groomingDescription['target_label'], 'Mochi')
        && !str_contains((string)$groomingDescription['target_label'], '19'),
        'New grooming activity must retain its internal booking link while displaying the pet name instead of the booking ID.'
    );
    staff_activity_record($pdo, $admin, [
        'kind' => 'action',
        'key' => 'POST:/grooming',
        'label' => 'Updated grooming workflow',
        'target_type' => 'grooming',
        'target_id' => 19,
        'target_label' => 'Grooming #19',
        'details' => [
            ['label' => 'Booking ID', 'value' => '19'],
            ['label' => 'New status', 'value' => 'In Progress'],
        ],
        'branch_id' => 20,
    ]);
    $groomingRows = array_values(array_filter(
        staff_activity_list($pdo, ['user_id' => 1], 250, 0)['activities'],
        static fn($entry) => ($entry['target_type'] ?? '') === 'grooming'
    ));
    expect_activity(
        count($groomingRows) === 1
        && str_contains((string)$groomingRows[0]['target_label'], 'Mochi')
        && !str_contains((string)$groomingRows[0]['target_label'], '19')
        && count(array_filter(
            $groomingRows[0]['action_details'],
            static fn($detail) => str_contains((string)($detail['label'] ?? ''), 'ID')
        )) === 0,
        'Existing grooming activity must resolve the pet name and remove raw ID details when it is read.'
    );
    expect_activity(
        count(staff_activity_list($pdo, ['module' => 'major'], 250, 0)['activities']) === 4,
        'Grooming actions must stay stored without appearing in the limited Activity Log.'
    );
    $petDescription = staff_activity_describe_mutation('/pet_information/PET-PRIVATE-123/status', 'PATCH', ['status' => 'active']);
    expect_activity(
        $petDescription['path'] === '/pet_information/:id/status',
        'Non-numeric pet identifiers must be hidden in normalized request paths.'
    );
    $plannedDescription = staff_activity_describe_mutation('/bookings', 'POST', [
        'booking_date' => '2099-01-02',
        'booking_time' => '10:00:00',
    ]);
    expect_activity(
        $plannedDescription['planning_status'] === 'planned'
        && $plannedDescription['planned_for'] !== null,
        'An action containing a future clinic schedule must be marked as planned in advance.'
    );
    $immediateDescription = staff_activity_describe_mutation('/queues/status', 'POST', ['status' => 'completed']);
    expect_activity(
        $immediateDescription['planning_status'] === 'not_planned',
        'An immediate action without a future schedule must be marked as not planned in advance.'
    );
    $pdo->exec('DELETE FROM users WHERE user_id = 2');
    expect_activity(count(staff_activity_list($pdo, ['user_id' => 2], 25, 0)['activities']) === 3, 'History must survive removal of a user record.');
    echo "Staff activity file tests passed.\n";
} finally {
    foreach (glob($directory . DIRECTORY_SEPARATOR . '*') ?: [] as $file) {
        if (is_file($file)) unlink($file);
    }
    if (is_file($directory . DIRECTORY_SEPARATOR . '.htaccess')) unlink($directory . DIRECTORY_SEPARATOR . '.htaccess');
    if (is_dir($directory)) rmdir($directory);
}
