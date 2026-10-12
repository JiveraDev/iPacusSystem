# iPawcus System Limitations and ISO/IEC 25010 Screening

Review date: 2026-09-22  
Scope: Current repository, connected workflows, and project documentation.  
Method: Clinic-facing functional assessment supported by source inspection. No production database, live clinic observation, load test, or complete browser acceptance test was performed.

## Executive assessment

iPawcus covers many daily veterinary-clinic tasks. Its stronger areas include booking checks, queue handoff, clinical completion, payment records, and branch-aware workflows. Its most important limitations are account/session security, realistic service capacity, emergency and end-of-life governance, and recovery after an outage.

This is a screening, not a claim that every live deployment has the same configuration or that the product has passed an ISO certification audit. A capability in source is not proof that its migration, worker, storage directory, or external service is operational in production. “Unverified” means there is insufficient observed or measured evidence; it does not mean the feature is broken.
## Recommended capstone-thesis scope

The full inventory below is too broad to present as a separate thesis objective for every screen. The selection here favors features that (1) directly serve the stated veterinary-clinic and pet-owner purpose, (2) form an end-to-end workflow, (3) are connected in the current application, and (4) can be demonstrated and evaluated with test accounts. It is a recommended framing, not an assertion about the project's approved proposal or the clinic's final requirements.

### Five primary features to discuss

| Selected feature | Why it belongs in the capstone scope | Honest functional limitation to disclose |
| --- | --- | --- |
| Role-based owner, administrator, and veterinarian workflows | Different users carry out and hand off the same patient journey; this is the organizing structure of the system. | It supports configured clinic roles and branches, not full human-resources, payroll, credentialing, or staff-capacity management. Do **not** call the current archive behavior an intentional scope limit; it is an access-control issue to resolve. |
| Pet registry, ownership, and electronic medical records | A durable patient identity and history are central to the project title and to later bookings and consultations. | Medical information is recorded and organized by authorized users; the application does not diagnose diseases automatically, replace professional judgment, or manage every specialized clinical/legal record. Owner visibility requires staff release/organization. |
| Appointment booking and availability | Owners request services and staff confirm them; date, branch, service, consent, payment, and conflict checks make this a demonstrable workflow. | Availability is based on configured rules and mostly fixed-length slots. It is not a complete scheduler for procedure duration, rooms, equipment, assistants, and all personnel. |
| Queue-to-veterinarian consultation workflow | It connects arrival, prioritization, assignment, diagnosis, visit completion, and patient history. | Queue priority is not formal emergency triage. The system records veterinary work but does not provide emergency decision support or guarantee a maximum waiting time. |
| Billing, payment review, and inventory traceability | Charges and stock movements connect clinical services to the clinic's financial and material operations. | Non-cash proof is reviewed by staff rather than automatically settled against a provider; inventory transfer is within a branch, and the system is not a complete accounting or procurement platform. |

These five features tell one coherent story: **register a pet → request an appointment → enter and complete the clinical queue → preserve the medical record → bill and account for used materials**. They are stronger thesis objectives than a long list of disconnected pages.

### Supporting features, not separate core objectives unless the approved proposal requires them

| Supporting feature | Appropriate thesis treatment | Boundary to state |
| --- | --- | --- |
| Online consultation | Demonstrate as an alternative consultation channel within the booking and clinical workflow. | Requires working connectivity and meeting configuration; ending a call does not automatically finalize diagnosis or billing. |
| Grooming and boarding | Show as service-specific extensions of booking, monitoring, and billing. | No full groomer-capacity scheduler or complete emergency/abandonment policy; do not present them as a general hospital resource-management system. |
| Consent, notifications, and reports | Discuss as supporting documentation, communication, and management visibility. | Message delivery depends on configured workers/services; reports can have missing-data notices; consent capture is not a complete privacy-governance program. |
| Local backup download | Discuss as an operational safeguard, not as the thesis's disaster-recovery solution. | Restoration is manual and unverified; there is no built-in scheduled, point-in-time, or web-based recovery. |

### Suggested scope-and-limitations wording

> The study focuses on an integrated web-based veterinary-clinic system for pet-owner and clinic accounts. Its primary scope covers pet registration and ownership, electronic medical records, appointment requests and confirmation, queue assignment and veterinarian consultation, and related billing and inventory recording. Online consultation, grooming, boarding, consent documents, notifications, reports, and backup export support these workflows where configured. The system is intended to organize and trace clinic operations; it does not replace a veterinarian's clinical judgment, a formal emergency-triage protocol, external payment settlement, full accounting or human-resources software, or a tested disaster-recovery service. Internet connectivity, correct deployment of database migrations, and configured third-party services remain necessary for the relevant functions.

This wording should be revised to match the **approved proposal, actual evaluation environment, and clinic sign-off**. Do not claim that every module above was validated in production merely because it appears in the application.

### Keep scope limitations separate from defects

