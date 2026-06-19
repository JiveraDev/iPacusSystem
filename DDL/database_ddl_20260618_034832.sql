-- Database DDL export
-- Database: ipawcus_system
-- Generated: 2026-06-18T03:48:31+00:00
-- Tables: 47
-- Views: 0

SET FOREIGN_KEY_CHECKS=0;

-- --------------------------------------------------------
-- Table: admin_profiles
-- --------------------------------------------------------

DROP TABLE IF EXISTS `admin_profiles`;
CREATE TABLE `admin_profiles` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `employee_id` varchar(50) DEFAULT NULL,
  `hire_date` date DEFAULT NULL,
  `employment_status` enum('full-time','part-time','contract') DEFAULT NULL,
  `sss_number` varchar(50) DEFAULT NULL,
  `philhealth_number` varchar(50) DEFAULT NULL,
  `tin_number` varchar(50) DEFAULT NULL,
  `pagibig_number` varchar(50) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `postionn` varchar(250) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `years_of_experience` int(11) DEFAULT NULL,
  `education_history` longtext DEFAULT NULL,
  `experience_history` longtext DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `employee_id` (`employee_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `admin_profiles_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Table: boarding_assignments
-- --------------------------------------------------------

DROP TABLE IF EXISTS `boarding_assignments`;
CREATE TABLE `boarding_assignments` (
  `assignment_id` int(11) NOT NULL AUTO_INCREMENT,
  `booking_id` int(11) NOT NULL,
  `room_type` varchar(50) NOT NULL,
  `room_number` int(11) NOT NULL,
  `status` enum('reserved','occupied','checked_out','cancelled') NOT NULL DEFAULT 'reserved',
  `reserved_at` datetime DEFAULT NULL,
  `actual_check_in_at` datetime DEFAULT NULL,
  `actual_check_out_at` datetime DEFAULT NULL,
  `desired_check_out_date` date DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`assignment_id`),
  KEY `boarding_assignment_booking_idx` (`booking_id`),
  KEY `boarding_assignment_room_idx` (`room_type`,`room_number`,`status`),
  KEY `boarding_assignment_status_idx` (`status`),
  CONSTRAINT `boarding_assignment_booking_fk` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`booking_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Table: boarding_documents
-- --------------------------------------------------------

DROP TABLE IF EXISTS `boarding_documents`;
CREATE TABLE `boarding_documents` (
  `document_id` int(11) NOT NULL AUTO_INCREMENT,
  `assignment_id` int(11) DEFAULT NULL,
  `booking_id` int(11) NOT NULL,
  `pet_id` int(11) DEFAULT NULL,
  `document_type` enum('monitoring_report','boarding_history','checkout_summary','diagnosis_reference','other') NOT NULL DEFAULT 'monitoring_report',
  `title` varchar(180) NOT NULL,
  `document_path` varchar(255) NOT NULL,
  `file_name` varchar(255) DEFAULT NULL,
  `mime_type` varchar(120) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `uploaded_by_user_id` int(11) DEFAULT NULL,
  `uploaded_by_name` varchar(220) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`document_id`),
  KEY `boarding_documents_assignment_idx` (`assignment_id`),
  KEY `boarding_documents_booking_idx` (`booking_id`),
  KEY `boarding_documents_pet_idx` (`pet_id`),
  KEY `boarding_documents_uploaded_by_fk` (`uploaded_by_user_id`),
  CONSTRAINT `boarding_documents_assignment_fk` FOREIGN KEY (`assignment_id`) REFERENCES `boarding_assignments` (`assignment_id`) ON DELETE SET NULL,
  CONSTRAINT `boarding_documents_booking_fk` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`booking_id`) ON DELETE CASCADE,
  CONSTRAINT `boarding_documents_pet_fk` FOREIGN KEY (`pet_id`) REFERENCES `pets_information` (`pet_id`) ON DELETE SET NULL,
  CONSTRAINT `boarding_documents_uploaded_by_fk` FOREIGN KEY (`uploaded_by_user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Table: boarding_observations
-- --------------------------------------------------------

DROP TABLE IF EXISTS `boarding_observations`;
CREATE TABLE `boarding_observations` (
  `observation_id` int(11) NOT NULL AUTO_INCREMENT,
  `assignment_id` int(11) DEFAULT NULL,
  `booking_id` int(11) NOT NULL,
  `pet_id` int(11) DEFAULT NULL,
  `room_type` varchar(50) NOT NULL,
  `room_number` int(11) NOT NULL,
  `observation_type` varchar(40) NOT NULL,
  `notes` text NOT NULL,
  `observed_at` datetime NOT NULL DEFAULT current_timestamp(),
  `created_by_user_id` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`observation_id`),
  KEY `boarding_observation_assignment_idx` (`assignment_id`),
  KEY `boarding_observation_booking_idx` (`booking_id`),
  KEY `boarding_observation_pet_idx` (`pet_id`),
  KEY `boarding_observation_type_idx` (`observation_type`),
  KEY `boarding_observation_user_fk` (`created_by_user_id`),
  CONSTRAINT `boarding_observation_assignment_fk` FOREIGN KEY (`assignment_id`) REFERENCES `boarding_assignments` (`assignment_id`) ON DELETE SET NULL,
  CONSTRAINT `boarding_observation_booking_fk` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`booking_id`) ON DELETE CASCADE,
  CONSTRAINT `boarding_observation_pet_fk` FOREIGN KEY (`pet_id`) REFERENCES `pets_information` (`pet_id`) ON DELETE SET NULL,
  CONSTRAINT `boarding_observation_user_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Table: boarding_tasks
-- --------------------------------------------------------

DROP TABLE IF EXISTS `boarding_tasks`;
CREATE TABLE `boarding_tasks` (
  `task_id` int(11) NOT NULL AUTO_INCREMENT,
  `assignment_id` int(11) DEFAULT NULL,
  `booking_id` int(11) NOT NULL,
  `pet_id` int(11) DEFAULT NULL,
  `room_type` varchar(50) NOT NULL,
  `room_number` int(11) NOT NULL,
  `task_type` varchar(40) NOT NULL,
  `due_at` datetime NOT NULL,
  `status` enum('pending','completed','cancelled') NOT NULL DEFAULT 'pending',
  `assigned_to` varchar(120) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `created_by_user_id` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`task_id`),
  KEY `boarding_task_assignment_idx` (`assignment_id`),
  KEY `boarding_task_booking_idx` (`booking_id`),
  KEY `boarding_task_pet_idx` (`pet_id`),
  KEY `boarding_task_due_idx` (`status`,`due_at`),
  KEY `boarding_task_user_fk` (`created_by_user_id`),
  CONSTRAINT `boarding_task_assignment_fk` FOREIGN KEY (`assignment_id`) REFERENCES `boarding_assignments` (`assignment_id`) ON DELETE SET NULL,
  CONSTRAINT `boarding_task_booking_fk` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`booking_id`) ON DELETE CASCADE,
  CONSTRAINT `boarding_task_pet_fk` FOREIGN KEY (`pet_id`) REFERENCES `pets_information` (`pet_id`) ON DELETE SET NULL,
  CONSTRAINT `boarding_task_user_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Table: bookings
