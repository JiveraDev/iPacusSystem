# How the simple iPawcus data-flow diagram was derived

This follows the supplied sample: plain rectangles for people, rounded numbered process boxes, open-ended data stores, and black labeled arrows. There are no colors, UML classes, database relationship lines, decisions, or decorative panels.

## How to imitate this method

1. Identify who sends or receives information: Pet Owner, Admin, Veterinarian, and Super Admin. Draw each role once per sheet as a rectangle, with all its flows connected to that same figure.
2. Group related user actions into a few major functions. Give each function a verb-based name and number. The numbers identify functions, not execution order.
3. Identify the information that must be saved. Group related records into logical data stores rather than drawing every SQL table. Draw each store once per sheet and connect all relevant processes to it.
4. For each major function, ask: who provides the data, what data comes in, where is it saved/read, and who receives the result? Draw only these main arrows.
5. Label arrows with the data being passed, such as "Booking details" or "Prescription details". Do not label them with commands like "Click", "Next", "Approve?", or "Yes/No".
6. Keep extra queries, form fields, and detailed steps on separate process-expansion sheets. Give every arrow its own label, above its horizontal segment near the process. Reserve separate routing corridors so lines do not cross figures or any label.

The main sheet does not require rigid columns. The super admin is next to account/report functions, the reports and operations processes sit to the right of clinical work, and the prescription store is below its process. Each role and each store remains a single shared figure. The detailed sheets use shared sidebars where the additional flows need more structure.

## Applying that method to this project

| User actions | Derived process | Main saved records |
| --- | --- | --- |
| Register/update accounts and pets; assign personnel to clinics | 1.0 Manage Accounts and Pets | D1 Account and Pet Records |
| Set clinic acceptance/online availability; book; examine; capture consent; diagnose | 2.0 Manage Bookings and Clinical Care | D2 Booking and Clinical Records |
| Issue/amend a pet prescription; start each item; generate dates; tick completed doses | 3.0 Manage Prescriptions and Schedules | D3 Prescription and Task Records |
| Perform grooming/boarding, manage stock/services, verify payments and refund | 4.0 Manage Clinic Operations | D4 Clinic Operations and Billing Records |
| Filter dashboards/reports, inspect activity, obtain backups | 5.0 Generate Reports and Monitor System | Reads existing records; no invented reports table |

## One worked example

The admin supplies examination findings, images, owner consent, and the assigned veterinarian. These are input data, so the admin is an external entity and the information labels an arrow. The system processes that input in 2.3 Conduct Physical Examination. It saves the exam and recording staff in D2, then returns examination/reassignment status and assigned-patient status. This is a data transformation, not a flowchart of button clicks.

For prescriptions, 2.0 supplies medication details to 3.0. The owner supplies selected items, individual start dates, and completion updates. The system generates each item's dated occurrences, stores them in D3, and returns schedules, checklist state, and reminders. A clinic or online diagnosis can supply the prescription.

## Scope and simplification

- The first sheet is a concise overview of the main data transformations, not an exhaustive inventory of all HTTP requests, SQL reads, status updates, or notification deliveries. Detailed sheets add those important inputs/outputs without placing them all on the main page.
- The context sheet shows the system as process 0 with the four roles. The five main processes are broad functional groups; detail numbers such as 2.3 expand their parent.
- Data stores are logical groups, not physical tables or UML classes. Their exact table mapping is included below and in the JSON model.
- A line shows data movement, not a foreign key, association multiplicity, or chronological sequence. Do not imitate accidental database-to-user or user-to-store shortcuts: all flows pass through a process.
- Reports read existing clinical and operational data. There is no fictitious reports database. The main sheet shows the major report sources; the report detail sheet also shows account/pet sources. The backup process separately reads all four store groups.

## Current changes represented

- The admin performs the physical examination, captures consent, records examination provenance, and may reassign the veterinarian. The vet can still capture additional consent during diagnosis.
- Onsite availability uses assigned/accepting vets and clinic hours, with one concurrent medical booking per vet. Online availability remains separate. Grooming and boarding keep their independent capacity rules.
- The vet receives assigned case status during examination. Current-day My List and future booking/todo views are display projections of these booking/clinical/task records, not separate data stores.
- Prescriptions are pet-specific, amendable/replacement-aware, and scheduled per item with individual start dates, frequency, duration and completion state. Clinic and online diagnosis both supply prescriptions.
- Prescription notifications link owners to the relevant tasks. Prescription printing is an output of diagnosis when medication content exists; it is not a mandatory process for an empty prescription.
- Grooming, boarding, stock, service catalogues, billing, refunds, notifications, reporting, activity and backups remain in scope.
- The source migration defines clinical_intakes although the supplied SQL export omits it. The diagram describes that current examination workflow; no SQL or DB change was made.

## Source evidence

### accounts

- [src/services/accountService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/accountService.js)
- [src/services/userLogin.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/userLogin.js)
- [src/services/profileService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/profileService.js)
- [php/branch_helpers.php](C:/Users/Admin/WebstormProjects/untitled1/php/branch_helpers.php)

### pets

- [src/services/petService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/petService.js)
- [src/services/ConnectOwnership.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/ConnectOwnership.js)
- [src/services/recordUpdateRequestService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/recordUpdateRequestService.js)

### availability

- [php/clinic_booking_helpers.php](C:/Users/Admin/WebstormProjects/untitled1/php/clinic_booking_helpers.php)
- [src/services/vetBookingScheduleService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/vetBookingScheduleService.js)
- [src/services/vetScheduleService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/vetScheduleService.js)

