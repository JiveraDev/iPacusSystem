# Git-Based Backlog Assumptions

Prepared: 2026-06-19

This document turns the Git history and current working-tree changes into backlog assumptions. It is meant for planning and Gantt chart work, not as a legal audit of the code.

## Evidence Scope

- Branch reviewed: `master`
- HEAD reviewed: `b4a81c2` (`feat: consolidate workflows, consent handling, and planning docs`, 2026-06-14)
- Commit count on `HEAD`: 52
- Working tree after this update includes TV status display, Super Admin reports, report export/print center, pet owner account controls, pet media monitoring, consent form records, lifecycle maintenance/recovery, and POS/inventory linkage changes.
- Latest full DB export in workspace: `DDL/database_ddl_20260618_034832.sql`
- New explicit migration: `DDL/20260619_create_consent_form_records.sql`
- Older canonical DB file supplied by user: `DDL/database_ddl_20260613_054826.sql`

Important: many commits have generic messages such as `committng`, `additional content`, and `adddded fixing`. For those commits, backlog themes are inferred from changed files and are marked as assumptions.

## High-Level Backlog Assumptions

| Backlog Area | Status Assumption | Git Evidence | Planning Notes |
| --- | --- | --- | --- |
| Basic React app, login, registration, owner dashboard | Mostly implemented | `314df67` initial app/auth/pages | Needs regression testing after later routing/auth changes |
| Pet registration and ownership linking | Mostly implemented | `2f6a97e`, `bd0d92f`, `8237a1d`, `bd699db` | Includes pet registry, owner linking, profile images, pet search/detail |
| PHP API migration from Node/server prototype | Implemented but should be stabilized | `bd699db` removes `server/*` and adds `php/*` endpoints | Keep PHP router/API as current backend baseline |
| Booking management | Implemented, needs QA | `d4e1518`, `452a044`, `cd3ca74`, later booking fixes | Covers booking create/list/status, admin review, payment proof, concern uploads |
| Consent file management | Implemented, needs workflow QA | `452a044`, `b4a81c2` | Consent template CRUD exists; diagnosis/boarding consent usage was expanded in the latest commit |
| Queue management | Implemented, expanded multiple times | `bd699db`, `d976396`, `cd3ca74`, `b79e672`, `a214007` | Queue create/status/receive/return/reenter; self-service queue exists |
| Home service booking and signature | Implemented, needs payment/consent QA | `cd3ca74`, `3560ca3`, later service/payment fixes | Uses `SignatureCapture`, upload/payment proof, home-service schema columns |
| Inventory management | Implemented, needs data QA | `ac0d15d`, `f2387e6`, `d6cf9ee`, `85edf6e` | Item list/add/stock-in/low-stock/near-expiry/disposal |
| Responsive UI improvements | Implemented broadly | `c9ee798` touches most screens | Should be regression tested on mobile/tablet/desktop |
| Profile, password, schedules | Implemented, needs role QA | `36bbfe7`, `ea21dcd`, `5371163`, `31e9176` | Admin/vet/owner profiles, password card, vet schedules, deactivated account blocking |
| Online consultations / Jitsi | Implemented, needs environment setup | `3560ca3`, online consult PHP/components; previous `docs/jitsi-self-host.md` is deleted in the working tree | Needs Jitsi URL/env and full start/join/end testing; confirm where deployment notes should live |
| Veterinarian workflow and EMR | Implemented, still active | `b79e672`, `bf998a9`, `b4a81c2` | Diagnosis, approved queue, my list, EMR, histories, optional vaccination, extra consents |
| POS and visit billing | Implemented, needs full financial QA | `b79e672`, `e0d56ca`, `a214007` | Visits, charges, payments, invoice/payment notifications |
| Boarding / pet hotel management | Implemented, still active | `bf998a9`, `54e6f1a`, `b4a81c2` | Room management, assignments, observations, tasks, documents, liability consent |
| Service catalog and materials | Implemented | `e0d56ca`, `ce91d87` | Links services to inventory/materials and POS |
| Email OTP and password reset | Implemented | `387ed2e` | Needs SMTP/env verification |
| Notifications and reminders | Implemented | `a214007` | Booking/queue/diagnosis/visit/todo reminders; preferences and bell |
| Browser push notifications | Implemented, needs production config | `7459581` | Requires VAPID keys, HTTPS, service worker testing |
| Payment methods management | Committed, needs QA | `b4a81c2` adds `php/payment_methods.php`, `PaymentMethodsManagement.jsx`, `paymentMethodService.js` | Needs OTP, QR upload, active/inactive method QA |
| Record update request workflow | Committed, needs QA | `b4a81c2` adds `php/record_update_requests.php`, `RecordUpdateRequestsManagement.jsx`, `VetRecordUpdateRequests.jsx` | Needs lifecycle QA and DB alignment |
| Server health / downtime handling | Committed, needs QA | `b4a81c2` adds `ServerDownPage.jsx` and updates `apiClient.js`, `App.jsx` | Needs API/database failure testing |
| Diagnosis extra consent and optional vaccination | Committed, needs QA | `b4a81c2` updates `VetDiagnosis.jsx`, `vet_diagnoses.php`, medical record files | Must verify diagnosis can save without vaccination and with extra consent |
| Boarding liability consent before payment/submit | Committed, needs QA | `b4a81c2` updates `PetHotel.jsx`, `add_booking.php`, `get_bookings.php` | Full DDL exports still lack `bookings.consent_forms` and `bookings.consent_status`; backend can auto-add if DB user has permission |
| TV status display/subdomain | Implemented, needs deployment QA | Working tree adds `TVStatusDisplay.jsx`, `statusDisplayService.js`, and `php/status_display.php` | Same project route plus `status.ipawcus.com` subdomain support |
| Super Admin report dashboard and report center | Implemented, needs report QA | Working tree adds report components/services/PHP and Chart.js dependencies | Verify KPI/dashboard queries, report filters, print layout, CSV export, and missing-data notes |
| Consent form record ledger | Implemented, needs migration QA | Working tree adds `DDL/20260619_create_consent_form_records.sql`, `consent_record_helpers.php`, and `/consent-form-records` | Apply migration before relying on consent reports/media monitoring |
| Pet media monitoring | Implemented, needs data QA | Working tree adds `PetMediaMonitoring.jsx`, `petMediaMonitoringService.js`, and `pet_media_monitoring.php` | Verify consent, booking, queue, diagnosis, and boarding images are deduplicated and filterable |
| Pet owner account controls | Implemented, needs schema decision | Working tree adds `PetOwnerAccountsManagement.jsx`, owner-account API routes, and login account-status check | Add `users.account_status` columns before deactivation is considered production-ready |
| Lifecycle maintenance and recovery | Implemented, needs flow QA | Working tree expands `booking_maintenance.php`, adds `lifecycle_recovery_report.php`, and calls maintenance from status display | Verify queue expiry, missed-booking reschedule/cancel behavior, and billing recovery report |
| POS/inventory stock consumption | Implemented, needs financial/inventory QA | Working tree expands `visit_billing.php`, `POSmanagement.jsx`, service catalog/inventory files | Verify linked materials/items consume stock, reverse on charge replacement, and handle insufficient stock |
| PDF/document preview beyond images | Future backlog | User request, current `PhotoViewer` image-focused | Add file preview/download behavior per upload type |

