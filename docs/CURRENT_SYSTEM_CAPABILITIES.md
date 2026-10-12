# iPawcus Current System Capability and Process Reference

Reviewed from the active program source on September 16, 2026.

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
- Veterinarian approved queues, personal work list, diagnoses, vaccination records, online consultations, medical records, histories, grooming review, record-update work, recurring availability, branch schedules, notifications, and TODOs.
- Super Administrator reports, report exports, account management, pet-owner account review, payment-method configuration, media monitoring, admin feature permissions, and inherited clinic access where the backend permits it.

The program uses a React 19/Vite frontend and a PHP/MySQL API. The backend is the source of truth for identity, roles, record ownership, branch access, state changes, prices, payment state, stock movement, and clinical completion.

The program has meaningful defensive controls: hashed API tokens, prepared database statements, transactions, row locks, named locks in collision-prone workflows, state-machine validation, upload MIME checking, protected media delivery, duplicate prevention, authoritative server-side pricing, and post-commit notification handling.

The most important current limitations are:

- The proposed system-backup module is inactive and must not be presented as a working backup or restore capability.
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
- Raises a shared server-availability state so the application can show its maintenance/server-down experience.
- Uses the shared ThemeProvider and ThemeToggle; the selected light/dark mode is stored under ipawcus-theme.
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

The program supports multiple branches, operating hours, closures, per-branch service availability, user assignments, veterinarian branch schedules, inventory location, booking transfers, and branch-aware operational data.

Regular administrators are restricted to assigned branches in branch-sensitive workflows. Super Admin can operate across branches. Veterinarian access is also checked against the clinical assignment or branch context in relevant workflows.

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

Password recovery uses an email OTP before accepting the new password. Authenticated profile password changes use the current workflow and password policy. A notification email is sent after a password change so an unexpected change can be reported.

### 5.5 Session failure handling

- Missing, expired, or revoked tokens cause HTTP 401.
- Disallowed roles cause HTTP 403.
- The frontend clears stale session data and returns to authentication when necessary.
- Transient network failures can be retried by the API client.
- A shared server-down page can submit a limited maintenance problem report.

The general login endpoint does not contain a comparable per-IP/password-attempt rate limiter. OTP and public maintenance-report endpoints have their own limiting behavior.

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
- Recurring weekly availability.
- Published branch visit schedules.

Veterinarian education history was removed by the personnel cleanup migration. Professional experience remains for veterinarians.

### 6.4 Profile restrictions and handling

- Every authenticated user can view and update their own profile.
- Super Admin can manage other users where the backend permits it.
- Normal administrators cannot assign their own branch from the profile; branch assignment belongs to Super Admin Account Management.
- Philippine phone formats are validated.
- Profile screens warn about unsaved changes.
- Staff profile updates produce a governance notification for Super Admin when the notification schema is available.
- Shared theme controls are used on profile screens.

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

The availability engine checks:

- Active branch.
- Branch operating hours.
- Branch closure dates.
- Whether the requested service is available at that branch.
- Past date/time exclusion.
- Existing booking conflicts.
- Relevant veterinarian schedule for online consultation.
- Sunday closure.
- The veterinarian lunch period from 12:00 PM to 1:00 PM for clinical appointments.

Grooming is intentionally excluded from the veterinarian lunch-overlap rule.

### 7.3 Veterinarian presence

The current-day presence control is an operational signal that an administrator can toggle. It resets by clinic day using Asia/Manila time. The public/read side can display whether a veterinarian is currently accepting visits.

Presence is informational and operational; it is not a substitute for the booking slot conflict and schedule checks.

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

Typical clinical slots use 30-minute scheduling. Home Service uses a longer service interval, and Boarding uses date/capacity rules instead of an ordinary single appointment slot. Online Consultation also checks the assigned veterinarian schedule.

Rescheduling:

- Locks the booking before modification.
- Revalidates operating hours, closure, Sunday, lunch, service availability, vet availability, and conflicts.
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

## 11. Veterinarian diagnosis and clinical completion

### 11.1 Access

The diagnosis API is restricted to Veterinarian and Super Admin roles. For a normal veterinarian, the backend derives the veterinarian identity from the authenticated token and does not trust a different veterinarian ID supplied by the browser.

The backend verifies:

- The queue, booking, and pet identity agree.
- The queue is not cancelled.
- The veterinarian has the relevant assignment.
- The case is in an allowed state.
- Required diagnosis schema is present.

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

The video screen uses the configured meeting integration. Camera, microphone, supported browser behavior, network quality, and any third-party meeting availability are external dependencies.

### 12.3 Clinical closure

The online diagnosis uses the same required-field presentation and clinical validation principles as the standard veterinarian diagnosis. Ending a video call alone does not invent a diagnosis or a paid invoice; the clinical and billing records must still be saved through their respective workflows.

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
- Recording pickup/collector confirmation and release.

When work starts, the backend records the authenticated Admin as the handler. The browser cannot override that identity.

### 15.4 Photos and sharing

Photo purposes include reference, before, after, and concern.

Controls:

