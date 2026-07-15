import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ArrowLeft,
    Eye,
    FileText,
    Loader2,
    PanelRightOpen,
    Pill,
    Plus,
    Printer,
    Receipt,
    Save,
    Stethoscope,
    Syringe,
    Trash2,
    Upload,
    X
} from 'lucide-react';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { PhotoViewer } from '../../ui/photo-viewer';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '../../ui/sheet';
import { Textarea } from '../../ui/textarea';
import { toast } from '../../reusecomponent/toast.jsx';
import SignatureCapture from '../SignatureCapture';
import { useDashboardUser, useNavigate } from '../dashboardRouter.jsx';
import { formatPhpCurrency } from '../../lib/currency';
import { formatQueueReference } from '../../lib/referenceNumbers';
import { fetchBoardingDocuments } from '../../services/boardingService';
import { fetchConsentFiles } from '../../services/consentFileService';
import { fetchProfile } from '../../services/profileService';
import { fetchQueues } from '../../services/queueService';
import { fetchServiceCatalog } from '../../services/serviceCatalogService';
import { uploadDataUrlImage, uploadFormData } from '../../services/uploadService';
import { createVetDiagnosis, fetchVetDiagnoses } from '../../services/vetDiagnosisService';

const DIAGNOSIS_CONTEXT_KEY = 'ipawcus-vet-diagnosis-context';
const DIAGNOSIS_DRAFT_STORAGE_PREFIX = 'ipawcus-vet-diagnosis-draft';
const DIAGNOSIS_DRAFT_SCHEMA_VERSION = 1;

const PRESCRIPTION_FREQUENCIES = [
    { value: 'per day', label: 'Per day' },
    { value: 'per week', label: 'Per week' },
    { value: 'per month', label: 'Per month' },
    { value: 'as needed', label: 'As needed' }
];

const PRESCRIPTION_DURATION_UNITS = [
    { value: 'day', label: 'Day(s)' },
    { value: 'week', label: 'Week(s)' },
    { value: 'month', label: 'Month(s)' },
    { value: 'as needed', label: 'As needed' }
];

const DOCUMENT_UPLOAD_ACCEPT = 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt';
const ADDITIONAL_CONSENT_CATEGORY = 'additional_consent';

const emptyDiagnosisForm = {
    chiefComplaint: '',
    majorSymptoms: '',
    symptoms: '',
    physicalExam: '',
    diagnosis: '',
    treatment: '',
    labResults: '',
    followUp: '',
    notes: '',
    vitalSigns: {
        temperature: '',
        heartRate: '',
        respiratoryRate: '',
        weight: ''
    },
    prescription: []
};

const emptyVaccinationRecord = {
    vaccineName: '',
    dateAdministered: '',
    nextDueDate: '',
    veterinarianName: '',
    veterinarianLicense: '',
    notes: ''
};

function createId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createPrescriptionDraft() {
    return {
        medicine: '',
        times: 1,
        frequency: 'per day',
        durationNumber: 1,
        durationUnit: 'week',
        instructions: ''
    };
}

function createCustomSection(serviceName = '', serviceId = '', majorSymptoms = '') {
    return {
        id: createId(),
        serviceId: serviceId ? String(serviceId) : '',
        label: serviceName,
        value: '',
        majorSymptoms,
        prescription: [],
        prescriptionDraft: createPrescriptionDraft(),
        uploads: []
    };
}

function readDiagnosisContext() {
    const params = new URLSearchParams(window.location.search);
    let storedContext = {};

    try {
        storedContext = JSON.parse(sessionStorage.getItem(DIAGNOSIS_CONTEXT_KEY) || '{}');
    } catch {
        storedContext = {};
    }

    const complaint = params.get('complaint') || storedContext.complaint || '';
    const bookingNumber = storedContext.bookingNumber || extractBookingNumber(complaint);

    return {
        mode: storedContext.mode || 'edit',
        queueId: params.get('queueId') || storedContext.queueId || '',
        queueNumber: storedContext.queueNumber || '',
        queueReference: storedContext.queueReference || '',
        bookingId: storedContext.bookingId || '',
        bookingNumber,
        assignmentId: storedContext.assignmentId || '',
        petId: params.get('petId') || storedContext.petId || '',
        petName: params.get('pet') || storedContext.petName || 'Unknown Pet',
        petSpecies: storedContext.petSpecies || '',
        petBreed: storedContext.petBreed || '',
        petBirthDate: storedContext.petBirthDate || '',
        petAge: storedContext.petAge || '',
        petGender: storedContext.petGender || '',
        petWeight: storedContext.petWeight || '',
        petStatus: storedContext.petStatus || '',
        petMicrochipId: storedContext.petMicrochipId || '',
        petAllergies: storedContext.petAllergies || '',
        petColor: storedContext.petColor || '',
        petProfileImage: storedContext.petProfileImage || '',
        ownerUserId: storedContext.ownerUserId || '',
        ownerName: params.get('owner') || storedContext.ownerName || 'Unknown Owner',
        ownerPhone: storedContext.ownerPhone || '',
        ownerAddress: storedContext.ownerAddress || '',
        serviceName: params.get('service') || storedContext.serviceName || 'Queue',
        complaint,
        bookingNotes: storedContext.bookingNotes || '',
        priority: storedContext.priority || '',
        queueSource: storedContext.queueSource || '',
        queueImagePath: storedContext.queueImagePath || '',
        queueSignaturePath: storedContext.queueSignaturePath || '',
        bookingConcernPaths: storedContext.bookingConcernPaths || '',
        bookingSignaturePath: storedContext.bookingSignaturePath || '',
        signedConsentDocumentPath: storedContext.signedConsentDocumentPath || '',
        signedConsentType: storedContext.signedConsentType || '',
        signedConsentAt: storedContext.signedConsentAt || '',
        physicalConsentPath: storedContext.physicalConsentPath || '',
        physicalConsentPreview: storedContext.physicalConsentPreview || ''
    };
}

function getStoredUser() {
    try {
        return JSON.parse(localStorage.getItem('currentUser') || '{}');
    } catch {
        return {};
    }
}

function getUserId(user) {
    return user?.id || user?.user_id || user?.userId || '';
}

function getUserName(user) {
    const fullName = [
        user?.firstName || user?.FirstName || user?.first_name,
        user?.lastName || user?.LastName || user?.last_name
    ].filter(Boolean).join(' ').trim();

    return fullName || user?.name || user?.email || 'Veterinarian';
}

function isCustomDiagnosisCatalogService(service) {
    const text = `${service?.serviceName || ''} ${service?.category || ''}`.toLowerCase();
    return !/\bgeneral\b/.test(text) && !/surgery/.test(text);
}

function resolveFileUrl(path) {
    if (!path) return '';

    const value = String(path).trim();
    if (!value) return '';
    if (/^(https?:|data:|blob:)/i.test(value)) return value;

    return `/${value.replace(/^\/+/, '').replace(/^public\//, '')}`;
}

function splitUploadPaths(value) {
    if (!value) return [];

    if (Array.isArray(value)) {
        return value.flatMap(splitUploadPaths);
    }

    return String(value)
        .split(/[\n,]+/)
        .map(item => item.trim())
        .filter(Boolean);
}

function combineUploadPathValues(...values) {
    return values.flatMap(splitUploadPaths).join('\n');
}

function pathFileName(path) {
    const cleanPath = String(path || '').split('?')[0].replace(/\\/g, '/');
    return cleanPath.split('/').filter(Boolean).pop() || 'Upload';
}

function isImageFile(attachment) {
    const mimeType = attachment?.mimeType || attachment?.type || '';
    const url = attachment?.preview || attachment?.url || attachment?.relativeUrl || '';

    return mimeType.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp)$/i.test(url);
}

