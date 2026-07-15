<?php

/** @var PDO $pdo */
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/account_status_helpers.php';

$userId = $_GET['userId'] ?? null;
$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    $input = [];
}
$isActive = filter_var($input['is_active'] ?? 0, FILTER_VALIDATE_BOOLEAN) ? 1 : 0;
$type = strtolower($input['type'] ?? '');

if (!$userId) {
    http_response_code(400);
    echo json_encode(['message' => 'User ID is required.']);
    exit;
}

try {
    $userStmt = $pdo->prepare("SELECT role FROM users WHERE user_id = ?");
    $userStmt->execute([$userId]);
    $user = $userStmt->fetch();

    if (!$user) {
        http_response_code(404);
        echo json_encode(['message' => 'Account not found.']);
        exit;
    }

    $role = strtolower($user['role'] ?? '');

    if ($type === 'vet' || $role === 'veterinarian') {
        $stmt = $pdo->prepare("UPDATE veterinarian_profiles SET is_active = ? WHERE user_id = ?");
    } else {
        if (!ensureAdminAccountStatusColumn($pdo)) {
            http_response_code(500);
            echo json_encode(['message' => 'Admin account status column is missing.']);
            exit;
        }

        $stmt = $pdo->prepare("UPDATE admin_profiles SET is_active = ? WHERE user_id = ?");
    }
    
    $stmt->execute([$isActive, $userId]);

    if ($isActive && accountColumnExists($pdo, 'users', 'account_status')) {
        $reactivateColumns = ['account_status = ?'];
        $reactivateParams = ['active'];

        if (accountColumnExists($pdo, 'users', 'deactivated_at')) {
            $reactivateColumns[] = 'deactivated_at = NULL';
        }

        if (accountColumnExists($pdo, 'users', 'deactivated_by_user_id')) {
            $reactivateColumns[] = 'deactivated_by_user_id = NULL';
        }

        if (accountColumnExists($pdo, 'users', 'deactivation_reason')) {
            $reactivateColumns[] = 'deactivation_reason = NULL';
        }

        $reactivateParams[] = $userId;
        $reactivateStmt = $pdo->prepare('UPDATE users SET ' . implode(', ', $reactivateColumns) . ' WHERE user_id = ?');
        $reactivateStmt->execute($reactivateParams);
    }

    echo json_encode([
        'message' => 'Account status updated successfully.',
        'user_id' => (int)$userId,
        'is_active' => $isActive
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['message' => 'Failed to update status: ' . $e->getMessage()]);
}
