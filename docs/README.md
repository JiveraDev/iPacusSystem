# iPawcus Documentation Index

Updated: 2026-10-14

## Current audit and testing

- [Configured database verification and Pet Hotel clinic selection](20261014_database_verification.md): the normal database connects, but its metadata import is incomplete; the landing room panel now supports per-clinic selection.

- [Isolated database sandbox](database_sandbox.md): latest 88-table schema, synthetic role logins, browser run/stop commands and database-backed checks, verified October 14.

- [October 13 project audit](20261013_project_audit.md): confirmed fixes, verification evidence, four-role interactions and remaining runtime checks.
- [Google integration testing](google_integration_testing.md): configuration, identity linking, onboarding and manual scenarios.
- [Installed skills](installed_skills.md): repository and session-provided skills.
- [Capability reference](CURRENT_SYSTEM_CAPABILITIES.md): detailed source-backed reference with an October 13 addendum.
- [Role instructions](../USER_INSTRUCTIONS_FOR_DIFFERENT_ROLES.md): pet-owner and personnel guide.

Current review: `master`, HEAD `a7e9add1`, with uncommitted work. `npm run check` writes logs to ignored `tmp/project-audit/`. Local database readiness failed. Older dated documents retain their original review dates as historical evidence.

This folder contains the current planning, architecture, backlog, deployment, and release notes for the iPawcus React/PHP project.

| Document | Purpose |
| --- | --- |
| `system_inventory_gantt_details.md` | System inventory, route and endpoint map, workflows, schema notes, Gantt-ready work packages, and manual QA checklist. |
| `git_backlog_assumptions.md` | Git-history-based backlog assumptions, current repository evidence, release phases, risks, and cleanup priorities. |
| `tv_status_display_deployment.md` | Deployment notes for the React and standalone TV status displays. |
| `deployment_upload_materials_format.md` | Practical deployment upload package format, domain folder layout, env placement, PWA flag behavior, writable upload folders, and final checklist. |
| `20260710_full_project_update.md` | Full July 10 update covering co-parent approvals, reports, booking, consent, QRPH, vet flows, reminders, verification, and required DB command. |
| `20260710_current_update_readme.md` | Current update summary, co-parent workflow notes, required database migration, and manual QA steps. |
| `20260710_full_system_audit.md` | Full system audit using the Elementor audit-guide structure, with security, performance, UX, SEO, deployment, and operations findings. |
| `deployed_server_sql_runbook.md` | Full deployed-server SQL list, combined migration file, verification queries, and optional legacy migration notes. |
| `mail_queueing.md` | Mail queueing setup, worker commands, environment toggles, and delivery status behavior. |
| `performance_optimization.md` | Submit/dashboard lag optimization notes, performance index migration, and worker guidance. |
| `20260705_consolidated_gantt_update.md` | Combined documentation summary and updated Gantt-ready release-hardening schedule for updating the current project Gantt. |
| `20260705_combined_project_update.md` | July 5 combined project update covering the TODO calendar redesign, shared Mantine date picker, report filters, account removal, medical-record notifications, database notes, and verification. |
| `reminder_testing.md` | Dry-run and send-test commands for schedule reminder notifications, plus the settings and timing functions to edit. |
| `20260630_project_update.md` | June 30 whole-project update covering API access, protected media, consent assignments, booking/queue/POS, dashboards, notifications, reports, and suggested commit message. |
| `20260625_repository_update.md` | June 22-25 repository changes, schema alignment notes, notification-page work, and verification scope. |
| `20260620_quality_fix_notes.md` | Historical notes for the June 20 phone, confirmation, modal, notification, and boarding fixes. |

## Historical June Repository Snapshot