- JPG, PNG, and WebP are accepted based on actual MIME content.
- Maximum eight MB per photo.
- Maximum 20 photos per grooming job.
- Concern photos are never owner-shared.
- An owner can see only their own explicitly shared non-concern photos after publication.
- A veterinarian can see grooming photos when assigned to that job’s review and allowed by branch context.
- Grooming photos use private storage and authenticated delivery.
- Published/closed photo records are locked against ordinary changes.

There is no general grooming-photo delete endpoint in the current workflow.

### 15.5 Veterinarian grooming review

Admin can request review from checked-in or in-progress work by selecting an active branch veterinarian and documenting the concern.

Only the assigned veterinarian can record one of the supported outcomes:

- Resume grooming.
- Stop grooming.
- Recommend consultation.

This review records advice and controls the grooming state. It does not itself create a clinical diagnosis, new booking, or extra charge.

### 15.6 Finish, billing, publish, and release

Finishing:

- Requires a valid service/package and intake/owner approval.
- Requires explicit completion confirmation.
- Uses or creates the existing visit/invoice context.
- Requires a positive authoritative active-catalog price.
- Produces a neutral default owner summary if needed.
- Does not mark the invoice paid.

When ready, the service and pricing details are locked. Release requires collector information and explicit pickup confirmation.

Publishing exposes only the intended package/add-ons, owner summary, and selected shareable photos. Internal notes, audit details, and the private review concern remain hidden.

### 15.7 Concurrency protection

Grooming jobs carry a version value. Updates use optimistic concurrency; a stale editor receives HTTP 409 and must reload instead of overwriting someone else’s newer work.

### 15.8 Current grooming limitations

- No dedicated groomer employee roster/capacity scheduler was found.
- The assistant field is a name field, not a verified personnel assignment.
- Itemized grooming add-on billing and automatic inventory consumption are not a complete dedicated grooming subsystem.
- Veterinarian review is not a substitute for a formal diagnosis.

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

Service display settings control owner-facing presentation and selected operational display values. All roles can read active settings; Admin/Super Admin mutations are protected. These settings do not override backend booking, catalog, or billing validation.

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

For a veterinarian it aggregates:

- Personal custom tasks.
- Assigned upcoming online consultations.
- Diagnosis follow-up recording tasks.

Clinic-generated items are read-only and link to their source screen. Personal tasks are editable.

### 22.7 Personal TODO actions

Users can:

- Create a personal task with title and start date.
- Add details, category, and optional end date.
- Update their own personal task.
- Mark it pending, completed, or cancelled.
- Delete their own personal task.

Required schema is checked. A user cannot edit another user’s tasks. Admin-like cross-user access is limited to the effective-user rules in the handler, and the route itself is not available to ordinary Admin.

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
- Filenames use timestamp plus random bytes instead of the user’s original name.

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

## 26. Public status display and clinic availability

The public status/TV routes provide a clinic-facing waiting/in-service/upcoming/billing/completed display by branch. The display is designed for queue operations and avoids exposing diagnosis text or complete private medical records.

The public availability endpoints expose only information needed to select an allowed branch/date/time/service. Final booking creation always repeats protected validation.

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
| Transient network/API outage | Retry, timeout, shared server-down state | Offline private operations are not supported |
| Sensitive form draft | Password/payment/signature/upload fields excluded | Browser/session storage remains a device-local concern |
| Accidental inventory removal | Password, acknowledgement, reason, reference check, report-safe archival, audit | Archived inventory has no self-service restore control |
| Archived user access | Status is returned for administrative display | Archive does not currently block login or existing token use |

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

### 29.5 File storage

- Set IPAWCUS_RUNTIME_MEDIA_ROOT to a persistent directory for production.
- Confirm the PHP process can create/write required subdirectories.
- Confirm the web server cannot directly serve the private root.
- Confirm protected /api/uploads/media requests reach PHP.
- Confirm uploaded files survive application deployments.

### 29.6 Clinic-specific settings

