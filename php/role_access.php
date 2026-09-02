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

function ipawcus_admin_feature_keys(): array
{
    return [
        'pets',
        'pet_register',
        'bookings',
        'record_requests',
        'boarding',
        'queue',
        'pos',
        'inventory',
        'services',
        'service_catalog',
        'consent',
    ];
}

function ipawcus_admin_feature_permissions_table_exists(PDO $pdo): bool
{
    static $exists = null;
    if ($exists !== null) {
        return $exists;
    }

    try {
        $stmt = $pdo->prepare("
            SELECT COUNT(DISTINCT column_name)
            FROM information_schema.columns
            WHERE table_schema = DATABASE()
              AND table_name = 'admin_feature_permissions'
              AND column_name IN ('user_id', 'feature_key', 'is_allowed')
        ");
        $stmt->execute();
        $exists = (int)$stmt->fetchColumn() === 3;
    } catch (Throwable $error) {
        $exists = false;
    }

    return $exists;
}

function ipawcus_admin_feature_permissions(PDO $pdo, int $userId): array
{
    $permissions = array_fill_keys(ipawcus_admin_feature_keys(), true);
    if ($userId <= 0 || !ipawcus_admin_feature_permissions_table_exists($pdo)) {
        return $permissions;
    }

    try {
        $stmt = $pdo->prepare("
            SELECT feature_key, is_allowed
            FROM admin_feature_permissions
            WHERE user_id = ?
        ");
        $stmt->execute([$userId]);
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $key = (string)($row['feature_key'] ?? '');
            if (array_key_exists($key, $permissions)) {
                $permissions[$key] = (int)($row['is_allowed'] ?? 0) === 1;
            }
        }
    } catch (Throwable $error) {
        // RBAC is additive. A missing/partial optional table must preserve the
        // original Admin permissions instead of breaking every mutation with
        // a server error. The management endpoint still reports the migration.
        error_log('Admin feature permission lookup failed: ' . $error->getMessage());
    }

    return $permissions;
}

function ipawcus_admin_feature_for_mutation(string $path, string $method): ?string
{
    $method = strtoupper($method);
    if (!in_array($method, ['POST', 'PUT', 'PATCH', 'DELETE'], true)) {
        return null;
    }

    if ($path === '/service-display-settings' || preg_match('#^/special_services(/|$)#', $path)) return 'services';
    if (preg_match('#^/service-catalog(/|$)#', $path)) return 'service_catalog';
    if (preg_match('#^/record-update-requests(/|$)#', $path)) return 'record_requests';
    if (preg_match('#^/boarding(/|$)#', $path)) return 'boarding';
    if (preg_match('#^/queues(/|$)#', $path)) return 'queue';
    if (preg_match('#^/visits(/|$)#', $path)) return 'pos';
    if (preg_match('#^/inventory(/|$)#', $path)) return 'inventory';
    if (preg_match('#^/(consent_files|consent-form-records|consent_form_records)(/|$)#', $path)) return 'consent';
    if ($path === '/pet_information' || preg_match('#^/pet_information/[^/]+(/status)?$#', $path)) return 'pet_register';
    if (preg_match('#^/bookings(/|$)#', $path)) return 'bookings';

    return null;
}

function ipawcus_public_route(string $path): bool
{
    return in_array($path, [
        '/login',
        '/register',
        '/users',
        '/health',
        '/system/problem-report',
        '/self-service/access',
        '/status-display',
        '/tv-status',
        '/booking-availability',
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

    if ($path === '/uploads/media' || preg_match('#^/uploads/media/#', $path)) {
        return ['roles' => ipawcus_roles('all'), 'media' => true];
    }

    if (preg_match('#^/(accounts|pet-owner-accounts|reports)(/|$)#', $path)) {
        return ['roles' => ipawcus_roles('superadmin')];
    }

    if ($path === '/lifecycle/recovery-report') {
        return ['roles' => ipawcus_roles('superadmin')];
    }

    if ($path === '/payment-methods') {
        return ['roles' => $method === 'GET' ? ipawcus_roles('all') : ipawcus_roles('superadmin')];
    }

    if ($path === '/payment-methods/otp') {
        return ['roles' => ipawcus_roles('superadmin')];
    }

    if ($path === '/profile') {
        return ['roles' => ipawcus_roles('all')];
    }

    if ($path === '/admin-feature-access') {
        return ['roles' => $method === 'GET' ? ipawcus_roles('admin') : ipawcus_roles('superadmin')];
    }

    if ($path === '/veterinarians') {
        return ['roles' => ipawcus_roles('all')];
    }

    if ($path === '/branches') {
        return ['roles' => ipawcus_roles('all')];
    }

    if ($path === '/veterinarian-branch-schedules') {
        return ['roles' => $method === 'GET' ? ipawcus_roles('all') : ipawcus_roles('vet')];
    }

    if ($path === '/upload' || $path === '/upload/delete') {
        return ['roles' => ipawcus_roles('all')];
    }

    if (preg_match('#^/notifications(/|$)#', $path)) {
        return ['roles' => ipawcus_roles('all')];
    }

    if ($path === '/boarding/documents') {
        return ['roles' => $method === 'GET' ? ipawcus_roles('clinic') : ipawcus_roles('admin')];
    }

    if (preg_match('#^/(inventory|boarding)(/|$)#', $path)) {
        return ['roles' => ipawcus_roles('admin')];
    }

    if ($path === '/bookings') {
        return ['roles' => $method === 'GET' ? ipawcus_roles('clinic') : ipawcus_roles('owner_or_admin')];
    }

    if (preg_match('#^/bookings/\d+/status$#', $path)) {
        return ['roles' => ipawcus_roles('owner_or_admin')];
    }

    if (preg_match('#^/bookings/\d+/billing-context$#', $path)) {
        return ['roles' => ipawcus_roles('admin')];
    }

    if (preg_match('#^/bookings/\d+/payment-review$#', $path)) {
        return ['roles' => ipawcus_roles('admin')];
    }

    if (preg_match('#^/bookings/\d+/payment-refunds$#', $path)) {
        return ['roles' => ipawcus_roles('admin')];
    }

    if (preg_match('#^/bookings/\d+/(schedule|receive)$#', $path)) {
        return ['roles' => ipawcus_roles('clinic')];
    }

    if (preg_match('#^/bookings/\d+/branch$#', $path)) {
        return ['roles' => ipawcus_roles('admin')];
    }

    if ($path === '/queues') {
        return ['roles' => $method === 'POST' ? ipawcus_roles('owner_or_admin') : ipawcus_roles('clinic')];
    }

    if (preg_match('#^/queues/(pets|assign|reenter)$#', $path)) {
        return ['roles' => ipawcus_roles('admin')];
    }

    if ($path === '/queues/status' || $path === '/queues/return') {
        return ['roles' => ipawcus_roles('clinic')];
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

    if ($path === '/pet_ownership/link' || preg_match('#^/pet_ownership/coparent-requests(/\d+)?$#', $path)) {
        return ['roles' => ipawcus_roles('owner_or_clinic')];
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

    if ($path === '/service-display-settings') {
        return ['roles' => $method === 'GET' ? ipawcus_roles('all') : ipawcus_roles('admin')];
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

    return ['deny' => true];
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

    if (!empty($policy['deny'])) {
        ipawcus_access_json(404, 'API route was not found or is not available.', 'api_route_not_found');
    }

    $user = ipawcus_require_current_api_user($pdo);
    $role = ipawcus_access_normalize_role($user['role'] ?? '');
    $allowedRoles = array_map('ipawcus_access_normalize_role', $policy['roles'] ?? ipawcus_roles('all'));

    if (!in_array($role, $allowedRoles, true)) {
        ipawcus_access_json(403, 'Your user role is not allowed to access this resource.', 'api_role_forbidden');
    }

    if ($role === 'admin') {
        $featureKey = ipawcus_admin_feature_for_mutation($path, $method);
        if ($featureKey !== null) {
            $permissions = ipawcus_admin_feature_permissions($pdo, (int)$user['user_id']);
            if (($permissions[$featureKey] ?? true) !== true) {
                ipawcus_access_json(
                    403,
                    'Your Super Admin has disabled access to this feature.',
                    'admin_feature_forbidden'
                );
            }
        }
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
        'invoices' => ipawcus_roles('owner_or_clinic'),
        'boarding_documents' => ipawcus_roles('clinic'),
        'signatures' => ipawcus_roles('owner_or_clinic'),
        'payment_qr', 'pet_profile_images', 'uploads' => ipawcus_roles('all'),
        'concerns', 'diagnosis', 'payments' => ipawcus_roles('owner_or_clinic'),
        default => ipawcus_roles('clinic'),
    };
}

function ipawcus_media_table_exists(PDO $pdo, string $tableName): bool
{
    $stmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM information_schema.tables
        WHERE table_schema = DATABASE()
          AND table_name = ?
    ");
    $stmt->execute([$tableName]);

    return (int)$stmt->fetchColumn() > 0;
}

function ipawcus_media_column_exists(PDO $pdo, string $tableName, string $columnName): bool
{
    $stmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = ?
          AND column_name = ?
    ");
    $stmt->execute([$tableName, $columnName]);

    return (int)$stmt->fetchColumn() > 0;
}

function ipawcus_media_path_patterns(string $relativePath): array
{
    $path = trim(str_replace('\\', '/', $relativePath), '/');

    return array_values(array_unique([
        $path,
        '/' . $path,
        'public/' . $path,
        '/public/' . $path,
        'api/uploads/media/' . $path,
        '/api/uploads/media/' . $path,
    ]));
}

function ipawcus_media_path_condition(PDO $pdo, string $tableAlias, string $tableName, array $columns, string $relativePath, array &$params): string
{
    $conditions = [];
    $patterns = ipawcus_media_path_patterns($relativePath);

    foreach ($columns as $column) {
        if (!ipawcus_media_column_exists($pdo, $tableName, $column)) {
            continue;
        }

        foreach ($patterns as $pattern) {
            $conditions[] = "{$tableAlias}.{$column} LIKE ?";
            $params[] = '%' . $pattern . '%';
        }
    }

    return $conditions ? '(' . implode(' OR ', $conditions) . ')' : '';
}

function ipawcus_owner_can_view_media(PDO $pdo, int $ownerUserId, string $relativePath): bool
{
    if ($ownerUserId <= 0) {
        return false;
    }

    if (ipawcus_media_table_exists($pdo, 'bookings')) {
        $pathParams = [];
        $pathCondition = ipawcus_media_path_condition($pdo, 'b', 'bookings', [
            'Image_Booking_Concern_Path',
            'payment_proof_url',
            'signature_path',
            'consent_forms',
        ], $relativePath, $pathParams);

        if ($pathCondition !== '') {
            $bookingPetsAccess = ipawcus_media_table_exists($pdo, 'booking_pets')
                ? " OR EXISTS (
                        SELECT 1
                        FROM booking_pets bp
                        JOIN pet_ownership po2 ON po2.pet_id = bp.pet_id
                        WHERE bp.booking_id = b.booking_id
                          AND po2.user_id = ?
                    )"
                : '';
            $accessParams = $bookingPetsAccess !== ''
                ? [$ownerUserId, $ownerUserId, $ownerUserId]
                : [$ownerUserId, $ownerUserId];

            $stmt = $pdo->prepare("
                SELECT COUNT(*)
                FROM bookings b
                WHERE (
                    b.user_id = ?
                    OR EXISTS (
                        SELECT 1
                        FROM pet_ownership po
                        WHERE po.pet_id = b.pet_id
                          AND po.user_id = ?
                    )
                    {$bookingPetsAccess}
                )
                  AND {$pathCondition}
                LIMIT 1
            ");
            $stmt->execute(array_merge($accessParams, $pathParams));
            if ((int)$stmt->fetchColumn() > 0) {
                return true;
            }
        }
    }

    if (ipawcus_media_table_exists($pdo, 'queues')) {
        $pathParams = [];
        $pathCondition = ipawcus_media_path_condition($pdo, 'q', 'queues', [
            'signiture_self_service_path',
            'image_path',
            'Image_Booking_Concern_Path',
        ], $relativePath, $pathParams);

        if ($pathCondition !== '') {
            $stmt = $pdo->prepare("
                SELECT COUNT(*)
                FROM queues q
                WHERE (
                    q.user_id = ?
                    OR EXISTS (
                        SELECT 1
                        FROM pet_ownership po
                        WHERE po.pet_id = q.pet_id
                          AND po.user_id = ?
                    )
                )
                  AND {$pathCondition}
                LIMIT 1
            ");
            $stmt->execute(array_merge([$ownerUserId, $ownerUserId], $pathParams));
            if ((int)$stmt->fetchColumn() > 0) {
                return true;
            }
        }
    }

    if (ipawcus_media_table_exists($pdo, 'pet_record_update_requests')) {
        $pathParams = [];
        $pathCondition = ipawcus_media_path_condition($pdo, 'r', 'pet_record_update_requests', [
            'payment_proof_url',
        ], $relativePath, $pathParams);

        if ($pathCondition !== '' && ipawcus_media_column_exists($pdo, 'pet_record_update_requests', 'owner_user_id')) {
            $stmt = $pdo->prepare("
                SELECT COUNT(*)
                FROM pet_record_update_requests r
                WHERE r.owner_user_id = ?
                  AND {$pathCondition}
                LIMIT 1
            ");
            $stmt->execute(array_merge([$ownerUserId], $pathParams));
            if ((int)$stmt->fetchColumn() > 0) {
                return true;
            }
        }
    }

    if (
        ipawcus_media_table_exists($pdo, 'visit_invoice_documents')
        && ipawcus_media_table_exists($pdo, 'visits')
    ) {
        $pathParams = [];
        $pathCondition = ipawcus_media_path_condition(
            $pdo,
            'invoice_document',
            'visit_invoice_documents',
            ['file_path'],
            $relativePath,
            $pathParams
        );

        if ($pathCondition !== '') {
            $petOwnershipAccess = ipawcus_media_table_exists($pdo, 'pet_ownership')
                ? " OR EXISTS (
                        SELECT 1
                        FROM pet_ownership po
                        WHERE po.pet_id = invoice_document.pet_id
                          AND po.user_id = ?
                    )"
                : '';
            $accessParams = $petOwnershipAccess !== ''
                ? [$ownerUserId, $ownerUserId]
                : [$ownerUserId];
            $stmt = $pdo->prepare("
                SELECT COUNT(*)
                FROM visit_invoice_documents invoice_document
                JOIN visits visit_record ON visit_record.visit_id = invoice_document.visit_id
                WHERE (
                    visit_record.owner_user_id = ?
                    {$petOwnershipAccess}
                )
                  AND {$pathCondition}
                LIMIT 1
            ");
            $stmt->execute(array_merge($accessParams, $pathParams));
            if ((int)$stmt->fetchColumn() > 0) {
                return true;
            }
        }
    }

    if (ipawcus_media_table_exists($pdo, 'vet_diagnoses')
        && ipawcus_media_table_exists($pdo, 'pet_ownership')) {
        $pathParams = [];
        $pathCondition = ipawcus_media_path_condition($pdo, 'vd', 'vet_diagnoses', [
            'attachments',
            'source_uploads',
        ], $relativePath, $pathParams);

        if ($pathCondition !== '') {
            $stmt = $pdo->prepare("
                SELECT COUNT(*)
                FROM vet_diagnoses vd
                JOIN pet_ownership po ON po.pet_id = vd.pet_id
                WHERE po.user_id = ?
                  AND {$pathCondition}
                LIMIT 1
            ");
            $stmt->execute(array_merge([$ownerUserId], $pathParams));
            if ((int)$stmt->fetchColumn() > 0) {
                return true;
            }
        }
    }

    if (ipawcus_media_table_exists($pdo, 'pet_medical_record_group_items')
        && ipawcus_media_table_exists($pdo, 'pet_medical_record_groups')
        && ipawcus_media_table_exists($pdo, 'pet_ownership')) {
        $pathParams = [];
        $pathCondition = ipawcus_media_path_condition($pdo, 'i', 'pet_medical_record_group_items', [
            'source_snapshot',
        ], $relativePath, $pathParams);

        if ($pathCondition !== '') {
            $stmt = $pdo->prepare("
                SELECT COUNT(*)
                FROM pet_medical_record_group_items i
                JOIN pet_medical_record_groups g ON g.group_id = i.group_id
                JOIN pet_ownership po ON po.pet_id = g.pet_id
                WHERE po.user_id = ?
                  AND {$pathCondition}
                LIMIT 1
            ");
            $stmt->execute(array_merge([$ownerUserId], $pathParams));
            if ((int)$stmt->fetchColumn() > 0) {
                return true;
            }
        }
    }

    return false;
}

function ipawcus_enforce_media_access(PDO $pdo, string $relativePath): array
{
    $user = ipawcus_require_current_api_user($pdo);
    $role = ipawcus_access_normalize_role($user['role'] ?? '');
    $allowedRoles = array_map('ipawcus_access_normalize_role', ipawcus_media_access_roles($relativePath));

    if (!in_array($role, $allowedRoles, true)) {
        ipawcus_access_json(403, 'Your user role is not allowed to view this file.', 'media_role_forbidden');
    }

    $directory = explode('/', trim(str_replace('\\', '/', $relativePath), '/'), 2)[0] ?? '';
    if ($role === 'pet_owner' && in_array($directory, ['concerns', 'diagnosis', 'invoices', 'payments', 'signatures'], true)) {
        if (!ipawcus_owner_can_view_media($pdo, (int)($user['user_id'] ?? 0), $relativePath)) {
            ipawcus_access_json(403, 'You can only view media attached to your own records.', 'media_owner_forbidden');
        }
    }

    return $user;
}
