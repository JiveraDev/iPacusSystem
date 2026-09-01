<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/workflow_guard_helpers.php';
require_once __DIR__ . '/branch_helpers.php';

$inventoryCurrentUser = ipawcus_guard_current_user($pdo);

function inventoryRequestedBranchId(PDO $pdo): int
{
    global $inventoryCurrentUser;
    $requested = $_GET['branchId'] ?? $_GET['branch_id'] ?? null;
    $branchId = is_numeric($requested)
        ? (int)$requested
        : branch_user_primary_id($pdo, ipawcus_guard_user_id($inventoryCurrentUser));
    if (!branch_fetch($pdo, $branchId)) {
        throw new InvalidArgumentException('Select an active inventory branch.');
    }
    if (!branch_user_can_access($pdo, $inventoryCurrentUser, $branchId)) {
        ipawcus_guard_error(403, 'You cannot access inventory from another branch.');
    }
    return $branchId;
}

function inventoryAssertLocationAccess(PDO $pdo, int $locationId): int
{
    global $inventoryCurrentUser;
    $stmt = $pdo->prepare('SELECT branch_id FROM inventory_locations WHERE location_id = ? AND status = \'active\' LIMIT 1');
    $stmt->execute([$locationId]);
    $branchId = (int)$stmt->fetchColumn();
    if ($branchId <= 0) {
        throw new InvalidArgumentException('Inventory location was not found.');
    }
    if (!branch_user_can_access($pdo, $inventoryCurrentUser, $branchId)) {
        ipawcus_guard_error(403, 'You cannot change inventory at another branch.');
    }
    return $branchId;
}

function inventoryInput(): array
{
    return json_decode(file_get_contents('php://input'), true) ?? [];
}

function inventoryColumnExists(PDO $pdo, string $tableName, string $columnName): bool
{
    static $cache = [];
    $cacheKey = spl_object_id($pdo) . ':' . $tableName . ':' . $columnName;
    if (array_key_exists($cacheKey, $cache)) {
        return $cache[$cacheKey];
    }

    $stmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = ?
          AND column_name = ?
    ");
    $stmt->execute([$tableName, $columnName]);
    $cache[$cacheKey] = (int)$stmt->fetchColumn() > 0;

    return $cache[$cacheKey];
}

function inventoryUser(PDO $pdo, $userId): array
{
    global $inventoryCurrentUser;
    $authenticatedUserId = ipawcus_guard_user_id($inventoryCurrentUser);
    if ($authenticatedUserId <= 0) {
        ipawcus_guard_error(401, 'A valid logged-in inventory user is required.');
    }
    if ($userId && (int)$userId !== $authenticatedUserId) {
        ipawcus_guard_error(403, 'Inventory changes can only be confirmed by the logged-in account.');
    }

    return [
        'user_id' => $authenticatedUserId,
        'full_name' => trim((string)($inventoryCurrentUser['first_Name'] ?? '') . ' ' . (string)($inventoryCurrentUser['last_Name'] ?? '')) ?: 'Inventory user',
    ];
}

function inventoryConfirmResponsibility(PDO $pdo, array $input, string $actionType, bool $reasonRequired = false): array
{
    $user = inventoryUser($pdo, $input['user_id'] ?? null);
    $acknowledged = filter_var($input['responsibility_acknowledged'] ?? false, FILTER_VALIDATE_BOOLEAN);
    $password = (string)($input['confirmation_password'] ?? '');
    $reason = inventoryOptionalText($input['reason'] ?? $input['remarks'] ?? null);

    if (!$acknowledged) {
        ipawcus_guard_error(422, 'Confirm that you accept responsibility for this inventory change.');
    }
    if ($password === '') {
        ipawcus_guard_error(422, 'Your account password is required to confirm this inventory change.');
    }
    if ($reasonRequired && !$reason) {
        ipawcus_guard_error(422, 'A reason is required for this inventory change.');
    }
    if (!ipawcus_guard_table_exists($pdo, 'inventory_action_audit')) {
        ipawcus_guard_error(409, 'Run DDL/20260901_02_inventory_responsibility_safeguards.sql before changing inventory.');
    }

    $passwordStmt = $pdo->prepare('SELECT user_password FROM users WHERE user_id = ? LIMIT 1');
    $passwordStmt->execute([(int)$user['user_id']]);
    $passwordHash = (string)$passwordStmt->fetchColumn();
    if ($passwordHash === '' || !password_verify($password, $passwordHash)) {
        ipawcus_guard_error(403, 'The password entered does not match the logged-in account.');
    }

    return array_merge($user, [
        'action_type' => $actionType,
        'reason' => $reason,
    ]);
}

