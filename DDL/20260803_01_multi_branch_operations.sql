-- iPawcus multi-branch operations migration
-- Target: MariaDB 10.4+ / MySQL-compatible servers
-- Created: 2026-08-03
--
-- IMPORTANT
-- 1. Select the deployed iPawcus database before importing this file.
-- 2. Take a full database backup and pause application writes.
-- 3. Apply DDL/20260729_deployment_required_new.sql first.
-- 4. Deploy the matching application files only after this migration succeeds.
--
-- Safe to rerun. Existing bookings, queues, visits, rooms, staff assignments,
-- inventory locations, and notifications are assigned to the Main Clinic.

SELECT DATABASE() AS selected_database, VERSION() AS database_version;

DROP PROCEDURE IF EXISTS ipawcus_mb_add_column;
DROP PROCEDURE IF EXISTS ipawcus_mb_add_index;
DROP PROCEDURE IF EXISTS ipawcus_mb_add_constraint;
DROP PROCEDURE IF EXISTS ipawcus_mb_drop_index;
DROP PROCEDURE IF EXISTS ipawcus_mb_assert_baseline;

DELIMITER $$

CREATE PROCEDURE ipawcus_mb_assert_baseline()
BEGIN
    DECLARE missing_count INT DEFAULT 0;

    SELECT COUNT(*) INTO missing_count
    FROM (
        SELECT 'users' AS table_name
        UNION ALL SELECT 'bookings'
        UNION ALL SELECT 'queues'
        UNION ALL SELECT 'visits'
        UNION ALL SELECT 'rooms'
        UNION ALL SELECT 'room_unit_statuses'
        UNION ALL SELECT 'boarding_assignments'
        UNION ALL SELECT 'inventory_locations'
        UNION ALL SELECT 'inventory_items'
        UNION ALL SELECT 'inventory_batches'
        UNION ALL SELECT 'inventory_stock_movements'
        UNION ALL SELECT 'inventory_stock_receipts'
        UNION ALL SELECT 'user_notifications'
        UNION ALL SELECT 'pet_record_update_requests'
    ) required
    LEFT JOIN information_schema.tables existing_table
      ON existing_table.table_schema = DATABASE()
     AND existing_table.table_name = required.table_name
    WHERE existing_table.table_name IS NULL;

    IF missing_count > 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Required iPawcus tables are missing. Apply the current baseline and 20260729 deployment migration first.';
    END IF;
END$$

CREATE PROCEDURE ipawcus_mb_add_column(
    IN p_table_name VARCHAR(64),
    IN p_column_name VARCHAR(64),
    IN p_definition TEXT
)
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = p_table_name
          AND column_name = p_column_name
    ) THEN
        SET @mb_sql = CONCAT('ALTER TABLE `', REPLACE(p_table_name, '`', '``'),
            '` ADD COLUMN `', REPLACE(p_column_name, '`', '``'), '` ', p_definition);
        PREPARE mb_stmt FROM @mb_sql;
        EXECUTE mb_stmt;
        DEALLOCATE PREPARE mb_stmt;
    END IF;
END$$

CREATE PROCEDURE ipawcus_mb_add_index(
    IN p_table_name VARCHAR(64),
    IN p_index_name VARCHAR(64),
    IN p_definition TEXT
)
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.statistics
        WHERE table_schema = DATABASE()
          AND table_name = p_table_name
          AND index_name = p_index_name
    ) THEN
        SET @mb_sql = CONCAT('ALTER TABLE `', REPLACE(p_table_name, '`', '``'),
            '` ADD ', p_definition);
        PREPARE mb_stmt FROM @mb_sql;
        EXECUTE mb_stmt;
        DEALLOCATE PREPARE mb_stmt;
    END IF;
END$$

CREATE PROCEDURE ipawcus_mb_add_constraint(
    IN p_table_name VARCHAR(64),
    IN p_constraint_name VARCHAR(64),
    IN p_definition TEXT
)
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_schema = DATABASE()
          AND table_name = p_table_name
          AND constraint_name = p_constraint_name
    ) THEN
        SET @mb_sql = CONCAT('ALTER TABLE `', REPLACE(p_table_name, '`', '``'),
            '` ADD CONSTRAINT `', REPLACE(p_constraint_name, '`', '``'), '` ', p_definition);
        PREPARE mb_stmt FROM @mb_sql;
        EXECUTE mb_stmt;
        DEALLOCATE PREPARE mb_stmt;
    END IF;
