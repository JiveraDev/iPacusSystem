<?php

/** @var PDO $pdo */
require_once __DIR__ . '/db.php';

header('Content-Type: application/json');

function account_profile_json(array $payload, int $statusCode = 200): void
{
    http_response_code($statusCode);
    echo json_encode($payload);
    exit;
}

function account_profile_normalize_role($role): string
{
    return strtolower(str_replace([' ', '-'], '_', trim((string)$role)));
}

function account_profile_require_super_admin(array $payload): void
{
    $role = account_profile_normalize_role($payload['role'] ?? ($_SERVER['HTTP_X_USER_ROLE'] ?? ''));
    if (!in_array($role, ['super_admin', 'superadmin'], true)) {
        account_profile_json(['message' => 'Only Super Admin can update personnel employment information.'], 403);
    }
}

$userId = (int)($_GET['userId'] ?? 0);
$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    $input = [];
}

if ($userId <= 0) {
    account_profile_json(['message' => 'User ID is required.'], 400);
}

account_profile_require_super_admin($input);

$position = trim((string)($input['position'] ?? $input['postionn'] ?? ''));
$employmentStatus = strtolower(trim((string)($input['employmentStatus'] ?? $input['employment_status'] ?? '')));
$validEmploymentStatuses = ['full-time', 'part-time', 'contract'];

if ($position === '' || strlen($position) > 250 || !in_array($employmentStatus, $validEmploymentStatuses, true)) {
    account_profile_json(['message' => 'A valid position and employment status are required.'], 422);
}

try {
    $stmt = $pdo->prepare("
        SELECT u.user_id, u.role
        FROM users u
        JOIN admin_profiles a ON a.user_id = u.user_id
        WHERE u.user_id = ?
        LIMIT 1
    ");
    $stmt->execute([$userId]);
    $account = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$account) {
        account_profile_json(['message' => 'Personnel account not found.'], 404);
    }

    $accountRole = account_profile_normalize_role($account['role'] ?? '');
    if ($accountRole !== 'admin') {
        account_profile_json(['message' => 'Only staff personnel employment information can be updated here.'], 422);
    }

    $update = $pdo->prepare("
        UPDATE admin_profiles
        SET postionn = ?, employment_status = ?
        WHERE user_id = ?
    ");
    $update->execute([$position, $employmentStatus, $userId]);

    $select = $pdo->prepare("
        SELECT u.*, a.*
        FROM users u
        JOIN admin_profiles a ON a.user_id = u.user_id
        WHERE u.user_id = ?
        LIMIT 1
    ");
    $select->execute([$userId]);

    account_profile_json([
        'message' => 'Personnel employment information updated successfully.',
        'account' => $select->fetch(PDO::FETCH_ASSOC),
    ]);
} catch (Throwable $e) {
    account_profile_json(['message' => 'Failed to update personnel employment information: ' . $e->getMessage()], 500);
}
