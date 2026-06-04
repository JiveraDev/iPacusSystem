-- Visit, service catalog, payment, and boarding document support.
-- Run this manually against the project database before using the new screens.

CREATE TABLE IF NOT EXISTS service_catalog (
    service_id INT AUTO_INCREMENT PRIMARY KEY,
    service_code VARCHAR(80) NULL,
    service_name VARCHAR(150) NOT NULL,
    service_type ENUM(
        'consultation',
        'vaccination',
        'laboratory',
        'surgery',
        'grooming',
        'boarding',
        'dental',
        'home_service',
        'other'
    ) NOT NULL,
    description TEXT NULL,
    base_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    is_major_service TINYINT(1) NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_by_user_id INT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY service_catalog_code_unique (service_code),
    KEY service_catalog_type_idx (service_type, is_active),
    KEY service_catalog_created_by_fk (created_by_user_id),
    CONSTRAINT service_catalog_created_by_fk
        FOREIGN KEY (created_by_user_id) REFERENCES users(user_id)
        ON DELETE SET NULL
);

-- Compatibility for databases where an earlier draft of service_catalog already exists.
SET @service_catalog_service_code_column_exists = (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'service_catalog'
      AND column_name = 'service_code'
);
SET @service_catalog_service_code_column_sql = IF(
    @service_catalog_service_code_column_exists = 0,
    'ALTER TABLE service_catalog ADD COLUMN service_code VARCHAR(80) NULL AFTER service_id',
    'SELECT ''service_catalog.service_code already exists'' AS message'
);
PREPARE service_catalog_service_code_column_stmt FROM @service_catalog_service_code_column_sql;
EXECUTE service_catalog_service_code_column_stmt;
DEALLOCATE PREPARE service_catalog_service_code_column_stmt;

SET @service_catalog_description_column_exists = (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'service_catalog'
      AND column_name = 'description'
);
SET @service_catalog_description_column_sql = IF(
    @service_catalog_description_column_exists = 0,
    'ALTER TABLE service_catalog ADD COLUMN description TEXT NULL AFTER service_type',
    'SELECT ''service_catalog.description already exists'' AS message'
);
PREPARE service_catalog_description_column_stmt FROM @service_catalog_description_column_sql;
EXECUTE service_catalog_description_column_stmt;
DEALLOCATE PREPARE service_catalog_description_column_stmt;

SET @service_catalog_major_column_exists = (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'service_catalog'
      AND column_name = 'is_major_service'
);
SET @service_catalog_major_column_sql = IF(
    @service_catalog_major_column_exists = 0,
    'ALTER TABLE service_catalog ADD COLUMN is_major_service TINYINT(1) NOT NULL DEFAULT 0 AFTER base_price',
    'SELECT ''service_catalog.is_major_service already exists'' AS message'
);
PREPARE service_catalog_major_column_stmt FROM @service_catalog_major_column_sql;
EXECUTE service_catalog_major_column_stmt;
DEALLOCATE PREPARE service_catalog_major_column_stmt;

SET @service_catalog_created_by_column_exists = (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'service_catalog'
      AND column_name = 'created_by_user_id'
);
SET @service_catalog_created_by_column_sql = IF(
    @service_catalog_created_by_column_exists = 0,
    'ALTER TABLE service_catalog ADD COLUMN created_by_user_id INT NULL AFTER is_active',
    'SELECT ''service_catalog.created_by_user_id already exists'' AS message'
);
PREPARE service_catalog_created_by_column_stmt FROM @service_catalog_created_by_column_sql;
EXECUTE service_catalog_created_by_column_stmt;
DEALLOCATE PREPARE service_catalog_created_by_column_stmt;

SET @service_catalog_created_at_column_exists = (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'service_catalog'
      AND column_name = 'created_at'
);
SET @service_catalog_created_at_column_sql = IF(
    @service_catalog_created_at_column_exists = 0,
    'ALTER TABLE service_catalog ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER created_by_user_id',
    'SELECT ''service_catalog.created_at already exists'' AS message'
);
PREPARE service_catalog_created_at_column_stmt FROM @service_catalog_created_at_column_sql;
EXECUTE service_catalog_created_at_column_stmt;
DEALLOCATE PREPARE service_catalog_created_at_column_stmt;

