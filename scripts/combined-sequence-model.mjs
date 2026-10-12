// A system-boundary sequence overview, not an activity or database diagram.
export const output = 'outputs/ipawcus-sequence-diagram-2026-10-08-combined';
export const title = 'iPawcus: A Web-Based Veterinary Management System with Online Booking and Pet Record Management for Vetfocus Care Animal Clinic';
export const participants = [
    { id: 'SA', label: ['Super Admin', '(Clinic Owner)'], x: 130, actor: true },
    { id: 'AD', label: ['Admin', '(Nurse / Staff)'], x: 410, actor: true },
    { id: 'VT', label: ['Veterinarian'], x: 690, actor: true },
    { id: 'PO', label: ['Pet Owner'], x: 970, actor: true },
    { id: 'SYS', label: ['iPawcus System', 'React UI + PHP API'], x: 1360, actor: false, w: 300 },
    { id: 'DB', label: ['Database', 'MariaDB / MySQL'], x: 1810, actor: false, w: 240 },
];
const e = (file, needle) => ({ file, needle });
const m = (id, from, to, text, kind, evidence, explanation) => ({ type: 'message', id, from, to, text, kind, evidence, explanation });
const ref = (id, text, detail, evidence) => ({ type: 'ref', id, text, detail, evidence });
const group = (id, operator, guard, events, branches) => ({ type: 'group', id, operator, branches: branches || [{ guard, events }] });

