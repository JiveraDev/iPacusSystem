import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ArrowLeft, Building2, Camera, CheckCircle2, ChevronDown, ClipboardList, Clock3, PawPrint, Scissors, Search, ShieldAlert, Stethoscope, Upload } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { Checkbox } from '../../ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { toast } from '../../reusecomponent/toast';
import { fetchGroomingJob, fetchGroomingJobs, updateGroomingJob, uploadGroomingPhoto } from '../../services/groomingService';
import { useDashboardUser, useNavigate } from '../dashboardRouter';
import { assignedBranchId, isBranchSelectionLocked, resolveAssignedBranch } from '../../lib/branchAccess';
import { fetchBranches } from '../../services/branchService';
import { groomingBookingReference, groomingNextStep, groomingOptionDisplay, groomingSavePayload } from '../../lib/groomingWorkflow';
import { reportBookingFormErrors } from '../../lib/bookingFormValidation';
import DashboardPageHeader from './DashboardPageHeader';
import ProtectedImage from './ProtectedImage';
import { formatDisplayDate, formatDisplayTime } from '../../lib/date';
import { PhotoViewer } from '../../ui/photo-viewer';
import { fetchServiceCatalog } from '../../services/serviceCatalogService';
import { formatPhpCurrency } from '../../lib/currency';

const STATUS = { scheduled: 'Ready to receive', checked_in: 'Received', in_progress: 'In grooming', vet_review: 'Vet review', ready: 'Awaiting payment', released: 'Paid and picked up', transferred: 'Transferred to confinement', cancelled: 'Stopped / cancelled', no_show: 'Did not arrive' };
const OUTCOMES = { pending: 'Awaiting vet assessment', resume: 'Cleared to resume', stop: 'Do not continue grooming', consultation: 'Separate consultation needed', confinement: 'Clinical confinement recommended', cancelled: 'Review closed — grooming stopped' };
const PANEL = 'rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:p-5';
const MUTED = 'text-sm text-slate-600 dark:text-slate-300';

function Extra({ title, children }) {
    return <details className="border-t border-slate-200 pt-3 dark:border-slate-700 [&[open]>summary>svg]:rotate-180">
        <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 rounded-md px-1 text-sm font-semibold hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:hover:bg-slate-800 [&::-webkit-details-marker]:hidden">{title}<ChevronDown className="size-4 shrink-0" aria-hidden="true" /></summary>
        <div className="space-y-4 pt-3">{children}</div>
    </details>;
}

function Choice({ id: providedId, label, value, onChange, options, disabled = false, required = false }) {
    const generatedId = useId();
    const id = providedId || generatedId;
    const displayValue = groomingOptionDisplay(options, value, label);
    return <div className="min-w-0 space-y-1.5"><label htmlFor={id} className="text-sm font-semibold">{label}{required ? <span className="text-red-600"> *</span> : null}</label>
        <Select value={String(value ?? '')} onValueChange={onChange} disabled={disabled}>
            <SelectTrigger id={id} aria-label={label} aria-required={required}><SelectValue placeholder="Choose an option" displayValue={displayValue} /></SelectTrigger>
            <SelectContent>{Object.entries(options).map(([key, text]) => <SelectItem key={key} value={key}>{text}</SelectItem>)}</SelectContent>
        </Select>
    </div>;
}

function Field({ id, label, value, onChange, multiline = false, required = false, ...props }) {
    const Control = multiline ? Textarea : Input;
    return <label htmlFor={id} className="block min-w-0 space-y-1.5 text-sm font-semibold"><span>{label}{required ? <span className="text-red-600"> *</span> : null}</span>
        <Control {...props} id={id} required={required} value={value ?? ''} onChange={(event) => onChange(event.target.value)} maxLength={props.maxLength ?? 3000} className="font-normal" />
    </label>;
}

function State({ value }) {
    const tone = value === 'vet_review' ? 'text-amber-800 bg-amber-50 dark:text-amber-200 dark:bg-amber-950/50'
        : ['ready', 'released'].includes(value) ? 'text-emerald-800 bg-emerald-50 dark:text-emerald-200 dark:bg-emerald-950/50'
            : ['cancelled', 'no_show'].includes(value) ? 'text-rose-800 bg-rose-50 dark:text-rose-200 dark:bg-rose-950/50'
                : value === 'transferred' ? 'text-violet-800 bg-violet-50 dark:text-violet-200 dark:bg-violet-950/50'
                    : 'text-slate-700 bg-slate-100 dark:text-slate-200 dark:bg-slate-800';
    return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}><span className="size-1.5 rounded-full bg-current" aria-hidden="true" />{STATUS[value] || value}</span>;
}

function PetAvatar({ item, className = 'size-10' }) {
    return item.pet_image
        ? <ProtectedImage src={item.pet_image} alt="" className={`${className} shrink-0 rounded-xl bg-slate-100 object-cover dark:bg-slate-800`} />
        : <span className={`${className} flex shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300`} aria-hidden="true"><PawPrint className="size-5" /></span>;
}

function GroomingProgress({ status }) {
    const steps = [
        { label: 'Received', statuses: ['checked_in', 'in_progress', 'vet_review', 'ready', 'released', 'transferred'] },
        { label: 'Grooming', statuses: ['in_progress', 'vet_review', 'ready', 'released', 'transferred'] },
        { label: 'Veterinarian', statuses: ['vet_review', 'ready', 'released', 'transferred'] },
        { label: 'Finished', statuses: ['ready', 'released', 'transferred'] },
    ];
    const activeIndex = status === 'scheduled' ? -1 : status === 'checked_in' ? 0 : status === 'in_progress' ? 1 : status === 'vet_review' ? 2 : ['ready', 'released', 'transferred'].includes(status) ? 3 : -1;
    const progress = activeIndex < 0 ? 0 : (activeIndex / (steps.length - 1)) * 100;

    return <div className="px-1" aria-label={`Grooming progress: ${STATUS[status] || status}`}>
        <div className="relative h-1 rounded-full bg-slate-200 dark:bg-slate-700">
            <span className="absolute inset-y-0 left-0 rounded-full bg-[#155dfc] transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${progress}%` }} />
        </div>
        <ol className="mt-2 grid grid-cols-4 gap-2 text-center text-[11px] font-medium">
            {steps.map((step, index) => <li key={step.label} className={index <= activeIndex ? 'text-[#155dfc] dark:text-blue-300' : 'text-slate-400 dark:text-slate-500'}>{step.label}</li>)}
        </ol>
    </div>;
}

function Photos({ photos }) {
    const [viewer, setViewer] = useState(null);

    if (!photos.length) return <p className={MUTED}>No photos have been added.</p>;

    return <>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">{photos.map((photo) => {
            const alt = photo.caption || `${photo.category} grooming photo`;
            return <figure key={photo.photo_id} className="min-w-0">
                <button type="button" className="block w-full rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900" onClick={() => setViewer({ src: photo.file_path, alt })} aria-label={`Preview ${alt}`}>
                    <ProtectedImage src={photo.file_path} alt={alt} className="aspect-square w-full rounded-lg bg-slate-100 object-contain dark:bg-slate-800" />
                </button>
                <figcaption className="mt-2 break-words text-sm"><span className="font-semibold capitalize">{photo.category}</span>{photo.caption && ` · ${photo.caption}`}</figcaption>
            </figure>;
        })}</div>
        <PhotoViewer src={viewer?.src || ''} alt={viewer?.alt || 'Grooming photo'} open={Boolean(viewer)} onOpenChange={(open) => !open && setViewer(null)} />
    </>;
}

