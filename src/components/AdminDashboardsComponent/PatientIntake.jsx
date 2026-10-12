import { useMemo, useState } from 'react';
import {
    Activity,
    Camera,
    CheckCircle2,
    ClipboardPlus,
    Eye,
    HeartPulse,
    Loader2,
    PawPrint,
    Play,
    RefreshCw,
    Search,
    Trash2,
    UserRoundCheck
} from 'lucide-react';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { PhotoViewer } from '../../ui/photo-viewer';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { Textarea } from '../../ui/textarea';
import { toast } from '../../reusecomponent/toast.jsx';
import { clinicTodayDate, formatDisplayDateTime } from '../../lib/date';
import { resolveImageUrl } from '../../lib/image';
import { formatQueueReference } from '../../lib/referenceNumbers';
import { getServiceDisplayName } from '../../lib/serviceLabels';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { fetchAccounts } from '../../services/accountService';
import { fetchBookings, receiveBooking } from '../../services/bookingService';
import { createAndUploadConsentDocumentPdf } from '../../services/consentDocumentPdf';
import { fetchConsentFiles } from '../../services/consentFileService';
import { saveConsentFormRecord } from '../../services/consentRecordService';
import { assignQueueToVeterinarian, fetchQueues } from '../../services/queueService';
import { saveClinicalIntake, startClinicalIntake } from '../../services/clinicalIntakeService';
import { uploadDocumentFile } from '../../services/uploadService';
import DashboardPageHeader from '../shared/DashboardPageHeader.jsx';
import ConsentDocument from '../shared/ConsentDocument.jsx';
import ProtectedImage from '../shared/ProtectedImage.jsx';
import SignatureCapture from '../SignatureCapture.jsx';

const EMPTY_VITAL_SIGNS = {
    temperature: '',
    heartRate: '',
    respiratoryRate: '',
    weight: ''
};

function normalize(value) {
    return String(value || '').trim().toLowerCase();
}

function numericId(value) {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : null;
}

function veterinarianId(veterinarian) {
    return String(veterinarian?.user_id || veterinarian?.id || veterinarian?.userId || '');
}

function veterinarianName(veterinarian) {
    if (veterinarian?.veterinarian_name) return veterinarian.veterinarian_name;
    const fullName = [
        veterinarian?.first_Name || veterinarian?.firstName || veterinarian?.first_name,
        veterinarian?.last_Name || veterinarian?.lastName || veterinarian?.last_name
    ].filter(Boolean).join(' ').trim();
    const name = fullName ? `Dr. ${fullName}` : veterinarian?.mail_Address || veterinarian?.email || 'Veterinarian';
    const branchName = veterinarian?.preferred_branch_name || veterinarian?.branch_name;
    return branchName ? `${name} · ${branchName}` : name;
}

function queueConsentRecord(item) {
    const queue = item?.queue || item || {};
    const records = Array.isArray(queue.consent_records) ? queue.consent_records : [];
    const record = records.find((entry) => entry?.signed_file_path || entry?.physical_file_path) || {};
    const path = record.signed_file_path
        || record.physical_file_path
        || queue.signed_consent_document_path
        || queue.physical_consent_path
        || '';

    return path ? {
        path,
        consentRecordId: record.consent_record_id || queue.signed_consent_record_id || null,
        consentType: record.consent_type || queue.signed_consent_type || 'Owner Consent',
        signedAt: record.signed_at || queue.signed_consent_at || ''
    } : null;
}

