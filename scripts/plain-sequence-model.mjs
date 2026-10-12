import * as base from './combined-sequence-model.mjs';

export const output = 'outputs/ipawcus-sequence-diagram-2026-10-08-plain';
export const title = base.title;
export const participants = base.participants;
export const imageAssets = [
    { id: 'ipawcus-logo', source: 'src/assets/circular_logo.png', filename: 'ipawcus-logo.png', participant: 'SYS', placement: 'above' },
    { id: 'mysql-logo', source: 'C:/Users/Admin/AppData/Local/Temp/pasted-image-6036.png', filename: 'mysql-logo.png', participant: 'DB', placement: 'above' },
];
export const references = {
    authentication: base.references.R1,
    integrations: base.references.R2,
    records: base.references.R3,
    operations: base.references.R4,
    care: base.references.R5,
};
const e = (file, needle) => ({ file, needle });
const m = (id, from, to, text, kind, evidence, explanation) => ({ type: 'message', id, from, to, text, kind, evidence, explanation });
const section = (id, title, items) => ({ type: 'group', id, operator: 'plain', branches: [{ guard: title, events: items }] });
const get = id => structuredClone(base.events.find(event => event.id === id));
const renameMessage = (items, id, label) => {
    for (const item of items) {
        if (item.id === id && item.type === 'message') item.text = label;
        for (const branch of item.branches || []) renameMessage(branch.events, id, label);
    }
};

const booking = get('booking');
booking.branches[0].events.splice(5, 0,
    m('booking-saved', 'SYS', 'PO', 'Pending booking / request number', 'reply', [e('src/services/bookingService.js', 'createBooking'), e('php/add_booking.php', 'booking_number')], 'The initial saved booking result is distinct from a later Admin confirmation or rejection. The owner can track the pending request.'));

const care = get('care');
care.branches[0].guard = 'Onsite visits: examination, consent and diagnosis';
const onsite = care.branches[0].events;
onsite.splice(onsite.findIndex(event => event.id === 'c7'), 0,
    m('patient-open', 'VT', 'SYS', 'Open patient / examination record', 'call', [e('src/components/VetrinarianComponents/VetDiagnosis.jsx', 'fetchQueues'), e('src/services/vetDiagnosisService.js', 'fetchVetDiagnoses')], 'The veterinarian opens the assigned patient context before recording the diagnosis. Queue/intake data and prior diagnosis history are obtained through existing service calls.'),
    m('patient-read', 'SYS', 'DB', 'Read exam / prior medical history', 'call', [e('php/get_queues.php', 'SELECT'), e('php/vet_diagnoses.php', 'SELECT')], 'Summarizes related authorized reads, not a fictitious single query or new endpoint.'),
    m('patient-return', 'SYS', 'VT', 'Patient history / findings / examiner', 'reply', [e('src/components/VetrinarianComponents/VetDiagnosis.jsx', 'applyClinicalIntake')], 'Returns the patient context, recorded examination and provenance. The veterinarian does not redo staff intake simply because a record is opened.'));
care.branches[1].guard = 'Online bookings instead: authorized video consultation';
care.branches[1].events = care.branches[1].events.map(event => event.type === 'ref'
    ? m('meeting-open', 'SYS', 'PO', 'Meeting access (Jitsi / JaaS)', 'reply', [e('src/services/onlineConsultationService.js', 'joinOnlineConsultation'), e('php/online_consultation_helpers.php', 'getJitsiBaseUrl')], 'After participant/booking checks, the owner receives authorized meeting access. The veterinarian obtains access through the start operation. The configured provider carries the video discussion; it is not another required clinic visit.')
    : event);
care.branches[2].guard = 'Grooming / boarding instead: care and room-stay updates';
care.branches[2].events = care.branches[2].events.map(event => event.type === 'ref'
    ? { type: 'note', id: 'care-checks', text: 'Vet review only when requested; pickup / discharge follows care and payment checks.', evidence: references.care.evidence }
    : event);
care.branches[2].events = care.branches[2].events.filter(event => event.type !== 'note');
renameMessage(care.branches[0].events, 'c1', 'Onsite: receive / assign; start exam');
renameMessage(care.branches[2].events, 'g1', 'Grooming / boarding: record care / room stay');

const authentication = section('authentication', 'Login: same validation for each role; owner exchange shown once', [
    m('login-submit', 'PO', 'SYS', 'Submit login details', 'call', references.authentication.evidence, 'This is a representative sign-in exchange. Staff sign in independently through the same authentication pattern; it is not a shared account or one batch login.'),
    m('login-check', 'SYS', 'DB', 'Check credentials / account / role', 'call', [e('php/login.php', 'access_token')], 'The backend validates the account and stored role. Invalid/inactive/unverified access follows its rejection/verification path instead of receiving a valid session.'),
    m('login-return', 'DB', 'SYS', 'Account / authorized role', 'reply', [e('php/login.php', 'access_token')], 'The database returns account data to the backend; it does not create the browser session itself.'),
    m('login-session', 'SYS', 'PO', 'Session / owner dashboard', 'reply', [e('src/services/userLogin.js', 'loginUser'), e('php/login.php', 'access_token')], 'The system returns the login context/token and opens the appropriate dashboard. The same result pattern opens the Super Admin, Admin or Veterinarian dashboard for that role.'),
]);

