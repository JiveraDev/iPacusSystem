<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/notification_helpers.php';
require_once __DIR__ . '/booking_maintenance.php';
require_once __DIR__ . '/consent_record_helpers.php';

header("Content-Type: application/json");

function getEnvValue($key, $default = '') {
    $val = getenv($key);
    if ($val !== false && $val !== null && $val !== '') return $val;
    if (isset($_ENV[$key]) && $_ENV[$key] !== '') return $_ENV[$key];
    if (isset($_SERVER[$key]) && $_SERVER[$key] !== '') return $_SERVER[$key];
    return $default;
}

function getClientIpAddress() {
    $forwarded = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? '';
    if (!empty($forwarded)) {
        $parts = explode(',', $forwarded);
        $firstIp = trim($parts[0]);
        if (filter_var($firstIp, FILTER_VALIDATE_IP)) {
            return $firstIp;
        }
    }

    $remoteAddr = $_SERVER['REMOTE_ADDR'] ?? '';
    if (filter_var($remoteAddr, FILTER_VALIDATE_IP)) {
        return $remoteAddr;
    }

    return '';
}

function getPublicIpForRestriction() {
    $mode = strtolower(trim((string)getEnvValue('RESTRICT_IP_MODE', 'auto')));
    $headerIp = trim((string)($_SERVER['HTTP_X_CLIENT_PUBLIC_IP'] ?? ''));

    if ($mode === 'public_wan') {
        return filter_var($headerIp, FILTER_VALIDATE_IP) ? $headerIp : '';
    }

    if (filter_var($headerIp, FILTER_VALIDATE_IP)) {
        return $headerIp;
    }

    return getClientIpAddress();
}

function ipMatchesRule($clientIp, $rule) {
    $rule = trim($rule);
    if ($rule === '') return false;
    if ($rule === $clientIp) return true;

    if (str_ends_with($rule, '*')) {
        $prefix = rtrim($rule, '*');
        return str_starts_with($clientIp, $prefix);
    }

    if (strpos($rule, '/') !== false) {
        [$subnet, $maskBits] = explode('/', $rule, 2);
        $subnetLong = ip2long($subnet);
        $ipLong = ip2long($clientIp);
        $maskBits = (int)$maskBits;
        if ($subnetLong === false || $ipLong === false || $maskBits < 0 || $maskBits > 32) {
            return false;
        }
        $mask = $maskBits === 0 ? 0 : (-1 << (32 - $maskBits));
        return (($ipLong & $mask) === ($subnetLong & $mask));
    }

    return false;
}

function isIpAllowedForSelfService($clientIp, $allowedIps) {
    if ($clientIp === '') {
        return false;
    }
    foreach ($allowedIps as $allowedIp) {
        if (ipMatchesRule($clientIp, $allowedIp)) {
            return true;
        }
    }

    return false;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);

$pet_id = $data['pet_id'] ?? null;
$user_id = $data['user_id'] ?? null;
$service_name = $data['service_name'] ?? null;
$priority = $data['priority'] ?? 'normal';
$complaint = $data['complaint'] ?? '';
$image_path = $data['image_path'] ?? null;
$signiture_self_service_path = $data['signiture_self_service_path'] ?? null;
$queue_source = $data['queue_source'] ?? 'admin';

if (!is_string($queue_source) || trim($queue_source) === '') {
    $queue_source = 'admin';
}
$queue_source = strtolower(trim($queue_source));
$allowedSources = ['admin', 'self_service', 'register', 'booking_management'];
if (!in_array($queue_source, $allowedSources, true)) {
    $queue_source = 'admin';
}
$initialStatus = $queue_source === 'booking_management' ? 'in-progress' : 'waiting';

if ($queue_source === 'self_service') {
    $clientIp = getPublicIpForRestriction();
    $rawAllowed = getEnvValue('RESTRICT_IP_SELF_SERVICE_QUEUE', '');
    $allowedIps = array_filter(array_map('trim', explode(',', $rawAllowed)));
    if (empty($allowedIps)) {
        $allowedIps = ['127.0.0.1', '::1'];
    }
    if (!isIpAllowedForSelfService($clientIp, $allowedIps)) {
        http_response_code(403);
        echo json_encode([
            'message' => 'Cannot access: must be connected to clinic WiFi to add queue.',
            'client_ip' => $clientIp
        ]);
        exit;
    }
}

if (!$pet_id || !$service_name) {
    http_response_code(400);
    echo json_encode(['message' => 'Missing required fields: pet_id and service_name are required']);
    exit;
}

