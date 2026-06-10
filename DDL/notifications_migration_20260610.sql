CREATE TABLE IF NOT EXISTS notification_preferences (
    user_id INT NOT NULL PRIMARY KEY,
    email_enabled TINYINT(1) NOT NULL DEFAULT 1,
    in_app_enabled TINYINT(1) NOT NULL DEFAULT 1,
    booking_updates TINYINT(1) NOT NULL DEFAULT 1,
    schedule_reminders TINYINT(1) NOT NULL DEFAULT 1,
    payment_updates TINYINT(1) NOT NULL DEFAULT 1,
    diagnosis_updates TINYINT(1) NOT NULL DEFAULT 1,
    queue_updates TINYINT(1) NOT NULL DEFAULT 1,
    boarding_updates TINYINT(1) NOT NULL DEFAULT 1,
    reminder_24h TINYINT(1) NOT NULL DEFAULT 1,
    reminder_2h TINYINT(1) NOT NULL DEFAULT 1,
    reminder_same_day TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT notification_preferences_user_fk
        FOREIGN KEY (user_id) REFERENCES users(user_id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_notifications (
    notification_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    type VARCHAR(80) NOT NULL DEFAULT 'system',
    category VARCHAR(80) NOT NULL DEFAULT 'system',
    title VARCHAR(180) NOT NULL,
    message TEXT NULL,
    redirect_path VARCHAR(255) NULL,
    in_app_visible TINYINT(1) NOT NULL DEFAULT 1,
    dedupe_key VARCHAR(180) NULL,
    email_subject VARCHAR(180) NULL,
    email_status ENUM('not_sent','sent','failed','skipped') NOT NULL DEFAULT 'not_sent',
    email_sent_at DATETIME NULL,
    email_error TEXT NULL,
    read_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY user_notifications_user_created_idx (user_id, created_at),
    KEY user_notifications_user_read_idx (user_id, read_at),
    UNIQUE KEY user_notifications_dedupe_unique (user_id, dedupe_key),
    CONSTRAINT user_notifications_user_fk
        FOREIGN KEY (user_id) REFERENCES users(user_id)
        ON DELETE CASCADE
);