const records = section('medical-records', 'Pet medical records: owner requests history / email copy', [
    m('record-request', 'PO', 'SYS', 'View / email pet medical record', 'call', [e('src/services/petService.js', 'fetchPetMedicalRecords'), e('src/services/petService.js', 'emailPetMedicalRecords')], 'Accessible history and email copies are distinct from a paid, staff-reviewed record-correction request.'),
    m('record-read', 'SYS', 'DB', 'Check pet access / read records', 'call', [e('php/pet_medical_records.php', 'email_copy')], 'The backend checks access and reads the permitted medical data; an email request queues/sends the copy through configured delivery.'),
    m('record-result', 'SYS', 'PO', 'Medical history / email-copy status', 'reply', [e('php/pet_medical_records.php', 'email_copy')], 'The owner receives the readable record or email-copy request result. The diagram does not claim that mail delivery always succeeds instantly.'),
]);
const inventory = section('inventory', 'Independent staff request: inventory / service catalogue', [
    m('stock-request', 'AD', 'SYS', 'Update items / stock / service materials', 'call', [e('php/inventory.php', 'stock'), e('php/service_catalog.php', 'service_catalog')], 'Admin submits an authorized catalogue or stock operation. Sales/material usage and manual stock entries remain auditable.'),
    m('stock-save', 'SYS', 'DB', 'Validate / save inventory changes', 'call', [e('php/inventory.php', 'stock')], 'Applicable item/stock checks precede persistence; an invalid movement is not saved as valid stock.'),
    m('stock-result', 'SYS', 'AD', 'Updated stock / operation result', 'reply', [e('php/inventory.php', 'json_encode')], 'The result returns to the staff member who submitted the operation, not to an unrelated pet owner.'),
]);
const backups = section('backup', 'Independent Super Admin request: system backup', [
    m('backup-request', 'SA', 'SYS', 'Request backup / download', 'call', [e('php/system_backups.php', 'Only the Super Admin')], 'An active authorized Super Admin requests creation/download. This is independent of an appointment or report request.'),
    m('backup-record', 'SYS', 'DB', 'Read backup / system metadata', 'call', [e('php/system_backups.php', 'ipawcus_backup_archive_for_download')], 'The backend checks backup metadata and prepares or retrieves the archive with the existing backup helpers. The diagram does not pretend that uploaded files reside in MariaDB or that this is only a SQL dump.'),
    m('backup-result', 'SYS', 'SA', 'Backup archive / download status', 'reply', [e('php/system_backups.php', 'ipawcus_system_backups_stream_local_export')], 'The existing backend streams the authorized archive to Super Admin; other roles do not gain backup-download access.'),
]);

export const events = [
    authentication,
    get('setup'),
    get('pets'),
    booking,
    care,
    get('prescription'),
    get('print'),
    get('prescription-start'),
    get('billing'),
    get('doses'),
    records,
    inventory,
    get('report'),
    backups,
];
renameMessage(events, 'r1', 'If Rx changes: sync pet plan / items');
renameMessage(events, 'r2', 'New / changed Rx: notify owner');
renameMessage(events, 'r3', 'With onsite medicines: print Rx');
renameMessage(events, 'd1', 'When due: mark dose done / skipped');
export const modelingNotes = [
    'This is one general sequence overview with all four roles shown once, plus System and Database. It keeps lifelines, activation bars, directional requests and returned results.',
    'There are no reference-number labels, control keywords, general section headings, activity nodes or decision diamonds. Only online consultation for online bookings keeps a descriptive rectangular box.',
    'Login is drawn once using the owner as an example; each staff member signs in separately using the same validation pattern before their actions. No shared session or batch authentication is invented.',
    'Read messages downward within the applicable interaction. Onsite and grooming/boarding conditions are stated in the first relevant message; online consultation is boxed separately. These are different service paths, not three mandatory stages for every pet.',
    'Super Admin setup, inventory, reports, records and backups are independently requested operations. Placement on the sheet does not make them compulsory steps of a visit.',
    'The figure retains meaningful validation, database saves, pending-versus-confirmed booking results, examination provenance, medication start dates and return messages. Routine low-level PHP forwarding and some database acknowledgements remain omitted.',
    'Medicine conditions stay in the arrow labels: changed prescriptions notify the owner; only printable onsite medicines trigger printing; available medicines can start separately; due doses are completed per item/date.',
    'The interface and PHP API are one conceptual System lifeline. Browser location lookup, Jitsi/JaaS, delivery and document helpers remain real supporting mechanisms, not a fictional universal external server.',
    'The existing iPawcus logo is above the System header. The supplied MySQL logo is above the Database header. Both are embedded without changing their pixels or aspect ratios; the rest of the diagram stays monochrome.',
    'Nothing in the application, database schema, dashboard debug bypass, uploaded references or previous diagram versions is modified.',
];
