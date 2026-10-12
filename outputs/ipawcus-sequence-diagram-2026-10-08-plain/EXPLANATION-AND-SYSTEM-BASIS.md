# General system sequence diagram - plain presentation

iPawcus: A Web-Based Veterinary Management System with Online Booking and Pet Record Management for Vetfocus Care Animal Clinic

This revision follows the message-by-message style of the individual sequence examples, with four role lifelines in one figure. It removes coded references, control keywords and grouping headings. Only the online-consultation exchanges for online bookings retain a descriptive box. It is not an activity diagram or an instruction to create another figure.

## How to read it

- This is one general sequence overview with all four roles shown once, plus System and Database. It keeps lifelines, activation bars, directional requests and returned results.
- There are no reference-number labels, control keywords, general section headings, activity nodes or decision diamonds. Only online consultation for online bookings keeps a descriptive rectangular box.
- Login is drawn once using the owner as an example; each staff member signs in separately using the same validation pattern before their actions. No shared session or batch authentication is invented.
- Read messages downward within the applicable interaction. Onsite and grooming/boarding conditions are stated in the first relevant message; online consultation is boxed separately. These are different service paths, not three mandatory stages for every pet.
- Super Admin setup, inventory, reports, records and backups are independently requested operations. Placement on the sheet does not make them compulsory steps of a visit.
- The figure retains meaningful validation, database saves, pending-versus-confirmed booking results, examination provenance, medication start dates and return messages. Routine low-level PHP forwarding and some database acknowledgements remain omitted.
- Medicine conditions stay in the arrow labels: changed prescriptions notify the owner; only printable onsite medicines trigger printing; available medicines can start separately; due doses are completed per item/date.
- The interface and PHP API are one conceptual System lifeline. Browser location lookup, Jitsi/JaaS, delivery and document helpers remain real supporting mechanisms, not a fictional universal external server.
- The existing iPawcus logo is above the System header. The supplied MySQL logo is above the Database header. Both are embedded without changing their pixels or aspect ratios; the rest of the diagram stays monochrome.
- Nothing in the application, database schema, dashboard debug bypass, uploaded references or previous diagram versions is modified.

## Derivation and retained detail

The examples supplied show Pet Owner, Admin and Super Admin; two owner and two Super Admin images are duplicates. Veterinarian actions are derived from the current implementation. Existing UI/service calls, PHP authorization/persistence and notification helpers were inspected to preserve actual directions and important state changes.

The login exchange explicitly shows credential submission, account/role validation, returned account data and the session/dashboard result. It is drawn once rather than repeated four times; every role still signs in independently. Subsequent protected requests retain their own access checks.

Booking separates available slots, initial pending confirmation and later Admin review. Onsite care retains Admin examination, owner signing, images, reassignment, My List progress and a veterinarian reading the patient/exam context before submitting diagnosis. Online access and diagnosis are shown as a different service, not a compulsory stage of an onsite visit.

Medication plans retain item-level start dates and dated occurrences. New/changed plans notify the owner. Onsite printable medicines can trigger the print dialog even when their content is unchanged. No medicines means no automatic printing. Routine database replies are omitted where they add no new information; the visible user-facing returns are retained.

This is a general overview of representative exchanges, not one literal execution that always includes all services, inventory, reports and backups. Conditions remain in the message labels; the online consultation is boxed separately. The login example applies independently to each role. Error/retry paths and all CRUD variants are not drawn.

## Supporting behavior and integrity checks

### Shared authentication and role authorization

Every role signs in independently. Registration/email verification, login, account status and protected API authorization are a shared interaction, not one login shared by four people. Each request still checks the applicable role and clinic/patient access. The existing dashboard debug bypass is not changed by this documentation.

1. User supplies account details or signs in.
2. System validates credentials, account status and any required verification against stored records.
3. On success, the API returns a token/user context and the interface opens the appropriate dashboard; invalid or unauthorized requests are rejected.
4. Subsequent protected requests apply role, clinic and patient authorization.

