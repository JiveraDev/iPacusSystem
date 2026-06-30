# Git-Based Backlog Assumptions

Updated: 2026-06-25

This document converts the current Git history and repository state into planning assumptions. It is a technical planning aid, not a formal audit.

## Evidence Scope

- Branch reviewed: `master`
- HEAD reviewed: `07fe6fb` from 2026-06-23
- Commit count on `HEAD`: 59
- Latest full schema export: `DDL/database_ddl_20260622_070744.sql`
- Schema upgrade script: `DDL/realign_20260618_to_20260622.sql`
- Dedicated consent migration: `DDL/20260619_create_consent_form_records.sql`
- Current unrelated working-tree change: `src/components/EmailVerification.jsx`

The documentation update does not modify the existing dashboard debug bypasses. At this snapshot, `Dashboard.jsx` has `DEBUG_BYPASS = false` and `dashboardRouter.jsx` has `DEBUG_BYPASS = true`; this mismatch is intentionally left unchanged under repository instructions.

Many older commits have vague messages. Assumptions below use changed-file evidence where commit messages are insufficient.

## Current Feature Status Assumptions

| Area | Status Assumption | Evidence | Main Follow-Up |
| --- | --- | --- | --- |
| Authentication, OTP, password reset | Implemented | `387ed2e`, auth PHP files, verification/reset screens | SMTP, expiry, retry, and deactivated-login QA |
| Pet registry and ownership | Implemented | `bd0d92f`, `bd699db`, pet/ownership endpoints and pages | Ownership, duplicate, image, and status regression tests |
| Booking and queue lifecycle | Implemented, operationally sensitive | Booking/queue endpoints, `booking_maintenance.php`, `lifecycle_recovery_report.php` | Full lifecycle and timezone QA |
| Veterinarian diagnosis and EMR | Implemented | `b79e672`, `bf998a9`, `b4a81c2` | Optional-vaccination, consent, billing, and record QA |
| Online consultation | Implemented, environment dependent | `3560ca3`, consultation components/PHP | Jitsi URL, start/join/end, and diagnosis QA |
| Boarding and pet hotel | Implemented | `bf998a9`, `54e6f1a`, `dfbf2a0`, `0db1102` | Room capacity, consent, assignment, monitoring, and checkout QA |
| POS and visit billing | Implemented, schema gap remains | `b79e672`, `e0d56ca`, `15502af` | Add `cash` enum support; test stock and payment accounting |
| Inventory and service materials | Implemented | `ac0d15d`, `e0d56ca`, `15502af` | Batch, stock movement, reversal, and insufficient-stock QA |
| Notifications | Implemented and refactored | `a214007`, `7459581`, `07fe6fb` | Responsive page, redirects, paging, push, and reminder QA |
| Reports and report center | Implemented | `15502af`, `07fe6fb` | Representative-data validation, CSV/print review, query drift checks |
| Pet owner accounts | Implemented | `15502af`; owner status columns included in June 22 DDL | Deactivation/reactivation, ownership unlink, and audit QA |
| Personnel employment profile editing | Implemented | `07fe6fb`, `PATCH /accounts/{id}/profile` | Authorization and validation QA |
| Consent ledger | Implemented in code, schema alignment blocked | `15502af`, June 19 migration, June 22 DDL, consent helpers | Reconcile competing table definitions |
| Pet media monitoring | Implemented | `15502af` | Source/date/pet filters, deduplication, and consent schema QA |
| TV status display | Implemented in two forms | `15502af`, `0db1102` | React and standalone deployment/privacy QA |
| Theme and auto-refresh | Implemented | `31e9176`, shared hooks/components | Long-session and multi-role regression tests |
| PDF/non-image preview | Not implemented completely | Image-focused `PhotoViewer` | Add PDF preview and document metadata/download handling |

## Recent Commit Evidence

### `15502af` - Operational Reporting and Lifecycle Oversight

Added or expanded:

- Super Admin reports dashboard and report center.
- Consent form records and media monitoring.
- Pet owner account controls.
- Lifecycle maintenance and recovery reporting.
- POS-to-inventory stock consumption and reversal.
- React TV status display.

Planning result: these features are committed and should no longer be described as uncommitted working-tree work. Their remaining status is QA, schema alignment, and deployment validation.

### `dfbf2a0` - June 20 Quality and Stability Pass

Added or adjusted:

- Locked Philippine `+639` phone handling.
- Logout and deactivation confirmations.
- Shared dialog/sheet close controls.
- Queue action labels.
- Boarding room creation compatibility.
- Notification/sidebar visual behavior.

Planning result: include these areas in regression testing across all account roles and responsive layouts.

### `0db1102` - Standalone TV Display

Added `Subdomain_folder` with its own PHP page, status endpoint, CSS, JavaScript, Apache defaults, and placeholder configuration.

Planning result: deployment now has two valid TV-display modes:

1. React route/subdomain using the main frontend and API.
2. Standalone subdomain folder with direct database access.

### `07fe6fb` - Notification Page, Reports, Profiles, and DDL Refresh

Added or adjusted:

