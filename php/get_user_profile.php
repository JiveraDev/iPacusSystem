<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/branch_helpers.php';
require_once __DIR__ . '/workflow_guard_helpers.php';

header("Content-Type: application/json");

$userId = $_GET['userId'] ?? null;
$role = $_GET['role'] ?? null;

if (!$userId) {
    http_response_code(400);
    echo json_encode(['message' => 'User ID is required.']);
    exit;
}

try {
    $currentUser = ipawcus_guard_current_user($pdo);
    $currentRole = ipawcus_guard_role($currentUser);
    if ($currentRole !== 'super_admin' && ipawcus_guard_user_id($currentUser) !== (int)$userId) {
        ipawcus_guard_error(403, 'You can view only your own profile.');
    }

    $roleStmt = $pdo->prepare('SELECT role FROM users WHERE user_id = ? LIMIT 1');
    $roleStmt->execute([(int)$userId]);
    $storedRole = $roleStmt->fetchColumn();
    if ($storedRole === false) {
        http_response_code(404);
        echo json_encode(['message' => 'Profile not found.']);
        exit;
    }
    $normalizedRole = branch_normalize_role((string)$storedRole);

    if ($normalizedRole === 'veterinarian' || $normalizedRole === 'vet') {
        $sql = "SELECT u.*, v.*, branch.branch_name AS preferred_branch_name
                FROM users u 
                LEFT JOIN veterinarian_profiles v ON u.user_id = v.user_id 
                LEFT JOIN branches branch ON branch.branch_id = u.preferred_branch_id
                WHERE u.user_id = ?";
    } elseif ($normalizedRole === 'admin' || $normalizedRole === 'super_admin' || $normalizedRole === 'superadmin') {
        $sql = "SELECT u.*, a.*, branch.branch_name AS preferred_branch_name
                FROM users u 
                LEFT JOIN admin_profiles a ON u.user_id = a.user_id 
                LEFT JOIN branches branch ON branch.branch_id = u.preferred_branch_id
                WHERE u.user_id = ?";
    } else {
        $sql = "SELECT u.*
                FROM users u
                WHERE u.user_id = ?";
    }

    $stmt = $pdo->prepare($sql);
    $stmt->execute([$userId]);
    $profile = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$profile) {
        http_response_code(404);
        echo json_encode(['message' => 'Profile not found.']);
        exit;
    }

    echo json_encode($profile);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['message' => 'Failed to fetch profile: ' . $e->getMessage()]);
}
