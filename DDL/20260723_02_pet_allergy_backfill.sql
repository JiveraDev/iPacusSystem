-- iPawcus legacy allergy safety backfill
-- Run after 20260723_01_backend_integrity_schema.sql.
--
-- This intentionally copies each legacy pets_information.pet_allergies value as
-- one exact normalized record. It does not split comma-separated text because
-- doing so automatically could change clinical meaning.
--
-- This script does not clear or overwrite the legacy column. The backend keeps
-- it synchronized during the compatibility period.

-- =========================================================
-- 1. Preview records that will be copied
-- =========================================================

SELECT
    p.pet_id,
    p.pet_name,
    TRIM(p.pet_allergies) AS legacy_allergy_text
FROM pets_information p
WHERE NULLIF(TRIM(p.pet_allergies), '') IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM pet_allergies pa
      WHERE pa.pet_id = p.pet_id
        AND LOWER(TRIM(pa.allergen)) = LOWER(TRIM(p.pet_allergies))
  )
ORDER BY p.pet_id;

-- =========================================================
-- 2. Preserve legacy clinical information in canonical rows
-- =========================================================

INSERT INTO pet_allergies (
    pet_id,
    allergen,
    severity,
    reaction,
    source,
    verification_status,
    created_by_user_id,
    updated_by_user_id,
    verified_by_user_id,
    verified_at,
    created_at,
    updated_at
)
SELECT
    p.pet_id,
    TRIM(p.pet_allergies),
    'Known',
    NULL,
    'legacy_import',
    'needs_review',
    NULL,
    NULL,
    NULL,
    NULL,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM pets_information p
WHERE NULLIF(TRIM(p.pet_allergies), '') IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM pet_allergies pa
      WHERE pa.pet_id = p.pet_id
        AND LOWER(TRIM(pa.allergen)) = LOWER(TRIM(p.pet_allergies))
  );

-- =========================================================
-- 3. Verification and manual-review queue
-- =========================================================

SELECT
    COUNT(*) AS legacy_values_still_missing_from_normalized_table
FROM pets_information p
WHERE NULLIF(TRIM(p.pet_allergies), '') IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM pet_allergies pa
      WHERE pa.pet_id = p.pet_id
        AND LOWER(TRIM(pa.allergen)) = LOWER(TRIM(p.pet_allergies))
  );

-- These rows require a clinic user to verify the exact allergen, reaction, and
-- severity. Do not delete the imported row until a verified replacement exists.
SELECT
    pa.allergy_id,
    pa.pet_id,
    p.pet_name,
    pa.allergen,
    pa.severity,
    pa.reaction,
    pa.verification_status,
    pa.created_at
FROM pet_allergies pa
JOIN pets_information p ON p.pet_id = pa.pet_id
WHERE pa.source = 'legacy_import'
  AND pa.verification_status = 'needs_review'
ORDER BY pa.pet_id, pa.allergy_id;