## Latest Commit Backlog Evidence

These items were uncommitted during the previous review and are now included in `b4a81c2`.

| Item | Evidence | Backlog Assumption | Needed Follow-Up |
| --- | --- | --- | --- |
| Consolidated current DDL | `b4a81c2` adds `DDL/database_ddl_20260613_054202.sql` and `DDL/database_ddl_20260613_054826.sql`, and removes older migration snapshots | DB source is being consolidated around full DDL exports | Decide whether to keep older migrations for history or replace them with one canonical DDL plus new migrations |
| Boarding consent storage | `b4a81c2` modifies `php/add_booking.php`, `php/get_bookings.php`, `src/components/PetOwnerDashboard/PetHotel.jsx` | Boarding consent is added to booking submit and admin fetch flow | Add explicit DB migration for `bookings.consent_forms` and `bookings.consent_status` or export fresh DDL |
| Diagnosis extra consent | `b4a81c2` modifies `src/components/VetrinarianComponents/VetDiagnosis.jsx`, `php/vet_diagnoses.php` | Vet can add extra consent forms/signatures during diagnosis | QA: save diagnosis with no vaccine; save diagnosis with extra consent; confirm attachments render in history/EMR |
| Medical records print/email | `b4a81c2` modifies `src/components/PetOwnerDashboard/MedicalRecords.jsx`, `php/pet_medical_records.php`, `src/components/VetrinarianComponents/VetPetsEMR.jsx` | Medical records were expanded and owner actions redesigned | QA: print, email copy, owner visibility, image preview, grouped records |
| Payment method settings | `b4a81c2` adds `php/payment_methods.php`, `PaymentMethodsManagement.jsx`, `paymentMethodService.js`, `usePaymentMethods.js` | Super admin payment method management is implemented enough for QA | QA OTP, QR image upload, active/inactive methods, payment forms consuming methods |
| Record update requests | `b4a81c2` adds `php/record_update_requests.php`, admin/vet components and service | Record correction lifecycle is implemented enough for QA | QA owner request, admin review, vet assignment, completion, notification if required |
| API health / outage handling | `b4a81c2` adds `ServerDownPage.jsx` and modifies `apiClient.js`, `App.jsx` | App now detects API/database failure | QA with stopped PHP server and stopped DB |
| Notification polish | `b4a81c2` modifies notification helpers/services/components | Push/email/in-app notification behavior is still being refined | QA unread/read all, push permission, reminder runner, category preferences |
| Upload and preview polishing | `b4a81c2` modifies `upload.php`, `photo-viewer.jsx`, image helpers | Upload handling and preview behavior are still active | Add PDF/document preview backlog; validate upload type restrictions |
| Route/role expansion | `b4a81c2` modifies `Dashboard.jsx`, `dashboardRouter.jsx` | New pages are added to dashboard navigation | Keep debug bypass untouched until separate security task |

