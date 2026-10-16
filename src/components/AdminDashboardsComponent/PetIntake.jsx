import { useMemo, useState } from 'react';
import {
    AlertCircle,
    ArrowRight,
    CalendarDays,
    Camera,
    CheckCircle2,
    ChevronDown,
    ClipboardPlus,
    Clock3,
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
import CarePageHeader from '../shared/CarePageHeader.jsx';
import ConsentDocument from '../shared/ConsentDocument.jsx';
import ProtectedImage from '../shared/ProtectedImage.jsx';
import SignatureCapture from '../SignatureCapture.jsx';
import './petIntake.css';

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
        return <Badge className="border-0 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">In examination</Badge>;
    }
    return <Badge className="border-0 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">Awaiting examination</Badge>;
}

function intakeStage(item) {
    return item.intake?.status === 'completed' ? 'completed' : item.intake ? 'in_progress' : 'waiting';
}

function IntakeAction({ item, startingKey, onStart }) {
    return (
        <Button
            type="button"
            size="sm"
            variant={item.intake ? 'outline' : 'default'}
            onClick={() => onStart(item)}
            disabled={startingKey === item.key}
            aria-label={`${item.intake?.status === 'completed' ? 'Review' : item.intake ? 'Continue' : 'Start'} examination for ${item.petName}`}
            className="intake-row-action"
        >
            {startingKey === item.key ? <Loader2 className="size-4 animate-spin" /> : item.intake ? <Eye className="size-4" /> : <Play className="size-4" />}
            {item.intake?.status === 'completed' ? 'Review' : item.intake ? 'Continue' : 'Start exam'}
        </Button>
    );
}