### booking

- [src/services/bookingService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/bookingService.js)
- [php/get_bookings.php](C:/Users/Admin/WebstormProjects/untitled1/php/get_bookings.php)

### exam

- [src/components/AdminDashboardsComponent/PatientIntake.jsx](C:/Users/Admin/WebstormProjects/untitled1/src/components/AdminDashboardsComponent/PatientIntake.jsx)
- [php/clinical_intakes.php](C:/Users/Admin/WebstormProjects/untitled1/php/clinical_intakes.php)
- [php/consent_record_helpers.php](C:/Users/Admin/WebstormProjects/untitled1/php/consent_record_helpers.php)

### diagnosis

- [src/components/VetrinarianComponents/VetDiagnosis.jsx](C:/Users/Admin/WebstormProjects/untitled1/src/components/VetrinarianComponents/VetDiagnosis.jsx)
- [php/vet_diagnoses.php](C:/Users/Admin/WebstormProjects/untitled1/php/vet_diagnoses.php)

### online

- [src/services/onlineConsultationService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/onlineConsultationService.js)
- [php/online_consultations.php](C:/Users/Admin/WebstormProjects/untitled1/php/online_consultations.php)

### prescriptions

- [src/services/prescriptionService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/prescriptionService.js)
- [php/prescription_helpers.php](C:/Users/Admin/WebstormProjects/untitled1/php/prescription_helpers.php)
- [php/prescriptions.php](C:/Users/Admin/WebstormProjects/untitled1/php/prescriptions.php)
- [src/components/PetOwnerDashboard/Todos.jsx](C:/Users/Admin/WebstormProjects/untitled1/src/components/PetOwnerDashboard/Todos.jsx)

### notifications

- [php/notification_helpers.php](C:/Users/Admin/WebstormProjects/untitled1/php/notification_helpers.php)
- [src/services/notificationService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/notificationService.js)

### care

- [src/services/boardingService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/boardingService.js)
- [src/services/groomingService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/groomingService.js)

### inventory

- [src/services/inventoryApi.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/inventoryApi.js)
- [src/services/serviceCatalogService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/serviceCatalogService.js)

### billing

- [php/visit_billing.php](C:/Users/Admin/WebstormProjects/untitled1/php/visit_billing.php)
- [src/services/visitBillingService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/visitBillingService.js)
- [src/services/paymentMethodService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/paymentMethodService.js)

### reports

- [php/reports_common.php](C:/Users/Admin/WebstormProjects/untitled1/php/reports_common.php)
- [src/services/reportService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/reportService.js)

### backup

- [php/system_backup_common.php](C:/Users/Admin/WebstormProjects/untitled1/php/system_backup_common.php)
- [src/services/systemBackupService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/systemBackupService.js)
- [php/staff_activity_helpers.php](C:/Users/Admin/WebstormProjects/untitled1/php/staff_activity_helpers.php)
- [src/services/staffActivityService.js](C:/Users/Admin/WebstormProjects/untitled1/src/services/staffActivityService.js)

## Logical data store mapping

### D1 — Account and Pet Records

`users`, `admin_profiles`, `veterinarian_profiles`, `user_auth_identities`, `admin_feature_permissions`, `admin_feature_permission_audit`, `api_access_tokens`, `email_otp_tokens`, `google_auth_onboarding_tokens`, `pets_information`, `pet_ownership`, `pet_coparent_requests`, `pet_catalog_options`, `user_branch_assignments`

### D2 — Booking and Clinical Records

`branches`, `branch_operating_hours`, `branch_closures`, `branch_service_availability`, `veterinarian_booking_clinics`, `vet_schedules`, `veterinarian_working_hours`, `veterinarian_booking_time_off`, `veterinarian_branch_schedules`, `bookings`, `booking_pets`, `booking_branch_transfers`, `queues`, `vet_queue_assignments`, `vet_diagnoses`, `consent_files`, `consent_form_records`, `pet_allergies`, `pet_vaccinations`, `history_before_registration`, `pet_record_update_requests`, `pet_record_update_request_events`, `pet_medical_record_groups`, `pet_medical_record_group_items`, `pet_medical_certificates`, `clinical_intakes`, `online_consultations`, `online_consultation_diagnoses`, `online_consultation_reschedules`, `visits`

### D3 — Prescription and Task Records

`prescription_plans`, `prescription_items`, `prescription_occurrences`, `prescription_events`, `pet_owner_todos`, `mail_queue`, `notification_preferences`, `notification_push_subscriptions`, `user_notifications`

### D4 — Clinic Operations and Billing Records

`grooming_jobs`, `grooming_events`, `grooming_photos`, `grooming_reviews`, `boarding_assignments`, `boarding_documents`, `boarding_material_usages`, `boarding_observations`, `boarding_tasks`, `rooms`, `room_unit_statuses`, `inventory_items`, `inventory_branch_items`, `inventory_batches`, `inventory_locations`, `inventory_suppliers`, `inventory_stock_movements`, `inventory_stock_receipts`, `inventory_stock_receipt_items`, `inventory_transfers`, `inventory_transfer_items`, `inventory_action_audit`, `service_materials`, `service_catalog`, `special_service_catalog`, `special_service_booking_items`, `visit_charges`, `visit_payments`, `visit_invoice_documents`, `visit_payment_refunds`, `payment_methods`, `booking_payment_submissions`, `booking_payment_refunds`, `service_display_settings`, `system_backups`, `system_backup_settings`