SET @service_catalog_updated_at_column_exists = (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'service_catalog'
      AND column_name = 'updated_at'
);
SET @service_catalog_updated_at_column_sql = IF(
    @service_catalog_updated_at_column_exists = 0,
    'ALTER TABLE service_catalog ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at',
    'SELECT ''service_catalog.updated_at already exists'' AS message'
);
PREPARE service_catalog_updated_at_column_stmt FROM @service_catalog_updated_at_column_sql;
EXECUTE service_catalog_updated_at_column_stmt;
DEALLOCATE PREPARE service_catalog_updated_at_column_stmt;

SET @service_catalog_code_index_exists = (
    SELECT COUNT(*)
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'service_catalog'
      AND index_name = 'service_catalog_code_unique'
);
SET @service_catalog_code_index_sql = IF(
    @service_catalog_code_index_exists = 0,
    'CREATE UNIQUE INDEX service_catalog_code_unique ON service_catalog (service_code)',
    'SELECT ''service_catalog_code_unique already exists'' AS message'
);
PREPARE service_catalog_code_index_stmt FROM @service_catalog_code_index_sql;
EXECUTE service_catalog_code_index_stmt;
DEALLOCATE PREPARE service_catalog_code_index_stmt;

SET @service_catalog_type_index_exists = (
    SELECT COUNT(*)
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'service_catalog'
      AND index_name = 'service_catalog_type_idx'
);
SET @service_catalog_type_index_sql = IF(
    @service_catalog_type_index_exists = 0,
    'CREATE INDEX service_catalog_type_idx ON service_catalog (service_type, is_active)',
    'SELECT ''service_catalog_type_idx already exists'' AS message'
);
PREPARE service_catalog_type_index_stmt FROM @service_catalog_type_index_sql;
EXECUTE service_catalog_type_index_stmt;
DEALLOCATE PREPARE service_catalog_type_index_stmt;

SET @service_catalog_created_by_index_exists = (
    SELECT COUNT(*)
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'service_catalog'
      AND index_name = 'service_catalog_created_by_fk'
);
SET @service_catalog_created_by_index_sql = IF(
    @service_catalog_created_by_index_exists = 0,
    'CREATE INDEX service_catalog_created_by_fk ON service_catalog (created_by_user_id)',
    'SELECT ''service_catalog_created_by_fk index already exists'' AS message'
);
PREPARE service_catalog_created_by_index_stmt FROM @service_catalog_created_by_index_sql;
EXECUTE service_catalog_created_by_index_stmt;
DEALLOCATE PREPARE service_catalog_created_by_index_stmt;

SET @service_catalog_created_by_fk_exists = (
    SELECT COUNT(*)
    FROM information_schema.table_constraints
    WHERE table_schema = DATABASE()
      AND table_name = 'service_catalog'
      AND constraint_name = 'service_catalog_created_by_fk'
);
SET @service_catalog_created_by_fk_sql = IF(
    @service_catalog_created_by_fk_exists = 0,
    'ALTER TABLE service_catalog ADD CONSTRAINT service_catalog_created_by_fk FOREIGN KEY (created_by_user_id) REFERENCES users(user_id) ON DELETE SET NULL',
    'SELECT ''service_catalog_created_by_fk already exists'' AS message'
);
PREPARE service_catalog_created_by_fk_stmt FROM @service_catalog_created_by_fk_sql;
EXECUTE service_catalog_created_by_fk_stmt;
DEALLOCATE PREPARE service_catalog_created_by_fk_stmt;

