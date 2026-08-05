# Clinical propagation cleanup runbook

These scripts clean only high-confidence legacy rows where one Diagnosis value
was copied into several otherwise independent clinical columns. They do not
change the schema and are never run by the application.

The PHP response sanitizer remains authoritative before and after this cleanup.
The application therefore stops presenting propagated duplicates even if the
database operator postpones these scripts.

## Required order

Run these only after the 20260723 integrity sequence:

1. `20260727_01_special_service_billing_price.sql`
2. `20260727_02a_clinical_propagation_preview.sql`
3. `20260727_02b_clinical_propagation_cleanup.sql`

Never skip `02a`.

## Matching rule

Both scripts use the same conservative rule:

- compare case-sensitive text after trimming leading and trailing whitespace;
- require the repeated value to equal the nonblank Diagnosis;
- treat the row as high-confidence propagation when that exact value occurs in
  four or more clinical columns, or in three columns when Diagnosis is 80
  characters or shorter;
- retain Diagnosis exactly;
- set only matching duplicate fields to `NULL`;
- leave distinct values, two-field repetitions, and long three-field
  repetitions untouched.

For clinic rows, the reviewed columns are Chief Complaint, Major Symptoms,
Symptoms, Physical Exam, Diagnosis, Treatment, Lab Results, and Notes. For
online diagnoses, they are Diagnosis, Recommendations, Treatment, Medications,
and Notes.

## Before preview

1. Select the intended iPawcus database.
2. Take a full database backup.
3. Confirm the 20260723 integrity sequence and
   `20260727_01_special_service_billing_price.sql` have completed.
4. Deploy or prepare the matching PHP/frontend revision. The response fix works
   independently of database cleanup.
5. Confirm the operator account can `SELECT`, `UPDATE`, `CREATE ROUTINE`,
   `ALTER ROUTINE`, `EXECUTE`, and manage transactions.

## Preview

Run:

```text
DDL/20260727_02a_clinical_propagation_preview.sql
```

The schema-status rows must both be `READY`.

Review every detailed candidate. Diagnosis is shown as `retained_diagnosis`;
`fields_to_null` lists the only columns the apply script will clear. If any
listed repetition is a genuine clinician entry, stop and do not run the stock
apply script. Prepare a separately reviewed exclusion by diagnosis ID instead.

Record these four summary values exactly, including zeros:

- `vet_diagnoses.candidate_rows`
- `vet_diagnoses.cells_to_null`
- `online_consultation_diagnoses.candidate_rows`
- `online_consultation_diagnoses.cells_to_null`

`review_only_rows` are deliberately excluded and remain unchanged.

## Apply

Schedule a maintenance window that pauses clinic and online diagnosis writes.
Open `20260727_02b_clinical_propagation_cleanup.sql` and replace its four `-1`
approval values with the four reviewed preview counts.

Run the file once. The procedure:

- rechecks the schema;
- recalculates all four counts inside a transaction;
- aborts and rolls back if live data no longer matches the approved preview;
- updates only exact matching duplicate cells;
- confirms the number of changed rows;
- rolls back if any high-confidence candidate remains;
- commits only after all safety checks pass.

Expected final results:

- `cleanup_status` is `PASS`;
- `vet_candidates_remaining` is `0`;
- `online_candidates_remaining` is `0`;
- both final `remaining_candidate_rows` values are `0`.

The script is safe to rerun only after running `02a` again and approving the new
zero counts.

## Rollback and audit

Any error raised inside the procedure rolls back its transaction automatically.
If a problem is discovered after a successful commit, keep the application in
maintenance mode and restore the pre-cleanup backup; do not guess the cleared
text.

The cleanup preserves Diagnosis and all distinct clinical values. Updated rows
will receive their normal `updated_at` timestamp change. Keep the preview
output, apply output, and backup reference with the deployment record.
