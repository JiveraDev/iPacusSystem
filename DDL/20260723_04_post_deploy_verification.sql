-- iPawcus post-deployment verification (read-only)
-- Run after scripts 01, 02, 03a, and 03b and after deploying the matching backend.
-- Every "problem_count" result should be 0 unless the accompanying comment
-- explicitly says that the result is informational.

SELECT DATABASE() AS selected_database, VERSION() AS database_version, NOW() AS checked_at;

-- =========================================================
-- 1. Affected-table inventory (informational)
-- =========================================================

SELECT affected.table_name, COALESCE(table_rows.row_count, 0) AS row_count
FROM (
    SELECT 'boarding_assignments' AS table_name
    UNION ALL SELECT 'boarding_documents'
    UNION ALL SELECT 'boarding_observations'
    UNION ALL SELECT 'boarding_tasks'
    UNION ALL SELECT 'online_consultation_reschedules'
    UNION ALL SELECT 'pet_allergies'
    UNION ALL SELECT 'pet_owner_todos'
    UNION ALL SELECT 'pet_record_update_requests'
    UNION ALL SELECT 'room_unit_statuses'
    UNION ALL SELECT 'service_materials'
    UNION ALL SELECT 'visits'
    UNION ALL SELECT 'visit_charges'
    UNION ALL SELECT 'visit_payments'
) affected
LEFT JOIN (
    SELECT 'boarding_assignments' AS table_name, COUNT(*) AS row_count FROM boarding_assignments
    UNION ALL SELECT 'boarding_documents', COUNT(*) FROM boarding_documents
    UNION ALL SELECT 'boarding_observations', COUNT(*) FROM boarding_observations
    UNION ALL SELECT 'boarding_tasks', COUNT(*) FROM boarding_tasks
    UNION ALL SELECT 'online_consultation_reschedules', COUNT(*) FROM online_consultation_reschedules
    UNION ALL SELECT 'pet_allergies', COUNT(*) FROM pet_allergies
    UNION ALL SELECT 'pet_owner_todos', COUNT(*) FROM pet_owner_todos
    UNION ALL SELECT 'pet_record_update_requests', COUNT(*) FROM pet_record_update_requests
    UNION ALL SELECT 'room_unit_statuses', COUNT(*) FROM room_unit_statuses
    UNION ALL SELECT 'service_materials', COUNT(*) FROM service_materials
    UNION ALL SELECT 'visits', COUNT(*) FROM visits
    UNION ALL SELECT 'visit_charges', COUNT(*) FROM visit_charges
    UNION ALL SELECT 'visit_payments', COUNT(*) FROM visit_payments
) table_rows ON table_rows.table_name = affected.table_name
ORDER BY affected.table_name;

-- =========================================================
-- 2. Required new schema
-- =========================================================

