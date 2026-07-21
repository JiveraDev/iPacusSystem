# iPawcus Legal, Privacy, Consent, and Veterinary Workflow Audit

Date: 2026-07-21  
Scope: Repository-factual audit for future Philippine legal and clinic workflow documents.  
Repository root: `C:\Users\Admin\WebstormProjects\untitled1`

This report is based on repository evidence only. It is not legal advice and does not draft final Terms, Privacy Notice, or consent forms. No private credentials or real client/patient records are reproduced here.

Fact labels:

- CONFIRMED: directly supported by code, schema, or repository documentation.
- INFERRED: strongly suggested by repository evidence, but not explicitly stated as policy.
- UNKNOWN: requires an answer from the clinic owner or is not found in the repository.
- CONFLICT: different parts of the system behave differently.

## A. Executive Summary

- CONFIRMED: iPawcus is a veterinary clinic management and EMR system. Evidence: `README.md:1`, `README.md:3`, `public/pwa/manifest.webmanifest:3-5`.
- CONFIRMED: iPawcus is the system name, and the clinic/operator name is Vetfocus Animal Care Clinic. Evidence: `src/reusecomponent/landingpagecontent.jsx:38-44`, `src/components/shared/ConsentDocument.jsx:35`, `src/components/StatusDisplay/TVStatusDisplay.jsx:269`.
- UNKNOWN: No Data Protection Officer, privacy officer, or formal privacy contact was found.
- CONFIRMED: Account, pet, booking, queue, EMR, consent, payment, notification, upload, boarding, online-consultation, and reporting workflows exist. Evidence: `docs/system_inventory_gantt_details.md:46-57`, `docs/system_inventory_gantt_details.md:98-166`.
- CONFIRMED: Registration does not currently enforce account-level Terms, Privacy Notice, privacy processing consent, or optional marketing consent acceptance tracking. Evidence: registration fields at `php/register.php:8-17`; no matching acceptance fields in `DDL/database_ddl_20260622_070744.sql:969-989`.
- CONFLICT: Backend route authorization exists, but repository documentation notes a dashboard/router debug-bypass mismatch. Evidence: `php/index.php:42-51`, `php/role_access.php:109-220`, `docs/system_inventory_gantt_details.md:10`, `docs/system_inventory_gantt_details.md:61`.
- HIGH-RISK GAP: Pet death, euthanasia, DNR, remains handling, necropsy, incident reporting, humane restraint, and emergency spending authority are mostly absent from enforceable code/schema.

## B. Confirmed System Identity

| Status | Finding | Evidence |
|---|---|---|
| CONFIRMED | System names include `iPawcus`, `iPawcus Pet Care System`, and `Pet EMR & Management System`. | `README.md:1`, `public/pwa/manifest.webmanifest:3-5` |
| CONFIRMED | Clinic shown to users as Vetfocus Animal Care Clinic in landing/dashboard UI. | `src/reusecomponent/landingpagecontent.jsx:38-44`, `src/components/PetOwnerDashboard/Home.jsx:44-45` |
| CONFIRMED | Consent document uses Vetfocus Animal Care Clinic as the clinic/operator name. | `src/components/shared/ConsentDocument.jsx:35`, `src/components/shared/ConsentDocument.jsx:77` |
| CONFIRMED | TV display pairs the iPawcus system name with Vetfocus Animal Care Clinic. | `src/components/StatusDisplay/TVStatusDisplay.jsx:269` |
| CONFIRMED | Mail sender name defaults to Vetfocus Animal Care Clinic. | `php/mail_helpers.php:31` |
| CONFIRMED | Domain/deployment examples include `ipawcus.com`, API subdomain, and Jitsi/meet subdomain options. | `README.md:137-170`, `README.md:177-188` |
| CONFIRMED | Production example config contains secrets/config values. Values are redacted in this report. | `.env.example.production:1`, `.env.example.production:3`, `.env.example.production:5-13`, `.env.example.production:21-27`, `.env.example.production:32`, `.env.example.production:36-38` |
| INFERRED | Applicable location/jurisdiction is Lucena City, Quezon, Philippines. | Address signals in `src/reusecomponent/landingpagecontent.jsx:38-44`; PH address filter at `src/services/addressAutocomplete.js:19` |
| UNKNOWN | Registered legal business name, DPO, official privacy contact, and final governing venue are not established in the repository. | Requires clinic-owner answer |

## C. User and Role Matrix

Backend route policy is centralized. Evidence: `php/index.php:42-51`, `php/role_access.php:65-220`.

