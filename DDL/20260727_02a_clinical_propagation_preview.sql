-- iPawcus legacy clinical propagation cleanup preview (READ ONLY)
-- Target: MariaDB 10.4+ / MySQL 8+
--
-- REQUIRED ORDER
-- 1. Back up the selected iPawcus database.
-- 2. Run DDL/20260727_01_special_service_billing_price.sql.
-- 3. Run this preview and review every candidate.
-- 4. Copy the four approved counts into
--    DDL/20260727_02b_clinical_propagation_cleanup.sql.
-- 5. Run 02b only during a maintenance window.
--
-- This file performs no writes. It targets only exact, case-sensitive matches
-- after trimming leading/trailing whitespace. Diagnosis is always retained.
-- A row is a high-confidence candidate when Diagnosis occurs in:
--   * four or more clinical columns; or
--   * three clinical columns and Diagnosis is at most 80 characters.

SELECT DATABASE() AS selected_database, VERSION() AS database_version;

SELECT
    required.table_name,
    required.required_column_count,
    COUNT(c.column_name) AS present_required_column_count,
    CASE
        WHEN COUNT(c.column_name) = required.required_column_count THEN 'READY'
        ELSE 'STOP_MISSING_COLUMNS'
    END AS schema_status
FROM (
    SELECT 'vet_diagnoses' AS table_name, 9 AS required_column_count
    UNION ALL
    SELECT 'online_consultation_diagnoses', 6
) required
LEFT JOIN information_schema.columns c
    ON c.table_schema = DATABASE()
   AND c.table_name = required.table_name
   AND (
       (required.table_name = 'vet_diagnoses' AND c.column_name IN (
           'diagnosis_id',
           'chief_complaint',
           'major_symptoms',
           'symptoms',
           'physical_exam',
           'diagnosis',
           'treatment',
           'lab_results',
           'notes'
       ))
       OR
       (required.table_name = 'online_consultation_diagnoses' AND c.column_name IN (
           'diagnosis_id',
           'diagnosis',
           'recommendations',
           'treatment',
           'medications',
           'notes'
       ))
   )
GROUP BY required.table_name, required.required_column_count
ORDER BY required.table_name;

-- Detailed clinic candidates. Review every original value and fields_to_null.
WITH vet_scored AS (
    SELECT
        vd.*,
        1
        + CASE
            WHEN NULLIF(TRIM(vd.chief_complaint), '') IS NOT NULL
             AND BINARY TRIM(vd.chief_complaint) = BINARY TRIM(vd.diagnosis)
                THEN 1 ELSE 0
          END
        + CASE
            WHEN NULLIF(TRIM(vd.major_symptoms), '') IS NOT NULL
             AND BINARY TRIM(vd.major_symptoms) = BINARY TRIM(vd.diagnosis)
                THEN 1 ELSE 0
          END
        + CASE
            WHEN NULLIF(TRIM(vd.symptoms), '') IS NOT NULL
             AND BINARY TRIM(vd.symptoms) = BINARY TRIM(vd.diagnosis)
                THEN 1 ELSE 0
          END
        + CASE
            WHEN NULLIF(TRIM(vd.physical_exam), '') IS NOT NULL
             AND BINARY TRIM(vd.physical_exam) = BINARY TRIM(vd.diagnosis)
                THEN 1 ELSE 0
          END
        + CASE
            WHEN NULLIF(TRIM(vd.treatment), '') IS NOT NULL
             AND BINARY TRIM(vd.treatment) = BINARY TRIM(vd.diagnosis)
                THEN 1 ELSE 0
          END
        + CASE
            WHEN NULLIF(TRIM(vd.lab_results), '') IS NOT NULL
             AND BINARY TRIM(vd.lab_results) = BINARY TRIM(vd.diagnosis)
                THEN 1 ELSE 0
          END
        + CASE
            WHEN NULLIF(TRIM(vd.notes), '') IS NOT NULL
             AND BINARY TRIM(vd.notes) = BINARY TRIM(vd.diagnosis)
                THEN 1 ELSE 0
          END AS duplicate_column_count
    FROM vet_diagnoses vd
    WHERE NULLIF(TRIM(vd.diagnosis), '') IS NOT NULL
)
SELECT
    diagnosis_id,
    queue_id,
    booking_id,
    pet_id,
    veterinarian_user_id,
    diagnosis_type,
    service_name,
    finalized_at,
    duplicate_column_count,
    duplicate_column_count - 1 AS cells_to_null,
    CHAR_LENGTH(TRIM(diagnosis)) AS diagnosis_length,
    CONCAT_WS(', ',
        IF(BINARY TRIM(chief_complaint) = BINARY TRIM(diagnosis), 'chief_complaint', NULL),
        IF(BINARY TRIM(major_symptoms) = BINARY TRIM(diagnosis), 'major_symptoms', NULL),
        IF(BINARY TRIM(symptoms) = BINARY TRIM(diagnosis), 'symptoms', NULL),
        IF(BINARY TRIM(physical_exam) = BINARY TRIM(diagnosis), 'physical_exam', NULL),
        IF(BINARY TRIM(treatment) = BINARY TRIM(diagnosis), 'treatment', NULL),
        IF(BINARY TRIM(lab_results) = BINARY TRIM(diagnosis), 'lab_results', NULL),
        IF(BINARY TRIM(notes) = BINARY TRIM(diagnosis), 'notes', NULL)
    ) AS fields_to_null,
    chief_complaint,
    major_symptoms,
    symptoms,
    physical_exam,
    diagnosis AS retained_diagnosis,
    treatment,
    lab_results,
    notes
