-- iPawcus historical visit reconciliation (write phase)
-- Run only after:
--   1. 20260723_01_backend_integrity_schema.sql
--   2. 20260723_02_pet_allergy_backfill.sql
--   3. 20260723_03a_historical_visit_preview.sql has been reviewed
--
-- This script is idempotent:
-- - It creates missing visit rows for finalized in-clinic diagnoses.
-- - It creates missing visit rows for completed online consultations.
-- - It creates a service charge only when a positive booking price exists and
--   the visit has no existing charges.
-- - It never creates payment records.
--
-- Review the candidate result sets before running the INSERT statements in
-- production. Take a database backup first.

-- =========================================================
-- 1. Preview unresolved historical records
-- =========================================================

SELECT
    'vet_diagnosis_without_visit' AS reconciliation_type,
    vd.diagnosis_id AS source_id,
    vd.booking_id,
    vd.queue_id,
    vd.pet_id,
    COALESCE(b.user_id, q.user_id) AS resolved_owner_user_id,
    vd.veterinarian_user_id,
    COALESCE(b.price, 0.00) AS proposed_charge
FROM vet_diagnoses vd
LEFT JOIN bookings b ON b.booking_id = vd.booking_id
LEFT JOIN queues q ON q.queue_id = vd.queue_id
LEFT JOIN visits v ON v.diagnosis_id = vd.diagnosis_id
WHERE vd.finalized_at IS NOT NULL
  AND v.visit_id IS NULL
ORDER BY vd.diagnosis_id;

SELECT
    'online_consultation_without_visit' AS reconciliation_type,
    oc.online_consultation_id AS source_id,
    b.booking_id,
    b.pet_id,
    oc.owner_user_id AS resolved_owner_user_id,
    oc.veterinarian_user_id,
    COALESCE(b.price, 0.00) AS proposed_charge
FROM online_consultations oc
JOIN bookings b ON b.booking_id = oc.booking_id
LEFT JOIN visits v
    ON v.booking_id = b.booking_id
   AND v.pet_id = b.pet_id
WHERE oc.status = 'completed'
  AND b.status = 'completed'
  AND b.pet_id IS NOT NULL
  AND v.visit_id IS NULL
ORDER BY oc.online_consultation_id;

-- A non-empty result here requires manual owner/pet repair before the related
-- visit can be reconstructed.
SELECT
    'unresolved_vet_diagnosis' AS warning_type,
    vd.diagnosis_id,
    vd.booking_id,
    vd.queue_id,
    vd.pet_id
FROM vet_diagnoses vd
LEFT JOIN bookings b ON b.booking_id = vd.booking_id
LEFT JOIN queues q ON q.queue_id = vd.queue_id
LEFT JOIN visits v ON v.diagnosis_id = vd.diagnosis_id
WHERE vd.finalized_at IS NOT NULL
  AND v.visit_id IS NULL
  AND COALESCE(b.user_id, q.user_id) IS NULL;

-- Recheck every hard blocker in the write file itself. This prevents an
-- approved preview from becoming stale if records changed before 03b ran.
DROP PROCEDURE IF EXISTS ipawcus_assert_historical_visit_backfill_20260723;

DELIMITER $$