function PetIdentity({ item }) {
    return (
        <div className="intake-pet-identity">
            <span className="intake-pet-avatar" aria-hidden="true"><PawPrint className="size-5" /></span>
            <div className="min-w-0">
                <p className="intake-pet-name">{item.petName}</p>
                <p className="intake-secondary">{item.ownerName}</p>
            </div>
        </div>
    );
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
    uploading
}) {
    const photos = fieldAttachments(attachments, fieldKey);

    return (
        <div className="space-y-2">
            <Label htmlFor={id} className="text-sm font-semibold text-slate-900 dark:text-slate-100">{label}</Label>
            <div className="overflow-hidden rounded-lg border border-slate-300 bg-white transition focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950">
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
        ['heartRate', 'Heart rate (bpm)', '120'],
        ['respiratoryRate', 'Respiratory rate (/min)', '30'],
        ['weight', 'Weight (kg)', '12.5']
    ];

    return (
        <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Vital signs</p>
            <div className="overflow-hidden rounded-lg border border-slate-300 bg-white transition focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950">
                <div className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-4">
                    {fields.map(([key, label, placeholder]) => (
                        <div key={key} className="space-y-1.5">
                            <Label htmlFor={`intake-${key}`} className="text-xs font-medium text-slate-600 dark:text-slate-400">{label}</Label>
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

export default function PetIntake() {
    const staff = useMemo(currentStaff, []);
    const today = clinicTodayDate();
    const [queues, setQueues] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [search, setSearch] = useState('');
    const [stageFilter, setStageFilter] = useState('all');
    const [sourceFilter, setSourceFilter] = useState('all');
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [lastRefreshed, setLastRefreshed] = useState(null);
    const [startingKey, setStartingKey] = useState('');
    const [selected, setSelected] = useState(null);
    const [isContextExpanded, setIsContextExpanded] = useState(false);
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
        if (!isAutoRefresh) setIsRefreshing(true);
        try {
            const [queueData, bookingData] = await Promise.all([fetchQueues(), fetchBookings()]);
            setQueues(Array.isArray(queueData) ? queueData : []);
            setBookings(Array.isArray(bookingData) ? bookingData : []);
            setLoadError('');
            setLastRefreshed(new Date());
        } catch (error) {
            setLoadError(error.message || 'Pet Intake could not be loaded.');
        } finally {
            setIsLoading(false);
            if (!isAutoRefresh) setIsRefreshing(false);
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

    useAutoRefresh(loadConsentForms, { intervalMs: 60000, refreshKey: 'pet-intake-consent-forms' });

    const loadVeterinarians = async ({ isAutoRefresh = false } = {}) => {
        try {
            const data = await fetchAccounts();
            setVeterinarians((Array.isArray(data?.veterinarians) ? data.veterinarians : [])
                .filter((veterinarian) => Number(veterinarian.is_active ?? 1) === 1));
        } catch (error) {
            if (!isAutoRefresh) toast.error(error.message || 'Active veterinarians could not be loaded.');
        }
    };

    useAutoRefresh(loadVeterinarians, { intervalMs: 15000, refreshKey: 'pet-intake-veterinarians' });

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
        return workItems.filter((item) => (stageFilter === 'all' || intakeStage(item) === stageFilter)
            && (sourceFilter === 'all' || item.source === sourceFilter)
            && (!query || normalize([
            item.reference,
            item.petName,
            item.ownerName,
            item.serviceName,
            item.veterinarianName,
            item.intake?.status
        ].join(' ')).includes(query)));
    }, [search, sourceFilter, stageFilter, workItems]);

    const stageOptions = [
        { value: 'all', label: 'All pets', icon: PawPrint, count: workItems.length },
        { value: 'waiting', label: 'Awaiting examination', icon: Clock3, count: workItems.filter((item) => intakeStage(item) === 'waiting').length },
        { value: 'in_progress', label: 'In examination', icon: HeartPulse, count: workItems.filter((item) => intakeStage(item) === 'in_progress').length },
        { value: 'completed', label: 'Ready for diagnosis', icon: CheckCircle2, count: workItems.filter((item) => intakeStage(item) === 'completed').length }
    ];
    const hasFilters = Boolean(search || stageFilter !== 'all' || sourceFilter !== 'all');
    const clearFilters = () => { setSearch(''); setStageFilter('all'); setSourceFilter('all'); };

    const openEditor = (item, intake) => {
        setSelected({ ...item, intake });
        setIsContextExpanded(false);
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
            if (!queueId) throw new Error('The clinic queue record could not be prepared for this pet.');

            const data = await startClinicalIntake({
                queue_id: queueId,
                booking_id: item.bookingId,
                assigned_veterinarian_user_id: item.veterinarianId
            });
            openEditor(nextItem, data.intake);
            toast.success(data.existing ? 'Physical examination reopened.' : 'Physical examination started. The pet is now visible in the veterinarian My List.');
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
            toast.info('This pet is already assigned to the selected veterinarian.');
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
            toast.success(`Pet reassigned to ${nextVeterinarianName}. Their My List will update automatically.`);
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
            }, 'pet-intake-consent');
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
                notes: `Owner consent captured during Pet Examination by ${staff.name} (${staff.position}).`
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
        <div className="care-workspace pet-intake space-y-5">
            <CarePageHeader
                icon={ClipboardPlus}
                title="Pet Intake"
                description="Prepare each pet for their veterinarian. Record findings, check vital signs, and capture owner consent."
                layout="stacked"
                actions={(
                    <>
                        <span className="intake-date"><CalendarDays className="size-4" aria-hidden="true" />{new Date(`${today}T12:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        <Button type="button" variant="outline" onClick={() => loadData()} disabled={isLoading || isRefreshing}>
                            <RefreshCw className={`size-4 ${isLoading || isRefreshing ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                    </>
                )}
            />

            <div className="intake-stage-filters" role="group" aria-label="Filter pets by intake status">
                {stageOptions.map((option) => {
                    const Icon = option.icon;
                    return (
                        <button key={option.value} type="button" className="intake-stage-filter" aria-pressed={stageFilter === option.value} onClick={() => setStageFilter(option.value)}>
                            <span className="intake-stage-label"><Icon className="size-4" aria-hidden="true" />{option.label}</span>
                            <span className="intake-stage-count">{isLoading ? '—' : option.count}</span>
                        </button>
                    );
                })}
            </div>

            {loadError && (
                <div className="intake-error" role="alert">
                    <AlertCircle className="size-5 shrink-0" aria-hidden="true" />
                    <div>
                        <p className="font-semibold">We couldn&apos;t update the intake list.</p>
                        <p className="mt-1 text-xs">{lastRefreshed ? 'The last loaded list is still shown. Try refreshing to get the latest updates.' : 'Check your connection and try again.'}</p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => loadData()} disabled={isRefreshing}>Try again</Button>
                </div>
            )}

            <section className="intake-worklist" aria-labelledby="intake-worklist-heading" aria-busy={isLoading}>
                <header className="intake-worklist-heading">
                    <div>
                        <h2 id="intake-worklist-heading">Today&apos;s intake list</h2>
                        <p>Assigned clinic bookings and queue arrivals, in visit order.</p>
                    </div>
                    <span className="intake-staff"><UserRoundCheck className="size-4 shrink-0" aria-hidden="true" />{staff.name}<span className="intake-secondary">{staff.position}</span></span>
                </header>

                <div className="intake-toolbar">
                    <div className="space-y-1.5">
                        <Label htmlFor="intake-search">Find a pet</Label>
                        <Input id="intake-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search pet, owner, reference, or veterinarian" leftIcon={<Search className="size-4" />} />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="intake-source">Arrival type</Label>
                        <Select value={sourceFilter} onValueChange={setSourceFilter}>
                            <SelectTrigger id="intake-source"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All arrivals</SelectItem>
                                <SelectItem value="queue">Queue arrivals</SelectItem>
                                <SelectItem value="booking">Confirmed bookings</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    {hasFilters && <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>Clear filters</Button>}
                </div>

                {isLoading ? (
                    <div className="intake-loading" role="status">
                        <span className="sr-only">Loading pet intake...</span>
                        {[1, 2, 3, 4].map((row) => <div key={row} className="intake-skeleton motion-safe:animate-pulse"><span /><span /><span /></div>)}
                    </div>
                ) : visibleItems.length === 0 ? (
                    <div className="intake-empty">
                        {loadError ? <AlertCircle className="size-8" aria-hidden="true" /> : hasFilters ? <Search className="size-8" aria-hidden="true" /> : <PawPrint className="size-8" aria-hidden="true" />}
                        <h3>{loadError ? 'The intake list is unavailable' : hasFilters ? 'No pets match these filters' : 'No pets in today’s intake list'}</h3>
                        <p>{loadError ? 'Try refreshing to load today’s assigned pets.' : hasFilters ? 'Try another name, reference, or intake status.' : 'Today’s assigned clinic bookings and queue arrivals will appear here.'}</p>
                        {hasFilters && <Button type="button" variant="outline" size="sm" onClick={clearFilters}>Clear filters</Button>}
                    </div>
                ) : (
                    <>
                        <div className="intake-desktop-list">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Pet / owner</TableHead>
                                        <TableHead>Reference</TableHead>
                                        <TableHead>Visit details</TableHead>
                                        <TableHead>Veterinarian</TableHead>
                                        <TableHead>Intake status</TableHead>
                                        <TableHead className="text-right">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {visibleItems.map((item) => (
                                        <TableRow key={item.key}>
                                            <TableCell><PetIdentity item={item} /></TableCell>
                                            <TableCell>
                                                <p className="intake-reference">{item.reference}</p>
                                                <p className="intake-secondary">{item.source === 'booking' ? 'Confirmed booking' : 'Queue arrival'}</p>
                                            </TableCell>
                                            <TableCell>
                                                <p className="font-medium">{item.serviceName}</p>
                                                <p className="intake-secondary">{formatDisplayDateTime(item.scheduledAt, undefined, { fallback: 'Today' })}</p>
                                            </TableCell>
                                            <TableCell className="font-medium">{item.veterinarianName}</TableCell>
                                            <TableCell>{intakeStatusBadge(item.intake)}</TableCell>
                                            <TableCell className="text-right">
                                                <IntakeAction item={item} startingKey={startingKey} onStart={startExamination} />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                        <ul className="intake-compact-list" aria-label="Pet intake list">
                            {visibleItems.map((item) => (
                                <li key={item.key}>
                                    <div className="intake-compact-identity"><PetIdentity item={item} />{intakeStatusBadge(item.intake)}</div>
                                    <dl className="intake-compact-details">
                                        <div><dt>Visit</dt><dd>{item.serviceName}<span className="intake-secondary">{formatDisplayDateTime(item.scheduledAt, undefined, { fallback: 'Today' })}</span></dd></div>
                                        <div><dt>Veterinarian</dt><dd>{item.veterinarianName}</dd></div>
                                    </dl>
                                    <div className="intake-compact-actions"><span className="intake-secondary"><span className="intake-reference">{item.reference}</span> · {item.source === 'booking' ? 'Booking' : 'Queue'}</span><IntakeAction item={item} startingKey={startingKey} onStart={startExamination} /></div>
                                </li>
                            ))}
                        </ul>
                    </>
                )}
                <footer className="intake-list-footer">
                    <span aria-live="polite">{isLoading ? 'Loading pets…' : `${visibleItems.length} of ${workItems.length} ${workItems.length === 1 ? 'pet' : 'pets'}`}</span>
                    <span className="flex items-center gap-1.5"><RefreshCw className="size-3" aria-hidden="true" />{loadError ? 'Update failed · try refresh' : 'Updates automatically'}</span>
                </footer>
            </section>

            <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open && !isSaving && !isSavingConsent && !isReassigning) setSelected(null); }}>
                <DialogContent className="care-workspace intake-editor max-w-6xl p-0 sm:p-0">
                    <DialogHeader className="intake-editor-header">
                        <div className="flex flex-wrap items-center gap-2">
                            <DialogTitle>Pet examination</DialogTitle>
                            {intakeStatusBadge({ status: draft.status })}
                        </div>
                        <DialogDescription>
                            Record the visit and prepare {selected?.petName || 'this pet'} for diagnosis.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="intake-editor-scroll">
                        <div className="intake-editor-layout">
                            <aside className="intake-editor-context" aria-label="Pet and care team">
                                {selected && <PetIdentity item={selected} />}
                                <Button type="button" variant="ghost" className="intake-context-toggle" aria-expanded={isContextExpanded} aria-controls="intake-pet-context-details" onClick={() => setIsContextExpanded((current) => !current)}>
                                    Pet details & care team
                                    <ChevronDown className="size-4" aria-hidden="true" />
                                </Button>
                                <div id="intake-pet-context-details" className="intake-context-supporting" data-expanded={isContextExpanded}>
                                    <dl className="intake-context-details">
                                        <div><dt>Pet details</dt><dd>{[selected?.petSpecies, selected?.petBreed].filter(Boolean).join(' · ') || 'Not recorded'}</dd></div>
                                        <div><dt>Visit reference</dt><dd className="intake-reference">{selected?.reference}</dd></div>
                                        <div><dt>Service</dt><dd>{selected?.serviceName}</dd></div>
                                        <div><dt>Examined by</dt><dd>{selected?.intake?.recordedByName || staff.name}<span className="intake-secondary">{selected?.intake?.recordedByPosition || staff.position}</span></dd></div>
                                    </dl>

                                    <section className="intake-care-team" aria-labelledby="intake-care-team-heading">
                                        <h3 id="intake-care-team-heading">Care team</h3>
                                        <div className="space-y-3">
                                            <div className="space-y-2">
                                                <Label htmlFor="intake-veterinarian">Assigned veterinarian</Label>
                                                <Select
                                                    value={selectedVeterinarianId}
                                                    onValueChange={setSelectedVeterinarianId}
                                                    disabled={isReassigning}
                                                >
                                                    <SelectTrigger id="intake-veterinarian" className="h-auto min-h-10 bg-white dark:bg-slate-950">
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
                                                className="w-full"
                                            >
                                                {isReassigning ? <Loader2 className="size-4 animate-spin" /> : <UserRoundCheck className="size-4" />}
                                                {isReassigning ? 'Reassigning...' : 'Reassign veterinarian'}
                                            </Button>
                                        </div>
                                        <p className="intake-secondary mt-3">
                                            Reassign when staffing changes. Examination details stay with this pet.
                                        </p>
                                    </section>
                                    <p className="intake-handoff-note"><ArrowRight className="size-4 shrink-0" aria-hidden="true" /><span>Completed intake is ready for the assigned veterinarian&apos;s diagnosis.</span></p>
                                </div>
                            </aside>

                            <div className="intake-editor-form">
                                <section className="intake-form-section" aria-labelledby="intake-visit-notes">
                                    <div className="intake-section-heading"><span aria-hidden="true">01</span><div><h3 id="intake-visit-notes">Visit notes</h3><p>Record the reason for the visit and any symptoms. Add photos where helpful.</p></div></div>

                                    <div className="grid gap-5 lg:grid-cols-2">
                                        <ClinicalEvidenceField
                                            id="intake-chief-complaint"
                                            label="Chief complaint"
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
                                            label="Symptoms & clinical signs"
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
                                        label="Major / urgent symptoms"
                                        value={draft.majorSymptoms}
                                        onChange={(value) => updateField('majorSymptoms', value)}
                                        placeholder="Record urgent symptoms that need close attention"
                                        fieldKey="majorSymptoms"
                                        attachments={draft.attachments}
                                        onUpload={uploadPhotos}
                                        onRemove={removePhoto}
                                        onPreview={setPreviewPhoto}
                                        uploading={uploadingField === 'majorSymptoms'}
                                    />
                                </section>

                                <section className="intake-form-section" aria-labelledby="intake-findings">
                                    <div className="intake-section-heading"><span aria-hidden="true">02</span><div><h3 id="intake-findings">Examination findings</h3><p>Enter measured vital signs and physical examination observations.</p></div></div>

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
                                        label="Physical examination findings"
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
                                </section>

                                <section className="intake-form-section" aria-labelledby="intake-owner-consent">
                                    <div className="intake-section-heading"><span aria-hidden="true">03</span><div><h3 id="intake-owner-consent">Owner consent</h3><p>Save a signed consent form before completing this examination.</p></div></div>
                                    <div>
                                        {savedConsent?.path ? (
                                            <Badge className="w-fit border-0 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                                                <CheckCircle2 className="mr-1 size-3" /> Consent recorded
                                            </Badge>
                                        ) : (
                                            <Badge className="w-fit border-0 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">Required before completion</Badge>
                                        )}
                                    </div>

                                    <div className="space-y-4">
                                        {savedConsent?.path && (
                                            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
                                                {savedConsent.consentType} was signed and saved for this pet. You can capture another form below if needed.
                                            </div>
                                        )}

                                        <div className="grid gap-4 md:grid-cols-2">
                                            <div className="space-y-2">
                                                <Label htmlFor="intake-consent-form">Consent form</Label>
                                                <Select value={selectedConsentId} onValueChange={setSelectedConsentId}>
                                                    <SelectTrigger id="intake-consent-form">
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
                                                <Label htmlFor="intake-consent-signer">Owner / signer name</Label>
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
                                            <p className="text-xs font-semibold">Owner signature</p>
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
                        </div>
                    </div>

                    <DialogFooter className="intake-editor-footer">
                        <p className="intake-secondary">{savedConsent?.path ? 'Consent recorded. Ready to complete.' : 'Save owner consent to complete. You can save a draft anytime.'}</p>
                        <Button type="button" variant="outline" onClick={() => persistIntake('in_progress')} disabled={isSaving || isSavingConsent || isReassigning || Boolean(uploadingField)}>
                            {isSaving ? <Loader2 className="size-4 animate-spin" /> : <ClipboardPlus className="size-4" />}
                            Save draft
                        </Button>
                        <Button type="button" onClick={() => persistIntake('completed')} disabled={isSaving || isSavingConsent || isReassigning || Boolean(uploadingField) || !savedConsent?.path}>
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
