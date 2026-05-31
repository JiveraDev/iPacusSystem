CREATE TABLE IF NOT EXISTS vet_queue_assignments (
    assignment_id INT AUTO_INCREMENT PRIMARY KEY,
    queue_id INT NOT NULL,
    veterinarian_user_id INT NOT NULL,
    veterinarian_name VARCHAR(220) NULL,
    status ENUM('received', 'returned', 'completed') DEFAULT 'received',
    receved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    returned_at DATETIME NULL,
    completed_at DATETIME NULL,
    return_reason TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX vet_queue_assignments_queue_idx (queue_id),
    INDEX vet_queue_assignments_vet_idx (veterinarian_user_id),
    INDEX vet_queue_assignments_status_idx (queue_id, status),
    CONSTRAINT vet_queue_assignments_queue_fk
        FOREIGN KEY (queue_id) REFERENCES queues (queue_id)
        ON DELETE CASCADE,
    CONSTRAINT vet_queue_assignments_vet_fk
        FOREIGN KEY (veterinarian_user_id) REFERENCES users (user_id)
);