## Current Working Tree Backlog Evidence

These items are pending in the working tree as of 2026-06-19 and should be covered by the next commit.

| Item | Evidence | Backlog Assumption | Needed Follow-Up |
| --- | --- | --- | --- |
| Super Admin report dashboard | `package.json`, `reportService.js`, `SuperAdminReportsDashboard.jsx`, `ReportChartCard.jsx`, `ReportKpiCard.jsx`, `ReportTable.jsx`, `reports_dashboard.php`, `reports_common.php` | A chart/KPI reports dashboard is implemented for Super Admin landing/dashboard use | QA each date range and confirm missing-data notes do not hide query failures |
| Report export and print center | `SuperAdminReportCenter.jsx`, `ReportPreview.jsx`, `reports_generate.php`, `REPORT_TYPES` in `reportService.js` | Report preview, browser print, and CSV export are implemented; PDF/Excel remain future work | QA all report types, filters, CSV values, and print CSS |
| Consent form record ledger | `DDL/20260619_create_consent_form_records.sql`, `consent_record_helpers.php`, `consent_form_records.php`, `consentRecordService.js` | Signed/released consent events now have a persistent ledger when migration exists | Run migration; QA booking, queue, diagnosis/manual consent capture and report visibility |
| Pet media monitoring | `PetMediaMonitoring.jsx`, `petMediaMonitoringService.js`, `pet_media_monitoring.php` | Super Admin can review images by pet/source/date across consent, booking, queue, diagnosis, and boarding data | QA dedupe, image URL resolution, source counts, and date filtering |
| Pet owner account controls | `PetOwnerAccountsManagement.jsx`, `pet_owner_accounts.php`, `accountService.js`, `login.php` | Super Admin can inspect owner accounts/pets, unlink ownership, and deactivate/reactivate owners when account-status columns exist | Add/apply user status migration; QA login block and ownership unlink audit expectations |
| Lifecycle maintenance and recovery | `booking_maintenance.php`, `lifecycle_recovery_report.php`, `pet_overdue_cancellations.php`, `status_display.php` | Expired queues, missed bookings, and diagnosis-to-billing gaps are being operationalized | QA timezone behavior, excluded service types, notification side effects, and recovery report output |
| POS inventory consumption | `visit_billing.php`, `POSmanagement.jsx`, `service_catalog.php`, `inventory.php`, `StockInPage.jsx` | Visit charges can consume linked inventory items/materials and reverse movements on charge replacement | QA insufficient stock, batch FIFO behavior, reversal records, payment posting, and stock reports |
| General Check-up label/enum cleanup | `DDL/database_ddl_*.sql`, `serviceLabels.js`, booking/service components | The old `wellness` booking enum label is being replaced with `General Check-up` variants | Confirm existing rows/migrations handle old `wellness` values before production import |
| Jitsi deployment doc removal | `docs/jitsi-self-host.md` is deleted in the working tree | Online consult implementation remains, but the previous self-hosting doc is no longer in this repo | Confirm whether deployment docs moved elsewhere or should be restored before release |

