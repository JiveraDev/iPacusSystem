<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/account_status_helpers.php';
require_once __DIR__ . '/auth_access_helpers.php';

const DEACTIVATED_ACCOUNT_MESSAGE = 'Account is archived. Contact the Super Admin if access should be restored.';

function isUserAccountArchived(PDO $pdo, array $user): bool
{
    $userId = (int)($user['user_id'] ?? 0);
    if ($userId <= 0 || !loginColumnExists($pdo, 'users', 'account_status')) {
        return false;
    }

    $stmt = $pdo->prepare('SELECT account_status FROM users WHERE user_id = ? LIMIT 1');
    $stmt->execute([$userId]);
    return in_array(strtolower((string)$stmt->fetchColumn()), ['archived', 'deactivated'], true);
}

function isStaffAccountDeactivated(PDO $pdo, array $user): bool
{
    $role = strtolower(trim((string)($user['role'] ?? '')));
    $userId = (int)($user['user_id'] ?? 0);

    if ($userId <= 0) {
        return false;
    }

    if ($role === 'veterinarian') {
        $stmt = $pdo->prepare("SELECT is_active FROM veterinarian_profiles WHERE user_id = ? LIMIT 1");
        $stmt->execute([$userId]);
        $isActive = $stmt->fetchColumn();

        return $isActive !== false && (int)$isActive !== 1;
    }

    if ($role === 'admin') {
        if (!ensureAdminAccountStatusColumn($pdo)) {
            return false;
        }

        $stmt = $pdo->prepare("SELECT is_active FROM admin_profiles WHERE user_id = ? LIMIT 1");
        $stmt->execute([$userId]);
        $isActive = $stmt->fetchColumn();

        return $isActive !== false && (int)$isActive !== 1;
    }

    return false;
}

function isPetOwnerAccountDeactivated(PDO $pdo, array $user): bool
{
    $role = strtolower(trim((string)($user['role'] ?? '')));
    $userId = (int)($user['user_id'] ?? 0);

    if ($userId <= 0 || !in_array($role, ['pet owner', 'pet_owner'], true)) {
        return false;
    }

    if (!loginColumnExists($pdo, 'users', 'account_status')) {
        return false;
    }

    $stmt = $pdo->prepare("SELECT account_status FROM users WHERE user_id = ? LIMIT 1");
    $stmt->execute([$userId]);
    $status = strtolower((string)$stmt->fetchColumn());

    return in_array($status, ['deactivated', 'archived'], true);
}

function loginColumnExists(PDO $pdo, string $tableName, string $columnName): bool
{
    static $cache = [];
    $cacheKey = $tableName . '.' . $columnName;

    if (array_key_exists($cacheKey, $cache)) {
        return $cache[$cacheKey];
    }

    $stmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = ?
          AND column_name = ?
    ");
    $stmt->execute([$tableName, $columnName]);
    $cache[$cacheKey] = (int)$stmt->fetchColumn() > 0;

    return $cache[$cacheKey];
}

// Get JSON input
$input = json_decode(file_get_contents('php://input'), true);

$email = $input['email'] ?? null;
$password = $input['password'] ?? null;

if (!$email || !$password) {
    http_response_code(400);
    echo json_encode(['message' => 'Email and password are required.']);
    exit;
}

try {
    $emailVerifiedSelect = loginColumnExists($pdo, 'users', 'email_verified_at')
        ? 'email_verified_at,'
        : 'NULL AS email_verified_at,';
    $stmt = $pdo->prepare("
        SELECT 
            user_id, 
            mail_Address, 
            {$emailVerifiedSelect}
            role, 
            first_Name, 
            last_Name, 
            personal_Address, 
            phoneNumber, 
            emergencyNumber, 
            user_password,
            setProfilePic_url,
            birthdate
        FROM users 
        WHERE mail_Address = ? 
        LIMIT 1
    ");
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['user_password'])) {
        http_response_code(401);
        echo json_encode(['message' => 'Invalid email or password.']);
        exit;
    }

    if (empty($user['email_verified_at'])) {
        http_response_code(403);
        echo json_encode([
            'message' => 'Please verify your email before logging in.',
            'code' => 'EMAIL_UNVERIFIED',
            'email' => $user['mail_Address'],
        ]);
        exit;
    }

    if (isUserAccountArchived($pdo, $user) || isStaffAccountDeactivated($pdo, $user)) {
        http_response_code(403);
        echo json_encode(['message' => DEACTIVATED_ACCOUNT_MESSAGE]);
        exit;
    }

    if (isPetOwnerAccountDeactivated($pdo, $user)) {
        http_response_code(403);
        echo json_encode(['message' => DEACTIVATED_ACCOUNT_MESSAGE]);
        exit;
    }

    $accessToken = ipawcus_create_access_token($pdo, (int)$user['user_id']);

    echo json_encode([
        'message' => 'Login successful.',
        'access_token' => $accessToken['token'],
        'token_type' => 'Bearer',
        'expires_at' => $accessToken['expires_at'],
        'user' => [
            'id' => $user['user_id'],
            'email' => $user['mail_Address'],
            'role' => $user['role'],
            'firstName' => $user['first_Name'],
            'lastName' => $user['last_Name'],
            'address' => $user['personal_Address'],
            'phoneNumber' => $user['phoneNumber'],
            'emergencyNumber' => $user['emergencyNumber'],
            'profileImage' => $user['setProfilePic_url'],
            'birthdate' => $user['birthdate']
        ]
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['message' => $e->getMessage() ?: 'Failed to find user.']);
}
