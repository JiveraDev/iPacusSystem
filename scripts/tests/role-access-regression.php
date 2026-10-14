<?php
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../../php/role_access.php';

$cases = [
    ['/accounts', 'GET', ['super_admin']],
    ['/reports/dashboard', 'GET', ['super_admin']],
    ['/pet-owner-accounts', 'GET', ['super_admin']],
    ['/payment-methods', 'POST', ['super_admin']],
    ['/admin-feature-access', 'POST', ['super_admin']],
    ['/system-backups', 'GET', ['super_admin']],
    ['/bookings', 'GET', ['admin', 'veterinarian', 'super_admin']],
    ['/bookings', 'POST', ['pet_owner', 'admin', 'super_admin']],
    ['/bookings/42/payment-review', 'POST', ['admin', 'super_admin']],
    ['/bookings/42/payment-refunds', 'POST', ['admin', 'super_admin']],
    ['/bookings/42/status', 'PATCH', ['pet_owner', 'admin', 'super_admin']],
    ['/queues', 'POST', ['pet_owner', 'admin', 'super_admin']],
    ['/queues/assign', 'POST', ['admin', 'super_admin']],
    ['/queues/receive', 'POST', ['veterinarian', 'super_admin']],
    ['/vet-diagnoses', 'POST', ['veterinarian', 'super_admin']],
    ['/pets/42/prescriptions', 'POST', ['veterinarian', 'super_admin']],
    ['/online-consultations', 'GET', ['pet_owner', 'veterinarian', 'super_admin']],
    ['/visits', 'POST', ['admin', 'super_admin']],
    ['/inventory', 'GET', ['admin', 'super_admin']],
    ['/boarding', 'POST', ['admin', 'super_admin']],
    ['/boarding/owner-stays', 'GET', ['pet_owner', 'super_admin']],
    ['/grooming', 'POST', ['admin', 'veterinarian', 'super_admin']],
    ['/pet-media-monitoring', 'GET', ['veterinarian', 'super_admin']],
    ['/service-catalog', 'POST', ['admin', 'super_admin']],
    ['/todos', 'POST', ['pet_owner', 'veterinarian', 'super_admin']],
    ['/account/google', 'POST', ['pet_owner', 'admin', 'veterinarian', 'super_admin']],
];
$checks = 0;
foreach ($cases as [$path, $method, $expected]) {
    $policy = ipawcus_route_access_policy($path, $method);
    if (!empty($policy['public']) || !empty($policy['deny']) || ($policy['roles'] ?? []) !== $expected) {
        throw new RuntimeException("Unexpected role policy for {$method} {$path}");
    }
    foreach (ipawcus_roles('all') as $role) {
        if (in_array($role, $policy['roles'], true) !== in_array($role, $expected, true)) {
            throw new RuntimeException("Unexpected permission for {$role}");
        }
        $checks++;
    }
}
foreach (['/auth/google', '/auth/google/complete', '/login', '/booking-availability'] as $path) {
    if (empty(ipawcus_route_access_policy($path, 'POST')['public'])) throw new RuntimeException("Public route missing: {$path}");
    $checks++;
}
if (empty(ipawcus_route_access_policy('/unknown-private-endpoint', 'GET')['deny'])) throw new RuntimeException('Unknown routes must fail closed');
$checks++;
$policy = ipawcus_route_access_policy('/users/42/pets', 'GET');
if (($policy['resource_user_id'] ?? 0) !== 42) throw new RuntimeException('Owner resource scoping was lost');
$checks++;
echo "PASS: {$checks} role policy checks; no database access. Record ownership and branch scopes still need runtime tests.\n";
