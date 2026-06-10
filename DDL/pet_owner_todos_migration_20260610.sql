CREATE TABLE IF NOT EXISTS pet_owner_todos (
    todo_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(180) NOT NULL,
    details TEXT NULL,
    category VARCHAR(80) NOT NULL DEFAULT 'Personal Task',
    start_at DATETIME NOT NULL,
    end_at DATETIME NULL,
    status ENUM('pending','completed','cancelled') NOT NULL DEFAULT 'pending',
    completed_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY pet_owner_todos_user_start_idx (user_id, start_at),
    KEY pet_owner_todos_user_status_idx (user_id, status),
    CONSTRAINT pet_owner_todos_user_fk
        FOREIGN KEY (user_id) REFERENCES users(user_id)
        ON DELETE CASCADE
);