### Optional external integrations and local document generation

These are deliberately not additional lifelines in the overview. No fictional single external service is invented. Notifications, location lookup, meetings and documents remain different mechanisms inside or beyond the system boundary.

1. Address input may call Geoapify autocomplete/reverse lookup in the browser. This is optional and is not required for every clinic visit.
2. An authorized online call obtains configured meeting access and uses Jitsi/JaaS. Runtime configuration can select JaaS or another Jitsi base URL; the diagram does not assume every call uses a self-hosted deployment.
3. In-app notifications retain recipient, read state and redirect path. Email/push delivery depends on preferences and configured delivery. Refreshing My List is an automatic GET-backed view update, not a new push-notification endpoint.
4. Consent PDFs, receipts and prescription print documents are generated through the existing document helpers. Diagnosis printing opens a browser print dialog only when the onsite diagnosis has printable medicines; it does not guarantee a physical printer completes the job.
5. Report PDF and Excel files are currently generated in the browser by the report export helpers (jsPDF and ExcelJS), not by a separate database or fictitious report server.

### Medical records, release/email and corrections

Reading/emailing an accessible medical record and requesting a correction are different interactions. A pet owner does not directly replace a verified veterinarian record.

1. Owner requests accessible pet history or an email copy; the system checks patient access, reads the record and returns/queues the copy.
2. For a correction, the owner submits requested changes and applicable payment proof.
3. Admin reviews the request, verifies payment where required and approves/rejects or assigns a veterinarian.
4. The assigned veterinarian starts the request, makes permitted record changes, supplies completion notes and completes it after payment/change checks.
5. The system saves the clinical changes and audit events, and notifies the owner of completion.

### Independent operational and governance requests

These are separately invoked operations, not mandatory steps of every appointment. Combining them in a reference avoids pretending that an Admin stock entry must always be followed by a Super Admin export or backup.

1. Admin manages catalogue/material definitions, inventory receipts/stock-out/transfers, branch care observations/tasks, payments and authorized refunds. The system checks permissions, saves affected records and audits stock/financial changes.
2. Super Admin manages accounts, roles, clinic assignments and clinic/payment configuration. Payment-method security operations retain applicable OTP checks.
3. Super Admin requests filtered reports; PHP reads operational data and returns the report model. The browser can preview/print it or produce PDF/Excel files.
4. Authorized monitoring views read staff activity/media. Media monitoring is available to Super Admin and Veterinarian in the current endpoint.
5. Active Super Admin requests a complete backup; the backend creates the export and streams the archive. Backup history/settings do not imply that every role can download backups.
6. Users update their own profiles, notification preferences and tasks according to role. Veterinarian My List is today-only, with a next-booked-day preview; future bookings remain in calendar To-dos.

### Care review and release coordination

Grooming and boarding/confinement are independent service paths. They are summarized in the alternative care branch, rather than placed after every medical visit.

1. Admin records the required care details, photos/observations and applicable room, material and task updates.
2. If grooming requires a veterinarian assessment, staff requests the assigned veterinarian review and pauses the grooming job. The veterinarian returns the permitted resume, stop or separate-consultation decision.
3. A review alone does not automatically create a medical diagnosis or consultation charge.
4. Finish/check-out prepares the applicable invoice and care history; it does not silently mark the invoice paid. Pickup/discharge retains required workflow and payment checks.

## Message-by-message basis

