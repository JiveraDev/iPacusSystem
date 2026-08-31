<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/account_status_helpers.php';

header("Content-Type: application/json");

try {
    $adminHasActiveColumn = ensureAdminAccountStatusColumn($pdo);
    $staffActiveSelect = $adminHasActiveColumn ? 'a.is_active AS is_active' : '1 AS is_active';
    $hasUserAccountStatus = accountColumnExists($pdo, 'users', 'account_status');
    $accountStatusSelect = $hasUserAccountStatus ? 'u.account_status' : "'active' AS account_status";

    // 1. Fetch Veterinarians
    $vetSql = "SELECT u.*, v.*, {$accountStatusSelect}, v.is_active AS is_active,
                      branch.branch_name AS preferred_branch_name
               FROM users u 
               JOIN veterinarian_profiles v ON u.user_id = v.user_id 
               LEFT JOIN branches branch ON branch.branch_id = u.preferred_branch_id
               WHERE u.role = 'Veterinarian'";
    $vetStmt = $pdo->query($vetSql);
    $veterinarians = $vetStmt->fetchAll();

    // 2. Fetch Admin/Staff
    $staffSql = "SELECT u.*, a.*, {$accountStatusSelect}, {$staffActiveSelect},
                        branch.branch_name AS preferred_branch_name
                 FROM users u 
                 JOIN admin_profiles a ON u.user_id = a.user_id 
                 LEFT JOIN branches branch ON branch.branch_id = u.preferred_branch_id
                 WHERE u.role = 'Admin'";
    $staffStmt = $pdo->query($staffSql);
    $staff = $staffStmt->fetchAll();

    // 3. Fetch Super Admins
    $superAdminSql = "SELECT u.*, a.*, {$accountStatusSelect}, {$staffActiveSelect},
                             branch.branch_name AS preferred_branch_name
                      FROM users u
                      LEFT JOIN admin_profiles a ON u.user_id = a.user_id
                      LEFT JOIN branches branch ON branch.branch_id = u.preferred_branch_id
                      WHERE LOWER(REPLACE(REPLACE(TRIM(u.role), ' ', '_'), '-', '_')) IN ('super_admin', 'superadmin')";
    $superAdminStmt = $pdo->query($superAdminSql);
    $superAdmins = $superAdminStmt->fetchAll();

    echo json_encode([
        'veterinarians' => $veterinarians,
        'staff' => $staff,
        'superadmins' => $superAdmins
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['message' => 'Failed to fetch accounts: ' . $e->getMessage()]);
}