export const references = {
    R1: {
        title: 'Shared authentication and role authorization',
        explanation: 'Every role signs in independently. Registration/email verification, login, account status and protected API authorization are a shared interaction, not one login shared by four people. Each request still checks the applicable role and clinic/patient access. The existing dashboard debug bypass is not changed by this documentation.',
        steps: ['User supplies account details or signs in.', 'System validates credentials, account status and any required verification against stored records.', 'On success, the API returns a token/user context and the interface opens the appropriate dashboard; invalid or unauthorized requests are rejected.', 'Subsequent protected requests apply role, clinic and patient authorization.'],
        evidence: [e('src/services/userLogin.js', 'loginUser'), e('php/login.php', 'access_token'), e('php/role_access.php', 'ipawcus_require_current_api_user')],
    },
    R2: {
        title: 'Optional external integrations and local document generation',
        explanation: 'These are deliberately not additional lifelines in the overview. No fictional single external service is invented. Notifications, location lookup, meetings and documents remain different mechanisms inside or beyond the system boundary.',
        steps: ['Address input may call Geoapify autocomplete/reverse lookup in the browser. This is optional and is not required for every clinic visit.', 'An authorized online call obtains configured meeting access and uses Jitsi/JaaS. Runtime configuration can select JaaS or another Jitsi base URL; the diagram does not assume every call uses a self-hosted deployment.', 'In-app notifications retain recipient, read state and redirect path. Email/push delivery depends on preferences and configured delivery. Refreshing My List is an automatic GET-backed view update, not a new push-notification endpoint.', 'Consent PDFs, receipts and prescription print documents are generated through the existing document helpers. Diagnosis printing opens a browser print dialog only when the onsite diagnosis has printable medicines; it does not guarantee a physical printer completes the job.', 'Report PDF and Excel files are currently generated in the browser by the report export helpers (jsPDF and ExcelJS), not by a separate database or fictitious report server.'],
        evidence: [e('src/services/addressAutocomplete.js', 'api.geoapify.com'), e('php/online_consultation_helpers.php', 'getJitsiBaseUrl'), e('src/components/shared/JaaSMeeting.jsx', 'JaaSMeeting'), e('php/notification_helpers.php', 'notification_create_event'), e('src/services/consentDocumentPdf.js', 'export'), e('src/lib/reportExport.js', 'exportReportExcel')],
    },
    R3: {
        title: 'Medical records, release/email and corrections',
        explanation: 'Reading/emailing an accessible medical record and requesting a correction are different interactions. A pet owner does not directly replace a verified veterinarian record.',
        steps: ['Owner requests accessible pet history or an email copy; the system checks patient access, reads the record and returns/queues the copy.', 'For a correction, the owner submits requested changes and applicable payment proof.', 'Admin reviews the request, verifies payment where required and approves/rejects or assigns a veterinarian.', 'The assigned veterinarian starts the request, makes permitted record changes, supplies completion notes and completes it after payment/change checks.', 'The system saves the clinical changes and audit events, and notifies the owner of completion.'],
        evidence: [e('src/services/petService.js', 'emailPetMedicalRecords'), e('php/pet_medical_records.php', 'email_copy'), e('php/record_update_requests.php', "'verify_payment'"), e('php/record_update_requests.php', "'complete'"), e('php/record_update_requests.php', 'notification_send_record_update_request_completed_to_owner')],
    },
    R4: {
        title: 'Independent operational and governance requests',
        explanation: 'These are separately invoked operations, not mandatory steps of every appointment. Combining them in a reference avoids pretending that an Admin stock entry must always be followed by a Super Admin export or backup.',
        steps: ['Admin manages catalogue/material definitions, inventory receipts/stock-out/transfers, branch care observations/tasks, payments and authorized refunds. The system checks permissions, saves affected records and audits stock/financial changes.', 'Super Admin manages accounts, roles, clinic assignments and clinic/payment configuration. Payment-method security operations retain applicable OTP checks.', 'Super Admin requests filtered reports; PHP reads operational data and returns the report model. The browser can preview/print it or produce PDF/Excel files.', 'Authorized monitoring views read staff activity/media. Media monitoring is available to Super Admin and Veterinarian in the current endpoint.', 'Active Super Admin requests a complete backup; the backend creates the export and streams the archive. Backup history/settings do not imply that every role can download backups.', 'Users update their own profiles, notification preferences and tasks according to role. Veterinarian My List is today-only, with a next-booked-day preview; future bookings remain in calendar To-dos.'],
        evidence: [e('src/services/visitBillingService.js', 'postVisitRefund'), e('php/inventory.php', 'stock'), e('php/service_catalog.php', 'service_catalog'), e('php/payment_methods.php', 'otp'), e('php/reports_generate.php', 'reports_build_report'), e('src/lib/reportExport.js', 'exportReportPdf'), e('php/staff_activity_helpers.php', 'function'), e('php/pet_media_monitoring.php', 'super_admin'), e('php/system_backups.php', 'super_admin'), e('docs/shared-veterinarian-booking.md', 'My List shows only')],
    },
    R5: {
        title: 'Care review and release coordination',
        explanation: 'Grooming and boarding/confinement are independent service paths. They are summarized in the alternative care branch, rather than placed after every medical visit.',
        steps: ['Admin records the required care details, photos/observations and applicable room, material and task updates.', 'If grooming requires a veterinarian assessment, staff requests the assigned veterinarian review and pauses the grooming job. The veterinarian returns the permitted resume, stop or separate-consultation decision.', 'A review alone does not automatically create a medical diagnosis or consultation charge.', 'Finish/check-out prepares the applicable invoice and care history; it does not silently mark the invoice paid. Pickup/discharge retains required workflow and payment checks.'],
        evidence: [e('docs/grooming-management.md', 'Vet review'), e('src/services/boardingService.js', 'checkOutBoardingBooking'), e('php/grooming.php', 'grooming')],
    },
};

