-- iPawcus payment-integrity and selling-price migration
-- Target: MariaDB 10.4+ / MySQL-compatible servers
-- Created: 2026-08-08
--
-- IMPORTANT
-- 1. Select the deployed iPawcus database before importing this file.
-- 2. Take a full database backup and pause application writes.
-- 3. Apply DDL/20260723_01_backend_integrity_schema.sql and
--    DDL/20260803_01_multi_branch_operations.sql first.
-- 4. Deploy the matching frontend and PHP files after this migration succeeds.
--
-- Safe to rerun. Existing payment proofs are imported as SUBMITTED for admin
-- review; this migration never assumes that a legacy proof was verified.

SELECT DATABASE() AS selected_database, VERSION() AS database_version;

DROP PROCEDURE IF EXISTS ipawcus_pi_add_column;

DELIMITER $$

CREATE PROCEDURE ipawcus_pi_add_column(
    IN p_table_name VARCHAR(64),
    IN p_column_name VARCHAR(64),
    IN p_definition TEXT
)
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = p_table_name
          AND column_name = p_column_name
    ) THEN
        SET @pi_sql = CONCAT(
            'ALTER TABLE `', REPLACE(p_table_name, '`', '``'),
            '` ADD COLUMN `', REPLACE(p_column_name, '`', '``'), '` ',
            p_definition
        );
        PREPARE pi_stmt FROM @pi_sql;
        EXECUTE pi_stmt;
        DEALLOCATE PREPARE pi_stmt;
    END IF;
END$$

DELIMITER ;

CALL ipawcus_pi_add_column(
    'inventory_items',
    'selling_price',
    'DECIMAL(12,2) NULL DEFAULT NULL AFTER `unit_cost`'
);

CALL ipawcus_pi_add_column(
    'bookings',
    'boarding_overstay_daily_rate',
    'DECIMAL(12,2) NULL DEFAULT NULL AFTER `price`'
);

UPDATE inventory_items
SET selling_price = unit_cost
WHERE selling_price IS NULL;