function GroomingPhotoEvidence({ photos = [], referencePhotos = [] }) {
    const [viewer, setViewer] = useState(null);
    const imageReferences = referencePhotos.filter(path => /\.(png|jpe?g|webp)(?:$|\?)/i.test(String(path || '')));
    const latestByCategory = (category) => [...photos].reverse().find(photo => photo.category === category) || null;
    const slots = [
        {
            key: 'concern',
            label: 'Owner concern',
            hint: 'Submitted with the booking',
            source: imageReferences[0] || '',
        },
        {
            key: 'before',
            label: 'Before grooming',
            hint: 'Captured during initial receiving',
            source: latestByCategory('before')?.file_path || '',
        },
        {
            key: 'after',
            label: 'After grooming',
            hint: 'Captured before completion',
            source: latestByCategory('after')?.file_path || '',
        },
    ];

    return <>
        <div className="grid gap-3 sm:grid-cols-3">
            {slots.map(slot => (
                <figure key={slot.key} className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-800/60">
                    {slot.source ? (
                        <button type="button" className="block w-full rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" onClick={() => setViewer({ src: slot.source, alt: slot.label })}>
                            <ProtectedImage src={slot.source} alt={slot.label} className="aspect-square w-full rounded-md bg-white object-contain dark:bg-slate-900" />
                        </button>
                    ) : (
                        <div className="flex aspect-square w-full flex-col items-center justify-center rounded-md bg-white px-3 text-center text-slate-400 dark:bg-slate-900">
                            <Camera className="size-6" />
                            <span className="mt-2 text-xs font-semibold">Not added</span>
                        </div>
                    )}
                    <figcaption className="mt-2">
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{slot.label}</p>
                        <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{slot.hint}</p>
                    </figcaption>
                </figure>
            ))}
        </div>
        <PhotoViewer src={viewer?.src || ''} alt={viewer?.alt || 'Grooming evidence photo'} open={Boolean(viewer)} onOpenChange={(open) => !open && setViewer(null)} />
    </>;
}

function SelectedPhotoPreview({ file, category }) {
    const [previewUrl, setPreviewUrl] = useState('');

    useEffect(() => {
        if (!file) return undefined;

        let isActive = true;
        const objectUrl = URL.createObjectURL(file);
        Promise.resolve().then(() => {
            if (isActive) setPreviewUrl(objectUrl);
        });
        return () => {
            isActive = false;
            URL.revokeObjectURL(objectUrl);
        };
    }, [file]);

    if (!file || !previewUrl) return null;

    return <figure className="rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-800/60">
        <img src={previewUrl} alt={`Selected ${category} grooming photo preview`} className="max-h-56 w-full rounded-md object-contain" />
        <figcaption className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300">
            <span className="font-semibold capitalize">{category} photo preview</span>
            <span className="max-w-full truncate">{file.name}</span>
        </figcaption>
    </figure>;
}

