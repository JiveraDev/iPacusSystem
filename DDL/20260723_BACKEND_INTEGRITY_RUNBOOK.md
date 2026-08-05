# Backend integrity repair runbook

This deployment repairs the empty-table workflow gaps without replacing the
current dashboard process. The SQL must be run manually by the database
operator. The application does not perform runtime schema changes.

## Files and required order

1. `20260723_01_backend_integrity_schema.sql`
2. `20260723_02_pet_allergy_backfill.sql`
3. `20260723_03a_historical_visit_preview.sql`
4. `20260723_03b_historical_visit_backfill.sql`
5. `20260723_04_post_deploy_verification.sql`

Do not skip directly to `03b`.

After this five-file integrity sequence, the later July 27 operator sequence is:

1. `20260727_01_special_service_billing_price.sql`
2. `20260727_02a_clinical_propagation_preview.sql`
3. `20260727_02b_clinical_propagation_cleanup.sql`

The clinical cleanup is separately documented in
`20260727_CLINICAL_PROPAGATION_CLEANUP_RUNBOOK.md`. Its preview and explicit
count approval are mandatory. The PHP response normalization remains effective
even when the database cleanup is postponed.

## Before starting

1. Schedule a short maintenance window so bookings, diagnoses, boarding
   checkout, and POS writes are paused.
2. Confirm that the selected database is the intended iPawcus database.
3. Take both:
   - a full database backup;
   - a structure-only export.
4. Preserve the backup until the post-deployment verification has been
   reviewed.
5. Confirm the database account can `SELECT`, `INSERT`, `UPDATE`, `CREATE`,
   `ALTER`, `CREATE ROUTINE`, `ALTER ROUTINE`, and `EXECUTE`, and can add
   indexes and foreign keys in the selected database.

The schema migration contains DDL statements. MariaDB/MySQL can implicitly
commit DDL, so restoring the backup is the reliable rollback for script `01`.

## How to run a file

Use phpMyAdmin/HeidiSQL by selecting the intended database and importing one
file at a time, or use a local MySQL-compatible client:

```bash
mysql -u YOUR_USER -p YOUR_DATABASE < DDL/20260723_01_backend_integrity_schema.sql
```

Do not place the password directly in the command.

Scripts `01` and `03b` use the MySQL client `DELIMITER` directive for guarded
stored procedures. Confirm this works in the exact phpMyAdmin/HeidiSQL version
on staging first; otherwise use the `mysql`/`mariadb` command-line client.

## Step 1: schema and integrity constraints

Run:

```text
DDL/20260723_01_backend_integrity_schema.sql
```

The first result identifies missing baseline tables. The script aborts if a
required baseline table is missing. In that case:

1. stop;
2. restore/apply the repository baseline schema;
3. rerun script `01`.

Review all duplicate-result sets at the end. They must be empty. If duplicates
are reported, the related unique index is deliberately skipped. Resolve those
records, rerun script `01`, and confirm script `01` finishes without its final
schema-contract error before continuing to `02` or `03b`. Do not merely remove
the duplicate and continue: rerunning `01` is what installs the skipped unique
index.

If script `01` reports an unexpected payment-method enum or a payment-reference
collision after trimming, stop and review those rows manually. The migration
will not discard custom enum values or merge two transaction references.

Script `01` adds:

- canonical allergy audit and verification attributes;
- structured boarding-observation attributes;
- server-side `boarding_material_usages`;
- record-update before/after snapshot hashes and transition events;
- cash payment enum support;
- visit identity, payment-reference, and actor constraints;
- a one-to-one boarding-material-to-visit-charge audit link;
- supporting indexes for the affected tables.

It also performs two disclosed data normalizations:

- invalid optional allergy/charge actor IDs are set to `NULL` before their
  foreign keys are installed;
- payment references are trimmed, with blank references converted to `NULL`,
  only after proving that trimming will not create a collision.

## Step 2: preserve legacy allergies

Run:

```text
DDL/20260723_02_pet_allergy_backfill.sql
```

This copies each legacy allergy string exactly once into `pet_allergies`. It
does not split text and does not clear `pets_information.pet_allergies`.

Expected result:

- `legacy_values_still_missing_from_normalized_table` is `0`.

Rows marked `needs_review` are not errors. Clinic staff must review their exact
allergen, reaction, and severity later. Do not delete an imported row until a
verified replacement exists.

