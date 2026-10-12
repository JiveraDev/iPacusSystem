# Combined system sequence diagram

iPawcus: A Web-Based Veterinary Management System with Online Booking and Pet Record Management for Vetfocus Care Animal Clinic

This figure is a conceptual UML sequence overview checked against the current React/PHP implementation on 8 October 2026. It is not an activity diagram, a physical deployment diagram or a live end-to-end test result.

## How it was derived

1. Identify the actors in the supplied sequence screenshots: Pet Owner, Admin and Super Admin. Two Pet Owner screenshots and two Super Admin screenshots are duplicates. The missing distinct Veterinarian sequence is derived from the current implementation, rather than inferred from a duplicate upload.
2. Read the current booking, intake, consent, diagnosis, online consultation, prescription, billing, care and governance code. Check the revised workflows against their frontend service calls, backend persistence and notification helpers.
3. Combine React and PHP into one conceptual iPawcus System participant. Keep Database distinct. This removes repeated UI-to-PHP forwarding without claiming that the real backend disappeared.
4. Keep all four actors once. Retain the direction and ordering of meaningful requests, saved state and user results. Routine database acknowledgements and repeated authentication are summarized, not reversed.
5. Separate service alternatives with ALT, conditional work with OPT, and dated medication completion with LOOP. Named REF interactions preserve supporting behavior without adding provider columns or repeating dozens of arrows.
6. Increase all visible labels to at least 18 px, bold and uppercase. Role names are 22 px. Fit each message label above its own arrow and leave independent processing activation bars short.

## Reading and scope

- This is a conceptual system-boundary UML sequence overview: UI and PHP forwarding are bundled, not removed from the architecture.
- Every role has exactly one visible lifeline. System and Database make six columns; unrelated providers are not falsely combined into one service lifeline.
- Messages preserve sender/receiver direction. Solid filled arrows are calls; dashed open arrows are replies; solid open arrows are user-facing updates or actor handoffs.
- Vertical order matters within a selected interaction. Opt and alt guards mean not every block runs; independent setup, record and governance requests are not mandatory per-visit steps.
- Repeated authentication and helper integrations use named ref fragments. Routine database acknowledgements and low-level UI/PHP forwarding are omitted, not reversed.
- Successful-path summaries do not draw every rejection, retry or no-show. Their guards and important integrity requirements remain in the explanation.
- Activation bars show short processing intervals, not entire months of medication use or one permanent login activation.
- No application, schema, original activity/class/context diagrams, dashboard bypass or user-uploaded image is modified.

The top-to-bottom order is the order within the selected interaction, not a claim that four people share a session or that all optional blocks execute for every patient. Super Admin configuration/reporting and R3/R4 requests are independently invoked. A booked patient goes through Admin review; a walk-in skips booking. A standard medical visit selects the onsite branch, an online booking selects the call branch, and routine grooming/boarding selects its own care branch.

A REF block names an interaction summarized here. It is not an activity step or a claim that unrelated external services are one server. This is an overview abstraction; expand the named interaction when implementation-level call-by-call detail is required.

## What changed from the references

- Separate PHP, location, meeting, notification and export columns are summarized at the system boundary or in R2; their identities are retained in the explanation.
- Onsite availability follows clinic hours and accepting assigned veterinarians, with cross-clinic/online conflict protection. Grooming slots and boarding room capacity remain independent.
- Admin owns physical examination, exam-time consent, images and veterinarian reassignment. Starting it appears on the assigned Vet's today-only My List. The Vet still handles clinical diagnosis and additional consent.
- Online consultations retain their own availability, access checks, video call and diagnosis/prescription path; they do not require onsite physical intake.
- Changed prescriptions remain synchronized with the pet, versioned and scheduled per medicine item. Owners start selected items or all items with dates, then track due occurrences. Onsite printing is guarded by printable medicine rows.
- Record read/email access is not confused with a staff-reviewed, payment-checked correction request.
- Report PDF/Excel export is represented as the current browser helper implementation, not as a fictional external generator. Meeting support is Jitsi/JaaS according to configuration, not unconditionally self-hosted.

## Named reference interactions

### R1: Shared authentication and role authorization

Every role signs in independently. Registration/email verification, login, account status and protected API authorization are a shared interaction, not one login shared by four people. Each request still checks the applicable role and clinic/patient access. The existing dashboard debug bypass is not changed by this documentation.