SELECT COUNT(*) AS problem_count
FROM (
    SELECT 'pet_allergies' AS table_name, 'reaction' AS column_name
    UNION ALL SELECT 'pet_allergies', 'source'
    UNION ALL SELECT 'pet_allergies', 'verification_status'
    UNION ALL SELECT 'pet_allergies', 'created_by_user_id'
    UNION ALL SELECT 'pet_allergies', 'updated_by_user_id'
    UNION ALL SELECT 'pet_allergies', 'verified_by_user_id'
    UNION ALL SELECT 'pet_allergies', 'verified_at'
    UNION ALL SELECT 'pet_allergies', 'created_at'
    UNION ALL SELECT 'pet_allergies', 'updated_at'
    UNION ALL SELECT 'boarding_observations', 'appetite_status'
    UNION ALL SELECT 'boarding_observations', 'water_intake_status'
    UNION ALL SELECT 'boarding_observations', 'elimination_status'
    UNION ALL SELECT 'boarding_observations', 'behavior_status'
    UNION ALL SELECT 'boarding_observations', 'temperature_c'
    UNION ALL SELECT 'boarding_observations', 'weight_kg'
    UNION ALL SELECT 'boarding_observations', 'condition_severity'
    UNION ALL SELECT 'boarding_observations', 'requires_vet_review'
    UNION ALL SELECT 'boarding_material_usages', 'usage_id'
    UNION ALL SELECT 'boarding_material_usages', 'client_reference'
    UNION ALL SELECT 'boarding_material_usages', 'assignment_id'
    UNION ALL SELECT 'boarding_material_usages', 'booking_id'
    UNION ALL SELECT 'boarding_material_usages', 'pet_id'
    UNION ALL SELECT 'boarding_material_usages', 'item_id'
    UNION ALL SELECT 'boarding_material_usages', 'item_name'
    UNION ALL SELECT 'boarding_material_usages', 'category'
    UNION ALL SELECT 'boarding_material_usages', 'unit'
    UNION ALL SELECT 'boarding_material_usages', 'quantity'
    UNION ALL SELECT 'boarding_material_usages', 'unit_price'
    UNION ALL SELECT 'boarding_material_usages', 'notes'
    UNION ALL SELECT 'boarding_material_usages', 'status'
    UNION ALL SELECT 'boarding_material_usages', 'recorded_by_user_id'
    UNION ALL SELECT 'boarding_material_usages', 'recorded_by_name'
    UNION ALL SELECT 'boarding_material_usages', 'voided_by_user_id'
    UNION ALL SELECT 'boarding_material_usages', 'voided_by_name'
    UNION ALL SELECT 'boarding_material_usages', 'voided_at'
    UNION ALL SELECT 'boarding_material_usages', 'created_at'
    UNION ALL SELECT 'boarding_material_usages', 'updated_at'
    UNION ALL SELECT 'pet_record_update_request_events', 'event_id'
    UNION ALL SELECT 'pet_record_update_request_events', 'request_id'
    UNION ALL SELECT 'pet_record_update_request_events', 'event_type'
    UNION ALL SELECT 'pet_record_update_request_events', 'from_status'
    UNION ALL SELECT 'pet_record_update_request_events', 'to_status'
    UNION ALL SELECT 'pet_record_update_request_events', 'from_payment_status'
    UNION ALL SELECT 'pet_record_update_request_events', 'to_payment_status'
    UNION ALL SELECT 'pet_record_update_request_events', 'actor_user_id'
    UNION ALL SELECT 'pet_record_update_request_events', 'note'
    UNION ALL SELECT 'pet_record_update_request_events', 'created_at'
    UNION ALL SELECT 'pet_record_update_requests', 'baseline_snapshot_hash'
    UNION ALL SELECT 'pet_record_update_requests', 'completed_snapshot_hash'
    UNION ALL SELECT 'visit_charges', 'boarding_material_usage_id'
) required_column
LEFT JOIN information_schema.columns existing_column
    ON existing_column.table_schema = DATABASE()
   AND existing_column.table_name = required_column.table_name
   AND existing_column.column_name = required_column.column_name
WHERE existing_column.column_name IS NULL;

SELECT COUNT(*) AS problem_count
FROM (
    SELECT 'boarding_material_usages' AS table_name
    UNION ALL SELECT 'pet_record_update_request_events'
) required_table
LEFT JOIN information_schema.tables existing_table
    ON existing_table.table_schema = DATABASE()
   AND existing_table.table_name = required_table.table_name
WHERE existing_table.table_name IS NULL;

