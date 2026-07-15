<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/coparent_request_helpers.php';

$method = $_SERVER['REQUEST_METHOD'];
$input = json_decode(file_get_contents('php://input'), true) ?: [];

function coparent_request_error(int $status, string $message): void
{
    http_response_code($status);
    echo json_encode(['success' => false, 'message' => $message]);
    exit;
}

function coparent_request_current_user_id(): int
{
    return (int)($_SERVER['IPAWCUS_USER_ID'] ?? 0);
}

function coparent_request_current_role(): string
{
    return strtolower(trim((string)($_SERVER['IPAWCUS_USER_ROLE'] ?? '')));
}

function coparent_request_can_view(array $request, int $userId, string $role): bool
{
    return $role === 'super_admin'
        || $userId === (int)$request['primaryOwnerUserId']
        || $userId === (int)$request['requesterUserId'];
}

function coparent_request_can_decide(array $request, int $userId, string $role): bool
{
    return $role === 'super_admin' || $userId === (int)$request['primaryOwnerUserId'];
}

try {
    coparent_ensure_schema($pdo);

    $requestId = (int)($_GET['requestId'] ?? $input['requestId'] ?? $input['request_id'] ?? 0);
    if ($requestId <= 0) {
        coparent_request_error(400, 'Co-parent request ID is required.');
    }

    $userId = coparent_request_current_user_id();
    $role = coparent_request_current_role();

    if ($userId <= 0) {
        coparent_request_error(401, 'Please log in again to continue.');
    }

    $request = coparent_request_detail($pdo, $requestId);
    if (!$request) {
        coparent_request_error(404, 'Co-parent request was not found.');
    }

    if (!coparent_request_can_view($request, $userId, $role)) {
        coparent_request_error(403, 'You are not allowed to view this co-parent request.');
    }

    if ($method === 'GET') {
        echo json_encode([
            'success' => true,
            'request' => $request,
        ]);
        exit;
    }

    if ($method !== 'PATCH' && $method !== 'POST') {
        coparent_request_error(405, 'Method not allowed.');
    }

    $action = strtolower(trim((string)($input['action'] ?? '')));
    if (!in_array($action, ['approve', 'decline', 'cancel'], true)) {
        coparent_request_error(400, 'Action must be approve, decline, or cancel.');
    }

    if ($action === 'cancel' && $userId !== (int)$request['requesterUserId'] && $role !== 'super_admin') {
        coparent_request_error(403, 'Only the requester can cancel this co-parent request.');
    }

    if (in_array($action, ['approve', 'decline'], true) && !coparent_request_can_decide($request, $userId, $role)) {
        coparent_request_error(403, 'Only the primary owner can approve or decline this co-parent request.');
    }

    if ($request['status'] !== 'pending') {
        echo json_encode([
            'success' => true,
            'message' => 'This co-parent request is already closed.',
            'request' => $request,
        ]);
        exit;
    }

    $pdo->beginTransaction();

    $lockStmt = $pdo->prepare("SELECT * FROM pet_coparent_requests WHERE request_id = ? FOR UPDATE");
    $lockStmt->execute([$requestId]);
    $locked = $lockStmt->fetch(PDO::FETCH_ASSOC);

    if (!$locked) {
        $pdo->rollBack();
        coparent_request_error(404, 'Co-parent request was not found.');
    }

    if ($locked['status'] !== 'pending') {
        $pdo->commit();
        $request = coparent_request_detail($pdo, $requestId);
        echo json_encode([
            'success' => true,
            'message' => 'This co-parent request is already closed.',
            'request' => $request,
        ]);
        exit;
    }

    $status = match ($action) {
        'approve' => 'approved',
        'decline' => 'declined',
        default => 'cancelled',
    };
    $note = trim((string)($input['note'] ?? ''));

    if ($action === 'approve') {
        coparent_insert_ownership($pdo, (int)$locked['pet_id'], (int)$locked['requester_user_id']);
    }

    $updateStmt = $pdo->prepare("
        UPDATE pet_coparent_requests
        SET status = ?,
            decision_note = ?,
            decided_at = NOW(),
            updated_at = NOW()
        WHERE request_id = ?
    ");
    $updateStmt->execute([$status, $note, $requestId]);

    $pdo->commit();

    $request = coparent_request_detail($pdo, $requestId);
    if ($action === 'approve' || $action === 'decline') {
        coparent_notify_requester_result($pdo, $request, $status);
    }

    echo json_encode([
        'success' => true,
        'message' => $action === 'approve'
            ? 'Co-parent request approved.'
            : ($action === 'decline' ? 'Co-parent request declined.' : 'Co-parent request cancelled.'),
        'request' => $request,
    ]);
} catch (Throwable $error) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    coparent_request_error(500, 'Co-parent request failed: ' . $error->getMessage());
}
