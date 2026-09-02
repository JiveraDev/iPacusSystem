-- Repair branch-scoped Pet Hotel and Kennel room storage.
-- This migration avoids CREATE PROCEDURE so it can run on shared Hostinger
-- databases that do not grant CREATE ROUTINE privileges.
-- It is safe to run again after a successful execution.

SET @boarding_main_branch_id := (
    SELECT branch_id
    FROM branches
    ORDER BY (status = 'active') DESC, is_main DESC, branch_id ASC
    LIMIT 1
);

-- Required branch and display columns.
SET @boarding_sql := IF(
    EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'rooms' AND column_name = 'branch_id'
    ),
    'DO 1',
    'ALTER TABLE `rooms` ADD COLUMN `branch_id` INT NULL AFTER `room_id`'
);
PREPARE boarding_stmt FROM @boarding_sql;
EXECUTE boarding_stmt;
DEALLOCATE PREPARE boarding_stmt;

SET @boarding_sql := IF(
    EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'rooms' AND column_name = 'description'
    ),
    'DO 1',
    'ALTER TABLE `rooms` ADD COLUMN `description` TEXT NULL AFTER `total_capacity`'
);
PREPARE boarding_stmt FROM @boarding_sql;
EXECUTE boarding_stmt;
DEALLOCATE PREPARE boarding_stmt;

SET @boarding_sql := IF(
    EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'room_unit_statuses' AND column_name = 'branch_id'
    ),
    'DO 1',
    'ALTER TABLE `room_unit_statuses` ADD COLUMN `branch_id` INT NULL AFTER `room_unit_status_id`'
);
PREPARE boarding_stmt FROM @boarding_sql;
EXECUTE boarding_stmt;
DEALLOCATE PREPARE boarding_stmt;

SET @boarding_sql := IF(
    EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'room_unit_statuses' AND column_name = 'notes'
    ),
    'DO 1',
    'ALTER TABLE `room_unit_statuses` ADD COLUMN `notes` TEXT NULL AFTER `status`'
);
PREPARE boarding_stmt FROM @boarding_sql;
EXECUTE boarding_stmt;
DEALLOCATE PREPARE boarding_stmt;

UPDATE rooms
SET branch_id = COALESCE(branch_id, @boarding_main_branch_id);

UPDATE room_unit_statuses
SET branch_id = COALESCE(branch_id, @boarding_main_branch_id);

ALTER TABLE rooms
    MODIFY COLUMN branch_id INT NOT NULL;

ALTER TABLE room_unit_statuses
    MODIFY COLUMN branch_id INT NOT NULL,
    MODIFY COLUMN status ENUM('available', 'maintenance', 'retired') NOT NULL DEFAULT 'available';

-- Consolidate legacy duplicate capacity rows before adding the branch/type key.
DROP TEMPORARY TABLE IF EXISTS ipawcus_room_capacity_merge;
CREATE TEMPORARY TABLE ipawcus_room_capacity_merge AS
SELECT branch_id, room_type, MIN(room_id) AS keeper_room_id, SUM(total_capacity) AS merged_capacity
FROM rooms
GROUP BY branch_id, room_type;

UPDATE rooms room
JOIN ipawcus_room_capacity_merge merged
  ON merged.keeper_room_id = room.room_id
SET room.total_capacity = merged.merged_capacity;

DELETE room
FROM rooms room
JOIN ipawcus_room_capacity_merge merged
  ON merged.branch_id = room.branch_id
 AND merged.room_type = room.room_type
WHERE room.room_id <> merged.keeper_room_id;

DROP TEMPORARY TABLE ipawcus_room_capacity_merge;

-- Consolidate duplicate unit-state rows before adding the branch-aware key.
DROP TEMPORARY TABLE IF EXISTS ipawcus_room_status_merge;
CREATE TEMPORARY TABLE ipawcus_room_status_merge AS
SELECT
    branch_id,
    room_type,
    room_number,
    MIN(room_unit_status_id) AS keeper_status_id,
    CASE
        WHEN SUM(status = 'retired') > 0 THEN 'retired'
        WHEN SUM(status = 'maintenance') > 0 THEN 'maintenance'
        ELSE 'available'
    END AS merged_status,
    MAX(notes) AS merged_notes
FROM room_unit_statuses
GROUP BY branch_id, room_type, room_number;

UPDATE room_unit_statuses room_status
JOIN ipawcus_room_status_merge merged
  ON merged.keeper_status_id = room_status.room_unit_status_id
SET room_status.status = merged.merged_status,
    room_status.notes = merged.merged_notes;

DELETE room_status
FROM room_unit_statuses room_status
JOIN ipawcus_room_status_merge merged
  ON merged.branch_id = room_status.branch_id
 AND merged.room_type = room_status.room_type
 AND merged.room_number = room_status.room_number
WHERE room_status.room_unit_status_id <> merged.keeper_status_id;

DROP TEMPORARY TABLE ipawcus_room_status_merge;

-- Remove legacy unique keys that incorrectly treat all branches as one branch.
SELECT GROUP_CONCAT(CONCAT('DROP INDEX `', index_name, '`') SEPARATOR ', ')
INTO @boarding_room_legacy_indexes
FROM (
    SELECT index_name
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'rooms'
      AND index_name <> 'PRIMARY'
      AND non_unique = 0
    GROUP BY index_name
    HAVING GROUP_CONCAT(column_name ORDER BY seq_in_index SEPARATOR ',') = 'room_type'
) legacy_room_indexes;

SET @boarding_sql := IF(
    @boarding_room_legacy_indexes IS NULL,
    'DO 1',
    CONCAT('ALTER TABLE `rooms` ', @boarding_room_legacy_indexes)
);
PREPARE boarding_stmt FROM @boarding_sql;
EXECUTE boarding_stmt;
DEALLOCATE PREPARE boarding_stmt;

