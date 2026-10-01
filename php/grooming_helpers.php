<?php
require_once __DIR__ . '/grooming_rules.php';
require_once __DIR__ . '/workflow_guard_helpers.php';
require_once __DIR__ . '/branch_helpers.php';

function grooming_require_schema(PDO $pdo): void
{
    foreach (['grooming_jobs', 'grooming_reviews', 'grooming_photos', 'grooming_events'] as $table) {
        if (!ipawcus_guard_table_exists($pdo, $table)) ipawcus_guard_error(409, 'Grooming Management is not set up yet. The clinic administrator needs to install the grooming database update.', ['code' => 'grooming_setup_required']);
    }
}

function grooming_booking(PDO $pdo, int $id, array $user, bool $lock = false): array
{
    $stmt = $pdo->prepare("SELECT b.*, COALESCE(p.pet_name, b.unregistered_pet_name) AS grooming_pet_name,
        p.pet_allergies, p.pet_status,
        TRIM(CONCAT(COALESCE(owner.first_Name, ''), ' ', COALESCE(owner.last_Name, ''))) AS grooming_owner_name
        FROM bookings b
        LEFT JOIN pets_information p ON p.pet_id = b.pet_id
        LEFT JOIN users owner ON owner.user_id = b.user_id
        WHERE b.booking_id = ?" . ($lock ? ' FOR UPDATE' : ''));
    $stmt->execute([$id]);
    $booking = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$booking || !grooming_is_service($booking['service_type'])) ipawcus_guard_error(404, 'This grooming booking could not be found.');
    $role = ipawcus_guard_role($user);
    if ($role === 'pet_owner') {
        if ((int)$booking['user_id'] !== ipawcus_guard_user_id($user)) ipawcus_guard_error(403, 'You can only view your own grooming records.');
    } elseif (!branch_user_can_access($pdo, $user, (int)$booking['branch_id'])) {
        ipawcus_guard_error(403, 'This grooming job belongs to another branch.');
    }
    return $booking;
}

function grooming_event(PDO $pdo, int $id, int $actor, string $action, array $details = []): void
{
    $stmt = $pdo->prepare('INSERT INTO grooming_events (booking_id, actor_id, action, details_json) VALUES (?, ?, ?, ?)');
    $stmt->execute([$id, $actor, $action, json_encode($details, JSON_THROW_ON_ERROR)]);
}

function grooming_apply_catalog_service(PDO $pdo, array $details): array
{
    if (!ipawcus_guard_table_exists($pdo, 'service_catalog')) {
        throw new InvalidArgumentException('Service Catalog is unavailable. Ask an administrator to restore it before starting grooming.');
    }

    $serviceIds = is_array($details['catalogServiceIds'] ?? null)
        ? array_values(array_unique(array_map('intval', $details['catalogServiceIds'])))
        : [];
    $serviceIds = array_values(array_filter($serviceIds, static fn(int $serviceId): bool => $serviceId > 0));
    $legacyServiceId = (int)($details['catalogServiceId'] ?? 0);
    if (!$serviceIds && $legacyServiceId > 0) {
        $serviceIds = [$legacyServiceId];
    }
    if (!$serviceIds && trim((string)($details['package'] ?? '')) !== '') {
        $match = $pdo->prepare("SELECT service_id FROM service_catalog WHERE service_type = 'grooming' AND is_active = 1 AND LOWER(TRIM(service_name)) = LOWER(TRIM(?)) ORDER BY service_id LIMIT 1");
        $match->execute([(string)$details['package']]);
        $matchedServiceId = (int)($match->fetchColumn() ?: 0);
        if ($matchedServiceId > 0) $serviceIds = [$matchedServiceId];
    }

    if (!$serviceIds) {
        return $details;
    }

    $placeholders = implode(',', array_fill(0, count($serviceIds), '?'));
    $stmt = $pdo->prepare("SELECT service_id, service_name, base_price FROM service_catalog WHERE service_id IN ({$placeholders}) AND service_type = 'grooming' AND is_active = 1");
    $stmt->execute($serviceIds);
    $servicesById = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $service) {
        $servicesById[(int)$service['service_id']] = $service;
    }
    if (count($servicesById) !== count($serviceIds)) {
        throw new InvalidArgumentException('One or more selected grooming services are inactive or no longer exist. Review the Service Catalog selections.');
    }

    $serviceNames = [];
    foreach ($serviceIds as $serviceId) {
        $service = $servicesById[$serviceId];
        if ((float)$service['base_price'] <= 0) {
            throw new InvalidArgumentException('Set a price above PHP 0 for every selected grooming item in Service Catalog before assigning it.');
        }
        $serviceNames[] = trim((string)$service['service_name']);
    }

    $details['catalogServiceIds'] = $serviceIds;
    $details['catalogServiceId'] = $serviceIds[0];
    $details['package'] = implode(', ', $serviceNames);
    return $details;
}

function grooming_ensure_job(PDO $pdo, array $booking, int $actor): array
{
    if (!in_array($booking['status'], ['confirmed', 'completed'], true)) ipawcus_guard_error(409, 'Approve this booking before opening its grooming job.');
    $stmt = $pdo->prepare('SELECT * FROM grooming_jobs WHERE booking_id = ? FOR UPDATE');
    $stmt->execute([(int)$booking['booking_id']]);
    $job = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($job) return $job;
    if ($booking['status'] === 'completed') ipawcus_guard_error(409, 'This booking was completed before Grooming Management. Keep its existing service record.');
    $details = grooming_validate_details(['ownerRequest' => $booking['notes'] ?? '', 'allergies' => $booking['pet_allergies'] ?? '']);
    $insert = $pdo->prepare('INSERT INTO grooming_jobs (booking_id, details_json, updated_by) VALUES (?, ?, ?)');
    $insert->execute([(int)$booking['booking_id'], json_encode($details), $actor]);
    grooming_event($pdo, (int)$booking['booking_id'], $actor, 'created');
    $stmt->execute([(int)$booking['booking_id']]);
    return $stmt->fetch(PDO::FETCH_ASSOC);
}

function grooming_media_access(PDO $pdo, string $path, array $user): bool
{
    if (!ipawcus_guard_table_exists($pdo, 'grooming_photos')) return false;
    $stmt = $pdo->prepare('SELECT p.*, b.branch_id, b.user_id, j.status AS grooming_status, j.published_at FROM grooming_photos p JOIN bookings b ON b.booking_id = p.booking_id JOIN grooming_jobs j ON j.booking_id = p.booking_id WHERE p.file_path = ?');
    $stmt->execute([$path]);
    $photo = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$photo) return false;
    $role = ipawcus_guard_role($user);
    if ($role === 'pet_owner') return (int)$photo['user_id'] === ipawcus_guard_user_id($user) && $photo['published_at'] && (int)$photo['share_with_owner'] === 1 && $photo['category'] !== 'concern';
    if (!branch_user_can_access($pdo, $user, (int)$photo['branch_id'])) return false;
    if (ipawcus_guard_is_admin_role($role)) return $role === 'super_admin' || (ipawcus_admin_feature_permissions($pdo, ipawcus_guard_user_id($user))['grooming'] ?? true);
    if ($role === 'veterinarian' && in_array((string)$photo['grooming_status'], ['ready', 'released', 'transferred'], true)) return true;
    $review = $pdo->prepare('SELECT 1 FROM grooming_reviews WHERE booking_id = ? AND veterinarian_id = ? LIMIT 1');
    $review->execute([(int)$photo['booking_id'], ipawcus_guard_user_id($user)]);
    return (bool)$review->fetchColumn();
}