| Area | Pet Owner / Client | Veterinarian | Admin / Staff | Super Admin / Owner | Enforcement |
|---|---|---|---|---|---|
| User profiles | Can use profile UI; backend profile route accepts all roles and supplied IDs. | Same. | Same. | Same. | CONFLICT/GAP: `php/role_access.php:85`, `php/get_user_profile.php:6-16`, `php/update_user_profile.php:5-22` |
| Account creation | Public registration; UI pet-owner focused. | Staff account created by Super Admin flow. | Staff account created by Super Admin flow. | Can create staff accounts. | CONFIRMED: `php/register.php:8-17`, `php/create_account.php:41-84`, `php/role_access.php:69-70` |
| Pet profiles | Create/link own pets; view owned/co-parent pets. | Clinic read/workflow access. | Create/update via pet registry. | Same. | CONFIRMED: `php/add_pet.php:49-77`, `php/link_pet.php:8-116`, `php/role_access.php:165-178` |
| Pet ownership | Claim by sharable ID; request co-parent access. | Clinic visibility. | Staff can manage pet records. | Broader owner/account controls. | CONFLICT: `php/coparent_requests.php:25-140`, base one-owner DDL `DDL/database_ddl_20260622_070744.sql:717-726`, co-parent deployment SQL `DDL/20260710_deployment_required_all.sql:9-34` |
| Bookings | Create/cancel own authorized bookings. | Clinic view; assigned online-consult actions. | Create, confirm, cancel, reschedule, receive. | Same. | CONFIRMED: `php/role_access.php:109-118`, `php/update_booking_status.php:296-343` |
| Queue entries | Create self-service queue; cancel own queue in UI. | Receive/return assigned queue. | Create/assign/reenter/status. | Same. | CONFIRMED: `php/role_access.php:121-134`, `php/receive_queue.php:23-35`, `php/return_queue.php:23-83` |
| Consent templates | View assigned/available contexts. | View clinic contexts. | Create/update/delete templates. | Same. | CONFIRMED: `php/role_access.php:153-158`, `php/add_consent_file.php:22-28` |
| Consent records | Owner/clinic access. | Clinic access. | Clinic access. | Clinic access. | CONFIRMED: `php/role_access.php:161-162`, `php/consent_record_helpers.php:266-283` |
| EMRs | Owner-visible organized records only. | Vet/clinic medical workflows. | Clinic medical workflows. | Same. | CONFIRMED: `php/pet_medical_records.php:993-1019`, `php/pet_medical_records.php:1755-1799` |
| Diagnoses/prescriptions | View if released/owner-visible. | Finalize assigned/own vet cases. | Operational support, not primary finalizer. | Super Admin included in vet role group. | CONFIRMED: `php/vet_diagnoses.php:715-740`, `php/vet_diagnoses.php:790-860`, `php/vet_diagnoses.php:889-994` |
| Lab results/images | Owner-visible only when organized/released. | Create/view clinical records. | Admin workflow access. | Vet/Super Admin media monitoring. | CONFIRMED: `DDL/database_ddl_20260622_070744.sql:1074-1079`, `php/role_access.php:145-146` |
| Payments/proofs | Upload proof for booking/payment flows. | Limited clinical/billing context. | POS/visit billing. | Payment-method settings. | CONFIRMED: `php/upload.php:27-30`, `php/visit_billing.php:1276-1345`, `php/payment_methods.php:136-162` |
| Invoices/receipts | View through owner/payment flows where exposed. | Workflow context. | POS print/image generation. | Reports. | CONFIRMED: `src/components/AdminDashboardsComponent/POSmanagement.jsx:772`, `php/visit_billing.php:1118-1170` |
| Notifications | Own notifications/preferences. | Own notifications/preferences. | Own notifications/preferences. | Own notifications/preferences. | CONFIRMED: `php/notifications.php:272-432`, `DDL/database_ddl_20260622_070744.sql:997-1023` |
| Reports/export/print | No. | No. | No. | Yes. | CONFIRMED: `php/reports_common.php:28-39`, `php/reports_generate.php:8-21`, `src/components/SuperAdminDashboardComponent/SuperAdminReportCenter.jsx:242-250`, `src/components/SuperAdminDashboardComponent/SuperAdminReportCenter.jsx:487`, `src/components/SuperAdminDashboardComponent/SuperAdminReportCenter.jsx:526` |
| Deceased pet records | Pet status visible in own pet context. | Clinic access. | Can update pet status in clinic routes. | Same. | CONFIRMED status only: `DDL/database_ddl_20260622_070744.sql:632`, booking blocks `php/add_booking.php:110-137` |
| Audit logs | UNKNOWN. | UNKNOWN. | UNKNOWN. | UNKNOWN. | No general `audit_log` table found; notification/email/payment timestamps exist. |

## D. Personal Data Inventory

| Status | Data category | Subject | Source / collection point | Purpose | Access | Storage / evidence | Retention / sharing | Required? |
|---|---|---|---|---|---|---|---|---|
| CONFIRMED | Name, email, address, phone | User/client/staff | Registration/profile | Account, contact, booking | Role-scoped generally, profile gap noted | `php/register.php:8-17`, `DDL/database_ddl_20260622_070744.sql:969-989` | Retention UNKNOWN | Required except some profile fields |
| CONFIRMED | Emergency contact/number | User or third person | Registration, boarding/booking | Emergency contact | Clinic booking views | `DDL/database_ddl_20260622_070744.sql:978`, `DDL/database_ddl_20260622_070744.sql:192` | Retention UNKNOWN | Optional in registration; used in boarding |
| CONFIRMED | Birthdate/profile photo | User | Profile | Profile display | Profile route gap | `DDL/database_ddl_20260622_070744.sql:986-987`, upload roles `php/upload.php:27-30` | Retention UNKNOWN | Optional |
| CONFIRMED | Password hash | User | Registration/reset/change | Authentication | Backend DB only | `php/register.php:39`, `php/auth_reset_password.php:40`, `php/update_password.php:45` | Retention UNKNOWN | Required for password auth |
| CONFIRMED | OTP email, token hash, IP, user agent | User | Email verification/reset/payment settings | Security verification | Backend | `DDL/database_ddl_20260622_070744.sql:264-284`, `php/auth_otp_helpers.php:182`, `php/auth_otp_helpers.php:208-223` | Cleanup indexed, period UNKNOWN | Required for OTP flows |
| CONFIRMED | Staff government/employment IDs | Admin staff | Staff profile | Employment/admin profile | Admin/Super Admin account views | `DDL/database_ddl_20260622_070744.sql:14-33` | Retention UNKNOWN | Optional in schema |
| CONFIRMED | Veterinarian license/PRC/profile | Veterinarian | Vet profile/account | Vet identity, schedule, assignment | Clinic/admin/vet views | `DDL/database_ddl_20260622_070744.sql:1031-1044` | Retention UNKNOWN | PRC field nullable |
| CONFIRMED | Push endpoint, public key, auth token, user agent | User/device | Browser notification subscription | Browser push notifications | Backend notification system | `DDL/database_ddl_20260622_070744.sql:495-512`, `php/notification_helpers.php:825-883` | Unsubscribe supported; retention otherwise UNKNOWN | Optional |
| CONFIRMED | Booking history, service, price, payment proof, concern images | Owner/pet | Booking/payment forms | Service approval/payment | Owner/clinic scoped, with media conflict | `DDL/database_ddl_20260622_070744.sql:158-193`, `php/upload.php:69-148` | Retention UNKNOWN | Required depending service/payment |
| CONFIRMED | Consent signatures/forms | Owner/signer | Booking, queue, home, boarding, online consult | Consent proof | Owner/clinic/admin depending endpoint | `DDL/20260619_create_consent_form_records.sql:1-24`, `php/consent_record_helpers.php:266-283` | Withdrawal behavior UNKNOWN | Required for some services |
| CONFIRMED | Pet ownership/co-owner data | Owner/co-parent | Add/link pet, co-parent request | Access control | Owner/clinic scoped | `php/link_pet.php:74-116`, `php/coparent_requests.php:25-140` | Dispute/revocation policy UNKNOWN | Required for owner access |
| CONFIRMED | Pet medical data | Pet linked to owner | Diagnosis/EMR/vaccination/allergy | Veterinary care | Owner-visible or clinic-only | `DDL/database_ddl_20260622_070744.sql:1056-1093`, `php/pet_medical_records.php:993-1019` | Retention UNKNOWN | Necessary for care |
| CONFIRMED | Email/notification history | User | Notification helper/events | Updates/reminders | Own notifications; backend | `DDL/database_ddl_20260622_070744.sql:997-1023`, `php/notification_helpers.php:336-349` | Deletion policy UNKNOWN | Generated |
| CONFIRMED | Browser local/session data | User/device | Frontend login/booking/call state | Session, pending booking, video call | Browser-local | `src/components/Login.jsx:39-44`, `src/App.jsx:265-332`, `src/context/VideoCallProvider.jsx:13-78` | Cleared in some flows; no global retention policy | Operational |

