-- iPawcus backend-integrity schema migration
-- Target: MariaDB 10.4+ / MySQL-compatible servers
--
-- IMPORTANT
-- 1. Select the intended iPawcus database before running this file.
-- 2. Take a full database backup.
-- 3. Run this file before 20260723_02_pet_allergy_backfill.sql and
--    the separate 20260723_03a preview / 20260723_03b write scripts.
-- 4. This migration changes schema and performs narrowly scoped data
--    normalization: invalid optional actor IDs are cleared and payment
--    references are trimmed (blank references become NULL). It does not create
--    historical payments or clear any legacy allergy field.
--
-- Safe to rerun: columns, indexes, constraints, and tables are checked before
-- they are added. Unique indexes are skipped with a warning if duplicate data
-- must be reviewed first.

SELECT DATABASE() AS selected_database, VERSION() AS database_version;

-- These are baseline dependencies, not created by this repair migration.
SELECT required_table
FROM (
    SELECT 'users' AS required_table
    UNION ALL SELECT 'pets_information'
    UNION ALL SELECT 'pet_ownership'
    UNION ALL SELECT 'bookings'
    UNION ALL SELECT 'queues'
    UNION ALL SELECT 'inventory_items'
    UNION ALL SELECT 'online_consultations'
    UNION ALL SELECT 'vet_diagnoses'
    UNION ALL SELECT 'service_catalog'
    UNION ALL SELECT 'boarding_assignments'
    UNION ALL SELECT 'boarding_documents'
    UNION ALL SELECT 'boarding_observations'
    UNION ALL SELECT 'boarding_tasks'
    UNION ALL SELECT 'online_consultation_reschedules'
    UNION ALL SELECT 'pet_allergies'
    UNION ALL SELECT 'pet_owner_todos'
    UNION ALL SELECT 'pet_record_update_requests'
    UNION ALL SELECT 'room_unit_statuses'
    UNION ALL SELECT 'service_materials'
    UNION ALL SELECT 'visits'
    UNION ALL SELECT 'visit_charges'
    UNION ALL SELECT 'visit_payments'
) required
LEFT JOIN information_schema.tables existing_table
    ON existing_table.table_schema = DATABASE()
   AND existing_table.table_name = required.required_table
WHERE existing_table.table_name IS NULL;

-- STOP if the preceding query returns any rows. Restore/apply the repository
-- baseline DDL before continuing with this repair migration.

-- =========================================================
-- 1. Reusable idempotent migration helpers
-- =========================================================

DROP PROCEDURE IF EXISTS ipawcus_add_column_if_missing_20260723;
DROP PROCEDURE IF EXISTS ipawcus_add_index_if_missing_20260723;
DROP PROCEDURE IF EXISTS ipawcus_add_constraint_if_missing_20260723;
DROP PROCEDURE IF EXISTS ipawcus_assert_backend_baseline_20260723;
DROP PROCEDURE IF EXISTS ipawcus_align_payment_method_enum_20260723;
DROP PROCEDURE IF EXISTS ipawcus_normalize_payment_references_20260723;
DROP PROCEDURE IF EXISTS ipawcus_assert_backend_contract_20260723;

DELIMITER $$

CREATE PROCEDURE ipawcus_assert_backend_baseline_20260723()
BEGIN
    DECLARE missing_count INT DEFAULT 0;

    SELECT COUNT(*)
    INTO missing_count
    FROM (
        SELECT 'users' AS required_table
        UNION ALL SELECT 'pets_information'
        UNION ALL SELECT 'pet_ownership'
        UNION ALL SELECT 'bookings'
        UNION ALL SELECT 'queues'
        UNION ALL SELECT 'inventory_items'
        UNION ALL SELECT 'online_consultations'
        UNION ALL SELECT 'vet_diagnoses'
        UNION ALL SELECT 'service_catalog'
        UNION ALL SELECT 'boarding_assignments'
        UNION ALL SELECT 'boarding_documents'
        UNION ALL SELECT 'boarding_observations'
        UNION ALL SELECT 'boarding_tasks'
        UNION ALL SELECT 'online_consultation_reschedules'
        UNION ALL SELECT 'pet_allergies'
        UNION ALL SELECT 'pet_owner_todos'
        UNION ALL SELECT 'pet_record_update_requests'
        UNION ALL SELECT 'room_unit_statuses'
        UNION ALL SELECT 'service_materials'
        UNION ALL SELECT 'visits'
        UNION ALL SELECT 'visit_charges'
        UNION ALL SELECT 'visit_payments'
    ) required
    LEFT JOIN information_schema.tables existing_table
        ON existing_table.table_schema = DATABASE()
       AND existing_table.table_name = required.required_table
    WHERE existing_table.table_name IS NULL;

    IF missing_count > 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Required baseline tables are missing. Restore the repository baseline DDL before running the 20260723 repair.';
    END IF;
END$$