## Gantt-Ready Backlog Table

| ID | Backlog Item | Type | Priority Assumption | Depends On | Acceptance Criteria |
| --- | --- | --- | --- | --- | --- |
| BL-001 | Stabilize deployable database schema | Technical | High | Full DDL and migration decision | One deployable schema/migration path exists; current code columns are included |
| BL-002 | Preserve or archive old migrations | Technical | Medium | BL-001 | Deleted older migration files are either restored, archived, or intentionally replaced |
| BL-003 | Validate auth, OTP, and account state | QA/Feature | High | SMTP/env config | Register, verify email, login, forgot/reset password, deactivated account blocking all pass |
| BL-004 | Validate pet registry and owner linking | QA/Feature | High | Auth and pet DB | Admin registers pet; owner links by sharable ID; profile image and status persist |
| BL-005 | Validate booking lifecycle | QA/Feature | High | Pets, uploads, payment methods | Owner submits booking; admin confirms/reschedules/cancels/receives; notifications fire |
| BL-006 | Validate queue lifecycle | QA/Feature | High | Pets, bookings | Queue add/status/assign/receive/return/reenter/complete/cancel all pass |
| BL-007 | Validate self-service queue | QA/Feature | Medium | Queue and access check | WAN/IP access check works; signature required; queue can be cancelled by owner |
| BL-008 | Validate diagnosis without vaccination | QA/Feature | High | Vet diagnosis flow | Diagnosis saves successfully with empty vaccination fields |
| BL-009 | Validate diagnosis extra consent side sheet/modal | QA/Feature | High | Consent templates, signature upload | Vet adds extra consent, owner signs, signature is saved and visible in diagnosis/history |
| BL-010 | Validate medical record print/email | QA/Feature | High | Medical record API, mail config | Owner can print and email record copy; no dropdown layout issue |
| BL-011 | Add PDF/document preview support | Feature | Medium | Upload metadata | Images preview; PDFs show browser preview; unsupported docs show metadata/download |
| BL-012 | Validate boarding booking consent | QA/Feature | High | BL-001, boarding rooms | Pet hotel submit/payment is blocked until liability consent is signed |
| BL-013 | Validate boarding admin operations | QA/Feature | High | Boarding booking | Room reserve, check-in/out, desired checkout, observations, tasks, docs, print history pass |
| BL-014 | Validate POS and visit billing | QA/Feature | High | Diagnosis, catalog, inventory | Visit creates; charges save; payment records; invoice/payment notifications fire |
| BL-015 | Validate service catalog/materials | QA/Feature | Medium | Inventory | Service CRUD and material linking work; inactive services handled correctly |
| BL-016 | Validate inventory operations | QA/Feature | Medium | Inventory schema | Create item, stock-in, stock-out/disposal, low-stock and expiry reports pass |
| BL-017 | Validate online consult and Jitsi | QA/Feature | Medium | Jitsi deployment/env | Owner books; admin approves; vet starts; owner joins; vet submits online diagnosis |
| BL-018 | Validate notification system | QA/Feature | High | Mail/push env | In-app, email, push, preferences, reminder runner all pass |
| BL-019 | Validate payment method management | QA/Feature | High | Payment method DB/API | Super admin OTP protects updates; QR image upload and active methods work |
| BL-020 | Validate record update request workflow | QA/Feature | Medium | Medical records, uploads | Owner request, admin approval/assignment, vet completion all pass |
| BL-021 | Add TV status display page | Feature | Implemented, verify | Queue/booking/diagnosis/payment APIs | Read-only full-screen display auto-refreshes and hides sensitive owner/diagnosis details |
| BL-022 | Deployment hardening | Technical | High | Feature QA | `.env.example`, CORS/origin, Hostinger rules, API paths, build output, PHP routing verified |
| BL-023 | Security/role hardening | Technical | High before production | Debug decision | Debug bypass removed or explicitly guarded; route roles and backend authorization reviewed |
| BL-024 | Data cleanup for committed uploads/logs | Technical | Medium | Deployment policy | Test uploads, logs, local `.env` history, and generated media are excluded or intentionally retained |
| BL-025 | Validate Super Admin reports dashboard | QA/Feature | High | Reports API, visit/bookings/queue/inventory data | KPI cards, charts, staff monitoring, and attention tables load for each date range |
| BL-026 | Validate report export and print center | QA/Feature | High | Reports dashboard/API | All report types generate, filters apply, print layout is usable, CSV export has expected columns |
| BL-027 | Apply and validate consent record ledger | Technical/QA | High | Consent migration, consent flows | `consent_form_records` exists; signed/released consent records persist and feed reports/media monitoring |
| BL-028 | Validate pet media monitoring | QA/Feature | Medium | Uploads, consent records, booking/queue/diagnosis/boarding data | Source/date/pet filters work, images preview, duplicate rows are avoided |
| BL-029 | Validate pet owner account controls | QA/Feature | High | User status migration, pet ownership | Owner list loads, ownership unlink works, deactivation/reactivation blocks/allows login as expected |
| BL-030 | Validate lifecycle maintenance and recovery report | QA/Technical | High | Queue/booking/visit schema | Previous-day queues and missed bookings update correctly; recovery report lists missing visit/charge records |
| BL-031 | Validate POS inventory stock consumption | QA/Feature | High | Service materials, inventory batches, POS | Visit charges consume stock, insufficient stock is blocked, replacements reverse prior stock movements |
| BL-032 | Final regression test pass | QA | High | All feature items | `npm run lint`, `npm run build`, PHP syntax checks, manual flow checklist completed |