## E. Data Flow and Third-Party Sharing Matrix

| Status | Provider/service | Data shared | Purpose / trigger | User informed? | Necessary/optional | Evidence |
|---|---|---|---|---|---|---|
| CONFIRMED | MySQL/database | System records | Core persistence | Not via privacy notice found | Necessary | `README.md:67`, `DDL/database_ddl_20260622_070744.sql` |
| CONFIRMED | SMTP email service / Hostinger SMTP config | Recipient email, subject, notification/OTP content | OTP, booking, queue, account, billing notices | Notification preference UI exists; no privacy notice found | Necessary for email notices; optional per prefs | `.env.example.production:21`, `php/mail_helpers.php:528-541`, `php/notification_helpers.php:435-495` |
| CONFIRMED | Mail queue worker | Email address/content/status/errors | Queued delivery | Not specifically in user-facing policy | Operational | `DDL/20260710_mail_queue.sql:1-23`, `php/mail_queue_worker.php:5-29`, `php/mail_helpers.php:189-243` |
| CONFIRMED | Browser push service | Push endpoint/key/auth token, notification title/body/path | Browser notifications | UI asks browser permission; no third-party policy link found | Optional | `src/services/pushNotificationService.js:109-136`, `php/notification_helpers.php:913-1041` |
| CONFIRMED | Jitsi / configured meet server | Meeting room URL; live audio/video occurs in iframe | Online consultation | UI shows online consultation | Necessary for online consult | `php/online_consultation_helpers.php:41-57`, `src/context/VideoCallProvider.jsx:301-302` |
| CONFLICT | Google Meet / Google Calendar | Schema supports provider/event ID, but runtime helper creates Jitsi | Potential unused/legacy integration | Not clear | UNKNOWN | `DDL/database_ddl_20260622_070744.sql:527-530`, `php/online_consultation_helpers.php:105` |
| CONFIRMED | Geoapify | Address search query, country filter PH, returned address data | Address autocomplete | No privacy notice link found | Optional UI convenience | `src/services/addressAutocomplete.js:1`, `src/services/addressAutocomplete.js:19`, `src/services/addressAutocomplete.js:24`, `src/services/addressAutocomplete.js:36-40` |
| CONFIRMED | QRPH, Maya, GCash, bank transfer labels | Payment reference/proof/sender detail entered by user; no gateway API found | Manual payment verification | Payment UI displays methods/instructions | Optional by selected method | `php/payment_methods.php:8`, `php/payment_methods.php:100-103`, `src/components/PetOwnerDashboard/ConsultPayment.jsx:461-479` |
| UNKNOWN | SMS provider | None found | SMS not implemented in repo | No | UNKNOWN | No SMS integration found |
| UNKNOWN | Analytics/error reporting | None found | No analytics/error service confirmed | No | UNKNOWN | No active analytics integration found |
| UNKNOWN | Backup/cloud storage/government reporting/labs/other clinics | None confirmed | Outside repo | No | UNKNOWN | Requires clinic answer |

## F. Pet Ownership and Authorization Rules

- CONFIRMED: Adding a pet creates a sharable pet ID. Evidence: `php/add_pet.php:49-53`.
- CONFIRMED: A registered user can link/claim a pet by sharable ID. Evidence: `php/link_pet.php:8-30`.
- CONFIRMED: If a primary owner exists, co-parent linking creates a request and requires approval/decline/cancel workflow. Evidence: `php/link_pet.php:74-89`, `php/coparent_requests.php:74-140`.
- CONFLICT: Base DDL allows one ownership row per pet, while deployment SQL adds co-parent fields and request table. Evidence: `DDL/database_ddl_20260622_070744.sql:717-726`, `DDL/20260710_deployment_required_all.sql:9-34`, `DDL/20260710_deployment_required_all.sql:80-125`.
- UNKNOWN: No ownership-dispute process, previous-owner access removal rule, authorized representative pickup rule, or emergency-contact treatment authority rule was found.
- UNKNOWN: No rule states which co-owner may sign invasive procedure consent.
- CONFIRMED: Deceased pets are blocked from new/confirmed booking flows. Evidence: `php/add_booking.php:110-137`, `php/update_booking_status.php:200-201`, `php/receive_booking.php:88-90`.

