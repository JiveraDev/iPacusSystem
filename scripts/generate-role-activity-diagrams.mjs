import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '..');
const outputPath = path.join(repositoryRoot, 'docs', 'IPAWCUS-Role-Activity-Diagrams.drawio');

const lane = (id, title, x, width) => ({ id, title, x, width });
const activity = (id, label, laneId, y, type = 'action', options = {}) => ({
    id,
    label,
    laneId,
    y,
    type,
    ...options,
});
const flows = (...definitions) => definitions.map((definition, index) => ({
    id: `flow-${String(index + 1).padStart(2, '0')}`,
    source: definition[0],
    target: definition[1],
    label: definition[2] || '',
}));

const overviewLanes = [
    lane('owner', 'Pet Owner', 30, 350),
    lane('system', 'System / API', 390, 350),
    lane('admin', 'Admin', 750, 350),
    lane('vet', 'Veterinarian', 1110, 350),
    lane('super', 'Super Admin', 1470, 350),
];

const detailedLanes = (roleTitle, collaboratorTitle) => [
    lane('role', roleTitle, 30, 570),
    lane('system', 'System / API', 610, 570),
    lane('collab', collaboratorTitle, 1190, 570),
];

const pages = [
    {
        id: 'role-overview',
        name: '01 - Cross-Role Overview',
        title: 'IPAWCUS Activity Diagram - Cross-Role Service Workflow',
        subtitle: 'End-to-end handoff from pet-owner request through administration, veterinary care, billing, notification, and oversight',
        width: 1850,
        height: 3500,
        lanes: overviewLanes,
        nodes: [
            activity('start', '', 'owner', 115, 'start'),
            activity('login', 'Sign in to IPAWCUS', 'owner', 170),
            activity('validateAuth', 'Validate credentials, verification,\nand account status', 'system', 285),
            activity('accessAllowed', 'Access allowed?', 'system', 410, 'decision'),
            activity('loginError', 'Show access error\nand retry login', 'owner', 535),
            activity('routeDashboard', 'Load role permissions\nand dashboard', 'system', 535),
            activity('managePet', 'Register or link pet\nand confirm ownership', 'owner', 665),
            activity('chooseService', 'Choose service, branch,\npet, date, and time', 'owner', 790),
            activity('checkAvailability', 'Check branch hours, veterinarian,\nroom, and slot availability', 'system', 915),
            activity('slotAvailable', 'Selected slot available?', 'system', 1040, 'decision'),
            activity('retrySlot', 'Choose another schedule', 'owner', 1165),
            activity('submitBooking', 'Submit booking, consent,\nand required details', 'owner', 1285),
            activity('storeBooking', 'Validate and store pending booking', 'system', 1405),
            activity('reviewBooking', 'Review booking and\npayment evidence', 'admin', 1525),
            activity('bookingApproved', 'Booking approved?', 'admin', 1650, 'decision'),
            activity('correctSubmission', 'Correct details or\nresubmit payment', 'owner', 1775),
            activity('confirmBooking', 'Confirm schedule and\nnotify pet owner', 'system', 1775),
            activity('checkIn', 'Receive booking or approve\nwalk-in queue entry', 'admin', 1900),
            activity('generateQueue', 'Generate branch queue number\nand priority', 'system', 2020),
            activity('assignVet', 'Assign available veterinarian', 'admin', 2140),
            activity('receiveCase', 'Receive case into My List', 'vet', 2260),
            activity('examinePet', 'Review history and\nexamine the pet', 'vet', 2380),
            activity('recordDiagnosis', 'Record findings, diagnosis,\ntreatment, and prescriptions', 'vet', 2500),
            activity('updateClinical', 'Finalize diagnosis, visit,\nand medical record', 'system', 2620),
            activity('billVisit', 'Add charges and\ncollect payment', 'admin', 2740),
            activity('paymentComplete', 'Payment complete?', 'admin', 2860, 'decision'),
            activity('settlePayment', 'Submit or correct payment', 'owner', 2980),
            activity('closeVisit', 'Update billing status and\nclose visit', 'system', 2980),
            activity('completionFork', '', 'system', 3100, 'fork'),
            activity('viewOutcome', 'View status, diagnosis,\nand medical record', 'owner', 3170),
            activity('reviewReports', 'Review operational and\nfinancial reports', 'super', 3170),
            activity('completionJoin', '', 'system', 3290, 'join'),
            activity('end', '', 'system', 3380, 'end'),
        ],
        edges: flows(
            ['start', 'login'],
            ['login', 'validateAuth'],
            ['validateAuth', 'accessAllowed'],
            ['accessAllowed', 'loginError', 'No'],
            ['loginError', 'login'],
            ['accessAllowed', 'routeDashboard', 'Yes'],
            ['routeDashboard', 'managePet'],
            ['managePet', 'chooseService'],
            ['chooseService', 'checkAvailability'],
            ['checkAvailability', 'slotAvailable'],
            ['slotAvailable', 'retrySlot', 'No'],
            ['retrySlot', 'checkAvailability'],
            ['slotAvailable', 'submitBooking', 'Yes'],
            ['submitBooking', 'storeBooking'],
            ['storeBooking', 'reviewBooking'],
            ['reviewBooking', 'bookingApproved'],
            ['bookingApproved', 'correctSubmission', 'No'],
            ['correctSubmission', 'reviewBooking'],
            ['bookingApproved', 'confirmBooking', 'Yes'],
            ['confirmBooking', 'checkIn'],
            ['checkIn', 'generateQueue'],
            ['generateQueue', 'assignVet'],
            ['assignVet', 'receiveCase'],
            ['receiveCase', 'examinePet'],
            ['examinePet', 'recordDiagnosis'],
            ['recordDiagnosis', 'updateClinical'],
            ['updateClinical', 'billVisit'],
            ['billVisit', 'paymentComplete'],
            ['paymentComplete', 'settlePayment', 'No'],
            ['settlePayment', 'billVisit'],
            ['paymentComplete', 'closeVisit', 'Yes'],
            ['closeVisit', 'completionFork'],
            ['completionFork', 'viewOutcome'],
            ['completionFork', 'reviewReports'],
            ['viewOutcome', 'completionJoin'],
            ['reviewReports', 'completionJoin'],
            ['completionJoin', 'end'],
        ),
    },
    {
        id: 'pet-owner',
        name: '02 - Pet Owner',
        title: 'IPAWCUS Activity Diagram - Pet Owner',
        subtitle: 'Pet management, service booking, payment, queue tracking, consultation, medical records, update requests, and account tools',
        width: 1790,
        height: 4660,
        lanes: detailedLanes('Pet Owner', 'Admin / Veterinarian / Co-owner'),
        nodes: [
            activity('start', '', 'role', 115, 'start'),
            activity('login', 'Register or sign in', 'role', 170),
            activity('authenticate', 'Verify email, credentials, token,\nand account status', 'system', 285),
            activity('authenticated', 'Authenticated?', 'system', 410, 'decision'),
            activity('retryLogin', 'Correct account details\nand try again', 'role', 535, 'action', { width: 240, xOffset: -130 }),
            activity('dashboard', 'Open Pet Owner dashboard', 'role', 535, 'action', { width: 240, xOffset: 130 }),
            activity('chooseActivity', 'Choose activity', 'role', 660, 'decision'),

            activity('managePet', 'Add a pet or enter\na sharable pet ID', 'role', 805),
            activity('validatePet', 'Validate pet data, duplicate records,\nand ownership rules', 'system', 925),
            activity('petValid', 'Pet or ownership link valid?', 'system', 1050, 'decision'),
            activity('correctPet', 'Correct pet details\nor sharable ID', 'role', 1175),
            activity('coownerDecision', 'Primary owner accepts or rejects\nco-parent request when required', 'collab', 1175),
            activity('savePet', 'Save pet or ownership link\nand refresh My Pets', 'system', 1300),

            activity('browseServices', 'Browse services and choose\nbranch, pet, and schedule', 'role', 1470),
            activity('loadAvailability', 'Load service rules, branch hours,\nvet schedule, rooms, and slots', 'system', 1590),
            activity('slotAvailable', 'Slot available?', 'system', 1715, 'decision'),
            activity('changeSchedule', 'Select another schedule', 'role', 1840),
            activity('submitBooking', 'Submit details, concern,\nconsent, and signature', 'role', 1960),
            activity('storePending', 'Create pending booking and\npayment instructions', 'system', 2080),
            activity('submitPayment', 'Submit payment method,\nreference, and proof', 'role', 2200),
            activity('adminReview', 'Review booking and payment proof', 'collab', 2320),
            activity('bookingApproved', 'Approved?', 'collab', 2445, 'decision'),
            activity('fixPayment', 'Correct details or\nresubmit payment proof', 'role', 2570),
            activity('bookingConfirmed', 'Confirm booking and send notification', 'system', 2570),
            activity('queueCheckIn', 'Receive booking and create\nor approve queue entry', 'collab', 2690),
            activity('trackQueue', 'Track queue status and number', 'role', 2810),
            activity('consultation', 'Attend clinic or online consultation', 'collab', 2930),
            activity('publishRecord', 'Publish diagnosis, visit status,\nand medical record', 'system', 3050),

            activity('viewRecords', 'View or email pet\nmedical records', 'role', 3220),
            activity('needsCorrection', 'Request a record correction?', 'role', 3345, 'decision'),
            activity('createRequest', 'Describe requested changes\nand submit payment proof', 'role', 3470),
            activity('verifyRequest', 'Verify payment, approve request,\nand assign veterinarian', 'collab', 3590),
            activity('updateRecord', 'Review and update medical record', 'collab', 3710),
            activity('notifyCompletion', 'Mark request complete\nand notify owner', 'system', 3830),

            activity('manageAccount', 'Manage profile, password,\nnotifications, and TODOs', 'role', 3970),
            activity('saveAccount', 'Validate and save account settings', 'system', 4090),

            activity('branchJoin', '', 'system', 4210, 'join'),
            activity('anotherActivity', 'Perform another activity?', 'role', 4300, 'decision'),
            activity('logout', 'Log out', 'role', 4425),
            activity('end', '', 'system', 4540, 'end'),
        ],
        edges: flows(
            ['start', 'login'], ['login', 'authenticate'], ['authenticate', 'authenticated'],
            ['authenticated', 'retryLogin', 'No'], ['retryLogin', 'login'], ['authenticated', 'dashboard', 'Yes'],
            ['dashboard', 'chooseActivity'],
            ['chooseActivity', 'managePet', 'Pet'], ['managePet', 'validatePet'], ['validatePet', 'petValid'],
            ['petValid', 'correctPet', 'No'], ['correctPet', 'managePet'], ['petValid', 'coownerDecision', 'Yes / if linked'],
            ['coownerDecision', 'savePet'], ['savePet', 'branchJoin'],
            ['chooseActivity', 'browseServices', 'Book'], ['browseServices', 'loadAvailability'], ['loadAvailability', 'slotAvailable'],
            ['slotAvailable', 'changeSchedule', 'No'], ['changeSchedule', 'loadAvailability'], ['slotAvailable', 'submitBooking', 'Yes'],
            ['submitBooking', 'storePending'], ['storePending', 'submitPayment'], ['submitPayment', 'adminReview'],
            ['adminReview', 'bookingApproved'], ['bookingApproved', 'fixPayment', 'No'], ['fixPayment', 'submitPayment'],
            ['bookingApproved', 'bookingConfirmed', 'Yes'], ['bookingConfirmed', 'queueCheckIn'], ['queueCheckIn', 'trackQueue'],
            ['trackQueue', 'consultation'], ['consultation', 'publishRecord'], ['publishRecord', 'branchJoin'],
            ['chooseActivity', 'viewRecords', 'Records'], ['viewRecords', 'needsCorrection'],
            ['needsCorrection', 'branchJoin', 'No'], ['needsCorrection', 'createRequest', 'Yes'],
            ['createRequest', 'verifyRequest'], ['verifyRequest', 'updateRecord'], ['updateRecord', 'notifyCompletion'],
            ['notifyCompletion', 'branchJoin'],
            ['chooseActivity', 'manageAccount', 'Account'], ['manageAccount', 'saveAccount'], ['saveAccount', 'branchJoin'],
            ['branchJoin', 'anotherActivity'], ['anotherActivity', 'chooseActivity', 'Yes'],
            ['anotherActivity', 'logout', 'No'], ['logout', 'end'],
        ),
    },
    {
        id: 'admin',
        name: '03 - Admin',
        title: 'IPAWCUS Activity Diagram - Admin',
        subtitle: 'Branch operations covering booking review, queue assignment, billing, boarding, inventory, catalog, consent, pets, and record requests',
        width: 1790,
        height: 4860,
        lanes: detailedLanes('Admin', 'Pet Owner / Veterinarian'),
        nodes: [
            activity('start', '', 'role', 115, 'start'),
            activity('login', 'Sign in as Admin', 'role', 170),
            activity('authenticate', 'Validate Admin role, account status,\nand assigned branch', 'system', 285),
            activity('authorized', 'Authorized?', 'system', 410, 'decision'),
            activity('accessError', 'Show access error\nand retry', 'role', 535, 'action', { width: 240, xOffset: -130 }),
            activity('selectBranch', 'Load assigned branch context', 'role', 535, 'action', { width: 240, xOffset: 130 }),
            activity('chooseActivity', 'Choose operational area', 'role', 660, 'decision'),

            activity('loadBookings', 'Load branch bookings and\npayment submissions', 'system', 805),
            activity('reviewBooking', 'Review schedule, consent, concern,\nand payment proof', 'role', 925),
            activity('paymentValid', 'Booking and payment valid?', 'role', 1050, 'decision'),
            activity('ownerResubmits', 'Correct booking or\nresubmit payment', 'collab', 1175),
            activity('confirmBooking', 'Confirm, reschedule, relocate,\nreject, or refund booking', 'role', 1175),
            activity('updateBooking', 'Persist status and notify owner', 'system', 1300),
            activity('receiveBooking', 'Receive arrival and create queue entry', 'role', 1420),
            activity('prioritizeQueue', 'Generate queue number, source,\nand priority', 'system', 1540),
            activity('assignVet', 'Assign or reassign veterinarian', 'role', 1660),
            activity('vetReceives', 'Receive assigned case', 'collab', 1780),

            activity('loadVisit', 'Load visit, diagnosis, services,\nand billable materials', 'system', 1960),
            activity('addCharges', 'Add service, medicine, product,\nand boarding charges', 'role', 2080),
            activity('calculateTotal', 'Calculate totals and balance', 'system', 2200),
            activity('collectPayment', 'Record and verify payment', 'role', 2320),
            activity('refundNeeded', 'Refund required?', 'role', 2445, 'decision'),
            activity('processRefund', 'Record booking or visit refund', 'role', 2570),
            activity('updateBilling', 'Update billing status, references,\nand stock movement', 'system', 2690),

            activity('checkRooms', 'Check boarding room availability', 'role', 2870),
            activity('loadRooms', 'Load branch rooms and reservations', 'system', 2990),
            activity('roomAvailable', 'Room available?', 'system', 3115, 'decision'),
            activity('changeStay', 'Choose another room or dates', 'role', 3240),
            activity('checkInBoarding', 'Assign room and check in pet', 'role', 3360),
            activity('monitorBoarding', 'Record observations, care tasks,\ndocuments, and materials', 'role', 3480),
            activity('postMaterials', 'Deduct materials and create charges', 'system', 3600),
            activity('checkOutBoarding', 'Complete tasks, settle bill,\nand check out pet', 'role', 3720),

            activity('manageOperations', 'Manage pets, record requests, consent,\ninventory, and service catalog', 'role', 3900),
            activity('validateOperation', 'Validate branch scope, stock,\nrequired fields, and permissions', 'system', 4020),
            activity('resolveException', 'Resolve low stock, near expiry,\ndisposal, or request issue', 'role', 4140),
            activity('saveOperation', 'Save changes, audit movement,\nand notify affected users', 'system', 4260),

            activity('branchJoin', '', 'system', 4380, 'join'),
            activity('anotherActivity', 'Perform another activity?', 'role', 4470, 'decision'),
            activity('logout', 'Log out', 'role', 4595),
            activity('end', '', 'system', 4710, 'end'),
        ],
        edges: flows(
            ['start', 'login'], ['login', 'authenticate'], ['authenticate', 'authorized'],
            ['authorized', 'accessError', 'No'], ['accessError', 'login'], ['authorized', 'selectBranch', 'Yes'],
            ['selectBranch', 'chooseActivity'],
            ['chooseActivity', 'loadBookings', 'Bookings / Queue'], ['loadBookings', 'reviewBooking'], ['reviewBooking', 'paymentValid'],
            ['paymentValid', 'ownerResubmits', 'No'], ['ownerResubmits', 'reviewBooking'], ['paymentValid', 'confirmBooking', 'Yes'],
            ['confirmBooking', 'updateBooking'], ['updateBooking', 'receiveBooking'], ['receiveBooking', 'prioritizeQueue'],
            ['prioritizeQueue', 'assignVet'], ['assignVet', 'vetReceives'], ['vetReceives', 'branchJoin'],
            ['chooseActivity', 'loadVisit', 'POS / Billing'], ['loadVisit', 'addCharges'], ['addCharges', 'calculateTotal'],
            ['calculateTotal', 'collectPayment'], ['collectPayment', 'refundNeeded'], ['refundNeeded', 'processRefund', 'Yes'],
            ['processRefund', 'updateBilling'], ['refundNeeded', 'updateBilling', 'No'], ['updateBilling', 'branchJoin'],
            ['chooseActivity', 'checkRooms', 'Boarding'], ['checkRooms', 'loadRooms'], ['loadRooms', 'roomAvailable'],
            ['roomAvailable', 'changeStay', 'No'], ['changeStay', 'checkRooms'], ['roomAvailable', 'checkInBoarding', 'Yes'],
            ['checkInBoarding', 'monitorBoarding'], ['monitorBoarding', 'postMaterials'], ['postMaterials', 'checkOutBoarding'],
            ['checkOutBoarding', 'branchJoin'],
            ['chooseActivity', 'manageOperations', 'Records / Stock'], ['manageOperations', 'validateOperation'],
            ['validateOperation', 'resolveException'], ['resolveException', 'saveOperation'], ['saveOperation', 'branchJoin'],
            ['branchJoin', 'anotherActivity'], ['anotherActivity', 'chooseActivity', 'Yes'],
            ['anotherActivity', 'logout', 'No'], ['logout', 'end'],
        ),
    },
    {
        id: 'veterinarian',
        name: '04 - Veterinarian',
        title: 'IPAWCUS Activity Diagram - Veterinarian',
        subtitle: 'Assigned queue care, diagnosis, online consultation, medical-record updates, schedules, TODOs, histories, and media monitoring',
        width: 1790,
        height: 4500,
        lanes: detailedLanes('Veterinarian', 'Admin / Pet Owner'),
        nodes: [
            activity('start', '', 'role', 115, 'start'),
            activity('login', 'Sign in as Veterinarian', 'role', 170),
            activity('authenticate', 'Validate role, account status,\nvet profile, and branch access', 'system', 285),
            activity('authorized', 'Authorized and active?', 'system', 410, 'decision'),
            activity('accessError', 'Show access error\nand contact Super Admin', 'role', 535, 'action', { width: 240, xOffset: -130 }),
            activity('dashboard', 'Load assigned branches, schedule,\nand veterinarian dashboard', 'role', 535, 'action', { width: 240, height: 78, xOffset: 130 }),
            activity('chooseActivity', 'Choose clinical activity', 'role', 660, 'decision'),

            activity('loadApproved', 'Load approved queues and bookings\nfor branch and date', 'system', 805),
            activity('receiveCase', 'Receive case into My List', 'role', 925),
            activity('moveToList', 'Create active veterinarian assignment', 'system', 1045),
            activity('examine', 'Review medical history, complaint,\nvitals, and physical examination', 'role', 1165),
            activity('enoughInfo', 'Enough clinical information?', 'role', 1290, 'decision'),
            activity('requestTests', 'Request tests or return case\nwith reason', 'collab', 1415),
            activity('requeue', 'Update queue and make case\navailable again', 'system', 1535),
            activity('diagnose', 'Record diagnosis, treatment,\nprescriptions, files, and follow-up', 'role', 1535),
            activity('finalizeDiagnosis', 'Finalize diagnosis and update\nvisit / medical record', 'system', 1655),
            activity('completeCase', 'Mark assignment and queue complete', 'role', 1775),
            activity('notifyOwnerAdmin', 'Notify owner and Admin', 'collab', 1895),

            activity('loadOnline', 'Load scheduled online consultations', 'system', 2070),
            activity('startOnline', 'Start consultation room', 'role', 2190),
            activity('ownerReady', 'Track veterinarian and owner readiness', 'system', 2310),
            activity('ownerJoined', 'Owner joined?', 'system', 2435, 'decision'),
            activity('rescheduleOnline', 'Reschedule or mark no-show', 'collab', 2560),
            activity('conductOnline', 'Conduct video consultation', 'role', 2560),
            activity('onlineDiagnosis', 'Submit online diagnosis\nand recommendations', 'role', 2680),
            activity('closeOnline', 'End meeting and mark completed', 'system', 2800),

            activity('loadRequests', 'Load approved or assigned\nrecord-update requests', 'system', 2980),
            activity('selfAssign', 'Assign request to self', 'role', 3100),
            activity('openRecords', 'Load pet history and record groups', 'system', 3220),
            activity('editRecords', 'Add, edit, reorder, or remove\nmedical-record items', 'role', 3340),
            activity('completeRequest', 'Add veterinarian notes\nand complete request', 'role', 3460),
            activity('notifyRequest', 'Save audit event and notify owner', 'system', 3580),

            activity('manageSchedule', 'Update branch schedule, TODOs,\nhistories, or pet media review', 'role', 3760),
            activity('saveSchedule', 'Validate and save changes', 'system', 3880),

            activity('branchJoin', '', 'system', 4000, 'join'),
            activity('anotherActivity', 'Perform another activity?', 'role', 4090, 'decision'),
            activity('logout', 'Log out', 'role', 4215),
            activity('end', '', 'system', 4330, 'end'),
        ],
        edges: flows(
            ['start', 'login'], ['login', 'authenticate'], ['authenticate', 'authorized'],
            ['authorized', 'accessError', 'No'], ['accessError', 'login'], ['authorized', 'dashboard', 'Yes'],
            ['dashboard', 'chooseActivity'],
            ['chooseActivity', 'loadApproved', 'Queue'], ['loadApproved', 'receiveCase'], ['receiveCase', 'moveToList'],
            ['moveToList', 'examine'], ['examine', 'enoughInfo'], ['enoughInfo', 'requestTests', 'No'],
            ['requestTests', 'requeue'], ['requeue', 'loadApproved'], ['enoughInfo', 'diagnose', 'Yes'],
            ['diagnose', 'finalizeDiagnosis'], ['finalizeDiagnosis', 'completeCase'], ['completeCase', 'notifyOwnerAdmin'],
            ['notifyOwnerAdmin', 'branchJoin'],
            ['chooseActivity', 'loadOnline', 'Online'], ['loadOnline', 'startOnline'], ['startOnline', 'ownerReady'],
            ['ownerReady', 'ownerJoined'], ['ownerJoined', 'rescheduleOnline', 'No'], ['rescheduleOnline', 'branchJoin'],
            ['ownerJoined', 'conductOnline', 'Yes'], ['conductOnline', 'onlineDiagnosis'], ['onlineDiagnosis', 'closeOnline'],
            ['closeOnline', 'branchJoin'],
            ['chooseActivity', 'loadRequests', 'Records'], ['loadRequests', 'selfAssign'], ['selfAssign', 'openRecords'],
            ['openRecords', 'editRecords'], ['editRecords', 'completeRequest'], ['completeRequest', 'notifyRequest'],
            ['notifyRequest', 'branchJoin'],
            ['chooseActivity', 'manageSchedule', 'Schedule / Media'], ['manageSchedule', 'saveSchedule'],
            ['saveSchedule', 'branchJoin'], ['branchJoin', 'anotherActivity'],
            ['anotherActivity', 'chooseActivity', 'Yes'], ['anotherActivity', 'logout', 'No'], ['logout', 'end'],
        ),
    },
    {
        id: 'super-admin',
        name: '05 - Super Admin',
        title: 'IPAWCUS Activity Diagram - Super Admin',
        subtitle: 'Personnel and owner accounts, branch assignment, reports and exports, payment-method security, recovery checks, and global oversight',
        width: 1790,
        height: 4460,
        lanes: detailedLanes('Super Admin', 'Managed Users / Clinic Operations'),
        nodes: [
            activity('start', '', 'role', 115, 'start'),
            activity('login', 'Sign in as Super Admin', 'role', 170),
            activity('authenticate', 'Validate Super Admin role, token,\nand account status', 'system', 285),
            activity('authorized', 'Authorized?', 'system', 410, 'decision'),
            activity('accessError', 'Show access error\nand retry', 'role', 535, 'action', { width: 240, xOffset: -130 }),
            activity('dashboard', 'Open Reports Dashboard\nand global navigation', 'role', 535, 'action', { width: 240, xOffset: 130 }),
            activity('chooseActivity', 'Choose administrative activity', 'role', 660, 'decision'),

            activity('loadAccounts', 'Load Admin and veterinarian accounts', 'system', 805),
            activity('manageAccount', 'Create, edit, activate, archive,\nor remove personnel account', 'role', 925),
            activity('enterRoleDetails', 'Enter role-specific profile, license,\nand branch assignments', 'role', 1045),
            activity('validateAccount', 'Validate email, role, branch,\nand required profile fields', 'system', 1165),
            activity('accountValid', 'Account data valid?', 'system', 1290, 'decision'),
            activity('correctAccount', 'Correct personnel details', 'role', 1415),
            activity('saveAccount', 'Save account and audit status change', 'system', 1415),
            activity('notifyPersonnel', 'Notify affected personnel', 'collab', 1535),

            activity('searchOwners', 'Load and search pet-owner accounts', 'system', 1710),
            activity('manageOwner', 'Activate/archive owner or\nremove a pet ownership link', 'role', 1830),
            activity('confirmOwnerAction', 'Confirm sensitive account action?', 'role', 1955, 'decision'),
            activity('updateOwner', 'Persist status or ownership change', 'system', 2080),

            activity('selectReport', 'Choose report type, branch,\nand date range', 'role', 2260),
            activity('aggregateReport', 'Aggregate operational, clinical,\ninventory, and financial data', 'system', 2380),
            activity('reportData', 'Matching data available?', 'system', 2505, 'decision'),
            activity('adjustFilters', 'Adjust report filters', 'role', 2630),
            activity('previewReport', 'Build report preview and totals', 'system', 2630),
            activity('exportReport', 'Generate or export report', 'role', 2750),

            activity('loadPayments', 'Load configured payment methods', 'system', 2930),
            activity('requestOtp', 'Request security OTP', 'role', 3050),
            activity('verifyOtp', 'Verify OTP and expiration', 'system', 3170),
            activity('otpValid', 'OTP valid?', 'system', 3295, 'decision'),
            activity('retryOtp', 'Request or enter another OTP', 'role', 3420),
            activity('editPayments', 'Enable, disable, or update\npayment method details', 'role', 3540),
            activity('savePayments', 'Encrypt / validate settings\nand save configuration', 'system', 3660),

            activity('reviewOversight', 'Review media monitoring, recovery,\nand role-specific operational screens', 'role', 2930),
            activity('auditOversight', 'Load protected data and\nrecord administrative audit trail', 'system', 3050),

            activity('branchJoin', '', 'system', 3840, 'join'),
            activity('anotherActivity', 'Perform another activity?', 'role', 3930, 'decision'),
            activity('logout', 'Log out', 'role', 4055),
            activity('end', '', 'system', 4170, 'end'),
        ],
        edges: flows(
            ['start', 'login'], ['login', 'authenticate'], ['authenticate', 'authorized'],
            ['authorized', 'accessError', 'No'], ['accessError', 'login'], ['authorized', 'dashboard', 'Yes'],
            ['dashboard', 'chooseActivity'],
            ['chooseActivity', 'loadAccounts', 'Personnel'], ['loadAccounts', 'manageAccount'],
            ['manageAccount', 'enterRoleDetails'], ['enterRoleDetails', 'validateAccount'], ['validateAccount', 'accountValid'],
            ['accountValid', 'correctAccount', 'No'], ['correctAccount', 'enterRoleDetails'],
            ['accountValid', 'saveAccount', 'Yes'], ['saveAccount', 'notifyPersonnel'], ['notifyPersonnel', 'branchJoin'],
            ['chooseActivity', 'searchOwners', 'Pet Owners'], ['searchOwners', 'manageOwner'],
            ['manageOwner', 'confirmOwnerAction'], ['confirmOwnerAction', 'manageOwner', 'No'],
            ['confirmOwnerAction', 'updateOwner', 'Yes'], ['updateOwner', 'branchJoin'],
            ['chooseActivity', 'selectReport', 'Reports'], ['selectReport', 'aggregateReport'],
            ['aggregateReport', 'reportData'], ['reportData', 'adjustFilters', 'No'], ['adjustFilters', 'selectReport'],
            ['reportData', 'previewReport', 'Yes'], ['previewReport', 'exportReport'], ['exportReport', 'branchJoin'],
            ['chooseActivity', 'loadPayments', 'Payments'], ['loadPayments', 'requestOtp'],
            ['requestOtp', 'verifyOtp'], ['verifyOtp', 'otpValid'], ['otpValid', 'retryOtp', 'No'],
            ['retryOtp', 'requestOtp'], ['otpValid', 'editPayments', 'Yes'], ['editPayments', 'savePayments'],
            ['savePayments', 'branchJoin'],
            ['chooseActivity', 'reviewOversight', 'Oversight'], ['reviewOversight', 'auditOversight'],
            ['auditOversight', 'branchJoin'], ['branchJoin', 'anotherActivity'],
            ['anotherActivity', 'chooseActivity', 'Yes'], ['anotherActivity', 'logout', 'No'], ['logout', 'end'],
        ),
    },
];

