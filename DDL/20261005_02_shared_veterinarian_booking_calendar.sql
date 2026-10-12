-- On-site medical appointments: one simultaneous appointment per accepting vet.
-- Existing bookings and historical visit/online schedules are preserved.
CREATE TABLE IF NOT EXISTS veterinarian_booking_clinics (
    veterinarian_user_id INT NOT NULL,
    branch_id INT NOT NULL,
    accepts_bookings TINYINT(1) NOT NULL DEFAULT 0,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (veterinarian_user_id, branch_id),
    CONSTRAINT vet_booking_clinic_user_fk FOREIGN KEY (veterinarian_user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT vet_booking_clinic_branch_fk FOREIGN KEY (branch_id) REFERENCES branches(branch_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- In-clinic availability follows existing branch operating hours automatically.
-- Vets explicitly opt in per assigned clinic; no extra hours or time off setup.
-- Online availability continues to use the existing vet_schedules table.
-- If an earlier version created working-hours/time-off tables, leave them
-- intact for recoverability. They are no longer read by the booking workflow.
INSERT IGNORE INTO veterinarian_booking_clinics (veterinarian_user_id, branch_id, accepts_bookings)
SELECT a.user_id, a.branch_id, 0
FROM user_branch_assignments a
JOIN users u ON u.user_id = a.user_id
WHERE a.is_active = 1
  AND LOWER(REPLACE(REPLACE(TRIM(u.role), ' ', '_'), '-', '_')) IN ('veterinarian', 'vet');

-- The old visit-based gate is retired. Medical capacity now comes from vets.
-- Service offerings, enabled flags, grooming, and boarding are preserved.
UPDATE branch_service_availability
SET availability_mode = 'always'
WHERE availability_mode = 'vet_visit' AND service_key NOT IN ('grooming', 'boarding');
