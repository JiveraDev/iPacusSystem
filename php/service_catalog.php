<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/workflow_guard_helpers.php';
require_once __DIR__ . '/notification_helpers.php';

header('Content-Type: application/json');

function service_catalog_input(): array
{
    return json_decode(file_get_contents('php://input'), true) ?: [];
}

function service_catalog_table_exists(PDO $pdo, string $tableName): bool
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

function service_catalog_column_exists(PDO $pdo, string $tableName, string $columnName): bool
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

function service_catalog_schema_ready(PDO $pdo): bool
{
    return service_catalog_table_exists($pdo, 'service_catalog')
        && service_catalog_table_exists($pdo, 'service_materials')
        && service_catalog_table_exists($pdo, 'inventory_items');
}

function service_catalog_missing_message(): string
{
    return 'Service catalog schema is missing. Restore the repository baseline DDL, then run DDL/20260723_01_backend_integrity_schema.sql.';
}

function service_catalog_text($value): string
{
    return trim((string)($value ?? ''));
}

function service_catalog_nullable_text($value): ?string
{
    $text = service_catalog_text($value);
    return $text === '' ? null : $text;
}

function service_catalog_error(int $statusCode, string $message): void
{
    ipawcus_rollback_current_transaction();

    http_response_code($statusCode);
    echo json_encode(['success' => false, 'message' => $message]);
    exit;
}

function service_catalog_require_schema(PDO $pdo): void
{
    if (!service_catalog_schema_ready($pdo)) {
        service_catalog_error(409, service_catalog_missing_message());
    }
}

function service_catalog_require_admin(PDO $pdo): array
{
    $currentUser = ipawcus_guard_current_user($pdo);
    if (!ipawcus_guard_is_admin_role(ipawcus_guard_role($currentUser))) {
        service_catalog_error(403, 'Only Admin or Super Admin can change the service catalog.');
    }

    return $currentUser;
}

function service_catalog_notify_super_admin(PDO $pdo, int $serviceId, string $serviceName, string $action): void
{
    try {
        notification_send_super_admin_governance_event($pdo, [
            'type' => 'service_catalog_updated',
            'category' => 'configuration_updates',
            'title' => 'Service catalog updated',
            'message' => "{$serviceName} was {$action} in the service catalog.",
            'push_message' => "Service catalog updated: {$serviceName}.",
            'redirect_path' => '/dashboard/service-catalog',
            'dedupe_key' => 'service-catalog-' . $serviceId . '-' . (int)floor(time() / 300),
        ]);
    } catch (Throwable $notificationError) {
        error_log('Service catalog governance notification failed: ' . $notificationError->getMessage());
    }
}

function service_catalog_format_material(array $row): array
{
    $materialName = $row['material_name'] ?? $row['item_name'] ?? '';

    return [
        'serviceMaterialId' => (int)$row['service_material_id'],
        'serviceId' => (int)$row['service_id'],
        'itemId' => $row['item_id'] !== null ? (int)$row['item_id'] : null,
        'materialName' => $materialName,
        'itemName' => $row['item_name'] ?? '',
        'sku' => $row['sku'] ?? '',
        'unit' => $row['unit'] ?? '',
        'qtyUsed' => (float)$row['qty_used'],
        'billablePolicy' => $row['billable_policy'],
        'inventoryStatus' => $row['item_id'] !== null ? 'linked' : 'not_in_inventory',
    ];
}

