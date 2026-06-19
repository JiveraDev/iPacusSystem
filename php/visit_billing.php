<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/notification_helpers.php';

header('Content-Type: application/json');

function visit_billing_input(): array
{
    return json_decode(file_get_contents('php://input'), true) ?: [];
}

function visit_billing_table_exists(PDO $pdo, string $tableName): bool
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

function visit_billing_column_exists(PDO $pdo, string $tableName, string $columnName): bool
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

function visit_billing_column_type(PDO $pdo, string $tableName, string $columnName): string
{
    $stmt = $pdo->prepare("
        SELECT COLUMN_TYPE
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = ?
          AND column_name = ?
        LIMIT 1
    ");
    $stmt->execute([$tableName, $columnName]);

    return (string)($stmt->fetchColumn() ?: '');
}

function visit_billing_schema_ready(PDO $pdo): bool
{
    foreach (['visits', 'visit_charges', 'visit_payments', 'service_catalog'] as $tableName) {
        if (!visit_billing_table_exists($pdo, $tableName)) {
            return false;
        }
    }

    return true;
}

function visit_billing_missing_message(): string
{
    return 'Visit billing schema is missing. Run DDL/visit_service_payment_migration_20260604.sql first.';
}

function visit_billing_error(int $statusCode, string $message): void
{
    global $pdo;

    if (defined('VISIT_BILLING_THROW_ERRORS') && VISIT_BILLING_THROW_ERRORS) {
        http_response_code($statusCode);
        throw new RuntimeException($message);
    }

    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    http_response_code($statusCode);
    echo json_encode(['success' => false, 'message' => $message]);
    exit;
}

function visit_billing_require_schema(PDO $pdo): void
{
    if (!visit_billing_schema_ready($pdo)) {
        visit_billing_error(409, visit_billing_missing_message());
    }
}

function visit_billing_ensure_payment_method_schema(PDO $pdo): void
{
    $columnType = visit_billing_column_type($pdo, 'visit_payments', 'payment_method');
    if ($columnType === '' || stripos($columnType, "'cash'") !== false) {
        return;
    }

    if (stripos($columnType, 'enum(') !== 0) {
        return;
    }

    visit_billing_error(
        409,
        "Database change required before POS cash payments can be posted: ALTER TABLE visit_payments MODIFY payment_method ENUM('cash','qrph','gcash','maya','bank_transfer') NOT NULL DEFAULT 'gcash';"
    );
}

function visit_billing_nullable_int($value): ?int
{
    if ($value === null || $value === '') {
        return null;
    }

    return is_numeric($value) ? (int)$value : null;
}

function visit_billing_nullable_text($value): ?string
{
    $text = trim((string)($value ?? ''));
    return $text === '' ? null : $text;
}

function visit_billing_allowed(string $value, array $allowed, string $fallback): string
{
    return in_array($value, $allowed, true) ? $value : $fallback;
}

function visit_billing_decode_json($value)
{
    if ($value === null || $value === '') {
        return null;
    }

    $decoded = json_decode((string)$value, true);

    return json_last_error() === JSON_ERROR_NONE ? $decoded : null;
}

function visit_billing_ensure_walk_in_patient(PDO $pdo): array
{
    $ownerEmail = 'pos.walkin@counter.local';
    $petShareId = 'PET-WALK-IN-SALE';

    $stmt = $pdo->prepare("SELECT user_id FROM users WHERE mail_Address = ? LIMIT 1");
    $stmt->execute([$ownerEmail]);
    $ownerUserId = $stmt->fetchColumn();

    if (!$ownerUserId) {
        $stmt = $pdo->prepare("
            INSERT INTO users (first_Name, last_Name, mail_Address, personal_Address, role)
            VALUES (?, ?, ?, ?, ?)
        ");
        $stmt->execute(['Walk-in', 'Counter Sale', $ownerEmail, 'POS counter sale', 'guest']);
        $ownerUserId = (int)$pdo->lastInsertId();
    } else {
        $ownerUserId = (int)$ownerUserId;
    }

    $hasShareId = visit_billing_column_exists($pdo, 'pets_information', 'pet_sharable_ID');
    if ($hasShareId) {
        $stmt = $pdo->prepare("SELECT pet_id FROM pets_information WHERE pet_sharable_ID = ? LIMIT 1");
        $stmt->execute([$petShareId]);
    } else {
        $stmt = $pdo->prepare("
            SELECT pet_id
            FROM pets_information
            WHERE pet_name = ?
              AND pet_Temp_owner = ?
            LIMIT 1
        ");
        $stmt->execute(['Walk-in Customer', 'Counter Sale']);
    }
    $petId = $stmt->fetchColumn();

    if (!$petId) {
        $columns = [
            'pet_name',
            'pet_species',
            'pet_breed',
            'pet_BDAY',
            'pet_status',
            'pet_gender',
            'pet_weight',
            'pet_Temp_owner',
            'pet_allergies',
            'pet_color_marking',
            'pet_age',
        ];
        $values = [
            'Walk-in Customer',
            'Counter Sale',
            'POS Sale',
            '1970-01-01',
            'Healthy',
            'N/A',
            0,
            'Counter Sale',
            null,
            'POS walk-in sale placeholder',
            'N/A',
        ];

        if ($hasShareId) {
            $columns[] = 'pet_sharable_ID';
            $values[] = $petShareId;
        }

        $placeholders = implode(', ', array_fill(0, count($columns), '?'));
        $stmt = $pdo->prepare('INSERT INTO pets_information (' . implode(', ', $columns) . ") VALUES ({$placeholders})");
        $stmt->execute($values);
        $petId = (int)$pdo->lastInsertId();
    } else {
        $petId = (int)$petId;
    }

    $stmt = $pdo->prepare("SELECT link_id FROM pet_ownership WHERE pet_id = ? LIMIT 1");
    $stmt->execute([$petId]);
    if (!$stmt->fetchColumn()) {
        $stmt = $pdo->prepare("INSERT INTO pet_ownership (user_id, pet_id) VALUES (?, ?)");
        $stmt->execute([$ownerUserId, $petId]);
    }

    return [
        'pet_id' => $petId,
        'owner_user_id' => $ownerUserId,
    ];
}

function visit_billing_resolve_owner(PDO $pdo, ?int $ownerUserId, int $petId, ?int $queueId, ?int $bookingId): int
{
    if ($ownerUserId !== null && $ownerUserId > 0) {
        return $ownerUserId;
    }

    if ($queueId !== null && $queueId > 0) {
        $stmt = $pdo->prepare("SELECT user_id FROM queues WHERE queue_id = ? LIMIT 1");
        $stmt->execute([$queueId]);
        $owner = $stmt->fetchColumn();
        if ($owner) {
            return (int)$owner;
        }
    }

    if ($bookingId !== null && $bookingId > 0) {
        $stmt = $pdo->prepare("SELECT user_id FROM bookings WHERE booking_id = ? LIMIT 1");
        $stmt->execute([$bookingId]);
        $owner = $stmt->fetchColumn();
        if ($owner) {
            return (int)$owner;
        }
    }

    $stmt = $pdo->prepare("SELECT user_id FROM pet_ownership WHERE pet_id = ? ORDER BY link_id DESC LIMIT 1");
    $stmt->execute([$petId]);
    $owner = $stmt->fetchColumn();
    if ($owner) {
        return (int)$owner;
    }

    visit_billing_error(400, 'owner_user_id could not be resolved for this visit.');
}

function visit_billing_fetch_visit_id(PDO $pdo, array $input): ?int
{
    $visitId = visit_billing_nullable_int($input['visit_id'] ?? $input['visitId'] ?? null);
    if ($visitId !== null && $visitId > 0) {
        return $visitId;
    }

    $petId = visit_billing_nullable_int($input['pet_id'] ?? $input['petId'] ?? null);
    $queueId = visit_billing_nullable_int($input['queue_id'] ?? $input['queueId'] ?? null);
    $bookingId = visit_billing_nullable_int($input['booking_id'] ?? $input['bookingId'] ?? null);

    if ($petId !== null && $queueId !== null) {
        $stmt = $pdo->prepare("SELECT visit_id FROM visits WHERE pet_id = ? AND queue_id = ? LIMIT 1");
        $stmt->execute([$petId, $queueId]);
        $existing = $stmt->fetchColumn();
        if ($existing) {
            return (int)$existing;
        }
    }

    if ($petId !== null && $bookingId !== null) {
        $stmt = $pdo->prepare("SELECT visit_id FROM visits WHERE pet_id = ? AND booking_id = ? LIMIT 1");
        $stmt->execute([$petId, $bookingId]);
        $existing = $stmt->fetchColumn();
        if ($existing) {
            return (int)$existing;
        }
    }

    return null;
}

function visit_billing_update_status(PDO $pdo, int $visitId): void
{
    $chargeStmt = $pdo->prepare("SELECT COALESCE(SUM(subtotal), 0) FROM visit_charges WHERE visit_id = ?");
    $chargeStmt->execute([$visitId]);
    $total = (float)$chargeStmt->fetchColumn();

    $paymentStmt = $pdo->prepare("
        SELECT COALESCE(SUM(amount), 0)
        FROM visit_payments
        WHERE visit_id = ?
          AND payment_status = 'verified'
    ");
    $paymentStmt->execute([$visitId]);
    $paid = (float)$paymentStmt->fetchColumn();

    if ($total <= 0) {
        $status = 'unbilled';
    } elseif ($paid <= 0) {
        $status = 'unpaid';
    } elseif ($paid + 0.0001 < $total) {
        $status = 'partial';
    } else {
        $status = 'paid';
    }

    $stmt = $pdo->prepare("UPDATE visits SET billing_status = ? WHERE visit_id = ?");
    $stmt->execute([$status, $visitId]);
}

function visit_billing_is_whole_quantity(float $quantity): bool
{
    return abs($quantity - round($quantity)) <= 0.0001;
}

function visit_billing_fetch_user(PDO $pdo, ?int $userId): ?array
{
    if ($userId === null || $userId <= 0) {
        return null;
    }

    $stmt = $pdo->prepare("
        SELECT
            user_id,
            TRIM(CONCAT(COALESCE(first_Name, ''), ' ', COALESCE(last_Name, ''))) AS full_name,
            mail_Address
        FROM users
        WHERE user_id = ?
        LIMIT 1
    ");
    $stmt->execute([$userId]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        return null;
    }

    return [
        'user_id' => (int)$user['user_id'],
        'full_name' => trim((string)($user['full_name'] ?? '')) ?: (string)($user['mail_Address'] ?? 'Clinic Staff'),
    ];
}

function visit_billing_resolve_stock_performer(PDO $pdo, int $visitId, ?int $preferredUserId = null): array
{
    $preferredUser = visit_billing_fetch_user($pdo, $preferredUserId);
    if ($preferredUser) {
        return $preferredUser;
    }

    $stmt = $pdo->prepare("
        SELECT COALESCE(v.veterinarian_user_id, v.owner_user_id) AS user_id
        FROM visits v
        WHERE v.visit_id = ?
        LIMIT 1
    ");
    $stmt->execute([$visitId]);
    $visitUserId = $stmt->fetchColumn();
    $visitUser = visit_billing_fetch_user($pdo, $visitUserId ? (int)$visitUserId : null);
    if ($visitUser) {
        return $visitUser;
    }

    $fallbackStmt = $pdo->query("
        SELECT
            user_id,
            TRIM(CONCAT(COALESCE(first_Name, ''), ' ', COALESCE(last_Name, ''))) AS full_name,
            mail_Address
        FROM users
        ORDER BY user_id ASC
        LIMIT 1
    ");
    $fallback = $fallbackStmt->fetch(PDO::FETCH_ASSOC);
    if ($fallback) {
        return [
            'user_id' => (int)$fallback['user_id'],
            'full_name' => trim((string)($fallback['full_name'] ?? '')) ?: (string)($fallback['mail_Address'] ?? 'Clinic Staff'),
        ];
    }

    visit_billing_error(409, 'A valid user is required to record inventory movement.');
}

function visit_billing_fetch_inventory_item(PDO $pdo, int $itemId, string $chargeType): array
{
    if (!visit_billing_table_exists($pdo, 'inventory_items')) {
        visit_billing_error(409, 'Inventory schema is missing.');
    }

    $stmt = $pdo->prepare("
        SELECT item_id, item_name, category, status
        FROM inventory_items
        WHERE item_id = ?
        LIMIT 1
    ");
    $stmt->execute([$itemId]);
    $item = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$item) {
        visit_billing_error(404, 'Inventory item was not found for a visit charge.');
    }

    if (($item['status'] ?? '') !== 'active') {
        visit_billing_error(409, 'Inactive inventory items cannot be billed or consumed.');
    }

    $category = strtoupper(trim((string)($item['category'] ?? '')));
    if ($chargeType === 'medication' && $category !== 'MEDICATION') {
        visit_billing_error(400, 'Medication charges must use an inventory item categorized as MEDICATION.');
    }

    if ($chargeType === 'retail_product' && in_array($category, ['MEDICATION', 'CONSUMABLE'], true)) {
        visit_billing_error(400, 'Product charges cannot use medication or internal consumable inventory items.');
    }

    return $item;
}

function visit_billing_consume_inventory_item(
    PDO $pdo,
    int $itemId,
    float $quantity,
    int $chargeId,
    string $description,
    string $chargeType,
    array $performer
): void {
    if ($quantity <= 0) {
        return;
    }

    if (!visit_billing_table_exists($pdo, 'inventory_batches') || !visit_billing_table_exists($pdo, 'inventory_stock_movements')) {
        visit_billing_error(409, 'Inventory batch and movement schema is required before inventory-linked charges can be saved.');
    }

    $item = visit_billing_fetch_inventory_item($pdo, $itemId, $chargeType);
    if (!visit_billing_is_whole_quantity($quantity)) {
        visit_billing_error(400, "Inventory quantity for {$item['item_name']} must be a whole number.");
    }

    $needed = (int)round($quantity);
    if ($needed <= 0) {
        return;
    }

    $batchStmt = $pdo->prepare("
        SELECT batch_id, quantity
        FROM inventory_batches
        WHERE item_id = ?
          AND quantity > 0
        ORDER BY expiry_date IS NULL ASC, expiry_date ASC, created_at ASC, batch_id ASC
        FOR UPDATE
    ");
    $batchStmt->execute([$itemId]);
    $batches = $batchStmt->fetchAll(PDO::FETCH_ASSOC);
    $available = array_reduce($batches, fn($sum, $batch) => $sum + (int)$batch['quantity'], 0);

    if ($available < $needed) {
        visit_billing_error(409, "{$item['item_name']} has insufficient stock. Needs {$needed}, available {$available}.");
    }

    $remaining = $needed;
    $updateBatch = $pdo->prepare("UPDATE inventory_batches SET quantity = ? WHERE batch_id = ?");
    $movementStmt = $pdo->prepare("
        INSERT INTO inventory_stock_movements (
            item_id,
            batch_id,
            movement_type,
            quantity_change,
            quantity_before,
            quantity_after,
            reference_type,
            reference_id,
            remarks,
            performed_by_user_id,
            performed_by_name
        ) VALUES (?, ?, 'stock_out', ?, ?, ?, 'visit_charges', ?, ?, ?, ?)
    ");

    foreach ($batches as $batch) {
        if ($remaining <= 0) {
            break;
        }

        $before = (int)$batch['quantity'];
        $deduct = min($before, $remaining);
        $after = $before - $deduct;

        $updateBatch->execute([$after, (int)$batch['batch_id']]);
        $movementStmt->execute([
            $itemId,
            (int)$batch['batch_id'],
            -$deduct,
            $before,
            $after,
            $chargeId,
            'Visit charge stock use: ' . substr($description, 0, 180),
            (int)$performer['user_id'],
            $performer['full_name'],
        ]);

        $remaining -= $deduct;
    }
}

function visit_billing_reverse_visit_charge_stock(PDO $pdo, int $visitId, array $performer): void
{
    if (
        !visit_billing_table_exists($pdo, 'inventory_stock_movements')
        || !visit_billing_table_exists($pdo, 'inventory_batches')
    ) {
        return;
    }

    $movementStmt = $pdo->prepare("
        SELECT ism.*
        FROM inventory_stock_movements ism
        JOIN visit_charges vc ON vc.charge_id = ism.reference_id
        WHERE vc.visit_id = ?
          AND ism.reference_type = 'visit_charges'
          AND ism.quantity_change < 0
        ORDER BY ism.movement_id DESC
        FOR UPDATE
    ");
    $movementStmt->execute([$visitId]);
    $movements = $movementStmt->fetchAll(PDO::FETCH_ASSOC);

    if (!$movements) {
        return;
    }

    $batchStmt = $pdo->prepare("
        SELECT quantity
        FROM inventory_batches
        WHERE batch_id = ?
          AND item_id = ?
        LIMIT 1
        FOR UPDATE
    ");
    $updateBatch = $pdo->prepare("UPDATE inventory_batches SET quantity = ? WHERE batch_id = ?");
    $reversalStmt = $pdo->prepare("
        INSERT INTO inventory_stock_movements (
            item_id,
            batch_id,
            movement_type,
            quantity_change,
            quantity_before,
            quantity_after,
            reference_type,
            reference_id,
            remarks,
            performed_by_user_id,
            performed_by_name
        ) VALUES (?, ?, 'adjustment', ?, ?, ?, 'visit_charge_reversal', ?, ?, ?, ?)
    ");

    foreach ($movements as $movement) {
        $batchId = (int)($movement['batch_id'] ?? 0);
        $itemId = (int)$movement['item_id'];
        $restore = abs((int)$movement['quantity_change']);
        if ($batchId <= 0 || $restore <= 0) {
            continue;
        }

        $batchStmt->execute([$batchId, $itemId]);
        $before = $batchStmt->fetchColumn();
        if ($before === false) {
            visit_billing_error(409, 'Cannot reverse inventory movement because the original batch no longer exists.');
        }

        $before = (int)$before;
        $after = $before + $restore;
        $updateBatch->execute([$after, $batchId]);
        $reversalStmt->execute([
            $itemId,
            $batchId,
            $restore,
            $before,
            $after,
            (int)$movement['reference_id'],
            'Reversed visit charge stock use before invoice update.',
            (int)$performer['user_id'],
            $performer['full_name'],
        ]);
    }
}

function visit_billing_fetch_service_materials(PDO $pdo, int $serviceId): array
{
    if (!visit_billing_table_exists($pdo, 'service_materials')) {
        return [];
    }

    $stmt = $pdo->prepare("
        SELECT
            sm.item_id,
            sm.material_name,
            sm.qty_used,
            sm.billable_policy,
            ii.item_name
        FROM service_materials sm
        LEFT JOIN inventory_items ii ON ii.item_id = sm.item_id
        WHERE sm.service_id = ?
          AND sm.item_id IS NOT NULL
        ORDER BY sm.service_material_id ASC
    ");
    $stmt->execute([$serviceId]);

    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

function visit_billing_save_charges(PDO $pdo, int $visitId, array $charges, bool $replace = true): void
{
    $preferredUserId = null;
    foreach ($charges as $charge) {
        $candidate = visit_billing_nullable_int($charge['created_by_user_id'] ?? $charge['createdByUserId'] ?? null);
        if ($candidate !== null && $candidate > 0) {
            $preferredUserId = $candidate;
            break;
        }
    }
    $stockPerformer = visit_billing_resolve_stock_performer($pdo, $visitId, $preferredUserId);

    if ($replace) {
        visit_billing_reverse_visit_charge_stock($pdo, $visitId, $stockPerformer);

        $deleteStmt = $pdo->prepare("DELETE FROM visit_charges WHERE visit_id = ?");
        $deleteStmt->execute([$visitId]);
    }

    $allowedTypes = ['service', 'diagnostic', 'medication', 'consumable', 'retail_product', 'boarding', 'other'];
    $explicitServiceMaterials = [];
    foreach ($charges as $charge) {
        $serviceId = visit_billing_nullable_int($charge['service_id'] ?? $charge['serviceId'] ?? null);
        $itemId = visit_billing_nullable_int($charge['item_id'] ?? $charge['itemId'] ?? null);
        if ($serviceId !== null && $serviceId > 0 && $itemId !== null && $itemId > 0) {
            $explicitServiceMaterials[$serviceId][$itemId] = true;
        }
    }

    $insertStmt = $pdo->prepare("
        INSERT INTO visit_charges (
            visit_id,
            charge_type,
            service_id,
            item_id,
            description,
            quantity,
            unit_price,
            subtotal,
            created_by_user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");

    foreach ($charges as $charge) {
        $description = visit_billing_nullable_text($charge['description'] ?? null);
        $quantity = (float)($charge['quantity'] ?? 1);
        $unitPrice = (float)($charge['unit_price'] ?? $charge['unitPrice'] ?? 0);

        if ($description === null) {
            continue;
        }

        if ($quantity <= 0) {
            visit_billing_error(400, 'Charge quantity must be greater than 0.');
        }

        if ($unitPrice < 0) {
            visit_billing_error(400, 'Charge price cannot be negative.');
        }

        $chargeType = visit_billing_allowed(
            trim((string)($charge['charge_type'] ?? $charge['chargeType'] ?? 'service')),
            $allowedTypes,
            'service'
        );
        $serviceId = visit_billing_nullable_int($charge['service_id'] ?? $charge['serviceId'] ?? null);
        $itemId = visit_billing_nullable_int($charge['item_id'] ?? $charge['itemId'] ?? null);
        $createdBy = visit_billing_nullable_int($charge['created_by_user_id'] ?? $charge['createdByUserId'] ?? null);
        $subtotal = round($quantity * $unitPrice, 2);

        if ($itemId !== null && $itemId > 0) {
            visit_billing_fetch_inventory_item($pdo, $itemId, $chargeType);
        }

        $insertStmt->execute([
            $visitId,
            $chargeType,
            $serviceId,
            $itemId,
            $description,
            $quantity,
            $unitPrice,
            $subtotal,
            $createdBy
        ]);
        $chargeId = (int)$pdo->lastInsertId();

        $linePerformer = $createdBy
            ? visit_billing_resolve_stock_performer($pdo, $visitId, $createdBy)
            : $stockPerformer;

        if ($itemId !== null && $itemId > 0) {
            visit_billing_consume_inventory_item(
                $pdo,
                $itemId,
                $quantity,
                $chargeId,
                $description,
                $chargeType,
                $linePerformer
            );
        }

        if ($serviceId !== null && $serviceId > 0 && $itemId === null && in_array($chargeType, ['service', 'diagnostic', 'boarding'], true)) {
            foreach (visit_billing_fetch_service_materials($pdo, $serviceId) as $material) {
                $materialItemId = (int)($material['item_id'] ?? 0);
                if ($materialItemId <= 0 || isset($explicitServiceMaterials[$serviceId][$materialItemId])) {
                    continue;
                }

                $materialQuantity = $quantity * (float)($material['qty_used'] ?? 0);
                $materialName = (string)($material['item_name'] ?? $material['material_name'] ?? $description);
                visit_billing_consume_inventory_item(
                    $pdo,
                    $materialItemId,
                    $materialQuantity,
                    $chargeId,
                    $description . ' - ' . $materialName,
                    'consumable',
                    $linePerformer
                );
            }
        }
    }

    visit_billing_update_status($pdo, $visitId);
}

function visit_billing_save_visit_payload(PDO $pdo, array $input): array
{
    visit_billing_require_schema($pdo);

    $petId = visit_billing_nullable_int($input['pet_id'] ?? $input['petId'] ?? null);
    $queueId = visit_billing_nullable_int($input['queue_id'] ?? $input['queueId'] ?? null);
    $bookingId = visit_billing_nullable_int($input['booking_id'] ?? $input['bookingId'] ?? null);
    $sourceType = visit_billing_allowed(
        trim((string)($input['source_type'] ?? $input['sourceType'] ?? ($queueId ? 'queue' : ($bookingId ? 'booking' : 'manual')))),
        ['queue', 'booking', 'walk_in', 'boarding', 'manual'],
        'manual'
    );

    if ($petId === null || $petId <= 0) {
        visit_billing_error(400, 'pet_id is required.');
    }

    $ownerUserId = visit_billing_resolve_owner(
        $pdo,
        visit_billing_nullable_int($input['owner_user_id'] ?? $input['ownerUserId'] ?? null),
        $petId,
        $queueId,
        $bookingId
    );
    $veterinarianUserId = visit_billing_nullable_int($input['veterinarian_user_id'] ?? $input['veterinarianUserId'] ?? null);
    $diagnosisId = visit_billing_nullable_int($input['diagnosis_id'] ?? $input['diagnosisId'] ?? null);
    $visitStatus = visit_billing_allowed(
        trim((string)($input['visit_status'] ?? $input['visitStatus'] ?? 'treatment_done')),
        ['waiting', 'in_consultation', 'treatment_done', 'completed', 'cancelled'],
        'treatment_done'
    );

    $charges = $input['charges'] ?? [];
    if (!is_array($charges)) {
        visit_billing_error(400, 'charges must be an array.');
    }

    $visitLookupInput = array_merge($input, [
        'pet_id' => $petId,
        'queue_id' => $queueId,
        'booking_id' => $bookingId,
    ]);
    $visitId = visit_billing_fetch_visit_id($pdo, $visitLookupInput);

    if ($visitId !== null) {
        $stmt = $pdo->prepare("
            UPDATE visits
            SET owner_user_id = ?,
                veterinarian_user_id = ?,
                queue_id = ?,
                booking_id = ?,
                diagnosis_id = COALESCE(?, diagnosis_id),
                source_type = ?,
                visit_status = ?
            WHERE visit_id = ?
        ");
        $stmt->execute([
            $ownerUserId,
            $veterinarianUserId,
            $queueId,
            $bookingId,
            $diagnosisId,
            $sourceType,
            $visitStatus,
            $visitId
        ]);
    } else {
        $stmt = $pdo->prepare("
            INSERT INTO visits (
                pet_id,
                owner_user_id,
                veterinarian_user_id,
                queue_id,
                booking_id,
                diagnosis_id,
                source_type,
                visit_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $petId,
            $ownerUserId,
            $veterinarianUserId,
            $queueId,
            $bookingId,
            $diagnosisId,
            $sourceType,
            $visitStatus
        ]);
        $visitId = (int)$pdo->lastInsertId();
    }

    if (!empty($charges)) {
        visit_billing_save_charges($pdo, $visitId, $charges, true);
    } else {
        visit_billing_update_status($pdo, $visitId);
    }

    return [
        'visitId' => $visitId,
        'hasCharges' => !empty($charges),
        'visit' => visit_billing_fetch_visit($pdo, $visitId),
    ];
}

function visit_billing_upsert_visit(PDO $pdo): void
{
    visit_billing_require_schema($pdo);

    $input = visit_billing_input();
    $petId = visit_billing_nullable_int($input['pet_id'] ?? $input['petId'] ?? null);
    $queueId = visit_billing_nullable_int($input['queue_id'] ?? $input['queueId'] ?? null);
    $bookingId = visit_billing_nullable_int($input['booking_id'] ?? $input['bookingId'] ?? null);
    $sourceType = visit_billing_allowed(
        trim((string)($input['source_type'] ?? $input['sourceType'] ?? ($queueId ? 'queue' : ($bookingId ? 'booking' : 'manual')))),
        ['queue', 'booking', 'walk_in', 'boarding', 'manual'],
        'manual'
    );
    $walkInPatient = null;

    if (($petId === null || $petId <= 0) && $sourceType === 'walk_in') {
        $walkInPatient = visit_billing_ensure_walk_in_patient($pdo);
        $petId = $walkInPatient['pet_id'];
    }

    if ($petId === null || $petId <= 0) {
        visit_billing_error(400, 'pet_id is required.');
    }

    $ownerInput = visit_billing_nullable_int($input['owner_user_id'] ?? $input['ownerUserId'] ?? null);
    if (($ownerInput === null || $ownerInput <= 0) && $walkInPatient !== null) {
        $ownerInput = $walkInPatient['owner_user_id'];
    }

    $ownerUserId = visit_billing_resolve_owner(
        $pdo,
        $ownerInput,
        $petId,
        $queueId,
        $bookingId
    );
    $veterinarianUserId = visit_billing_nullable_int($input['veterinarian_user_id'] ?? $input['veterinarianUserId'] ?? null);
    $diagnosisId = visit_billing_nullable_int($input['diagnosis_id'] ?? $input['diagnosisId'] ?? null);
    $visitStatus = visit_billing_allowed(
        trim((string)($input['visit_status'] ?? $input['visitStatus'] ?? 'treatment_done')),
        ['waiting', 'in_consultation', 'treatment_done', 'completed', 'cancelled'],
        'treatment_done'
    );

    $charges = $input['charges'] ?? [];
    if (!is_array($charges)) {
        visit_billing_error(400, 'charges must be an array.');
    }

    $pdo->beginTransaction();
    try {
        $visitLookupInput = array_merge($input, [
            'pet_id' => $petId,
            'queue_id' => $queueId,
            'booking_id' => $bookingId,
        ]);
        $visitId = visit_billing_fetch_visit_id($pdo, $visitLookupInput);

        if ($visitId !== null) {
            $stmt = $pdo->prepare("
                UPDATE visits
                SET owner_user_id = ?,
                    veterinarian_user_id = ?,
                    queue_id = ?,
                    booking_id = ?,
                    diagnosis_id = COALESCE(?, diagnosis_id),
                    source_type = ?,
                    visit_status = ?
                WHERE visit_id = ?
            ");
            $stmt->execute([
                $ownerUserId,
                $veterinarianUserId,
                $queueId,
                $bookingId,
                $diagnosisId,
                $sourceType,
                $visitStatus,
                $visitId
            ]);
        } else {
            $stmt = $pdo->prepare("
                INSERT INTO visits (
                    pet_id,
                    owner_user_id,
                    veterinarian_user_id,
                    queue_id,
                    booking_id,
                    diagnosis_id,
                    source_type,
                    visit_status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $petId,
                $ownerUserId,
                $veterinarianUserId,
                $queueId,
                $bookingId,
                $diagnosisId,
                $sourceType,
                $visitStatus
            ]);
            $visitId = (int)$pdo->lastInsertId();
        }

        if (!empty($charges)) {
            visit_billing_save_charges($pdo, $visitId, $charges, true);
        } else {
            visit_billing_update_status($pdo, $visitId);
        }

        $paymentInput = $input['payment'] ?? $input['paymentPayload'] ?? null;
        $paymentId = null;
        if (is_array($paymentInput)) {
            $paymentId = visit_billing_insert_payment_payload($pdo, $visitId, $paymentInput);
        }

        $pdo->commit();

        try {
            if (!empty($charges)) {
                notification_send_visit_event($pdo, $visitId, 'invoice_ready');
            }
        } catch (Throwable $notificationError) {
            error_log('Visit invoice notification failed: ' . $notificationError->getMessage());
        }

        try {
            if ($paymentId !== null) {
                notification_send_visit_event($pdo, $visitId, 'payment_received', [
                    'payment_id' => $paymentId,
                    'amount' => (float)($paymentInput['amount'] ?? 0),
                    'reference_number' => visit_billing_nullable_text($paymentInput['reference_number'] ?? $paymentInput['referenceNumber'] ?? null),
                ]);
            }
        } catch (Throwable $notificationError) {
            error_log('Visit payment notification failed: ' . $notificationError->getMessage());
        }

        echo json_encode([
            'success' => true,
            'message' => 'Visit billing saved.',
            'visit' => visit_billing_fetch_visit($pdo, $visitId)
        ]);
    } catch (Exception $e) {
        visit_billing_error(500, 'Failed to save visit billing: ' . $e->getMessage());
    }
}

function visit_billing_fetch_visit(PDO $pdo, int $visitId): ?array
{
    $hasDiagnosisTable = visit_billing_table_exists($pdo, 'vet_diagnoses');
    $diagnosisSelect = $hasDiagnosisTable
        ? ",
            vd.prescriptions AS diagnosis_prescriptions,
            vd.notes AS diagnosis_notes,
            vd.diagnosis AS diagnosis_summary"
        : ",
            NULL AS diagnosis_prescriptions,
            NULL AS diagnosis_notes,
            NULL AS diagnosis_summary";
    $diagnosisJoin = $hasDiagnosisTable
        ? "LEFT JOIN vet_diagnoses vd ON vd.diagnosis_id = v.diagnosis_id"
        : "";

    $stmt = $pdo->prepare("
        SELECT
            v.*,
            p.pet_name,
            p.pet_species,
            CONCAT(owner.first_Name, ' ', owner.last_Name) AS owner_name,
            CONCAT(vet.first_Name, ' ', vet.last_Name) AS veterinarian_name,
            q.queue_number,
            b.booking_number
            {$diagnosisSelect}
        FROM visits v
        JOIN pets_information p ON p.pet_id = v.pet_id
        JOIN users owner ON owner.user_id = v.owner_user_id
        LEFT JOIN users vet ON vet.user_id = v.veterinarian_user_id
        LEFT JOIN queues q ON q.queue_id = v.queue_id
        LEFT JOIN bookings b ON b.booking_id = v.booking_id
        {$diagnosisJoin}
        WHERE v.visit_id = ?
        LIMIT 1
    ");
    $stmt->execute([$visitId]);
    $visit = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$visit) {
        return null;
    }

    $chargesStmt = $pdo->prepare("
        SELECT
            vc.*,
            sc.service_name,
            ii.item_name
        FROM visit_charges vc
        LEFT JOIN service_catalog sc ON sc.service_id = vc.service_id
        LEFT JOIN inventory_items ii ON ii.item_id = vc.item_id
        WHERE vc.visit_id = ?
        ORDER BY vc.charge_id ASC
    ");
    $chargesStmt->execute([$visitId]);
    $charges = array_map(function ($charge) {
        return [
            'chargeId' => (int)$charge['charge_id'],
            'visitId' => (int)$charge['visit_id'],
            'chargeType' => $charge['charge_type'],
            'serviceId' => $charge['service_id'] !== null ? (int)$charge['service_id'] : null,
            'serviceName' => $charge['service_name'] ?? '',
            'itemId' => $charge['item_id'] !== null ? (int)$charge['item_id'] : null,
            'itemName' => $charge['item_name'] ?? '',
            'description' => $charge['description'],
            'quantity' => (float)$charge['quantity'],
            'unitPrice' => (float)$charge['unit_price'],
            'subtotal' => (float)$charge['subtotal'],
            'createdAt' => $charge['created_at'],
        ];
    }, $chargesStmt->fetchAll(PDO::FETCH_ASSOC));

    $paymentsStmt = $pdo->prepare("
        SELECT *
        FROM visit_payments
        WHERE visit_id = ?
        ORDER BY paid_at DESC, payment_id DESC
    ");
    $paymentsStmt->execute([$visitId]);
    $payments = array_map(function ($payment) {
        return [
            'paymentId' => (int)$payment['payment_id'],
            'visitId' => (int)$payment['visit_id'],
            'paymentMethod' => $payment['payment_method'],
            'paymentStatus' => $payment['payment_status'],
            'amount' => (float)$payment['amount'],
            'referenceNumber' => $payment['reference_number'],
            'proofUrl' => $payment['proof_url'],
            'notes' => $payment['notes'],
            'paidAt' => $payment['paid_at'],
            'receivedByUserId' => $payment['received_by_user_id'] !== null ? (int)$payment['received_by_user_id'] : null,
            'receivedByName' => $payment['received_by_name'],
        ];
    }, $paymentsStmt->fetchAll(PDO::FETCH_ASSOC));

    $total = array_reduce($charges, fn($sum, $charge) => $sum + (float)$charge['subtotal'], 0.0);
    $paid = array_reduce($payments, function ($sum, $payment) {
        return $payment['paymentStatus'] === 'verified' ? $sum + (float)$payment['amount'] : $sum;
    }, 0.0);

    return [
        'visitId' => (int)$visit['visit_id'],
        'petId' => (int)$visit['pet_id'],
        'petName' => $visit['pet_name'],
        'petSpecies' => $visit['pet_species'],
        'ownerUserId' => (int)$visit['owner_user_id'],
        'ownerName' => trim((string)$visit['owner_name']),
        'veterinarianUserId' => $visit['veterinarian_user_id'] !== null ? (int)$visit['veterinarian_user_id'] : null,
        'veterinarianName' => trim((string)($visit['veterinarian_name'] ?? '')),
        'queueId' => $visit['queue_id'] !== null ? (int)$visit['queue_id'] : null,
        'queueNumber' => $visit['queue_number'] !== null ? (int)$visit['queue_number'] : null,
        'bookingId' => $visit['booking_id'] !== null ? (int)$visit['booking_id'] : null,
        'bookingNumber' => $visit['booking_number'],
        'diagnosisId' => $visit['diagnosis_id'] !== null ? (int)$visit['diagnosis_id'] : null,
        'diagnosisSummary' => $visit['diagnosis_summary'] ?? '',
        'diagnosisNotes' => $visit['diagnosis_notes'] ?? '',
        'prescriptions' => visit_billing_decode_json($visit['diagnosis_prescriptions'] ?? null) ?: [],
        'sourceType' => $visit['source_type'],
        'visitStatus' => $visit['visit_status'],
        'billingStatus' => $visit['billing_status'],
        'createdAt' => $visit['created_at'],
        'updatedAt' => $visit['updated_at'],
        'charges' => $charges,
        'payments' => $payments,
        'totals' => [
            'charges' => round($total, 2),
            'paid' => round($paid, 2),
            'balance' => round(max(0, $total - $paid), 2),
        ],
    ];
}

function visit_billing_list(PDO $pdo): void
{
    if (!visit_billing_schema_ready($pdo)) {
        echo json_encode([
            'success' => true,
            'schemaReady' => false,
            'message' => visit_billing_missing_message(),
            'visits' => []
        ]);
        return;
    }

    $visitId = visit_billing_nullable_int($_GET['visitId'] ?? $_GET['visit_id'] ?? null);
    if ($visitId !== null) {
        echo json_encode([
            'success' => true,
            'schemaReady' => true,
            'visits' => array_filter([visit_billing_fetch_visit($pdo, $visitId)])
        ]);
        return;
    }

    $conditions = [];
    $params = [];
    foreach ([
        ['petId', 'pet_id', 'v.pet_id'],
        ['queueId', 'queue_id', 'v.queue_id'],
        ['bookingId', 'booking_id', 'v.booking_id'],
        ['diagnosisId', 'diagnosis_id', 'v.diagnosis_id'],
    ] as [$camel, $snake, $column]) {
        $value = visit_billing_nullable_int($_GET[$camel] ?? $_GET[$snake] ?? null);
        if ($value !== null) {
            $conditions[] = "{$column} = ?";
            $params[] = $value;
        }
    }

    $whereSql = $conditions ? 'WHERE ' . implode(' AND ', $conditions) : '';
    $stmt = $pdo->prepare("
        SELECT v.visit_id
        FROM visits v
        {$whereSql}
        ORDER BY v.created_at DESC, v.visit_id DESC
        LIMIT 100
    ");
    $stmt->execute($params);
    $visits = [];
    foreach ($stmt->fetchAll(PDO::FETCH_COLUMN) as $id) {
        $visit = visit_billing_fetch_visit($pdo, (int)$id);
        if ($visit) {
            $visits[] = $visit;
        }
    }

    echo json_encode([
        'success' => true,
        'schemaReady' => true,
        'visits' => $visits
    ]);
}

function visit_billing_replace_charges(PDO $pdo, int $visitId): void
{
    visit_billing_require_schema($pdo);
    if ($visitId <= 0) {
        visit_billing_error(400, 'Visit ID is required.');
    }

    $input = visit_billing_input();
    $charges = $input['charges'] ?? [];
    if (!is_array($charges)) {
        visit_billing_error(400, 'charges must be an array.');
    }

    $pdo->beginTransaction();
    try {
        visit_billing_save_charges($pdo, $visitId, $charges, true);
        $pdo->commit();

        echo json_encode([
            'success' => true,
            'message' => 'Visit charges saved.',
            'visit' => visit_billing_fetch_visit($pdo, $visitId)
        ]);
    } catch (Exception $e) {
        visit_billing_error(500, 'Failed to save visit charges: ' . $e->getMessage());
    }
}

function visit_billing_insert_payment_payload(PDO $pdo, int $visitId, array $input): int
{
    $amount = (float)($input['amount'] ?? 0);
    if ($amount <= 0) {
        visit_billing_error(400, 'Payment amount must be greater than 0.');
    }

    $paymentMethod = visit_billing_allowed(
        trim((string)($input['payment_method'] ?? $input['paymentMethod'] ?? 'gcash')),
        ['cash', 'qrph', 'gcash', 'maya', 'bank_transfer'],
        'gcash'
    );
    if ($paymentMethod === 'cash') {
        visit_billing_ensure_payment_method_schema($pdo);
    }
    $paymentStatus = visit_billing_allowed(
        trim((string)($input['payment_status'] ?? $input['paymentStatus'] ?? 'verified')),
        ['pending', 'verified', 'failed', 'refunded', 'voided'],
        'verified'
    );

    $stmt = $pdo->prepare("
        INSERT INTO visit_payments (
            visit_id,
            payment_method,
            payment_status,
            amount,
            reference_number,
            proof_url,
            notes,
            paid_at,
            received_by_user_id,
            received_by_name
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");
    $stmt->execute([
        $visitId,
        $paymentMethod,
        $paymentStatus,
        $amount,
        visit_billing_nullable_text($input['reference_number'] ?? $input['referenceNumber'] ?? null),
        visit_billing_nullable_text($input['proof_url'] ?? $input['proofUrl'] ?? null),
        visit_billing_nullable_text($input['notes'] ?? null),
        visit_billing_nullable_text($input['paid_at'] ?? $input['paidAt'] ?? null) ?: date('Y-m-d H:i:s'),
        visit_billing_nullable_int($input['received_by_user_id'] ?? $input['receivedByUserId'] ?? null),
        visit_billing_nullable_text($input['received_by_name'] ?? $input['receivedByName'] ?? null)
    ]);
    $paymentId = (int)$pdo->lastInsertId();

    visit_billing_update_status($pdo, $visitId);

    return $paymentId;
}

function visit_billing_add_payment(PDO $pdo, int $visitId): void
{
    visit_billing_require_schema($pdo);
    if ($visitId <= 0) {
        visit_billing_error(400, 'Visit ID is required.');
    }

    $input = visit_billing_input();

    $pdo->beginTransaction();
    try {
        if (array_key_exists('charges', $input)) {
            $charges = $input['charges'];
            if (!is_array($charges)) {
                visit_billing_error(400, 'charges must be an array.');
            }
            visit_billing_save_charges($pdo, $visitId, $charges, true);
        }

        $paymentId = visit_billing_insert_payment_payload($pdo, $visitId, $input);
        $pdo->commit();

        try {
            notification_send_visit_event($pdo, $visitId, 'payment_received', [
                'payment_id' => $paymentId,
                'amount' => (float)($input['amount'] ?? 0),
                'reference_number' => visit_billing_nullable_text($input['reference_number'] ?? $input['referenceNumber'] ?? null),
            ]);
        } catch (Throwable $notificationError) {
            error_log('Visit payment notification failed: ' . $notificationError->getMessage());
        }

        echo json_encode([
            'success' => true,
            'message' => 'Payment recorded.',
            'visit' => visit_billing_fetch_visit($pdo, $visitId)
        ]);
    } catch (Exception $e) {
        visit_billing_error(500, 'Failed to record payment: ' . $e->getMessage());
    }
}

if (!defined('VISIT_BILLING_HELPERS_ONLY') || !VISIT_BILLING_HELPERS_ONLY) {
    $method = $_SERVER['REQUEST_METHOD'];
    $action = $_GET['action'] ?? '';
    $visitId = isset($_GET['visitId']) ? (int)$_GET['visitId'] : 0;

    if ($method === 'GET') {
        visit_billing_list($pdo);
    } elseif ($method === 'POST' && $action === 'charges') {
        visit_billing_replace_charges($pdo, $visitId);
    } elseif ($method === 'POST' && $action === 'payments') {
        visit_billing_add_payment($pdo, $visitId);
    } elseif ($method === 'POST') {
        visit_billing_upsert_visit($pdo);
    } else {
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
    }
}