CREATE PROCEDURE ipawcus_assert_historical_visit_backfill_20260723()
BEGIN
    DECLARE invalid_unique_index_count INT DEFAULT 0;
    DECLARE hard_conflict_count INT DEFAULT 0;

    SELECT COUNT(*)
    INTO invalid_unique_index_count
    FROM (
        SELECT 'visits' AS table_name, 'visits_booking_pet_unique' AS index_name, 'booking_id,pet_id' AS column_list
        UNION ALL SELECT 'visits', 'visits_queue_pet_unique', 'queue_id,pet_id'
        UNION ALL SELECT 'visits', 'visits_diagnosis_unique', 'diagnosis_id'
    ) expected_index
    LEFT JOIN (
        SELECT
            table_name,
            index_name,
            MIN(non_unique) AS non_unique,
            GROUP_CONCAT(column_name ORDER BY seq_in_index SEPARATOR ',') AS column_list
        FROM information_schema.statistics
        WHERE table_schema = DATABASE()
        GROUP BY table_name, index_name
    ) actual_index
        ON actual_index.table_name = expected_index.table_name
       AND actual_index.index_name = expected_index.index_name
    WHERE actual_index.index_name IS NULL
       OR actual_index.non_unique <> 0
       OR actual_index.column_list <> expected_index.column_list;

    IF invalid_unique_index_count > 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Required visit unique indexes are invalid. Resolve script 01 output, then rerun script 01.';
    END IF;

    SELECT COUNT(*)
    INTO hard_conflict_count
    FROM (
        -- A finalized diagnosis must resolve to a real owner and consistent
        -- booking/queue patient identity.
        SELECT 1 AS conflict
        FROM vet_diagnoses vd
        LEFT JOIN bookings b ON b.booking_id = vd.booking_id
        LEFT JOIN queues q ON q.queue_id = vd.queue_id
        LEFT JOIN visits linked_visit ON linked_visit.diagnosis_id = vd.diagnosis_id
        WHERE vd.finalized_at IS NOT NULL
          AND linked_visit.visit_id IS NULL
          AND (
              COALESCE(b.user_id, q.user_id) IS NULL
              OR (vd.booking_id IS NOT NULL AND b.booking_id IS NULL)
              OR (vd.queue_id IS NOT NULL AND q.queue_id IS NULL)
              OR (b.pet_id IS NOT NULL AND b.pet_id <> vd.pet_id)
              OR (q.pet_id IS NOT NULL AND q.pet_id <> vd.pet_id)
              OR (
                  vd.booking_id IS NOT NULL
                  AND q.booking_id IS NOT NULL
                  AND q.booking_id <> vd.booking_id
              )
              OR (
                  b.user_id IS NOT NULL
                  AND q.user_id IS NOT NULL
                  AND b.user_id <> q.user_id
              )
              OR EXISTS (
                  SELECT 1
                  FROM visits owner_conflict_visit
                  WHERE owner_conflict_visit.pet_id = vd.pet_id
                    AND owner_conflict_visit.owner_user_id <> COALESCE(b.user_id, q.user_id)
                    AND (
                        (vd.queue_id IS NOT NULL AND owner_conflict_visit.queue_id = vd.queue_id)
                        OR (vd.booking_id IS NOT NULL AND owner_conflict_visit.booking_id = vd.booking_id)
                    )
              )
          )

        UNION ALL

        -- One diagnosis cannot be auto-linked when queue/booking identity
        -- points to more than one existing visit.
        SELECT 1
        FROM vet_diagnoses vd
        JOIN visits identity_visit
            ON identity_visit.pet_id = vd.pet_id
           AND (
               (vd.queue_id IS NOT NULL AND identity_visit.queue_id = vd.queue_id)
               OR (vd.booking_id IS NOT NULL AND identity_visit.booking_id = vd.booking_id)
           )
        LEFT JOIN visits linked_visit ON linked_visit.diagnosis_id = vd.diagnosis_id
        WHERE vd.finalized_at IS NOT NULL
          AND linked_visit.visit_id IS NULL
        GROUP BY vd.diagnosis_id
        HAVING COUNT(DISTINCT identity_visit.visit_id) > 1

        UNION ALL

        -- One unlinked visit cannot be assigned to multiple diagnoses.
        SELECT 1
        FROM vet_diagnoses vd
        JOIN visits identity_visit
            ON identity_visit.diagnosis_id IS NULL
           AND identity_visit.pet_id = vd.pet_id
           AND (
               (vd.queue_id IS NOT NULL AND identity_visit.queue_id = vd.queue_id)
               OR (vd.booking_id IS NOT NULL AND identity_visit.booking_id = vd.booking_id)
           )
        LEFT JOIN visits linked_visit ON linked_visit.diagnosis_id = vd.diagnosis_id
        WHERE vd.finalized_at IS NOT NULL
          AND linked_visit.visit_id IS NULL
        GROUP BY identity_visit.visit_id
        HAVING COUNT(DISTINCT vd.diagnosis_id) > 1

        UNION ALL

        -- A matching identity already linked to another diagnosis is never
        -- overwritten.
        SELECT 1
        FROM vet_diagnoses vd
        JOIN visits identity_visit
            ON identity_visit.pet_id = vd.pet_id
           AND identity_visit.diagnosis_id IS NOT NULL
           AND identity_visit.diagnosis_id <> vd.diagnosis_id
           AND (
               (vd.queue_id IS NOT NULL AND identity_visit.queue_id = vd.queue_id)
               OR (vd.booking_id IS NOT NULL AND identity_visit.booking_id = vd.booking_id)
           )
        LEFT JOIN visits linked_visit ON linked_visit.diagnosis_id = vd.diagnosis_id
        WHERE vd.finalized_at IS NOT NULL
          AND linked_visit.visit_id IS NULL

        UNION ALL

        -- Completed online consultations must resolve to the same registered
        -- owner/pet as their booking, with no conflicting visit identity.
        SELECT 1
        FROM online_consultations oc
        JOIN bookings b ON b.booking_id = oc.booking_id
        WHERE oc.status = 'completed'
          AND b.status = 'completed'
          AND (
              b.pet_id IS NULL
              OR b.user_id <> oc.owner_user_id
              OR EXISTS (
                  SELECT 1
                  FROM visits owner_conflict_visit
                  WHERE owner_conflict_visit.booking_id = b.booking_id
                    AND owner_conflict_visit.pet_id = b.pet_id
                    AND owner_conflict_visit.owner_user_id <> oc.owner_user_id
              )
              OR EXISTS (
                  SELECT 1
                  FROM visits conflicting_visit
                  WHERE conflicting_visit.booking_id = b.booking_id
                    AND conflicting_visit.pet_id <> b.pet_id
              )
          )
    ) hard_conflict;

    IF hard_conflict_count > 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Historical visit identity conflicts remain. Review 03a, repair every BLOCKED row, and rerun 03a before 03b.';
    END IF;