const escapeXml = (value) => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');

const grid = 10;
const clearance = 16;

function visibleLineCount(label, charactersPerLine = 34) {
    return String(label || '').split('\n').reduce(
        (total, line) => total + Math.max(1, Math.ceil(line.length / charactersPerLine)),
        0,
    );
}

function nodeDimensions(node) {
    if (node.type === 'start' || node.type === 'end') {
        return { width: 30, height: 30 };
    }
    if (node.type === 'fork' || node.type === 'join') {
        return { width: 190, height: 12 };
    }
    if (node.type === 'decision') {
        return { width: 250, height: Math.max(100, visibleLineCount(node.label, 24) * 18 + 42) };
    }
    return { width: node.width || 300, height: node.height || Math.max(66, visibleLineCount(node.label) * 18 + 28) };
}

function positionNodes(page) {
    const lanesById = new Map(page.lanes.map((entry) => [entry.id, entry]));
    for (const node of page.nodes) {
        const parentLane = lanesById.get(node.laneId);
        if (!parentLane) {
            throw new Error(`Unknown lane ${node.laneId} for node ${node.id}`);
        }
        const dimensions = nodeDimensions(node);
        node.width = dimensions.width;
        node.height = dimensions.height;
        node.x = parentLane.x + (parentLane.width - node.width) / 2 + (node.xOffset || 0);
    }
}