## Release-Phase Assumptions From Git History

### Phase 1: Foundation and Owner Dashboard

Evidence:

- `314df67` created React/Vite/Tailwind base, login/register, owner dashboard pages, service forms, profile, todos, and initial UI primitives.
- `2f6a97e` and `bd0d92f` added pet registration/pet search foundation.

Assumption:

- The first backlog milestone was basic pet owner self-service: login/register, pet profile, service booking forms, and owner dashboard navigation.

### Phase 2: PHP Backend and Admin Operations

Evidence:

- `bd699db` removed the old Node/server files and added PHP API endpoints for pets, users, login, register, upload, linking, and routing.
- It also added `BookingManagement`, `ConsentFileManagement`, `PetInfoModal`, `PetOwnerInfoModal`, and `QueueManagement`.

Assumption:

- The second milestone was replacing prototype backend logic with PHP and adding admin operations for bookings, consent templates, pets, and queues.

### Phase 3: Booking, Consent, Queue, and Account Management

Evidence:

- `d4e1518` added `get_bookings.php`, `update_booking_status.php`, and booking UI changes.
- `452a044` added `add_booking.php` and consent file CRUD endpoints.
- `a2483d0` added account creation/list/status endpoints and `AccountManagement`.
- `cd3ca74` added queue endpoints, self-service queue, signature capture, home service confirmation, and upload media.

Assumption:

