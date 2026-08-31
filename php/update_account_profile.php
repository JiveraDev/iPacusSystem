<?php

/** @var PDO $pdo */
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/workflow_guard_helpers.php';
require_once __DIR__ . '/branch_helpers.php';
require_once __DIR__ . '/notification_helpers.php';

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

function account_profile_require_super_admin(PDO $pdo): array
{
    $currentUser = ipawcus_guard_current_user($pdo);
    if (ipawcus_guard_role($currentUser) !== 'super_admin') {
        account_profile_json(['message' => 'Only Super Admin can update personnel employment information and branch assignment.'], 403);
    }

    return $currentUser;
}

$userId = (int)($_GET['userId'] ?? 0);
$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    $input = [];
}

if ($userId <= 0) {
    account_profile_json(['message' => 'User ID is required.'], 400);
}

$currentUser = account_profile_require_super_admin($pdo);

$position = trim((string)($input['position'] ?? $input['postionn'] ?? ''));
$employmentStatus = strtolower(trim((string)($input['employmentStatus'] ?? $input['employment_status'] ?? '')));
$specialization = trim((string)($input['specialization'] ?? ''));
$licenseNumber = trim((string)($input['licenseNumber'] ?? $input['prc_license_number'] ?? ''));
$branchId = isset($input['branchId']) && is_numeric($input['branchId']) ? (int)$input['branchId'] : 0;
$validEmploymentStatuses = ['full-time', 'part-time', 'contract'];

if ($branchId <= 0) {
    account_profile_json(['message' => 'A valid assigned branch is required.'], 422);
}

try {
    branch_require_schema($pdo);
    if (!branch_fetch($pdo, $branchId)) {
        account_profile_json(['message' => 'Select an active branch for this Admin account.'], 422);
    }
    $stmt = $pdo->prepare('SELECT user_id, role FROM users WHERE user_id = ? LIMIT 1');
    $stmt->execute([$userId]);
    $account = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$account) {
        account_profile_json(['message' => 'Personnel account not found.'], 404);
    }

    $accountRole = account_profile_normalize_role($account['role'] ?? '');
    $isVeterinarian = in_array($accountRole, ['veterinarian', 'vet'], true);
    if (!$isVeterinarian && $accountRole !== 'admin') {
        account_profile_json(['message' => 'Only Admin and Veterinarian professional information can be updated here.'], 422);
    }
    if ($isVeterinarian && ($specialization === '' || $licenseNumber === '' || strlen($specialization) > 250 || strlen($licenseNumber) > 250)) {
        account_profile_json(['message' => 'A valid PRC license number and specialization are required.'], 422);
    }
    if (!$isVeterinarian && ($position === '' || strlen($position) > 250 || !in_array($employmentStatus, $validEmploymentStatuses, true))) {
        account_profile_json(['message' => 'A valid position and employment status are required.'], 422);
    }

    $pdo->beginTransaction();
    if ($isVeterinarian) {
        $update = $pdo->prepare('UPDATE veterinarian_profiles SET specialization = ?, prc_license_number = ? WHERE user_id = ?');
        $update->execute([$specialization, $licenseNumber, $userId]);
    } else {
        $update = $pdo->prepare('UPDATE admin_profiles SET postionn = ?, employment_status = ? WHERE user_id = ?');
        $update->execute([$position, $employmentStatus, $userId]);
    }

    $userUpdate = $pdo->prepare('UPDATE users SET preferred_branch_id = ? WHERE user_id = ?');
    $userUpdate->execute([$branchId, $userId]);

    $deactivateAssignments = $pdo->prepare("
        UPDATE user_branch_assignments
        SET is_primary = 0, is_active = 0, ended_at = NOW()
        WHERE user_id = ? AND branch_id <> ? AND is_active = 1
    ");
    $deactivateAssignments->execute([$userId, $branchId]);

    $assignBranch = $pdo->prepare("
        INSERT INTO user_branch_assignments
            (user_id, branch_id, is_primary, is_active, assigned_by_user_id, assigned_at, ended_at)
        VALUES (?, ?, 1, 1, ?, NOW(), NULL)
        ON DUPLICATE KEY UPDATE
            is_primary = 1,
            is_active = 1,
            assigned_by_user_id = VALUES(assigned_by_user_id),
            assigned_at = NOW(),
            ended_at = NULL
    ");
    $assignBranch->execute([$userId, $branchId, ipawcus_guard_user_id($currentUser)]);

    $profileTable = $isVeterinarian ? 'veterinarian_profiles' : 'admin_profiles';
    $select = $pdo->prepare("
        SELECT u.*, profile.*, branch.branch_name AS preferred_branch_name
        FROM users u
        JOIN {$profileTable} profile ON profile.user_id = u.user_id
        LEFT JOIN branches branch ON branch.branch_id = u.preferred_branch_id
        WHERE u.user_id = ?
        LIMIT 1
    ");
    $select->execute([$userId]);
    $updatedAccount = $select->fetch(PDO::FETCH_ASSOC);
    $pdo->commit();

    try {
        $accountName = trim((string)(($updatedAccount['first_Name'] ?? '') . ' ' . ($updatedAccount['last_Name'] ?? ''))) ?: 'Personnel account';
        $branchName = trim((string)($updatedAccount['preferred_branch_name'] ?? 'Main Clinic')) ?: 'Main Clinic';
        notification_send_super_admin_governance_event($pdo, [
            'type' => 'personnel_account_assignment_updated',
            'category' => 'account_updates',
            'title' => 'Personnel assignment updated',
            'message' => $isVeterinarian
                ? "{$accountName}'s professional information and assignment at {$branchName} were updated."
                : "{$accountName} is now {$position} ({$employmentStatus}) at {$branchName}.",
            'push_message' => "Personnel assignment updated for {$accountName}.",
            'redirect_path' => '/dashboard/accounts',
            'dedupe_key' => 'personnel-account-assignment-' . $userId . '-' . date('YmdHis'),
        ]);
    } catch (Throwable $notificationError) {
        error_log('Personnel assignment notification failed: ' . $notificationError->getMessage());
    }

    account_profile_json([
        'message' => $isVeterinarian
            ? 'Veterinarian professional information and branch assignment updated successfully.'
            : 'Personnel information and branch assignment updated successfully.',
        'account' => $updatedAccount,
    ]);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    account_profile_json(['message' => 'Failed to update personnel information and branch assignment: ' . $e->getMessage()], 500);
}