CREATE TABLE IF NOT EXISTS service_materials (
    service_material_id INT AUTO_INCREMENT PRIMARY KEY,
    service_id INT NOT NULL,
    item_id INT NULL,
    material_name VARCHAR(180) NOT NULL,
    qty_used DECIMAL(10,2) NOT NULL DEFAULT 1.00,
    billable_policy ENUM('included','separate','optional') NOT NULL DEFAULT 'included',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY service_materials_service_material_idx (service_id, material_name),
    KEY service_materials_item_fk (item_id),
    CONSTRAINT service_materials_service_fk
        FOREIGN KEY (service_id) REFERENCES service_catalog(service_id)
        ON DELETE CASCADE,
    CONSTRAINT service_materials_item_fk
        FOREIGN KEY (item_id) REFERENCES inventory_items(item_id)
        ON DELETE SET NULL
);

-- Compatibility for older service_materials draft table.
ALTER TABLE service_materials MODIFY COLUMN item_id INT NULL;

SET @service_materials_material_name_column_exists = (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'service_materials'
      AND column_name = 'material_name'
);
SET @service_materials_material_name_column_sql = IF(
    @service_materials_material_name_column_exists = 0,
    'ALTER TABLE service_materials ADD COLUMN material_name VARCHAR(180) NULL AFTER item_id',
    'SELECT ''service_materials.material_name already exists'' AS message'
);
PREPARE service_materials_material_name_column_stmt FROM @service_materials_material_name_column_sql;
EXECUTE service_materials_material_name_column_stmt;
DEALLOCATE PREPARE service_materials_material_name_column_stmt;

UPDATE service_materials sm
LEFT JOIN inventory_items ii ON ii.item_id = sm.item_id
SET sm.material_name = COALESCE(NULLIF(sm.material_name, ''), ii.item_name, 'Material')
WHERE sm.material_name IS NULL OR sm.material_name = '';

ALTER TABLE service_materials MODIFY COLUMN material_name VARCHAR(180) NOT NULL;

SET @service_materials_created_at_column_exists = (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'service_materials'
      AND column_name = 'created_at'
);
SET @service_materials_created_at_column_sql = IF(
    @service_materials_created_at_column_exists = 0,
    'ALTER TABLE service_materials ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER billable_policy',
    'SELECT ''service_materials.created_at already exists'' AS message'
);
PREPARE service_materials_created_at_column_stmt FROM @service_materials_created_at_column_sql;
EXECUTE service_materials_created_at_column_stmt;
DEALLOCATE PREPARE service_materials_created_at_column_stmt;

SET @service_materials_updated_at_column_exists = (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'service_materials'
      AND column_name = 'updated_at'
);
SET @service_materials_updated_at_column_sql = IF(
    @service_materials_updated_at_column_exists = 0,
    'ALTER TABLE service_materials ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at',
    'SELECT ''service_materials.updated_at already exists'' AS message'
);
PREPARE service_materials_updated_at_column_stmt FROM @service_materials_updated_at_column_sql;
EXECUTE service_materials_updated_at_column_stmt;
DEALLOCATE PREPARE service_materials_updated_at_column_stmt;

CREATE TABLE IF NOT EXISTS visits (
    visit_id INT AUTO_INCREMENT PRIMARY KEY,
    pet_id INT NOT NULL,
    owner_user_id INT NOT NULL,
    veterinarian_user_id INT NULL,
    queue_id INT NULL,
    booking_id INT NULL,
    diagnosis_id INT NULL,
    source_type ENUM('queue','booking','walk_in','boarding','manual') NOT NULL DEFAULT 'manual',
    visit_status ENUM('waiting','in_consultation','treatment_done','completed','cancelled') NOT NULL DEFAULT 'waiting',
    billing_status ENUM('unbilled','unpaid','partial','paid','refunded') NOT NULL DEFAULT 'unbilled',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY visits_pet_idx (pet_id),
    KEY visits_owner_idx (owner_user_id),
    KEY visits_vet_idx (veterinarian_user_id),
    KEY visits_queue_idx (queue_id),
    KEY visits_booking_idx (booking_id),
    KEY visits_diagnosis_idx (diagnosis_id),
    UNIQUE KEY visits_queue_pet_unique (queue_id, pet_id),
    UNIQUE KEY visits_booking_pet_unique (booking_id, pet_id),
    CONSTRAINT visits_pet_fk
        FOREIGN KEY (pet_id) REFERENCES pets_information(pet_id),
    CONSTRAINT visits_owner_fk
        FOREIGN KEY (owner_user_id) REFERENCES users(user_id),
    CONSTRAINT visits_vet_fk
        FOREIGN KEY (veterinarian_user_id) REFERENCES users(user_id)
        ON DELETE SET NULL,
    CONSTRAINT visits_queue_fk
        FOREIGN KEY (queue_id) REFERENCES queues(queue_id)
        ON DELETE SET NULL,
    CONSTRAINT visits_booking_fk
        FOREIGN KEY (booking_id) REFERENCES bookings(booking_id)
        ON DELETE SET NULL,
    CONSTRAINT visits_diagnosis_fk
        FOREIGN KEY (diagnosis_id) REFERENCES vet_diagnoses(diagnosis_id)
        ON DELETE SET NULL
);

