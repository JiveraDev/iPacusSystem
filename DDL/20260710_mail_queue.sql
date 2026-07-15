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