It is defensible to state that automatic diagnosis, payment-gateway settlement, offline clinical work, and full emergency governance are **outside the chosen capstone scope** if the proposal did not promise them. It is **not** defensible to relabel an implemented control that behaves incorrectly as a scope limitation. In particular, archived accounts retaining access, existing tokens surviving password reset, unnecessary password-hash fields in responses, and fail-open administrator feature permissions should be recorded as implementation/security findings with corrective or risk-acceptance actions before any production claim.

## Limitations by function

| Function | Current limitation and operational consequence | Evidence |
| --- | --- | --- |
| Registration and accounts | Terms acceptance is required, but a versioned acceptance record and complete privacy-request/retention process were not found. Archiving an account is only an administrative label: the user can still receive and use a valid access token. | `php/register.php`; `php/login.php`; `php/auth_access_helpers.php`; `docs/CURRENT_SYSTEM_CAPABILITIES.md` §30.3 |
| Password and sessions | Changing or resetting a password does not revoke existing access tokens. This weakens recovery after a device or token is compromised. General login throttling was not found. | `php/update_password.php`; `php/auth_reset_password.php`; `php/auth_access_helpers.php`; `php/login.php` |
| Profiles and staff directory | Profile and staff-account responses select all columns from `users`, including the stored password hash, despite not needing that field for the screen. A hash is not a plaintext password, but it should not be sent to a browser. | `php/get_user_profile.php`; `php/get_accounts.php` |
| Administrator permissions | If the optional feature-permissions table is missing or the lookup fails, Admin permissions default to allowed. The management endpoint reports missing setup, but the permission check is fail-open. | `php/role_access.php` |
| Branches and staffing | Branches and vet schedules are represented, but a present/accepting indicator is not a complete plan for room, equipment, assistant, and veterinarian capacity. | `docs/CURRENT_SYSTEM_CAPABILITIES.md` §7 |
| Pets and ownership | Basic ownership and co-parent approval exist. Healthy, Emergency, and Deceased status values are too coarse to manage emergency decisions or end-of-life care. | `docs/CURRENT_SYSTEM_CAPABILITIES.md` §8 |
| Booking | Most services reserve a fixed 30-minute period, including surgery and dental services, while catalog services can have editable durations. A displayed free slot may therefore not represent the actual time a procedure requires. | `php/booking_slot_helpers.php`; `php/booking_availability.php`; `docs/CURRENT_SYSTEM_CAPABILITIES.md` §17.1 |
| Queue | Priority values order work but do not form a complete clinical triage protocol. Self-service joining depends on maintained clinic-network/IP settings and is not strong physical-presence proof. | `docs/CURRENT_SYSTEM_CAPABILITIES.md` §10 |
| Diagnosis and medical records | Clinical completion is linked to the queue and visit, but formal emergency escalation, adverse-event management, controlled-drug records, and a complete discharge/follow-up protocol are not established. Owner-visible records depend on staff organization and release. | `docs/CURRENT_SYSTEM_CAPABILITIES.md` §§11–13, 30.6 |
| Online consultation | Ending the video call does not close the clinical record or billing; staff must complete those separately. The workflow depends on meeting configuration and connectivity. | `docs/CURRENT_SYSTEM_CAPABILITIES.md` §12 |
| Grooming | There is no dedicated groomer-capacity scheduler or verified assistant assignment. Add-ons are descriptive rather than a complete itemized pricing and inventory-consumption subsystem. A vet review does not automatically create a consultation. | `docs/grooming-management.md`; `docs/CURRENT_SYSTEM_CAPABILITIES.md` §15.8 |
| Boarding | Rooms, observations, tasks, materials, and billing are represented, but a full abandonment, emergency-spending, DNR, or remains-handling policy is not established in the application. Clinic procedures must cover these decisions. | `docs/CURRENT_SYSTEM_CAPABILITIES.md` §§16, 30.6 |
| Inventory | Transfers are limited to locations within one branch and are marked received in the direct transfer operation. Removed products retain their reporting history, but archived inventory has no application-level restore control. | `docs/CURRENT_SYSTEM_CAPABILITIES.md` §18 |
| Payments and POS | A submitted proof is not a confirmed payment; staff review remains necessary. Automatic settlement against a payment provider was not established in the reviewed workflow, leaving a reconciliation task. | `docs/CURRENT_SYSTEM_CAPABILITIES.md` §§9.7, 19 |
| Consent and privacy | Consent documents can be captured, but a complete versioning, withdrawal, privacy-data-request, or automated retention/deletion workflow was not found. The clinic must separately determine whether forms and policies are sufficient. | `docs/CURRENT_SYSTEM_CAPABILITIES.md` §§21, 30.6 |
| Notifications | In-app history exists. Email depends on a worker, reminders on a configured scheduler, and push on browser and deployment support. A committed clinic action does not prove that the recipient received a message. | `docs/CURRENT_SYSTEM_CAPABILITIES.md` §22 |
| Reports | Fifteen report types and PDF/Excel exports exist, but a report can generate with omitted sources when schema is missing. There is no active disease-occurrence report. Missing-data notices must be checked before using totals for decisions. | `docs/CURRENT_SYSTEM_CAPABILITIES.md` §§23.4–23.6, 30.2 |
| Backups and outages | Super Admin can download a complete local ZIP. There is no application-scheduled backup, historical ZIP re-download, web restore, point-in-time recovery, or verified end-to-end restore process. The ZIP is not password-encrypted. Private clinic work is not available offline through the PWA. | `docs/BACKUP_RECOVERY.md`; `docs/CURRENT_SYSTEM_CAPABILITIES.md` §§30.1, 30.4–30.5 |
| Media and documents | Authenticated media delivery exists, but protection depends on correct hosting rules and private storage. Runtime-upload directories also exist in the repository; the production deployment process excludes them, but an incorrect deployment could expose files. | `php/runtime_media.php`; `php/upload_media.php`; `scripts/deploy-hostinger.mjs`; `docs/hostinger_git_deployment.md` |

