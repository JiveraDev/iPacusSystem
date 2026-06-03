-- Pet hotel and boarding room-unit workflow.
-- Run this manually before using the updated boarding management screens.

CREATE TABLE IF NOT EXISTS room_unit_statuses (
    room_unit_status_id INT AUTO_INCREMENT PRIMARY KEY,
    room_type VARCHAR(50) NOT NULL,
    room_number INT NOT NULL,
    status ENUM('available', 'maintenance') NOT NULL DEFAULT 'available',
    notes TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY room_unit_status_unique (room_type, room_number),
    KEY room_unit_status_lookup (room_type, status)
);

CREATE TABLE IF NOT EXISTS boarding_assignments (
    assignment_id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL,
    room_type VARCHAR(50) NOT NULL,
    room_number INT NOT NULL,
    status ENUM('reserved', 'occupied', 'checked_out', 'cancelled') NOT NULL DEFAULT 'reserved',
    reserved_at DATETIME DEFAULT NULL,
    actual_check_in_at DATETIME DEFAULT NULL,
    actual_check_out_at DATETIME DEFAULT NULL,
    desired_check_out_date DATE DEFAULT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL ON UPDATE CURRENT_TIMESTAMP,
    KEY boarding_assignment_booking_idx (booking_id),
    KEY boarding_assignment_room_idx (room_type, room_number, status),
    KEY boarding_assignment_status_idx (status),
    CONSTRAINT boarding_assignment_booking_fk
        FOREIGN KEY (booking_id) REFERENCES bookings (booking_id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS boarding_observations (
    observation_id INT AUTO_INCREMENT PRIMARY KEY,
    assignment_id INT DEFAULT NULL,
    booking_id INT NOT NULL,
    pet_id INT DEFAULT NULL,
    room_type VARCHAR(50) NOT NULL,
    room_number INT NOT NULL,
    observation_type VARCHAR(40) NOT NULL,
    notes TEXT NOT NULL,
    observed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by_user_id INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    KEY boarding_observation_assignment_idx (assignment_id),
    KEY boarding_observation_booking_idx (booking_id),
    KEY boarding_observation_pet_idx (pet_id),
    KEY boarding_observation_type_idx (observation_type),
    CONSTRAINT boarding_observation_assignment_fk
        FOREIGN KEY (assignment_id) REFERENCES boarding_assignments (assignment_id)
        ON DELETE SET NULL,
    CONSTRAINT boarding_observation_booking_fk
        FOREIGN KEY (booking_id) REFERENCES bookings (booking_id)
        ON DELETE CASCADE,
    CONSTRAINT boarding_observation_pet_fk
        FOREIGN KEY (pet_id) REFERENCES pets_information (pet_id)
        ON DELETE SET NULL,
    CONSTRAINT boarding_observation_user_fk
        FOREIGN KEY (created_by_user_id) REFERENCES users (user_id)
        ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS boarding_tasks (
    task_id INT AUTO_INCREMENT PRIMARY KEY,
    assignment_id INT DEFAULT NULL,
    booking_id INT NOT NULL,
    pet_id INT DEFAULT NULL,
    room_type VARCHAR(50) NOT NULL,
    room_number INT NOT NULL,
    task_type VARCHAR(40) NOT NULL,
    due_at DATETIME NOT NULL,
    status ENUM('pending', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
    assigned_to VARCHAR(120) DEFAULT NULL,
    notes TEXT,
    completed_at DATETIME DEFAULT NULL,
    created_by_user_id INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL ON UPDATE CURRENT_TIMESTAMP,
    KEY boarding_task_assignment_idx (assignment_id),
    KEY boarding_task_booking_idx (booking_id),
    KEY boarding_task_pet_idx (pet_id),
    KEY boarding_task_due_idx (status, due_at),
    CONSTRAINT boarding_task_assignment_fk
        FOREIGN KEY (assignment_id) REFERENCES boarding_assignments (assignment_id)
        ON DELETE SET NULL,
    CONSTRAINT boarding_task_booking_fk
        FOREIGN KEY (booking_id) REFERENCES bookings (booking_id)
        ON DELETE CASCADE,
    CONSTRAINT boarding_task_pet_fk
        FOREIGN KEY (pet_id) REFERENCES pets_information (pet_id)
        ON DELETE SET NULL,
    CONSTRAINT boarding_task_user_fk
        FOREIGN KEY (created_by_user_id) REFERENCES users (user_id)
        ON DELETE SET NULL
);