1. User supplies account details or signs in.
2. System validates credentials, account status and any required verification against stored records.
3. On success, the API returns a token/user context and the interface opens the appropriate dashboard; invalid or unauthorized requests are rejected.
4. Subsequent protected requests apply role, clinic and patient authorization.

### R2: Optional external integrations and local document generation

These are deliberately not additional lifelines in the overview. No fictional single external service is invented. Notifications, location lookup, meetings and documents remain different mechanisms inside or beyond the system boundary.

1. Address input may call Geoapify autocomplete/reverse lookup in the browser. This is optional and is not required for every clinic visit.
2. An authorized online call obtains configured meeting access and uses Jitsi/JaaS. Runtime configuration can select JaaS or another Jitsi base URL; the diagram does not assume every call uses a self-hosted deployment.
3. In-app notifications retain recipient, read state and redirect path. Email/push delivery depends on preferences and configured delivery. Refreshing My List is an automatic GET-backed view update, not a new push-notification endpoint.
4. Consent PDFs, receipts and prescription print documents are generated through the existing document helpers. Diagnosis printing opens a browser print dialog only when the onsite diagnosis has printable medicines; it does not guarantee a physical printer completes the job.
5. Report PDF and Excel files are currently generated in the browser by the report export helpers (jsPDF and ExcelJS), not by a separate database or fictitious report server.

### R3: Medical records, release/email and corrections

Reading/emailing an accessible medical record and requesting a correction are different interactions. A pet owner does not directly replace a verified veterinarian record.

1. Owner requests accessible pet history or an email copy; the system checks patient access, reads the record and returns/queues the copy.
2. For a correction, the owner submits requested changes and applicable payment proof.
3. Admin reviews the request, verifies payment where required and approves/rejects or assigns a veterinarian.
4. The assigned veterinarian starts the request, makes permitted record changes, supplies completion notes and completes it after payment/change checks.
5. The system saves the clinical changes and audit events, and notifies the owner of completion.

### R4: Independent operational and governance requests

These are separately invoked operations, not mandatory steps of every appointment. Combining them in a reference avoids pretending that an Admin stock entry must always be followed by a Super Admin export or backup.

1. Admin manages catalogue/material definitions, inventory receipts/stock-out/transfers, branch care observations/tasks, payments and authorized refunds. The system checks permissions, saves affected records and audits stock/financial changes.
2. Super Admin manages accounts, roles, clinic assignments and clinic/payment configuration. Payment-method security operations retain applicable OTP checks.
3. Super Admin requests filtered reports; PHP reads operational data and returns the report model. The browser can preview/print it or produce PDF/Excel files.
4. Authorized monitoring views read staff activity/media. Media monitoring is available to Super Admin and Veterinarian in the current endpoint.
5. Active Super Admin requests a complete backup; the backend creates the export and streams the archive. Backup history/settings do not imply that every role can download backups.
6. Users update their own profiles, notification preferences and tasks according to role. Veterinarian My List is today-only, with a next-booked-day preview; future bookings remain in calendar To-dos.

### R5: Care review and release coordination

Grooming and boarding/confinement are independent service paths. They are summarized in the alternative care branch, rather than placed after every medical visit.

1. Admin records the required care details, photos/observations and applicable room, material and task updates.
2. If grooming requires a veterinarian assessment, staff requests the assigned veterinarian review and pauses the grooming job. The veterinarian returns the permitted resume, stop or separate-consultation decision.
3. A review alone does not automatically create a medical diagnosis or consultation charge.
4. Finish/check-out prepares the applicable invoice and care history; it does not silently mark the invoice paid. Pickup/discharge retains required workflow and payment checks.

## Message-by-message explanation

