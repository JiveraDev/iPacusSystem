-- iPawcus historical visit reconciliation preview (read-only)
-- Run after scripts 01 and 02.
--
-- Review every result before running
-- DDL/20260723_03b_historical_visit_backfill.sql.

SELECT
    'vet_diagnosis_without_visit' AS reconciliation_type,
    vd.diagnosis_id AS source_id,
    vd.booking_id,
    vd.queue_id,
    vd.pet_id,
    COALESCE(b.user_id, q.user_id) AS resolved_owner_user_id,
    vd.veterinarian_user_id,
    COALESCE(b.price, 0.00) AS proposed_charge,
    CASE
        WHEN COALESCE(b.user_id, q.user_id) IS NULL THEN 'BLOCKED_OWNER_REVIEW'
        WHEN (vd.booking_id IS NOT NULL AND b.booking_id IS NULL)
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
            THEN 'BLOCKED_OWNER_PET_CONFLICT'
        WHEN (
            SELECT COUNT(DISTINCT candidate_visit.visit_id)
            FROM visits candidate_visit
            WHERE candidate_visit.pet_id = vd.pet_id
              AND (
                  (vd.queue_id IS NOT NULL AND candidate_visit.queue_id = vd.queue_id)
                  OR (vd.booking_id IS NOT NULL AND candidate_visit.booking_id = vd.booking_id)
              )
        ) > 1
            THEN 'BLOCKED_AMBIGUOUS_IDENTITY'
        WHEN EXISTS (
            SELECT 1
            FROM visits conflicting_visit
            WHERE conflicting_visit.pet_id = vd.pet_id
              AND conflicting_visit.diagnosis_id IS NOT NULL
              AND conflicting_visit.diagnosis_id <> vd.diagnosis_id
              AND (
                  (vd.queue_id IS NOT NULL AND conflicting_visit.queue_id = vd.queue_id)
                  OR (vd.booking_id IS NOT NULL AND conflicting_visit.booking_id = vd.booking_id)
              )
        )
            THEN 'BLOCKED_IDENTITY_CONFLICT'
        WHEN identity_visit.visit_id IS NOT NULL THEN 'WILL_LINK_EXISTING_VISIT'
        ELSE 'WILL_CREATE_VISIT'
    END AS proposed_action,
    identity_visit.visit_id AS identity_visit_id,
    identity_visit.diagnosis_id AS identity_visit_diagnosis_id
FROM vet_diagnoses vd
LEFT JOIN bookings b ON b.booking_id = vd.booking_id
LEFT JOIN queues q ON q.queue_id = vd.queue_id
LEFT JOIN visits linked_visit ON linked_visit.diagnosis_id = vd.diagnosis_id
LEFT JOIN visits identity_visit
    ON identity_visit.pet_id = vd.pet_id
   AND (
       (vd.queue_id IS NOT NULL AND identity_visit.queue_id = vd.queue_id)
       OR (vd.booking_id IS NOT NULL AND identity_visit.booking_id = vd.booking_id)
   )
WHERE vd.finalized_at IS NOT NULL
  AND linked_visit.visit_id IS NULL
ORDER BY vd.diagnosis_id, identity_visit.visit_id;

SELECT
    'online_consultation_without_visit' AS reconciliation_type,
    oc.online_consultation_id AS source_id,
    b.booking_id,
    b.pet_id,
    oc.owner_user_id AS resolved_owner_user_id,
    oc.veterinarian_user_id,
    COALESCE(b.price, 0.00) AS proposed_charge,
    CASE
        WHEN b.pet_id IS NULL THEN 'BLOCKED_UNREGISTERED_PATIENT'
        WHEN b.user_id <> oc.owner_user_id THEN 'BLOCKED_OWNER_PET_CONFLICT'
        WHEN EXISTS (
            SELECT 1
            FROM visits owner_conflict_visit
            WHERE owner_conflict_visit.booking_id = b.booking_id
              AND owner_conflict_visit.pet_id = b.pet_id
              AND owner_conflict_visit.owner_user_id <> oc.owner_user_id
        ) THEN 'BLOCKED_OWNER_PET_CONFLICT'
        WHEN EXISTS (
            SELECT 1
            FROM visits conflicting_visit
            WHERE conflicting_visit.booking_id = b.booking_id
              AND conflicting_visit.pet_id <> b.pet_id
        ) THEN 'BLOCKED_IDENTITY_CONFLICT'
        ELSE 'WILL_CREATE_VISIT'
    END AS proposed_action