## Step 3: preview historical visit reconstruction

Run the read-only file:

```text
DDL/20260723_03a_historical_visit_preview.sql
```

Do not continue if any row has:

- `BLOCKED_OWNER_REVIEW`;
- `BLOCKED_OWNER_PET_CONFLICT`;
- `BLOCKED_AMBIGUOUS_IDENTITY`;
- `BLOCKED_IDENTITY_CONFLICT`;
- `BLOCKED_UNREGISTERED_PATIENT`;
- a duplicate visit conflict.

At the time this repair was prepared, the live database was expected to show:

- one finalized veterinarian diagnosis requiring a visit with a captured
  booking price of `0.00`;
- three completed online consultations requiring visits and charges of
  `500.00`, `499.00`, and `500.00`;
- no payment creation.

If the preview differs, review the new records before running the write phase.

## Step 4: reconstruct historical visits

After approving the preview, run:

```text
DDL/20260723_03b_historical_visit_backfill.sql
```

This script:

- links a compatible legacy visit to its diagnosis where possible;
- creates missing diagnosis and completed-online-consultation visits;
- creates charges only from a positive price already captured on a booking;
- creates no payments;
- preserves refunded billing states;
- runs its write phase in a transaction;
- is safe to rerun.

If the SQL client reports an error during its write transaction, run
`ROLLBACK;`, investigate the error, and rerun the preview before trying again.

## Step 5: deploy the matching source

Deploy the PHP and frontend source from the same revision as these SQL files.
Do not deploy only the SQL or only the source.

The source remains compatible during the maintenance sequence, but the full
safety behavior is enabled only after script `01`.

No change is required to the Dashboard or DashboardRouter debug bypass.

## Step 6: verification

Run:

```text
DDL/20260723_04_post_deploy_verification.sql
```

All `problem_count` values should be `0`.

The following results are informational and may legitimately contain rows:

- affected-table row counts;
- allergy rows marked `needs_review`;
- legacy completed record requests without reconstructable before/after hashes;
- active boarding materials not yet posted to POS;
- active services without material presets.

Material presets cannot be guessed safely. Configure them through Service
Catalog Management after deployment, especially for vaccination, laboratory,
surgery, dental, and boarding services.

## Boarding price boundary

The backend rejects payment and checkout when the invoice is below the
booking's captured stay price plus every recorded boarding material. This
prevents the base stay line or a material line from being removed to
undercharge a completed stay.

Changing the desired checkout date does not recalculate `bookings.price`.
The current schema stores a total price, not the historical daily rate or a
pricing-rule version, so an automatic recalculation would risk inventing a
charge. For a planned extension, add the clinic-approved extension charge in
POS before taking payment. A future pricing-policy migration can automate this
after the clinic defines whether partial days, room changes, discounts, and
promotions affect the rate.

## Functional smoke tests

After the SQL checks pass:

1. Add and remove a pet allergy, then confirm it appears in pet, queue,
   booking, and medical-record responses.
2. Reschedule a pending/confirmed online consultation and confirm its
   `reschedules` history contains the authenticated actor. Confirm a completed
   booking is rejected.
3. Complete a new online diagnosis and confirm one visit and one service charge
   are created. Retry the completion and confirm no duplicate appears.
4. Attempt an overpayment and a reused payment reference; both must be
   rejected.
5. Create a record update request:
   - approval must fail before payment verification/waiver;
   - completion must fail before a medical change;
   - completion must succeed after the assigned veterinarian saves a change.
6. Add a boarding observation and confirm its actor is recorded.
7. Add a boarding material using the existing screen. Confirm it appears in
   `boarding_material_usages`, survives a browser refresh, and is retained as
   history after checkout.
8. Confirm a boarding checkout with a reliable unpaid visit balance is
   rejected.
9. Remove or reduce the base boarding-stay line below `bookings.price`; confirm
   payment and checkout are rejected.

## Rollback

If verification fails materially:

1. keep the application in maintenance mode;
2. save the error output and the failed verification results;
3. restore the pre-deployment backup;
4. redeploy the previous source revision;
5. rerun the old application health checks before reopening writes.

Do not attempt to reverse the schema by dropping columns or tables on the live
database unless a reviewed rollback migration has been prepared.
