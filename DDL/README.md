# Database DDL Export

Run this from the project root:

```bash
php DDL/export_database_ddl.php
```

It reads the database connection from `.env` and writes a timestamped file like:

```text
DDL/database_ddl_20260530_213000.sql
```

Optional commands:

```bash
php DDL/export_database_ddl.php --output DDL/current_schema.sql
php DDL/export_database_ddl.php --include-views
```

## Manual Migrations

- `20261005_02_shared_veterinarian_booking_calendar.sql` adds per-clinic booking acceptance preferences. Run after the multi-branch migration, assign clinics in Account Management, and let each vet enable Accept bookings per site. On-site availability follows clinic operating hours automatically; online calls retain the separate profile day/time picker and existing vet_schedules table. No extra working hours or time off setup. Grooming and boarding remain independent. See `docs/shared-veterinarian-booking.md` for rollout and verification.
- `20261005_01_pet_prescription_schedules.sql` adds versioned pet prescriptions, independent medication schedules, dose occurrences, and an audit event ledger shared by clinic and online consultations.
- `20261002_03_pet_certificates.sql` adds veterinarian-issued medical certificates, expiration, signature references, owner-view tracking, and links to medical-record update requests. Registration certificates remain generated from the canonical pet profile and require no stored row.
- `20261002_02_medical_record_item_revisions.sql` adds the editable clinical revision snapshot and revision-file metadata to organized medical-record items while preserving the original source snapshot for audit history.
- `20260930_01_inventory_branch_catalog.sql` adds branch-local product visibility and removal state. Run it after `20260803_01_multi_branch_operations.sql` before deploying the matching inventory backend; products then appear only at clinics where they have a real location or batch, and removing one clinic's product no longer hides it from other clinics.
- `20260923_01_clinical_confinement.sql` adds Clinical Confinement as a medically referred Boarding admission. It links Diagnosis or Grooming Vet Review to one Boarding booking and the originating visit invoice, while keeping owner approval in the existing boarding-consent and room-assignment flow.
- `20260819_01_invoice_pdf_documents.sql` adds immutable Point-Of-Sale invoice PDF records linked to the visit, verified payment, and pet. Run it after the visit billing/payment schema is installed and before enabling POS invoice posting in this build.
- `20260809_02_archiving_payment_storage.sql` adds recoverable account/pet archiving, configurable encrypted payment details, dynamic payment ledger keys, and branch/location/storage-area inventory identity. Run it after `20260808_01_payment_integrity.sql`, then set `PAYMENT_DETAILS_KEY` before saving payment settings.
- `20260809_01_sunday_closure.sql` applies Monday-Saturday 8:00 AM-6:00 PM hours and closes all configured branches on Sunday.
- `20260808_01_payment_integrity.sql` adds the booking-payment review/refund ledgers, visit-payment refunds, inventory selling prices, and boarding overstay billing support.
- `20260803_01_multi_branch_operations.sql` is the required multi-branch migration. Run it after `20260729_deployment_required_new.sql` and before deploying the matching multi-branch frontend/PHP build. It seeds the five VFC locations, 8:00 AM-6:00 PM operating hours, one small/medium/large hotel room and confinement unit per location, branch services, staff assignments, veterinarian visits, branch-local stock, and branch ownership for bookings, queues, visits, boarding, record requests, reports, and notifications.
- `20260729_deployment_required_new.sql` is the single import file for the required deployed-database changes added after the July 10 bundle. It combines the July 23 integrity schema, legacy-allergy preservation, and July 27 Special Services billing-price migration. It intentionally excludes historical-visit and clinical-propagation data repairs because their preview/approval steps must be run separately against production.
- `20260727_01_special_service_billing_price.sql` adds the optional exact Special Services price used for booking snapshots and POS defaults. Run it after the 20260723 integrity sequence; ranged or quote-based services intentionally remain unset.
- `20260727_02a_clinical_propagation_preview.sql` is the required read-only review before cleaning high-confidence legacy clinical field propagation.
- `20260727_02b_clinical_propagation_cleanup.sql` applies the approved clinic/online cleanup in a guarded transaction; its four approval counts must come from `02a`.
- `20260727_CLINICAL_PROPAGATION_CLEANUP_RUNBOOK.md` contains the operator-only preview, approval, apply, verification, and rollback instructions. Run `20260727_01`, then `02a`, then `02b`.
- `20260723_EMPTY_TABLE_BACKEND_AUDIT.md` records the table-by-table findings, fixes, and remaining operator decisions.
- `20260723_BACKEND_INTEGRITY_RUNBOOK.md` is the required operator guide for the empty-table/backend-integrity repair.
- `20260723_01_backend_integrity_schema.sql` adds the required safety schema and integrity constraints.
- `20260723_02_pet_allergy_backfill.sql` preserves legacy allergy values in the canonical table.
- `20260723_03a_historical_visit_preview.sql` previews historical visit reconstruction without writing data.
- `20260723_03b_historical_visit_backfill.sql` reconstructs approved historical visits and evidence-based charges without creating payments.
- `20260723_04_post_deploy_verification.sql` performs read-only post-deployment integrity checks.
- `20260710_deployment_required_all.sql` bundles all required July 10 deployed-server SQL in the correct order.
- `20260709_coparent_requests.sql` adds the co-parent approval request table and ownership metadata columns.
- `20260710_mail_queue.sql` adds queued email delivery for notifications and owner-facing email jobs.
- `20260710_performance_indexes.sql` adds indexes for high-traffic dashboard, booking, queue, POS, report, inventory, online consultation, and record-request reads.
