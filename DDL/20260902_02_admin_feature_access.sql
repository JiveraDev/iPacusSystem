-- Super Admin-managed feature access for Admin accounts.
-- Existing Admin accounts remain fully allowed until an explicit row is saved.

CREATE TABLE IF NOT EXISTS admin_feature_permissions (
    permission_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id INT NOT NULL,
    feature_key VARCHAR(64) NOT NULL,
    is_allowed TINYINT(1) NOT NULL DEFAULT 1,
    updated_by_user_id INT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (permission_id),
    UNIQUE KEY uq_admin_feature_permission (user_id, feature_key),
    KEY idx_admin_feature_permissions_user (user_id),
    KEY idx_admin_feature_permissions_updated_by (updated_by_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_feature_permission_audit (
    audit_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    target_user_id INT NOT NULL,
    changed_by_user_id INT NOT NULL,
    previous_permissions JSON NULL,
    new_permissions JSON NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (audit_id),
    KEY idx_admin_feature_permission_audit_target (target_user_id, created_at),
    KEY idx_admin_feature_permission_audit_actor (changed_by_user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
