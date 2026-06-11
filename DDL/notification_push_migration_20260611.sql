ALTER TABLE notification_preferences
    ADD COLUMN browser_push_enabled TINYINT(1) NOT NULL DEFAULT 0 AFTER in_app_enabled;

ALTER TABLE user_notifications
    ADD COLUMN push_status ENUM('not_sent','sent','failed','skipped') NOT NULL DEFAULT 'not_sent' AFTER email_error,
    ADD COLUMN push_sent_at DATETIME NULL AFTER push_status,
    ADD COLUMN push_error TEXT NULL AFTER push_sent_at;

CREATE TABLE IF NOT EXISTS notification_push_subscriptions (
    subscription_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    endpoint TEXT NOT NULL,
    endpoint_hash CHAR(64) NOT NULL,
    p256dh TEXT NULL,
    auth TEXT NULL,
    content_encoding VARCHAR(40) NULL DEFAULT 'aes128gcm',
    user_agent TEXT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    last_sent_at DATETIME NULL,
    last_error TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY notification_push_endpoint_unique (endpoint_hash),
    KEY notification_push_user_active_idx (user_id, is_active),
    CONSTRAINT notification_push_user_fk
        FOREIGN KEY (user_id) REFERENCES users(user_id)
        ON DELETE CASCADE
);
