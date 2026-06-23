-- Realign schema from:
--   DDL/database_ddl_20260618_034832.sql
-- to:
--   DDL/database_ddl_20260622_070744.sql
--
-- Select the target database first, then run this against the database
-- that is still on the June 18 DDL.
-- This intentionally does not alter AUTO_INCREMENT counters.

SET FOREIGN_KEY_CHECKS=0;

CREATE TABLE IF NOT EXISTS `consent_form_records` (
  `consent_record_id` int(11) NOT NULL AUTO_INCREMENT,
  `consent_file_id` int(11) DEFAULT NULL,
  `booking_id` int(11) DEFAULT NULL,
  `queue_id` int(11) DEFAULT NULL,
  `owner_user_id` int(11) DEFAULT NULL,
  `pet_id` int(11) DEFAULT NULL,
  `consent_type` varchar(120) DEFAULT NULL,
  `service_name` varchar(180) DEFAULT NULL,
  `status` enum('pending','signed','released','cancelled') NOT NULL DEFAULT 'pending',
  `signed_document_path` varchar(255) DEFAULT NULL,
  `signed_at` datetime DEFAULT NULL,
  `released_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`consent_record_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP PROCEDURE IF EXISTS `ddl_add_column_if_missing_20260622`;

DELIMITER //
CREATE PROCEDURE `ddl_add_column_if_missing_20260622`(
  IN target_table varchar(64),
  IN target_column varchar(64),
  IN column_definition text,
  IN after_clause text
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = target_table
      AND COLUMN_NAME = target_column
  ) THEN
    SET @add_column_sql = CONCAT(
      'ALTER TABLE `', REPLACE(target_table, '`', '``'), '` ',
      'ADD COLUMN `', REPLACE(target_column, '`', '``'), '` ',
      column_definition,
      ' ',
      after_clause
    );
    PREPARE add_column_stmt FROM @add_column_sql;
    EXECUTE add_column_stmt;
    DEALLOCATE PREPARE add_column_stmt;
  END IF;
END//
DELIMITER ;

CALL `ddl_add_column_if_missing_20260622`('bookings', 'consent_forms', 'longtext DEFAULT NULL', 'AFTER `signature_path`');
CALL `ddl_add_column_if_missing_20260622`('bookings', 'consent_status', 'varchar(40) DEFAULT NULL', 'AFTER `consent_forms`');

CALL `ddl_add_column_if_missing_20260622`('users', 'account_status', 'enum(''active'',''deactivated'') NOT NULL DEFAULT ''active''', 'AFTER `role`');
CALL `ddl_add_column_if_missing_20260622`('users', 'deactivated_at', 'datetime DEFAULT NULL', 'AFTER `account_status`');
CALL `ddl_add_column_if_missing_20260622`('users', 'deactivation_reason', 'text DEFAULT NULL', 'AFTER `deactivated_at`');
CALL `ddl_add_column_if_missing_20260622`('users', 'last_seen_at', 'datetime DEFAULT NULL', 'AFTER `created_at`');

DROP PROCEDURE IF EXISTS `ddl_add_column_if_missing_20260622`;

SET FOREIGN_KEY_CHECKS=1;
