-- Inventory display test seed
-- Re-runnable: this removes only rows tied to the QA-INV-* SKUs below.
-- Creates:
--   1. QA Near Expiry Dewormer: 2 batches, one near-expiry and one fresh
--   2. QA Expired Rabies Vaccine: 1 expired batch
--   3. QA Stable Surgical Gloves: 1 fresh batch

START TRANSACTION;

SET @sku_near := 'QA-INV-DEWORM-001';
SET @sku_expired := 'QA-INV-RABIES-EXPIRED-001';
SET @sku_fresh := 'QA-INV-GLOVES-001';
SET @delivery_note := 'QA-INV-EXPIRY-BATCH-SEED';

DELETE sm
FROM inventory_stock_movements sm
JOIN inventory_items i ON i.item_id = sm.item_id
WHERE i.sku IN (@sku_near, @sku_expired, @sku_fresh);

DELETE sri
FROM inventory_stock_receipt_items sri
JOIN inventory_items i ON i.item_id = sri.item_id
WHERE i.sku IN (@sku_near, @sku_expired, @sku_fresh);

DELETE sri
FROM inventory_stock_receipt_items sri
JOIN inventory_stock_receipts sr ON sr.receipt_id = sri.receipt_id
WHERE sr.delivery_note_number = @delivery_note;

DELETE b
FROM inventory_batches b
JOIN inventory_items i ON i.item_id = b.item_id
WHERE i.sku IN (@sku_near, @sku_expired, @sku_fresh);

DELETE FROM inventory_items
WHERE sku IN (@sku_near, @sku_expired, @sku_fresh);

DELETE FROM inventory_stock_receipts
WHERE delivery_note_number = @delivery_note;

INSERT INTO users (
    first_Name,
    last_Name,
    mail_Address,
    personal_Address,
    user_password,
    role
)
SELECT
    'Inventory',
    'Seeder',
    'inventory.seed@example.test',
    'Local seed data',
    NULL,
    'admin'
WHERE NOT EXISTS (
    SELECT 1
    FROM users
    WHERE mail_Address = 'inventory.seed@example.test'
);

SET @seed_user_id := (
    SELECT user_id
    FROM users
    WHERE mail_Address = 'inventory.seed@example.test'
    ORDER BY user_id
    LIMIT 1
);
SET @seed_user_name := 'Inventory Seeder';

INSERT INTO inventory_locations (
    location_name,
    location_type,
    address,
    status
)
VALUES (
    'QA Pharmacy Storage',
    'storage',
    'Seeded test location',
    'active'
)
ON DUPLICATE KEY UPDATE
    location_id = LAST_INSERT_ID(location_id),
    location_type = VALUES(location_type),
    address = VALUES(address),
    status = VALUES(status);
SET @pharmacy_location_id := LAST_INSERT_ID();

INSERT INTO inventory_locations (
    location_name,
    location_type,
    address,
    status
)
VALUES (
    'QA Cold Storage',
    'storage',
    'Seeded cold-chain test location',
    'active'
)
ON DUPLICATE KEY UPDATE
    location_id = LAST_INSERT_ID(location_id),
    location_type = VALUES(location_type),
    address = VALUES(address),
    status = VALUES(status);
SET @cold_location_id := LAST_INSERT_ID();

INSERT INTO inventory_suppliers (
    supplier_name,
    contact_number,
    email,
    address,
    status
)
VALUES (
    'QA Vet Supply Tester',
    '+63 900 000 0000',
    'qa-vet-supply@example.test',
    'Seeded supplier for inventory QA',
    'active'
)
ON DUPLICATE KEY UPDATE
    supplier_id = LAST_INSERT_ID(supplier_id),
    contact_number = VALUES(contact_number),
    email = VALUES(email),
    address = VALUES(address),
    status = VALUES(status);
SET @supplier_id := LAST_INSERT_ID();

INSERT INTO inventory_items (
    item_name,
    generic_name,
    sku,
    barcode,
    description,
    category,
    brand,
    unit,
    reorder_level,
    unit_cost,
    expiry_warning_days,
    profile_image_path,
    status,
    created_by_user_id,
    created_by_name,
    location_id
)
VALUES (
    'QA Near Expiry Dewormer',
    'Pyrantel Pamoate',
    @sku_near,
    'QA-DEWORM-001',
    'Seed item for checking near-expiry status and multi-batch display.',
    'Medicines',
    'QA Pharma',
    'bottles',
    10,
    185.00,
    90,
    NULL,
    'active',
    @seed_user_id,
    @seed_user_name,
    @pharmacy_location_id
);
SET @item_near_id := LAST_INSERT_ID();

INSERT INTO inventory_items (
    item_name,
    generic_name,
    sku,
    barcode,
    description,
    category,
    brand,
    unit,
    reorder_level,
    unit_cost,
    expiry_warning_days,
    profile_image_path,
    status,
    created_by_user_id,
    created_by_name,
    location_id
)
VALUES (
    'QA Expired Rabies Vaccine',
    'Inactivated Rabies Vaccine',
    @sku_expired,
    'QA-RABIES-EXP-001',
    'Seed item for checking expired status.',
    'Vaccines',
    'QA Biologics',
    'vials',
    5,
    520.00,
    90,
    NULL,
    'active',
    @seed_user_id,
    @seed_user_name,
    @cold_location_id
);
SET @item_expired_id := LAST_INSERT_ID();