for (const page of pages) {
    positionNodes(page);
}

class MinHeap {
    constructor() {
        this.items = [];
    }

    push(item) {
        this.items.push(item);
        let index = this.items.length - 1;
        while (index > 0) {
            const parent = Math.floor((index - 1) / 2);
            if (this.items[parent].priority <= item.priority) break;
            this.items[index] = this.items[parent];
            index = parent;
        }
        this.items[index] = item;
    }

    pop() {
        if (this.items.length === 0) return null;
        const root = this.items[0];
        const tail = this.items.pop();
        if (this.items.length === 0) return root;
        let index = 0;
        while (true) {
            const left = index * 2 + 1;
            const right = left + 1;
            if (left >= this.items.length) break;
            const next = right < this.items.length && this.items[right].priority < this.items[left].priority ? right : left;
            if (this.items[next].priority >= tail.priority) break;
            this.items[index] = this.items[next];
            index = next;
        }
        this.items[index] = tail;
        return root;
    }

    get size() {
        return this.items.length;
    }
}

const directions = [
    { name: 'right', dx: grid, dy: 0 },
    { name: 'down', dx: 0, dy: grid },
    { name: 'left', dx: -grid, dy: 0 },
    { name: 'up', dx: 0, dy: -grid },
];
const snap = (value) => Math.round(value / grid) * grid;
const pointKey = (point) => `${point.x},${point.y}`;
const stateKey = (point, direction) => `${point.x},${point.y},${direction}`;
const segmentKey = (a, b) => [pointKey(a), pointKey(b)].sort().join('|');