function inventoryWriteAudit(
    PDO $pdo,
    array $confirmation,
    ?int $itemId,
    ?int $batchId,
    ?int $locationId,
    $beforeState,
    $afterState
): void {
    $encode = static fn($value): ?string => $value === null
        ? null
        : json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    $stmt = $pdo->prepare("
        INSERT INTO inventory_action_audit (
            action_type, item_id, batch_id, location_id, reason,
            before_state_json, after_state_json,
            performed_by_user_id, performed_by_name
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");
    $stmt->execute([
        $confirmation['action_type'],
        $itemId,
        $batchId,
        $locationId,
        $confirmation['reason'],
        $encode($beforeState),
        $encode($afterState),
        (int)$confirmation['user_id'],
        $confirmation['full_name'],
    ]);
}

function inventoryStatus(int $quantity, int $reorderLevel, ?string $expiryDate, int $warningDays): string
{
    if ($quantity <= 0) return 'out-of-stock';
    if ($expiryDate) {
        $today = new DateTimeImmutable('today');
        $expiry = new DateTimeImmutable($expiryDate);
        if ($expiry < $today) return 'expired';
        if ((int)$today->diff($expiry)->format('%a') <= $warningDays) return 'near-expiry';
    }
    if ($reorderLevel > 0 && $quantity <= $reorderLevel) return 'low-stock';
    return 'in-stock';
}

function inventoryText($value): string
{
    return trim((string)($value ?? ''));
}

function inventoryOptionalText($value): ?string
{
    $text = inventoryText($value);
    return $text === '' ? null : $text;
}

function inventoryCodePart($value, int $length, string $fallback): string
{
    $clean = strtoupper(preg_replace('/[^A-Za-z0-9]+/', '', inventoryText($value)));
    if ($clean === '') {
        $clean = $fallback;
    }

    return substr(str_pad($clean, $length, $fallback), 0, $length);
}

function inventorySkuExists(PDO $pdo, string $sku): bool
{
    $stmt = $pdo->prepare("SELECT 1 FROM inventory_items WHERE sku = ? LIMIT 1");
    $stmt->execute([$sku]);
    return (bool)$stmt->fetchColumn();
}

function inventoryBatchExists(PDO $pdo, int $itemId, string $batchNumber): bool
{
    $stmt = $pdo->prepare("SELECT 1 FROM inventory_batches WHERE item_id = ? AND batch_number = ? LIMIT 1");
    $stmt->execute([$itemId, $batchNumber]);
    return (bool)$stmt->fetchColumn();
}

function inventoryGenerateSku(PDO $pdo, string $itemName, string $category, ?string $brand): string
{
    $base = implode('-', [
        inventoryCodePart($category, 3, 'INV'),
        inventoryCodePart($brand ?: $itemName, 3, 'GEN'),
        inventoryCodePart($itemName, 4, 'ITEM'),
        date('ymd')
    ]);

    $counter = 1;
    do {
        $sku = sprintf('%s-%03d', $base, $counter);
        $counter++;
    } while (inventorySkuExists($pdo, $sku));

    return $sku;
}

function inventoryGenerateBatchNumber(PDO $pdo, int $itemId, string $itemName): string
{
    $base = implode('-', [
        'BCH',
        inventoryCodePart($itemName, 4, 'ITEM'),
        date('ymd')
    ]);

    $counter = 1;
    do {
        $batchNumber = sprintf('%s-%03d', $base, $counter);
        $counter++;
    } while (inventoryBatchExists($pdo, $itemId, $batchNumber));

    return $batchNumber;
}

function inventoryResolveLocationId(PDO $pdo, array $input): int
{
    $locationId = (int)($input['location_id'] ?? 0);
    if ($locationId > 0) {
        $stmt = $pdo->prepare("
            SELECT location_id
            FROM inventory_locations
            WHERE location_id = ? AND status = 'active'
            LIMIT 1
        ");
        $stmt->execute([$locationId]);
        $existingId = $stmt->fetchColumn();
        if ($existingId) {
            inventoryAssertLocationAccess($pdo, (int)$existingId);
            return (int)$existingId;
        }

        throw new Exception('Inventory location was not found.');
    }

    $locationName = inventoryOptionalText($input['location_name'] ?? null);
    $storageArea = inventoryOptionalText($input['storage_area'] ?? $input['storageArea'] ?? null) ?: 'General Storage';
    if (!$locationName) {
        throw new Exception('Inventory location is required.');
    }

    $branchId = inventoryRequestedBranchId($pdo);
    $lookup = $pdo->prepare("
        SELECT location_id
        FROM inventory_locations
        WHERE LOWER(location_name) = LOWER(?)
          AND branch_id = ?
          AND LOWER(COALESCE(storage_area, 'General Storage')) = LOWER(?)
        LIMIT 1
    ");
    $lookup->execute([$locationName, $branchId, $storageArea]);
    $existingId = $lookup->fetchColumn();
    if ($existingId) {
        inventoryAssertLocationAccess($pdo, (int)$existingId);
        return (int)$existingId;
    }

    try {
        $insert = $pdo->prepare("INSERT INTO inventory_locations (branch_id, location_name, storage_area) VALUES (?, ?, ?)");
        $insert->execute([$branchId, $locationName, $storageArea]);
        return (int)$pdo->lastInsertId();
    } catch (PDOException $e) {
        $lookup->execute([$locationName, $branchId, $storageArea]);
        $existingId = $lookup->fetchColumn();
        if ($existingId) {
            return (int)$existingId;
        }
        throw $e;
    }
}

function inventoryResolveSupplierId(PDO $pdo, array $input): int
{
    $supplierId = (int)($input['supplier_id'] ?? 0);
    if ($supplierId > 0) {
        $stmt = $pdo->prepare("
            SELECT supplier_id
            FROM inventory_suppliers
            WHERE supplier_id = ? AND status = 'active'
            LIMIT 1
        ");
        $stmt->execute([$supplierId]);
        $existingId = $stmt->fetchColumn();
        if ($existingId) {
            return (int)$existingId;
        }

        throw new Exception('Supplier was not found.');
    }

    $supplierName = inventoryOptionalText($input['supplier_name'] ?? null);
    if (!$supplierName) {
        throw new Exception('Supplier is required for each stock-in item.');
    }

    if (strlen($supplierName) > 150) {
        throw new Exception('Supplier name must be 150 characters or fewer.');
    }

    $lookup = $pdo->prepare("
        SELECT supplier_id, status
        FROM inventory_suppliers
        WHERE LOWER(supplier_name) = LOWER(?)
        LIMIT 1
    ");
    $lookup->execute([$supplierName]);
    $existing = $lookup->fetch(PDO::FETCH_ASSOC);
    if ($existing) {
        if ((string)($existing['status'] ?? '') !== 'active') {
            $activate = $pdo->prepare("UPDATE inventory_suppliers SET status = 'active' WHERE supplier_id = ?");
            $activate->execute([(int)$existing['supplier_id']]);
        }

        return (int)$existing['supplier_id'];
    }

    try {
        $insert = $pdo->prepare("INSERT INTO inventory_suppliers (supplier_name) VALUES (?)");
        $insert->execute([$supplierName]);
        return (int)$pdo->lastInsertId();
    } catch (PDOException $e) {
        $lookup->execute([$supplierName]);
        $existing = $lookup->fetch(PDO::FETCH_ASSOC);
        if ($existing) {
            return (int)$existing['supplier_id'];
        }
        throw $e;
    }
}

function getInventoryItems(PDO $pdo): void
{
    $branchId = inventoryRequestedBranchId($pdo);
    $stmt = $pdo->prepare("
        SELECT
            i.*,
            branch.branch_name,
            item_location.location_name AS item_location_name,
            item_location.storage_area AS item_storage_area,
            (
                SELECT COALESCE(SUM(b.quantity), 0)
                FROM inventory_batches b
                JOIN inventory_locations bl ON bl.location_id = b.location_id
                WHERE b.item_id = i.item_id AND bl.branch_id = ?
            ) AS total_quantity,
            (
                SELECT MIN(b.expiry_date)
                FROM inventory_batches b
                JOIN inventory_locations bl ON bl.location_id = b.location_id
                WHERE b.item_id = i.item_id AND bl.branch_id = ? AND b.expiry_date IS NOT NULL
            ) AS nearest_expiry,
            (
                SELECT s.supplier_name
                FROM inventory_stock_receipt_items sri
                JOIN inventory_suppliers s ON s.supplier_id = sri.supplier_id
                WHERE sri.item_id = i.item_id
                ORDER BY sri.receipt_item_id DESC
                LIMIT 1
            ) AS last_supplier
        FROM inventory_items i
        JOIN branches branch ON branch.branch_id = ?
        LEFT JOIN inventory_locations item_location ON item_location.location_id = i.location_id
        WHERE i.status = 'active'
        ORDER BY i.item_name ASC
    ");
    $stmt->execute([$branchId, $branchId, $branchId]);
    $items = $stmt->fetchAll();

    $batchStmt = $pdo->prepare("
        SELECT b.*, l.location_name, l.storage_area, l.branch_id
        FROM inventory_batches b
        JOIN inventory_locations l ON l.location_id = b.location_id
        WHERE l.branch_id = ?
        ORDER BY b.expiry_date IS NULL, b.expiry_date ASC, b.batch_number ASC
    ");
    $batchStmt->execute([$branchId]);
    $batchesByItem = [];
    foreach ($batchStmt->fetchAll() as $batch) {
        $itemId = (int)$batch['item_id'];
        $batchesByItem[$itemId][] = [
            'id' => (string)$batch['batch_id'],
            'batchId' => (int)$batch['batch_id'],
            'batchNumber' => $batch['batch_number'],
            'quantity' => (int)$batch['quantity'],
            'manufacturingDate' => $batch['manufacturing_date'],
            'expiryDate' => $batch['expiry_date'] ?: 'No expiry',
            'locationId' => (int)$batch['location_id'],
            'location' => trim((string)$batch['location_name']) . ' / ' . trim((string)($batch['storage_area'] ?: 'General Storage')),
            'locationName' => $batch['location_name'],
            'storageArea' => $batch['storage_area'] ?: 'General Storage',
            'unitCost' => (float)$batch['unit_cost'],
            'createdAt' => $batch['created_at']
        ];
    }

    $hasSellingPrice = inventoryColumnExists($pdo, 'inventory_items', 'selling_price');
    $result = array_map(function ($item) use ($batchesByItem, $branchId, $hasSellingPrice) {
        $itemId = (int)$item['item_id'];
        $quantity = (int)$item['total_quantity'];
        $reorderLevel = (int)$item['reorder_level'];
        $warningDays = (int)$item['expiry_warning_days'];
        $nearestExpiry = $item['nearest_expiry'];

        return [
            'id' => (string)$itemId,
            'itemId' => $itemId,
            'image' => $item['profile_image_path'] ? '/' . ltrim($item['profile_image_path'], '/') : '',
            'name' => $item['item_name'],
            'genericName' => $item['generic_name'],
            'sku' => $item['sku'],
            'barcode' => $item['barcode'],
            'description' => $item['description'],
            'category' => $item['category'],
            'brand' => $item['brand'],
            'supplier' => $item['last_supplier'] ?: 'No stock receipt yet',
            'supplierContact' => '',
            'locationId' => (int)$item['location_id'],
            'location' => ($batchesByItem[$itemId][0]['location'] ?? trim((string)($item['item_location_name'] ?: $item['branch_name'])) . ' / ' . trim((string)($item['item_storage_area'] ?: 'General Storage'))),
            'storageArea' => $batchesByItem[$itemId][0]['storageArea'] ?? ($item['item_storage_area'] ?: 'General Storage'),
            'branchId' => $branchId,
            'branchName' => $item['branch_name'],
            'quantity' => $quantity,
            'unit' => $item['unit'],
            'costPrice' => (float)$item['unit_cost'],
            'sellingPrice' => (float)($hasSellingPrice ? ($item['selling_price'] ?? $item['unit_cost']) : $item['unit_cost']),
            'expiryDate' => $nearestExpiry,
            'batches' => $batchesByItem[$itemId] ?? [],
            'status' => inventoryStatus($quantity, $reorderLevel, $nearestExpiry, $warningDays),
            'lastUpdated' => $item['updated_at'],
            'reorderLevel' => $reorderLevel,
            'expiryWarningDays' => $warningDays,
            'storageInstructions' => '',
            'createdBy' => $item['created_by_name']
        ];
    }, $items);

    echo json_encode(['items' => $result]);
}

function getInventoryMeta(PDO $pdo): void
{
    $branchId = inventoryRequestedBranchId($pdo);
    $suppliers = $pdo->query("
        SELECT supplier_id AS id, supplier_name AS name
        FROM inventory_suppliers
        WHERE status = 'active'
        ORDER BY supplier_name
    ")->fetchAll();

    $locationsStmt = $pdo->prepare("
        SELECT
            location.location_id AS id,
            location.location_name AS name,
            location.location_type AS type,
            location.storage_area AS storageArea,
            branch.branch_name AS branchName,
            CONCAT(branch.branch_name, ' - ', location.location_name, ' / ', COALESCE(NULLIF(location.storage_area, ''), 'General Storage')) AS displayName
        FROM inventory_locations location
        JOIN branches branch ON branch.branch_id = location.branch_id
        WHERE location.status = 'active' AND location.branch_id = ?
        ORDER BY location.location_name, location.storage_area
    ");
    $locationsStmt->execute([$branchId]);
    $locations = $locationsStmt->fetchAll();

    $brands = $pdo->query("
        SELECT DISTINCT brand AS name
        FROM inventory_items
        WHERE status = 'active' AND brand IS NOT NULL AND TRIM(brand) <> ''
        ORDER BY brand
    ")->fetchAll();

    $units = $pdo->query("
        SELECT DISTINCT unit AS name
        FROM inventory_items
        WHERE status = 'active' AND unit IS NOT NULL AND TRIM(unit) <> ''
        ORDER BY unit
    ")->fetchAll();

    echo json_encode([
        'suppliers' => $suppliers,
        'locations' => $locations,
        'brands' => $brands,
        'units' => $units,
        'branchId' => $branchId
    ]);
}

function createInventoryItem(PDO $pdo): void
{
    $input = inventoryInput();
    $confirmation = inventoryConfirmResponsibility($pdo, $input, 'create_item');
    $user = $confirmation;

    $required = ['item_name', 'category', 'unit'];
    foreach ($required as $field) {
        if (!inventoryOptionalText($input[$field] ?? null)) {
            http_response_code(400);
            echo json_encode(['message' => "$field is required."]);
            return;
        }
    }

    if ((int)($input['location_id'] ?? 0) <= 0 && !inventoryOptionalText($input['location_name'] ?? null)) {
        http_response_code(400);
        echo json_encode(['message' => 'Inventory location is required.']);
        return;
    }

    $pdo->beginTransaction();
    try {
        $itemName = inventoryText($input['item_name']);
        $category = inventoryText($input['category']);
        $unit = inventoryText($input['unit']);
        $brand = inventoryOptionalText($input['brand'] ?? null);
        $locationId = inventoryResolveLocationId($pdo, $input);
        $sku = inventoryOptionalText($input['sku'] ?? null);
        if (!$sku || inventorySkuExists($pdo, $sku)) {
            $sku = inventoryGenerateSku($pdo, $itemName, $category, $brand);
        }

        $itemColumns = [
            'item_name', 'generic_name', 'sku', 'barcode', 'description', 'category', 'brand', 'unit',
            'location_id', 'reorder_level', 'unit_cost',
        ];
        $itemValues = [
            $itemName,
            inventoryOptionalText($input['generic_name'] ?? null),
            $sku,
            inventoryOptionalText($input['barcode'] ?? null),
            inventoryOptionalText($input['description'] ?? null),
            $category,
            $brand,
            $unit,
            $locationId,
            (int)($input['reorder_level'] ?? 0),
            (float)($input['unit_cost'] ?? 0),
        ];
        if (inventoryColumnExists($pdo, 'inventory_items', 'selling_price')) {
            $sellingPrice = (float)($input['selling_price'] ?? $input['unit_cost'] ?? 0);
            if ($sellingPrice < 0) {
                throw new InvalidArgumentException('Selling price cannot be negative.');
            }
            $itemColumns[] = 'selling_price';
            $itemValues[] = $sellingPrice;
        }
        $itemColumns = array_merge($itemColumns, [
            'expiry_warning_days', 'profile_image_path', 'created_by_user_id', 'created_by_name',
        ]);
        $itemValues = array_merge($itemValues, [
            (int)($input['expiry_warning_days'] ?? 90),
            inventoryOptionalText($input['profile_image_path'] ?? null),
            (int)$user['user_id'],
            $user['full_name'],
        ]);
        $placeholders = implode(', ', array_fill(0, count($itemColumns), '?'));
        $stmt = $pdo->prepare(
            'INSERT INTO inventory_items (' . implode(', ', $itemColumns) . ') VALUES (' . $placeholders . ')'
        );
        $stmt->execute($itemValues);

        $itemId = (int)$pdo->lastInsertId();
        $quantity = (int)($input['quantity'] ?? 0);
        if ($quantity < 0) {
            throw new Exception('Initial quantity cannot be negative.');
        }
        $batchId = null;
        $batchNumber = null;

        if ($quantity > 0) {
            $batchNumber = inventoryOptionalText($input['batch_number'] ?? null);
            if (!$batchNumber || inventoryBatchExists($pdo, $itemId, $batchNumber)) {
                $batchNumber = inventoryGenerateBatchNumber($pdo, $itemId, $itemName);
            }

            $batchStmt = $pdo->prepare("
                INSERT INTO inventory_batches (
                    item_id, location_id, batch_number, quantity, expiry_date, unit_cost
                ) VALUES (?, ?, ?, ?, ?, ?)
            ");
            $batchStmt->execute([
                $itemId,
                $locationId,
                $batchNumber,
                $quantity,
                inventoryOptionalText($input['expiry_date'] ?? null),
                (float)($input['unit_cost'] ?? 0)
            ]);
            $batchId = (int)$pdo->lastInsertId();
        }

        $movementStmt = $pdo->prepare("
            INSERT INTO inventory_stock_movements (
                item_id, batch_id, location_id, movement_type, quantity_change, quantity_before, quantity_after,
                reference_type, reference_id, remarks, performed_by_user_id, performed_by_name
            ) VALUES (?, ?, ?, 'add_item', ?, 0, ?, 'inventory_items', ?, ?, ?, ?)
        ");
        $movementStmt->execute([
            $itemId,
            $batchId,
            $locationId,
            $quantity,
            $quantity,
            $itemId,
            'Inventory item created',
            (int)$user['user_id'],
            $user['full_name']
        ]);

        inventoryWriteAudit(
            $pdo,
            $confirmation,
            $itemId,
            $batchId,
            $locationId,
            null,
            [
                'item_name' => $itemName,
                'sku' => $sku,
                'category' => $category,
                'brand' => $brand,
                'unit' => $unit,
                'location_id' => $locationId,
                'quantity' => $quantity,
                'batch_number' => $batchNumber,
                'unit_cost' => (float)($input['unit_cost'] ?? 0),
                'selling_price' => (float)($input['selling_price'] ?? $input['unit_cost'] ?? 0),
            ]
        );

        $pdo->commit();
        http_response_code(201);
        echo json_encode([
            'message' => 'Inventory item created.',
            'item_id' => $itemId,
            'sku' => $sku,
            'batch_number' => $batchNumber,
            'location_id' => $locationId
        ]);
    } catch (Exception $e) {
        $pdo->rollBack();
        http_response_code(500);
        echo json_encode(['message' => $e->getMessage()]);
    }
}

function createStockIn(PDO $pdo): void
{
    $input = inventoryInput();
    $confirmation = inventoryConfirmResponsibility($pdo, $input, 'stock_in');
    $user = $confirmation;
    $items = $input['items'] ?? [];

    if (empty($items)) {
        http_response_code(400);
        echo json_encode(['message' => 'At least one stock-in item is required.']);
        return;
    }

    $pdo->beginTransaction();
    try {
        $receiptBranchId = null;
        foreach ($items as $line) {
            $lineLocationId = (int)($line['location_id'] ?? 0);
            $lineBranchId = inventoryAssertLocationAccess($pdo, $lineLocationId);
            if ($receiptBranchId !== null && $receiptBranchId !== $lineBranchId) {
                throw new InvalidArgumentException('A stock-in receipt must contain items for one branch only.');
            }
            $receiptBranchId = $lineBranchId;
        }
        $receiptStmt = $pdo->prepare("
            INSERT INTO inventory_stock_receipts (
                branch_id, receiving_date, delivery_note_number, proof_image_path, notes,
                received_by_user_id, received_by_name
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ");
        $receiptStmt->execute([
            $receiptBranchId,
            $input['receiving_date'] ?? date('Y-m-d'),
            inventoryOptionalText($input['delivery_note_number'] ?? null),
            inventoryOptionalText($input['proof_image_path'] ?? null),
            inventoryOptionalText($input['notes'] ?? null),
            (int)$user['user_id'],
            $user['full_name']
        ]);
        $receiptId = (int)$pdo->lastInsertId();

        foreach ($items as $line) {
            foreach (['item_id', 'location_id', 'batch_number', 'quantity_received'] as $field) {
                if (empty($line[$field])) {
                    throw new Exception("$field is required for each stock-in item.");
                }
            }

            $itemId = (int)$line['item_id'];
            $supplierId = inventoryResolveSupplierId($pdo, $line);
            $locationId = (int)$line['location_id'];
            $batchNumber = inventoryText($line['batch_number']);
            $quantity = (int)$line['quantity_received'];
            if ($quantity <= 0) {
                throw new Exception('Quantity received must be greater than 0.');
            }

            $batchLookup = $pdo->prepare("
                SELECT batch_id, quantity, location_id
                FROM inventory_batches
                WHERE item_id = ? AND batch_number = ? AND location_id = ?
                LIMIT 1
                FOR UPDATE
            ");
            $batchLookup->execute([$itemId, $batchNumber, $locationId]);
            $batch = $batchLookup->fetch();

            if ($batch) {
                if ((int)$batch['location_id'] !== $locationId) {
                    throw new Exception('This batch already exists for the selected item at a different location.');
                }

                $batchId = (int)$batch['batch_id'];
                $before = (int)$batch['quantity'];
                $after = $before + $quantity;
                $updateBatch = $pdo->prepare("
                    UPDATE inventory_batches
                    SET quantity = ?, expiry_date = COALESCE(?, expiry_date), unit_cost = ?
                    WHERE batch_id = ?
                ");
                $updateBatch->execute([
                    $after,
                    inventoryOptionalText($line['expiry_date'] ?? null),
                    (float)($line['unit_cost'] ?? 0),
                    $batchId
                ]);
            } else {
                $before = 0;
                $after = $quantity;
                $insertBatch = $pdo->prepare("
                    INSERT INTO inventory_batches (
                        item_id, location_id, batch_number, quantity, expiry_date, unit_cost
                    ) VALUES (?, ?, ?, ?, ?, ?)
                ");
                $insertBatch->execute([
                    $itemId,
                    $locationId,
                    $batchNumber,
                    $quantity,
                    inventoryOptionalText($line['expiry_date'] ?? null),
                    (float)($line['unit_cost'] ?? 0)
                ]);
                $batchId = (int)$pdo->lastInsertId();
            }

            $receiptItemStmt = $pdo->prepare("
                INSERT INTO inventory_stock_receipt_items (
                    receipt_id, item_id, supplier_id, location_id, batch_id,
                    batch_number, quantity_received, expiry_date, unit_cost
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $receiptItemStmt->execute([
                $receiptId,
                $itemId,
                $supplierId,
                $locationId,
                $batchId,
                $batchNumber,
                $quantity,
                inventoryOptionalText($line['expiry_date'] ?? null),
                (float)($line['unit_cost'] ?? 0)
            ]);

            $movementStmt = $pdo->prepare("
                INSERT INTO inventory_stock_movements (
                    item_id, batch_id, location_id, movement_type, quantity_change, quantity_before, quantity_after,
                    reference_type, reference_id, remarks, performed_by_user_id, performed_by_name
                ) VALUES (?, ?, ?, 'stock_in', ?, ?, ?, 'inventory_stock_receipts', ?, ?, ?, ?)
            ");
            $movementStmt->execute([
                $itemId,
                $batchId,
                $locationId,
                $quantity,
                $before,
                $after,
                $receiptId,
                'Stock in received',
                (int)$user['user_id'],
                $user['full_name']
            ]);
        }

        inventoryWriteAudit(
            $pdo,
            $confirmation,
            null,
            null,
            (int)($items[0]['location_id'] ?? 0) ?: null,
            null,
            [
                'receipt_id' => $receiptId,
                'receiving_date' => $input['receiving_date'] ?? date('Y-m-d'),
                'delivery_note_number' => inventoryOptionalText($input['delivery_note_number'] ?? null),
                'item_count' => count($items),
                'items' => array_map(static fn(array $line): array => [
                    'item_id' => (int)($line['item_id'] ?? 0),
                    'location_id' => (int)($line['location_id'] ?? 0),
                    'batch_number' => inventoryText($line['batch_number'] ?? null),
                    'quantity_received' => (int)($line['quantity_received'] ?? 0),
                ], $items),
            ]
        );

        $pdo->commit();
        http_response_code(201);
        echo json_encode(['message' => 'Stock in recorded.', 'receipt_id' => $receiptId]);
    } catch (Exception $e) {
        $pdo->rollBack();
        http_response_code(500);
        echo json_encode(['message' => $e->getMessage()]);
    }
}

function createStockOut(PDO $pdo): void
{
    $input = inventoryInput();
    $confirmation = inventoryConfirmResponsibility($pdo, $input, 'stock_out', true);
    $user = $confirmation;

    if (empty($input['item_id']) || empty($input['batch_id']) || empty($input['quantity'])) {
        http_response_code(400);
        echo json_encode(['message' => 'item_id, batch_id, and quantity are required.']);
        return;
    }

    $quantity = (int)$input['quantity'];
    if ($quantity <= 0) {
        http_response_code(400);
        echo json_encode(['message' => 'Quantity must be greater than 0.']);
        return;
    }

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare("
            SELECT batch.quantity, batch.location_id
            FROM inventory_batches batch
            WHERE batch.batch_id = ? AND batch.item_id = ?
            LIMIT 1
            FOR UPDATE
        ");
        $stmt->execute([(int)$input['batch_id'], (int)$input['item_id']]);
        $batch = $stmt->fetch();

        if (!$batch) {
            throw new Exception('Batch was not found.');
        }
        $locationId = (int)$batch['location_id'];
        inventoryAssertLocationAccess($pdo, $locationId);

        $before = (int)$batch['quantity'];
        if ($quantity > $before) {
            throw new Exception('Stock out quantity cannot exceed available batch quantity.');
        }

        $after = $before - $quantity;
        $update = $pdo->prepare("UPDATE inventory_batches SET quantity = ? WHERE batch_id = ?");
        $update->execute([$after, (int)$input['batch_id']]);

        $movement = $pdo->prepare("
            INSERT INTO inventory_stock_movements (
                item_id, batch_id, location_id, movement_type, quantity_change, quantity_before, quantity_after,
                reference_type, reference_id, remarks, performed_by_user_id, performed_by_name
            ) VALUES (?, ?, ?, 'stock_out', ?, ?, ?, 'inventory_batches', ?, ?, ?, ?)
        ");
        $movement->execute([
            (int)$input['item_id'],
            (int)$input['batch_id'],
            $locationId,
            -$quantity,
            $before,
            $after,
            (int)$input['batch_id'],
            $confirmation['reason'],
            (int)$user['user_id'],
            $user['full_name']
        ]);

        inventoryWriteAudit(
            $pdo,
            $confirmation,
            (int)$input['item_id'],
            (int)$input['batch_id'],
            $locationId,
            ['quantity' => $before],
            ['quantity' => $after, 'quantity_removed' => $quantity]
        );

        $pdo->commit();
        echo json_encode(['message' => 'Stock out recorded.']);
    } catch (Exception $e) {
        $pdo->rollBack();
        http_response_code(500);
        echo json_encode(['message' => $e->getMessage()]);
    }
}

function updateInventoryItem(PDO $pdo): void
{
    $input = inventoryInput();
    $confirmation = inventoryConfirmResponsibility($pdo, $input, 'update_item');

    $itemId = (int)($input['item_id'] ?? 0);
    if ($itemId <= 0) {
        http_response_code(400);
        echo json_encode(['message' => 'item_id is required.']);
        return;
    }

    $fields = [];
    $values = [];

    $textFields = [
        'item_name' => ['column' => 'item_name', 'required' => true, 'max' => 180],
        'generic_name' => ['column' => 'generic_name', 'required' => false, 'max' => 150],
        'barcode' => ['column' => 'barcode', 'required' => false, 'max' => 80],
        'description' => ['column' => 'description', 'required' => false, 'max' => 2000],
        'category' => ['column' => 'category', 'required' => true, 'max' => 100],
        'brand' => ['column' => 'brand', 'required' => false, 'max' => 120],
        'unit' => ['column' => 'unit', 'required' => true, 'max' => 50],
    ];
    foreach ($textFields as $inputKey => $config) {
        if (!array_key_exists($inputKey, $input)) continue;
        $value = inventoryOptionalText($input[$inputKey]);
        if ($config['required'] && $value === null) {
            ipawcus_guard_error(422, ucwords(str_replace('_', ' ', $inputKey)) . ' is required.');
        }
        if ($value !== null && strlen($value) > $config['max']) {
            ipawcus_guard_error(422, ucwords(str_replace('_', ' ', $inputKey)) . " must be {$config['max']} characters or fewer.");
        }
        $fields[] = $config['column'] . ' = ?';
        $values[] = $value;
    }

    if (array_key_exists('reorder_level', $input)) {
        $reorderLevel = (int)$input['reorder_level'];
        if ($reorderLevel < 0) ipawcus_guard_error(422, 'Reorder level cannot be negative.');
        $fields[] = 'reorder_level = ?';
        $values[] = $reorderLevel;
    }

    if (array_key_exists('expiry_warning_days', $input)) {
        $warningDays = (int)$input['expiry_warning_days'];
        if ($warningDays < 1) ipawcus_guard_error(422, 'Expiry warning days must be at least 1.');
        $fields[] = 'expiry_warning_days = ?';
        $values[] = $warningDays;
    }

    if (array_key_exists('unit_cost', $input)) {
        $unitCost = (float)$input['unit_cost'];
        if ($unitCost < 0) {
            http_response_code(400);
            echo json_encode(['message' => 'Unit cost cannot be negative.']);
            return;
        }

        $fields[] = 'unit_cost = ?';
        $values[] = $unitCost;
    }

    if (array_key_exists('selling_price', $input)) {
        if (!inventoryColumnExists($pdo, 'inventory_items', 'selling_price')) {
            http_response_code(409);
            echo json_encode(['message' => 'Run DDL/20260808_01_payment_integrity.sql before setting selling prices.']);
            return;
        }
        $sellingPrice = (float)$input['selling_price'];
        if ($sellingPrice < 0) {
            http_response_code(400);
            echo json_encode(['message' => 'Selling price cannot be negative.']);
            return;
        }
        $fields[] = 'selling_price = ?';
        $values[] = $sellingPrice;
    }

    if (array_key_exists('location_id', $input)) {
        $locationId = (int)$input['location_id'];
        if ($locationId <= 0) {
            http_response_code(400);
            echo json_encode(['message' => 'location_id is required.']);
            return;
        }

        $locationStmt = $pdo->prepare("
            SELECT location_id
            FROM inventory_locations
            WHERE location_id = ? AND status = 'active'
            LIMIT 1
        ");
        $locationStmt->execute([$locationId]);
        if (!$locationStmt->fetchColumn()) {
            http_response_code(404);
            echo json_encode(['message' => 'Inventory location was not found.']);
            return;
        }
        inventoryAssertLocationAccess($pdo, $locationId);

        $fields[] = 'location_id = ?';
        $values[] = $locationId;
    }

    if (empty($fields)) {
        http_response_code(400);
        echo json_encode(['message' => 'Nothing to update.']);
        return;
    }

    $pdo->beginTransaction();
    $existsStmt = $pdo->prepare("
        SELECT item_id, item_name, generic_name, barcode, description, category, brand, unit,
               reorder_level, expiry_warning_days, unit_cost, selling_price, location_id, status
        FROM inventory_items
        WHERE item_id = ?
        LIMIT 1
        FOR UPDATE
    ");
    $existsStmt->execute([$itemId]);
    $before = $existsStmt->fetch(PDO::FETCH_ASSOC);
    if (!$before) {
        $pdo->rollBack();
        ipawcus_guard_error(404, 'Inventory item was not found.');
    }

    try {
        $values[] = $itemId;
        $stmt = $pdo->prepare("UPDATE inventory_items SET " . implode(', ', $fields) . " WHERE item_id = ?");
        $stmt->execute($values);

        $afterStmt = $pdo->prepare("
            SELECT item_id, item_name, generic_name, barcode, description, category, brand, unit,
                   reorder_level, expiry_warning_days, unit_cost, selling_price, location_id, status
            FROM inventory_items
            WHERE item_id = ?
            LIMIT 1
        ");
        $afterStmt->execute([$itemId]);
        $after = $afterStmt->fetch(PDO::FETCH_ASSOC);
        inventoryWriteAudit(
            $pdo,
            $confirmation,
            $itemId,
            null,
            (int)($after['location_id'] ?? $before['location_id']),
            $before,
            $after
        );
        $pdo->commit();
        echo json_encode(['message' => 'Inventory item updated.']);
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        http_response_code(500);
        echo json_encode(['message' => $error->getMessage()]);
    }
}

function archiveInventoryItem(PDO $pdo): void
{
    $input = inventoryInput();
    $confirmation = inventoryConfirmResponsibility($pdo, $input, 'archive_item', true);
    $itemId = (int)($input['item_id'] ?? 0);
    if ($itemId <= 0) {
        ipawcus_guard_error(422, 'Select an inventory item to archive.');
    }

    $pdo->beginTransaction();
    try {
        $itemStmt = $pdo->prepare("
            SELECT item_id, item_name, sku, status, location_id
            FROM inventory_items
            WHERE item_id = ?
            LIMIT 1
            FOR UPDATE
        ");
        $itemStmt->execute([$itemId]);
        $item = $itemStmt->fetch(PDO::FETCH_ASSOC);
        if (!$item) {
            throw new InvalidArgumentException('Inventory item was not found.');
        }
        inventoryAssertLocationAccess($pdo, (int)$item['location_id']);
        if (strtolower((string)$item['status']) === 'inactive') {
            throw new InvalidArgumentException('This inventory item is already archived.');
        }

        $quantityStmt = $pdo->prepare('SELECT quantity FROM inventory_batches WHERE item_id = ? FOR UPDATE');
        $quantityStmt->execute([$itemId]);
        $quantity = array_sum(array_map('intval', $quantityStmt->fetchAll(PDO::FETCH_COLUMN)));
        if ($quantity > 0) {
            throw new InvalidArgumentException('Stock must be reduced or transferred to zero before this product can be archived.');
        }

        $update = $pdo->prepare("UPDATE inventory_items SET status = 'inactive' WHERE item_id = ?");
        $update->execute([$itemId]);
        inventoryWriteAudit(
            $pdo,
            $confirmation,
            $itemId,
            null,
            (int)$item['location_id'],
            $item,
            array_merge($item, ['status' => 'inactive', 'quantity' => 0])
        );
        $pdo->commit();
        echo json_encode(['message' => 'Inventory item archived.']);
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        $status = $error instanceof InvalidArgumentException ? 409 : 500;
        http_response_code($status);
        echo json_encode(['message' => $error->getMessage()]);
    }
}

function transferInventoryStock(PDO $pdo): void
{
    $input = inventoryInput();
    $confirmation = inventoryConfirmResponsibility($pdo, $input, 'transfer_stock', true);
    $itemId = (int)($input['item_id'] ?? 0);
    $sourceBatchId = (int)($input['batch_id'] ?? $input['source_batch_id'] ?? 0);
    $destinationLocationId = (int)($input['destination_location_id'] ?? 0);
    $quantity = (int)($input['quantity'] ?? 0);
    if ($itemId <= 0 || $sourceBatchId <= 0 || $destinationLocationId <= 0 || $quantity <= 0) {
        ipawcus_guard_error(422, 'Item, source batch, destination location, and a positive quantity are required.');
    }
    if (!ipawcus_guard_table_exists($pdo, 'inventory_transfers') || !ipawcus_guard_table_exists($pdo, 'inventory_transfer_items')) {
        ipawcus_guard_error(409, 'Run the multi-branch inventory transfer migration before transferring stock.');
    }

    $pdo->beginTransaction();
    try {
        $sourceStmt = $pdo->prepare("
            SELECT batch.batch_id, batch.item_id, batch.location_id, batch.batch_number,
                   batch.quantity, batch.expiry_date, batch.manufacturing_date, batch.unit_cost,
                   item.item_name
            FROM inventory_batches batch
            JOIN inventory_items item ON item.item_id = batch.item_id
            WHERE batch.batch_id = ? AND batch.item_id = ? AND item.status = 'active'
            LIMIT 1
            FOR UPDATE
        ");
        $sourceStmt->execute([$sourceBatchId, $itemId]);
        $source = $sourceStmt->fetch(PDO::FETCH_ASSOC);
        if (!$source) {
            throw new InvalidArgumentException('The selected active inventory batch was not found.');
        }

        $sourceLocationId = (int)$source['location_id'];
        $sourceBranchId = inventoryAssertLocationAccess($pdo, $sourceLocationId);
        $destinationBranchId = inventoryAssertLocationAccess($pdo, $destinationLocationId);
        if ($sourceLocationId === $destinationLocationId) {
            throw new InvalidArgumentException('Choose a different destination location.');
        }
        if ($sourceBranchId !== $destinationBranchId) {
            throw new InvalidArgumentException('This immediate transfer is limited to locations in the same clinic branch.');
        }
        $sourceBefore = (int)$source['quantity'];
        if ($quantity > $sourceBefore) {
            throw new InvalidArgumentException('Transfer quantity cannot exceed the available source batch quantity.');
        }

        $destinationStmt = $pdo->prepare("
            SELECT batch_id, quantity
            FROM inventory_batches
            WHERE item_id = ? AND batch_number = ? AND location_id = ?
            LIMIT 1
            FOR UPDATE
        ");
        $destinationStmt->execute([$itemId, $source['batch_number'], $destinationLocationId]);
        $destination = $destinationStmt->fetch(PDO::FETCH_ASSOC);
        $destinationBefore = (int)($destination['quantity'] ?? 0);

        $sourceAfter = $sourceBefore - $quantity;
        $sourceUpdate = $pdo->prepare('UPDATE inventory_batches SET quantity = ? WHERE batch_id = ?');
        $sourceUpdate->execute([$sourceAfter, $sourceBatchId]);

        if ($destination) {
            $destinationBatchId = (int)$destination['batch_id'];
            $destinationAfter = $destinationBefore + $quantity;
            $destinationUpdate = $pdo->prepare('UPDATE inventory_batches SET quantity = ? WHERE batch_id = ?');
            $destinationUpdate->execute([$destinationAfter, $destinationBatchId]);
        } else {
            $destinationAfter = $quantity;
            $destinationInsert = $pdo->prepare("
                INSERT INTO inventory_batches (
                    item_id, location_id, batch_number, quantity, manufacturing_date, expiry_date, unit_cost
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            ");
            $destinationInsert->execute([
                $itemId,
                $destinationLocationId,
                $source['batch_number'],
                $quantity,
                $source['manufacturing_date'],
                $source['expiry_date'],
                $source['unit_cost'],
            ]);
            $destinationBatchId = (int)$pdo->lastInsertId();
        }

        $transferNumber = 'TRF-' . date('Ymd') . '-' . strtoupper(bin2hex(random_bytes(3)));
        $transferStmt = $pdo->prepare("
            INSERT INTO inventory_transfers (
                transfer_number, from_location_id, to_location_id, status, notes,
                created_by_user_id, received_by_user_id, received_at
            ) VALUES (?, ?, ?, 'received', ?, ?, ?, NOW())
        ");
        $transferStmt->execute([
            $transferNumber,
            $sourceLocationId,
            $destinationLocationId,
            $confirmation['reason'],
            (int)$confirmation['user_id'],
            (int)$confirmation['user_id'],
        ]);
        $transferId = (int)$pdo->lastInsertId();
        $transferItemStmt = $pdo->prepare("
            INSERT INTO inventory_transfer_items (
                inventory_transfer_id, item_id, source_batch_id, quantity
            ) VALUES (?, ?, ?, ?)
        ");
        $transferItemStmt->execute([$transferId, $itemId, $sourceBatchId, $quantity]);

        $movementStmt = $pdo->prepare("
            INSERT INTO inventory_stock_movements (
                item_id, batch_id, location_id, movement_type, quantity_change,
                quantity_before, quantity_after, reference_type, reference_id,
                remarks, performed_by_user_id, performed_by_name
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'inventory_transfers', ?, ?, ?, ?)
        ");
        $movementStmt->execute([
            $itemId, $sourceBatchId, $sourceLocationId, 'transfer_out', -$quantity,
            $sourceBefore, $sourceAfter, $transferId, $confirmation['reason'],
            (int)$confirmation['user_id'], $confirmation['full_name'],
        ]);
        $movementStmt->execute([
            $itemId, $destinationBatchId, $destinationLocationId, 'transfer_in', $quantity,
            $destinationBefore, $destinationAfter, $transferId, $confirmation['reason'],
            (int)$confirmation['user_id'], $confirmation['full_name'],
        ]);

        inventoryWriteAudit(
            $pdo,
            $confirmation,
            $itemId,
            $sourceBatchId,
            $sourceLocationId,
            [
                'source_location_id' => $sourceLocationId,
                'source_batch_id' => $sourceBatchId,
                'source_quantity' => $sourceBefore,
                'destination_location_id' => $destinationLocationId,
                'destination_quantity' => $destinationBefore,
            ],
            [
                'transfer_id' => $transferId,
                'transfer_number' => $transferNumber,
                'quantity_transferred' => $quantity,
                'source_quantity' => $sourceAfter,
                'destination_batch_id' => $destinationBatchId,
                'destination_quantity' => $destinationAfter,
            ]
        );
        $pdo->commit();
        echo json_encode(['message' => 'Inventory stock transferred.', 'transfer_number' => $transferNumber]);
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        $status = $error instanceof InvalidArgumentException ? 409 : 500;
        http_response_code($status);
        echo json_encode(['message' => $error->getMessage()]);
    }
}

$action = $_GET['action'] ?? 'list';
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET' && $action === 'meta') {
    getInventoryMeta($pdo);
} elseif ($method === 'GET') {
    getInventoryItems($pdo);
} elseif ($method === 'POST' && $action === 'create-item') {
    createInventoryItem($pdo);
} elseif ($method === 'PATCH' && $action === 'update-item') {
    updateInventoryItem($pdo);
} elseif ($method === 'POST' && $action === 'stock-in') {
    createStockIn($pdo);
} elseif ($method === 'POST' && $action === 'stock-out') {
    createStockOut($pdo);
} elseif ($method === 'POST' && $action === 'transfer') {
    transferInventoryStock($pdo);
} elseif ($method === 'POST' && $action === 'archive-item') {
    archiveInventoryItem($pdo);
} else {
    http_response_code(405);
    echo json_encode(['message' => 'Method not allowed.']);
}
