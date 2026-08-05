-- iPawcus Special Services billing-price migration
-- Target: MariaDB 10.4+ / MySQL 8+
--
-- RUN ORDER
-- 1. Back up the selected iPawcus database.
-- 2. Run the required 20260723 backend-integrity migrations first.
-- 3. Run this file.
-- 4. Deploy the matching PHP changes.
--
-- Safe to rerun. This migration adds one nullable exact-price column and only
-- backfills services whose display label unambiguously means "free".
-- Ranged or variable labels are deliberately left NULL so billing never
-- invents an amount.

SELECT DATABASE() AS selected_database, VERSION() AS database_version;

DROP PROCEDURE IF EXISTS ipawcus_special_service_billing_price_20260727;

DELIMITER $$

CREATE PROCEDURE ipawcus_special_service_billing_price_20260727()
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = DATABASE()
          AND table_name = 'special_service_catalog'
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'special_service_catalog is missing. Apply the repository baseline/20260723 integrity schema first.';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 'special_service_catalog'
          AND column_name = 'base_price'
    ) THEN
        ALTER TABLE special_service_catalog
            ADD COLUMN base_price DECIMAL(10,2) NULL
            COMMENT 'Exact default charge snapshotted into bookings.price; NULL means quote/manual price required'
            AFTER price_label;
    END IF;
END$$

DELIMITER ;

CALL ipawcus_special_service_billing_price_20260727();
DROP PROCEDURE IF EXISTS ipawcus_special_service_billing_price_20260727;

UPDATE special_service_catalog
SET base_price = 0.00
WHERE base_price IS NULL
  AND LOWER(TRIM(COALESCE(price_label, ''))) IN (
      'free',
      'no charge',
      'complimentary'
  );

-- Verification: this must return one row for base_price.
SELECT
    column_name,
    column_type,
    is_nullable,
    column_comment
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = 'special_service_catalog'
  AND column_name = 'base_price';

-- Operator review: set base_price only when one exact default charge is known.
-- Leave ranged, quote-based, per-pet, and variable prices NULL; POS will carry
-- the selected title with PHP 0.00 so staff can enter the final approved fee.
SELECT
    special_service_id,
    service_code,
    service_title,
    price_label,
    base_price
FROM special_service_catalog
ORDER BY sort_order ASC, special_service_id ASC;

