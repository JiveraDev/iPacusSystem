// Conceptual domain classes: operations describe responsibilities, not literal
// JavaScript/PHP class declarations. Every responsibility has source evidence.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = path.dirname(fileURLToPath(import.meta.url));
export const source = JSON.parse(fs.readFileSync(path.join(OUT, 'system-source-model.json'), 'utf8'));
const sqlLines = fs.readFileSync('C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql', 'utf8').split(/\r?\n/);
const schema = JSON.parse(fs.readFileSync(path.join(OUT, 'schema-model.json'), 'utf8'));
const modules = new Map(source.modules.map(module => [module.name, module]));
export const groups = schema.modules.map(group => ({ id: group.id, title: group.title, names: [...group.names] }));
groups.find(group => group.id === 'bookings').names.push('clinical_intakes');

const aliases = {
    branches: 'Branch', users: 'User', pets_information: 'Pet', pet_ownership: 'PetOwnership',
    pet_vaccinations: 'PetVaccination', pet_medical_record_groups: 'MedicalRecordGroup',
    pet_medical_record_group_items: 'MedicalRecordItem', queues: 'QueueEntry',
    vet_diagnoses: 'Diagnosis', veterinarian_profiles: 'VeterinarianProfile',
    veterinarian_booking_clinics: 'VetClinicBookingPreference', vet_schedules: 'OnlineVetSchedule',
    online_consultation_diagnoses: 'OnlineDiagnosis', clinical_intakes: 'PhysicalExamination',
    consent_files: 'ConsentTemplate', consent_form_records: 'ConsentRecord',
    user_notifications: 'Notification', pet_owner_todos: 'PetOwnerTodo', mail_queue: 'OutgoingEmail',
    inventory_batches: 'InventoryBatch', inventory_action_audit: 'InventoryAudit',
    admin_feature_permission_audit: 'AdminPermissionAudit', room_unit_statuses: 'RoomUnitStatus',
    history_before_registration: 'PetPriorHistory', pet_catalog_options: 'PetCatalogOption',
    veterinarian_branch_schedules: 'LegacyVetClinicVisit',
    veterinarian_working_hours: 'LegacyVetWorkingHours', veterinarian_booking_time_off: 'LegacyVetTimeOff',
};
const pascal = value => value.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('');
export const camel = value => value.replace(/_([a-zA-Z])/g, (_, letter) => letter.toUpperCase());
function className(table) {
    if (aliases[table]) return aliases[table];
    const singular = table.endsWith('ies') ? table.slice(0, -3) + 'y' : table.endsWith('s') && !table.endsWith('ss') ? table.slice(0, -1) : table;
    return pascal(singular);
}
const fields = {
    users: { first_Name: 'firstName', last_Name: 'lastName', mail_Address: 'email', personal_Address: 'address', user_password: 'passwordHash', setProfilePic_url: 'profileImageUrl' },
    pets_information: { pet_species: 'species', pet_breed: 'breed', pet_BDAY: 'birthDate', pet_status: 'status', pet_gender: 'gender', pet_weight: 'weight', pet_sharable_ID: 'sharableId' },
    veterinarian_profiles: { id: 'profileId', prc_license_number: 'licenseNumber' },
    admin_profiles: { id: 'profileId', postionn: 'position' },
    pet_vaccinations: { vax_id: 'vaccinationId', vax_name: 'vaccineName', vax_date: 'vaccinationDate', vax_next_due: 'nextDueDate', vax_applicator: 'applicator', vax_status: 'status' },
    online_consultations: { online_consultation_id: 'consultationId' },
    online_consultation_diagnoses: { online_consultation_id: 'consultationId' },
    consent_form_records: { consent_record_id: 'consentId', consent_file_id: 'templateId' },
    consent_files: { file_id: 'templateId' },
    clinical_intakes: { intake_id: 'examinationId', physical_exam: 'physicalFindings' },
};
export function fieldName(table, column) { return fields[table]?.[column] || camel(column); }
function domainType(column) {
    if (/^(tinyint|boolean|bool)$/.test(column.type) && (column.size === '1' || /^(is_|has_|accepts_|visible_|share_|verified_by_admin)/.test(column.name))) return 'bool';
    if (/int/.test(column.type)) return 'int';
    if (/decimal|float|double/.test(column.type)) return 'decimal';
    if (/timestamp|datetime/.test(column.type)) return 'datetime';
    if (/^(date|time)$/.test(column.type)) return column.type;
    if (column.type === 'json' || /json_valid/.test(column.definition || '')) return 'json';
    if (/blob|binary/.test(column.type)) return 'bytes';
    return 'string';
}

