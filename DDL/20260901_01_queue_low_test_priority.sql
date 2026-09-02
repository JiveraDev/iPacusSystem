-- Add the ?Low-test option used by queue creation and queue filters.
-- Run this once against the production iPawcus database before deploying the UI.
ALTER TABLE queues
    MODIFY COLUMN priority ENUM('normal', 'urgent', 'low-test') NULL DEFAULT 'normal';
