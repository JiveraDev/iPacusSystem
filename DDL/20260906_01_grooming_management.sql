    CREATE TABLE IF NOT EXISTS grooming_jobs (
        booking_id INT NOT NULL PRIMARY KEY,
        status VARCHAR(24) NOT NULL DEFAULT 'scheduled',
        performed_by VARCHAR(120) NOT NULL DEFAULT '',
        details_json LONGTEXT NOT NULL,
        version INT NOT NULL DEFAULT 1,
        published_at DATETIME NULL,
        visit_id INT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_by INT NOT NULL,
        CONSTRAINT grooming_booking_fk FOREIGN KEY (booking_id) REFERENCES bookings(booking_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    CREATE TABLE IF NOT EXISTS grooming_reviews (
        review_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        booking_id INT NOT NULL,
        veterinarian_id INT NOT NULL,
        requested_by INT NOT NULL,
        reason TEXT NOT NULL,
        outcome VARCHAR(24) NOT NULL DEFAULT 'pending',
        review_notes TEXT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        reviewed_at DATETIME NULL,
        KEY grooming_review_vet (veterinarian_id, outcome),
        CONSTRAINT grooming_review_job_fk FOREIGN KEY (booking_id) REFERENCES grooming_jobs(booking_id),
        CONSTRAINT grooming_review_vet_fk FOREIGN KEY (veterinarian_id) REFERENCES users(user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    CREATE TABLE IF NOT EXISTS grooming_photos (
        photo_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        booking_id INT NOT NULL,
        category VARCHAR(20) NOT NULL,
        caption VARCHAR(300) NOT NULL DEFAULT '',
        file_path VARCHAR(255) NOT NULL UNIQUE,
        share_with_owner TINYINT(1) NOT NULL DEFAULT 0,
        uploaded_by INT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT grooming_photo_job_fk FOREIGN KEY (booking_id) REFERENCES grooming_jobs(booking_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    CREATE TABLE IF NOT EXISTS grooming_events (
        event_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        booking_id INT NOT NULL,
        actor_id INT NOT NULL,
        action VARCHAR(40) NOT NULL,
        details_json LONGTEXT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT grooming_event_job_fk FOREIGN KEY (booking_id) REFERENCES grooming_jobs(booking_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
