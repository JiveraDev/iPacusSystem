import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ArrowLeft,
    Building2,
    CalendarDays,
    ChevronDown,
    ClipboardCheck,
    Download,
    Eye,
    FileText,
    Loader2,
    PanelRightOpen,
    PawPrint,
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
import {
    downloadConsentDocument,
    openProtectedDocument,
    useConsentDocumentSource
} from '../../hooks/useConsentDocumentSource';
import SignatureCapture from '../SignatureCapture';
import ProtectedImage from '../shared/ProtectedImage.jsx';
import UploadImagePreview from '../shared/UploadImagePreview.jsx';
import { useDashboardUser, useNavigate } from '../dashboardRouter.jsx';
import { formatPhpCurrency } from '../../lib/currency';
import { reportBookingFormErrors } from '../../lib/bookingFormValidation';
import { formatQueueReference } from '../../lib/referenceNumbers';
import { fetchBoardingDocuments } from '../../services/boardingService';
import { createConsentDocumentPdfFile } from '../../services/consentDocumentPdf';
import { fetchConsentFiles } from '../../services/consentFileService';
import { fetchProfile } from '../../services/profileService';
import { createPrescriptionDocumentPdfFile } from '../../services/prescriptionDocumentPdf';
import { fetchQueues } from '../../services/queueService';
import { fetchServiceCatalog } from '../../services/serviceCatalogService';
import { uploadDocumentFile, uploadFormData } from '../../services/uploadService';
import { createVetDiagnosis, fetchVetDiagnoses } from '../../services/vetDiagnosisService';
import DashboardPageHeader from '../shared/DashboardPageHeader.jsx';

const DIAGNOSIS_CONTEXT_KEY = 'ipawcus-vet-diagnosis-context';
const DIAGNOSIS_DRAFT_STORAGE_PREFIX = 'ipawcus-vet-diagnosis-draft';
const DIAGNOSIS_DRAFT_SCHEMA_VERSION = 2;

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

const DOCUMENT_UPLOAD_ACCEPT = 'image/*,.pdf';
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

