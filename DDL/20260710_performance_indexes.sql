DROP PROCEDURE IF EXISTS ipawcus_add_index_if_missing;
DROP PROCEDURE IF EXISTS ipawcus_add_perf_index_20260710;

CREATE INDEX IF NOT EXISTS users_mail_address_idx
    ON users (mail_Address);

CREATE INDEX IF NOT EXISTS pets_information_sharable_idx
    ON pets_information (pet_sharable_ID);

CREATE INDEX IF NOT EXISTS pets_information_status_idx
    ON pets_information (pet_status);

CREATE INDEX IF NOT EXISTS bookings_user_created_idx
    ON bookings (user_id, created_at, booking_id);

CREATE INDEX IF NOT EXISTS bookings_status_date_idx
    ON bookings (status, booking_date, booking_time);

CREATE INDEX IF NOT EXISTS bookings_service_date_status_idx
    ON bookings (service_type, booking_date, status);

CREATE INDEX IF NOT EXISTS bookings_vet_status_date_idx
    ON bookings (veterinarian_id, status, booking_date);

CREATE INDEX IF NOT EXISTS booking_pets_pet_booking_idx
    ON booking_pets (pet_id, booking_id);

CREATE INDEX IF NOT EXISTS queues_status_timestamp_idx
    ON queues (status, `timestamp`, queue_id);

CREATE INDEX IF NOT EXISTS queues_pet_status_idx
    ON queues (pet_id, status, `timestamp`);

CREATE INDEX IF NOT EXISTS queues_user_timestamp_idx
    ON queues (user_id, `timestamp`);

CREATE INDEX IF NOT EXISTS visits_created_idx
    ON visits (created_at, visit_id);

CREATE INDEX IF NOT EXISTS visits_billing_created_idx
    ON visits (billing_status, created_at);

CREATE INDEX IF NOT EXISTS visits_status_created_idx
    ON visits (visit_status, created_at);

CREATE INDEX IF NOT EXISTS visits_vet_created_idx
    ON visits (veterinarian_user_id, created_at);

CREATE INDEX IF NOT EXISTS visit_payments_status_paid_idx
    ON visit_payments (payment_status, paid_at);

CREATE INDEX IF NOT EXISTS visit_payments_method_paid_idx
    ON visit_payments (payment_method, paid_at);

CREATE INDEX IF NOT EXISTS visit_charges_visit_subtotal_idx
    ON visit_charges (visit_id, subtotal);

CREATE INDEX IF NOT EXISTS inventory_items_status_name_idx
    ON inventory_items (status, item_name);

CREATE INDEX IF NOT EXISTS inventory_items_category_status_idx
    ON inventory_items (category, status);

CREATE INDEX IF NOT EXISTS inventory_batches_item_expiry_idx
    ON inventory_batches (item_id, expiry_date, created_at);

CREATE INDEX IF NOT EXISTS inventory_movements_reference_idx
    ON inventory_stock_movements (reference_type, reference_id);

CREATE INDEX IF NOT EXISTS inventory_movements_item_created_idx
    ON inventory_stock_movements (item_id, created_at);

CREATE INDEX IF NOT EXISTS online_consultations_vet_start_idx
    ON online_consultations (veterinarian_user_id, scheduled_start);

CREATE INDEX IF NOT EXISTS online_consultations_owner_start_idx
    ON online_consultations (owner_user_id, scheduled_start);

CREATE INDEX IF NOT EXISTS vet_diagnoses_vet_finalized_idx
    ON vet_diagnoses (veterinarian_user_id, finalized_at, created_at);

CREATE INDEX IF NOT EXISTS vet_diagnoses_pet_created_idx
    ON vet_diagnoses (pet_id, created_at);

CREATE INDEX IF NOT EXISTS record_requests_status_created_idx
    ON pet_record_update_requests (status, created_at);

CREATE INDEX IF NOT EXISTS record_requests_vet_status_idx
    ON pet_record_update_requests (assigned_veterinarian_user_id, status, created_at);

CREATE INDEX IF NOT EXISTS record_requests_owner_status_idx
    ON pet_record_update_requests (owner_user_id, status, created_at);
