-- iPawcus legacy clinical propagation cleanup APPLY
-- Target: MariaDB 10.4+ / MySQL 8+
--
-- DO NOT RUN BEFORE 20260727_02a_clinical_propagation_preview.sql.
-- This script is operator-run only and must be executed during a maintenance
-- window after a full database backup.
--
-- The four approval values below must exactly match the reviewed 02a summary.
-- The procedure aborts and rolls back if the live counts no longer match that
-- approved preview.

-- Approved from the 2026-07-27 preview: both detailed candidate queries
-- returned zero rows, so both candidate and affected-cell counts are zero.
SET @approved_vet_candidate_rows := 0;
SET @approved_vet_cells_to_null := 0;
SET @approved_online_candidate_rows := 0;
SET @approved_online_cells_to_null := 0;

SELECT DATABASE() AS selected_database, VERSION() AS database_version;

DROP PROCEDURE IF EXISTS ipawcus_cleanup_clinical_propagation_20260727;

DELIMITER $$

CREATE PROCEDURE ipawcus_cleanup_clinical_propagation_20260727()
BEGIN
    DECLARE v_present_columns INT DEFAULT 0;
    DECLARE v_vet_candidates INT DEFAULT 0;
    DECLARE v_vet_cells INT DEFAULT 0;
    DECLARE v_online_candidates INT DEFAULT 0;
    DECLARE v_online_cells INT DEFAULT 0;
    DECLARE v_vet_rows_updated INT DEFAULT 0;
    DECLARE v_online_rows_updated INT DEFAULT 0;
    DECLARE v_vet_remaining INT DEFAULT 0;
    DECLARE v_online_remaining INT DEFAULT 0;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    IF DATABASE() IS NULL OR DATABASE() = '' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'No database selected. Select the intended iPawcus database and rerun.';
    END IF;

    SELECT COUNT(*)
    INTO v_present_columns
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'vet_diagnoses'
      AND column_name IN (
          'diagnosis_id',
          'chief_complaint',
          'major_symptoms',
          'symptoms',
          'physical_exam',
          'diagnosis',
          'treatment',
          'lab_results',
          'notes'
      );
    IF v_present_columns <> 9 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'vet_diagnoses clinical schema is incomplete. Stop and apply the required baseline/integrity schema.';
    END IF;

    SELECT COUNT(*)
    INTO v_present_columns
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'online_consultation_diagnoses'
      AND column_name IN (
          'diagnosis_id',
          'diagnosis',
          'recommendations',
          'treatment',
          'medications',
          'notes'
      );
    IF v_present_columns <> 6 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'online_consultation_diagnoses schema is incomplete. Stop and apply the required baseline/integrity schema.';
    END IF;

    IF @approved_vet_candidate_rows IS NULL
       OR @approved_vet_cells_to_null IS NULL
       OR @approved_online_candidate_rows IS NULL
       OR @approved_online_cells_to_null IS NULL
       OR @approved_vet_candidate_rows < 0
       OR @approved_vet_cells_to_null < 0
       OR @approved_online_candidate_rows < 0
       OR @approved_online_cells_to_null < 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Approval counts are unset. Run 02a and replace all four -1 values before applying cleanup.';
    END IF;

    START TRANSACTION;

    SELECT
        COUNT(*),
        COALESCE(SUM(scored.duplicate_column_count - 1), 0)
    INTO v_vet_candidates, v_vet_cells
    FROM (
        SELECT
            vd.diagnosis_id,
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
    ) scored
    WHERE scored.duplicate_column_count >= 4
       OR (
           scored.duplicate_column_count >= 3
           AND CHAR_LENGTH(TRIM(scored.diagnosis)) <= 80
       );

    SELECT
        COUNT(*),
        COALESCE(SUM(scored.duplicate_column_count - 1), 0)
    INTO v_online_candidates, v_online_cells
    FROM (
        SELECT
            ocd.diagnosis_id,
            ocd.diagnosis,
            1
            + CASE WHEN NULLIF(TRIM(ocd.recommendations), '') IS NOT NULL AND BINARY TRIM(ocd.recommendations) = BINARY TRIM(ocd.diagnosis) THEN 1 ELSE 0 END
            + CASE WHEN NULLIF(TRIM(ocd.treatment), '') IS NOT NULL AND BINARY TRIM(ocd.treatment) = BINARY TRIM(ocd.diagnosis) THEN 1 ELSE 0 END
            + CASE WHEN NULLIF(TRIM(ocd.medications), '') IS NOT NULL AND BINARY TRIM(ocd.medications) = BINARY TRIM(ocd.diagnosis) THEN 1 ELSE 0 END
            + CASE WHEN NULLIF(TRIM(ocd.notes), '') IS NOT NULL AND BINARY TRIM(ocd.notes) = BINARY TRIM(ocd.diagnosis) THEN 1 ELSE 0 END AS duplicate_column_count
        FROM online_consultation_diagnoses ocd
        WHERE NULLIF(TRIM(ocd.diagnosis), '') IS NOT NULL
    ) scored
    WHERE scored.duplicate_column_count >= 4
       OR (
           scored.duplicate_column_count >= 3
           AND CHAR_LENGTH(TRIM(scored.diagnosis)) <= 80
       );

    SET @clinical_vet_candidates_before := v_vet_candidates;
    SET @clinical_vet_cells_before := v_vet_cells;
    SET @clinical_online_candidates_before := v_online_candidates;
    SET @clinical_online_cells_before := v_online_cells;

    IF v_vet_candidates <> @approved_vet_candidate_rows
       OR v_vet_cells <> @approved_vet_cells_to_null THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'vet_diagnoses no longer matches the approved preview counts. Cleanup rolled back; rerun 02a.';
    END IF;

    IF v_online_candidates <> @approved_online_candidate_rows
       OR v_online_cells <> @approved_online_cells_to_null THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Online diagnosis data no longer matches the approved preview counts. Cleanup rolled back; rerun 02a.';
    END IF;

    UPDATE vet_diagnoses vd
    SET
        vd.chief_complaint = CASE
            WHEN NULLIF(TRIM(vd.chief_complaint), '') IS NOT NULL
             AND BINARY TRIM(vd.chief_complaint) = BINARY TRIM(vd.diagnosis)
                THEN NULL ELSE vd.chief_complaint
        END,
        vd.major_symptoms = CASE
            WHEN NULLIF(TRIM(vd.major_symptoms), '') IS NOT NULL
             AND BINARY TRIM(vd.major_symptoms) = BINARY TRIM(vd.diagnosis)
                THEN NULL ELSE vd.major_symptoms
        END,
        vd.symptoms = CASE
            WHEN NULLIF(TRIM(vd.symptoms), '') IS NOT NULL
             AND BINARY TRIM(vd.symptoms) = BINARY TRIM(vd.diagnosis)
                THEN NULL ELSE vd.symptoms
        END,
        vd.physical_exam = CASE
            WHEN NULLIF(TRIM(vd.physical_exam), '') IS NOT NULL
             AND BINARY TRIM(vd.physical_exam) = BINARY TRIM(vd.diagnosis)
                THEN NULL ELSE vd.physical_exam
        END,
        vd.treatment = CASE
            WHEN NULLIF(TRIM(vd.treatment), '') IS NOT NULL
             AND BINARY TRIM(vd.treatment) = BINARY TRIM(vd.diagnosis)
                THEN NULL ELSE vd.treatment
        END,
        vd.lab_results = CASE
            WHEN NULLIF(TRIM(vd.lab_results), '') IS NOT NULL
             AND BINARY TRIM(vd.lab_results) = BINARY TRIM(vd.diagnosis)
                THEN NULL ELSE vd.lab_results
        END,
        vd.notes = CASE
            WHEN NULLIF(TRIM(vd.notes), '') IS NOT NULL
             AND BINARY TRIM(vd.notes) = BINARY TRIM(vd.diagnosis)
                THEN NULL ELSE vd.notes
        END
    WHERE NULLIF(TRIM(vd.diagnosis), '') IS NOT NULL
      AND (
          (
              1
              + CASE WHEN NULLIF(TRIM(vd.chief_complaint), '') IS NOT NULL AND BINARY TRIM(vd.chief_complaint) = BINARY TRIM(vd.diagnosis) THEN 1 ELSE 0 END
              + CASE WHEN NULLIF(TRIM(vd.major_symptoms), '') IS NOT NULL AND BINARY TRIM(vd.major_symptoms) = BINARY TRIM(vd.diagnosis) THEN 1 ELSE 0 END
              + CASE WHEN NULLIF(TRIM(vd.symptoms), '') IS NOT NULL AND BINARY TRIM(vd.symptoms) = BINARY TRIM(vd.diagnosis) THEN 1 ELSE 0 END
              + CASE WHEN NULLIF(TRIM(vd.physical_exam), '') IS NOT NULL AND BINARY TRIM(vd.physical_exam) = BINARY TRIM(vd.diagnosis) THEN 1 ELSE 0 END
              + CASE WHEN NULLIF(TRIM(vd.treatment), '') IS NOT NULL AND BINARY TRIM(vd.treatment) = BINARY TRIM(vd.diagnosis) THEN 1 ELSE 0 END
              + CASE WHEN NULLIF(TRIM(vd.lab_results), '') IS NOT NULL AND BINARY TRIM(vd.lab_results) = BINARY TRIM(vd.diagnosis) THEN 1 ELSE 0 END
              + CASE WHEN NULLIF(TRIM(vd.notes), '') IS NOT NULL AND BINARY TRIM(vd.notes) = BINARY TRIM(vd.diagnosis) THEN 1 ELSE 0 END
          ) >= 4
          OR (
              (
                  1
                  + CASE WHEN NULLIF(TRIM(vd.chief_complaint), '') IS NOT NULL AND BINARY TRIM(vd.chief_complaint) = BINARY TRIM(vd.diagnosis) THEN 1 ELSE 0 END
                  + CASE WHEN NULLIF(TRIM(vd.major_symptoms), '') IS NOT NULL AND BINARY TRIM(vd.major_symptoms) = BINARY TRIM(vd.diagnosis) THEN 1 ELSE 0 END
                  + CASE WHEN NULLIF(TRIM(vd.symptoms), '') IS NOT NULL AND BINARY TRIM(vd.symptoms) = BINARY TRIM(vd.diagnosis) THEN 1 ELSE 0 END
                  + CASE WHEN NULLIF(TRIM(vd.physical_exam), '') IS NOT NULL AND BINARY TRIM(vd.physical_exam) = BINARY TRIM(vd.diagnosis) THEN 1 ELSE 0 END
                  + CASE WHEN NULLIF(TRIM(vd.treatment), '') IS NOT NULL AND BINARY TRIM(vd.treatment) = BINARY TRIM(vd.diagnosis) THEN 1 ELSE 0 END
                  + CASE WHEN NULLIF(TRIM(vd.lab_results), '') IS NOT NULL AND BINARY TRIM(vd.lab_results) = BINARY TRIM(vd.diagnosis) THEN 1 ELSE 0 END
                  + CASE WHEN NULLIF(TRIM(vd.notes), '') IS NOT NULL AND BINARY TRIM(vd.notes) = BINARY TRIM(vd.diagnosis) THEN 1 ELSE 0 END
              ) >= 3
              AND CHAR_LENGTH(TRIM(vd.diagnosis)) <= 80
          )
      );
    SET v_vet_rows_updated = ROW_COUNT();

    UPDATE online_consultation_diagnoses ocd
    SET
        ocd.recommendations = CASE
            WHEN NULLIF(TRIM(ocd.recommendations), '') IS NOT NULL
             AND BINARY TRIM(ocd.recommendations) = BINARY TRIM(ocd.diagnosis)
                THEN NULL ELSE ocd.recommendations
        END,
        ocd.treatment = CASE
            WHEN NULLIF(TRIM(ocd.treatment), '') IS NOT NULL
             AND BINARY TRIM(ocd.treatment) = BINARY TRIM(ocd.diagnosis)
                THEN NULL ELSE ocd.treatment
        END,
        ocd.medications = CASE
            WHEN NULLIF(TRIM(ocd.medications), '') IS NOT NULL
             AND BINARY TRIM(ocd.medications) = BINARY TRIM(ocd.diagnosis)
                THEN NULL ELSE ocd.medications
        END,
        ocd.notes = CASE
            WHEN NULLIF(TRIM(ocd.notes), '') IS NOT NULL
             AND BINARY TRIM(ocd.notes) = BINARY TRIM(ocd.diagnosis)
                THEN NULL ELSE ocd.notes
        END
    WHERE NULLIF(TRIM(ocd.diagnosis), '') IS NOT NULL
      AND (
          (
              1
              + CASE WHEN NULLIF(TRIM(ocd.recommendations), '') IS NOT NULL AND BINARY TRIM(ocd.recommendations) = BINARY TRIM(ocd.diagnosis) THEN 1 ELSE 0 END
              + CASE WHEN NULLIF(TRIM(ocd.treatment), '') IS NOT NULL AND BINARY TRIM(ocd.treatment) = BINARY TRIM(ocd.diagnosis) THEN 1 ELSE 0 END
              + CASE WHEN NULLIF(TRIM(ocd.medications), '') IS NOT NULL AND BINARY TRIM(ocd.medications) = BINARY TRIM(ocd.diagnosis) THEN 1 ELSE 0 END
              + CASE WHEN NULLIF(TRIM(ocd.notes), '') IS NOT NULL AND BINARY TRIM(ocd.notes) = BINARY TRIM(ocd.diagnosis) THEN 1 ELSE 0 END
          ) >= 4
          OR (
              (
                  1
                  + CASE WHEN NULLIF(TRIM(ocd.recommendations), '') IS NOT NULL AND BINARY TRIM(ocd.recommendations) = BINARY TRIM(ocd.diagnosis) THEN 1 ELSE 0 END
                  + CASE WHEN NULLIF(TRIM(ocd.treatment), '') IS NOT NULL AND BINARY TRIM(ocd.treatment) = BINARY TRIM(ocd.diagnosis) THEN 1 ELSE 0 END
                  + CASE WHEN NULLIF(TRIM(ocd.medications), '') IS NOT NULL AND BINARY TRIM(ocd.medications) = BINARY TRIM(ocd.diagnosis) THEN 1 ELSE 0 END
                  + CASE WHEN NULLIF(TRIM(ocd.notes), '') IS NOT NULL AND BINARY TRIM(ocd.notes) = BINARY TRIM(ocd.diagnosis) THEN 1 ELSE 0 END
              ) >= 3
              AND CHAR_LENGTH(TRIM(ocd.diagnosis)) <= 80
          )
      );
    SET v_online_rows_updated = ROW_COUNT();

    SELECT COUNT(*)
    INTO v_vet_remaining
    FROM (
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
    ) scored
    WHERE scored.duplicate_column_count >= 4
       OR (
           scored.duplicate_column_count >= 3
           AND CHAR_LENGTH(TRIM(scored.diagnosis)) <= 80
       );

    SELECT COUNT(*)
    INTO v_online_remaining
    FROM (
        SELECT
            ocd.diagnosis,
            1
            + CASE WHEN NULLIF(TRIM(ocd.recommendations), '') IS NOT NULL AND BINARY TRIM(ocd.recommendations) = BINARY TRIM(ocd.diagnosis) THEN 1 ELSE 0 END
            + CASE WHEN NULLIF(TRIM(ocd.treatment), '') IS NOT NULL AND BINARY TRIM(ocd.treatment) = BINARY TRIM(ocd.diagnosis) THEN 1 ELSE 0 END
            + CASE WHEN NULLIF(TRIM(ocd.medications), '') IS NOT NULL AND BINARY TRIM(ocd.medications) = BINARY TRIM(ocd.diagnosis) THEN 1 ELSE 0 END
            + CASE WHEN NULLIF(TRIM(ocd.notes), '') IS NOT NULL AND BINARY TRIM(ocd.notes) = BINARY TRIM(ocd.diagnosis) THEN 1 ELSE 0 END AS duplicate_column_count
        FROM online_consultation_diagnoses ocd
        WHERE NULLIF(TRIM(ocd.diagnosis), '') IS NOT NULL
    ) scored
    WHERE scored.duplicate_column_count >= 4
       OR (
           scored.duplicate_column_count >= 3
           AND CHAR_LENGTH(TRIM(scored.diagnosis)) <= 80
       );

    IF v_vet_rows_updated <> v_vet_candidates
       OR v_online_rows_updated <> v_online_candidates
       OR v_vet_remaining <> 0
       OR v_online_remaining <> 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Cleanup post-check failed. All changes were rolled back.';
    END IF;

    SET @clinical_vet_rows_updated := v_vet_rows_updated;
    SET @clinical_online_rows_updated := v_online_rows_updated;
    SET @clinical_vet_candidates_remaining := v_vet_remaining;
    SET @clinical_online_candidates_remaining := v_online_remaining;

    COMMIT;