// name / implementation module / implementation operation / behavior note.
const operations = {
    users: [
        ['login', 'userLogin', 'loginUser'], ['logout', 'apiClient', 'clearStoredAuthSession'],
        ['updateProfile', 'profileService', 'updateProfile'], ['updatePassword', 'userService', 'updateUserPassword'],
    ],
    branches: [['listBranches', 'branchService', 'fetchBranches'], ['checkAvailability', 'bookingAvailabilityService', 'fetchBookingAvailability'], ['relocateBooking', 'branchService', 'relocateBooking']],
    veterinarian_profiles: [['updateProfile', 'profileService', 'updateProfile'], ['setAcceptingPatients', 'vetPresenceService', 'updateVetPresence'], ['receivePatient', 'queueService', 'receiveQueue']],
    user_branch_assignments: [['assignClinic', 'accountService', 'updatePersonnelAccountDetails'], ['setPrimaryClinic', 'accountService', 'updatePersonnelAccountDetails']],
    veterinarian_booking_clinics: [['setAcceptsBookings', 'vetBookingScheduleService', 'saveVetBookingSchedule'], ['listAcceptedClinics', 'vetBookingScheduleService', 'fetchVetBookingSchedule']],
    vet_schedules: [['updateAvailability', 'vetScheduleService', 'updateVetSchedules'], ['listAvailableSlots', 'vetScheduleService', 'fetchVetSchedules']],
    branch_operating_hours: [['checkClinicHours', 'clinic_booking_helpers', 'clinic_booking_capacity']],
    branch_closures: [['checkClosure', 'clinic_booking_helpers', 'clinic_booking_capacity']],
    branch_service_availability: [['checkServiceAvailability', 'bookingAvailabilityService', 'fetchBookingAvailability']],
    pets_information: [['registerPet', 'addPet', 'addPetService'], ['updateDetails', 'petService', 'updatePetDetails'], ['updateStatus', 'petService', 'updatePetStatus'], ['viewMedicalHistory', 'petService', 'fetchPetMedicalRecords']],
    pet_ownership: [['linkPet', 'ConnectOwnership', 'linkPetService'], ['requestCoParent', 'ConnectOwnership', 'linkPetService'], ['removeOwnership', 'accountService', 'removePetOwnerOwnership']],
    pet_coparent_requests: [['viewRequest', 'ConnectOwnership', 'fetchCoparentRequest'], ['decideRequest', 'ConnectOwnership', 'decideCoparentRequest']],
    pet_vaccinations: [['recordVaccination', 'pet_medical_records', 'pet_medical_save_vaccination'], ['viewHistory', 'pet_medical_records', 'pet_medical_fetch_vaccinations']],
    pet_allergies: [['saveAllergy', 'pet_medical_records', 'pet_medical_save_allergy'], ['viewAllergies', 'pet_medical_records', 'pet_medical_fetch_allergies']],
    pet_medical_record_groups: [['createGroup', 'petService', 'createPetMedicalRecordGroup'], ['updateGroup', 'petService', 'updatePetMedicalRecordGroup'], ['deleteGroup', 'petService', 'deletePetMedicalRecordGroup']],
    pet_medical_record_group_items: [['addItem', 'petService', 'addPetMedicalRecordGroupItem'], ['updateItem', 'petService', 'updatePetMedicalRecordGroupItem'], ['removeItem', 'petService', 'removePetMedicalRecordGroupItem']],
    pet_medical_certificates: [['issueCertificate', 'petCertificateService', 'issuePetMedicalCertificate'], ['markViewed', 'petCertificateService', 'markPetMedicalCertificateViewed']],
    pet_record_update_requests: [['createRequest', 'recordUpdateRequestService', 'createRecordUpdateRequest'], ['updateRequest', 'recordUpdateRequestService', 'updateRecordUpdateRequest']],
    pet_catalog_options: [['listOptions', 'petCatalogService', 'fetchPetCatalog']],
    bookings: [['createBooking', 'bookingService', 'createBooking'], ['updateSchedule', 'bookingService', 'updateBookingSchedule'], ['updateStatus', 'bookingService', 'updateBookingStatus'], ['receiveBooking', 'bookingService', 'receiveBooking'], ['cancelBooking', 'bookingService', 'updateBookingStatus']],
    booking_pets: [['attachPet', 'bookingService', 'createBooking']],
    booking_branch_transfers: [['transferBooking', 'branchService', 'relocateBooking']],
    queues: [['enqueue', 'queueService', 'addQueueItem'], ['updateStatus', 'queueService', 'updateQueueStatus'], ['assignVeterinarian', 'queueService', 'assignQueueToVeterinarian'], ['reenterQueue', 'queueService', 'reenterQueue']],
    vet_queue_assignments: [['receive', 'queueService', 'receiveQueue'], ['returnQueue', 'queueService', 'returnQueue'], ['complete', 'vet_diagnoses', 'vetDiagnosisCompleteQueue']],
    clinical_intakes: [
        ['startExamination', 'clinicalIntakeService', 'startClinicalIntake'],
        ['saveFindings', 'clinicalIntakeService', 'saveClinicalIntake'],
        ['completeExamination', 'PatientIntake', 'persistIntake'],
        ['reassignVeterinarian', 'PatientIntake', 'reassignVeterinarian'],
        ['attachEvidence', 'PatientIntake', 'uploadPhotos'], ['captureConsent', 'PatientIntake', 'saveSignedConsent'],
    ],
    vet_diagnoses: [
        ['recordDiagnosis', 'vetDiagnosisService', 'createVetDiagnosis'], ['finalize', 'VetDiagnosis', 'handleSaveDiagnosis'],
        ['viewDiagnosis', 'vetDiagnosisService', 'fetchVetDiagnosis'], ['addConsent', 'VetDiagnosis', 'addAdditionalConsent'],
        ['printPrescription', 'VetDiagnosis', 'printPrescriptionFromCurrentForm', 'Print only when a prescription has content.'],
    ],
    consent_files: [['createTemplate', 'consentFileService', 'createConsentFile'], ['updateTemplate', 'consentFileService', 'updateConsentFile'], ['deleteTemplate', 'consentFileService', 'deleteConsentFile']],
    consent_form_records: [['saveSignedConsent', 'consentRecordService', 'saveConsentFormRecord'], ['validateDocumentScope', 'consent_record_helpers', 'consent_record_assert_document_scope']],
    online_consultations: [['start', 'onlineConsultationService', 'startOnlineConsultation'], ['join', 'onlineConsultationService', 'joinOnlineConsultation'], ['end', 'onlineConsultationService', 'endOnlineConsultation'], ['submitDiagnosis', 'onlineConsultationService', 'submitOnlineConsultationDiagnosis']],
    online_consultation_diagnoses: [['recordDiagnosis', 'onlineConsultationService', 'submitOnlineConsultationDiagnosis'], ['issuePrescription', 'prescription_helpers', 'prescription_sync_plan']],
    online_consultation_reschedules: [['reschedule', 'bookingService', 'updateBookingSchedule']],
    prescription_plans: [['syncFromDiagnosis', 'prescription_helpers', 'prescription_sync_plan'], ['startSelectedItems', 'prescriptionService', 'startPrescriptionPlan'], ['amend', 'prescriptionService', 'amendPrescriptionPlan'], ['notifyOwner', 'prescription_helpers', 'prescription_notify_plan']],
    prescription_items: [['startItem', 'prescriptionService', 'startPrescriptionPlan', 'Start payload selects individual items and their start dates.'], ['updateItem', 'prescriptionService', 'amendPrescriptionPlan'], ['generateOccurrences', 'prescription_helpers', 'prescription_generate_occurrences']],
    prescription_occurrences: [['markDone', 'prescriptionService', 'updatePrescriptionOccurrence'], ['skipOccurrence', 'prescriptionService', 'updatePrescriptionOccurrence']],
    prescription_events: [['recordEvent', 'prescription_helpers', 'prescription_event']],
    pet_owner_todos: [['createTodo', 'todoService', 'createPetOwnerTodo'], ['updateTodo', 'todoService', 'updatePetOwnerTodo'], ['deleteTodo', 'todoService', 'deletePetOwnerTodo']],
    user_notifications: [['notify', 'notification_helpers', 'notification_create_event'], ['markRead', 'notificationService', 'markNotificationRead'], ['markAllRead', 'notificationService', 'markAllNotificationsRead']],
    notification_preferences: [['loadPreferences', 'notificationService', 'fetchNotificationPreferences'], ['savePreferences', 'notificationService', 'saveNotificationPreferences']],
    notification_push_subscriptions: [['subscribe', 'notificationService', 'saveNotificationPushSubscription'], ['disable', 'notificationService', 'disableNotificationPushSubscription']],
    inventory_items: [['createItem', 'inventoryApi', 'createInventoryItem'], ['updateItem', 'inventoryApi', 'updateInventoryItem'], ['stockOut', 'inventoryApi', 'createStockOut']],
    inventory_stock_receipts: [['receiveStock', 'inventoryApi', 'createStockReceipt']],
    inventory_stock_receipt_items: [['recordReceivedItem', 'inventoryApi', 'createStockReceipt']],
    inventory_transfers: [['transferStock', 'inventoryApi', 'transferInventoryStock']],
    inventory_transfer_items: [['recordTransferItem', 'inventoryApi', 'transferInventoryStock']],
    inventory_branch_items: [['removeFromClinic', 'inventoryApi', 'deleteInventoryItem']],
    service_catalog: [['saveService', 'serviceCatalogService', 'saveServiceCatalogItem'], ['updateMaterials', 'serviceCatalogService', 'updateServiceCatalogMaterials'], ['deactivate', 'serviceCatalogService', 'deactivateServiceCatalogItem']],
    service_materials: [['updateMaterials', 'serviceCatalogService', 'updateServiceCatalogMaterials']],
    service_display_settings: [['saveDisplaySettings', 'serviceCatalogService', 'saveServiceDisplaySettings']],
    special_service_catalog: [['createService', 'specialServicesService', 'createSpecialService'], ['updateService', 'specialServicesService', 'updateSpecialService']],
    visits: [['createVisit', 'visitBillingService', 'createVisit'], ['updateStatus', 'visit_billing', 'visit_billing_update_status'], ['calculateBalance', 'visit_billing', 'visit_billing_fetch_visit']],
    visit_charges: [['saveCharges', 'visitBillingService', 'saveVisitCharges'], ['replaceCharges', 'visit_billing', 'visit_billing_replace_charges']],
    visit_payments: [['recordPayment', 'visitBillingService', 'postVisitPayment'], ['requestRefund', 'visitBillingService', 'postVisitRefund']],
    visit_payment_refunds: [['processRefund', 'visitBillingService', 'postVisitRefund']],
    visit_invoice_documents: [['saveInvoice', 'visit_billing', 'visit_billing_save_invoice_document'], ['listInvoices', 'visit_billing', 'visit_billing_fetch_invoice_documents']],
    booking_payment_submissions: [['reviewPayment', 'bookingService', 'reviewBookingPayment']],
    booking_payment_refunds: [['processRefund', 'bookingService', 'postBookingPaymentRefund']],
    payment_methods: [['updateMethods', 'paymentMethodService', 'updatePaymentMethods'], ['requestChangeOtp', 'paymentMethodService', 'requestPaymentMethodsOtp']],
    grooming_jobs: [['updateJob', 'groomingService', 'updateGroomingJob'], ['viewJob', 'groomingService', 'fetchGroomingJob']],
    grooming_photos: [['uploadPhoto', 'groomingService', 'uploadGroomingPhoto']],
    boarding_assignments: [['assignRoom', 'boardingService', 'assignBoardingRoom'], ['checkIn', 'boardingService', 'checkInBoardingBooking'], ['checkOut', 'boardingService', 'checkOutBoardingBooking'], ['updateCheckOut', 'boardingService', 'updateDesiredCheckOut']],
    boarding_documents: [['addDocument', 'boardingService', 'createBoardingDocument'], ['listDocuments', 'boardingService', 'fetchBoardingDocuments']],
    boarding_observations: [['recordObservation', 'boardingService', 'createBoardingObservation']],
    boarding_tasks: [['createTask', 'boardingService', 'createBoardingTask'], ['completeTask', 'boardingService', 'completeBoardingTask']],
    boarding_material_usages: [['recordUsage', 'boardingService', 'createBoardingMaterial'], ['removeUsage', 'boardingService', 'removeBoardingMaterial']],
    rooms: [['createRooms', 'boardingService', 'createBoardingRooms'], ['updateRoom', 'boardingService', 'updateBoardingRoom'], ['checkAvailability', 'boardingService', 'fetchRoomAvailability']],
    room_unit_statuses: [['updateStatus', 'boardingService', 'updateBoardingRoom']],
    admin_profiles: [['updateProfile', 'accountService', 'updatePersonnelAccountDetails']],
    admin_feature_permissions: [['savePermissions', 'adminFeatureAccessService', 'saveAdminFeatureAccess']],
    user_auth_identities: [['connectGoogle', 'googleAuthService', 'connectGoogleAccount'], ['checkConnection', 'googleAuthService', 'getGoogleConnectionStatus']],
    email_otp_tokens: [['sendVerification', 'authEmail', 'resendVerificationCode'], ['verifyEmail', 'authEmail', 'verifyEmail']],
    google_auth_onboarding_tokens: [['completeRegistration', 'googleAuthService', 'completeGoogleRegistration']],
    system_backups: [['createBackup', 'system_backup_common', 'ipawcus_backup_create'], ['listBackups', 'systemBackupService', 'fetchSystemBackups'], ['downloadBackup', 'systemBackupService', 'downloadLocalSystemBackup']],
};

