-- Pet-linked, versioned prescriptions and per-dose owner schedules.
-- Apply after the baseline users, pets_information, and pet_ownership tables.

CREATE TABLE IF NOT EXISTS `prescription_plans` (
  `plan_id` int(11) NOT NULL AUTO_INCREMENT,
  `pet_id` int(11) NOT NULL,
  `owner_user_id` int(11) DEFAULT NULL,
  `veterinarian_user_id` int(11) NOT NULL,
  `source_type` varchar(40) NOT NULL,
  `source_record_id` int(11) NOT NULL,
  `source_label` varchar(180) DEFAULT NULL,
  `version_number` int(11) NOT NULL DEFAULT 1,
  `status` enum('issued','partially_started','active','completed','stopped','superseded') NOT NULL DEFAULT 'issued',
  `content_hash` char(64) NOT NULL,
  `supersedes_plan_id` int(11) DEFAULT NULL,
  `issued_at` datetime NOT NULL DEFAULT current_timestamp(),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`plan_id`),
  UNIQUE KEY `prescription_plan_source_version_unique` (`source_type`,`source_record_id`,`version_number`),
  KEY `prescription_plan_pet_status_idx` (`pet_id`,`status`,`issued_at`),
  KEY `prescription_plan_owner_status_idx` (`owner_user_id`,`status`,`issued_at`),
  KEY `prescription_plan_vet_idx` (`veterinarian_user_id`,`issued_at`),
  CONSTRAINT `prescription_plan_pet_fk` FOREIGN KEY (`pet_id`) REFERENCES `pets_information` (`pet_id`),
  CONSTRAINT `prescription_plan_owner_fk` FOREIGN KEY (`owner_user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL,
  CONSTRAINT `prescription_plan_vet_fk` FOREIGN KEY (`veterinarian_user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `prescription_plan_supersedes_fk` FOREIGN KEY (`supersedes_plan_id`) REFERENCES `prescription_plans` (`plan_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `prescription_items` (
  `item_id` int(11) NOT NULL AUTO_INCREMENT,
  `plan_id` int(11) NOT NULL,
  `client_item_key` varchar(100) DEFAULT NULL,
  `medicine` varchar(255) NOT NULL,
  `dose` varchar(120) DEFAULT NULL,
  `route` varchar(80) DEFAULT NULL,
  `times_count` int(11) NOT NULL DEFAULT 1,
  `frequency` varchar(40) NOT NULL DEFAULT 'per day',
  `schedule_type` enum('times_daily','interval_hours','weekly','monthly','as_needed') NOT NULL DEFAULT 'times_daily',
  `interval_hours` int(11) DEFAULT NULL,
  `time_slots` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`time_slots`)),
  `days_of_week` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`days_of_week`)),
  `duration_number` int(11) NOT NULL DEFAULT 1,
  `duration_unit` varchar(30) NOT NULL DEFAULT 'week',
  `instructions` text DEFAULT NULL,
  `recommended_start_date` date DEFAULT NULL,
  `start_at` datetime DEFAULT NULL,
  `end_at` datetime DEFAULT NULL,
  `status` enum('pending_start','active','completed','stopped','replaced') NOT NULL DEFAULT 'pending_start',
  `replaces_item_id` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`item_id`),
  KEY `prescription_item_plan_status_idx` (`plan_id`,`status`),
  KEY `prescription_item_replaces_idx` (`replaces_item_id`),
  CONSTRAINT `prescription_item_plan_fk` FOREIGN KEY (`plan_id`) REFERENCES `prescription_plans` (`plan_id`) ON DELETE CASCADE,
  CONSTRAINT `prescription_item_replaces_fk` FOREIGN KEY (`replaces_item_id`) REFERENCES `prescription_items` (`item_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `prescription_occurrences` (
  `occurrence_id` bigint(20) NOT NULL AUTO_INCREMENT,
  `item_id` int(11) NOT NULL,
  `due_at` datetime NOT NULL,
  `status` enum('pending','taken','skipped','missed','cancelled') NOT NULL DEFAULT 'pending',
  `completed_at` datetime DEFAULT NULL,
  `completed_by_user_id` int(11) DEFAULT NULL,
  `completion_notes` varchar(500) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`occurrence_id`),
  UNIQUE KEY `prescription_occurrence_item_due_unique` (`item_id`,`due_at`),
  KEY `prescription_occurrence_due_status_idx` (`status`,`due_at`),
  KEY `prescription_occurrence_completed_by_idx` (`completed_by_user_id`),
  CONSTRAINT `prescription_occurrence_item_fk` FOREIGN KEY (`item_id`) REFERENCES `prescription_items` (`item_id`) ON DELETE CASCADE,
  CONSTRAINT `prescription_occurrence_completed_by_fk` FOREIGN KEY (`completed_by_user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `prescription_events` (
  `event_id` bigint(20) NOT NULL AUTO_INCREMENT,
  `plan_id` int(11) NOT NULL,
  `item_id` int(11) DEFAULT NULL,
  `actor_user_id` int(11) DEFAULT NULL,
  `event_type` varchar(60) NOT NULL,
  `event_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`event_data`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`event_id`),
  KEY `prescription_event_plan_created_idx` (`plan_id`,`created_at`),
  KEY `prescription_event_item_idx` (`item_id`),
  KEY `prescription_event_actor_idx` (`actor_user_id`),
  CONSTRAINT `prescription_event_plan_fk` FOREIGN KEY (`plan_id`) REFERENCES `prescription_plans` (`plan_id`) ON DELETE CASCADE,
  CONSTRAINT `prescription_event_item_fk` FOREIGN KEY (`item_id`) REFERENCES `prescription_items` (`item_id`) ON DELETE SET NULL,
  CONSTRAINT `prescription_event_actor_fk` FOREIGN KEY (`actor_user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