- This backlog stage focused on operationalizing bookings and queues, including signatures and payment/concern uploads.

### Phase 4: Inventory and Admin Reports

Evidence:

- `ac0d15d` added `php/inventory.php`, inventory pages, inventory status badge, and `inventoryApi.js`.
- `f2387e6` and `d6cf9ee` are inventory fixes.
- `85edf6` added inventory seed data.

Assumption:

- Inventory was introduced as a separate admin module after core booking and queue workflows.

### Phase 5: Responsiveness, Profiles, Schedules, and Dark Mode

Evidence:

- `c9ee798` touched most UI screens and explicitly mentions responsiveness.
- `36bbfe7` added room availability, profile endpoints, vet schedules, pet medical records, admin/vet profiles.
- `ea21dcd` added password update/profile update support and shared password/profile history components.
- `5371163` added deactivated-account blocking and pet status utility.
- `31e9176` added theme provider, theme hooks, theme toggle, auto-refresh, and broad dark-mode/UI updates.

Assumption:

- This phase was a UI/UX and account-management stabilization phase across roles.

### Phase 6: Vet, EMR, POS, and Schema Reorganization

Evidence:

- `b79e672` has a detailed commit message adding vet diagnosis, approved queue, vet my list, vet EMR, POS, queue receive/return, DDL migration folder, and upload deletion.

Assumption:

- This phase introduced the end-to-end clinical workflow: queue to vet to diagnosis/EMR to POS.

### Phase 7: Boarding, Billing, Service Catalog

Evidence:

- `bf998a9` added boarding migration, boarding backend, `PetBoardingManagement`, diagnosis history, and vaccination diagnosis migration.
- `e0d56ca` added visit billing migration, service catalog backend, visit billing backend, `ServiceCatalogManagement`, and expanded POS/boarding/vet diagnosis.
- `5304881` added a generated DB DDL.
- `54e6f1a` adjusted boarding room behavior.

Assumption:

- Boarding and visit billing were added after the base clinical workflow, then linked into service catalog and POS.

### Phase 8: Email, Notifications, and Push

Evidence:

- `387ed2e` added email OTP, forgot/reset password, mail helpers, and email verification UI.
- `a214007` added notification migrations, notification helpers, notification APIs, owner todos, notification bell/preferences, and service modules.
- `7459581` added browser push migration, service worker, push service, and push preference UI changes.

Assumption:

- The notification backlog was added as a late-stage operational layer after core workflows existed.

### Phase 9: Workflow Consolidation, Consent Rules, and Planning Docs

Evidence:

- `b4a81c2` added payment methods, record update requests, server-down page, current DDL exports, and planning documents.
- `b4a81c2` updated diagnosis, boarding, medical records, notifications, API client, upload, and profile/auth services.

Assumption:

- This phase commits business-rule and planning polish: optional vaccination, extra consents, boarding consent, medical record print/email, payment methods, record update requests, API health, and DB documentation.

### Phase 10: Super Admin Intelligence, Consent Ledger, and Lifecycle Recovery

Evidence:

- Current working tree adds Chart.js dependencies, Super Admin report dashboard/report center components, report service modules, and report PHP endpoints.
- Current working tree adds `DDL/20260619_create_consent_form_records.sql`, consent record helper/API files, and media monitoring that reads consent/booking/queue/diagnosis/boarding image sources.
- Current working tree adds pet owner account controls, account-status login checks, lifecycle maintenance expansion, recovery report endpoint, and POS inventory consumption/reversal behavior.

Assumption:

- This phase is an operations and oversight layer: Super Admin reporting, consent auditability, owner account control, media review, lifecycle cleanup, and tighter billing-to-inventory accounting.

## Commit-by-Commit Evidence Appendix