function resolveOperation(table, [name, moduleName, operationName, note]) {
    const module = modules.get(moduleName);
    if (!module) throw new Error('Unknown module: ' + moduleName + ' / ' + table);
    const operation = [...(module.operations || []), ...(module.localFunctions || [])].find(operation => operation.name === operationName);
    if (!operation) throw new Error('Unknown operation: ' + moduleName + '.' + operationName);
    return { name, signature: '+ ' + name + '()', evidence: { file: module.source, line: operation.line, operation: operationName }, ...(note ? { note } : {}) };
}

// Supporting records without a distinct business operation expose a read
// responsibility only when the source actually queries their table. No made-up CRUD.
export const classes = source.tables.map(table => {
    const attributes = table.columns.map(column => ({ name: fieldName(table.name, column.name), sqlName: column.name, type: domainType(column), nullable: column.nullable }));
    const explicit = (operations[table.name] || []).map(operation => resolveOperation(table.name, operation));
    if (!explicit.length) {
        const reader = source.modules.flatMap(module => (module.queries || []).filter(query => query.table === table.name && ['FROM', 'JOIN'].includes(query.clause)).map(query => ({ file: module.source, line: query.line, clause: query.clause }))).find(query => !/backup|schema/.test(query.file));
        if (reader) explicit.push({ name: 'viewRecord', signature: '+ viewRecord()', evidence: reader, note: 'Conceptual read responsibility backed by an observed table query.' });
    }
    return { id: table.name, name: className(table.name), attributes, operations: explicit, table,
        legacy: table.name.startsWith('veterinarian_') && /working_hours|time_off|branch_schedules/.test(table.name),
        migrationOnly: table.provenance === 'migration-only' };
});
const classMap = new Map(classes.map(item => [item.id, item]));
for (const item of classes) {
    if (new Set(item.attributes.map(attribute => attribute.name)).size !== item.attributes.length) throw new Error('Repeated attribute alias in ' + item.name);
}
export const relations = source.tables.flatMap(table => table.fks.map((key, index) => ({
    id: table.name + '-fk-' + index, source: table.name, target: key.table, columns: key.columns, references: key.references,
    sourceText: [table.pk, ...table.unique].some(columns => columns.length && columns.every(column => key.columns.includes(column))) ? '0..1' : '0..*',
    targetText: key.columns.some(name => table.columns.find(column => column.name === name).nullable) ? '0..1' : '1',
    kind: 'association', evidence: { file: table.provenance === 'migration-only' ? table.source : 'C:/Users/Admin/Downloads/iPawcus_ERD_Schema.sql',
        line: table.provenance === 'migration-only' ? table.line : sqlLines.findIndex(line => line.includes('CONSTRAINT `' + key.constraint + '`')) + 1,
        constraint: key.constraint },
})));
function applicationReference(table, column, target, targetColumn, file, line) {
    const definition = classMap.get(table).table;
    if (!definition.columns.some(item => item.name === column) || !classMap.get(target).table.columns.some(item => item.name === targetColumn)) throw new Error('Unknown application association field.');
    relations.push({ id: table + '-app-' + column, source: table, target, columns: [column], references: [targetColumn], sourceText: '0..*', targetText: definition.columns.find(item => item.name === column).nullable ? '0..1' : '1', kind: 'application-association', evidence: { file, line, note: 'Logical application association; not a declared SQL foreign key.' } });
}
applicationReference('bookings', 'veterinarian_id', 'users', 'user_id', 'php/get_bookings.php', 146);
for (const [column, target, targetColumn, line] of [
    ['consent_file_id', 'consent_files', 'file_id', 369], ['owner_user_id', 'users', 'user_id', 371],
    ['pet_id', 'pets_information', 'pet_id', 372], ['booking_id', 'bookings', 'booking_id', 373],
    ['queue_id', 'queues', 'queue_id', 374], ['visit_id', 'visits', 'visit_id', 375],
    ['processed_by_user_id', 'users', 'user_id', 385],
]) applicationReference('consent_form_records', column, target, targetColumn, 'php/consent_record_helpers.php', line);

