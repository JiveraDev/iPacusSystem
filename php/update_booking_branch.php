<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/workflow_guard_helpers.php';
require_once __DIR__ . '/branch_helpers.php';
require_once __DIR__ . '/notification_helpers.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'PATCH') {
    http_response_code(405);
    echo json_encode(['message' => 'Method not allowed.']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true) ?: [];
$bookingId = (int)($_GET['bookingId'] ?? 0);
$targetBranchId = (int)($input['branchId'] ?? $input['branch_id'] ?? 0);
$reason = trim((string)($input['reason'] ?? 'Booking was assigned to the correct branch.'));

try {
    branch_require_schema($pdo);
    $currentUser = ipawcus_guard_current_user($pdo);
    $role = ipawcus_guard_role($currentUser);
    $actorId = ipawcus_guard_user_id($currentUser);
    if (!in_array($role, ['admin', 'super_admin'], true)) {
        ipawcus_guard_error(403, 'Only Admin and Super Admin can relocate a booking.');
    }
    if ($bookingId <= 0 || $targetBranchId <= 0) {
        throw new InvalidArgumentException('Booking and destination branch are required.');
    }

    $pdo->beginTransaction();
    $stmt = $pdo->prepare('SELECT * FROM bookings WHERE booking_id = ? LIMIT 1 FOR UPDATE');
    $stmt->execute([$bookingId]);
    $booking = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$booking) {
        throw new OutOfBoundsException('Booking not found.');
    }
    if (($booking['status'] ?? '') !== 'pending') {
        throw new DomainException('Only pending bookings can be relocated. Confirmed bookings stay with their approved branch.');
    }

    $fromBranchId = (int)$booking['branch_id'];

    $resolution = branch_resolve_booking(
        $pdo,
        $targetBranchId,
        $booking['service_type'] ?? null,
        $booking['is_home_service'] ?? 0,
        $booking['is_online_consultation'] ?? 0,
        (string)$booking['booking_date'],
        (string)$booking['booking_time'],
        is_numeric($booking['veterinarian_id'] ?? null) ? (int)$booking['veterinarian_id'] : null
    );
    $resolvedBranchId = (int)$resolution['branch_id'];
    if ($resolvedBranchId === $fromBranchId) {
        $pdo->commit();
        echo json_encode(['success' => true, 'message' => 'Booking is already assigned to this branch.']);
        exit;
    }

    $update = $pdo->prepare('UPDATE bookings SET branch_id = ?, veterinarian_id = COALESCE(?, veterinarian_id) WHERE booking_id = ?');
    $update->execute([$resolvedBranchId, $resolution['veterinarian_user_id'] ?? null, $bookingId]);
    $queueUpdate = $pdo->prepare('UPDATE queues SET branch_id = ? WHERE booking_id = ?');
    $queueUpdate->execute([$resolvedBranchId, $bookingId]);
    $audit = $pdo->prepare("
        INSERT INTO booking_branch_transfers
            (booking_id, from_branch_id, to_branch_id, transferred_by_user_id, reason, payment_review_required)
        VALUES (?, ?, ?, ?, ?, 0)
    ");
    $audit->execute([$bookingId, $fromBranchId, $resolvedBranchId, $actorId, $reason ?: null]);
    $pdo->commit();

    $ownerMessage = "Booking {$booking['booking_number']} was moved to {$resolution['branch']['branch_name']}. Its price and submitted payment remain unchanged.";
    notification_create_event($pdo, [
        'user_id' => (int)$booking['user_id'],
        'branch_id' => $resolvedBranchId,
        'type' => 'booking_branch_relocated',
        'category' => 'booking_updates',
        'title' => 'Booking location updated',
        'message' => $ownerMessage,
        'push_message' => $ownerMessage,
        'redirect_path' => !empty($booking['pet_id']) ? '/dashboard/my-pets/' . (int)$booking['pet_id'] : '/dashboard/todos',
        'dedupe_key' => 'booking-branch-relocated-' . $bookingId . '-' . time(),
        'force_in_app' => true,
    ]);
    foreach (branch_admin_recipient_ids($pdo, $resolvedBranchId, false) as $recipientId) {
        notification_create_event($pdo, [
            'user_id' => $recipientId,
            'branch_id' => $resolvedBranchId,
            'type' => 'booking_relocated_to_branch',
            'category' => 'booking_updates',
            'title' => 'Booking moved to your branch',
            'message' => "{$booking['booking_number']} was moved to {$resolution['branch']['branch_name']}. Reason: {$reason}",
            'push_message' => "{$booking['booking_number']} moved to {$resolution['branch']['branch_name']}.",
            'redirect_path' => '/dashboard/bookings',
            'dedupe_key' => 'booking-relocated-target-' . $bookingId . '-' . $recipientId . '-' . time(),
            'force_in_app' => true,
        ]);
    }

    echo json_encode([
        'success' => true,
        'message' => 'Booking relocated. Existing price and payment were preserved.',
        'branchId' => $resolvedBranchId,
        'branchName' => $resolution['branch']['branch_name'],
    ]);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    $status = match (true) {
        $e instanceof InvalidArgumentException => 422,
        $e instanceof DomainException => 409,
        $e instanceof OutOfBoundsException => 404,
        default => 500,
    };
    http_response_code($status);
    echo json_encode(['message' => $status === 500 ? 'Failed to relocate booking.' : $e->getMessage()]);
}
