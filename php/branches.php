<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/workflow_guard_helpers.php';
require_once __DIR__ . '/branch_helpers.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['message' => 'Method not allowed.']);
    exit;
}

try {
    $currentUser = ipawcus_guard_current_user($pdo);
    $serviceKey = isset($_GET['service']) ? (string)$_GET['service'] : null;
    $date = isset($_GET['date']) ? (string)$_GET['date'] : null;
    $branches = branch_fetch_catalog($pdo, $serviceKey, $date);
    if (filter_var($_GET['assigned'] ?? false, FILTER_VALIDATE_BOOLEAN)) {
        $role = ipawcus_guard_role($currentUser);
        if ($role !== 'super_admin' && $role !== 'pet_owner' && $role !== 'veterinarian') {
            $allowedBranchIds = branch_user_ids($pdo, ipawcus_guard_user_id($currentUser));
            $branches = array_values(array_filter(
                $branches,
                fn(array $branch): bool => in_array((int)$branch['id'], $allowedBranchIds, true)
            ));
        }
    }
    echo json_encode([
        'branches' => $branches,
        'mainBranchId' => branch_main_id($pdo),
    ]);
} catch (Throwable $e) {
    http_response_code($e instanceof InvalidArgumentException ? 422 : 500);
    echo json_encode(['message' => $e->getMessage()]);
}