-- --------------------------------------------------------

DROP TABLE IF EXISTS `bookings`;
CREATE TABLE `bookings` (
  `booking_id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `pet_id` int(11) DEFAULT NULL,
  `booking_number` varchar(20) NOT NULL,
  `service_type` enum('consultation','vaccination','grooming','dental','General Check-up','surgery','kapon','lab-testing','parasite-control','boarding','home-service','special services') NOT NULL,
  `booking_date` date NOT NULL,
  `booking_time` time NOT NULL,
  `status` enum('pending','confirmed','completed','cancelled') DEFAULT 'pending',
  `price` decimal(10,2) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `is_home_service` tinyint(1) DEFAULT 0,
  `address` text DEFAULT NULL,
  `payment_proof_url` varchar(255) DEFAULT NULL,
  `payment_method` varchar(40) DEFAULT NULL,
  `payment_reference` varchar(120) DEFAULT NULL,
  `is_online_consultation` tinyint(1) DEFAULT 0,
  `veterinarian_id` varchar(50) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `Image_Booking_Concern_Path` text DEFAULT NULL,
  `registered_status` enum('Registered','Not Registered') DEFAULT NULL,
  `petType` varchar(250) DEFAULT NULL,
  `unregistered_pet_name` varchar(250) DEFAULT NULL,
  `unregistered_pet_breed` varchar(250) DEFAULT NULL,
  `unregistered_pet_age` varchar(250) DEFAULT NULL,
  `unregistered_pet_weight` varchar(250) DEFAULT NULL,
  `signature_path` text DEFAULT NULL,
  `transport_fee` decimal(10,2) DEFAULT 0.00,
  `check_in_date` date DEFAULT NULL,
  `check_out_date` date DEFAULT NULL,
  `room_size` varchar(50) DEFAULT NULL,
  `add_ons` text DEFAULT NULL,
  `emergency_contact` varchar(100) DEFAULT NULL,
  `hotel_boarding_type` enum('hotel','boarding') DEFAULT NULL,
  PRIMARY KEY (`booking_id`),
  UNIQUE KEY `booking_number` (`booking_number`),
  KEY `user_id` (`user_id`),
  KEY `pet_id` (`pet_id`),
  KEY `bookings_hotel_boarding_availability_idx` (`service_type`,`hotel_boarding_type`,`room_size`,`check_in_date`,`check_out_date`,`status`),
  CONSTRAINT `bookings_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `bookings_ibfk_2` FOREIGN KEY (`pet_id`) REFERENCES `pets_information` (`pet_id`)
) ENGINE=InnoDB AUTO_INCREMENT=27 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Table: booking_pets
-- --------------------------------------------------------

DROP TABLE IF EXISTS `booking_pets`;
CREATE TABLE `booking_pets` (
  `booking_pet_id` int(11) NOT NULL AUTO_INCREMENT,
  `booking_id` int(11) NOT NULL,
  `pet_id` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`booking_pet_id`),
  UNIQUE KEY `booking_pets_unique` (`booking_id`,`pet_id`),
  KEY `booking_pets_pet_fk` (`pet_id`),
  CONSTRAINT `booking_pets_booking_fk` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`booking_id`) ON DELETE CASCADE,
  CONSTRAINT `booking_pets_pet_fk` FOREIGN KEY (`pet_id`) REFERENCES `pets_information` (`pet_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Table: consent_files
-- --------------------------------------------------------

DROP TABLE IF EXISTS `consent_files`;
CREATE TABLE `consent_files` (
  `file_id` int(11) NOT NULL AUTO_INCREMENT,
  `file_name` varchar(255) NOT NULL,
  `file_type` varchar(10) NOT NULL,
  `file_size` varchar(20) DEFAULT NULL,
  `content` longtext DEFAULT NULL,
  `category` varchar(50) DEFAULT NULL,
  `uploaded_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`file_id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Table: email_otp_tokens
-- --------------------------------------------------------

DROP TABLE IF EXISTS `email_otp_tokens`;
CREATE TABLE `email_otp_tokens` (
  `otp_id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) DEFAULT NULL,
  `email` varchar(200) NOT NULL,
  `purpose` enum('email_verification','password_reset','password_change','payment_settings_change') NOT NULL,
  `token_hash` char(64) NOT NULL,
  `expires_at` datetime NOT NULL,
  `used_at` datetime DEFAULT NULL,
  `attempt_count` int(11) NOT NULL DEFAULT 0,
  `max_attempts` int(11) NOT NULL DEFAULT 5,
  `last_sent_at` datetime DEFAULT NULL,
  `request_ip` varchar(45) DEFAULT NULL,
  `user_agent` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`otp_id`),
  KEY `email_otp_user_purpose_idx` (`user_id`,`purpose`,`expires_at`),
  KEY `email_otp_email_purpose_idx` (`email`,`purpose`,`expires_at`),
  KEY `email_otp_token_hash_idx` (`token_hash`),
  KEY `email_otp_cleanup_idx` (`used_at`,`expires_at`),
  CONSTRAINT `email_otp_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Table: history_before_registration
-- --------------------------------------------------------

DROP TABLE IF EXISTS `history_before_registration`;
CREATE TABLE `history_before_registration` (
  `current_medication` varchar(250) DEFAULT NULL,
  `veterinarian_notes` varchar(250) DEFAULT NULL,
  `pet_id` int(11) DEFAULT NULL,
  `last_visit_Date` date DEFAULT NULL,
  KEY `pet_id` (`pet_id`),
  CONSTRAINT `history_before_registration_ibfk_1` FOREIGN KEY (`pet_id`) REFERENCES `pets_information` (`pet_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Table: inventory_batches
-- --------------------------------------------------------

