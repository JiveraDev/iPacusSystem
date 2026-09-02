CREATE TABLE IF NOT EXISTS service_display_settings (
    settings_key VARCHAR(80) NOT NULL,
    settings_json LONGTEXT NOT NULL,
    updated_by_user_id INT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (settings_key),
    CONSTRAINT fk_service_display_settings_user
        FOREIGN KEY (updated_by_user_id) REFERENCES users(user_id)
        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

