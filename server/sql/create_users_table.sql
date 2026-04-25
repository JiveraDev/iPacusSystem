# CREATE TABLE IF NOT EXISTS users (
#     id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
#     email VARCHAR(255) NOT NULL UNIQUE,
#     password_hash VARCHAR(255) NOT NULL,
#     role VARCHAR(50) NOT NULL DEFAULT 'pet_owner',
#     first_name VARCHAR(100) NOT NULL,
#     last_name VARCHAR(100) NOT NULL,
#     address VARCHAR(255) NOT NULL,
#     phone_number VARCHAR(50) NOT NULL,
#     emergency_contact VARCHAR(50) NULL,
#     created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
# );
#
#
select * from users;

UPDATE users
SET role = 'Pet Owner'
WHERE role = 'pet_owner';