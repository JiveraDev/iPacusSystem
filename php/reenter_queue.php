<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/booking_maintenance.php';
require_once __DIR__ . '/reference_number_helpers.php';

header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);
$queue_id = $data['queue_id'] ?? null;

if (!$queue_id) {
    http_response_code(400);
    echo json_encode(['message' => 'queue_id is required']);
    exit;
}

try {
    runLifecycleMaintenance($pdo);

    $sourceStmt = $pdo->prepare("
        SELECT *
        FROM queues
        WHERE queue_id = ?
        LIMIT 1
    ");
    $sourceStmt->execute([$queue_id]);
    $source = $sourceStmt->fetch(PDO::FETCH_ASSOC);

    if (!$source) {
        http_response_code(404);
        echo json_encode(['message' => 'Queue item not found']);
        exit;
    }

    $activeQueueStmt = $pdo->prepare("
        SELECT q.queue_id, q.queue_number, q.status, q.timestamp
        FROM queues q
        WHERE q.pet_id = ?
          AND q.status IN ('waiting', 'in-progress')
        ORDER BY q.timestamp DESC
    ");
    $activeQueueStmt->execute([$source['pet_id']]);
    $activeQueues = $activeQueueStmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($activeQueues as $active) {
        $queueDate = date('Y-m-d', strtotime((string)$active['timestamp']));
        $todayDate = maintenance_today($pdo);

        if ($queueDate === $todayDate) {
            $activeReference = ipawcus_format_queue_reference($active['queue_number'], $active['timestamp'] ?? null);
            http_response_code(409);
            echo json_encode([
                'message' => "This pet already has an active queue entry for today ({$activeReference}).",
                'queue_id' => $active['queue_id'],
                'queue_number' => $active['queue_number'],
                'queue_reference' => $activeReference,
                'status' => $active['status']
            ]);
            exit;
        }

        $activeReference = ipawcus_format_queue_reference($active['queue_number'], $active['timestamp'] ?? null);
        http_response_code(409);
        echo json_encode([
            'message' => "This pet still has an active in-service queue entry ({$activeReference}). Complete, return, or cancel it before re-entry.",
            'queue_id' => $active['queue_id'],
            'queue_number' => $active['queue_number'],
            'queue_reference' => $activeReference,
            'status' => $active['status']
        ]);
        exit;
    }

    $maxStmt = $pdo->prepare("SELECT MAX(queue_number) AS max_num FROM queues WHERE DATE(timestamp) = CURDATE()");
    $maxStmt->execute();
    $maxResult = $maxStmt->fetch(PDO::FETCH_ASSOC);
    $new_queue_number = ((int)($maxResult['max_num'] ?? 0)) + 1;

    $columnsStmt = $pdo->query("SHOW COLUMNS FROM queues");
    $columns = $columnsStmt->fetchAll(PDO::FETCH_COLUMN);

    $complaint = maintenance_append_note(
        $source['complaint'] ?? '',
        '[Lifecycle] Re-entered from previous queue ' . ipawcus_format_queue_reference($source['queue_number'] ?? $queue_id, $source['timestamp'] ?? null) . ' (' . maintenance_now($pdo) . ')'
    );

    $insertColumns = ['pet_id', 'user_id', 'service_name', 'queue_number', 'status', 'priority', 'complaint', 'timestamp'];
    $insertValues = [
        $source['pet_id'],
        $source['user_id'],
        $source['service_name'],
        $new_queue_number,
        'waiting',
        $source['priority'] ?? 'normal',
        $complaint
    ];
    $placeholders = ['?', '?', '?', '?', '?', '?', '?', 'NOW()'];

    foreach (['booking_id', 'queue_source', 'image_path', 'signiture_self_service_path', 'verified_by_admin'] as $optionalColumn) {
        if (in_array($optionalColumn, $columns, true) && array_key_exists($optionalColumn, $source)) {
            $insertColumns[] = $optionalColumn;
            $insertValues[] = $source[$optionalColumn];
            $placeholders[] = '?';
        }
    }

    $insertStmt = $pdo->prepare(sprintf(
        "INSERT INTO queues (%s) VALUES (%s)",
        implode(', ', $insertColumns),
        implode(', ', $placeholders)
    ));
    $insertStmt->execute($insertValues);
    $newQueueId = (int)$pdo->lastInsertId();

    echo json_encode([
        'success' => true,
        'queue_id' => $newQueueId,
        'queue_number' => $new_queue_number,
        'queue_reference' => ipawcus_format_queue_reference($new_queue_number)
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['message' => 'Failed to re-enter queue: ' . $e->getMessage()]);
}
