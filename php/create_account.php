<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/account_status_helpers.php';
require_once __DIR__ . '/branch_helpers.php';
require_once __DIR__ . '/workflow_guard_helpers.php';
require_once __DIR__ . '/notification_helpers.php';

function createAccountUserColumnExists(PDO $pdo, string $columnName): bool
{
    static $columnCache = [];

    if (array_key_exists($columnName, $columnCache)) {
        return $columnCache[$columnName];
    }

    $stmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 'users'
          AND column_name = ?
    ");
    $stmt->execute([$columnName]);
    $columnCache[$columnName] = (int)$stmt->fetchColumn() > 0;

    return $columnCache[$columnName];
}

function createAccountNormalizeRole(?string $role): ?string
{
    $normalized = strtolower(str_replace([' ', '-'], '_', trim((string)$role)));

    return match ($normalized) {
        'veterinarian', 'vet' => 'Veterinarian',
        'admin', 'staff' => 'Admin',
        'super_admin', 'superadmin' => 'Super Admin',
        default => null,
    };
}

// Get JSON input
$input = json_decode(file_get_contents('php://input'), true);

$firstName = $input['firstName'] ?? null;
$lastName = $input['lastName'] ?? null;
$email = $input['email'] ?? null;
$password = $input['password'] ?? null;
$role = createAccountNormalizeRole($input['role'] ?? null);
$masterKey = (string)($input['masterKey'] ?? '');
$branchId = isset($input['branchId']) && is_numeric($input['branchId']) ? (int)$input['branchId'] : null;

$expectedMasterKey = trim((string)(getenv('MASTER_KEY') ?: getenv('VITE_MASTER_KEY') ?: ''));
if ($expectedMasterKey === '') {
    http_response_code(500);
    echo json_encode(['message' => 'Master key is not configured.']);
    exit;
}

if ($masterKey === '' || !hash_equals($expectedMasterKey, $masterKey)) {
    http_response_code(403);
    echo json_encode(['message' => 'Invalid Master Key. Authorization denied.']);
    exit;
}

// Common Profile Fields
$hireDate = $input['hireDate'] ?? date('Y-m-d');

// Vet Specific
$licenseNumber = $input['licenseNumber'] ?? null;
$specialization = $input['specialization'] ?? 'General Practice';

// Staff Specific
$position = $role === 'Super Admin' ? 'Super Admin' : ($input['position'] ?? 'Staff');
$employmentStatus = $input['employmentStatus'] ?? 'full-time';

if (!$firstName || !$lastName || !$email || !$password || !$role) {
    http_response_code(400);
    echo json_encode(['message' => 'Missing required fields for account creation.']);
    exit;
}

branch_require_schema($pdo);
if ($role === 'Admin' && (!$branchId || !branch_fetch($pdo, $branchId))) {
    http_response_code(422);
    echo json_encode(['message' => 'Select the branch this Admin account will manage.']);
    exit;
}
if (!$branchId) {
    $branchId = branch_main_id($pdo);
}

try {
    $currentUser = ipawcus_guard_current_user($pdo);
    $adminHasActiveColumn = $role !== 'Veterinarian' ? ensureAdminAccountStatusColumn($pdo) : false;

    $pdo->beginTransaction();

    // Hash the password for security
    $hashedPassword = password_hash($password, PASSWORD_DEFAULT);

    $userColumns = [
        'first_Name',
        'last_Name',
        'mail_Address',
        'personal_Address',
        'user_password',
        'phoneNumber',
        'role',
        'preferred_branch_id',
        'created_at'
    ];
    $userPlaceholders = ['?', '?', '?', '?', '?', '?', '?', '?', 'NOW()'];
    $userParams = [
        $firstName,
        $lastName,
        $email,
        'Clinic Address Placeholder',
        $hashedPassword,
        '+639',
        $role,
        $branchId
    ];

    if (createAccountUserColumnExists($pdo, 'email_verified_at')) {
        $userColumns[] = 'email_verified_at';
        $userPlaceholders[] = 'NOW()';
    }

    $branchAssignment = $pdo->prepare("
        INSERT INTO user_branch_assignments (user_id, branch_id, is_primary, is_active, assigned_by_user_id)
        VALUES (?, ?, 1, 1, ?)
        ON DUPLICATE KEY UPDATE is_primary = 1, is_active = 1, ended_at = NULL, assigned_by_user_id = VALUES(assigned_by_user_id)
    ");
    // 1. Insert into users table. Admin-created staff accounts are trusted as verified.
    $userStmt = $pdo->prepare(sprintf(
        'INSERT INTO users (`%s`) VALUES (%s)',
        implode('`, `', $userColumns),
        implode(', ', $userPlaceholders)
    ));
    $userStmt->execute($userParams);
    $userId = $pdo->lastInsertId();
    $branchAssignment->execute([$userId, $branchId, ipawcus_guard_user_id($currentUser)]);

    if ($role === 'Veterinarian') {
        // 2. Insert into veterinarian_profiles
        $vetId = 'VET-' . strtoupper(bin2hex(random_bytes(3)));
        $vetStmt = $pdo->prepare("
            INSERT INTO veterinarian_profiles (user_id, veterinarian_id, prc_license_number, specialization, hire_date, is_active) 
            VALUES (?, ?, ?, ?, ?, 1)
        ");
        $vetStmt->execute([$userId, $vetId, $licenseNumber, $specialization, $hireDate]);
    } else {
        // 3. Insert into admin_profiles for staff and Super Admin profile compatibility.
        $empId = 'EMP-' . strtoupper(bin2hex(random_bytes(3)));
        if ($adminHasActiveColumn) {
            $adminStmt = $pdo->prepare("
                INSERT INTO admin_profiles (user_id, employee_id, hire_date, employment_status, postionn, is_active) 
                VALUES (?, ?, ?, ?, ?, 1)
            ");
            $adminStmt->execute([$userId, $empId, $hireDate, $employmentStatus, $position]);
        } else {
            $adminStmt = $pdo->prepare("
                INSERT INTO admin_profiles (user_id, employee_id, hire_date, employment_status, postionn) 
                VALUES (?, ?, ?, ?, ?)
            ");
            $adminStmt->execute([$userId, $empId, $hireDate, $employmentStatus, $position]);
        }
    }

    $pdo->commit();

    try {
        $branch = branch_fetch($pdo, (int)$branchId);
        $accountName = trim("{$firstName} {$lastName}");
        $branchName = trim((string)($branch['branch_name'] ?? 'Main Clinic')) ?: 'Main Clinic';
        notification_send_super_admin_governance_event($pdo, [
            'type' => 'personnel_account_created',
            'category' => 'account_updates',
            'title' => 'Personnel account created',
            'message' => "{$accountName} was created as {$role} and assigned to {$branchName}.",
            'push_message' => "New {$role} account: {$accountName}.",
            'redirect_path' => '/dashboard/accounts',
            'dedupe_key' => "personnel-account-created-{$userId}",
        ]);
    } catch (Throwable $notificationError) {
        error_log('Account creation governance notification failed: ' . $notificationError->getMessage());
    }

    echo json_encode([
        'message' => 'Account created successfully.',
        'user_id' => $userId,
        'branch_id' => $branchId
    ]);

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['message' => 'Failed to create account: ' . $e->getMessage()]);
}