FROM vet_scored
WHERE duplicate_column_count >= 4
   OR (duplicate_column_count >= 3 AND CHAR_LENGTH(TRIM(diagnosis)) <= 80)
ORDER BY diagnosis_id;

-- Detailed online-consultation candidates.
WITH online_scored AS (
    SELECT
        ocd.*,
        1
        + CASE
            WHEN NULLIF(TRIM(ocd.recommendations), '') IS NOT NULL
             AND BINARY TRIM(ocd.recommendations) = BINARY TRIM(ocd.diagnosis)
                THEN 1 ELSE 0
          END
        + CASE
            WHEN NULLIF(TRIM(ocd.treatment), '') IS NOT NULL
             AND BINARY TRIM(ocd.treatment) = BINARY TRIM(ocd.diagnosis)
                THEN 1 ELSE 0
          END
        + CASE
            WHEN NULLIF(TRIM(ocd.medications), '') IS NOT NULL
             AND BINARY TRIM(ocd.medications) = BINARY TRIM(ocd.diagnosis)
                THEN 1 ELSE 0
          END
        + CASE
            WHEN NULLIF(TRIM(ocd.notes), '') IS NOT NULL
             AND BINARY TRIM(ocd.notes) = BINARY TRIM(ocd.diagnosis)
                THEN 1 ELSE 0
          END AS duplicate_column_count
    FROM online_consultation_diagnoses ocd
    WHERE NULLIF(TRIM(ocd.diagnosis), '') IS NOT NULL
)
SELECT
    diagnosis_id,
    online_consultation_id,
    booking_id,
    veterinarian_user_id,
    finalized_at,
    duplicate_column_count,
    duplicate_column_count - 1 AS cells_to_null,
    CHAR_LENGTH(TRIM(diagnosis)) AS diagnosis_length,
    CONCAT_WS(', ',
        IF(BINARY TRIM(recommendations) = BINARY TRIM(diagnosis), 'recommendations', NULL),
        IF(BINARY TRIM(treatment) = BINARY TRIM(diagnosis), 'treatment', NULL),
        IF(BINARY TRIM(medications) = BINARY TRIM(diagnosis), 'medications', NULL),
        IF(BINARY TRIM(notes) = BINARY TRIM(diagnosis), 'notes', NULL)
    ) AS fields_to_null,
    diagnosis AS retained_diagnosis,
    recommendations,
    treatment,
    medications,
    notes
FROM online_scored
WHERE duplicate_column_count >= 4
   OR (duplicate_column_count >= 3 AND CHAR_LENGTH(TRIM(diagnosis)) <= 80)
ORDER BY diagnosis_id;