END$$

CREATE PROCEDURE ipawcus_mb_drop_index(
    IN p_table_name VARCHAR(64),
    IN p_index_name VARCHAR(64)
)
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.statistics
        WHERE table_schema = DATABASE()
          AND table_name = p_table_name
          AND index_name = p_index_name
    ) THEN
        SET @mb_sql = CONCAT('ALTER TABLE `', REPLACE(p_table_name, '`', '``'),
            '` DROP INDEX `', REPLACE(p_index_name, '`', '``'), '`');
        PREPARE mb_stmt FROM @mb_sql;
        EXECUTE mb_stmt;
        DEALLOCATE PREPARE mb_stmt;
    END IF;
END$$

DELIMITER ;

CALL ipawcus_mb_assert_baseline();

-- -------------------------------------------------------------------------
-- Branch master, hours, closures, and service availability
-- -------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS branches (
    branch_id INT NOT NULL AUTO_INCREMENT,
    branch_code VARCHAR(40) NOT NULL,
    branch_name VARCHAR(180) NOT NULL,
    branch_type ENUM('main_clinic', 'pet_corner') NOT NULL,
    address TEXT NOT NULL,
    phone_number VARCHAR(100) DEFAULT NULL,
    map_url VARCHAR(500) DEFAULT NULL,
    is_main TINYINT(1) NOT NULL DEFAULT 0,
    status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (branch_id),
    UNIQUE KEY branches_code_unique (branch_code),
    KEY branches_status_idx (status, branch_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO branches
    (branch_code, branch_name, branch_type, address, phone_number, is_main, status)
VALUES
    ('MAIN', 'VFC Pharmacy / Main Clinic', 'main_clinic',
     'Oakbrook Avenue corner Clayton Street, Phase 3, Pleasantville Subdivision, Barangay Ilayang Iyam, Lucena City, Quezon 4301, Philippines',
     '(042) 421-9086 / 0933 476 8522', 1, 'active'),
    ('ISABANG', 'VFC Pet Corner Isabang', 'pet_corner',
     '1229 Unit 8, Maharlika Highway, Isabang, Lucena City, Quezon 4301, Philippines',
     NULL, 0, 'active'),
    ('ENRIQUEZ', 'VFC Pet Corner Main Enriquez St.', 'pet_corner',
     'Enriquez St. corner Barcelona St., Barangay 2, Lucena City, Quezon 4301, Philippines',
     NULL, 0, 'active'),
    ('GULANG_GULANG', 'VFC Pet Corner Gulang-Gulang', 'pet_corner',
     'Doña Aurora Blvd., Purok Pagkakaisa, Gulang-Gulang, Lucena City, Quezon 4301, Philippines',
     NULL, 0, 'active'),
    ('MAYAO', 'VFC Pet Corner Mayao', 'pet_corner',
     'Mayao Kanluran, Lucena City, Quezon 4301, Philippines',
     NULL, 0, 'active')
ON DUPLICATE KEY UPDATE
    branch_name = VALUES(branch_name),
    branch_type = VALUES(branch_type),
    address = VALUES(address),
    phone_number = COALESCE(VALUES(phone_number), phone_number),
    is_main = VALUES(is_main),
    status = VALUES(status);

SET @ipawcus_main_branch_id = (
    SELECT branch_id FROM branches WHERE branch_code = 'MAIN' LIMIT 1
);

CREATE TABLE IF NOT EXISTS branch_operating_hours (
    operating_hour_id INT NOT NULL AUTO_INCREMENT,
    branch_id INT NOT NULL,
    day_of_week TINYINT UNSIGNED NOT NULL COMMENT '1=Monday through 7=Sunday',
    opens_at TIME DEFAULT NULL,
    closes_at TIME DEFAULT NULL,
    is_closed TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (operating_hour_id),
    UNIQUE KEY branch_operating_hours_unique (branch_id, day_of_week),
    CONSTRAINT branch_operating_hours_branch_fk FOREIGN KEY (branch_id)
        REFERENCES branches(branch_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO branch_operating_hours (branch_id, day_of_week, opens_at, closes_at, is_closed)
SELECT
    b.branch_id,
    days.day_of_week,
    CASE WHEN days.day_of_week = 7 THEN NULL ELSE '08:00:00' END,
    CASE WHEN days.day_of_week = 7 THEN NULL ELSE '18:00:00' END,
    CASE WHEN days.day_of_week = 7 THEN 1 ELSE 0 END
FROM branches b
CROSS JOIN (
    SELECT 1 AS day_of_week UNION ALL SELECT 2 UNION ALL SELECT 3
    UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7
) days
WHERE b.status = 'active'
ON DUPLICATE KEY UPDATE
    opens_at = VALUES(opens_at),
    closes_at = VALUES(closes_at),
    is_closed = VALUES(is_closed);

CREATE TABLE IF NOT EXISTS branch_closures (
    closure_id INT NOT NULL AUTO_INCREMENT,
    branch_id INT NOT NULL,
    closure_date DATE NOT NULL,
    reason VARCHAR(255) DEFAULT NULL,
    created_by_user_id INT DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (closure_id),
    UNIQUE KEY branch_closure_unique (branch_id, closure_date),
    CONSTRAINT branch_closures_branch_fk FOREIGN KEY (branch_id)
        REFERENCES branches(branch_id) ON DELETE CASCADE,
    CONSTRAINT branch_closures_user_fk FOREIGN KEY (created_by_user_id)
        REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS branch_service_availability (
    branch_service_id INT NOT NULL AUTO_INCREMENT,
    branch_id INT NOT NULL,
    service_key VARCHAR(80) NOT NULL,
    service_label VARCHAR(150) NOT NULL,
    availability_mode ENUM('always', 'vet_visit') NOT NULL DEFAULT 'always',
    booking_enabled TINYINT(1) NOT NULL DEFAULT 1,
    queue_enabled TINYINT(1) NOT NULL DEFAULT 1,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (branch_service_id),
    UNIQUE KEY branch_service_unique (branch_id, service_key),
    KEY branch_service_lookup_idx (service_key, is_active),
    CONSTRAINT branch_service_branch_fk FOREIGN KEY (branch_id)
        REFERENCES branches(branch_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Main-only services and services available at every location.
INSERT INTO branch_service_availability
    (branch_id, service_key, service_label, availability_mode, booking_enabled, queue_enabled, is_active)
SELECT b.branch_id, service.service_key, service.service_label,
       CASE
           WHEN b.branch_type = 'pet_corner'
                AND service.service_key IN ('vaccination', 'lab-testing', 'parasite-control')
               THEN 'vet_visit'
           ELSE 'always'
       END,
       1, 1, 1
FROM branches b
JOIN (
    SELECT 'vaccination' AS service_key, 'Vaccination' AS service_label
    UNION ALL SELECT 'grooming', 'Grooming'
    UNION ALL SELECT 'boarding', 'Pet Hotel and Kennel Boarding'
    UNION ALL SELECT 'lab-testing', 'Laboratory Testing'
    UNION ALL SELECT 'parasite-control', 'Parasite Control'
) service
WHERE b.status = 'active'
ON DUPLICATE KEY UPDATE
    service_label = VALUES(service_label),
    availability_mode = VALUES(availability_mode),
    booking_enabled = VALUES(booking_enabled),
    queue_enabled = VALUES(queue_enabled),
    is_active = VALUES(is_active);

INSERT INTO branch_service_availability
    (branch_id, service_key, service_label, availability_mode, booking_enabled, queue_enabled, is_active)
SELECT @ipawcus_main_branch_id, service_key, service_label, 'always', 1, 1, 1
FROM (
    SELECT 'General Check-up' AS service_key, 'General Check-up' AS service_label
    UNION ALL SELECT 'consultation', 'Online Consultation'
    UNION ALL SELECT 'home-service', 'Home Service'
    UNION ALL SELECT 'dental', 'Dental Check-up'
    UNION ALL SELECT 'surgery', 'Surgery'
    UNION ALL SELECT 'kapon', 'Kapon'
    UNION ALL SELECT 'special services', 'Special Services'
) main_service
ON DUPLICATE KEY UPDATE
    service_label = VALUES(service_label),
    availability_mode = VALUES(availability_mode),
    booking_enabled = VALUES(booking_enabled),
    queue_enabled = VALUES(queue_enabled),
    is_active = VALUES(is_active);

-- -------------------------------------------------------------------------
-- Staff branch assignment and veterinarian visit schedule
-- -------------------------------------------------------------------------

CALL ipawcus_mb_add_column('users', 'preferred_branch_id', 'INT NULL AFTER `birthdate`');

UPDATE users
SET preferred_branch_id = @ipawcus_main_branch_id
WHERE preferred_branch_id IS NULL
  AND LOWER(REPLACE(REPLACE(TRIM(role), ' ', '_'), '-', '_')) IN
      ('admin', 'veterinarian', 'super_admin', 'superadmin');

CALL ipawcus_mb_add_index('users', 'users_preferred_branch_idx',
    'INDEX `users_preferred_branch_idx` (`preferred_branch_id`)');
CALL ipawcus_mb_add_constraint('users', 'users_preferred_branch_fk',
    'FOREIGN KEY (`preferred_branch_id`) REFERENCES `branches` (`branch_id`) ON DELETE SET NULL');

CREATE TABLE IF NOT EXISTS user_branch_assignments (
    user_branch_assignment_id INT NOT NULL AUTO_INCREMENT,
    user_id INT NOT NULL,
    branch_id INT NOT NULL,
    is_primary TINYINT(1) NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    assigned_by_user_id INT DEFAULT NULL,
    assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME DEFAULT NULL,
    PRIMARY KEY (user_branch_assignment_id),
    UNIQUE KEY user_branch_assignment_unique (user_id, branch_id),
    KEY user_branch_assignment_scope_idx (branch_id, is_active, user_id),
    CONSTRAINT user_branch_assignment_user_fk FOREIGN KEY (user_id)
        REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT user_branch_assignment_branch_fk FOREIGN KEY (branch_id)
        REFERENCES branches(branch_id) ON DELETE CASCADE,
    CONSTRAINT user_branch_assignment_actor_fk FOREIGN KEY (assigned_by_user_id)
        REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO user_branch_assignments (user_id, branch_id, is_primary, is_active)
SELECT u.user_id, COALESCE(u.preferred_branch_id, @ipawcus_main_branch_id), 1, 1
FROM users u
WHERE LOWER(REPLACE(REPLACE(TRIM(u.role), ' ', '_'), '-', '_')) IN
      ('admin', 'veterinarian', 'super_admin', 'superadmin')
  AND NOT EXISTS (
      SELECT 1
      FROM user_branch_assignments existing_assignment
      WHERE existing_assignment.user_id = u.user_id
        AND existing_assignment.is_active = 1
  )
ON DUPLICATE KEY UPDATE
    is_primary = VALUES(is_primary),
    is_active = VALUES(is_active),
    ended_at = NULL;

CREATE TABLE IF NOT EXISTS veterinarian_branch_schedules (
    visit_schedule_id INT NOT NULL AUTO_INCREMENT,
    veterinarian_user_id INT NOT NULL,
    branch_id INT NOT NULL,
    starts_at DATETIME NOT NULL,
    ends_at DATETIME NOT NULL,
    service_keys LONGTEXT DEFAULT NULL,
    appointment_capacity SMALLINT UNSIGNED DEFAULT NULL,
    notes TEXT DEFAULT NULL,
    status ENUM('published', 'cancelled', 'completed') NOT NULL DEFAULT 'published',
    created_by_user_id INT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (visit_schedule_id),
    KEY vet_branch_schedule_lookup_idx (branch_id, starts_at, ends_at, status),
    KEY vet_branch_schedule_vet_idx (veterinarian_user_id, starts_at, ends_at, status),
    CONSTRAINT vet_branch_schedule_vet_fk FOREIGN KEY (veterinarian_user_id)
        REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT vet_branch_schedule_branch_fk FOREIGN KEY (branch_id)
        REFERENCES branches(branch_id) ON DELETE CASCADE,
    CONSTRAINT vet_branch_schedule_creator_fk FOREIGN KEY (created_by_user_id)
        REFERENCES users(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- -------------------------------------------------------------------------
-- Branch ownership of operational records
-- -------------------------------------------------------------------------

CALL ipawcus_mb_add_column('bookings', 'branch_id', 'INT NULL AFTER `booking_number`');
CALL ipawcus_mb_add_column('bookings', 'original_branch_id', 'INT NULL AFTER `branch_id`');
UPDATE bookings
SET branch_id = COALESCE(branch_id, @ipawcus_main_branch_id),
    original_branch_id = COALESCE(original_branch_id, branch_id, @ipawcus_main_branch_id);
ALTER TABLE bookings MODIFY COLUMN branch_id INT NOT NULL;
CALL ipawcus_mb_add_index('bookings', 'bookings_branch_status_date_idx',
    'INDEX `bookings_branch_status_date_idx` (`branch_id`, `status`, `booking_date`, `booking_time`)');
CALL ipawcus_mb_add_constraint('bookings', 'bookings_branch_fk',
    'FOREIGN KEY (`branch_id`) REFERENCES `branches` (`branch_id`)');
CALL ipawcus_mb_add_constraint('bookings', 'bookings_original_branch_fk',
    'FOREIGN KEY (`original_branch_id`) REFERENCES `branches` (`branch_id`)');

CREATE TABLE IF NOT EXISTS booking_branch_transfers (
    transfer_id INT NOT NULL AUTO_INCREMENT,
    booking_id INT NOT NULL,
    from_branch_id INT NOT NULL,
    to_branch_id INT NOT NULL,
    transferred_by_user_id INT NOT NULL,
    reason VARCHAR(500) DEFAULT NULL,
    payment_review_required TINYINT(1) NOT NULL DEFAULT 0,
    transferred_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (transfer_id),
    KEY booking_branch_transfer_booking_idx (booking_id, transferred_at),
    CONSTRAINT booking_branch_transfer_booking_fk FOREIGN KEY (booking_id)
        REFERENCES bookings(booking_id) ON DELETE CASCADE,
    CONSTRAINT booking_branch_transfer_from_fk FOREIGN KEY (from_branch_id)
        REFERENCES branches(branch_id),
    CONSTRAINT booking_branch_transfer_to_fk FOREIGN KEY (to_branch_id)
        REFERENCES branches(branch_id),
    CONSTRAINT booking_branch_transfer_actor_fk FOREIGN KEY (transferred_by_user_id)
        REFERENCES users(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CALL ipawcus_mb_add_column('queues', 'branch_id', 'INT NULL AFTER `booking_id`');
CALL ipawcus_mb_add_column('queues', 'queue_date', 'DATE NULL AFTER `queue_number`');
UPDATE queues q
LEFT JOIN bookings b ON b.booking_id = q.booking_id
SET q.branch_id = COALESCE(q.branch_id, b.branch_id, @ipawcus_main_branch_id),
    q.queue_date = COALESCE(q.queue_date, DATE(q.timestamp));
ALTER TABLE queues MODIFY COLUMN branch_id INT NOT NULL;
ALTER TABLE queues MODIFY COLUMN queue_date DATE NOT NULL;
CALL ipawcus_mb_add_index('queues', 'queues_branch_day_number_idx',
    'INDEX `queues_branch_day_number_idx` (`branch_id`, `queue_date`, `queue_number`)');
CALL ipawcus_mb_add_index('queues', 'queues_branch_status_idx',
    'INDEX `queues_branch_status_idx` (`branch_id`, `status`, `priority`, `timestamp`)');
CALL ipawcus_mb_add_constraint('queues', 'queues_branch_fk',
    'FOREIGN KEY (`branch_id`) REFERENCES `branches` (`branch_id`)');

CALL ipawcus_mb_add_column('visits', 'branch_id', 'INT NULL AFTER `visit_id`');
UPDATE visits v
LEFT JOIN bookings b ON b.booking_id = v.booking_id
LEFT JOIN queues q ON q.queue_id = v.queue_id
SET v.branch_id = COALESCE(v.branch_id, b.branch_id, q.branch_id, @ipawcus_main_branch_id);
ALTER TABLE visits MODIFY COLUMN branch_id INT NOT NULL;
CALL ipawcus_mb_add_index('visits', 'visits_branch_status_idx',
    'INDEX `visits_branch_status_idx` (`branch_id`, `visit_status`, `created_at`)');
CALL ipawcus_mb_add_constraint('visits', 'visits_branch_fk',
    'FOREIGN KEY (`branch_id`) REFERENCES `branches` (`branch_id`)');

CALL ipawcus_mb_add_column('pet_record_update_requests', 'branch_id', 'INT NULL AFTER `request_number`');
UPDATE pet_record_update_requests
SET branch_id = COALESCE(branch_id, @ipawcus_main_branch_id);
ALTER TABLE pet_record_update_requests MODIFY COLUMN branch_id INT NOT NULL;
CALL ipawcus_mb_add_index('pet_record_update_requests', 'record_requests_branch_status_idx',
    'INDEX `record_requests_branch_status_idx` (`branch_id`, `status`, `created_at`)');
CALL ipawcus_mb_add_constraint('pet_record_update_requests', 'record_requests_branch_fk',
    'FOREIGN KEY (`branch_id`) REFERENCES `branches` (`branch_id`)');

CALL ipawcus_mb_add_column('user_notifications', 'branch_id', 'INT NULL AFTER `user_id`');
CALL ipawcus_mb_add_index('user_notifications', 'user_notifications_branch_idx',
    'INDEX `user_notifications_branch_idx` (`branch_id`, `created_at`)');
CALL ipawcus_mb_add_constraint('user_notifications', 'user_notifications_branch_fk',
    'FOREIGN KEY (`branch_id`) REFERENCES `branches` (`branch_id`) ON DELETE SET NULL');

-- -------------------------------------------------------------------------
-- Branch rooms. Retired is the safe delete state; historical assignments stay.
-- -------------------------------------------------------------------------

CALL ipawcus_mb_add_column('rooms', 'branch_id', 'INT NULL AFTER `room_id`');
UPDATE rooms SET branch_id = COALESCE(branch_id, @ipawcus_main_branch_id);
ALTER TABLE rooms MODIFY COLUMN branch_id INT NOT NULL;
CALL ipawcus_mb_add_index('rooms', 'rooms_branch_type_unique',
    'UNIQUE INDEX `rooms_branch_type_unique` (`branch_id`, `room_type`)');
CALL ipawcus_mb_add_constraint('rooms', 'rooms_branch_fk',
    'FOREIGN KEY (`branch_id`) REFERENCES `branches` (`branch_id`)');

INSERT INTO rooms (branch_id, room_type, total_capacity, description)
SELECT b.branch_id, room_type.room_type, 1,
       CONCAT('Initial ', REPLACE(room_type.room_type, '-', ' '), ' capacity for ', b.branch_name)
FROM branches b
CROSS JOIN (
    SELECT 'hotel-small' AS room_type
    UNION ALL SELECT 'hotel-medium'
    UNION ALL SELECT 'hotel-large'
    UNION ALL SELECT 'boarding-small'
    UNION ALL SELECT 'boarding-medium'
    UNION ALL SELECT 'boarding-large'
) room_type
WHERE b.status = 'active'
ON DUPLICATE KEY UPDATE total_capacity = GREATEST(total_capacity, 1);

CALL ipawcus_mb_add_column('room_unit_statuses', 'branch_id', 'INT NULL AFTER `room_unit_status_id`');
UPDATE room_unit_statuses SET branch_id = COALESCE(branch_id, @ipawcus_main_branch_id);
ALTER TABLE room_unit_statuses MODIFY COLUMN branch_id INT NOT NULL;
ALTER TABLE room_unit_statuses
    MODIFY COLUMN status ENUM('available', 'maintenance', 'retired') NOT NULL DEFAULT 'available';
CALL ipawcus_mb_add_index('room_unit_statuses', 'room_unit_status_branch_support_idx',
    'INDEX `room_unit_status_branch_support_idx` (`branch_id`, `room_type`, `room_number`)');
CALL ipawcus_mb_drop_index('room_unit_statuses', 'room_unit_status_unique');
CALL ipawcus_mb_add_index('room_unit_statuses', 'room_unit_status_branch_unique',
    'UNIQUE INDEX `room_unit_status_branch_unique` (`branch_id`, `room_type`, `room_number`)');
CALL ipawcus_mb_add_constraint('room_unit_statuses', 'room_unit_status_branch_fk',
    'FOREIGN KEY (`branch_id`) REFERENCES `branches` (`branch_id`)');

INSERT INTO room_unit_statuses (branch_id, room_type, room_number, status, notes)
SELECT r.branch_id, r.room_type, numbers.room_number, 'available', 'Initial branch room/kennel unit'
FROM rooms r
JOIN (SELECT 1 AS room_number) numbers
WHERE r.total_capacity >= numbers.room_number
ON DUPLICATE KEY UPDATE status = room_unit_statuses.status;

CALL ipawcus_mb_add_column('boarding_assignments', 'branch_id', 'INT NULL AFTER `booking_id`');
UPDATE boarding_assignments ba
JOIN bookings b ON b.booking_id = ba.booking_id
SET ba.branch_id = COALESCE(ba.branch_id, b.branch_id, @ipawcus_main_branch_id);
ALTER TABLE boarding_assignments MODIFY COLUMN branch_id INT NOT NULL;
CALL ipawcus_mb_add_index('boarding_assignments', 'boarding_assignment_branch_room_idx',
    'INDEX `boarding_assignment_branch_room_idx` (`branch_id`, `room_type`, `room_number`, `status`)');
CALL ipawcus_mb_add_constraint('boarding_assignments', 'boarding_assignment_branch_fk',
    'FOREIGN KEY (`branch_id`) REFERENCES `branches` (`branch_id`)');

-- -------------------------------------------------------------------------
-- Central item catalog with branch-local inventory batches
-- -------------------------------------------------------------------------

CALL ipawcus_mb_add_column('inventory_locations', 'branch_id', 'INT NULL AFTER `location_id`');
UPDATE inventory_locations SET branch_id = COALESCE(branch_id, @ipawcus_main_branch_id);
ALTER TABLE inventory_locations MODIFY COLUMN branch_id INT NOT NULL;
CALL ipawcus_mb_add_index('inventory_locations', 'inventory_locations_branch_idx',
    'INDEX `inventory_locations_branch_idx` (`branch_id`, `status`)');
CALL ipawcus_mb_add_constraint('inventory_locations', 'inventory_locations_branch_fk',
    'FOREIGN KEY (`branch_id`) REFERENCES `branches` (`branch_id`)');

INSERT INTO inventory_locations (branch_id, location_name, location_type, address, status)
SELECT b.branch_id, CONCAT(b.branch_name, ' - Main Stock'), 'branch', b.address, 'active'
FROM branches b
WHERE b.status = 'active'
  AND NOT EXISTS (
      SELECT 1 FROM inventory_locations il
      WHERE il.branch_id = b.branch_id AND il.status = 'active'
  );

CALL ipawcus_mb_add_index('inventory_batches', 'inventory_batches_item_support_idx',
    'INDEX `inventory_batches_item_support_idx` (`item_id`)');
CALL ipawcus_mb_drop_index('inventory_batches', 'item_id');
CALL ipawcus_mb_add_index('inventory_batches', 'inventory_batch_location_unique',
    'UNIQUE INDEX `inventory_batch_location_unique` (`item_id`, `batch_number`, `location_id`)');

CALL ipawcus_mb_add_column('inventory_stock_movements', 'location_id', 'INT NULL AFTER `batch_id`');
UPDATE inventory_stock_movements movement
LEFT JOIN inventory_batches batch ON batch.batch_id = movement.batch_id
LEFT JOIN inventory_items item ON item.item_id = movement.item_id
SET movement.location_id = COALESCE(movement.location_id, batch.location_id, item.location_id);
CALL ipawcus_mb_add_index('inventory_stock_movements', 'inventory_movements_location_idx',
    'INDEX `inventory_movements_location_idx` (`location_id`, `created_at`)');
CALL ipawcus_mb_add_constraint('inventory_stock_movements', 'inventory_movements_location_fk',
    'FOREIGN KEY (`location_id`) REFERENCES `inventory_locations` (`location_id`)');

CALL ipawcus_mb_add_column('inventory_stock_receipts', 'branch_id', 'INT NULL AFTER `receipt_id`');
UPDATE inventory_stock_receipts receipt
LEFT JOIN inventory_stock_receipt_items receipt_item ON receipt_item.receipt_id = receipt.receipt_id
LEFT JOIN inventory_locations location ON location.location_id = receipt_item.location_id
SET receipt.branch_id = COALESCE(receipt.branch_id, location.branch_id, @ipawcus_main_branch_id);
ALTER TABLE inventory_stock_receipts MODIFY COLUMN branch_id INT NOT NULL;
CALL ipawcus_mb_add_index('inventory_stock_receipts', 'inventory_receipts_branch_idx',
    'INDEX `inventory_receipts_branch_idx` (`branch_id`, `receiving_date`)');
CALL ipawcus_mb_add_constraint('inventory_stock_receipts', 'inventory_receipts_branch_fk',
    'FOREIGN KEY (`branch_id`) REFERENCES `branches` (`branch_id`)');

CREATE TABLE IF NOT EXISTS inventory_transfers (
    inventory_transfer_id INT NOT NULL AUTO_INCREMENT,
    transfer_number VARCHAR(40) NOT NULL,
    from_location_id INT NOT NULL,
    to_location_id INT NOT NULL,
    status ENUM('draft', 'in_transit', 'received', 'cancelled') NOT NULL DEFAULT 'draft',
    notes TEXT DEFAULT NULL,
    created_by_user_id INT NOT NULL,
    received_by_user_id INT DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    received_at DATETIME DEFAULT NULL,
    PRIMARY KEY (inventory_transfer_id),
    UNIQUE KEY inventory_transfer_number_unique (transfer_number),
    CONSTRAINT inventory_transfer_from_fk FOREIGN KEY (from_location_id)
        REFERENCES inventory_locations(location_id),
    CONSTRAINT inventory_transfer_to_fk FOREIGN KEY (to_location_id)
        REFERENCES inventory_locations(location_id),
    CONSTRAINT inventory_transfer_creator_fk FOREIGN KEY (created_by_user_id)
        REFERENCES users(user_id),
    CONSTRAINT inventory_transfer_receiver_fk FOREIGN KEY (received_by_user_id)
        REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS inventory_transfer_items (
    inventory_transfer_item_id INT NOT NULL AUTO_INCREMENT,
    inventory_transfer_id INT NOT NULL,
    item_id INT NOT NULL,
    source_batch_id INT NOT NULL,
    quantity INT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (inventory_transfer_item_id),
    KEY inventory_transfer_items_transfer_idx (inventory_transfer_id),
    CONSTRAINT inventory_transfer_items_transfer_fk FOREIGN KEY (inventory_transfer_id)
        REFERENCES inventory_transfers(inventory_transfer_id) ON DELETE CASCADE,
    CONSTRAINT inventory_transfer_items_item_fk FOREIGN KEY (item_id)
        REFERENCES inventory_items(item_id),
    CONSTRAINT inventory_transfer_items_batch_fk FOREIGN KEY (source_batch_id)
        REFERENCES inventory_batches(batch_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- -------------------------------------------------------------------------
-- Verification output
-- -------------------------------------------------------------------------

SELECT branch_id, branch_code, branch_name, branch_type, address, is_main, status
FROM branches
ORDER BY is_main DESC, branch_name;

SELECT b.branch_code, COUNT(r.room_id) AS configured_room_types,
       SUM(r.total_capacity) AS configured_units
FROM branches b
LEFT JOIN rooms r ON r.branch_id = b.branch_id
GROUP BY b.branch_id, b.branch_code
ORDER BY b.is_main DESC, b.branch_name;

SELECT b.branch_code, bsa.service_key, bsa.availability_mode
FROM branch_service_availability bsa
JOIN branches b ON b.branch_id = bsa.branch_id
WHERE bsa.is_active = 1
ORDER BY b.is_main DESC, b.branch_name, bsa.service_key;

SELECT
    (SELECT COUNT(*) FROM bookings WHERE branch_id IS NULL) AS bookings_without_branch,
    (SELECT COUNT(*) FROM queues WHERE branch_id IS NULL) AS queues_without_branch,
    (SELECT COUNT(*) FROM visits WHERE branch_id IS NULL) AS visits_without_branch,
    (SELECT COUNT(*) FROM boarding_assignments WHERE branch_id IS NULL) AS boarding_assignments_without_branch;

DROP PROCEDURE IF EXISTS ipawcus_mb_add_column;
DROP PROCEDURE IF EXISTS ipawcus_mb_add_index;
DROP PROCEDURE IF EXISTS ipawcus_mb_add_constraint;
DROP PROCEDURE IF EXISTS ipawcus_mb_drop_index;
DROP PROCEDURE IF EXISTS ipawcus_mb_assert_baseline;

-- End of 20260803 multi-branch migration.
