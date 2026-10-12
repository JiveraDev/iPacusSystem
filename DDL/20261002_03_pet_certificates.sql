-- Veterinary medical certificates linked to a pet and, when applicable, the
-- owner's paid medical-record update request. Registration certificates are
-- generated from the canonical pet record and do not require stored rows.

CREATE TABLE IF NOT EXISTS pet_medical_certificates (
    certificate_id BIGINT NOT NULL AUTO_INCREMENT,
    certificate_number VARCHAR(48) NOT NULL,
    pet_id INT NOT NULL,
    request_id INT NULL,
    veterinarian_user_id INT NOT NULL,
    branch_id INT NULL,
    examination_date DATE NOT NULL,
    valid_until DATE NOT NULL,
    clinical_findings TEXT NULL,
    certification_statement TEXT NOT NULL,
    signature_path VARCHAR(255) NOT NULL,
    status ENUM('active', 'superseded', 'revoked') NOT NULL DEFAULT 'active',
    owner_viewed_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (certificate_id),
    UNIQUE KEY pet_medical_certificate_number_unique (certificate_number),
    KEY pet_medical_certificate_pet_idx (pet_id, status, valid_until, certificate_id),
    KEY pet_medical_certificate_request_idx (request_id),
    KEY pet_medical_certificate_vet_idx (veterinarian_user_id, created_at),
    CONSTRAINT pet_medical_certificate_pet_fk
        FOREIGN KEY (pet_id) REFERENCES pets_information (pet_id) ON DELETE CASCADE,
    CONSTRAINT pet_medical_certificate_request_fk
        FOREIGN KEY (request_id) REFERENCES pet_record_update_requests (request_id) ON DELETE SET NULL,
    CONSTRAINT pet_medical_certificate_vet_fk
        FOREIGN KEY (veterinarian_user_id) REFERENCES users (user_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
