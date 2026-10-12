CREATE TABLE IF NOT EXISTS system_backups (
    backup_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    backup_uuid CHAR(36) NOT NULL,
    backup_type ENUM('complete', 'changes') NOT NULL,
    status ENUM('running', 'completed', 'failed', 'interrupted') NOT NULL DEFAULT 'running',
    progress_percent TINYINT UNSIGNED NOT NULL DEFAULT 0,
    progress_stage VARCHAR(160) NOT NULL DEFAULT 'Preparing backup',
    parent_backup_id BIGINT UNSIGNED NULL,
    base_backup_id BIGINT UNSIGNED NULL,
    archive_name VARCHAR(255) NULL,
    archive_path VARCHAR(500) NULL,
    state_path VARCHAR(500) NULL,
    archive_size BIGINT UNSIGNED NULL,
    checksum_sha256 CHAR(64) NULL,
    scanned_row_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
    changed_row_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
    included_file_count INT UNSIGNED NOT NULL DEFAULT 0,
    deleted_file_count INT UNSIGNED NOT NULL DEFAULT 0,
    created_by_user_id INT NULL,
    created_by_name VARCHAR(220) NOT NULL,
    started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME NULL,
    error_message VARCHAR(1000) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (backup_id),
    UNIQUE KEY uq_system_backups_uuid (backup_uuid),
    KEY idx_system_backups_status_started (status, started_at),
    KEY idx_system_backups_parent (parent_backup_id),
    KEY idx_system_backups_base (base_backup_id),
    KEY idx_system_backups_actor (created_by_user_id),
    CONSTRAINT fk_system_backups_parent
        FOREIGN KEY (parent_backup_id) REFERENCES system_backups (backup_id)
        ON DELETE SET NULL,
    CONSTRAINT fk_system_backups_base
        FOREIGN KEY (base_backup_id) REFERENCES system_backups (backup_id)
        ON DELETE SET NULL,
    CONSTRAINT fk_system_backups_actor
        FOREIGN KEY (created_by_user_id) REFERENCES users (user_id)
        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
