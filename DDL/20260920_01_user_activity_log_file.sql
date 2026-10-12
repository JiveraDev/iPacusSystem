-- Run once before deploying file-based staff activity history.
-- The column stores a relative path, such as staff_activity/user-42.jsonl.
-- Activity entries remain in protected files; no activity table is needed.
ALTER TABLE users
    ADD COLUMN activity_log_file VARCHAR(255) NULL;
