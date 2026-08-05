<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/notification_helpers.php';
require_once __DIR__ . '/booking_maintenance.php';
require_once __DIR__ . '/consent_record_helpers.php';
require_once __DIR__ . '/reference_number_helpers.php';
require_once __DIR__ . '/workflow_guard_helpers.php';
require_once __DIR__ . '/branch_helpers.php';

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

function queueActiveBookingsForPet(PDO $pdo, int $petId): array
{
    $hasBookingPets = maintenance_table_exists($pdo, 'booking_pets');
    $bookingPetCondition = $hasBookingPets
        ? " OR EXISTS (
                SELECT 1
                FROM booking_pets bp
                WHERE bp.booking_id = b.booking_id
                  AND bp.pet_id = ?
            )"
        : '';
    $params = $hasBookingPets ? [$petId, $petId] : [$petId];

    $stmt = $pdo->prepare("
        SELECT
            b.booking_id,
            b.booking_number,
            b.service_type,
            b.booking_date,
            b.booking_time,
            b.status
        FROM bookings b
        WHERE LOWER(COALESCE(b.status, '')) IN ('pending', 'confirmed')
          AND (
              b.pet_id = ?
              {$bookingPetCondition}
          )
        ORDER BY b.booking_date ASC, b.booking_time ASC, b.booking_id ASC
        FOR UPDATE
    ");
    $stmt->execute($params);

    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

function queueActiveBookingSummary(array $bookings): array
{
    return array_map(static function (array $booking): array {
        return [
            'booking_id' => (int)($booking['booking_id'] ?? 0),
            'booking_number' => (string)($booking['booking_number'] ?? ''),
            'service_type' => (string)($booking['service_type'] ?? ''),
            'booking_date' => (string)($booking['booking_date'] ?? ''),
            'booking_time' => (string)($booking['booking_time'] ?? ''),
            'status' => strtolower(trim((string)($booking['status'] ?? 'pending'))),
        ];
    }, $bookings);
}

function queueRespondWithActiveBookingConflict(array $bookings, bool $canCancelAndQueue, string $message): void
{
    global $pdo;

    if ($pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    http_response_code(409);
    echo json_encode([
        'code' => 'ACTIVE_BOOKING_CONFIRMATION_REQUIRED',
        'message' => $message,
        'can_cancel_and_queue' => $canCancelAndQueue,
        'active_bookings' => queueActiveBookingSummary($bookings),
    ]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);

$pet_id = $data['pet_id'] ?? null;
$user_id = $data['user_id'] ?? null;
$service_name = $data['service_name'] ?? null;
$requestedBranchId = $data['branch_id'] ?? $data['branchId'] ?? null;
$sourceBookingId = isset($data['booking_id']) && is_numeric($data['booking_id']) ? (int)$data['booking_id'] : null;
$priority = $data['priority'] ?? 'normal';
$complaint = $data['complaint'] ?? '';
$image_path = $data['image_path'] ?? null;
$signiture_self_service_path = $data['signiture_self_service_path'] ?? null;
$consent_file_id = $data['consent_file_id'] ?? $data['consentFileId'] ?? null;
$consent_type = $data['consent_type'] ?? $data['consentType'] ?? null;
$consent_signed_at = $data['consent_signed_at'] ?? $data['consentSignedAt'] ?? $data['signed_at'] ?? null;
$signer_name = $data['signer_name'] ?? $data['signerName'] ?? null;
$cancelActiveBookings = filter_var(
    $data['cancel_active_bookings'] ?? false,
    FILTER_VALIDATE_BOOLEAN
);
$confirmedBookingIds = array_values(array_unique(array_filter(
    array_map('intval', is_array($data['confirmed_booking_ids'] ?? null) ? $data['confirmed_booking_ids'] : []),
    static fn(int $bookingId): bool => $bookingId > 0
)));
sort($confirmedBookingIds, SORT_NUMERIC);
$currentApiUser = ipawcus_guard_current_user($pdo);
$currentApiRole = ipawcus_guard_role($currentApiUser);
$currentApiUserId = ipawcus_guard_user_id($currentApiUser);
$queue_source = $data['queue_source'] ?? ($currentApiRole === 'pet_owner' ? 'self_service' : 'admin');

if (!is_string($queue_source) || trim($queue_source) === '') {
    http_response_code(422);
    echo json_encode(['message' => 'Queue source is required.']);
    exit;
}
$queue_source = strtolower(trim($queue_source));
$allowedSources = ['admin', 'self_service', 'register', 'booking_management'];
if (!in_array($queue_source, $allowedSources, true)) {
    http_response_code(422);
    echo json_encode(['message' => 'Invalid queue source.', 'allowedSources' => $allowedSources]);
    exit;
}
if ($currentApiRole === 'pet_owner' && $queue_source !== 'self_service') {
    http_response_code(403);
    echo json_encode(['message' => 'Pet owners can only create self-service queue entries.']);
    exit;
}
if ($queue_source === 'booking_management' && !ipawcus_guard_is_admin_role($currentApiRole)) {
    http_response_code(403);
    echo json_encode(['message' => 'Only authorized staff can create booking-management queue entries.']);
    exit;
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

$cancelledBookingIds = [];
$queueTakeoverReason = 'Cancelled by clinic staff because the pet was manually entered into the clinic queue. The queue entry replaces this booking.';

try {
    runLifecycleMaintenance($pdo, (int)$pet_id);

    $branchId = null;
    if ($sourceBookingId) {
        $sourceBookingStmt = $pdo->prepare('SELECT branch_id FROM bookings WHERE booking_id = ? LIMIT 1');
        $sourceBookingStmt->execute([$sourceBookingId]);
        $branchId = (int)$sourceBookingStmt->fetchColumn();
    }
    if ($branchId <= 0) {
        $branchId = is_numeric($requestedBranchId)
            ? (int)$requestedBranchId
            : branch_user_primary_id($pdo, $currentApiUserId);
    }
    $branch = branch_fetch($pdo, $branchId);
    if (!$branch) {
        throw new InvalidArgumentException('Select an active clinic branch for this queue.');
    }
    if ($currentApiRole === 'admin' && !branch_user_can_access($pdo, $currentApiUser, $branchId)) {
        ipawcus_guard_error(403, 'You can add a walk-in queue only for your assigned branch.');
    }
    if (!branch_is_open($pdo, $branchId, date('Y-m-d'), date('H:i:s'))) {
        throw new InvalidArgumentException($branch['branch_name'] . ' is currently closed. Queue hours are 8:00 AM to 6:00 PM.');
    }
    $queueServiceKey = branch_service_key((string)$service_name);
    $serviceStmt = $pdo->prepare("
        SELECT availability_mode
        FROM branch_service_availability
        WHERE branch_id = ? AND service_key = ? AND is_active = 1 AND queue_enabled = 1
        LIMIT 1
    ");
    $serviceStmt->execute([$branchId, $queueServiceKey]);
    $availabilityMode = $serviceStmt->fetchColumn();
    if ($availabilityMode === false) {
        throw new InvalidArgumentException($branch['branch_name'] . ' does not offer this queue service.');
    }
    if ($availabilityMode === 'vet_visit' && !branch_find_vet_visit(
        $pdo,
        $branchId,
        $queueServiceKey,
        date('Y-m-d'),
        date('H:i:s')
    )) {
        throw new InvalidArgumentException('This Pet Corner service can be queued only while a scheduled veterinarian is visiting.');
    }

    if ($currentApiRole === 'pet_owner') {
        if (!empty($user_id) && (int)$user_id !== $currentApiUserId) {
            http_response_code(403);
            echo json_encode(['message' => 'You cannot queue a pet under another user account.']);
            exit;
        }
        if (!ipawcus_guard_pet_access($pdo, (int)$pet_id, $currentApiUserId)) {
            http_response_code(403);
            echo json_encode(['message' => 'You are not allowed to queue this pet.']);
            exit;
        }
        $user_id = $currentApiUserId;
    }

    $pdo->beginTransaction();

    // Serialize booking and queue creation for this pet. Booking creation uses
    // the same pet-row lock so neither workflow can pass its conflict checks
    // while the other is still being committed.
    $petLockStmt = $pdo->prepare("
        SELECT pet_id
        FROM pets_information
        WHERE pet_id = ?
        LIMIT 1
        FOR UPDATE
    ");
    $petLockStmt->execute([(int)$pet_id]);
    if (!$petLockStmt->fetchColumn()) {
        $pdo->rollBack();
        http_response_code(404);
        echo json_encode(['message' => 'Pet not found.']);
        exit;
    }

    // Check for active queue entries for THIS specific pet
    $activeQueueStmt = $pdo->prepare("
        SELECT queue_id, queue_number, status, timestamp
        FROM queues
        WHERE pet_id = ?
          AND status IN ('waiting', 'in-progress')
        ORDER BY timestamp DESC
        LIMIT 1
        FOR UPDATE
    ");
    $activeQueueStmt->execute([$pet_id]);
    $activeQueue = $activeQueueStmt->fetch(PDO::FETCH_ASSOC);

    if ($activeQueue) {
        $queueDate = date('Y-m-d', strtotime($activeQueue['timestamp']));
        $todayDate = date('Y-m-d');
        $activeQueueReference = ipawcus_format_queue_reference($activeQueue['queue_number'], $activeQueue['timestamp'] ?? null);

        if ($queueDate === $todayDate) {
            // If it's from today, block it as usual
            $pdo->rollBack();
            http_response_code(409);
            echo json_encode([
                'message' => "This pet already has an active queue entry for today ({$activeQueueReference}). Please complete or cancel it before adding another queue.",
                'queue_id' => $activeQueue['queue_id'],
                'queue_number' => $activeQueue['queue_number'],
                'queue_reference' => $activeQueueReference,
                'status' => $activeQueue['status']
            ]);
            exit;
        } else {
            $pdo->rollBack();
            http_response_code(409);
            echo json_encode([
                'message' => "This pet still has an active in-service queue entry ({$activeQueueReference}). Complete, return, or cancel it before adding another queue.",
                'queue_id' => $activeQueue['queue_id'],
                'queue_number' => $activeQueue['queue_number'],
                'queue_reference' => $activeQueueReference,
                'status' => $activeQueue['status']
            ]);
            exit;
        }
    }

    // Only a manual Queue Management entry can replace bookings. Booking
    // Management hand-offs, registration auto-queue, and owner self-service
    // keep their existing behavior and never cancel bookings here.
    if ($queue_source === 'admin') {
        $activeBookings = queueActiveBookingsForPet($pdo, (int)$pet_id);

        if (!empty($activeBookings)) {
            $canCancelAndQueue = $queue_source === 'admin'
                && ipawcus_guard_is_admin_role($currentApiRole);
            $activeBookingIds = array_map(
                static fn(array $booking): int => (int)$booking['booking_id'],
                $activeBookings
            );
            sort($activeBookingIds, SORT_NUMERIC);

            if (!$canCancelAndQueue || !$cancelActiveBookings) {
                $message = $canCancelAndQueue
                    ? 'This pet has an active booking. Review it first; to use the walk-in queue instead, confirm that the listed booking will be cancelled and the queue will become the active workflow.'
                    : 'This pet has an active booking. It must be kept or cancelled by an authorized admin before a standalone queue entry can be created.';
                queueRespondWithActiveBookingConflict($activeBookings, $canCancelAndQueue, $message);
            }

            if ($confirmedBookingIds !== $activeBookingIds) {
                queueRespondWithActiveBookingConflict(
                    $activeBookings,
                    true,
                    'The active booking list changed after confirmation. Review the updated list before cancelling bookings and adding this pet to the queue.'
                );
            }

            foreach ($activeBookingIds as $activeBookingId) {
                if (!maintenance_cancel_booking($pdo, $activeBookingId, $queueTakeoverReason, false)) {
                    throw new RuntimeException('An active booking changed before it could be cancelled. No queue entry was created.');
                }
                $cancelledBookingIds[] = $activeBookingId;
            }
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
    $stmt = $pdo->prepare("
        SELECT queue_number
        FROM queues
        WHERE branch_id = ?
          AND timestamp >= CURDATE()
          AND timestamp < DATE_ADD(CURDATE(), INTERVAL 1 DAY)
        ORDER BY queue_number DESC
        LIMIT 1
        FOR UPDATE
    ");
    $stmt->execute([$branchId]);
    $result = $stmt->fetch();
    $new_queue_number = ((int)($result['queue_number'] ?? 0)) + 1;

    // Build INSERT dynamically so queue creation works across sources even when schema adds optional columns.
    $columnsStmt = $pdo->query("SHOW COLUMNS FROM queues");
    $columns = $columnsStmt->fetchAll(PDO::FETCH_COLUMN);

    $insertColumns = ['pet_id', 'user_id', 'service_name', 'queue_number', 'status', 'priority', 'complaint', 'timestamp'];
    $insertValues = [$pet_id, $user_id, $service_name, $new_queue_number, $initialStatus, $priority, $complaint];
    $placeholders = ['?', '?', '?', '?', '?', '?', '?', 'NOW()'];

    $insertColumns[] = 'branch_id';
    $insertValues[] = $branchId;
    $placeholders[] = '?';

    $insertColumns[] = 'queue_date';
    $insertValues[] = date('Y-m-d');
    $placeholders[] = '?';

    if ($sourceBookingId && in_array('booking_id', $columns, true)) {
        $insertColumns[] = 'booking_id';
        $insertValues[] = $sourceBookingId;
        $placeholders[] = '?';
    }

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
        'consent_file_id' => $consent_file_id,
        'consent_type' => $consent_type ?: (($service_name ?? 'Service') . ' Consent'),
        'owner_user_id' => $user_id,
        'pet_id' => $pet_id,
        'service_name' => $service_name,
        'signed_file_path' => $signiture_self_service_path,
        'signed_at' => $consent_signed_at,
        'signer_name' => $signer_name,
        'notes' => $queue_source === 'self_service'
            ? 'Captured during self-service queue creation.'
            : 'Captured during queue creation.',
    ]);

    $pdo->commit();

    try {
        notification_send_queue_event($pdo, $queueId, 'created');
    } catch (Throwable $notificationError) {
        error_log('Queue creation notification failed: ' . $notificationError->getMessage());
    }

    foreach ($cancelledBookingIds as $cancelledBookingId) {
        try {
            notification_send_booking_event($pdo, $cancelledBookingId, 'cancelled', [
                'reason' => $queueTakeoverReason,
                'cancellation_message' => $queueTakeoverReason,
            ]);
        } catch (Throwable $notificationError) {
            error_log('Queue takeover booking notification failed: ' . $notificationError->getMessage());
        }
    }

    echo json_encode([
        'success' => true,
        'queue_id' => $queueId,
        'queue_number' => $new_queue_number,
        'queue_reference' => ipawcus_format_queue_reference($new_queue_number),
        'branch_id' => $branchId,
        'branch_name' => $branch['branch_name'],
        'cancelled_booking_ids' => $cancelledBookingIds,
        'cancelled_booking_count' => count($cancelledBookingIds),
    ]);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    $status = $e instanceof InvalidArgumentException ? 422 : 500;
    http_response_code($status);
    echo json_encode(['message' => $status === 500 ? 'Failed to add to queue: ' . $e->getMessage() : $e->getMessage()]);
}
