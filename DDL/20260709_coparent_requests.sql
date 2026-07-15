-- Co-parent approval workflow.
-- Run this once on environments where pet co-parent approvals are enabled.

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
