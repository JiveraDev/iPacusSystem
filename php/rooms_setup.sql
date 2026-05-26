-- Run this once before using Pet Hotel and Pet Boarding availability.
-- Your bookings table already has the needed stay columns:
-- check_in_date, check_out_date, room_size, add_ons, emergency_contact, hotel_boarding_type.

CREATE TABLE IF NOT EXISTS rooms (
    room_id INT AUTO_INCREMENT PRIMARY KEY,
    room_type ENUM('hotel-small', 'hotel-medium', 'hotel-large', 'boarding-small', 'boarding-medium', 'boarding-large') NOT NULL,
    total_capacity INT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

INSERT INTO rooms (room_type, total_capacity, description)
SELECT 'hotel-small', 5, 'Small Hotel Rooms'
WHERE NOT EXISTS (SELECT 1 FROM rooms WHERE room_type = 'hotel-small');

INSERT INTO rooms (room_type, total_capacity, description)
SELECT 'hotel-medium', 3, 'Medium Hotel Rooms'
WHERE NOT EXISTS (SELECT 1 FROM rooms WHERE room_type = 'hotel-medium');

INSERT INTO rooms (room_type, total_capacity, description)
SELECT 'hotel-large', 2, 'Large Hotel Rooms'
WHERE NOT EXISTS (SELECT 1 FROM rooms WHERE room_type = 'hotel-large');

INSERT INTO rooms (room_type, total_capacity, description)
SELECT 'boarding-small', 10, 'Small Kennels'
WHERE NOT EXISTS (SELECT 1 FROM rooms WHERE room_type = 'boarding-small');

INSERT INTO rooms (room_type, total_capacity, description)
SELECT 'boarding-medium', 8, 'Medium Kennels'
WHERE NOT EXISTS (SELECT 1 FROM rooms WHERE room_type = 'boarding-medium');

INSERT INTO rooms (room_type, total_capacity, description)
SELECT 'boarding-large', 5, 'Large Kennels'
WHERE NOT EXISTS (SELECT 1 FROM rooms WHERE room_type = 'boarding-large');

CREATE TABLE IF NOT EXISTS booking_pets (
    booking_pet_id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL,
    pet_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE KEY booking_pets_unique (booking_id, pet_id),
    CONSTRAINT booking_pets_booking_fk
        FOREIGN KEY (booking_id) REFERENCES bookings (booking_id)
        ON DELETE CASCADE,
    CONSTRAINT booking_pets_pet_fk
        FOREIGN KEY (pet_id) REFERENCES pets_information (pet_id)
        ON DELETE CASCADE
);
