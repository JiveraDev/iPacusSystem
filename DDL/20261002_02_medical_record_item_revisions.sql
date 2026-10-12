-- Store editable medical-record revisions separately from the immutable source
-- snapshot. Safe to run repeatedly.

SET @medical_record_revision_sql := IF(
    EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 'pet_medical_record_group_items'
          AND column_name = 'revision_snapshot'
    ),
    'DO 1',
    'ALTER TABLE `pet_medical_record_group_items` ADD COLUMN `revision_snapshot` LONGTEXT NULL AFTER `source_snapshot`'
);
PREPARE medical_record_revision_stmt FROM @medical_record_revision_sql;
EXECUTE medical_record_revision_stmt;
DEALLOCATE PREPARE medical_record_revision_stmt;
