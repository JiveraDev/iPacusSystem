# iPawcus System Capabilities, Detailed Workflows, and Limitations

Revised and cross-referenced: **October 18, 2026**. Basis: the current local working tree, including uncommitted implementation changes. This is the combined functional reference for the system. It incorporates the detailed capability catalogue, the September limitations review, newer module guides, and a fresh comparison with connected screens, frontend services, PHP dispatch/policies, and selected handler rules.

The original module catalogue was reviewed on September 16. The September 22 limitations report and October 13–16 audits remain dated evidence; their conclusions are reconciled here rather than all being treated as current. This revision changes documentation only. Dashboard and dashboard-router debug bypasses are preserved.

## Current review and evidence boundaries

The system supports pet owners, administrators, veterinarians, and super administrators. Its core workflow connects pet registration, ownership, booking, intake/queue, veterinarian care, records, billing, and material traceability. Grooming, clinical confinement, Pet Hotel, online calls, prescriptions, certificates, consent, reports, notifications, and backup export extend that workflow.

**Implemented** means an active connection exists in the program. It does not mean the deployed server, database, external provider, or every role-specific browser journey was verified. This review followed the route dispatcher and access policy, sampled the relevant implementation rules, and rechecked changes that conflict with older documentation. It is not an exhaustive security audit of every line.

Fresh verification on October 18:

- `npm.cmd run check`: **201/201 runner checks passed**, including **114 frontend tests**, lint, production build, PHP syntax, selected database-free regressions, and local API routing. The runner count is not a count of full business journeys. Logs are local ignored artifacts in `tmp/project-audit/`.
- `npm.cmd run check:google`: configuration, matching public/server client IDs, PHP extensions, trusted local origin, and the installed verifier pass. The local database readiness step fails. This probe does not establish that a real Google sign-in succeeds.
- Documentation validation passes across nine revised files: 324 relative/internal links, 70 source line anchors, and all 39 numbered main sections; no broken targets or unresolved draft markers were found. `git diff --check` also passes.
- No database migration, production record change, live payment, mail/push delivery, video meeting, restore, or deployment was performed for this revision. No new browser journey was run.

Database findings must be read with their dates and environments: the October 14 isolated 88-table sandbox passed its documented synthetic API checks; the normal configured database connected on that date but lacked required keys, constraints, and auto-increment metadata. Today's Google prerequisite probe cannot establish current database readiness. The October 14 missing-schema SQL was review-only, not proof that a repair was applied. See [configured database findings](20261014_database_verification.md) and [sandbox isolation](database_sandbox.md).

Key corrections from the older documents:

| Area | Reconciled current description |
| --- | --- |
| Staff-account directory | `get_accounts.php` now removes `user_password`. The separate profile endpoint still serializes all user columns; that finding remains open. |
| Account inactivity | Archive does not revoke access. Google sign-in checks inactive staff profiles; password login does not call its staff-deactivation helpers, and token lookup does not enforce staff inactivity. |
| Booking capacity | Medical services share the actual accepting veterinarian roster across clinics. A pending appointment reserves a vet. Ordinary medical durations remain fixed at 30 minutes; online/home intervals are 60 minutes. |
| Online versus clinic hours | Online starts follow the vet's separate call calendar and are exempt from clinic opening/lunch/closure gates. Cross-service veterinarian interval conflicts still apply. |
| Published branch visits | Retired. The legacy endpoint returns an empty list and rejects publishing. Per-clinic booking acceptance is current. |
| Intake | Admin physical-examination records and signed consent precede diagnosis finalization where the intake schema is installed. The intake GET query has a branch-scoping gap described in section 36. |
| Prescriptions and certificates | Independent immutable prescription additions, dose checklists, registration certificates, and veterinarian-issued medical certificates are implemented. |
| Grooming | Before/after evidence and active catalog selections are required at the relevant transitions. Verified full POS payment releases ready jobs. A confinement review can transfer care into Boarding. |
| Activity Log | There is a separate Super Admin Activity Log page. The current API returns selected operational action modules; the old guide's navigation/sign-in and Report Center placement descriptions are not current. |
| Request failures | Section recovery and a confirmed service-status notice are implemented. One failed endpoint does not replace the entire application. |

