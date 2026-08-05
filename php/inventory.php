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

function inventoryUser(PDO $pdo, $userId): array
{
    if (!$userId) {
        http_response_code(400);
        echo json_encode(['message' => 'Logged-in user is required.']);
        exit;
    }

    $stmt = $pdo->prepare("
        SELECT user_id, TRIM(CONCAT(COALESCE(first_Name, ''), ' ', last_Name)) AS full_name
        FROM users
        WHERE user_id = ?
        LIMIT 1
    ");
    $stmt->execute([$userId]);
    $user = $stmt->fetch();

    if (!$user) {
        http_response_code(404);
        echo json_encode(['message' => 'Logged-in user was not found.']);
        exit;
    }

    return $user;
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
    if (!$locationName) {
        throw new Exception('Inventory location is required.');
    }

    $lookup = $pdo->prepare("
        SELECT location_id
        FROM inventory_locations
        WHERE LOWER(location_name) = LOWER(?)
        LIMIT 1
    ");
    $lookup->execute([$locationName]);
    $existingId = $lookup->fetchColumn();
    if ($existingId) {
        inventoryAssertLocationAccess($pdo, (int)$existingId);
        return (int)$existingId;
    }

    try {
        $branchId = inventoryRequestedBranchId($pdo);
        $insert = $pdo->prepare("INSERT INTO inventory_locations (branch_id, location_name) VALUES (?, ?)");
        $insert->execute([$branchId, $locationName]);
        return (int)$pdo->lastInsertId();
    } catch (PDOException $e) {
        $lookup->execute([$locationName]);
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
        WHERE i.status = 'active'
        ORDER BY i.item_name ASC
    ");
    $stmt->execute([$branchId, $branchId, $branchId]);
    $items = $stmt->fetchAll();

    $batchStmt = $pdo->prepare("
        SELECT b.*, l.location_name, l.branch_id
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
            'location' => $batch['location_name'],
            'unitCost' => (float)$batch['unit_cost'],
            'createdAt' => $batch['created_at']
        ];
    }

    $result = array_map(function ($item) use ($batchesByItem, $branchId) {
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
            'location' => $item['branch_name'],
            'branchId' => $branchId,
            'branchName' => $item['branch_name'],
            'quantity' => $quantity,
            'unit' => $item['unit'],
            'costPrice' => (float)$item['unit_cost'],
            'expiryDate' => $nearestExpiry,
            'batches' => $batchesByItem[$itemId] ?? [],
            'status' => inventoryStatus($quantity, $reorderLevel, $nearestExpiry, $warningDays),
            'lastUpdated' => $item['updated_at'],
            'reorderLevel' => $reorderLevel,
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
        SELECT location_id AS id, location_name AS name, location_type AS type
        FROM inventory_locations
        WHERE status = 'active' AND branch_id = ?
        ORDER BY location_name
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
    $user = inventoryUser($pdo, $input['user_id'] ?? null);

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

        $stmt = $pdo->prepare("
            INSERT INTO inventory_items (
                item_name, generic_name, sku, barcode, description, category, brand, unit,
                location_id, reorder_level, unit_cost, expiry_warning_days, profile_image_path,
                created_by_user_id, created_by_name
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
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
            (int)($input['expiry_warning_days'] ?? 90),
            inventoryOptionalText($input['profile_image_path'] ?? null),
            (int)$user['user_id'],
            $user['full_name']
        ]);

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
    $user = inventoryUser($pdo, $input['user_id'] ?? null);
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
    $user = inventoryUser($pdo, $input['user_id'] ?? null);

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
            $input['remarks'] ?? 'Stock out recorded',
            (int)$user['user_id'],
            $user['full_name']
        ]);

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
    inventoryUser($pdo, $input['user_id'] ?? null);

    $itemId = (int)($input['item_id'] ?? 0);
    if ($itemId <= 0) {
        http_response_code(400);
        echo json_encode(['message' => 'item_id is required.']);
        return;
    }

    $fields = [];
    $values = [];

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

    $existsStmt = $pdo->prepare("SELECT item_id FROM inventory_items WHERE item_id = ? LIMIT 1");
    $existsStmt->execute([$itemId]);
    if (!$existsStmt->fetchColumn()) {
        http_response_code(404);
        echo json_encode(['message' => 'Inventory item was not found.']);
        return;
    }

    $values[] = $itemId;
    $stmt = $pdo->prepare("UPDATE inventory_items SET " . implode(', ', $fields) . " WHERE item_id = ?");
    $stmt->execute($values);

    echo json_encode(['message' => 'Inventory item updated.']);
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
} else {
    http_response_code(405);
    echo json_encode(['message' => 'Method not allowed.']);
}