-- Compatibility for older visits draft table.
SET @visits_diagnosis_column_exists = (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'visits'
      AND column_name = 'diagnosis_id'
);
SET @visits_diagnosis_column_sql = IF(
    @visits_diagnosis_column_exists = 0,
    'ALTER TABLE visits ADD COLUMN diagnosis_id INT NULL AFTER booking_id',
    'SELECT ''visits.diagnosis_id already exists'' AS message'
);
PREPARE visits_diagnosis_column_stmt FROM @visits_diagnosis_column_sql;
EXECUTE visits_diagnosis_column_stmt;
DEALLOCATE PREPARE visits_diagnosis_column_stmt;

SET @visits_source_type_column_exists = (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'visits'
      AND column_name = 'source_type'
);
SET @visits_source_type_column_sql = IF(
    @visits_source_type_column_exists = 0,
    'ALTER TABLE visits ADD COLUMN source_type ENUM(''queue'',''booking'',''walk_in'',''boarding'',''manual'') NOT NULL DEFAULT ''manual'' AFTER diagnosis_id',
    'SELECT ''visits.source_type already exists'' AS message'
);
PREPARE visits_source_type_column_stmt FROM @visits_source_type_column_sql;
EXECUTE visits_source_type_column_stmt;
DEALLOCATE PREPARE visits_source_type_column_stmt;

SET @visits_updated_at_column_exists = (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'visits'
      AND column_name = 'updated_at'
);
SET @visits_updated_at_column_sql = IF(
    @visits_updated_at_column_exists = 0,
    'ALTER TABLE visits ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at',
    'SELECT ''visits.updated_at already exists'' AS message'
);
PREPARE visits_updated_at_column_stmt FROM @visits_updated_at_column_sql;
EXECUTE visits_updated_at_column_stmt;
DEALLOCATE PREPARE visits_updated_at_column_stmt;

SET @visits_diagnosis_index_exists = (
    SELECT COUNT(*)
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'visits'
      AND index_name = 'visits_diagnosis_idx'
);
SET @visits_diagnosis_index_sql = IF(
    @visits_diagnosis_index_exists = 0,
    'CREATE INDEX visits_diagnosis_idx ON visits (diagnosis_id)',
    'SELECT ''visits_diagnosis_idx already exists'' AS message'
);
PREPARE visits_diagnosis_index_stmt FROM @visits_diagnosis_index_sql;
EXECUTE visits_diagnosis_index_stmt;
DEALLOCATE PREPARE visits_diagnosis_index_stmt;

SET @visits_diagnosis_fk_exists = (
    SELECT COUNT(*)
    FROM information_schema.table_constraints
    WHERE table_schema = DATABASE()
      AND table_name = 'visits'
      AND constraint_name = 'visits_diagnosis_fk'
);
SET @visits_diagnosis_fk_sql = IF(
    @visits_diagnosis_fk_exists = 0,
    'ALTER TABLE visits ADD CONSTRAINT visits_diagnosis_fk FOREIGN KEY (diagnosis_id) REFERENCES vet_diagnoses(diagnosis_id) ON DELETE SET NULL',
    'SELECT ''visits_diagnosis_fk already exists'' AS message'
);
PREPARE visits_diagnosis_fk_stmt FROM @visits_diagnosis_fk_sql;
EXECUTE visits_diagnosis_fk_stmt;
DEALLOCATE PREPARE visits_diagnosis_fk_stmt;

