-- Clinical confinement is stored as a medically referred Boarding admission.
-- The clinical visit remains the single billing source; no confinement table is
-- created. This migration is safe to run more than once.

SET @clinical_confinement_sql := IF(
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'bookings' AND column_name = 'admission_type'),
    'DO 1',
    "ALTER TABLE `bookings` ADD COLUMN `admission_type` ENUM('regular','confinement') NOT NULL DEFAULT 'regular' AFTER `hotel_boarding_type`"
);
PREPARE clinical_confinement_stmt FROM @clinical_confinement_sql;
EXECUTE clinical_confinement_stmt;
DEALLOCATE PREPARE clinical_confinement_stmt;

SET @clinical_confinement_sql := IF(
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'bookings' AND column_name = 'source_visit_id'),
    'DO 1',
    'ALTER TABLE `bookings` ADD COLUMN `source_visit_id` INT NULL AFTER `admission_type`'
);
PREPARE clinical_confinement_stmt FROM @clinical_confinement_sql;
EXECUTE clinical_confinement_stmt;
DEALLOCATE PREPARE clinical_confinement_stmt;

SET @clinical_confinement_sql := IF(
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'bookings' AND column_name = 'source_diagnosis_id'),
    'DO 1',
    'ALTER TABLE `bookings` ADD COLUMN `source_diagnosis_id` INT NULL AFTER `source_visit_id`'
);
PREPARE clinical_confinement_stmt FROM @clinical_confinement_sql;
EXECUTE clinical_confinement_stmt;
DEALLOCATE PREPARE clinical_confinement_stmt;

SET @clinical_confinement_sql := IF(
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'bookings' AND column_name = 'source_grooming_booking_id'),
    'DO 1',
    'ALTER TABLE `bookings` ADD COLUMN `source_grooming_booking_id` INT NULL AFTER `source_diagnosis_id`'
);
PREPARE clinical_confinement_stmt FROM @clinical_confinement_sql;
EXECUTE clinical_confinement_stmt;
DEALLOCATE PREPARE clinical_confinement_stmt;

SET @clinical_confinement_sql := IF(
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'bookings' AND column_name = 'referred_by_vet_user_id'),
    'DO 1',
    'ALTER TABLE `bookings` ADD COLUMN `referred_by_vet_user_id` INT NULL AFTER `source_grooming_booking_id`'
);
PREPARE clinical_confinement_stmt FROM @clinical_confinement_sql;
EXECUTE clinical_confinement_stmt;
DEALLOCATE PREPARE clinical_confinement_stmt;

SET @clinical_confinement_sql := IF(
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'bookings' AND column_name = 'confinement_reason'),
    'DO 1',
    'ALTER TABLE `bookings` ADD COLUMN `confinement_reason` TEXT NULL AFTER `referred_by_vet_user_id`'
);
PREPARE clinical_confinement_stmt FROM @clinical_confinement_sql;
EXECUTE clinical_confinement_stmt;
DEALLOCATE PREPARE clinical_confinement_stmt;

SET @clinical_confinement_sql := IF(
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'bookings' AND column_name = 'care_instructions'),
    'DO 1',
    'ALTER TABLE `bookings` ADD COLUMN `care_instructions` TEXT NULL AFTER `confinement_reason`'
);
PREPARE clinical_confinement_stmt FROM @clinical_confinement_sql;
EXECUTE clinical_confinement_stmt;
DEALLOCATE PREPARE clinical_confinement_stmt;

SET @clinical_confinement_sql := IF(
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'bookings' AND column_name = 'owner_approval_status'),
    'DO 1',
    "ALTER TABLE `bookings` ADD COLUMN `owner_approval_status` ENUM('pending','approved','declined') NULL AFTER `care_instructions`"
);
PREPARE clinical_confinement_stmt FROM @clinical_confinement_sql;
EXECUTE clinical_confinement_stmt;
DEALLOCATE PREPARE clinical_confinement_stmt;

SET @clinical_confinement_sql := IF(
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'bookings' AND column_name = 'owner_approved_at'),
    'DO 1',
    'ALTER TABLE `bookings` ADD COLUMN `owner_approved_at` DATETIME NULL AFTER `owner_approval_status`'
);
PREPARE clinical_confinement_stmt FROM @clinical_confinement_sql;
EXECUTE clinical_confinement_stmt;
DEALLOCATE PREPARE clinical_confinement_stmt;

SET @clinical_confinement_sql := IF(
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'bookings' AND column_name = 'billing_charge_id'),
    'DO 1',
    'ALTER TABLE `bookings` ADD COLUMN `billing_charge_id` INT NULL AFTER `owner_approved_at`'
);
PREPARE clinical_confinement_stmt FROM @clinical_confinement_sql;
EXECUTE clinical_confinement_stmt;
DEALLOCATE PREPARE clinical_confinement_stmt;

SET @clinical_confinement_sql := IF(
    EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'bookings' AND index_name = 'bookings_confinement_visit_idx'),
    'DO 1',
    'ALTER TABLE `bookings` ADD INDEX `bookings_confinement_visit_idx` (`admission_type`, `source_visit_id`)'
);
PREPARE clinical_confinement_stmt FROM @clinical_confinement_sql;
EXECUTE clinical_confinement_stmt;
DEALLOCATE PREPARE clinical_confinement_stmt;

SET @clinical_confinement_sql := IF(
    EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'bookings' AND index_name = 'bookings_confinement_diagnosis_unique'),
    'DO 1',
    'ALTER TABLE `bookings` ADD UNIQUE INDEX `bookings_confinement_diagnosis_unique` (`source_diagnosis_id`)'
);
PREPARE clinical_confinement_stmt FROM @clinical_confinement_sql;
EXECUTE clinical_confinement_stmt;
DEALLOCATE PREPARE clinical_confinement_stmt;

SET @clinical_confinement_sql := IF(
    EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'bookings' AND index_name = 'bookings_confinement_grooming_unique'),
    'DO 1',
    'ALTER TABLE `bookings` ADD UNIQUE INDEX `bookings_confinement_grooming_unique` (`source_grooming_booking_id`)'
);
PREPARE clinical_confinement_stmt FROM @clinical_confinement_sql;
EXECUTE clinical_confinement_stmt;
DEALLOCATE PREPARE clinical_confinement_stmt;

SELECT
    CASE WHEN COUNT(*) = 10 THEN 'PASS' ELSE 'FAIL' END AS clinical_confinement_columns
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = 'bookings'
  AND column_name IN (
      'admission_type', 'source_visit_id', 'source_diagnosis_id',
      'source_grooming_booking_id', 'referred_by_vet_user_id',
      'confinement_reason', 'care_instructions', 'owner_approval_status',
      'owner_approved_at', 'billing_charge_id'
  );
