<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/phone_number_helpers.php';
require_once __DIR__ . '/workflow_guard_helpers.php';
require_once __DIR__ . '/branch_helpers.php';
require_once __DIR__ . '/notification_helpers.php';

$userId = $_GET['userId'] ?? null;
$role = $_GET['role'] ?? null;
$input = json_decode(file_get_contents('php://input'), true);

if (!$userId) {
    http_response_code(400);
    echo json_encode(['message' => 'User ID is required.']);
    exit;
}

if (!$input) {
    http_response_code(400);
    echo json_encode(['message' => 'No data provided for update.']);
    exit;
}

function addFieldIfPresent(array $input, array &$fields, array &$params, string $inputKey, string $columnName): void
{
    if (array_key_exists($inputKey, $input)) {
        $fields[] = "$columnName = ?";
        $params[] = $input[$inputKey];
    }
}

function addJsonFieldIfPresent(array $input, array &$fields, array &$params, string $inputKey, string $columnName): void
{
    if (array_key_exists($inputKey, $input)) {
        $fields[] = "$columnName = ?";
        $params[] = is_array($input[$inputKey]) ? json_encode($input[$inputKey]) : $input[$inputKey];
    }
}

try {
    $currentUser = ipawcus_guard_current_user($pdo);
    $currentRole = ipawcus_guard_role($currentUser);
    if ($currentRole !== 'super_admin' && ipawcus_guard_user_id($currentUser) !== (int)$userId) {
        ipawcus_guard_error(403, 'You can update only your own profile.');
    }

    $roleStmt = $pdo->prepare('SELECT role FROM users WHERE user_id = ? LIMIT 1');
    $roleStmt->execute([(int)$userId]);
    $storedRole = $roleStmt->fetchColumn();
    if ($storedRole === false) {
        ipawcus_guard_error(404, 'Profile not found.');
    }
    $normalizedRole = branch_normalize_role((string)$storedRole);
    $role = (string)$storedRole;
    if ($normalizedRole === 'admin' && array_key_exists('preferredBranchId', $input)) {
        ipawcus_guard_error(403, 'Admin branch assignments can be changed only by Super Admin in Account Management.');
    }
    $pdo->beginTransaction();

    $userFields = [];
    $userParams = [];
    addFieldIfPresent($input, $userFields, $userParams, 'firstName', 'first_Name');
    addFieldIfPresent($input, $userFields, $userParams, 'lastName', 'last_Name');
    addFieldIfPresent($input, $userFields, $userParams, 'email', 'mail_Address');
    if (array_key_exists('phoneNumber', $input) || array_key_exists('phone', $input)) {
        $userFields[] = 'phoneNumber = ?';
        $userParams[] = rejectInvalidPhilippinePhoneNumber($input['phoneNumber'] ?? $input['phone'], 'Phone number', true);
    }
    addFieldIfPresent($input, $userFields, $userParams, 'address', 'personal_Address');
    addFieldIfPresent($input, $userFields, $userParams, 'profileImage', 'setProfilePic_url');
    addFieldIfPresent($input, $userFields, $userParams, 'dateOfBirth', 'birthdate');
    if (array_key_exists('preferredBranchId', $input)) {
        $preferredBranchId = (int)$input['preferredBranchId'];
        if (!branch_fetch($pdo, $preferredBranchId)) {
            throw new InvalidArgumentException('Select an active preferred branch.');
        }
        if ($currentRole === 'admin' && !branch_user_can_access($pdo, $currentUser, $preferredBranchId)) {
            ipawcus_guard_error(403, 'Admin preference must be one of the assigned branches.');
        }
        $userFields[] = 'preferred_branch_id = ?';
        $userParams[] = $preferredBranchId;
    }

    if (!empty($userFields)) {
        $userParams[] = $userId;
        $stmt = $pdo->prepare('UPDATE users SET ' . implode(', ', $userFields) . ' WHERE user_id = ?');
        $stmt->execute($userParams);
    }

    $profileUpdated = false;

    if ($normalizedRole === 'veterinarian' || $normalizedRole === 'vet') {
        $profileFields = [];
        $profileParams = [];
        addJsonFieldIfPresent($input, $profileFields, $profileParams, 'educationHistory', 'education_history');
        addJsonFieldIfPresent($input, $profileFields, $profileParams, 'experienceHistory', 'experience_history');

        if (!empty($profileFields)) {
            $profileParams[] = $userId;
            $stmt = $pdo->prepare('UPDATE veterinarian_profiles SET ' . implode(', ', $profileFields) . ' WHERE user_id = ?');
            $stmt->execute($profileParams);
            $profileUpdated = true;
        }
    } elseif ($normalizedRole === 'admin' || $normalizedRole === 'super_admin' || $normalizedRole === 'superadmin') {
        $profileFields = [];
        $profileParams = [];
        addFieldIfPresent($input, $profileFields, $profileParams, 'sssNumber', 'sss_number');
        addFieldIfPresent($input, $profileFields, $profileParams, 'philhealthNumber', 'philhealth_number');
        addFieldIfPresent($input, $profileFields, $profileParams, 'tinNumber', 'tin_number');
        addFieldIfPresent($input, $profileFields, $profileParams, 'pagibigNumber', 'pagibig_number');
        addJsonFieldIfPresent($input, $profileFields, $profileParams, 'educationHistory', 'education_history');
        addJsonFieldIfPresent($input, $profileFields, $profileParams, 'experienceHistory', 'experience_history');

        if (!empty($profileFields)) {
            $profileParams[] = $userId;
            $stmt = $pdo->prepare('UPDATE admin_profiles SET ' . implode(', ', $profileFields) . ' WHERE user_id = ?');
            $stmt->execute($profileParams);
            $profileUpdated = true;
        }
    }

    if (empty($userFields) && !$profileUpdated) {
        $pdo->rollBack();
        http_response_code(400);
        echo json_encode(['message' => 'No valid fields provided for update.']);
        exit;
    }

    $pdo->commit();

    if (in_array($normalizedRole, ['admin', 'super_admin', 'superadmin', 'veterinarian', 'vet'], true)) {
        try {
            $changedFieldLabels = [];
            $fieldLabels = [
                'firstName' => 'first name',
                'lastName' => 'last name',
                'email' => 'email address',
                'phoneNumber' => 'phone number',
                'phone' => 'phone number',
                'address' => 'address',
                'profileImage' => 'profile photo',
                'dateOfBirth' => 'birthdate',
                'preferredBranchId' => 'preferred branch',
                'sssNumber' => 'SSS number',
                'philhealthNumber' => 'PhilHealth number',
                'tinNumber' => 'TIN',
                'pagibigNumber' => 'Pag-IBIG number',
                'educationHistory' => 'education history',
                'experienceHistory' => 'experience history',
            ];
            foreach ($fieldLabels as $inputKey => $label) {
                if (array_key_exists($inputKey, $input)) {
                    $changedFieldLabels[] = $label;
                }
            }
            $changedFieldLabels = array_values(array_unique($changedFieldLabels));

            $nameStmt = $pdo->prepare('SELECT first_Name, last_Name, mail_Address FROM users WHERE user_id = ? LIMIT 1');
            $nameStmt->execute([(int)$userId]);
            $updatedUser = $nameStmt->fetch(PDO::FETCH_ASSOC) ?: [];
            $accountName = trim((string)(($updatedUser['first_Name'] ?? '') . ' ' . ($updatedUser['last_Name'] ?? '')))
                ?: trim((string)($updatedUser['mail_Address'] ?? 'Personnel account'));
            $changeSummary = $changedFieldLabels ? implode(', ', $changedFieldLabels) : 'profile information';

            notification_send_super_admin_governance_event($pdo, [
                'type' => 'personnel_profile_updated',
                'category' => 'account_updates',
                'title' => 'Personnel profile updated',
                'message' => "{$accountName} updated: {$changeSummary}.",
                'push_message' => "Personnel profile updated for {$accountName}.",
                'redirect_path' => '/dashboard/accounts',
                'dedupe_key' => 'personnel-profile-updated-' . (int)$userId . '-' . date('YmdHis'),
            ]);
        } catch (Throwable $notificationError) {
            error_log('Personnel profile notification failed: ' . $notificationError->getMessage());
        }
    }

    $_GET['userId'] = $userId;
    $_GET['role'] = $role;
    require __DIR__ . '/get_user_profile.php';
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    http_response_code($e instanceof InvalidArgumentException ? 422 : 500);
    echo json_encode(['message' => 'Failed to update profile: ' . $e->getMessage()]);
}
