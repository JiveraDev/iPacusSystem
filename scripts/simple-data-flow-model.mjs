// High-level logical DFD. Grouping data is deliberate: this is not an ERD.
export const roles = {
    owner: 'Pet Owner', admin: 'Admin', vet: 'Veterinarian', super: 'Super Admin',
};
export const stores = {
    D1: 'Account and\nPet Records',
    D2: 'Booking and\nClinical Records',
    D3: 'Prescription and\nTask Records',
    D4: 'Clinic Operations\nand Billing Records',
};
export const sources = {
    accounts: ['src/services/accountService.js', 'src/services/userLogin.js', 'src/services/profileService.js', 'php/branch_helpers.php'],
    pets: ['src/services/petService.js', 'src/services/ConnectOwnership.js', 'src/services/recordUpdateRequestService.js'],
    availability: ['php/clinic_booking_helpers.php', 'src/services/vetBookingScheduleService.js', 'src/services/vetScheduleService.js'],
    booking: ['src/services/bookingService.js', 'php/get_bookings.php'],
    exam: ['src/components/AdminDashboardsComponent/PatientIntake.jsx', 'php/clinical_intakes.php', 'php/consent_record_helpers.php'],
    diagnosis: ['src/components/VetrinarianComponents/VetDiagnosis.jsx', 'php/vet_diagnoses.php'],
    online: ['src/services/onlineConsultationService.js', 'php/online_consultations.php'],
    prescriptions: ['src/services/prescriptionService.js', 'php/prescription_helpers.php', 'php/prescriptions.php', 'src/components/PetOwnerDashboard/Todos.jsx'],
    notifications: ['php/notification_helpers.php', 'src/services/notificationService.js'],
    care: ['src/services/boardingService.js', 'src/services/groomingService.js'],
    inventory: ['src/services/inventoryApi.js', 'src/services/serviceCatalogService.js'],
    billing: ['php/visit_billing.php', 'src/services/visitBillingService.js', 'src/services/paymentMethodService.js'],
    reports: ['php/reports_common.php', 'src/services/reportService.js'],
    backup: ['php/system_backup_common.php', 'src/services/systemBackupService.js', 'php/staff_activity_helpers.php', 'src/services/staffActivityService.js'],
    tasks: ['src/services/todoService.js'],
    presence: ['src/services/vetPresenceService.js', 'php/vet_presence.php'],
    media: ['src/services/petMediaMonitoringService.js'],
};
const I = (ref, label, direction = 'in') => ({ ref, label, direction });
const block = (number, name, feature, items) => ({ number, name, feature, items });

