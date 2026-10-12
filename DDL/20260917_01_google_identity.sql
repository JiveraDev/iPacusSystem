CREATE TABLE IF NOT EXISTS user_auth_identities (
    identity_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id INT NOT NULL,
    provider VARCHAR(30) NOT NULL,
    provider_subject VARCHAR(255) NOT NULL,
    provider_email VARCHAR(200) NULL,
    linked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login_at DATETIME NULL,
    PRIMARY KEY (identity_id),
    UNIQUE KEY uq_user_auth_provider_subject (provider, provider_subject),
    UNIQUE KEY uq_user_auth_user_provider (user_id, provider),
    KEY idx_user_auth_identity_user (user_id),
    CONSTRAINT fk_user_auth_identity_user
        FOREIGN KEY (user_id) REFERENCES users (user_id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS google_auth_onboarding_tokens (
    onboarding_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    token_hash CHAR(64) NOT NULL,
    provider_subject VARCHAR(255) NOT NULL,
    email VARCHAR(200) NOT NULL,
    first_name VARCHAR(100) NULL,
    last_name VARCHAR(100) NULL,
    picture_url VARCHAR(500) NULL,
    expires_at DATETIME NOT NULL,
    consumed_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (onboarding_id),
    UNIQUE KEY uq_google_onboarding_token_hash (token_hash),
    UNIQUE KEY uq_google_onboarding_subject (provider_subject),
    KEY idx_google_onboarding_expiry (expires_at, consumed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