END$$

DELIMITER ;

CALL ipawcus_cleanup_clinical_propagation_20260727();
DROP PROCEDURE IF EXISTS ipawcus_cleanup_clinical_propagation_20260727;

SELECT
    @clinical_vet_candidates_before AS approved_vet_candidates_matched,
    @clinical_vet_cells_before AS vet_cells_set_to_null,
    @clinical_vet_rows_updated AS vet_rows_updated,
    @clinical_vet_candidates_remaining AS vet_candidates_remaining,
    @clinical_online_candidates_before AS approved_online_candidates_matched,
    @clinical_online_cells_before AS online_cells_set_to_null,
    @clinical_online_rows_updated AS online_rows_updated,
    @clinical_online_candidates_remaining AS online_candidates_remaining,
    CASE
        WHEN @clinical_vet_candidates_remaining = 0
         AND @clinical_online_candidates_remaining = 0
            THEN 'PASS'
        ELSE 'FAIL'
    END AS cleanup_status;

-- Final read-only verification. Both remaining_candidate_rows values must be 0.
SELECT
    'vet_diagnoses' AS source_table,
    COUNT(*) AS remaining_candidate_rows
FROM (
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
) scored
WHERE scored.duplicate_column_count >= 4
   OR (
       scored.duplicate_column_count >= 3
       AND CHAR_LENGTH(TRIM(scored.diagnosis)) <= 80
   )