| Sender -> receiver | Message | Preserved meaning |
| --- | --- | --- |
| PO -> SYS | Submit login details | This is a representative sign-in exchange. Staff sign in independently through the same authentication pattern; it is not a shared account or one batch login. |
| SYS -> DB | Check credentials / account / role | The backend validates the account and stored role. Invalid/inactive/unverified access follows its rejection/verification path instead of receiving a valid session. |
| DB -> SYS | Account / authorized role | The database returns account data to the backend; it does not create the browser session itself. |
| SYS -> PO | Session / owner dashboard | The system returns the login context/token and opens the appropriate dashboard. The same result pattern opens the Super Admin, Admin or Veterinarian dashboard for that role. |
| SA -> SYS | Manage accounts, roles and clinic assignments | Super Admin determines the staff clinic assignments. Account activation/deactivation and role-specific professional data remain part of this summarized account operation. |
| SYS -> DB | Save access / clinic configuration | This represents related persistence operations, not a new all-in-one SQL statement. |
| VT -> SYS | Set site acceptance and separate online slots | Onsite acceptance is per assigned clinic. Online-call start selections are separate; veterinarian presence today is not an onsite booking-hours calendar. |
| SYS -> DB | Save preferences / protect bookings | Saving preferences cannot abandon protected existing bookings. One veterinarian cannot overlap medical services across clinics and online calls. |
| PO -> SYS | Register pet / request link | Owner/co-parent access remains validated; an ownership request is not automatically accepted for someone else's pet. |
| SYS -> DB | Validate and save pet / ownership | Registration and ownership links are separate supporting records, summarized at the system boundary. |
| SYS -> PO | Pet record / owner-link status | The result can be a saved pet, existing link or pending co-parent approval; approval steps are retained in the explanation. |
| PO -> SYS | Find service / date / vet options | The owner chooses the relevant clinic/service or the online veterinarian before checking availability. |
| SYS -> DB | Check capacity and vet conflicts | Onsite medical capacity follows clinic hours and eligible veterinarians, not overlapping independent medical-service capacities. Online calls use separate selected slots. Grooming and boarding keep their own slot/room rules. |
| SYS -> PO | Available dates and times | Unavailable or conflicting choices are rejected; the user can select another option. |
| PO -> SYS | Submit booking / payment proof | Includes service concern and applicable upload/payment details. Payment proof applies where required, not to every booking. Optional home-service address lookup is the supporting behavior notes. Failed validation does not create a valid booking. |
| SYS -> DB | Reserve / save pending booking | Medical bookings reserve a veterinarian when created, before confirmation. This avoids displaying four patients against only three accepting veterinarians. Nonmedical services reserve their own applicable capacity, not a veterinarian. |
| SYS -> PO | Pending booking / request number | The initial saved booking result is distinct from a later Admin confirmation or rejection. The owner can track the pending request. |
| AD -> SYS | Review booking / payment; confirm or adjust | Admin may reject, reschedule, transfer clinic or adjust assignment through the authorized endpoints. The main trace shows an accepted/confirmed request, not all error alternatives. |
| SYS -> DB | Save review / booking status | Database persistence precedes the displayed booking result and resulting notification. |
| SYS -> PO | Booking result / notification | This is a user-facing result/status event, not an acknowledgement from an unrelated owner session. Notification delivery and navigation are the supporting behavior notes. |
| AD -> SYS | Onsite: receive / assign; start exam | An approved queue and assigned veterinarian are required. A booked arrival uses receiveBooking; a walk-in uses the queue flow. Staff start physical examination, not the pet owner. |
| SYS -> DB | Save queue / intake / assigned vet | Intake preserves examined-by staff independently of the assigned veterinarian and links the same pet/queue context. |
| SYS -> VT | My List refresh: undergoing examination | Represents the automatic GET-backed visible refresh. It does not invent a server push endpoint; My List is today-only, and future bookings remain in To-dos/next-day preview. |
| PO -> AD | Sign consent during examination | This is the owner's signing interaction administered by staff; it does not assume the owner has permission to call the admin intake endpoint. |
| AD -> SYS | Save findings / images / consent; reassign if needed / complete exam | Summarizes complaint, symptoms, urgent signs, vitals, physical findings and uploaded images. Admin can reassign the veterinarian before completion. Linked consent must already be saved before completing the intake. |
| SYS -> DB | Save exam / consent / assignment | These are coordinated steps from separate existing endpoints, not a claim of one atomic combined intake/consent API. |
| VT -> SYS | Open patient / examination record | The veterinarian opens the assigned patient context before recording the diagnosis. Queue/intake data and prior diagnosis history are obtained through existing service calls. |
| SYS -> DB | Read exam / prior medical history | Summarizes related authorized reads, not a fictitious single query or new endpoint. |
| SYS -> VT | Patient history / findings / examiner | Returns the patient context, recorded examination and provenance. The veterinarian does not redo staff intake simply because a record is opened. |
| VT -> SYS | Finalize diagnosis / treatment; consent if needed | Veterinarian review retains exam provenance, assessment, laboratory findings, treatment, follow-up and optional additional consent. Starting examination is not the same as completing diagnosis. |
| SYS -> DB | Save diagnosis / visit / history | Clinical finalization includes existing transaction/visit/invoice integration. Prescription synchronization, when needed, is summarized by the following guarded fragment. |
| VT -> SYS | Start authorized online consultation | The veterinarian starts the scheduled call; the patient does not need an onsite intake. |
| PO -> SYS | Join authorized call | System verifies booking/participant access and records join status before the authorized meeting UI is opened. |
| SYS -> PO | Meeting access (Jitsi / JaaS) | After participant/booking checks, the owner receives authorized meeting access. The veterinarian obtains access through the start operation. The configured provider carries the video discussion; it is not another required clinic visit. |
| VT -> SYS | Submit online diagnosis / recommendations | Includes medications where entered; completing the online diagnosis also completes the consultation/booking and prepares its visit billing. |
| SYS -> DB | Save diagnosis / call completion | Online diagnoses synchronize prescription plans in the existing backend. A cancelled/no-show call follows a different status path, not a successful diagnostic result. |
| AD -> SYS | Grooming / boarding: record care / room stay | Grooming has receive/before photo/start/after photo/finish/pickup states; boarding has room assignment, check-in, observations, tasks, documents/materials and check-out. These are alternative care types, not required steps of an online or medical visit. |
| SYS -> DB | Save care / materials / charges | Required care evidence and applicable capacity checks remain. Grooming finishing prepares/reuses an invoice but does not mark it paid. A requested vet review pauses grooming and does not create a diagnosis or consultation charge automatically. |
| SYS -> DB | If Rx changes: sync pet plan / items | This is part of the diagnostic finalization persistence, shown after the shared diagnostic branches for concision. A changed plan supersedes the previous plan and cancels its pending occurrences while retaining history. Empty content creates no new plan. |
| SYS -> PO | New / changed Rx: notify owner | Notification follows persisted changed content and directs the owner to the relevant pet prescription plan. Unchanged content does not generate a replacement version. |
| SYS -> VT | With onsite medicines: print Rx | No prescription means no automatic printing. Printing does not depend on creating a changed prescription version. The current online flow issues prescriptions but is not falsely claimed to use the onsite automatic-print handler. |
| PO -> SYS | Start items / all; dates per item | Each medicine can start separately with its own start date, frequency, time slots/weekday rules and duration. Start all applies selected item settings rather than forcing one shared schedule. |
| SYS -> DB | Create dated doses per item | Daily/hourly/weekly recurrences are generated for each medicine, not one combined schedule for every item. Three-times-daily defaults can use morning, noon and evening. |
| SYS -> PO | Item checklist / calendar / To-dos | The response displays due occurrences and completion state. Starting a plan does not mark its doses completed. |
| AD -> SYS | Post charges / verify and record payment | Catalogue services, medicines/products, material charges and applicable care fees remain separately auditable. A submitted proof is not automatically a verified payment. |
| SYS -> DB | Save billing / payment; adjust stock | Only applicable sale/material operations affect stock. Refunds use the authorized refund endpoint and preserve payment/refund history rather than overwriting a sale. |
| SYS -> PO | Invoice / receipt / status | Receipt/print helpers are inside the system boundary (the supporting behavior notes). The owner is shown the relevant invoice and payment/refund status. |
| PO -> SYS | When due: mark dose done / skipped | Each due item/date/time can be completed or skipped independently. This loop runs later when doses are due, not while the veterinarian remains in one long active session. |
| SYS -> DB | Update occurrence / progress | Updates a specific occurrence and plan status; other medicines and future doses are not marked completed automatically. |
| PO -> SYS | View / email pet medical record | Accessible history and email copies are distinct from a paid, staff-reviewed record-correction request. |
| SYS -> DB | Check pet access / read records | The backend checks access and reads the permitted medical data; an email request queues/sends the copy through configured delivery. |
| SYS -> PO | Medical history / email-copy status | The owner receives the readable record or email-copy request result. The diagram does not claim that mail delivery always succeeds instantly. |
| AD -> SYS | Update items / stock / service materials | Admin submits an authorized catalogue or stock operation. Sales/material usage and manual stock entries remain auditable. |
| SYS -> DB | Validate / save inventory changes | Applicable item/stock checks precede persistence; an invalid movement is not saved as valid stock. |
| SYS -> AD | Updated stock / operation result | The result returns to the staff member who submitted the operation, not to an unrelated pet owner. |
| SA -> SYS | Request filtered report / PDF / Excel | This operation is invoked independently of a particular appointment. The backend builds filtered data; the interface generates PDF or Excel files when requested. |
| SYS -> DB | Read filtered operational records | Reporting reads relevant stored clinical, booking, financial and inventory records; it does not create a second reporting database. |
| SYS -> SA | Report view / export download | The view/export result returns to the requesting Super Admin. Monitoring and backups remain separately invoked the supporting behavior notes interactions. |
| SA -> SYS | Request backup / download | An active authorized Super Admin requests creation/download. This is independent of an appointment or report request. |
| SYS -> DB | Read backup / system metadata | The backend checks backup metadata and prepares or retrieves the archive with the existing backup helpers. The diagram does not pretend that uploaded files reside in MariaDB or that this is only a SQL dump. |
| SYS -> SA | Backup archive / download status | The existing backend streams the authorized archive to Super Admin; other roles do not gain backup-download access. |