CREATE TABLE IF NOT EXISTS booking_payment_submissions (
    submission_id INT NOT NULL AUTO_INCREMENT,
    booking_id INT NOT NULL,
    purpose ENUM('booking_payment', 'online_consultation', 'home_transport', 'deposit') NOT NULL DEFAULT 'booking_payment',
    amount DECIMAL(12,2) NOT NULL,
    payment_method ENUM('cash', 'qrph', 'gcash', 'maya', 'bank_transfer') NOT NULL,
    reference_number VARCHAR(120) NULL,
    proof_url VARCHAR(500) NULL,
    submission_status ENUM('submitted', 'under_review', 'verified', 'rejected', 'refunded', 'voided') NOT NULL DEFAULT 'submitted',
    submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at DATETIME NULL,
    reviewed_by_user_id INT NULL,
    review_notes VARCHAR(500) NULL,
    linked_visit_payment_id INT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (submission_id),
    INDEX booking_payment_booking_status_idx (booking_id, submission_status),
    INDEX booking_payment_reviewed_by_idx (reviewed_by_user_id),
    INDEX booking_payment_method_reference_idx (payment_method, reference_number),
    UNIQUE INDEX booking_payment_linked_visit_payment_unique (linked_visit_payment_id),
    CONSTRAINT booking_payment_booking_fk
        FOREIGN KEY (booking_id) REFERENCES bookings (booking_id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT booking_payment_reviewer_fk
        FOREIGN KEY (reviewed_by_user_id) REFERENCES users (user_id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT booking_payment_visit_payment_fk
        FOREIGN KEY (linked_visit_payment_id) REFERENCES visit_payments (payment_id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT booking_payment_amount_positive CHECK (amount > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS visit_payment_refunds (
    refund_id INT NOT NULL AUTO_INCREMENT,
    visit_payment_id INT NOT NULL,
    visit_id INT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    refund_method ENUM('cash', 'qrph', 'gcash', 'maya', 'bank_transfer') NOT NULL,
    reference_number VARCHAR(120) NULL,
    reason VARCHAR(500) NOT NULL,
    refund_status ENUM('processed', 'voided') NOT NULL DEFAULT 'processed',
    processed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_by_user_id INT NOT NULL,
    processed_by_name VARCHAR(180) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (refund_id),
    INDEX visit_payment_refund_payment_idx (visit_payment_id, refund_status),
    INDEX visit_payment_refund_visit_idx (visit_id, processed_at),
    UNIQUE INDEX visit_payment_refund_method_reference_unique (refund_method, reference_number),
    CONSTRAINT visit_payment_refund_payment_fk
        FOREIGN KEY (visit_payment_id) REFERENCES visit_payments (payment_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT visit_payment_refund_visit_fk
        FOREIGN KEY (visit_id) REFERENCES visits (visit_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT visit_payment_refund_user_fk
        FOREIGN KEY (processed_by_user_id) REFERENCES users (user_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT visit_payment_refund_amount_positive CHECK (amount > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS booking_payment_refunds (
    refund_id INT NOT NULL AUTO_INCREMENT,
    booking_payment_submission_id INT NOT NULL,
    booking_id INT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    refund_method ENUM('cash', 'qrph', 'gcash', 'maya', 'bank_transfer') NOT NULL,
    reference_number VARCHAR(120) NULL,
    reason VARCHAR(500) NOT NULL,
    refund_status ENUM('processed', 'voided') NOT NULL DEFAULT 'processed',
    processed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_by_user_id INT NOT NULL,
    processed_by_name VARCHAR(180) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (refund_id),
    INDEX booking_payment_refund_submission_idx (booking_payment_submission_id, refund_status),
    INDEX booking_payment_refund_booking_idx (booking_id, processed_at),
    UNIQUE INDEX booking_payment_refund_method_reference_unique (refund_method, reference_number),
    CONSTRAINT booking_payment_refund_submission_fk
        FOREIGN KEY (booking_payment_submission_id) REFERENCES booking_payment_submissions (submission_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT booking_payment_refund_booking_fk
        FOREIGN KEY (booking_id) REFERENCES bookings (booking_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT booking_payment_refund_user_fk
        FOREIGN KEY (processed_by_user_id) REFERENCES users (user_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT booking_payment_refund_amount_positive CHECK (amount > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO booking_payment_submissions (
    booking_id,
    purpose,
    amount,
    payment_method,
    reference_number,
    proof_url,
    submission_status,
    submitted_at
)
SELECT
    b.booking_id,
    CASE
        WHEN COALESCE(b.is_home_service, 0) = 1 OR LOWER(TRIM(b.service_type)) IN ('home-service', 'home_service', 'home service')
            THEN 'home_transport'
        WHEN COALESCE(b.is_online_consultation, 0) = 1
            THEN 'online_consultation'
        ELSE 'booking_payment'
    END,
    CASE
        WHEN COALESCE(b.is_home_service, 0) = 1 OR LOWER(TRIM(b.service_type)) IN ('home-service', 'home_service', 'home service')
            THEN GREATEST(COALESCE(b.transport_fee, 0), 0)
        ELSE GREATEST(COALESCE(b.price, 0), 0)
    END,
    b.payment_method,
    NULLIF(TRIM(b.payment_reference), ''),
    b.payment_proof_url,
    'submitted',
    COALESCE(b.created_at, NOW())
FROM bookings b
WHERE b.payment_proof_url IS NOT NULL
  AND TRIM(b.payment_proof_url) <> ''
  AND b.payment_method IN ('cash', 'qrph', 'gcash', 'maya', 'bank_transfer')
  AND (
      CASE
          WHEN COALESCE(b.is_home_service, 0) = 1 OR LOWER(TRIM(b.service_type)) IN ('home-service', 'home_service', 'home service')
              THEN GREATEST(COALESCE(b.transport_fee, 0), 0)
          ELSE GREATEST(COALESCE(b.price, 0), 0)
      END
  ) > 0
  AND NOT EXISTS (
      SELECT 1
      FROM booking_payment_submissions existing_submission
      WHERE existing_submission.booking_id = b.booking_id
  );

DROP PROCEDURE IF EXISTS ipawcus_pi_add_column;

SELECT
    (SELECT COUNT(*) FROM booking_payment_submissions) AS booking_payment_submission_count,
    (SELECT COUNT(*) FROM visit_payment_refunds) AS visit_payment_refund_count,
    (SELECT COUNT(*) FROM booking_payment_refunds) AS booking_payment_refund_count,
    (SELECT COUNT(*) FROM inventory_items WHERE selling_price IS NULL) AS inventory_items_missing_selling_price;