| Commit | Date | Changed Areas | Content-Level Summary |
| --- | --- | --- | --- |
| `314df67` | 2026-04-25 | App foundation, owner dashboard, auth screens, service forms, UI primitives | Initial React/Vite app with login/register, owner dashboard, consult/services/pets/todos/profile screens |
| `2f6a97e` | 2026-04-27 | Server SQL, pet register files | Placeholder/empty pet registration files added |
| `bd0d92f` | 2026-04-27 | Server SQL, `PetRegister`, dashboard, pet service | Pet registration/search implementation and dashboard route/nav expansion |
| `8237a1d` | 2026-04-28 | README, server upload config, pet profile, toast, ownership service | Refactor utilities, RBAC, toast relocation, secure image handling, pet owner profile, ownership linking |
| `bd699db` | 2026-04-28 | PHP API, admin booking/consent/queue components, public uploads | Migration from Node prototype to PHP endpoints and admin operations |
| `d976396` | 2026-05-05 | Queue dialog, dashboard, pet profile, sheet/table UI | Admin queue dialog and UI primitives; pet profile/admin page refinement |
| `0981a95` | 2026-05-05 | `.env`, `.gitignore` | Environment file was committed then later removed; treat as cleanup/security history |
| `d4e1518` | 2026-05-05 | Booking PHP, `BookingManagement`, services pages, `tables.sql` | Booking listing/status and admin booking UI expansion |
| `43a3759` | 2026-05-05 | README | Documentation-only update |
| `452a044` | 2026-05-06 | Booking create, consent CRUD, service booking forms | Booking submit API and consent file management implementation |
| `9cef0cc` | 2026-05-06 | Pet owner dashboard | Small UI/content change; message not descriptive |
| `a2483d0` | 2026-05-06 | Accounts PHP, Super Admin account component, dashboard routes | Account management and account status backend |
| `cc9576a` | 2026-05-06 | `MyPets.jsx` | TODO cleanup |
| `14f1f0c` | 2026-05-06 | `MyPets.jsx` | TODO cleanup repeat |
| `6961feb` | 2026-05-06 | `tables.sql`, source file | SQL/schema update |
| `3c806d0` | 2026-05-09 | `.env` | Removed committed environment file |
| `cd3ca74` | 2026-05-14 | Queue PHP, home service, self-service queue, signature, uploads | Queue backend and signature-based service/queue flows |
| `a54a082` | 2026-05-17 | Booking/account/app files | Fixes around booking/account/session; message vague |
| `ac0d15d` | 2026-05-19 | Inventory PHP and admin inventory pages | Inventory module initial implementation |
| `b932a96` | 2026-05-19 | `.env` | Removed environment file again |
| `3455803` | 2026-05-19 | README | Documentation update |
| `ee18779` | 2026-05-19 | `.gitignore` | Ignore rule update |
| `75ed4c6` | 2026-05-19 | Merge | Merge remote tracking branch |
| `5899c04` | 2026-05-19 | `.gitignore` | Ignore rule update |
| `ab58360` | 2026-05-19 | Source files | Small source change; message vague |
| `43535b4` | 2026-05-19 | Source file | Small source change; message vague |
| `f2387e6` | 2026-05-20 | Inventory PHP/source | Inventory fixes |
| `d6cf9ee` | 2026-05-21 | Inventory PHP/source | Inventory fixes |
| `84a31f6` | 2026-05-21 | `tables.sql` | Schema update |
| `85edf6` | 2026-05-21 | Inventory seed SQL | Inventory seed data update |
| `d6ccca8` | 2026-05-21 | Source and Vite config | General idea/config update; message vague |
| `c9ee798` | 2026-05-24 | Most UI screens, AGENTS, PHP activity endpoints | Responsive screen pass and pet activity endpoints |
| `36bbfe7` | 2026-05-26 | Profiles, medical records, vet schedules, room availability | Profile/admin/vet screens, medical record endpoint, vet schedules, room availability |
| `ea21dcd` | 2026-05-26 | Password/profile update, profile shared components, booking/payment screens | Password change and profile editing improvements |
| `3560ca3` | 2026-05-27 | Online consultations, special services, booking maintenance, Jitsi docs | Online consult/Jitsi and special services workflow |
| `32aa09d` | 2026-05-28 | Source file | Consultation fix |
| `db45dd4` | 2026-05-28 | Source file | Consultation fix |
| `5371163` | 2026-05-28 | Login/account/profile/service booking files | Deactivated account blocking and profile entrypoint fix |
| `31e9176` | 2026-05-29 | Theme, auto-refresh, many UI screens, cleanup of uploaded media | Dark mode, auto-refresh, UI cleanup, generated media removal |
| `b79e672` | 2026-05-31 | DDL, vet components, POS, queue/booking helpers | Vet diagnosis/EMR/POS workflow and DDL migration organization |
| `bf998a9` | 2026-06-03 | Boarding backend/component, DDL, diagnosis history | Pet boarding management and diagnosis history |
| `e0d56ca` | 2026-06-04 | Visit billing, service catalog, POS/boarding/vet diagnosis | Service catalog and visit billing/POS expansion |
| `5304881` | 2026-06-04 | DDL export | Generated DB DDL added |
| `f8b1080` | 2026-06-04 | `.gitignore` | Hostinger deploy ignore rules |
| `ce91d87` | 2026-06-04 | `.htaccess`, service catalog, consult | Deployment/web server and small service/consult changes |
| `371e0e8` | 2026-06-04 | App/UI/services | Lint fixes |
| `424dd6e` | 2026-06-04 | `findPet.js` | Lint fix |
| `387ed2e` | 2026-06-08 | OTP/email PHP, mail helpers, verification/reset screens | Email verification, forgot/reset password, mail OTP |
| `54e6f1a` | 2026-06-08 | Boarding backend/component, dashboard, approved queue | Boarding room behavior fixes |
| `a214007` | 2026-06-11 | Notifications, todos, services, many screens | In-app/email notifications, reminders, notification preferences, API service layer |
| `7459581` | 2026-06-11 | Push migration, service worker, push service, notification UI | Browser push notifications |
| `b4a81c2` | 2026-06-14 | DDL exports, planning docs, consent workflows, payment methods, record requests, API health, medical records | Consolidated workflow updates: boarding consent, optional diagnosis vaccination, extra signed consents, medical record print/email, payment method management, record update requests, server-down handling, and backlog/system documentation |