function rectangle(node, padding = 0) {
    return {
        x: node.x - padding,
        y: node.y - padding,
        width: node.width + padding * 2,
        height: node.height + padding * 2,
    };
}

function containsPoint(rect, point) {
    return point.x >= rect.x && point.x <= rect.x + rect.width
        && point.y >= rect.y && point.y <= rect.y + rect.height;
}

function chooseSides(source, target) {
    const sourceCenterX = source.x + source.width / 2;
    const targetCenterX = target.x + target.width / 2;
    const sourceCenterY = source.y + source.height / 2;
    const targetCenterY = target.y + target.height / 2;
    const dx = Math.abs(targetCenterX - sourceCenterX);
    const dy = Math.abs(targetCenterY - sourceCenterY);
    if (target.type === 'join' && dx > target.width) {
        return sourceCenterX <= targetCenterX
            ? { sourceSide: 'right', targetSide: 'left' }
            : { sourceSide: 'left', targetSide: 'right' };
    }
    if (dy >= dx * 0.42) {
        return sourceCenterY <= targetCenterY
            ? { sourceSide: 'bottom', targetSide: 'top' }
            : { sourceSide: 'top', targetSide: 'bottom' };
    }
    return sourceCenterX <= targetCenterX
        ? { sourceSide: 'right', targetSide: 'left' }
        : { sourceSide: 'left', targetSide: 'right' };
}