function GroomingRecord({ item, mode, onClose, onUpdated, groomingServices = [], catalogMessage = '' }) {
    const navigate = useNavigate();
    const [record, setRecord] = useState(null);
    const [details, setDetails] = useState({});
    const [performer, setPerformer] = useState('');
    const [dirty, setDirty] = useState(false);
    const dirtyRef = useRef(false);
    const loadRevision = useRef(0);
    const [autoSaving, setAutoSaving] = useState(false);
    const autoSavingRef = useRef(false);
    const [autoSaveState, setAutoSaveState] = useState('idle');
    const [autoSaveRetry, setAutoSaveRetry] = useState(0);
    const autoSaveRetryTimerRef = useRef(null);
    const formFocusedRef = useRef(false);
    const [busy, setBusy] = useState(false);
    const busyRef = useRef(false);
    const [error, setError] = useState('');
    const [vetId, setVetId] = useState('');
    const [reason, setReason] = useState('');
    const [outcome, setOutcome] = useState('');
    const [reviewNotes, setReviewNotes] = useState('');
    const [confinementPlan, setConfinementPlan] = useState({ facilityType: 'boarding', roomSize: 'small', expectedDischarge: '', careInstructions: '' });
    const [photo, setPhoto] = useState(null);
    const photoRef = useRef(null);
    const [category, setCategory] = useState('');
    const [share, setShare] = useState(false);
    const [catalogSearch, setCatalogSearch] = useState('');
    const [showVetHandoff, setShowVetHandoff] = useState(false);
    const isAdmin = mode === 'admin';
    const isOwner = mode === 'owner';
    const job = record?.job;
    const closed = ['released', 'transferred', 'cancelled', 'no_show'].includes(job?.status);
    const locked = closed || job?.status === 'ready';

    const markDirty = (value) => {
        dirtyRef.current = value;
        setDirty(value);
        if (value) {
            loadRevision.current += 1;
            setAutoSaveState('pending');
        }
    };
    useEffect(() => {
        const warn = (event) => { if (dirtyRef.current) { event.preventDefault(); event.returnValue = ''; } };
        window.addEventListener('beforeunload', warn);
        return () => {
            loadRevision.current += 1;
            if (autoSaveRetryTimerRef.current) window.clearTimeout(autoSaveRetryTimerRef.current);
            window.removeEventListener('beforeunload', warn);
        };
    }, []);

    const reload = async () => {
        const revision = ++loadRevision.current;
        const next = await fetchGroomingJob(item.booking_id);
        if (revision !== loadRevision.current || dirtyRef.current) return;
        setRecord(next); setDetails(next.details); setPerformer(next.job.performed_by || ''); setError('');
        return next;
    };
    const persistDraft = useCallback(async () => {
        if (!dirtyRef.current) return true;
        if (!isAdmin || !record?.job || locked || busyRef.current || autoSavingRef.current) return false;

        const revision = loadRevision.current;
        const version = Number(record.job.version || 0);
        const detailsSnapshot = details;
        const performerSnapshot = performer;
        autoSavingRef.current = true;
        setAutoSaving(true);
        setAutoSaveState('saving');
        setError('');

        try {
            await updateGroomingJob({
                bookingId: item.booking_id,
                version,
                ...groomingSavePayload(record.job, detailsSnapshot, performerSnapshot),
            });
            const revisionIsCurrent = loadRevision.current === revision;
            setRecord((current) => current ? {
                ...current,
                job: { ...current.job, version: version + 1 },
                ...(revisionIsCurrent ? { details: detailsSnapshot } : {}),
            } : current);
            if (revisionIsCurrent) {
                dirtyRef.current = false;
                setDirty(false);
                setAutoSaveState('saved');
                if (autoSaveRetryTimerRef.current) {
                    window.clearTimeout(autoSaveRetryTimerRef.current);
                    autoSaveRetryTimerRef.current = null;
                }
            } else {
                setAutoSaveState('pending');
            }
            return true;
        } catch (saveError) {
            setError(`Changes could not be saved: ${saveError.message || 'Keep this record open while we retry.'}`);
            setAutoSaveState('error');
            if (autoSaveRetryTimerRef.current) window.clearTimeout(autoSaveRetryTimerRef.current);
            autoSaveRetryTimerRef.current = window.setTimeout(() => {
                setAutoSaveState('pending');
                setAutoSaveRetry((current) => current + 1);
            }, 4000);
            return false;
        } finally {
            autoSavingRef.current = false;
            setAutoSaving(false);
        }
    }, [details, isAdmin, item.booking_id, locked, performer, record]);
    useEffect(() => {
        if (!isAdmin || !dirty || !record || locked || busy || autoSaving || autoSaveState === 'error') return undefined;
        const timerId = window.setTimeout(() => {
            persistDraft();
        }, 800);
        return () => window.clearTimeout(timerId);
    }, [autoSaveRetry, autoSaveState, autoSaving, busy, dirty, isAdmin, locked, persistDraft, record]);
    useAutoRefresh(async () => {
        if (dirtyRef.current || busyRef.current || autoSavingRef.current || formFocusedRef.current) return;
        try { await reload(); } catch (err) { setError(err.message); throw err; }
    }, { refreshKey: `${item.booking_id}-${mode}` });

    const update = (key, value) => { setDetails((current) => ({ ...current, [key]: value, ...(['package', 'addOns'].includes(key) && current[key] !== value ? { ownerApproved: false } : {}) })); markDirty(true); };
    const act = async (payload, message, { upload = false, onSuccess = null } = {}) => {
        if (busyRef.current || autoSavingRef.current) return;
        busyRef.current = true; setBusy(true); setError('');
        loadRevision.current += 1;
        let saved = false;
        let response = null;
        try {
            if (upload) {
                const requestedCategory = category || (['in_progress', 'ready'].includes(record.job.status) ? 'after' : 'before');
                const photoCategory = ['before', 'after'].includes(requestedCategory) ? requestedCategory : 'before';
                await uploadGroomingPhoto(photo, { booking_id: item.booking_id, category: photoCategory, caption: '', share_with_owner: share ? 1 : 0 });
                setPhoto(null); setShare(false); setCategory('');
                if (photoRef.current) photoRef.current.value = '';
            } else response = await updateGroomingJob({ bookingId: item.booking_id, version: record.job.version, ...payload });
            saved = true;
            markDirty(false); setReason(''); setReviewNotes(''); setOutcome('');
            setAutoSaveState('idle');
            if (autoSaveRetryTimerRef.current) {
                window.clearTimeout(autoSaveRetryTimerRef.current);
                autoSaveRetryTimerRef.current = null;
            }
            setConfinementPlan({ facilityType: 'boarding', roomSize: 'small', expectedDischarge: '', careInstructions: '' });
            toast.success(typeof message === 'function' ? message(response) : message);
            const refreshedRecord = await reload();
            onUpdated();
            if (onSuccess) {
                try {
                    await onSuccess({ response, record: refreshedRecord });
                } catch (nextError) {
                    setError(nextError.message);
                    toast.warning(nextError.message);
                }
            }
        } catch (err) {
            const message = saved ? 'Your changes were saved, but the updated record could not be loaded. Reload the record before making more changes.' : err.message;
            setError(message);
            if (saved) toast.warning(message); else toast.error(message);
        }
        finally { busyRef.current = false; setBusy(false); }
    };
    const discard = async () => {
        if (dirty && !window.confirm('Discard your unsaved grooming changes and load the latest record?')) return;
        markDirty(false);
        setAutoSaveState('idle');
        if (autoSaveRetryTimerRef.current) {
            window.clearTimeout(autoSaveRetryTimerRef.current);
            autoSaveRetryTimerRef.current = null;
        }
        try { await reload(); } catch (err) { setError(err.message); }
    };
    const close = async () => {
        if (isAdmin && dirtyRef.current && !(await persistDraft())) return;
        if (((!isAdmin && dirty) || reason || reviewNotes || photo) && !window.confirm('Leave this grooming record? Unsaved changes will be lost.')) return;
        onClose();
    };

    const latestReview = record?.reviews?.[0];
    const field = (key, label, multiline = false, extra = {}) => <Field label={label} value={details[key]} onChange={(value) => update(key, value)} multiline={multiline} {...extra} />;
    const continueToPos = ({ response, record: refreshedRecord }) => {
        if (response?.status === 'released' || response?.pickupCompletedByPayment) {
            return;
        }
        const visitId = Number(response?.visitId || refreshedRecord?.job?.visit_id || 0);
        if (visitId <= 0) {
            throw new Error('Grooming finished, but the POS invoice could not be identified. Open Point-of-Sale and select this booking.');
        }

        localStorage.setItem('ipawcus-pos-prefill', JSON.stringify({
            message: `${item.pet_name}'s grooming invoice is ready. Full payment will complete pickup automatically.`,
            visit: {
                id: `visit-${visitId}`,
                visitId,
                source: 'database',
                sourceType: 'booking',
                bookingId: item.booking_id,
                bookingNumber: item.booking_number || '',
                branchId: item.branch_id || null,
                petName: item.pet_name || 'Grooming patient',
                ownerName: item.owner_name || 'Pet owner',
                species: item.pet_species || 'Pet',
                visitType: 'Grooming Payment',
                veterinarian: performer || 'Grooming Team',
                complaint: details.ownerRequest || details.package || 'Completed grooming service',
                billingStatus: 'unpaid',
                total: Number(refreshedRecord?.details?.agreedTotal || details.agreedTotal || 0),
                paid: 0,
                balance: Number(refreshedRecord?.details?.agreedTotal || details.agreedTotal || 0),
                status: 'Awaiting payment',
            },
            charges: [],
        }));
        navigate('/dashboard/pos');
    };
    const save = (status = job.status, { openPos = false } = {}) => act(
        groomingSavePayload(job, details, performer, status),
        status === job.status
            ? 'Grooming details saved.'
            : status === 'ready'
                ? (response) => response?.status === 'released' || response?.pickupCompletedByPayment
                    ? 'Grooming finished. The paid invoice completed pickup automatically.'
                    : 'Grooming finished. Opening the invoice in POS.'
                : `Grooming updated: ${STATUS[status].toLowerCase()}.`,
        openPos ? { onSuccess: continueToPos } : {}
    );
    const preparing = ['scheduled', 'checked_in', 'vet_review'].includes(job?.status);
    const defaultPhotoCategory = ['in_progress', 'ready'].includes(job?.status) ? 'after' : 'before';
    const photoCategory = ['before', 'after'].includes(category) ? category : defaultPhotoCategory;
    const selectedCatalogServiceIds = (Array.isArray(details.catalogServiceIds) && details.catalogServiceIds.length
        ? details.catalogServiceIds
        : details.catalogServiceId ? [details.catalogServiceId] : [])
        .map((serviceId) => String(serviceId));
    const selectedCatalogServices = selectedCatalogServiceIds
        .map((serviceId) => groomingServices.find((service) => String(service.serviceId) === serviceId))
        .filter(Boolean);
    const selectedCatalogTotal = selectedCatalogServices.reduce((total, service) => total + Number(service.basePrice || 0), 0);
    const hasUnavailableCatalogService = selectedCatalogServices.length !== selectedCatalogServiceIds.length;
    const visibleGroomingServices = groomingServices.filter((service) => `${service.serviceName} ${service.serviceCode || ''}`.toLowerCase().includes(catalogSearch.trim().toLowerCase()));
    const concernPhotos = [
        ...(record?.referencePhotos || [])
            .filter(path => /\.(png|jpe?g|webp)(?:$|\?)/i.test(String(path || '')))
            .slice(0, 1)
            .map(path => ({ photo_id: `owner-${path}`, file_path: path, category: 'owner concern', caption: 'Submitted with booking' })),
        ...(record?.photos?.filter(savedPhoto => savedPhoto.category === 'concern') || []).slice(-1),
    ].slice(0, 1);
    const hasBeforePhoto = Boolean(record?.photos?.some(savedPhoto => savedPhoto.category === 'before'));
    const hasAfterPhoto = Boolean(record?.photos?.some(savedPhoto => savedPhoto.category === 'after'));
    const nextStep = groomingNextStep(job?.status, latestReview?.outcome);
    const toggleGroomingService = (service, checked) => {
        const availableIds = new Set(groomingServices.map((candidate) => String(candidate.serviceId)));
        const currentIds = selectedCatalogServiceIds.filter((serviceId) => availableIds.has(serviceId));
        const serviceId = String(service.serviceId);
        const nextIds = checked
            ? [...new Set([...currentIds, serviceId])]
            : currentIds.filter((currentId) => currentId !== serviceId);
        const nextServices = nextIds
            .map((nextId) => groomingServices.find((candidate) => String(candidate.serviceId) === nextId))
            .filter(Boolean);
        setDetails((current) => ({
            ...current,
            catalogServiceIds: nextIds.map(Number),
            catalogServiceId: nextIds.length ? Number(nextIds[0]) : null,
            package: nextServices.map((selectedService) => selectedService.serviceName).join(', '),
            ownerApproved: false,
        }));
        markDirty(true);
    };
    const submitVetAssessment = () => {
        const validationErrors = [];
        if (!outcome) {
            validationErrors.push({ fieldId: 'grooming-review-outcome', label: 'Review outcome', type: 'selection', message: 'Choose the grooming review outcome.' });
        }
        if (!reviewNotes.trim()) {
            validationErrors.push({ fieldId: 'grooming-review-notes', label: 'Assessment and instructions', type: 'missing', message: 'Enter the veterinary assessment and instructions.' });
        }
        if (outcome === 'confinement' && !confinementPlan.expectedDischarge) {
            validationErrors.push({ fieldId: 'grooming-confinement-discharge', label: 'Expected discharge', type: 'missing', message: 'Choose the expected discharge date.' });
        }
        if (reportBookingFormErrors(validationErrors)) return;
        act({ action: 'review', outcome, notes: reviewNotes, ...confinementPlan }, outcome === 'confinement'
            ? 'Confinement request sent to Boarding for owner approval and room assignment.'
            : 'Vet assessment sent to Grooming Management.');
    };

    if (isAdmin) {
        const canStart = Boolean(selectedCatalogServices.length > 0
            && !hasUnavailableCatalogService
            && selectedCatalogServices.every((service) => Number(service.basePrice) > 0)
            && details.intakeConfirmed
            && details.ownerApproved
            && hasBeforePhoto);
        const canRequestVet = !dirty && !autoSaving && !photo && Boolean(vetId && reason.trim()) && latestReview?.outcome !== 'pending';
        const cancelJob = (status) => {
            if (!details.internalNotes?.trim()) {
                toast.error(status === 'no_show' ? 'Add a short note explaining that the pet did not arrive.' : 'Add the cancellation reason in Grooming Notes first.');
                document.getElementById('grooming-internal-notes')?.focus();
                return;
            }
            const prompt = status === 'no_show' ? 'Confirm that this pet did not arrive?' : 'Stop this grooming job? This does not issue a refund.';
            if (window.confirm(prompt)) save(status);
        };

        return <section
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            aria-label={`Grooming record for ${item.pet_name}`}
            onFocusCapture={() => { formFocusedRef.current = true; }}
            onBlurCapture={(event) => {
                if (!event.relatedTarget || !event.currentTarget.contains(event.relatedTarget)) {
                    formFocusedRef.current = false;
                }
            }}
        >
            <header className="border-b border-slate-200 px-4 py-4 dark:border-slate-800 sm:px-5">
                <div className="flex flex-wrap items-center gap-3">
                    <Button variant="ghost" size="sm" onClick={close} disabled={busy || autoSaving} className="shrink-0 gap-1.5 px-2"><ArrowLeft className="size-4" />Back</Button>
                    <PetAvatar item={item} className="size-11" />
                    <div className="min-w-0 flex-1">
                        <h2 className="break-words text-lg font-bold">{item.pet_name}</h2>
                        <p className="mt-0.5 break-words text-xs text-slate-500 dark:text-slate-400">
                            {[item.pet_breed || item.pet_species, `Owner: ${item.owner_name}`, groomingBookingReference(item)].filter(Boolean).join(' · ')}
                        </p>
                    </div>
                    {job && <State value={job.status} />}
                </div>
            </header>

            {error && <div role="alert" className="mx-4 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200 sm:mx-5"><p>{error}</p><Button variant="outline" size="sm" onClick={discard} disabled={busy || autoSaving}>Reload latest record</Button></div>}

            {!record ? <p role="status" className="px-5 py-12 text-center text-sm text-slate-500 dark:text-slate-400">{error ? 'The grooming record is unavailable.' : 'Loading grooming record…'}</p> : <>
                <div className="border-b border-slate-200 px-5 py-5 dark:border-slate-800">
                    <GroomingProgress status={job.status} />
                </div>

                {latestReview && <div className="mx-4 mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100 sm:mx-5">
                    <p className="flex items-center gap-2 font-semibold"><ShieldAlert className="size-4" />{OUTCOMES[latestReview.outcome]}</p>
                    <p className="mt-1 whitespace-pre-wrap">{latestReview.reason}</p>
                    {latestReview.review_notes && <p className="mt-1 whitespace-pre-wrap">{latestReview.veterinarian_name}: {latestReview.review_notes}</p>}
                </div>}

                <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(17rem,0.85fr)]">
                    <div className="min-w-0 space-y-4">
                        {(details.allergies || details.ownerRequest) && <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-100">
                            {details.allergies && <p><strong>Allergies / sensitivities:</strong> {details.allergies}</p>}
                            {details.ownerRequest && <p className="mt-1 whitespace-pre-wrap"><strong>Owner request:</strong> {details.ownerRequest}</p>}
                        </div>}

                        <section className={PANEL}>
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <h3 className="text-sm font-bold">Grooming service</h3>
                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Confirmed with the owner before grooming begins.</p>
                                </div>
                                {!preparing && <span className="text-sm font-semibold">{details.package || 'Grooming service'}</span>}
                            </div>
                            {preparing && <fieldset disabled={busy || locked} className="mt-4 space-y-3">
                                <div className="space-y-1.5">
                                    <label htmlFor="grooming-catalog-search" className="text-sm font-semibold">Services and assigned prices <span className="text-red-600">*</span></label>
                                    {groomingServices.length > 5 && <Input id="grooming-catalog-search" value={catalogSearch} onChange={(event) => setCatalogSearch(event.target.value)} placeholder="Search grooming services" disabled={busy || locked} />}
                                    <div className="max-h-60 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700" role="group" aria-label="Grooming services from Service Catalog">
                                        {visibleGroomingServices.map((service) => {
                                            const serviceId = String(service.serviceId);
                                            const priceReady = Number(service.basePrice) > 0;
                                            return <label key={serviceId} className="flex min-h-11 cursor-pointer items-center gap-3 border-b border-slate-100 px-3 py-2 last:border-b-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60">
                                                <Checkbox checked={selectedCatalogServiceIds.includes(serviceId)} onCheckedChange={(checked) => toggleGroomingService(service, checked)} disabled={busy || locked || !priceReady} aria-label={`Select ${service.serviceName}`} />
                                                <span className="min-w-0 flex-1 text-sm font-medium">{service.serviceName}{service.serviceCode ? <span className="ml-1.5 text-xs font-normal text-slate-500 dark:text-slate-400">{service.serviceCode}</span> : null}</span>
                                                <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">{priceReady ? formatPhpCurrency(service.basePrice) : 'Price required'}</span>
                                            </label>;
                                        })}
                                        {!visibleGroomingServices.length && <p className="px-3 py-4 text-sm text-slate-500 dark:text-slate-400">No matching grooming service.</p>}
                                    </div>
                                    {selectedCatalogServices.length > 0 && <p className="text-xs text-slate-500 dark:text-slate-400"><strong className="font-semibold text-slate-700 dark:text-slate-200">{selectedCatalogServices.length}</strong> selected · Official total: <strong className="font-semibold text-slate-700 dark:text-slate-200">{formatPhpCurrency(selectedCatalogTotal)}</strong>. Each service will be itemized in POS.</p>}
                                    {hasUnavailableCatalogService && <p className="text-xs text-amber-700 dark:text-amber-300">A previously assigned service is no longer active. Review the selections before starting.</p>}
                                    {!selectedCatalogServices.length && details.package && <p className="text-xs text-amber-700 dark:text-amber-300">The previous service “{details.package}” has no active catalog price. Select one or more matching services before starting.</p>}
                                    {!groomingServices.length && <p className="text-xs text-amber-700 dark:text-amber-300">{catalogMessage || 'No active Grooming services are available in Service Catalog.'}</p>}
                                </div>
                                <label className="flex cursor-pointer items-start gap-2 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/70">
                                    <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-[#155dfc]" checked={Boolean(details.intakeConfirmed && details.ownerApproved)} onChange={(event) => { setDetails((current) => ({ ...current, intakeConfirmed: event.target.checked, ownerApproved: event.target.checked })); markDirty(true); }} />
                                    <span>I checked the pet and confirmed these services with the owner.</span>
                                </label>
                            </fieldset>}
                            {details.addOns && <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Includes: {details.addOns}</p>}
                        </section>

                        <section className={PANEL}>
                            <label htmlFor="grooming-internal-notes" className="text-sm font-bold">Grooming notes</label>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Record observations, behavior, skin concerns, or cancellation reasons.</p>
                            <Textarea id="grooming-internal-notes" value={details.internalNotes || ''} onChange={(event) => update('internalNotes', event.target.value)} disabled={busy || locked} maxLength={3000} placeholder="Add only the information the care team needs…" className="mt-3 min-h-28 resize-y" />
                        </section>

                    </div>

                    <aside className="min-w-0 space-y-4">
                        <section className={PANEL}>
                            <div className="flex items-center justify-between gap-3">
                                <h3 className="text-sm font-bold">Photo record</h3>
                                <span className="text-xs text-slate-500 dark:text-slate-400">Concern · Before · After</span>
                            </div>
                            {!closed && !job.published_at && <fieldset disabled={busy} className="mt-3 space-y-3">
                                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{photoCategory === 'before' ? 'Before photo — initial receiving' : 'After photo — completed grooming'}</p>
                                <input id="grooming-photo" ref={photoRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => { setPhoto(event.target.files?.[0] || null); setCategory(photoCategory); }} />
                                <label htmlFor="grooming-photo" className="flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 px-3 py-4 text-center transition-colors hover:border-blue-400 hover:bg-blue-50/50 focus-within:ring-2 focus-within:ring-blue-500 dark:border-slate-700 dark:hover:border-blue-700 dark:hover:bg-blue-950/20">
                                    <Upload className="size-5 text-slate-400" aria-hidden="true" />
                                    <span className="mt-2 text-xs font-semibold">{photo ? photo.name : 'Choose a grooming photo'}</span>
                                    <span className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">JPG, PNG or WebP · up to 8 MB</span>
                                </label>
                                <SelectedPhotoPreview file={photo} category={photoCategory} />
                                <label className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300"><input className="mt-0.5 size-4" type="checkbox" checked={share} onChange={(event) => setShare(event.target.checked)} />Share with the owner summary</label>
                                <div className="flex flex-wrap gap-2">
                                    <Button type="button" variant="outline" size="sm" disabled={!photo || dirty || autoSaving} onClick={() => act({}, 'Photo saved.', { upload: true })}><Camera className="size-4" />{busy ? 'Uploading…' : 'Upload photo'}</Button>
                                    {photo && <Button type="button" variant="ghost" size="sm" onClick={() => { setPhoto(null); setCategory(''); if (photoRef.current) photoRef.current.value = ''; }}>Clear</Button>}
                                </div>
                            </fieldset>}
                            <div className="mt-4"><GroomingPhotoEvidence photos={record.photos} referencePhotos={record.referencePhotos} /></div>
                            {job.status === 'checked_in' && !hasBeforePhoto && <p className="mt-3 text-xs font-semibold text-amber-700 dark:text-amber-300">Add the before photo during receiving before starting grooming.</p>}
                            {job.status === 'in_progress' && !hasAfterPhoto && <p className="mt-3 text-xs font-semibold text-amber-700 dark:text-amber-300">Add the after photo before finishing grooming.</p>}
                        </section>

                        {!locked && ['checked_in', 'in_progress', 'vet_review'].includes(job.status) && <section className={PANEL}>
                            <div className="flex items-center gap-2"><Stethoscope className="size-4 text-slate-500" /><h3 className="text-sm font-bold">Veterinarian handoff</h3></div>
                            <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">Pause grooming and send the notes to a veterinarian when a health concern appears.</p>
                            {latestReview?.outcome === 'pending' ? <div className="mt-3 space-y-3">
                                <p className="rounded-lg bg-amber-50 p-3 text-xs font-medium text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">Waiting for {latestReview.veterinarian_name || 'the veterinarian'} to review this pet.</p>
                                {concernPhotos.length > 0 && <div><p className="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-200">Concern photos included</p><Photos photos={concernPhotos} /></div>}
                            </div> : <>
                                <Button type="button" variant="outline" className="mt-3 w-full" onClick={() => setShowVetHandoff((current) => !current)}>{showVetHandoff ? 'Close handoff' : 'Send to veterinarian'}</Button>
                                {showVetHandoff && <fieldset disabled={busy} className="mt-3 space-y-3">
                                    <Choice label="Veterinarian" value={vetId} onChange={setVetId} options={Object.fromEntries((record.eligibleVets || []).map((vet) => [String(vet.user_id), `${vet.first_Name} ${vet.last_Name}`]))} />
                                    <Field id="grooming-vet-concern" label="Health concern" value={reason} onChange={setReason} multiline />
                                    <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Concern photos sent with this handoff</p>
                                        <div className="mt-2">{concernPhotos.length ? <Photos photos={concernPhotos} /> : <p className="text-xs text-slate-500 dark:text-slate-400">The owner did not submit a concern photo with this booking. The written handoff will still be sent.</p>}</div>
                                    </div>
                                    {!record.eligibleVets?.length && <p className="text-xs text-slate-500 dark:text-slate-400">No active veterinarian is assigned to this branch.</p>}
                                    <Button type="button" className="w-full" disabled={!canRequestVet} onClick={() => act({ action: 'request_review', veterinarianId: Number(vetId), reason }, 'Grooming paused. The vet has been asked to review this pet.')}><ShieldAlert className="size-4" />Pause and send</Button>
                                    {photo && <p className="text-xs text-amber-700 dark:text-amber-300">Save or clear the selected photo before sending the handoff so the veterinarian receives the correct record.</p>}
                                </fieldset>}
                            </>}
                        </section>}

                        {job.status === 'ready' && <section className={PANEL}>
                            <h3 className="text-sm font-bold">Awaiting payment</h3>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">The grooming work is complete. Full payment in POS automatically records pickup and closes the booking.</p>
                            <Button type="button" variant="outline" size="sm" className="mt-3" disabled={busy || autoSaving} onClick={() => continueToPos({ response: { visitId: job.visit_id }, record })}>Open invoice in POS</Button>
                        </section>}

                    </aside>
                </div>

                <footer className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50/80 px-4 py-4 dark:border-slate-800 dark:bg-slate-950/40 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                    <div className="flex flex-wrap gap-2">
                        {!closed && <Button type="button" variant="destructive" disabled={busy || dirty || autoSaving} onClick={() => cancelJob('cancelled')}>Cancel grooming</Button>}
                        {job.status === 'scheduled' && <Button type="button" variant="outline" disabled={busy || dirty || autoSaving} onClick={() => cancelJob('no_show')}>Did not arrive</Button>}
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                        {nextStep && <Button type="button" disabled={busy || dirty || autoSaving || (nextStep.status === 'in_progress' && (!canStart || !hasBeforePhoto)) || (nextStep.status === 'ready' && !hasAfterPhoto)} onClick={() => save(nextStep.status, { openPos: nextStep.status === 'ready' })} className={job.status === 'in_progress' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : ''}>{busy ? 'Saving…' : nextStep.label}</Button>}
                    </div>
                </footer>
            </>}
        </section>;
    }

    return <section className={`${PANEL} space-y-5`} aria-label={`Grooming record for ${item.pet_name}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
            <Button variant="outline" onClick={close} disabled={busy}><ArrowLeft /> Back to list</Button>
            <div className="flex items-center gap-2"><span className={MUTED}>{groomingBookingReference(item)}</span>{job && <State value={job.status} />}</div>
        </div>
        <div><h2 className="text-xl font-bold">{item.pet_name}</h2><p className={MUTED}>{formatDisplayDate(item.booking_date)} · {formatDisplayTime(item.booking_time)} · {item.branch_name}{!isOwner && ` · ${item.owner_name}`}</p></div>
        {error && <div role="alert" className="space-y-2 rounded-lg border border-rose-200 p-3 text-sm text-rose-800 dark:border-rose-900 dark:text-rose-200"><p>{error}</p><Button variant="outline" size="sm" onClick={discard} disabled={busy}>Reload latest record</Button></div>}
        {!record ? <p role="status" className={MUTED}>{error ? 'The grooming record is unavailable.' : 'Loading grooming record…'}</p> : isOwner ? <>
            <div><h3 className="font-semibold">{details.package}</h3>{details.addOns && <p className={MUTED}>{details.addOns}</p>}<p className="mt-3 whitespace-pre-wrap text-sm">{details.ownerSummary}</p></div>
            <Photos photos={record.photos} />
        </> : <>
            {latestReview && <div className="space-y-2 border-l-4 border-amber-400 pl-3 text-sm">
                <p className="flex items-center gap-2 font-semibold"><ShieldAlert className="size-4" />{OUTCOMES[latestReview.outcome]}</p>
                <p className="whitespace-pre-wrap">{latestReview.reason}</p>
                {latestReview.review_notes && <p className="whitespace-pre-wrap">{latestReview.veterinarian_name}: {latestReview.review_notes}</p>}
                {latestReview.outcome === 'consultation' && <p className={MUTED}>Grooming stays paused. Arrange a separate consultation with owner approval; no consultation has been booked or charged automatically.</p>}
                {latestReview.outcome === 'confinement' && <p className={MUTED}>Grooming was closed and a Clinical Confinement request was sent to Boarding. The owner must approve the boarding consent before room assignment.</p>}
            </div>}
            {!isAdmin ? <>
                {details.ownerRequest && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                    <p className="font-semibold">Owner concern and requested grooming</p>
                    <p className="mt-1 whitespace-pre-wrap">{details.ownerRequest}</p>
                </div>}
                <dl className="grid gap-4 text-sm sm:grid-cols-2">{Object.entries({ 'Performed by': performer || 'Not assigned', Package: details.package, Allergies: details.allergies, 'Intake notes': details.intakeNotes, 'Handling assessment': details.handling, 'Internal notes': details.internalNotes }).map(([label, value]) => <div key={label}><dt className="font-semibold">{label}</dt><dd className="whitespace-pre-wrap">{value || 'Not recorded'}</dd></div>)}</dl>
                <GroomingPhotoEvidence photos={record.photos} referencePhotos={record.referencePhotos} />
                <fieldset disabled={busy} className="space-y-4 border-t border-slate-200 pt-4 dark:border-slate-700">
                    <legend className="font-semibold">Vet assessment</legend>
                    <Choice id="grooming-review-outcome" label="Review outcome" required value={outcome} onChange={(value) => { setOutcome(value); markDirty(true); }} options={{ resume: 'Grooming may resume', stop: 'Stop grooming', consultation: 'Needs a separate consultation', confinement: 'Admit to clinical confinement' }} />
                    <Field id="grooming-review-notes" label="Assessment and instructions" required value={reviewNotes} onChange={(value) => { setReviewNotes(value); markDirty(true); }} multiline maxLength={5000} />
                    {outcome === 'confinement' && <div className="grid gap-4 rounded-xl border border-violet-200 bg-violet-50/60 p-4 dark:border-violet-900/60 dark:bg-violet-950/20 sm:grid-cols-2">
                        <Choice label="Placement" value={confinementPlan.facilityType} onChange={(value) => { setConfinementPlan(current => ({ ...current, facilityType: value })); markDirty(true); }} options={{ boarding: 'Confinement', hotel: 'Pet Hotel' }} />
                        <Choice label="Room size" value={confinementPlan.roomSize} onChange={(value) => { setConfinementPlan(current => ({ ...current, roomSize: value })); markDirty(true); }} options={{ small: 'Small', medium: 'Medium', large: 'Large' }} />
                        <Field id="grooming-confinement-discharge" label="Expected discharge" required type="date" value={confinementPlan.expectedDischarge} onChange={(value) => { setConfinementPlan(current => ({ ...current, expectedDischarge: value })); markDirty(true); }} />
                        <Field id="grooming-confinement-care" label="Boarding care instructions (optional)" value={confinementPlan.careInstructions} onChange={(value) => { setConfinementPlan(current => ({ ...current, careInstructions: value })); markDirty(true); }} multiline maxLength={5000} />
                        <p className="text-xs text-violet-800 dark:text-violet-200 sm:col-span-2">Submitting closes grooming, creates a pending Clinical Confinement admission in Boarding, and adds its charge to this visit. Owner approval is captured during room assignment.</p>
                    </div>}
                    <p className={MUTED}>{outcome === 'confinement' ? 'Use the assessment field for the clinical reason. Boarding staff will manage consent, room assignment, monitoring, and discharge.' : 'This records your assessment only. The admin manages the grooming job and any separate consultation booking.'}</p>
                    <Button disabled={busy || latestReview?.outcome !== 'pending'} onClick={submitVetAssessment}><CheckCircle2 />{busy ? 'Saving…' : 'Submit assessment'}</Button>
                </fieldset>
            </> : <>
                {details.allergies && <p className="border-l-4 border-amber-400 pl-3 text-sm"><strong>Allergies / sensitivities:</strong> {details.allergies}</p>}
                {details.ownerRequest && <p className="whitespace-pre-wrap text-sm"><strong>Owner request:</strong> {details.ownerRequest}</p>}
                {preparing ? <fieldset disabled={busy} className="space-y-4">
                    <p className={MUTED}>Handled by <span className="font-semibold text-slate-900 dark:text-slate-100">{performer}</span></p>
                    <div className="grid gap-4 md:grid-cols-2">
                        {field('package', 'Grooming service', false, { list: 'grooming-packages', placeholder: 'e.g. Bath and brush' })}
                        <datalist id="grooming-packages"><option value="Bath and brush" /><option value="Full groom" /><option value="Hygiene tidy" /><option value="Nail trim" /></datalist>
                        {field('assistantName', 'Assisting nurse (optional)', false, { placeholder: 'Only if someone is helping', maxLength: 120 })}
                    </div>
                    <label className="flex cursor-pointer items-start gap-2 text-sm"><input type="checkbox" className="mt-1 size-4 shrink-0" checked={Boolean(details.intakeConfirmed && details.ownerApproved)} onChange={(event) => { setDetails((current) => ({ ...current, intakeConfirmed: event.target.checked, ownerApproved: event.target.checked })); markDirty(true); }} />I checked the pet and confirmed the service with the owner.</label>
                    <p className={MUTED}>Pricing uses the existing Service Catalog and booking billing. No price entry is needed here.</p>
                </fieldset> : <p className="text-sm"><strong>{details.package || 'Grooming'}</strong> · {performer || 'Staff not recorded'}{details.assistantName && ` · Assisting nurse: ${details.assistantName}`}</p>}
                {!locked && <fieldset disabled={busy}>{field('internalNotes', 'Notes (optional, clinic only)', true, { placeholder: 'Only record something the team needs to know.' })}</fieldset>}
                {nextStep && <p className={MUTED}>{nextStep.hint}</p>}
                {job.status === 'ready' && <div className="space-y-3">
                    <p className={MUTED}>Grooming is complete and awaiting payment. Full payment automatically records pickup and closes the booking.</p>
                </div>}
                {job.status === 'released' && <p className={MUTED}>Collected by {details.pickupPerson || 'the authorized person'}. Payment records are available in POS.</p>}
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    {nextStep && <Button disabled={busy} onClick={() => save(nextStep.status, { openPos: nextStep.status === 'ready' })}>{busy ? 'Saving…' : nextStep.label}</Button>}
                </div>
                {!locked && ['checked_in', 'in_progress', 'vet_review'].includes(job.status) && latestReview?.outcome !== 'pending' && <Extra title="Pet needs a vet? Pause grooming">
                    <fieldset disabled={busy} className="space-y-3">
                        <p className={MUTED}>Save any changes first. Grooming stays paused until the assigned vet clears it.</p>
                        <Choice label="Veterinarian" value={vetId} onChange={setVetId} options={Object.fromEntries((record.eligibleVets || []).map((vet) => [String(vet.user_id), `${vet.first_Name} ${vet.last_Name}`]))} />
                        {!record.eligibleVets?.length && <p className={MUTED}>No active vet is assigned to this branch. Ask the administrator to check branch assignments.</p>}
                        <Field label="What is the concern?" value={reason} onChange={setReason} multiline />
                        <Button variant="outline" disabled={dirty || !vetId || !reason.trim()} onClick={() => act({ action: 'request_review', veterinarianId: Number(vetId), reason }, 'Grooming paused. The vet has been asked to review this pet.')}><ShieldAlert />Pause & ask vet</Button>
                    </fieldset>
                </Extra>}
                <Extra title={`Photos (optional)${record.photos.length ? ` · ${record.photos.length}` : ''}`}>
                    {!closed && !job.published_at && <fieldset disabled={busy} className="space-y-3">
                        <div className="flex flex-wrap gap-2" aria-label="Photo type">{Object.entries({ before: 'Before', after: 'After', concern: 'Vet concern' }).map(([key, label]) => <Button key={key} size="sm" variant={photoCategory === key ? 'default' : 'outline'} aria-pressed={photoCategory === key} onClick={() => setCategory(key)}>{label}</Button>)}</div>
                        <label className="block space-y-2 text-sm font-semibold">{photoCategory === 'concern' ? 'Concern photo' : `${photoCategory === 'before' ? 'Before' : 'After'} grooming photo`}<Input ref={photoRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { setPhoto(event.target.files?.[0] || null); setCategory(photoCategory); }} /></label>
                        <p className={MUTED}>JPG, PNG or WebP, up to 8 MB. Photos are optional and private unless shared.</p>
                        {photoCategory !== 'concern' && <label className="flex items-center gap-2 text-sm"><input className="size-4" type="checkbox" checked={share} onChange={(event) => setShare(event.target.checked)} />Include this photo if I share the owner summary</label>}
                        {dirty && <p className={MUTED}>Save changes before adding the photo.</p>}
                        <Button variant="outline" disabled={!photo || dirty} onClick={() => act({}, 'Photo saved.', { upload: true })}><Camera />{busy ? 'Uploading…' : 'Save photo'}</Button>
                        {photo && <Button variant="ghost" onClick={() => { setPhoto(null); setCategory(''); if (photoRef.current) photoRef.current.value = ''; }}>Clear selection</Button>}
                    </fieldset>}
                    <Photos photos={record.photos} />
                    {record.referencePhotos?.length > 0 && <Extra title="Owner reference photos"><Photos photos={record.referencePhotos.filter((path) => !/\.pdf(?:$|\?)/i.test(path)).map((path) => ({ photo_id: path, file_path: path, category: 'reference', caption: 'Provided with booking' }))} /></Extra>}
                </Extra>
                <Extra title="More details & history">
                    {!preparing && !locked && <fieldset disabled={busy} className="grid gap-4 md:grid-cols-2">
                        {field('assistantName', 'Assisting nurse (optional)', false, { maxLength: 120 })}
                        {field('package', 'Grooming service')}
                        <label className="flex items-start gap-2 text-sm md:col-span-2"><input type="checkbox" className="mt-1 size-4 shrink-0" disabled={busy} checked={Boolean(details.ownerApproved)} onChange={(event) => update('ownerApproved', event.target.checked)} />The owner agreed to this service.</label>
                    </fieldset>}
                    {!locked && <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
                        {field('addOns', 'Add-ons (optional)')}
                        {field('allergies', 'Allergies / sensitivities')}
                        <Choice label="Coat condition" value={details.coat} onChange={(value) => update('coat', value)} options={{ unknown: 'Not recorded', clear: 'Clear', tangled: 'Tangled', matted: 'Matted', review: 'Concern — ask a vet' }} />
                        <Choice label="Handling" value={details.handling} onChange={(value) => update('handling', value)} options={{ unknown: 'Not recorded', settled: 'Settled', nervous: 'Nervous', sensitive: 'Sensitive', support: 'Needs support' }} />
                    </fieldset>}
                    {locked && <p className="whitespace-pre-wrap text-sm"><strong>Clinic notes:</strong> {details.internalNotes || 'No additional notes.'}</p>}
                    {['ready', 'released'].includes(job.status) && <div className="space-y-3">
                        <p className="whitespace-pre-wrap text-sm"><strong>Owner summary:</strong> {details.ownerSummary}</p>
                        <p className={MUTED}>Sharing includes the service and selected photos, not clinic notes or vet concerns.</p>
                        <Button variant="outline" disabled={busy || dirty || Boolean(job.published_at)} onClick={() => act({ action: 'publish' }, 'Summary shared with the pet owner.')}>{job.published_at ? 'Summary shared' : 'Share owner summary'}</Button>
                    </div>}
                    {Object.entries({ 'Previous intake notes': details.intakeNotes, 'Previous products note': details.productsUsed, 'Previous approval note': details.approvalNote, 'Previous handover note': details.pickupNote, 'Emergency contact': details.emergencyContact, Belongings: details.belongings }).filter(([, value]) => value).map(([label, value]) => <p key={label} className="whitespace-pre-wrap text-sm"><strong>{label}:</strong> {value}</p>)}
                </Extra>
                {!locked && <Extra title="Stop job / pet did not arrive">
                    <p className={MUTED}>Add a short reason in Notes above. Any payment refund must be handled separately in POS.</p>
                    <div className="flex flex-wrap gap-2">
                        <Button variant="destructive" disabled={busy || !details.internalNotes?.trim()} onClick={() => { if (window.confirm('Stop this grooming job? This does not issue a refund.')) save('cancelled'); }}>Stop grooming</Button>
                        {job.status === 'scheduled' && <Button variant="outline" disabled={busy || !details.internalNotes?.trim()} onClick={() => { if (window.confirm('Confirm this pet did not arrive?')) save('no_show'); }}>Did not arrive</Button>}
                    </div>
                </Extra>}
                {dirty && <p role="status" className={MUTED}>You have unsaved changes. Automatic refresh is paused while you edit.</p>}
            </>}
        </>}
    </section>;
}

export default function GroomingWorkspace({ mode = 'admin' }) {
    const dashboardUser = useDashboardUser();
    const branchLocked = mode === 'admin' && isBranchSelectionLocked(dashboardUser);
    const accountScopeKey = `${mode}-${dashboardUser?.user_id || dashboardUser?.id || ''}-${dashboardUser?.role || ''}-${assignedBranchId(dashboardUser)}`;
    const [branchState, setBranchState] = useState({ key: '', branches: [] });
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selected, setSelected] = useState(null);
    const [receivingId, setReceivingId] = useState(null);
    const [search, setSearch] = useState('');
    const [groomingServices, setGroomingServices] = useState([]);
    const [catalogMessage, setCatalogMessage] = useState('');
    const load = async () => {
        try {
            const [data, branchData, catalogData] = await Promise.all([
                fetchGroomingJobs(mode === 'vet'),
                mode === 'admin' ? fetchBranches({ assignedOnly: branchLocked }) : Promise.resolve({ branches: [] }),
                mode === 'admin'
                    ? fetchServiceCatalog().catch((catalogError) => ({ catalogError }))
                    : Promise.resolve({ services: [] }),
            ]);
            const nextItems = data.items || [];
            setItems(nextItems);
            setBranchState({ key: accountScopeKey, branches: Array.isArray(branchData) ? branchData : branchData.branches || [] });
            if (mode === 'admin') {
                if (catalogData.catalogError) {
                    setCatalogMessage(catalogData.catalogError.message || 'Service Catalog could not be loaded.');
                } else if (catalogData.schemaReady === false) {
                    setGroomingServices([]);
                    setCatalogMessage(catalogData.message || 'Service Catalog is not set up.');
                } else {
                    const services = (catalogData.services || []).filter((service) => service.isActive !== false && String(service.serviceType || '').toLowerCase() === 'grooming');
                    setGroomingServices(services);
                    setCatalogMessage(services.length ? '' : 'Add an active Grooming service and price in Service Catalog before starting a grooming job.');
                }

                const requestedBookingId = sessionStorage.getItem('ipawcus-open-grooming-booking-id');
                if (requestedBookingId) {
                    sessionStorage.removeItem('ipawcus-open-grooming-booking-id');
                    const requestedItem = nextItems.find((candidate) => String(candidate.booking_id) === String(requestedBookingId));
                    if (requestedItem) setSelected(requestedItem);
                }
            }
            setError('');
            return nextItems;
        }
        catch (err) { setError(err.message); throw err; }
        finally { setLoading(false); }
    };
    useAutoRefresh(load, { refreshKey: accountScopeKey });
    const branchesLoaded = branchState.key === accountScopeKey;
    const branches = branchesLoaded ? branchState.branches : [];
    const assignedBranch = resolveAssignedBranch(branches, dashboardUser);
    const effectiveBranch = branchLocked ? (assignedBranch ? String(assignedBranch.id) : '') : 'all';
    const branchLabel = !branchLocked ? 'All branches' : !branchesLoaded
        ? (error ? 'Branch unavailable' : 'Loading assigned branch…')
        : assignedBranch?.name || 'No branch assigned';
    const selectedInScope = selected && (!branchLocked || String(selected.branch_id) === effectiveBranch) ? selected : null;
    const scopedItems = items.filter((item) => mode !== 'admin'
        || (branchesLoaded && (effectiveBranch === 'all' || String(item.branch_id) === effectiveBranch)));
    const visible = scopedItems.filter((item) => mode !== 'admin' || (
        !['released', 'transferred', 'cancelled', 'no_show'].includes(item.status)
        && `${item.pet_name} ${item.owner_name} ${item.booking_number} ${item.performed_by || ''} ${item.grooming_service || ''}`.toLowerCase().includes(search.toLowerCase())
    ));
    const title = mode === 'admin' ? 'Grooming' : mode === 'vet' ? 'Grooming reviews' : 'Grooming summaries';
    const refresh = () => { load().catch(() => {}); };
    const receivePet = async (item) => {
        if (receivingId) return;
        setReceivingId(item.booking_id);
        try {
            await updateGroomingJob({
                action: 'receive',
                bookingId: item.booking_id,
                version: Number(item.version || 0),
            });
            const nextItems = await load();
            const receivedItem = (nextItems || []).find(candidate => String(candidate.booking_id) === String(item.booking_id));
            toast.success(`${item.pet_name} was received for grooming.`);
            setSelected(receivedItem || { ...item, status: 'checked_in', version: Number(item.version || 0) + 1 });
        } catch (receiveError) {
            toast.error(receiveError.message || 'The pet could not be received. Refresh the grooming list and try again.');
        } finally {
            setReceivingId(null);
        }
    };
    return <div className="mx-auto w-full max-w-[1600px] space-y-4 text-slate-900 dark:text-slate-100">
        {mode === 'admin' ? <DashboardPageHeader icon={Scissors} title={title} description="Receive approved bookings, complete grooming, and let full POS payment close pickup automatically." petHover={false} meta={<span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400" aria-label={`Branch: ${branchLabel}`}><Building2 className="size-3.5 shrink-0" aria-hidden="true" />{branchLabel}</span>} /> : <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="flex items-center gap-2 text-lg font-bold"><Scissors className="size-5" />{title}</h2><Button variant="outline" size="sm" onClick={refresh}>Refresh</Button></div>}
        {selectedInScope ? <GroomingRecord key={selectedInScope.booking_id} item={selectedInScope} mode={mode} onClose={() => setSelected(null)} onUpdated={refresh} groomingServices={groomingServices} catalogMessage={catalogMessage} /> : <>
            {mode === 'admin' ? <>
                <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                    <label className="relative block min-w-0">
                        <span className="sr-only">Search grooming jobs</span>
                        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search pet, owner, booking, service, or staff…" className="pl-9" />
                    </label>
                </div>

                {branchLocked && branchesLoaded && !assignedBranch && <p className={MUTED}>Ask the Super Admin to assign your account to a clinic branch before managing grooming jobs.</p>}
                {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">{error} We will retry automatically while this page is open.</p>}

                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
                    {loading ? <p role="status" className="px-5 py-12 text-center text-sm text-slate-500 dark:text-slate-400">Loading grooming jobs…</p> : !visible.length ? <div className="flex items-start justify-center gap-3 px-5 py-12"><ClipboardList className="mt-0.5 size-5 shrink-0 text-slate-400" /><p className={MUTED}>{error ? 'Records could not be loaded.' : scopedItems.length ? 'No open grooming jobs match this search.' : 'Approve a grooming booking in Booking Management to see it here.'}</p></div> : <div className="overflow-x-auto">
                        <table className="w-full min-w-[860px] border-collapse text-left text-sm">
                            <caption className="sr-only">Grooming receiving and work queue</caption>
                            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-400">
                                <tr>
                                    <th scope="col" className="w-[28%] px-4 py-3">Pet &amp; owner</th>
                                    <th scope="col" className="w-[20%] px-4 py-3">Grooming service</th>
                                    <th scope="col" className="w-[19%] px-4 py-3">Schedule</th>
                                    <th scope="col" className="w-[18%] px-4 py-3">Status</th>
                                    <th scope="col" className="w-[15%] px-4 py-3 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {visible.map((item) => {
                                    const itemCatalogIds = Array.isArray(item.grooming_catalog_service_ids) && item.grooming_catalog_service_ids.length
                                        ? item.grooming_catalog_service_ids
                                        : item.grooming_catalog_service_id ? [item.grooming_catalog_service_id] : [];
                                    const itemCatalogServices = itemCatalogIds
                                        .map((serviceId) => groomingServices.find((service) => String(service.serviceId) === String(serviceId)))
                                        .filter(Boolean);
                                    const itemCatalogTotal = itemCatalogServices.reduce((total, service) => total + Number(service.basePrice || 0), 0);
                                    const actionLabel = item.status === 'scheduled' ? 'Receive pet'
                                        : item.status === 'checked_in' ? 'Start grooming'
                                            : item.status === 'in_progress' ? 'Continue'
                                                : item.status === 'vet_review' ? 'View review'
                                                    : item.status === 'ready' ? 'Open payment'
                                                        : 'View record';
                                    return <tr key={item.booking_id} className="align-middle transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                                        <td className="px-4 py-4">
                                            <div className="flex min-w-0 items-center gap-3">
                                                <PetAvatar item={item} />
                                                <div className="min-w-0">
                                                    <p className="break-words font-semibold text-slate-900 dark:text-slate-100">{item.pet_name}</p>
                                                    <p className="mt-0.5 break-words text-xs text-slate-500 dark:text-slate-400">{[item.pet_breed || item.pet_species, item.owner_name].filter(Boolean).join(' · ')}</p>
                                                    <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">{groomingBookingReference(item)}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <p className="font-medium text-slate-800 dark:text-slate-200">{item.grooming_service || 'Grooming service'}</p>
                                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{itemCatalogServices.length ? `${formatPhpCurrency(itemCatalogTotal)} · ` : ''}{item.performed_by || 'Staff assigned at intake'}</p>
                                        </td>
                                        <td className="px-4 py-4">
                                            <p className="font-medium text-slate-800 dark:text-slate-200">{formatDisplayTime(item.booking_time)}</p>
                                            <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400"><Clock3 className="size-3.5" aria-hidden="true" />{formatDisplayDate(item.booking_date)}</p>
                                        </td>
                                        <td className="px-4 py-4"><State value={item.status} /></td>
                                        <td className="px-4 py-4 text-right"><Button size="sm" variant={['released', 'transferred', 'cancelled', 'no_show'].includes(item.status) ? 'outline' : 'default'} disabled={Boolean(receivingId)} onClick={() => item.status === 'scheduled' ? receivePet(item) : setSelected(item)}>{receivingId === item.booking_id ? 'Receiving…' : actionLabel}</Button></td>
                                    </tr>;
                                })}
                            </tbody>
                        </table>
                    </div>}
                    {!loading && visible.length > 0 && <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50/70 px-4 py-2.5 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400"><span>{visible.length} open grooming {visible.length === 1 ? 'job' : 'jobs'}</span><span>{branchLabel}</span></div>}
                </div>
            </> : <>
                {error && <p role="alert" className="rounded-lg border border-rose-200 p-3 text-sm text-rose-800 dark:border-rose-900 dark:text-rose-200">{error} Use Refresh to try again.</p>}
                <div className={PANEL}>
                    {loading ? <p role="status" className={MUTED}>Loading {title.toLowerCase()}…</p> : !visible.length ? <div className="flex items-start gap-3"><ClipboardList className="mt-0.5 size-5 shrink-0 text-slate-400" /><p className={MUTED}>{error ? 'Records could not be loaded.' : mode === 'owner' ? 'Your completed grooming summaries will appear here after the clinic shares them.' : 'No grooming reviews are waiting for you. Routine grooming stays with the care team.'}</p></div> : <ul className="divide-y divide-slate-200 dark:divide-slate-700">{visible.map((item) => <li key={item.booking_id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="break-words font-semibold">{item.pet_name}</span><State value={item.status} /></div><p className={`mt-1 ${MUTED}`}>{formatDisplayDate(item.booking_date)} · {formatDisplayTime(item.booking_time)} · {item.branch_name}</p>{mode !== 'owner' && <p className={`break-words ${MUTED}`}>{item.owner_name} · {groomingBookingReference(item)} · {item.performed_by || 'Staff not assigned'}</p>}</div>
                        <Button variant="outline" className="shrink-0" onClick={() => setSelected(item)}>{mode === 'vet' ? 'Review concern' : 'View summary'}</Button>
                    </li>)}</ul>}
                </div>
            </>}
        </>}
    </div>;
}
