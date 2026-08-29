<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/account_status_helpers.php';

header('Content-Type: application/json');

try {
    $hasUserAccountStatus = accountColumnExists($pdo, 'users', 'account_status');
    $accountStatusWhere = $hasUserAccountStatus
        ? "AND COALESCE(NULLIF(LOWER(u.account_status), ''), 'active') NOT IN ('archived', 'deactivated', 'disabled', 'inactive', 'suspended')"
        : '';

    $stmt = $pdo->query("
        SELECT
            u.user_id,
            u.first_Name,
            u.last_Name,
            u.mail_Address,
            v.veterinarian_id,
            COALESCE(NULLIF(TRIM(v.specialization), ''), 'General Practice') AS specialization,
            v.prc_license_number,
            COALESCE(v.is_active, 1) AS is_active,
            COALESCE(v.is_accepting_patients, 1) AS is_accepting_patients,
            v.consultation_rate
        FROM users u
        JOIN veterinarian_profiles v ON u.user_id = v.user_id
        WHERE LOWER(REPLACE(REPLACE(TRIM(u.role), ' ', '_'), '-', '_')) IN ('veterinarian', 'vet')
          AND COALESCE(v.is_active, 1) = 1
          AND COALESCE(v.is_accepting_patients, 1) = 1
          {$accountStatusWhere}
        ORDER BY u.last_Name ASC, u.first_Name ASC, u.user_id ASC
    ");

    echo json_encode([
        'success' => true,
        'veterinarians' => $stmt->fetchAll(PDO::FETCH_ASSOC),
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to fetch veterinarians: ' . $e->getMessage(),
    ]);
}