// Explicit system-boundary contract. IN always means role -> process 0;
// OUT always means process 0 -> role, regardless of the role's placement.
const C = (actor, direction, data, feature, covers, shortLabel) => ({ actor, direction, data, feature, covers, shortLabel });
export const contextFlows = [
    C('super', 'in', 'Account, role and clinic assignments', 'accounts', ['Personnel accounts', 'Role assignments', 'Veterinarian clinic assignments'], 'User Accounts'),
    C('super', 'in', 'Clinic, access and payment settings', 'billing', ['Clinic information', 'Admin feature access', 'Payment-method configuration'], 'Clinic Settings'),
    C('super', 'in', 'Report, media and backup requests', 'backup', ['Report filters', 'Staff activity queries', 'Media monitoring queries', 'Local backup requests'], 'Monitoring Requests'),
    C('super', 'out', 'Account and configuration status', 'accounts', ['Account status', 'Clinic assignment status', 'Configuration status'], 'Account Status'),
    C('super', 'out', 'Reports, media and staff history', 'reports', ['Dashboard summaries', 'Report exports', 'Pet media results', 'Staff activity history'], 'Reports and History'),
    C('super', 'out', 'Backup files and download status', 'backup', ['Backup archive download', 'Backup audit and download status'], 'Backup Results'),
    C('admin', 'in', 'Pet, booking and queue details', 'booking', ['Pet registration', 'Booking review and changes', 'Queue coordination'], 'Booking Details'),
    C('admin', 'in', 'Exam findings, images and vet assignment', 'exam', ['Physical examination findings', 'Examination photos', 'Assigned veterinarian and reassignment'], 'Exam Findings'),
    C('admin', 'in', 'Signed consent records', 'exam', ['Owner signature captured during examination', 'Consent document and examination linkage'], 'Signed Consent'),
    C('admin', 'in', 'Care, stock, billing and refund entries', 'care', ['Grooming', 'Boarding', 'Clinical confinement', 'Service catalog', 'Inventory updates', 'Charges', 'Payment verification', 'Refund records'], 'Operations Entries'),
    C('admin', 'out', 'Booking, queue and examination status', 'exam', ['Booking results', 'Queue worklist', 'Examination and reassignment status'], 'Patient Status'),
    C('admin', 'out', 'Patient records and signed documents', 'pets', ['Pet and medical records', 'Consent documents', 'Record-request results'], 'Patient Records'),
    C('admin', 'out', 'Care, stock, invoices and payment status', 'billing', ['Care and room status', 'Inventory status', 'Billing invoices', 'Verified payment and refund status'], 'Operations Results'),
    C('vet', 'in', 'Clinic acceptance and online availability', 'availability', ['Accept bookings per assigned clinic', 'Independent online consultation start times'], 'Booking Availability'),
    C('vet', 'in', 'Diagnosis, lab and consultation records', 'diagnosis', ['Clinical diagnosis and treatment', 'Manually recorded lab findings', 'Online consultation notes and diagnosis', 'Vaccination and medical-record updates'], 'Clinical Findings'),
    C('vet', 'in', 'Prescription changes and additional consent', 'prescriptions', ['Clinic and online prescriptions', 'Prescription amendments and replacements', 'Additional owner consent records'], 'Prescriptions and Consent'),
    C('vet', 'in', 'Task updates and presence status', 'tasks', ['Task details and completion', 'Queue presence sign-in and status'], 'Tasks and Presence'),
    C('vet', 'out', 'Assigned patients, exam and medical records', 'exam', ['Assigned patients during physical examination', 'Examination findings and recording staff', 'Medical history and saved lab findings'], 'Assigned Patient Records'),
    C('vet', 'out', 'Bookings and online consultation details', 'online', ['Today My List', 'Next booked day preview', 'All assigned booking schedules', 'Online call details'], 'Booking Schedules'),
    C('vet', 'out', 'Task calendar and treatment reminders', 'notifications', ['Generated task calendar', 'Booking counts', 'Task and treatment notifications'], 'Calendar and Reminders'),
    C('owner', 'in', 'Account, pet and ownership details', 'pets', ['Registration and login credentials', 'Profile and pet details', 'Ownership linking', 'Medical-record update requests'], 'Account and Pet Details'),
    C('owner', 'in', 'Booking, queue and change requests', 'booking', ['Medical, online, grooming and boarding bookings', 'Self-service queue entry', 'Reschedule and cancel requests'], 'Appointment Requests'),
    C('owner', 'in', 'Payment proof and consent signatures', 'billing', ['Payment proof', 'Owner signatures for examination and additional consent'], 'Payments and Consent'),
    C('owner', 'in', 'Item start dates and completion updates', 'prescriptions', ['Selected medication items', 'Per-item start dates', 'Taken and skipped occurrences'], 'Medication Updates'),
    C('owner', 'out', 'Account, pet and booking status', 'pets', ['Account and pet status', 'Ownership and record-request results', 'Booking confirmation and details', 'Queue status'], 'Account and Booking Status'),
    C('owner', 'out', 'Medical records and current prescriptions', 'prescriptions', ['Medical history', 'Current clinic and online prescription', 'Replacement prescription information'], 'Records and Prescriptions'),
    C('owner', 'out', 'Invoices, payment and consent documents', 'billing', ['Invoices', 'Payment and refund status', 'Signed consent documents'], 'Billing and Consent Documents'),
    C('owner', 'out', 'Dated checklists, calendars and reminders', 'notifications', ['Per-item dated occurrences', 'TODO checklist', 'Schedule calendar', 'New prescription and due-task notifications'], 'Schedules and Reminders'),
];