function makePort(node, side, slotIndex, slotCount) {
    const fraction = (slotIndex + 1) / (slotCount + 1);
    if (side === 'top' || side === 'bottom') {
        const x = snap(node.x + Math.max(24, Math.min(node.width - 24, node.width * fraction)));
        const y = side === 'top' ? node.y : node.y + node.height;
        const extensionY = side === 'top'
            ? Math.floor((y - clearance - grid) / grid) * grid
            : Math.ceil((y + clearance + grid) / grid) * grid;
        return {
            boundary: { x, y },
            extension: { x, y: extensionY },
            anchor: { x: (x - node.x) / node.width, y: side === 'top' ? 0 : 1 },
        };
    }
    const y = snap(node.y + Math.max(24, Math.min(node.height - 24, node.height * fraction)));
    const x = side === 'left' ? node.x : node.x + node.width;
    const extensionX = side === 'left'
        ? Math.floor((x - clearance - grid) / grid) * grid
        : Math.ceil((x + clearance + grid) / grid) * grid;
    return {
        boundary: { x, y },
        extension: { x: extensionX, y },
        anchor: { x: side === 'left' ? 0 : 1, y: (y - node.y) / node.height },
    };
}

function simplify(points) {
    if (points.length <= 2) return points;
    const result = [points[0]];
    for (let index = 1; index < points.length - 1; index += 1) {
        const previous = result.at(-1);
        const current = points[index];
        const next = points[index + 1];
        if (!((previous.x === current.x && current.x === next.x)
            || (previous.y === current.y && current.y === next.y))) {
            result.push(current);
        }
    }
    result.push(points.at(-1));
    return result;
}

