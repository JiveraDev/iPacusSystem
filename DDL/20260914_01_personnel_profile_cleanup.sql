-- Apply once after backing up admin_profiles and veterinarian_profiles.
-- The removed columns and their existing values cannot be recovered from this migration.
-- Existing Nurse positions are moved to the closest new position label.
UPDATE admin_profiles
SET postionn = 'Assistant Vet'
WHERE postionn IN ('Nurse', 'Senior Nurse');

ALTER TABLE admin_profiles
    DROP COLUMN sss_number,
    DROP COLUMN philhealth_number,
    DROP COLUMN tin_number,
    DROP COLUMN pagibig_number,
    DROP COLUMN education_history,
    DROP COLUMN experience_history;

ALTER TABLE veterinarian_profiles
    DROP COLUMN education_history;