for (const [target, discriminator, file, line] of [
    ['vet_diagnoses', 'clinic_diagnosis', 'php/vet_diagnoses.php', 1061],
    ['online_consultation_diagnoses', 'online_consultation', 'php/online_consultations.php', 631],
]) relations.push({ id: 'prescription_plans-source-' + discriminator, source: 'prescription_plans', target,
    columns: ['source_record_id'], references: ['diagnosis_id'], sourceText: '0..*', targetText: '0..1',
    kind: 'application-association', discriminator: { column: 'source_type', value: discriminator },
    evidence: { file, line, note: 'Conditional logical reference when source_type = ' + discriminator + '; alternatives are mutually exclusive, not declared SQL foreign keys.' } });

// The main sheet follows the reference image's five-column domain arrangement.
export const core = [
    'branches', 'users', 'pets_information', 'pet_vaccinations', 'pet_medical_record_groups',
    'veterinarian_booking_clinics', 'user_branch_assignments', 'pet_ownership', 'pet_medical_record_group_items', 'service_catalog',
    'bookings', 'veterinarian_profiles', 'clinical_intakes', 'queues', 'inventory_items',
    'booking_pets', 'vet_schedules', 'vet_diagnoses', 'visits', 'visit_charges',
    'online_consultations', 'vet_queue_assignments', 'prescription_plans', 'visit_payments', 'visit_payment_refunds',
    'online_consultation_diagnoses', 'consent_form_records', 'prescription_items', 'prescription_occurrences', 'user_notifications',
    'consent_files', 'branch_operating_hours', 'pet_owner_todos',
];
export const coreFields = {
    users: ['user_id', 'first_Name', 'last_Name', 'mail_Address', 'phoneNumber', 'role', 'account_status', 'preferred_branch_id'],
    branches: ['branch_id', 'branch_code', 'branch_name', 'branch_type', 'address', 'status'],
    pets_information: ['pet_id', 'pet_name', 'pet_species', 'pet_breed', 'pet_BDAY', 'pet_gender', 'pet_weight', 'pet_status', 'pet_sharable_ID'],
    veterinarian_profiles: ['id', 'user_id', 'veterinarian_id', 'prc_license_number', 'specialization', 'consultation_rate', 'is_accepting_patients'],
    bookings: ['booking_id', 'booking_number', 'user_id', 'pet_id', 'branch_id', 'veterinarian_id', 'service_type', 'booking_date', 'booking_time', 'status', 'price'],
    queues: ['queue_id', 'pet_id', 'user_id', 'booking_id', 'branch_id', 'queue_number', 'queue_date', 'status', 'priority'],
    clinical_intakes: ['intake_id', 'queue_id', 'pet_id', 'assigned_veterinarian_user_id', 'recorded_by_user_id', 'status', 'chief_complaint', 'symptoms', 'major_symptoms', 'physical_exam', 'vital_signs', 'attachments'],
    vet_diagnoses: ['diagnosis_id', 'queue_id', 'booking_id', 'pet_id', 'veterinarian_user_id', 'chief_complaint', 'physical_exam', 'diagnosis', 'treatment', 'prescriptions', 'finalized_at'],
    consent_form_records: ['consent_record_id', 'consent_file_id', 'owner_user_id', 'pet_id', 'queue_id', 'visit_id', 'status', 'signed_file_path', 'processed_by_user_id'],
    consent_files: ['file_id', 'file_name', 'content', 'category'],
    online_consultations: ['online_consultation_id', 'booking_id', 'owner_user_id', 'veterinarian_user_id', 'scheduled_start', 'scheduled_end', 'meeting_url', 'status'],
    online_consultation_diagnoses: ['diagnosis_id', 'online_consultation_id', 'veterinarian_user_id', 'diagnosis', 'treatment', 'medications', 'finalized_at'],
    prescription_plans: ['plan_id', 'pet_id', 'owner_user_id', 'veterinarian_user_id', 'source_type', 'source_record_id', 'version_number', 'status', 'supersedes_plan_id'],
    prescription_items: ['item_id', 'plan_id', 'medicine', 'dose', 'route', 'times_count', 'schedule_type', 'time_slots', 'days_of_week', 'start_at', 'end_at', 'status', 'replaces_item_id'],
    prescription_occurrences: ['occurrence_id', 'item_id', 'due_at', 'status', 'completed_at'],
    visits: ['visit_id', 'pet_id', 'owner_user_id', 'veterinarian_user_id', 'queue_id', 'booking_id', 'diagnosis_id', 'branch_id', 'visit_status', 'billing_status'],
    visit_charges: ['charge_id', 'visit_id', 'charge_type', 'service_id', 'item_id', 'description', 'quantity', 'unit_price', 'subtotal'],
    visit_payments: ['payment_id', 'visit_id', 'payment_method', 'payment_status', 'amount', 'reference_number', 'paid_at'],
    visit_payment_refunds: ['refund_id', 'visit_payment_id', 'visit_id', 'amount', 'refund_method', 'reason', 'refund_status'],
    user_notifications: ['notification_id', 'user_id', 'type', 'title', 'message', 'redirect_path', 'read_at'],
    inventory_items: ['item_id', 'item_name', 'sku', 'category', 'unit', 'reorder_level', 'unit_cost', 'status'],
    pet_medical_record_groups: ['group_id', 'pet_id', 'title', 'summary', 'visible_to_owner', 'sort_order'],
    pet_medical_record_group_items: ['item_id', 'group_id', 'source_type', 'source_id', 'title', 'summary', 'service_date'],
    service_catalog: ['service_id', 'service_code', 'service_name', 'service_type', 'base_price', 'is_major_service', 'is_active'],
    vet_queue_assignments: ['assignment_id', 'queue_id', 'veterinarian_user_id', 'status', 'received_at', 'returned_at', 'completed_at'],
    user_branch_assignments: ['user_branch_assignment_id', 'user_id', 'branch_id', 'is_primary', 'is_active'],
    branch_operating_hours: ['operating_hour_id', 'branch_id', 'day_of_week', 'opens_at', 'closes_at', 'is_closed'],
    pet_owner_todos: ['todo_id', 'user_id', 'title', 'category', 'start_at', 'end_at', 'status'],
};

