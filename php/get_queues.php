<?php
require_once 'db.php';

header('Content-Type: application/json');

try {
    // Auto-cancel queues older than 2 days
    $pdo->exec("UPDATE queues SET status = 'cancelled' WHERE status IN ('waiting', 'in-progress') AND timestamp < (NOW() - INTERVAL 2 DAY)");

    $columnsStmt = $pdo->query("SHOW COLUMNS FROM queues");
    $columns = $columnsStmt->fetchAll(PDO::FETCH_COLUMN);
    $hasQueueSource = in_array('queue_source', $columns, true);
    $queueSourceSelect = $hasQueueSource ? "q.queue_source" : "'admin'";

    $stmt = $pdo->prepare("
        SELECT 
            q.*, 
            p.pet_name, 
            u.first_Name, 
            u.last_Name, 
            u.phoneNumber as contactNumber, 
            {$queueSourceSelect} AS queue_source,
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
        ORDER BY q.timestamp DESC
    ");
    $stmt->execute();
    $queues = $stmt->fetchAll();

    echo json_encode($queues);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