## G. Service, Payment, Cancellation, and Refund Rules

### Backend-Enforced Rules

- CONFIRMED: Booking service enum includes consultation, vaccination, grooming, dental, General Check-up, surgery, kapon, lab-testing, parasite-control, boarding, home-service, and special services. Evidence: `DDL/database_ddl_20260622_070744.sql:163`.
- CONFIRMED: Booking statuses are pending, confirmed, completed, and cancelled. Evidence: `DDL/database_ddl_20260622_070744.sql:166`, `php/workflow_guard_helpers.php:171-188`.
- CONFIRMED: Queues can only be completed through matching service/diagnosis workflow. Evidence: `php/update_queue_status.php:27-40`, `php/workflow_guard_helpers.php:201-218`.
- CONFIRMED: Backend official booking price reads `service_catalog.base_price` except hardcoded online/home/boarding rules. Evidence: `php/add_booking.php:605-631`, `php/add_booking.php:692-704`.
- CONFIRMED: Online consultation backend price is `500`. Evidence: `php/add_booking.php:692`.
- CONFIRMED: Home-service backend price/transport is much lower than the current display projection. Evidence: `php/add_booking.php:696`, `php/add_booking.php:1101`.
- CONFIRMED: Boarding has backend room/add-on pricing. Evidence: `php/add_booking.php:649-658`, `php/add_booking.php:700`.
- CONFIRMED: Service catalog supports materials with `included`, `separate`, or `optional` billable policy. Evidence: `DDL/database_ddl_20260622_070744.sql:900-906`, `php/service_catalog.php:280-321`.
- CONFIRMED: Payment methods include QRPH, Maya, GCash, and bank transfer; payment proof is required by payment-method settings. Evidence: `php/payment_methods.php:8`, `php/payment_methods.php:100-103`, `DDL/database_ddl_20260622_070744.sql:603-611`.
- CONFLICT: POS UI/code supports cash, but June 22 DDL `visit_payments.payment_method` excludes cash and backend returns a readiness error if enum lacks it. Evidence: `src/components/AdminDashboardsComponent/POSmanagement.jsx:96`, `php/visit_billing.php:91-98`, `php/visit_billing.php:1276-1280`, `DDL/database_ddl_20260622_070744.sql:1205`.

### UI-Only or Display-Only Rules

- CONFIRMED: Client-facing price projections are frontend/localStorage display config, not DB billing policy. Evidence: `src/lib/servicePriceProjections.js:4-14`, `src/lib/servicePriceProjections.js:17-44`, `src/lib/servicePriceProjections.js:276-287`.
- CONFIRMED: Admin/Super Admin can configure visible booking display labels/prices in Booking Management UI only. Evidence: `src/components/AdminDashboardsComponent/BookingManagement.jsx:59-90`, `src/components/AdminDashboardsComponent/BookingManagement.jsx:1749-1811`.
- CONFLICT: Special service defaults include `Free` for kapon and `PHP 5,000 - PHP 15,000` for special surgery, while projection config says kapon starts at PHP 1,500 and special surgery PHP 5,000-PHP 20,000+. Evidence: `php/special_services.php:317-331`, `src/lib/servicePriceProjections.js:13-14`.
- CONFIRMED: UI text says payment will be verified within 24 hours; no backend 24-hour SLA enforcement was found. Evidence: `src/components/PetOwnerDashboard/ConsultPayment.jsx:283-284`, `src/components/PetOwnerDashboard/PaymentSubmission.jsx:167-170`.
- CONFIRMED: UI text says cancellation request may include wallet/transaction for refund/return; backend stores the cancellation message/wallet/transaction in notes, but no refund rule is automated. Evidence: `src/components/PetOwnerDashboard/ConsultConfirmation.jsx:352`, `php/update_booking_status.php:377-390`.
- UNKNOWN: Deposits, no-show fees, refund eligibility, medication/supply charge separation by service, emergency-care pricing, and refund timelines require clinic policy answers.

## H. Medical Consent Matrix

| Status | Service/procedure | Risk | Required consent | Who may sign | When signed | Withdrawal | Emergency exception | Current system support | Missing clinic decision |
|---|---|---:|---|---|---|---|---|---|---|
| UNKNOWN | General examination | Low/medium | Not specifically required | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | Booking/queue consent possible | Whether routine exam needs written consent |
| UNKNOWN | Vaccination | Low/medium | Not specifically required | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | Service/booking + vaccination record | Adverse reaction consent |
| UNKNOWN | Medication administration | Medium | Not specifically required | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | Diagnosis/POS medication fields | Medication-risk consent |
| UNKNOWN | Blood collection | Medium | Not found | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | Lab/result text only | Sampling consent |
| UNKNOWN | Laboratory testing | Medium | Not specifically required | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | Booking enum + lab result field | Lab consent/ownership of samples |
| UNKNOWN | Imaging | Medium | Not specifically required | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | Attachments/source uploads | X-ray/ultrasound consent |
| UNKNOWN | Sedation | High | Not found | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | No sedation-specific field found | Sedation policy |
| UNKNOWN | Anesthesia | High | Not found | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | Surgery service only | Anesthesia consent/checklist |
| UNKNOWN | Surgery | High | Not specifically required | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | Booking/special service exists | Procedure-specific risks |
| UNKNOWN | Dental extraction | High | Not specifically required | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | Dental service exists | Extraction authority |
| UNKNOWN | Wound suturing | Medium/high | Not found | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | Diagnosis/treatment text only | Wound-care consent |
| UNKNOWN | Grooming | Low/medium | Not specifically required | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | Booking service exists | Matting/injury/aggressive-pet policy |
| CONFIRMED/UNKNOWN | Confinement | Medium/high | Not explicit | Owner/clinic UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | Boarding/visit statuses exist | Medical confinement agreement terms |
| CONFIRMED | Boarding | Medium | Signed liability consent required for booking | Pet owner presumed, not legally defined | Before payment/activation | UNKNOWN | UNKNOWN | `php/add_booking.php:795-797`, `src/components/PetOwnerDashboard/PetHotel.jsx:408-413` | Abandonment, emergencies, remains |
| CONFIRMED | Home service | Medium | Signed owner consent required | Pet owner presumed, not legally defined | Before submission | UNKNOWN | UNKNOWN | `php/add_booking.php:861-863`, `src/components/PetOwnerDashboard/HomeServiceConfirmation.jsx:126-197` | Travel, safety, access |
| CONFIRMED | Online consultation | Medium | UI checkboxes plus assigned consent/signature | Pet owner presumed | Before payment/submission | UNKNOWN | UNKNOWN | `src/components/PetOwnerDashboard/ConsultPayment.jsx:133-138`, `php/add_booking.php:861-863` | Recording, failed calls, emergency exclusion |
| UNKNOWN | Emergency stabilization | High | Not found | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | Pet status `Emergency` only | Stabilization authority |
| UNKNOWN | CPR/DNR | Highest | Not found | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | No DNR/CPR fields found | CPR/DNR policy |
| UNKNOWN | Euthanasia | Highest | Not found | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | No euthanasia fields found | End-of-life authority |
| UNKNOWN | Necropsy | High | Not found | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | No necropsy fields found | Post-mortem policy |
| UNKNOWN | Handling of remains | High/sensitive | Not found | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | No remains fields found | Release/cremation/burial policy |