- `/dashboard/notifications`
- `NotificationFeed.jsx`
- `NotificationsPage.jsx`
- `useNotificationCenter.js`
- `PATCH /accounts/{id}/profile`
- June 22 full DDL and June 18-to-22 realignment script
- Report charts, date formatting, consent fallback reporting, and profile screens

Planning result: responsive notifications and personnel profile editing require dedicated QA. The new DDL files do not fully eliminate schema drift.

## Gantt-Ready Backlog

| ID | Backlog Item | Type | Priority | Acceptance Criteria |
| --- | --- | --- | --- | --- |
| BL-001 | Reconcile `consent_form_records` schema | Database | Critical | One explicit migration produces the columns expected by helpers, reports, and media monitoring on both clean and upgraded databases |
| BL-002 | Add cash payment enum support | Database | High | `visit_payments.payment_method` accepts `cash`; POS cash posting succeeds |
| BL-003 | Validate clean database deployment | QA/Database | High | June 22 baseline plus required migrations supports auth, booking, queue, consent, reports, media, boarding, POS, and notifications |
| BL-004 | Validate June 18 database upgrade | QA/Database | High | Realignment is tested on a backup copy and produces the intended current schema without data loss |
| BL-005 | Run end-to-end booking/queue/diagnosis/POS lifecycle QA | QA | High | Status transitions, visits, charges, payments, stock movements, notifications, and owner todos remain consistent |
| BL-006 | Validate responsive notification center | QA | High | Bell and full page work above/below 720px; filters, paging, read state, redirects, and refresh pass |
| BL-007 | Validate Super Admin reports | QA | High | KPI, charts, filters, consent fallback data, CSV, and print output match representative database records |
| BL-008 | Validate personnel profile updates | QA/Security | Medium | Only Super Admin can update valid admin position/employment fields; invalid targets return errors |
| BL-009 | Validate standalone and React TV deployments | QA/Deployment | High | Both modes refresh correctly and expose no owner contact, complaint, or diagnosis text |
| BL-010 | Validate account deactivation and ownership controls | QA | High | Deactivation blocks login, reactivation restores it, and unlinking does not delete pets |
| BL-011 | Validate POS inventory accounting | QA | High | Linked materials consume stock, replacements reverse movement, and insufficient stock is blocked |
| BL-012 | Validate boarding operations | QA | High | Consent, room add/capacity, assignment, check-in/out, tasks, observations, and documents pass |
| BL-013 | Validate email and push environments | QA/Deployment | High | OTP, transactional email, push subscription, and reminder runner pass under HTTPS |
| BL-014 | Add PDF/document preview | Feature | Medium | PDFs preview where supported; other documents show safe metadata and download/open actions |
| BL-015 | Enforce backend role authorization | Security | High before production | Sensitive PHP routes verify authenticated identity and role and return 403 when unauthorized |
| BL-016 | Remove tracked secrets and rotate exposed values | Security | Critical | Example files contain placeholders, exposed credentials are rotated, and Git history risk is reviewed |
| BL-017 | Resolve dashboard/router bypass strategy | Security | Deferred/explicit approval | Frontend role behavior is consistent after a separately approved hardening change |
| BL-018 | Final release regression | QA | High | Lint, build, PHP syntax, database smoke tests, and manual critical-flow checklist pass |

## Database Risks

| Risk | Current Evidence | Required Action |
| --- | --- | --- |
| Consent schema mismatch | June 22 full DDL uses `signed_document_path`; June 19 migration/helper use richer audit columns | Create and test a reconciliation migration |
| Cash payment mismatch | June 22 DDL enum excludes `cash`; billing code supports cash | Alter enum before production cash use |
| Runtime schema mutation | Several PHP endpoints create or alter tables/columns | Prefer versioned migrations and least-privilege runtime DB credentials |
| Historical schema files | Multiple full exports and migrations coexist | Declare one baseline and ordered migration path |
| General Check-up legacy values | Older data may use `wellness` naming | Verify migration and reporting compatibility |

## Security and Cleanup Risks

| Risk | Required Action |
| --- | --- |
| Real secrets in tracked example/environment files or history | Replace with placeholders, rotate values, and review repository history |
| Frontend-only role checks | Add server-side authorization to sensitive PHP endpoints |
| Debug-bypass mismatch | Preserve current values for now; handle only in an explicitly authorized task |
| Uploaded/test media in Git history | Define retention policy and ignore generated/private uploads |
| Push and Jitsi production dependencies | Verify HTTPS, certificates, VAPID, service worker scope, and Jitsi routing |
| Large broad commits | Use broader regression testing because history does not isolate all behavior |

## Release Phase Summary

1. Foundation: React owner dashboard, auth screens, and service forms.
2. PHP backend and admin operations: users, pets, bookings, consent files, and queues.
3. Inventory, profiles, schedules, theme, and responsive UI.
4. Veterinarian workflow, EMR, POS, boarding, and service catalog.
5. OTP email, notifications, reminders, and browser push.
6. Workflow consolidation: payment methods, record updates, outage handling, and consent rules.
7. Operational oversight: reports, consent ledger, pet media, owner controls, lifecycle recovery, and inventory-linked billing.
8. Deployment/UI refinement: standalone TV display, responsive notification page, personnel profile editing, and June 22 schema refresh.