const emptyConfinementPlan = {
    requested: false,
    facilityType: 'boarding',
    roomSize: 'small',
    expectedDischarge: '',
    reason: '',
    careInstructions: ''
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

function createCustomSection(serviceName = '', serviceId = '') {
    return {
        id: createId(),
        serviceId: serviceId ? String(serviceId) : '',
        label: serviceName,
        value: '',
        majorSymptoms: '',
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

    const seen = new Set();
    return uploads.filter(upload => {
        const key = `${upload.label}:${upload.url}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function inheritedDiagnosisConsents(context) {
    const signedDocuments = splitUploadPaths(context.signedConsentDocumentPath);
    const physicalDocuments = splitUploadPaths(context.physicalConsentPath || context.physicalConsentPreview);

    return [...signedDocuments, ...physicalDocuments].map((path, index) => normalizeAdditionalConsent({
        id: `inherited-consent-${index}-${path}`,
        name: pathFileName(path),
        url: path,
        relativeUrl: path,
        mimeType: index < signedDocuments.length && path.split(/[?#]/)[0].toLowerCase().endsWith('.pdf')
            ? 'application/pdf'
            : 'image/png',
        uploadedAt: context.signedConsentAt || '',
        category: ADDITIONAL_CONSENT_CATEGORY,
        title: index < signedDocuments.length
            ? context.signedConsentType || 'Signed consent document'
            : 'Physical consent image',
        signerName: context.ownerName || 'Pet owner',
        signedAt: context.signedConsentAt || '',
        preview: path
    }));
}

function mergeUniqueConsents(...consentGroups) {
    const seen = new Set();

    return consentGroups.flat().filter(consent => {
        const path = consent.url || consent.relativeUrl || consent.preview || consent.documentDataUrl || consent.id;
        const key = String(path || '').trim().toLowerCase();
        if (!key || seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
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
        name: attachment.displayName || attachment.display_name || attachment.name || pathFileName(attachment.url || attachment.relativeUrl),
        originalName: attachment.originalName || attachment.original_name || attachment.name || '',
        storedFileName: attachment.storedFileName || attachment.stored_file_name || pathFileName(attachment.url || attachment.relativeUrl),
        url: attachment.url || attachment.relativeUrl || '',
        relativeUrl: attachment.relativeUrl || attachment.url || '',
        mimeType: attachment.mimeType || attachment.type || '',
        uploadedAt: attachment.uploadedAt || '',
        category: attachment.category || attachment.attachmentCategory || 'diagnosis_upload'
    };
}

function medicalUploadFormFields(context, category) {
    return {
        pet_id: context.petId || '',
        pet_name: context.petName || '',
        record_label: context.serviceName || 'Medical record',
        attachment_category: category || 'medical-file'
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
    const documentDataUrl = attachment.documentDataUrl || '';
    const preview = documentDataUrl || attachment.preview || normalized.url || '';

    return {
        ...normalized,
        category: ADDITIONAL_CONSENT_CATEGORY,
        templateId: attachment.templateId || attachment.template_id || attachment.consentTemplateId || '',
        title: attachment.title || attachment.consentTitle || normalized.name || 'Signed consent',
        content: attachment.content || attachment.consentContent || '',
        signerName: attachment.signerName || attachment.signer_name || '',
        signedAt: attachment.signedAt || attachment.signed_at || attachment.uploadedAt || '',
        signatureDataUrl: attachment.signatureDataUrl || '',
        signatureUrl: attachment.signatureUrl || '',
        documentDataUrl,
        preview
    };
}

async function buildSignedConsentDocumentFile({
    title,
    content,
    signerName,
    signedAt,
    signatureDataUrl,
    petName,
    veterinarianName
}) {
    if (!signatureDataUrl?.startsWith('data:image')) {
        throw new Error('A valid owner signature is required to generate the signed consent form.');
    }

    return createConsentDocumentPdfFile({
        title,
        content,
        signatureImage: signatureDataUrl,
        signerName,
        signedAt,
        veterinarianName,
        templateContext: {
            ownerName: signerName,
            signedAt,
            petName,
            veterinarianName
        }
    }, 'signed-consent-form');
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
        originalName: attachment.originalName || attachment.original_name || attachment.name || '',
        storedFileName: attachment.storedFileName || attachment.stored_file_name || pathFileName(url),
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
        mimeType: consent.mimeType
            || ((consent.url || consent.relativeUrl || '').split(/[?#]/)[0].toLowerCase().endsWith('.pdf')
                ? 'application/pdf'
                : 'image/png'),
        uploadedAt: consent.uploadedAt || '',
        category: ADDITIONAL_CONSENT_CATEGORY,
        templateId: consent.templateId || '',
        title: consent.title || 'Consent Form',
        content: consent.content || '',
        signerName: consent.signerName || '',
        signedAt: consent.signedAt || '',
        signatureDataUrl: consent.signatureDataUrl || '',
        signatureUrl: consent.signatureUrl || '',
        documentDataUrl: consent.documentDataUrl || '',
        preview: consent.preview && !String(consent.preview).startsWith('blob:')
            ? consent.preview
            : consent.documentDataUrl || consent.signatureDataUrl || ''
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

function normalizeDraftFormData(formData) {
    return {
        ...emptyDiagnosisForm,
        ...(formData || {}),
        chiefComplaint: formData?.chiefComplaint || '',
        majorSymptoms: formData?.majorSymptoms || '',
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
        majorSymptoms: section.majorSymptoms || '',
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
            ? normalizeDraftFormData(initialDraft.formData)
            : {
                ...emptyDiagnosisForm,
                vitalSigns: { ...emptyDiagnosisForm.vitalSigns }
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
            : inheritedDiagnosisConsents(initialContext)
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
    const [confinementPlan, setConfinementPlan] = useState(() => ({
        ...emptyConfinementPlan,
        ...(initialDraft?.confinementPlan || {})
    }));
    const [billingSchemaMessage, setBillingSchemaMessage] = useState('');
    const [isDraftReady, setIsDraftReady] = useState(() => Boolean(initialDraft));
    const [showAdditionalRecords, setShowAdditionalRecords] = useState(() => contextIsVaccination);

    useEffect(() => {
        if (contextIsVaccination) setShowAdditionalRecords(true);
    }, [contextIsVaccination]);

    const hydrateDiagnosisRecord = useCallback((record) => {
        setLoadedDiagnosisId(record.diagnosisId || record.id || null);
        setDiagnosisType(record.diagnosisType || 'general');
        setFormData({
            ...emptyDiagnosisForm,
            chiefComplaint: record.chiefComplaint || '',
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
                majorSymptoms: section.majorSymptoms || '',
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
    }, [veterinarianLicense, veterinarianName]);

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
                    console.error('Diagnosis visit charges are unavailable:', data.message || data);
                    setBillingSchemaMessage('Visit charges are temporarily unavailable. You can continue documenting the diagnosis.');
                    setServiceCatalog([]);
                    return;
                }

                setBillingSchemaMessage('');
                setServiceCatalog((Array.isArray(data.services) ? data.services : []).filter(service => service.isActive));
            } catch (error) {
                if (isActive) {
                    console.error('Failed to load diagnosis service pricing:', error);
                    setBillingSchemaMessage('Visit charges could not be loaded. You can continue documenting the diagnosis and try again later.');
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
                    console.error('Failed to load consent templates:', error);
                    toast.error('Consent forms could not be loaded. Refresh the page or try again later.');
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

                setCustomFields(current => {
                    if (current.length !== 1 || current[0].label.trim() !== initialContext.serviceName.trim()) {
                        return current;
                    }

                    return [{ ...current[0], label: nextContext.serviceName }];
                });
            } catch (error) {
                if (isActive) {
                    console.error('Failed to load diagnosis queue details:', error);
                    toast.error('Queue details could not be loaded. Refresh the page or try again later.');
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
    }, [initialContext]);

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
                    console.error('Diagnosis records are unavailable:', data.message || data);
                    setSchemaWarning('Diagnosis records are temporarily unavailable. Try again later or contact support.');
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
                    console.error('Failed to load the diagnosis record:', error);
                    toast.error('The diagnosis record could not be loaded. Refresh the page or try again later.');
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
        const inheritedConsents = inheritedDiagnosisConsents(context);
        if (inheritedConsents.length === 0) {
            return;
        }

        setAdditionalConsents(current => mergeUniqueConsents(inheritedConsents, current));
    }, [context, loadedDiagnosisId]);

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
            visitCharges,
            confinementPlan
        };

        persistDiagnosisDraft(draftStorageKey, draft);
    }, [
        additionalConsents,
        consentDraft,
        confinementPlan,
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
            originalName: file.name,
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
        Object.entries(medicalUploadFormFields(context, attachment.category)).forEach(([key, value]) => {
            if (value) formDataUpload.append(key, String(value));
        });

        const result = await uploadFormData(formDataUpload);

        return {
            id: attachment.id,
            name: result.display_name || attachment.name,
            originalName: result.original_name || attachment.originalName || attachment.name,
            storedFileName: result.stored_file_name || pathFileName(result.relative_url || result.url),
            url: result.relative_url || result.url || '',
            relativeUrl: result.relative_url || result.url || '',
            mimeType: result.mime_type || attachment.mimeType || '',
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
            let documentFile = consent.documentFile instanceof File ? consent.documentFile : null;
            if (!documentFile && consent.signatureDataUrl?.startsWith('data:image')) {
                documentFile = await buildSignedConsentDocumentFile({
                    title: consent.title,
                    content: consent.content,
                    signerName: consent.signerName || context.ownerName,
                    signedAt: consent.signedAt,
                    signatureDataUrl: consent.signatureDataUrl,
                    petName: context.petName,
                    veterinarianName
                });
            }
            const existingDocumentUrl = consent.url || consent.relativeUrl || '';
            const documentUpload = documentFile
                ? await uploadDocumentFile(documentFile, 'consent_document', {
                    returnMetadata: true,
                    formFields: medicalUploadFormFields(context, ADDITIONAL_CONSENT_CATEGORY)
                })
                : null;
            const documentUrl = documentUpload?.path || existingDocumentUrl;

            if (!documentUrl) {
                throw new Error('The complete signed consent form could not be uploaded.');
            }

            uploaded.push({
                id: consent.id || createId(),
                name: documentUpload?.displayName || consent.name || `Signed consent - ${consent.title || 'Consent Form'}.pdf`,
                originalName: documentUpload?.originalName || consent.originalName || consent.name || '',
                storedFileName: documentUpload?.storedFileName || consent.storedFileName || pathFileName(documentUrl),
                url: documentUrl,
                relativeUrl: documentUrl,
                mimeType: 'application/pdf',
                uploadedAt: consent.uploadedAt || new Date().toISOString(),
                category: ADDITIONAL_CONSENT_CATEGORY,
                templateId: consent.templateId || '',
                title: consent.title || 'Consent Form',
                content: consent.content || '',
                signerName: consent.signerName || context.ownerName || 'Pet owner',
                signedAt: consent.signedAt || new Date().toISOString(),
                signatureUrl: consent.signatureUrl || ''
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

    const addAdditionalConsent = async () => {
        if (!selectedConsentTemplate) {
            toast.error('Select a consent form first.');
            return false;
        }

        if (!consentDraft.signature) {
            toast.error('Pet owner signature is required for the selected consent form.');
            return false;
        }

        const signedAt = new Date().toISOString();
        const title = selectedConsentTemplate.title || 'Consent Form';
        try {
            const documentFile = await buildSignedConsentDocumentFile({
                title,
                content: selectedConsentTemplate.content,
                signerName: context.ownerName || 'Pet owner',
                signedAt,
                signatureDataUrl: consentDraft.signature,
                petName: context.petName,
                veterinarianName
            });
            const documentPreviewUrl = URL.createObjectURL(documentFile);

            setAdditionalConsents(current => [
                ...current,
                {
                    id: createId(),
                    name: `Signed consent - ${title}.pdf`,
                    category: ADDITIONAL_CONSENT_CATEGORY,
                    templateId: selectedConsentTemplate.id,
                    title,
                    content: selectedConsentTemplate.content,
                    signerName: context.ownerName || 'Pet owner',
                    signedAt,
                    signatureDataUrl: consentDraft.signature,
                    documentFile,
                    documentDataUrl: documentPreviewUrl,
                    preview: documentPreviewUrl,
                    mimeType: 'application/pdf'
                }
            ]);
            setConsentDraft(current => ({ ...current, signature: null }));
            return true;
        } catch (error) {
            console.error('Failed to generate the signed consent form:', error);
            toast.error('The signed consent form could not be generated. Please try again.');
            return false;
        }
    };

    const removeAdditionalConsent = (id) => {
        setAdditionalConsents(current => {
            const removed = current.find(consent => consent.id === id);
            const previewUrl = removed?.documentDataUrl || removed?.preview || '';
            if (previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
            return current.filter(consent => consent.id !== id);
        });
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
        const materialCharges = (service.materials || [])
            .filter((material) => material.billablePolicy !== 'optional')
            .map((material) => ({
            id: createId(),
            chargeType: 'consumable',
            serviceId: service.serviceId,
            itemId: material.itemId,
            description: `${material.itemName}${material.billablePolicy === 'included' ? ' (included)' : ''}`,
            quantity: Number(material.qtyUsed) || 1,
            unitPrice: material.billablePolicy === 'separate' ? Number(material.sellingPrice) || 0 : 0,
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

        setCustomFields(current => [
            ...current,
            createCustomSection(selectedCustomService.serviceName, selectedCustomService.serviceId)
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
            console.error('Failed to print the prescription:', error);
            toast.error('The prescription could not be printed. Please try again.');
        }
    };

    const handleSaveDiagnosis = async ({ printAfterSave = false, stayAfterSave = false } = {}) => {
        if (!veterinarianUserId) {
            toast.error('Your veterinarian session could not be identified. Log in again before saving this diagnosis.');
            return false;
        }

        if (!context.petId) {
            toast.warning('Pet information is missing from this diagnosis. Return to My List and reopen the patient.');
            return false;
        }

        if (diagnosisType === 'general' && !formData.diagnosis.trim()) {
            reportBookingFormErrors([{
                fieldId: 'vet-diagnosis-primary',
                label: 'Diagnosis',
                type: 'missing',
                message: 'Enter the primary diagnosis before saving.'
            }]);
            return false;
        }

        if (confinementPlan.requested) {
            const confinementErrors = [];
            if (!confinementPlan.expectedDischarge) {
                confinementErrors.push({ fieldId: 'vet-confinement-discharge', label: 'Expected discharge', type: 'missing', message: 'Choose the expected discharge date.' });
            }
            if (!confinementPlan.reason.trim()) {
                confinementErrors.push({ fieldId: 'vet-confinement-reason', label: 'Clinical reason', type: 'missing', message: 'Enter why the pet needs confinement.' });
            }
            if (reportBookingFormErrors(confinementErrors)) return false;
        }

        const autoAddedCustomSection = diagnosisType === 'custom' && selectedCustomService
            ? createCustomSection(selectedCustomService.serviceName, selectedCustomService.serviceId)
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
            reportBookingFormErrors([{
                fieldId: 'vet-custom-diagnosis-service',
                label: 'Custom diagnosis service',
                type: 'selection',
                message: 'Select at least one custom diagnosis service.'
            }]);
            return false;
        }

        const hasVaccinationDetails = hasVaccinationRecordContent(vaccinationRecord);
        const shouldSaveVaccinationRecord = shouldRecordVaccination && hasVaccinationDetails;
        if (shouldRecordVaccination && hasVaccinationDetails && (!vaccinationRecord.vaccineName.trim() || !vaccinationRecord.dateAdministered || !vaccinationRecord.nextDueDate)) {
            const vaccinationErrors = [];
            if (!vaccinationRecord.vaccineName.trim()) {
                vaccinationErrors.push({ fieldId: 'vet-vaccination-name', label: 'Vaccine name', type: 'missing', message: 'Enter the vaccine name.' });
            }
            if (!vaccinationRecord.dateAdministered) {
                vaccinationErrors.push({ fieldId: 'vet-vaccination-date-administered', label: 'Date administered', type: 'missing', message: 'Select the date administered.' });
            }
            if (!vaccinationRecord.nextDueDate) {
                vaccinationErrors.push({ fieldId: 'vet-vaccination-next-due-date', label: 'Next due date', type: 'missing', message: 'Select the next due date.' });
            }
            reportBookingFormErrors(vaccinationErrors);
            return false;
        }
        if (shouldSaveVaccinationRecord && vaccinationRecord.nextDueDate < vaccinationRecord.dateAdministered) {
            reportBookingFormErrors([{
                fieldId: 'vet-vaccination-next-due-date',
                label: 'Next due date',
                type: 'range',
                message: 'Next due date cannot be earlier than the date administered.'
            }]);
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
                confinement: confinementPlan.requested
                    ? {
                        requested: true,
                        facility_type: confinementPlan.facilityType,
                        room_size: confinementPlan.roomSize,
                        expected_discharge: confinementPlan.expectedDischarge,
                        reason: confinementPlan.reason,
                        care_instructions: confinementPlan.careInstructions
                    }
                    : { requested: false },
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
            toast.success(data.confinement
                ? 'Diagnosis saved. Clinical Confinement is pending owner approval and room assignment in Boarding.'
                : 'Diagnosis saved and patient marked done.');
            if (printAfterSave) {
                printPrescriptionFromCurrentForm();
            }
            if (!stayAfterSave) {
                goBackToMyList();
            }
            return true;
        } catch (error) {
            console.error('Failed to save the diagnosis:', error);
            toast.error(error.message || 'The diagnosis could not be saved. Review the details and try again.');
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
        <div className="mx-auto max-w-7xl space-y-4">
            <DashboardPageHeader
                icon={Stethoscope}
                title="Diagnosis"
                description="Record the examination, assessment, treatment, prescription, and follow-up in one clinical workflow."
                meta={loadedDiagnosisId ? (
                    <Badge className="border-0 bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300">Saved clinical record</Badge>
                ) : null}
                navigation={(
                    <Button type="button" variant="ghost" size="sm" onClick={goBackToMyList} className="-ml-2 w-fit gap-2">
                        <ArrowLeft className="size-4" />
                        Back to My List
                    </Button>
                )}
            />

            <PatientVisitSummary
                context={context}
                sourceUploads={sourceUploads}
                consentUploads={consentUploads}
                additionalConsents={additionalConsents}
                consentForms={consentFormsForDisplay}
                boardingDocumentUploads={boardingDocumentUploads}
                onPreview={setPreviewImage}
            />

            {schemaWarning && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                    {schemaWarning}
                </div>
            )}

            {isLoadingRecord && (
                <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                    <Loader2 className="mr-2 inline size-4 animate-spin text-[#155dfc]" />
                    Loading saved diagnosis details...
                </div>
            )}

            {isLoadingContext && (
                <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm font-semibold text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-300">
                    <Loader2 className="mr-2 inline size-4 animate-spin" />
                    Loading latest pet, booking, and upload details...
                </div>
            )}

            <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 md:flex-row md:items-center md:justify-between">
                <div>
                    <Label className="text-sm font-bold text-slate-900 dark:text-slate-100">Form type</Label>
                    <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                        {diagnosisType === 'general'
                            ? 'Standard medical or surgical examination.'
                            : 'Service-specific diagnosis blocks and records.'}
                    </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="Diagnosis form type">
                    <DiagnosisTypeButton
                        active={diagnosisType === 'general'}
                        icon={Stethoscope}
                        title="General diagnosis"
                        description="Use standard exam fields, vital signs, diagnosis, treatment, and prescription."
                        onClick={() => setDiagnosisType('general')}
                    />
                    <DiagnosisTypeButton
                        active={diagnosisType === 'custom'}
                        icon={FileText}
                        title="Custom service"
                        description="Add one or more service-specific diagnosis blocks with symptoms, prescription, and uploads."
                        onClick={() => setDiagnosisType('custom')}
                    />
                </div>
            </section>

            {diagnosisType === 'general' ? (
                <>
                    <DiagnosisProgress formData={formData} />
                    <GeneralDiagnosisForm
                        formData={formData}
                        currentPrescription={currentPrescription}
                        setCurrentPrescription={setCurrentPrescription}
                        updateForm={updateForm}
                        updateVitalSign={updateVitalSign}
                        addPrescription={addPrescription}
                        removePrescription={removePrescription}
                    />
                </>
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

            <ConfinementDispositionSection
                plan={confinementPlan}
                setPlan={setConfinementPlan}
            />

            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <button
                    type="button"
                    className="flex w-full items-center justify-between gap-4 p-4 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 dark:hover:bg-slate-800/70"
                    onClick={() => setShowAdditionalRecords(current => !current)}
                    aria-expanded={showAdditionalRecords}
                    aria-controls="diagnosis-additional-records"
                >
                    <span className="flex min-w-0 items-center gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[#155dfc] dark:bg-blue-950/50 dark:text-blue-300">
                            <ClipboardCheck className="size-5" />
                        </span>
                        <span>
                            <span className="block text-sm font-bold text-slate-900 dark:text-slate-100">Additional records</span>
                            <span className="mt-0.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
                                Vaccination, consent, charges, uploads, and reference documents.
                            </span>
                        </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                        {contextIsVaccination && (
                            <Badge className="hidden border-0 bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 sm:inline-flex">
                                Vaccination visit
                            </Badge>
                        )}
                        <ChevronDown className={`size-5 text-slate-400 transition-transform ${showAdditionalRecords ? 'rotate-180' : ''}`} />
                    </span>
                </button>

                {showAdditionalRecords && (
                    <div id="diagnosis-additional-records" className="space-y-4 border-t border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-950/30">
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
                    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <Label className="text-sm font-bold text-slate-900 dark:text-slate-100">Diagnosis Uploads</Label>
                                <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
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

                    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <Label className="text-sm font-bold text-slate-900 dark:text-slate-100">Reference Documents</Label>
                                <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
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
                    </div>
                )}
            </section>

            <div className="flex flex-col-reverse gap-3 rounded-xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/95 sm:flex-row sm:justify-between lg:sticky lg:bottom-4 lg:z-20">
                <Button type="button" variant="outline" onClick={handleCancel} disabled={isSaving} className="sm:w-auto">
                    Cancel
                </Button>
                <div className="flex flex-col gap-3 sm:flex-row">
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
                        id="vet-vaccination-name"
                        label="Vaccine Name"
                        required
                        value={record.vaccineName}
                        placeholder="Example: Rabies, 5-in-1, DHPP"
                        onChange={(value) => updateRecord('vaccineName', value)}
                    />
                    <InputBlock
                        id="vet-vaccination-date-administered"
                        label="Date Administered"
                        required
                        type="date"
                        value={record.dateAdministered}
                        onChange={(value) => updateRecord('dateAdministered', value)}
                    />
                    <InputBlock
                        id="vet-vaccination-next-due-date"
                        label="Next Due Date"
                        required
                        type="date"
                        value={record.nextDueDate}
                        min={record.dateAdministered || undefined}
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
                                                    placeholder="Reaction or batch notes"
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
    const submitSignedConsent = async () => {
        const wasAdded = await addAdditionalConsent();
        if (!wasAdded) {
            return;
        }
        setShowTemplatePreview(false);
        setIsSheetOpen(false);
    };

    const cancelSignatureCapture = () => {
        setDraft(current => ({ ...current, signature: null }));
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
                                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={cancelSignatureCapture}
                                            className="w-full sm:w-auto"
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            type="button"
                                            onClick={submitSignedConsent}
                                            disabled={!selectedTemplate || !draft.signature}
                                            className="w-full bg-[#155dfc] text-white hover:bg-[#0d4acf] sm:min-w-40 sm:w-auto"
                                        >
                                            <Upload className="size-4" />
                                            Submit Signature
                                        </Button>
                                    </div>
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
                            <AdditionalConsentCard
                                key={consent.id}
                                consent={consent}
                                ownerName={ownerName}
                                onPreview={onPreview}
                                onRemove={consent.sourceConsent ? null : () => removeAdditionalConsent(consent.id)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}

function AdditionalConsentCard({ consent, ownerName, onPreview, onRemove }) {
    const [isOpening, setIsOpening] = useState(false);
    const signatureOnlyPaths = new Set([
        consent.signatureDataUrl,
        consent.signatureUrl
    ].filter(Boolean));
    const candidateDocumentPath = consent.documentDataUrl
        || consent.documentPath
        || consent.document_path
        || consent.signedDocumentPath
        || consent.signed_document_path
        || consent.url
        || consent.relativeUrl
        || consent.preview
        || '';
    const documentPath = signatureOnlyPaths.has(candidateDocumentPath) ? '' : candidateDocumentPath;
    const {
        source,
        isPdf,
        isLoading,
        isUnavailable
    } = useConsentDocumentSource({
        ...consent,
        documentPath,
        legacySignaturePath: consent.signatureDataUrl || consent.signatureUrl || ''
    });
    const title = consent.title || consent.name || 'Signed consent';

    const handleView = async () => {
        if (!source || isOpening) return;
        if (!isPdf) {
            onPreview?.({ src: source, alt: `${title} complete signed form` });
            return;
        }

        setIsOpening(true);
        try {
            await openProtectedDocument(source);
        } catch (error) {
            console.error('Failed to open the signed consent form:', error);
            toast.error('The signed consent form could not be opened. Please try again.');
        } finally {
            setIsOpening(false);
        }
    };

    return (
        <div className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
            <div className="flex h-32 items-center justify-center bg-white">
                {source ? (
                    isPdf ? (
                        <div className="text-center text-slate-400">
                            <FileText className="mx-auto mb-2 size-8" />
                            <p className="text-xs font-bold">Signed consent PDF</p>
                        </div>
                    ) : source.startsWith('data:') || source.startsWith('blob:') ? (
                        <UploadImagePreview
                            src={source}
                            alt={`${title} complete signed form`}
                            onPreview={(nextSource) => onPreview?.({ src: nextSource, alt: `${title} complete signed form` })}
                            imageClassName="h-full w-full object-contain"
                        />
                    ) : (
                        <ProtectedImage
                            src={source}
                            alt={`${title} complete signed form`}
                            className="h-full w-full object-contain"
                            fallbackClassName="h-full w-full"
                        />
                    )
                ) : isLoading ? (
                    <div className="flex flex-col items-center gap-2 text-xs font-semibold text-slate-400">
                        <Loader2 className="size-5 animate-spin" />
                        Building full form
                    </div>
                ) : (
                    <p className="px-3 text-center text-xs font-semibold text-amber-700">
                        Complete consent preview unavailable
                    </p>
                )}
            </div>
            <div className="space-y-3 p-3">
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                        <p className="truncate text-sm font-black text-slate-900">{title}</p>
                        <p className="mt-1 truncate text-xs font-semibold text-slate-500">
                            {consent.signerName || ownerName || 'Pet owner'} {consent.signedAt ? `- ${formatSignedAt(consent.signedAt)}` : ''}
                        </p>
                    </div>
                    {consent.sourceConsent && <Badge className="shrink-0 border-0 bg-green-50 text-green-700">Intake</Badge>}
                </div>
                {isUnavailable && (
                    <p className="text-xs font-semibold text-amber-700">Signature-only display is disabled.</p>
                )}
                <div>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleView}
                        disabled={!source || isOpening}
                        className="h-8 w-full gap-1 text-xs"
                    >
                        {isOpening ? <Loader2 className="size-3 animate-spin" /> : <Eye className="size-3" />}
                        {isPdf ? 'Open PDF' : 'View'}
                    </Button>
                </div>
                {onRemove && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={onRemove}
                        className="h-8 w-full text-red-600 hover:bg-red-50 hover:text-red-700"
                    >
                        <Trash2 className="size-4" />
                        Remove
                    </Button>
                )}
            </div>
        </div>
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

function PatientVisitSummary({
    context,
    sourceUploads,
    consentUploads,
    additionalConsents,
    consentForms,
    boardingDocumentUploads,
    onPreview
}) {
    const weight = context.petWeight
        ? `${context.petWeight}${String(context.petWeight).toLowerCase().includes('kg') ? '' : ' kg'}`
        : '';
    const patientFacts = [context.petSpecies, context.petBreed, context.petGender, context.petAge, weight].filter(Boolean);
    const hasQueueReference = Boolean(context.queueReference || context.queueNumber);
    const visitReference = context.queueReference
        || (context.queueNumber ? formatQueueReference({ queueNumber: context.queueNumber }) : '')
        || context.bookingNumber
        || 'Not assigned';

    return (
        <section className="grid overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="flex min-w-0 flex-col gap-4 p-4 sm:flex-row sm:items-center">
                <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                    {context.petProfileImage ? (
                        <ProtectedImage
                            src={resolveFileUrl(context.petProfileImage)}
                            alt={context.petName}
                            className="h-full w-full object-cover"
                            fallbackClassName="h-full w-full"
                        />
                    ) : (
                        <PawPrint className="size-8 text-slate-400" aria-hidden="true" />
                    )}
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-xl font-bold text-slate-950 dark:text-slate-50">{context.petName}</h2>
                        <Badge className="border-0 bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">Patient</Badge>
                    </div>
                    <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                        {patientFacts.length > 0 ? patientFacts.join(' · ') : 'Patient details are not available'}
                    </p>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                        <span className="font-semibold text-slate-800 dark:text-slate-100">Owner:</span> {context.ownerName}
                        {context.ownerPhone ? <span className="text-slate-400"> · {context.ownerPhone}</span> : null}
                    </p>
                </div>
            </div>

            <div className="border-t border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-800/40 lg:border-l lg:border-t-0">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                    <div className="flex items-start gap-3">
                        <CalendarDays className="mt-0.5 size-4 shrink-0 text-[#155dfc]" aria-hidden="true" />
                        <div className="min-w-0">
                            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Visit type</p>
                            <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{context.serviceName}</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <FileText className="mt-0.5 size-4 shrink-0 text-[#155dfc]" aria-hidden="true" />
                        <div className="min-w-0">
                            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                                {hasQueueReference ? 'Queue reference' : 'Booking reference'}
                            </p>
                            <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{visitReference}</p>
                        </div>
                    </div>
                </div>
                <DiagnosisContextSidebar
                    context={context}
                    sourceUploads={sourceUploads}
                    consentUploads={consentUploads}
                    additionalConsents={additionalConsents}
                    consentForms={consentForms}
                    boardingDocumentUploads={boardingDocumentUploads}
                    onPreview={onPreview}
                />
            </div>
        </section>
    );
}

function DiagnosisProgress({ formData }) {
    const hasText = value => String(value || '').trim().length > 0;
    const hasVitalSign = Object.values(formData.vitalSigns || {}).some(hasText);
    const steps = [
        {
            id: 'diagnosis-examination',
            label: 'Examination',
            hasContent: hasVitalSign || ['chiefComplaint', 'majorSymptoms', 'symptoms', 'physicalExam'].some(key => hasText(formData[key]))
        },
        {
            id: 'diagnosis-assessment',
            label: 'Assessment',
            hasContent: hasText(formData.diagnosis) || hasText(formData.labResults)
        },
        { id: 'diagnosis-treatment', label: 'Treatment', hasContent: hasText(formData.treatment) },
        { id: 'diagnosis-prescription', label: 'Prescription', hasContent: (formData.prescription || []).length > 0 },
        { id: 'diagnosis-follow-up', label: 'Follow-up', hasContent: hasText(formData.followUp) || hasText(formData.notes) }
    ];
    const activeIndex = steps.reduce((furthest, step, index) => (step.hasContent ? index : furthest), 0);

    return (
        <nav className="overflow-x-auto rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900" aria-label="Diagnosis sections">
            <div className="mx-auto flex min-w-[620px] max-w-4xl items-start">
                {steps.map((step, index) => {
                    const reached = index <= activeIndex;
                    const active = index === activeIndex;

                    return (
                        <div key={step.id} className="contents">
                            <button
                                type="button"
                                onClick={() => document.getElementById(step.id)?.scrollIntoView({ block: 'start' })}
                                className="group flex w-24 shrink-0 flex-col items-center gap-1.5 rounded-md px-1 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                aria-current={active ? 'step' : undefined}
                            >
                                <span className={`flex size-7 items-center justify-center rounded-full border text-xs font-bold ${
                                    reached
                                        ? 'border-[#155dfc] bg-[#155dfc] text-white'
                                        : 'border-slate-300 bg-white text-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-400'
                                }`}>
                                    {index + 1}
                                </span>
                                <span className={`text-xs font-semibold ${active ? 'text-[#155dfc]' : 'text-slate-500 dark:text-slate-400'}`}>
                                    {step.label}
                                </span>
                            </button>
                            {index < steps.length - 1 && (
                                <span className={`mt-4 h-px min-w-6 flex-1 ${index < activeIndex ? 'bg-[#155dfc]' : 'bg-slate-200 dark:bg-slate-700'}`} aria-hidden="true" />
                            )}
                        </div>
                    );
                })}
            </div>
        </nav>
    );
}

function DiagnosisContextSidebar({ context, sourceUploads, consentUploads, additionalConsents, consentForms, boardingDocumentUploads, onPreview }) {
    const visibleConsentForms = consentForms || additionalConsents;

    return (
        <Sheet>
            <SheetTrigger asChild>
                <Button type="button" variant="outline" className="mt-4 w-full gap-2">
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
                                    No signed consent document found.
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
                                        <AdditionalConsentCard
                                            key={consent.id}
                                            consent={consent}
                                            ownerName={context.ownerName}
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
            aria-pressed={active}
            title={description}
            className={`flex min-h-10 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                active
                    ? 'border-[#155dfc] bg-blue-50 text-[#155dfc] dark:bg-blue-950/50 dark:text-blue-300'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-blue-800 dark:hover:text-slate-100'
            }`}
        >
            <Icon className="size-4" aria-hidden="true" />
            <span>{title}</span>
            <span className="sr-only">{description}</span>
        </button>
    );
}

function DiagnosisSection({ id, number, icon, title, description, children }) {
    const Icon = icon;

    return (
        <section id={id} className="scroll-mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <header className="flex items-start gap-3 border-b border-blue-100 bg-blue-50/70 px-4 py-3 dark:border-blue-900/50 dark:bg-blue-950/30 sm:px-5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white text-[#155dfc] shadow-sm ring-1 ring-blue-100 dark:bg-slate-900 dark:text-blue-300 dark:ring-blue-900/60">
                    <Icon className="size-5" aria-hidden="true" />
                </span>
                <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{number}. {title}</h3>
                    <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">{description}</p>
                </div>
            </header>
            <div className="space-y-5 p-4 sm:p-5">{children}</div>
        </section>
    );
}

function ConfinementDispositionSection({ plan, setPlan }) {
    const updatePlan = (field, value) => {
        setPlan(current => ({ ...current, [field]: value }));
    };
    const disposition = plan.requested ? 'confinement' : 'home';

    return (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <header className="flex items-start gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700 sm:px-5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
                    <Building2 className="size-5" aria-hidden="true" />
                </span>
                <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Visit disposition</h3>
                    <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">Choose whether the pet goes home or needs monitored confinement in Boarding.</p>
                </div>
            </header>
            <div className="space-y-4 p-4 sm:p-5">
                <Field id="vet-visit-disposition" label="After this visit">
                    <Select value={disposition} onValueChange={(value) => updatePlan('requested', value === 'confinement')}>
                        <SelectTrigger id="vet-visit-disposition">
                            <SelectValue displayValue={disposition === 'confinement' ? 'Admit to clinical confinement' : 'Send home / outpatient care'} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="home">Send home / outpatient care</SelectItem>
                            <SelectItem value="confinement">Admit to clinical confinement</SelectItem>
                        </SelectContent>
                    </Select>
                </Field>

                {plan.requested && (
                    <div className="space-y-4 rounded-xl border border-violet-200 bg-violet-50/50 p-4 dark:border-violet-900/60 dark:bg-violet-950/20">
                        <div className="grid gap-4 sm:grid-cols-3">
                            <Field id="vet-confinement-placement" label="Placement" required>
                                <Select value={plan.facilityType} onValueChange={(value) => updatePlan('facilityType', value)}>
                                    <SelectTrigger id="vet-confinement-placement"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="boarding">Confinement</SelectItem>
                                        <SelectItem value="hotel">Pet Hotel</SelectItem>
                                    </SelectContent>
                                </Select>
                            </Field>
                            <Field id="vet-confinement-room-size" label="Room size" required>
                                <Select value={plan.roomSize} onValueChange={(value) => updatePlan('roomSize', value)}>
                                    <SelectTrigger id="vet-confinement-room-size"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="small">Small</SelectItem>
                                        <SelectItem value="medium">Medium</SelectItem>
                                        <SelectItem value="large">Large</SelectItem>
                                    </SelectContent>
                                </Select>
                            </Field>
                            <InputBlock
                                id="vet-confinement-discharge"
                                label="Expected discharge"
                                required
                                type="date"
                                value={plan.expectedDischarge}
                                onChange={(value) => updatePlan('expectedDischarge', value)}
                            />
                        </div>
                        <div className="grid gap-4 lg:grid-cols-2">
                            <Field id="vet-confinement-reason" label="Clinical reason" required>
                                <Textarea
                                    id="vet-confinement-reason"
                                    value={plan.reason}
                                    onChange={(event) => updatePlan('reason', event.target.value)}
                                    placeholder="Why does the pet need monitored confinement?"
                                    className="min-h-24"
                                    maxLength={5000}
                                />
                            </Field>
                            <Field id="vet-confinement-care" label="Boarding care instructions">
                                <Textarea
                                    id="vet-confinement-care"
                                    value={plan.careInstructions}
                                    onChange={(event) => updatePlan('careInstructions', event.target.value)}
                                    placeholder="Monitoring, feeding, medication, or handling instructions"
                                    className="min-h-24"
                                    maxLength={5000}
                                />
                            </Field>
                        </div>
                        <p className="text-xs font-medium leading-5 text-violet-800 dark:text-violet-200">
                            Saving creates a pending Clinical Confinement admission in Boarding and adds the stay to this visit’s invoice. Boarding staff must capture owner consent before assigning a room.
                        </p>
                    </div>
                )}
            </div>
        </section>
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
        <div className="space-y-4">
            <DiagnosisSection
                id="diagnosis-examination"
                number="1"
                icon={Stethoscope}
                title="Patient Examination"
                description="Record the reason for the visit, clinical signs, vital signs, and examination findings."
            >
                <div className="grid gap-4 lg:grid-cols-2">
                    <Field id="vet-chief-complaint" label="Chief Complaint">
                        <Textarea
                            id="vet-chief-complaint"
                            value={formData.chiefComplaint}
                            onChange={(event) => updateForm('chiefComplaint', event.target.value)}
                            placeholder="Enter the main reason for the visit"
                            className="min-h-24"
                        />
                    </Field>
                    <Field id="vet-clinical-signs" label="Symptoms & Clinical Signs">
                        <Textarea
                            id="vet-clinical-signs"
                            value={formData.symptoms}
                            onChange={(event) => updateForm('symptoms', event.target.value)}
                            placeholder="Enter observed or reported symptoms"
                            className="min-h-24"
                        />
                    </Field>
                </div>

                <MajorSymptomsContainer
                    value={formData.majorSymptoms}
                    onChange={(value) => updateForm('majorSymptoms', value)}
                />

                <div className="space-y-3">
                    <Label className="text-sm font-bold text-slate-900 dark:text-slate-100">Vital Signs</Label>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <InputBlock
                            id="vet-temperature"
                            label="Temperature (°C)"
                            value={formData.vitalSigns.temperature}
                            placeholder="38.5"
                            restriction="decimal"
                            onChange={(value) => updateVitalSign('temperature', value)}
                        />
                        <InputBlock
                            id="vet-heart-rate"
                            label="Heart Rate (BPM)"
                            value={formData.vitalSigns.heartRate}
                            placeholder="120"
                            restriction="integer"
                            onChange={(value) => updateVitalSign('heartRate', value)}
                        />
                        <InputBlock
                            id="vet-respiratory-rate"
                            label="Respiratory Rate"
                            value={formData.vitalSigns.respiratoryRate}
                            placeholder="30"
                            restriction="integer"
                            onChange={(value) => updateVitalSign('respiratoryRate', value)}
                        />
                        <InputBlock
                            id="vet-weight"
                            label="Weight (kg)"
                            value={formData.vitalSigns.weight}
                            placeholder="12.5"
                            restriction="decimal"
                            onChange={(value) => updateVitalSign('weight', value)}
                        />
                    </div>
                </div>

                <Field id="vet-physical-exam" label="Physical Examination Findings">
                    <Textarea
                        id="vet-physical-exam"
                        value={formData.physicalExam}
                        onChange={(event) => updateForm('physicalExam', event.target.value)}
                        placeholder="Enter physical examination findings"
                        className="min-h-24"
                    />
                </Field>
            </DiagnosisSection>

            <DiagnosisSection
                id="diagnosis-assessment"
                number="2"
                icon={ClipboardCheck}
                title="Assessment & Diagnosis"
                description="Document the primary assessment and any supporting diagnostic results."
            >
                <div className="grid gap-4 lg:grid-cols-2">
                    <Field id="vet-diagnosis-primary" label="Primary Diagnosis" required>
                        <Textarea
                            id="vet-diagnosis-primary"
                            value={formData.diagnosis}
                            onChange={(event) => updateForm('diagnosis', event.target.value)}
                            placeholder="Enter the primary diagnosis"
                            className="min-h-28"
                        />
                    </Field>
                    <Field id="vet-lab-results" label="Lab & Diagnostic Results">
                        <Textarea
                            id="vet-lab-results"
                            value={formData.labResults}
                            onChange={(event) => updateForm('labResults', event.target.value)}
                            placeholder="Summarize laboratory or diagnostic findings"
                            className="min-h-28"
                        />
                    </Field>
                </div>
            </DiagnosisSection>

            <DiagnosisSection
                id="diagnosis-treatment"
                number="3"
                icon={FileText}
                title="Treatment Plan"
                description="Record treatment, procedures, and care instructions for this visit."
            >
                <Field id="vet-treatment-plan" label="Treatment / Procedure">
                    <Textarea
                        id="vet-treatment-plan"
                        value={formData.treatment}
                        onChange={(event) => updateForm('treatment', event.target.value)}
                        placeholder="Enter treatment, procedure, or care instructions"
                        className="min-h-28"
                    />
                </Field>
            </DiagnosisSection>

            <DiagnosisSection
                id="diagnosis-prescription"
                number="4"
                icon={Pill}
                title="Prescription & Medications"
                description="Add prescribed items, frequency, duration, and instructions."
            >
                <PrescriptionEditor
                    currentPrescription={currentPrescription}
                    setCurrentPrescription={setCurrentPrescription}
                    prescriptions={formData.prescription}
                    addPrescription={addPrescription}
                    removePrescription={removePrescription}
                    embedded
                />
            </DiagnosisSection>

            <DiagnosisSection
                id="diagnosis-follow-up"
                number="5"
                icon={CalendarDays}
                title="Follow-up"
                description="Set the next visit date and record reminders or additional instructions."
            >
                <div className="grid gap-4 lg:grid-cols-[minmax(220px,0.7fr)_minmax(0,1.3fr)]">
                    <InputBlock
                        id="vet-follow-up-date"
                        label="Follow-up Date"
                        type="date"
                        value={formData.followUp}
                        onChange={(value) => updateForm('followUp', value)}
                    />
                    <Field id="vet-follow-up-notes" label="Follow-up Notes">
                        <Textarea
                            id="vet-follow-up-notes"
                            value={formData.notes}
                            onChange={(event) => updateForm('notes', event.target.value)}
                            placeholder="Enter follow-up details or reminders"
                            className="min-h-20"
                        />
                    </Field>
                </div>
            </DiagnosisSection>
        </div>
    );
}

function MajorSymptomsContainer({ value, onChange }) {
    return (
        <div className="space-y-2">
            <Label htmlFor="vet-major-symptoms" className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Major / Urgent Symptoms
            </Label>
            <Textarea
                id="vet-major-symptoms"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder="Record urgent symptoms that need close attention"
                className="min-h-20 border-amber-200 bg-amber-50/40 focus-visible:ring-amber-500 dark:border-amber-900/60 dark:bg-amber-950/20"
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
    const prescriptionItems = rows.map((row, index) => `
        <article class="prescription-item">
            <div class="prescription-label">${String(index + 1).padStart(2, '0')} / ${escapeHtml(row.section)}</div>
            <strong>${escapeHtml(formatPrescriptionLine(row.prescription))}</strong>
            ${row.prescription.instructions ? `<p class="instructions">Instructions: ${escapeHtml(row.prescription.instructions)}</p>` : ''}
        </article>
    `).join('');

    return `<!doctype html>
<html>
<head>
    <meta charset="utf-8" />
    <title>Prescription - ${escapeHtml(context.petName || 'Patient')}</title>
    <style>
        @page { size: 58mm 297mm; margin: 0; }
        * { box-sizing: border-box; }
        html, body { width: 58mm; min-width: 58mm; margin: 0; padding: 0; background: #fff; }
        body {
            color: #0f172a;
            font-family: Arial, sans-serif;
            font-size: 7pt;
            line-height: 1.35;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        .sheet { width: 58mm; margin: 0; padding: 0 5mm 5mm; overflow: hidden; }
        .header { margin: 0 -5mm; padding: 5mm 5mm 4mm; background: #155dfc; color: #fff; text-align: center; }
        .brand { font-size: 12pt; font-weight: 800; line-height: 1; letter-spacing: .04em; }
        .clinic { margin-top: 1.2mm; font-size: 7.5pt; font-weight: 800; }
        .document-type { margin-top: 1mm; font-size: 6pt; letter-spacing: .08em; }
        .title { padding: 5mm 0 3mm; text-align: center; }
        .title h1 { margin: 0; font-size: 10pt; }
        .title p { margin: 1.5mm 0 0; color: #475569; font-size: 6.5pt; font-weight: 700; }
        .rule { border: 0; border-top: .2mm dashed #94a3b8; margin: 0 0 3mm; }
        .grid { margin-bottom: 3mm; }
        .field { display: flex; align-items: flex-start; justify-content: space-between; gap: 3mm; padding: 1mm 0; }
        .label { flex: 0 0 auto; color: #475569; font-size: 6.4pt; font-weight: 800; text-transform: uppercase; }
        .value { min-width: 0; text-align: right; color: #0f172a; font-size: 6.4pt; overflow-wrap: anywhere; }
        .section { margin-top: 3mm; }
        .section h2 { margin: 0 0 2mm; font-size: 7pt; text-transform: uppercase; letter-spacing: .05em; }
        .box { color: #334155; white-space: pre-wrap; line-height: 1.45; overflow-wrap: anywhere; }
        .prescription-item { border-top: .2mm dashed #94a3b8; padding: 2.5mm 0; break-inside: avoid; }
        .prescription-label { margin-bottom: 1.4mm; border-radius: 1mm; background: #eff6ff; padding: 1.2mm 1.5mm; color: #155dfc; font-size: 6pt; font-weight: 800; text-transform: uppercase; overflow-wrap: anywhere; }
        .prescription-item strong { display: block; font-size: 7pt; line-height: 1.4; overflow-wrap: anywhere; }
        .instructions { margin: 1.2mm 0 0; color: #475569; font-size: 6.3pt; white-space: pre-wrap; line-height: 1.45; overflow-wrap: anywhere; }
        .signature { margin-top: 8mm; }
        .line { margin-top: 8mm; border-top: .2mm solid #111827; padding-top: 1.5mm; text-align: center; color: #475569; font-size: 5.8pt; font-weight: 700; }
        .footer { margin-top: 5mm; border-top: .2mm dashed #94a3b8; padding-top: 3mm; color: #64748b; font-size: 5.7pt; line-height: 1.45; text-align: center; }
    </style>
</head>
<body>
    <main class="sheet">
        <header class="header">
            <div class="brand">IPAWCUS</div>
            <div class="clinic">VETERINARY CLINIC</div>
            <div class="document-type">OFFICIAL PRESCRIPTION RECORD</div>
        </header>

        <div class="title">
            <h1>PRESCRIPTION</h1>
            <p>${escapeHtml(today)}</p>
        </div>
        <hr class="rule" />

        <section class="grid">
            <div class="field"><span class="label">Patient</span><span class="value">${escapeHtml(context.petName || 'Patient')}</span></div>
            <div class="field"><span class="label">Owner</span><span class="value">${escapeHtml(context.ownerName || 'Pet Owner')}</span></div>
            <div class="field"><span class="label">Service</span><span class="value">${escapeHtml(context.serviceName || 'Diagnosis')}</span></div>
            <div class="field"><span class="label">Veterinarian</span><span class="value">${escapeHtml(veterinarianName || 'Clinic Veterinarian')}</span></div>
            <div class="field"><span class="label">Species / Breed</span><span class="value">${escapeHtml([context.petSpecies, context.petBreed].filter(Boolean).join(' / ') || 'N/A')}</span></div>
            <div class="field"><span class="label">License</span><span class="value">${escapeHtml(veterinarianLicense || 'N/A')}</span></div>
        </section>
        <hr class="rule" />

        ${diagnosisText ? `<section class="section">
            <h2>Diagnosis Summary</h2>
            <div class="box">${escapeHtml(diagnosisText)}</div>
        </section>` : ''}

        <section class="section">
            <h2>Prescriptions</h2>
            ${prescriptionItems}
        </section>

        ${notes ? `<section class="section"><h2>Notes</h2><div class="box">${escapeHtml(notes)}</div></section>` : ''}

        <section class="signature">
            <div class="line">Veterinarian Signature</div>
            <div class="line">Owner's Electronic Signature over Printed Name</div>
        </section>

        <footer class="footer">Generated by iPawcus from the diagnosis record.</footer>
    </main>
</body>
</html>`;
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

async function uploadPrescriptionDocument(payload) {
    const rows = collectPrescriptionRows(payload.generalPrescriptions, payload.customSections);
    if (rows.length === 0) {
        return null;
    }

    const file = await createPrescriptionDocumentPdfFile({ ...payload, rows });
    const documentUpload = await uploadDocumentFile(file, 'prescription_document', {
        returnMetadata: true,
        formFields: medicalUploadFormFields(payload.context || {}, 'prescription_document')
    });
    const documentUrl = documentUpload.path;

    return {
        id: createId(),
        name: documentUpload.displayName || file.name,
        originalName: documentUpload.originalName || file.name,
        storedFileName: documentUpload.storedFileName || pathFileName(documentUrl),
        url: documentUrl,
        relativeUrl: documentUrl,
        mimeType: 'application/pdf',
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
    removePrescription,
    embedded = false
}) {
    const updatePrescriptionInput = (field, value) => {
        setCurrentPrescription(current => ({ ...current, [field]: value }));
    };

    return (
        <div className={`space-y-4 ${embedded ? '' : 'rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/40'}`}>
            {!embedded && <Label className="text-sm font-bold text-slate-900 dark:text-slate-100">{title}</Label>}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(190px,1.5fr)_90px_150px_90px_140px]">
                <div className="space-y-2 sm:col-span-2 xl:col-span-1">
                    <Label className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Medicine / Item</Label>
                    <Input
                        value={currentPrescription.medicine}
                        onChange={(event) => updatePrescriptionInput('medicine', event.target.value)}
                        placeholder="e.g. Amoxicillin 500mg"
                        aria-label="Medicine or item"
                        className="bg-white dark:bg-slate-900"
                    />
                </div>
                <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Times</Label>
                    <Input
                        type="number"
                        min="0"
                        value={currentPrescription.times}
                        onChange={(event) => updatePrescriptionInput('times', parseNonNegativeNumber(event.target.value, 1))}
                        placeholder="1"
                        aria-label="Number of times"
                        className="bg-white dark:bg-slate-900"
                    />
                </div>
                <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Frequency</Label>
                    <Select
                        value={currentPrescription.frequency}
                        onValueChange={(value) => updatePrescriptionInput('frequency', value)}
                    >
                        <SelectTrigger className="bg-white dark:bg-slate-900" aria-label="Prescription frequency">
                            <SelectValue placeholder="Frequency" />
                        </SelectTrigger>
                        <SelectContent>
                            {PRESCRIPTION_FREQUENCIES.map(option => (
                                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Duration</Label>
                    <Input
                        type="number"
                        min="0"
                        value={currentPrescription.durationNumber}
                        onChange={(event) => updatePrescriptionInput('durationNumber', parseNonNegativeNumber(event.target.value, 0))}
                        placeholder="1"
                        aria-label="Prescription duration"
                        className="bg-white dark:bg-slate-900"
                    />
                </div>
                <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Duration Unit</Label>
                    <Select
                        value={currentPrescription.durationUnit}
                        onValueChange={(value) => updatePrescriptionInput('durationUnit', value)}
                    >
                        <SelectTrigger className="bg-white dark:bg-slate-900" aria-label="Prescription duration unit">
                            <SelectValue placeholder="Unit" />
                        </SelectTrigger>
                        <SelectContent>
                            {PRESCRIPTION_DURATION_UNITS.map(option => (
                                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1 space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Instructions / Notes</Label>
                    <Textarea
                        value={currentPrescription.instructions}
                        onChange={(event) => updatePrescriptionInput('instructions', event.target.value)}
                        placeholder="Enter dosage instructions or notes for the owner"
                        aria-label="Prescription instructions or notes"
                        className="min-h-20 bg-white dark:bg-slate-900"
                    />
                </div>
                <Button type="button" onClick={addPrescription} className="gap-2 bg-[#155dfc] text-white hover:bg-[#0d4acf] sm:mb-0.5">
                    <Plus className="size-4" />
                    Add Medication
                </Button>
            </div>

            {prescriptions.length > 0 && (
                <div className="space-y-2">
                    {prescriptions.map(prescription => (
                        <div key={prescription.id} className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                    <Pill className="mr-1 inline size-4 text-slate-400" />
                                    {formatPrescriptionLine(prescription)}
                                </p>
                                {prescription.instructions && (
                                    <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{prescription.instructions}</p>
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
                        <SelectTrigger id="vet-custom-diagnosis-service" className="bg-white" aria-label="Custom diagnosis service">
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
                                                    placeholder="Service findings"
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
    const [isDownloading, setIsDownloading] = useState(false);
    const [isOpening, setIsOpening] = useState(false);
    const rawSource = attachment.documentDataUrl
        || attachment.preview
        || attachment.url
        || attachment.relativeUrl
        || '';
    const previewSrc = rawSource?.startsWith('data:') || rawSource?.startsWith('blob:')
        ? rawSource
        : resolveFileUrl(rawSource);
    const canPreviewImage = isImageFile({ ...attachment, url: previewSrc });
    const attachmentName = attachment.name || attachment.label || 'Upload';
    const isPdf = String(attachment.mimeType || attachment.mime_type || '').toLowerCase() === 'application/pdf'
        || rawSource.split(/[?#]/)[0].toLowerCase().endsWith('.pdf');

    const handleView = async () => {
        if (!rawSource || isOpening) return;
        if (canPreviewImage) {
            onPreview?.({ src: rawSource, alt: attachmentName });
            return;
        }

        setIsOpening(true);
        try {
            await openProtectedDocument(rawSource);
        } catch (error) {
            console.error('Failed to open a diagnosis attachment:', error);
            toast.error('The attachment could not be opened. Please try again.');
        } finally {
            setIsOpening(false);
        }
    };

    const handleDownload = async () => {
        if (!rawSource || isDownloading) return;

        setIsDownloading(true);
        try {
            await downloadConsentDocument(rawSource, attachmentName);
        } catch (error) {
            console.error('Failed to download a diagnosis attachment:', error);
            toast.error('The attachment could not be downloaded. Please try again.');
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <div className="group overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="relative flex h-32 items-center justify-center bg-slate-50">
                {canPreviewImage && previewSrc ? (
                    rawSource.startsWith('data:') || rawSource.startsWith('blob:') ? (
                        <UploadImagePreview
                            src={rawSource}
                            alt={attachmentName}
                            onPreview={(nextSource) => onPreview?.({ src: nextSource, alt: attachmentName })}
                        />
                    ) : (
                        <ProtectedImage
                            src={rawSource}
                            alt={attachmentName}
                            className="h-full w-full object-cover transition group-hover:scale-105"
                            fallbackClassName="h-full w-full"
                        />
                    )
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
                <p className="truncate text-xs font-semibold text-slate-600">{attachmentName}</p>
                <div className={`grid gap-2 ${isPdf ? 'grid-cols-1' : 'grid-cols-2'}`}>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleView}
                        disabled={!rawSource || isOpening}
                        className="h-8 gap-1 text-xs"
                    >
                        {isOpening ? <Loader2 className="size-3 animate-spin" /> : <Eye className="size-3" />}
                        {isPdf ? 'Open PDF' : 'View'}
                    </Button>
                    {!isPdf && <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleDownload}
                        disabled={!rawSource || isDownloading}
                        className="h-8 gap-1 text-xs"
                    >
                        {isDownloading ? <Loader2 className="size-3 animate-spin" /> : <Download className="size-3" />}
                        Download
                    </Button>}
                </div>
            </div>
        </div>
    );
}

function Field({ id, label, required = false, children }) {
    return (
        <div className="space-y-2">
            <Label htmlFor={id} className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {label}{required ? <span className="text-red-600"> *</span> : null}
            </Label>
            {children}
        </div>
    );
}

function InputBlock({ id, label, value, onChange, placeholder = '', type = 'text', restriction, min, max, required = false }) {
    return (
        <div className="space-y-2">
            <Label htmlFor={id} className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {label}{required ? <span className="text-red-600"> *</span> : null}
            </Label>
            <Input
                id={id}
                type={type}
                required={required}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                restriction={restriction}
                min={min}
                max={max}
                className="bg-white dark:bg-slate-900"
            />
        </div>
    );
}