function buildSourceUploads(context) {
    const uploads = [];
    const appendPaths = (paths, label, source) => {
        splitUploadPaths(paths).forEach((path, index) => {
            uploads.push({
                id: `${source}-${label}-${index}-${path}`,
                label,
                source,
                name: pathFileName(path),
                url: path
            });
        });
    };

    appendPaths(context.queueImagePath, 'Queue complaint upload', 'queue');
    appendPaths(context.bookingConcernPaths, 'Booking concern upload', 'booking');

    const seen = new Set();
    return uploads.filter(upload => {
        const key = `${upload.label}:${upload.url}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function buildSignedConsentUploads(context) {
    const uploads = [];
    const appendPaths = (paths, label, source, extra = {}) => {
        splitUploadPaths(paths).forEach((path, index) => {
            uploads.push({
                id: `${source}-${label}-${index}-${path}`,
                label,
                source,
                name: pathFileName(path),
                url: path,
                ...extra
            });
        });
    };

    appendPaths(
        context.signedConsentDocumentPath,
        context.signedConsentType || 'Signed consent document',
        'consent',
        { signedAt: context.signedConsentAt || '' }
    );
    appendPaths(context.physicalConsentPath || context.physicalConsentPreview, 'Physical consent image', 'consent');
    appendPaths(context.queueSignaturePath, 'Queue signature', 'consent');
    appendPaths(context.bookingSignaturePath, 'Booking signature', 'consent');

    const seen = new Set();
    return uploads.filter(upload => {
        const key = `${upload.label}:${upload.url}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function buildInitialChiefComplaint(context) {
    const complaint = removeBookingMarker(context.complaint);
    const bookingNotes = String(context.bookingNotes || '').trim();
    const parts = [];

    if (complaint) {
        parts.push(complaint);
    }

    if (bookingNotes && !complaint.includes(bookingNotes)) {
        parts.push(`Booking notes: ${bookingNotes}`);
    }

    return parts.join('\n');
}

function normalizeContextValue(value) {
    if (value === null || value === undefined) return '';
    return String(value);
}

function extractBookingNumber(complaint) {
    const match = String(complaint || '').match(/\[Booking:\s*([^\]]+)\]/);
    return match ? match[1].trim() : '';
}

function removeBookingMarker(complaint) {
    return String(complaint || '').replace(/\[Booking:\s*[^\]]+\]\s*/g, '').trim();
}

function isVaccinationService(serviceName) {
    return /vaccin/i.test(String(serviceName || ''));
}

function hasVaccinationRecordContent(record) {
    return Object.values(record || {}).some(value => String(value || '').trim() !== '');
}

function mergeQueueContext(baseContext, queueItem) {
    if (!queueItem) return baseContext;

    const bookingNumber = queueItem.related_booking_number
        || baseContext.bookingNumber
        || extractBookingNumber(queueItem.complaint);

    return {
        ...baseContext,
        queueId: normalizeContextValue(queueItem.queue_id || baseContext.queueId),
        queueNumber: normalizeContextValue(queueItem.queue_number || baseContext.queueNumber),
        queueReference: queueItem.queue_reference || baseContext.queueReference || formatQueueReference(queueItem),
        bookingId: normalizeContextValue(queueItem.booking_id || baseContext.bookingId),
        bookingNumber: normalizeContextValue(bookingNumber),
        assignmentId: normalizeContextValue(queueItem.assignment_id || baseContext.assignmentId),
        petId: normalizeContextValue(queueItem.pet_id || baseContext.petId),
        petName: queueItem.pet_name || baseContext.petName || 'Unknown Pet',
        petSpecies: queueItem.pet_species || baseContext.petSpecies || '',
        petBreed: queueItem.pet_breed || baseContext.petBreed || '',
        petBirthDate: queueItem.pet_BDAY || baseContext.petBirthDate || '',
        petAge: queueItem.pet_age || baseContext.petAge || '',
        petGender: queueItem.pet_gender || baseContext.petGender || '',
        petWeight: queueItem.pet_weight || baseContext.petWeight || '',
        petStatus: queueItem.pet_status || baseContext.petStatus || '',
        petMicrochipId: normalizeContextValue(queueItem.pet_microchip || baseContext.petMicrochipId),
        petAllergies: queueItem.pet_allergies || baseContext.petAllergies || '',
        petColor: queueItem.pet_color_marking || baseContext.petColor || '',
        petProfileImage: queueItem.setpetImage_url || baseContext.petProfileImage || '',
        ownerUserId: normalizeContextValue(queueItem.user_id || baseContext.ownerUserId),
        ownerName: queueItem.owner_name
            || [queueItem.first_Name, queueItem.last_Name].filter(Boolean).join(' ').trim()
            || baseContext.ownerName
            || 'Unknown Owner',
        ownerPhone: queueItem.contactNumber || baseContext.ownerPhone || '',
        ownerAddress: queueItem.address || baseContext.ownerAddress || '',
        serviceName: queueItem.service_name || baseContext.serviceName || 'Queue',
        complaint: queueItem.complaint || baseContext.complaint || '',
        bookingNotes: queueItem.booking_notes || baseContext.bookingNotes || '',
        priority: queueItem.priority || baseContext.priority || '',
        queueSource: queueItem.queue_source || baseContext.queueSource || '',
        queueImagePath: queueItem.image_path || baseContext.queueImagePath || '',
        queueSignaturePath: queueItem.signiture_self_service_path || baseContext.queueSignaturePath || '',
        bookingConcernPaths: queueItem.booking_concern_paths || baseContext.bookingConcernPaths || '',
        bookingSignaturePath: queueItem.booking_signature_path || baseContext.bookingSignaturePath || '',
        signedConsentDocumentPath: combineUploadPathValues(baseContext.signedConsentDocumentPath, queueItem.signed_consent_document_path),
        signedConsentType: baseContext.signedConsentType || queueItem.signed_consent_type || '',
        signedConsentAt: baseContext.signedConsentAt || queueItem.signed_consent_at || '',
        physicalConsentPath: combineUploadPathValues(baseContext.physicalConsentPath, queueItem.physical_consent_path),
        physicalConsentPreview: baseContext.physicalConsentPreview || ''
    };
}

function cleanPrescription(prescription) {
    const times = Number(prescription.times);
    const durationNumber = Number(prescription.durationNumber);

    return {
        id: prescription.id || createId(),
        medicine: prescription.medicine || '',
        times: Number.isFinite(times) && times >= 0 ? times : 1,
        frequency: prescription.frequency || 'per day',
        durationNumber: Number.isFinite(durationNumber) && durationNumber >= 0 ? durationNumber : 0,
        durationUnit: prescription.durationUnit || 'week',
        instructions: prescription.instructions || ''
    };
}

function normalizeSavedAttachment(attachment) {
    return {
        id: attachment.id || createId(),
        name: attachment.name || pathFileName(attachment.url || attachment.relativeUrl),
        url: attachment.url || attachment.relativeUrl || '',
        relativeUrl: attachment.relativeUrl || attachment.url || '',
        mimeType: attachment.mimeType || attachment.type || '',
        uploadedAt: attachment.uploadedAt || '',
        category: attachment.category || attachment.attachmentCategory || 'diagnosis_upload'
    };
}

function normalizeConsentTemplate(file) {
    return {
        id: String(file.file_id || file.id || ''),
        title: file.file_name || file.title || 'Consent Form',
        content: file.content || '',
        category: file.category || 'General'
    };
}

function normalizeAdditionalConsent(attachment) {
    const normalized = normalizeSavedAttachment(attachment);

    return {
        ...normalized,
        category: ADDITIONAL_CONSENT_CATEGORY,
        templateId: attachment.templateId || attachment.template_id || attachment.consentTemplateId || '',
        title: attachment.title || attachment.consentTitle || normalized.name || 'Signed consent',
        content: attachment.content || attachment.consentContent || '',
        signerName: attachment.signerName || attachment.signer_name || '',
        signedAt: attachment.signedAt || attachment.signed_at || attachment.uploadedAt || '',
        signatureDataUrl: attachment.signatureDataUrl || '',
        signatureUrl: attachment.signatureUrl || attachment.url || attachment.relativeUrl || ''
    };
}

function buildDiagnosisDraftStorageKey(context, veterinarianUserId) {
    const vetKey = normalizeContextValue(veterinarianUserId || 'unknown-vet');
    const subjectKey = context.queueId
        ? `queue-${context.queueId}`
        : context.bookingId
            ? `booking-${context.bookingId}`
            : context.bookingNumber
                ? `booking-number-${context.bookingNumber}`
                : context.petId
                    ? `pet-${context.petId}`
                    : '';

    return subjectKey ? `${DIAGNOSIS_DRAFT_STORAGE_PREFIX}:${vetKey}:${subjectKey}` : '';
}

function readDiagnosisDraft(storageKey) {
    if (!storageKey) return null;

    try {
        const draft = JSON.parse(localStorage.getItem(storageKey) || 'null');
        return draft?.schemaVersion === DIAGNOSIS_DRAFT_SCHEMA_VERSION ? draft : null;
    } catch {
        return null;
    }
}

function persistDiagnosisDraft(storageKey, draft) {
    if (!storageKey || !draft) return;

    try {
        localStorage.setItem(storageKey, JSON.stringify(draft));
    } catch {
        // Large pending browser-only data, such as signatures, can exceed local storage.
    }
}

function clearDiagnosisDraft(storageKey) {
    if (!storageKey) return;

    try {
        localStorage.removeItem(storageKey);
    } catch {
        // Draft cleanup is best effort.
    }
}

function serializeAttachmentForDraft(attachment) {
    if (!attachment || attachment.file) return null;

    const preview = attachment.preview && !String(attachment.preview).startsWith('blob:')
        ? attachment.preview
        : '';
    const url = attachment.url || attachment.relativeUrl || '';

    if (!preview && !url) return null;

    return {
        id: attachment.id || createId(),
        name: attachment.name || pathFileName(url),
        url,
        relativeUrl: attachment.relativeUrl || attachment.url || '',
        mimeType: attachment.mimeType || attachment.type || '',
        uploadedAt: attachment.uploadedAt || '',
        category: attachment.category || attachment.attachmentCategory || 'diagnosis_upload',
        preview
    };
}

function serializeAdditionalConsentForDraft(consent) {
    if (!consent) return null;

    return {
        id: consent.id || createId(),
        name: consent.name || `Signed consent - ${consent.title || 'Consent Form'}`,
        url: consent.url || consent.relativeUrl || consent.signatureUrl || '',
        relativeUrl: consent.relativeUrl || consent.url || consent.signatureUrl || '',
        mimeType: consent.mimeType || 'image/png',
        uploadedAt: consent.uploadedAt || '',
        category: ADDITIONAL_CONSENT_CATEGORY,
        templateId: consent.templateId || '',
        title: consent.title || 'Consent Form',
        content: consent.content || '',
        signerName: consent.signerName || '',
        signedAt: consent.signedAt || '',
        signatureDataUrl: consent.signatureDataUrl || '',
        signatureUrl: consent.signatureUrl || consent.url || consent.relativeUrl || '',
        preview: consent.preview && !String(consent.preview).startsWith('blob:') ? consent.preview : consent.signatureDataUrl || ''
    };
}

function serializeCustomSectionForDraft(section) {
    return {
        id: section.id || createId(),
        serviceId: section.serviceId || '',
        label: section.label || '',
        value: section.value || '',
        majorSymptoms: section.majorSymptoms || '',
        prescription: Array.isArray(section.prescription) ? section.prescription.map(cleanPrescription) : [],
        prescriptionDraft: section.prescriptionDraft ? cleanPrescription(section.prescriptionDraft) : createPrescriptionDraft(),
        uploads: (section.uploads || []).map(serializeAttachmentForDraft).filter(Boolean)
    };
}

function normalizeDraftFormData(formData, context) {
    const complaint = buildInitialChiefComplaint(context);

    return {
        ...emptyDiagnosisForm,
        ...(formData || {}),
        chiefComplaint: formData?.chiefComplaint ?? complaint,
        majorSymptoms: formData?.majorSymptoms || complaint,
        vitalSigns: {
            ...emptyDiagnosisForm.vitalSigns,
            ...(formData?.vitalSigns || {})
        },
        prescription: Array.isArray(formData?.prescription)
            ? formData.prescription.map(cleanPrescription)
            : []
    };
}

function normalizeDraftCustomSection(section, context) {
    return {
        id: section.id || createId(),
        serviceId: section.serviceId || '',
        label: section.label || context.serviceName || '',
        value: section.value || '',
        majorSymptoms: section.majorSymptoms || buildInitialChiefComplaint(context),
        prescription: Array.isArray(section.prescription) ? section.prescription.map(cleanPrescription) : [],
        prescriptionDraft: section.prescriptionDraft ? cleanPrescription(section.prescriptionDraft) : createPrescriptionDraft(),
        uploads: Array.isArray(section.uploads) ? section.uploads.map(normalizeSavedAttachment) : []
    };
}

function formatSignedAt(value) {
    if (!value) return '';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleString();
}

function normalizeBoardingDocumentUpload(document) {
    return {
        id: `boarding-document-${document.documentId}`,
        label: document.title || 'Boarding document',
        source: 'boarding',
        name: document.fileName || pathFileName(document.documentPath || document.url),
        url: document.documentPath || document.url || '',
        mimeType: document.mimeType || '',
        bookingNumber: document.bookingNumber || '',
        createdAt: document.createdAt || ''
    };
}

export default function VetDiagnosis() {
    const navigate = useNavigate();
    const dashboardUser = useDashboardUser();
    const currentUser = useMemo(() => dashboardUser || getStoredUser(), [dashboardUser]);
    const veterinarianUserId = getUserId(currentUser);
    const veterinarianName = getUserName(currentUser);
    const [veterinarianLicense, setVeterinarianLicense] = useState(currentUser?.licenseNumber || currentUser?.prc_license_number || '');
    const generalFileInputRef = useRef(null);
    const referenceFileInputRef = useRef(null);
    const skipNextDraftPersistRef = useRef(false);
    const initialContext = useMemo(readDiagnosisContext, []);
    const initialDraftStorageKey = useMemo(
        () => buildDiagnosisDraftStorageKey(initialContext, veterinarianUserId),
        [initialContext, veterinarianUserId]
    );
    const initialDraft = useMemo(() => readDiagnosisDraft(initialDraftStorageKey), [initialDraftStorageKey]);
    const [context, setContext] = useState(initialContext);
    const draftStorageKey = useMemo(
        () => buildDiagnosisDraftStorageKey(context, veterinarianUserId),
        [context, veterinarianUserId]
    );
    const sourceUploads = useMemo(() => buildSourceUploads(context), [context]);
    const consentUploads = useMemo(() => buildSignedConsentUploads(context), [context]);
    const contextIsVaccination = useMemo(() => isVaccinationService(context.serviceName), [context.serviceName]);
    const [boardingDocuments, setBoardingDocuments] = useState([]);
    const boardingDocumentUploads = useMemo(() => boardingDocuments.map(normalizeBoardingDocumentUpload), [boardingDocuments]);
    const allSourceUploads = useMemo(() => [
        ...sourceUploads,
        ...consentUploads,
        ...boardingDocumentUploads
    ], [boardingDocumentUploads, consentUploads, sourceUploads]);

    const [diagnosisType, setDiagnosisType] = useState(() => initialDraft?.diagnosisType || 'general');
    const [formData, setFormData] = useState(() => (
        initialDraft?.formData
            ? normalizeDraftFormData(initialDraft.formData, initialContext)
            : {
                ...emptyDiagnosisForm,
                chiefComplaint: buildInitialChiefComplaint(initialContext),
                vitalSigns: {
                    ...emptyDiagnosisForm.vitalSigns,
                    weight: initialContext.petWeight || ''
                }
            }
    ));
    const [currentPrescription, setCurrentPrescription] = useState(() => (
        initialDraft?.currentPrescription
            ? cleanPrescription(initialDraft.currentPrescription)
            : createPrescriptionDraft()
    ));
    const [customFields, setCustomFields] = useState(() => (
        Array.isArray(initialDraft?.customFields) && initialDraft.customFields.length > 0
            ? initialDraft.customFields.map(section => normalizeDraftCustomSection(section, initialContext))
            : []
    ));
    const [uploadedImages, setUploadedImages] = useState(() => (
        Array.isArray(initialDraft?.uploadedImages)
            ? initialDraft.uploadedImages.map(normalizeSavedAttachment)
            : []
    ));
    const [isSaving, setIsSaving] = useState(false);
    const [isLoadingRecord, setIsLoadingRecord] = useState(false);
    const [loadedDiagnosisId, setLoadedDiagnosisId] = useState(() => initialDraft?.loadedDiagnosisId || null);
    const [schemaWarning, setSchemaWarning] = useState('');
    const [previewImage, setPreviewImage] = useState(null);
    const [isLoadingContext, setIsLoadingContext] = useState(Boolean(initialContext.queueId || initialContext.bookingId || initialContext.bookingNumber));
    const [consentTemplates, setConsentTemplates] = useState([]);
    const [isLoadingConsentTemplates, setIsLoadingConsentTemplates] = useState(false);
    const [consentDraft, setConsentDraft] = useState(() => ({
        templateId: initialDraft?.consentDraft?.templateId || '',
        signature: initialDraft?.consentDraft?.signature || null
    }));
    const [additionalConsents, setAdditionalConsents] = useState(() => (
        Array.isArray(initialDraft?.additionalConsents)
            ? initialDraft.additionalConsents.map(normalizeAdditionalConsent)
            : []
    ));
    const consentFormsForDisplay = useMemo(() => additionalConsents, [additionalConsents]);
    const [shouldRecordVaccination, setShouldRecordVaccination] = useState(() => Boolean(initialDraft?.shouldRecordVaccination));
    const [vaccinationRecord, setVaccinationRecord] = useState(() => ({
        ...emptyVaccinationRecord,
        ...(initialDraft?.vaccinationRecord || {}),
        veterinarianName: initialDraft?.vaccinationRecord?.veterinarianName || veterinarianName,
        veterinarianLicense: initialDraft?.vaccinationRecord?.veterinarianLicense || currentUser?.licenseNumber || currentUser?.prc_license_number || ''
    }));
    const [serviceCatalog, setServiceCatalog] = useState([]);
    const [selectedServiceId, setSelectedServiceId] = useState(() => initialDraft?.selectedServiceId || '');
    const [selectedCustomServiceId, setSelectedCustomServiceId] = useState(() => initialDraft?.selectedCustomServiceId || '');
    const [visitCharges, setVisitCharges] = useState(() => (
        Array.isArray(initialDraft?.visitCharges) ? initialDraft.visitCharges : []
    ));
    const [billingSchemaMessage, setBillingSchemaMessage] = useState('');
    const [isDraftReady, setIsDraftReady] = useState(() => Boolean(initialDraft));

    const hydrateDiagnosisRecord = useCallback((record) => {
        setLoadedDiagnosisId(record.diagnosisId || record.id || null);
        setDiagnosisType(record.diagnosisType || 'general');
        setFormData({
            ...emptyDiagnosisForm,
            chiefComplaint: record.chiefComplaint || buildInitialChiefComplaint(context),
            majorSymptoms: record.majorSymptoms || '',
            symptoms: record.symptoms || '',
            physicalExam: record.physicalExam || '',
            diagnosis: record.diagnosis || '',
            treatment: record.treatment || '',
            labResults: record.labResults || '',
            followUp: record.followUp || '',
            notes: record.notes || '',
            vitalSigns: {
                ...emptyDiagnosisForm.vitalSigns,
                ...(record.vitalSigns || {})
            },
            prescription: Array.isArray(record.prescriptions) ? record.prescriptions.map(cleanPrescription) : []
        });
        setCurrentPrescription(createPrescriptionDraft());
        const savedAttachments = Array.isArray(record.attachments) ? record.attachments : [];
        setUploadedImages(savedAttachments
            .filter(attachment => attachment.category !== ADDITIONAL_CONSENT_CATEGORY)
            .map(normalizeSavedAttachment));
        setAdditionalConsents(savedAttachments
            .filter(attachment => attachment.category === ADDITIONAL_CONSENT_CATEGORY)
            .map(normalizeAdditionalConsent));

        const sections = Array.isArray(record.customSections) ? record.customSections : [];
        setCustomFields(sections.length > 0
            ? sections.map(section => ({
                id: section.id || createId(),
                serviceId: section.serviceId || section.service_id || '',
                label: section.label || section.serviceName || '',
                value: section.value || section.notes || '',
                majorSymptoms: section.majorSymptoms || buildInitialChiefComplaint(context),
                prescription: Array.isArray(section.prescriptions)
                    ? section.prescriptions.map(cleanPrescription)
                    : Array.isArray(section.prescription)
                        ? section.prescription.map(cleanPrescription)
                        : [],
                prescriptionDraft: createPrescriptionDraft(),
                uploads: Array.isArray(section.attachments)
                    ? section.attachments.map(normalizeSavedAttachment)
                    : Array.isArray(section.uploads)
                        ? section.uploads.map(normalizeSavedAttachment)
                        : []
            }))
            : []
        );

        if (record.vaccinationRecord) {
            setShouldRecordVaccination(true);
            setVaccinationRecord({
                ...emptyVaccinationRecord,
                vaccineName: record.vaccinationRecord.vaccineName || record.vaccinationRecord.name || '',
                dateAdministered: record.vaccinationRecord.dateAdministered || record.vaccinationRecord.date || '',
                nextDueDate: record.vaccinationRecord.nextDueDate || record.vaccinationRecord.nextDue || '',
                veterinarianName: record.vaccinationRecord.veterinarianName || record.vaccinationRecord.applicator || veterinarianName,
                veterinarianLicense: record.vaccinationRecord.veterinarianLicense || veterinarianLicense,
                notes: record.vaccinationRecord.notes || ''
            });
        }
    }, [context, veterinarianLicense, veterinarianName]);

    useEffect(() => {
        const loadVetProfile = async () => {
            if (!veterinarianUserId) return;

            try {
                const data = await fetchProfile({
                    userId: veterinarianUserId,
                    role: currentUser?.role || 'Veterinarian'
                });
                setVeterinarianLicense(data.prc_license_number || data.licenseNumber || '');
            } catch {
                setVeterinarianLicense(currentUser?.licenseNumber || currentUser?.prc_license_number || '');
            }
        };

        loadVetProfile();
    }, [currentUser, veterinarianUserId]);

    useEffect(() => {
        let isActive = true;

        const loadServiceCatalog = async () => {
            try {
                const data = await fetchServiceCatalog();

                if (!isActive) return;

                if (data.schemaReady === false) {
                    setBillingSchemaMessage(data.message || 'Service catalog migration is required before visit charges can be saved.');
                    setServiceCatalog([]);
                    return;
                }

                setBillingSchemaMessage('');
                setServiceCatalog((Array.isArray(data.services) ? data.services : []).filter(service => service.isActive));
            } catch (error) {
                if (isActive) {
                    setBillingSchemaMessage(error.message || 'Failed to load service catalog.');
                }
            }
        };

        loadServiceCatalog();

        return () => {
            isActive = false;
        };
    }, []);

    useEffect(() => {
        let isActive = true;

        const loadConsentTemplates = async () => {
            setIsLoadingConsentTemplates(true);

            try {
                const data = await fetchConsentFiles();
                if (!isActive) return;

                const templates = Array.isArray(data) ? data.map(normalizeConsentTemplate).filter(template => template.id) : [];
                setConsentTemplates(templates);
                setConsentDraft(current => ({
                    ...current,
                    templateId: current.templateId || templates[0]?.id || ''
                }));
            } catch (error) {
                if (isActive) {
                    setConsentTemplates([]);
                    toast.error(error.message || 'Failed to load consent templates.');
                }
            } finally {
                if (isActive) {
                    setIsLoadingConsentTemplates(false);
                }
            }
        };

        loadConsentTemplates();

        return () => {
            isActive = false;
        };
    }, []);

    useEffect(() => {
        if (!context.petId) {
            setBoardingDocuments([]);
            return undefined;
        }

        let isActive = true;

        const loadBoardingDocuments = async () => {
            try {
                const data = await fetchBoardingDocuments({ petId: context.petId });

                if (!isActive) return;

                if (data.schemaReady !== false) {
                    setBoardingDocuments(Array.isArray(data.documents) ? data.documents : []);
                }
            } catch {
                if (isActive) {
                    setBoardingDocuments([]);
                }
            }
        };

        loadBoardingDocuments();

        return () => {
            isActive = false;
        };
    }, [context.petId]);

    useEffect(() => {
        setVaccinationRecord(current => ({
            ...current,
            veterinarianName: current.veterinarianName || veterinarianName,
            veterinarianLicense: current.veterinarianLicense || veterinarianLicense
        }));
    }, [veterinarianLicense, veterinarianName]);

    useEffect(() => {
        if (!initialContext.queueId && !initialContext.bookingId && !initialContext.bookingNumber) {
            setIsLoadingContext(false);
            return undefined;
        }

        let isActive = true;
        const previousComplaint = buildInitialChiefComplaint(initialContext);

        const loadLiveQueueContext = async () => {
            setIsLoadingContext(true);

            try {
                const data = await fetchQueues();

                if (!isActive || !Array.isArray(data)) return;

                const queueItem = data.find(item =>
                    (initialContext.queueId && String(item.queue_id) === String(initialContext.queueId))
                    || (initialContext.bookingId && String(item.booking_id || '') === String(initialContext.bookingId))
                    || (initialContext.bookingNumber && String(item.related_booking_number || extractBookingNumber(item.complaint)) === String(initialContext.bookingNumber))
                );

                if (!queueItem) return;

                const nextContext = mergeQueueContext(initialContext, queueItem);
                setContext(nextContext);

                try {
                    sessionStorage.setItem(DIAGNOSIS_CONTEXT_KEY, JSON.stringify(nextContext));
                } catch {
                    // Context refresh is best effort; the live state is already updated.
                }

                const nextComplaint = buildInitialChiefComplaint(nextContext);
                setFormData(current => {
                    const currentComplaint = current.chiefComplaint.trim();
                    if (loadedDiagnosisId) {
                        return current;
                    }

                    const shouldUpdateComplaint = !currentComplaint || currentComplaint === previousComplaint.trim();
                    const currentMajorSymptoms = current.majorSymptoms.trim();
                    const shouldUpdateMajorSymptoms = !currentMajorSymptoms || currentMajorSymptoms === previousComplaint.trim();
                    const nextVitalSigns = {
                        ...current.vitalSigns,
                        weight: current.vitalSigns.weight || nextContext.petWeight || ''
                    };

                    return {
                        ...current,
                        chiefComplaint: shouldUpdateComplaint ? nextComplaint : current.chiefComplaint,
                        majorSymptoms: shouldUpdateMajorSymptoms ? nextComplaint : current.majorSymptoms,
                        vitalSigns: nextVitalSigns
                    };
                });

                setCustomFields(current => {
                    if (current.length !== 1 || current[0].label.trim() !== initialContext.serviceName.trim()) {
                        return current;
                    }

                    return [{ ...current[0], label: nextContext.serviceName, majorSymptoms: current[0].majorSymptoms || nextComplaint }];
                });
            } catch (error) {
                if (isActive) {
                    toast.error(error.message || 'Failed to load queue details.');
                }
            } finally {
                if (isActive) {
                    setIsLoadingContext(false);
                }
            }
        };

        loadLiveQueueContext();

        return () => {
            isActive = false;
        };
    }, [initialContext, loadedDiagnosisId]);

    useEffect(() => {
        if (!context.queueId && !context.petId) {
            return undefined;
        }

        let isActive = true;
        const loadExistingRecord = async () => {
            setIsLoadingRecord(true);

            try {
                const data = await fetchVetDiagnoses(
                    context.queueId ? { queueId: context.queueId } : { petId: context.petId }
                );

                if (!isActive) return;

                if (data.schemaReady === false) {
                    setSchemaWarning(data.message || 'Diagnosis table is not ready.');
                    return;
                }

                const record = Array.isArray(data.records) ? data.records[0] : null;
                if (record) {
                    const savedDraft = readDiagnosisDraft(draftStorageKey);

                    if (savedDraft) {
                        setLoadedDiagnosisId(current => current || record.diagnosisId || record.id || null);
                    } else {
                        hydrateDiagnosisRecord(record);
                    }
                }
            } catch (error) {
                if (isActive && context.mode === 'view') {
                    toast.error(error.message || 'Failed to load diagnosis record.');
                }
            } finally {
                if (isActive) {
                    setIsLoadingRecord(false);
                    setIsDraftReady(true);
                }
            }
        };

        loadExistingRecord();

        return () => {
            isActive = false;
        };
    }, [context.mode, context.petId, context.queueId, draftStorageKey, hydrateDiagnosisRecord]);

    useEffect(() => {
        if (context.queueId || context.petId) return;
        setIsDraftReady(true);
    }, [context.petId, context.queueId]);

    useEffect(() => {
        if (!isDraftReady || isSaving || !draftStorageKey) return;

        if (skipNextDraftPersistRef.current) {
            skipNextDraftPersistRef.current = false;
            return;
        }

        const draft = {
            schemaVersion: DIAGNOSIS_DRAFT_SCHEMA_VERSION,
            updatedAt: new Date().toISOString(),
            contextSnapshot: context,
            loadedDiagnosisId,
            diagnosisType,
            formData: {
                ...formData,
                prescription: formData.prescription.map(cleanPrescription)
            },
            currentPrescription: cleanPrescription(currentPrescription),
            customFields: customFields.map(serializeCustomSectionForDraft),
            uploadedImages: uploadedImages.map(serializeAttachmentForDraft).filter(Boolean),
            consentDraft: {
                templateId: consentDraft.templateId || '',
                signature: consentDraft.signature || null
            },
            additionalConsents: additionalConsents.map(serializeAdditionalConsentForDraft).filter(Boolean),
            shouldRecordVaccination,
            vaccinationRecord,
            selectedServiceId,
            selectedCustomServiceId,
            visitCharges
        };

        persistDiagnosisDraft(draftStorageKey, draft);
    }, [
        additionalConsents,
        consentDraft,
        context,
        currentPrescription,
        customFields,
        diagnosisType,
        draftStorageKey,
        formData,
        isDraftReady,
        isSaving,
        loadedDiagnosisId,
        selectedCustomServiceId,
        selectedServiceId,
        shouldRecordVaccination,
        uploadedImages,
        vaccinationRecord,
        visitCharges
    ]);

    const updateForm = (field, value) => {
        setFormData(current => ({ ...current, [field]: value }));
    };

    const updateVitalSign = (field, value) => {
        setFormData(current => ({
            ...current,
            vitalSigns: {
                ...current.vitalSigns,
                [field]: value
            }
        }));
    };

    const addPrescription = () => {
        const cleaned = cleanPrescription(currentPrescription);
        if (!cleaned.medicine.trim()) {
            toast.error('Please enter or select a medicine before adding a prescription.');
            return;
        }

        setFormData(current => ({
            ...current,
            prescription: [...current.prescription, cleaned]
        }));
        setCurrentPrescription(createPrescriptionDraft());
    };

    const removePrescription = (id) => {
        setFormData(current => ({
            ...current,
            prescription: current.prescription.filter(item => item.id !== id)
        }));
    };

    const updateCustomField = (id, field, value) => {
        setCustomFields(current =>
            current.map(item => item.id === id ? { ...item, [field]: value } : item)
        );
    };

    const updateCustomPrescriptionDraft = (id, updater) => {
        setCustomFields(current =>
            current.map(item => {
                if (item.id !== id) return item;
                const nextDraft = typeof updater === 'function'
                    ? updater(item.prescriptionDraft || createPrescriptionDraft())
                    : updater;

                return { ...item, prescriptionDraft: nextDraft };
            })
        );
    };

    const addCustomPrescription = (id) => {
        setCustomFields(current =>
            current.map(item => {
                if (item.id !== id) return item;

                const cleaned = cleanPrescription(item.prescriptionDraft || createPrescriptionDraft());
                if (!cleaned.medicine.trim()) {
                    toast.error('Please enter or select a medicine before adding a prescription.');
                    return item;
                }

                return {
                    ...item,
                    prescription: [...item.prescription, cleaned],
                    prescriptionDraft: createPrescriptionDraft()
                };
            })
        );
    };

    const removeCustomPrescription = (fieldId, prescriptionId) => {
        setCustomFields(current =>
            current.map(item =>
                item.id === fieldId
                    ? { ...item, prescription: item.prescription.filter(prescription => prescription.id !== prescriptionId) }
                    : item
            )
        );
    };

    const removeCustomField = (id) => {
        setCustomFields(current => {
            const field = current.find(item => item.id === id);
            field?.uploads?.forEach(revokeAttachmentPreview);
            return current.filter(item => item.id !== id);
        });
    };

    const createPendingAttachments = (files, category = 'diagnosis_upload') => {
        return files.map(file => ({
            id: createId(),
            name: file.name,
            file,
            mimeType: file.type,
            preview: URL.createObjectURL(file),
            category
        }));
    };

    const handleImageUpload = (event) => {
        const files = Array.from(event.target.files || []);
        if (files.length === 0) return;

        setUploadedImages(current => [...current, ...createPendingAttachments(files, 'diagnosis_upload')]);
        event.target.value = '';
    };

    const handleReferenceUpload = (event) => {
        const files = Array.from(event.target.files || []);
        if (files.length === 0) return;

        setUploadedImages(current => [...current, ...createPendingAttachments(files, 'reference_document')]);
        event.target.value = '';
    };

    const handleCustomUpload = (id, event) => {
        const files = Array.from(event.target.files || []);
        if (files.length === 0) return;

        setCustomFields(current =>
            current.map(item =>
                item.id === id
                    ? { ...item, uploads: [...item.uploads, ...createPendingAttachments(files)] }
                    : item
            )
        );
        event.target.value = '';
    };

    const removeGeneralAttachment = (id) => {
        setUploadedImages(current => {
            const attachment = current.find(item => item.id === id);
            revokeAttachmentPreview(attachment);
            return current.filter(item => item.id !== id);
        });
    };

    const removeCustomAttachment = (fieldId, attachmentId) => {
        setCustomFields(current =>
            current.map(item => {
                if (item.id !== fieldId) return item;
                const attachment = item.uploads.find(upload => upload.id === attachmentId);
                revokeAttachmentPreview(attachment);

                return { ...item, uploads: item.uploads.filter(upload => upload.id !== attachmentId) };
            })
        );
    };

    const revokeAttachmentPreview = (attachment) => {
        if (attachment?.preview?.startsWith('blob:')) {
            URL.revokeObjectURL(attachment.preview);
        }
    };

    const goBackToMyList = () => {
        navigate('/dashboard/vet/my-list');
    };

    const uploadDiagnosisAttachment = async (attachment) => {
        if (!attachment.file) {
            return normalizeSavedAttachment(attachment);
        }

        const formDataUpload = new FormData();
        formDataUpload.append('image', attachment.file);
        formDataUpload.append('type', 'diagnosis');

        const result = await uploadFormData(formDataUpload);

        return {
            id: attachment.id,
            name: attachment.name,
            url: result.relative_url || result.url || '',
            relativeUrl: result.relative_url || result.url || '',
            mimeType: attachment.mimeType || '',
            uploadedAt: new Date().toISOString(),
            category: attachment.category || 'diagnosis_upload'
        };
    };

    const uploadAttachmentList = async (attachments) => {
        return Promise.all((attachments || []).map(uploadDiagnosisAttachment));
    };

    const uploadAdditionalConsentList = async (consents) => {
        const uploaded = [];

        for (const consent of consents || []) {
            let signatureUrl = consent.signatureUrl || consent.url || consent.relativeUrl || '';

            if (consent.signatureDataUrl?.startsWith('data:image')) {
                signatureUrl = await uploadDataUrlImage(consent.signatureDataUrl, 'booking_signature', 'diagnosis_consent');
            }

            uploaded.push({
                id: consent.id || createId(),
                name: consent.name || `Signed consent - ${consent.title || 'Consent Form'}`,
                url: signatureUrl,
                relativeUrl: signatureUrl,
                mimeType: 'image/png',
                uploadedAt: consent.uploadedAt || new Date().toISOString(),
                category: ADDITIONAL_CONSENT_CATEGORY,
                templateId: consent.templateId || '',
                title: consent.title || 'Consent Form',
                content: consent.content || '',
                signerName: consent.signerName || context.ownerName || 'Pet owner',
                signedAt: consent.signedAt || new Date().toISOString(),
                signatureUrl
            });
        }

        return uploaded;
    };

    const diagnosisAttachments = useMemo(
        () => uploadedImages.filter(attachment => attachment.category !== 'reference_document'),
        [uploadedImages]
    );
    const referenceAttachments = useMemo(
        () => uploadedImages.filter(attachment => attachment.category === 'reference_document'),
        [uploadedImages]
    );
    const selectedConsentTemplate = useMemo(
        () => consentTemplates.find(template => template.id === consentDraft.templateId) || null,
        [consentDraft.templateId, consentTemplates]
    );

    const addAdditionalConsent = () => {
        if (!selectedConsentTemplate) {
            toast.error('Select a consent form first.');
            return;
        }

        if (!consentDraft.signature) {
            toast.error('Pet owner signature is required for the selected consent form.');
            return;
        }

        const signedAt = new Date().toISOString();
        const title = selectedConsentTemplate.title || 'Consent Form';

        setAdditionalConsents(current => [
            ...current,
            {
                id: createId(),
                name: `Signed consent - ${title}`,
                category: ADDITIONAL_CONSENT_CATEGORY,
                templateId: selectedConsentTemplate.id,
                title,
                content: selectedConsentTemplate.content,
                signerName: context.ownerName || 'Pet owner',
                signedAt,
                signatureDataUrl: consentDraft.signature,
                preview: consentDraft.signature,
                mimeType: 'image/png'
            }
        ]);
        setConsentDraft(current => ({ ...current, signature: null }));
    };

    const removeAdditionalConsent = (id) => {
        setAdditionalConsents(current => current.filter(consent => consent.id !== id));
    };

    const cleanCustomSectionsForSave = async (fields = customFields) => {
        const sections = fields.filter(field =>
            field.label.trim()
            || field.value.trim()
            || field.majorSymptoms.trim()
            || field.prescription.length > 0
            || field.uploads.length > 0
        );

        const uploadedSections = [];
        for (const section of sections) {
            uploadedSections.push({
                id: section.id,
                serviceId: section.serviceId || null,
                label: section.label.trim(),
                value: section.value.trim(),
                majorSymptoms: section.majorSymptoms.trim(),
                prescriptions: section.prescription.map(cleanPrescription),
                attachments: await uploadAttachmentList(section.uploads)
            });
        }

        return uploadedSections;
    };

    const selectedCatalogService = useMemo(
        () => serviceCatalog.find(service => String(service.serviceId) === String(selectedServiceId)),
        [selectedServiceId, serviceCatalog]
    );
    const customDiagnosisServiceOptions = useMemo(
        () => serviceCatalog.filter(isCustomDiagnosisCatalogService),
        [serviceCatalog]
    );
    const selectedCustomService = useMemo(
        () => customDiagnosisServiceOptions.find(service => String(service.serviceId) === String(selectedCustomServiceId)),
        [customDiagnosisServiceOptions, selectedCustomServiceId]
    );

    const visitChargesTotal = useMemo(() => (
        visitCharges.reduce((total, charge) => total + ((Number(charge.quantity) || 0) * (Number(charge.unitPrice) || 0)), 0)
    ), [visitCharges]);

    const buildVisitChargeLinesForService = (service) => {
        const serviceChargeId = createId();
        const materialCharges = (service.materials || []).map((material) => ({
            id: createId(),
            chargeType: 'consumable',
            serviceId: service.serviceId,
            itemId: material.itemId,
            description: `${material.itemName}${material.billablePolicy === 'included' ? ' (included)' : ''}`,
            quantity: Number(material.qtyUsed) || 1,
            unitPrice: 0,
            billablePolicy: material.billablePolicy,
            createdByUserId: veterinarianUserId || null
        }));

        return [
            {
                id: serviceChargeId,
                chargeType: 'service',
                serviceId: service.serviceId,
                itemId: null,
                description: service.serviceName,
                quantity: 1,
                unitPrice: Number(service.basePrice) || 0,
                billablePolicy: 'separate',
                createdByUserId: veterinarianUserId || null
            },
            ...materialCharges
        ];
    };

    const addServiceVisitCharge = () => {
        if (!selectedCatalogService) {
            toast.error('Select a catalog service first.');
            return;
        }

        setVisitCharges(current => [
            ...current,
            ...buildVisitChargeLinesForService(selectedCatalogService)
        ]);
        setSelectedServiceId('');
    };

    const addCustomField = () => {
        if (billingSchemaMessage) {
            toast.error(billingSchemaMessage);
            return;
        }

        if (!selectedCustomService) {
            toast.error('Select a catalog service for the custom diagnosis block.');
            return;
        }

        const complaint = buildInitialChiefComplaint(context);
        setCustomFields(current => [
            ...current,
            createCustomSection(selectedCustomService.serviceName, selectedCustomService.serviceId, complaint)
        ]);
        setVisitCharges(current => [
            ...current,
            ...buildVisitChargeLinesForService(selectedCustomService)
        ]);
        setSelectedCustomServiceId('');
    };

    const updateVisitCharge = (id, field, value) => {
        setVisitCharges(current =>
            current.map(charge => charge.id === id ? { ...charge, [field]: value } : charge)
        );
    };

    const removeVisitCharge = (id) => {
        setVisitCharges(current => current.filter(charge => charge.id !== id));
    };

    const buildVisitChargesPayload = (charges = visitCharges) => {
        return charges
            .filter(charge => String(charge.description || '').trim() !== '')
            .map(charge => ({
                chargeType: charge.chargeType,
                serviceId: charge.serviceId || null,
                itemId: charge.itemId || null,
                description: charge.description,
                quantity: Number(charge.quantity) || 1,
                unitPrice: Number(charge.unitPrice) || 0,
                createdByUserId: veterinarianUserId || null
            }));
    };

    const printablePrescriptionPayload = useMemo(() => {
        const generalPrescriptions = diagnosisType === 'general'
            ? formData.prescription.map(cleanPrescription)
            : [];
        const customSectionsForPrint = diagnosisType === 'custom'
            ? customFields.map(field => ({
                label: field.label || 'Custom Diagnosis',
                value: field.value || '',
                majorSymptoms: field.majorSymptoms || '',
                prescriptions: field.prescription.map(cleanPrescription)
            }))
            : [];
        const diagnosisText = diagnosisType === 'general'
            ? formData.diagnosis
            : customSectionsForPrint
                .map(section => `${section.label}: ${section.value || section.majorSymptoms || ''}`.trim())
                .filter(Boolean)
                .join('\n');

        return {
            diagnosisText,
            notes: formData.notes,
            rows: collectPrescriptionRows(generalPrescriptions, customSectionsForPrint)
        };
    }, [customFields, diagnosisType, formData.diagnosis, formData.notes, formData.prescription]);

    const hasPrintablePrescriptions = printablePrescriptionPayload.rows.length > 0;

    const printPrescriptionFromCurrentForm = () => {
        if (!hasPrintablePrescriptions) {
            toast.error('Add at least one prescription before printing.');
            return;
        }

        try {
            printHtmlDocument(buildPrescriptionPrintHtml({
                context,
                veterinarianName,
                veterinarianLicense,
                ...printablePrescriptionPayload
            }));
        } catch (error) {
            toast.error(error.message || 'Could not print prescription.');
        }
    };

    const handleSaveDiagnosis = async ({ printAfterSave = false, stayAfterSave = false } = {}) => {
        if (!veterinarianUserId) {
            toast.error('Could not identify the current veterinarian account.');
            return false;
        }

        if (!context.petId) {
            toast.error('Missing pet information for this diagnosis.');
            return false;
        }

        if (diagnosisType === 'general' && !formData.diagnosis.trim()) {
            toast.error('Please enter a diagnosis before saving.');
            return false;
        }

        const autoAddedCustomSection = diagnosisType === 'custom' && selectedCustomService
            ? createCustomSection(selectedCustomService.serviceName, selectedCustomService.serviceId, buildInitialChiefComplaint(context))
            : null;
        const effectiveCustomFields = autoAddedCustomSection
            ? [...customFields, autoAddedCustomSection]
            : customFields;
        const effectiveVisitCharges = autoAddedCustomSection
            ? [...visitCharges, ...buildVisitChargeLinesForService(selectedCustomService)]
            : visitCharges;

        const hasCustomDetails = effectiveCustomFields.some(field =>
            field.label.trim()
            || field.value.trim()
            || field.majorSymptoms.trim()
            || field.prescription.length > 0
            || field.uploads.length > 0
        );

        if (diagnosisType === 'custom' && !hasCustomDetails) {
            toast.error('Please enter at least one custom diagnosis service.');
            return false;
        }

        const hasVaccinationDetails = hasVaccinationRecordContent(vaccinationRecord);
        const shouldSaveVaccinationRecord = shouldRecordVaccination && hasVaccinationDetails;
        if (shouldRecordVaccination && hasVaccinationDetails && (!vaccinationRecord.vaccineName.trim() || !vaccinationRecord.dateAdministered || !vaccinationRecord.nextDueDate)) {
            toast.error('Vaccine name, date administered, and next due date are required for vaccination records.');
            return false;
        }

        setIsSaving(true);

        try {
            if (billingSchemaMessage) {
                throw new Error(billingSchemaMessage);
            }

            if (autoAddedCustomSection) {
                setCustomFields(effectiveCustomFields);
                setVisitCharges(effectiveVisitCharges);
                setSelectedCustomServiceId('');
            }

            const visitChargesPayload = buildVisitChargesPayload(effectiveVisitCharges);
            const attachments = (await uploadAttachmentList(uploadedImages))
                .filter(attachment => attachment.category !== 'prescription_document');
            const signedConsents = await uploadAdditionalConsentList(additionalConsents);
            const customSections = diagnosisType === 'custom' ? await cleanCustomSectionsForSave(effectiveCustomFields) : [];
            const generalPrescriptions = formData.prescription.map(cleanPrescription);
            const prescriptionDocument = await uploadPrescriptionDocument({
                context,
                veterinarianName,
                veterinarianLicense,
                diagnosisText: diagnosisType === 'general'
                    ? formData.diagnosis
                    : customSections.map(section => `${section.label}: ${section.value || section.majorSymptoms || ''}`).join('\n'),
                notes: formData.notes,
                generalPrescriptions,
                customSections
            });
            const diagnosisAttachments = prescriptionDocument
                ? [...attachments, ...signedConsents, prescriptionDocument]
                : [...attachments, ...signedConsents];

            const data = await createVetDiagnosis({
                queue_id: context.queueId || null,
                booking_id: context.bookingId || null,
                assignment_id: context.assignmentId || null,
                pet_id: context.petId,
                owner_user_id: context.ownerUserId || null,
                veterinarian_user_id: veterinarianUserId,
                veterinarian_name: veterinarianName,
                diagnosis_type: diagnosisType,
                service_name: context.serviceName,
                chief_complaint: formData.chiefComplaint,
                major_symptoms: formData.majorSymptoms,
                symptoms: formData.symptoms,
                physical_exam: formData.physicalExam,
                diagnosis: diagnosisType === 'general' ? formData.diagnosis : null,
                treatment: formData.treatment,
                lab_results: formData.labResults,
                follow_up_date: formData.followUp || null,
                notes: formData.notes,
                vital_signs: formData.vitalSigns,
                prescriptions: generalPrescriptions,
                custom_sections: customSections,
                attachments: diagnosisAttachments,
                source_uploads: allSourceUploads,
                visit_charges: visitChargesPayload,
                vaccination_record: shouldSaveVaccinationRecord
                    ? {
                        ...vaccinationRecord,
                        veterinarianName: vaccinationRecord.veterinarianName || veterinarianName,
                        veterinarianLicense: vaccinationRecord.veterinarianLicense || veterinarianLicense
                    }
                    : null
            });

            if (!data.success) {
                throw new Error(data.message || 'Failed to save diagnosis.');
            }

            if (data.diagnosis) {
                hydrateDiagnosisRecord(data.diagnosis);
            }

            skipNextDraftPersistRef.current = true;
            clearDiagnosisDraft(draftStorageKey);
            toast.success('Diagnosis saved and patient marked done.');
            if (printAfterSave) {
                printPrescriptionFromCurrentForm();
            }
            if (!stayAfterSave) {
                goBackToMyList();
            }
            return true;
        } catch (error) {
            toast.error(error.message || 'Failed to save diagnosis.');
            return false;
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveAndPrintPrescription = async () => {
        if (!hasPrintablePrescriptions) {
            toast.error('Add at least one prescription before printing.');
            return;
        }

        await handleSaveDiagnosis({ printAfterSave: true, stayAfterSave: true });
    };

    const handleCancel = () => {
        if (window.confirm('Cancel this diagnosis? Unsaved changes will be lost.')) {
            clearDiagnosisDraft(draftStorageKey);
            goBackToMyList();
        }
    };

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <Button type="button" variant="ghost" onClick={goBackToMyList} className="w-fit gap-2">
                        <ArrowLeft className="size-4" />
                        Back to My List
                    </Button>
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-2xl font-bold text-[#101828]">Diagnosis Form</h2>
                            {loadedDiagnosisId && (
                                <Badge className="border-0 bg-green-50 text-green-700">Saved Record #{loadedDiagnosisId}</Badge>
                            )}
                        </div>
                        <p className="text-sm font-semibold text-slate-500">
                            {context.petName} - Owner: {context.ownerName}
                        </p>
                    </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="rounded-lg bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700">
                        {context.serviceName}
                    </div>
                    <DiagnosisContextSidebar
                        context={context}
                        sourceUploads={sourceUploads}
                        consentUploads={consentUploads}
                        additionalConsents={additionalConsents}
                        consentForms={consentFormsForDisplay}
                        boardingDocumentUploads={boardingDocumentUploads}
                        onPreview={setPreviewImage}
                    />
                </div>
            </div>

            {schemaWarning && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
                    {schemaWarning}
                </div>
            )}

            {isLoadingRecord && (
                <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-500">
                    <Loader2 className="mr-2 inline size-4 animate-spin text-[#155dfc]" />
                    Loading saved diagnosis details...
                </div>
            )}

            {isLoadingContext && (
                <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm font-semibold text-blue-700">
                    <Loader2 className="mr-2 inline size-4 animate-spin" />
                    Loading latest pet, booking, and upload details...
                </div>
            )}

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <Label className="mb-3 block text-sm font-bold text-slate-900">Diagnosis Module</Label>
                <div className="grid gap-3 md:grid-cols-2">
                    <DiagnosisTypeButton
                        active={diagnosisType === 'general'}
                        icon={Stethoscope}
                        title="General Medical / Surgery"
                        description="Use standard exam fields, vital signs, diagnosis, treatment, and prescription."
                        onClick={() => setDiagnosisType('general')}
                    />
                    <DiagnosisTypeButton
                        active={diagnosisType === 'custom'}
                        icon={FileText}
                        title="Custom Diagnosis Services"
                        description="Add one or more service-specific diagnosis blocks with symptoms, prescription, and uploads."
                        onClick={() => setDiagnosisType('custom')}
                    />
                </div>
            </section>

            {diagnosisType === 'general' ? (
                <GeneralDiagnosisForm
                    formData={formData}
                    currentPrescription={currentPrescription}
                    setCurrentPrescription={setCurrentPrescription}
                    updateForm={updateForm}
                    updateVitalSign={updateVitalSign}
                    addPrescription={addPrescription}
                    removePrescription={removePrescription}
                />
            ) : (
                <CustomDiagnosisForm
                    customFields={customFields}
                    addCustomField={addCustomField}
                    serviceCatalog={customDiagnosisServiceOptions}
                    selectedCustomServiceId={selectedCustomServiceId}
                    setSelectedCustomServiceId={setSelectedCustomServiceId}
                    schemaMessage={billingSchemaMessage}
                    updateCustomField={updateCustomField}
                    updateCustomPrescriptionDraft={updateCustomPrescriptionDraft}
                    addCustomPrescription={addCustomPrescription}
                    removeCustomPrescription={removeCustomPrescription}
                    removeCustomField={removeCustomField}
                    handleCustomUpload={handleCustomUpload}
                    removeCustomAttachment={removeCustomAttachment}
                    onPreview={setPreviewImage}
                />
            )}

            <VaccinationRecordSection
                enabled={shouldRecordVaccination}
                setEnabled={setShouldRecordVaccination}
                record={vaccinationRecord}
                setRecord={setVaccinationRecord}
                suggested={contextIsVaccination}
            />

            <AdditionalConsentSection
                consentTemplates={consentTemplates}
                isLoading={isLoadingConsentTemplates}
                draft={consentDraft}
                setDraft={setConsentDraft}
                selectedTemplate={selectedConsentTemplate}
                additionalConsents={additionalConsents}
                consentForms={consentFormsForDisplay}
                addAdditionalConsent={addAdditionalConsent}
                removeAdditionalConsent={removeAdditionalConsent}
                ownerName={context.ownerName}
                onPreview={setPreviewImage}
            />

            <VisitChargesSection
                serviceCatalog={serviceCatalog}
                selectedServiceId={selectedServiceId}
                setSelectedServiceId={setSelectedServiceId}
                addServiceVisitCharge={addServiceVisitCharge}
                visitCharges={visitCharges}
                updateVisitCharge={updateVisitCharge}
                removeVisitCharge={removeVisitCharge}
                total={visitChargesTotal}
                schemaMessage={billingSchemaMessage}
            />

            {diagnosisType === 'general' && (
                <>
                    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <Label className="text-sm font-bold text-slate-900">Diagnosis Uploads</Label>
                                <p className="mt-1 text-sm font-medium text-slate-500">
                                    Attach lab reports, X-rays, wound photos, or other files created during diagnosis.
                                </p>
                            </div>
                            <input
                                ref={generalFileInputRef}
                                type="file"
                                accept={DOCUMENT_UPLOAD_ACCEPT}
                                multiple
                                onChange={handleImageUpload}
                                className="hidden"
                            />
                            <Button type="button" variant="outline" onClick={() => generalFileInputRef.current?.click()} className="gap-2">
                                <Upload className="size-4" />
                                Upload Files
                            </Button>
                        </div>

                        <AttachmentGrid
                            attachments={diagnosisAttachments}
                            emptyMessage="No diagnosis uploads attached."
                            onRemove={removeGeneralAttachment}
                            onPreview={setPreviewImage}
                        />
                    </section>

                    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <Label className="text-sm font-bold text-slate-900">Reference Documents</Label>
                                <p className="mt-1 text-sm font-medium text-slate-500">
                                    Attach boarding reports, monitoring documents, PDFs, or external clinic references.
                                </p>
                            </div>
                            <input
                                ref={referenceFileInputRef}
                                type="file"
                                accept={DOCUMENT_UPLOAD_ACCEPT}
                                multiple
                                onChange={handleReferenceUpload}
                                className="hidden"
                            />
                            <Button type="button" variant="outline" onClick={() => referenceFileInputRef.current?.click()} className="gap-2">
                                <Upload className="size-4" />
                                Upload Documents
                            </Button>
                        </div>

                        <AttachmentGrid
                            attachments={referenceAttachments}
                            emptyMessage="No reference documents attached."
                            onRemove={removeGeneralAttachment}
                            onPreview={setPreviewImage}
                        />
                    </section>
                </>
            )}

            <div className="flex flex-col-reverse gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={handleCancel} disabled={isSaving}>
                    Cancel
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    onClick={handleSaveAndPrintPrescription}
                    disabled={isSaving || isLoadingRecord || !hasPrintablePrescriptions}
                    title={!hasPrintablePrescriptions ? 'Add at least one prescription before printing.' : undefined}
                    className="gap-2"
                >
                    {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Printer className="size-4" />}
                    {loadedDiagnosisId ? 'Update & Print Prescription' : 'Save & Print Prescription'}
                </Button>
                <Button
                    type="button"
                    onClick={() => handleSaveDiagnosis()}
                    disabled={isSaving || isLoadingRecord}
                    className="bg-[#155dfc] text-white hover:bg-[#0d4acf]"
                >
                    {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                    {loadedDiagnosisId ? 'Update Diagnosis' : 'Save Diagnosis'}
                </Button>
            </div>

            <PhotoViewer
                src={previewImage?.src || ''}
                alt={previewImage?.alt || 'Diagnosis upload'}
                open={Boolean(previewImage)}
                onOpenChange={(open) => {
                    if (!open) setPreviewImage(null);
                }}
            />
        </div>
    );
}

function VaccinationRecordSection({ enabled, setEnabled, record, setRecord, suggested }) {
    const updateRecord = (field, value) => {
        setRecord(current => ({ ...current, [field]: value }));
    };

    return (
        <section className={`rounded-xl border p-5 shadow-sm ${enabled ? 'border-blue-200 bg-blue-50/40' : 'border-slate-200 bg-white'}`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Syringe className="size-5 text-[#155dfc]" />
                        <h3 className="text-lg font-bold text-slate-900">Vaccination Record</h3>
                        {suggested && (
                            <Badge className="border-0 bg-blue-100 text-blue-700">Suggested for this service</Badge>
                        )}
                    </div>
                    <p className="mt-1 text-sm font-medium text-slate-500">
                        Optional. Fill this only when a vaccine was actually administered or needs to be recorded.
                    </p>
                </div>
                <Button
                    type="button"
                    variant={enabled ? 'default' : 'outline'}
                    onClick={() => setEnabled(current => !current)}
                    className={enabled ? 'bg-[#155dfc] text-white hover:bg-[#0d4acf]' : ''}
                >
                    {enabled ? 'Recording' : 'Record Vaccine'}
                </Button>
            </div>

            {enabled && (
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <InputBlock
                        label="Vaccine Name"
                        value={record.vaccineName}
                        placeholder="Example: Rabies, 5-in-1, DHPP"
                        onChange={(value) => updateRecord('vaccineName', value)}
                    />
                    <InputBlock
                        label="Date Administered"
                        type="date"
                        value={record.dateAdministered}
                        onChange={(value) => updateRecord('dateAdministered', value)}
                    />
                    <InputBlock
                        label="Next Due Date"
                        type="date"
                        value={record.nextDueDate}
                        onChange={(value) => updateRecord('nextDueDate', value)}
                    />
                    <InputBlock
                        label="Veterinarian"
                        value={record.veterinarianName}
                        placeholder="Dr. Name"
                        onChange={(value) => updateRecord('veterinarianName', value)}
                    />
                    <InputBlock
                        label="License Number"
                        value={record.veterinarianLicense}
                        placeholder="PRC license number"
                        onChange={(value) => updateRecord('veterinarianLicense', value)}
                    />
                    <Field label="Vaccination Notes">
                        <Textarea
                            value={record.notes}
                            onChange={(event) => updateRecord('notes', event.target.value)}
                            placeholder="Reaction notes, batch details, reminders, or owner instructions"
                            className="min-h-20 bg-white"
                        />
                    </Field>
                </div>
            )}
        </section>
    );
}

function AdditionalConsentSection({
    consentTemplates,
    isLoading,
    draft,
    setDraft,
    selectedTemplate,
    additionalConsents,
    consentForms,
    addAdditionalConsent,
    removeAdditionalConsent,
    ownerName,
    onPreview
}) {
    const visibleConsentForms = consentForms || additionalConsents;
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const [showTemplatePreview, setShowTemplatePreview] = useState(false);
    const submitSignedConsent = () => {
        addAdditionalConsent();
        setShowTemplatePreview(false);
        setIsSheetOpen(false);
    };

    return (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <div className="flex flex-wrap items-center gap-2">
                        <FileText className="size-5 text-[#155dfc]" />
                        <h3 className="text-lg font-bold text-slate-900">Consent Forms</h3>
                        <Badge className="border-0 bg-blue-50 text-blue-700">
                            {visibleConsentForms.length} signed
                        </Badge>
                    </div>
                    <p className="mt-1 text-sm font-medium text-slate-500">
                        Signed owner consent forms connected to this visit.
                    </p>
                </div>

                <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                    <SheetTrigger asChild>
                        <Button type="button" variant="outline" className="w-full gap-2 sm:w-auto">
                            <PanelRightOpen className="size-4" />
                            Add Consent
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="right" className="overflow-y-auto sm:max-w-2xl">
                        <div className="p-5">
                            <SheetHeader>
                                <SheetTitle>Consent Forms</SheetTitle>
                                <SheetDescription>
                                    Select a consent template and collect the pet owner signature for this diagnosis.
                                </SheetDescription>
                            </SheetHeader>

                            <div className="mt-5 space-y-5">
                                <div className="space-y-3">
                                    <div className="space-y-2">
                                        <Label className="text-sm font-bold text-slate-900">Consent Template</Label>
                                        <Select
                                            value={draft.templateId}
                                            onValueChange={(value) => {
                                                setDraft(current => ({ ...current, templateId: value }));
                                                setShowTemplatePreview(false);
                                            }}
                                            disabled={isLoading || consentTemplates.length === 0}
                                        >
                                            <SelectTrigger className="bg-white">
                                                <SelectValue
                                                    placeholder={isLoading ? 'Loading consent forms...' : 'Select consent form'}
                                                    displayValue={selectedTemplate?.title}
                                                />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {consentTemplates.map(template => (
                                                    <SelectItem key={template.id} value={template.id}>
                                                        {template.title}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                                        {selectedTemplate ? (
                                            <>
                                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                                    <div className="min-w-0">
                                                        <p className="truncate font-bold text-slate-900">{selectedTemplate.title}</p>
                                                        <Badge className="mt-2 border-0 bg-slate-100 text-slate-600">{selectedTemplate.category}</Badge>
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        onClick={() => setShowTemplatePreview(current => !current)}
                                                        className="w-full gap-2 sm:w-auto"
                                                    >
                                                        <Eye className="size-4" />
                                                        {showTemplatePreview ? 'Hide Preview' : 'Preview Consent'}
                                                    </Button>
                                                </div>
                                                {showTemplatePreview && (
                                                    <p className="mt-4 max-h-80 overflow-y-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-3 text-sm font-medium leading-6 text-slate-600">
                                                        {selectedTemplate.content || 'No consent content available.'}
                                                    </p>
                                                )}
                                            </>
                                        ) : (
                                            <p className="text-sm font-semibold text-slate-400">
                                                No consent template selected. Add templates from Consent Files Management if this list is empty.
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div>
                                        <Label className="text-sm font-bold text-slate-900">Owner Signature</Label>
                                        <p className="mt-1 text-xs font-semibold text-slate-500">
                                            Signed by {ownerName || 'pet owner'} for the selected consent form.
                                        </p>
                                    </div>
                                    <SignatureCapture
                                        signature={draft.signature}
                                        onSignatureChange={(signature) => setDraft(current => ({ ...current, signature }))}
                                        disabled={!selectedTemplate}
                                    />
                                    <Button
                                        type="button"
                                        onClick={submitSignedConsent}
                                        disabled={!selectedTemplate || !draft.signature}
                                        className="w-full bg-[#155dfc] text-white hover:bg-[#0d4acf]"
                                    >
                                        <Upload className="size-4" />
                                        Submit Signature
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </SheetContent>
                </Sheet>
            </div>

            <div className="mt-5">
                {visibleConsentForms.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-400">
                        No signed consent forms found for this diagnosis.
                    </p>
                ) : (
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {visibleConsentForms.map(consent => (
                            <div key={consent.id} className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                                <button
                                    type="button"
                                    onClick={() => onPreview?.({
                                        src: consent.preview || consent.signatureDataUrl || consent.url || consent.signatureUrl,
                                        alt: consent.title || consent.name || 'Signed consent'
                                    })}
                                    className="min-w-0 text-left"
                                >
                                    <p className="truncate text-sm font-black text-slate-900">{consent.title || consent.name}</p>
                                    <p className="mt-1 truncate text-xs font-semibold text-slate-500">
                                        {consent.signerName || ownerName || 'Pet owner'} {consent.signedAt ? `- ${formatSignedAt(consent.signedAt)}` : ''}
                                    </p>
                                </button>
                                {consent.sourceConsent ? (
                                    <Badge className="shrink-0 border-0 bg-green-50 text-green-700">Intake</Badge>
                                ) : (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => removeAdditionalConsent(consent.id)}
                                        className="shrink-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                                    >
                                        <Trash2 className="size-4" />
                                    </Button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}

function VisitChargesSection({
    serviceCatalog,
    selectedServiceId,
    setSelectedServiceId,
    addServiceVisitCharge,
    visitCharges,
    updateVisitCharge,
    removeVisitCharge,
    total,
    schemaMessage
}) {
    const selectedService = serviceCatalog.find(service => String(service.serviceId) === String(selectedServiceId));

    return (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Receipt className="size-5 text-[#155dfc]" />
                        <h3 className="text-lg font-bold text-slate-900">Visit Charges</h3>
                    </div>
                    <p className="mt-1 text-sm font-medium text-slate-500">
                        Selected catalog services become visit charge lines for payment.
                    </p>
                </div>
                <Badge className="w-fit border-0 bg-blue-50 text-blue-700">{formatPhpCurrency(total)}</Badge>
            </div>

            {schemaMessage && (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
                    {schemaMessage}
                </div>
            )}

            <div className="mt-4 grid gap-3 md:grid-cols-[minmax(220px,1fr)_auto]">
                <Select
                    value={selectedServiceId}
                    onValueChange={setSelectedServiceId}
                    disabled={serviceCatalog.length === 0 || Boolean(schemaMessage)}
                >
                    <SelectTrigger className="bg-white">
                        <SelectValue
                            placeholder="Select catalog service"
                            displayValue={selectedService ? `${selectedService.serviceName} - ${formatPhpCurrency(selectedService.basePrice)}` : undefined}
                        />
                    </SelectTrigger>
                    <SelectContent>
                        {serviceCatalog.map(service => (
                            <SelectItem key={service.serviceId} value={String(service.serviceId)}>
                                {service.serviceName} - {formatPhpCurrency(service.basePrice)}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Button type="button" variant="outline" onClick={addServiceVisitCharge} disabled={!selectedServiceId || Boolean(schemaMessage)}>
                    <Plus className="size-4" />
                    Add Service
                </Button>
            </div>

            <div className="mt-4 space-y-2">
                {visitCharges.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-400">
                        No visit charges selected.
                    </p>
                ) : (
                    visitCharges.map(charge => {
                        const subtotal = (Number(charge.quantity) || 0) * (Number(charge.unitPrice) || 0);

                        return (
                            <div key={charge.id} className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 lg:grid-cols-[minmax(220px,1fr)_100px_120px_110px_auto] lg:items-center">
                                <div>
                                    <Input
                                        value={charge.description}
                                        onChange={(event) => updateVisitCharge(charge.id, 'description', event.target.value)}
                                        className="bg-white"
                                    />
                                    <p className="mt-1 text-xs font-semibold uppercase text-slate-400">
                                        {charge.chargeType}{charge.billablePolicy ? ` / ${charge.billablePolicy}` : ''}
                                    </p>
                                </div>
                                <Input
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    value={charge.quantity}
                                    onChange={(event) => updateVisitCharge(charge.id, 'quantity', event.target.value)}
                                    className="bg-white"
                                />
                                <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={charge.unitPrice}
                                    onChange={(event) => updateVisitCharge(charge.id, 'unitPrice', event.target.value)}
                                    className="bg-white"
                                />
                                <p className="text-sm font-black text-[#101828]">{formatPhpCurrency(subtotal)}</p>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeVisitCharge(charge.id)}
                                    className="w-fit text-red-600 hover:bg-red-50 hover:text-red-700"
                                >
                                    <Trash2 className="size-4" />
                                    Remove
                                </Button>
                            </div>
                        );
                    })
                )}
            </div>
        </section>
    );
}

function DiagnosisContextSidebar({ context, sourceUploads, consentUploads, additionalConsents, consentForms, boardingDocumentUploads, onPreview }) {
    const visibleConsentForms = consentForms || additionalConsents;

    return (
        <Sheet>
            <SheetTrigger asChild>
                <Button type="button" variant="outline" className="gap-2">
                    <PanelRightOpen className="size-4" />
                    Pet Details & Uploads
                </Button>
            </SheetTrigger>
            <SheetContent side="right" className="sm:max-w-xl">
                <div className="p-5">
                    <SheetHeader>
                        <SheetTitle>Patient Sheet</SheetTitle>
                        <SheetDescription>
                            Queue and booking context for this diagnosis. Payment receipts are not included here.
                        </SheetDescription>
                    </SheetHeader>

                    <div className="space-y-5">
                        <section className="rounded-xl border border-slate-200 bg-white p-4">
                            <h3 className="mb-3 text-sm font-black uppercase tracking-widest text-slate-400">Pet Details</h3>
                            {context.petProfileImage && (
                                <div className="mb-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                                    <img
                                        src={resolveFileUrl(context.petProfileImage)}
                                        alt={context.petName}
                                        className="h-44 w-full object-cover"
                                    />
                                </div>
                            )}
                            <div className="grid gap-3 text-sm sm:grid-cols-2">
                                <SheetDetail label="Pet" value={context.petName} />
                                <SheetDetail label="Owner" value={context.ownerName} />
                                <SheetDetail label="Species" value={context.petSpecies} />
                                <SheetDetail label="Breed" value={context.petBreed} />
                                <SheetDetail label="Status" value={context.petStatus} />
                                <SheetDetail label="Age" value={context.petAge} />
                                <SheetDetail label="Gender" value={context.petGender} />
                                <SheetDetail label="Weight" value={context.petWeight ? `${context.petWeight} kg` : ''} />
                                <SheetDetail label="Birth Date" value={context.petBirthDate} />
                                <SheetDetail label="Microchip" value={context.petMicrochipId} />
                                <SheetDetail label="Color / Marking" value={context.petColor} />
                                <SheetDetail label="Allergies" value={context.petAllergies} />
                                <SheetDetail label="Owner Phone" value={context.ownerPhone} />
                                <SheetDetail label="Address" value={context.ownerAddress} className="sm:col-span-2" />
                            </div>
                        </section>

                        <section className="rounded-xl border border-slate-200 bg-white p-4">
                            <h3 className="mb-3 text-sm font-black uppercase tracking-widest text-slate-400">Visit Details</h3>
                            <div className="grid gap-3 text-sm">
                                <SheetDetail label="Service" value={context.serviceName} />
                                <SheetDetail label="Queue ID" value={context.queueReference || (context.queueNumber ? formatQueueReference({ queueNumber: context.queueNumber }) : '')} />
                                <SheetDetail label="Booking Number" value={context.bookingNumber} />
                                <SheetDetail label="Complaint" value={removeBookingMarker(context.complaint)} />
                                <SheetDetail label="Booking Notes" value={context.bookingNotes} />
                            </div>
                        </section>

                        <section className="rounded-xl border border-slate-200 bg-white p-4">
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Related Uploads</h3>
                                <Badge className="border-0 bg-slate-100 text-slate-700">{sourceUploads.length}</Badge>
                            </div>

                            {sourceUploads.length === 0 ? (
                                <p className="rounded-lg border border-dashed border-slate-200 p-4 text-sm font-semibold text-slate-400">
                                    No queue or booking concern uploads found.
                                </p>
                            ) : (
                                <div className="space-y-3">
                                    {sourceUploads.map(upload => (
                                        <AttachmentCard
                                            key={upload.id}
                                            attachment={upload}
                                            onPreview={onPreview}
                                        />
                                    ))}
                                </div>
                            )}
                        </section>

                        <section className="rounded-xl border border-slate-200 bg-white p-4">
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Signed Consent</h3>
                                <Badge className="border-0 bg-slate-100 text-slate-700">{consentUploads.length}</Badge>
                            </div>

                            {consentUploads.length === 0 ? (
                                <p className="rounded-lg border border-dashed border-slate-200 p-4 text-sm font-semibold text-slate-400">
                                    No signed consent image found.
                                </p>
                            ) : (
                                <div className="space-y-3">
                                    {consentUploads.map(upload => (
                                        <AttachmentCard
                                            key={upload.id}
                                            attachment={upload}
                                            onPreview={onPreview}
                                        />
                                    ))}
                                </div>
                            )}
                        </section>

                        <section className="rounded-xl border border-slate-200 bg-white p-4">
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Consent Forms</h3>
                                <Badge className="border-0 bg-slate-100 text-slate-700">{visibleConsentForms.length}</Badge>
                            </div>

                            {visibleConsentForms.length === 0 ? (
                                <p className="rounded-lg border border-dashed border-slate-200 p-4 text-sm font-semibold text-slate-400">
                                    No consent forms signed for this diagnosis.
                                </p>
                            ) : (
                                <div className="space-y-3">
                                    {visibleConsentForms.map(consent => (
                                        <AttachmentCard
                                            key={consent.id}
                                            attachment={{
                                                ...consent,
                                                label: consent.title || 'Consent form',
                                                name: consent.title || consent.name || 'Signed consent',
                                                preview: consent.preview || consent.signatureDataUrl,
                                                url: consent.url || consent.signatureUrl,
                                                mimeType: 'image/png'
                                            }}
                                            onPreview={onPreview}
                                        />
                                    ))}
                                </div>
                            )}
                        </section>

                        <section className="rounded-xl border border-slate-200 bg-white p-4">
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Boarding Documents</h3>
                                <Badge className="border-0 bg-slate-100 text-slate-700">{boardingDocumentUploads.length}</Badge>
                            </div>

                            {boardingDocumentUploads.length === 0 ? (
                                <p className="rounded-lg border border-dashed border-slate-200 p-4 text-sm font-semibold text-slate-400">
                                    No boarding monitoring documents found.
                                </p>
                            ) : (
                                <div className="space-y-3">
                                    {boardingDocumentUploads.map(upload => (
                                        <AttachmentCard
                                            key={upload.id}
                                            attachment={upload}
                                            onPreview={onPreview}
                                        />
                                    ))}
                                </div>
                            )}
                        </section>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}

function SheetDetail({ label, value, className = '' }) {
    return (
        <div className={className}>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
            <p className="mt-1 break-words font-semibold text-slate-700">
                {value || <span className="text-slate-300">N/A</span>}
            </p>
        </div>
    );
}

function DiagnosisTypeButton({ active, icon, title, description, onClick }) {
    const Icon = icon;

    return (
        <button
            type="button"
            onClick={onClick}
            className={`rounded-xl border-2 p-4 text-left transition ${
                active ? 'border-[#155dfc] bg-blue-50' : 'border-slate-200 bg-white hover:border-blue-200'
            }`}
        >
            <Icon className={`mb-3 size-7 ${active ? 'text-[#155dfc]' : 'text-slate-500'}`} />
            <h3 className="font-bold text-slate-900">{title}</h3>
            <p className="mt-1 text-sm font-medium leading-relaxed text-slate-500">{description}</p>
        </button>
    );
}

function GeneralDiagnosisForm({
    formData,
    currentPrescription,
    setCurrentPrescription,
    updateForm,
    updateVitalSign,
    addPrescription,
    removePrescription
}) {
    return (
        <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900">Medical Examination</h3>

            <Field label="Chief Complaint">
                <Textarea
                    value={formData.chiefComplaint}
                    onChange={(event) => updateForm('chiefComplaint', event.target.value)}
                    placeholder="Main reason for visit"
                    className="min-h-20"
                />
            </Field>

            <MajorSymptomsContainer
                value={formData.majorSymptoms}
                onChange={(value) => updateForm('majorSymptoms', value)}
            />

            <Field label="Symptoms & Clinical Signs">
                <Textarea
                    value={formData.symptoms}
                    onChange={(event) => updateForm('symptoms', event.target.value)}
                    placeholder="Observable symptoms and clinical signs"
                    className="min-h-20"
                />
            </Field>

            <div className="space-y-3">
                <Label className="text-sm font-bold text-slate-900">Vital Signs</Label>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <InputBlock
                        label="Temperature (C)"
                        value={formData.vitalSigns.temperature}
                        placeholder="38.5"
                        restriction="decimal"
                        onChange={(value) => updateVitalSign('temperature', value)}
                    />
                    <InputBlock
                        label="Heart Rate (bpm)"
                        value={formData.vitalSigns.heartRate}
                        placeholder="120"
                        restriction="integer"
                        onChange={(value) => updateVitalSign('heartRate', value)}
                    />
                    <InputBlock
                        label="Respiratory Rate"
                        value={formData.vitalSigns.respiratoryRate}
                        placeholder="30"
                        restriction="integer"
                        onChange={(value) => updateVitalSign('respiratoryRate', value)}
                    />
                    <InputBlock
                        label="Weight (kg)"
                        value={formData.vitalSigns.weight}
                        placeholder="12.5"
                        restriction="decimal"
                        onChange={(value) => updateVitalSign('weight', value)}
                    />
                </div>
            </div>

            <Field label="Physical Examination Findings">
                <Textarea
                    value={formData.physicalExam}
                    onChange={(event) => updateForm('physicalExam', event.target.value)}
                    placeholder="General appearance, HEENT, cardiovascular, respiratory, etc."
                    className="min-h-24"
                />
            </Field>

            <Field label="Diagnosis" required>
                <Textarea
                    value={formData.diagnosis}
                    onChange={(event) => updateForm('diagnosis', event.target.value)}
                    placeholder="Primary diagnosis and differential diagnoses"
                    className="min-h-20"
                />
            </Field>

            <Field label="Treatment Plan">
                <Textarea
                    value={formData.treatment}
                    onChange={(event) => updateForm('treatment', event.target.value)}
                    placeholder="Recommended treatments, procedures, and interventions"
                    className="min-h-20"
                />
            </Field>

            <PrescriptionEditor
                currentPrescription={currentPrescription}
                setCurrentPrescription={setCurrentPrescription}
                prescriptions={formData.prescription}
                addPrescription={addPrescription}
                removePrescription={removePrescription}
            />

            <Field label="Lab Results">
                <Textarea
                    value={formData.labResults}
                    onChange={(event) => updateForm('labResults', event.target.value)}
                    placeholder="Summary of lab findings"
                    className="min-h-20"
                />
            </Field>

            <div className="grid gap-4 md:grid-cols-2">
                <InputBlock
                    label="Follow-up Date"
                    type="date"
                    value={formData.followUp}
                    onChange={(value) => updateForm('followUp', value)}
                />
                <Field label="Notes">
                    <Textarea
                        value={formData.notes}
                        onChange={(event) => updateForm('notes', event.target.value)}
                        placeholder="Additional notes"
                        className="min-h-20"
                    />
                </Field>
            </div>
        </section>
    );
}

function MajorSymptomsContainer({ value, onChange }) {
    return (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <Label className="text-sm font-black uppercase tracking-widest text-amber-700">Major Symptoms</Label>
            <Textarea
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder="High-priority symptoms, red flags, onset, severity, and duration"
                className="mt-3 min-h-24 border-amber-200 bg-white"
            />
        </div>
    );
}

function parseNonNegativeNumber(value, fallback = 0) {
    const parsed = Number(value);

    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function formatPrescriptionLine(prescription) {
    const durationUnit = prescription.durationUnit === 'as needed'
        ? 'as needed'
        : `${prescription.durationUnit}${Number(prescription.durationNumber) === 1 ? '' : '(s)'}`;

    return `${prescription.medicine} - ${prescription.times} time(s) ${prescription.frequency} for ${prescription.durationNumber} ${durationUnit}`;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function printHtmlDocument(html) {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.setAttribute('aria-hidden', 'true');
    document.body.appendChild(iframe);

    const printWindow = iframe.contentWindow;
    const printDocument = printWindow?.document;
    if (!printWindow || !printDocument) {
        iframe.remove();
        throw new Error('Could not prepare prescription print view.');
    }

    printDocument.open();
    printDocument.write(html);
    printDocument.close();

    setTimeout(() => {
        printWindow.focus();
        printWindow.print();
        setTimeout(() => iframe.remove(), 1000);
    }, 250);
}

function buildPrescriptionPrintHtml({ context, veterinarianName, veterinarianLicense, diagnosisText, notes, rows }) {
    const today = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    const prescriptionRows = rows.map((row, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>${escapeHtml(row.section)}</td>
            <td>
                <strong>${escapeHtml(formatPrescriptionLine(row.prescription))}</strong>
                ${row.prescription.instructions ? `<p class="instructions">${escapeHtml(row.prescription.instructions)}</p>` : ''}
            </td>
        </tr>
    `).join('');

    return `<!doctype html>
<html>
<head>
    <meta charset="utf-8" />
    <title>Prescription - ${escapeHtml(context.petName || 'Patient')}</title>
    <style>
        @page { size: A4; margin: 14mm; }
        * { box-sizing: border-box; }
        body { margin: 0; color: #111827; font-family: Arial, sans-serif; background: #fff; }
        .sheet { width: 100%; }
        .header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 2px solid #155dfc; padding-bottom: 18px; }
        .brand { color: #155dfc; font-size: 28px; font-weight: 800; line-height: 1; }
        .clinic { margin-top: 6px; color: #475569; font-size: 14px; font-weight: 700; }
        .title { text-align: right; }
        .title h1 { margin: 0; font-size: 22px; }
        .title p { margin: 6px 0 0; color: #475569; font-size: 13px; font-weight: 700; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 18px; margin: 20px 0; }
        .field { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 12px; }
        .label { display: block; color: #64748b; font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
        .value { display: block; margin-top: 4px; color: #111827; font-size: 14px; font-weight: 700; }
        .section { margin-top: 20px; }
        .section h2 { margin: 0 0 10px; font-size: 15px; text-transform: uppercase; letter-spacing: .08em; color: #155dfc; }
        .box { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; min-height: 56px; white-space: pre-wrap; line-height: 1.5; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 13px; }
        th { background: #eff6ff; color: #1d4ed8; text-align: left; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; }
        th, td { border: 1px solid #dbe3ef; padding: 10px; vertical-align: top; }
        td:first-child { width: 42px; text-align: center; font-weight: 800; }
        td:nth-child(2) { width: 160px; font-weight: 700; color: #334155; }
        .instructions { margin: 6px 0 0; color: #475569; white-space: pre-wrap; line-height: 1.45; }
        .signature { display: grid; grid-template-columns: 1fr 1fr; gap: 36px; margin-top: 42px; }
        .line { border-top: 1px solid #111827; padding-top: 8px; text-align: center; font-size: 12px; font-weight: 700; }
        .footer { margin-top: 28px; color: #64748b; font-size: 11px; text-align: center; }
    </style>
</head>
<body>
    <main class="sheet">
        <header class="header">
            <div>
                <div class="brand">iPawcus</div>
                <div class="clinic">Vetfocus Care Animal Clinic</div>
            </div>
            <div class="title">
                <h1>Prescription</h1>
                <p>${escapeHtml(today)}</p>
            </div>
        </header>

        <section class="grid">
            <div class="field"><span class="label">Patient</span><span class="value">${escapeHtml(context.petName || 'Patient')}</span></div>
            <div class="field"><span class="label">Owner</span><span class="value">${escapeHtml(context.ownerName || 'Pet Owner')}</span></div>
            <div class="field"><span class="label">Service</span><span class="value">${escapeHtml(context.serviceName || 'Diagnosis')}</span></div>
            <div class="field"><span class="label">Veterinarian</span><span class="value">${escapeHtml(veterinarianName || 'Clinic Veterinarian')}</span></div>
            <div class="field"><span class="label">Species / Breed</span><span class="value">${escapeHtml([context.petSpecies, context.petBreed].filter(Boolean).join(' / ') || 'N/A')}</span></div>
            <div class="field"><span class="label">License</span><span class="value">${escapeHtml(veterinarianLicense || 'N/A')}</span></div>
        </section>

        <section class="section">
            <h2>Diagnosis Summary</h2>
            <div class="box">${escapeHtml(diagnosisText || 'No diagnosis summary recorded.')}</div>
        </section>

        <section class="section">
            <h2>Prescription Details</h2>
            <table>
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Section</th>
                        <th>Medication and Instructions</th>
                    </tr>
                </thead>
                <tbody>${prescriptionRows}</tbody>
            </table>
        </section>

        ${notes ? `<section class="section"><h2>Notes</h2><div class="box">${escapeHtml(notes)}</div></section>` : ''}

        <section class="signature">
            <div class="line">Veterinarian Signature</div>
            <div class="line">Owner / Client Signature</div>
        </section>

        <footer class="footer">Generated by iPawcus from the diagnosis record.</footer>
    </main>
</body>
</html>`;
}

function wrapCanvasText(ctx, text, maxWidth) {
    const words = String(text || '').split(/\s+/).filter(Boolean);
    const lines = [];
    let currentLine = '';

    words.forEach(word => {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        if (ctx.measureText(testLine).width <= maxWidth) {
            currentLine = testLine;
            return;
        }

        if (currentLine) {
            lines.push(currentLine);
        }
        currentLine = word;
    });

    if (currentLine) {
        lines.push(currentLine);
    }

    return lines.length > 0 ? lines : [''];
}

function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight) {
    const lines = wrapCanvasText(ctx, text, maxWidth);
    lines.forEach((line, index) => {
        ctx.fillText(line, x, y + (index * lineHeight));
    });

    return y + (lines.length * lineHeight);
}

function collectPrescriptionRows(generalPrescriptions, customSections) {
    const rows = [];

    generalPrescriptions.forEach(prescription => {
        rows.push({ section: 'General Diagnosis', prescription });
    });

    customSections.forEach(section => {
        (section.prescriptions || []).forEach(prescription => {
            rows.push({ section: section.label || 'Custom Diagnosis', prescription });
        });
    });

    return rows;
}

function buildPrescriptionImageBlob({ context, veterinarianName, veterinarianLicense, diagnosisText, notes, rows }) {
    return new Promise((resolve, reject) => {
        const canvas = document.createElement('canvas');
        const width = 900;
        const lineHeight = 28;
        const estimatedHeight = 430 + (rows.length * 120) + (notes ? 120 : 0);
        canvas.width = width;
        canvas.height = Math.max(760, estimatedHeight);
        const ctx = canvas.getContext('2d');

        if (!ctx) {
            reject(new Error('Could not create prescription image.'));
            return;
        }

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#155dfc';
        ctx.fillRect(0, 0, canvas.width, 120);
        ctx.fillStyle = '#ffffff';
        ctx.font = '700 34px Arial';
        ctx.fillText('Ipawcus Veterinary Clinic', 48, 52);
        ctx.font = '700 20px Arial';
        ctx.fillText('Prescription Record', 48, 86);

        ctx.fillStyle = '#101828';
        ctx.font = '700 22px Arial';
        ctx.fillText(context.petName || 'Patient', 48, 165);
        ctx.font = '16px Arial';
        ctx.fillStyle = '#4a5565';
        ctx.fillText(`Owner: ${context.ownerName || 'Pet Owner'}`, 48, 195);
        ctx.fillText(`Service: ${context.serviceName || 'Diagnosis'}`, 48, 224);
        ctx.fillText(`Veterinarian: ${veterinarianName || 'Clinic Veterinarian'}`, 48, 253);
        if (veterinarianLicense) {
            ctx.fillText(`License: ${veterinarianLicense}`, 48, 282);
        }

        ctx.textAlign = 'right';
        ctx.fillText(new Date().toLocaleDateString(), width - 48, 165);
        ctx.textAlign = 'left';

        let y = 330;
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(48, y - 28);
        ctx.lineTo(width - 48, y - 28);
        ctx.stroke();

        ctx.fillStyle = '#101828';
        ctx.font = '700 20px Arial';
        ctx.fillText('Diagnosis Summary', 48, y);
        ctx.font = '16px Arial';
        ctx.fillStyle = '#334155';
        y = drawWrappedText(ctx, diagnosisText || 'No diagnosis summary recorded.', 48, y + 34, width - 96, lineHeight) + 26;

        ctx.fillStyle = '#101828';
        ctx.font = '700 20px Arial';
        ctx.fillText('Prescriptions', 48, y);
        y += 36;

        rows.forEach((row, index) => {
            const top = y - 20;
            ctx.fillStyle = '#f8fafc';
            ctx.fillRect(48, top, width - 96, 96);
            ctx.strokeStyle = '#e2e8f0';
            ctx.strokeRect(48, top, width - 96, 96);
            ctx.fillStyle = '#155dfc';
            ctx.font = '700 15px Arial';
            ctx.fillText(`${index + 1}. ${row.section}`, 68, y + 4);
            ctx.fillStyle = '#101828';
            ctx.font = '700 17px Arial';
            ctx.fillText(formatPrescriptionLine(row.prescription), 68, y + 34);
            if (row.prescription.instructions) {
                ctx.fillStyle = '#475569';
                ctx.font = '15px Arial';
                drawWrappedText(ctx, row.prescription.instructions, 68, y + 62, width - 136, 22);
            }
            y += 116;
        });

        if (notes) {
            ctx.fillStyle = '#101828';
            ctx.font = '700 20px Arial';
            ctx.fillText('Notes', 48, y);
            ctx.font = '16px Arial';
            ctx.fillStyle = '#334155';
            y = drawWrappedText(ctx, notes, 48, y + 34, width - 96, lineHeight) + 20;
        }

        ctx.fillStyle = '#64748b';
        ctx.font = '14px Arial';
        ctx.fillText('Generated from the finalized diagnosis record.', 48, Math.min(canvas.height - 42, y + 30));

        canvas.toBlob(blob => {
            if (blob) {
                resolve(blob);
            } else {
                reject(new Error('Could not export prescription image.'));
            }
        }, 'image/png');
    });
}

async function uploadPrescriptionDocument(payload) {
    const rows = collectPrescriptionRows(payload.generalPrescriptions, payload.customSections);
    if (rows.length === 0) {
        return null;
    }

    const blob = await buildPrescriptionImageBlob({ ...payload, rows });
    const file = new File([blob], `prescription-${Date.now()}.png`, { type: 'image/png' });
    const formDataUpload = new FormData();
    formDataUpload.append('image', file);
    formDataUpload.append('type', 'diagnosis');

    const result = await uploadFormData(formDataUpload);

    return {
        id: createId(),
        name: file.name,
        url: result.relative_url || result.url || '',
        relativeUrl: result.relative_url || result.url || '',
        mimeType: 'image/png',
        uploadedAt: new Date().toISOString(),
        category: 'prescription_document'
    };
}

function PrescriptionEditor({
    title = 'Prescription & Medications',
    currentPrescription,
    setCurrentPrescription,
    prescriptions,
    addPrescription,
    removePrescription
}) {
    const updatePrescriptionInput = (field, value) => {
        setCurrentPrescription(current => ({ ...current, [field]: value }));
    };

    return (
        <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <Label className="text-sm font-bold text-slate-900">{title}</Label>
            <div className="grid gap-3 lg:grid-cols-[minmax(180px,1fr)_90px_130px_90px_130px_auto]">
                <Input
                    value={currentPrescription.medicine}
                    onChange={(event) => updatePrescriptionInput('medicine', event.target.value)}
                    placeholder="Medicine / item"
                    className="bg-white"
                />
                <Input
                    type="number"
                    min="0"
                    value={currentPrescription.times}
                    onChange={(event) => updatePrescriptionInput('times', parseNonNegativeNumber(event.target.value, 1))}
                    placeholder="Times"
                    className="bg-white"
                />
                <Select
                    value={currentPrescription.frequency}
                    onValueChange={(value) => updatePrescriptionInput('frequency', value)}
                >
                    <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Frequency" />
                    </SelectTrigger>
                    <SelectContent>
                        {PRESCRIPTION_FREQUENCIES.map(option => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Input
                    type="number"
                    min="0"
                    value={currentPrescription.durationNumber}
                    onChange={(event) => updatePrescriptionInput('durationNumber', parseNonNegativeNumber(event.target.value, 0))}
                    placeholder="Duration"
                    className="bg-white"
                />
                <Select
                    value={currentPrescription.durationUnit}
                    onValueChange={(value) => updatePrescriptionInput('durationUnit', value)}
                >
                    <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Unit" />
                    </SelectTrigger>
                    <SelectContent>
                        {PRESCRIPTION_DURATION_UNITS.map(option => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Button type="button" onClick={addPrescription} className="bg-[#155dfc] text-white hover:bg-[#0d4acf]">
                    <Plus className="size-4" />
                    Add
                </Button>
            </div>

            <Textarea
                value={currentPrescription.instructions}
                onChange={(event) => updatePrescriptionInput('instructions', event.target.value)}
                placeholder="Optional prescription instructions"
                className="min-h-16 bg-white"
            />

            {prescriptions.length > 0 && (
                <div className="space-y-2">
                    {prescriptions.map(prescription => (
                        <div key={prescription.id} className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-700">
                                    <Pill className="mr-1 inline size-4 text-slate-400" />
                                    {formatPrescriptionLine(prescription)}
                                </p>
                                {prescription.instructions && (
                                    <p className="mt-1 text-xs font-medium text-slate-500">{prescription.instructions}</p>
                                )}
                            </div>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removePrescription(prescription.id)}
                                className="w-fit text-red-600 hover:bg-red-50 hover:text-red-700"
                            >
                                <Trash2 className="size-4" />
                                Remove
                            </Button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function CustomDiagnosisForm({
    customFields,
    addCustomField,
    serviceCatalog,
    selectedCustomServiceId,
    setSelectedCustomServiceId,
    schemaMessage,
    updateCustomField,
    updateCustomPrescriptionDraft,
    addCustomPrescription,
    removeCustomPrescription,
    removeCustomField,
    handleCustomUpload,
    removeCustomAttachment,
    onPreview
}) {
    const selectedService = serviceCatalog.find(service => String(service.serviceId) === String(selectedCustomServiceId));

    return (
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h3 className="text-lg font-bold text-slate-900">Custom Diagnosis Services</h3>
                    <p className="text-sm font-medium text-slate-500">
                        Add service blocks from the active service catalog. Each block carries its own symptoms, prescription, and uploads.
                    </p>
                </div>
                <div className="grid w-full gap-2 sm:w-[420px] sm:grid-cols-[minmax(0,1fr)_auto]">
                    <Select
                        value={selectedCustomServiceId}
                        onValueChange={setSelectedCustomServiceId}
                        disabled={serviceCatalog.length === 0 || Boolean(schemaMessage)}
                    >
                        <SelectTrigger className="bg-white">
                            <SelectValue
                                placeholder="Select service"
                                displayValue={selectedService ? `${selectedService.serviceName} - ${formatPhpCurrency(selectedService.basePrice)}` : undefined}
                            />
                        </SelectTrigger>
                        <SelectContent>
                            {serviceCatalog.map(service => (
                                <SelectItem key={service.serviceId} value={String(service.serviceId)}>
                                    {service.serviceName} - {formatPhpCurrency(service.basePrice)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button type="button" variant="outline" onClick={addCustomField} disabled={!selectedCustomServiceId || Boolean(schemaMessage)}>
                        <Plus className="size-4" />
                        Add
                    </Button>
                </div>
            </div>

            {schemaMessage && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
                    {schemaMessage}
                </div>
            )}

            {customFields.map((field, index) => {
                const fieldService = serviceCatalog.find(service => String(service.serviceId) === String(field.serviceId));
                const fieldTitle = fieldService?.serviceName || field.label || `Service ${index + 1}`;

                return (
                <div key={field.id} className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1 space-y-2">
                            <Label className="text-sm font-bold text-slate-900">Service {index + 1}</Label>
                            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                                <div className="flex flex-wrap items-center gap-2">
                                    <p className="font-black text-slate-900">{fieldTitle}</p>
                                    {fieldService && (
                                        <Badge className="border-0 bg-blue-50 text-blue-700">
                                            {formatPhpCurrency(fieldService.basePrice)}
                                        </Badge>
                                    )}
                                </div>
                                {!field.serviceId && (
                                    <Input
                                        value={field.label}
                                        onChange={(event) => updateCustomField(field.id, 'label', event.target.value)}
                                        placeholder="Legacy service label"
                                        className="mt-3 bg-white"
                                    />
                                )}
                            </div>
                        </div>
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => removeCustomField(field.id)}
                            className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        >
                            <Trash2 className="size-4" />
                            Remove
                        </Button>
                    </div>

                    <MajorSymptomsContainer
                        value={field.majorSymptoms}
                        onChange={(value) => updateCustomField(field.id, 'majorSymptoms', value)}
                    />

                    <Field label="Findings / Diagnosis Details">
                        <Textarea
                            value={field.value}
                            onChange={(event) => updateCustomField(field.id, 'value', event.target.value)}
                            placeholder="Service-specific findings, diagnosis notes, or recommendations"
                            className="min-h-24 bg-white"
                        />
                    </Field>

                    <PrescriptionEditor
                        title="Prescription for this Service"
                        currentPrescription={field.prescriptionDraft}
                        setCurrentPrescription={(updater) => updateCustomPrescriptionDraft(field.id, updater)}
                        prescriptions={field.prescription}
                        addPrescription={() => addCustomPrescription(field.id)}
                        removePrescription={(prescriptionId) => removeCustomPrescription(field.id, prescriptionId)}
                    />

                    <div className="rounded-lg border border-slate-200 bg-white p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <Label className="text-sm font-bold text-slate-900">Service Uploads</Label>
                                <p className="mt-1 text-xs font-semibold text-slate-500">Attach files specific to this custom service.</p>
                            </div>
                            <input
                                id={`custom-upload-${field.id}`}
                                type="file"
                                accept={DOCUMENT_UPLOAD_ACCEPT}
                                multiple
                                onChange={(event) => handleCustomUpload(field.id, event)}
                                className="hidden"
                            />
                            <Button type="button" variant="outline" onClick={() => document.getElementById(`custom-upload-${field.id}`)?.click()}>
                                <Upload className="size-4" />
                                Upload
                            </Button>
                        </div>

                        <AttachmentGrid
                            attachments={field.uploads}
                            emptyMessage="No uploads for this service."
                            onRemove={(attachmentId) => removeCustomAttachment(field.id, attachmentId)}
                            onPreview={onPreview}
                        />
                    </div>
                </div>
                );
            })}
        </section>
    );
}

function AttachmentGrid({ attachments, emptyMessage, onRemove, onPreview }) {
    if (!attachments || attachments.length === 0) {
        return (
            <p className="mt-4 rounded-lg border border-dashed border-slate-200 p-4 text-sm font-semibold text-slate-400">
                {emptyMessage}
            </p>
        );
    }

    return (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {attachments.map(attachment => (
                <AttachmentCard
                    key={attachment.id}
                    attachment={attachment}
                    onRemove={onRemove ? () => onRemove(attachment.id) : null}
                    onPreview={onPreview}
                />
            ))}
        </div>
    );
}

function AttachmentCard({ attachment, onRemove, onPreview }) {
    const previewSrc = attachment.preview || resolveFileUrl(attachment.url || attachment.relativeUrl);
    const canPreviewImage = isImageFile({ ...attachment, url: previewSrc });

    return (
        <div className="group overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="relative flex h-32 items-center justify-center bg-slate-50">
                {canPreviewImage && previewSrc ? (
                    <button
                        type="button"
                        onClick={() => onPreview?.({ src: previewSrc, alt: attachment.name })}
                        className="h-full w-full"
                    >
                        <img src={previewSrc} alt={attachment.name} className="h-full w-full object-cover transition group-hover:scale-105" />
                    </button>
                ) : (
                    <div className="text-center text-slate-400">
                        <FileText className="mx-auto mb-2 size-8" />
                        <p className="text-xs font-bold">File</p>
                    </div>
                )}

                {onRemove && (
                    <button
                        type="button"
                        onClick={onRemove}
                        className="absolute right-2 top-2 rounded-full bg-red-600 p-1 text-white opacity-0 transition group-hover:opacity-100"
                        aria-label={`Remove ${attachment.name}`}
                    >
                        <X className="size-4" />
                    </button>
                )}
            </div>
            <div className="space-y-2 p-3">
                <p className="truncate text-xs font-semibold text-slate-600">{attachment.name || 'Upload'}</p>
                <div className="flex items-center gap-2">
                    {canPreviewImage && previewSrc ? (
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => onPreview?.({ src: previewSrc, alt: attachment.name })}
                            className="h-8 flex-1 text-xs"
                        >
                            <Eye className="size-3" />
                            View
                        </Button>
                    ) : previewSrc ? (
                        <a
                            href={previewSrc}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-8 flex-1 items-center justify-center rounded-md border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:bg-slate-50"
                        >
                            Open
                        </a>
                    ) : null}
                </div>
            </div>
        </div>
    );
}

function Field({ label, required = false, children }) {
    return (
        <div className="space-y-2">
            <Label className="text-sm font-bold text-slate-900">
                {label}{required ? <span className="text-red-600"> *</span> : null}
            </Label>
            {children}
        </div>
    );
}

function InputBlock({ label, value, onChange, placeholder = '', type = 'text', restriction }) {
    return (
        <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</Label>
            <Input
                type={type}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                restriction={restriction}
                className="bg-white"
            />
        </div>
    );
}
