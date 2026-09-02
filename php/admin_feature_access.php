<?php

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/role_access.php';

header('Content-Type: application/json');

function admin_feature_access_error(int $status, string $message, string $code): void
{
    http_response_code($status);
    echo json_encode(['success' => false, 'message' => $message, 'code' => $code]);
    exit;
}

function admin_feature_access_require_schema(PDO $pdo): void
{
    if (!ipawcus_admin_feature_permissions_table_exists($pdo)) {
        admin_feature_access_error(
            503,
            'Admin access controls are not installed yet. Run DDL/20260902_02_admin_feature_access.sql, then try again.',
            'admin_feature_access_schema_missing'
        );
    }
}

function admin_feature_access_target(PDO $pdo, int $userId): array
{
    $stmt = $pdo->prepare("
        SELECT user_id, first_Name, last_Name, mail_Address, role
        FROM users
        WHERE user_id = ?
        LIMIT 1
    ");
    $stmt->execute([$userId]);
    $target = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$target || ipawcus_access_normalize_role($target['role'] ?? '') !== 'admin') {
        admin_feature_access_error(404, 'Select a valid Admin account.', 'admin_feature_access_target_invalid');
    }

    return $target;
}

function admin_feature_access_response(PDO $pdo, array $target): array
{
    return [
        'success' => true,
        'account' => [
            'userId' => (int)$target['user_id'],
            'name' => trim((string)($target['first_Name'] ?? '') . ' ' . (string)($target['last_Name'] ?? '')),
            'email' => (string)($target['mail_Address'] ?? ''),
            'role' => (string)($target['role'] ?? 'Admin'),
        ],
        'permissions' => ipawcus_admin_feature_permissions($pdo, (int)$target['user_id']),
        'featureKeys' => ipawcus_admin_feature_keys(),
    ];
}

$currentUser = ipawcus_require_current_api_user($pdo);
$currentRole = ipawcus_access_normalize_role($currentUser['role'] ?? '');
$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));

try {
    admin_feature_access_require_schema($pdo);

    if ($method === 'GET') {
        $requestedUserId = (int)($_GET['userId'] ?? 0);
        if ($currentRole === 'admin') {
            if ($requestedUserId > 0 && $requestedUserId !== (int)$currentUser['user_id']) {
                admin_feature_access_error(403, 'Admin accounts can only read their own feature access.', 'admin_feature_access_scope_forbidden');
            }
            $requestedUserId = (int)$currentUser['user_id'];
        } elseif ($currentRole !== 'super_admin') {
            admin_feature_access_error(403, 'Only Admin and Super Admin accounts can read feature access.', 'admin_feature_access_forbidden');
        }

        if ($requestedUserId <= 0) {
            admin_feature_access_error(422, 'Select an Admin account.', 'admin_feature_access_target_required');
        }

        echo json_encode(admin_feature_access_response($pdo, admin_feature_access_target($pdo, $requestedUserId)));
        exit;
    }

    if ($method !== 'PUT') {
        admin_feature_access_error(405, 'Method not allowed.', 'method_not_allowed');
    }

    if ($currentRole !== 'super_admin') {
        admin_feature_access_error(403, 'Only a Super Admin can change Admin feature access.', 'admin_feature_access_update_forbidden');
    }

    $payload = json_decode(file_get_contents('php://input'), true) ?: [];
    $targetUserId = (int)($payload['userId'] ?? $payload['user_id'] ?? 0);
    $submitted = $payload['permissions'] ?? null;
    if ($targetUserId <= 0 || !is_array($submitted)) {
        admin_feature_access_error(422, 'An Admin account and its feature permissions are required.', 'admin_feature_access_invalid_payload');
    }

    $target = admin_feature_access_target($pdo, $targetUserId);
    $keys = ipawcus_admin_feature_keys();
    $permissions = [];
    foreach ($keys as $key) {
        if (!array_key_exists($key, $submitted)) {
            admin_feature_access_error(422, "Missing access choice for {$key}.", 'admin_feature_access_incomplete');
        }
        $permissions[$key] = filter_var($submitted[$key], FILTER_VALIDATE_BOOLEAN);
    }

    $previous = ipawcus_admin_feature_permissions($pdo, $targetUserId);
    $pdo->beginTransaction();

    $delete = $pdo->prepare('DELETE FROM admin_feature_permissions WHERE user_id = ?');
    $delete->execute([$targetUserId]);

    $insert = $pdo->prepare("
        INSERT INTO admin_feature_permissions (user_id, feature_key, is_allowed, updated_by_user_id)
        VALUES (?, ?, ?, ?)
    ");
    foreach ($permissions as $key => $allowed) {
        $insert->execute([$targetUserId, $key, $allowed ? 1 : 0, (int)$currentUser['user_id']]);
    }

    $auditTable = $pdo->query("
        SELECT COUNT(*)
        FROM information_schema.tables
        WHERE table_schema = DATABASE()
          AND table_name = 'admin_feature_permission_audit'
    ")->fetchColumn();
    if ((int)$auditTable > 0) {
        $audit = $pdo->prepare("
            INSERT INTO admin_feature_permission_audit
                (target_user_id, changed_by_user_id, previous_permissions, new_permissions)
            VALUES (?, ?, ?, ?)
        ");
        $audit->execute([
            $targetUserId,
            (int)$currentUser['user_id'],
            json_encode($previous),
            json_encode($permissions),
        ]);
    }

    $pdo->commit();
    echo json_encode(admin_feature_access_response($pdo, $target));
} catch (Throwable $error) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('Admin feature access error: ' . $error->getMessage());
    admin_feature_access_error(500, 'Admin feature access could not be updated. Please try again.', 'admin_feature_access_failed');
}
