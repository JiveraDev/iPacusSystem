<?php

require_once __DIR__ . '/auth_access_helpers.php';

function ipawcus_access_json(int $status, string $message, string $code): void
{
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'message' => $message,
        'code' => $code,
    ]);
    exit;
}

function ipawcus_role_groups(): array
{
    return [
        'all' => ['pet_owner', 'admin', 'veterinarian', 'super_admin'],
        'clinic' => ['admin', 'veterinarian', 'super_admin'],
        'admin' => ['admin', 'super_admin'],
        'superadmin' => ['super_admin'],
        'vet' => ['veterinarian', 'super_admin'],
        'owner' => ['pet_owner', 'super_admin'],
        'owner_or_admin' => ['pet_owner', 'admin', 'super_admin'],
        'owner_or_vet' => ['pet_owner', 'veterinarian', 'super_admin'],
        'owner_or_clinic' => ['pet_owner', 'admin', 'veterinarian', 'super_admin'],
    ];
}

function ipawcus_roles(string $group): array
{
    $groups = ipawcus_role_groups();
    return $groups[$group] ?? $groups['all'];
}

function ipawcus_public_route(string $path): bool
{
    return in_array($path, [
        '/login',
        '/register',
        '/users',
        '/health',
        '/self-service/access',
        '/status-display',
        '/tv-status',
        '/notifications/reminders/run',
    ], true) || preg_match('#^/auth/#', $path);
}

function ipawcus_route_access_policy(string $path, string $method): array
{
    $path = '/' . trim($path, '/');
    if ($path === '/') {
        $path = '';
    }

    $method = strtoupper($method);

    if (ipawcus_public_route($path)) {
        return ['public' => true];
    }

    if (preg_match('#^/uploads/media/#', $path)) {
        return ['roles' => ipawcus_roles('all'), 'media' => true];
    }

    if (preg_match('#^/(accounts|pet-owner-accounts|reports)(/|$)#', $path)) {
        return ['roles' => ipawcus_roles('superadmin')];
    }

    if ($path === '/queues/debug' || $path === '/lifecycle/recovery-report') {
        return ['roles' => ipawcus_roles('superadmin')];
    }

    if ($path === '/payment-methods') {
        return ['roles' => $method === 'GET' ? ipawcus_roles('all') : ipawcus_roles('superadmin')];
    }

    if ($path === '/payment-methods/otp') {
        return ['roles' => ipawcus_roles('superadmin')];
    }

    if (preg_match('#^/(inventory|boarding)(/|$)#', $path)) {
        return ['roles' => ipawcus_roles('admin')];
    }

    if ($path === '/bookings') {
        return ['roles' => $method === 'GET' ? ipawcus_roles('admin') : ipawcus_roles('owner_or_admin')];
    }

    if (preg_match('#^/bookings/\d+/(status|schedule|receive)$#', $path)) {
        return ['roles' => ipawcus_roles('admin')];
    }

    if ($path === '/queues') {
        return ['roles' => $method === 'POST' ? ipawcus_roles('owner_or_admin') : ipawcus_roles('clinic')];
    }

    if (preg_match('#^/queues/(pets|status|assign|return|reenter)$#', $path)) {
        return ['roles' => ipawcus_roles('admin')];
    }

    if ($path === '/queues/receive') {
        return ['roles' => ipawcus_roles('vet')];
    }

    if (preg_match('#^/vet-diagnoses(/|$)#', $path)) {
        return ['roles' => ipawcus_roles('vet')];
    }

    if (preg_match('#^/online-consultations(/|$)#', $path)) {
        return ['roles' => ipawcus_roles('owner_or_vet')];
    }

    if ($path === '/pet-media-monitoring') {
        return ['roles' => ['veterinarian', 'super_admin']];
    }

    if ($path === '/visits' || preg_match('#^/visits/\d+(/|$)#', $path)) {
        return ['roles' => ipawcus_roles('admin')];
    }

    if ($path === '/consent_files') {
        return ['roles' => $method === 'GET' ? ipawcus_roles('owner_or_clinic') : ipawcus_roles('admin')];
    }

    if (preg_match('#^/consent_files/\d+$#', $path)) {
        return ['roles' => ipawcus_roles('admin')];
    }

    if (preg_match('#^/consent-form-records$#', $path) || preg_match('#^/consent_form_records$#', $path)) {
        return ['roles' => ipawcus_roles('owner_or_clinic')];
    }

    if ($path === '/pet_information') {
        return ['roles' => $method === 'POST' ? ipawcus_roles('owner_or_admin') : ipawcus_roles('clinic')];
    }

    if (preg_match('#^/pet_information/[^/]+(/status)?$#', $path)) {
        return ['roles' => ipawcus_roles('owner_or_clinic')];
    }

    if (preg_match('#^/pets/[^/]+/(queues|bookings|medical|overdue/cancel)$#', $path)) {
        return ['roles' => ipawcus_roles('owner_or_clinic')];
    }

    if (preg_match('#^/users/(\d+)/(pets|bookings|todos)$#', $path, $matches)) {
        return [
            'roles' => ipawcus_roles('owner_or_clinic'),
            'resource_user_id' => (int)$matches[1],
        ];
    }

    if (preg_match('#^/users/(\d+)(/password)?$#', $path, $matches)) {
        return [
            'roles' => ipawcus_roles('owner_or_clinic'),
            'resource_user_id' => (int)$matches[1],
        ];
    }

    if ($path === '/todos' || preg_match('#^/todos/\d+$#', $path)) {
        return ['roles' => ['pet_owner', 'veterinarian', 'super_admin']];
    }

    if ($path === '/record-update-requests' || preg_match('#^/record-update-requests/\d+$#', $path)) {
        return ['roles' => ipawcus_roles('owner_or_clinic')];
    }

    if ($path === '/service-catalog' || preg_match('#^/service-catalog/\d+(/materials)?$#', $path)) {
        return ['roles' => $method === 'GET' ? ipawcus_roles('all') : ipawcus_roles('admin')];
    }

    if ($path === '/special_services') {
        return ['roles' => $method === 'GET' ? ipawcus_roles('all') : ipawcus_roles('admin')];
    }

    if (preg_match('#^/special_services/\d+$#', $path)) {
        return ['roles' => ipawcus_roles('admin')];
    }

    if ($path === '/rooms/availability') {
        return ['roles' => ipawcus_roles('all')];
    }

    if ($path === '/vet_schedules') {
        return ['roles' => $method === 'GET' ? ipawcus_roles('all') : ipawcus_roles('vet')];
    }

    if ($path === '/mail/test') {
        return ['roles' => ipawcus_roles('superadmin')];
    }

    return ['roles' => ipawcus_roles('all')];
}