SELECT GROUP_CONCAT(CONCAT('DROP INDEX `', index_name, '`') SEPARATOR ', ')
INTO @boarding_status_legacy_indexes
FROM (
    SELECT index_name
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'room_unit_statuses'
      AND index_name <> 'PRIMARY'
      AND non_unique = 0
    GROUP BY index_name
    HAVING GROUP_CONCAT(column_name ORDER BY seq_in_index SEPARATOR ',') = 'room_type,room_number'
) legacy_status_indexes;

SET @boarding_sql := IF(
    @boarding_status_legacy_indexes IS NULL,
    'DO 1',
    CONCAT('ALTER TABLE `room_unit_statuses` ', @boarding_status_legacy_indexes)
);
PREPARE boarding_stmt FROM @boarding_sql;
EXECUTE boarding_stmt;
DEALLOCATE PREPARE boarding_stmt;

-- Repair a same-named but incorrectly defined rooms index before recreating it.
SELECT GROUP_CONCAT(column_name ORDER BY seq_in_index SEPARATOR ',')
INTO @boarding_rooms_index_columns
FROM information_schema.statistics
WHERE table_schema = DATABASE()
  AND table_name = 'rooms'
  AND index_name = 'rooms_branch_type_unique';

SELECT MIN(non_unique)
INTO @boarding_rooms_index_non_unique
FROM information_schema.statistics
WHERE table_schema = DATABASE()
  AND table_name = 'rooms'
  AND index_name = 'rooms_branch_type_unique';

SET @boarding_sql := IF(
    @boarding_rooms_index_columns IS NOT NULL
    AND (
        @boarding_rooms_index_columns <> 'branch_id,room_type'
        OR COALESCE(@boarding_rooms_index_non_unique, 1) <> 0
    ),
    'ALTER TABLE `rooms` DROP INDEX `rooms_branch_type_unique`',
    'DO 1'
);
PREPARE boarding_stmt FROM @boarding_sql;
EXECUTE boarding_stmt;
DEALLOCATE PREPARE boarding_stmt;

SET @boarding_sql := IF(
    EXISTS (
        SELECT 1 FROM information_schema.statistics
        WHERE table_schema = DATABASE()
          AND table_name = 'rooms'
          AND index_name = 'rooms_branch_type_unique'
          AND non_unique = 0
    ),
    'DO 1',
    'ALTER TABLE `rooms` ADD UNIQUE INDEX `rooms_branch_type_unique` (`branch_id`, `room_type`)'
);
PREPARE boarding_stmt FROM @boarding_sql;
EXECUTE boarding_stmt;
DEALLOCATE PREPARE boarding_stmt;

SELECT GROUP_CONCAT(column_name ORDER BY seq_in_index SEPARATOR ',')
INTO @boarding_status_index_columns
FROM information_schema.statistics
WHERE table_schema = DATABASE()
  AND table_name = 'room_unit_statuses'
  AND index_name = 'room_unit_status_branch_unique';

SELECT MIN(non_unique)
INTO @boarding_status_index_non_unique
FROM information_schema.statistics
WHERE table_schema = DATABASE()
  AND table_name = 'room_unit_statuses'
  AND index_name = 'room_unit_status_branch_unique';

SET @boarding_sql := IF(
    @boarding_status_index_columns IS NOT NULL
    AND (
        @boarding_status_index_columns <> 'branch_id,room_type,room_number'
        OR COALESCE(@boarding_status_index_non_unique, 1) <> 0
    ),
    'ALTER TABLE `room_unit_statuses` DROP INDEX `room_unit_status_branch_unique`',
    'DO 1'
);
PREPARE boarding_stmt FROM @boarding_sql;
EXECUTE boarding_stmt;
DEALLOCATE PREPARE boarding_stmt;

SET @boarding_sql := IF(
    EXISTS (
        SELECT 1 FROM information_schema.statistics
        WHERE table_schema = DATABASE()
          AND table_name = 'room_unit_statuses'
          AND index_name = 'room_unit_status_branch_unique'
          AND non_unique = 0
    ),
    'DO 1',
    'ALTER TABLE `room_unit_statuses` ADD UNIQUE INDEX `room_unit_status_branch_unique` (`branch_id`, `room_type`, `room_number`)'
);
PREPARE boarding_stmt FROM @boarding_sql;
EXECUTE boarding_stmt;
DEALLOCATE PREPARE boarding_stmt;

-- Final verification. Both result rows must show PASS.
SELECT
    'rooms_branch_type_unique' AS schema_check,
    IF(
        GROUP_CONCAT(column_name ORDER BY seq_in_index SEPARATOR ',') = 'branch_id,room_type'
        AND MIN(non_unique) = 0,
        'PASS',
        'FAIL'
    ) AS result
FROM information_schema.statistics
WHERE table_schema = DATABASE()
  AND table_name = 'rooms'
  AND index_name = 'rooms_branch_type_unique'
UNION ALL
SELECT
    'room_unit_status_branch_unique',
    IF(
        GROUP_CONCAT(column_name ORDER BY seq_in_index SEPARATOR ',') = 'branch_id,room_type,room_number'
        AND MIN(non_unique) = 0,
        'PASS',
        'FAIL'
    )
FROM information_schema.statistics
WHERE table_schema = DATABASE()
  AND table_name = 'room_unit_statuses'
  AND index_name = 'room_unit_status_branch_unique';

SELECT branch.branch_name, room.room_type, room.total_capacity
FROM rooms room
JOIN branches branch ON branch.branch_id = room.branch_id
ORDER BY branch.branch_name, room.room_type;
