<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/phone_number_helpers.php';

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

$role = $input['role'] ?? $role;
$normalizedRole = strtolower(str_replace([' ', '-'], '_', trim((string)$role)));

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

    $_GET['userId'] = $userId;
    $_GET['role'] = $role;
    require __DIR__ . '/get_user_profile.php';
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    http_response_code(500);
    echo json_encode(['message' => 'Failed to update profile: ' . $e->getMessage()]);
}
