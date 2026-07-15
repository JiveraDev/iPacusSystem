<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/booking_maintenance.php';
require_once __DIR__ . '/reference_number_helpers.php';
require_once __DIR__ . '/booking_queue_helpers.php';
require_once __DIR__ . '/workflow_guard_helpers.php';

header("Content-Type: application/json");

$petId = $_GET['petId'] ?? null;

if (!$petId) {
    http_response_code(400);
    echo json_encode(['message' => 'Pet ID is required.']);
    exit;
}

try {
    $currentApiUser = ipawcus_guard_current_user($pdo);
    $currentApiRole = ipawcus_guard_role($currentApiUser);
    $currentApiUserId = ipawcus_guard_user_id($currentApiUser);
    $numericPetId = null;
    if (strpos((string)$petId, 'PET-') === 0) {
        $petStmt = $pdo->prepare("SELECT pet_id FROM pets_information WHERE pet_sharable_ID = ? LIMIT 1");
        $petStmt->execute([$petId]);
        $resolvedPetId = $petStmt->fetchColumn();
        $numericPetId = $resolvedPetId ? (int)$resolvedPetId : null;
    } else {
        $numericPetId = (int)$petId;
    }

    if ($currentApiRole === 'pet_owner' && ($numericPetId === null || !ipawcus_guard_pet_access($pdo, $numericPetId, $currentApiUserId))) {
        http_response_code(403);
        echo json_encode(['message' => 'You are not allowed to view queues for this pet.']);
        exit;
    }

    if ($numericPetId !== null && $numericPetId > 0) {
        autoCancelStaleQueuesDetailed($pdo, $numericPetId, true);
    }

    $whereColumn = strpos((string)$petId, 'PET-') === 0 ? 'p.pet_sharable_ID' : 'p.pet_id';
    $columnsStmt = $pdo->query("SHOW COLUMNS FROM queues");
    $columns = $columnsStmt->fetchAll(PDO::FETCH_COLUMN);
    $hasQueueSource = in_array('queue_source', $columns, true);
    $queueSourceSelect = $hasQueueSource ? "q.queue_source" : "'admin'";
    $hasSelfServiceSignature = in_array('signiture_self_service_path', $columns, true);
    $selfServiceSignatureSelect = $hasSelfServiceSignature ? "q.signiture_self_service_path" : "NULL";

    $stmt = $pdo->prepare("
        SELECT
            q.queue_id,
            q.pet_id,
            q.service_name,
            q.queue_number,
            q.status,
            q.priority,
            q.complaint,
            q.timestamp,
            {$queueSourceSelect} AS queue_source,
            {$selfServiceSignatureSelect} AS signiture_self_service_path
        FROM queues q
        JOIN pets_information p ON q.pet_id = p.pet_id
        WHERE {$whereColumn} = ?
        ORDER BY q.timestamp DESC
    ");
    $stmt->execute([$petId]);

    $queues = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($queues as &$queue) {
        $queue['queue_reference'] = ipawcus_format_queue_reference($queue['queue_number'] ?? 0, $queue['timestamp'] ?? null);
        $queue['complaint'] = cleanBookingQueueComplaint($queue['complaint'] ?? '');
    }
    unset($queue);

    echo json_encode($queues);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['message' => 'Failed to fetch pet queues: ' . $e->getMessage()]);
}