export const events = [
    ref('R1', 'Sign in independently; authorize each role and request', references.R1.explanation, references.R1.evidence),
    group('setup', 'opt', 'Clinic / veterinarian configuration changes', [
        m('s1', 'SA', 'SYS', 'Manage accounts, roles and clinic assignments', 'call', [e('src/services/accountService.js', 'updatePersonnelAccountDetails'), e('php/veterinarian_booking_schedule.php', 'Only Super Admin can assign clinics')], 'Super Admin determines the staff clinic assignments. Account activation/deactivation and role-specific professional data remain part of this summarized account operation.'),
        m('s2', 'SYS', 'DB', 'Save access / clinic configuration', 'call', [e('php/update_account_profile.php', 'user_id'), e('php/veterinarian_booking_schedule.php', 'user_branch_assignments')], 'This represents related persistence operations, not a new all-in-one SQL statement.'),
        m('s3', 'VT', 'SYS', 'Set site acceptance and separate online slots', 'call', [e('src/services/vetBookingScheduleService.js', 'export'), e('src/services/vetScheduleService.js', 'updateVetSchedule')], 'Onsite acceptance is per assigned clinic. Online-call start selections are separate; veterinarian presence today is not an onsite booking-hours calendar.'),
        m('s4', 'SYS', 'DB', 'Save preferences / protect bookings', 'call', [e('php/veterinarian_booking_schedule.php', 'pending'), e('php/update_vet_schedule.php', 'confirmed')], 'Saving preferences cannot abandon protected existing bookings. One veterinarian cannot overlap medical services across clinics and online calls.'),
    ]),
    group('pets', 'opt', 'New pet / ownership-link request', [
        m('p1', 'PO', 'SYS', 'Register pet / request link', 'call', [e('src/services/addPet.js', 'export'), e('php/link_pet.php', 'pet_id')], 'Owner/co-parent access remains validated; an ownership request is not automatically accepted for someone else\'s pet.'),
        m('p2', 'SYS', 'DB', 'Validate and save pet / ownership', 'call', [e('php/add_pet.php', 'pets_information'), e('php/link_pet.php', 'pet_ownership')], 'Registration and ownership links are separate supporting records, summarized at the system boundary.'),
        m('p3', 'SYS', 'PO', 'Pet record / owner-link status', 'reply', [e('src/services/petService.js', 'fetchUserPets')], 'The result can be a saved pet, existing link or pending co-parent approval; approval steps are retained in the explanation.'),
    ]),
    group('booking', 'opt', 'Scheduled service request; walk-ins skip booking', [
        m('b1', 'PO', 'SYS', 'Find service / date / vet options', 'call', [e('src/services/bookingAvailabilityService.js', 'export')], 'The owner chooses the relevant clinic/service or the online veterinarian before checking availability.'),
        m('b2', 'SYS', 'DB', 'Check capacity and vet conflicts', 'call', [e('php/clinic_booking_helpers.php', 'function'), e('docs/shared-veterinarian-booking.md', 'Three accepting')], 'Onsite medical capacity follows clinic hours and eligible veterinarians, not overlapping independent medical-service capacities. Online calls use separate selected slots. Grooming and boarding keep their own slot/room rules.'),
        m('b3', 'SYS', 'PO', 'Available dates and times', 'reply', [e('php/booking_availability.php', 'json_encode')], 'Unavailable or conflicting choices are rejected; the user can select another option.'),
        m('b4', 'PO', 'SYS', 'Submit booking / payment proof', 'call', [e('src/services/bookingService.js', 'createBooking')], 'Includes service concern and applicable upload/payment details. Payment proof applies where required, not to every booking. Optional home-service address lookup is R2. Failed validation does not create a valid booking.'),
        m('b5', 'SYS', 'DB', 'Reserve / save pending booking', 'call', [e('php/add_booking.php', 'bookings')], 'Medical bookings reserve a veterinarian when created, before confirmation. This avoids displaying four patients against only three accepting veterinarians. Nonmedical services reserve their own applicable capacity, not a veterinarian.'),
        m('b6', 'AD', 'SYS', 'Review booking / payment; confirm or adjust', 'call', [e('src/services/bookingService.js', 'reviewBookingPayment'), e('src/services/bookingService.js', 'updateBookingStatus')], 'Admin may reject, reschedule, transfer clinic or adjust assignment through the authorized endpoints. The main trace shows an accepted/confirmed request, not all error alternatives.'),
        m('b7', 'SYS', 'DB', 'Save review / booking status', 'call', [e('php/update_booking_status.php', 'confirmed'), e('php/booking_payment_review.php', 'payment')], 'Database persistence precedes the displayed booking result and resulting notification.'),
        m('b8', 'SYS', 'PO', 'Booking result / notification', 'signal', [e('php/notification_helpers.php', 'notification_send_booking_event')], 'This is a user-facing result/status event, not an acknowledgement from an unrelated owner session. Notification delivery and navigation are R2.'),
    ]),
    group('care', 'alt', null, null, [
        { guard: 'Onsite medical patient (booking or walk-in)', events: [
            m('c1', 'AD', 'SYS', 'Receive / assign patient; start examination', 'call', [e('src/components/AdminDashboardsComponent/PatientIntake.jsx', 'startClinicalIntake'), e('src/services/queueService.js', 'export')], 'An approved queue and assigned veterinarian are required. A booked arrival uses receiveBooking; a walk-in uses the queue flow. Staff start physical examination, not the pet owner.'),
            m('c2', 'SYS', 'DB', 'Save queue / intake / assigned vet', 'call', [e('php/clinical_intakes.php', 'INSERT INTO clinical_intakes')], 'Intake preserves examined-by staff independently of the assigned veterinarian and links the same pet/queue context.'),
            m('c3', 'SYS', 'VT', 'My List refresh: undergoing examination', 'signal', [e('src/components/AdminDashboardsComponent/PatientIntake.jsx', 'My List'), e('docs/shared-veterinarian-booking.md', 'My List shows only')], 'Represents the automatic GET-backed visible refresh. It does not invent a server push endpoint; My List is today-only, and future bookings remain in To-dos/next-day preview.'),
            m('c4', 'PO', 'AD', 'Sign consent during examination', 'signal', [e('src/components/AdminDashboardsComponent/PatientIntake.jsx', 'createAndUploadConsentDocumentPdf')], 'This is the owner\'s signing interaction administered by staff; it does not assume the owner has permission to call the admin intake endpoint.'),
            m('c5', 'AD', 'SYS', 'Save findings / images / consent; reassign if needed / complete exam', 'call', [e('src/components/AdminDashboardsComponent/PatientIntake.jsx', 'saveClinicalIntake'), e('src/components/AdminDashboardsComponent/PatientIntake.jsx', 'reassigned'), e('php/clinical_intakes.php', 'Capture and save the pet owner consent')], 'Summarizes complaint, symptoms, urgent signs, vitals, physical findings and uploaded images. Admin can reassign the veterinarian before completion. Linked consent must already be saved before completing the intake.'),
            m('c6', 'SYS', 'DB', 'Save exam / consent / assignment', 'call', [e('php/clinical_intakes.php', 'UPDATE clinical_intakes SET'), e('php/consent_form_records.php', 'consent')], 'These are coordinated steps from separate existing endpoints, not a claim of one atomic combined intake/consent API.'),
            m('c7', 'VT', 'SYS', 'Finalize diagnosis / treatment; consent if needed', 'call', [e('src/services/vetDiagnosisService.js', 'export'), e('src/components/VetrinarianComponents/VetDiagnosis.jsx', 'handleSaveDiagnosis')], 'Veterinarian review retains exam provenance, assessment, laboratory findings, treatment, follow-up and optional additional consent. Starting examination is not the same as completing diagnosis.'),
            m('c8', 'SYS', 'DB', 'Save diagnosis / visit / history', 'call', [e('php/vet_diagnoses.php', 'vet_diagnoses'), e('php/vet_diagnoses.php', 'visitBilling')], 'Clinical finalization includes existing transaction/visit/invoice integration. Prescription synchronization, when needed, is summarized by the following guarded fragment.'),
        ] },
        { guard: 'Online consultation booking', events: [
            m('o1', 'VT', 'SYS', 'Start authorized online consultation', 'call', [e('src/services/onlineConsultationService.js', 'startOnlineConsultation')], 'The veterinarian starts the scheduled call; the patient does not need an onsite intake.'),
            m('o2', 'PO', 'SYS', 'Join authorized call', 'call', [e('src/services/onlineConsultationService.js', 'joinOnlineConsultation')], 'System verifies booking/participant access and records join status before the authorized meeting UI is opened.'),
            ref('R2-call', 'R2: Jitsi / JaaS meeting access and video call', 'The configured meeting provider carries the actual video exchange. Meeting access and participants remain authorized; no single self-hosted deployment is assumed.', references.R2.evidence),
            m('o3', 'VT', 'SYS', 'Submit online diagnosis / recommendations', 'call', [e('src/services/onlineConsultationService.js', 'submitOnlineConsultationDiagnosis')], 'Includes medications where entered; completing the online diagnosis also completes the consultation/booking and prepares its visit billing.'),
            m('o4', 'SYS', 'DB', 'Save diagnosis / call completion', 'call', [e('php/online_consultations.php', "'online_consultation'"), e('php/online_consultations.php', 'visit_billing_ensure_online_consultation_visit')], 'Online diagnoses synchronize prescription plans in the existing backend. A cancelled/no-show call follows a different status path, not a successful diagnostic result.'),
        ] },
        { guard: 'Grooming / boarding / confinement care', events: [
            m('g1', 'AD', 'SYS', 'Run care job / room stay; record care', 'call', [e('src/services/groomingService.js', 'updateGroomingJob'), e('src/services/boardingService.js', 'checkInBoardingBooking')], 'Grooming has receive/before photo/start/after photo/finish/pickup states; boarding has room assignment, check-in, observations, tasks, documents/materials and check-out. These are alternative care types, not required steps of an online or medical visit.'),
            m('g2', 'SYS', 'DB', 'Save care / materials / charges', 'call', [e('php/grooming.php', 'grooming'), e('php/boarding_management.php', 'boarding')], 'Required care evidence and applicable capacity checks remain. Grooming finishing prepares/reuses an invoice but does not mark it paid. A requested vet review pauses grooming and does not create a diagnosis or consultation charge automatically.'),
            ref('R5-care', 'R5: Care updates; vet review if requested; discharge / pickup after checks', 'Admin requests the assigned veterinarian\'s review only when necessary. Boarding checkout and grooming pickup retain the current workflow/payment restrictions; no automatic discharge is invented.', references.R5.evidence),
        ] },
    ]),
    group('prescription', 'opt', 'Diagnosis contains new / changed medicines (onsite or online)', [
        m('r1', 'SYS', 'DB', 'Sync pet plan / items; retain versions', 'call', [e('php/prescription_helpers.php', 'prescription_sync_plan'), e('php/online_consultations.php', 'prescription_sync_plan')], 'This is part of the diagnostic finalization persistence, shown after the shared diagnostic branches for concision. A changed plan supersedes the previous plan and cancels its pending occurrences while retaining history. Empty content creates no new plan.'),
        m('r2', 'SYS', 'PO', 'New / updated plan notification', 'signal', [e('php/prescription_helpers.php', 'prescription_notify_plan')], 'Notification follows persisted changed content and directs the owner to the relevant pet prescription plan. Unchanged content does not generate a replacement version.'),
    ]),
    group('print', 'opt', 'Onsite diagnosis has printable medicines', [
        m('r3', 'SYS', 'VT', 'Open prescription print dialog', 'signal', [e('src/components/VetrinarianComponents/VetDiagnosis.jsx', 'hasPrintablePrescriptions'), e('src/components/VetrinarianComponents/VetDiagnosis.jsx', 'printAfterSave')], 'No prescription means no automatic printing. Printing does not depend on creating a changed prescription version. The current online flow issues prescriptions but is not falsely claimed to use the onsite automatic-print handler.'),
    ]),
    group('prescription-start', 'opt', 'Owner starts available prescription item(s), new or existing', [
        m('r4', 'PO', 'SYS', 'Start items / all; dates per item', 'call', [e('src/services/prescriptionService.js', 'startPrescriptionPlan'), e('src/components/shared/PrescriptionPlanPanel.jsx', 'startDate')], 'Each medicine can start separately with its own start date, frequency, time slots/weekday rules and duration. Start all applies selected item settings rather than forcing one shared schedule.'),
        m('r5', 'SYS', 'DB', 'Create dated doses per item', 'call', [e('php/prescription_helpers.php', 'prescription_generate_occurrences')], 'Daily/hourly/weekly recurrences are generated for each medicine, not one combined schedule for every item. Three-times-daily defaults can use morning, noon and evening.'),
        m('r6', 'SYS', 'PO', 'Item checklist / calendar / To-dos', 'reply', [e('src/components/shared/PrescriptionPlanPanel.jsx', 'occurrence')], 'The response displays due occurrences and completion state. Starting a plan does not mark its doses completed.'),
    ]),
    group('billing', 'opt', 'Charges / payment / authorized refund', [
        m('f1', 'AD', 'SYS', 'Post charges / verify and record payment', 'call', [e('src/services/visitBillingService.js', 'postVisitPayment'), e('src/services/bookingService.js', 'reviewBookingPayment')], 'Catalogue services, medicines/products, material charges and applicable care fees remain separately auditable. A submitted proof is not automatically a verified payment.'),
        m('f2', 'SYS', 'DB', 'Save billing / payment; adjust stock', 'call', [e('php/visit_billing.php', 'visit_payments'), e('php/visit_billing.php', 'stock')], 'Only applicable sale/material operations affect stock. Refunds use the authorized refund endpoint and preserve payment/refund history rather than overwriting a sale.'),
        m('f3', 'SYS', 'PO', 'Invoice / receipt / status', 'signal', [e('php/visit_billing.php', 'invoice'), e('src/services/visitBillingService.js', 'postVisitRefund')], 'Receipt/print helpers are inside the system boundary (R2). The owner is shown the relevant invoice and payment/refund status.'),
    ]),
    group('doses', 'loop', 'Each due occurrence of a started prescription item', [
        m('d1', 'PO', 'SYS', 'Mark this dose done / skipped', 'call', [e('src/services/prescriptionService.js', 'updatePrescriptionOccurrence')], 'Each due item/date/time can be completed or skipped independently. This loop runs later when doses are due, not while the veterinarian remains in one long active session.'),
        m('d2', 'SYS', 'DB', 'Update occurrence / progress', 'call', [e('php/prescriptions.php', 'occurrence')], 'Updates a specific occurrence and plan status; other medicines and future doses are not marked completed automatically.'),
    ]),
    group('report', 'opt', 'Independent Super Admin report request', [
        m('a1', 'SA', 'SYS', 'Request filtered report / PDF / Excel', 'call', [e('src/lib/reportExport.js', 'exportReportPdf'), e('php/reports_generate.php', 'reports_build_report')], 'This operation is invoked independently of a particular appointment. The backend builds filtered data; the interface generates PDF or Excel files when requested.'),
        m('a2', 'SYS', 'DB', 'Read filtered operational records', 'call', [e('php/reports_generate.php', 'reports_build_report')], 'Reporting reads relevant stored clinical, booking, financial and inventory records; it does not create a second reporting database.'),
        m('a3', 'SYS', 'SA', 'Report view / export download', 'reply', [e('src/lib/reportExport.js', 'exportReportExcel')], 'The view/export result returns to the requesting Super Admin. Monitoring and backups remain separately invoked R4 interactions.'),
    ]),
    ref('R3', 'View / email records; correction: Owner → Admin review → Vet update → Owner result', references.R3.explanation, references.R3.evidence),
    ref('R4', 'Independent operations: stock / settings / reports / monitoring / backups', references.R4.explanation, references.R4.evidence),
    ref('R2', 'Supporting services: location / notifications / documents (invoked when needed)', references.R2.explanation, references.R2.evidence),
];

export const modelingNotes = [
    'This is a conceptual system-boundary UML sequence overview: UI and PHP forwarding are bundled, not removed from the architecture.',
    'Every role has exactly one visible lifeline. System and Database make six columns; unrelated providers are not falsely combined into one service lifeline.',
    'Messages preserve sender/receiver direction. Solid filled arrows are calls; dashed open arrows are replies; solid open arrows are user-facing updates or actor handoffs.',
    'Vertical order matters within a selected interaction. Opt and alt guards mean not every block runs; independent setup, record and governance requests are not mandatory per-visit steps.',
    'Repeated authentication and helper integrations use named ref fragments. Routine database acknowledgements and low-level UI/PHP forwarding are omitted, not reversed.',
    'Successful-path summaries do not draw every rejection, retry or no-show. Their guards and important integrity requirements remain in the explanation.',
    'Activation bars show short processing intervals, not entire months of medication use or one permanent login activation.',
    'No application, schema, original activity/class/context diagrams, dashboard bypass or user-uploaded image is modified.',
];