SELECT COUNT(*) AS problem_count
FROM (
    SELECT 'boarding_material_usages' AS table_name, 'usage_id' AS column_name, 'int' AS data_type, 'NO' AS is_nullable
    UNION ALL SELECT 'boarding_material_usages', 'client_reference', 'varchar', 'YES'
    UNION ALL SELECT 'boarding_material_usages', 'assignment_id', 'int', 'NO'
    UNION ALL SELECT 'boarding_material_usages', 'booking_id', 'int', 'NO'
    UNION ALL SELECT 'boarding_material_usages', 'pet_id', 'int', 'YES'
    UNION ALL SELECT 'boarding_material_usages', 'item_id', 'int', 'YES'
    UNION ALL SELECT 'boarding_material_usages', 'item_name', 'varchar', 'NO'
    UNION ALL SELECT 'boarding_material_usages', 'category', 'varchar', 'YES'
    UNION ALL SELECT 'boarding_material_usages', 'unit', 'varchar', 'NO'
    UNION ALL SELECT 'boarding_material_usages', 'quantity', 'decimal', 'NO'
    UNION ALL SELECT 'boarding_material_usages', 'unit_price', 'decimal', 'NO'
    UNION ALL SELECT 'boarding_material_usages', 'notes', 'text', 'YES'
    UNION ALL SELECT 'boarding_material_usages', 'status', 'enum', 'NO'
    UNION ALL SELECT 'boarding_material_usages', 'recorded_by_user_id', 'int', 'YES'
    UNION ALL SELECT 'boarding_material_usages', 'recorded_by_name', 'varchar', 'YES'
    UNION ALL SELECT 'boarding_material_usages', 'voided_by_user_id', 'int', 'YES'
    UNION ALL SELECT 'boarding_material_usages', 'voided_by_name', 'varchar', 'YES'
    UNION ALL SELECT 'boarding_material_usages', 'voided_at', 'datetime', 'YES'
    UNION ALL SELECT 'boarding_material_usages', 'created_at', 'timestamp', 'NO'
    UNION ALL SELECT 'boarding_material_usages', 'updated_at', 'timestamp', 'NO'
    UNION ALL SELECT 'pet_record_update_request_events', 'event_id', 'bigint', 'NO'
    UNION ALL SELECT 'pet_record_update_request_events', 'request_id', 'int', 'NO'
    UNION ALL SELECT 'pet_record_update_request_events', 'event_type', 'varchar', 'NO'
    UNION ALL SELECT 'pet_record_update_request_events', 'from_status', 'varchar', 'YES'
    UNION ALL SELECT 'pet_record_update_request_events', 'to_status', 'varchar', 'YES'
    UNION ALL SELECT 'pet_record_update_request_events', 'from_payment_status', 'varchar', 'YES'
    UNION ALL SELECT 'pet_record_update_request_events', 'to_payment_status', 'varchar', 'YES'
    UNION ALL SELECT 'pet_record_update_request_events', 'actor_user_id', 'int', 'YES'
    UNION ALL SELECT 'pet_record_update_request_events', 'note', 'text', 'YES'
    UNION ALL SELECT 'pet_record_update_request_events', 'created_at', 'timestamp', 'NO'
    UNION ALL SELECT 'visit_charges', 'boarding_material_usage_id', 'int', 'YES'
) required_column
LEFT JOIN information_schema.columns actual_column
    ON actual_column.table_schema = DATABASE()
   AND actual_column.table_name = required_column.table_name
   AND actual_column.column_name = required_column.column_name
WHERE actual_column.column_name IS NULL
   OR LOWER(actual_column.data_type) <> required_column.data_type
   OR actual_column.is_nullable <> required_column.is_nullable;

SELECT COUNT(*) AS problem_count
FROM (
    SELECT 'boarding_material_usages' AS table_name, 'PRIMARY' AS index_name, 0 AS non_unique, 'usage_id' AS column_list
    UNION ALL SELECT 'boarding_material_usages', 'boarding_material_client_reference_unique', 0, 'assignment_id,client_reference'
    UNION ALL SELECT 'pet_record_update_request_events', 'PRIMARY', 0, 'event_id'
    UNION ALL SELECT 'pet_allergies', 'pet_allergies_pet_allergen_unique', 0, 'pet_id,allergen'
    UNION ALL SELECT 'visit_charges', 'visit_charges_boarding_material_unique', 0, 'boarding_material_usage_id'
    UNION ALL SELECT 'visits', 'visits_booking_pet_unique', 0, 'booking_id,pet_id'
    UNION ALL SELECT 'visits', 'visits_queue_pet_unique', 0, 'queue_id,pet_id'
    UNION ALL SELECT 'visits', 'visits_diagnosis_unique', 0, 'diagnosis_id'
    UNION ALL SELECT 'visit_payments', 'visit_payments_method_reference_unique', 0, 'payment_method,reference_number'
) required_index
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
    ON actual_index.table_name = required_index.table_name
   AND actual_index.index_name = required_index.index_name
WHERE actual_index.index_name IS NULL
   OR actual_index.non_unique <> required_index.non_unique
   OR actual_index.column_list <> required_index.column_list;

