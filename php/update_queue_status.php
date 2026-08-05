<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/booking_queue_helpers.php';
require_once __DIR__ . '/queue_assignment_helpers.php';
require_once __DIR__ . '/notification_helpers.php';
require_once __DIR__ . '/booking_maintenance.php';
require_once __DIR__ . '/workflow_guard_helpers.php';
require_once __DIR__ . '/branch_helpers.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$queue_id = $input['queue_id'] ?? null;
$status = isset($input['status']) ? strtolower(trim((string)$input['status'])) : null;
$action = strtolower(trim((string)($input['action'] ?? '')));
$cancellationReason = trim((string)($input['reason'] ?? $input['cancellation_reason'] ?? ''));

if (!$queue_id || !$status) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing queue_id or status']);
    exit;
}

if (strlen($cancellationReason) > 500) {
    http_response_code(422);
    echo json_encode(['error' => 'Cancellation reason must be 500 characters or fewer.']);
    exit;
}

$allowedQueueStatuses = ['waiting', 'in-progress', 'completed', 'cancelled'];
if (!in_array($status, $allowedQueueStatuses, true)) {
    http_response_code(400);
    echo json_encode([
        'error' => 'Invalid queue status.',
        'allowedStatuses' => $allowedQueueStatuses
    ]);
    exit;
}

if ($status === 'completed') {
    http_response_code(409);
    echo json_encode([
        'error' => 'Queues can only be completed by saving a veterinarian diagnosis so visit billing is created in the same transaction.'
    ]);
    exit;
}

try {
    $currentUser = ipawcus_guard_current_user($pdo);
    $currentRole = ipawcus_guard_role($currentUser);
    $currentUserId = ipawcus_guard_user_id($currentUser);
    $currentIsAdmin = ipawcus_guard_is_admin_role($currentRole);
    runLifecycleMaintenance($pdo);

    $pdo->beginTransaction();

    $queueStmt = $pdo->prepare("SELECT * FROM queues WHERE queue_id = ? LIMIT 1 FOR UPDATE");
    $queueStmt->execute([$queue_id]);
    $queue = $queueStmt->fetch(PDO::FETCH_ASSOC);

    if (!$queue) {
        $pdo->rollBack();
        http_response_code(404);
        echo json_encode(['error' => 'Queue item not found.']);
        exit;
    }

    if ($currentRole === 'admin' && !branch_user_can_access($pdo, $currentUser, (int)($queue['branch_id'] ?? 0))) {
        $pdo->rollBack();
        http_response_code(403);
        echo json_encode(['error' => 'This queue belongs to another branch.']);
        exit;
    }

    $isCompletedReopen = $action === 'reopen'
        && strtolower(trim((string)($queue['status'] ?? ''))) === 'completed'
        && $status === 'in-progress';

    if ($isCompletedReopen) {
        $reopenHasAssignments = vetQueueAssignmentsTableExists($pdo);

        if ($currentRole === 'veterinarian' && $reopenHasAssignments) {
            $assignmentStmt = $pdo->prepare("
                SELECT veterinarian_user_id
                FROM vet_queue_assignments
                WHERE queue_id = ?
                  AND status = 'completed'
                ORDER BY assignment_id DESC
                LIMIT 1
            ");
            $assignmentStmt->execute([$queue_id]);
            $assignedVeterinarianId = (int)$assignmentStmt->fetchColumn();
            if ($assignedVeterinarianId <= 0 || $assignedVeterinarianId !== $currentUserId) {
                $pdo->rollBack();
                http_response_code(403);
                echo json_encode(['error' => 'Only the veterinarian who completed this case can reopen it.']);
                exit;
            }
        } elseif (!ipawcus_guard_is_admin_role($currentRole)) {
            $pdo->rollBack();
            http_response_code(403);
            echo json_encode(['error' => 'Your role is not allowed to reopen completed cases.']);
            exit;
        }
    } else {
        $isOwnerCancellation = $currentRole === 'pet_owner'
            && $status === 'cancelled'
            && (
                (int)($queue['user_id'] ?? 0) === $currentUserId
                || ipawcus_guard_pet_access($pdo, (int)($queue['pet_id'] ?? 0), $currentUserId)
            );

        if (!$currentIsAdmin && !$isOwnerCancellation) {
            $pdo->rollBack();
            http_response_code(403);
            echo json_encode([
                'error' => $status === 'cancelled'
                    ? 'Only an authorized admin or the linked pet owner can cancel this queue entry.'
                    : 'Only an authorized admin can change this queue status.'
            ]);
            exit;
        }

        ipawcus_guard_validate_queue_transition((string)$queue['status'], (string)$status, false);
    }

    $previousStatus = strtolower(trim((string)($queue['status'] ?? '')));
    $effectiveCancellationReason = $cancellationReason !== ''
        ? $cancellationReason
        : ($currentIsAdmin
            ? 'Cancelled by clinic staff from Queue Management.'
            : 'Cancelled by the pet owner.');

    if ($status === 'cancelled' && $previousStatus !== 'cancelled') {
        $cancelled = maintenance_cancel_queue(
            $pdo,
            (int)$queue_id,
            $effectiveCancellationReason,
            false,
            true
        );
        if (!$cancelled) {
            throw new RuntimeException('The queue entry changed before it could be cancelled.');
        }
    } elseif ($status !== $previousStatus) {
        $stmt = $pdo->prepare("UPDATE queues SET status = ? WHERE queue_id = ?");
        $stmt->execute([$status, $queue_id]);
    }

    $hasVetQueueAssignments = vetQueueAssignmentsTableExists($pdo);

    if ($hasVetQueueAssignments && $status === 'in-progress') {
        $latestStmt = $pdo->prepare("
            SELECT assignment_id
            FROM vet_queue_assignments
            WHERE queue_id = ?
              AND status = 'completed'
            ORDER BY assignment_id DESC
            LIMIT 1
        ");
        $latestStmt->execute([$queue_id]);
        $latestAssignmentId = $latestStmt->fetchColumn();

        if ($latestAssignmentId) {
            $reopenStmt = $pdo->prepare("
                UPDATE vet_queue_assignments
                SET status = 'received',
                    completed_at = NULL,
                    returned_at = NULL
                WHERE assignment_id = ?
            ");
            $reopenStmt->execute([$latestAssignmentId]);
        }
    }

    $pdo->commit();

    if ($status !== $previousStatus) {
        try {
            $event = $status === 'in-progress' ? 'in_progress' : $status;
            notification_send_queue_event($pdo, (int)$queue_id, $event, [
                'reason' => $status === 'cancelled' ? $effectiveCancellationReason : '',
            ]);
        } catch (Throwable $notificationError) {
            error_log('Queue status notification failed: ' . $notificationError->getMessage());
        }
    }

    if ($status === 'cancelled' && !empty($queue['pet_id'])) {
        try {
            runLifecycleMaintenance($pdo, (int)$queue['pet_id']);
        } catch (Throwable $maintenanceError) {
            error_log('Post-cancellation lifecycle maintenance failed: ' . $maintenanceError->getMessage());
        }
    }

    echo json_encode([
        'success' => true,
        'queue_id' => (int)$queue_id,
        'status' => $status,
    ]);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
