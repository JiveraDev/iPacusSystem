-- Email verification and password reset OTP support.
-- Run this once before enabling registration verification or forgot-password flows.

SET @users_email_verified_column_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'users'
    AND column_name = 'email_verified_at'
);
SET @users_email_verified_column_sql = IF(
  @users_email_verified_column_exists = 0,
  'ALTER TABLE `users` ADD COLUMN `email_verified_at` datetime DEFAULT NULL AFTER `mail_Address`',
  'SELECT ''users.email_verified_at already exists'' AS message'
);
PREPARE users_email_verified_column_stmt FROM @users_email_verified_column_sql;
EXECUTE users_email_verified_column_stmt;
DEALLOCATE PREPARE users_email_verified_column_stmt;

SET @users_email_verified_backfill_sql = IF(
  @users_email_verified_column_exists = 0,
  'UPDATE `users` SET `email_verified_at` = COALESCE(`created_at`, NOW()) WHERE `email_verified_at` IS NULL',
  'SELECT ''users.email_verified_at backfill skipped because column already existed'' AS message'
);
PREPARE users_email_verified_backfill_stmt FROM @users_email_verified_backfill_sql;
EXECUTE users_email_verified_backfill_stmt;
DEALLOCATE PREPARE users_email_verified_backfill_stmt;

SET @users_password_changed_column_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'users'
    AND column_name = 'password_changed_at'
);
SET @users_password_changed_column_sql = IF(
  @users_password_changed_column_exists = 0,
  'ALTER TABLE `users` ADD COLUMN `password_changed_at` datetime DEFAULT NULL AFTER `user_password`',
  'SELECT ''users.password_changed_at already exists'' AS message'
);
PREPARE users_password_changed_column_stmt FROM @users_password_changed_column_sql;
EXECUTE users_password_changed_column_stmt;
DEALLOCATE PREPARE users_password_changed_column_stmt;

CREATE TABLE IF NOT EXISTS `email_otp_tokens` (
  `otp_id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) DEFAULT NULL,
  `email` varchar(200) NOT NULL,
  `purpose` enum('email_verification','password_reset','password_change') NOT NULL,
  `token_hash` char(64) NOT NULL,
  `expires_at` datetime NOT NULL,
  `used_at` datetime DEFAULT NULL,
  `attempt_count` int(11) NOT NULL DEFAULT 0,
  `max_attempts` int(11) NOT NULL DEFAULT 5,
  `last_sent_at` datetime DEFAULT NULL,
  `request_ip` varchar(45) DEFAULT NULL,
  `user_agent` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`otp_id`),
  KEY `email_otp_user_purpose_idx` (`user_id`, `purpose`, `expires_at`),
  KEY `email_otp_email_purpose_idx` (`email`, `purpose`, `expires_at`),
  KEY `email_otp_token_hash_idx` (`token_hash`),
  KEY `email_otp_cleanup_idx` (`used_at`, `expires_at`),
  CONSTRAINT `email_otp_user_fk`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

SET @users_email_duplicate_count = (
  SELECT COUNT(*)
  FROM (
    SELECT `mail_Address`
    FROM `users`
    WHERE `mail_Address` IS NOT NULL
      AND TRIM(`mail_Address`) <> ''
    GROUP BY `mail_Address`
    HAVING COUNT(*) > 1
  ) duplicate_emails
);
SET @users_email_unique_index_exists = (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'users'
    AND index_name = 'users_mail_address_unique'
);
SET @users_email_unique_index_sql = IF(
  @users_email_unique_index_exists = 0 AND @users_email_duplicate_count = 0,
  'CREATE UNIQUE INDEX `users_mail_address_unique` ON `users` (`mail_Address`)',
  IF(
    @users_email_unique_index_exists > 0,
    'SELECT ''users_mail_address_unique already exists'' AS message',
    'SELECT ''users.mail_Address has duplicate values. Clean duplicates before adding users_mail_address_unique.'' AS message'
  )
);
PREPARE users_email_unique_index_stmt FROM @users_email_unique_index_sql;
EXECUTE users_email_unique_index_stmt;
DEALLOCATE PREPARE users_email_unique_index_stmt;
