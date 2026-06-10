<?php
require_once 'db.php';
require_once __DIR__ . '/queue_assignment_helpers.php';
require_once __DIR__ . '/booking_maintenance.php';

header('Content-Type: application/json');

try {
    autoCancelStaleQueues($pdo);

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

    $stmt = $pdo->prepare("
        SELECT 
            q.*, 
            {$relatedBookingIdSelect} AS booking_id,
            bq.booking_number AS related_booking_number,
            bq.notes AS booking_notes,
            bq.Image_Booking_Concern_Path AS booking_concern_paths,
            bq.signature_path AS booking_signature_path,
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
        {$bookingJoin}
        {$assignmentJoin}
        ORDER BY q.timestamp DESC
    ");
    $stmt->execute();
    $queues = $stmt->fetchAll();

    echo json_encode($queues);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
