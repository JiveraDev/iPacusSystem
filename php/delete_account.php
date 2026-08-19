<?php

/** @var PDO $pdo */
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/account_status_helpers.php';
require_once __DIR__ . '/notification_helpers.php';

function delete_account_json(array $payload, int $statusCode = 200): void
{
    http_response_code($statusCode);
    echo json_encode($payload);
    exit;
}

function delete_account_column_exists(PDO $pdo, string $table, string $column): bool
{
    $stmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = ?
          AND column_name = ?
    ");
    $stmt->execute([$table, $column]);

    return (int)$stmt->fetchColumn() > 0;
}

function delete_account_required_sql(): string
{
    return 'Run the approved archive-status deployment SQL before archiving accounts.';
}

function delete_account_normalize_role(?string $role): string
{
    return strtolower(str_replace([' ', '-'], '_', trim((string)$role)));
}

function delete_account_name(array $account): string
{
    $name = trim((string)(($account['first_Name'] ?? '') . ' ' . ($account['last_Name'] ?? '')));
    return $name !== '' ? $name : (string)($account['mail_Address'] ?? 'Account');
}

function delete_account_email_text(string $title, string $intro, array $rows): string
{
    $lines = [$title, '', $intro, ''];
    foreach ($rows as $label => $value) {
        if ($value !== null && $value !== '') {
            $lines[] = "{$label}: {$value}";
        }
    }

    return trim(implode("\n", $lines));
}

function delete_account_notify_removed_user(PDO $pdo, array $account, string $reason, string $actorName): void
{
    $userId = (int)($account['user_id'] ?? 0);
    if ($userId <= 0) {
        return;
    }

    $accountName = delete_account_name($account);
    $title = 'Account archived';
    $intro = "Hello {$accountName}, your iPawcus account has been archived by clinic administration. Your records remain protected and the account can be restored when appropriate. If you believe this was a mistake, please contact the clinic.";
    $rows = [
        'Account' => $accountName,
        'Role' => $account['role'] ?? '',
        'Archived by' => $actorName,
        'Reason' => $reason,
        'Recorded at' => date('F j, Y g:i A'),
    ];
    $emailHtml = notification_email_template($title, $intro, $rows, null, "Account: {$accountName}");

    notification_create_event($pdo, [
        'user_id' => $userId,
        'type' => 'account_removed',
        'category' => 'account_updates',
        'title' => $title,
        'message' => 'Your account has been archived by clinic administration.',
        'push_title' => $title,
        'push_message' => 'Your account has been archived by clinic administration.',
        'force_in_app' => true,
        'dedupe_key' => "account-removed-{$userId}",
        'email_subject' => 'Your iPawcus account was archived',
        'email_html' => $emailHtml,
        'email_text' => delete_account_email_text($title, $intro, $rows),
    ]);
}

function delete_account_notify_super_admins(PDO $pdo, array $account, string $reason, string $actorName): void
{
    $accountName = delete_account_name($account);
    $title = 'Account archived';
    $message = "{$accountName} was archived from active account use.";
    $rows = [
        'Account' => $accountName,
        'Email' => $account['mail_Address'] ?? '',
        'Role' => $account['role'] ?? '',
        'Archived by' => $actorName,
        'Reason' => $reason,
    ];
    $emailHtml = notification_email_template($title, $message, $rows, null, "Account: {$accountName}");

    notification_create_event_for_roles($pdo, ['super_admin', 'superadmin'], [
        'type' => 'account_removed_audit',
        'category' => 'account_updates',
        'title' => $title,
        'message' => $message,
        'push_title' => $title,
        'push_message' => $message,
        'redirect_path' => '/dashboard/accounts',
        'force_in_app' => true,
        'dedupe_key' => 'account-removed-audit-' . (int)($account['user_id'] ?? 0) . '-' . date('YmdHis'),
        'email_subject' => "Account archived: {$accountName}",
        'email_html' => $emailHtml,
        'email_text' => delete_account_email_text($title, $message, $rows),
    ]);
}

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    $input = [];
}

$userId = (int)($_GET['userId'] ?? 0);
$masterKey = (string)($input['masterKey'] ?? '');
$reason = trim((string)($input['reason'] ?? ''));
$actorUserId = (int)($_SERVER['IPAWCUS_USER_ID'] ?? 0);