## Source checks

Source paths and anchors were checked at generation and again before rendering. The saved SHA-256 snapshots establish which local implementation was used. This is a static documentation check, not a live database or end-to-end workflow test.

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
| [php/add_booking.php:319](../../php/add_booking.php) | `booking_number` |
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
| [src/components/VetrinarianComponents/VetDiagnosis.jsx:51](../../src/components/VetrinarianComponents/VetDiagnosis.jsx) | `fetchQueues` |
| [src/services/vetDiagnosisService.js:3](../../src/services/vetDiagnosisService.js) | `fetchVetDiagnoses` |
| [php/get_queues.php:17](../../php/get_queues.php) | `SELECT` |
| [php/vet_diagnoses.php:32](../../php/vet_diagnoses.php) | `SELECT` |
| [src/components/VetrinarianComponents/VetDiagnosis.jsx:85](../../src/components/VetrinarianComponents/VetDiagnosis.jsx) | `applyClinicalIntake` |
| [src/services/vetDiagnosisService.js:3](../../src/services/vetDiagnosisService.js) | `export` |
| [src/components/VetrinarianComponents/VetDiagnosis.jsx:1673](../../src/components/VetrinarianComponents/VetDiagnosis.jsx) | `handleSaveDiagnosis` |
| [php/vet_diagnoses.php:24](../../php/vet_diagnoses.php) | `vet_diagnoses` |
| [php/vet_diagnoses.php:1082](../../php/vet_diagnoses.php) | `visitBilling` |
| [src/services/onlineConsultationService.js:12](../../src/services/onlineConsultationService.js) | `startOnlineConsultation` |
| [src/services/onlineConsultationService.js:16](../../src/services/onlineConsultationService.js) | `joinOnlineConsultation` |
| [php/online_consultation_helpers.php:142](../../php/online_consultation_helpers.php) | `getJitsiBaseUrl` |
| [src/services/onlineConsultationService.js:24](../../src/services/onlineConsultationService.js) | `submitOnlineConsultationDiagnosis` |
| [php/online_consultations.php:636](../../php/online_consultations.php) | `'online_consultation'` |
| [php/online_consultations.php:560](../../php/online_consultations.php) | `visit_billing_ensure_online_consultation_visit` |
| [src/services/groomingService.js:7](../../src/services/groomingService.js) | `updateGroomingJob` |
| [src/services/boardingService.js:44](../../src/services/boardingService.js) | `checkInBoardingBooking` |
| [php/grooming.php:3](../../php/grooming.php) | `grooming` |
| [php/boarding_management.php:19](../../php/boarding_management.php) | `boarding` |
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
| [src/services/petService.js:49](../../src/services/petService.js) | `fetchPetMedicalRecords` |
| [src/services/petService.js:54](../../src/services/petService.js) | `emailPetMedicalRecords` |
| [php/pet_medical_records.php:1627](../../php/pet_medical_records.php) | `email_copy` |
| [php/inventory.php:247](../../php/inventory.php) | `stock` |
| [php/service_catalog.php:8](../../php/service_catalog.php) | `service_catalog` |
| [php/inventory.php:224](../../php/inventory.php) | `json_encode` |
| [src/lib/reportExport.js:83](../../src/lib/reportExport.js) | `exportReportPdf` |
| [php/reports_generate.php:22](../../php/reports_generate.php) | `reports_build_report` |
| [src/lib/reportExport.js:220](../../src/lib/reportExport.js) | `exportReportExcel` |
| [php/system_backups.php:22](../../php/system_backups.php) | `Only the Super Admin` |
| [php/system_backups.php:45](../../php/system_backups.php) | `ipawcus_backup_archive_for_download` |
| [php/system_backups.php:43](../../php/system_backups.php) | `ipawcus_system_backups_stream_local_export` |
| [src/services/addressAutocomplete.js:48](../../src/services/addressAutocomplete.js) | `api.geoapify.com` |
| [src/components/shared/JaaSMeeting.jsx:30](../../src/components/shared/JaaSMeeting.jsx) | `JaaSMeeting` |
| [php/notification_helpers.php:338](../../php/notification_helpers.php) | `notification_create_event` |
| [src/services/consentDocumentPdf.js:212](../../src/services/consentDocumentPdf.js) | `export` |
| [php/record_update_requests.php:683](../../php/record_update_requests.php) | `'verify_payment'` |
| [php/record_update_requests.php:683](../../php/record_update_requests.php) | `'complete'` |
| [php/record_update_requests.php:1036](../../php/record_update_requests.php) | `notification_send_record_update_request_completed_to_owner` |
| [php/payment_methods.php:4](../../php/payment_methods.php) | `otp` |
| [php/staff_activity_helpers.php:6](../../php/staff_activity_helpers.php) | `function` |
| [php/pet_media_monitoring.php:30](../../php/pet_media_monitoring.php) | `super_admin` |
| [php/system_backups.php:21](../../php/system_backups.php) | `super_admin` |
| [docs/grooming-management.md:13](../../docs/grooming-management.md) | `Vet review` |
| [src/services/boardingService.js:48](../../src/services/boardingService.js) | `checkOutBoardingBooking` |

## Reproduce

```powershell
python scripts/validate-render-combined-sequence.py --plain --fonts
node scripts/generate-combined-sequence-diagram.mjs --plain
python scripts/validate-render-combined-sequence.py --plain
```

The prior combined version and original activity/context/class diagrams are preserved. No app or database changes are made.