END$$

DELIMITER ;

CALL ipawcus_assert_historical_visit_backfill_20260723();
DROP PROCEDURE IF EXISTS ipawcus_assert_historical_visit_backfill_20260723;

-- =========================================================
-- 2. Reconstruct visits for finalized in-clinic diagnoses
-- =========================================================

START TRANSACTION;

-- A legacy visit may already represent the same queue or booking but have no
-- diagnosis_id because that linkage was introduced later. Attach the diagnosis
-- before attempting a new insert so the identity constraints are respected.
UPDATE visits v
JOIN (
    SELECT
        vd.diagnosis_id,
        MIN(existing_visit.visit_id) AS visit_id
    FROM vet_diagnoses vd
    JOIN visits existing_visit
        ON existing_visit.diagnosis_id IS NULL
       AND (
           (
               vd.queue_id IS NOT NULL
               AND existing_visit.queue_id = vd.queue_id
               AND existing_visit.pet_id = vd.pet_id
           )
           OR (
               vd.booking_id IS NOT NULL
               AND existing_visit.booking_id = vd.booking_id
               AND existing_visit.pet_id = vd.pet_id
           )
       )
    LEFT JOIN visits already_linked
        ON already_linked.diagnosis_id = vd.diagnosis_id
    WHERE vd.finalized_at IS NOT NULL
      AND already_linked.visit_id IS NULL
    GROUP BY vd.diagnosis_id
) diagnosis_match ON diagnosis_match.visit_id = v.visit_id
SET v.diagnosis_id = diagnosis_match.diagnosis_id;

INSERT INTO visits (
    pet_id,
    owner_user_id,
    veterinarian_user_id,
    queue_id,
    booking_id,
    diagnosis_id,
    source_type,
    visit_status,
    billing_status,
    created_at,
    updated_at
)
SELECT
    vd.pet_id,
    COALESCE(b.user_id, q.user_id),
    vd.veterinarian_user_id,
    vd.queue_id,
    vd.booking_id,
    vd.diagnosis_id,
    CASE
        WHEN vd.queue_id IS NOT NULL THEN 'queue'
        WHEN vd.booking_id IS NOT NULL THEN 'booking'
        ELSE 'manual'
    END,
    'completed',
    'unbilled',
    COALESCE(vd.finalized_at, vd.created_at, CURRENT_TIMESTAMP),
    COALESCE(vd.updated_at, vd.finalized_at, CURRENT_TIMESTAMP)
FROM vet_diagnoses vd
LEFT JOIN bookings b ON b.booking_id = vd.booking_id
LEFT JOIN queues q ON q.queue_id = vd.queue_id
WHERE vd.finalized_at IS NOT NULL
  AND COALESCE(b.user_id, q.user_id) IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM visits existing_visit
      WHERE existing_visit.diagnosis_id = vd.diagnosis_id
         OR (
             vd.queue_id IS NOT NULL
             AND existing_visit.queue_id = vd.queue_id
             AND existing_visit.pet_id = vd.pet_id
         )
         OR (
             vd.booking_id IS NOT NULL
             AND existing_visit.booking_id = vd.booking_id
             AND existing_visit.pet_id = vd.pet_id
         )
  );