function localDateKey(value) {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[1]}-${match[2]}-${match[3]}`;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    return [parsed.getFullYear(), String(parsed.getMonth() + 1).padStart(2, '0'), String(parsed.getDate()).padStart(2, '0')].join('-');
}

function isGrooming(value) {
    return normalize(value).includes('grooming');
}

function isBoarding(value) {
    const key = normalize(value);
    return key.includes('boarding') || key.includes('hotel');
}

function isEligibleBooking(booking, today) {
    return normalize(booking.status) === 'confirmed'
        && localDateKey(booking.date) === today
        && !booking.isOnlineConsultation
        && !isGrooming(booking.type || booking.service)
        && !isBoarding(booking.type || booking.service);
}

function isEligibleQueue(item, today) {
    return normalize(item.status) === 'in-progress'
        && localDateKey(item.queue_date || item.timestamp) === today
        && !isGrooming(item.service_name)
        && Number(item.has_active_assignment || 0) === 1;
}

function currentStaff() {
    try {
        const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
        const name = [user.firstName || user.first_Name, user.lastName || user.last_Name].filter(Boolean).join(' ').trim();
        return {
            id: user.id || user.user_id || '',
            name: name || user.email || 'Clinic staff',
            position: user.position || user.postionn || 'Admin'
        };
    } catch {
        return { id: '', name: 'Clinic staff', position: 'Admin' };
    }
}

function emptyDraft(intake = {}) {
    return {
        intakeId: intake.intakeId || '',
        status: intake.status || 'in_progress',
        chiefComplaint: intake.chiefComplaint || '',
        symptoms: intake.symptoms || '',
        majorSymptoms: intake.majorSymptoms || '',
        physicalExam: intake.physicalExam || '',
        vitalSigns: { ...EMPTY_VITAL_SIGNS, ...(intake.vitalSigns || {}) },
        attachments: Array.isArray(intake.attachments) ? intake.attachments : []
    };
}

function intakeStatusBadge(intake) {
    if (intake?.status === 'completed') {
        return <Badge className="border-0 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">Ready for diagnosis</Badge>;
    }
    if (intake?.status === 'in_progress') {
        return <Badge className="border-0 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">Undergoing physical examination</Badge>;
    }
    return <Badge className="border-0 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">Awaiting examination</Badge>;
}

function fieldAttachments(attachments, fieldKey) {
    return (attachments || []).filter((attachment) => attachment.fieldKey === fieldKey);
}

function ClinicalEvidenceField({
    id,
    label,
    value,
    onChange,
    placeholder,
    fieldKey,
    attachments,
    onUpload,
    onRemove,
    onPreview,
    uploading,
    urgent = false
}) {
    const photos = fieldAttachments(attachments, fieldKey);

    return (
        <div className="space-y-2">
            <Label htmlFor={id} className="text-sm font-bold text-slate-900 dark:text-slate-100">{label}</Label>
            <div className={`overflow-hidden rounded-lg border bg-white transition focus-within:ring-2 dark:bg-slate-950 ${urgent
                ? 'border-amber-200 focus-within:border-amber-500 focus-within:ring-amber-500/20 dark:border-amber-900'
                : 'border-slate-300 focus-within:border-blue-500 focus-within:ring-blue-500/20 dark:border-slate-700'}`}>
                <Textarea
                    id={id}
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    placeholder={placeholder}
                    className="min-h-24 resize-y rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0"
                    maxLength={10000}
                />
                <div className="border-t border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/70">
                    <div className="flex flex-wrap items-center gap-2">
                        <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 focus-within:ring-2 focus-within:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800">
                            {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Camera className="size-3.5" />}
                            {uploading ? 'Uploading...' : 'Add photo'}
                            <input
                                type="file"
                                accept="image/*"
                                multiple
                                disabled={uploading}
                                className="sr-only"
                                onChange={(event) => {
                                    onUpload(fieldKey, Array.from(event.target.files || []));
                                    event.target.value = '';
                                }}
                            />
                        </label>
                        {photos.length > 0 && <span className="text-xs font-semibold text-slate-500">{photos.length} {photos.length === 1 ? 'photo' : 'photos'}</span>}
                    </div>
                    {photos.length > 0 && (
                        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                            {photos.map((photo) => (
                                <div key={photo.id || photo.url} className="group relative size-20 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950">
                                    <button type="button" className="size-full" onClick={() => onPreview(photo)} aria-label={`Preview ${photo.name || 'examination photo'}`}>
                                        <ProtectedImage src={photo.url || photo.relativeUrl} alt={photo.name || 'Examination photo'} className="size-full object-cover" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => onRemove(photo.id)}
                                        className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-slate-950/75 text-white opacity-100 focus-visible:ring-2 focus-visible:ring-white sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                                        aria-label={`Remove ${photo.name || 'photo'}`}
                                    >
                                        <Trash2 className="size-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function VitalSignsEvidence({ draft, updateVital, attachments, onUpload, onRemove, onPreview, uploading }) {
    const photos = fieldAttachments(attachments, 'vitalSigns');
    const fields = [
        ['temperature', 'Temperature (°C)', '38.5'],
        ['heartRate', 'Heart Rate (BPM)', '120'],
        ['respiratoryRate', 'Respiratory Rate', '30'],
        ['weight', 'Weight (kg)', '12.5']
    ];

    return (
        <div className="space-y-2">
            <Label className="text-sm font-bold text-slate-900 dark:text-slate-100">Vital Signs</Label>
            <div className="overflow-hidden rounded-lg border border-slate-300 bg-white transition focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950">
                <div className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-4">
                    {fields.map(([key, label, placeholder]) => (
                        <div key={key} className="space-y-1.5">
                            <Label htmlFor={`intake-${key}`} className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</Label>
                            <Input
                                id={`intake-${key}`}
                                value={draft.vitalSigns[key]}
                                onChange={(event) => updateVital(key, event.target.value.replace(/[^0-9.]/g, ''))}
                                placeholder={placeholder}
                                inputMode="decimal"
                                className="bg-white dark:bg-slate-900"
                            />
                        </div>
                    ))}
                </div>
                <div className="border-t border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/70">
                    <div className="flex flex-wrap items-center gap-2">
                        <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 focus-within:ring-2 focus-within:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
                            {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Camera className="size-3.5" />}
                            {uploading ? 'Uploading...' : 'Add photo'}
                            <input
                                type="file"
                                accept="image/*"
                                multiple
                                disabled={uploading}
                                className="sr-only"
                                onChange={(event) => {
                                    onUpload('vitalSigns', Array.from(event.target.files || []));
                                    event.target.value = '';
                                }}
                            />
                        </label>
                        {photos.length > 0 && <span className="text-xs font-semibold text-slate-500">{photos.length} {photos.length === 1 ? 'photo' : 'photos'}</span>}
                    </div>
                    {photos.length > 0 && (
                        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                            {photos.map((photo) => (
                                <div key={photo.id || photo.url} className="group relative size-20 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-white dark:border-slate-700">
                                    <button type="button" className="size-full" onClick={() => onPreview(photo)} aria-label={`Preview ${photo.name || 'vital signs photo'}`}>
                                        <ProtectedImage src={photo.url || photo.relativeUrl} alt={photo.name || 'Vital signs photo'} className="size-full object-cover" />
                                    </button>
                                    <button type="button" onClick={() => onRemove(photo.id)} className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-slate-950/75 text-white opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100" aria-label={`Remove ${photo.name || 'photo'}`}>
                                        <Trash2 className="size-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function PatientIntake() {
    const staff = useMemo(currentStaff, []);
    const today = clinicTodayDate();
    const [queues, setQueues] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [search, setSearch] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [startingKey, setStartingKey] = useState('');
    const [selected, setSelected] = useState(null);
    const [draft, setDraft] = useState(emptyDraft());
    const [isSaving, setIsSaving] = useState(false);
    const [uploadingField, setUploadingField] = useState('');
    const [previewPhoto, setPreviewPhoto] = useState(null);
    const [consentForms, setConsentForms] = useState([]);
    const [selectedConsentId, setSelectedConsentId] = useState('');
    const [signerName, setSignerName] = useState('');
    const [signatureImage, setSignatureImage] = useState('');
    const [savedConsent, setSavedConsent] = useState(null);
    const [isSavingConsent, setIsSavingConsent] = useState(false);
    const [veterinarians, setVeterinarians] = useState([]);
    const [selectedVeterinarianId, setSelectedVeterinarianId] = useState('');
    const [isReassigning, setIsReassigning] = useState(false);

    const loadData = async ({ isAutoRefresh = false } = {}) => {
        if (!isAutoRefresh) setIsLoading(true);
        try {
            const [queueData, bookingData] = await Promise.all([fetchQueues(), fetchBookings()]);
            setQueues(Array.isArray(queueData) ? queueData : []);
            setBookings(Array.isArray(bookingData) ? bookingData : []);
        } catch (error) {
            if (!isAutoRefresh) toast.error(error.message || 'Patient Intake could not be loaded.');
        } finally {
            if (!isAutoRefresh) setIsLoading(false);
        }
    };

    useAutoRefresh(loadData);

    const loadConsentForms = async ({ isAutoRefresh = false } = {}) => {
        try {
            const data = await fetchConsentFiles();
            const forms = Array.isArray(data) ? data : [];
            setConsentForms(forms);
            setSelectedConsentId((current) => current || (forms[0]?.file_id ? String(forms[0].file_id) : ''));
        } catch (error) {
            if (!isAutoRefresh) toast.error(error.message || 'Consent templates could not be loaded.');
        }
    };

    useAutoRefresh(loadConsentForms, { intervalMs: 60000, refreshKey: 'patient-intake-consent-forms' });

    const loadVeterinarians = async ({ isAutoRefresh = false } = {}) => {
        try {
            const data = await fetchAccounts();
            setVeterinarians((Array.isArray(data?.veterinarians) ? data.veterinarians : [])
                .filter((veterinarian) => Number(veterinarian.is_active ?? 1) === 1));
        } catch (error) {
            if (!isAutoRefresh) toast.error(error.message || 'Active veterinarians could not be loaded.');
        }
    };

    useAutoRefresh(loadVeterinarians, { intervalMs: 15000, refreshKey: 'patient-intake-veterinarians' });

    const selectedConsent = useMemo(
        () => consentForms.find((form) => String(form.file_id) === String(selectedConsentId)),
        [consentForms, selectedConsentId]
    );

    const workItems = useMemo(() => {
        const queueItems = queues.filter((item) => isEligibleQueue(item, today));
        const queuedBookingIds = new Set(queueItems.map((item) => String(item.booking_id || '')).filter(Boolean));
        const bookingItems = bookings
            .filter((booking) => isEligibleBooking(booking, today))
            .filter((booking) => !queuedBookingIds.has(String(booking.id)));

        return [
            ...queueItems.map((item) => ({
                key: `queue-${item.queue_id}`,
                source: 'queue',
                queue: item,
                queueId: item.queue_id,
                bookingId: item.booking_id || null,
                reference: formatQueueReference(item),
                petId: item.pet_id,
                petName: item.pet_name || 'Unknown Pet',
                ownerName: item.owner_name || [item.first_Name, item.last_Name].filter(Boolean).join(' ') || 'Unknown Owner',
                ownerUserId: item.user_id,
                petSpecies: item.pet_species || '',
                petBreed: item.pet_breed || '',
                branchName: item.branch_name || '',
                serviceName: getServiceDisplayName(item.service_name, 'Queue'),
                scheduledAt: item.timestamp,
                veterinarianId: item.veterinarian_user_id,
                veterinarianName: item.veterinarian_name || 'Unassigned',
                intake: item.clinical_intake || null
            })),
            ...bookingItems.map((booking) => ({
                key: `booking-${booking.id}`,
                source: 'booking',
                booking,
                queueId: null,
                bookingId: booking.id,
                reference: booking.bookingNumber,
                petId: booking.petId,
                petName: booking.petName || 'Unknown Pet',
                ownerName: booking.ownerName || 'Unknown Owner',
                ownerUserId: booking.userId,
                petSpecies: booking.petSpecies || '',
                petBreed: booking.petBreed || '',
                branchName: booking.branchName || '',
                serviceName: getServiceDisplayName(booking.service || booking.type, 'Booking'),
                scheduledAt: `${booking.date} ${booking.time}`,
                veterinarianId: booking.veterinarianId,
                veterinarianName: booking.veterinarian || 'Unassigned',
                intake: null
            }))
        ].sort((left, right) => new Date(left.scheduledAt) - new Date(right.scheduledAt));
    }, [bookings, queues, today]);

    const visibleItems = useMemo(() => {
        const query = normalize(search);
        if (!query) return workItems;
        return workItems.filter((item) => normalize([
            item.reference,
            item.petName,
            item.ownerName,
            item.serviceName,
            item.veterinarianName,
            item.intake?.status
        ].join(' ')).includes(query));
    }, [search, workItems]);

    const openEditor = (item, intake) => {
        setSelected({ ...item, intake });
        setDraft(emptyDraft(intake));
        setSignerName(item.ownerName || '');
        setSignatureImage('');
        setSavedConsent(queueConsentRecord(item));
        setSelectedVeterinarianId(String(item.veterinarianId || ''));
    };

    const startExamination = async (item) => {
        if (!item.veterinarianId) {
            toast.error('Assign a veterinarian before starting the physical examination.');
            return;
        }
        if (!item.petId) {
            toast.error('Register this pet before starting the physical examination.');
            return;
        }
        if (item.intake) {
            openEditor(item, item.intake);
            return;
        }

        setStartingKey(item.key);
        try {
            let queueId = item.queueId;
            let nextItem = item;
            if (!queueId && item.bookingId) {
                const received = await receiveBooking(item.bookingId, {
                    veterinarian_user_id: item.veterinarianId,
                    veterinarian_name: item.veterinarianName,
                    service_name: item.serviceName
                });
                queueId = received?.queue?.queue_id;
                nextItem = { ...item, queueId, queue: received.queue };
            }
            if (!queueId) throw new Error('The clinic queue record could not be prepared for this patient.');

            const data = await startClinicalIntake({
                queue_id: queueId,
                booking_id: item.bookingId,
                assigned_veterinarian_user_id: item.veterinarianId
            });
            openEditor(nextItem, data.intake);
            toast.success(data.existing ? 'Physical examination reopened.' : 'Physical examination started. The patient is now visible in the veterinarian My List.');
            await loadData({ isAutoRefresh: true });
        } catch (error) {
            toast.error(error.message || 'The physical examination could not be started.');
        } finally {
            setStartingKey('');
        }
    };

    const reassignVeterinarian = async () => {
        if (!selected?.queueId || !selectedVeterinarianId) {
            toast.error('Select the veterinarian who is currently available.');
            return;
        }

        const veterinarian = veterinarians.find((item) => veterinarianId(item) === String(selectedVeterinarianId));
        if (!veterinarian) {
            toast.error('The selected veterinarian is no longer active. Refresh and choose another veterinarian.');
            return;
        }

        if (String(selected.veterinarianId || '') === String(selectedVeterinarianId)) {
            toast.info('This patient is already assigned to the selected veterinarian.');
            return;
        }

        setIsReassigning(true);
        try {
            const nextVeterinarianName = veterinarianName(veterinarian);
            const data = await assignQueueToVeterinarian({
                queue_id: selected.queueId,
                veterinarian_user_id: Number(selectedVeterinarianId),
                veterinarian_name: nextVeterinarianName,
                reason: `Reassigned during physical examination by ${staff.name}`
            });
            if (!data.success) throw new Error(data.error || data.message || 'The veterinarian could not be reassigned.');

            setSelected((current) => current ? {
                ...current,
                veterinarianId: selectedVeterinarianId,
                veterinarianName: nextVeterinarianName,
                intake: current.intake ? {
                    ...current.intake,
                    assignedVeterinarianUserId: Number(selectedVeterinarianId)
                } : current.intake,
                queue: current.queue ? {
                    ...current.queue,
                    veterinarian_user_id: Number(selectedVeterinarianId),
                    veterinarian_name: nextVeterinarianName,
                    assignment_id: data.assignment?.assignment_id || current.queue.assignment_id
                } : current.queue
            } : current);
            toast.success(`Patient reassigned to ${nextVeterinarianName}. Their My List will update automatically.`);
            await loadData({ isAutoRefresh: true });
        } catch (error) {
            toast.error(error.message || 'The veterinarian could not be reassigned.');
        } finally {
            setIsReassigning(false);
        }
    };

    const updateField = (field, value) => setDraft((current) => ({ ...current, [field]: value }));
    const updateVital = (field, value) => setDraft((current) => ({
        ...current,
        vitalSigns: { ...current.vitalSigns, [field]: value }
    }));

    const uploadPhotos = async (fieldKey, files) => {
        const images = files.filter((file) => file.type.startsWith('image/'));
        if (images.length !== files.length) toast.error('Only image files can be attached inside examination fields.');
        if (images.length === 0) return;
        setUploadingField(fieldKey);
        try {
            const uploaded = await Promise.all(images.map(async (file) => {
                const result = await uploadDocumentFile(file, 'diagnosis', {
                    returnMetadata: true,
                    formFields: {
                        pet_id: selected?.petId,
                        pet_name: selected?.petName,
                        record_label: 'Physical examination',
                        attachment_category: `intake-${fieldKey}`
                    }
                });
                return {
                    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                    fieldKey,
                    url: result.path,
                    relativeUrl: result.path,
                    name: result.originalName || file.name,
                    mimeType: result.mimeType || file.type,
                    uploadedAt: new Date().toISOString()
                };
            }));
            setDraft((current) => ({ ...current, attachments: [...current.attachments, ...uploaded] }));
        } catch (error) {
            toast.error(error.message || 'One or more examination photos could not be uploaded.');
        } finally {
            setUploadingField('');
        }
    };

    const removePhoto = (attachmentId) => {
        setDraft((current) => ({
            ...current,
            attachments: current.attachments.filter((attachment) => attachment.id !== attachmentId)
        }));
    };

    const saveSignedConsent = async () => {
        if (!selected?.queueId || !selectedConsent) {
            toast.error('Select a consent form before capturing the owner signature.');
            return;
        }
        if (!signatureImage) {
            toast.error('Ask the pet owner to sign inside the consent area first.');
            return;
        }

        setIsSavingConsent(true);
        try {
            const signedAtDate = new Date();
            const signedAtIso = signedAtDate.toISOString();
            const consentType = selectedConsent.file_name || selectedConsent.name || 'Owner Consent';
            const resolvedSignerName = signerName.trim() || selected.ownerName || 'Pet owner';
            const signedDocumentPath = await createAndUploadConsentDocumentPdf({
                title: consentType,
                content: selectedConsent.content || '',
                signatureImage,
                signerName: resolvedSignerName,
                signedAt: signedAtDate.toLocaleString(),
                veterinarianName: staff.name,
                veterinarianLicense: '',
                representativeLabel: 'Clinic staff witness',
                representativeDetail: staff.position,
                templateContext: {
                    ownerName: resolvedSignerName,
                    petName: selected.petName,
                    petSpecies: selected.petSpecies,
                    petBreed: selected.petBreed,
                    serviceName: selected.serviceName,
                    branchName: selected.branchName,
                    queueNumber: selected.reference
                }
            }, 'patient-intake-consent');
            const record = await saveConsentFormRecord({
                consent_file_id: numericId(selectedConsentId),
                consent_type: consentType,
                owner_user_id: numericId(selected.ownerUserId),
                pet_id: numericId(selected.petId),
                queue_id: numericId(selected.queueId),
                booking_id: numericId(selected.bookingId),
                service_name: selected.serviceName,
                status: 'signed',
                source: 'manual',
                signed_at: signedAtIso,
                signed_file_path: signedDocumentPath,
                signer_name: resolvedSignerName,
                processed_by_user_id: numericId(staff.id),
                processed_by_name: staff.name,
                notes: `Owner consent captured during Patient Examination by ${staff.name} (${staff.position}).`
            });

            setSavedConsent({
                path: signedDocumentPath,
                consentRecordId: record?.consent_record_id || null,
                consentType,
                signedAt: signedAtIso
            });
            setSignatureImage('');
            toast.success('Owner consent signed and attached to this examination.');
            await loadData({ isAutoRefresh: true });
        } catch (error) {
            toast.error(error.message || 'The signed owner consent could not be saved.');
        } finally {
            setIsSavingConsent(false);
        }
    };

    const persistIntake = async (status) => {
        if (!draft.intakeId) return;
        if (status === 'completed' && !savedConsent?.path) {
            toast.error('Capture and save the pet owner consent before completing the physical examination.');
            return;
        }
        setIsSaving(true);
        try {
            const data = await saveClinicalIntake({
                intake_id: draft.intakeId,
                status,
                chief_complaint: draft.chiefComplaint,
                symptoms: draft.symptoms,
                major_symptoms: draft.majorSymptoms,
                physical_exam: draft.physicalExam,
                vital_signs: draft.vitalSigns,
                attachments: draft.attachments
            });
            setDraft(emptyDraft(data.intake));
            setSelected((current) => current ? { ...current, intake: data.intake } : current);
            toast.success(data.message || 'Physical examination saved.');
            await loadData({ isAutoRefresh: true });
            if (status === 'completed') setSelected(null);
        } catch (error) {
            toast.error(error.message || 'The physical examination could not be saved.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-5">
            <DashboardPageHeader
                icon={HeartPulse}
                title="Patient Intake"
                description="Record the physical examination for assigned bookings and queue patients before veterinarian diagnosis."
                layout="stacked"
                actions={(
                    <Button type="button" variant="outline" onClick={() => loadData()} disabled={isLoading} className="gap-2">
                        {isLoading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                        Refresh
                    </Button>
                )}
            />

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                    <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search patient, owner, booking, queue, or veterinarian" leftIcon={<Search className="size-4" />} />
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                        <UserRoundCheck className="size-4" />
                        {staff.name} · {staff.position}
                    </div>
                </div>
            </div>

            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800 sm:px-5">
                    <div>
                        <h2 className="text-sm font-bold text-slate-900 dark:text-white">Today&apos;s examination worklist</h2>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Starting an examination makes the patient visible in the assigned veterinarian&apos;s My List.</p>
                    </div>
                    <Badge className="border-0 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">{visibleItems.length} patients</Badge>
                </div>
                <div className="overflow-x-auto">
                    <Table className="min-w-[900px]">
                        <TableHeader>
                            <TableRow>
                                <TableHead>Reference</TableHead>
                                <TableHead>Patient</TableHead>
                                <TableHead>Service / schedule</TableHead>
                                <TableHead>Assigned veterinarian</TableHead>
                                <TableHead>Examination</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={6} className="py-12 text-center text-sm text-slate-500"><Loader2 className="mr-2 inline size-4 animate-spin" />Loading patient intake...</TableCell></TableRow>
                            ) : visibleItems.length === 0 ? (
                                <TableRow><TableCell colSpan={6} className="py-12 text-center"><PawPrint className="mx-auto size-8 text-slate-300" /><p className="mt-2 text-sm font-semibold text-slate-500">No assigned patients are waiting for physical examination.</p></TableCell></TableRow>
                            ) : visibleItems.map((item) => (
                                <TableRow key={item.key}>
                                    <TableCell>
                                        <p className="font-bold text-slate-900 dark:text-white">{item.reference}</p>
                                        <p className="mt-0.5 text-xs text-slate-500">{item.source === 'booking' ? 'Confirmed booking' : 'Queue patient'}</p>
                                    </TableCell>
                                    <TableCell>
                                        <p className="font-semibold text-slate-900 dark:text-white">{item.petName}</p>
                                        <p className="mt-0.5 text-xs text-slate-500">{item.ownerName}</p>
                                    </TableCell>
                                    <TableCell>
                                        <p className="font-medium text-slate-800 dark:text-slate-100">{item.serviceName}</p>
                                        <p className="mt-0.5 text-xs text-slate-500">{formatDisplayDateTime(item.scheduledAt, undefined, { fallback: 'Today' })}</p>
                                    </TableCell>
                                    <TableCell className="font-medium text-slate-700 dark:text-slate-200">{item.veterinarianName}</TableCell>
                                    <TableCell>{intakeStatusBadge(item.intake)}</TableCell>
                                    <TableCell className="text-right">
                                        <Button type="button" size="sm" onClick={() => startExamination(item)} disabled={startingKey === item.key} className="gap-2 bg-[#155dfc] text-white hover:bg-[#0d4acf]">
                                            {startingKey === item.key ? <Loader2 className="size-3.5 animate-spin" /> : item.intake ? <Eye className="size-3.5" /> : <Play className="size-3.5" />}
                                            {item.intake?.status === 'completed' ? 'Review' : item.intake ? 'Continue' : 'Start exam'}
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </section>

            <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open && !isSaving && !isSavingConsent && !isReassigning) setSelected(null); }}>
                <DialogContent className="max-h-[94vh] max-w-5xl overflow-y-auto p-0">
                    <DialogHeader className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                        <div className="flex flex-wrap items-center gap-2">
                            <DialogTitle>Patient Examination</DialogTitle>
                            {intakeStatusBadge({ status: draft.status })}
                        </div>
                        <DialogDescription>
                            {selected?.petName} · {selected?.serviceName} · Assigned to {selected?.veterinarianName}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-5 px-5 py-4">
                        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                            <Activity className="size-4 text-blue-600" />
                            Examined by {selected?.intake?.recordedByName || staff.name}
                            <span className="text-slate-400">·</span>
                            {selected?.intake?.recordedByPosition || staff.position}
                        </div>

                        <section className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 dark:border-blue-900/60 dark:bg-blue-950/20">
                            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                                <div className="space-y-2">
                                    <Label>Assigned Veterinarian</Label>
                                    <Select
                                        value={selectedVeterinarianId}
                                        onValueChange={setSelectedVeterinarianId}
                                        disabled={isReassigning}
                                    >
                                        <SelectTrigger className="bg-white dark:bg-slate-950">
                                            <SelectValue
                                                placeholder="Select available veterinarian"
                                                displayValue={selectedVeterinarianId
                                                    ? veterinarianName(veterinarians.find((item) => veterinarianId(item) === String(selectedVeterinarianId)) || {
                                                        veterinarian_name: selected?.veterinarianName
                                                    })
                                                    : ''}
                                            />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {veterinarians.length === 0 ? (
                                                <SelectItem value="none" disabled>No active veterinarians</SelectItem>
                                            ) : veterinarians.map((veterinarian) => (
                                                <SelectItem key={veterinarianId(veterinarian)} value={veterinarianId(veterinarian)}>
                                                    {veterinarianName(veterinarian)}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={reassignVeterinarian}
                                    disabled={isReassigning || !selectedVeterinarianId || String(selected?.veterinarianId || '') === String(selectedVeterinarianId)}
                                    className="border-blue-200 bg-white text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:bg-slate-950 dark:text-blue-300"
                                >
                                    {isReassigning ? <Loader2 className="size-4 animate-spin" /> : <UserRoundCheck className="size-4" />}
                                    {isReassigning ? 'Reassigning...' : 'Reassign veterinarian'}
                                </Button>
                            </div>
                            <p className="mt-2 text-xs font-medium text-blue-700/80 dark:text-blue-300/80">
                                Use this when staffing changes. The patient moves to the newly assigned veterinarian&apos;s My List without clearing examination details.
                            </p>
                        </section>

                        <div className="grid gap-5 lg:grid-cols-2">
                            <ClinicalEvidenceField
                                id="intake-chief-complaint"
                                label="Chief Complaint"
                                value={draft.chiefComplaint}
                                onChange={(value) => updateField('chiefComplaint', value)}
                                placeholder="Enter the main reason for the visit"
                                fieldKey="chiefComplaint"
                                attachments={draft.attachments}
                                onUpload={uploadPhotos}
                                onRemove={removePhoto}
                                onPreview={setPreviewPhoto}
                                uploading={uploadingField === 'chiefComplaint'}
                            />
                            <ClinicalEvidenceField
                                id="intake-clinical-signs"
                                label="Symptoms & Clinical Signs"
                                value={draft.symptoms}
                                onChange={(value) => updateField('symptoms', value)}
                                placeholder="Enter observed or reported symptoms"
                                fieldKey="symptoms"
                                attachments={draft.attachments}
                                onUpload={uploadPhotos}
                                onRemove={removePhoto}
                                onPreview={setPreviewPhoto}
                                uploading={uploadingField === 'symptoms'}
                            />
                        </div>

                        <ClinicalEvidenceField
                            id="intake-major-symptoms"
                            label="Major / Urgent Symptoms"
                            value={draft.majorSymptoms}
                            onChange={(value) => updateField('majorSymptoms', value)}
                            placeholder="Record urgent symptoms that need close attention"
                            fieldKey="majorSymptoms"
                            attachments={draft.attachments}
                            onUpload={uploadPhotos}
                            onRemove={removePhoto}
                            onPreview={setPreviewPhoto}
                            uploading={uploadingField === 'majorSymptoms'}
                            urgent
                        />

                        <VitalSignsEvidence
                            draft={draft}
                            updateVital={updateVital}
                            attachments={draft.attachments}
                            onUpload={uploadPhotos}
                            onRemove={removePhoto}
                            onPreview={setPreviewPhoto}
                            uploading={uploadingField === 'vitalSigns'}
                        />

                        <ClinicalEvidenceField
                            id="intake-physical-findings"
                            label="Physical Examination Findings"
                            value={draft.physicalExam}
                            onChange={(value) => updateField('physicalExam', value)}
                            placeholder="Enter physical examination findings"
                            fieldKey="physicalExam"
                            attachments={draft.attachments}
                            onUpload={uploadPhotos}
                            onRemove={removePhoto}
                            onPreview={setPreviewPhoto}
                            uploading={uploadingField === 'physicalExam'}
                        />

                        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950">
                            <div className="flex flex-col gap-2 border-b border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/70 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Pet Owner Consent</h3>
                                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Capture the initial owner consent inside this examination. The veterinarian may add further consent forms during Diagnosis.</p>
                                </div>
                                {savedConsent?.path ? (
                                    <Badge className="w-fit border-0 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                                        <CheckCircle2 className="mr-1 size-3" /> Consent recorded
                                    </Badge>
                                ) : (
                                    <Badge className="w-fit border-0 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">Required before completion</Badge>
                                )}
                            </div>

                            <div className="space-y-4 p-4">
                                {savedConsent?.path && (
                                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
                                        {savedConsent.consentType} was signed and saved for this queue patient. You can capture another form below if needed.
                                    </div>
                                )}

                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label>Consent Form</Label>
                                        <Select value={selectedConsentId} onValueChange={setSelectedConsentId}>
                                            <SelectTrigger>
                                                <SelectValue
                                                    placeholder="Select consent form"
                                                    displayValue={selectedConsent?.file_name || selectedConsent?.name || ''}
                                                />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {consentForms.length === 0 ? (
                                                    <SelectItem value="none" disabled>No consent templates available</SelectItem>
                                                ) : consentForms.map((form) => (
                                                    <SelectItem key={form.file_id} value={String(form.file_id)}>
                                                        {form.file_name || form.name || 'Consent Form'}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="intake-consent-signer">Owner / Signer Name</Label>
                                        <Input
                                            id="intake-consent-signer"
                                            value={signerName}
                                            onChange={(event) => setSignerName(event.target.value)}
                                            placeholder="Pet owner full name"
                                        />
                                    </div>
                                </div>

                                {selectedConsent && (
                                    <details className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
                                        <summary className="cursor-pointer bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:bg-slate-900 dark:text-slate-200">
                                            Review consent document
                                        </summary>
                                        <div className="max-h-[420px] overflow-y-auto bg-slate-100 p-2 dark:bg-slate-900">
                                            <ConsentDocument
                                                variant="compact"
                                                title={selectedConsent.file_name || selectedConsent.name || 'Consent Form'}
                                                content={selectedConsent.content || ''}
                                                signatureImage={signatureImage}
                                                signerName={signerName.trim() || selected?.ownerName}
                                                signedAt={signatureImage ? new Date().toLocaleString() : ''}
                                                veterinarianName={staff.name}
                                                veterinarianLicense=""
                                                representativeLabel="Clinic Staff Witness"
                                                representativeDetail={staff.position}
                                                templateContext={{
                                                    ownerName: signerName.trim() || selected?.ownerName,
                                                    petName: selected?.petName,
                                                    petSpecies: selected?.petSpecies,
                                                    petBreed: selected?.petBreed,
                                                    serviceName: selected?.serviceName,
                                                    branchName: selected?.branchName,
                                                    queueNumber: selected?.reference
                                                }}
                                            />
                                        </div>
                                    </details>
                                )}

                                <div className="space-y-2">
                                    <Label>Owner Signature</Label>
                                    <SignatureCapture
                                        signature={signatureImage}
                                        onSignatureChange={setSignatureImage}
                                        disabled={!selectedConsentId || isSavingConsent}
                                    />
                                </div>

                                <div className="flex justify-end">
                                    <Button
                                        type="button"
                                        onClick={saveSignedConsent}
                                        disabled={isSavingConsent || !selectedConsent || !signatureImage}
                                        className="bg-[#155dfc] text-white hover:bg-[#0d4acf]"
                                    >
                                        {isSavingConsent ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                                        Save signed consent
                                    </Button>
                                </div>
                            </div>
                        </section>
                    </div>

                    <DialogFooter className="sticky bottom-0 border-t border-slate-200 bg-white/95 px-5 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
                        <Button type="button" variant="outline" onClick={() => persistIntake('in_progress')} disabled={isSaving || isReassigning || Boolean(uploadingField)}>
                            {isSaving ? <Loader2 className="size-4 animate-spin" /> : <ClipboardPlus className="size-4" />}
                            Save draft
                        </Button>
                        <Button type="button" onClick={() => persistIntake('completed')} disabled={isSaving || isSavingConsent || isReassigning || Boolean(uploadingField) || !savedConsent?.path} className="bg-emerald-600 text-white hover:bg-emerald-700">
                            {isSaving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                            Complete examination
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <PhotoViewer
                src={previewPhoto ? resolveImageUrl(previewPhoto.url || previewPhoto.relativeUrl) : ''}
                alt={previewPhoto?.name || 'Examination photo'}
                open={Boolean(previewPhoto)}
                onOpenChange={(open) => { if (!open) setPreviewPhoto(null); }}
            />
        </div>
    );
}