Consent evidence: `DDL/20260619_create_consent_form_records.sql:1-24`, `php/consent_record_helpers.php:147-164`, `php/consent_record_helpers.php:266-283`, `php/consent_record_helpers.php:386-428`.

## I. Humane Handling and Incident-Prevention Findings

| Item | Status | Repository finding |
|---|---|---|
| Humane restraint | UNKNOWN | No policy/workflow found |
| Muzzles | UNKNOWN | No handling-policy reference found |
| Sedation authorization | UNKNOWN | No sedation consent/workflow found |
| Aggressive/fearful pets | UNKNOWN | No dedicated field/policy found |
| Bite incidents | UNKNOWN | No bite incident field/report found |
| Escape/lost-pet incidents | UNKNOWN | No workflow found |
| Staff injury | UNKNOWN | No workflow found |
| Pet injury during handling | UNKNOWN | No workflow found |
| Medication errors | UNKNOWN | No incident/error workflow found |
| Incorrect-pet/procedure prevention | INFERRED partial | Pet/booking/queue IDs exist, but no checklist or verification step. Evidence: bookings `DDL/database_ddl_20260622_070744.sql:158-193`, queues `DDL/database_ddl_20260622_070744.sql:816-825`, pet IDs `DDL/database_ddl_20260622_070744.sql:626-642` |
| Identity verification before treatment | INFERRED partial | Sharable pet ID/ownership exists, but no pre-treatment identity checklist. Evidence: `php/add_pet.php:49-53`, `php/link_pet.php:8-30` |
| Allergy verification | CONFIRMED partial | Allergies can be stored/displayed; no forced verification before procedure. Evidence: `DDL/database_ddl_20260622_070744.sql:637`, `DDL/database_ddl_20260622_070744.sql:651-658`, `src/components/PetOwnerDashboard/PetProfile.jsx:800-819` |
| Surgical checklist | UNKNOWN | Not found |
| Anesthesia monitoring | UNKNOWN | Not found |
| Handover/discharge instructions | INFERRED partial | Follow-up/prescription/notes exist, but no formal discharge workflow. Evidence: `DDL/database_ddl_20260622_070744.sql:1073-1079` |
| Incident reports | UNKNOWN | No incident-report table/workflow found |
| CCTV/image recording | UNKNOWN | Upload/media monitoring exists; CCTV policy not found. Evidence for media only: `php/role_access.php:145-146` |
| Owner notification | CONFIRMED general | Notifications exist for booking/queue/diagnosis/payment, not incident-specific. Evidence: `php/notification_helpers.php:1494-1575`, `php/notification_helpers.php:1810-1888`, `php/notification_helpers.php:2263` |
| Internal investigation | UNKNOWN | Not found |
| Complaint escalation | UNKNOWN | Not found |
| Veterinary supervision | INFERRED partial | Vet assignment/finalization is enforced, but no supervision policy found. Evidence: `php/receive_queue.php:23-35`, `php/vet_diagnoses.php:715-740` |
| Staff authorization/role limits | CONFIRMED | Backend role policy exists. Evidence: `php/role_access.php:65-220` |

## J. Emergency, Deterioration, Pet Death, and Remains Findings

- CONFIRMED: Pet status can be `Emergency` or `Deceased`. Evidence: `DDL/database_ddl_20260622_070744.sql:632`.
- CONFIRMED: Deceased pets are blocked from future booking/confirmation/receiving workflows. Evidence: `php/add_booking.php:110-137`, `php/update_booking_status.php:200-201`, `php/receive_booking.php:88-90`.
- CONFIRMED: Boarding has assignments, observations, tasks, and documents that can support monitoring, but not a legal deterioration/death policy. Evidence: `DDL/database_ddl_20260622_070744.sql:41-58`, `DDL/database_ddl_20260622_070744.sql:66-88`, `DDL/database_ddl_20260622_070744.sql:96-150`.
- UNKNOWN: No owner-selected emergency spending limit was found.
- UNKNOWN: No required owner-contact attempt count/timing was found.
- UNKNOWN: Emergency contacts are stored, but no authority-to-consent rule was found. Evidence for storage only: `DDL/database_ddl_20260622_070744.sql:978`, `DDL/database_ddl_20260622_070744.sql:192`.
- UNKNOWN: No transfer-to-another-clinic policy was found.
- UNKNOWN: No CPR, DNR, euthanasia, remains, cremation, burial, or necropsy workflow was found.
- UNKNOWN: No death time, cause, circumstances, owner notification, release of remains, or incident investigation fields were found beyond `pet_status`.
- INFERRED: No broad "clinic is never responsible under any circumstances" waiver was found in searched repository text. External paper forms remain UNKNOWN.
- UNKNOWN: The repository does not encode distinctions between death caused by illness/unavoidable treatment risk, unexpected adverse event, alleged negligence/mishandling, or intentional cruelty/misconduct.