function routeBetween(start, end, obstacles, page, usedSegments, usedPoints) {
    const minX = grid;
    const minY = 95;
    const maxX = Math.floor((page.width - grid) / grid) * grid;
    const maxY = Math.floor((page.height - grid) / grid) * grid;
    const blocked = (point) => obstacles.some((obstacle) => containsPoint(obstacle, point));
    const open = new MinHeap();
    const costs = new Map();
    const previous = new Map();
    const startKey = stateKey(start, 'start');
    costs.set(startKey, 0);
    open.push({ point: start, direction: 'start', cost: 0, priority: Math.abs(start.x - end.x) + Math.abs(start.y - end.y) });
    let final = null;

    while (open.size > 0) {
        const current = open.pop();
        const currentKey = stateKey(current.point, current.direction);
        if (current.cost !== costs.get(currentKey)) continue;
        if (current.point.x === end.x && current.point.y === end.y) {
            final = current;
            break;
        }
        for (const direction of directions) {
            const next = { x: current.point.x + direction.dx, y: current.point.y + direction.dy };
            if (next.x < minX || next.x > maxX || next.y < minY || next.y > maxY) continue;
            if (!(next.x === end.x && next.y === end.y) && blocked(next)) continue;
            if (usedSegments.has(segmentKey(current.point, next))) continue;
            const bendPenalty = current.direction !== 'start' && current.direction !== direction.name ? 4 : 0;
            const pointPenalty = (usedPoints.get(pointKey(next)) || 0) * 5;
            const nextCost = current.cost + 1 + bendPenalty + pointPenalty;
            const nextKey = stateKey(next, direction.name);
            if (nextCost >= (costs.get(nextKey) ?? Number.POSITIVE_INFINITY)) continue;
            costs.set(nextKey, nextCost);
            previous.set(nextKey, currentKey);
            const heuristic = (Math.abs(next.x - end.x) + Math.abs(next.y - end.y)) / grid;
            open.push({ point: next, direction: direction.name, cost: nextCost, priority: nextCost + heuristic });
        }
    }

    if (!final) throw new Error(`Unable to route ${pointKey(start)} to ${pointKey(end)} on ${page.name}`);
    const route = [];
    let key = stateKey(final.point, final.direction);
    while (key) {
        const [x, y] = key.split(',', 2).map(Number);
        route.push({ x, y });
        key = previous.get(key);
    }
    return simplify(route.reverse());
}