UNION ALL

SELECT
    'online_consultation_diagnoses',
    COUNT(*)
FROM (
    SELECT
        ocd.diagnosis,
        1
        + CASE WHEN NULLIF(TRIM(ocd.recommendations), '') IS NOT NULL AND BINARY TRIM(ocd.recommendations) = BINARY TRIM(ocd.diagnosis) THEN 1 ELSE 0 END
        + CASE WHEN NULLIF(TRIM(ocd.treatment), '') IS NOT NULL AND BINARY TRIM(ocd.treatment) = BINARY TRIM(ocd.diagnosis) THEN 1 ELSE 0 END
        + CASE WHEN NULLIF(TRIM(ocd.medications), '') IS NOT NULL AND BINARY TRIM(ocd.medications) = BINARY TRIM(ocd.diagnosis) THEN 1 ELSE 0 END
        + CASE WHEN NULLIF(TRIM(ocd.notes), '') IS NOT NULL AND BINARY TRIM(ocd.notes) = BINARY TRIM(ocd.diagnosis) THEN 1 ELSE 0 END AS duplicate_column_count
    FROM online_consultation_diagnoses ocd
    WHERE NULLIF(TRIM(ocd.diagnosis), '') IS NOT NULL
) scored
WHERE scored.duplicate_column_count >= 4
   OR (
       scored.duplicate_column_count >= 3
       AND CHAR_LENGTH(TRIM(scored.diagnosis)) <= 80
   );
