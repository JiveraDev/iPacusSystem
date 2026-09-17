<?php

require_once __DIR__ . '/system_backup_zip.php';

const IPAWCUS_BACKUP_EXCEL_MAX_ROWS = 250000;

function ipawcus_backup_excel_escape(string $value): string
{
    if (preg_match('//u', $value) !== 1) {
        $value = function_exists('iconv') ? (string)iconv('UTF-8', 'UTF-8//IGNORE', $value) : '';
    }
    $value = preg_replace('/[^\P{C}\t\r\n]/u', '', $value) ?? '';
    if (strlen($value) > 32767) {
        $value = function_exists('mb_strcut')
            ? mb_strcut($value, 0, 32700, 'UTF-8')
            : substr($value, 0, 32700);
        $value .= ' ... [truncated in Excel; complete value remains in database.sql]';
    }
    return htmlspecialchars($value, ENT_XML1 | ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function ipawcus_backup_excel_column_name(int $index): string
{
    $name = '';
    while ($index > 0) {
        $index--;
        $name = chr(65 + ($index % 26)) . $name;
        $index = intdiv($index, 26);
    }
    return $name;
}

function ipawcus_backup_excel_table_exists(PDO $pdo, string $table): bool
{
    $stmt = $pdo->prepare('SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?');
    $stmt->execute([$table]);
    return (int)$stmt->fetchColumn() > 0;
}

function ipawcus_backup_excel_columns(PDO $pdo, string $table): array
{
    if (!preg_match('/^[A-Za-z0-9_]+$/', $table) || !ipawcus_backup_excel_table_exists($pdo, $table)) {
        return [];
    }
    $stmt = $pdo->query('SHOW COLUMNS FROM `' . $table . '`');
    return array_map(static fn(array $row): string => (string)$row['Field'], $stmt->fetchAll(PDO::FETCH_ASSOC));
}

function ipawcus_backup_excel_has_columns(PDO $pdo, string $table, array $columns): bool
{
    $existing = ipawcus_backup_excel_columns($pdo, $table);
    return count(array_intersect($columns, $existing)) === count($columns);
}

function ipawcus_backup_excel_rows(PDO $pdo, string $sql): Generator
{
    $stmt = $pdo->query($sql);
    $count = 0;
    while (($row = $stmt->fetch(PDO::FETCH_ASSOC)) !== false && $count < IPAWCUS_BACKUP_EXCEL_MAX_ROWS) {
        yield array_values($row);
        $count++;
    }
    $stmt->closeCursor();
}

function ipawcus_backup_excel_query_sheet(string $title, array $headers, string $sql, array $options = []): array
{
    return [
        'title' => $title,
        'headers' => $headers,
        'rows' => static fn(PDO $pdo): Generator => ipawcus_backup_excel_rows($pdo, $sql),
        'validations' => $options['validations'] ?? [],
        'blankRows' => $options['blankRows'] ?? 0,
    ];
}

function ipawcus_backup_excel_message_sheet(string $title, string $message): array
{
    return [
        'title' => $title,
        'headers' => ['Status'],
        'rows' => static function () use ($message): Generator {
            yield [$message];
        },
        'validations' => [],
        'blankRows' => 0,
    ];
}

function ipawcus_backup_excel_raw_sheet(PDO $pdo, string $title, string $table, array $preferredColumns, string $where = '', string $orderBy = ''): array
{
    $available = ipawcus_backup_excel_columns($pdo, $table);
    if (!$available) {
        return ipawcus_backup_excel_message_sheet($title, 'This module is not installed in the current database.');
    }

    $columns = array_values(array_intersect($preferredColumns, $available));
    if (!$columns) {
        $columns = $available;
    }
    $select = implode(', ', array_map(static fn(string $column): string => '`' . $column . '`', $columns));
    $headers = array_map('ipawcus_backup_excel_heading', $columns);
    if ($orderBy !== '') {
        preg_match_all('/\b[A-Za-z_][A-Za-z0-9_]*\b/', $orderBy, $matches);
        $reserved = ['ORDER', 'BY', 'ASC', 'DESC'];
        $orderColumns = array_values(array_filter($matches[0] ?? [], static fn(string $word): bool => !in_array(strtoupper($word), $reserved, true)));
        if (array_diff($orderColumns, $available)) {
            $orderBy = '';
        }
    }
    $sql = 'SELECT ' . $select . ' FROM `' . $table . '`' . $where . $orderBy . ' LIMIT ' . IPAWCUS_BACKUP_EXCEL_MAX_ROWS;
    return ipawcus_backup_excel_query_sheet($title, $headers, $sql);
}

function ipawcus_backup_excel_heading(string $column): string
{
    $headings = [
        'id' => 'ID', 'user_id' => 'User ID', 'pet_id' => 'Pet ID', 'booking_id' => 'Booking ID',
        'queue_id' => 'Queue ID', 'diagnosis_id' => 'Diagnosis ID', 'visit_id' => 'Visit ID',
        'review_id' => 'Review ID', 'queue_number' => 'Queue Number', 'booking_number' => 'Booking Number',
        'pet_name' => 'Pet Name', 'pet_species' => 'Species', 'pet_breed' => 'Breed',
        'pet_BDAY' => 'Birth Date', 'pet_status' => 'Pet Status', 'pet_gender' => 'Sex / Gender',
        'pet_weight' => 'Weight', 'pet_microchip' => 'Microchip ID', 'pet_Temp_owner' => 'Temporary Owner',
        'pet_allergies' => 'Allergies', 'pet_color_marking' => 'Color / Markings',
        'first_Name' => 'First Name', 'last_Name' => 'Last Name', 'mail_Address' => 'Email Address',
        'personal_Address' => 'Address', 'emergencyNumber' => 'Emergency Number', 'phoneNumber' => 'Phone Number',
        'chief_complaint' => 'Chief Complaint', 'major_symptoms' => 'Major Symptoms',
        'physical_exam' => 'Physical Examination', 'lab_results' => 'Lab Results',
        'follow_up_date' => 'Follow-up Date', 'review_notes' => 'Assessment / Instructions',
        'performed_by_name' => 'Performed By', 'created_at' => 'Created At', 'updated_at' => 'Updated At',
        'finalized_at' => 'Finalized At', 'reviewed_at' => 'Reviewed At', 'payment_method' => 'Payment Method',
        'payment_status' => 'Payment Status', 'reference_number' => 'Reference Number',
    ];
    if (isset($headings[$column])) {
        return $headings[$column];
    }
    return ucwords(str_replace('_', ' ', preg_replace('/([a-z])([A-Z])/', '$1 $2', $column) ?? $column));
}

function ipawcus_backup_excel_definitions(PDO $pdo, array $backup): array
{
    $createdAt = (string)($backup['createdAt'] ?? date(DATE_ATOM));
    $type = ($backup['type'] ?? 'complete') === 'changes' ? 'Changes Backup' : 'Complete Backup';
    $sheets = [[
        'title' => 'Read Me',
        'headers' => ['Item', 'Explanation'],
        'rows' => static function () use ($createdAt, $type, $backup): Generator {
            yield ['Workbook purpose', 'Readable emergency operations snapshot. It is not a replacement for database.sql.'];
            yield ['Created', $createdAt];
            yield ['Backup type', $type];
            yield ['Backup reference', (string)($backup['reference'] ?? '')];
            yield ['How to use', 'Use filters in each sheet to review the latest saved clinic information during an outage.'];
            yield ['Offline entries', 'Record temporary outage work only in the Offline Entries sheet. Do not edit the saved source lists.'];
            yield ['Reconciliation', 'When iPawcus returns, review offline entries before entering them into the live system. Automatic re-import is not enabled.'];
            yield ['Sensitive information', 'Store this workbook securely. It contains confidential clinic and client information.'];
            yield ['Passwords', 'Account password hashes are intentionally excluded from the readable workbook. They remain protected inside database.sql for recovery.'];
            yield ['Worksheet limit', 'Operational worksheets contain up to 250,000 rows. database.sql remains the complete recovery source.'];
        },
        'validations' => [],
        'blankRows' => 0,
    ]];

    if (
        ipawcus_backup_excel_has_columns($pdo, 'queues', ['queue_id', 'pet_id', 'user_id', 'booking_id', 'service_name', 'queue_number', 'status', 'priority', 'complaint', 'queue_source', 'verified_by_admin', 'timestamp'])
        && ipawcus_backup_excel_has_columns($pdo, 'pets_information', ['pet_id', 'pet_name'])
        && ipawcus_backup_excel_has_columns($pdo, 'users', ['user_id', 'first_Name', 'last_Name'])
    ) {
        $sql = "SELECT q.queue_id, q.queue_number, q.pet_id, COALESCE(p.pet_name, 'Pet') AS pet_name,
                       q.user_id AS owner_user_id, TRIM(CONCAT(COALESCE(u.first_Name, ''), ' ', COALESCE(u.last_Name, ''))) AS owner_name,
                       q.booking_id, q.service_name, q.status, q.priority, q.complaint, q.queue_source, q.verified_by_admin, q.timestamp
                FROM queues q
                LEFT JOIN pets_information p ON p.pet_id = q.pet_id
                LEFT JOIN users u ON u.user_id = q.user_id
                WHERE LOWER(COALESCE(q.status, '')) NOT IN ('completed', 'cancelled')
                ORDER BY q.priority = 'urgent' DESC, q.queue_number ASC
                LIMIT " . IPAWCUS_BACKUP_EXCEL_MAX_ROWS;
        $sheets[] = ipawcus_backup_excel_query_sheet('Current Queue', [
            'Queue ID', 'Queue Number', 'Pet ID', 'Pet Name', 'Owner User ID', 'Owner Name', 'Booking ID',
            'Service', 'Status', 'Priority', 'Concern / Complaint', 'Source', 'Admin Verified', 'Queued At'
        ], $sql);
    } else {
        $sheets[] = ipawcus_backup_excel_raw_sheet($pdo, 'Current Queue', 'queues', [
            'queue_id', 'queue_number', 'pet_id', 'user_id', 'booking_id', 'service_name', 'status', 'priority', 'complaint', 'queue_source', 'timestamp'
        ]);
    }

    if (
        ipawcus_backup_excel_has_columns($pdo, 'bookings', ['booking_id', 'user_id', 'pet_id', 'booking_number', 'service_type', 'booking_date', 'booking_time', 'status', 'unregistered_pet_name', 'veterinarian_id', 'price', 'payment_method', 'payment_reference', 'notes', 'created_at'])
        && ipawcus_backup_excel_has_columns($pdo, 'pets_information', ['pet_id', 'pet_name'])
        && ipawcus_backup_excel_has_columns($pdo, 'users', ['user_id', 'first_Name', 'last_Name'])
    ) {
        $sql = "SELECT b.booking_id, b.booking_number, b.booking_date, b.booking_time, b.status, b.service_type,
                       b.pet_id, COALESCE(p.pet_name, b.unregistered_pet_name, 'Pet') AS pet_name,
                       b.user_id AS owner_user_id, TRIM(CONCAT(COALESCE(u.first_Name, ''), ' ', COALESCE(u.last_Name, ''))) AS owner_name,
                       b.veterinarian_id, b.price, b.payment_method, b.payment_reference, b.notes, b.created_at
                FROM bookings b
                LEFT JOIN pets_information p ON p.pet_id = b.pet_id
                LEFT JOIN users u ON u.user_id = b.user_id
                WHERE LOWER(COALESCE(b.status, '')) NOT IN ('completed', 'cancelled')
                ORDER BY b.booking_date ASC, b.booking_time ASC
                LIMIT " . IPAWCUS_BACKUP_EXCEL_MAX_ROWS;
        $sheets[] = ipawcus_backup_excel_query_sheet('Active Bookings', [
            'Booking ID', 'Booking Number', 'Date', 'Time', 'Status', 'Service', 'Pet ID', 'Pet Name',
            'Owner User ID', 'Owner Name', 'Veterinarian ID', 'Price', 'Payment Method', 'Payment Reference', 'Notes', 'Created At'
        ], $sql);
    } else {
        $sheets[] = ipawcus_backup_excel_raw_sheet($pdo, 'Active Bookings', 'bookings', [
            'booking_id', 'booking_number', 'booking_date', 'booking_time', 'status', 'service_type', 'pet_id', 'user_id', 'veterinarian_id', 'price', 'notes', 'created_at'
        ]);
    }

    $sheets[] = ipawcus_backup_excel_raw_sheet($pdo, 'Pet Directory', 'pets_information', [
        'pet_id', 'pet_sharable_ID', 'pet_name', 'pet_species', 'pet_breed', 'pet_BDAY', 'pet_status',
        'pet_gender', 'pet_weight', 'pet_microchip', 'pet_Temp_owner', 'pet_allergies', 'pet_color_marking', 'pet_age'
    ], '', ' ORDER BY pet_name ASC');

    $sheets[] = ipawcus_backup_excel_raw_sheet($pdo, 'People Directory', 'users', [
        'user_id', 'first_Name', 'last_Name', 'mail_Address', 'personal_Address', 'emergencyNumber',
        'phoneNumber', 'role', 'account_status', 'deactivated_at', 'created_at', 'last_seen_at', 'birthdate'
    ], '', ' ORDER BY last_Name ASC, first_Name ASC');

    $sheets[] = ipawcus_backup_excel_raw_sheet($pdo, 'Diagnoses', 'vet_diagnoses', [
        'diagnosis_id', 'queue_id', 'booking_id', 'pet_id', 'veterinarian_user_id', 'veterinarian_name',
        'diagnosis_type', 'service_name', 'chief_complaint', 'major_symptoms', 'symptoms', 'physical_exam',
        'diagnosis', 'treatment', 'lab_results', 'follow_up_date', 'notes', 'vital_signs', 'prescriptions',
        'custom_sections', 'finalized_at', 'created_at', 'updated_at'
    ], '', ' ORDER BY finalized_at DESC');

    $sheets[] = ipawcus_backup_excel_raw_sheet($pdo, 'Grooming Reviews', 'grooming_reviews', [
        'review_id', 'booking_id', 'veterinarian_id', 'requested_by', 'reason', 'outcome', 'review_notes', 'created_at', 'reviewed_at'
    ], '', ' ORDER BY created_at DESC');

    $sheets[] = ipawcus_backup_excel_raw_sheet($pdo, 'Grooming Jobs', 'grooming_jobs', [
        'booking_id', 'status', 'performed_by', 'details_json', 'version', 'published_at', 'visit_id', 'created_at', 'updated_at', 'updated_by'
    ], '', ' ORDER BY updated_at DESC');

    $sheets[] = ipawcus_backup_excel_raw_sheet($pdo, 'Grooming Photos', 'grooming_photos', [
        'photo_id', 'booking_id', 'category', 'caption', 'file_path', 'share_with_owner', 'uploaded_by', 'created_at'
    ], '', ' ORDER BY created_at DESC');

    $sheets[] = ipawcus_backup_excel_raw_sheet($pdo, 'Boarding Stays', 'boarding_assignments', [
        'assignment_id', 'booking_id', 'pet_id', 'room_type', 'room_number', 'status', 'check_in_date',
        'desired_check_out_date', 'actual_check_out_date', 'assigned_by_user_id', 'created_at', 'updated_at'
    ], '', ' ORDER BY created_at DESC');

    $sheets[] = ipawcus_backup_excel_raw_sheet($pdo, 'Boarding Tasks', 'boarding_tasks', [
        'task_id', 'assignment_id', 'booking_id', 'pet_id', 'room_type', 'room_number', 'task_type',
        'due_at', 'status', 'assigned_to', 'notes', 'completed_at', 'created_by_user_id', 'created_at', 'updated_at'
    ], '', ' ORDER BY due_at ASC');

    if (ipawcus_backup_excel_has_columns($pdo, 'inventory_items', ['item_id', 'item_name', 'generic_name', 'sku', 'category', 'brand', 'unit', 'reorder_level', 'unit_cost', 'status', 'location_id', 'updated_at'])) {
        $batchJoin = ipawcus_backup_excel_has_columns($pdo, 'inventory_batches', ['item_id', 'quantity', 'expiry_date'])
            ? 'LEFT JOIN inventory_batches b ON b.item_id = i.item_id'
            : '';
        $quantity = $batchJoin ? 'COALESCE(SUM(b.quantity), 0)' : 'NULL';
        $expiry = $batchJoin ? 'MIN(CASE WHEN b.quantity > 0 THEN b.expiry_date END)' : 'NULL';
        $sql = "SELECT i.item_id, i.item_name, i.generic_name, i.sku, i.category, i.brand, i.unit,
                       {$quantity} AS total_quantity, i.reorder_level, {$expiry} AS nearest_expiry,
                       i.unit_cost, i.status, i.location_id, i.updated_at
                FROM inventory_items i {$batchJoin}
                GROUP BY i.item_id, i.item_name, i.generic_name, i.sku, i.category, i.brand, i.unit,
                         i.reorder_level, i.unit_cost, i.status, i.location_id, i.updated_at
                ORDER BY i.item_name ASC LIMIT " . IPAWCUS_BACKUP_EXCEL_MAX_ROWS;
        $sheets[] = ipawcus_backup_excel_query_sheet('Inventory', [
            'Item ID', 'Item Name', 'Generic Name', 'SKU', 'Category', 'Brand', 'Unit', 'Total Quantity',
            'Reorder Level', 'Nearest Expiry', 'Unit Cost', 'Status', 'Location ID', 'Updated At'
        ], $sql);
    } else {
        $sheets[] = ipawcus_backup_excel_raw_sheet($pdo, 'Inventory', 'inventory_items', ['item_id', 'item_name', 'sku', 'category', 'unit', 'reorder_level', 'unit_cost', 'status', 'updated_at']);
    }

    $sheets[] = ipawcus_backup_excel_raw_sheet($pdo, 'Inventory Stock', 'inventory_batches', [
        'batch_id', 'item_id', 'batch_number', 'quantity', 'expiry_date', 'unit_cost', 'supplier_id',
        'location_id', 'created_at', 'updated_at'
    ], '', ' ORDER BY expiry_date ASC');

    $sheets[] = ipawcus_backup_excel_raw_sheet($pdo, 'Visits', 'visits', [
        'visit_id', 'pet_id', 'owner_user_id', 'veterinarian_user_id', 'queue_id', 'booking_id', 'diagnosis_id',
        'source_type', 'visit_status', 'billing_status', 'created_at', 'updated_at'
    ], '', ' ORDER BY created_at DESC');

    $sheets[] = ipawcus_backup_excel_raw_sheet($pdo, 'Visit Charges', 'visit_charges', [
        'charge_id', 'visit_id', 'charge_type', 'service_id', 'item_id', 'description', 'quantity',
        'unit_price', 'subtotal', 'created_by_user_id', 'created_at', 'updated_at'
    ], '', ' ORDER BY created_at DESC');

    $sheets[] = ipawcus_backup_excel_raw_sheet($pdo, 'Payments', 'visit_payments', [
        'payment_id', 'visit_id', 'payment_method', 'payment_status', 'amount', 'reference_number', 'notes',
        'paid_at', 'received_by_user_id', 'received_by_name', 'created_at', 'updated_at'
    ], '', ' ORDER BY created_at DESC');

    $sheets[] = ipawcus_backup_excel_raw_sheet($pdo, 'Invoice Documents', 'visit_invoice_documents', [
        'invoice_document_id', 'invoice_number', 'visit_id', 'payment_id', 'pet_id', 'file_path', 'file_name',
        'mime_type', 'paper_width', 'created_by_user_id', 'created_by_name', 'created_at'
    ], '', ' ORDER BY created_at DESC');

    $sheets[] = ipawcus_backup_excel_action_sheet($pdo);

    $sheets[] = [
        'title' => 'Offline Entries',
        'headers' => [
            'Offline Entry ID', 'Recorded At', 'Module', 'Reference ID', 'Pet ID', 'Pet Name', 'Owner Name',
            'Action / Diagnosis', 'Status', 'Notes', 'Entered By', 'Reconciled'
        ],
        'rows' => static function (): Generator {
            for ($index = 1; $index <= 250; $index++) {
                yield [sprintf('OFF-%04d', $index), '', '', '', '', '', '', '', 'New', '', '', 'No'];
            }
        },
        'validations' => [
            ['column' => 3, 'from' => 2, 'to' => 251, 'values' => ['Queue', 'Booking', 'Diagnosis', 'Grooming', 'Inventory', 'Payment']],
            ['column' => 9, 'from' => 2, 'to' => 251, 'values' => ['New', 'In progress', 'Completed', 'Cancelled']],
            ['column' => 12, 'from' => 2, 'to' => 251, 'values' => ['No', 'Yes']],
        ],
        'editable' => true,
        'blankRows' => 250,
    ];

    return $sheets;
}

function ipawcus_backup_excel_action_sheet(PDO $pdo): array
{
    $sources = [];
    if (ipawcus_backup_excel_has_columns($pdo, 'inventory_action_audit', ['inventory_audit_id', 'item_id', 'action_type', 'performed_by_user_id', 'performed_by_name', 'reason', 'created_at'])) {
        $sources[] = "SELECT 'Inventory' AS source_module, inventory_audit_id AS event_id, item_id AS record_id,
                             action_type AS action_name, performed_by_user_id AS actor_user_id,
                             performed_by_name AS actor_name, reason AS details, created_at AS event_time
                      FROM inventory_action_audit";
    }
    if (ipawcus_backup_excel_has_columns($pdo, 'grooming_events', ['event_id', 'booking_id', 'actor_id', 'action', 'details_json', 'created_at'])) {
        $sources[] = "SELECT 'Grooming' AS source_module, event_id, booking_id AS record_id,
                             action AS action_name, actor_id AS actor_user_id, '' AS actor_name,
                             details_json AS details, created_at AS event_time FROM grooming_events";
    }
    if (ipawcus_backup_excel_has_columns($pdo, 'pet_record_update_request_events', ['event_id', 'request_id', 'event_type', 'actor_user_id', 'note', 'created_at'])) {
        $sources[] = "SELECT 'Record Update' AS source_module, event_id, request_id AS record_id,
                             event_type AS action_name, actor_user_id, '' AS actor_name,
                             note AS details, created_at AS event_time FROM pet_record_update_request_events";
    }

    if (!$sources) {
        return ipawcus_backup_excel_message_sheet('Action Log', 'No supported audit-log tables are installed.');
    }

    $sql = 'SELECT * FROM (' . implode(' UNION ALL ', $sources) . ') backup_actions ORDER BY event_time DESC LIMIT ' . IPAWCUS_BACKUP_EXCEL_MAX_ROWS;
    return ipawcus_backup_excel_query_sheet('Action Log', [
        'Module', 'Event ID', 'Record ID', 'Action', 'Actor User ID', 'Actor Name', 'Details', 'Date / Time'
    ], $sql);
}

function ipawcus_create_emergency_workbook(PDO $pdo, string $path, array $backup): array
{
    $sheets = ipawcus_backup_excel_definitions($pdo, $backup);
    return ipawcus_create_workbook_from_definitions($pdo, $path, $backup, $sheets);
}

function ipawcus_create_workbook_from_definitions(PDO $pdo, string $path, array $backup, array $sheets): array
{
    $temporaryFiles = [];
    $zip = new IpawcusStreamingZipWriter($path);

    try {
        $zip->addString('[Content_Types].xml', ipawcus_backup_excel_content_types(count($sheets)));
        $zip->addString('_rels/.rels', ipawcus_backup_excel_root_relationships());
        $zip->addString('docProps/app.xml', ipawcus_backup_excel_app_properties($sheets));
        $zip->addString('docProps/core.xml', ipawcus_backup_excel_core_properties((string)($backup['createdAt'] ?? date(DATE_ATOM))));
        $zip->addString('xl/workbook.xml', ipawcus_backup_excel_workbook($sheets));
        $zip->addString('xl/_rels/workbook.xml.rels', ipawcus_backup_excel_workbook_relationships(count($sheets)));
        $zip->addString('xl/styles.xml', ipawcus_backup_excel_styles());

        $rowCounts = [];
        foreach ($sheets as $index => $sheet) {
            $temporaryPath = tempnam(dirname($path), 'sheet-');
            if ($temporaryPath === false) {
                throw new RuntimeException('A temporary Excel worksheet could not be created.');
            }
            $temporaryFiles[] = $temporaryPath;
            $rowCounts[$sheet['title']] = ipawcus_backup_excel_write_sheet($pdo, $temporaryPath, $sheet);
            $zip->addFile('xl/worksheets/sheet' . ($index + 1) . '.xml', $temporaryPath);
        }

        $zip->close();
        return ['sheetCount' => count($sheets), 'rowCounts' => $rowCounts];
    } finally {
        foreach ($temporaryFiles as $temporaryPath) {
            if (is_file($temporaryPath)) {
                @unlink($temporaryPath);
            }
        }
    }
}

function ipawcus_backup_excel_write_sheet(PDO $pdo, string $path, array $sheet): int
{
    $handle = fopen($path, 'wb');
    if ($handle === false) {
        throw new RuntimeException('An Excel worksheet could not be written.');
    }

    $headers = $sheet['headers'];
    $lastColumn = ipawcus_backup_excel_column_name(max(1, count($headers)));
    $write = static function ($handle, string $value): void {
        if (fwrite($handle, $value) === false) {
            throw new RuntimeException('An Excel worksheet could not be written completely.');
        }
    };

    try {
        $write($handle, '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>');
        $write($handle, '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">');
        $write($handle, '<sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>');
        $write($handle, '<sheetFormatPr defaultRowHeight="15"/>');
        $write($handle, '<cols>');
        foreach ($headers as $index => $header) {
            $width = max(12, min(36, strlen((string)$header) + 5));
            $column = $index + 1;
            $write($handle, '<col min="' . $column . '" max="' . $column . '" width="' . $width . '" customWidth="1"/>');
        }
        $write($handle, '</cols><sheetData>');
        $write($handle, '<row r="1" ht="24" customHeight="1">');
        foreach ($headers as $index => $header) {
            $reference = ipawcus_backup_excel_column_name($index + 1) . '1';
            $write($handle, '<c r="' . $reference . '" t="inlineStr" s="1"><is><t>' . ipawcus_backup_excel_escape((string)$header) . '</t></is></c>');
        }
        $write($handle, '</row>');

        $rowNumber = 2;
        $rows = $sheet['rows']($pdo);
        foreach ($rows as $row) {
            $write($handle, '<row r="' . $rowNumber . '">');
            foreach ($headers as $index => $_header) {
                $reference = ipawcus_backup_excel_column_name($index + 1) . $rowNumber;
                $value = $row[$index] ?? '';
                $text = $value === null ? '' : (is_bool($value) ? ($value ? 'Yes' : 'No') : (string)$value);
                $bodyStyle = !empty($sheet['editable']) ? 3 : 2;
                $write($handle, '<c r="' . $reference . '" t="inlineStr" s="' . $bodyStyle . '"><is><t xml:space="preserve">' . ipawcus_backup_excel_escape($text) . '</t></is></c>');
            }
            $write($handle, '</row>');
            $rowNumber++;
        }
        $write($handle, '</sheetData>');

        $filterEnd = max(1, $rowNumber - 1);
        $write($handle, '<autoFilter ref="A1:' . $lastColumn . $filterEnd . '"/>');
        $validations = $sheet['validations'] ?? [];
        if ($validations) {
            $write($handle, '<dataValidations count="' . count($validations) . '">');
            foreach ($validations as $validation) {
                $column = ipawcus_backup_excel_column_name((int)$validation['column']);
                $values = implode(',', array_map(static fn($value): string => str_replace('"', '""', (string)$value), $validation['values']));
                $range = $column . (int)$validation['from'] . ':' . $column . (int)$validation['to'];
                $write($handle, '<dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="' . $range . '"><formula1>&quot;' . ipawcus_backup_excel_escape($values) . '&quot;</formula1></dataValidation>');
            }
            $write($handle, '</dataValidations>');
        }
        $write($handle, '<pageMargins left="0.4" right="0.4" top="0.6" bottom="0.6" header="0.2" footer="0.2"/>');
        $write($handle, '</worksheet>');
        return $rowNumber - 2;
    } finally {
        fclose($handle);
    }
}

function ipawcus_backup_excel_content_types(int $sheetCount): string
{
    $sheets = '';
    for ($index = 1; $index <= $sheetCount; $index++) {
        $sheets .= '<Override PartName="/xl/worksheets/sheet' . $index . '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
    }
    return '<?xml version="1.0" encoding="UTF-8"?>'
        . '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        . '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        . '<Default Extension="xml" ContentType="application/xml"/>'
        . '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        . '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
        . '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>'
        . '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>'
        . $sheets . '</Types>';
}

function ipawcus_backup_excel_root_relationships(): string
{
    return '<?xml version="1.0" encoding="UTF-8"?>'
        . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        . '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
        . '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>'
        . '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>'
        . '</Relationships>';
}

function ipawcus_backup_excel_workbook(array $sheets): string
{
    $xml = '<?xml version="1.0" encoding="UTF-8"?>'
        . '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>';
    foreach ($sheets as $index => $sheet) {
        $xml .= '<sheet name="' . ipawcus_backup_excel_escape(substr((string)$sheet['title'], 0, 31)) . '" sheetId="' . ($index + 1) . '" r:id="rId' . ($index + 1) . '"/>';
    }
    return $xml . '</sheets></workbook>';
}

function ipawcus_backup_excel_workbook_relationships(int $sheetCount): string
{
    $xml = '<?xml version="1.0" encoding="UTF-8"?>'
        . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';
    for ($index = 1; $index <= $sheetCount; $index++) {
        $xml .= '<Relationship Id="rId' . $index . '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' . $index . '.xml"/>';
    }
    $xml .= '<Relationship Id="rId' . ($sheetCount + 1) . '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>';
    return $xml . '</Relationships>';
}

function ipawcus_backup_excel_styles(): string
{
    return '<?xml version="1.0" encoding="UTF-8"?>'
        . '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        . '<fonts count="2"><font><sz val="10"/><name val="Aptos"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="10"/><name val="Aptos"/></font></fonts>'
        . '<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF155DFC"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF7CC"/><bgColor indexed="64"/></patternFill></fill></fills>'
        . '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FFE2E8F0"/></bottom><diagonal/></border></borders>'
        . '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
        . '<cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs>'
        . '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
        . '</styleSheet>';
}

function ipawcus_backup_excel_core_properties(string $createdAt): string
{
    $created = gmdate('Y-m-d\TH:i:s\Z', strtotime($createdAt) ?: time());
    return '<?xml version="1.0" encoding="UTF-8"?>'
        . '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
        . '<dc:title>iPawcus Emergency Operations Workbook</dc:title><dc:creator>iPawcus System Backup</dc:creator>'
        . '<dcterms:created xsi:type="dcterms:W3CDTF">' . $created . '</dcterms:created>'
        . '</cp:coreProperties>';
}

function ipawcus_backup_excel_app_properties(array $sheets): string
{
    $titles = implode('', array_map(static fn(array $sheet): string => '<vt:lpstr>' . ipawcus_backup_excel_escape((string)$sheet['title']) . '</vt:lpstr>', $sheets));
    return '<?xml version="1.0" encoding="UTF-8"?>'
        . '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">'
        . '<Application>iPawcus</Application><TitlesOfParts><vt:vector size="' . count($sheets) . '" baseType="lpstr">' . $titles . '</vt:vector></TitlesOfParts>'
        . '</Properties>';
}