try {
    runLifecycleMaintenance($pdo, (int)$pet_id);

    // Check for active queue entries for THIS specific pet
    $activeQueueStmt = $pdo->prepare("
        SELECT queue_id, queue_number, status, timestamp
        FROM queues
        WHERE pet_id = ?
          AND status IN ('waiting', 'in-progress')
        ORDER BY timestamp DESC
        LIMIT 1
    ");
    $activeQueueStmt->execute([$pet_id]);
    $activeQueue = $activeQueueStmt->fetch(PDO::FETCH_ASSOC);

    if ($activeQueue) {
        $queueDate = date('Y-m-d', strtotime($activeQueue['timestamp']));
        $todayDate = date('Y-m-d');

        if ($queueDate === $todayDate) {
            // If it's from today, block it as usual
            http_response_code(409);
            echo json_encode([
                'message' => "This pet already has an active queue entry for today (#{$activeQueue['queue_number']}). Please complete or cancel it before adding another queue.",
                'queue_id' => $activeQueue['queue_id'],
                'queue_number' => $activeQueue['queue_number'],
                'status' => $activeQueue['status']
            ]);
            exit;
        } else {
            http_response_code(409);
            echo json_encode([
                'message' => "This pet still has an active in-service queue entry (#{$activeQueue['queue_number']}). Complete, return, or cancel it before adding another queue.",
                'queue_id' => $activeQueue['queue_id'],
                'queue_number' => $activeQueue['queue_number'],
                'status' => $activeQueue['status']
            ]);
            exit;
        }
    }

    // Allow queueing pets without linked registered owner by using a synthetic temp-owner user row.
    if (empty($user_id)) {
        $petStmt = $pdo->prepare("SELECT pet_Temp_owner FROM pets_information WHERE pet_id = ?");
        $petStmt->execute([$pet_id]);
        $pet = $petStmt->fetch(PDO::FETCH_ASSOC);
        $tempOwnerName = trim((string)($pet['pet_Temp_owner'] ?? ''));
        if ($tempOwnerName === '') {
            $tempOwnerName = "Temporary Owner #{$pet_id}";
        }

        $tempEmail = "temp_pet_{$pet_id}@unregistered.local";
        $findUserStmt = $pdo->prepare("SELECT user_id FROM users WHERE mail_Address = ? LIMIT 1");
        $findUserStmt->execute([$tempEmail]);
        $existingTempUser = $findUserStmt->fetch(PDO::FETCH_ASSOC);

        if ($existingTempUser && !empty($existingTempUser['user_id'])) {
            $user_id = (int)$existingTempUser['user_id'];
        } else {
            $nameParts = preg_split('/\s+/', $tempOwnerName);
            $firstName = $nameParts[0] ?? null;
            $lastName = count($nameParts) > 1 ? implode(' ', array_slice($nameParts, 1)) : $tempOwnerName;

            $createUserStmt = $pdo->prepare("
                INSERT INTO users (first_Name, last_Name, mail_Address, personal_Address, role)
                VALUES (?, ?, ?, ?, ?)
            ");
            $createUserStmt->execute([$firstName, $lastName, $tempEmail, 'Unregistered temporary owner', 'guest']);
            $user_id = (int)$pdo->lastInsertId();
        }
    }

    // Calculate new queue number: max number for today + 1
    $stmt = $pdo->prepare("SELECT MAX(queue_number) as max_num FROM queues WHERE DATE(timestamp) = CURDATE()");
    $stmt->execute();
    $result = $stmt->fetch();
    $new_queue_number = ($result['max_num'] ?? 0) + 1;

    // Build INSERT dynamically so queue creation works across sources even when schema adds optional columns.
    $columnsStmt = $pdo->query("SHOW COLUMNS FROM queues");
    $columns = $columnsStmt->fetchAll(PDO::FETCH_COLUMN);

    $insertColumns = ['pet_id', 'user_id', 'service_name', 'queue_number', 'status', 'priority', 'complaint', 'timestamp'];
    $insertValues = [$pet_id, $user_id, $service_name, $new_queue_number, $initialStatus, $priority, $complaint];
    $placeholders = ['?', '?', '?', '?', '?', '?', '?', 'NOW()'];

    if (in_array('queue_source', $columns, true)) {
        $insertColumns[] = 'queue_source';
        $insertValues[] = $queue_source;
        $placeholders[] = '?';
    }

    if (in_array('image_path', $columns, true)) {
        $insertColumns[] = 'image_path';
        $insertValues[] = $image_path;
        $placeholders[] = '?';
    }

    if (in_array('signiture_self_service_path', $columns, true)) {
        $insertColumns[] = 'signiture_self_service_path';
        $insertValues[] = $signiture_self_service_path;
        $placeholders[] = '?';
    }

    $sql = sprintf(
        "INSERT INTO queues (%s) VALUES (%s)",
        implode(', ', $insertColumns),
        implode(', ', $placeholders)
    );
    $stmt = $pdo->prepare($sql);
    $stmt->execute($insertValues);
    $queueId = (int)$pdo->lastInsertId();

    consent_record_capture_queue($pdo, [
        'queue_id' => $queueId,
        'owner_user_id' => $user_id,
        'pet_id' => $pet_id,
        'service_name' => $service_name,
        'signed_file_path' => $signiture_self_service_path,
        'notes' => $queue_source === 'self_service'
            ? 'Captured during self-service queue creation.'
            : 'Captured during queue creation.',
    ]);

    try {
        notification_send_queue_event($pdo, $queueId, 'created');
    } catch (Throwable $notificationError) {
        error_log('Queue creation notification failed: ' . $notificationError->getMessage());
    }

    echo json_encode(['success' => true]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['message' => 'Failed to add to queue: ' . $e->getMessage()]);
}
