ALTER TABLE pet_record_update_requests
    ADD COLUMN payment_reference VARCHAR(120) NULL AFTER payment_proof_url;

CREATE INDEX idx_record_update_payment_reference
    ON pet_record_update_requests (payment_reference);
