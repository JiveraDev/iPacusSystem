-- Persist immutable Point-Of-Sale invoice PDFs separately from customer payment proof.
-- Apply after the visit billing tables have been installed.

 CREATE TABLE IF NOT EXISTS visit_invoice_documents (
    invoice_document_id INT NOT NULL AUTO_INCREMENT,
    invoice_number VARCHAR(80) NOT NULL,
    visit_id INT NOT NULL,
    payment_id INT NOT NULL,
    pet_id INT NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL DEFAULT 'application/pdf',
    paper_width VARCHAR(8) NOT NULL DEFAULT '80mm',
    created_by_user_id INT NULL,
    created_by_name VARCHAR(220) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (invoice_document_id),
    UNIQUE KEY visit_invoice_documents_number_uq (invoice_number),
    UNIQUE KEY visit_invoice_documents_payment_uq (payment_id),
    KEY visit_invoice_documents_visit_idx (visit_id, created_at),
    KEY visit_invoice_documents_pet_idx (pet_id, created_at),
    KEY visit_invoice_documents_creator_idx (created_by_user_id),
    CONSTRAINT visit_invoice_documents_visit_fk
        FOREIGN KEY (visit_id) REFERENCES visits (visit_id) ON DELETE CASCADE,
    CONSTRAINT visit_invoice_documents_payment_fk
        FOREIGN KEY (payment_id) REFERENCES visit_payments (payment_id) ON DELETE CASCADE,
    CONSTRAINT visit_invoice_documents_pet_fk
        FOREIGN KEY (pet_id) REFERENCES pets_information (pet_id),
    CONSTRAINT visit_invoice_documents_creator_fk
        FOREIGN KEY (created_by_user_id) REFERENCES users (user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