CREATE TABLE IF NOT EXISTS visit_charges (
    charge_id INT AUTO_INCREMENT PRIMARY KEY,
    visit_id INT NOT NULL,
    charge_type ENUM(
        'service',
        'diagnostic',
        'medication',
        'consumable',
        'retail_product',
        'boarding',
        'other'
    ) NOT NULL,
    service_id INT NULL,
    item_id INT NULL,
    description VARCHAR(255) NOT NULL,
    quantity DECIMAL(10,2) NOT NULL DEFAULT 1.00,
    unit_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    created_by_user_id INT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY visit_charges_visit_idx (visit_id),
    KEY visit_charges_service_idx (service_id),
    KEY visit_charges_item_idx (item_id),
    KEY visit_charges_created_by_fk (created_by_user_id),
    CONSTRAINT visit_charges_visit_fk
        FOREIGN KEY (visit_id) REFERENCES visits(visit_id)
        ON DELETE CASCADE,
    CONSTRAINT visit_charges_service_fk
        FOREIGN KEY (service_id) REFERENCES service_catalog(service_id)
        ON DELETE SET NULL,
    CONSTRAINT visit_charges_item_fk
        FOREIGN KEY (item_id) REFERENCES inventory_items(item_id)
        ON DELETE SET NULL,
    CONSTRAINT visit_charges_created_by_fk
        FOREIGN KEY (created_by_user_id) REFERENCES users(user_id)
        ON DELETE SET NULL
);

-- Compatibility for older visit_charges draft table.
ALTER TABLE visit_charges
    MODIFY COLUMN charge_type ENUM(
        'service',
        'diagnostic',
        'medication',
        'consumable',
        'retail_product',
        'boarding',
        'other'
    ) NOT NULL;

SET @visit_charges_created_by_column_exists = (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'visit_charges'
      AND column_name = 'created_by_user_id'
);
SET @visit_charges_created_by_column_sql = IF(
    @visit_charges_created_by_column_exists = 0,
    'ALTER TABLE visit_charges ADD COLUMN created_by_user_id INT NULL AFTER subtotal',
    'SELECT ''visit_charges.created_by_user_id already exists'' AS message'
);
PREPARE visit_charges_created_by_column_stmt FROM @visit_charges_created_by_column_sql;
EXECUTE visit_charges_created_by_column_stmt;
DEALLOCATE PREPARE visit_charges_created_by_column_stmt;

SET @visit_charges_created_at_column_exists = (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'visit_charges'
      AND column_name = 'created_at'
);
SET @visit_charges_created_at_column_sql = IF(
    @visit_charges_created_at_column_exists = 0,
    'ALTER TABLE visit_charges ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER created_by_user_id',
    'SELECT ''visit_charges.created_at already exists'' AS message'
);
PREPARE visit_charges_created_at_column_stmt FROM @visit_charges_created_at_column_sql;
EXECUTE visit_charges_created_at_column_stmt;
DEALLOCATE PREPARE visit_charges_created_at_column_stmt;

SET @visit_charges_updated_at_column_exists = (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'visit_charges'
      AND column_name = 'updated_at'
);
SET @visit_charges_updated_at_column_sql = IF(
    @visit_charges_updated_at_column_exists = 0,
    'ALTER TABLE visit_charges ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
    'SELECT ''visit_charges.updated_at already exists'' AS message'
);
PREPARE visit_charges_updated_at_column_stmt FROM @visit_charges_updated_at_column_sql;
EXECUTE visit_charges_updated_at_column_stmt;
DEALLOCATE PREPARE visit_charges_updated_at_column_stmt;