SELECT COUNT(*) AS problem_count
FROM (
    SELECT 'boarding_material_usages' AS table_name, 'boarding_material_assignment_fk' AS constraint_name, 'assignment_id' AS column_name, 'boarding_assignments' AS referenced_table_name, 'assignment_id' AS referenced_column_name, 'CASCADE' AS delete_rule
    UNION ALL SELECT 'boarding_material_usages', 'boarding_material_booking_fk', 'booking_id', 'bookings', 'booking_id', 'CASCADE'
    UNION ALL SELECT 'boarding_material_usages', 'boarding_material_pet_fk', 'pet_id', 'pets_information', 'pet_id', 'SET NULL'
    UNION ALL SELECT 'boarding_material_usages', 'boarding_material_item_fk', 'item_id', 'inventory_items', 'item_id', 'SET NULL'
    UNION ALL SELECT 'boarding_material_usages', 'boarding_material_recorded_by_fk', 'recorded_by_user_id', 'users', 'user_id', 'SET NULL'
    UNION ALL SELECT 'boarding_material_usages', 'boarding_material_voided_by_fk', 'voided_by_user_id', 'users', 'user_id', 'SET NULL'
    UNION ALL SELECT 'pet_record_update_request_events', 'record_update_event_request_fk', 'request_id', 'pet_record_update_requests', 'request_id', 'CASCADE'
    UNION ALL SELECT 'pet_record_update_request_events', 'record_update_event_actor_fk', 'actor_user_id', 'users', 'user_id', 'SET NULL'
    UNION ALL SELECT 'visit_charges', 'visit_charges_boarding_material_fk', 'boarding_material_usage_id', 'boarding_material_usages', 'usage_id', 'RESTRICT'
) required_foreign_key
LEFT JOIN information_schema.key_column_usage actual_foreign_key
    ON actual_foreign_key.constraint_schema = DATABASE()
   AND actual_foreign_key.table_name = required_foreign_key.table_name
   AND actual_foreign_key.constraint_name = required_foreign_key.constraint_name
   AND actual_foreign_key.column_name = required_foreign_key.column_name
   AND actual_foreign_key.referenced_table_name = required_foreign_key.referenced_table_name
   AND actual_foreign_key.referenced_column_name = required_foreign_key.referenced_column_name
LEFT JOIN information_schema.referential_constraints actual_rule
    ON actual_rule.constraint_schema = DATABASE()
   AND actual_rule.table_name = required_foreign_key.table_name
   AND actual_rule.constraint_name = required_foreign_key.constraint_name
WHERE actual_foreign_key.constraint_name IS NULL
   OR actual_rule.constraint_name IS NULL
   OR actual_rule.delete_rule <> required_foreign_key.delete_rule;

SELECT
    CASE
        WHEN COUNT(*) = 1
         AND MAX(LOWER(column_type)) = 'enum(''cash'',''qrph'',''gcash'',''maya'',''bank_transfer'')'
         AND MAX(is_nullable) = 'NO'
         AND TRIM(BOTH '''' FROM COALESCE(MAX(column_default), '')) = 'gcash'
        THEN 0
        ELSE 1
    END AS problem_count,
    MAX(column_type) AS column_type
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = 'visit_payments'
  AND column_name = 'payment_method';

SELECT
    CASE
        WHEN COUNT(*) = 1
         AND MAX(LOWER(column_type)) = 'enum(''recorded'',''voided'')'
         AND MAX(is_nullable) = 'NO'
         AND TRIM(BOTH '''' FROM COALESCE(MAX(column_default), '')) = 'recorded'
        THEN 0
        ELSE 1
    END AS problem_count,
    MAX(column_type) AS column_type
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = 'boarding_material_usages'
  AND column_name = 'status';

-- =========================================================
-- 3. Allergy reconciliation and duplicate safety
-- =========================================================

SELECT COUNT(*) AS problem_count
FROM pets_information p
WHERE NULLIF(TRIM(p.pet_allergies), '') IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM pet_allergies pa
      WHERE pa.pet_id = p.pet_id
        AND LOWER(TRIM(pa.allergen)) = LOWER(TRIM(p.pet_allergies))
  );

SELECT COUNT(*) AS problem_count
FROM (
    SELECT pet_id, LOWER(TRIM(allergen)) AS normalized_allergen
    FROM pet_allergies
    GROUP BY pet_id, LOWER(TRIM(allergen))
    HAVING COUNT(*) > 1
) duplicate_allergies;

SELECT COUNT(*) AS problem_count
FROM pet_allergies
WHERE TRIM(allergen) = '';

