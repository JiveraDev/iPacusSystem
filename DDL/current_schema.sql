-- Database DDL export
-- Database: ipawcus_system
-- Generated: 2026-05-30T13:49:55+00:00
-- Tables: 27
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
-- Table: bookings
-- --------------------------------------------------------

DROP TABLE IF EXISTS `bookings`;
CREATE TABLE `bookings` (
  `booking_id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `pet_id` int(11) DEFAULT NULL,
  `booking_number` varchar(20) NOT NULL,
  `service_type` enum('consultation','vaccination','grooming','dental','wellness','surgery','kapon','lab-testing','parasite-control','boarding','home-service','special services') NOT NULL,
  `booking_date` date NOT NULL,
  `booking_time` time NOT NULL,
  `status` enum('pending','confirmed','completed','cancelled') DEFAULT 'pending',
  `price` decimal(10,2) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `is_home_service` tinyint(1) DEFAULT 0,
  `address` text DEFAULT NULL,
  `payment_proof_url` varchar(255) DEFAULT NULL,
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
) ENGINE=InnoDB AUTO_INCREMENT=25 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

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
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Table: queues
-- --------------------------------------------------------

DROP TABLE IF EXISTS `queues`;
CREATE TABLE `queues` (
  `queue_id` int(11) NOT NULL AUTO_INCREMENT,
  `pet_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
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
  CONSTRAINT `queues_ibfk_1` FOREIGN KEY (`pet_id`) REFERENCES `pets_information` (`pet_id`),
  CONSTRAINT `queues_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=46 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

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
  `personal_Address` varchar(250) NOT NULL,
  `user_password` varchar(250) DEFAULT NULL,
  `emergencyNumber` varchar(100) DEFAULT NULL,
  `phoneNumber` varchar(100) DEFAULT NULL,
  `role` varchar(100) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `setProfilePic_url` varchar(250) DEFAULT NULL,
  `birthdate` date DEFAULT NULL,
  PRIMARY KEY (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

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
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

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

SET FOREIGN_KEY_CHECKS=1;