## K. Privacy, Retention, Security, and Data-Subject Rights

| Status | Topic | Finding | Evidence |
|---|---|---|---|
| CONFIRMED | Authentication | Token-based access is used; token hash stored server-side. | `README.md:11`, `php/auth_access_helpers.php:42-66`, `php/login.php:147-153` |
| CONFIRMED | Token sources | Bearer, `X-Access-Token`, query `access_token`, and cookie token are accepted. | `php/auth_access_helpers.php:90-107` |
| CONFIRMED | Password hashing | Uses `password_hash` and `password_verify`. | `php/register.php:39`, `php/login.php:119`, `php/update_password.php:39-45` |
| CONFIRMED | Email verification | Login blocks accounts without `email_verified_at`. | `php/login.php:125-130`, `php/auth_verify_email.php:32` |
| CONFIRMED | Account deactivation | Login blocks deactivated accounts. | `php/login.php:49-57`, `php/delete_account.php:194-198` |
| CONFIRMED | CORS | API currently allows all origins. | `php/index.php:3-5` |
| CONFIRMED | Error display | PHP display errors are enabled. | `php/index.php:14-15` |
| CONFIRMED | Upload restrictions | Upload role/type allowlist, blocked extensions, MIME sniffing, and protected URL return exist. | `php/upload.php:26-34`, `php/upload.php:45-59`, `php/upload.php:100-121`, `php/upload.php:141-148` |
| CONFLICT | File access | Protected `/api/uploads/media` exists, but root `.htaccess` rewrites direct public media paths. | `php/upload_media.php:10-58`, `.htaccess:19`, `src/lib/image.js:84-107` |
| CONFIRMED | Medical record export | Owner print/email copy is owner-visible only; private images/attachments remain view-only inside iPawcus per email text. | `src/components/PetOwnerDashboard/MedicalRecords.jsx:131-142`, `php/pet_medical_records.php:1291-1309` |
| CONFIRMED | Super Admin reports | Reports can be generated, printed, and CSV-exported. | `php/reports_generate.php:8-21`, `src/components/SuperAdminDashboardComponent/SuperAdminReportCenter.jsx:242-250`, `src/components/SuperAdminDashboardComponent/SuperAdminReportCenter.jsx:487`, `src/components/SuperAdminDashboardComponent/SuperAdminReportCenter.jsx:526` |
| CONFIRMED | Correction procedure | Pet record update request workflow exists. | `DDL/database_ddl_20260622_070744.sql:757-789`, `php/record_update_requests.php:249-280`, `php/record_update_requests.php:329-479` |
| UNKNOWN | Retention periods | No actual retention periods found. | Requires owner policy |
| UNKNOWN | Account deletion effect on medical/billing records | Deactivation exists; full deletion/record-retention policy not defined. | `php/delete_account.php:194-217` |
| UNKNOWN | Backup behavior | No verified backup workflow found. | Requires owner/hosting answer |
| UNKNOWN | Data portability | CSV reports and medical email copies exist, but no formal data portability right workflow found. | See report/medical citations above |
| UNKNOWN | Objection/withdrawal | No privacy objection or consent-withdrawal mechanism found. | Requires policy |
| UNKNOWN | Privacy complaint/breach notification | No workflow found. | Requires policy |
| UNKNOWN | Rate limiting | No general login/API rate limiting confirmed. OTP resend throttling exists. | `php/payment_methods.php:211`, `php/auth_otp_helpers.php:170-188` |

## L. Existing Legal Text and Acceptance Mechanism

| Status | Text / mechanism | Location | Audience / timing | Mandatory? | Recorded? | Notes |
|---|---|---|---|---|---|---|
| CONFIRMED | "I agree to the online consultation fee and terms" | `src/components/PetOwnerDashboard/ConsultPayment.jsx:327` | Pet owner, online-consult payment | UI mandatory | Partly via signed consent/payment submission, not account terms version | UI-only checkbox text |
| CONFIRMED | "I authorize online veterinary consultation" | `src/components/PetOwnerDashboard/ConsultPayment.jsx:342` | Pet owner, online consult | UI mandatory | Consent/signature sent | Specific online-consult consent UI |
| CONFIRMED | "may require an in-clinic follow-up" | `src/components/PetOwnerDashboard/ConsultPayment.jsx:345` | Pet owner | UI mandatory with checkbox | Not separately versioned | Important clinical limitation |
| CONFIRMED | "No online consultation consent form is assigned..." | `src/components/PetOwnerDashboard/ConsultPayment.jsx:138`, `src/components/PetOwnerDashboard/ConsultPayment.jsx:314` | Pet owner | Blocks submission | N/A | Consent template assignment required |
| CONFIRMED | Home-service consent assignment required | `src/components/PetOwnerDashboard/HomeServiceConfirmation.jsx:126`, `src/components/PetOwnerDashboard/HomeServiceConfirmation.jsx:298-308` | Pet owner | Blocks submission | Signed consent submitted | Backend also requires signed consent |
| CONFIRMED | Boarding liability consent required | `src/components/PetOwnerDashboard/PetHotel.jsx:408-413`, `src/components/PetOwnerDashboard/PetHotel.jsx:765-775` | Pet owner | Blocks submission | Signed consent submitted | Backend also requires consent |
| CONFIRMED | Self-service queue consent signature required | `src/components/PetOwnerDashboard/Self-Service_QUEUE.jsx:260-266`, `src/components/PetOwnerDashboard/Self-Service_QUEUE.jsx:638` | Pet owner / kiosk user | Blocks submission | Queue consent record captured | Service-specific consent |
| CONFIRMED | Signature component waits for consent checkboxes | `src/components/SignatureCapture.jsx:52`, `src/components/SignatureCapture.jsx:109` | Consent signing screens | UI state | Signature image uploaded | UI mechanism only |
| CONFIRMED | Payment verification within 24 hours | `src/components/PetOwnerDashboard/ConsultPayment.jsx:283-284`, `src/components/PetOwnerDashboard/PaymentSubmission.jsx:167-170` | Pet owner payment pages | Informational | No SLA tracking found | UI-only timing statement |
| CONFIRMED | Cancellation request/refund-return prompt | `src/components/PetOwnerDashboard/ConsultConfirmation.jsx:352`, `src/components/PetOwnerDashboard/ConsultConfirmation.jsx:416-458` | Pet owner online consult | Optional cancellation request | Stored in booking notes | No refund entitlement defined |
| UNKNOWN | Terms and Conditions | Not found as account-level policy | All users | No | No | Gap |
| UNKNOWN | Privacy Policy / Privacy Notice | Not found as formal policy | All users | No | No | Gap |
| UNKNOWN | Optional marketing consent | Not found | All users | No | No | Gap |
| UNKNOWN | Liability waiver | No broad waiver found in searched repo | Service users | UNKNOWN | UNKNOWN | Paper forms may exist outside repo |