## Risks and Cleanup Backlog From Git Review

| Risk | Evidence | Backlog Action |
| --- | --- | --- |
| Secrets/env file history | `.env` was added and later deleted in multiple commits | Verify no real secrets are in Git history before production sharing |
| Generated/test upload media in history | Several commits added public images, concerns, signatures, payments | Decide retention policy; add cleanup and ignore rules |
| DDL/migration confusion | `tables.sql` existed historically, later deleted; `b4a81c2` removed older migration snapshots and added full DDL exports | Create one clear database migration strategy |
| Debug bypass enabled | Current repo instruction says do not change dashboard/dashboardRouter debug bypass | Track as explicit pre-production security task |
| Large broad commits | Multiple commits changed 50-80 files with vague messages | Add more manual QA because commit history does not isolate behavior cleanly |
| Runtime schema alteration | PHP auto-adds some columns | Prefer explicit SQL migrations for deployment predictability |
| Push notification production dependency | Push requires HTTPS and VAPID config | Add deployment checklist item |
| Jitsi production dependency | Online consult depends on Jitsi URL and setup | Add environment/deployment validation task |
| Consent ledger migration gap | `consent_form_records` is an explicit 2026-06-19 migration, not in the latest full DDL export | Run the migration or refresh full DDL before report/media consent features are expected to work |
| Pet owner deactivation schema gap | `pet_owner_accounts.php` requires `users.account_status`, `users.deactivated_at`, and `users.deactivation_reason` but only returns SQL when missing | Add a tracked migration and QA login blocking/reactivation |
| Payment method enum gap | `visit_billing.php` allows `cash`, but older DDL enums may not include it | Add a migration for `visit_payments.payment_method` before cash payment posting |
| General Check-up enum rename | DDL/service label changes replace older `wellness` wording with `General Check-up` | Confirm existing production rows and booking forms migrate cleanly |
| Report query drift | Reports aggregate across many tables and fall back when tables/columns are missing | QA reports against a representative database and review missing-data notes |