DROP TABLE IF EXISTS `inventory_batches`;
CREATE TABLE `inventory_batches` (
  `batch_id` int(11) NOT NULL AUTO_INCREMENT,
  `item_id` int(11) NOT NULL,
  `batch_number` varchar(100) NOT NULL,
  `quantity` int(11) NOT NULL DEFAULT 0,
  `manufacturing_date` date DEFAULT NULL,
  `expiry_date` date DEFAULT NULL,
  `unit_cost` decimal(10,2) NOT NULL DEFAULT 0.00,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `location_id` int(11) NOT NULL,
  PRIMARY KEY (`batch_id`),
  UNIQUE KEY `item_id` (`item_id`,`batch_number`),
  KEY `inventory_batches_location_fk` (`location_id`),
  CONSTRAINT `inventory_batches_item_fk` FOREIGN KEY (`item_id`) REFERENCES `inventory_items` (`item_id`) ON DELETE CASCADE,
  CONSTRAINT `inventory_batches_location_fk` FOREIGN KEY (`location_id`) REFERENCES `inventory_locations` (`location_id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Table: inventory_items
-- --------------------------------------------------------

DROP TABLE IF EXISTS `inventory_items`;
CREATE TABLE `inventory_items` (
  `item_id` int(11) NOT NULL AUTO_INCREMENT,
  `item_name` varchar(150) NOT NULL,
  `generic_name` varchar(150) DEFAULT NULL,
  `sku` varchar(80) NOT NULL,
  `barcode` varchar(100) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `category` varchar(100) NOT NULL,
  `brand` varchar(100) DEFAULT NULL,
  `unit` varchar(50) NOT NULL,
  `reorder_level` int(11) DEFAULT 0,
  `unit_cost` decimal(10,2) NOT NULL DEFAULT 0.00,
  `expiry_warning_days` int(11) DEFAULT 90,
  `profile_image_path` varchar(255) DEFAULT NULL,
  `status` enum('active','inactive') DEFAULT 'active',
  `created_by_user_id` int(11) NOT NULL,
  `created_by_name` varchar(220) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `location_id` int(11) NOT NULL,
  PRIMARY KEY (`item_id`),
  UNIQUE KEY `sku` (`sku`),
  KEY `inventory_items_created_by_fk` (`created_by_user_id`),
  KEY `inventory_items_location_fk` (`location_id`),
  CONSTRAINT `inventory_items_created_by_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `inventory_items_location_fk` FOREIGN KEY (`location_id`) REFERENCES `inventory_locations` (`location_id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Table: inventory_locations
-- --------------------------------------------------------

DROP TABLE IF EXISTS `inventory_locations`;
CREATE TABLE `inventory_locations` (
  `location_id` int(11) NOT NULL AUTO_INCREMENT,
  `location_name` varchar(150) NOT NULL,
  `location_type` enum('branch','storage','room','area') DEFAULT 'branch',
  `address` text DEFAULT NULL,
  `status` enum('active','inactive') DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`location_id`),
  UNIQUE KEY `location_name` (`location_name`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Table: inventory_stock_movements
-- --------------------------------------------------------

DROP TABLE IF EXISTS `inventory_stock_movements`;
CREATE TABLE `inventory_stock_movements` (
  `movement_id` int(11) NOT NULL AUTO_INCREMENT,
  `item_id` int(11) NOT NULL,
  `batch_id` int(11) DEFAULT NULL,
  `movement_type` enum('add_item','stock_in','stock_out','adjustment','disposal') NOT NULL,
  `quantity_change` int(11) NOT NULL,
  `quantity_before` int(11) NOT NULL DEFAULT 0,
  `quantity_after` int(11) NOT NULL DEFAULT 0,
  `reference_type` varchar(50) DEFAULT NULL,
  `reference_id` int(11) DEFAULT NULL,
  `remarks` text DEFAULT NULL,
  `performed_by_user_id` int(11) NOT NULL,
  `performed_by_name` varchar(220) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`movement_id`),
  KEY `inventory_movements_item_fk` (`item_id`),
  KEY `inventory_movements_batch_fk` (`batch_id`),
  KEY `inventory_movements_user_fk` (`performed_by_user_id`),
  CONSTRAINT `inventory_movements_batch_fk` FOREIGN KEY (`batch_id`) REFERENCES `inventory_batches` (`batch_id`),
  CONSTRAINT `inventory_movements_item_fk` FOREIGN KEY (`item_id`) REFERENCES `inventory_items` (`item_id`),
  CONSTRAINT `inventory_movements_user_fk` FOREIGN KEY (`performed_by_user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Table: inventory_stock_receipts
-- --------------------------------------------------------

DROP TABLE IF EXISTS `inventory_stock_receipts`;
CREATE TABLE `inventory_stock_receipts` (
  `receipt_id` int(11) NOT NULL AUTO_INCREMENT,
  `receiving_date` date NOT NULL,
  `delivery_note_number` varchar(100) DEFAULT NULL,
  `proof_image_path` varchar(255) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `received_by_user_id` int(11) NOT NULL,
  `received_by_name` varchar(220) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`receipt_id`),
  KEY `inventory_receipts_received_by_fk` (`received_by_user_id`),
  CONSTRAINT `inventory_receipts_received_by_fk` FOREIGN KEY (`received_by_user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Table: inventory_stock_receipt_items
-- --------------------------------------------------------

DROP TABLE IF EXISTS `inventory_stock_receipt_items`;
CREATE TABLE `inventory_stock_receipt_items` (
  `receipt_item_id` int(11) NOT NULL AUTO_INCREMENT,
  `receipt_id` int(11) NOT NULL,
  `item_id` int(11) NOT NULL,
  `supplier_id` int(11) NOT NULL,
  `batch_id` int(11) DEFAULT NULL,
  `batch_number` varchar(100) NOT NULL,
  `quantity_received` int(11) NOT NULL,
  `expiry_date` date DEFAULT NULL,
  `unit_cost` decimal(10,2) NOT NULL DEFAULT 0.00,
  `location_id` int(11) NOT NULL,
  PRIMARY KEY (`receipt_item_id`),
  KEY `inventory_receipt_items_receipt_fk` (`receipt_id`),
  KEY `inventory_receipt_items_item_fk` (`item_id`),
  KEY `inventory_receipt_items_supplier_fk` (`supplier_id`),
  KEY `inventory_receipt_items_batch_fk` (`batch_id`),
  KEY `inventory_receipt_items_location_fk` (`location_id`),
  CONSTRAINT `inventory_receipt_items_batch_fk` FOREIGN KEY (`batch_id`) REFERENCES `inventory_batches` (`batch_id`),
  CONSTRAINT `inventory_receipt_items_item_fk` FOREIGN KEY (`item_id`) REFERENCES `inventory_items` (`item_id`),
  CONSTRAINT `inventory_receipt_items_location_fk` FOREIGN KEY (`location_id`) REFERENCES `inventory_locations` (`location_id`),
  CONSTRAINT `inventory_receipt_items_receipt_fk` FOREIGN KEY (`receipt_id`) REFERENCES `inventory_stock_receipts` (`receipt_id`) ON DELETE CASCADE,
  CONSTRAINT `inventory_receipt_items_supplier_fk` FOREIGN KEY (`supplier_id`) REFERENCES `inventory_suppliers` (`supplier_id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Table: inventory_suppliers
-- --------------------------------------------------------

DROP TABLE IF EXISTS `inventory_suppliers`;
CREATE TABLE `inventory_suppliers` (
  `supplier_id` int(11) NOT NULL AUTO_INCREMENT,
  `supplier_name` varchar(150) NOT NULL,
  `contact_number` varchar(100) DEFAULT NULL,
  `email` varchar(150) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `status` enum('active','inactive') DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`supplier_id`),
  UNIQUE KEY `supplier_name` (`supplier_name`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Table: notification_preferences
-- --------------------------------------------------------

DROP TABLE IF EXISTS `notification_preferences`;
CREATE TABLE `notification_preferences` (
  `user_id` int(11) NOT NULL,
  `email_enabled` tinyint(1) NOT NULL DEFAULT 1,
  `in_app_enabled` tinyint(1) NOT NULL DEFAULT 1,
  `browser_push_enabled` tinyint(1) NOT NULL DEFAULT 0,
  `booking_updates` tinyint(1) NOT NULL DEFAULT 1,
  `schedule_reminders` tinyint(1) NOT NULL DEFAULT 1,
  `payment_updates` tinyint(1) NOT NULL DEFAULT 1,
  `diagnosis_updates` tinyint(1) NOT NULL DEFAULT 1,
  `queue_updates` tinyint(1) NOT NULL DEFAULT 1,
  `boarding_updates` tinyint(1) NOT NULL DEFAULT 1,
  `reminder_24h` tinyint(1) NOT NULL DEFAULT 1,
  `reminder_2h` tinyint(1) NOT NULL DEFAULT 1,
  `reminder_same_day` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`user_id`),
  CONSTRAINT `notification_preferences_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Table: notification_push_subscriptions
-- --------------------------------------------------------

DROP TABLE IF EXISTS `notification_push_subscriptions`;
CREATE TABLE `notification_push_subscriptions` (
  `subscription_id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `endpoint` text NOT NULL,
  `endpoint_hash` char(64) NOT NULL,
  `p256dh` text DEFAULT NULL,
  `auth` text DEFAULT NULL,
  `content_encoding` varchar(40) DEFAULT 'aes128gcm',
  `user_agent` text DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `last_sent_at` datetime DEFAULT NULL,
  `last_error` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`subscription_id`),
  UNIQUE KEY `notification_push_endpoint_unique` (`endpoint_hash`),
  KEY `notification_push_user_active_idx` (`user_id`,`is_active`),
  CONSTRAINT `notification_push_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Table: online_consultations
-- --------------------------------------------------------

DROP TABLE IF EXISTS `online_consultations`;
CREATE TABLE `online_consultations` (
  `online_consultation_id` int(11) NOT NULL AUTO_INCREMENT,
  `booking_id` int(11) NOT NULL,
  `owner_user_id` int(11) NOT NULL,
  `veterinarian_user_id` int(11) NOT NULL,
  `scheduled_start` datetime NOT NULL,
  `scheduled_end` datetime NOT NULL,
  `meeting_provider` enum('google_meet','jitsi','manual') DEFAULT 'google_meet',
  `meeting_url` text DEFAULT NULL,
  `meeting_code` varchar(150) DEFAULT NULL,
  `google_calendar_event_id` varchar(255) DEFAULT NULL,
  `status` enum('scheduled','vet_ready','in_progress','completed','cancelled','no_show') DEFAULT 'scheduled',
  `vet_started_at` datetime DEFAULT NULL,
  `owner_joined_at` datetime DEFAULT NULL,
  `ended_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`online_consultation_id`),
  UNIQUE KEY `booking_id` (`booking_id`),
  KEY `owner_user_id` (`owner_user_id`),
  KEY `veterinarian_user_id` (`veterinarian_user_id`),
  CONSTRAINT `online_consultations_ibfk_1` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`booking_id`) ON DELETE CASCADE,
  CONSTRAINT `online_consultations_ibfk_2` FOREIGN KEY (`owner_user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `online_consultations_ibfk_3` FOREIGN KEY (`veterinarian_user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Table: online_consultation_diagnoses
-- --------------------------------------------------------

DROP TABLE IF EXISTS `online_consultation_diagnoses`;
CREATE TABLE `online_consultation_diagnoses` (
  `diagnosis_id` int(11) NOT NULL AUTO_INCREMENT,
  `online_consultation_id` int(11) NOT NULL,
  `booking_id` int(11) NOT NULL,
  `veterinarian_user_id` int(11) NOT NULL,
  `diagnosis` text NOT NULL,
  `recommendations` text DEFAULT NULL,
  `treatment` text DEFAULT NULL,
  `medications` text DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `vital_signs` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`vital_signs`)),
  `symptoms` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`symptoms`)),
  `lab_tests` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`lab_tests`)),
  `finalized_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`diagnosis_id`),
  UNIQUE KEY `online_consultation_id` (`online_consultation_id`),
  KEY `booking_id` (`booking_id`),
  KEY `veterinarian_user_id` (`veterinarian_user_id`),
  CONSTRAINT `online_consultation_diagnoses_ibfk_1` FOREIGN KEY (`online_consultation_id`) REFERENCES `online_consultations` (`online_consultation_id`),
  CONSTRAINT `online_consultation_diagnoses_ibfk_2` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`booking_id`),
  CONSTRAINT `online_consultation_diagnoses_ibfk_3` FOREIGN KEY (`veterinarian_user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Table: online_consultation_reschedules