function intersectsRectangle(a, b, rect) {
    if (a.x === b.x) {
        return a.x > rect.x && a.x < rect.x + rect.width
            && Math.max(a.y, b.y) > rect.y && Math.min(a.y, b.y) < rect.y + rect.height;
    }
    if (a.y === b.y) {
        return a.y > rect.y && a.y < rect.y + rect.height
            && Math.max(a.x, b.x) > rect.x && Math.min(a.x, b.x) < rect.x + rect.width;
    }
    return true;
}

const routingOverrides = {
    'pet-owner:flow-04': { sourceSide: 'left', targetSide: 'top' },
    'pet-owner:flow-16': { sourceSide: 'left', targetSide: 'top' },
    'pet-owner:flow-34': { sourceSide: 'right', targetSide: 'top' },
    'pet-owner:flow-42': { sourceSide: 'right', targetSide: 'top' },
    'admin:flow-04': { sourceSide: 'left', targetSide: 'top' },
    'veterinarian:flow-04': { sourceSide: 'left', targetSide: 'top' },
    'super-admin:flow-04': { sourceSide: 'left', targetSide: 'top' },
};

function createRoutes(page, nodesById) {
    const specifications = page.edges.map((edge) => ({
        edge,
        ...(routingOverrides[`${page.id}:${edge.id}`] || chooseSides(nodesById.get(edge.source), nodesById.get(edge.target))),
    }));
    const portCounts = new Map();
    for (const specification of specifications) {
        for (const [nodeId, side] of [[specification.edge.source, specification.sourceSide], [specification.edge.target, specification.targetSide]]) {
            const key = `${nodeId}:${side}`;
            portCounts.set(key, (portCounts.get(key) || 0) + 1);
        }
    }
    const portIndexes = new Map();
    const obstacles = [{ x: 0, y: 0, width: page.width, height: 94 }, ...page.nodes.map((node) => rectangle(node, clearance))];
    const usedSegments = new Set();
    const usedPoints = new Map();
    const routes = new Map();

    for (const specification of specifications) {
        const { edge, sourceSide, targetSide } = specification;
        const source = nodesById.get(edge.source);
        const target = nodesById.get(edge.target);
        const sourceKey = `${source.id}:${sourceSide}`;
        const targetKey = `${target.id}:${targetSide}`;
        const sourceIndex = portIndexes.get(sourceKey) || 0;
        const targetIndex = portIndexes.get(targetKey) || 0;
        portIndexes.set(sourceKey, sourceIndex + 1);
        portIndexes.set(targetKey, targetIndex + 1);
        const sourcePort = makePort(source, sourceSide, sourceIndex, portCounts.get(sourceKey));
        const targetPort = makePort(target, targetSide, targetIndex, portCounts.get(targetKey));
        const routeObstacles = obstacles.filter((_, index) => index === 0 || ![source.id, target.id].includes(page.nodes[index - 1].id));
        const points = routeBetween(sourcePort.extension, targetPort.extension, routeObstacles, page, usedSegments, usedPoints);
        const complete = [sourcePort.boundary, ...points, targetPort.boundary];

        for (let index = 0; index < points.length - 1; index += 1) {
            const a = points[index];
            const b = points[index + 1];
            const steps = Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) / grid;
            for (let step = 0; step < steps; step += 1) {
                const from = { x: a.x + Math.sign(b.x - a.x) * grid * step, y: a.y + Math.sign(b.y - a.y) * grid * step };
                const to = { x: a.x + Math.sign(b.x - a.x) * grid * (step + 1), y: a.y + Math.sign(b.y - a.y) * grid * (step + 1) };
                usedSegments.add(segmentKey(from, to));
                usedPoints.set(pointKey(to), (usedPoints.get(pointKey(to)) || 0) + 1);
            }
        }

        for (const node of page.nodes) {
            if (node.id === source.id || node.id === target.id) continue;
            const nodeRect = rectangle(node);
            for (let index = 0; index < complete.length - 1; index += 1) {
                if (intersectsRectangle(complete[index], complete[index + 1], nodeRect)) {
                    throw new Error(`Flow ${edge.id} intersects ${node.id} on ${page.name}`);
                }
            }
        }

        routes.set(edge.id, { sourceAnchor: sourcePort.anchor, targetAnchor: targetPort.anchor, points });
    }
    return routes;
}