## M. Conflicts and High-Risk Gaps

1. CONFLICT: Clinic/system identity varies across UI and consent text. Evidence: `src/reusecomponent/landingpagecontent.jsx:38-44`, `src/components/shared/ConsentDocument.jsx:35`, `src/components/StatusDisplay/TVStatusDisplay.jsx:269`.
2. CONFIRMED GAP: No account-level Terms, Privacy Notice, or marketing consent tracking. Evidence: `php/register.php:8-17`, `DDL/database_ddl_20260622_070744.sql:969-989`.
3. CONFLICT: Public backend registration accepts `role`; UI intends pet-owner registration. Evidence: `php/register.php:43-52`, `src/components/Registration.jsx:44-46`.
4. CONFIRMED GAP: Profile endpoint access is too broad for privacy-sensitive personal data. Evidence: `php/role_access.php:85`, `php/get_user_profile.php:6-16`, `php/update_user_profile.php:5-22`.
5. CONFLICT: Protected media API vs direct `.htaccess` public-media rewrite. Evidence: `php/upload_media.php:10-58`, `.htaccess:19`.
6. CONFLICT: `api_access_tokens` required by code but no matching DDL table found in the baseline DDL. Evidence: `php/auth_access_helpers.php:27-31`, `DDL/database_ddl_20260622_070744.sql`.
7. CONFLICT: Consent record schema differs between baseline DDL and richer migration/helper. Evidence: `DDL/database_ddl_20260622_070744.sql:241-256`, `DDL/20260619_create_consent_form_records.sql:1-24`, `php/consent_record_helpers.php:55-70`.
8. CONFLICT: Client-visible booking price projections differ from backend official price calculation and special-service defaults. Evidence: `src/lib/servicePriceProjections.js:4-44`, `php/add_booking.php:692-704`, `php/special_services.php:317-331`.
9. UNKNOWN: Emergency authorization, DNR, euthanasia, remains, incident handling, aggressive-pet handling, and humane restraint policies are absent from repo.
10. UNKNOWN: Retention, deletion, breach notice, privacy complaint, and consent withdrawal are not defined.

## N. Questions Requiring Clinic-Owner Answers

See the questionnaire at the end of this report.

## O. Recommended Document Set

This is a document inventory only, not drafted legal text:

1. Pet Owner Terms of Use.
2. Privacy Notice.
3. Privacy Consent plus separate optional marketing consent.
4. General Veterinary Service Agreement.
5. Online Consultation Consent.
6. Procedure-specific consent forms for vaccination, medication, lab/imaging, sedation/anesthesia, surgery, dental extraction, wound care, and grooming.
7. Emergency Treatment Authorization.
8. CPR/DNR Authorization.
9. Euthanasia and End-of-Life Authorization.
10. Remains Release / Cremation / Burial / Necropsy Authorization.
11. Confinement and Boarding Agreement.
12. Home Service Agreement.
13. Humane Handling, Aggressive Pet, Restraint, Sedation, and Incident Policy.
14. Payment, Cancellation, Refund, No-show, and Abandonment Policy.
15. Registration-page acceptance text and checkbox wording.

## P. Evidence Appendix

Key files inspected:

