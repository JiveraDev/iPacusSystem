-- iPawcus clinic operating-hours update
-- Monday through Saturday: 8:00 AM to 6:00 PM
-- Sunday: closed
--
-- Select the deployed iPawcus database before importing this file.
-- Safe to rerun after DDL/20260803_01_multi_branch_operations.sql.

SELECT DATABASE() AS selected_database, VERSION() AS database_version;

INSERT INTO branch_operating_hours (
    branch_id,
    day_of_week,
    opens_at,
    closes_at,
    is_closed
)
SELECT
    b.branch_id,
    days.day_of_week,
    CASE WHEN days.day_of_week = 7 THEN NULL ELSE '08:00:00' END,
    CASE WHEN days.day_of_week = 7 THEN NULL ELSE '18:00:00' END,
    CASE WHEN days.day_of_week = 7 THEN 1 ELSE 0 END
FROM branches b
CROSS JOIN (
    SELECT 1 AS day_of_week UNION ALL SELECT 2 UNION ALL SELECT 3
    UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7
) days
WHERE b.status = 'active'
ON DUPLICATE KEY UPDATE
    opens_at = VALUES(opens_at),
    closes_at = VALUES(closes_at),
    is_closed = VALUES(is_closed);

SELECT
    b.branch_code,
    b.branch_name,
    h.day_of_week,
    CASE h.day_of_week
        WHEN 1 THEN 'Monday'
        WHEN 2 THEN 'Tuesday'
        WHEN 3 THEN 'Wednesday'
        WHEN 4 THEN 'Thursday'
        WHEN 5 THEN 'Friday'
        WHEN 6 THEN 'Saturday'
        WHEN 7 THEN 'Sunday'
    END AS day_name,
    h.opens_at,
    h.closes_at,
    h.is_closed
FROM branch_operating_hours h
JOIN branches b ON b.branch_id = h.branch_id
WHERE b.status = 'active'
ORDER BY b.is_main DESC, b.branch_name, h.day_of_week;