| ID | Sender -> receiver | Message | Preserved meaning |
| --- | --- | --- | --- |
| s1 | SA -> SYS | Manage accounts, roles and clinic assignments | Super Admin determines the staff clinic assignments. Account activation/deactivation and role-specific professional data remain part of this summarized account operation. |
| s2 | SYS -> DB | Save access / clinic configuration | This represents related persistence operations, not a new all-in-one SQL statement. |
| s3 | VT -> SYS | Set site acceptance and separate online slots | Onsite acceptance is per assigned clinic. Online-call start selections are separate; veterinarian presence today is not an onsite booking-hours calendar. |
| s4 | SYS -> DB | Save preferences / protect bookings | Saving preferences cannot abandon protected existing bookings. One veterinarian cannot overlap medical services across clinics and online calls. |
| p1 | PO -> SYS | Register pet / request link | Owner/co-parent access remains validated; an ownership request is not automatically accepted for someone else's pet. |
| p2 | SYS -> DB | Validate and save pet / ownership | Registration and ownership links are separate supporting records, summarized at the system boundary. |
| p3 | SYS -> PO | Pet record / owner-link status | The result can be a saved pet, existing link or pending co-parent approval; approval steps are retained in the explanation. |
| b1 | PO -> SYS | Find service / date / vet options | The owner chooses the relevant clinic/service or the online veterinarian before checking availability. |
| b2 | SYS -> DB | Check capacity and vet conflicts | Onsite medical capacity follows clinic hours and eligible veterinarians, not overlapping independent medical-service capacities. Online calls use separate selected slots. Grooming and boarding keep their own slot/room rules. |
| b3 | SYS -> PO | Available dates and times | Unavailable or conflicting choices are rejected; the user can select another option. |
| b4 | PO -> SYS | Submit booking / payment proof | Includes service concern and applicable upload/payment details. Payment proof applies where required, not to every booking. Optional home-service address lookup is R2. Failed validation does not create a valid booking. |
| b5 | SYS -> DB | Reserve / save pending booking | Medical bookings reserve a veterinarian when created, before confirmation. This avoids displaying four patients against only three accepting veterinarians. Nonmedical services reserve their own applicable capacity, not a veterinarian. |
| b6 | AD -> SYS | Review booking / payment; confirm or adjust | Admin may reject, reschedule, transfer clinic or adjust assignment through the authorized endpoints. The main trace shows an accepted/confirmed request, not all error alternatives. |
| b7 | SYS -> DB | Save review / booking status | Database persistence precedes the displayed booking result and resulting notification. |
| b8 | SYS -> PO | Booking result / notification | This is a user-facing result/status event, not an acknowledgement from an unrelated owner session. Notification delivery and navigation are R2. |
| c1 | AD -> SYS | Receive / assign patient; start examination | An approved queue and assigned veterinarian are required. A booked arrival uses receiveBooking; a walk-in uses the queue flow. Staff start physical examination, not the pet owner. |
| c2 | SYS -> DB | Save queue / intake / assigned vet | Intake preserves examined-by staff independently of the assigned veterinarian and links the same pet/queue context. |
| c3 | SYS -> VT | My List refresh: undergoing examination | Represents the automatic GET-backed visible refresh. It does not invent a server push endpoint; My List is today-only, and future bookings remain in To-dos/next-day preview. |
| c4 | PO -> AD | Sign consent during examination | This is the owner's signing interaction administered by staff; it does not assume the owner has permission to call the admin intake endpoint. |
| c5 | AD -> SYS | Save findings / images / consent; reassign if needed / complete exam | Summarizes complaint, symptoms, urgent signs, vitals, physical findings and uploaded images. Admin can reassign the veterinarian before completion. Linked consent must already be saved before completing the intake. |
| c6 | SYS -> DB | Save exam / consent / assignment | These are coordinated steps from separate existing endpoints, not a claim of one atomic combined intake/consent API. |
| c7 | VT -> SYS | Finalize diagnosis / treatment; consent if needed | Veterinarian review retains exam provenance, assessment, laboratory findings, treatment, follow-up and optional additional consent. Starting examination is not the same as completing diagnosis. |
| c8 | SYS -> DB | Save diagnosis / visit / history | Clinical finalization includes existing transaction/visit/invoice integration. Prescription synchronization, when needed, is summarized by the following guarded fragment. |
| o1 | VT -> SYS | Start authorized online consultation | The veterinarian starts the scheduled call; the patient does not need an onsite intake. |
| o2 | PO -> SYS | Join authorized call | System verifies booking/participant access and records join status before the authorized meeting UI is opened. |
| o3 | VT -> SYS | Submit online diagnosis / recommendations | Includes medications where entered; completing the online diagnosis also completes the consultation/booking and prepares its visit billing. |
| o4 | SYS -> DB | Save diagnosis / call completion | Online diagnoses synchronize prescription plans in the existing backend. A cancelled/no-show call follows a different status path, not a successful diagnostic result. |
| g1 | AD -> SYS | Run care job / room stay; record care | Grooming has receive/before photo/start/after photo/finish/pickup states; boarding has room assignment, check-in, observations, tasks, documents/materials and check-out. These are alternative care types, not required steps of an online or medical visit. |
| g2 | SYS -> DB | Save care / materials / charges | Required care evidence and applicable capacity checks remain. Grooming finishing prepares/reuses an invoice but does not mark it paid. A requested vet review pauses grooming and does not create a diagnosis or consultation charge automatically. |
| r1 | SYS -> DB | Sync pet plan / items; retain versions | This is part of the diagnostic finalization persistence, shown after the shared diagnostic branches for concision. A changed plan supersedes the previous plan and cancels its pending occurrences while retaining history. Empty content creates no new plan. |
| r2 | SYS -> PO | New / updated plan notification | Notification follows persisted changed content and directs the owner to the relevant pet prescription plan. Unchanged content does not generate a replacement version. |
| r3 | SYS -> VT | Open prescription print dialog | No prescription means no automatic printing. Printing does not depend on creating a changed prescription version. The current online flow issues prescriptions but is not falsely claimed to use the onsite automatic-print handler. |
| r4 | PO -> SYS | Start items / all; dates per item | Each medicine can start separately with its own start date, frequency, time slots/weekday rules and duration. Start all applies selected item settings rather than forcing one shared schedule. |
| r5 | SYS -> DB | Create dated doses per item | Daily/hourly/weekly recurrences are generated for each medicine, not one combined schedule for every item. Three-times-daily defaults can use morning, noon and evening. |
| r6 | SYS -> PO | Item checklist / calendar / To-dos | The response displays due occurrences and completion state. Starting a plan does not mark its doses completed. |
| f1 | AD -> SYS | Post charges / verify and record payment | Catalogue services, medicines/products, material charges and applicable care fees remain separately auditable. A submitted proof is not automatically a verified payment. |
| f2 | SYS -> DB | Save billing / payment; adjust stock | Only applicable sale/material operations affect stock. Refunds use the authorized refund endpoint and preserve payment/refund history rather than overwriting a sale. |
| f3 | SYS -> PO | Invoice / receipt / status | Receipt/print helpers are inside the system boundary (R2). The owner is shown the relevant invoice and payment/refund status. |
| d1 | PO -> SYS | Mark this dose done / skipped | Each due item/date/time can be completed or skipped independently. This loop runs later when doses are due, not while the veterinarian remains in one long active session. |
| d2 | SYS -> DB | Update occurrence / progress | Updates a specific occurrence and plan status; other medicines and future doses are not marked completed automatically. |
| a1 | SA -> SYS | Request filtered report / PDF / Excel | This operation is invoked independently of a particular appointment. The backend builds filtered data; the interface generates PDF or Excel files when requested. |
| a2 | SYS -> DB | Read filtered operational records | Reporting reads relevant stored clinical, booking, financial and inventory records; it does not create a second reporting database. |
| a3 | SYS -> SA | Report view / export download | The view/export result returns to the requesting Super Admin. Monitoring and backups remain separately invoked R4 interactions. |