Source references for these corrections appear beside the relevant sections and in the [cross-reference map](#34-source-evidence-map). All open limitations are consolidated in [section 36](#36-consolidated-limitations-and-findings).

## Contents

- [1–4. Scope, architecture, roles, and authority](#1-purpose-and-reading-rules)
- [5–8. Authentication, accounts, branches, pets, and ownership](#5-authentication-registration-and-password-processes)
- [9–12. Booking, queue, diagnosis, and online consultation](#9-booking-and-appointment-process)
- [13–16. Medical records, update requests, Grooming, and Boarding](#13-medical-records-and-health-history)
- [17–20. Services, inventory, POS/billing, and payment methods](#17-service-catalog-and-owner-facing-services)
- [21–27. Consent, notifications, reports, media, uploads, displays, and lifecycle maintenance](#21-consent-form-management)
- [28. Cross-cutting restrictions and fail-safes](#28-cross-cutting-restrictions-and-fail-safes)
- [29. Configuration and deployment dependencies](#29-configuration-and-deployment-dependencies)
- [30. Inactive, incomplete, or not implemented](#30-inactive-incomplete-or-not-implemented)
- [31–33. State machines, data authority, and API map](#31-state-machine-reference)
- [34. Source-evidence map](#34-source-evidence-map)
- [35. Validation status](#35-validation-status-of-this-document)
- [36. Consolidated limitations and findings](#36-consolidated-limitations-and-findings)
- [37. Complete workflow and role handoffs](#37-complete-workflow-and-role-handoffs)
- [38. Suggested scope and quality assessment](#38-suggested-scope-and-quality-assessment)
- [39. Document provenance and maintenance](#39-document-provenance-and-maintenance)

## 1. Purpose and reading rules

This document describes what the current iPawcus program is designed to do. It was produced by tracing the connected React screens, frontend services, PHP route dispatcher, backend validation and transaction code, upload controls, and current SQL migrations. Older Markdown files were used only to locate areas of the program; they were not treated as proof that a feature exists.

This is a static source-code screening, not a certification of the live hosting environment or its current database contents. A feature can be present in the program but unavailable on a server if its SQL migration, environment variable, storage directory, mail worker, or browser requirement has not been deployed.

The following labels are used:

- **Active:** connected to a current screen or API route.
- **Deployment-dependent:** active code exists, but it needs a migration, server configuration, worker, HTTPS, or third-party service.
- **Inactive:** files may exist in the repository, but the feature is not connected to active navigation or API routing.
- **Not implemented:** no complete operational workflow was found in the current program.

Security decisions must be based on the PHP route and record-level checks. Hiding a frontend menu item is only a usability control and is not the final authorization boundary.

## 2. Executive capability summary

iPawcus is a multi-role veterinary-clinic operations system with these active business areas:

- Pet-owner registration, email verification, login, password recovery, profiles, preferences, pets, shared ownership, bookings, self-service queue entry, medical-record viewing, update requests, online consultations, consent documents, notifications, and schedule/TODO views.
- Administrator pet registration, booking review, queue coordination, point of sale, inventory, grooming, boarding, record-request review, service catalog, consent-template management, and branch-scoped operations.
- Veterinarian approved queues, personal work list, diagnoses, vaccination records, online consultations, medical records, prescriptions, medical certificates, histories, grooming review, clinical confinement, record-update work, online availability, per-clinic booking acceptance, notifications, and TODOs.
- Super Administrator reports, report exports, account management, pet-owner account review, payment-method configuration, media monitoring, admin feature permissions, and inherited clinic access where the backend permits it.

The program uses a React 19/Vite frontend and a PHP/MySQL API. The backend is the source of truth for identity, roles, record ownership, branch access, state changes, prices, payment state, stock movement, and clinical completion.

The program has meaningful defensive controls: hashed API tokens, prepared database statements, transactions, row locks, named locks in collision-prone workflows, state-machine validation, upload MIME checking, protected media delivery, duplicate prevention, authoritative server-side pricing, and post-commit notification handling.

The most important current limitations are:

- Super Admin has a connected, configuration-dependent local backup download action. Automated retention and in-app restoration are not implemented; a clean-environment restore has not been verified by this audit. See section 30.1 and `BACKUP_RECOVERY.md`.
- “Archived” is currently an administrative label. The login handler still creates a token for an archived account, and existing valid tokens are not invalidated by archive status.
- The frontend route matcher is intentionally broad for several screens. PHP route and record checks remain the real security control.
- PWA support caches the application shell only. It does not provide offline access to private clinic records, offline writes, or later data reconciliation.
- Several features fail closed when their migrations or secure storage are missing; their presence in source does not prove that the deployed database is ready.
- There is no unified automated end-to-end test suite and no verified disaster-recovery workflow in the active application.

## 3. System architecture and request handling

### 3.1 Frontend

The main frontend entry points are src/main.jsx, src/App.jsx, and src/components/Dashboard.jsx. Dashboard.jsx defines the visible navigation and connects paths to page components. src/components/dashboardRouter.jsx performs client-side path matching.

The frontend:

- Stores the signed-in user and API access token in browser local storage.
- Sends API requests through src/services/apiClient.js.
- De-duplicates equivalent GET requests that are already in flight.
- Applies request timeouts and retries transient failures when appropriate.
- Clears local authentication and redirects when authentication expires.
- Signals coordinated health checks after endpoint failures. A service-status notice appears only after confirmed health-probe failures; page and section error boundaries contain rendering failures.
- Uses the shared ThemeProvider and ThemeToggle; the selected named palette is stored under ipawcus-theme, with the document dark class following its appearance. The palette library includes Light, Islands Light/Dark, Dracula, Alucard, Solarized Light/Dark, Nightfall, and a legacy Dark alias.
- Uses shared UI primitives and responsive layouts for phone, tablet, desktop, and wide screens.

### 3.2 Backend dispatch

php/index.php is the API dispatcher. It normalizes supported API path formats and routes each request to a PHP handler. It accepts GET, POST, PUT, PATCH, DELETE, and OPTIONS where handlers allow them.

Backend routing behavior:

- Known public endpoints are explicitly identified.
- Protected endpoints require a valid access token.
- The current user role is normalized to pet_owner, admin, veterinarian, or super_admin.
- The route policy rejects disallowed roles with HTTP 403.
- Unknown or unapproved protected routes are denied with HTTP 404.
- Record-specific handlers perform additional owner, veterinarian, and branch checks after the route-level role check.
- PHP display errors are disabled in the dispatcher while server-side error logging is enabled.

The API currently sends Access-Control-Allow-Origin: *. That is convenient for separated frontend/API hosting, but production should review whether an unrestricted CORS origin is appropriate.

### 3.3 Authentication tokens

Successful login creates a cryptographically random 32-byte API token. Only its SHA-256 hash is stored in api_access_tokens. The default validity is 30 days. Expired tokens are marked revoked during later token creation, and a valid token records its last-used time.

The API can read the token from:

- Authorization: Bearer.
- X-Access-Token.
- An access_token query parameter.
- The ipawcus_api_token cookie.

The query-parameter option is a security concern because URLs may be copied or logged. Normal application requests should use the Authorization header.

### 3.4 Database behavior

The application uses MySQL through PDO. High-risk workflows use explicit transactions and row locking. Many modules check their required tables and columns before they write. When an integrity-critical migration is absent, the normal behavior is to return an explanatory error instead of silently creating a partial runtime schema.

This project keeps schema information in tables.sql and dated files under DDL/. A new server must apply all required migrations in the intended order before the corresponding modules can be considered operational.

### 3.5 Live refresh and temporary browser drafts

GET-backed dashboard views can use src/hooks/useAutoRefresh.js. Its default refresh interval is four seconds. It:

- Avoids overlapping refresh calls.
- Keeps refreshes quiet after the initial load.
- Pauses while the browser tab is hidden.
- Uses increasing retry delays, up to 30 seconds, after failures.
- Refreshes when the tab becomes visible again.

src/hooks/useSessionFormPersistence.js preserves eligible form drafts in session storage for the current user and route. It intentionally excludes sensitive or misleading fields, including passwords, OTPs, access tokens, signatures, payment/card/bank data, proofs, receipts, uploaded files, and search/filter/page controls. Storage failures do not block the form, and saved drafts are cleared at the appropriate logout/user boundary.

### 3.6 PWA and browser push

PWA registration is deployment-dependent and gated by the PWAACTIVATOR setting. The service worker caches the application shell and static resources. It does not cache authenticated API records or queue private writes for later synchronization.

Browser push is also deployment-dependent. It needs HTTPS, a registered service worker, VAPID configuration, browser permission, and a valid stored subscription.

**Current source cross-reference:** [src/services/apiClient.js](../src/services/apiClient.js#L41); [php/index.php](../php/index.php#L54); [src/hooks/useAutoRefresh.js](../src/hooks/useAutoRefresh.js#L3); [src/lib/theme.js](../src/lib/theme.js#L1).

## 4. Roles, navigation, and authority

### 4.1 Effective roles

| Role | Main purpose | Primary active work areas |
| --- | --- | --- |
| Pet Owner | Self-service access to their pets and clinic interactions | Consult/services, own pets, booking, self-service queue, online consultation, medical records, record-update requests, notifications, profile, schedule/TODOs |
| Admin | Clinic operations and reception/business handling | Pet register, bookings, record requests, boarding, grooming, queue, POS, service catalog, inventory, consent files, operational pet directory |
| Veterinarian | Clinical and assigned-care work | Approved List, My List, diagnosis, online consultations, medical records, record requests, histories, assigned grooming review, media monitoring, schedule/TODOs |
| Super Admin | Governance, reporting, configuration, and oversight | Reports, Report Center, accounts, pet owners, payment methods, media monitoring, admin feature controls, plus permitted clinic operations |

### 4.2 Frontend navigation versus backend authorization

Dashboard.jsx contains the intended navigation roles. dashboardRouter.jsx deliberately allows ALL_ROLES for several route patterns, including some booking, queue, consent, account, pet-register, and inventory paths. Therefore:

- A URL being renderable in React does not grant data access.
- The PHP role policy is the real route boundary.
- Owner checks, branch checks, and assignment checks inside handlers are still required.
- The existing debug-bypass blocks in Dashboard.jsx and dashboardRouter.jsx are untouched by this documentation work.

### 4.3 Optional per-admin feature control

The Super Admin can configure these administrator feature keys:

- pets
- pet_register
- bookings
- record_requests
- boarding
- grooming
- queue
- pos
- inventory
- services
- service_catalog
- consent

These settings are enforced for administrator mutations at the backend as well as used for frontend visibility. They are an additive layer over the normal Admin role.

Current limitation: if the admin_feature_permissions table is absent or its lookup fails, the backend defaults the permissions to allowed and logs the error. This preserves legacy Admin operation but is fail-open for this optional permission layer.

### 4.4 Branch scope

The program supports multiple branches, operating hours, closures, per-branch service availability, user assignments, per-clinic veterinarian booking acceptance, inventory location, booking transfers, and branch-aware operational data. Published branch-visit scheduling has been retired.

Regular administrators are restricted to assigned branches in branch-sensitive workflows. Super Admin can operate across branches. Veterinarian access is also checked against the clinical assignment or branch context in relevant workflows.

**Current source cross-reference:** [php/role_access.php](../php/role_access.php#L17); [php/role_access.php](../php/role_access.php#L56); [php/branch_helpers.php](../php/branch_helpers.php#L193).

## 5. Authentication, registration, and password processes

### 5.1 Public pet-owner registration

Actors: new pet owner.

Required information:

- First name.
- Last name.
- Email address.
- Personal address.
- Philippine phone number.
- Password.
- Acceptance of Terms of Use and General Service Conditions.

Process:

1. The frontend collects the registration information and agreement.
2. The backend validates required values, phone format, and password strength.
3. Public registration always creates a pet_owner; it cannot create a staff or Super Admin account.
4. The password is stored with bcrypt hashing.
5. The account remains unverified until the email OTP is completed.
6. A verification code is generated, hashed, stored with expiry and attempt limits, and emailed.
7. Successful verification records email_verified_at and permits login.

Password policy:

- At least eight characters.
- At least one uppercase letter.
- At least one number.
- At least one special character.

Duplicate-account safeguard: if the email belongs to an existing unverified pet-owner account, registration does not overwrite its password or profile. The user is returned to the verification/resend process.

### 5.2 Email OTP behavior

OTP purposes include email verification, password reset, password change, and payment-settings change.

Safeguards:

- Six-digit cryptographically generated code.
- HMAC-based stored hash using OTP_SECRET, with VITE_MASTER_KEY as configured fallback.
- Default 10-minute expiry; the configured minimum is five minutes.
- Default five attempts; the configured minimum is three.
- Default 60-second resend cooldown; the configured minimum is 15 seconds.
- Issuing a new code retires previous active codes for the same purpose.
- A failed email delivery retires the newly created code so the user can retry without being trapped by the cooldown.
- Used, expired, and exhausted codes are rejected.

If the OTP schema or secret is missing, OTP-protected operations fail instead of pretending they succeeded.

### 5.3 Login

Process:

1. Email and password are required.
2. The password is verified against the bcrypt hash.
3. Unverified email accounts are rejected with an EMAIL_UNVERIFIED result.
4. A new API access token is created.
5. The frontend stores the user session and token.

Important current behavior: login calculates whether the account is archived and returns that label to the frontend, but it does not stop token creation. Helper functions that could identify inactive staff or archived owners exist in login.php but are not called in the active login path.

### 5.4 Password recovery and change

Password recovery uses an email OTP before accepting the new password. An authenticated password change requires the current password and a valid new password. Notification delivery is attempted after the change. Neither password handler revokes existing API tokens, and token lookup does not use password_changed_at to invalidate them. Recovery therefore does not terminate an already issued session.

### 5.5 Session failure handling

- Missing, expired, or revoked tokens cause HTTP 401.
- Disallowed roles cause HTTP 403.
- The frontend clears stale session data and returns to authentication when necessary.
- Transient network failures can be retried by the API client.
- Service availability is checked independently of an individual feature failure. The maintenance reporting endpoint remains available for a limited diagnostic report; see sections 27.4–27.5.

The general login endpoint does not contain a comparable per-IP/password-attempt rate limiter. OTP and public maintenance-report endpoints have their own limiting behavior.

### 5.6 Google sign-in, onboarding, and explicit linking

`GoogleContinueButton` obtains the identity credential and sends it to `/auth/google`. The server verifies its signature through the installed Google library and checks the configured audience, expiry, issuer, and verified identity data.

1. A returning linked identity receives an iPawcus session with its stored role.
2. An existing password account with the same email receives link-required guidance; accounts are not silently merged.
3. A new identity receives a short-lived onboarding token. Completing contact/profile fields and accepting terms creates a pet-owner account transactionally.
4. A signed-in user can connect a matching Google identity from Profile through `/account/google`; conflicting identities and mismatched email are rejected.

Setup requires matching client IDs, trusted frontend origins, the Composer verifier, email-verification/access-token schema, identity/onboarding tables, and a nullable password column for Google-only accounts. Onboarding expiry uses the database clock. Google sign-in checks inactive Admin/Veterinarian profiles; this differs from the current password-login path. Archive remains an administrative marker in both the public user payload and token policy.

Live Google credentials, browser callbacks, origin registration, and successful database writes were not tested in this revision. See [Google integration testing](google_integration_testing.md).

**Current source cross-reference:** [php/register.php](../php/register.php#L16); [php/login.php](../php/login.php#L155); [php/update_password.php](../php/update_password.php#L47); [php/google_auth_helpers.php](../php/google_auth_helpers.php#L293).

## 6. Account administration and profiles

### 6.1 Super Admin account management

The Super Admin can:

- List and inspect staff accounts.
- Create Admin and Veterinarian accounts.
- Update personnel profiles.
- Assign active branches.
- Set administrator feature permissions.
- Mark accounts active/archived through the current account-status controls.
- Review pet-owner accounts and ownership information.

The account “delete” action is an archive operation, not a hard database deletion. It:

- Requires the configured master key.
- Prevents the current Super Admin from archiving their own account.
- Prevents archiving a Super Admin through that operation.

Current limitation: archive status does not actually revoke authentication or permissions. It should not be treated as account deactivation until login and token lookup enforce it and existing tokens are revoked.

### 6.2 Administrator personnel profile

Common identity/contact fields include:

- First and last name.
- Email.
- Phone.
- Address.
- Birth date.
- Profile image.
- Preferred branch.

Administrator employment fields currently retained:

- Employee ID.
- Position/role.
- Employment status.
- Total years of experience.
- Active marker.
- Branch assignment.

Allowed administrator positions are:

- Assistant Vet.
- Secretary.
- Staff.
- HR.

Allowed employment statuses are full-time, part-time, and contract.

Government-identification fields, education history, and administrator professional-experience history were removed by DDL/20260914_01_personnel_profile_cleanup.sql. Old Nurse and Senior Nurse roles are migrated to Assistant Vet.

### 6.3 Veterinarian personnel profile

Veterinarian profile information includes:

- Common identity/contact fields.
- Professional license/PRC identifier.
- Specialization.
- Total years of experience.
- Professional-experience history.
- Active branch assignment.
- Recurring weekly online-consultation start selections.
- Per-assigned-clinic Accept bookings preferences.

Published branch visits are retired; the old branch-schedule endpoint is a compatibility response, not an active visit-publishing workflow.

Veterinarian education history was removed by the personnel cleanup migration. Professional experience remains for veterinarians.

### 6.4 Profile restrictions and handling

- Every authenticated user can view and update their own profile.
- Super Admin can manage other users where the backend permits it.
- Normal administrators cannot assign their own branch from the profile; branch assignment belongs to Super Admin Account Management.
- Philippine phone formats are validated.
- Profile screens warn about unsaved changes.
- Staff profile updates produce a governance notification for Super Admin when the notification schema is available.
- Shared theme controls are used on profile screens.

### 6.5 Current profile-response limitation

The staff directory removes password hashes before serialization. `GET /profile` uses `u.*` or `SELECT u.*`, then serializes the fetched profile without removing `user_password`. Owner/Super Admin scope checks exist, but they do not justify exposing the stored hash. This remains an implementation issue and must not be described as fixed by the directory change.

**Current source cross-reference:** [php/get_accounts.php](../php/get_accounts.php#L46); [php/get_user_profile.php](../php/get_user_profile.php#L62); [php/update_account_profile.php](../php/update_account_profile.php).

## 7. Branch, operating-hour, and veterinarian availability processes

### 7.1 Branch configuration use

Branch information is used by:

- Booking availability and confirmation.
- Queue entry and assignment.
- Administrator data access.
- Grooming and boarding.
- Inventory location and movement.
- Visit/POS records.
- Reports and report filters.
- Veterinarian presence and schedules.

### 7.2 Booking calendar safeguards

For on-site and home medical appointments, the engine checks the active clinic, service support, opening hours, closure dates, past times, accepting assigned active veterinarians, and actual reserved intervals. On-site/home appointments must fit clinic hours and avoid 12:00–1:00 PM lunch. Ordinary clinic booking excludes Sunday. Grooming uses its own service-slot availability and is exempt from the veterinarian lunch rule. Boarding uses room/date-range capacity.

Online consultation uses a separate weekly call-start calendar, independent of clinic assignment, clinic acceptance, opening hours, lunch, and closure dates. Selecting a start reserves a full 60-minute interval. The same veterinarian cannot have overlapping online, home, or on-site appointments across branches. A half-hour display step is not a half-hour online consultation duration.

### 7.3 Veterinarian presence

Admin Home can change a daily Vet is in / Vet is out setting. The public landing page and owner Home combine that setting with the selected clinic's hours, closure dates, Sunday, and lunch to display in, out, closed, lunch, or unavailable. The daily setting resets at midnight in Asia/Manila; a reset does not make a closed clinic appear open.

The sign is informational. It does not cancel appointments, allocate a particular vet, or override the separate appointment rules. A failed availability/presence request is shown as unavailable.

### 7.4 Shared veterinarian capacity and booking preferences

Super Admin assigns one or more active clinics to a veterinarian. The vet can enable Accept bookings for each assigned clinic. Each accepting active vet contributes one simultaneous medical appointment; capacity is shared across medical service types, rather than separately inventing capacity for each service. Pending bookings already reserve a veterinarian. The calendar checks that vet's booked interval across all locations and online calls.

Assignment/preference changes are rejected if they would remove required coverage for existing future appointments. Removing a booked online start is likewise rejected until the call is moved or cancelled. Schedule and appointment changes use the shared medical-calendar lock.

The current system has no per-vet working-hours or time-off editor. Clinic hours supply the on-site schedule, and unassigned legacy bookings conservatively consume capacity until reconciled. Published branch visits are retired: legacy GET returns an empty list, and writes return a replacement-workflow conflict. See [shared veterinarian booking](shared-veterinarian-booking.md).

**Current source cross-reference:** [php/clinic_booking_helpers.php](../php/clinic_booking_helpers.php#L26); [php/veterinarian_booking_schedule.php](../php/veterinarian_booking_schedule.php#L35); [php/booking_slot_helpers.php](../php/booking_slot_helpers.php#L55); [php/veterinarian_branch_schedules.php](../php/veterinarian_branch_schedules.php#L14); [php/vet_presence.php](../php/vet_presence.php).

## 8. Pet registration, ownership, and pet profile

### 8.1 Pet registration data

The program currently handles:

- Pet name.
- Species.
- Primary breed.
- Birth date and derived age display.
- Sex/gender.
- Body weight.
- Color/markings.
- Microchip number.
- Registered owner or temporary owner.
- Pet status: Healthy, Emergency, or Deceased.
- Allergies.
- Pet profile image.
- Generated registration/shareable ID.

The Admin Pet Register includes a compact registration form and a floating Registered Pets List. The list keeps search and filters, limits the modal to 10 pets per page, and provides numbered/previous/next pagination.

After registering a pet, an administrator can hand it to Queue Management. A deceased pet cannot be placed into a new active queue.

### 8.2 Pet-owner pet creation and linking

A pet owner can:

- Add a pet under their own account.
- Link an existing clinic pet by its shareable ID.
- View pets they own or co-own.

Ownership process:

1. If a pet has no owner, the first valid link can establish the owner.
2. If the pet already has an owner, the new link becomes a co-parent request rather than immediate access.
3. The primary owner or authorized clinic role can approve or decline as permitted.
4. Approval creates the ownership link.
5. Duplicate ownership links and duplicate requests are guarded.
6. Both parties receive relevant notifications when notification support is available.

The approval operation uses a transaction and row locking so concurrent decisions do not create duplicate ownership.

### 8.3 Pet profile presentation and actions

The current pet profile uses a compact clinic-ID-style card intended to keep the important information within one screen where viewport size permits. It includes:

- iPawcus/Vetfocus clinic identity.
- Registration ID and copy action.
- Aligned pet image and name.
- Health-status label.
- Personal information.
- Queue number as a stamp when an active queue exists.
- A flip view for vaccination records.
- Floating actions for Update Record, Health History, Consent Files, and Bookings.

Owner-only actions are marked as such in the interface. The backend still verifies ownership before returning or changing private records.

### 8.4 Basic pet editing

The shared basic-information editor sends only an allowlisted set of fields:

- Name.
- Species.
- Breed.
- Birth date.
- Gender.
- Weight.
- Color.
- Microchip.

It does not send ownership fields or arbitrary clinical fields. Clinical/medical changes belong to the medical-record or approved record-update workflow.

### 8.5 Pet-status safeguards

Deceased status is used to block future clinical booking confirmation/receipt and active queue creation. The maintenance endpoint can also close overdue bookings and queues for a selected pet.

The current status model records Emergency and Deceased, but it does not provide a complete emergency-triage, DNR, euthanasia, remains-release, or incident-management workflow.

### 8.6 Registration and veterinary medical certificates

Authorized pet/clinic views can prepare a Certificate of Clinic Registration from the existing patient record. It has no expiration and proves clinic registration only; it does not certify current health, vaccination, or fitness for travel.

Medical certificates are a separate stored clinical document. The handler permits issuance only by the actual `veterinarian` role; Super Admin route access does not grant issuance. The vet supplies an examination date, findings, certification statement, signature path, and validity of 1–30 days after examination. Future examination dates are rejected. A linked record-update request must match the pet, assigned vet, and an assigned/in-progress request state.

Issuance locks the pet, supersedes prior active certificates, stores the numbered certificate, and attempts an owner notification after commit. Owner views identify new certificates and can mark them viewed. Expired status is derived from validity dates. The current certificate API returns registration data and the latest non-revoked medical certificate; it is not a complete public certificate-verification or revocation-management service. Medical issuance requires `DDL/20261002_03_pet_certificates.sql`.

**Current source cross-reference:** [php/add_pet.php](../php/add_pet.php); [php/link_pet.php](../php/link_pet.php); [php/coparent_requests.php](../php/coparent_requests.php); [php/pet_certificates.php](../php/pet_certificates.php#L325).

## 9. Booking and appointment process

### 9.1 Supported booking categories

The booking/service flow recognizes:

- General Check-up.
- Vaccination.
- Parasite Control.
- Grooming.
- Dental.
- Surgery.
- Laboratory Testing.
- Online Consultation.
- Home Service.
- Special Services.
- Boarding/Pet Hotel.

The owner-facing service pages explain and preselect services, but the booking API remains responsible for availability, ownership, consent, price, and conflict validation.

### 9.2 Standard owner booking

Actors: pet owner, administrator, and later veterinarian or service staff.

Process:

1. The owner selects a service.
2. The owner selects one or more eligible owned pets where the service supports it, or supplies the supported temporary/unregistered-pet details.
3. The owner chooses an active branch and an available date/time.
4. Required concerns, contact/location data, consent forms, signatures, and payment proof are collected according to service type.
5. Uploaded documents are stored first, then their protected paths are included in the booking request.
6. The backend rechecks pet ownership, pet status, branch/service availability, the date/time, daily conflicts, slot conflicts, and required consent/payment evidence.
7. A pending booking and booking number are created.
8. The owner and clinic can receive notifications.
9. Admin reviews the booking and can confirm or cancel it, subject to validation.
10. A confirmed clinical booking can be received into the queue/workflow.
11. Completion must occur through the matching service workflow, not through a generic status edit.

### 9.3 Booking status model

Normal states:

- pending
- confirmed
- completed
- cancelled

Allowed ordinary transitions:

- pending to pending, confirmed, or cancelled.
- confirmed to confirmed or cancelled.
- confirmed to completed only inside the matching service-completion workflow.
- completed remains completed.
- cancelled remains cancelled.

The generic booking-status endpoint rejects a request to mark a booking completed. This prevents an appointment from appearing clinically complete without its diagnosis, grooming completion, boarding completion, or corresponding billing context.

### 9.4 Admin review and confirmation

Admin can:

- Inspect booking details and submitted concern files.
- Review service and pet information.
- Verify or reject relevant payment proof.
- Confirm or cancel a pending booking.
- Reschedule allowed bookings.
- Transfer an eligible pending booking to another branch.
- Receive a confirmed booking into the correct operational workflow.

Confirmation repeats critical checks instead of trusting the original browser state. It rejects:

- A non-pending booking.
- A deceased registered pet.
- An inactive or unavailable branch/service.
- Missing required consent.
- Missing or unverified required payment.
- Invalid date/time.
- A daily pet/owner conflict.
- A branch, room, or veterinarian slot conflict.

### 9.5 Scheduling rules

Ordinary clinical services reserve 30 minutes. Home Service and Online Consultation reserve 60 minutes; online starts can be displayed every 30 minutes. Boarding uses room/date-range capacity. Medical bookings reserve an actual vet against the shared cross-clinic/cross-service calendar, including while pending. Editable service-catalog duration does not automatically change these fixed reservation lengths. Procedure-specific people, equipment, travel time, and room scheduling are not a complete resource-planning workflow.

Rescheduling:

- Locks the booking before modification.
- Revalidates the service-specific rules: clinic hours/closures/lunch for on-site/home work, the independent call calendar for online work, and applicable veterinarian/room/service conflicts.
- Does not allow grooming to be rescheduled after the grooming job has moved beyond its early state.
- Preserves the booking identity while recording the new schedule.

### 9.6 Branch relocation

An administrator can relocate an eligible pending booking. The backend:

- Rechecks the destination branch and requested slot.
- Preserves the selected service, stored price, and payment context.
- Records branch-transfer information.
- Notifies the owner and destination branch users when notifications are available.

It is not a generic edit that silently changes any historical/completed booking.

### 9.7 Booking payments

Online Consultation and Home Service can require advance payment evidence. Non-cash references are validated as exactly 18 digits where the workflow requires that format. A proof submission is not the same as a verified payment; administrator review determines whether it can clear the confirmation guard.

The price saved or billed by the backend comes from the active service/special-service catalog and billing rules. A price shown by a frontend projection is informational until the server validates it.

### 9.8 Booking concurrency and failure handling

The program uses combinations of:

- Database transactions.
- Booking row locks.
- Pet/owner daily-subject locks.
- Slot conflict rechecks.
- Named locks for collision-prone operations.
- Duplicate-reference checks.

If the record changes before a decision is written, the server returns a conflict instead of silently overwriting the newer state.

### 9.9 Public-to-login booking handoff and Pet Hotel clinic selection

Landing service actions/calendar selections save an allowlisted one-time destination in tab-scoped storage. Pet-owner login can restore service, date, time, clinic, vet, and selected room size. The intent expires after 30 minutes. Plain login/register actions clear an old intent; staff keep their normal Home destination. This selection does not reserve capacity before booking submission.

The landing Pet Hotel room panel selects a clinic and reloads that branch's room availability. Choosing a room preserves clinic and size through login. The booking form rechecks the actual stay dates; a room count shown on the landing page does not guarantee a reservation.

**Current source cross-reference:** [php/add_booking.php](../php/add_booking.php); [php/update_booking_status.php](../php/update_booking_status.php); [php/booking_availability.php](../php/booking_availability.php#L121); [src/lib/landingBookingIntent.js](../src/lib/landingBookingIntent.js).

## 10. Queue and patient handoff process

### 10.1 Queue entry sources

Queue records identify how they entered the system:

- admin
- self_service
- register
- booking_management

Supported priorities are normal, urgent, and low-test. The priority is operational ordering; it is not a full clinical triage protocol.

### 10.2 Manual Admin queue entry

Process:

1. Admin selects an eligible registered pet or uses the supported queue dialog.
2. The backend checks the branch, service, current clinic availability, pet status, active bookings, and existing active queues.
3. If a manual queue would replace explicit confirmed bookings, the interface must show the affected bookings and receive explicit confirmation.
4. The backend locks and rechecks those records.
5. The queue number is allocated sequentially for the branch and clinic day.
6. A unique queue reference is saved.
7. The queue starts as waiting.

Register, self-service, and booking-management handoffs do not silently cancel unrelated confirmed bookings.

### 10.3 Pet-owner self-service queue

The self-service queue is restricted to authenticated pet owners and the server-defined clinic network.

The access endpoint checks the caller IP against allowed clinic/Wi-Fi addresses configured in the environment. The default addresses are loopback/local development values and must be configured for a real clinic network.

The workflow also requires:

- An owned eligible pet.
- The current branch to be open and queue-enabled.
- A supported available service.
- Veterinarian visit availability where required.
- The required owner signature/consent.
- No existing active queue for the pet.
- No conflicting protected booking state.

This is location/network gating, not strong physical identity proof; clinic Wi-Fi/IP configuration must be maintained correctly.

### 10.4 Queue status model

States:

- waiting
- in-progress
- completed
- cancelled

Normal transitions:

- waiting to waiting, in-progress, or cancelled.
- in-progress to in-progress or cancelled.
- in-progress to completed only through the service/diagnosis completion workflow.
- cancelled cannot be reactivated by the normal endpoint.

A completed clinical queue can be deliberately reopened to in-progress only by the veterinarian who completed that case and only when the diagnosis/assignment checks accept it. This is a controlled correction path, not a general Admin status change.

### 10.5 Admin assignment and Veterinarian My List

Process:

1. Admin views waiting entries in Queue Management.
2. Admin assigns an active veterinarian.
3. The queue is moved to in-progress as the assignment is created.
4. The veterinarian sees approved work and receives an eligible case into My List.
5. An active assignment records the receiving veterinarian.
6. Only that veterinarian can perform veterinarian-only actions on the case.

The assignment records prevent two veterinarians from simultaneously owning the same live case. An Admin can coordinate a locked assignment but cannot impersonate the receiving veterinarian.

### 10.6 Returning and re-entering a queue

Return behavior is source-aware:

- A stale case can be cancelled with a reason and retained in history.
- A queue that came from Booking Management can be returned to its confirmed booking state while the temporary queue is cancelled.
- An ordinary same-day queue can be returned to the veterinarian Approved List.

Re-entry creates a new waiting queue record when no active queue already exists. It preserves relevant source context and notes while creating a new reference/queue number rather than rewriting the old historical record.

### 10.7 Queue completion safeguard

The generic queue-status endpoint rejects direct completion. Clinical completion happens while saving the veterinarian diagnosis so that:

- Diagnosis exists.
- Queue and assignment are completed consistently.
- The related booking can be completed consistently.
- A visit and charges are created or reused.

If any required database write fails inside that transaction, all of those changes roll back.

### 10.8 Pet Intake and assistant physical examination

The Admin Pet Intake workspace matches booking and queue sources, coordinates assignment/consent, and records a physical examination before the veterinarian finalizes diagnosis. Intake stores the complaint, symptoms, major symptoms, physical examination, temperature, heart/respiratory rate, weight, attachments, assigned vet, recording staff identity/position, timestamps, and in-progress/completed state.

Starting intake requires an in-progress queue with a received veterinarian assignment. Existing intake for that queue is reused. Completing the examination requires a saved signed or physical consent document. Where the intake table is installed, diagnosis finalization requires a completed examination assigned to the diagnosing vet. Missing intake deployment is reported by the intake endpoint rather than silently creating its table.

Current access limitation: POST/PATCH verify the Admin's queue branch, but the GET query only adds an assigned-vet condition for veterinarian actors. It does not add an equivalent branch predicate for Admin actors. A branch-scoped frontend list is therefore insufficient to establish branch isolation for direct intake GET requests. This source finding has not been demonstrated against live patient data; see finding SEC-06.

**Current source cross-reference:** [php/add_to_queue.php](../php/add_to_queue.php); [php/assign_queue_vet.php](../php/assign_queue_vet.php); [php/receive_queue.php](../php/receive_queue.php); [php/clinical_intakes.php](../php/clinical_intakes.php#L151).

## 11. Veterinarian diagnosis and clinical completion

### 11.1 Access

The diagnosis API is restricted to Veterinarian and Super Admin roles. For a normal veterinarian, the backend derives the veterinarian identity from the authenticated token and does not trust a different veterinarian ID supplied by the browser.

The backend verifies:

- The queue, booking, and pet identity agree.
- The queue is not cancelled.
- The veterinarian has the relevant assignment.
- The case is in an allowed state.
- Required diagnosis schema is present.
- If clinical intake storage is installed, its examination is complete and its assigned vet matches the diagnosing vet.

### 11.2 General diagnosis mode

The general clinical form can store:

- Service name/context.
- Chief complaint.
- Major symptoms.
- Symptoms and clinical signs.
- Temperature.
- Heart rate.
- Respiratory rate.
- Body weight.
- Physical examination.
- Primary diagnosis.
- Treatment.
- Prescription details.
- Laboratory results.
- Follow-up date/instructions.
- Internal notes.
- Source uploads and diagnosis attachments.

The primary diagnosis is required in general mode.

### 11.3 Custom service diagnosis mode

Custom mode supports one or more active service-catalog blocks. Each block can contain its own findings/symptoms, prescriptions, and attachments. At least one valid active service block is required.

### 11.4 Form validation experience

The diagnosis screens use the shared error-presentation behavior also used by Booking:

- Show a toast explaining the missing or invalid input.
- Mark the relevant field or section.
- Move focus/scroll to the error where appropriate.
- Apply the same approach to ordinary veterinarian diagnosis and online-consult diagnosis.

Important missing values include the primary diagnosis, custom-service selection/details, and vaccination fields when vaccination entry has begun.

### 11.5 Vaccination subrecord

A diagnosis can atomically add a vaccination record. When any vaccination data is supplied, the required set includes:

- Vaccine name.
- Date administered.
- Next due date.

The next due date cannot be earlier than the administered date. The vaccination record can also retain veterinarian/license, notes, and status context.

### 11.6 Attachments and prescription document

Diagnosis can use:

- Concern/signature/consent sources from the originating booking or queue.
- Boarding-related source documents where applicable.
- New diagnosis image/PDF attachments.
- Custom-service attachments.
- Additional signed consent documents.
- A generated prescription PDF when prescriptions exist.

The print/prescription action is only meaningful when prescription information exists.

### 11.7 Atomic save result

The diagnosis transaction:

1. Locks and validates the case.
2. Inserts or updates the one diagnosis associated with the queue.
3. Updates the pet weight when a valid new weight is supplied.
4. Saves the optional vaccination.
5. Creates or reuses the visit.
6. Creates validated charges.
7. Completes the queue.
8. Completes the veterinarian assignment.
9. Completes the related booking where applicable.
10. Commits all database changes.

Notifications for diagnosis availability, queue completion, and invoice readiness are attempted after commit. A notification failure is logged but does not undo the completed medical transaction.

Saving a diagnosis does not mark its invoice paid. Payment requires a real verified payment entry.

### 11.8 Diagnosis history

Veterinarians can browse diagnosis histories and reopen protected files through authenticated media links. Owners obtain allowed clinical content through the organized Medical Records view rather than unrestricted access to every internal field.

**Current source cross-reference:** [php/vet_diagnoses.php](../php/vet_diagnoses.php#L812); [php/vet_diagnoses.php](../php/vet_diagnoses.php#L949).

## 12. Online consultation

### 12.1 Creation

Online consultation is initiated through an online-consultation booking. It depends on:

- Eligible owner/pet.
- Assigned active veterinarian.
- Published veterinarian availability.
- Available date/time.
- Required consent/signature.
- Required payment proof and Admin verification.
- Booking confirmation.

### 12.2 Session states and actions

The online-consultation backend supports session operations to start/join, maintain the scheduled/ready/in-progress state, end the session, and complete the diagnosis.

The owner and assigned veterinarian can access the consultation route; record-level identity checks prevent unrelated owners or veterinarians from joining it.

The video screen uses the configured Jitsi meeting integration. Camera, microphone, supported browser behavior, network quality, and meeting-host availability are external dependencies. The owner can join a confirmed consultation as soon as the assigned veterinarian marks it ready; there is no ten-minute join gate. Completed, cancelled, and no-show sessions reject reopening. The shared VideoCallProvider supports minimizing/restoring a call while navigating and capturing the remote participant when authorized. A successful call does not prove that the clinical record or invoice is complete.

### 12.3 Clinical closure

The online diagnosis uses the same required-field presentation and clinical validation principles as the standard veterinarian diagnosis. Ending a video call alone does not invent a diagnosis or a paid invoice; the clinical and billing records must still be saved through their respective workflows.

**Current source cross-reference:** [php/online_consultations.php](../php/online_consultations.php#L361); [src/context/VideoCallProvider.jsx](../src/context/VideoCallProvider.jsx).

## 13. Medical records and health history

### 13.1 Access model

- Pet owners can read records only for pets they own or co-own.
- Clinic roles can read eligible pet records.
- Only clinic roles can modify organized medical content.
- Owners see only medical-record groups explicitly marked visible to owner.

### 13.2 Aggregated record contents

The Medical Records response can combine:

- Pet identity/profile information.
- Vaccinations.
- Canonical allergies.
- Prescriptions.
- Diagnosis/service history.
- Visit and charge information.
- Boarding history and allowed documents.
- Organized record groups and items.

The organized record system is not just an unfiltered database dump. It lets clinic staff choose which source entries belong in an owner-visible group.

### 13.3 Clinic actions

Authorized clinic users can:

- Create, update, reorder, and delete record groups.
- Set the group title, summary, revision notes, and owner visibility.
- Add an existing source record to a group.
- Remove a source item from a group.
- Add or remove vaccination records.
- Add or remove allergy records.

Adding an item stores a source snapshot for historical presentation and prevents the same source item from being duplicated in the same group.

### 13.4 Owner email copy

An owner can request an email copy of organized, owner-visible records. The copy is sent to the authenticated requesting co-owner’s own account email.

Private diagnostic images and internal-only attachments remain protected in the application and are not automatically exposed merely because a text record is emailed.

### 13.5 Allergy handling

The program supports canonical allergy records with legacy synchronization/import behavior and audit/verification metadata when the required migration exists. Duplicate records are guarded.

### 13.6 Change notifications

Changes to owner-visible groups/items can notify owners. Notification delivery is supplementary: the database change remains the authoritative record even if a later email or push attempt fails.

### 13.7 Issued prescriptions and medication checklists

Veterinarian workflows can issue prescriptions from a saved diagnosis or the pet EMR. A new additional prescription is independent: it does not replace an earlier issued course, cancel its pending doses, or restart its medicines. Repeated submission of the same draft is deduplicated. Issued directions are immutable; the former amendment action is rejected. Reopening a diagnosis preserves its issued medicines.

Medication schedules support times per day, interval hours, weekly, monthly, and as-needed directions. Owners of the pet and authorized clinic roles can start eligible items and record scheduled doses as Taken, Skipped, or Pending. Starting scheduled medicine generates occurrences. Start/checklist changes lock the relevant plan/items; the records retain their action history.

The Active view includes medicines awaiting start and unfinished courses. A scheduled medicine moves to History when all its scheduled doses are Taken or Skipped. This describes checklist resolution, not proof every dose was taken. Pending/missed doses retain active work, and correcting a dose to Pending restores the item to Active. Completing one medicine does not hide another unfinished medicine. As-needed items create no artificial dose schedule and have an explicit Mark finished action after starting. Stopped/superseded legacy plans retain history and reject checklist changes.

Dose tasks can appear in the owner's schedule. This is a recording/reminder aid; it does not verify administration, check drug interactions, dispense controlled drugs, or automatically diagnose the patient. The existing prescription schedule migration must be installed. See [prescription workflow](prescription-workflow.md).

**Current source cross-reference:** [php/pet_medical_records.php](../php/pet_medical_records.php); [php/prescriptions.php](../php/prescriptions.php#L214); [php/prescription_helpers.php](../php/prescription_helpers.php#L316); [src/components/shared/PrescriptionPlanPanel.jsx](../src/components/shared/PrescriptionPlanPanel.jsx).

## 14. Paid pet-record update requests

### 14.1 Owner submission

An owner can request a controlled correction or update for an owned pet. The current configured request fee is PHP 200.

Submission includes:

- Pet.
- Requested changes/reason.
- Payment method.
- Transaction reference/proof when applicable.

The payment method must be enabled. Non-cash transaction references use the current 18-digit validation. A proof can move payment to submitted; it does not automatically make it verified.

Only one non-closed request is allowed for the same pet and owner. The pet row and active requests are locked during creation to prevent duplicate simultaneous submissions.

### 14.2 Request states

- pending_admin_review
- approved
- rejected
- assigned
- in_progress
- completed
- cancelled

Payment states:

- pending
- submitted
- verified
- waived
- rejected

### 14.3 Admin actions

Admin can:

- Verify a submitted payment.
- Waive or reject payment through allowed edits.
- Approve the request.
- Reject it.
- Assign an eligible active veterinarian.
- Update administrative notes.

Approval, assignment, start, and completion require payment to be verified or waived.

Generic update is deliberately limited. It cannot bypass the named workflow action to change request status, assignment, or verify payment.

### 14.4 Veterinarian actions

The assigned veterinarian can:

- Accept/continue their own assignment where allowed.
- Start the request.
- Make the requested pet or medical-record correction using the normal protected editors.
- Add veterinarian notes.
- Complete the request.

Completion requires veterinarian evidence/notes. When snapshot support is deployed:

1. A baseline snapshot hash is recorded when the work is assigned/started.
2. Completion computes a new pet/record snapshot.
3. Completion is rejected if no actual record change is detected.
4. The completion snapshot hash and transition event are stored.

### 14.5 Request fail-safes

- Owner scope is checked.
- Every update locks the request row.
- Invalid transitions return conflict/validation errors.
- Closed requests cannot have their payment moved.
- A verified or waived payment cannot be moved back to an uncleared state.
- Only the assigned veterinarian can start or complete.
- Notifications are sent after successful commit.

**Current source cross-reference:** [php/record_update_requests.php](../php/record_update_requests.php#L576); [php/record_update_requests.php](../php/record_update_requests.php#L236).

## 15. Grooming management

### 15.1 Entry into Grooming

An approved grooming booking appears in Admin Grooming. A GET/list request does not create or alter a grooming job. The job is created on the first real save or photo upload and is keyed to the booking so repeated opens do not create duplicates.

Routine grooming bookings are intentionally kept out of the veterinarian clinical Approved List. Veterinarian involvement begins only when a grooming review is requested.

### 15.2 Grooming states

Normal operational sequence:

- scheduled
- checked_in
- in_progress
- ready
- released

Other states:

- vet_review
- transferred
- cancelled
- no_show

A job in vet_review is paused. It can return to the operational workflow only after the assigned veterinarian records a review outcome that permits resume.

### 15.3 Admin grooming actions

The grooming workspace supports:

- Opening an approved grooming booking.
- Recording intake information.
- Confirming owner approval.
- Selecting the service/package.
- Recording an assistant name.
- Checking in.
- Starting grooming.
- Updating the internal work record.
- Uploading and classifying photos.
- Requesting a veterinarian review.
- Confirming work completion.
- Preparing the owner summary.
- Publishing allowed results.
- Recording pickup information; release is completed automatically through verified full POS payment after the job is ready.

When work starts, the backend records the authenticated Admin as the handler. The browser cannot override that identity.

### 15.4 Photos and sharing

The current grooming upload handler accepts before and after photos. Reference/concern material comes from the booking/context rather than a new general concern-photo upload control.

Controls:

- JPG, PNG, and WebP are accepted based on actual MIME content.
- Maximum eight MB per photo.
- One current before photo and one current after photo; re-upload replaces the matching category record/file while preserving its action history.
- Concern photos are never owner-shared.
- An owner can see only their own explicitly shared non-concern photos after publication.
- A veterinarian must satisfy branch access. The media helper allows assigned-review access and also allows ready/released/transferred job photos; this is broader than pending-review-only access.
- Grooming photos use private storage and authenticated delivery.
- Published/closed photo records are locked against ordinary changes.

There is no general grooming-photo delete endpoint in the current workflow.

### 15.5 Veterinarian grooming review

Admin can request review from checked-in or in-progress work by selecting an active branch veterinarian and documenting the concern.

Only the assigned veterinarian can record one of the supported outcomes:

- Resume grooming.
- Stop grooming.
- Recommend consultation.
- Recommend confinement.

Resume/stop/consultation record the review outcome; they do not automatically create a separate clinical diagnosis or consultation booking. Confinement is an explicit exception: it creates or updates linked clinical confinement and billing context, marks the grooming job transferred, and completes its grooming booking. Boarding still handles consent/approval, actual unit placement, and the stay.

### 15.6 Finish, billing, publish, and release

Finishing:

- Requires valid active-catalog service selection and intake/owner approval.
- Starting requires a before photo; finishing requires an after photo.
- Requires explicit completion confirmation.
- Uses or creates the existing visit/invoice context.
- Requires a positive authoritative active-catalog price.
- Produces a neutral default owner summary if needed.
- Does not mark the invoice paid.

When ready, service and pricing details are locked. Generic manual status changes to released are rejected. The linked visit must become fully paid through verified POS payments; the billing helper then releases the job and completes linked grooming booking/queue records. It fills pickup confirmation and a default collector identity from the owner/staff context. Physical collection must still be checked by clinic staff; payment-driven flags are not independent evidence that the pet was actually collected.

Publishing exposes only the intended package/add-ons, owner summary, and selected shareable photos. Internal notes, audit details, and the private review concern remain hidden.

### 15.7 Concurrency protection

Grooming jobs carry a version value. Updates use optimistic concurrency; a stale editor receives HTTP 409 and must reload instead of overwriting someone else’s newer work.

### 15.8 Current grooming limitations

- No dedicated groomer employee roster/capacity scheduler was found.
- The assistant field is a name field, not a verified personnel assignment.
- Itemized grooming add-on billing and automatic inventory consumption are not a complete dedicated grooming subsystem.
- Veterinarian review is not a substitute for a formal diagnosis.

**Current source cross-reference:** [php/grooming.php](../php/grooming.php#L156); [php/grooming.php](../php/grooming.php#L239); [php/grooming_upload.php](../php/grooming_upload.php#L11); [php/visit_billing.php](../php/visit_billing.php#L945).

## 16. Boarding and Pet Hotel management

### 16.1 Room configuration

Admin can manage branch-specific:

- Room types.
- Individual units.
- Capacity/context.
- Room status.

Room states include available, reserved, occupied, maintenance, and retired. Maintenance and retired units are excluded from ordinary availability.

### 16.2 Booking-to-room assignment

Process:

1. A Boarding/Pet Hotel booking is submitted and approved through Booking.
2. Admin opens Boarding Management.
3. The system checks the booking, dates, branch, signed consent, pet, and room availability.
4. Admin reserves/assigns an eligible unit.
5. At arrival, Admin checks the pet in and the assignment becomes occupied.
6. During the stay, staff record observations, tasks, documents, and material usage.
7. Staff can set the desired checkout and review overstay/billing.
8. Checkout validates the operational and billing context and closes the assignment as allowed.

### 16.3 Direct walk-in boarding

Admin can create a direct check-in where the program permits it. The flow requires a valid pet/owner context, room/date availability, and a completed signed/uploaded Boarding consent PDF.

Direct check-in does not bypass capacity or document checks.

### 16.4 Consent protection

Boarding consent is bound to its booking/owner/pet context. The backend:

- Normalizes signed and physical document paths.
- Acquires a document-specific lock.
- Searches existing booking and consent-record references.
- Rejects reuse when the document is already connected to a different booking, owner, or record.

This prevents one uploaded signed PDF from being reused as proof for unrelated boarding.

### 16.5 Room collision protection

Availability excludes overlapping reserved/occupied assignments. Reservation/check-in uses transactions, row locks, and named locks so two administrators cannot allocate the same unit for overlapping dates.

A cancelled booking cannot be assigned or checked in. An occupied assignment cannot simply be returned to reserved by an invalid generic state edit.

### 16.6 Monitoring

Boarding observations can include:

- Appetite.
- Water intake.
- Elimination.
- Behavior.
- Temperature.
- Weight.
- Severity.
- Whether veterinarian review is required.
- Notes and timestamp/author context.

Boarding tasks have task type, due time, notes, assignee context, and pending/completed handling. Relevant owner-facing tasks also appear in the owner’s Schedule/TODO view as read-only clinic-generated items.

Protected boarding documents can be uploaded and associated with the stay.

### 16.7 Materials and billing

Staff can record inventory material usage against the boarding assignment. The usage:

- Links to the inventory item and stay.
- Records quantity and billing context.
- Uses an idempotent client reference where supplied.
- Can be removed/voided only through allowed rules.
- Retains historical trace instead of silently erasing the event.

Before a Boarding invoice is considered complete, billing checks recorded material usage and overstay details. Overstay uses expected checkout, overdue days, and the configured daily rate.

### 16.8 Boarding dependencies

Structured observations, tasks, room controls, consent records, and material traceability require their current database migrations. Missing integrity-critical schema produces a deployment error rather than a partial write.

### 16.9 Clinical confinement from diagnosis or grooming review

A veterinarian can recommend confinement from a saved diagnosis or the assigned grooming review. The clinical helper requires an identified visit, pet, owner, vet, branch, one source case, reason, facility/room size, expected discharge after today, and an active Boarding price. It prevents overlapping stays and reuses the source-linked confinement when allowed.

The recommendation creates a pending boarding admission with source diagnosis/grooming/visit references, owner approval pending, care instructions, expected dates, and a linked boarding charge on the original clinical/grooming visit. Settled invoices cannot be silently repriced through the recommendation editor. Admin then manages approval, consent, reservation/check-in, monitoring, materials, billing, and checkout in Boarding.

This records a clinical recommendation and operational stay. It does not establish ICU staffing, emergency spending authority, DNR, abandonment, or end-of-life governance. `DDL/20260923_01_clinical_confinement.sql` is required.

**Current source cross-reference:** [php/boarding_management.php](../php/boarding_management.php#L469); [php/clinical_confinement_helpers.php](../php/clinical_confinement_helpers.php#L76); [src/components/AdminDashboardsComponent/PetBoardingManagement.jsx](../src/components/AdminDashboardsComponent/PetBoardingManagement.jsx).

## 17. Service catalog and owner-facing services

### 17.1 Catalog management

Admin can:

- List and search service-catalog entries.
- Create a service.
- Edit service type, name, description, price, duration, and active state.
- Configure default materials.
- Deactivate a service.
- Permanently delete a service when reference rules allow it.

Negative prices are rejected. Pricing used by booking and billing is resolved on the server.

### 17.2 Service material presets

Each service can have up to 100 material presets. A preset records:

- Linked active inventory item.
- Quantity.
- Billing policy: included, separate, or optional.

Duplicate material links are rejected. Quantity must be positive, and batch-counted linked items require whole-number quantities.

If the service-material storage is incomplete or incompatible, the API returns service information in a protected/read-only manner and pauses material editing instead of overwriting unknown data.

### 17.3 Special Services

Admin can manage special-service offerings with:

- Generated/unique service code.
- Title and details.
- Price label and authoritative base price.
- Duration.
- Maximum pets.
- Display order.
- Active state.
- Optional single-date or date-range restriction.

Owners can view active offerings and book them when their restrictions and branch availability permit.

### 17.4 Service display settings

Service display settings control owner-facing descriptions, inclusions, duration labels, prices/instructions, and selected operational display values. Current service child pages expose edit modals to Admin/Super Admin. All roles can read active settings; mutations are protected. These settings do not override backend booking, catalog, or billing validation, including fixed booking durations. The older Booking Management display-settings block is not the current editing location.

**Current source cross-reference:** [php/service_catalog.php](../php/service_catalog.php); [php/service_display_settings.php](../php/service_display_settings.php); [php/special_services.php](../php/special_services.php); [src/components/PetOwnerDashboard/ServicePageLayout.jsx](../src/components/PetOwnerDashboard/ServicePageLayout.jsx).

## 18. Inventory management

### 18.1 Inventory records

The inventory module stores and presents:

- SKU.
- Item/product name.
- Category/material type.
- Brand.
- Supplier.
- Unit.
- Reorder level.
- Expiry warning days.
- Unit cost.
- Selling price.
- Branch/location.
- Profile image.
- Active state.
- Batches/lots.
- Batch quantity.
- Manufacture and expiry dates.

Computed attention states include:

- expired
- near-expiry
- out-of-stock
- low-stock
- ok

The Inventory page keeps search, filters, pagination, and detail actions. The former summary boxes are represented more compactly in the page header. Near-expiry reporting is hidden on the Reports KPI rail when its value is zero.

### 18.2 Inventory actions

Admin can:

- Create an item.
- Edit item metadata.
- Stock in one or more receipt lines for one branch.
- Stock out an amount.
- Transfer stock between locations within the same branch.
- Remove one or many items from active inventory under strict conditions while retaining report history.
- Open low-stock, near-expiry, and disposal/history views where connected.

### 18.3 Responsibility confirmation

Every inventory mutation requires:

- A responsibility acknowledgement.
- The authenticated account password.
- A reason for stock-out, transfer, inventory removal, and other sensitive edits where requested.

The password is rechecked by the backend. The inventory audit schema is mandatory for protected mutations; if it is not deployed, the write is blocked with a migration-required conflict.

### 18.4 Stock-in

Stock-in:

- Requires supplier information per receipt line.
- Restricts one receipt to one branch.
- Inserts or updates batches under a transaction.
- Records receipt and movement information.
- Can attach a protected proof/receipt image or PDF.

### 18.5 Stock-out and transfer

Stock-out locks the relevant batch and refuses a quantity greater than available stock.

Transfer:

- Requires different source and destination locations.
- Is restricted to the same branch.
- Locks and verifies sufficient source quantity.
- Records paired transfer-out and transfer-in movement history.
- Marks the transfer received according to the current direct transfer operation.

### 18.6 Inventory consumption by billing

Product/service-material charges can consume inventory while charges are saved. The backend:

- Loads the active inventory item.
- Validates allowed quantity.
- Locks affected batches.
- Records stock movement against the visit/charge context.
- Preserves the sale description, quantity, unit price, selling price, and subtotal as billing snapshots.

Reversing mutable charges can return associated stock through the controlled reversal path. Charges become immutable after verified payment or a partial/paid/refunded billing state.

### 18.7 Report-safe inventory removal

Single and bulk removal require password, acknowledgement, branch scope, and reason. The operation:

- Rejects the complete request while any selected item is still required by a service material preset.
- Archives selected products as inactive so they disappear from active inventory and cannot be used in new stock operations.
- Retains product identity, batches, stock receipts, movements, transfers, invoice charges, payments, refunds, and report history.
- Writes one inventory audit entry per selected product and one staff activity entry containing readable product names.

The Inventory Status report reflects current active inventory and therefore excludes archived products. Historical movement and financial reports retain them. There is no restore control in the active application yet, so removal still requires deliberate confirmation.

### 18.8 Inventory limitations

- Admin access is branch-scoped.
- Product cost and current catalog price do not rewrite historical invoices.
- A zero quantity or inactive item cannot be treated as available.
- Missing audit/integrity schema blocks writes.
- Archived inventory does not currently have a self-service restore control.

**Current source cross-reference:** [php/inventory.php](../php/inventory.php); [php/inventory_invoice_helpers.php](../php/inventory_invoice_helpers.php); [src/components/AdminDashboardsComponent/AllItemsPage.jsx](../src/components/AdminDashboardsComponent/AllItemsPage.jsx).

## 19. Point of Sale, visits, invoices, payments, and refunds

### 19.1 Visit/billing context

Admin POS operates on a visit. A visit can be linked to:

- Queue.
- Booking.
- Diagnosis.
- Boarding assignment/material usage.
- Grooming.
- Online consultation.
- Walk-in sale.

For a walk-in sale, the backend can create or reuse the special Walk-in Counter Sale owner/pet context so every invoice has a valid patient/owner relation without pretending it belongs to a normal registered client.

### 19.2 Identity reconciliation

When a visit is created or reused, the backend compares the pet, owner, veterinarian, queue, booking, and diagnosis sources. It rejects conflicting owners or patient identities rather than choosing one silently.

### 19.3 Charges

Charge types include services and products/materials. A charge records:

- Description snapshot.
- Quantity.
- Unit/selling price snapshot.
- Subtotal.
- Catalog or inventory source where applicable.
- Visit and source context.

Required separate service materials are expanded according to the service preset. Included, separate, and optional policies are handled distinctly.

Charges cannot be replaced after verified money exists or the visit is partial, paid, or refunded. A cancelled or refunded visit also rejects inappropriate new charge changes.

### 19.4 Billing states

The backend recalculates billing status from total charges, verified payments, and processed refunds:

- unbilled
- unpaid
- partial
- paid
- refunded

Clinical completion never sets paid by itself.

### 19.5 Payments

Admin can post a payment using enabled payment methods such as Cash, QRPH, GCash, Maya, or Bank Transfer, depending on deployed settings.

Controls:

- Amount must be valid for the visit.
- Non-cash transaction number is exactly 18 digits where required.
- Transaction reference uniqueness is checked.
- Relevant proof/review state must be valid.
- Visit and existing payment rows are locked.
- Duplicate verified requests return the existing valid result rather than double-posting where the idempotent reference path applies.

Payment submissions and final visit payments are distinct records. Submission states can include submitted, under_review, verified, rejected, refunded, and voided according to the payment-review workflow.

### 19.6 Refunds

The backend exposes visit-payment and booking-payment refund handlers with audited processing. The current POS component has no Record Refund action; the older role guide explicitly described that action as hidden. Backend support must not be presented as a complete staff-accessible refund UI or automatic provider refund.

Refund processing:

- Requires an eligible verified/refunded payment.
- Requires an amount that does not exceed the remaining refundable balance.
- Requires a reason.
- Validates an 18-digit non-cash refund transaction reference where applicable.
- Locks payment and prior refund records.
- Stores a processed refund record rather than deleting the payment.
- Updates the related submission/payment state.
- Recalculates visit billing status.

Processed and voided refund records form an audit history.

### 19.7 Invoice and receipt

The frontend can produce an official invoice/receipt with clinic identity, invoice number, date, source reference, pet, owner, veterinarian/counter, line items, quantity, prices, and total.

The invoice-document workflow can also:

1. Generate the PDF.
2. Upload it as an invoice_document; this type accepts PDF only.
3. Validate that the file exists in protected runtime storage.
4. Save its visit, payment, pet, file path, filename, MIME type, paper width, and generator context in visit_invoice_documents.
5. Reuse or return stored invoice documents for later viewing.

This stored PDF is the appropriate durable “copy of the receipt/invoice” for Pet Files & Media because it preserves the rendered paper and can be viewed or downloaded without recreating it from changed catalog data.

The feature requires DDL/20260819_01_invoice_pdf_documents.sql and working private media storage.

**Current source cross-reference:** [php/visit_billing.php](../php/visit_billing.php#L945); [php/booking_payment_refund.php](../php/booking_payment_refund.php); [src/services/visitBillingService.js](../src/services/visitBillingService.js#L25); [src/components/AdminDashboardsComponent/POSmanagement.jsx](../src/components/AdminDashboardsComponent/POSmanagement.jsx).

## 20. Payment-method administration

All authenticated roles can read enabled payment instructions needed for their workflow. Only Super Admin can change payment settings.

Changes require:

- A six-digit OTP issued for payment_settings_change.
- The OTP to belong to the same authenticated Super Admin.
- Valid method key/type/instructions.
- Valid active state.
- Valid uploaded QR/image path when used.
- Reference checks before an in-use method is deactivated.

Sensitive account details are encrypted using a server secret that must be at least 32 characters. If the secret, OTP migration, or required payment schema is missing, updates fail.

**Current source cross-reference:** [php/payment_methods.php](../php/payment_methods.php#L160); [php/payment_methods.php](../php/payment_methods.php#L418).

## 21. Consent Form Management

### 21.1 Consent templates

Admin can:

- Upload/create a consent template.
- Name and categorize it.
- Store its template content.
- Assign it to one or more allowed pet-owner workflow contexts.
- Edit its name, category, content, and contexts.
- Delete it when the current management operation permits.

Only one active template can own a context that must be unique. The backend normalizes context assignments and rejects conflicts.

Template create, update, and delete operations can generate Super Admin governance notifications.

### 21.2 Consent records

Consent-form records preserve a particular use of a template. A record can be associated with:

- Owner.
- Pet.
- Booking.
- Queue.
- Visit.
- Template/type.
- Source.
- Signed or physical PDF path.
- Signed/released timestamps.
- Notes.

Allowed consent-record statuses:

- pending
- signed
- released
- cancelled

Allowed sources include booking, queue, vet_my_list, diagnosis, and manual.

### 21.3 Digital and physical documents

The application distinguishes:

- A generated/signed consent PDF.
- An uploaded physical completed PDF.
- A legacy signature-only image.

A signature image alone is not automatically promoted to a completed signed document when a proper signed PDF path is absent. Booking consent normalization preserves this distinction.

### 21.4 Consent safeguards

- Consent-document upload accepts PDF only.
- The upload issues a short-lived receipt bound to user/type/context details.
- Document paths are normalized.
- A document-specific database lock is acquired during binding.
- Existing booking and consent-record references are checked with row locks.
- Reuse across a different owner, pet, booking, or record is rejected.
- Owner access to the protected file is checked against an owned booking/queue/record.
- Missing consent schema blocks the operation with deployment guidance.

Consent management records agreement evidence. It is not a legal guarantee by itself; clinic policy must still define retention, withdrawal, versioning, and signature acceptance requirements.

**Current source cross-reference:** [php/consent_form_records.php](../php/consent_form_records.php); [php/consent_record_helpers.php](../php/consent_record_helpers.php); [php/upload_receipt_helpers.php](../php/upload_receipt_helpers.php).

## 22. Notifications, reminders, and Schedule/TODOs

### 22.1 Notification center

Each authenticated user can:

- View notifications.
- Filter active/history scopes.
- Page through results.
- Read one notification.
- Mark all as read.
- Open the route connected to an event.
- Review unread/category counts.
- Change notification preferences.

The API limits page size to prevent unbounded notification responses.

### 22.2 Notification categories

The notification system covers operational events such as:

- Booking submission, confirmation, reschedule, cancellation, and reminders.
- Queue waiting, assignment, return, cancellation, and completion.
- Diagnosis/medical-record availability.
- Payment, invoice, and refund events.
- Ownership/co-parent requests and decisions.
- Record-update request events.
- Boarding and grooming events.
- Consent-template governance.
- Account/profile governance.
- TODO reminders.

Exact delivery depends on both event type and user preferences.

### 22.3 Delivery channels

Supported channels:

- In-app notification.
- Email.
- Browser push.

In-app records are the primary application notification history. Email and push are additional delivery attempts.

General email notifications can be queued. A worker/cron process must process that queue; otherwise messages remain pending. Failed delivery attempts are recorded/retried according to the mail-queue logic.

Browser push requires the deployment dependencies described in section 3.6.

### 22.4 Notification transaction behavior

Operational database transactions commit before non-critical delivery is attempted. If email, push, or a secondary notification fails:

- The booking, diagnosis, payment, or other main action stays committed.
- The failure is logged.
- Delivery can be retried where the queue supports it.

Event dedupe keys reduce repeat notifications from idempotent or repeated operations.

### 22.5 Reminder runner

The reminder route is public at the route-policy layer so a scheduler can call it, but the handler requires the configured reminder secret/key. It creates due booking/TODO reminders using user preferences such as 24-hour, two-hour, and same-day timing.

If the secret or scheduled caller is not configured, automatic reminders should not be assumed to run.

### 22.6 Schedule/TODO aggregation

The Schedule/TODO API is available to pet owners, veterinarians, and Super Admin.

For a pet owner it aggregates:

- Pending/confirmed bookings.
- Boarding stays.
- Personal custom tasks.
- Diagnosis follow-up dates.
- Unpaid/partial visit balances.
- Boarding-care tasks relevant to their booking.
- Prescription medication occurrences where the schedule schema is available.

For a veterinarian it aggregates:

- Personal custom tasks.
- Assigned pending/confirmed medical bookings within the selected range, including clinic visits, home visits, and online calls.
- Diagnosis follow-up recording tasks.

The vet calendar uses actual assigned appointments and counts each booking once. My List focuses on today in Philippine time; a read-only next-booked-day preview can show the next future approved appointments without starting their diagnosis early. It does not invent recurring clinic-shift tasks.

Clinic-generated items are read-only and link to their source screen. Personal tasks are editable.

### 22.7 Personal TODO actions

Users can:

- Create a personal task with title and start date.
- Add details, category, and optional end date.
- Update their own personal task.
- Mark it pending, completed, or cancelled.
- Delete their own personal task.

Required schema is checked. A user cannot edit another user’s tasks. Admin-like cross-user access is limited to the effective-user rules in the handler, and the route itself is not available to ordinary Admin.

**Current source cross-reference:** [php/notifications.php](../php/notifications.php#L47); [php/mail_queue_worker.php](../php/mail_queue_worker.php); [php/pet_owner_todos.php](../php/pet_owner_todos.php#L387); [php/pet_owner_todos.php](../php/pet_owner_todos.php#L586).

## 23. Reports Dashboard and Report Center

### 23.1 Access and date handling

Reports are restricted to Super Admin at the backend.

Quick ranges:

- Today.
- This Week.
- This Month.
- This Quarter.
- This Year.
- Custom.

Date calculations use Asia/Manila. Invalid dates and a start date after the end date are rejected. Branch filtering is available where the report supports it. Financial reports intentionally use all payment methods rather than allowing a filter that could hide part of the financial total.

### 23.2 Current dashboard design and interaction

The current Reports Dashboard:

- Uses a compact horizontal KPI rail with previous/next controls inside the allocated area.
- Hides Total Paid Amount and Total Unpaid Balance from the visible KPI list.
- Hides Near Expiry Items when its value is zero.
- Removes comparison text containing “versus prior” while retaining concise supporting text where supplied.
- Lets a connected KPI switch the relevant graph or open its target screen/table.
- Presents one active trend/performance chart and one active distribution/mix chart.
- Provides previous/next buttons for both chart groups.
- Rotates each graph group every 15 seconds while the tab is visible.
- Keeps the page position stable when normal graph rotation/switching occurs.
- Animates chart entrance and progressive line drawing unless reduced motion is preferred.
- Shows Sales Trend service/material details only when a data point is clicked, not merely hovered.
- Displays the selected sales point’s Services Sold and Materials Sold in a scrollable details panel.
- Removes billing summary/attention tables from the visible dashboard.
- Keeps inventory attention below the charts and allows scrolling instead of shrinking every graph to an unreadable size.
- Lets inventory-attention rows open the corresponding Inventory item context.

The data API can still return more KPIs/charts/tables than the current visual dashboard chooses to display.

### 23.3 KPI and chart data

The server builds operational indicators and datasets from available bookings, queues, visits, consultations, inventory, boarding, consent, and other supported tables. Chart families include revenue/sales, appointment/queue activity, consultations, boarding, services/products, veterinarian activity, animal distribution, billing mix, and inventory alerts.

The current UI cycles through these datasets rather than rendering every chart simultaneously.

### 23.4 Report Center types

The current Report Center exposes 15 report types:

1. Sales Report.
2. Billing Report.
3. Invoice and Receipt Report.
4. Service Utilization Report.
5. Appointment Report.
6. Queue Report.
7. Consultation Report.
8. Follow-Up Check-Up Report.
9. EMR Request Report.
10. Inventory Status Report.
11. Stock Movement Report.
12. Medicine/Product Sales Report.
13. Confinement and Pet Hotel Report.
14. Consent Form Report.
15. Veterinarian Activity Report.

Categorized Pet Cases Report is not in the current report-type list.

### 23.5 Report generation and exports

Generated reports can include:

- Selected date/branch filters.
- Summary values.
- Comparison information for supported standard ranges.
- Totals.
- Detailed data rows.
- Missing-data notices.
- Generator name/time.

Exports:

- Printable browser view.
- PDF through jsPDF/autotable.
- Excel workbook through ExcelJS.

Generating a report can create a governance notification.

An exported report is a business report, not a database backup. It cannot restore application records, relationships, passwords, files, or transaction history.

### 23.6 Missing-data behavior

Report handlers check which tables/columns exist. If a source is unavailable, the response includes missing_data notes and omits unsupported data rather than substituting invented values.

This makes partial reporting understandable, but it also means a report can be technically generated while incomplete. The missing-data notice must be reviewed before relying on totals.

### 23.7 Staff Activity Log and printable governance history

Admin, veterinarian, and Super Admin profiles expose personal activity history. Super Admin also has a dedicated `/dashboard/activity-log` page with printable organization-wide history. This is separate from the 15 business report types above.

Successful authenticated staff mutations through the controller are appended to per-user JSONL files, with the relative file reference stored on `users.activity_log_file`. Reads authorize the actor: staff can read their own actions; only Super Admin can request another user or the all-users scope. Current API filters expose major operational modules: inventory, bookings, queues, POS, medical-record updates, diagnosis, and online consultations. The retained `/activity/view` POST returns `recorded: false`; it is not proof of current page-navigation tracking.

Rows can show actor/role, timestamp, module/action, safe patient/product context, branch, record reference, method/normalized route, successful response, selected operational changes, and planned/not-planned state. Detail capture is allowlisted and excludes credentials, password hashes, access tokens, contact details, payment references, attachment paths, and diagnostic content. Selected operational reasons are retained for supported workflows. The interface filters by module/time and, for Super Admin, user/role/branch; the API also accepts a planning filter. Pagination supports up to 250 rows per request. Quiet periods are derived from timestamps, not staff-attendance measurements.

The schema column and persistent writable private file storage are required. History starts when deployed; logging failure is logged and does not undo a committed clinic action. Files are not a tamper-proof ledger, failed attempts are outside the successful-mutation feed, and filtered views are not an exhaustive security/access log. See [activity history](staff_activity_history.md).

**Current source cross-reference:** [src/services/reportService.js](../src/services/reportService.js#L57); [php/reports_common.php](../php/reports_common.php#L785); [php/staff_activity.php](../php/staff_activity.php#L46); [src/components/SuperAdminDashboardComponent/SuperAdminActivityLog.jsx](../src/components/SuperAdminDashboardComponent/SuperAdminActivityLog.jsx).

## 24. Pet Files & Media Monitoring

### 24.1 Access

Pet Media Monitoring is available to Veterinarian and Super Admin. It requires a selected pet and date range.

### 24.2 Aggregated media

The monitor can collect image/PDF references from:

- Consent records.
- Booking concern files.
- Booking signatures/consent documents.
- Queue concern/signature files.
- Diagnosis attachments.
- Diagnosis source uploads.
- Custom-service attachments.
- Generated prescription PDFs.
- Boarding documents.
- Stored invoice/receipt PDFs.

Results are deduplicated by pet and URL and grouped/countable by source. Unsupported file types are not presented as monitored media.

### 24.3 Stored invoice copy

When a visit invoice PDF has been saved in visit_invoice_documents, it is included as Pet Files & Media source material for the relevant pet. This is the implemented connection for retaining the receipt/invoice paper as a viewable PDF.

### 24.4 Monitoring restrictions

- The endpoint does not return all pets’ files without a selected patient.
- Date range is required.
- Missing source schema is reported.
- A listed protected URL still passes authenticated media access when opened.
- Monitoring does not bypass owner, veterinarian, or clinic media rules.

**Current source cross-reference:** [php/pet_media_monitoring.php](../php/pet_media_monitoring.php); [src/components/SuperAdminDashboardComponent/PetMediaMonitoring.jsx](../src/components/SuperAdminDashboardComponent/PetMediaMonitoring.jsx).

## 25. Upload and protected-media handling

### 25.1 Upload permissions

Upload types are role-specific.

Pet Owner can upload:

- User/profile image.
- Pet image.
- Booking signature.
- Booking payment proof.
- Booking concern.
- Consent document.

Veterinarian can upload:

- User/profile image.
- Booking signature/concern.
- Diagnosis files.
- Consent document.
- Prescription document.

Admin and Super Admin can additionally upload:

- Pet image.
- Payment QR.
- Boarding document.
- Inventory item image.
- Inventory receipt.
- Invoice document.

Grooming photo upload has its own context-specific handler.

### 25.2 Content validation

General upload controls:

- Maximum size eight MB.
- Zero-byte files rejected.
- Executable/script extensions explicitly blocked.
- Actual content MIME is read with fileinfo.
- The stored extension is derived from the recognized MIME, not trusted from the original filename.
- Images allow supported JPG, PNG, GIF, or WebP according to field type.
- Mixed evidence fields can also allow PDF.
- Consent, prescription, and invoice documents are PDF-only.
- Filenames combine sanitized readable context/original-name tokens with timestamp and randomness; the original uploaded filename is never used as an unrestricted storage path.

### 25.3 Runtime storage

The runtime-media root can be configured with IPAWCUS_RUNTIME_MEDIA_ROOT. On suitable local development it falls back to public/. On supported public_html deployment it attempts to keep persistent runtime media outside the Git-managed child deployment.

When creating the root, the program writes an Apache .htaccess that disables indexes and denies direct access. Files are intended to be opened through /api/uploads/media.

If a deployment puts runtime files somewhere directly public and the server ignores Apache .htaccess, that protection can fail. Hosting rules must be verified.

### 25.4 Protected delivery

The media endpoint:

- Requires authentication.
- Rejects empty, traversal, control-character, and overlong paths.
- Allows only known media directories.
- Applies role rules by directory.
- Resolves the real path and verifies it remains inside the allowed root.
- Sets X-Content-Type-Options: nosniff.
- Uses private caching or no-store for Grooming.
- Serves PDFs inline with a sanitized filename.

Owner access to concerns, diagnosis, invoices, payments, and signatures is matched against their own booking, queue, update request, visit, diagnosis, medical-record group, or pet ownership.

Grooming media uses its own publication/ownership/reviewer access decision.

**Current source cross-reference:** [php/upload.php](../php/upload.php#L32); [php/upload_media.php](../php/upload_media.php#L69); [php/runtime_media.php](../php/runtime_media.php).

## 26. Public status display and clinic availability

The public status/TV routes provide a clinic-facing waiting/in-service/upcoming/billing/completed display by branch. The display is designed for queue operations and avoids exposing diagnosis text or complete private medical records.

The public availability endpoints expose only information needed to select an allowed branch/date/time/service. Final booking creation always repeats protected validation.

**Current source cross-reference:** [php/status_display.php](../php/status_display.php); [src/components/StatusDisplay/TVStatusDisplay.jsx](../src/components/StatusDisplay/TVStatusDisplay.jsx); [Subdomain_folder/assets/tv-display.js](../Subdomain_folder/assets/tv-display.js).

## 27. Lifecycle maintenance and operational recovery checks

### 27.1 Automatic lifecycle maintenance

The booking-maintenance code uses Asia/Manila and can:

- Cancel waiting/in-progress queues after their service day ends.
- Return an active veterinarian assignment when a stale queue is cancelled.
- Cancel eligible non-boarding bookings more than seven days overdue.
- Auto-reschedule eligible missed confirmed bookings to a valid later day when no conflict exists.
- Preserve the original booking date in lifecycle notes.
- Notify affected users after successful commit.

Home Service, Online Consultation, Boarding, and Special Services are excluded from generic auto-rescheduling/cancellation paths where their specialized process must decide the outcome.

Maintenance checks whether service actually began through grooming, queue assignment/completion, diagnosis, or a non-cancelled visit before treating a booking as missed.

### 27.2 Per-pet overdue cleanup

The pet overdue endpoint can run the relevant stale queue/overdue booking cleanup for one pet and reports which IDs were cancelled/rescheduled.

### 27.3 Lifecycle recovery report

The Super Admin-only lifecycle recovery report is read-only. It finds:

- Completed queues with a diagnosis but no visit or no charges.
- Completed bookings with a diagnosis but no visit or no charges.

It reports up to the current query limits and marks whether its schema is ready.

It does not repair, restore, or recreate the missing data. “Recovery report” means inconsistency detection, not disaster recovery.

### 27.4 Server-down problem report

The maintenance screen can submit a deliberately limited public problem report. The backend:

- Limits request body size.
- Applies a per-IP temporary-file rate limit.
- Checks required database environment variables.
- Tests PDO MySQL availability and a short database connection.
- Classifies common authentication, database name, host, lost connection, and timeout failures.
- Emails a sanitized diagnostic to the configured maintenance address.
- Excludes credentials, account details, patient information, and medical records.

If the recipient or mail transport is not configured, delivery fails with a clear error.

### 27.5 Section recovery, uncertain writes, and confirmed outages

Error boundaries protect startup/provider, page, section, shared table/card/dialog/sheet, and report-widget rendering. Retry display remounts the failed subtree; independent sibling content and its state can remain usable. State inside a remounted failed subtree may be lost. Reload remains appropriate for stale assets or failed lazy imports. Boundaries do not automatically catch asynchronous/event-handler failures.

Selected independent GET loaders use `useSectionResource` / `createSectionResource` to distinguish initial load, refresh, valid/stale data, last success, failure, cancellation, and retry. Keys include the relevant user/pet/branch/date scope; obsolete responses cannot publish into a changed scope. Access/missing-resource failures clear protected data. Access, validation, conflict, and missing failures stop automatic polling until explicit recovery or a changed scope. Transient failures follow the auto-refresh backoff.

Booking/queue worklists hide actionable rows after a failed refresh. Inventory items and locations load independently, but stock changes need verified dependencies. Intake keeps booking/queue matching in one required group. Successful independent dashboard sources can remain visible with a recovery notice. A failed source is not reported as a verified zero count or empty list.

API responses must contain readable JSON except intentional HTTP 204. Write requests are not automatically retried. A timeout, lost connection, or unreadable mutation response can mean the server committed without delivering confirmation; the user is told to refresh and inspect the result before submitting again.

Feature failures schedule a shared health probe after a debounce. Two failed probes confirm an outage; only successful health validation clears the shared notice. The notice supports manual checks and periodic recovery checks without replacing healthy content. The standalone TV display also has timeout, stale/unknown, retry, and backoff handling.

This is implemented recovery behavior, not offline operation or a repair mechanism for invalid business records. Only selected loaders use the resource abstraction; other screens retain their own request handling plus rendering boundaries. The October 16 guide records 51 browser fault checks using synthetic intercepted responses, not every real role transaction. See [error isolation](error_isolation.md).

**Current source cross-reference:** [php/booking_maintenance.php](../php/booking_maintenance.php#L9); [php/lifecycle_recovery_report.php](../php/lifecycle_recovery_report.php); [src/services/serviceHealth.js](../src/services/serviceHealth.js#L3); [src/lib/sectionResource.js](../src/lib/sectionResource.js); [src/lib/errorPolicy.js](../src/lib/errorPolicy.js#L7).

## 28. Cross-cutting restrictions and fail-safes

| Risk | Current handling | Remaining caution |
| --- | --- | --- |
| Unauthenticated API access | Protected routes require a valid unexpired, unrevoked token | Token can also be accepted in URL query; prefer Authorization header |
| Wrong role | php/role_access.php checks every active API route | Some frontend path patterns are broader than intended navigation |
| Owner reading another owner’s data | User-ID, pet-ownership, booking, queue, record, and media checks | Every new endpoint must add record-level checks, not just role checks |
| Admin operating another branch | Branch-aware handlers verify user assignment | Confirm every future branch-sensitive handler calls the same guard |
| User-supplied actor identity | Clinical and sensitive actions derive actor from token | Avoid adding endpoints that trust user_id from JSON |
| Duplicate booking or queue | Daily conflict checks, active-queue checks, row/named locks | Busy production behavior still needs concurrency testing |
| Invalid status jump | Booking, queue, record-request, grooming, boarding, and billing validators | Special correction/reopen paths must remain narrow |
| Direct clinical completion | Generic booking/queue completion rejected | Completion must remain connected to diagnosis/service workflow |
| Partial diagnosis completion | Diagnosis, visit, charge, queue, assignment, and booking saved transactionally | Email/push happens after commit and can fail separately |
| Room double allocation | Availability query plus transaction/row/named locks | Depends on all room migrations and correct date data |
| Overselling inventory | Batch locks and available-quantity checks | Concurrent load testing is still recommended |
| Editing paid charges | Charge mutation blocked after verified/partial/paid/refunded state | Corrections must use refund/reversal policy, not direct SQL |
| Duplicate payment/refund reference | Exact-reference validation and row locks | Cash/reference policy still needs operational reconciliation |
| Reusing signed consent | Document-path lock and cross-context reference checks | Hosting must prevent direct unauthorized file access |
| Dangerous upload | Role/type allowlist, size, extension and MIME checks, randomized name | Antivirus/malware scanning is not present |
| Path traversal | Normalization, allowed directories, realpath containment | Web-server direct-access rules must be verified |
| Stale concurrent Grooming editor | Version check returns 409 | User must reload and reapply intended changes |
| Duplicate record-update request | Pet and active-request rows locked | Manual database edits could bypass application rules |
| Completing record request without a change | Baseline/completion snapshot hashes when schema supports them | Without the snapshot migration, evidence is mainly notes/workflow |
| Missing schema | Many integrity-critical modules fail closed with migration guidance | Reports may remain partially available and disclose missing_data |
| Notification failure | Main action commits; delivery error is logged/retryable | Users may not receive external notification |
| Hidden browser tab refresh load | Auto-refresh pauses and resumes on visibility | Very large datasets still need server pagination |
| Transient network/API outage | Local request recovery, read retry/backoff, confirmed health notice; writes are not auto-retried | An uncertain write must be checked before resubmission; offline private operations are not supported |
| Sensitive form draft | Password/payment/signature/upload fields excluded | Browser/session storage remains a device-local concern |
| Accidental inventory removal | Password, acknowledgement, reason, reference check, report-safe archival, audit | Archived inventory has no self-service restore control |
| Archived user access | Status is returned for administrative display | Archive does not currently block login or existing token use |

**Current source cross-reference:** [php/role_access.php](../php/role_access.php#L424); [php/workflow_guard_helpers.php](../php/workflow_guard_helpers.php); [src/services/apiClient.js](../src/services/apiClient.js).

## 29. Configuration and deployment dependencies

The following checklist determines whether source-level capabilities work on a deployed server.

### 29.1 Required base services

- Supported PHP runtime.
- PDO MySQL extension.
- MySQL database and current schema.
- Correct DB_HOST, DB_PORT, DB_NAME, DB_USER, and DB_PASSWORD.
- Writable runtime-media location.
- Correct frontend API base URL.
- Production HTTPS.

### 29.2 Authentication and security settings

- api_access_tokens migration.
- email_otp_tokens and users.email_verified_at migration.
- OTP_SECRET, or the deliberately configured fallback.
- VITE_MASTER_KEY for operations that intentionally require it.
- Payment encryption secret of at least 32 characters.
- Correct CORS/host policy.
- Google identity/onboarding migration, matching Google client IDs, trusted frontend origins, and installed verifier when Google sign-in is enabled.

### 29.3 Messaging

- SMTP configuration.
- Mail queue schema.
- Scheduled mail worker.
- Reminder runner secret and scheduler.
- VAPID public/private configuration for push.
- Service worker and HTTPS.

### 29.4 Operational schema families

The deployment must include the current migrations for:

- Branches, assignments, hours, closures, and service availability.
- Booking expansion, branch transfer, payments, and consent.
- Queue assignment and lifecycle controls.
- Veterinarian diagnoses, vaccination, medical-record groups, and allergies.
- Online consultations and schedules.
- Visits, charges, payments, payment submissions, and refunds.
- Invoice PDF documents.
- Record-update requests, transition events, and snapshots.
- Service catalog and service material presets.
- Inventory batches, locations, receipts, movements, transfers, audit, and selling price.
- Grooming management.
- Boarding rooms, assignments, observations, tasks, documents, materials, and overstay fields.
- Notifications, preferences, email queue, push subscriptions, and TODOs.
- Admin feature permissions.
- Clinical intake, shared veterinarian clinic preferences, clinical confinement, medical certificates, and prescription schedules/events.
- Staff activity file-reference column and system-backup audit metadata.

### 29.5 File storage

- Set IPAWCUS_RUNTIME_MEDIA_ROOT to a persistent directory for production.
- Confirm the PHP process can create/write required subdirectories.
- Confirm the web server cannot directly serve the private root.
- Confirm protected /api/uploads/media requests reach PHP.
- Confirm uploaded files survive application deployments.
- Provision the configured private grooming-photo directory and staff activity storage with persistent PHP write access.
- Backup export needs its enabled module, audit schema, writable temporary workspace, and the resources to assemble a complete ZIP.

### 29.6 Clinic-specific settings

- Active branches.
- Operating hours and closure dates.
- Per-branch service availability.
- Veterinarian branch assignments, per-clinic booking acceptance, and separate online start selections.
- Veterinarian current-day presence process.
- Clinic network/IP allowlist for self-service queue.
- Active service catalog with authoritative prices.
- Active payment methods and instructions.
- Current consent templates and assigned contexts.

**Current source cross-reference:** [php/config.php](../php/config.php); [scripts/local-api-router.php](../scripts/local-api-router.php); [scripts/deploy-hostinger.mjs](../scripts/deploy-hostinger.mjs).

## 30. Inactive, incomplete, or not implemented

### 30.1 Local backup download and restore limitations

The Super Admin profile provides an active **Download Backup** action. Each request creates a complete ZIP in a unique operating-system temporary workspace, streams it to the browser, and removes the temporary server files after the response ends. The application does not retain a reusable ZIP in the domain or hosting account.

The ZIP contains:

- A complete SQL database recovery source.
- Current uploaded runtime media.
- A readable emergency-operations Excel workbook.
- A package manifest and SHA-256 component checksums.
- Restore instructions.

The `system_backups` table retains audit metadata only: actor, time, result, size, checksum, and coverage counts. Only authenticated Super Admin accounts can start an export or view this history. Browser download settings determine the destination folder on the Super Admin's computer.

The application intentionally does **not** provide:

- Custom scheduled or incremental server backups.
- Retained backup ZIPs on the application server.
- Historical ZIP re-downloads.
- A web-based restore button.
- Point-in-time database recovery.
- Automated media restoration or server-failure self-recovery.

Hostinger's hosting backup remains separate from this local export. A trained IT administrator must perform and test restoration on a clean environment. The Excel workbook supports emergency reading but cannot replace the SQL database recovery source.

The ZIP is not password encrypted and excludes application source, `.env`, database credentials, and previous backup ZIPs. Protect its destination storage. The current ZIP writer requires fewer than 65,536 entries, individual files below 4 GB, and archive offsets below 4 GB. Operational workbook sheets are limited to 250,000 rows; SQL remains the recovery source. Export generation, interrupted-download cleanup, and a complete clean-environment restoration were not re-tested in this revision. See [backup contents and recovery](BACKUP_RECOVERY.md).

### 30.2 Proposed disease-occurrence report

The requested future disease-occurrence/appearance analysis across veterinarian diagnosis and grooming concerns is not an active report. The current Report Center does not include it.

A future implementation must first define:

- Canonical disease terminology and synonyms.
- Whether provisional and confirmed diagnoses are counted differently.
- How free-text grooming concerns map to disease categories.
- Species/breed/age/branch/date filters.
- Duplicate-episode rules.
- Privacy and minimum-count rules.

### 30.3 Archived-account enforcement

Archive/deactivated fields and interface actions exist, but login and token lookup intentionally do not enforce them in the active code. This is a known authorization-policy gap.

### 30.4 Offline operation

The PWA does not support:

- Offline viewing of private pet/medical/financial data.
- Offline booking or queue writes.
- Conflict reconciliation when connectivity returns.

### 30.5 Full disaster recovery

The lifecycle recovery report is an integrity report only. The application has no active disaster-recovery orchestration for a lost database or media directory.

### 30.6 Clinical/governance gaps

No complete specialized workflow was found for:

- Formal emergency triage and escalation.
- DNR orders.
- Euthanasia authorization and execution.
- Remains release/cremation tracking.
- Adverse-event or incident reports.
- Controlled-drug register.
- Formal consent withdrawal/privacy-data request.
- Automated data-retention/deletion policy.

These may be handled outside the application, but they must not be claimed as iPawcus capabilities.

### 30.7 Operational/testing gaps

- No unified automated end-to-end test framework is configured in package.json.
- The unified default runner covers frontend tests, lint/build, PHP syntax, selected database-free regressions, and local API routing. Separate sandbox/API checks also exist; these do not form a complete browser/end-to-end suite.
- Static source review does not prove all current migrations are applied on production.
- Static source review does not prove SMTP, push, meeting, cron, or secure storage are functioning.
- Malware/antivirus scanning is not part of upload handling.
- General login brute-force throttling was not found.

**Current source cross-reference:** [php/system_backups.php](../php/system_backups.php#L43); [php/system_backup_common.php](../php/system_backup_common.php); [src/services/reportService.js](../src/services/reportService.js#L57); [public/ipawcus-push-sw.js](../public/ipawcus-push-sw.js).

## 31. State-machine reference

### 31.1 Booking

pending → confirmed → matching service completion → completed

pending → cancelled

confirmed → cancelled

Completed and cancelled are terminal in the ordinary status workflow.

### 31.2 Queue

waiting → in-progress → diagnosis/service completion → completed

waiting → cancelled

in-progress → cancelled

Controlled exception: the veterinarian who completed a case can reopen an eligible completed queue to in-progress for correction.

### 31.3 Record update request

pending_admin_review → approved → assigned → in_progress → completed

Admin can reject from eligible open states. Payment must be verified or waived before approve/assign/start/complete.

### 31.4 Grooming

scheduled → checked_in → in_progress → ready → released

checked_in or in_progress → vet_review → resume/stop/consultation outcome

vet_review → confinement recommendation → transferred; the linked stay is managed in Boarding

ready → verified full POS payment → released; manual release is rejected

Early/eligible work can become cancelled or no_show.

### 31.5 Boarding room/assignment

available room → reserved assignment → occupied assignment → checked-out/closed handling

Room itself can also be maintenance or retired and therefore unavailable.

### 31.6 Billing

unbilled → unpaid → partial → paid

Processed refunds recalculate the state and can result in refunded.

### 31.7 Consent record

pending → signed → released

Eligible records can be cancelled according to their workflow.

### 31.8 Personal TODO

pending → completed

pending/completed → cancelled where allowed; deletion is restricted to the owner’s personal task.

## 32. Data ownership and authority rules

The following principles summarize who is authoritative:

- Authentication identity comes from the access token, not a user ID posted by the browser.
- Owner access comes from pet_ownership and matching source records.
- Branch access comes from active user-branch assignment and workflow branch context.
- Veterinarian clinical authority comes from the current assignment/consultation record.
- Service price comes from the active backend catalog/special-service rules.
- Inventory availability comes from locked batch/location quantities.
- Billing state comes from stored charges, verified payments, and processed refunds.
- A payment proof is evidence awaiting review, not payment confirmation.
- A completed service is not automatically a paid invoice.
- A frontend hidden button is not an authorization rule.
- A report/export is not a database backup.
- A notification is not the authoritative business transaction.

## 33. Main API capability map

| API family | Purpose | Main access |
| --- | --- | --- |
| /login, /register, /auth/* | Authentication, verification, recovery | Public with validation |
| /profile, /users/{id}/*, /account/google | Profiles/password, scoped owner data, explicit Google linking | Authenticated; owner/Super Admin scope as applicable |
| /pet_information, /pet_ownership/*, /pets/* | Pet register, linking, ownership, profile records | Owner/clinic by action |
| /bookings/*, /booking-availability | Booking lifecycle and slots | Availability public; writes scoped |
| /queues/*, /self-service/access | Queue creation, assignment, receive, return, reentry | Owner/Admin/Vet by action |
| /clinical-intakes | Physical examination before diagnosis | Clinic read; Admin/Super Admin write, with current GET branch gap |
| /vet-diagnoses/* | Clinical diagnosis and completion | Veterinarian/Super Admin |
| /pets/{id}/prescriptions, /prescriptions/*, /prescription-items/*, /prescription-occurrences/* | Issue independent prescriptions, start courses, record doses/completion | Issuance Vet-group; other actions owner/clinic with handler checks |
| /pets/{id}/certificates | Registration data, latest medical certificate, issue/view actions | Owner/clinic read; only actual Veterinarian issues medical certificates |
| /online-consultations/* | Online appointment/session/diagnosis | Owner or assigned Veterinarian |
| /record-update-requests/* | Paid controlled record correction | Owner/clinic by action |
| /grooming | Grooming workspace and review | Read by allowed roles; writes clinic-scoped |
| /boarding/*, /rooms/availability | Boarding rooms, stay, monitoring, materials | Admin; availability authenticated |
| /service-catalog/*, /special_services | Service and preset management | Read all authenticated; mutations Admin |
| /inventory/* | Item, batch, movement, transfer, delete | Admin/Super Admin with branch/feature checks |
| /visits/* | POS, charges, payments, refunds, invoice data | Admin/Super Admin |
| /payment-methods/* | Payment instructions/configuration | Read authenticated; changes Super Admin + OTP |
| /consent_files, /consent-form-records | Templates and signed usage records | Owner/clinic reads; Admin template mutations |
| /notifications/* | Feed, preferences, push, reminders | Authenticated; reminder runner secret |
| /todos | Combined schedule and personal tasks | Owner/Vet/Super Admin |
| /reports/* | Dashboard and report generation | Super Admin |
| /pet-media-monitoring | Pet image/PDF source inventory | Veterinarian/Super Admin |
| /upload, /uploads/media | Validated upload and protected retrieval | Authenticated and record-scoped |
| /branches, /veterinarian-booking-schedule, /vet_schedules | Branch context, clinic assignment/acceptance, online starts | Authenticated reads; Super Admin clinic assignment, vet own preferences/online starts |
| /veterinarian-branch-schedules | Retired branch-visit compatibility endpoint | Authenticated empty read; publishing rejected |
| /activity, /activity/options, /activity/view | Scoped staff action history/filter options; retired view-event compatibility | Clinic own history; Super Admin all; view POST does not record |
| /system-backups | Generate/download local ZIP and list export audit metadata | Super Admin; deployment-dependent |
| /vet-presence | Current visit availability signal | Public read; Admin/Super Admin write |
| /status-display, /tv-status | Public queue status display | Public limited data |
| /lifecycle/recovery-report | Finds completed cases missing billing | Super Admin, read-only |
| /system/problem-report, /health | Maintenance diagnostics | Public, limited/rate-controlled as applicable |

## 34. Source-evidence map

The principal active sources inspected for this reference include:

### Application and access

- [src/App.jsx](../src/App.jsx)
- [src/main.jsx](../src/main.jsx)
- [src/components/Dashboard.jsx](../src/components/Dashboard.jsx)
- [src/components/dashboardRouter.jsx](../src/components/dashboardRouter.jsx)
- [src/services/apiClient.js](../src/services/apiClient.js)
- [src/hooks/useAutoRefresh.js](../src/hooks/useAutoRefresh.js)
- [src/hooks/useSessionFormPersistence.js](../src/hooks/useSessionFormPersistence.js)
- [src/context/ThemeProvider.jsx](../src/context/ThemeProvider.jsx)
- [php/index.php](../php/index.php)
- [php/role_access.php](../php/role_access.php)
- [php/auth_access_helpers.php](../php/auth_access_helpers.php)
- [php/workflow_guard_helpers.php](../php/workflow_guard_helpers.php)

### Authentication, profiles, and accounts

- [php/login.php](../php/login.php)
- [php/register.php](../php/register.php)
- [php/auth_otp_helpers.php](../php/auth_otp_helpers.php)
- [php/password_policy_helpers.php](../php/password_policy_helpers.php)
- [php/get_accounts.php](../php/get_accounts.php)
- [php/create_account.php](../php/create_account.php)
- [php/delete_account.php](../php/delete_account.php)
- [php/update_account_status.php](../php/update_account_status.php)
- [php/update_account_profile.php](../php/update_account_profile.php)
- [php/get_user_profile.php](../php/get_user_profile.php)
- [php/update_user_profile.php](../php/update_user_profile.php)
- [src/components/SuperAdminDashboardComponent/AccountManagement.jsx](../src/components/SuperAdminDashboardComponent/AccountManagement.jsx)
- [src/components/SuperAdminDashboardComponent/PetOwnerAccountsManagement.jsx](../src/components/SuperAdminDashboardComponent/PetOwnerAccountsManagement.jsx)
- [src/components/AdminDashboardsComponent/adminprofile.jsx](../src/components/AdminDashboardsComponent/adminprofile.jsx)
- [src/components/VetrinarianComponents/VetProfile.jsx](../src/components/VetrinarianComponents/VetProfile.jsx)
- [src/components/PetOwnerDashboard/PetOwnerProfile.jsx](../src/components/PetOwnerDashboard/PetOwnerProfile.jsx)
- [DDL/20260914_01_personnel_profile_cleanup.sql](../DDL/20260914_01_personnel_profile_cleanup.sql)

### Pets, booking, queue, and clinical records

- [php/add_pet.php](../php/add_pet.php)
- [php/get_pet.php](../php/get_pet.php)
- [php/get_pets.php](../php/get_pets.php)
- [php/update_pet.php](../php/update_pet.php)
- [php/update_pet_status.php](../php/update_pet_status.php)
- [php/link_pet.php](../php/link_pet.php)
- [php/coparent_requests.php](../php/coparent_requests.php)
- [php/add_booking.php](../php/add_booking.php)
- [php/get_bookings.php](../php/get_bookings.php)
- [php/booking_availability.php](../php/booking_availability.php)
- [php/update_booking_status.php](../php/update_booking_status.php)
- [php/update_booking_schedule.php](../php/update_booking_schedule.php)
- [php/receive_booking.php](../php/receive_booking.php)
- [php/add_to_queue.php](../php/add_to_queue.php)
- [php/get_queues.php](../php/get_queues.php)
- [php/update_queue_status.php](../php/update_queue_status.php)
- [php/assign_queue_vet.php](../php/assign_queue_vet.php)
- [php/receive_queue.php](../php/receive_queue.php)
- [php/return_queue.php](../php/return_queue.php)
- [php/reenter_queue.php](../php/reenter_queue.php)
- [php/vet_diagnoses.php](../php/vet_diagnoses.php)
- [php/pet_medical_records.php](../php/pet_medical_records.php)
- [php/record_update_requests.php](../php/record_update_requests.php)
- [php/online_consultations.php](../php/online_consultations.php)
- [php/booking_maintenance.php](../php/booking_maintenance.php)
- [php/lifecycle_recovery_report.php](../php/lifecycle_recovery_report.php)
- [src/components/PetOwnerDashboard/PetProfile.jsx](../src/components/PetOwnerDashboard/PetProfile.jsx)
- [src/components/AdminDashboardsComponent/PetRegister.jsx](../src/components/AdminDashboardsComponent/PetRegister.jsx)
- [src/components/AdminDashboardsComponent/BookingManagement.jsx](../src/components/AdminDashboardsComponent/BookingManagement.jsx)
- [src/components/AdminDashboardsComponent/QueueManagement.jsx](../src/components/AdminDashboardsComponent/QueueManagement.jsx)
- [src/components/VetrinarianComponents/VetDiagnosis.jsx](../src/components/VetrinarianComponents/VetDiagnosis.jsx)
- [src/components/VetrinarianComponents/VetMylistinService.jsx](../src/components/VetrinarianComponents/VetMylistinService.jsx)
- [src/components/VetrinarianComponents/VetPetsEMR.jsx](../src/components/VetrinarianComponents/VetPetsEMR.jsx)

### Grooming and boarding

- [php/grooming.php](../php/grooming.php)
- [php/grooming_helpers.php](../php/grooming_helpers.php)
- [php/grooming_rules.php](../php/grooming_rules.php)
- [php/grooming_media.php](../php/grooming_media.php)
- [php/grooming_upload.php](../php/grooming_upload.php)
- [php/boarding_management.php](../php/boarding_management.php)
- [src/components/shared/GroomingWorkspace.jsx](../src/components/shared/GroomingWorkspace.jsx)
- [src/components/AdminDashboardsComponent/GroomingManagement.jsx](../src/components/AdminDashboardsComponent/GroomingManagement.jsx)
- [src/components/AdminDashboardsComponent/PetBoardingManagement.jsx](../src/components/AdminDashboardsComponent/PetBoardingManagement.jsx)
- [DDL/20260906_01_grooming_management.sql](../DDL/20260906_01_grooming_management.sql)

### Services, inventory, and billing

- [php/service_catalog.php](../php/service_catalog.php)
- [php/special_services.php](../php/special_services.php)
- [php/inventory.php](../php/inventory.php)
- [php/inventory_invoice_helpers.php](../php/inventory_invoice_helpers.php)
- [php/visit_billing.php](../php/visit_billing.php)
- [php/payment_methods.php](../php/payment_methods.php)
- [src/components/AdminDashboardsComponent/ServiceCatalogManagement.jsx](../src/components/AdminDashboardsComponent/ServiceCatalogManagement.jsx)
- [src/components/AdminDashboardsComponent/AllItemsPage.jsx](../src/components/AdminDashboardsComponent/AllItemsPage.jsx)
- [src/components/AdminDashboardsComponent/StockInPage.jsx](../src/components/AdminDashboardsComponent/StockInPage.jsx)
- [src/components/AdminDashboardsComponent/POSmanagement.jsx](../src/components/AdminDashboardsComponent/POSmanagement.jsx)
- [src/lib/invoicePdf.js](../src/lib/invoicePdf.js)
- [DDL/20260819_01_invoice_pdf_documents.sql](../DDL/20260819_01_invoice_pdf_documents.sql)

### Consent, notifications, media, and reporting

- [php/consent_file_helpers.php](../php/consent_file_helpers.php)
- [php/consent_form_records.php](../php/consent_form_records.php)
- [php/consent_record_helpers.php](../php/consent_record_helpers.php)
- [php/notifications.php](../php/notifications.php)
- [php/notification_helpers.php](../php/notification_helpers.php)
- [php/pet_owner_todos.php](../php/pet_owner_todos.php)
- [php/upload.php](../php/upload.php)
- [php/upload_media.php](../php/upload_media.php)
- [php/runtime_media.php](../php/runtime_media.php)
- [php/pet_media_monitoring.php](../php/pet_media_monitoring.php)
- [php/reports_dashboard.php](../php/reports_dashboard.php)
- [php/reports_generate.php](../php/reports_generate.php)
- [php/reports_common.php](../php/reports_common.php)
- [php/system_problem_report.php](../php/system_problem_report.php)
- [src/components/AdminDashboardsComponent/ConsentFileManagement.jsx](../src/components/AdminDashboardsComponent/ConsentFileManagement.jsx)
- [src/components/SuperAdminDashboardComponent/PetMediaMonitoring.jsx](../src/components/SuperAdminDashboardComponent/PetMediaMonitoring.jsx)
- [src/components/SuperAdminDashboardComponent/SuperAdminReportsDashboard.jsx](../src/components/SuperAdminDashboardComponent/SuperAdminReportsDashboard.jsx)
- [src/components/SuperAdminDashboardComponent/SuperAdminReportCenter.jsx](../src/components/SuperAdminDashboardComponent/SuperAdminReportCenter.jsx)
- [src/components/SuperAdminDashboardComponent/ReportChartCard.jsx](../src/components/SuperAdminDashboardComponent/ReportChartCard.jsx)
- [src/services/reportService.js](../src/services/reportService.js)

### Additional sources reconciled in the October 18 revision

- [php/auth_google.php](../php/auth_google.php)
- [php/auth_google_complete.php](../php/auth_google_complete.php)
- [php/account_google.php](../php/account_google.php)
- [php/google_auth_helpers.php](../php/google_auth_helpers.php)
- [php/clinic_booking_helpers.php](../php/clinic_booking_helpers.php)
- [php/clinical_intakes.php](../php/clinical_intakes.php)
- [php/veterinarian_booking_schedule.php](../php/veterinarian_booking_schedule.php)
- [php/veterinarian_branch_schedules.php](../php/veterinarian_branch_schedules.php)
- [php/clinical_confinement_helpers.php](../php/clinical_confinement_helpers.php)
- [php/pet_certificates.php](../php/pet_certificates.php)
- [php/prescriptions.php](../php/prescriptions.php)
- [php/prescription_helpers.php](../php/prescription_helpers.php)
- [php/staff_activity.php](../php/staff_activity.php)
- [php/staff_activity_helpers.php](../php/staff_activity_helpers.php)
- [php/system_backups.php](../php/system_backups.php)
- [php/system_backup_common.php](../php/system_backup_common.php)
- [src/services/serviceHealth.js](../src/services/serviceHealth.js)
- [src/lib/errorPolicy.js](../src/lib/errorPolicy.js)
- [src/lib/sectionResource.js](../src/lib/sectionResource.js)
- [src/hooks/useSectionResource.js](../src/hooks/useSectionResource.js)
- [src/components/shared/ErrorBoundary.jsx](../src/components/shared/ErrorBoundary.jsx)
- [src/components/shared/ServiceStatusNotice.jsx](../src/components/shared/ServiceStatusNotice.jsx)
- [src/components/shared/PrescriptionPlanPanel.jsx](../src/components/shared/PrescriptionPlanPanel.jsx)
- [src/components/shared/PetCertificateDialog.jsx](../src/components/shared/PetCertificateDialog.jsx)
- [src/components/SuperAdminDashboardComponent/SuperAdminActivityLog.jsx](../src/components/SuperAdminDashboardComponent/SuperAdminActivityLog.jsx)
- [scripts/check-project.mjs](../scripts/check-project.mjs)
- [scripts/check-google-auth.php](../scripts/check-google-auth.php)

## 35. Validation status of this document

This reference was checked against active source connections, but it does not replace runtime acceptance testing.

The October 18 default runner passes 201/201 checks, including 114 frontend tests. Lint/build, the PHP syntax sweep, selected database-free workflow regressions, and the local API router pass. Google configuration/library readiness passes but the local database step fails. Documentation checks validate target files, source line bounds, internal heading links, and section completeness. These checks do not authenticate a real owner or staff browser, exercise every database transaction, or certify deployment; the detailed limitations are in section 36.

For a release-level capability certification, the next verification pass should:

1. Apply the complete migration set to a clean test database.
2. Create one account for each role and one multi-branch scenario.
3. Execute each workflow and record screenshots/API results.
4. Test invalid ownership, wrong branch, wrong role, expired token, and invalid transitions.
5. Run concurrent booking, queue, room, inventory, grooming, and payment tests.
6. Verify private media cannot be opened directly or by another owner.
7. Verify invoice PDFs survive a redeployment.
8. Verify mail worker, reminders, browser push, and meeting integration.
9. Verify reports against manually reconciled database totals.
10. Implement and test an independent backup/restore process before relying on the application for disaster recovery.

Until that runtime pass is completed, this document should be described as the **current program capability reference**, not a production compliance certificate.

## 36. Consolidated limitations and findings

This section combines the September limitations with the current source comparison. **Scope boundary** means an absent or limited product workflow. **Implementation finding** means an existing control needs correction; it is not an acceptable substitute for an advertised security property. **Deployment dependency** means code requires configuration/schema/storage/services. **Unverified** means this review lacks runtime evidence, not that the feature necessarily fails.

### 36.1 Access, identity, privacy, and audit findings

| ID | Type / current status | Limitation and operational consequence | Current cross-reference |
| --- | --- | --- | --- |
| SEC-01 | Implementation finding; open | Archive/deactivation labels do not revoke API tokens or universally block sign-in. Do not use archive as an emergency access lock. Some appointment rosters exclude archived accounts, but that does not deactivate authentication. | [php/login.php](../php/login.php#L155); [php/auth_access_helpers.php](../php/auth_access_helpers.php#L110) |
| SEC-02 | Implementation finding; open | Password change/reset updates the password, optionally records password_changed_at, and leaves existing tokens valid. A compromised session can survive password recovery. | [php/update_password.php](../php/update_password.php#L47); [php/auth_reset_password.php](../php/auth_reset_password.php#L43); [php/auth_access_helpers.php](../php/auth_access_helpers.php#L110) |
| SEC-03 | Implementation finding; partly corrected | Staff directory responses now strip user_password. Profile serialization still includes all selected user columns, including the stored hash. Limit the remaining endpoint to necessary public fields. | [php/get_accounts.php](../php/get_accounts.php#L46); [php/get_user_profile.php](../php/get_user_profile.php#L62) |
| SEC-04 | Implementation finding; open | Optional Admin feature permissions default to allowed when their table is absent or the lookup fails. Central role checks remain, but disabled-feature guarantees are not fail-closed. | [php/role_access.php](../php/role_access.php#L56) |
| SEC-05 | Implementation finding; open | Google sign-in rejects inactive staff profiles. Password sign-in defines inactivity helpers but does not invoke them before token creation. Existing token lookup does not check those staff profile flags. Authentication paths therefore do not enforce one consistent deactivation policy. | [php/google_auth_helpers.php](../php/google_auth_helpers.php#L251); [php/login.php](../php/login.php#L155); [php/auth_access_helpers.php](../php/auth_access_helpers.php#L110) |
| SEC-06 | Implementation finding; source-confirmed, runtime impact unverified | Clinical intake POST/PATCH check Admin branch access. GET filters a vet to their assignment but does not constrain Admin results to assigned branches. Direct authenticated reads need the same branch boundary. | [php/clinical_intakes.php](../php/clinical_intakes.php#L151) |
| SEC-07 | Implementation/security limitation | General password-login throttling is absent from the inspected handler. Tokens are stored in browser local storage and can also be accepted in URL query/cookie form. Wildcard API CORS is present. These choices require an explicit deployment/security review; they are not proof of a demonstrated exploit. | [php/login.php](../php/login.php#L155); [php/auth_access_helpers.php](../php/auth_access_helpers.php#L110); [php/index.php](../php/index.php#L3) |
| SEC-08 | Scope/deployment boundary | Private media depends on authenticated delivery plus server rules/private storage; MIME checks do not scan malware. A misconfigured server can bypass intended direct-access protection. Grooming media access is broader for ready/released/transferred jobs than assigned pending reviews alone. | [php/upload_media.php](../php/upload_media.php#L69); [php/grooming_helpers.php](../php/grooming_helpers.php#L107) |
| SEC-09 | Scope boundary | Terms/consent capture is not a complete versioned policy-acceptance, withdrawal, privacy-request, or automated retention/deletion program. Staff action files are neither a tamper-proof ledger nor a complete failed-access log. | [php/register.php](../php/register.php#L16); [php/staff_activity_helpers.php](../php/staff_activity_helpers.php#L1198) |

### 36.2 Functional and operational boundaries

| ID | Area | Implemented capability | Remaining boundary / consequence |
| --- | --- | --- | --- |
| FUN-01 | Staffing and branches | Assignment, active/accepting roster, clinic hours, closures, shared vet reservations. | No per-vet leave/working-hours workflow, assistant/room/equipment resource plan, payroll, or full HR/credentialing. Retired branch visits must not be advertised as current. See section 7. |
| FUN-02 | Booking duration | Shared medical capacity, actual vet assignment, cross-clinic conflicts, 30-minute ordinary and 60-minute home/online intervals. | Catalog duration does not determine reservation length. Surgery/dental work can require longer resources than the fixed slot. Home travel/buffer scheduling is not established. See sections 9.5 and 17. |
| FUN-03 | Queue and emergency care | Queue priorities, network-gated self-service, assignment, intake, clinical completion. | Priority is not formal emergency triage; network/IP gating is not strong physical-presence proof. No guaranteed waiting time. See section 10. |
| FUN-04 | Patient/clinical governance | Healthy/Emergency/Deceased status, diagnoses, allergies, vaccinations, follow-up, medical summaries. | No complete DNR, euthanasia, remains release, incident/adverse-event, controlled-drug, or emergency-spending workflow. The software does not automatically diagnose. See sections 8, 11, 30.6. |
| FUN-05 | Owner medical records | Owner-visible organized records, permitted history, email/export, paid update requests. | Owner summaries depend on staff organization/release; they are not an unrestricted internal chart dump. Request completion evidence depends on snapshot schema. See sections 13–14. |
| FUN-06 | Prescriptions | Independent issued plans, start confirmation, dose checklists, as-needed completion, retained history. | No automatic drug-interaction checking or proof a dose was administered. Issued directions cannot be amended in place. Historical dose correction affects checklist state, not the issued prescription. See section 13.7. |
| FUN-07 | Certificates | Clinic-registration print data and veterinarian-issued short-validity medical certificate. | Registration is not health/travel clearance. The handler returns the latest non-revoked medical certificate, and no complete public validation/revocation-management workflow was established. See section 8.6. |
| FUN-08 | Online consultation | Vet-ready/join/close actions, Jitsi call, minimized navigation, diagnosis. | Depends on connectivity, devices and meeting host. Leaving the call does not finish clinical records or verify money. See section 12. |
| FUN-09 | Grooming | Catalog service selection, photo evidence, staff record, vet review, billing, publication, full-payment release, confinement transfer. | No dedicated groomer-capacity roster; assistant is a name field. No complete dedicated itemized add-on/stock subsystem. Payment-driven pickup flags do not independently verify physical collection. See section 15. |
| FUN-10 | Boarding/confinement | Room capacity/reservation, clinical referral, consent, approval, observations/tasks, materials, overstay and billing. | Does not supply full abandonment/emergency/DNR/end-of-life policy or hospital/ICU staffing. Clinical referral is not actual room allocation/check-in. See section 16. |
| FUN-11 | Inventory | Batch/location stock, costs/prices, receipts, guarded stock-out, same-branch transfer and archival trace. | No inter-branch transfer journey, staged receiving approval in the direct transfer operation, or inventory restore button. Not full procurement/accounting. See section 18. |
| FUN-12 | Payments/refunds | Staff proof review, charges, verified payments, stored invoices, audited backend refund handlers. | Proof is not settlement; no automated provider reconciliation was established. Current POS offers no refund action. Backend refund records do not send money through a payment provider. See section 19. |
| FUN-13 | Reports | Fifteen business types, print/PDF/Excel, dashboard and separate Activity Log print. | No disease-occurrence/categorized-pet-cases report. Missing sources can produce partial reports; check missing_data. No verified external laboratory/accounting/clinic interoperability. See section 23. |
| FUN-14 | Notifications | In-app history, preferences, queued email, reminder runner, push hooks. | A committed action does not prove recipient delivery. Workers, scheduler, subscription/browser permission and external services are required. See section 22. |
| FUN-15 | Backup/recovery | On-demand Super Admin SQL/media/Excel/manifest ZIP and audit metadata. | No retained historical ZIP, app-scheduled/incremental/PITR backup, web restore, or verified clean restore. ZIP is not password encrypted; source/.env are excluded. ZIP size/entry and workbook row limits apply. See section 30.1 and the backup guide. |
| FUN-16 | Connectivity/recovery | Cached PWA shell, local section retry, confirmed outage notice, stale data handling. | No offline private data/writes or later conflict synchronization. Retrying a crashed subtree can discard its state. An uncertain write must be checked before resubmission. Not every loader uses section-resource handling. See sections 3.6, 27.5, 30.4. |

### 36.3 Deployment and evidence constraints

| ID | Constraint | Evidence and practical meaning |
| --- | --- | --- |
| DEP-01 | Current local database prerequisite failure | October 18 check:google passes configuration/library checks but fails database readiness. Today's successful default runner uses selected database-free checks and cannot establish registration, payment, or transactional write readiness. |
| DEP-02 | Historical configured database import defects | October 14 review found 88 readable tables, but 87 tables missing exported indexes, 75 missing exported foreign-key constraints, and 80 missing required auto-increment metadata. This revision did not re-run the export comparison or apply the prepared repair. The historical synthetic sandbox is separate. |
| DEP-03 | Feature-specific setup | Current migrations, proper indexes/constraints, private writable storage, workers, HTTPS, provider origins, and persistent uploads are required. A source file or successful GET does not prove a complete installation. See section 29. |
| QA-01 | Runtime/role isolation | Default tests do not execute every role handoff, wrong-owner/wrong-branch request, double-receive, concurrent stock/payment, or restore journey against a complete database. Intake read scope and auth-policy differences need explicit regression scenarios after correction. |
| QA-02 | Performance/accessibility | No fresh measured response-time, concurrency, large-data, real-device, screen-reader, or complete responsive acceptance study was run. The build's large chunk warning is a measurement prompt, not proof of unacceptable speed. The earlier targeted fault/layout checks cover only their recorded scenarios. |
| QA-03 | External integrations and production | Real Google callbacks, OTP/SMTP delivery, push, meeting access, payment-provider behavior, Apache/hosting isolation, deployment survival, and full restore remain outside this revision's runtime evidence. |

### 36.4 Recommended correction and verification order

1. Address profile field exposure, Admin intake GET branch scope, consistent inactive/archive enforcement, token revocation after password recovery, and optional feature fail-open behavior. These are implementation findings, not thesis scope boundaries.
2. Restore current database/schema readiness in a reviewed environment, then run database-backed role/ownership/branch and concurrent transaction scenarios. Keep the synthetic sandbox separate from the configured clinic database.
3. Verify private media, persistent invoice/activity/grooming files, export cleanup, and a complete clean-environment restore. Confirm actual mail/reminder/push/video operation separately.
4. Reconcile service duration, resource staffing, physical collection, emergency, consent, and end-of-life policies with clinic owners; implement any rules promised by the project requirements.
5. Observe complete role journeys on phone, tablet, desktop, and wide monitors; reconcile reports to known transactions and establish measurable quality acceptance criteria.

## 37. Complete workflow and role handoffs

| Workflow | Actors and sequence | Completion boundary |
| --- | --- | --- |
| Account and pet setup | Owner registers/verifies or completes Google onboarding → profile → adds pet or requests co-ownership → authorized approval. | A shareable ID alone does not grant an existing owner's private pet access. |
| Clinic appointment | Owner selects service/branch/slot/pet/consent/payment evidence → server reserves capacity → Admin reviews/clears/ confirms → queue/vet assignment → Admin intake and saved consent → vet diagnosis/prescription → visit/charges → POS verifies payment → owner reviews released records. | Confirmed appointment, completed clinical care, and paid invoice are separate states. |
| Walk-in/self-service | Admin registers/selects pet or owner submits network-gated queue → staff handles assignment/consent/intake → vet receives/completes care → billing/history. | Generic queue status changes cannot manufacture clinical completion. |
| Online consultation | Owner chooses vet/call start/pet/consent/proof → review/confirmation → vet marks ready → owner joins → call and diagnosis → billing/records. | One-hour reservation and vet-ready join rules apply; leaving a call is not a diagnosis/payment action. |
| Additional prescription | Vet issues a fresh independent plan → owner confirms item starts → scheduled doses or as-needed use → checklist/history. | New issuance preserves prior courses; checklist completion is not evidence of medicine ingestion. |
| Record update/certificate | Owner requests change and submits evidence → Admin clears/waives payment and assigns → assigned vet edits/organizes records, optionally issues a certificate → actual-change evidence/request completion → owner views. | Certificate issuance has separate vet/date/signature rules; it is not automatic with payment. |
| Grooming | Approved booking → receiving/intake/before photo → active catalog selections → start → assigned-vet concern review if needed → after photo/finish ready → verified full POS payment releases → permitted summary/photo publication. | Manual release is rejected. Staff must still verify actual collection. |
| Clinical confinement | Vet diagnosis or grooming review recommends stay → source-linked pending admission/charge → Admin obtains required approval/consent → room reservation/check-in → clinical monitoring/tasks/materials → review billing/discharge/checkout. | A recommendation or transferred grooming status is not itself unit allocation or physical check-in. |
| Pet Hotel | Owner chooses clinic/room size/stay dates/care/consent/payment evidence → Admin confirms and assigns unit → check-in → care/tasks/materials → charges/checkout/history. | Landing room selection is a prefill; protected availability and room collision checks still decide acceptance. |
| Inventory and POS | Authorized Admin acknowledges/password-confirms stock changes → batch/movement audit → clinical/service/product charges consume allowed materials → verified money locks charges → saved PDF. | Historical financial/stock snapshots remain even when products are archived. |
| Governance and recovery | Super Admin manages accounts/branches/permissions/payment settings → reviews reports/activity → creates local backup ZIP → trained operator separately verifies restoration. | Reports and lifecycle inconsistency lists are not database backups or repairs. |

For click-by-click role instructions, use the [role guide](../USER_INSTRUCTIONS_FOR_DIFFERENT_ROLES.md). This matrix describes connected responsibilities, not additional permissions beyond the PHP route and record checks.

## 38. Suggested scope and quality assessment

### 38.1 Recommended capstone scope

If consistent with the approved proposal, five connected objectives describe the system more clearly than a separate objective per screen:

1. Role-based owner and clinic workflow coordination.
2. Pet registration/ownership and electronic medical records.
3. Appointment requests, availability, and confirmation.
4. Queue/intake-to-veterinarian consultation and documented completion.
5. Billing/payment review and inventory traceability.

Online consultation, prescriptions/certificates, grooming, boarding/confinement, consent, notifications, reports, activity, and backup export support those objectives. Treat a feature as evaluated only when its actual demonstration and test evidence exist.

Suggested wording:

> iPawcus is an integrated web-based veterinary-clinic and pet-owner system covering pet registration and shared ownership, appointment requests and confirmation, queue and physical-intake coordination, veterinarian consultation, organized medical records, prescriptions, and related billing and inventory recording. Configured supporting workflows include online consultation, grooming, boarding and clinical confinement, certificates, consent documents, notifications, reports, activity history, and local backup export. It organizes clinic operations but does not replace professional clinical judgment, formal emergency and end-of-life policy, external payment settlement, full accounting or HR, offline clinical work, or a tested disaster-recovery service. Relevant functions depend on database integrity, connectivity, secure storage, and configured third-party services.

Do not reclassify SEC-01–SEC-06 as intentional scope limitations. They describe behavior of existing controls and require correction or explicit risk treatment.

### 38.2 Qualitative quality screening

The following reconciles the nine quality categories used by the [September ISO/IEC 25010 screening](20260922_system_limitations_iso25010_screening.md). It is a repository-based assessment, not an ISO conformity claim, certification, numeric score, or substitute for measured evaluation.

| Category | Current source-backed assessment | Evidence still required |
| --- | --- | --- |
| Functional suitability | Broad connected clinic coverage, with the explicit functional boundaries above. | Approved requirements mapped to successful end-to-end tasks. |
| Performance efficiency | Polling dedupe/visibility/backoff and deferred exports exist; large build chunks remain. | Measured latency, concurrent load, data scale, export memory/time, and device performance. |
| Compatibility | Browser, PHP/MySQL, email, push, Google, and Jitsi integration paths exist. | Real provider operation and any promised laboratory/accounting/clinic interoperability. |
| Interaction capability | Shared controls/themes, validation, section retry, and responsive layouts exist. | Observed task completion, keyboard/screen-reader behavior, training outcomes, and full device coverage. |
| Reliability | Transactions, locks, dedupe, state guards, and scoped recovery reduce partial/duplicate work. | Complete schema, concurrency/failure scenarios, persistent storage, and verified restoration. |
| Security | Central route/record guards and protected files exist; specific open findings remain. | Corrected authentication/profile/intake issues and deployed adversarial role/record/media checks. |
| Maintainability | Unified checks, module regressions, sandbox tooling, and source-linked docs exist. | Complete browser coverage, migration repeatability, and continued regression maintenance. |
| Flexibility | Configurable branches/services/palettes and shared vet capacity exist. | Procedure-duration, staffing/resource, integration, and deployment adaptation requirements. |
| Safety | Documentation supports professional decisions; specialized clinical governance is incomplete. | Clinic-approved triage, consent, emergency, DNR/end-of-life, incident, and medication procedures. |

## 39. Document provenance and maintenance

This file is the combined maintained reference. Historical dated reviews retain their original results and must not override current source without rechecking it.

| Source document | Material incorporated / current treatment |
| --- | --- |
| [September limitations and quality screening](20260922_system_limitations_iso25010_screening.md) | Functional limitations, quality categories, capstone scope; corrected for directory-field cleanup, shared vet capacity, current tests and newer modules. |
| [October project audit](20261013_project_audit.md) | Routing/Google/security corrections and role checklist. Its database failure and counts are dated results. |
| [Configured database verification](20261014_database_verification.md) | Historical schema-import defects and landing Pet Hotel clinic handoff; no repair assumed. |
| [Sandbox guide](database_sandbox.md) | Separate synthetic database and isolation limits; sandbox success is not production certification. |
| [Role instructions](../USER_INSTRUCTIONS_FOR_DIFFERENT_ROLES.md) | Operator steps reconciled with backend authority, intake, prescriptions/certificates, refunds and Activity Log placement. |
| [Shared veterinarian booking](shared-veterinarian-booking.md) and [presence/lunch](vet-presence-and-lunch.md) | Independent online/clinic rules, accepting roster, shared conflicts, retired visits, and informational presence. |
| [Prescription workflow](prescription-workflow.md) | Add-only issued plans, dose state/history, independent starts and as-needed completion. |
| [Grooming guide](grooming-management.md) | Photo/catalog/review/POS release and confinement-transfer behavior reconciled with handlers. |
| [Activity history](staff_activity_history.md) | Current dedicated page, operational module filters, safe details and file-log limitations. |
| [Backup/recovery](BACKUP_RECOVERY.md) | Local ZIP contents, cleanup, archive/workbook limits, manual unverified restore. |
| [Error isolation](error_isolation.md) | Current render/request recovery and the limited scope of earlier synthetic browser checks. |

When changing a capability, update its description, role/branch/owner restriction, state transition, dependency, limitation, and source reference together. Re-run relative-link/line-anchor checks after source movement. Record the date and environment for runtime evidence. Do not replace missing measurements with a claim that an implemented screen is production-ready.