function ipawcus_require_current_api_user(PDO $pdo): array
{
    if (isset($GLOBALS['ipawcus_current_api_user']) && is_array($GLOBALS['ipawcus_current_api_user'])) {
        return $GLOBALS['ipawcus_current_api_user'];
    }

    $token = ipawcus_request_access_token();
    $user = ipawcus_fetch_user_by_access_token($pdo, $token);

    if (!$user) {
        ipawcus_access_json(401, 'Please log in again to continue.', 'api_auth_required');
    }

    $GLOBALS['ipawcus_current_api_user'] = $user;
    $_SERVER['IPAWCUS_USER_ID'] = (string)((int)$user['user_id']);
    $_SERVER['IPAWCUS_USER_ROLE'] = (string)$user['normalized_role'];

    return $user;
}

function ipawcus_enforce_route_access(PDO $pdo, string $path, string $method): ?array
{
    $policy = ipawcus_route_access_policy($path, $method);
    if (!empty($policy['public'])) {
        return null;
    }

    $user = ipawcus_require_current_api_user($pdo);
    $role = ipawcus_access_normalize_role($user['role'] ?? '');
    $allowedRoles = array_map('ipawcus_access_normalize_role', $policy['roles'] ?? ipawcus_roles('all'));

    if (!in_array($role, $allowedRoles, true)) {
        ipawcus_access_json(403, 'Your user role is not allowed to access this resource.', 'api_role_forbidden');
    }

    $resourceUserId = (int)($policy['resource_user_id'] ?? 0);
    if ($resourceUserId > 0 && $role === 'pet_owner' && (int)$user['user_id'] !== $resourceUserId) {
        ipawcus_access_json(403, 'You can only access records under your own account.', 'api_owner_scope_forbidden');
    }

    return $user;
}

function ipawcus_media_access_roles(string $relativePath): array
{
    $directory = explode('/', trim(str_replace('\\', '/', $relativePath), '/'), 2)[0] ?? '';

    return match ($directory) {
        'inventory_items', 'inventory_receipts' => ipawcus_roles('admin'),
        'boarding_documents' => ipawcus_roles('admin'),
        'signatures' => ipawcus_roles('clinic'),
        'payment_qr', 'pet_profile_images', 'uploads' => ipawcus_roles('all'),
        'concerns', 'diagnosis', 'payments' => ipawcus_roles('owner_or_clinic'),
        default => ipawcus_roles('clinic'),
    };
}

function ipawcus_enforce_media_access(PDO $pdo, string $relativePath): array
{
    $user = ipawcus_require_current_api_user($pdo);
    $role = ipawcus_access_normalize_role($user['role'] ?? '');
    $allowedRoles = array_map('ipawcus_access_normalize_role', ipawcus_media_access_roles($relativePath));

    if (!in_array($role, $allowedRoles, true)) {
        ipawcus_access_json(403, 'Your user role is not allowed to view this file.', 'media_role_forbidden');
    }

    return $user;
}