if ($userId <= 0) {
    delete_account_json(['success' => false, 'message' => 'User ID is required.'], 400);
}

$expectedMasterKey = trim((string)(getenv('MASTER_KEY') ?: getenv('VITE_MASTER_KEY') ?: ''));
if ($expectedMasterKey === '') {
    delete_account_json(['success' => false, 'message' => 'Master key is not configured.'], 500);
}

if ($masterKey === '' || !hash_equals($expectedMasterKey, $masterKey)) {
    delete_account_json(['success' => false, 'message' => 'Invalid Master Key. Authorization denied.'], 403);
}

if (!delete_account_column_exists($pdo, 'users', 'account_status')) {
    delete_account_json([
        'success' => false,
        'message' => 'Database change required before account archiving can be used.',
        'required_sql' => delete_account_required_sql(),
    ], 409);
}

if ($actorUserId > 0 && $actorUserId === $userId) {
    delete_account_json(['success' => false, 'message' => 'You cannot archive the account you are currently using.'], 422);
}

try {
    $accountStmt = $pdo->prepare("
        SELECT user_id, first_Name, last_Name, mail_Address, role, account_status
        FROM users
        WHERE user_id = ?
        LIMIT 1
    ");
    $accountStmt->execute([$userId]);
    $account = $accountStmt->fetch(PDO::FETCH_ASSOC);

    if (!$account) {
        delete_account_json(['success' => false, 'message' => 'Account not found.'], 404);
    }

    $normalizedRole = delete_account_normalize_role($account['role'] ?? '');
    if (in_array($normalizedRole, ['super_admin', 'superadmin'], true)) {
        delete_account_json(['success' => false, 'message' => 'Super Admin accounts cannot be archived from this action.'], 422);
    }

    $actorName = 'Super Admin';
    if ($actorUserId > 0) {
        $actorStmt = $pdo->prepare("
            SELECT first_Name, last_Name, mail_Address
            FROM users
            WHERE user_id = ?
            LIMIT 1
        ");
        $actorStmt->execute([$actorUserId]);
        $actor = $actorStmt->fetch(PDO::FETCH_ASSOC);
        if ($actor) {
            $actorName = delete_account_name($actor);
        }
    }

    $deleteReason = $reason !== '' ? $reason : 'Archived by Super Admin';

    $pdo->beginTransaction();

    $setParts = ['account_status = ?'];
    $params = ['archived'];

    if (delete_account_column_exists($pdo, 'users', 'deactivated_at')) {
        $setParts[] = 'deactivated_at = NOW()';
    }

    if (delete_account_column_exists($pdo, 'users', 'deactivation_reason')) {
        $setParts[] = 'deactivation_reason = ?';
        $params[] = $deleteReason;
    }

    $params[] = $userId;
    $deleteStmt = $pdo->prepare('UPDATE users SET ' . implode(', ', $setParts) . ' WHERE user_id = ?');
    $deleteStmt->execute($params);

    if ($normalizedRole === 'veterinarian') {
        $profileStmt = $pdo->prepare('UPDATE veterinarian_profiles SET is_active = 0 WHERE user_id = ?');
        $profileStmt->execute([$userId]);
    } else {
        if (!ensureAdminAccountStatusColumn($pdo)) {
            throw new RuntimeException('Admin account status column is missing.');
        }
        $profileStmt = $pdo->prepare('UPDATE admin_profiles SET is_active = 0 WHERE user_id = ?');
        $profileStmt->execute([$userId]);
    }

    accountRevokeAccessTokens($pdo, $userId);

    $pdo->commit();

    try {
        delete_account_notify_removed_user($pdo, $account, $deleteReason, $actorName);
        delete_account_notify_super_admins($pdo, $account, $deleteReason, $actorName);
    } catch (Throwable $notificationError) {
        error_log('Account delete notification failed: ' . $notificationError->getMessage());
    }

    delete_account_json([
        'success' => true,
        'message' => 'Account archived.',
        'user_id' => $userId,
    ]);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    delete_account_json(['success' => false, 'message' => 'Failed to archive account: ' . $e->getMessage()], 500);
}