## ISO/IEC 25010:2023: nine-characteristic screening

This report interprets “nine ISO objectives” as the nine product-quality characteristics of [ISO/IEC 25010:2023](https://committee.iso.org/standard/78176.html). The characteristic names are also listed in [ISO's product-quality measurement preview](https://www.iso.org/obp/ui?_escaped_fragment_=iso%3Astd%3Aiso-iec%3A25023%3Adis%3Aed-1%3Av1%3Aen). This qualitative screening does not establish conformity, certification, or a numerical score. Those would require agreed requirements, measures, test conditions, and observed results.

| Characteristic | Screening judgment | Principal gap or uncertainty |
| --- | --- | --- |
| Functional suitability | Partial | Broad operational coverage, but emergency, end-of-life, incident, disease-analysis, and complete capacity workflows are absent or incomplete. |
| Performance efficiency | Unverified | No measured response-time, concurrent-user, large-data, or backup-generation benchmarks were available. Four-second dashboard refreshes and full on-demand exports warrant load testing. |
| Compatibility | Partial / unverified | Web, email, push, and video components exist. Data exchange with other clinic, laboratory, accounting, or payment systems has not been demonstrated. |
| Interaction capability | Unverified | Responsive layouts and shared controls exist, but role-based task completion, accessibility, keyboard/screen-reader use, and training outcomes require observation across devices. |
| Reliability | Partial | Transactions and conflict checks are strengths. Offline clinical operation and a proven restoration process are missing. |
| Security | Significant gaps | Archive does not revoke access; password changes leave existing tokens valid; unnecessary password hashes reach API responses; login throttling and deployed media protection require attention. |
| Maintainability | Partial | Documentation and standalone checks exist, and lint passed during this review. There is no unified end-to-end suite; many workflows depend on ordered migrations and external configuration. |
| Flexibility | Partial | Branches, catalog, roles, and themes are configurable. Fixed booking durations and limited grooming/staff capacity constrain adaptation to real schedules. |
| Safety | Significant gaps | Complete triage, DNR, euthanasia, adverse-event, controlled-drug, and emergency-authorization workflows were not found. Clinic procedures must cover them outside the application. |

## Recommended priority order

1. Stop sending unnecessary sensitive user fields to browsers, and define effective account deactivation and token revocation on password recovery.
2. Verify a complete backup restoration, deployed media protection, migrations, mail worker, reminders, push, and meeting configuration in a safe staging environment.
3. Make appointment capacity reflect actual procedure duration, people, rooms, and equipment; test collision behavior with real clinic schedules.
4. Define clinic-owned emergency, consent, DNR, end-of-life, incident, and controlled-drug procedures, then decide which must become enforceable system workflows.
5. Conduct observed, role-by-role booking-to-payment and boarding/grooming acceptance tests at phone, tablet, and desktop sizes, including accessibility checks.
6. Establish measurable ISO acceptance criteria before assigning scores or claiming conformity.

## Verification and boundaries

- `npm run lint` passed during this review.
- Spot checks with `php -l` passed for `php/get_user_profile.php` and `php/system_backups.php`.
- JavaScript tests could not be completed in the restricted environment because the test runner could not spawn child processes; that is an environment limitation, not evidence that the tests failed functionally.
- Production database migrations, live data, clinic workflow, accessibility, browser behavior, load, and disaster-recovery restoration were **not** verified.
- Existing debug bypasses in `src/components/Dashboard.jsx` and `src/components/dashboardRouter.jsx` were not changed. Frontend navigation is not the backend authorization boundary.

## Principal repository references

- `docs/CURRENT_SYSTEM_CAPABILITIES.md` — current capability and process reference.
- `docs/grooming-management.md` — grooming first-release scope and known limitations.
- `docs/BACKUP_RECOVERY.md` — local-export contents and recovery limitations.
- `docs/hostinger_git_deployment.md` — media and deployment dependencies.
- `php/role_access.php`, `php/auth_access_helpers.php`, `php/login.php` — role, token, and login behavior.
- `php/booking_slot_helpers.php`, `php/booking_availability.php` — service time-slot behavior.
- `php/get_user_profile.php`, `php/get_accounts.php` — profile/account response fields.
