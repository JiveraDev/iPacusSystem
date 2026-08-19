-- iPawcus archive, configurable payment methods, and inventory storage migration
-- Target: MariaDB 10.4+ / MySQL-compatible servers
-- Created: 2026-08-0
-- IMPORTANT
-- 1. Select the deployed iPawcus database and take a full backup first.
-- 2. Run DDL/20260808_01_payment_integrity.sql before this migration.
-- 3. Deploy the matching PHP and frontend files after this script succeeds.
-- 4. Add a long random PAYMENT_DETAILS_KEY to the deployed PHP environment.
--
-- Safe to rerun. No branch, account, pet, inventory, or payment row is deleted.

SELECT DATABASE() AS selected_database, VERSION() AS database_version;

DROP PROCEDURE IF EXISTS ipawcus_aps_add_column;
DELIMITER $$
CREATE PROCEDURE ipawcus_aps_add_column(
    IN p_table_name VARCHAR(64),
    IN p_column_name VARCHAR(64),
    IN p_definition TEXT
)
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = DATABASE() AND table_name = p_table_name
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = p_table_name AND column_name = p_column_name
    ) THEN
        SET @aps_sql = CONCAT(
            'ALTER TABLE `', REPLACE(p_table_name, '`', '``'),
            '` ADD COLUMN `', REPLACE(p_column_name, '`', '``'), '` ', p_definition
        );
        PREPARE aps_stmt FROM @aps_sql;
        EXECUTE aps_stmt;
        DEALLOCATE PREPARE aps_stmt;
    END IF;
END$$
DELIMITER ;

-- Archive metadata. Existing deactivated accounts remain recoverable and are
-- normalized to the new user-facing Archived state.
CALL ipawcus_aps_add_column('users', 'account_status', "VARCHAR(24) NOT NULL DEFAULT 'active'");
ALTER TABLE users
    MODIFY COLUMN account_status ENUM('active', 'archived', 'deactivated') NOT NULL DEFAULT 'active';
UPDATE users SET account_status = 'archived' WHERE account_status = 'deactivated';

CALL ipawcus_aps_add_column('pets_information', 'is_archived', 'TINYINT(1) NOT NULL DEFAULT 0');
CALL ipawcus_aps_add_column('pets_information', 'archived_at', 'DATETIME NULL');
CALL ipawcus_aps_add_column('pets_information', 'archived_by_user_id', 'INT NULL');
CALL ipawcus_aps_add_column('pets_information', 'archive_reason', 'VARCHAR(500) NULL');

-- Payment method category and encrypted account-number storage.
CALL ipawcus_aps_add_column('payment_methods', 'method_type', "VARCHAR(32) NOT NULL DEFAULT 'ewallet'");
CALL ipawcus_aps_add_column('payment_methods', 'account_number_encrypted', 'MEDIUMTEXT NULL');

ALTER TABLE payment_methods
    MODIFY COLUMN method_key VARCHAR(64) NOT NULL,
    MODIFY COLUMN label VARCHAR(100) NOT NULL,
    MODIFY COLUMN account_name VARCHAR(150) NULL,
    MODIFY COLUMN qr_image_url VARCHAR(500) NULL;

UPDATE payment_methods
SET method_type = CASE
    WHEN method_key = 'bank_transfer' THEN 'bank_transfer'
    ELSE 'ewallet'
END
WHERE method_type IS NULL OR TRIM(method_type) = '' OR method_type NOT IN ('ewallet', 'bank_transfer');

-- Configurable method keys must be accepted by every payment ledger. Existing
-- values and indexes are retained; only the column type is widened.
ALTER TABLE bookings MODIFY COLUMN payment_method VARCHAR(64) NULL;
ALTER TABLE pet_record_update_requests MODIFY COLUMN payment_method VARCHAR(64) NOT NULL DEFAULT 'qrph';
ALTER TABLE visit_payments MODIFY COLUMN payment_method VARCHAR(64) NOT NULL;
ALTER TABLE booking_payment_submissions MODIFY COLUMN payment_method VARCHAR(64) NOT NULL;
ALTER TABLE visit_payment_refunds MODIFY COLUMN refund_method VARCHAR(64) NOT NULL;
ALTER TABLE booking_payment_refunds MODIFY COLUMN refund_method VARCHAR(64) NOT NULL;

-- Branch is held by inventory_locations.branch_id; storage_area identifies the
-- shelf, cabinet, room, refrigerator, display, or other part within that branch.
CALL ipawcus_aps_add_column('inventory_locations', 'storage_area', 'VARCHAR(120) NULL');
UPDATE inventory_locations
SET storage_area = COALESCE(NULLIF(TRIM(storage_area), ''), 'General Storage');
ALTER TABLE inventory_locations
    MODIFY COLUMN storage_area VARCHAR(120) NOT NULL DEFAULT 'General Storage';

-- A location name may be reused at another branch or for another storage part.
-- Replace the legacy global-name constraint with the operational identity used
-- by the backend: branch + location + storage area.
SET @aps_sql = IF(
    EXISTS (
        SELECT 1 FROM information_schema.statistics
        WHERE table_schema = DATABASE()
          AND table_name = 'inventory_locations'
          AND index_name = 'location_name'
    ),
    'ALTER TABLE `inventory_locations` DROP INDEX `location_name`',
    'SELECT 1'
);
PREPARE aps_stmt FROM @aps_sql;
EXECUTE aps_stmt;
DEALLOCATE PREPARE aps_stmt;

SET @aps_sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.statistics
        WHERE table_schema = DATABASE()
          AND table_name = 'inventory_locations'
          AND index_name = 'inventory_location_branch_storage_unique'
    ),
    'ALTER TABLE `inventory_locations` ADD UNIQUE INDEX `inventory_location_branch_storage_unique` (`branch_id`, `location_name`, `storage_area`)',
    'SELECT 1'
);
PREPARE aps_stmt FROM @aps_sql;
EXECUTE aps_stmt;
DEALLOCATE PREPARE aps_stmt;

DROP PROCEDURE IF EXISTS ipawcus_aps_add_column;

SELECT
    (SELECT COUNT(*) FROM users WHERE account_status = 'archived') AS archived_account_count,
    (SELECT COUNT(*) FROM pets_information WHERE is_archived = 1) AS archived_pet_count,
    (SELECT COUNT(*) FROM payment_methods) AS payment_method_count,
    (SELECT COUNT(*) FROM inventory_locations WHERE storage_area IS NULL OR TRIM(storage_area) = '') AS locations_missing_storage_area;