FROM online_consultations oc
JOIN bookings b ON b.booking_id = oc.booking_id
LEFT JOIN visits v
    ON v.booking_id = b.booking_id
   AND v.pet_id = b.pet_id
WHERE oc.status = 'completed'
  AND b.status = 'completed'
  AND v.visit_id IS NULL
ORDER BY oc.online_consultation_id;

-- Every result in this set is a hard blocker. Repair the ownership/patient
-- identity or choose the correct legacy visit manually before running 03b.
SELECT
    'diagnosis_matches_multiple_visits' AS conflict_type,
    candidate.diagnosis_id AS source_id,
    NULL AS related_id,
    COUNT(DISTINCT candidate.visit_id) AS conflict_count
FROM (
    SELECT vd.diagnosis_id, identity_visit.visit_id
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
) candidate
GROUP BY candidate.diagnosis_id
HAVING COUNT(DISTINCT candidate.visit_id) > 1

UNION ALL

SELECT
    'visit_matches_multiple_diagnoses',
    MIN(candidate.diagnosis_id),
    candidate.visit_id,
    COUNT(DISTINCT candidate.diagnosis_id)
FROM (
    SELECT vd.diagnosis_id, identity_visit.visit_id
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
) candidate
GROUP BY candidate.visit_id
HAVING COUNT(DISTINCT candidate.diagnosis_id) > 1

UNION ALL

SELECT
    'diagnosis_owner_or_pet_mismatch',
    vd.diagnosis_id,
    NULL,
    1
FROM vet_diagnoses vd
LEFT JOIN bookings b ON b.booking_id = vd.booking_id
LEFT JOIN queues q ON q.queue_id = vd.queue_id
LEFT JOIN visits linked_visit ON linked_visit.diagnosis_id = vd.diagnosis_id
WHERE vd.finalized_at IS NOT NULL
  AND linked_visit.visit_id IS NULL
  AND (
      (vd.booking_id IS NOT NULL AND b.booking_id IS NULL)
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

SELECT
    'online_consultation_owner_mismatch',
    oc.online_consultation_id,
    b.booking_id,
    1
FROM online_consultations oc
JOIN bookings b ON b.booking_id = oc.booking_id
WHERE oc.status = 'completed'
  AND b.status = 'completed'
  AND (
      b.user_id <> oc.owner_user_id
      OR EXISTS (
          SELECT 1
          FROM visits owner_conflict_visit
          WHERE owner_conflict_visit.booking_id = b.booking_id
            AND owner_conflict_visit.pet_id = b.pet_id
            AND owner_conflict_visit.owner_user_id <> oc.owner_user_id
      )
  )

UNION ALL

SELECT
    'online_booking_has_different_pet_visit',
    oc.online_consultation_id,
    conflicting_visit.visit_id,
    1
FROM online_consultations oc
JOIN bookings b ON b.booking_id = oc.booking_id
JOIN visits conflicting_visit
    ON conflicting_visit.booking_id = b.booking_id
   AND conflicting_visit.pet_id <> b.pet_id
WHERE oc.status = 'completed'
  AND b.status = 'completed';

-- Any result means script 01 could not install the corresponding unique key.
-- Resolve these duplicates before the write phase.
SELECT
    'duplicate_booking_pet_visit' AS conflict_type,
    booking_id AS source_id,
    pet_id,
    COUNT(*) AS conflict_count
FROM visits
WHERE booking_id IS NOT NULL
GROUP BY booking_id, pet_id
HAVING COUNT(*) > 1

UNION ALL

SELECT
    'duplicate_queue_pet_visit',
    queue_id,
    pet_id,
    COUNT(*)
FROM visits
WHERE queue_id IS NOT NULL
GROUP BY queue_id, pet_id
HAVING COUNT(*) > 1;

SELECT
    'duplicate_diagnosis_visit' AS conflict_type,
    diagnosis_id AS source_id,
    COUNT(*) AS conflict_count
FROM visits
WHERE diagnosis_id IS NOT NULL
GROUP BY diagnosis_id
HAVING COUNT(*) > 1;

SELECT
    'duplicate_payment_reference' AS conflict_type,
    payment_method,
    reference_number,
    COUNT(*) AS conflict_count
FROM visit_payments
WHERE reference_number IS NOT NULL
GROUP BY payment_method, reference_number
HAVING COUNT(*) > 1;

-- Expected current production preview:
-- - 1 finalized veterinarian diagnosis visit, with no charge because the
--   captured booking price is 0.00.
-- - 3 completed online-consultation visits, with captured charges of
--   500.00, 499.00, and 500.00.
-- - No payments will be proposed or created.