CREATE PROCEDURE ipawcus_add_column_if_missing_20260723(
    IN p_table_name VARCHAR(64),
    IN p_column_name VARCHAR(64),
    IN p_column_definition TEXT
)
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = DATABASE()
          AND table_name = p_table_name
    ) AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = p_table_name
          AND column_name = p_column_name
    ) THEN
        SET @ipawcus_ddl = CONCAT(
            'ALTER TABLE `',
            REPLACE(p_table_name, '`', '``'),
            '` ADD COLUMN `',
            REPLACE(p_column_name, '`', '``'),
            '` ',
            p_column_definition
        );
        PREPARE ipawcus_stmt FROM @ipawcus_ddl;
        EXECUTE ipawcus_stmt;
        DEALLOCATE PREPARE ipawcus_stmt;
    END IF;
END$$

CREATE PROCEDURE ipawcus_add_index_if_missing_20260723(
    IN p_table_name VARCHAR(64),
    IN p_index_name VARCHAR(64),
    IN p_index_definition TEXT
)
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = DATABASE()
          AND table_name = p_table_name
    ) AND NOT EXISTS (
        SELECT 1
        FROM information_schema.statistics
        WHERE table_schema = DATABASE()
          AND table_name = p_table_name
          AND index_name = p_index_name
    ) THEN
        SET @ipawcus_ddl = CONCAT(
            'ALTER TABLE `',
            REPLACE(p_table_name, '`', '``'),
            '` ADD ',
            p_index_definition
        );
        PREPARE ipawcus_stmt FROM @ipawcus_ddl;
        EXECUTE ipawcus_stmt;
        DEALLOCATE PREPARE ipawcus_stmt;
    END IF;
END$$

CREATE PROCEDURE ipawcus_add_constraint_if_missing_20260723(
    IN p_table_name VARCHAR(64),
    IN p_constraint_name VARCHAR(64),
    IN p_constraint_definition TEXT
)
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = DATABASE()
          AND table_name = p_table_name
    ) AND NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_schema = DATABASE()
          AND table_name = p_table_name
          AND constraint_name = p_constraint_name
    ) THEN
        SET @ipawcus_ddl = CONCAT(
            'ALTER TABLE `',
            REPLACE(p_table_name, '`', '``'),
            '` ADD CONSTRAINT `',
            REPLACE(p_constraint_name, '`', '``'),
            '` ',
            p_constraint_definition
        );
        PREPARE ipawcus_stmt FROM @ipawcus_ddl;
        EXECUTE ipawcus_stmt;
        DEALLOCATE PREPARE ipawcus_stmt;
    END IF;
END$$