## Source basis

Each evidence anchor was checked for file existence and matching text. Line numbers are snapshots and may move after subsequent edits. Evidence hashes are saved in sequence-layout.json; the renderer checks them again. This verifies traceability, not successful execution against a live database.

| Source | Anchor |
| --- | --- |
| [src/services/userLogin.js:16](../../src/services/userLogin.js) | `loginUser` |
| [php/login.php:155](../../php/login.php) | `access_token` |
| [php/role_access.php:399](../../php/role_access.php) | `ipawcus_require_current_api_user` |
| [src/services/accountService.js:29](../../src/services/accountService.js) | `updatePersonnelAccountDetails` |
| [php/veterinarian_booking_schedule.php:63](../../php/veterinarian_booking_schedule.php) | `Only Super Admin can assign clinics` |
| [php/update_account_profile.php:62](../../php/update_account_profile.php) | `user_id` |
| [php/veterinarian_booking_schedule.php:15](../../php/veterinarian_booking_schedule.php) | `user_branch_assignments` |
| [src/services/vetBookingScheduleService.js:3](../../src/services/vetBookingScheduleService.js) | `export` |
| [src/services/vetScheduleService.js:8](../../src/services/vetScheduleService.js) | `updateVetSchedule` |
| [php/veterinarian_booking_schedule.php:92](../../php/veterinarian_booking_schedule.php) | `pending` |
| [php/update_vet_schedule.php:78](../../php/update_vet_schedule.php) | `confirmed` |
| [src/services/addPet.js:3](../../src/services/addPet.js) | `export` |
| [php/link_pet.php:29](../../php/link_pet.php) | `pet_id` |
| [php/add_pet.php:114](../../php/add_pet.php) | `pets_information` |
| [php/link_pet.php:43](../../php/link_pet.php) | `pet_ownership` |
| [src/services/petService.js:3](../../src/services/petService.js) | `fetchUserPets` |
| [src/services/bookingAvailabilityService.js:3](../../src/services/bookingAvailabilityService.js) | `export` |
| [php/clinic_booking_helpers.php:6](../../php/clinic_booking_helpers.php) | `function` |
| [docs/shared-veterinarian-booking.md:12](../../docs/shared-veterinarian-booking.md) | `Three accepting` |
| [php/booking_availability.php:246](../../php/booking_availability.php) | `json_encode` |
| [src/services/bookingService.js:43](../../src/services/bookingService.js) | `createBooking` |
| [php/add_booking.php:245](../../php/add_booking.php) | `bookings` |
| [src/services/bookingService.js:31](../../src/services/bookingService.js) | `reviewBookingPayment` |
| [src/services/bookingService.js:49](../../src/services/bookingService.js) | `updateBookingStatus` |
| [php/update_booking_status.php:95](../../php/update_booking_status.php) | `confirmed` |
| [php/booking_payment_review.php:5](../../php/booking_payment_review.php) | `payment` |
| [php/notification_helpers.php:2128](../../php/notification_helpers.php) | `notification_send_booking_event` |
| [src/components/AdminDashboardsComponent/PatientIntake.jsx:38](../../src/components/AdminDashboardsComponent/PatientIntake.jsx) | `startClinicalIntake` |
| [src/services/queueService.js:4](../../src/services/queueService.js) | `export` |
| [php/clinical_intakes.php:230](../../php/clinical_intakes.php) | `INSERT INTO clinical_intakes` |
| [src/components/AdminDashboardsComponent/PatientIntake.jsx:484](../../src/components/AdminDashboardsComponent/PatientIntake.jsx) | `My List` |
| [docs/shared-veterinarian-booking.md:71](../../docs/shared-veterinarian-booking.md) | `My List shows only` |
| [src/components/AdminDashboardsComponent/PatientIntake.jsx:34](../../src/components/AdminDashboardsComponent/PatientIntake.jsx) | `createAndUploadConsentDocumentPdf` |
| [src/components/AdminDashboardsComponent/PatientIntake.jsx:38](../../src/components/AdminDashboardsComponent/PatientIntake.jsx) | `saveClinicalIntake` |
| [src/components/AdminDashboardsComponent/PatientIntake.jsx:519](../../src/components/AdminDashboardsComponent/PatientIntake.jsx) | `reassigned` |
| [php/clinical_intakes.php:267](../../php/clinical_intakes.php) | `Capture and save the pet owner consent` |
| [php/clinical_intakes.php:217](../../php/clinical_intakes.php) | `UPDATE clinical_intakes SET` |
| [php/consent_form_records.php:3](../../php/consent_form_records.php) | `consent` |
| [src/services/vetDiagnosisService.js:3](../../src/services/vetDiagnosisService.js) | `export` |
| [src/components/VetrinarianComponents/VetDiagnosis.jsx:1673](../../src/components/VetrinarianComponents/VetDiagnosis.jsx) | `handleSaveDiagnosis` |
| [php/vet_diagnoses.php:24](../../php/vet_diagnoses.php) | `vet_diagnoses` |
| [php/vet_diagnoses.php:1082](../../php/vet_diagnoses.php) | `visitBilling` |
| [src/services/onlineConsultationService.js:12](../../src/services/onlineConsultationService.js) | `startOnlineConsultation` |
| [src/services/onlineConsultationService.js:16](../../src/services/onlineConsultationService.js) | `joinOnlineConsultation` |
| [src/services/addressAutocomplete.js:48](../../src/services/addressAutocomplete.js) | `api.geoapify.com` |
| [php/online_consultation_helpers.php:142](../../php/online_consultation_helpers.php) | `getJitsiBaseUrl` |
| [src/components/shared/JaaSMeeting.jsx:30](../../src/components/shared/JaaSMeeting.jsx) | `JaaSMeeting` |
| [php/notification_helpers.php:338](../../php/notification_helpers.php) | `notification_create_event` |
| [src/services/consentDocumentPdf.js:212](../../src/services/consentDocumentPdf.js) | `export` |
| [src/lib/reportExport.js:220](../../src/lib/reportExport.js) | `exportReportExcel` |
| [src/services/onlineConsultationService.js:24](../../src/services/onlineConsultationService.js) | `submitOnlineConsultationDiagnosis` |
| [php/online_consultations.php:636](../../php/online_consultations.php) | `'online_consultation'` |
| [php/online_consultations.php:560](../../php/online_consultations.php) | `visit_billing_ensure_online_consultation_visit` |
| [src/services/groomingService.js:7](../../src/services/groomingService.js) | `updateGroomingJob` |
| [src/services/boardingService.js:44](../../src/services/boardingService.js) | `checkInBoardingBooking` |
| [php/grooming.php:3](../../php/grooming.php) | `grooming` |
| [php/boarding_management.php:19](../../php/boarding_management.php) | `boarding` |
| [docs/grooming-management.md:13](../../docs/grooming-management.md) | `Vet review` |
| [src/services/boardingService.js:48](../../src/services/boardingService.js) | `checkOutBoardingBooking` |
| [php/prescription_helpers.php:235](../../php/prescription_helpers.php) | `prescription_sync_plan` |
| [php/online_consultations.php:631](../../php/online_consultations.php) | `prescription_sync_plan` |
| [php/prescription_helpers.php:311](../../php/prescription_helpers.php) | `prescription_notify_plan` |
| [src/components/VetrinarianComponents/VetDiagnosis.jsx:1652](../../src/components/VetrinarianComponents/VetDiagnosis.jsx) | `hasPrintablePrescriptions` |
| [src/components/VetrinarianComponents/VetDiagnosis.jsx:1673](../../src/components/VetrinarianComponents/VetDiagnosis.jsx) | `printAfterSave` |
| [src/services/prescriptionService.js:14](../../src/services/prescriptionService.js) | `startPrescriptionPlan` |
| [src/components/shared/PrescriptionPlanPanel.jsx:54](../../src/components/shared/PrescriptionPlanPanel.jsx) | `startDate` |
| [php/prescription_helpers.php:471](../../php/prescription_helpers.php) | `prescription_generate_occurrences` |
| [src/components/shared/PrescriptionPlanPanel.jsx:60](../../src/components/shared/PrescriptionPlanPanel.jsx) | `occurrence` |
| [src/services/visitBillingService.js:20](../../src/services/visitBillingService.js) | `postVisitPayment` |
| [php/visit_billing.php:169](../../php/visit_billing.php) | `visit_payments` |
| [php/visit_billing.php:1198](../../php/visit_billing.php) | `stock` |
| [php/visit_billing.php:204](../../php/visit_billing.php) | `invoice` |
| [src/services/visitBillingService.js:24](../../src/services/visitBillingService.js) | `postVisitRefund` |
| [src/services/prescriptionService.js:22](../../src/services/prescriptionService.js) | `updatePrescriptionOccurrence` |
| [php/prescriptions.php:110](../../php/prescriptions.php) | `occurrence` |
| [src/lib/reportExport.js:83](../../src/lib/reportExport.js) | `exportReportPdf` |
| [php/reports_generate.php:22](../../php/reports_generate.php) | `reports_build_report` |
| [src/services/petService.js:54](../../src/services/petService.js) | `emailPetMedicalRecords` |
| [php/pet_medical_records.php:1627](../../php/pet_medical_records.php) | `email_copy` |
| [php/record_update_requests.php:683](../../php/record_update_requests.php) | `'verify_payment'` |
| [php/record_update_requests.php:683](../../php/record_update_requests.php) | `'complete'` |
| [php/record_update_requests.php:1036](../../php/record_update_requests.php) | `notification_send_record_update_request_completed_to_owner` |
| [php/inventory.php:247](../../php/inventory.php) | `stock` |
| [php/service_catalog.php:8](../../php/service_catalog.php) | `service_catalog` |
| [php/payment_methods.php:4](../../php/payment_methods.php) | `otp` |
| [php/staff_activity_helpers.php:6](../../php/staff_activity_helpers.php) | `function` |
| [php/pet_media_monitoring.php:30](../../php/pet_media_monitoring.php) | `super_admin` |
| [php/system_backups.php:21](../../php/system_backups.php) | `super_admin` |

## Reproduce

Run from the repository root:

```powershell
python scripts/validate-render-combined-sequence.py --fonts
node scripts/generate-combined-sequence-diagram.mjs
python scripts/validate-render-combined-sequence.py
```

Only documentation and generated diagram files are created. No app code, database schema, original uploaded image or pre-existing diagram is changed.
