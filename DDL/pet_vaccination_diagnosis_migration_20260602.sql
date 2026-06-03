-- Run this migration once to let diagnosis saves create full vaccination records.

SET @vax_license_column_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'pet_vaccinations'
    AND column_name = 'vax_veterinarian_license'
);
SET @vax_license_column_sql = IF(
  @vax_license_column_exists = 0,
  'ALTER TABLE `pet_vaccinations` ADD COLUMN `vax_veterinarian_license` varchar(100) DEFAULT NULL AFTER `vax_applicator`',
  'SELECT ''pet_vaccinations.vax_veterinarian_license already exists'' AS message'
);
PREPARE vax_license_column_stmt FROM @vax_license_column_sql;
EXECUTE vax_license_column_stmt;
DEALLOCATE PREPARE vax_license_column_stmt;

SET @vax_notes_column_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'pet_vaccinations'
    AND column_name = 'vax_notes'
);
SET @vax_notes_column_sql = IF(
  @vax_notes_column_exists = 0,
  'ALTER TABLE `pet_vaccinations` ADD COLUMN `vax_notes` text DEFAULT NULL AFTER `vax_status`',
  'SELECT ''pet_vaccinations.vax_notes already exists'' AS message'
);
PREPARE vax_notes_column_stmt FROM @vax_notes_column_sql;
EXECUTE vax_notes_column_stmt;
DEALLOCATE PREPARE vax_notes_column_stmt;

SET @vax_vet_user_column_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'pet_vaccinations'
    AND column_name = 'vax_veterinarian_user_id'
);
SET @vax_vet_user_column_sql = IF(
  @vax_vet_user_column_exists = 0,
  'ALTER TABLE `pet_vaccinations` ADD COLUMN `vax_veterinarian_user_id` int(11) DEFAULT NULL AFTER `vax_notes`',
  'SELECT ''pet_vaccinations.vax_veterinarian_user_id already exists'' AS message'
);
PREPARE vax_vet_user_column_stmt FROM @vax_vet_user_column_sql;
EXECUTE vax_vet_user_column_stmt;
DEALLOCATE PREPARE vax_vet_user_column_stmt;

SET @vax_source_diagnosis_column_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'pet_vaccinations'
    AND column_name = 'source_diagnosis_id'
);
SET @vax_source_diagnosis_column_sql = IF(
  @vax_source_diagnosis_column_exists = 0,
  'ALTER TABLE `pet_vaccinations` ADD COLUMN `source_diagnosis_id` int(11) DEFAULT NULL AFTER `vax_veterinarian_user_id`',
  'SELECT ''pet_vaccinations.source_diagnosis_id already exists'' AS message'
);
PREPARE vax_source_diagnosis_column_stmt FROM @vax_source_diagnosis_column_sql;
EXECUTE vax_source_diagnosis_column_stmt;
DEALLOCATE PREPARE vax_source_diagnosis_column_stmt;

SET @vax_source_diagnosis_index_exists = (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'pet_vaccinations'
    AND index_name = 'pet_vaccinations_source_diagnosis_unique'
);
SET @vax_source_diagnosis_index_sql = IF(
  @vax_source_diagnosis_index_exists = 0,
  'CREATE UNIQUE INDEX `pet_vaccinations_source_diagnosis_unique` ON `pet_vaccinations` (`source_diagnosis_id`)',
  'SELECT ''pet_vaccinations_source_diagnosis_unique already exists'' AS message'
);
PREPARE vax_source_diagnosis_index_stmt FROM @vax_source_diagnosis_index_sql;
EXECUTE vax_source_diagnosis_index_stmt;
DEALLOCATE PREPARE vax_source_diagnosis_index_stmt;