- Active branches.
- Operating hours and closure dates.
- Per-branch service availability.
- Veterinarian branch assignments and schedules.
- Veterinarian current-day presence process.
- Clinic network/IP allowlist for self-service queue.
- Active service catalog with authoritative prices.
- Active payment methods and instructions.
- Current consent templates and assigned contexts.

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
- Some standalone JavaScript/PHP regression scripts exist, but they are not a complete suite.
- Static source review does not prove all current migrations are applied on production.
- Static source review does not prove SMTP, push, meeting, cron, or secure storage are functioning.
- Malware/antivirus scanning is not part of upload handling.
- General login brute-force throttling was not found.

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
| /profile, /users/{id}/* | Profile/password and scoped owner data | Authenticated; owner scope |
| /pet_information, /pet_ownership/*, /pets/* | Pet register, linking, ownership, profile records | Owner/clinic by action |
| /bookings/*, /booking-availability | Booking lifecycle and slots | Availability public; writes scoped |
| /queues/*, /self-service/access | Queue creation, assignment, receive, return, reentry | Owner/Admin/Vet by action |
| /vet-diagnoses/* | Clinical diagnosis and completion | Veterinarian/Super Admin |
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
| /branches, /veterinarian-branch-schedules | Branch and schedule context | Authenticated; mutations restricted |
| /vet-presence | Current visit availability signal | Public read; Admin/Super Admin write |
| /status-display, /tv-status | Public queue status display | Public limited data |
| /lifecycle/recovery-report | Finds completed cases missing billing | Super Admin, read-only |
| /system/problem-report, /health | Maintenance diagnostics | Public, limited/rate-controlled as applicable |

## 34. Source-evidence map

The principal active sources inspected for this reference include:

### Application and access

- src/App.jsx
- src/main.jsx
- src/components/Dashboard.jsx
- src/components/dashboardRouter.jsx
- src/services/apiClient.js
- src/hooks/useAutoRefresh.js
- src/hooks/useSessionFormPersistence.js
- src/context/ThemeProvider.jsx
- php/index.php
- php/role_access.php
- php/auth_access_helpers.php
- php/workflow_guard_helpers.php

### Authentication, profiles, and accounts

- php/login.php
- php/register.php
- php/auth_otp_helpers.php
- php/password_policy_helpers.php
- php/get_accounts.php
- php/create_account.php
- php/delete_account.php
- php/update_account_status.php
- php/update_account_profile.php
- php/get_user_profile.php
- php/update_user_profile.php
- src/components/SuperAdminDashboardComponent/AccountManagement.jsx
- src/components/SuperAdminDashboardComponent/PetOwnerAccountsManagement.jsx
- src/components/AdminDashboardsComponent/adminprofile.jsx
- src/components/VetrinarianComponents/VetProfile.jsx
- src/components/PetOwnerDashboard/PetOwnerProfile.jsx
- DDL/20260914_01_personnel_profile_cleanup.sql

### Pets, booking, queue, and clinical records

- php/add_pet.php
- php/get_pet.php
- php/get_pets.php
- php/update_pet.php
- php/update_pet_status.php
- php/link_pet.php
- php/coparent_requests.php
- php/add_booking.php
- php/get_bookings.php
- php/booking_availability.php
- php/update_booking_status.php
- php/update_booking_schedule.php
- php/receive_booking.php
- php/add_to_queue.php
- php/get_queues.php
- php/update_queue_status.php
- php/assign_queue_vet.php
- php/receive_queue.php
- php/return_queue.php
- php/reenter_queue.php
- php/vet_diagnoses.php
- php/pet_medical_records.php
- php/record_update_requests.php
- php/online_consultations.php
- php/booking_maintenance.php
- php/lifecycle_recovery_report.php
- src/components/PetOwnerDashboard/PetProfile.jsx
- src/components/AdminDashboardsComponent/PetRegister.jsx
- src/components/AdminDashboardsComponent/BookingManagement.jsx
- src/components/AdminDashboardsComponent/QueueManagement.jsx
- src/components/VetrinarianComponents/VetDiagnosis.jsx
- src/components/VetrinarianComponents/VetMylistinService.jsx
- src/components/VetrinarianComponents/VetPetsEMR.jsx

### Grooming and boarding

- php/grooming.php
- php/grooming_helpers.php
- php/grooming_rules.php
- php/grooming_media.php
- php/grooming_upload.php
- php/boarding_management.php
- src/components/shared/GroomingWorkspace.jsx
- src/components/AdminDashboardsComponent/GroomingManagement.jsx
- src/components/AdminDashboardsComponent/PetBoardingManagement.jsx
- DDL/20260906_01_grooming_management.sql

### Services, inventory, and billing

- php/service_catalog.php
- php/special_services.php
- php/inventory.php
- php/inventory_invoice_helpers.php
- php/visit_billing.php
- php/payment_methods.php
- src/components/AdminDashboardsComponent/ServiceCatalogManagement.jsx
- src/components/AdminDashboardsComponent/AllItemsPage.jsx
- src/components/AdminDashboardsComponent/StockInPage.jsx
- src/components/AdminDashboardsComponent/POSmanagement.jsx
- src/lib/invoicePdf.js
- DDL/20260819_01_invoice_pdf_documents.sql

### Consent, notifications, media, and reporting

- php/consent_file_helpers.php
- php/consent_form_records.php
- php/consent_record_helpers.php
- php/notifications.php
- php/notification_helpers.php
- php/pet_owner_todos.php
- php/upload.php
- php/upload_media.php
- php/runtime_media.php
- php/pet_media_monitoring.php
- php/reports_dashboard.php
- php/reports_generate.php
- php/reports_common.php
- php/system_problem_report.php
- src/components/AdminDashboardsComponent/ConsentFileManagement.jsx
- src/components/SuperAdminDashboardComponent/PetMediaMonitoring.jsx
- src/components/SuperAdminDashboardComponent/SuperAdminReportsDashboard.jsx
- src/components/SuperAdminDashboardComponent/SuperAdminReportCenter.jsx
- src/components/SuperAdminDashboardComponent/ReportChartCard.jsx
- src/services/reportService.js

## 35. Validation status of this document

This reference was checked against active source connections, but it does not replace runtime acceptance testing.

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