export const overview = {
    id: '01-simple-data-flow', title: 'iPawcus — Simple Data Flow Diagram', level: 'overview',
    note: 'Main data flows only. Each user role and each data store appears once.',
    blocks: [
        block('1.0', 'Manage Accounts\nand Pets', 'accounts', [
            I('owner', 'Account and pet details'), I('owner', 'Account and pet status', 'out'),
            I('super', 'Personnel and clinic assignments'), I('super', 'Account and access status', 'out'),
            I('D1', 'Account and pet records', 'out'),
        ]),
        block('2.0', 'Manage Bookings\nand Clinical Care', 'booking', [
            I('owner', 'Booking and consent details'), I('owner', 'Booking and medical summary', 'out'),
            I('admin', 'Exam, consent and vet assignment'), I('admin', 'Examination and queue status', 'out'),
            I('vet', 'Availability and clinical findings'), I('vet', 'Assigned patients and bookings', 'out'),
            I('D2', 'Booking and clinical records', 'out'),
        ]),
        block('3.0', 'Manage Prescriptions\nand Schedules', 'prescriptions', [
            I('process:2.0', 'Prescription details'),
            I('owner', 'Item start dates and completion'), I('owner', 'Schedules and reminders', 'out'),
            I('D3', 'Pet prescription plans'), I('D3', 'Dated schedule updates', 'out'),
        ]),
        block('4.0', 'Manage Clinic\nOperations', 'care', [
            I('admin', 'Care, stock and payment entries'), I('admin', 'Care, stock and billing status', 'out'),
            I('D4', 'Clinic and billing records', 'out'),
        ]),
        block('5.0', 'Generate Reports\nand Monitor System', 'reports', [
            I('super', 'Report and monitoring criteria'), I('super', 'Reports and dashboard results', 'out'),
            I('D2', 'Booking and clinical statistics'), I('D4', 'Care, stock and billing statistics'),
        ]),
    ],
};
export const details = [
    { id: '02-accounts-and-pets', title: '1.0 — Accounts and Pets', parent: '1.0', level: 'detail', blocks: [
        block('1.1', 'Authenticate and\nManage Accounts', 'accounts', [
            ...Object.keys(roles).flatMap(ref => [I(ref, 'Credentials and profile details'), I(ref, 'Access and profile status', 'out')]),
            I('D1', 'User and role records'), I('D1', 'Account changes', 'out'),
        ]),
        block('1.2', 'Assign Personnel\nto Clinics', 'accounts', [I('super', 'Clinic and role assignments'), I('super', 'Assignment status', 'out'), I('D1', 'Personnel and access records'), I('D1', 'Clinic access changes', 'out')]),
        block('1.3', 'Register and\nUpdate Pets', 'pets', [I('owner', 'Pet details'), I('owner', 'Pet record status', 'out'), I('D1', 'Existing pet records'), I('D1', 'Pet record changes', 'out')]),
        block('1.4', 'Manage Ownership\nand Medical History', 'pets', [I('owner', 'Ownership and record requests'), I('owner', 'Ownership and medical history', 'out'), I('D1', 'Pet details and ownership'), I('D1', 'Ownership changes', 'out'), I('D2', 'Medical record history'), I('D2', 'Medical-record requests', 'out')]),
    ] },
    { id: '03-bookings-and-clinical-care', title: '2.0 — Bookings and Clinical Care', parent: '2.0', level: 'detail', blocks: [
        block('2.1', 'Set Booking\nAvailability', 'availability', [I('vet', 'Clinic acceptance and online slots'), I('vet', 'Booking availability', 'out'), I('D1', 'Assigned clinics'), I('D2', 'Clinic hours and reservations'), I('D2', 'Booking preferences and online slots', 'out')]),
        block('2.2', 'Create and\nReview Bookings', 'booking', [I('owner', 'Service, pet and booking details'), I('owner', 'Booking confirmation', 'out'), I('admin', 'Booking review and assignment'), I('D2', 'Available slots and booking data'), I('D2', 'Reserved booking and assigned vet', 'out')]),
        block('2.3', 'Conduct Physical\nExamination', 'exam', [I('admin', 'Findings, images and signed consent'), I('admin', 'Exam and reassignment status', 'out'), I('vet', 'Assigned patient and exam status', 'out'), I('D2', 'Booking, queue and consent data'), I('D2', 'Exam record and recording staff', 'out')]),
        block('2.4', 'Record Clinic\nDiagnosis', 'diagnosis', [I('vet', 'Diagnosis and additional consent'), I('owner', 'Medical summary', 'out'), I('D2', 'Exam findings and patient history'), I('D2', 'Finalized diagnosis and consent', 'out'), I('process:3.0', 'Clinic prescription details', 'out')]),
        block('2.5', 'Conduct Online\nConsultation', 'online', [I('owner', 'Call join details'), I('vet', 'Call, diagnosis and medication details'), I('owner', 'Online consultation summary', 'out'), I('D2', 'Online appointment and call details'), I('D2', 'Online diagnosis and call status', 'out'), I('process:3.0', 'Online prescription details', 'out')]),
    ] },
    { id: '04-prescriptions-and-schedules', title: '3.0 — Prescriptions and Schedules', parent: '3.0', level: 'detail', blocks: [
        block('3.1', 'Synchronize Latest\nPet Prescription', 'prescriptions', [I('process:2.0', 'Clinic or online prescription'), I('D3', 'Existing pet prescription'), I('D3', 'New or replacement plan', 'out'), I('owner', 'New or updated prescription', 'out')]),
        block('3.2', 'Start Medication\nItems', 'prescriptions', [I('owner', 'Selected items and start dates'), I('owner', 'Activated medication items', 'out'), I('D3', 'Pending medication items'), I('D3', 'Per-item start dates and rules', 'out')]),
        block('3.3', 'Generate Dated\nOccurrences', 'prescriptions', [I('D3', 'Dates, frequency and duration'), I('D3', 'Dated medication occurrences', 'out'), I('owner', 'Calendar and todo checklist', 'out')]),
        block('3.4', 'Record Completion\nand Amend Plans', 'prescriptions', [I('owner', 'Done or skipped occurrences'), I('vet', 'Prescription amendments'), I('D3', 'Current plans and occurrences'), I('D3', 'Completion and replacement records', 'out'), I('owner', 'Updated checklist', 'out')]),
        block('3.5', 'Deliver Schedule\nNotifications', 'notifications', [I('D3', 'New plans, due items and preferences'), I('D3', 'Notification delivery status', 'out'), I('owner', 'Medication alerts and task links', 'out')]),
    ] },
    { id: '05-clinic-operations', title: '4.0 — Clinic Operations', parent: '4.0', level: 'detail', blocks: [
        block('4.1', 'Manage Grooming\nand Boarding', 'care', [I('admin', 'Care, room and stay entries'), I('admin', 'Care and room status', 'out'), I('D2', 'Grooming and boarding bookings'), I('D4', 'Room and care records'), I('D4', 'Stay, observation and grooming data', 'out')]),
        block('4.2', 'Manage Services\nand Inventory', 'inventory', [I('admin', 'Service and stock entries'), I('admin', 'Service and stock status', 'out'), I('D4', 'Service prices and inventory'), I('D4', 'Service and stock changes', 'out')]),
        block('4.3', 'Process Billing\nand Payments', 'billing', [I('admin', 'Charges and payment verification'), I('owner', 'Payment proof'), I('owner', 'Invoice and payment status', 'out'), I('D4', 'Charges and payment records'), I('D4', 'Invoice and verified payments', 'out')]),
        block('4.4', 'Process Refunds\nand Payment Settings', 'billing', [I('admin', 'Refund details'), I('super', 'Payment-method settings'), I('D4', 'Payment and refund eligibility'), I('D4', 'Refund and payment settings', 'out'), I('owner', 'Refund status', 'out')]),
    ] },
    { id: '06-reports-and-monitoring', title: '5.0 — Reports and Monitoring', parent: '5.0', level: 'detail', blocks: [
        block('5.1', 'Compile Dashboard\nStatistics', 'reports', [I('super', 'Date and clinic filters'), I('D1', 'Account and pet statistics'), I('D2', 'Booking and clinical statistics'), I('D4', 'Care, stock and billing statistics'), I('super', 'Separate charts and summaries', 'out')]),
        block('5.2', 'Generate Selected\nReports', 'reports', [I('super', 'Report type and filters'), I('D1', 'Account and pet data'), I('D2', 'Booking and clinical data'), I('D4', 'Care, inventory and billing data'), I('super', 'Generated report', 'out')]),
        block('5.3', 'Monitor Activity\nand Backups', 'backup', [I('super', 'Monitoring and backup requests'), I('D1', 'Personnel, pet and activity records'), I('D2', 'Booking and clinical backup data'), I('D3', 'Prescription and task backup data'), I('D4', 'Operations and backup records'), I('D4', 'Backup status and archive details', 'out'), I('super', 'Audit results and backup archive', 'out')]),
    ] },
];
export const primaryProcesses = Object.fromEntries(overview.blocks.map(item => [item.number, item.name]));
