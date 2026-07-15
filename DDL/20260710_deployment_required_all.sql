-- iPawcus deployed-server SQL bundle for the July 10 update.
-- Run this once on the deployed database after taking a backup.
-- Safe to rerun: each section checks for existing columns, tables, or indexes.

-- =========================================================
-- 1. Co-parent approval workflow
-- =========================================================

SET @has_relationship := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'pet_ownership'
      AND COLUMN_NAME = 'relationship'
);
SET @sql := IF(
    @has_relationship = 0,
    'ALTER TABLE pet_ownership ADD COLUMN relationship VARCHAR(32) DEFAULT ''primary'' NULL AFTER pet_id',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_is_primary := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'pet_ownership'
      AND COLUMN_NAME = 'is_primary'
);
SET @sql := IF(
    @has_is_primary = 0,
    'ALTER TABLE pet_ownership ADD COLUMN is_primary TINYINT(1) DEFAULT 0 NULL AFTER relationship',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE pet_ownership po
JOIN (
    SELECT pet_id, MIN(link_id) AS primary_link_id
    FROM pet_ownership
    GROUP BY pet_id
) first_owner ON first_owner.pet_id = po.pet_id
SET
    po.relationship = CASE
        WHEN po.link_id = first_owner.primary_link_id THEN 'primary'
        ELSE 'co_parent'
    END,
    po.is_primary = CASE
        WHEN po.link_id = first_owner.primary_link_id THEN 1
        ELSE 0
    END
WHERE po.relationship IS NULL
   OR po.relationship = ''
   OR po.is_primary IS NULL;

SET @has_pet_index := (
    SELECT COUNT(*)
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'pet_ownership'
      AND INDEX_NAME = 'pet_ownership_pet_idx'
);
SET @sql := IF(
    @has_pet_index = 0,
    'ALTER TABLE pet_ownership ADD INDEX pet_ownership_pet_idx (pet_id)',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_single_pet_unique := (
    SELECT COUNT(*)
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'pet_ownership'
      AND INDEX_NAME = 'pet_id'
      AND NON_UNIQUE = 0
      AND COLUMN_NAME = 'pet_id'
);
SET @sql := IF(
    @has_single_pet_unique > 0,
    'ALTER TABLE pet_ownership DROP INDEX pet_id',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_user_pet_unique := (
    SELECT COUNT(*)
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'pet_ownership'
      AND INDEX_NAME = 'pet_ownership_user_pet_unique'
);
SET @sql := IF(
    @has_user_pet_unique = 0,
    'ALTER TABLE pet_ownership ADD UNIQUE KEY pet_ownership_user_pet_unique (user_id, pet_id)',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS pet_coparent_requests (
    request_id INT AUTO_INCREMENT PRIMARY KEY,
    pet_id INT NOT NULL,
    requester_user_id INT NOT NULL,
    primary_owner_user_id INT NOT NULL,
    status ENUM('pending','approved','declined','cancelled') NOT NULL DEFAULT 'pending',
    request_token VARCHAR(64) NOT NULL,
    requester_message TEXT NULL,
    decision_note TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    decided_at DATETIME NULL,
    INDEX idx_coparent_pet_status (pet_id, status),
    INDEX idx_coparent_owner_status (primary_owner_user_id, status),
    INDEX idx_coparent_requester_status (requester_user_id, status),
    UNIQUE KEY uniq_coparent_token (request_token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

SET @has_notification_preferences := (
    SELECT COUNT(*)
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'notification_preferences'
);
SET @has_ownership_updates := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'notification_preferences'
      AND COLUMN_NAME = 'ownership_updates'
);
SET @sql := IF(
    @has_notification_preferences > 0 AND @has_ownership_updates = 0,
    'ALTER TABLE notification_preferences ADD COLUMN ownership_updates TINYINT(1) NOT NULL DEFAULT 1 AFTER boarding_updates',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =========================================================
-- 2. Mail queue
-- =========================================================

CREATE TABLE IF NOT EXISTS mail_queue (
    queue_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    to_email VARCHAR(255) NOT NULL,
    to_name VARCHAR(180) NULL,
    subject VARCHAR(255) NOT NULL,
    html_body MEDIUMTEXT NOT NULL,
    text_body MEDIUMTEXT NULL,
    options_json TEXT NULL,
    notification_id INT NULL,
    status ENUM('pending','sending','sent','failed') NOT NULL DEFAULT 'pending',
    priority TINYINT NOT NULL DEFAULT 0,
    attempts INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 3,
    available_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    locked_at DATETIME NULL,
    lock_token CHAR(32) NULL,
    sent_at DATETIME NULL,
    last_error TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY mail_queue_status_available_idx (status, available_at, priority, queue_id),
    KEY mail_queue_notification_idx (notification_id),
    KEY mail_queue_lock_idx (lock_token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

SET @has_email_status := (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'user_notifications'
      AND column_name = 'email_status'
);

SET @email_status_sql := IF(
    @has_email_status > 0,
    "ALTER TABLE user_notifications MODIFY email_status ENUM('not_sent','queued','sent','failed','skipped') NOT NULL DEFAULT 'not_sent'",
    "SELECT 'user_notifications.email_status does not exist yet' AS info"
);

PREPARE email_status_stmt FROM @email_status_sql;
EXECUTE email_status_stmt;
DEALLOCATE PREPARE email_status_stmt;

-- =========================================================
-- 3. Performance indexes
-- =========================================================

DROP PROCEDURE IF EXISTS ipawcus_add_index_if_missing;
DROP PROCEDURE IF EXISTS ipawcus_add_perf_index_20260710;

CREATE INDEX IF NOT EXISTS users_mail_address_idx
    ON users (mail_Address);

CREATE INDEX IF NOT EXISTS pets_information_sharable_idx
    ON pets_information (pet_sharable_ID);

CREATE INDEX IF NOT EXISTS pets_information_status_idx
    ON pets_information (pet_status);

CREATE INDEX IF NOT EXISTS bookings_user_created_idx
    ON bookings (user_id, created_at, booking_id);

CREATE INDEX IF NOT EXISTS bookings_status_date_idx
    ON bookings (status, booking_date, booking_time);

CREATE INDEX IF NOT EXISTS bookings_service_date_status_idx
    ON bookings (service_type, booking_date, status);

CREATE INDEX IF NOT EXISTS bookings_vet_status_date_idx
    ON bookings (veterinarian_id, status, booking_date);

CREATE INDEX IF NOT EXISTS booking_pets_pet_booking_idx
    ON booking_pets (pet_id, booking_id);

CREATE INDEX IF NOT EXISTS queues_status_timestamp_idx
    ON queues (status, `timestamp`, queue_id);

CREATE INDEX IF NOT EXISTS queues_pet_status_idx
    ON queues (pet_id, status, `timestamp`);

CREATE INDEX IF NOT EXISTS queues_user_timestamp_idx
    ON queues (user_id, `timestamp`);

CREATE INDEX IF NOT EXISTS visits_created_idx
    ON visits (created_at, visit_id);

CREATE INDEX IF NOT EXISTS visits_billing_created_idx
    ON visits (billing_status, created_at);

CREATE INDEX IF NOT EXISTS visits_status_created_idx
    ON visits (visit_status, created_at);

CREATE INDEX IF NOT EXISTS visits_vet_created_idx
    ON visits (veterinarian_user_id, created_at);

CREATE INDEX IF NOT EXISTS visit_payments_status_paid_idx
    ON visit_payments (payment_status, paid_at);

CREATE INDEX IF NOT EXISTS visit_payments_method_paid_idx
    ON visit_payments (payment_method, paid_at);

CREATE INDEX IF NOT EXISTS visit_charges_visit_subtotal_idx
    ON visit_charges (visit_id, subtotal);

CREATE INDEX IF NOT EXISTS inventory_items_status_name_idx
    ON inventory_items (status, item_name);

CREATE INDEX IF NOT EXISTS inventory_items_category_status_idx
    ON inventory_items (category, status);

CREATE INDEX IF NOT EXISTS inventory_batches_item_expiry_idx
    ON inventory_batches (item_id, expiry_date, created_at);

CREATE INDEX IF NOT EXISTS inventory_movements_reference_idx
    ON inventory_stock_movements (reference_type, reference_id);

CREATE INDEX IF NOT EXISTS inventory_movements_item_created_idx
    ON inventory_stock_movements (item_id, created_at);

CREATE INDEX IF NOT EXISTS online_consultations_vet_start_idx
    ON online_consultations (veterinarian_user_id, scheduled_start);

CREATE INDEX IF NOT EXISTS online_consultations_owner_start_idx
    ON online_consultations (owner_user_id, scheduled_start);

CREATE INDEX IF NOT EXISTS vet_diagnoses_vet_finalized_idx
    ON vet_diagnoses (veterinarian_user_id, finalized_at, created_at);

CREATE INDEX IF NOT EXISTS vet_diagnoses_pet_created_idx
    ON vet_diagnoses (pet_id, created_at);

CREATE INDEX IF NOT EXISTS record_requests_status_created_idx
    ON pet_record_update_requests (status, created_at);

CREATE INDEX IF NOT EXISTS record_requests_vet_status_idx
    ON pet_record_update_requests (assigned_veterinarian_user_id, status, created_at);

CREATE INDEX IF NOT EXISTS record_requests_owner_status_idx
    ON pet_record_update_requests (owner_user_id, status, created_at);