-- Informational clinical-review queue; non-zero is expected immediately after
-- importing legacy values and must be reviewed by clinic staff.
SELECT
    pa.allergy_id,
    pa.pet_id,
    p.pet_name,
    pa.allergen,
    pa.severity,
    pa.reaction,
    pa.source,
    pa.verification_status
FROM pet_allergies pa
JOIN pets_information p ON p.pet_id = pa.pet_id
WHERE pa.verification_status = 'needs_review'
ORDER BY pa.pet_id, pa.allergy_id;

-- =========================================================
-- 4. Visit/billing reconciliation
-- =========================================================

SELECT COUNT(*) AS problem_count
FROM vet_diagnoses vd
LEFT JOIN visits v ON v.diagnosis_id = vd.diagnosis_id
WHERE vd.finalized_at IS NOT NULL
  AND v.visit_id IS NULL;

SELECT COUNT(*) AS problem_count
FROM online_consultations oc
JOIN bookings b ON b.booking_id = oc.booking_id
LEFT JOIN visits v
    ON v.booking_id = b.booking_id
   AND v.pet_id = b.pet_id
WHERE oc.status = 'completed'
  AND b.status = 'completed'
  AND b.pet_id IS NOT NULL
  AND v.visit_id IS NULL;

SELECT COUNT(*) AS problem_count
FROM vet_diagnoses vd
JOIN visits v ON v.diagnosis_id = vd.diagnosis_id
LEFT JOIN bookings b ON b.booking_id = vd.booking_id
LEFT JOIN queues q ON q.queue_id = vd.queue_id
WHERE vd.finalized_at IS NOT NULL
  AND (
      v.pet_id <> vd.pet_id
      OR COALESCE(b.user_id, q.user_id) IS NULL
      OR v.owner_user_id <> COALESCE(b.user_id, q.user_id)
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
  );

SELECT COUNT(*) AS problem_count
FROM online_consultations oc
JOIN bookings b ON b.booking_id = oc.booking_id
JOIN visits v
    ON v.booking_id = b.booking_id
   AND v.pet_id = b.pet_id
WHERE oc.status = 'completed'
  AND b.status = 'completed'
  AND (
      b.user_id <> oc.owner_user_id
      OR v.owner_user_id <> oc.owner_user_id
  );

SELECT COUNT(*) AS problem_count
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

SELECT COUNT(*) AS problem_count
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

SELECT COUNT(*) AS problem_count
FROM (
    SELECT booking_id, pet_id
    FROM visits
    WHERE booking_id IS NOT NULL
    GROUP BY booking_id, pet_id
    HAVING COUNT(*) > 1
) duplicate_booking_visits;

SELECT COUNT(*) AS problem_count
FROM (
    SELECT queue_id, pet_id
    FROM visits
    WHERE queue_id IS NOT NULL
    GROUP BY queue_id, pet_id
    HAVING COUNT(*) > 1
) duplicate_queue_visits;

SELECT COUNT(*) AS problem_count
FROM (
    SELECT diagnosis_id
    FROM visits
    WHERE diagnosis_id IS NOT NULL
    GROUP BY diagnosis_id
    HAVING COUNT(*) > 1
) duplicate_diagnosis_visits;

SELECT COUNT(*) AS problem_count
FROM (
    SELECT payment_method, reference_number
    FROM visit_payments
    WHERE reference_number IS NOT NULL
    GROUP BY payment_method, reference_number
    HAVING COUNT(*) > 1
) duplicate_payment_references;

SELECT COUNT(*) AS problem_count
FROM (
    SELECT
        v.visit_id,
        ROUND(COALESCE(charges.charge_total, 0), 2) AS charge_total,
        ROUND(COALESCE(payments.paid_total, 0), 2) AS paid_total
    FROM visits v
    LEFT JOIN (
        SELECT visit_id, SUM(subtotal) AS charge_total
        FROM visit_charges
        GROUP BY visit_id
    ) charges ON charges.visit_id = v.visit_id
    LEFT JOIN (
        SELECT visit_id, SUM(amount) AS paid_total
        FROM visit_payments
        WHERE payment_status = 'verified'
        GROUP BY visit_id
    ) payments ON payments.visit_id = v.visit_id
    WHERE COALESCE(payments.paid_total, 0) > COALESCE(charges.charge_total, 0) + 0.0049
) overpaid_visits;