function service_catalog_list(PDO $pdo): void
{
    if (!service_catalog_schema_ready($pdo)) {
        echo json_encode([
            'success' => true,
            'schemaReady' => false,
            'message' => service_catalog_missing_message(),
            'services' => []
        ]);
        return;
    }

    $includeInactive = filter_var($_GET['includeInactive'] ?? false, FILTER_VALIDATE_BOOLEAN);
    $whereSql = $includeInactive ? '' : 'WHERE sc.is_active = 1';
    $stmt = $pdo->query("
        SELECT
            sc.*,
            CONCAT(u.first_Name, ' ', u.last_Name) AS created_by_name
        FROM service_catalog sc
        LEFT JOIN users u ON u.user_id = sc.created_by_user_id
        {$whereSql}
        ORDER BY sc.is_active DESC, sc.service_type ASC, sc.service_name ASC
    ");
    $services = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $serviceId = (int)$row['service_id'];
        $services[$serviceId] = [
            'serviceId' => $serviceId,
            'serviceCode' => $row['service_code'] ?? '',
            'serviceName' => $row['service_name'],
            'serviceType' => $row['service_type'],
            'description' => $row['description'] ?? '',
            'basePrice' => (float)$row['base_price'],
            'isMajorService' => (int)($row['is_major_service'] ?? 0) === 1,
            'isActive' => (int)$row['is_active'] === 1,
            'createdByUserId' => $row['created_by_user_id'] !== null ? (int)$row['created_by_user_id'] : null,
            'createdByName' => trim((string)($row['created_by_name'] ?? '')),
            'createdAt' => $row['created_at'],
            'updatedAt' => $row['updated_at'],
            'materials' => []
        ];
    }

    if (!empty($services)) {
        $materialStmt = $pdo->query("
            SELECT
                sm.*,
                ii.item_name,
                ii.sku,
                ii.unit
            FROM service_materials sm
            LEFT JOIN inventory_items ii ON ii.item_id = sm.item_id
            ORDER BY sm.service_id ASC, ii.item_name ASC
        ");
        foreach ($materialStmt->fetchAll(PDO::FETCH_ASSOC) as $material) {
            $serviceId = (int)$material['service_id'];
            if (isset($services[$serviceId])) {
                $services[$serviceId]['materials'][] = service_catalog_format_material($material);
            }
        }
    }

    echo json_encode([
        'success' => true,
        'schemaReady' => true,
        'services' => array_values($services)
    ]);
}

function service_catalog_validate_type(string $serviceType): string
{
    $allowedTypes = [
        'consultation',
        'vaccination',
        'laboratory',
        'surgery',
        'grooming',
        'boarding',
        'dental',
        'home_service',
        'other'
    ];

    if (!in_array($serviceType, $allowedTypes, true)) {
        service_catalog_error(400, 'Invalid service type.');
    }

    return $serviceType;
}

function service_catalog_save(PDO $pdo, ?int $serviceId = null): void
{
    service_catalog_require_schema($pdo);

    $input = service_catalog_input();
    $currentUser = service_catalog_require_admin($pdo);
    $createdByUserId = ipawcus_guard_user_id($currentUser);
    $serviceName = service_catalog_text($input['service_name'] ?? $input['serviceName'] ?? '');
    $serviceType = service_catalog_validate_type(service_catalog_text($input['service_type'] ?? $input['serviceType'] ?? ''));
    $basePrice = (float)($input['base_price'] ?? $input['basePrice'] ?? 0);

    if ($serviceName === '') {
        service_catalog_error(400, 'Service name is required.');
    }

    if ($basePrice < 0) {
        service_catalog_error(400, 'Base price cannot be negative.');
    }

    $serviceCode = service_catalog_nullable_text($input['service_code'] ?? $input['serviceCode'] ?? null);
    $description = service_catalog_nullable_text($input['description'] ?? null);
    $isMajorService = isset($input['is_major_service'])
        ? (int)(bool)$input['is_major_service']
        : (isset($input['isMajorService']) ? (int)(bool)$input['isMajorService'] : 0);
    if ($serviceType === 'other') {
        $isMajorService = 0;
    }
    $isActive = isset($input['is_active']) ? (int)(bool)$input['is_active'] : (isset($input['isActive']) ? (int)(bool)$input['isActive'] : 1);
    try {
        if ($serviceId !== null && $serviceId > 0) {
            $stmt = $pdo->prepare("
                UPDATE service_catalog
                SET service_code = ?,
                    service_name = ?,
                    service_type = ?,
                    description = ?,
                    base_price = ?,
                    is_major_service = ?,
                    is_active = ?
                WHERE service_id = ?
            ");
            $stmt->execute([$serviceCode, $serviceName, $serviceType, $description, $basePrice, $isMajorService, $isActive, $serviceId]);
            service_catalog_notify_super_admin($pdo, $serviceId, $serviceName, 'updated');
            echo json_encode(['success' => true, 'message' => 'Service updated.', 'serviceId' => $serviceId]);
            return;
        }

        $stmt = $pdo->prepare("
            INSERT INTO service_catalog (
                service_code,
                service_name,
                service_type,
                description,
                base_price,
                is_major_service,
                is_active,
                created_by_user_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([$serviceCode, $serviceName, $serviceType, $description, $basePrice, $isMajorService, $isActive, $createdByUserId]);
        $createdServiceId = (int)$pdo->lastInsertId();
        service_catalog_notify_super_admin($pdo, $createdServiceId, $serviceName, 'created');

        http_response_code(201);
        echo json_encode([
            'success' => true,
            'message' => 'Service created.',
            'serviceId' => $createdServiceId
        ]);
    } catch (PDOException $e) {
        service_catalog_error(500, 'Failed to save service: ' . $e->getMessage());
    }
}

function service_catalog_save_materials(PDO $pdo, int $serviceId): void
{
    service_catalog_require_schema($pdo);
    service_catalog_require_admin($pdo);

    if ($serviceId <= 0) {
        service_catalog_error(400, 'Service ID is required.');
    }

    $existsStmt = $pdo->prepare("SELECT service_id, service_name FROM service_catalog WHERE service_id = ? LIMIT 1");
    $existsStmt->execute([$serviceId]);
    $service = $existsStmt->fetch(PDO::FETCH_ASSOC);
    if (!$service) {
        service_catalog_error(404, 'Service was not found.');
    }

    $input = service_catalog_input();
    $materials = $input['materials'] ?? [];
    if (!is_array($materials)) {
        service_catalog_error(400, 'Materials must be an array.');
    }

    if (count($materials) > 100) {
        service_catalog_error(400, 'A service can have at most 100 preset materials.');
    }

    $allowedPolicies = ['included', 'separate', 'optional'];
    $seenMaterials = [];

    $pdo->beginTransaction();
    try {
        $deleteStmt = $pdo->prepare("DELETE FROM service_materials WHERE service_id = ?");
        $deleteStmt->execute([$serviceId]);

        $insertStmt = $pdo->prepare("
            INSERT INTO service_materials (
                service_id,
                item_id,
                material_name,
                qty_used,
                billable_policy
            ) VALUES (?, ?, ?, ?, ?)
        ");

        foreach ($materials as $material) {
            $itemId = (int)($material['item_id'] ?? $material['itemId'] ?? 0);
            $materialName = service_catalog_nullable_text($material['material_name'] ?? $material['materialName'] ?? $material['item_name'] ?? $material['itemName'] ?? null);
            $qtyValue = $material['qty_used'] ?? $material['qtyUsed'] ?? 1;
            if (!is_numeric($qtyValue)) {
                service_catalog_error(400, 'Material quantity must be a valid number.');
            }
            $qtyUsed = (float)$qtyValue;
            $policy = service_catalog_text($material['billable_policy'] ?? $material['billablePolicy'] ?? 'included');

            if ($itemId <= 0 && $materialName === null) {
                continue;
            }

            if ($qtyUsed <= 0) {
                service_catalog_error(400, 'Material quantity must be greater than 0.');
            }

            if (!in_array($policy, $allowedPolicies, true)) {
                service_catalog_error(400, 'Invalid material billable policy.');
            }

            if ($materialName !== null && strlen($materialName) > 180) {
                service_catalog_error(400, 'Material name must be 180 characters or fewer.');
            }

            if ($itemId > 0) {
                $itemStmt = $pdo->prepare("SELECT item_id, item_name, status FROM inventory_items WHERE item_id = ? LIMIT 1");
                $itemStmt->execute([$itemId]);
                $item = $itemStmt->fetch(PDO::FETCH_ASSOC);
                if (!$item) {
                    service_catalog_error(404, 'Inventory material was not found.');
                }
                if (($item['status'] ?? '') !== 'active') {
                    service_catalog_error(409, 'Inactive inventory materials cannot be attached to a service.');
                }
                if (abs($qtyUsed - round($qtyUsed)) > 0.0001) {
                    service_catalog_error(400, 'Linked inventory material quantities must be whole numbers because inventory stock is batch-counted.');
                }
                $materialName = $materialName ?: $item['item_name'];
            } elseif ($materialName !== null) {
                $matchStmt = $pdo->prepare("
                    SELECT item_id
                    FROM inventory_items
                    WHERE LOWER(item_name) = LOWER(?)
                      AND status = 'active'
                    ORDER BY item_id ASC
                    LIMIT 1
                ");
                $matchStmt->execute([$materialName]);
                $matchedItemId = $matchStmt->fetchColumn();
                $itemId = $matchedItemId ? (int)$matchedItemId : null;
                if ($itemId !== null && abs($qtyUsed - round($qtyUsed)) > 0.0001) {
                    service_catalog_error(400, 'Linked inventory material quantities must be whole numbers because inventory stock is batch-counted.');
                }
            }

            $dedupeKey = $itemId
                ? 'item:' . $itemId
                : 'name:' . strtolower(preg_replace('/\s+/', ' ', $materialName ?? ''));
            if (isset($seenMaterials[$dedupeKey])) {
                service_catalog_error(400, 'Duplicate service materials are not allowed.');
            }
            $seenMaterials[$dedupeKey] = true;

            $insertStmt->execute([$serviceId, $itemId ?: null, $materialName, $qtyUsed, $policy]);
        }

        $pdo->commit();
        service_catalog_notify_super_admin($pdo, $serviceId, (string)$service['service_name'], 'updated');
        echo json_encode(['success' => true, 'message' => 'Service materials saved.']);
    } catch (Exception $e) {
        service_catalog_error(500, 'Failed to save materials: ' . $e->getMessage());
    }
}

function service_catalog_reference_count(PDO $pdo, string $tableName, string $columnName, int $serviceId): int
{
    if (!service_catalog_table_exists($pdo, $tableName) || !service_catalog_column_exists($pdo, $tableName, $columnName)) {
        return 0;
    }

    $stmt = $pdo->prepare("SELECT COUNT(*) FROM {$tableName} WHERE {$columnName} = ?");
    $stmt->execute([$serviceId]);

    return (int)$stmt->fetchColumn();
}

function service_catalog_delete(PDO $pdo, int $serviceId, bool $hardDelete = false): void
{
    service_catalog_require_schema($pdo);
    service_catalog_require_admin($pdo);

    if ($serviceId <= 0) {
        service_catalog_error(400, 'Service ID is required.');
    }

    $existsStmt = $pdo->prepare("SELECT service_id, service_name FROM service_catalog WHERE service_id = ? LIMIT 1");
    $existsStmt->execute([$serviceId]);
    $service = $existsStmt->fetch(PDO::FETCH_ASSOC);
    if (!$service) {
        service_catalog_error(404, 'Service was not found.');
    }

    if (!$hardDelete) {
        $stmt = $pdo->prepare("UPDATE service_catalog SET is_active = 0 WHERE service_id = ?");
        $stmt->execute([$serviceId]);
        service_catalog_notify_super_admin($pdo, $serviceId, (string)$service['service_name'], 'deactivated');

        echo json_encode(['success' => true, 'message' => 'Service deactivated.']);
        return;
    }

    $usedChargeCount = service_catalog_reference_count($pdo, 'visit_charges', 'service_id', $serviceId);
    if ($usedChargeCount > 0) {
        service_catalog_error(409, 'This service is already used in billing history. Deactivate it instead of deleting it.');
    }

    $pdo->beginTransaction();
    try {
        $materialStmt = $pdo->prepare("DELETE FROM service_materials WHERE service_id = ?");
        $materialStmt->execute([$serviceId]);

        $stmt = $pdo->prepare("DELETE FROM service_catalog WHERE service_id = ?");
        $stmt->execute([$serviceId]);
        $pdo->commit();
    } catch (PDOException $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }

        if ($e->getCode() === '23000') {
            service_catalog_error(409, 'This service is already used by existing records. Deactivate it instead of deleting it.');
        }

        service_catalog_error(500, 'Failed to delete service: ' . $e->getMessage());
    }

    service_catalog_notify_super_admin($pdo, $serviceId, (string)$service['service_name'], 'deleted');

    echo json_encode(['success' => true, 'message' => 'Service deleted.']);
}

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
$serviceId = isset($_GET['serviceId']) ? (int)$_GET['serviceId'] : null;

if ($method === 'GET') {
    service_catalog_list($pdo);
} elseif ($method === 'POST' && $action === 'materials') {
    service_catalog_save_materials($pdo, (int)$serviceId);
} elseif ($method === 'POST' && $serviceId !== null && $serviceId > 0) {
    service_catalog_save($pdo, (int)$serviceId);
} elseif ($method === 'POST') {
    service_catalog_save($pdo);
} elseif ($method === 'PATCH') {
    service_catalog_save($pdo, (int)$serviceId);
} elseif ($method === 'DELETE') {
    $hardDelete = filter_var($_GET['hardDelete'] ?? false, FILTER_VALIDATE_BOOLEAN);
    service_catalog_delete($pdo, (int)$serviceId, $hardDelete);
} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
}
