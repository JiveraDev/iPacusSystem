-- Run this migration once before saving veterinarian diagnosis records.
-- It stores in-clinic queue/booking diagnoses and links booking-backed queues directly.

CREATE TABLE IF NOT EXISTS `vet_diagnoses` (
  `diagnosis_id` int(11) NOT NULL AUTO_INCREMENT,
  `queue_id` int(11) DEFAULT NULL,
  `booking_id` int(11) DEFAULT NULL,
  `assignment_id` int(11) DEFAULT NULL,
  `pet_id` int(11) NOT NULL,
  `veterinarian_user_id` int(11) NOT NULL,
  `veterinarian_name` varchar(220) DEFAULT NULL,
  `diagnosis_type` enum('general','custom') NOT NULL DEFAULT 'general',
  `service_name` varchar(180) DEFAULT NULL,
  `chief_complaint` text DEFAULT NULL,
  `major_symptoms` text DEFAULT NULL,
  `symptoms` text DEFAULT NULL,
  `physical_exam` text DEFAULT NULL,
  `diagnosis` text DEFAULT NULL,
  `treatment` text DEFAULT NULL,
  `lab_results` text DEFAULT NULL,
  `follow_up_date` date DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `vital_signs` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`vital_signs`)),
  `prescriptions` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`prescriptions`)),
  `custom_sections` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`custom_sections`)),
  `attachments` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`attachments`)),
  `source_uploads` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`source_uploads`)),
  `finalized_at` datetime DEFAULT current_timestamp(),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`diagnosis_id`),
  UNIQUE KEY `vet_diagnoses_queue_unique` (`queue_id`),
  KEY `vet_diagnoses_pet_idx` (`pet_id`),
  KEY `vet_diagnoses_booking_idx` (`booking_id`),
  KEY `vet_diagnoses_assignment_idx` (`assignment_id`),
  KEY `vet_diagnoses_vet_idx` (`veterinarian_user_id`),
  CONSTRAINT `vet_diagnoses_queue_fk` FOREIGN KEY (`queue_id`) REFERENCES `queues` (`queue_id`) ON DELETE SET NULL,
  CONSTRAINT `vet_diagnoses_booking_fk` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`booking_id`) ON DELETE SET NULL,
  CONSTRAINT `vet_diagnoses_assignment_fk` FOREIGN KEY (`assignment_id`) REFERENCES `vet_queue_assignments` (`assignment_id`) ON DELETE SET NULL,
  CONSTRAINT `vet_diagnoses_pet_fk` FOREIGN KEY (`pet_id`) REFERENCES `pets_information` (`pet_id`),
  CONSTRAINT `vet_diagnoses_vet_fk` FOREIGN KEY (`veterinarian_user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

SET @queue_booking_column_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'queues'
    AND column_name = 'booking_id'
);
SET @queue_booking_column_sql = IF(
  @queue_booking_column_exists = 0,
  'ALTER TABLE `queues` ADD COLUMN `booking_id` int(11) DEFAULT NULL AFTER `user_id`',
  'SELECT ''queues.booking_id already exists'' AS message'
);
PREPARE queue_booking_column_stmt FROM @queue_booking_column_sql;
EXECUTE queue_booking_column_stmt;
DEALLOCATE PREPARE queue_booking_column_stmt;

SET @queue_booking_index_exists = (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'queues'
    AND index_name = 'queues_booking_idx'
);
SET @queue_booking_index_sql = IF(
  @queue_booking_index_exists = 0,
  'CREATE INDEX `queues_booking_idx` ON `queues` (`booking_id`)',
  'SELECT ''queues_booking_idx already exists'' AS message'
);
PREPARE queue_booking_index_stmt FROM @queue_booking_index_sql;
EXECUTE queue_booking_index_stmt;
DEALLOCATE PREPARE queue_booking_index_stmt;

SET @queue_booking_fk_exists = (
  SELECT COUNT(*)
  FROM information_schema.table_constraints
  WHERE table_schema = DATABASE()
    AND table_name = 'queues'
    AND constraint_name = 'queues_booking_fk'
);
SET @queue_booking_fk_sql = IF(
  @queue_booking_fk_exists = 0,
  'ALTER TABLE `queues` ADD CONSTRAINT `queues_booking_fk` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`booking_id`) ON DELETE SET NULL',
  'SELECT ''queues_booking_fk already exists'' AS message'
);
PREPARE queue_booking_fk_stmt FROM @queue_booking_fk_sql;
EXECUTE queue_booking_fk_stmt;
DEALLOCATE PREPARE queue_booking_fk_stmt;