CREATE PROCEDURE ipawcus_align_payment_method_enum_20260723()
BEGIN
    DECLARE current_column_type TEXT DEFAULT NULL;
    DECLARE current_nullable VARCHAR(3) DEFAULT NULL;
    DECLARE current_default VARCHAR(64) DEFAULT NULL;

    SELECT
        LOWER(column_type),
        is_nullable,
        column_default
    INTO
        current_column_type,
        current_nullable,
        current_default
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'visit_payments'
      AND column_name = 'payment_method'
    LIMIT 1;

    IF current_column_type IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'visit_payments.payment_method is missing.';
    ELSEIF current_column_type NOT IN (
        'enum(''qrph'',''gcash'',''maya'',''bank_transfer'')',
        'enum(''cash'',''qrph'',''gcash'',''maya'',''bank_transfer'')'
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Unexpected visit_payments.payment_method enum. Review its values before running this migration.';
    ELSEIF current_column_type <> 'enum(''cash'',''qrph'',''gcash'',''maya'',''bank_transfer'')'
        OR current_nullable <> 'NO'
        OR TRIM(BOTH '''' FROM COALESCE(current_default, '')) <> 'gcash'
    THEN
        ALTER TABLE visit_payments
            MODIFY COLUMN payment_method
                ENUM('cash','qrph','gcash','maya','bank_transfer')
                NOT NULL
                DEFAULT 'gcash';
    END IF;
END$$

CREATE PROCEDURE ipawcus_normalize_payment_references_20260723()
BEGIN
    DECLARE normalized_collision_count INT DEFAULT 0;

    SELECT COUNT(*)
    INTO normalized_collision_count
    FROM (
        SELECT payment_method, TRIM(reference_number) AS normalized_reference
        FROM visit_payments
        WHERE reference_number IS NOT NULL
          AND TRIM(reference_number) <> ''
        GROUP BY payment_method, TRIM(reference_number)
        HAVING COUNT(*) > 1
    ) normalized_collisions;

    IF normalized_collision_count > 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Payment references collide after trimming. Resolve the duplicate references and rerun script 01.';
    END IF;

    UPDATE visit_payments
    SET reference_number = NULLIF(TRIM(reference_number), '')
    WHERE reference_number IS NOT NULL
      AND (
          reference_number <> TRIM(reference_number)
          OR TRIM(reference_number) = ''
      );
END$$

DELIMITER ;

CALL ipawcus_assert_backend_baseline_20260723();
DROP PROCEDURE IF EXISTS ipawcus_assert_backend_baseline_20260723;

-- =========================================================
-- 2. Canonical allergy metadata and clinical audit fields
-- =========================================================

CALL ipawcus_add_column_if_missing_20260723(
    'pet_allergies',
    'reaction',
    'VARCHAR(255) NULL AFTER `severity`'
);
CALL ipawcus_add_column_if_missing_20260723(
    'pet_allergies',
    'source',
    'VARCHAR(32) NOT NULL DEFAULT ''clinical'' AFTER `reaction`'
);
CALL ipawcus_add_column_if_missing_20260723(
    'pet_allergies',
    'verification_status',
    'VARCHAR(24) NOT NULL DEFAULT ''needs_review'' AFTER `source`'
);
CALL ipawcus_add_column_if_missing_20260723(
    'pet_allergies',
    'created_by_user_id',
    'INT NULL AFTER `verification_status`'
);
CALL ipawcus_add_column_if_missing_20260723(
    'pet_allergies',
    'updated_by_user_id',
    'INT NULL AFTER `created_by_user_id`'
);
CALL ipawcus_add_column_if_missing_20260723(
    'pet_allergies',
    'verified_by_user_id',
    'INT NULL AFTER `updated_by_user_id`'
);
CALL ipawcus_add_column_if_missing_20260723(
    'pet_allergies',
    'verified_at',
    'DATETIME NULL AFTER `verified_by_user_id`'
);
CALL ipawcus_add_column_if_missing_20260723(
    'pet_allergies',
    'created_at',
    'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER `verified_at`'
);
CALL ipawcus_add_column_if_missing_20260723(
    'pet_allergies',
    'updated_at',
    'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER `created_at`'
);

CALL ipawcus_add_index_if_missing_20260723(
    'pet_allergies',
    'pet_allergies_pet_allergen_idx',
    'INDEX `pet_allergies_pet_allergen_idx` (`pet_id`, `allergen`)'
);
CALL ipawcus_add_index_if_missing_20260723(
    'pet_allergies',
    'pet_allergies_verification_idx',
    'INDEX `pet_allergies_verification_idx` (`verification_status`, `pet_id`)'
);
CALL ipawcus_add_index_if_missing_20260723(
    'pet_allergies',
    'pet_allergies_created_by_idx',
    'INDEX `pet_allergies_created_by_idx` (`created_by_user_id`)'
);
CALL ipawcus_add_index_if_missing_20260723(
    'pet_allergies',
    'pet_allergies_updated_by_idx',
    'INDEX `pet_allergies_updated_by_idx` (`updated_by_user_id`)'
);
CALL ipawcus_add_index_if_missing_20260723(
    'pet_allergies',
    'pet_allergies_verified_by_idx',
    'INDEX `pet_allergies_verified_by_idx` (`verified_by_user_id`)'
);

-- Remove invalid historical actor references before adding foreign keys.
UPDATE pet_allergies pa
LEFT JOIN users u ON u.user_id = pa.created_by_user_id
SET pa.created_by_user_id = NULL
WHERE pa.created_by_user_id IS NOT NULL
  AND u.user_id IS NULL;

UPDATE pet_allergies pa
LEFT JOIN users u ON u.user_id = pa.updated_by_user_id
SET pa.updated_by_user_id = NULL
WHERE pa.updated_by_user_id IS NOT NULL
  AND u.user_id IS NULL;

UPDATE pet_allergies pa
LEFT JOIN users u ON u.user_id = pa.verified_by_user_id
SET pa.verified_by_user_id = NULL
WHERE pa.verified_by_user_id IS NOT NULL
  AND u.user_id IS NULL;

CALL ipawcus_add_constraint_if_missing_20260723(
    'pet_allergies',
    'pet_allergies_created_by_fk',
    'FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL'
);
CALL ipawcus_add_constraint_if_missing_20260723(
    'pet_allergies',
    'pet_allergies_updated_by_fk',
    'FOREIGN KEY (`updated_by_user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL'
);
CALL ipawcus_add_constraint_if_missing_20260723(
    'pet_allergies',
    'pet_allergies_verified_by_fk',
    'FOREIGN KEY (`verified_by_user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL'
);

-- Add the duplicate-prevention key only when existing data is clean.
SET @pet_allergy_duplicate_count = (
    SELECT COUNT(*)
    FROM (
        SELECT pet_id, LOWER(TRIM(allergen)) AS normalized_allergen
        FROM pet_allergies
        GROUP BY pet_id, LOWER(TRIM(allergen))
        HAVING COUNT(*) > 1
    ) duplicate_allergies
);
SET @pet_allergy_unique_exists = (
    SELECT COUNT(*)
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'pet_allergies'
      AND index_name = 'pet_allergies_pet_allergen_unique'
);
SET @ipawcus_ddl = IF(
    @pet_allergy_unique_exists = 0 AND @pet_allergy_duplicate_count = 0,
    'ALTER TABLE `pet_allergies` ADD UNIQUE INDEX `pet_allergies_pet_allergen_unique` (`pet_id`, `allergen`)',
    'SELECT ''pet_allergies unique key already exists or duplicate allergies require review'' AS migration_info'
);
PREPARE ipawcus_stmt FROM @ipawcus_ddl;
EXECUTE ipawcus_stmt;
DEALLOCATE PREPARE ipawcus_stmt;

-- =========================================================
-- 3. Structured boarding observations
-- =========================================================

CALL ipawcus_add_column_if_missing_20260723(
    'boarding_observations',
    'appetite_status',
    'VARCHAR(40) NULL AFTER `notes`'
);
CALL ipawcus_add_column_if_missing_20260723(
    'boarding_observations',
    'water_intake_status',
    'VARCHAR(40) NULL AFTER `appetite_status`'
);
CALL ipawcus_add_column_if_missing_20260723(
    'boarding_observations',
    'elimination_status',
    'VARCHAR(40) NULL AFTER `water_intake_status`'
);
CALL ipawcus_add_column_if_missing_20260723(
    'boarding_observations',
    'behavior_status',
    'VARCHAR(40) NULL AFTER `elimination_status`'
);
CALL ipawcus_add_column_if_missing_20260723(
    'boarding_observations',
    'temperature_c',
    'DECIMAL(5,2) NULL AFTER `behavior_status`'
);
CALL ipawcus_add_column_if_missing_20260723(
    'boarding_observations',
    'weight_kg',
    'DECIMAL(8,2) NULL AFTER `temperature_c`'
);
CALL ipawcus_add_column_if_missing_20260723(
    'boarding_observations',
    'condition_severity',
    'VARCHAR(40) NULL AFTER `weight_kg`'
);
CALL ipawcus_add_column_if_missing_20260723(
    'boarding_observations',
    'requires_vet_review',
    'TINYINT(1) NULL DEFAULT NULL AFTER `condition_severity`'
);
CALL ipawcus_add_index_if_missing_20260723(
    'boarding_observations',
    'boarding_observation_review_idx',
    'INDEX `boarding_observation_review_idx` (`requires_vet_review`, `observed_at`)'
);

-- =========================================================
-- 4. Server-side boarding material history
-- =========================================================

CREATE TABLE IF NOT EXISTS boarding_material_usages (
    usage_id INT NOT NULL AUTO_INCREMENT,
    client_reference VARCHAR(100) NULL,
    assignment_id INT NOT NULL,
    booking_id INT NOT NULL,
    pet_id INT NULL,
    item_id INT NULL,
    item_name VARCHAR(180) NOT NULL,
    category VARCHAR(100) NULL,
    unit VARCHAR(50) NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    notes TEXT NULL,
    status ENUM('recorded','voided') NOT NULL DEFAULT 'recorded',
    recorded_by_user_id INT NULL,
    recorded_by_name VARCHAR(220) NULL,
    voided_by_user_id INT NULL,
    voided_by_name VARCHAR(220) NULL,
    voided_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (usage_id),
    UNIQUE INDEX boarding_material_client_reference_unique (assignment_id, client_reference),
    INDEX boarding_material_assignment_status_idx (assignment_id, status),
    INDEX boarding_material_booking_status_idx (booking_id, status),
    INDEX boarding_material_pet_idx (pet_id),
    INDEX boarding_material_item_idx (item_id),
    INDEX boarding_material_created_idx (created_at),
    INDEX boarding_material_recorded_by_idx (recorded_by_user_id),
    INDEX boarding_material_voided_by_idx (voided_by_user_id),
    CONSTRAINT boarding_material_assignment_fk
        FOREIGN KEY (assignment_id) REFERENCES boarding_assignments (assignment_id) ON DELETE CASCADE,
    CONSTRAINT boarding_material_booking_fk
        FOREIGN KEY (booking_id) REFERENCES bookings (booking_id) ON DELETE CASCADE,
    CONSTRAINT boarding_material_pet_fk
        FOREIGN KEY (pet_id) REFERENCES pets_information (pet_id) ON DELETE SET NULL,
    CONSTRAINT boarding_material_item_fk
        FOREIGN KEY (item_id) REFERENCES inventory_items (item_id) ON DELETE SET NULL,
    CONSTRAINT boarding_material_recorded_by_fk
        FOREIGN KEY (recorded_by_user_id) REFERENCES users (user_id) ON DELETE SET NULL,
    CONSTRAINT boarding_material_voided_by_fk
        FOREIGN KEY (voided_by_user_id) REFERENCES users (user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CALL ipawcus_add_column_if_missing_20260723(
    'boarding_material_usages',
    'client_reference',
    'VARCHAR(100) NULL AFTER `usage_id`'
);
CALL ipawcus_add_index_if_missing_20260723(
    'boarding_material_usages',
    'boarding_material_client_reference_unique',
    'UNIQUE INDEX `boarding_material_client_reference_unique` (`assignment_id`, `client_reference`)'
);

-- One material usage can be billed by at most one immutable visit charge.
-- The nullable link lets legacy/non-material charges keep their current shape.
CALL ipawcus_add_column_if_missing_20260723(
    'visit_charges',
    'boarding_material_usage_id',
    'INT NULL AFTER `item_id`'
);
CALL ipawcus_add_index_if_missing_20260723(
    'visit_charges',
    'visit_charges_boarding_material_unique',
    'UNIQUE INDEX `visit_charges_boarding_material_unique` (`boarding_material_usage_id`)'
);
CALL ipawcus_add_constraint_if_missing_20260723(
    'visit_charges',
    'visit_charges_boarding_material_fk',
    'FOREIGN KEY (`boarding_material_usage_id`) REFERENCES `boarding_material_usages` (`usage_id`) ON UPDATE CASCADE ON DELETE RESTRICT'
);

-- =========================================================
-- 5. Record-update evidence and transition audit
-- =========================================================

CALL ipawcus_add_column_if_missing_20260723(
    'pet_record_update_requests',
    'baseline_snapshot_hash',
    'CHAR(64) NULL AFTER `completed_at`'
);
CALL ipawcus_add_column_if_missing_20260723(
    'pet_record_update_requests',
    'completed_snapshot_hash',
    'CHAR(64) NULL AFTER `baseline_snapshot_hash`'
);
CALL ipawcus_add_index_if_missing_20260723(
    'pet_record_update_requests',
    'record_update_baseline_hash_idx',
    'INDEX `record_update_baseline_hash_idx` (`baseline_snapshot_hash`)'
);
CALL ipawcus_add_index_if_missing_20260723(
    'pet_record_update_requests',
    'record_update_completed_hash_idx',
    'INDEX `record_update_completed_hash_idx` (`completed_snapshot_hash`)'
);

CREATE TABLE IF NOT EXISTS pet_record_update_request_events (
    event_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    request_id INT NOT NULL,
    event_type VARCHAR(40) NOT NULL,
    from_status VARCHAR(40) NULL,
    to_status VARCHAR(40) NULL,
    from_payment_status VARCHAR(40) NULL,
    to_payment_status VARCHAR(40) NULL,
    actor_user_id INT NULL,
    note TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (event_id),
    INDEX record_update_event_request_idx (request_id, created_at),
    INDEX record_update_event_actor_idx (actor_user_id),
    CONSTRAINT record_update_event_request_fk
        FOREIGN KEY (request_id) REFERENCES pet_record_update_requests (request_id) ON DELETE CASCADE,
    CONSTRAINT record_update_event_actor_fk
        FOREIGN KEY (actor_user_id) REFERENCES users (user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- =========================================================
-- 6. Visit, charge, and payment integrity
-- =========================================================

-- Align the enum only from the known repository definition. An unexpected
-- custom enum aborts instead of silently dropping values.
CALL ipawcus_align_payment_method_enum_20260723();

-- Trim references only after proving that normalization will not merge two
-- historical transactions. Blank references become NULL so nullable unique
-- semantics work as intended.
CALL ipawcus_normalize_payment_references_20260723();

CALL ipawcus_add_index_if_missing_20260723(
    'visit_charges',
    'visit_charges_created_by_idx',
    'INDEX `visit_charges_created_by_idx` (`created_by_user_id`)'
);

UPDATE visit_charges vc
LEFT JOIN users u ON u.user_id = vc.created_by_user_id
SET vc.created_by_user_id = NULL
WHERE vc.created_by_user_id IS NOT NULL
  AND u.user_id IS NULL;

CALL ipawcus_add_constraint_if_missing_20260723(
    'visit_charges',
    'visit_charges_created_by_fk',
    'FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL'
);

-- Each clinical identity should resolve to one visit. If a deployment has
-- duplicates, the key is skipped and the duplicate query in step 8 reports it.
SET @visits_booking_pet_duplicates = (
    SELECT COUNT(*)
    FROM (
        SELECT booking_id, pet_id
        FROM visits
        WHERE booking_id IS NOT NULL
        GROUP BY booking_id, pet_id
        HAVING COUNT(*) > 1
    ) duplicate_visits
);
SET @visits_booking_pet_unique_exists = (
    SELECT COUNT(*)
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'visits'
      AND index_name = 'visits_booking_pet_unique'
);
SET @ipawcus_ddl = IF(
    @visits_booking_pet_unique_exists = 0 AND @visits_booking_pet_duplicates = 0,
    'ALTER TABLE `visits` ADD UNIQUE INDEX `visits_booking_pet_unique` (`booking_id`, `pet_id`)',
    'SELECT ''visits booking/pet unique key already exists or duplicate visits require review'' AS migration_info'
);
PREPARE ipawcus_stmt FROM @ipawcus_ddl;
EXECUTE ipawcus_stmt;
DEALLOCATE PREPARE ipawcus_stmt;

SET @visits_queue_pet_duplicates = (
    SELECT COUNT(*)
    FROM (
        SELECT queue_id, pet_id
        FROM visits
        WHERE queue_id IS NOT NULL
        GROUP BY queue_id, pet_id
        HAVING COUNT(*) > 1
    ) duplicate_visits
);
SET @visits_queue_pet_unique_exists = (
    SELECT COUNT(*)
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'visits'
      AND index_name = 'visits_queue_pet_unique'
);
SET @ipawcus_ddl = IF(
    @visits_queue_pet_unique_exists = 0 AND @visits_queue_pet_duplicates = 0,
    'ALTER TABLE `visits` ADD UNIQUE INDEX `visits_queue_pet_unique` (`queue_id`, `pet_id`)',
    'SELECT ''visits queue/pet unique key already exists or duplicate visits require review'' AS migration_info'
);
PREPARE ipawcus_stmt FROM @ipawcus_ddl;
EXECUTE ipawcus_stmt;
DEALLOCATE PREPARE ipawcus_stmt;

SET @visits_diagnosis_duplicates = (
    SELECT COUNT(*)
    FROM (
        SELECT diagnosis_id
        FROM visits
        WHERE diagnosis_id IS NOT NULL
        GROUP BY diagnosis_id
        HAVING COUNT(*) > 1
    ) duplicate_visits
);
SET @visits_diagnosis_unique_exists = (
    SELECT COUNT(*)
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'visits'
      AND index_name = 'visits_diagnosis_unique'
);
SET @ipawcus_ddl = IF(
    @visits_diagnosis_unique_exists = 0 AND @visits_diagnosis_duplicates = 0,
    'ALTER TABLE `visits` ADD UNIQUE INDEX `visits_diagnosis_unique` (`diagnosis_id`)',
    'SELECT ''visits diagnosis unique key already exists or duplicate visits require review'' AS migration_info'
);
PREPARE ipawcus_stmt FROM @ipawcus_ddl;
EXECUTE ipawcus_stmt;
DEALLOCATE PREPARE ipawcus_stmt;

SET @visit_payment_reference_duplicates = (
    SELECT COUNT(*)
    FROM (
        SELECT payment_method, reference_number
        FROM visit_payments
        WHERE reference_number IS NOT NULL
        GROUP BY payment_method, reference_number
        HAVING COUNT(*) > 1
    ) duplicate_references
);
SET @visit_payment_reference_unique_exists = (
    SELECT COUNT(*)
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'visit_payments'
      AND index_name = 'visit_payments_method_reference_unique'
);
SET @ipawcus_ddl = IF(
    @visit_payment_reference_unique_exists = 0
    AND @visit_payment_reference_duplicates = 0,
    'ALTER TABLE `visit_payments` ADD UNIQUE INDEX `visit_payments_method_reference_unique` (`payment_method`, `reference_number`)',
    'SELECT ''payment reference unique key already exists or duplicate references require review'' AS migration_info'
);
PREPARE ipawcus_stmt FROM @ipawcus_ddl;
EXECUTE ipawcus_stmt;
DEALLOCATE PREPARE ipawcus_stmt;

-- =========================================================
-- 7. Supporting lookup indexes for other affected tables
-- =========================================================

CALL ipawcus_add_index_if_missing_20260723(
    'online_consultation_reschedules',
    'online_reschedule_consultation_created_idx',
    'INDEX `online_reschedule_consultation_created_idx` (`online_consultation_id`, `created_at`)'
);
CALL ipawcus_add_index_if_missing_20260723(
    'service_materials',
    'service_materials_service_item_policy_idx',
    'INDEX `service_materials_service_item_policy_idx` (`service_id`, `item_id`, `billable_policy`)'
);
CALL ipawcus_add_index_if_missing_20260723(
    'pet_owner_todos',
    'pet_owner_todos_status_end_idx',
    'INDEX `pet_owner_todos_status_end_idx` (`user_id`, `status`, `end_at`)'
);

-- =========================================================
-- 8. Strict schema-contract assertion
-- =========================================================

DELIMITER $$

CREATE PROCEDURE ipawcus_assert_backend_contract_20260723()
BEGIN
    DECLARE required_column_problem_count INT DEFAULT 0;
    DECLARE required_index_problem_count INT DEFAULT 0;
    DECLARE required_foreign_key_problem_count INT DEFAULT 0;
    DECLARE required_special_type_problem_count INT DEFAULT 0;

    SELECT COUNT(*)
    INTO required_column_problem_count
    FROM (
        SELECT 'boarding_material_usages' AS table_name, 'usage_id' AS column_name, 'int' AS data_type, 'NO' AS is_nullable
        UNION ALL SELECT 'boarding_material_usages', 'client_reference', 'varchar', 'YES'
        UNION ALL SELECT 'boarding_material_usages', 'assignment_id', 'int', 'NO'
        UNION ALL SELECT 'boarding_material_usages', 'booking_id', 'int', 'NO'
        UNION ALL SELECT 'boarding_material_usages', 'pet_id', 'int', 'YES'
        UNION ALL SELECT 'boarding_material_usages', 'item_id', 'int', 'YES'
        UNION ALL SELECT 'boarding_material_usages', 'item_name', 'varchar', 'NO'
        UNION ALL SELECT 'boarding_material_usages', 'category', 'varchar', 'YES'
        UNION ALL SELECT 'boarding_material_usages', 'unit', 'varchar', 'NO'
        UNION ALL SELECT 'boarding_material_usages', 'quantity', 'decimal', 'NO'
        UNION ALL SELECT 'boarding_material_usages', 'unit_price', 'decimal', 'NO'
        UNION ALL SELECT 'boarding_material_usages', 'notes', 'text', 'YES'
        UNION ALL SELECT 'boarding_material_usages', 'status', 'enum', 'NO'
        UNION ALL SELECT 'boarding_material_usages', 'recorded_by_user_id', 'int', 'YES'
        UNION ALL SELECT 'boarding_material_usages', 'recorded_by_name', 'varchar', 'YES'
        UNION ALL SELECT 'boarding_material_usages', 'voided_by_user_id', 'int', 'YES'
        UNION ALL SELECT 'boarding_material_usages', 'voided_by_name', 'varchar', 'YES'
        UNION ALL SELECT 'boarding_material_usages', 'voided_at', 'datetime', 'YES'
        UNION ALL SELECT 'boarding_material_usages', 'created_at', 'timestamp', 'NO'
        UNION ALL SELECT 'boarding_material_usages', 'updated_at', 'timestamp', 'NO'
        UNION ALL SELECT 'pet_record_update_request_events', 'event_id', 'bigint', 'NO'
        UNION ALL SELECT 'pet_record_update_request_events', 'request_id', 'int', 'NO'
        UNION ALL SELECT 'pet_record_update_request_events', 'event_type', 'varchar', 'NO'
        UNION ALL SELECT 'pet_record_update_request_events', 'from_status', 'varchar', 'YES'
        UNION ALL SELECT 'pet_record_update_request_events', 'to_status', 'varchar', 'YES'
        UNION ALL SELECT 'pet_record_update_request_events', 'from_payment_status', 'varchar', 'YES'
        UNION ALL SELECT 'pet_record_update_request_events', 'to_payment_status', 'varchar', 'YES'
        UNION ALL SELECT 'pet_record_update_request_events', 'actor_user_id', 'int', 'YES'
        UNION ALL SELECT 'pet_record_update_request_events', 'note', 'text', 'YES'
        UNION ALL SELECT 'pet_record_update_request_events', 'created_at', 'timestamp', 'NO'
        UNION ALL SELECT 'visit_charges', 'boarding_material_usage_id', 'int', 'YES'
    ) required_column
    LEFT JOIN information_schema.columns actual_column
        ON actual_column.table_schema = DATABASE()
       AND actual_column.table_name = required_column.table_name
       AND actual_column.column_name = required_column.column_name
    WHERE actual_column.column_name IS NULL
       OR LOWER(actual_column.data_type) <> required_column.data_type
       OR actual_column.is_nullable <> required_column.is_nullable;

    SELECT COUNT(*)
    INTO required_index_problem_count
    FROM (
        SELECT 'boarding_material_usages' AS table_name, 'PRIMARY' AS index_name, 0 AS non_unique, 'usage_id' AS column_list
        UNION ALL SELECT 'boarding_material_usages', 'boarding_material_client_reference_unique', 0, 'assignment_id,client_reference'
        UNION ALL SELECT 'pet_record_update_request_events', 'PRIMARY', 0, 'event_id'
        UNION ALL SELECT 'pet_allergies', 'pet_allergies_pet_allergen_unique', 0, 'pet_id,allergen'
        UNION ALL SELECT 'visit_charges', 'visit_charges_boarding_material_unique', 0, 'boarding_material_usage_id'
        UNION ALL SELECT 'visits', 'visits_booking_pet_unique', 0, 'booking_id,pet_id'
        UNION ALL SELECT 'visits', 'visits_queue_pet_unique', 0, 'queue_id,pet_id'
        UNION ALL SELECT 'visits', 'visits_diagnosis_unique', 0, 'diagnosis_id'
        UNION ALL SELECT 'visit_payments', 'visit_payments_method_reference_unique', 0, 'payment_method,reference_number'
    ) required_index
    LEFT JOIN (
        SELECT
            table_name,
            index_name,
            MIN(non_unique) AS non_unique,
            GROUP_CONCAT(column_name ORDER BY seq_in_index SEPARATOR ',') AS column_list
        FROM information_schema.statistics
        WHERE table_schema = DATABASE()
        GROUP BY table_name, index_name
    ) actual_index
        ON actual_index.table_name = required_index.table_name
       AND actual_index.index_name = required_index.index_name
    WHERE actual_index.index_name IS NULL
       OR actual_index.non_unique <> required_index.non_unique
       OR actual_index.column_list <> required_index.column_list;

    SELECT COUNT(*)
    INTO required_foreign_key_problem_count
    FROM (
        SELECT 'boarding_material_usages' AS table_name, 'boarding_material_assignment_fk' AS constraint_name, 'assignment_id' AS column_name, 'boarding_assignments' AS referenced_table_name, 'assignment_id' AS referenced_column_name, 'CASCADE' AS delete_rule
        UNION ALL SELECT 'boarding_material_usages', 'boarding_material_booking_fk', 'booking_id', 'bookings', 'booking_id', 'CASCADE'
        UNION ALL SELECT 'boarding_material_usages', 'boarding_material_pet_fk', 'pet_id', 'pets_information', 'pet_id', 'SET NULL'
        UNION ALL SELECT 'boarding_material_usages', 'boarding_material_item_fk', 'item_id', 'inventory_items', 'item_id', 'SET NULL'
        UNION ALL SELECT 'boarding_material_usages', 'boarding_material_recorded_by_fk', 'recorded_by_user_id', 'users', 'user_id', 'SET NULL'
        UNION ALL SELECT 'boarding_material_usages', 'boarding_material_voided_by_fk', 'voided_by_user_id', 'users', 'user_id', 'SET NULL'
        UNION ALL SELECT 'pet_record_update_request_events', 'record_update_event_request_fk', 'request_id', 'pet_record_update_requests', 'request_id', 'CASCADE'
        UNION ALL SELECT 'pet_record_update_request_events', 'record_update_event_actor_fk', 'actor_user_id', 'users', 'user_id', 'SET NULL'
        UNION ALL SELECT 'visit_charges', 'visit_charges_boarding_material_fk', 'boarding_material_usage_id', 'boarding_material_usages', 'usage_id', 'RESTRICT'
    ) required_foreign_key
    LEFT JOIN information_schema.key_column_usage actual_foreign_key
        ON actual_foreign_key.constraint_schema = DATABASE()
       AND actual_foreign_key.table_name = required_foreign_key.table_name
       AND actual_foreign_key.constraint_name = required_foreign_key.constraint_name
       AND actual_foreign_key.column_name = required_foreign_key.column_name
       AND actual_foreign_key.referenced_table_name = required_foreign_key.referenced_table_name
       AND actual_foreign_key.referenced_column_name = required_foreign_key.referenced_column_name
    LEFT JOIN information_schema.referential_constraints actual_rule
        ON actual_rule.constraint_schema = DATABASE()
       AND actual_rule.table_name = required_foreign_key.table_name
       AND actual_rule.constraint_name = required_foreign_key.constraint_name
    WHERE actual_foreign_key.constraint_name IS NULL
       OR actual_rule.constraint_name IS NULL
       OR actual_rule.delete_rule <> required_foreign_key.delete_rule;

    SELECT COUNT(*)
    INTO required_special_type_problem_count
    FROM (
        SELECT
            'boarding_material_usages' AS table_name,
            'status' AS column_name,
            'enum(''recorded'',''voided'')' AS column_type,
            'recorded' AS column_default
        UNION ALL
        SELECT
            'visit_payments',
            'payment_method',
            'enum(''cash'',''qrph'',''gcash'',''maya'',''bank_transfer'')',
            'gcash'
    ) required_type
    LEFT JOIN information_schema.columns actual_type
        ON actual_type.table_schema = DATABASE()
       AND actual_type.table_name = required_type.table_name
       AND actual_type.column_name = required_type.column_name
    WHERE actual_type.column_name IS NULL
       OR LOWER(actual_type.column_type) <> required_type.column_type
       OR TRIM(BOTH '''' FROM COALESCE(actual_type.column_default, '')) <> required_type.column_default;

    IF required_column_problem_count
        + required_index_problem_count
        + required_foreign_key_problem_count
        + required_special_type_problem_count > 0
    THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Backend schema contract is incomplete. Repair reported definitions and rerun script 01.';
    END IF;
END$$

DELIMITER ;

-- =========================================================
-- 9. Verification / manual-review output
-- =========================================================

SELECT
    pet_id,
    LOWER(TRIM(allergen)) AS normalized_allergen,
    COUNT(*) AS duplicate_count
FROM pet_allergies
GROUP BY pet_id, LOWER(TRIM(allergen))
HAVING COUNT(*) > 1;

SELECT
    booking_id,
    pet_id,
    COUNT(*) AS duplicate_count
FROM visits
WHERE booking_id IS NOT NULL
GROUP BY booking_id, pet_id
HAVING COUNT(*) > 1;

SELECT
    queue_id,
    pet_id,
    COUNT(*) AS duplicate_count
FROM visits
WHERE queue_id IS NOT NULL
GROUP BY queue_id, pet_id
HAVING COUNT(*) > 1;

SELECT
    diagnosis_id,
    COUNT(*) AS duplicate_count
FROM visits
WHERE diagnosis_id IS NOT NULL
GROUP BY diagnosis_id
HAVING COUNT(*) > 1;

SELECT
    payment_method,
    reference_number,
    COUNT(*) AS duplicate_count
FROM visit_payments
WHERE reference_number IS NOT NULL
GROUP BY payment_method, reference_number
HAVING COUNT(*) > 1;

SELECT
    table_name,
    index_name,
    non_unique
FROM information_schema.statistics
WHERE table_schema = DATABASE()
  AND (
      index_name IN (
          'pet_allergies_pet_allergen_unique',
          'boarding_material_client_reference_unique',
          'visit_charges_boarding_material_unique',
          'visits_booking_pet_unique',
          'visits_queue_pet_unique',
          'visits_diagnosis_unique',
          'visit_payments_method_reference_unique'
      )
      OR table_name IN (
          'boarding_material_usages',
          'pet_record_update_request_events'
      )
  )
ORDER BY table_name, index_name, seq_in_index;

-- This final assertion makes script 01 fail closed. In particular, duplicate
-- data cannot silently leave a required unique constraint uninstalled.
CALL ipawcus_assert_backend_contract_20260723();

DROP PROCEDURE IF EXISTS ipawcus_add_column_if_missing_20260723;
DROP PROCEDURE IF EXISTS ipawcus_add_index_if_missing_20260723;
DROP PROCEDURE IF EXISTS ipawcus_add_constraint_if_missing_20260723;
DROP PROCEDURE IF EXISTS ipawcus_assert_backend_baseline_20260723;
DROP PROCEDURE IF EXISTS ipawcus_align_payment_method_enum_20260723;
DROP PROCEDURE IF EXISTS ipawcus_normalize_payment_references_20260723;
DROP PROCEDURE IF EXISTS ipawcus_assert_backend_contract_20260723;