-- --------------------------------------------------------

DROP TABLE IF EXISTS `online_consultation_reschedules`;
CREATE TABLE `online_consultation_reschedules` (
  `reschedule_id` int(11) NOT NULL AUTO_INCREMENT,
  `online_consultation_id` int(11) NOT NULL,
  `old_start` datetime NOT NULL,
  `old_end` datetime NOT NULL,
  `new_start` datetime NOT NULL,
  `new_end` datetime NOT NULL,
  `reason` text DEFAULT NULL,
  `changed_by_user_id` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`reschedule_id`),
  KEY `online_consultation_id` (`online_consultation_id`),
  KEY `changed_by_user_id` (`changed_by_user_id`),
  CONSTRAINT `online_consultation_reschedules_ibfk_1` FOREIGN KEY (`online_consultation_id`) REFERENCES `online_consultations` (`online_consultation_id`),
  CONSTRAINT `online_consultation_reschedules_ibfk_2` FOREIGN KEY (`changed_by_user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Table: payment_methods
-- --------------------------------------------------------

DROP TABLE IF EXISTS `payment_methods`;
CREATE TABLE `payment_methods` (
  `method_key` varchar(40) NOT NULL,
  `label` varchar(80) NOT NULL,
  `account_name` varchar(140) DEFAULT NULL,
  `account_number` varchar(140) DEFAULT NULL,
  `instructions` text DEFAULT NULL,
  `qr_image_url` varchar(255) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `requires_proof` tinyint(1) NOT NULL DEFAULT 1,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `updated_by_user_id` int(11) DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`method_key`),
  KEY `payment_methods_sort_idx` (`is_active`,`sort_order`),
  KEY `payment_methods_updated_by_idx` (`updated_by_user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Table: pets_information
-- --------------------------------------------------------

DROP TABLE IF EXISTS `pets_information`;
CREATE TABLE `pets_information` (
  `pet_id` int(11) NOT NULL AUTO_INCREMENT,
  `pet_name` varchar(250) NOT NULL,
  `pet_species` varchar(100) NOT NULL,
  `pet_breed` varchar(250) NOT NULL,
  `pet_BDAY` date NOT NULL,
  `pet_status` enum('Healthy','Emergency','Deceased') NOT NULL DEFAULT 'Healthy',
  `pet_gender` varchar(250) NOT NULL,
  `pet_weight` decimal(8,2) NOT NULL,
  `pet_microchip` int(11) DEFAULT NULL,
  `pet_Temp_owner` varchar(250) DEFAULT NULL,
  `pet_allergies` varchar(250) DEFAULT NULL,
  `pet_color_marking` varchar(250) DEFAULT NULL,
  `pet_sharable_ID` varchar(250) DEFAULT NULL,
  `pet_age` varchar(250) DEFAULT NULL,
  `setpetImage_url` varchar(250) DEFAULT NULL,
  PRIMARY KEY (`pet_id`),
  UNIQUE KEY `pet_sharable_ID` (`pet_sharable_ID`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Table: pet_allergies
-- --------------------------------------------------------

DROP TABLE IF EXISTS `pet_allergies`;
CREATE TABLE `pet_allergies` (
  `allergy_id` int(11) NOT NULL AUTO_INCREMENT,
  `pet_id` int(11) NOT NULL,
  `allergen` varchar(255) NOT NULL,
  `severity` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`allergy_id`),
  KEY `pet_id` (`pet_id`),
  CONSTRAINT `pet_allergies_ibfk_1` FOREIGN KEY (`pet_id`) REFERENCES `pets_information` (`pet_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Table: pet_medical_record_groups
-- --------------------------------------------------------

DROP TABLE IF EXISTS `pet_medical_record_groups`;
CREATE TABLE `pet_medical_record_groups` (
  `group_id` int(11) NOT NULL AUTO_INCREMENT,
  `pet_id` int(11) NOT NULL,
  `title` varchar(180) NOT NULL,
  `summary` text DEFAULT NULL,
  `visible_to_owner` tinyint(1) NOT NULL DEFAULT 1,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `created_by_user_id` int(11) DEFAULT NULL,
  `updated_by_user_id` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`group_id`),
  KEY `pet_medical_record_groups_pet_idx` (`pet_id`,`sort_order`,`group_id`),
  KEY `pet_medical_record_groups_created_by_idx` (`created_by_user_id`),
  KEY `pet_medical_record_groups_updated_by_idx` (`updated_by_user_id`),
  CONSTRAINT `pet_medical_record_groups_pet_fk` FOREIGN KEY (`pet_id`) REFERENCES `pets_information` (`pet_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Table: pet_medical_record_group_items
-- --------------------------------------------------------

DROP TABLE IF EXISTS `pet_medical_record_group_items`;
CREATE TABLE `pet_medical_record_group_items` (
  `item_id` int(11) NOT NULL AUTO_INCREMENT,
  `group_id` int(11) NOT NULL,
  `source_type` varchar(40) NOT NULL,
  `source_id` int(11) DEFAULT NULL,
  `title` varchar(180) NOT NULL,
  `summary` text DEFAULT NULL,
  `revision_notes` text DEFAULT NULL,
  `service_date` datetime DEFAULT NULL,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `source_snapshot` longtext DEFAULT NULL,
  `added_by_user_id` int(11) DEFAULT NULL,
  `updated_by_user_id` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`item_id`),
  KEY `pet_medical_record_group_items_group_idx` (`group_id`,`sort_order`,`item_id`),
  KEY `pet_medical_record_group_items_source_idx` (`source_type`,`source_id`),
  KEY `pet_medical_record_group_items_added_by_idx` (`added_by_user_id`),
  KEY `pet_medical_record_group_items_updated_by_idx` (`updated_by_user_id`),
  CONSTRAINT `pet_medical_record_group_items_group_fk` FOREIGN KEY (`group_id`) REFERENCES `pet_medical_record_groups` (`group_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Table: pet_ownership
-- --------------------------------------------------------

DROP TABLE IF EXISTS `pet_ownership`;
CREATE TABLE `pet_ownership` (
  `link_id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) DEFAULT NULL,
  `pet_id` int(11) DEFAULT NULL,
  `linked_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`link_id`),
  UNIQUE KEY `pet_id` (`pet_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `pet_ownership_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `pet_ownership_ibfk_2` FOREIGN KEY (`pet_id`) REFERENCES `pets_information` (`pet_id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Table: pet_owner_todos
-- --------------------------------------------------------

DROP TABLE IF EXISTS `pet_owner_todos`;
CREATE TABLE `pet_owner_todos` (
  `todo_id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `title` varchar(180) NOT NULL,
  `details` text DEFAULT NULL,
  `category` varchar(80) NOT NULL DEFAULT 'Personal Task',
  `start_at` datetime NOT NULL,
  `end_at` datetime DEFAULT NULL,
  `status` enum('pending','completed','cancelled') NOT NULL DEFAULT 'pending',
  `completed_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`todo_id`),
  KEY `pet_owner_todos_user_start_idx` (`user_id`,`start_at`),
  KEY `pet_owner_todos_user_status_idx` (`user_id`,`status`),
  CONSTRAINT `pet_owner_todos_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Table: pet_record_update_requests
-- --------------------------------------------------------

DROP TABLE IF EXISTS `pet_record_update_requests`;
CREATE TABLE `pet_record_update_requests` (
  `request_id` int(11) NOT NULL AUTO_INCREMENT,
  `request_number` varchar(32) NOT NULL,
  `pet_id` int(11) NOT NULL,
  `owner_user_id` int(11) DEFAULT NULL,
  `requested_changes` text DEFAULT NULL,
  `payment_method` varchar(40) NOT NULL DEFAULT 'qrph',
  `payment_amount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `payment_status` enum('pending','submitted','verified','waived','rejected') NOT NULL DEFAULT 'pending',
  `payment_proof_url` varchar(255) DEFAULT NULL,
  `status` enum('pending_admin_review','approved','rejected','assigned','in_progress','completed','cancelled') NOT NULL DEFAULT 'pending_admin_review',
  `admin_notes` text DEFAULT NULL,
  `veterinarian_notes` text DEFAULT NULL,
  `assigned_veterinarian_user_id` int(11) DEFAULT NULL,
  `reviewed_by_user_id` int(11) DEFAULT NULL,
  `completed_by_user_id` int(11) DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`request_id`),
  UNIQUE KEY `request_number` (`request_number`),
  KEY `record_update_pet_idx` (`pet_id`,`status`),
  KEY `record_update_owner_idx` (`owner_user_id`,`created_at`),
  KEY `record_update_status_idx` (`status`,`payment_status`),
  KEY `record_update_vet_idx` (`assigned_veterinarian_user_id`,`status`),
  KEY `record_update_reviewed_by_fk` (`reviewed_by_user_id`),
  KEY `record_update_completed_by_fk` (`completed_by_user_id`),
  CONSTRAINT `record_update_assigned_vet_fk` FOREIGN KEY (`assigned_veterinarian_user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL,
  CONSTRAINT `record_update_completed_by_fk` FOREIGN KEY (`completed_by_user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL,
  CONSTRAINT `record_update_owner_fk` FOREIGN KEY (`owner_user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL,
  CONSTRAINT `record_update_pet_fk` FOREIGN KEY (`pet_id`) REFERENCES `pets_information` (`pet_id`) ON DELETE CASCADE,
  CONSTRAINT `record_update_reviewed_by_fk` FOREIGN KEY (`reviewed_by_user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Table: pet_vaccinations
-- --------------------------------------------------------

DROP TABLE IF EXISTS `pet_vaccinations`;
CREATE TABLE `pet_vaccinations` (
  `vax_id` int(11) NOT NULL AUTO_INCREMENT,
  `pet_id` int(11) NOT NULL,
  `vax_name` varchar(255) NOT NULL,
  `vax_date` date NOT NULL,
  `vax_next_due` date NOT NULL,
  `vax_applicator` varchar(255) DEFAULT NULL,
  `vax_status` enum('completed','pending') DEFAULT 'completed',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`vax_id`),
  KEY `pet_id` (`pet_id`),
  CONSTRAINT `pet_vaccinations_ibfk_1` FOREIGN KEY (`pet_id`) REFERENCES `pets_information` (`pet_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Table: queues
-- --------------------------------------------------------

DROP TABLE IF EXISTS `queues`;
CREATE TABLE `queues` (
  `queue_id` int(11) NOT NULL AUTO_INCREMENT,
  `pet_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `booking_id` int(11) DEFAULT NULL,
  `service_name` varchar(100) NOT NULL,
  `queue_number` int(11) NOT NULL,
  `status` enum('waiting','in-progress','completed','cancelled') DEFAULT 'waiting',
  `priority` enum('normal','urgent') DEFAULT 'normal',
  `complaint` text DEFAULT NULL,
  `image_path` varchar(255) DEFAULT NULL,
  `signiture_self_service_path` varchar(250) DEFAULT NULL,
  `queue_source` varchar(50) DEFAULT 'admin',
  `verified_by_admin` tinyint(1) DEFAULT 0,
  `timestamp` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`queue_id`),
  KEY `pet_id` (`pet_id`),
  KEY `user_id` (`user_id`),
  KEY `queues_booking_idx` (`booking_id`),
  CONSTRAINT `queues_booking_fk` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`booking_id`) ON DELETE SET NULL,
  CONSTRAINT `queues_ibfk_1` FOREIGN KEY (`pet_id`) REFERENCES `pets_information` (`pet_id`),
  CONSTRAINT `queues_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=51 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Table: rooms
-- --------------------------------------------------------

DROP TABLE IF EXISTS `rooms`;
CREATE TABLE `rooms` (
  `room_id` int(11) NOT NULL AUTO_INCREMENT,
  `room_type` enum('hotel-small','hotel-medium','hotel-large','boarding-small','boarding-medium','boarding-large') NOT NULL,
  `total_capacity` int(11) NOT NULL,
  `description` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`room_id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Table: room_unit_statuses
-- --------------------------------------------------------

DROP TABLE IF EXISTS `room_unit_statuses`;
CREATE TABLE `room_unit_statuses` (
  `room_unit_status_id` int(11) NOT NULL AUTO_INCREMENT,
  `room_type` varchar(50) NOT NULL,
  `room_number` int(11) NOT NULL,
  `status` enum('available','maintenance') NOT NULL DEFAULT 'available',
  `notes` text DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`room_unit_status_id`),
  UNIQUE KEY `room_unit_status_unique` (`room_type`,`room_number`),
  KEY `room_unit_status_lookup` (`room_type`,`status`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Table: service_catalog
-- --------------------------------------------------------

DROP TABLE IF EXISTS `service_catalog`;
CREATE TABLE `service_catalog` (
  `service_id` int(11) NOT NULL AUTO_INCREMENT,
  `service_code` varchar(80) DEFAULT NULL,
  `service_name` varchar(150) NOT NULL,
  `service_type` enum('consultation','vaccination','laboratory','surgery','grooming','boarding','dental','home_service','other') NOT NULL,
  `description` text DEFAULT NULL,
  `base_price` decimal(10,2) NOT NULL DEFAULT 0.00,
  `is_major_service` tinyint(1) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) DEFAULT 1,
  `created_by_user_id` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`service_id`),
  UNIQUE KEY `service_catalog_code_unique` (`service_code`),
  KEY `service_catalog_type_idx` (`service_type`,`is_active`),
  KEY `service_catalog_created_by_fk` (`created_by_user_id`),
  CONSTRAINT `service_catalog_created_by_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Table: service_materials
-- --------------------------------------------------------

DROP TABLE IF EXISTS `service_materials`;
CREATE TABLE `service_materials` (
  `service_material_id` int(11) NOT NULL AUTO_INCREMENT,
  `service_id` int(11) NOT NULL,
  `item_id` int(11) DEFAULT NULL,
  `material_name` varchar(180) NOT NULL,
  `qty_used` decimal(10,2) NOT NULL DEFAULT 1.00,
  `billable_policy` enum('included','separate','optional') DEFAULT 'included',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`service_material_id`),
  KEY `service_id` (`service_id`),
  KEY `item_id` (`item_id`),
  CONSTRAINT `service_materials_ibfk_1` FOREIGN KEY (`service_id`) REFERENCES `service_catalog` (`service_id`),
  CONSTRAINT `service_materials_ibfk_2` FOREIGN KEY (`item_id`) REFERENCES `inventory_items` (`item_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Table: special_service_booking_items
-- --------------------------------------------------------

DROP TABLE IF EXISTS `special_service_booking_items`;
CREATE TABLE `special_service_booking_items` (
  `booking_special_service_id` int(11) NOT NULL AUTO_INCREMENT,
  `booking_id` int(11) NOT NULL,
  `special_service_id` int(11) DEFAULT NULL,
  `custom_service_title` varchar(150) DEFAULT NULL,
  `custom_service_description` text DEFAULT NULL,
  `custom_service_details` text DEFAULT NULL,
  `sequence_no` int(11) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`booking_special_service_id`),
  KEY `special_service_booking_items_booking_fk` (`booking_id`),
  KEY `special_service_booking_items_catalog_fk` (`special_service_id`),
  CONSTRAINT `special_service_booking_items_booking_fk` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`booking_id`) ON DELETE CASCADE,
  CONSTRAINT `special_service_booking_items_catalog_fk` FOREIGN KEY (`special_service_id`) REFERENCES `special_service_catalog` (`special_service_id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Table: special_service_catalog
-- --------------------------------------------------------

DROP TABLE IF EXISTS `special_service_catalog`;
CREATE TABLE `special_service_catalog` (
  `special_service_id` int(11) NOT NULL AUTO_INCREMENT,
  `service_code` varchar(60) NOT NULL,
  `service_title` varchar(150) NOT NULL,
  `service_description` text DEFAULT NULL,
  `service_details` text DEFAULT NULL,
  `price_label` varchar(100) DEFAULT NULL,
  `duration_label` varchar(100) DEFAULT NULL,
  `max_pets` int(11) NOT NULL DEFAULT 1,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `date_restriction_type` enum('none','single','range') DEFAULT 'none',
  `date_start` date DEFAULT NULL,
  `date_end` date DEFAULT NULL,
  `created_by_user_id` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`special_service_id`),
  UNIQUE KEY `service_code` (`service_code`),
  KEY `special_service_catalog_user_fk` (`created_by_user_id`),
  CONSTRAINT `special_service_catalog_user_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Table: users
-- --------------------------------------------------------

DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `user_id` int(11) NOT NULL AUTO_INCREMENT,
  `first_Name` varchar(100) DEFAULT NULL,
  `last_Name` varchar(100) NOT NULL,
  `mail_Address` varchar(200) NOT NULL,
  `email_verified_at` datetime DEFAULT NULL,
  `personal_Address` varchar(250) NOT NULL,
  `user_password` varchar(250) DEFAULT NULL,
  `password_changed_at` datetime DEFAULT NULL,
  `emergencyNumber` varchar(100) DEFAULT NULL,
  `phoneNumber` varchar(100) DEFAULT NULL,
  `role` varchar(100) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `setProfilePic_url` varchar(250) DEFAULT NULL,
  `birthdate` date DEFAULT NULL,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `users_mail_address_unique` (`mail_Address`)
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Table: user_notifications
-- --------------------------------------------------------

DROP TABLE IF EXISTS `user_notifications`;
CREATE TABLE `user_notifications` (
  `notification_id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `type` varchar(80) NOT NULL DEFAULT 'system',
  `category` varchar(80) NOT NULL DEFAULT 'system',
  `title` varchar(180) NOT NULL,
  `message` text DEFAULT NULL,
  `push_title` varchar(180) DEFAULT NULL,
  `push_message` text DEFAULT NULL,
  `redirect_path` varchar(255) DEFAULT NULL,
  `in_app_visible` tinyint(1) NOT NULL DEFAULT 1,
  `dedupe_key` varchar(180) DEFAULT NULL,
  `email_subject` varchar(180) DEFAULT NULL,
  `email_status` enum('not_sent','sent','failed','skipped') NOT NULL DEFAULT 'not_sent',
  `email_sent_at` datetime DEFAULT NULL,
  `email_error` text DEFAULT NULL,
  `push_status` enum('not_sent','sent','failed','skipped') NOT NULL DEFAULT 'not_sent',
  `push_sent_at` datetime DEFAULT NULL,
  `push_error` text DEFAULT NULL,
  `read_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`notification_id`),
  UNIQUE KEY `user_notifications_dedupe_unique` (`user_id`,`dedupe_key`),
  KEY `user_notifications_user_created_idx` (`user_id`,`created_at`),
  KEY `user_notifications_user_read_idx` (`user_id`,`read_at`),
  CONSTRAINT `user_notifications_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Table: veterinarian_profiles
-- --------------------------------------------------------

DROP TABLE IF EXISTS `veterinarian_profiles`;
CREATE TABLE `veterinarian_profiles` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `veterinarian_id` varchar(50) DEFAULT NULL,
  `prc_license_number` varchar(50) DEFAULT NULL,
  `specialization` text DEFAULT NULL,
  `consultation_rate` decimal(10,2) DEFAULT NULL,
  `years_of_experience` int(11) DEFAULT NULL,
  `hire_date` date DEFAULT NULL,
  `is_accepting_patients` tinyint(1) DEFAULT 1,
  `is_active` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `education_history` longtext DEFAULT NULL,
  `experience_history` longtext DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `veterinarian_id` (`veterinarian_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `veterinarian_profiles_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Table: vet_diagnoses
-- --------------------------------------------------------

DROP TABLE IF EXISTS `vet_diagnoses`;
CREATE TABLE `vet_diagnoses` (
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
  CONSTRAINT `vet_diagnoses_assignment_fk` FOREIGN KEY (`assignment_id`) REFERENCES `vet_queue_assignments` (`assignment_id`) ON DELETE SET NULL,
  CONSTRAINT `vet_diagnoses_booking_fk` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`booking_id`) ON DELETE SET NULL,
  CONSTRAINT `vet_diagnoses_pet_fk` FOREIGN KEY (`pet_id`) REFERENCES `pets_information` (`pet_id`),
  CONSTRAINT `vet_diagnoses_queue_fk` FOREIGN KEY (`queue_id`) REFERENCES `queues` (`queue_id`) ON DELETE SET NULL,
  CONSTRAINT `vet_diagnoses_vet_fk` FOREIGN KEY (`veterinarian_user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Table: vet_queue_assignments
-- --------------------------------------------------------

DROP TABLE IF EXISTS `vet_queue_assignments`;
CREATE TABLE `vet_queue_assignments` (
  `assignment_id` int(11) NOT NULL AUTO_INCREMENT,
  `queue_id` int(11) NOT NULL,
  `veterinarian_user_id` int(11) NOT NULL,
  `veterinarian_name` varchar(220) DEFAULT NULL,
  `status` enum('received','returned','completed') DEFAULT 'received',
  `received_at` datetime DEFAULT current_timestamp(),
  `returned_at` datetime DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `return_reason` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`assignment_id`),
  KEY `vet_queue_assignments_queue_idx` (`queue_id`),
  KEY `vet_queue_assignments_vet_idx` (`veterinarian_user_id`),
  KEY `vet_queue_assignments_status_idx` (`queue_id`,`status`),
  CONSTRAINT `vet_queue_assignments_queue_fk` FOREIGN KEY (`queue_id`) REFERENCES `queues` (`queue_id`) ON DELETE CASCADE,
  CONSTRAINT `vet_queue_assignments_vet_fk` FOREIGN KEY (`veterinarian_user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Table: vet_schedules
-- --------------------------------------------------------

DROP TABLE IF EXISTS `vet_schedules`;
CREATE TABLE `vet_schedules` (
  `schedule_id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `day_of_week` varchar(20) NOT NULL,
  `time_slot` varchar(20) NOT NULL,
  `is_available` tinyint(1) DEFAULT 1,
  PRIMARY KEY (`schedule_id`),
  KEY `vet_schedules_fk` (`user_id`),
  CONSTRAINT `vet_schedules_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Table: visits
-- --------------------------------------------------------

DROP TABLE IF EXISTS `visits`;
CREATE TABLE `visits` (
  `visit_id` int(11) NOT NULL AUTO_INCREMENT,
  `pet_id` int(11) NOT NULL,
  `owner_user_id` int(11) NOT NULL,
  `veterinarian_user_id` int(11) DEFAULT NULL,
  `queue_id` int(11) DEFAULT NULL,
  `booking_id` int(11) DEFAULT NULL,
  `diagnosis_id` int(11) DEFAULT NULL,
  `source_type` enum('queue','booking','walk_in','boarding','manual') NOT NULL DEFAULT 'manual',
  `visit_status` enum('waiting','in_consultation','treatment_done','completed','cancelled') DEFAULT 'waiting',
  `billing_status` enum('unbilled','unpaid','partial','paid','refunded') DEFAULT 'unbilled',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`visit_id`),
  KEY `pet_id` (`pet_id`),
  KEY `owner_user_id` (`owner_user_id`),
  KEY `veterinarian_user_id` (`veterinarian_user_id`),
  KEY `queue_id` (`queue_id`),
  KEY `booking_id` (`booking_id`),
  KEY `visits_diagnosis_idx` (`diagnosis_id`),
  CONSTRAINT `visits_diagnosis_fk` FOREIGN KEY (`diagnosis_id`) REFERENCES `vet_diagnoses` (`diagnosis_id`) ON DELETE SET NULL,
  CONSTRAINT `visits_ibfk_1` FOREIGN KEY (`pet_id`) REFERENCES `pets_information` (`pet_id`),
  CONSTRAINT `visits_ibfk_2` FOREIGN KEY (`owner_user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `visits_ibfk_3` FOREIGN KEY (`veterinarian_user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `visits_ibfk_4` FOREIGN KEY (`queue_id`) REFERENCES `queues` (`queue_id`),
  CONSTRAINT `visits_ibfk_5` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`booking_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Table: visit_charges
-- --------------------------------------------------------

DROP TABLE IF EXISTS `visit_charges`;
CREATE TABLE `visit_charges` (
  `charge_id` int(11) NOT NULL AUTO_INCREMENT,
  `visit_id` int(11) NOT NULL,
  `charge_type` enum('service','diagnostic','medication','consumable','retail_product','boarding','other') NOT NULL,
  `service_id` int(11) DEFAULT NULL,
  `item_id` int(11) DEFAULT NULL,
  `description` varchar(255) NOT NULL,
  `quantity` decimal(10,2) NOT NULL DEFAULT 1.00,
  `unit_price` decimal(10,2) NOT NULL DEFAULT 0.00,
  `subtotal` decimal(10,2) NOT NULL DEFAULT 0.00,
  `created_by_user_id` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`charge_id`),
  KEY `visit_id` (`visit_id`),
  KEY `service_id` (`service_id`),
  KEY `item_id` (`item_id`),
  CONSTRAINT `visit_charges_ibfk_1` FOREIGN KEY (`visit_id`) REFERENCES `visits` (`visit_id`),
  CONSTRAINT `visit_charges_ibfk_2` FOREIGN KEY (`service_id`) REFERENCES `service_catalog` (`service_id`),
  CONSTRAINT `visit_charges_ibfk_3` FOREIGN KEY (`item_id`) REFERENCES `inventory_items` (`item_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Table: visit_payments
-- --------------------------------------------------------

DROP TABLE IF EXISTS `visit_payments`;
CREATE TABLE `visit_payments` (
  `payment_id` int(11) NOT NULL AUTO_INCREMENT,
  `visit_id` int(11) NOT NULL,
  `payment_method` enum('qrph','gcash','maya','bank_transfer') NOT NULL DEFAULT 'gcash',
  `payment_status` enum('pending','verified','failed','refunded','voided') NOT NULL DEFAULT 'verified',
  `amount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `reference_number` varchar(120) DEFAULT NULL,
  `proof_url` varchar(255) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `paid_at` datetime NOT NULL DEFAULT current_timestamp(),
  `received_by_user_id` int(11) DEFAULT NULL,
  `received_by_name` varchar(220) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`payment_id`),
  KEY `visit_payments_visit_idx` (`visit_id`),
  KEY `visit_payments_received_by_fk` (`received_by_user_id`),
  CONSTRAINT `visit_payments_received_by_fk` FOREIGN KEY (`received_by_user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL,
  CONSTRAINT `visit_payments_visit_fk` FOREIGN KEY (`visit_id`) REFERENCES `visits` (`visit_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

SET FOREIGN_KEY_CHECKS=1;