-- Copy candidate_rows and cells_to_null for both rows into the four approval
-- variables at the top of 02b. review_only_rows are deliberately untouched.
WITH vet_scored AS (
    SELECT
        vd.diagnosis,
        1
        + CASE WHEN NULLIF(TRIM(vd.chief_complaint), '') IS NOT NULL AND BINARY TRIM(vd.chief_complaint) = BINARY TRIM(vd.diagnosis) THEN 1 ELSE 0 END
        + CASE WHEN NULLIF(TRIM(vd.major_symptoms), '') IS NOT NULL AND BINARY TRIM(vd.major_symptoms) = BINARY TRIM(vd.diagnosis) THEN 1 ELSE 0 END
        + CASE WHEN NULLIF(TRIM(vd.symptoms), '') IS NOT NULL AND BINARY TRIM(vd.symptoms) = BINARY TRIM(vd.diagnosis) THEN 1 ELSE 0 END
        + CASE WHEN NULLIF(TRIM(vd.physical_exam), '') IS NOT NULL AND BINARY TRIM(vd.physical_exam) = BINARY TRIM(vd.diagnosis) THEN 1 ELSE 0 END
        + CASE WHEN NULLIF(TRIM(vd.treatment), '') IS NOT NULL AND BINARY TRIM(vd.treatment) = BINARY TRIM(vd.diagnosis) THEN 1 ELSE 0 END
        + CASE WHEN NULLIF(TRIM(vd.lab_results), '') IS NOT NULL AND BINARY TRIM(vd.lab_results) = BINARY TRIM(vd.diagnosis) THEN 1 ELSE 0 END
        + CASE WHEN NULLIF(TRIM(vd.notes), '') IS NOT NULL AND BINARY TRIM(vd.notes) = BINARY TRIM(vd.diagnosis) THEN 1 ELSE 0 END AS duplicate_column_count
    FROM vet_diagnoses vd
    WHERE NULLIF(TRIM(vd.diagnosis), '') IS NOT NULL
),
online_scored AS (
    SELECT
        ocd.diagnosis,
        1
        + CASE WHEN NULLIF(TRIM(ocd.recommendations), '') IS NOT NULL AND BINARY TRIM(ocd.recommendations) = BINARY TRIM(ocd.diagnosis) THEN 1 ELSE 0 END
        + CASE WHEN NULLIF(TRIM(ocd.treatment), '') IS NOT NULL AND BINARY TRIM(ocd.treatment) = BINARY TRIM(ocd.diagnosis) THEN 1 ELSE 0 END
        + CASE WHEN NULLIF(TRIM(ocd.medications), '') IS NOT NULL AND BINARY TRIM(ocd.medications) = BINARY TRIM(ocd.diagnosis) THEN 1 ELSE 0 END
        + CASE WHEN NULLIF(TRIM(ocd.notes), '') IS NOT NULL AND BINARY TRIM(ocd.notes) = BINARY TRIM(ocd.diagnosis) THEN 1 ELSE 0 END AS duplicate_column_count
    FROM online_consultation_diagnoses ocd
    WHERE NULLIF(TRIM(ocd.diagnosis), '') IS NOT NULL
)
SELECT
    'vet_diagnoses' AS source_table,
    COALESCE(SUM(CASE
        WHEN duplicate_column_count >= 4
          OR (duplicate_column_count >= 3 AND CHAR_LENGTH(TRIM(diagnosis)) <= 80)
            THEN 1 ELSE 0
    END), 0) AS candidate_rows,
    COALESCE(SUM(CASE
        WHEN duplicate_column_count >= 4
          OR (duplicate_column_count >= 3 AND CHAR_LENGTH(TRIM(diagnosis)) <= 80)
            THEN duplicate_column_count - 1 ELSE 0
    END), 0) AS cells_to_null,
    COALESCE(SUM(CASE
        WHEN duplicate_column_count = 2
          OR (duplicate_column_count = 3 AND CHAR_LENGTH(TRIM(diagnosis)) > 80)
            THEN 1 ELSE 0
    END), 0) AS review_only_rows
FROM vet_scored

UNION ALL

SELECT
    'online_consultation_diagnoses',
    COALESCE(SUM(CASE
        WHEN duplicate_column_count >= 4
          OR (duplicate_column_count >= 3 AND CHAR_LENGTH(TRIM(diagnosis)) <= 80)
            THEN 1 ELSE 0
    END), 0),
    COALESCE(SUM(CASE
        WHEN duplicate_column_count >= 4
          OR (duplicate_column_count >= 3 AND CHAR_LENGTH(TRIM(diagnosis)) <= 80)
            THEN duplicate_column_count - 1 ELSE 0
    END), 0),
    COALESCE(SUM(CASE
        WHEN duplicate_column_count = 2
          OR (duplicate_column_count = 3 AND CHAR_LENGTH(TRIM(diagnosis)) > 80)
            THEN 1 ELSE 0
    END), 0)
FROM online_scored;
