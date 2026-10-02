<?php

/** @var PDO $pdo */
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/account_status_helpers.php';
require_once __DIR__ . '/notification_helpers.php';

$userId = $_GET['userId'] ?? null;
$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    $input = [];
}
$isActive = filter_var($input['is_active'] ?? 0, FILTER_VALIDATE_BOOLEAN) ? 1 : 0;

if (!$userId) {
    http_response_code(400);
    echo json_encode(['message' => 'User ID is required.']);
    exit;
}

try {
    $userStmt = $pdo->prepare("SELECT role, first_Name, last_Name, mail_Address FROM users WHERE user_id = ?");
    $userStmt->execute([$userId]);
    $user = $userStmt->fetch();

    if (!$user) {
        http_response_code(404);
        echo json_encode(['message' => 'Account not found.']);
        exit;
    }

    $normalizedRole = strtolower(str_replace([' ', '-'], '_', trim((string)($user['role'] ?? ''))));
    if (!$isActive && in_array($normalizedRole, ['super_admin', 'superadmin'], true)) {
        http_response_code(422);
        echo json_encode(['message' => 'Super Admin accounts cannot be archived from this action.']);
        exit;
    }

    $actorUserId = (int)($_SERVER['IPAWCUS_USER_ID'] ?? 0);
    if ($actorUserId > 0 && $actorUserId === (int)$userId) {
        http_response_code(422);
        echo json_encode(['message' => 'You cannot archive the account you are currently using.']);
        exit;
    }

    $pdo->beginTransaction();

    if (accountColumnExists($pdo, 'users', 'account_status')) {
        $reactivateColumns = ['account_status = ?'];
        $reactivateParams = [$isActive ? 'active' : 'archived'];

        if (accountColumnExists($pdo, 'users', 'deactivated_at')) {
            $reactivateColumns[] = $isActive ? 'deactivated_at = NULL' : 'deactivated_at = NOW()';
        }

        if (accountColumnExists($pdo, 'users', 'deactivated_by_user_id')) {
            $reactivateColumns[] = 'deactivated_by_user_id = NULL';
        }

        if (accountColumnExists($pdo, 'users', 'deactivation_reason')) {
            $reactivateColumns[] = $isActive ? 'deactivation_reason = NULL' : "deactivation_reason = 'Archived by Super Admin'";
        }

        $reactivateParams[] = $userId;
        $reactivateStmt = $pdo->prepare('UPDATE users SET ' . implode(', ', $reactivateColumns) . ' WHERE user_id = ?');
        $reactivateStmt->execute($reactivateParams);
    }

    $profileTable = match ($normalizedRole) {
        'admin' => 'admin_profiles',
        'veterinarian', 'vet' => 'veterinarian_profiles',
        default => '',
    };
    if ($profileTable !== '' && accountColumnExists($pdo, $profileTable, 'is_active')) {
        $profileStatusStmt = $pdo->prepare("UPDATE {$profileTable} SET is_active = ? WHERE user_id = ?");
        $profileStatusStmt->execute([$isActive, $userId]);
    }

    if (!$isActive) {
        accountRevokeAccessTokens($pdo, (int)$userId);
    }

    $pdo->commit();

    try {
        $accountName = trim((string)(($user['first_Name'] ?? '') . ' ' . ($user['last_Name'] ?? '')))
            ?: trim((string)($user['mail_Address'] ?? 'Personnel account'));
        $statusLabel = $isActive ? 'restored' : 'archived';
        notification_send_super_admin_governance_event($pdo, [
            'type' => 'personnel_account_status_updated',
            'category' => 'account_updates',
            'title' => 'Personnel account status changed',
            'message' => "{$accountName} ({$user['role']}) was {$statusLabel}.",
            'push_message' => "{$accountName} was {$statusLabel}.",
            'redirect_path' => '/dashboard/accounts',
            'dedupe_key' => 'personnel-account-status-' . (int)$userId . '-' . $isActive . '-' . date('YmdHis'),
        ]);
    } catch (Throwable $notificationError) {
        error_log('Personnel status notification failed: ' . $notificationError->getMessage());
    }

    echo json_encode([
        'message' => $isActive ? 'Account restored.' : 'Account archived and access blocked.',
        'user_id' => (int)$userId,
        'is_active' => $isActive
    ]);

} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['message' => 'Failed to update status: ' . $e->getMessage()]);
}