SELECT COUNT(*) AS problem_count
FROM visits v
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
WHERE v.billing_status <> 'refunded'
  AND v.billing_status <> CASE
      WHEN COALESCE(charges.charge_total, 0) <= 0 THEN 'unbilled'
      WHEN COALESCE(payments.paid_total, 0) <= 0 THEN 'unpaid'
      WHEN payments.paid_total + 0.0049 < charges.charge_total THEN 'partial'
      ELSE 'paid'
  END;

-- =========================================================
-- 5. Record-request workflow integrity
-- =========================================================

SELECT COUNT(*) AS problem_count
FROM pet_record_update_requests
WHERE status IN ('approved', 'assigned', 'in_progress', 'completed')
  AND payment_status NOT IN ('verified', 'waived');

SELECT COUNT(*) AS problem_count
FROM pet_record_update_requests prur
WHERE prur.status = 'completed'
  AND EXISTS (
      SELECT 1
      FROM pet_record_update_request_events event
      WHERE event.request_id = prur.request_id
        AND event.to_status = 'completed'
  )
  AND (
      prur.baseline_snapshot_hash IS NULL
      OR prur.completed_snapshot_hash IS NULL
      OR prur.baseline_snapshot_hash = prur.completed_snapshot_hash
  );

-- Informational legacy-review queue. Requests completed before this deployment
-- have no reconstructable "before" snapshot and should not be reported as a
-- false post-deployment failure.
SELECT
    prur.request_id,
    prur.request_number,
    prur.pet_id,
    prur.completed_at
FROM pet_record_update_requests prur
WHERE prur.status = 'completed'
  AND NOT EXISTS (
      SELECT 1
      FROM pet_record_update_request_events event
      WHERE event.request_id = prur.request_id
        AND event.to_status = 'completed'
  )
  AND (
      prur.baseline_snapshot_hash IS NULL
      OR prur.completed_snapshot_hash IS NULL
      OR prur.baseline_snapshot_hash = prur.completed_snapshot_hash
  )
ORDER BY prur.completed_at, prur.request_id;

-- =========================================================
-- 6. Boarding relational integrity
-- =========================================================

SELECT COUNT(*) AS problem_count
FROM boarding_observations bo
LEFT JOIN boarding_assignments ba ON ba.assignment_id = bo.assignment_id
LEFT JOIN bookings b ON b.booking_id = bo.booking_id
WHERE bo.assignment_id IS NULL
   OR (
      ba.assignment_id IS NULL
      OR b.booking_id IS NULL
      OR ba.booking_id <> bo.booking_id
      OR NOT (bo.pet_id <=> b.pet_id)
      OR ba.room_type <> bo.room_type
      OR ba.room_number <> bo.room_number
  );

SELECT COUNT(*) AS problem_count
FROM boarding_tasks bt
LEFT JOIN boarding_assignments ba ON ba.assignment_id = bt.assignment_id
LEFT JOIN bookings b ON b.booking_id = bt.booking_id
WHERE bt.assignment_id IS NULL
   OR (
      ba.assignment_id IS NULL
      OR b.booking_id IS NULL
      OR ba.booking_id <> bt.booking_id
      OR NOT (bt.pet_id <=> b.pet_id)
      OR ba.room_type <> bt.room_type
      OR ba.room_number <> bt.room_number
  );

SELECT COUNT(*) AS problem_count
FROM boarding_documents bd
LEFT JOIN boarding_assignments ba ON ba.assignment_id = bd.assignment_id
LEFT JOIN bookings b ON b.booking_id = bd.booking_id
WHERE b.booking_id IS NULL
   OR NOT (bd.pet_id <=> b.pet_id)
   OR (
       bd.assignment_id IS NOT NULL
       AND (
           ba.assignment_id IS NULL
           OR ba.booking_id <> bd.booking_id
       )
   );

SELECT COUNT(*) AS problem_count
FROM boarding_material_usages bmu
LEFT JOIN boarding_assignments ba ON ba.assignment_id = bmu.assignment_id
LEFT JOIN bookings b ON b.booking_id = bmu.booking_id
WHERE ba.assignment_id IS NULL
   OR b.booking_id IS NULL
   OR ba.booking_id <> bmu.booking_id
   OR NOT (bmu.pet_id <=> b.pet_id);