function nodeStyle(node) {
    const common = 'html=0;whiteSpace=wrap;fontColor=#111827;fontSize=12;align=center;verticalAlign=middle;shadow=0;';
    if (node.type === 'start') return `${common}ellipse;aspect=fixed;fillColor=#111827;strokeColor=#111827;`;
    if (node.type === 'end') return `${common}ellipse;shape=endState;aspect=fixed;fillColor=#111827;strokeColor=#111827;strokeWidth=2;`;
    if (node.type === 'decision') return `${common}rhombus;fillColor=#ffffff;strokeColor=#111827;strokeWidth=1.5;spacing=8;`;
    if (node.type === 'fork' || node.type === 'join') return `${common}rounded=0;fillColor=#111827;strokeColor=#111827;`;
    return `${common}rounded=1;arcSize=12;fillColor=#ffffff;strokeColor=#374151;strokeWidth=1.4;spacing=8;`;
}

function renderNode(node) {
    const label = String(node.label || '').split('\n').map(escapeXml).join('&#xa;');
    return `        <mxCell id="${node.id}" value="${label}" style="${nodeStyle(node)}" vertex="1" parent="1"><mxGeometry x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" as="geometry"/></mxCell>`;
}

function renderEdge(edge, route) {
    const style = [
        'edgeStyle=orthogonalEdgeStyle', 'rounded=0', 'orthogonalLoop=1', 'jettySize=auto',
        'jumpStyle=arc', 'jumpSize=9', 'html=0', 'strokeColor=#374151', 'strokeWidth=1.4',
        'endArrow=block', 'endFill=1', 'endSize=7', 'exitDx=0', 'exitDy=0', 'entryDx=0', 'entryDy=0',
        `exitX=${route.sourceAnchor.x.toFixed(4)}`, `exitY=${route.sourceAnchor.y.toFixed(4)}`,
        `entryX=${route.targetAnchor.x.toFixed(4)}`, `entryY=${route.targetAnchor.y.toFixed(4)}`,
    ].join(';');
    const points = route.points.map((point) => `              <mxPoint x="${point.x}" y="${point.y}"/>`).join('\n');
    const label = edge.label
        ? [
            `        <mxCell id="${edge.id}-label" value="${escapeXml(edge.label)}" style="edgeLabel;html=0;align=center;verticalAlign=middle;resizable=0;points=[];fontColor=#111827;fontSize=11;fontStyle=1;labelBackgroundColor=#ffffff;" vertex="1" connectable="0" parent="${edge.id}">`,
            '          <mxGeometry x="0" y="-14" relative="1" as="geometry"><mxPoint as="offset"/></mxGeometry>',
            '        </mxCell>',
        ].join('\n')
        : '';
    return [
        `        <mxCell id="${edge.id}" value="" style="${style}" edge="1" parent="1" source="${edge.source}" target="${edge.target}">`,
        '          <mxGeometry relative="1" as="geometry">',
        '            <Array as="points">', points,
        '            </Array>',
        '          </mxGeometry>',
        '        </mxCell>',
        label,
    ].filter(Boolean).join('\n');
}

function renderPage(page) {
    const nodesById = new Map(page.nodes.map((node) => [node.id, node]));
    if (nodesById.size !== page.nodes.length) throw new Error(`Duplicate node ID on ${page.name}`);
    for (const edge of page.edges) {
        if (!nodesById.has(edge.source) || !nodesById.has(edge.target)) throw new Error(`Unknown flow endpoint on ${page.name}: ${edge.id}`);
    }
    const routes = createRoutes(page, nodesById);
    const laneStyle = 'swimlane;html=0;horizontal=1;startSize=42;rounded=0;collapsible=0;fontStyle=1;fontSize=13;align=center;verticalAlign=middle;fillColor=#f8fafc;swimlaneFillColor=#ffffff;strokeColor=#9ca3af;fontColor=#111827;strokeWidth=1;';
    const titleStyle = 'text;html=0;align=left;verticalAlign=middle;fontColor=#111827;fontSize=24;fontStyle=1;strokeColor=none;fillColor=none;';
    const subtitleStyle = 'text;html=0;align=left;verticalAlign=middle;fontColor=#4b5563;fontSize=12;strokeColor=none;fillColor=none;';
    const legendStyle = 'rounded=0;html=0;whiteSpace=wrap;align=left;verticalAlign=middle;spacing=8;fillColor=#ffffff;strokeColor=#9ca3af;fontColor=#111827;fontSize=11;';
    const lanesXml = page.lanes.map((entry) => `        <mxCell id="lane-${entry.id}" value="${escapeXml(entry.title)}" style="${laneStyle}" vertex="1" parent="1"><mxGeometry x="${entry.x}" y="95" width="${entry.width}" height="${page.height - 120}" as="geometry"/></mxCell>`).join('\n');
    const nodesXml = page.nodes.map(renderNode).join('\n');
    const edgesXml = page.edges.map((edge) => renderEdge(edge, routes.get(edge.id))).join('\n');
    return [
        `  <diagram id="${page.id}" name="${escapeXml(page.name)}">`,
        `    <mxGraphModel dx="1400" dy="850" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="${page.width}" pageHeight="${page.height}" math="0" shadow="0" background="#ffffff">`,
        '      <root>',
        '        <mxCell id="0"/>',
        '        <mxCell id="1" parent="0"/>',
        `        <mxCell id="page-title" value="${escapeXml(page.title)}" style="${titleStyle}" vertex="1" parent="1"><mxGeometry x="30" y="15" width="1050" height="34" as="geometry"/></mxCell>`,
        `        <mxCell id="page-subtitle" value="${escapeXml(page.subtitle)}" style="${subtitleStyle}" vertex="1" parent="1"><mxGeometry x="30" y="53" width="1250" height="24" as="geometry"/></mxCell>`,
        `        <mxCell id="page-legend" value="● Start   ◎ End   Rounded box = activity   Diamond = decision   Thick bar = fork / join" style="${legendStyle}" vertex="1" parent="1"><mxGeometry x="${page.width - 560}" y="20" width="530" height="48" as="geometry"/></mxCell>`,
        lanesXml,
        nodesXml,
        edgesXml,
        '      </root>',
        '    </mxGraphModel>',
        '  </diagram>',
    ].join('\n');
}

const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<mxfile host="app.diagrams.net" modified="2026-08-11T00:00:00.000Z" agent="Codex" version="24.7.17" type="device" compressed="false">',
    pages.map(renderPage).join('\n'),
    '</mxfile>',
    '',
].join('\n');

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, xml, 'utf8');
console.log(`Generated ${outputPath}`);
