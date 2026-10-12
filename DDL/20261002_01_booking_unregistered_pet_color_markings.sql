-- Preserve color/markings entered for an unregistered pet until an admin
-- confirms the pet profile from Booking Management. Safe to run repeatedly.

SET @booking_pet_color_sql := IF(
    EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 'bookings'
          AND column_name = 'unregistered_pet_color_markings'
    ),
    'DO 1',
    'ALTER TABLE `bookings` ADD COLUMN `unregistered_pet_color_markings` VARCHAR(120) NULL AFTER `unregistered_pet_weight`'
);
PREPARE booking_pet_color_stmt FROM @booking_pet_color_sql;
EXECUTE booking_pet_color_stmt;
DEALLOCATE PREPARE booking_pet_color_stmt;

-- Only custom values approved while an admin registers an unregistered
-- booking are added to the shared autocomplete catalog.
CREATE TABLE IF NOT EXISTS pet_catalog_options (
    option_id INT NOT NULL AUTO_INCREMENT,
    species VARCHAR(50) NOT NULL,
    breed VARCHAR(80) NOT NULL,
    approved_by_user_id INT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (option_id),
    UNIQUE KEY pet_catalog_species_breed_unique (species, breed),
    KEY pet_catalog_approved_by_idx (approved_by_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