- Branch: `master`
- Reviewed HEAD: `07fe6fb` from 2026-06-23
- Commit count at review: 59
- Frontend: React 19, Vite 8, Tailwind CSS
- Backend: PHP 8.x with routing through `php/index.php`
- Current full schema export: `DDL/database_ddl_20260622_070744.sql`
- Upgrade script from the June 18 export: `DDL/realign_20260618_to_20260622.sql`
- Standalone TV display: `Subdomain_folder`

The June 25 repository snapshot remains as a historical baseline; the June 30 and July 5 project notes record the broader working-tree updates.

## Historical July Coverage

- July 5 consolidated Gantt update: combined documentation summary, current status mapping, new Gantt items, suggested release-hardening dates, and Mermaid Gantt draft.
- July 5 combined project update: calendar-app style TODO scheduling, slot/range task creation, shared Mantine date picker behavior, report date filters, account directory row activation, master-key account removal, and medical-record owner notifications.
- Responsive notification center with `/dashboard/notifications`, shared notification feed state, filtering, pagination, mark-read actions, and quiet refresh.
- Super Admin personnel employment profile editing through `PATCH /accounts/{id}/profile`.
- Updated report charts, consent reporting fallbacks, date handling, and dashboard presentation.
- June 30 whole-project update: API access tokens, role policies, protected media delivery, consent-template assignment, booking/queue references, POS payment proof, live dashboard summaries, notifications/TODOs, reporting comparisons, and dashboard navigation grouping.
- React and standalone TV status displays, including subdomain deployment.
- Super Admin reports, pet media monitoring, pet owner account controls, lifecycle recovery, and POS/inventory linkage.
- June 20 UX/API fixes for Philippine mobile inputs, confirmations, modal close controls, and boarding room creation.

## Verification Snapshot

Completed on 2026-07-05:

- `npm run lint`
- `npm run build`
- `php -l php/get_accounts.php`
- `php -l php/index.php`
- `php -l php/pet_medical_records.php`
- `php -l php/delete_account.php`

Completed on 2026-06-25:

- `npm run lint`
- `npm run build`
- `php -l php/update_account_profile.php`
- `php -l php/status_display.php`
- `php -l Subdomain_folder/index.php`
- `php -l Subdomain_folder/status.php`
- `git diff --check`

## Deployment Priorities

1. Resolve the `consent_form_records` schema mismatch before production deployment. The June 22 full export uses a reduced table definition, while `DDL/20260619_create_consent_form_records.sql` and current helper code use additional audit, source, visit, and file-path columns.
2. If upgrading a database based on `DDL/database_ddl_20260618_034832.sql`, review and run `DDL/realign_20260618_to_20260622.sql` in a backup/staging database first.
3. Add `cash` to `visit_payments.payment_method` before enabling cash POS posting. The June 22 export still limits the enum to `qrph`, `gcash`, `maya`, and `bank_transfer`.
4. Keep the existing debug-bypass values in `src/components/Dashboard.jsx` and `src/components/dashboardRouter.jsx` unchanged unless a separate security task explicitly authorizes that work.
5. Remove or rotate any real credentials that have been placed in tracked environment example files or Git history. Example files must contain placeholders only.

## Set Aside for Later

### Role and API Security

- Enforce authorization in PHP APIs; frontend route checks are not a security boundary.
- Protect reports, account management, pet records, POS, inventory, diagnosis, bookings, and queue operations with server-side role checks.
- Reconcile the intentionally preserved dashboard and dashboard-router debug-bypass configuration in a dedicated hardening task.

### Workflow and Financial QA

- Review booking, queue, veterinarian assignment, diagnosis, visit, invoice, payment, and owner-todo transitions end to end.
- Ensure diagnosis completion and POS bill creation are transactional where required.
- Verify pending payments remain visible until settled.
- Validate stock consumption, reversal, batch selection, and insufficient-stock behavior.

### Remaining Product Work

- Add PDF and non-image document preview behavior.
- Complete PDF/Excel report export if required; current report output supports browser print and CSV.
- Improve inventory/product search and supplier creation.
- Finish production push-notification and Jitsi environment validation.
