<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/account_status_helpers.php';

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

// Get JSON input
$input = json_decode(file_get_contents('php://input'), true);

$firstName = $input['firstName'] ?? null;
$lastName = $input['lastName'] ?? null;
$email = $input['email'] ?? null;
$password = $input['password'] ?? null;
$role = $input['role'] ?? null; // 'Veterinarian' or 'Admin'
$masterKey = (string)($input['masterKey'] ?? '');

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
$position = $input['position'] ?? 'Staff';
$employmentStatus = $input['employmentStatus'] ?? 'full-time';

if (!$firstName || !$lastName || !$email || !$password || !$role) {
    http_response_code(400);
    echo json_encode(['message' => 'Missing required fields for account creation.']);
    exit;
}

try {
    $adminHasActiveColumn = $role === 'Veterinarian' ? false : ensureAdminAccountStatusColumn($pdo);

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
        'created_at'
    ];
    $userPlaceholders = ['?', '?', '?', '?', '?', '?', '?', 'NOW()'];
    $userParams = [
        $firstName,
        $lastName,
        $email,
        'Clinic Address Placeholder',
        $hashedPassword,
        '000-000-0000',
        $role
    ];

    if (createAccountUserColumnExists($pdo, 'email_verified_at')) {
        $userColumns[] = 'email_verified_at';
        $userPlaceholders[] = 'NOW()';
    }

    // 1. Insert into users table. Admin-created staff accounts are trusted as verified.
    $userStmt = $pdo->prepare(sprintf(
        'INSERT INTO users (`%s`) VALUES (%s)',
        implode('`, `', $userColumns),
        implode(', ', $userPlaceholders)
    ));
    $userStmt->execute($userParams);
    $userId = $pdo->lastInsertId();

    if ($role === 'Veterinarian') {
        // 2. Insert into veterinarian_profiles
        $vetId = 'VET-' . strtoupper(bin2hex(random_bytes(3)));
        $vetStmt = $pdo->prepare("
            INSERT INTO veterinarian_profiles (user_id, veterinarian_id, prc_license_number, specialization, hire_date, is_active) 
            VALUES (?, ?, ?, ?, ?, 1)
        ");
        $vetStmt->execute([$userId, $vetId, $licenseNumber, $specialization, $hireDate]);
    } else {
        // 3. Insert into admin_profiles
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

    echo json_encode([
        'message' => 'Account created successfully.',
        'user_id' => $userId
    ]);

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['message' => 'Failed to create account: ' . $e->getMessage()]);
}