INSERT INTO inventory_items (
    item_name,
    generic_name,
    sku,
    barcode,
    description,
    category,
    brand,
    unit,
    reorder_level,
    unit_cost,
    expiry_warning_days,
    profile_image_path,
    status,
    created_by_user_id,
    created_by_name,
    location_id
)
VALUES (
    'QA Stable Surgical Gloves',
    NULL,
    @sku_fresh,
    'QA-GLOVES-001',
    'Seed item for checking a normal in-stock item.',
    'Medical Supplies',
    'QA Medline',
    'boxes',
    20,
    245.00,
    90,
    NULL,
    'active',
    @seed_user_id,
    @seed_user_name,
    @pharmacy_location_id
);
SET @item_fresh_id := LAST_INSERT_ID();

INSERT INTO inventory_stock_receipts (
    receiving_date,
    delivery_note_number,
    proof_image_path,
    notes,
    received_by_user_id,
    received_by_name
)
VALUES (
    CURDATE(),
    @delivery_note,
    NULL,
    'Seed receipt for inventory display testing: 3 items, 4 batches, near-expiry and expired coverage.',
    @seed_user_id,
    @seed_user_name
);
SET @receipt_id := LAST_INSERT_ID();

INSERT INTO inventory_batches (
    item_id,
    location_id,
    batch_number,
    quantity,
    manufacturing_date,
    expiry_date,
    unit_cost
)
VALUES (
    @item_near_id,
    @pharmacy_location_id,
    'QA-DW-NEAR-001',
    24,
    DATE_SUB(CURDATE(), INTERVAL 180 DAY),
    DATE_ADD(CURDATE(), INTERVAL 20 DAY),
    185.00
);
SET @batch_near_id := LAST_INSERT_ID();

INSERT INTO inventory_batches (
    item_id,
    location_id,
    batch_number,
    quantity,
    manufacturing_date,
    expiry_date,
    unit_cost
)
VALUES (
    @item_near_id,
    @pharmacy_location_id,
    'QA-DW-FRESH-002',
    36,
    DATE_SUB(CURDATE(), INTERVAL 60 DAY),
    DATE_ADD(CURDATE(), INTERVAL 365 DAY),
    185.00
);
SET @batch_near_fresh_id := LAST_INSERT_ID();

INSERT INTO inventory_batches (
    item_id,
    location_id,
    batch_number,
    quantity,
    manufacturing_date,
    expiry_date,
    unit_cost
)
VALUES (
    @item_expired_id,
    @cold_location_id,
    'QA-RAB-EXP-001',
    10,
    DATE_SUB(CURDATE(), INTERVAL 240 DAY),
    DATE_SUB(CURDATE(), INTERVAL 14 DAY),
    520.00
);
SET @batch_expired_id := LAST_INSERT_ID();

INSERT INTO inventory_batches (
    item_id,
    location_id,
    batch_number,
    quantity,
    manufacturing_date,
    expiry_date,
    unit_cost
)
VALUES (
    @item_fresh_id,
    @pharmacy_location_id,
    'QA-GLV-FRESH-001',
    50,
    DATE_SUB(CURDATE(), INTERVAL 30 DAY),
    DATE_ADD(CURDATE(), INTERVAL 730 DAY),
    245.00
);
SET @batch_fresh_id := LAST_INSERT_ID();

INSERT INTO inventory_stock_receipt_items (
    receipt_id,
    item_id,
    supplier_id,
    location_id,
    batch_id,
    batch_number,
    quantity_received,
    expiry_date,
    unit_cost
)
VALUES
    (@receipt_id, @item_near_id, @supplier_id, @pharmacy_location_id, @batch_near_id, 'QA-DW-NEAR-001', 24, DATE_ADD(CURDATE(), INTERVAL 20 DAY), 185.00),
    (@receipt_id, @item_near_id, @supplier_id, @pharmacy_location_id, @batch_near_fresh_id, 'QA-DW-FRESH-002', 36, DATE_ADD(CURDATE(), INTERVAL 365 DAY), 185.00),
    (@receipt_id, @item_expired_id, @supplier_id, @cold_location_id, @batch_expired_id, 'QA-RAB-EXP-001', 10, DATE_SUB(CURDATE(), INTERVAL 14 DAY), 520.00),
    (@receipt_id, @item_fresh_id, @supplier_id, @pharmacy_location_id, @batch_fresh_id, 'QA-GLV-FRESH-001', 50, DATE_ADD(CURDATE(), INTERVAL 730 DAY), 245.00);

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
)
VALUES
    (@item_near_id, @batch_near_id, 'stock_in', 24, 0, 24, 'inventory_stock_receipts', @receipt_id, 'Seed stock in: near-expiry batch', @seed_user_id, @seed_user_name),
    (@item_near_id, @batch_near_fresh_id, 'stock_in', 36, 0, 36, 'inventory_stock_receipts', @receipt_id, 'Seed stock in: fresh batch', @seed_user_id, @seed_user_name),
    (@item_expired_id, @batch_expired_id, 'stock_in', 10, 0, 10, 'inventory_stock_receipts', @receipt_id, 'Seed stock in: expired batch', @seed_user_id, @seed_user_name),
    (@item_fresh_id, @batch_fresh_id, 'stock_in', 50, 0, 50, 'inventory_stock_receipts', @receipt_id, 'Seed stock in: fresh batch', @seed_user_id, @seed_user_name);

COMMIT;

SELECT
    i.sku,
    i.item_name,
    b.batch_number,
    b.quantity,
    b.expiry_date,
    CASE
        WHEN b.expiry_date < CURDATE() THEN 'expired batch'
        WHEN DATEDIFF(b.expiry_date, CURDATE()) <= i.expiry_warning_days THEN 'near-expiry batch'
        ELSE 'fresh batch'
    END AS expected_batch_status
FROM inventory_items i
JOIN inventory_batches b ON b.item_id = i.item_id
WHERE i.sku IN (@sku_near, @sku_expired, @sku_fresh)
ORDER BY i.item_name, b.expiry_date;