-- =========================================================
-- 3. Reconstruct visits for completed online consultations
-- =========================================================

INSERT INTO visits (
    pet_id,
    owner_user_id,
    veterinarian_user_id,
    queue_id,
    booking_id,
    diagnosis_id,
    source_type,
    visit_status,
    billing_status,
    created_at,
    updated_at
)
SELECT
    b.pet_id,
    oc.owner_user_id,
    oc.veterinarian_user_id,
    NULL,
    b.booking_id,
    NULL,
    'booking',
    'completed',
    'unbilled',
    COALESCE(oc.ended_at, oc.updated_at, b.created_at, CURRENT_TIMESTAMP),
    COALESCE(oc.updated_at, oc.ended_at, CURRENT_TIMESTAMP)
FROM online_consultations oc
JOIN bookings b ON b.booking_id = oc.booking_id
WHERE oc.status = 'completed'
  AND b.status = 'completed'
  AND b.pet_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM visits existing_visit
      WHERE existing_visit.booking_id = b.booking_id
        AND existing_visit.pet_id = b.pet_id
  );

-- =========================================================
-- 4. Add evidence-based charges (never payments)
-- =========================================================

-- In-clinic diagnosis charge: use the price captured on the booking.
INSERT INTO visit_charges (
    visit_id,
    charge_type,
    service_id,
    item_id,
    description,
    quantity,
    unit_price,
    subtotal,
    created_by_user_id,
    created_at,
    updated_at
)
SELECT
    v.visit_id,
    'service',
    NULL,
    NULL,
    CONCAT(
        'Historical service charge - ',
        COALESCE(NULLIF(vd.service_name, ''), NULLIF(b.service_type, ''), 'Veterinary service')
    ),
    1.00,
    b.price,
    b.price,
    vd.veterinarian_user_id,
    COALESCE(vd.finalized_at, vd.created_at, CURRENT_TIMESTAMP),
    COALESCE(vd.updated_at, vd.finalized_at, CURRENT_TIMESTAMP)
FROM visits v
JOIN vet_diagnoses vd ON vd.diagnosis_id = v.diagnosis_id
JOIN bookings b ON b.booking_id = vd.booking_id
WHERE b.price > 0
  AND NOT EXISTS (
      SELECT 1
      FROM visit_charges existing_charge
      WHERE existing_charge.visit_id = v.visit_id
  )
  AND NOT EXISTS (
       SELECT 1
       FROM visit_payments existing_payment
       WHERE existing_payment.visit_id = v.visit_id
         AND existing_payment.payment_status NOT IN ('voided', 'failed')
  );

-- Online consultation charge: use the price captured on the booking and link
-- to the active consultation service when one can be resolved unambiguously.
INSERT INTO visit_charges (
    visit_id,
    charge_type,
    service_id,
    item_id,
    description,
    quantity,
    unit_price,
    subtotal,
    created_by_user_id,
    created_at,
    updated_at
)
SELECT
    v.visit_id,
    'service',
    (
        SELECT sc.service_id
        FROM service_catalog sc
        WHERE sc.is_active = 1
          AND (
              sc.service_code = 'CONSULT-GENERAL'
              OR sc.service_type = 'consultation'
          )
        ORDER BY
            CASE WHEN sc.service_code = 'CONSULT-GENERAL' THEN 0 ELSE 1 END,
            sc.service_id ASC
        LIMIT 1
    ),
    NULL,
    CONCAT('Historical online consultation - ', b.booking_number),
    1.00,
    b.price,
    b.price,
    oc.veterinarian_user_id,
    COALESCE(oc.ended_at, oc.updated_at, b.created_at, CURRENT_TIMESTAMP),
    COALESCE(oc.updated_at, oc.ended_at, CURRENT_TIMESTAMP)
FROM visits v
JOIN bookings b ON b.booking_id = v.booking_id
JOIN online_consultations oc ON oc.booking_id = b.booking_id
WHERE oc.status = 'completed'
  AND b.status = 'completed'
  AND b.price > 0
  AND NOT EXISTS (
      SELECT 1
      FROM visit_charges existing_charge
      WHERE existing_charge.visit_id = v.visit_id
  )
  AND NOT EXISTS (
       SELECT 1
       FROM visit_payments existing_payment
       WHERE existing_payment.visit_id = v.visit_id
         AND existing_payment.payment_status NOT IN ('voided', 'failed')
  );

