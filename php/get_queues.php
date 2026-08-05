<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/queue_assignment_helpers.php';
require_once __DIR__ . '/booking_maintenance.php';
require_once __DIR__ . '/reference_number_helpers.php';
require_once __DIR__ . '/booking_queue_helpers.php';
require_once __DIR__ . '/consent_record_helpers.php';
require_once __DIR__ . '/pet_allergy_helpers.php';
require_once __DIR__ . '/workflow_guard_helpers.php';
require_once __DIR__ . '/branch_helpers.php';

header('Content-Type: application/json');

function queue_table_exists(PDO $pdo, string $tableName): bool
{
    $stmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM information_schema.tables
        WHERE table_schema = DATABASE()
          AND table_name = ?
    ");
    $stmt->execute([$tableName]);

    return (int)$stmt->fetchColumn() > 0;
}

try {
    autoCancelStaleQueues($pdo);
    $currentApiUser = ipawcus_guard_current_user($pdo);
    $currentApiRole = ipawcus_guard_role($currentApiUser);
    $scopeWhere = '';
    $scopeParams = [];
    if ($currentApiRole === 'admin') {
        $branchIds = branch_user_ids($pdo, ipawcus_guard_user_id($currentApiUser));
        if (!$branchIds) {
            $scopeWhere = ' AND 1 = 0';
        } else {
            $scopeWhere = ' AND q.branch_id IN (' . implode(',', array_fill(0, count($branchIds), '?')) . ')';
            $scopeParams = $branchIds;
        }
    }

    $columnsStmt = $pdo->query("SHOW COLUMNS FROM queues");
    $columns = $columnsStmt->fetchAll(PDO::FETCH_COLUMN);
    $hasQueueSource = in_array('queue_source', $columns, true);
    $hasBookingId = in_array('booking_id', $columns, true);
    $queueSourceSelect = $hasQueueSource ? "q.queue_source" : "'admin'";
    $relatedBookingIdSelect = $hasBookingId ? "COALESCE(q.booking_id, bq.booking_id)" : "bq.booking_id";
    $bookingJoinCondition = $hasBookingId
        ? "(bq.booking_id = q.booking_id OR (q.booking_id IS NULL AND q.complaint LIKE CONCAT('%[Booking: ', bq.booking_number, ']%')))"
        : "q.complaint LIKE CONCAT('%[Booking: ', bq.booking_number, ']%')";
    $bookingJoin = "LEFT JOIN bookings bq ON {$bookingJoinCondition}";
    $hasVetQueueAssignments = vetQueueAssignmentsTableExists($pdo);
    $assignmentSelect = $hasVetQueueAssignments
        ? "
            vqa.assignment_id,
            vqa.veterinarian_user_id,
            vqa.veterinarian_name,
            vqa.status AS assignment_status,
            vqa.received_at,
            vqa.returned_at,
            vqa.completed_at,
            CASE WHEN active_vqa.assignment_id IS NULL THEN 0 ELSE 1 END AS has_active_assignment,"
        : "
            NULL AS assignment_id,
            NULL AS veterinarian_user_id,
            NULL AS veterinarian_name,
            NULL AS assignment_status,
            NULL AS received_at,
            NULL AS returned_at,
            NULL AS completed_at,
            0 AS has_active_assignment,";
    $assignmentJoin = $hasVetQueueAssignments
        ? "
        LEFT JOIN vet_queue_assignments vqa ON vqa.assignment_id = (
            SELECT latest_vqa.assignment_id
            FROM vet_queue_assignments latest_vqa
            WHERE latest_vqa.queue_id = q.queue_id
            ORDER BY latest_vqa.assignment_id DESC
            LIMIT 1
        )
        LEFT JOIN vet_queue_assignments active_vqa ON active_vqa.assignment_id = (
            SELECT received_vqa.assignment_id
            FROM vet_queue_assignments received_vqa
            WHERE received_vqa.queue_id = q.queue_id
              AND received_vqa.status = 'received'
            ORDER BY received_vqa.assignment_id DESC
            LIMIT 1
        )"
        : "";
    $hasConsentRecords = consent_record_table_exists($pdo);
    $consentRecordSelect = $hasConsentRecords
        ? "
            cfr.consent_record_id AS signed_consent_record_id,
            cfr.consent_type AS signed_consent_type,
            cfr.signed_file_path AS signed_consent_document_path,
            cfr.physical_file_path AS physical_consent_path,
            cfr.signed_at AS signed_consent_at,"
        : "
            NULL AS signed_consent_record_id,
            NULL AS signed_consent_type,
            NULL AS signed_consent_document_path,
            NULL AS physical_consent_path,
            NULL AS signed_consent_at,";
    $consentRecordJoin = $hasConsentRecords
        ? "
        LEFT JOIN consent_form_records cfr ON cfr.consent_record_id = (
            SELECT latest_cfr.consent_record_id
            FROM consent_form_records latest_cfr
            WHERE latest_cfr.queue_id = q.queue_id
              AND (latest_cfr.signed_file_path IS NOT NULL OR latest_cfr.physical_file_path IS NOT NULL)
            ORDER BY latest_cfr.consent_record_id DESC
            LIMIT 1
        )"
        : "";

    $stmt = $pdo->prepare("
        SELECT 
            q.*, 
            branch.branch_code,
            branch.branch_name,
            branch.address AS branch_address,
            {$relatedBookingIdSelect} AS booking_id,
            bq.booking_number AS related_booking_number,
            bq.notes AS booking_notes,
            bq.Image_Booking_Concern_Path AS booking_concern_paths,
            bq.signature_path AS booking_signature_path,
            bq.consent_forms AS booking_consent_forms,
            bq.booking_date AS related_booking_date,
            bq.booking_time AS related_booking_time,
            p.pet_name, 
            p.pet_species,
            p.pet_breed,
            p.pet_BDAY,
            p.pet_age,
            p.pet_gender,
            p.pet_weight,
            p.pet_status,
            p.pet_microchip,
            p.pet_allergies,
            p.pet_color_marking,
            p.setpetImage_url,
            u.first_Name, 
            u.last_Name, 
            u.phoneNumber as contactNumber, 
            {$queueSourceSelect} AS queue_source,
            {$assignmentSelect}
            {$consentRecordSelect}
            COALESCE(
                NULLIF(TRIM(CONCAT(COALESCE(u.first_Name, ''), ' ', COALESCE(u.last_Name, ''))), ''),
                p.pet_Temp_owner,
                'Unknown Owner'
            ) AS owner_name,
            CASE 
                WHEN EXISTS (
                    SELECT 1
                    FROM users ux
                    WHERE LOWER(TRIM(CONCAT(COALESCE(ux.first_Name, ''), ' ', COALESCE(ux.last_Name, '')))) =
                          LOWER(TRIM(COALESCE(
                              NULLIF(TRIM(CONCAT(COALESCE(u.first_Name, ''), ' ', COALESCE(u.last_Name, ''))), ''),
                              p.pet_Temp_owner,
                              ''
                          )))
                      AND ux.mail_Address NOT LIKE '%@unregistered.local'
                ) THEN 'registered'
                ELSE 'unregistered'
            END AS owner_status,
            CASE
                WHEN EXISTS (
                    SELECT 1
                    FROM users ux
                    WHERE LOWER(TRIM(CONCAT(COALESCE(ux.first_Name, ''), ' ', COALESCE(ux.last_Name, '')))) =
                          LOWER(TRIM(COALESCE(
                              NULLIF(TRIM(CONCAT(COALESCE(u.first_Name, ''), ' ', COALESCE(u.last_Name, ''))), ''),
                              p.pet_Temp_owner,
                              ''
                          )))
                      AND ux.mail_Address NOT LIKE '%@unregistered.local'
                ) THEN COALESCE(
                    (
                        SELECT ux2.personal_Address
                        FROM users ux2
                        WHERE LOWER(TRIM(CONCAT(COALESCE(ux2.first_Name, ''), ' ', COALESCE(ux2.last_Name, '')))) =
                              LOWER(TRIM(COALESCE(
                                  NULLIF(TRIM(CONCAT(COALESCE(u.first_Name, ''), ' ', COALESCE(u.last_Name, ''))), ''),
                                  p.pet_Temp_owner,
                                  ''
                              )))
                          AND ux2.mail_Address NOT LIKE '%@unregistered.local'
                        ORDER BY ux2.user_id DESC
                        LIMIT 1
                    ),
                    'N/A'
                )
                ELSE 'The pet owner is unregistered.'
            END AS address
        FROM queues q
        JOIN pets_information p ON q.pet_id = p.pet_id
        LEFT JOIN users u ON q.user_id = u.user_id
        LEFT JOIN branches branch ON branch.branch_id = q.branch_id
        {$bookingJoin}
        {$assignmentJoin}
        {$consentRecordJoin}
        WHERE 1 = 1 {$scopeWhere}
        ORDER BY q.timestamp DESC
    ");
    $stmt->execute($scopeParams);
    $queues = $stmt->fetchAll();
    $consentRecordsByQueue = consent_record_fetch_queue_records(
        $pdo,
        array_column($queues, 'queue_id')
    );

    foreach ($queues as &$queue) {
        $queue['queue_reference'] = ipawcus_format_queue_reference($queue['queue_number'] ?? 0, $queue['timestamp'] ?? null);
        $queue['complaint'] = cleanBookingQueueComplaint($queue['complaint'] ?? '');
        $queue['pet_allergies'] = pet_allergy_effective_text(
            $pdo,
            (int)($queue['pet_id'] ?? 0),
            $queue['pet_allergies'] ?? null
        );

        if (array_key_exists('booking_notes', $queue)) {
            $queue['booking_notes'] = bookingCleanVisibleNotes($queue['booking_notes'] ?? '');
        }

        $bookingConsentForms = consent_record_forms_for_response($queue['booking_consent_forms'] ?? null);
        $storedBookingSignaturePath = consent_record_nullable_text($queue['booking_signature_path'] ?? null);
        $signedBookingConsentPath = consent_record_first_signed_document_path($bookingConsentForms);
        $legacyBookingSignaturePath = consent_record_first_legacy_signature_path($bookingConsentForms);
        if (
            $legacyBookingSignaturePath === null
            && $storedBookingSignaturePath !== null
            && $storedBookingSignaturePath !== $signedBookingConsentPath
        ) {
            $legacyBookingSignaturePath = $storedBookingSignaturePath;
        }
        $queue['booking_consent_forms'] = $bookingConsentForms;
        $queue['booking_signature_path'] = $signedBookingConsentPath;
        $queue['booking_legacy_consent_signature_path'] = $legacyBookingSignaturePath;

        $queueConsentRecords = $consentRecordsByQueue[(int)($queue['queue_id'] ?? 0)] ?? [];
        $queue['consent_records'] = $queueConsentRecords;
        foreach (consent_record_queue_compatibility_fields($queueConsentRecords) as $field => $value) {
            $queue[$field] = $value;
        }
    }
    unset($queue);

    echo json_encode($queues);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