- Identity/docs: `README.md:1-3`, `public/pwa/manifest.webmanifest:3-5`, `src/reusecomponent/landingpagecontent.jsx:38-44`.
- Router/auth: `php/index.php:3-5`, `php/index.php:14-15`, `php/index.php:42-51`, `php/role_access.php:65-220`, `php/auth_access_helpers.php:42-66`, `php/auth_access_helpers.php:90-107`.
- Registration/login/OTP: `php/register.php:8-17`, `php/register.php:39-72`, `php/login.php:119-153`, `php/auth_otp_helpers.php:54`, `php/auth_otp_helpers.php:182`, `php/auth_verify_email.php:32`.
- Main schema: `DDL/database_ddl_20260622_070744.sql:14`, `DDL/database_ddl_20260622_070744.sql:41`, `DDL/database_ddl_20260622_070744.sql:66`, `DDL/database_ddl_20260622_070744.sql:96`, `DDL/database_ddl_20260622_070744.sql:125`, `DDL/database_ddl_20260622_070744.sql:158`, `DDL/database_ddl_20260622_070744.sql:225`, `DDL/database_ddl_20260622_070744.sql:241`, `DDL/database_ddl_20260622_070744.sql:264`, `DDL/database_ddl_20260622_070744.sql:470`, `DDL/database_ddl_20260622_070744.sql:495`, `DDL/database_ddl_20260622_070744.sql:520`, `DDL/database_ddl_20260622_070744.sql:603`, `DDL/database_ddl_20260622_070744.sql:626`, `DDL/database_ddl_20260622_070744.sql:651`, `DDL/database_ddl_20260622_070744.sql:666`, `DDL/database_ddl_20260622_070744.sql:717`, `DDL/database_ddl_20260622_070744.sql:797`, `DDL/database_ddl_20260622_070744.sql:816`, `DDL/database_ddl_20260622_070744.sql:876`, `DDL/database_ddl_20260622_070744.sql:900`, `DDL/database_ddl_20260622_070744.sql:942`, `DDL/database_ddl_20260622_070744.sql:969`, `DDL/database_ddl_20260622_070744.sql:997`, `DDL/database_ddl_20260622_070744.sql:1031`, `DDL/database_ddl_20260622_070744.sql:1056`, `DDL/database_ddl_20260622_070744.sql:1142`, `DDL/database_ddl_20260622_070744.sql:1175`, `DDL/database_ddl_20260622_070744.sql:1202`.
- Consent: `DDL/20260619_create_consent_form_records.sql:1-24`, `php/consent_record_helpers.php:147-164`, `php/consent_record_helpers.php:266-283`, `php/consent_record_helpers.php:386-428`.
- Booking/workflow/pricing: `php/add_booking.php:605-704`, `php/add_booking.php:738-761`, `php/add_booking.php:795-797`, `php/add_booking.php:861-877`, `php/add_booking.php:1154-1214`, `php/update_booking_status.php:268-343`, `php/workflow_guard_helpers.php:171-218`.
- Online consult: `DDL/database_ddl_20260622_070744.sql:520-535`, `php/online_consultation_helpers.php:41-57`, `php/online_consultation_helpers.php:90-113`, `php/online_consultations.php:196-253`, `php/online_consultations.php:314-357`, `php/online_consultations.php:367-460`.
- Payments/reports: `php/payment_methods.php:8`, `php/payment_methods.php:100-162`, `php/visit_billing.php:91-98`, `php/visit_billing.php:1276-1345`, `php/reports_common.php:28-39`, `php/reports_common.php:2948-2964`.
- Uploads/media: `php/upload.php:26-34`, `php/upload.php:45-59`, `php/upload.php:100-148`, `php/upload_media.php:10-58`, `.htaccess:19`, `src/lib/image.js:84-107`.
- Third parties: `.env.example.production:19-21`, `src/services/addressAutocomplete.js:1-24`, `src/context/VideoCallProvider.jsx:301-302`, `php/mail_helpers.php:528-541`.
- Existing UI legal/consent text: `src/components/PetOwnerDashboard/ConsultPayment.jsx:133-138`, `src/components/PetOwnerDashboard/ConsultPayment.jsx:327-345`, `src/components/PetOwnerDashboard/HomeServiceConfirmation.jsx:126-197`, `src/components/PetOwnerDashboard/PetHotel.jsx:408-413`, `src/components/PetOwnerDashboard/Self-Service_QUEUE.jsx:260-266`, `src/components/PetOwnerDashboard/Self-Service_QUEUE.jsx:638`.

## Clinic-Owner Questionnaire

1. What is the exact registered business name of the clinic?
2. What exact clinic address, phone number, email address, and business identifiers should appear in legal documents?
3. Who is the privacy/DPO contact, and what email/phone/address should data-subject requests use?
4. What is the minimum user age for pet-owner accounts?
5. Are minors allowed to register with parent/guardian consent?
6. What are the account deletion, deactivation, and reactivation rules?
7. How long should account, booking, billing, medical, consent, upload, notification, and audit records be retained?
8. Who is the hosting provider for the live system?
9. Who manages backups, how often are backups made, and how long are backups kept?
10. What email provider is officially used?
11. Is SMS used now or planned?
12. Which payment providers are officially accepted: cash, QRPH, GCash, Maya, bank transfer, or others?
13. Are marketing communications sent? If yes, by email, SMS, push, or social media?
14. Is marketing consent optional and separately withdrawable?
15. What is the booking cancellation policy by service?
16. What is the refund policy for paid bookings, online consults, home service, boarding, and cancelled services?
17. Are deposits required for any service?
18. What is the no-show policy?
19. What emergency spending limit should owners authorize by default, if any?
20. How many attempts must staff make to contact the owner during an emergency?
21. Who may authorize treatment if the owner is unreachable?
22. May an emergency contact authorize treatment, CPR, euthanasia, or transfer?
23. When may the clinic transfer a pet to another facility?
24. What is the CPR policy?
25. What is the DNR policy?
26. Who may sign euthanasia authorization?
27. What identification or proof is required before euthanasia or remains release?
28. How are remains handled: owner pickup, clinic-arranged cremation, burial, or third-party aftercare?
29. Are cremation or burial providers used? Name them if applicable.
30. Is necropsy/post-mortem examination available or referred out?
31. What happens to unpaid bills after a pet dies?
32. What incident-reporting process is used for injury, escape, medication error, wrong procedure, complaint, or suspected mishandling?
33. Who investigates complaints and how are owners updated?
34. Does the clinic have insurance relevant to veterinary services, boarding, grooming, transport, or home service?
35. What is the boarding abandonment procedure if an owner does not collect the pet?
36. What is the aggressive/fearful-pet handling policy?
37. When may muzzles, restraint, or sedation be used?
38. Who may authorize sedation or anesthesia?
39. Is CCTV used in clinic, boarding, grooming, or treatment areas?
40. Are pet photos/videos used for records only, or also teaching/marketing?
41. May medical cases be used for teaching or marketing, and is owner consent required?
42. May anonymized data be used for reports, analytics, research, or business planning?
43. What governing law and dispute venue should documents state?
44. What current paper consent forms does the clinic already use?
45. Which services always require written consent before treatment?
46. Which services may proceed in an emergency before signed consent?
47. Are co-owners equally authorized to approve treatment, or only the primary owner?
48. What happens if co-owners disagree about treatment?
49. What discharge instructions must owners receive after each procedure type?
50. What owner behavior policy applies to abusive, threatening, or unsafe conduct?