-- Recalculate billing state without inventing payment history.
UPDATE visits v
LEFT JOIN (
    SELECT visit_id, ROUND(COALESCE(SUM(subtotal), 0), 2) AS charge_total
    FROM visit_charges
    GROUP BY visit_id
) charges ON charges.visit_id = v.visit_id
LEFT JOIN (
    SELECT visit_id, ROUND(COALESCE(SUM(amount), 0), 2) AS paid_total
    FROM visit_payments
    WHERE payment_status = 'verified'
    GROUP BY visit_id
) payments ON payments.visit_id = v.visit_id
SET v.billing_status = CASE
    WHEN COALESCE(charges.charge_total, 0) <= 0 THEN 'unbilled'
    WHEN COALESCE(payments.paid_total, 0) <= 0 THEN 'unpaid'
    WHEN payments.paid_total + 0.0049 < charges.charge_total THEN 'partial'
    ELSE 'paid'
END
WHERE v.visit_status <> 'cancelled'
  AND v.billing_status <> 'refunded'
  AND (
      EXISTS (
          SELECT 1
          FROM vet_diagnoses vd
          WHERE vd.diagnosis_id = v.diagnosis_id
            AND vd.finalized_at IS NOT NULL
      )
      OR EXISTS (
          SELECT 1
          FROM online_consultations oc
          JOIN bookings b ON b.booking_id = oc.booking_id
          WHERE b.booking_id = v.booking_id
            AND b.pet_id = v.pet_id
            AND oc.status = 'completed'
            AND b.status = 'completed'
      )
  );

COMMIT;

-- =========================================================
-- 5. Post-backfill verification
-- =========================================================

SELECT
    COUNT(*) AS finalized_diagnoses_without_visit
FROM vet_diagnoses vd
LEFT JOIN visits v ON v.diagnosis_id = vd.diagnosis_id
WHERE vd.finalized_at IS NOT NULL
  AND v.visit_id IS NULL;

SELECT
    COUNT(*) AS completed_online_consultations_without_visit
FROM online_consultations oc
JOIN bookings b ON b.booking_id = oc.booking_id
LEFT JOIN visits v
    ON v.booking_id = b.booking_id
   AND v.pet_id = b.pet_id
WHERE oc.status = 'completed'
  AND b.status = 'completed'
  AND b.pet_id IS NOT NULL
  AND v.visit_id IS NULL;

SELECT COUNT(*) AS positive_price_diagnosis_visits_without_charge
FROM vet_diagnoses vd
JOIN bookings b ON b.booking_id = vd.booking_id
JOIN visits v ON v.diagnosis_id = vd.diagnosis_id
WHERE vd.finalized_at IS NOT NULL
  AND b.price > 0
  AND NOT EXISTS (
      SELECT 1
      FROM visit_charges vc
      WHERE vc.visit_id = v.visit_id
  );

SELECT COUNT(*) AS positive_price_online_visits_without_charge
FROM online_consultations oc
JOIN bookings b ON b.booking_id = oc.booking_id
JOIN visits v
    ON v.booking_id = b.booking_id
   AND v.pet_id = b.pet_id
WHERE oc.status = 'completed'
  AND b.status = 'completed'
  AND b.price > 0
  AND NOT EXISTS (
      SELECT 1
      FROM visit_charges vc
      WHERE vc.visit_id = v.visit_id
  );

SELECT
    v.visit_id,
    v.booking_id,
    v.diagnosis_id,
    v.source_type,
    v.visit_status,
    v.billing_status,
    ROUND(COALESCE(SUM(vc.subtotal), 0), 2) AS charge_total,
    ROUND(COALESCE((
        SELECT SUM(vp.amount)
        FROM visit_payments vp
        WHERE vp.visit_id = v.visit_id
          AND vp.payment_status = 'verified'
    ), 0), 2) AS verified_payment_total
FROM visits v
LEFT JOIN visit_charges vc ON vc.visit_id = v.visit_id
GROUP BY
    v.visit_id,
    v.booking_id,
    v.diagnosis_id,
    v.source_type,
    v.visit_status,
    v.billing_status
ORDER BY v.visit_id;
