<?php

require_once __DIR__ . '/staff_activity_helpers.php';
header('Cache-Control: no-store');

$activityUser = ipawcus_require_current_api_user($pdo);
$activityRole = ipawcus_access_normalize_role((string)$activityUser['role']);
if (!staff_activity_tracked_role($activityUser)) {
    ipawcus_access_json(403, 'The Activity Log is available to clinic staff.', 'activity_role_forbidden');
}

try {
    staff_activity_require_column($pdo);
} catch (Throwable $error) {
    ipawcus_access_json(503, $error->getMessage(), 'activity_setup_required');
}

$activityMethod = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
$activityPath = $path ?? '/activity';

if ($activityPath === '/activity/view' && $activityMethod === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true) ?: [];
    $viewPath = trim((string)($input['path'] ?? ''));
    if (!preg_match('#^/dashboard(?:/[a-z0-9/-]+)?$#', $viewPath) || strlen($viewPath) > 160) {
        ipawcus_access_json(422, 'Choose a valid dashboard page.', 'activity_path_invalid');
    }

    try {
        $parts = array_values(array_filter(explode('/', $viewPath)));
        $pageKey = (string)(end($parts) ?: 'dashboard');
        $pageNames = [
            'dashboard' => 'Dashboard',
            'booking-management' => 'Booking Management',
            'queue-management' => 'Queue Management',
            'inventory' => 'Inventory',
            'pet-boarding' => 'Pet Boarding',
            'grooming' => 'Grooming',
            'pos' => 'Point of Sale',
            'accounts' => 'Account Management',
            'reports' => 'Reports',
            'profile' => 'Profile',
            'payment-methods' => 'Payment Methods',
        ];
        $page = $pageNames[$pageKey] ?? ucwords(str_replace('-', ' ', $pageKey));
        $safePath = preg_replace('#/\d+(?=/|$)#', '/:id', $viewPath);
        try {
            $branchId = staff_activity_request_branch($pdo, $viewPath, [], [], $activityUser);
        } catch (Throwable $branchError) {
            error_log('Staff page branch lookup failed: ' . $branchError->getMessage());
            $branchId = 0;
        }
        staff_activity_record($pdo, $activityUser, [
            'kind' => 'page_view',
            'key' => 'view:' . $safePath,
            'label' => 'Opened ' . $page,
            'details' => [['label' => 'Dashboard page', 'value' => $page]],
            'branch_id' => $branchId,
            'branch_label' => $branchId > 0 ? null : (staff_activity_is_global_path($viewPath) || $activityRole === 'super_admin'
                ? 'Organization-wide'
                : 'Branch not recorded'),
            'method' => 'GET',
            'path' => $safePath,
            'response_status' => 200,
            'planning_status' => 'not_planned',
            'planning_basis' => 'Immediate dashboard navigation',
        ]);
        echo json_encode(['success' => true]);
    } catch (Throwable $error) {
        error_log('Staff page activity failed: ' . $error->getMessage());
        ipawcus_access_json(500, 'Activity could not be recorded.', 'activity_write_failed');
    }
    exit;
}

if ($activityPath === '/activity/options' && $activityMethod === 'GET') {
    if ($activityRole !== 'super_admin') {
        ipawcus_access_json(403, 'Only Super Admins can view everyone’s activity.', 'activity_scope_forbidden');
    }

    echo json_encode(staff_activity_options($pdo));
    exit;
}

if ($activityPath === '/activity' && $activityMethod === 'GET') {
    $allUsers = ($_GET['scope'] ?? '') === 'all';
    if ($allUsers && $activityRole !== 'super_admin') {
        ipawcus_access_json(403, 'Only Super Admins can view everyone’s activity.', 'activity_scope_forbidden');
    }

    $requestedUserId = filter_var($_GET['userId'] ?? null, FILTER_VALIDATE_INT);
    if ($requestedUserId && $activityRole !== 'super_admin' && (int)$requestedUserId !== (int)$activityUser['user_id']) {
        ipawcus_access_json(403, 'You can only view your own activity.', 'activity_user_forbidden');
    }

    $filters = [];
    if (!$allUsers) {
        $filters['user_id'] = (int)$activityUser['user_id'];
    } elseif ($requestedUserId && $requestedUserId > 0) {
        $filters['user_id'] = (int)$requestedUserId;
    }

    $roleFilter = ipawcus_access_normalize_role((string)($_GET['role'] ?? ''));
    if ($allUsers && in_array($roleFilter, ['admin', 'veterinarian', 'super_admin'], true)) {
        $filters['role'] = $roleFilter;
    }
    $branchFilterValue = (string)($_GET['branchId'] ?? '');
    $branchFilter = filter_var($branchFilterValue, FILTER_VALIDATE_INT);
    if ($allUsers && $branchFilter && $branchFilter > 0) {
        $filters['branch_id'] = (int)$branchFilter;
    } elseif ($allUsers && in_array($branchFilterValue, ['organization', 'unresolved'], true)) {
        $filters['branch_scope'] = $branchFilterValue;
    }
    $kindFilter = (string)($_GET['kind'] ?? '');
    if (in_array($kindFilter, ['action', 'page_view', 'sign_in'], true)) {
        $filters['kind'] = $kindFilter;
    }
    $planningFilter = (string)($_GET['planning'] ?? '');
    if (in_array($planningFilter, ['planned', 'not_planned', 'not_recorded'], true)) {
        $filters['planning'] = $planningFilter;
    }
    $fromFilter = trim((string)($_GET['from'] ?? ''));
    if ($fromFilter !== '') {
        try {
            $filters['from'] = (new DateTimeImmutable($fromFilter))
                ->setTimezone(new DateTimeZone('UTC'))
                ->format('Y-m-d\TH:i:s.u\Z');
        } catch (Throwable $error) {
            ipawcus_access_json(422, 'Choose a valid activity log time range.', 'activity_time_invalid');
        }
    }
    $limit = max(1, min(250, (int)($_GET['limit'] ?? 25)));
    $offset = max(0, min(100000, (int)($_GET['offset'] ?? 0)));
    echo json_encode(staff_activity_list($pdo, $filters, $limit, $offset) + [
        'limit' => $limit,
        'offset' => $offset,
    ]);
    exit;
}

header('Allow: GET, POST');
ipawcus_access_json(405, 'Method not allowed.', 'activity_method_not_allowed');