// Stateless domain services capture important system behavior that has no DB
// table. Their attributes compartment is intentionally empty, not fabricated.
for (const [id, name, operationSpecs, targets] of [
    ['domain:booking_scheduler', 'BookingScheduler', [
        ['findAvailableVets', 'clinic_booking_helpers', 'clinic_booking_roster'],
        ['checkCapacity', 'clinic_booking_helpers', 'clinic_booking_capacity'],
        ['reserveVet', 'clinic_booking_helpers', 'clinic_booking_reserve_vet'],
        ['getOnlineSlots', 'clinic_booking_helpers', 'clinic_booking_online_times'],
    ], ['branches', 'branch_operating_hours', 'veterinarian_booking_clinics', 'vet_schedules', 'bookings']],
    ['domain:report_generator', 'ReportGenerator', [
        ['generateReport', 'reportService', 'generateReport'],
        ['buildDashboard', 'reports_common', 'reports_dashboard'],
    ], ['bookings', 'visits', 'inventory_items']],
]) {
    const behavior = operationSpecs.map(spec => resolveOperation(id, spec));
    classes.push({ id, name, attributes: [], operations: behavior, table: null, legacy: false, migrationOnly: false, stateless: true });
    core.push(id);
    for (const target of targets) relations.push({ id: id.replace(':', '-') + '-uses-' + target, source: id, target,
        columns: [], references: [], sourceText: 'uses', targetText: '', kind: 'dependency', evidence: behavior[0].evidence });
}