SELECT COUNT(*) AS problem_count
FROM boarding_assignments ba
JOIN bookings b ON b.booking_id = ba.booking_id
WHERE ba.status = 'checked_out'
  AND (
      NOT EXISTS (
          SELECT 1
          FROM visits v
          WHERE v.booking_id = ba.booking_id
            AND v.visit_status <> 'cancelled'
      )
      OR COALESCE((
          SELECT SUM(vc.subtotal)
          FROM visits v
          JOIN visit_charges vc ON vc.visit_id = v.visit_id
          WHERE v.booking_id = ba.booking_id
            AND v.visit_status <> 'cancelled'
      ), 0) <= 0
      OR COALESCE((
          SELECT SUM(vc.subtotal)
          FROM visits v
          JOIN visit_charges vc ON vc.visit_id = v.visit_id
          WHERE v.booking_id = ba.booking_id
            AND v.visit_status <> 'cancelled'
      ), 0) + 0.009 < GREATEST(COALESCE(b.price, 0), 0) + COALESCE((
          SELECT SUM(ROUND(bmu.quantity * bmu.unit_price, 2))
          FROM boarding_material_usages bmu
          WHERE bmu.booking_id = ba.booking_id
            AND bmu.status = 'recorded'
      ), 0)
      OR EXISTS (
          SELECT 1
          FROM visits v
          WHERE v.booking_id = ba.booking_id
            AND v.visit_status <> 'cancelled'
            AND v.billing_status = 'refunded'
      )
      OR EXISTS (
          SELECT 1
          FROM visits v
          WHERE v.booking_id = ba.booking_id
            AND v.visit_status <> 'cancelled'
            AND COALESCE((
                SELECT SUM(vp.amount)
                FROM visit_payments vp
                WHERE vp.visit_id = v.visit_id
                  AND vp.payment_status = 'verified'
            ), 0) + 0.0001 < COALESCE((
                SELECT SUM(vc.subtotal)
                FROM visit_charges vc
                WHERE vc.visit_id = v.visit_id
            ), 0)
      )
  );

SELECT COUNT(*) AS problem_count
FROM boarding_material_usages bmu
JOIN boarding_assignments ba ON ba.assignment_id = bmu.assignment_id
LEFT JOIN visit_charges vc
    ON vc.boarding_material_usage_id = bmu.usage_id
LEFT JOIN visits v ON v.visit_id = vc.visit_id
WHERE bmu.status = 'recorded'
  AND ba.status = 'checked_out'
  AND (
      vc.charge_id IS NULL
      OR v.visit_id IS NULL
      OR v.booking_id <> bmu.booking_id
      OR NOT (vc.item_id <=> bmu.item_id)
      OR ABS(vc.quantity - bmu.quantity) > 0.0001
      OR ABS(vc.unit_price - bmu.unit_price) > 0.0001
      OR ABS(vc.subtotal - ROUND(bmu.quantity * bmu.unit_price, 2)) > 0.009
  );

SELECT COUNT(*) AS problem_count
FROM boarding_material_usages bmu
JOIN visit_charges vc ON vc.boarding_material_usage_id = bmu.usage_id
WHERE bmu.status = 'voided';

-- Informational: active recorded materials waiting to be included in POS.
SELECT
    bmu.usage_id,
    bmu.assignment_id,
    bmu.booking_id,
    bmu.item_name,
    bmu.quantity,
    bmu.unit_price
FROM boarding_material_usages bmu
JOIN boarding_assignments ba ON ba.assignment_id = bmu.assignment_id
LEFT JOIN visit_charges vc ON vc.boarding_material_usage_id = bmu.usage_id
WHERE bmu.status = 'recorded'
  AND ba.status IN ('reserved', 'occupied')
  AND vc.charge_id IS NULL
ORDER BY bmu.assignment_id, bmu.usage_id;

-- =========================================================
-- 7. Service configuration (informational)
-- =========================================================

SELECT
    sc.service_id,
    sc.service_code,
    sc.service_name,
    sc.service_type,
    sc.base_price
FROM service_catalog sc
WHERE sc.is_active = 1
  AND NOT EXISTS (
      SELECT 1
      FROM service_materials sm
      WHERE sm.service_id = sc.service_id
  )
ORDER BY sc.service_type, sc.service_name;