CREATE TABLE IF NOT EXISTS visit_payments (
    payment_id INT AUTO_INCREMENT PRIMARY KEY,
    visit_id INT NOT NULL,
    payment_method ENUM('cash','gcash','maya','bank_transfer','card','other') NOT NULL DEFAULT 'cash',
    payment_status ENUM('pending','verified','failed','refunded','voided') NOT NULL DEFAULT 'verified',
    amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    reference_number VARCHAR(120) NULL,
    proof_url VARCHAR(255) NULL,
    notes TEXT NULL,
    paid_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    received_by_user_id INT NULL,
    received_by_name VARCHAR(220) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY visit_payments_visit_idx (visit_id),
    KEY visit_payments_received_by_fk (received_by_user_id),
    CONSTRAINT visit_payments_visit_fk
        FOREIGN KEY (visit_id) REFERENCES visits(visit_id)
        ON DELETE CASCADE,
    CONSTRAINT visit_payments_received_by_fk
        FOREIGN KEY (received_by_user_id) REFERENCES users(user_id)
        ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS boarding_documents (
    document_id INT AUTO_INCREMENT PRIMARY KEY,
    assignment_id INT NULL,
    booking_id INT NOT NULL,
    pet_id INT NULL,
    document_type ENUM('monitoring_report','boarding_history','checkout_summary','diagnosis_reference','other') NOT NULL DEFAULT 'monitoring_report',
    title VARCHAR(180) NOT NULL,
    document_path VARCHAR(255) NOT NULL,
    file_name VARCHAR(255) NULL,
    mime_type VARCHAR(120) NULL,
    notes TEXT NULL,
    uploaded_by_user_id INT NULL,
    uploaded_by_name VARCHAR(220) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY boarding_documents_assignment_idx (assignment_id),
    KEY boarding_documents_booking_idx (booking_id),
    KEY boarding_documents_pet_idx (pet_id),
    KEY boarding_documents_uploaded_by_fk (uploaded_by_user_id),
    CONSTRAINT boarding_documents_assignment_fk
        FOREIGN KEY (assignment_id) REFERENCES boarding_assignments(assignment_id)
        ON DELETE SET NULL,
    CONSTRAINT boarding_documents_booking_fk
        FOREIGN KEY (booking_id) REFERENCES bookings(booking_id)
        ON DELETE CASCADE,
    CONSTRAINT boarding_documents_pet_fk
        FOREIGN KEY (pet_id) REFERENCES pets_information(pet_id)
        ON DELETE SET NULL,
    CONSTRAINT boarding_documents_uploaded_by_fk
        FOREIGN KEY (uploaded_by_user_id) REFERENCES users(user_id)
        ON DELETE SET NULL
);

INSERT INTO service_catalog (service_code, service_name, service_type, base_price, description, is_major_service)
VALUES
    ('CONSULT-GENERAL', 'General Consultation', 'consultation', 0.00, 'Default clinic consultation service.', 1),
    ('VACCINATION', 'Vaccination', 'vaccination', 0.00, 'Vaccination service; vaccine materials can be configured.', 1),
    ('LABORATORY', 'Laboratory Test', 'laboratory', 0.00, 'Diagnostic laboratory service.', 1),
    ('SURGERY', 'Surgery', 'surgery', 0.00, 'Surgical service or package.', 1),
    ('GROOMING', 'Grooming', 'grooming', 0.00, 'Grooming service.', 1),
    ('BOARDING', 'Boarding / Pet Hotel Stay', 'boarding', 0.00, 'Boarding or pet hotel stay.', 1),
    ('DENTAL', 'Dental Service', 'dental', 0.00, 'Dental checkup or procedure.', 1),
    ('HOME-SERVICE', 'Home Service', 'home_service', 0.00, 'Home visit service.', 1)
ON DUPLICATE KEY UPDATE
    service_name = VALUES(service_name),
    service_type = VALUES(service_type),
    description = VALUES(description),
    is_major_service = VALUES(is_major_service);
