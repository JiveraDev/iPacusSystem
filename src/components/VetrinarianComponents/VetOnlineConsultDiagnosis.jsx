import { createElement, useCallback, useEffect, useState } from 'react';
import {
    ArrowLeft,
    CheckCircle,
    CircleAlert,
    ClipboardList,
    FileText,
    Loader2,
    Maximize2,
    Minimize2,
    PanelRightClose,
    PanelRightOpen,
    PhoneOff,
    Pill,
    Stethoscope,
    Video
} from 'lucide-react';
import { useNavigate, useParams } from '../dashboardRouter.jsx';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { toast } from '../../reusecomponent/toast.jsx';
import { formatDisplayDateTime } from '../../lib/date';
import { useVideoCall } from '../../context/VideoCallProvider.jsx';
import {
    endOnlineConsultation,
    fetchOnlineConsultation,
    startOnlineConsultation,
    submitOnlineConsultationDiagnosis
} from '../../services/onlineConsultationService';

const emptyDiagnosisForm = {
    diagnosis: '',
    recommendations: '',
    treatment: '',
    medications: '',
    notes: ''
};

function getDraftKey(onlineConsultationId) {
    return `vet-online-consult-draft-${onlineConsultationId}`;
}

function readDraft(onlineConsultationId) {
    try {
        return JSON.parse(localStorage.getItem(getDraftKey(onlineConsultationId)) || 'null');
    } catch {
        return null;
    }
}

function removeDraft(onlineConsultationId) {
    localStorage.removeItem(getDraftKey(onlineConsultationId));
}

function getStatusBadge(status) {
    const normalized = String(status || '').toLowerCase();

    if (normalized === 'vet_ready') {
        return <Badge className="bg-blue-50 text-blue-700 border border-blue-200">Vet Ready</Badge>;
    }

    if (normalized === 'in_progress') {
        return <Badge className="bg-green-50 text-green-700 border border-green-200">In Progress</Badge>;
    }

    if (normalized === 'completed') {
        return <Badge className="bg-slate-100 text-slate-700 border border-slate-200">Completed</Badge>;
    }

    return <Badge className="bg-amber-50 text-amber-700 border border-amber-200">Scheduled</Badge>;
}

function ClinicalTextareaField({
    id,
    label,
    helper,
    icon: Icon,
    value,
    onChange,
    placeholder,
    required = false,
    error = '',
    className = 'min-h-[120px]'
}) {
    const helperId = `${id}-helper`;
    const errorId = `${id}-error`;

    return (
        <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {createElement(Icon, { className: 'size-4', 'aria-hidden': true })}
                    </span>
                    <div className="min-w-0">
                        <Label htmlFor={id} className="block text-sm font-bold text-slate-900 dark:text-slate-100">
                            {label}
                        </Label>
                        <p id={helperId} className="mt-0.5 text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">
                            {helper}
                        </p>
                    </div>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-wide ${
                    required
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
                        : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                }`}>
                    {required ? 'Required' : 'Optional'}
                </span>
            </div>

            <Textarea
                id={id}
                name={id}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                aria-describedby={`${helperId}${error ? ` ${errorId}` : ''}`}
                aria-invalid={Boolean(error)}
                className={`${className} resize-y rounded-lg border-slate-300 bg-white px-3.5 py-3 text-sm leading-6 text-slate-900 shadow-none transition placeholder:text-slate-400 focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 ${
                    error
                        ? 'border-red-400 bg-red-50/40 focus-visible:border-red-500 focus-visible:ring-red-500/20 dark:border-red-500 dark:bg-red-950/20'
                        : ''
                }`}
            />

            {error && (
                <p id={errorId} className="flex items-center gap-1.5 text-xs font-semibold text-red-600 dark:text-red-300">
                    <CircleAlert className="size-3.5" aria-hidden="true" />
                    {error}
                </p>
            )}
        </div>
    );
}

export default function VetOnlineConsultDiagnosis() {
    const navigate = useNavigate();
    const { onlineConsultationId } = useParams();
    const { activeCall, isMinimized, startCall, minimizeCall, maximizeCall, endCall } = useVideoCall();
    const [consultation, setConsultation] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isStarting, setIsStarting] = useState(false);
    const [lastAutosavedAt, setLastAutosavedAt] = useState('');
    const [diagnosisForm, setDiagnosisForm] = useState(emptyDiagnosisForm);
    const [diagnosisError, setDiagnosisError] = useState('');
    const [isClinicalPanelOpen, setIsClinicalPanelOpen] = useState(true);

    const buildCallDetails = useCallback((source) => ({
        consultationId: source?.id || onlineConsultationId,
        role: 'veterinarian',
        meetingUrl: source?.meetingUrl,
        meetingCode: source?.meetingCode,
        title: 'Online Consultation',
        petName: source?.petName,
        ownerName: source?.ownerName,
        veterinarianName: source?.veterinarianName,
        scheduledStart: source?.scheduledStart,
        returnPath: `/dashboard/vet/online-consultations/${source?.id || onlineConsultationId}/diagnosis`
    }), [onlineConsultationId]);

    const openConsultationCall = useCallback((source = consultation, options = {}) => {
        if (!source?.meetingUrl) {
            return;
        }

        startCall(buildCallDetails(source), options);
    }, [buildCallDetails, consultation, startCall]);

    useEffect(() => {
        const loadConsultation = async () => {
            setIsLoading(true);
            try {
                const data = await fetchOnlineConsultation(onlineConsultationId);

                const loaded = Array.isArray(data) ? data[0] : data;
                if (!loaded) {
                    throw new Error('Online consultation not found');
                }

                setConsultation(loaded);
                const serverForm = {
                    diagnosis: loaded.diagnosis || '',
                    recommendations: loaded.recommendations || '',
                    treatment: loaded.treatment || '',
                    medications: loaded.medications || '',
                    notes: loaded.diagnosisNotes || ''
                };
                const savedDraft = readDraft(onlineConsultationId);
                setDiagnosisForm(savedDraft?.form ? { ...serverForm, ...savedDraft.form } : serverForm);
                setLastAutosavedAt(savedDraft?.savedAt || '');
            } catch (error) {
                console.error('Failed to load online consultation:', error);
                toast.error(error.message || 'Failed to load online consultation');
            } finally {
                setIsLoading(false);
            }
        };

        if (onlineConsultationId) {
            loadConsultation();
        }
    }, [onlineConsultationId]);

    useEffect(() => {
        const status = String(consultation?.status || '').toLowerCase();

        if (consultation?.meetingUrl && ['vet_ready', 'in_progress'].includes(status)) {
            openConsultationCall(consultation);
        }
    }, [consultation, openConsultationCall]);

    useEffect(() => {
        if (!onlineConsultationId || isLoading || !consultation) return undefined;

        const timeoutId = window.setTimeout(() => {
            const savedAt = new Date().toISOString();
            localStorage.setItem(getDraftKey(onlineConsultationId), JSON.stringify({
                form: diagnosisForm,
                savedAt
            }));
            setLastAutosavedAt(savedAt);
        }, 700);

        return () => window.clearTimeout(timeoutId);
    }, [consultation, diagnosisForm, isLoading, onlineConsultationId]);

    const updateDiagnosisField = (field, value) => {
        setDiagnosisForm((current) => ({
            ...current,
            [field]: value
        }));

        if (field === 'diagnosis' && value.trim()) {
            setDiagnosisError('');
        }
    };

    const startConsultation = async () => {
        if (!consultation) return;

        setIsStarting(true);
        try {
            const updated = await startOnlineConsultation(consultation.id);

            setConsultation(updated);
            openConsultationCall(updated);
            toast.success('Consultation started. Waiting for the pet owner to join.');
        } catch (error) {
            console.error('Failed to start consultation:', error);
            toast.error(error.message || 'Failed to start consultation');
        } finally {
            setIsStarting(false);
        }
    };

    const saveDiagnosis = async () => {
        if (!consultation) return;

        if (!diagnosisForm.diagnosis.trim()) {
            setDiagnosisError('Enter the primary diagnosis before completing the consultation.');
            toast.error('Diagnosis is required.');
            window.requestAnimationFrame(() => document.getElementById('online-consult-diagnosis')?.focus());
            return;
        }

        setIsSaving(true);
        try {
            const updated = await submitOnlineConsultationDiagnosis(consultation.id, diagnosisForm);

            setConsultation(updated);
            endCall();
            removeDraft(onlineConsultationId);
            toast.success('Diagnosis saved and consultation completed.');
            navigate('/dashboard/vet/online-consultations');
        } catch (error) {
            console.error('Failed to save diagnosis:', error);
            toast.error(error.message || 'Failed to save diagnosis');
        } finally {
            setIsSaving(false);
        }
    };

    const endWithoutDiagnosis = async () => {
        if (!consultation) return;

        setIsSaving(true);
        try {
            const updated = await endOnlineConsultation(consultation.id);

            setConsultation(updated);
            endCall();
            toast.success('Call ended. Save the diagnosis to complete the consultation.');
        } catch (error) {
            console.error('Failed to end consultation:', error);
            toast.error(error.message || 'Failed to end consultation');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex h-64 items-center justify-center gap-3 text-slate-500">
                <Loader2 className="h-6 w-6 animate-spin" />
                Loading consultation workspace...
            </div>
        );
    }

    if (!consultation) {
        return (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
                <p className="font-semibold text-slate-900">Consultation not found</p>
                <Button onClick={() => navigate('/dashboard/vet/online-consultations')} className="mt-4">
                    Back to Online Consults
                </Button>
            </div>
        );
    }

    const canUseRoom = Boolean(consultation.meetingUrl) && consultation.status !== 'completed' && consultation.status !== 'cancelled';
    const callStarted = ['vet_ready', 'in_progress'].includes(String(consultation.status || '').toLowerCase());
    const isFinal = ['completed', 'cancelled'].includes(String(consultation.status || '').toLowerCase());
    const isCurrentCall = Boolean(activeCall?.meetingUrl && activeCall.meetingUrl === consultation.meetingUrl);
    const handleBackToConsults = () => {
        if (isCurrentCall) {
            minimizeCall();
        }

        navigate('/dashboard/vet/online-consultations');
    };
    const handleOpenCall = () => {
        if (isCurrentCall) {
            maximizeCall();
            return;
        }

        openConsultationCall(consultation);
    };

    return (
        <div>
            <div className="flex min-h-[calc(100vh-120px)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 2xl:h-[calc(100vh-120px)] 2xl:min-h-[680px]">
                <div className="flex flex-col gap-4 border-b border-slate-200 px-4 py-4 dark:border-slate-800 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleBackToConsults}
                        className="gap-2"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back
                    </Button>
                    <div>
                        <div className="flex flex-wrap items-center gap-3">
                            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Consultation Diagnosis</h1>
                            {getStatusBadge(consultation.status)}
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            {consultation.petName || 'Unnamed Pet'} with {consultation.ownerName || 'Pet Owner'} - {formatDisplayDateTime(consultation.scheduledStart)}
                        </p>
                        {lastAutosavedAt && (
                            <p className="mt-1 text-xs font-medium text-emerald-600">
                                Draft autosaved {formatDisplayDateTime(lastAutosavedAt)}
                            </p>
                        )}
                    </div>
                </div>

                    <div className="flex flex-wrap gap-2">
                        {!callStarted && canUseRoom && (
                            <Button onClick={startConsultation} disabled={isStarting} className="gap-2 bg-[#155dfc] hover:bg-[#0d4acf]">
                                {isStarting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
                                Start Meeting
                            </Button>
                        )}
                        {callStarted && canUseRoom && (
                            <Button variant="outline" onClick={isMinimized ? handleOpenCall : minimizeCall} className="gap-2">
                                {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
                                {isMinimized ? 'Open Call' : 'Minimize'}
                            </Button>
                        )}
                        <Button
                            variant="outline"
                            onClick={() => setIsClinicalPanelOpen((isOpen) => !isOpen)}
                            aria-controls="online-consult-clinical-panel"
                            aria-expanded={isClinicalPanelOpen}
                            className="gap-2 border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-950/70"
                        >
                            {isClinicalPanelOpen
                                ? <PanelRightClose className="size-4" aria-hidden="true" />
                                : <PanelRightOpen className="size-4" aria-hidden="true" />}
                            {isClinicalPanelOpen ? 'Hide Clinical Notes' : 'Show Clinical Notes'}
                        </Button>
                    </div>
                </div>

                <div className="flex min-h-0 flex-1 flex-col overflow-auto 2xl:flex-row 2xl:overflow-hidden">
                    <section className="flex min-h-[520px] min-w-0 flex-1 flex-col bg-[#101828] 2xl:min-h-0">
                    <div className="flex items-center justify-between border-b border-white/10 px-5 py-3 text-white">
                        <div>
                            <p className="text-sm font-semibold">Jitsi Meeting Room</p>
                            <p className="text-xs text-white/60">{consultation.meetingCode || 'Private consultation room'}</p>
                        </div>
                        {callStarted ? (
                            <span className="rounded-full bg-green-500/20 px-3 py-1 text-xs font-semibold text-green-100">Live</span>
                        ) : (
                            <span className="rounded-full bg-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-100">Not started</span>
                        )}
                    </div>

                    <div className="relative flex-1">
                        {canUseRoom && callStarted ? (
                            <div className="flex h-full min-h-[520px] flex-col items-center justify-center p-8 text-center text-white">
                                <Video className="mb-4 h-12 w-12 text-white/60" />
                                <h2 className="text-xl font-bold">{isMinimized ? 'Call minimized' : 'Meeting room active'}</h2>
                                <p className="mt-2 max-w-md text-sm text-white/70">
                                    {consultation.meetingCode || 'Private consultation room'}
                                </p>
                                <div className="mt-6 flex flex-wrap justify-center gap-2">
                                    <Button onClick={handleOpenCall} className="gap-2 bg-[#155dfc] hover:bg-[#0d4acf]">
                                        <Maximize2 className="h-4 w-4" />
                                        Open Call
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        onClick={minimizeCall}
                                        className="gap-2 border border-white/20 text-white hover:bg-white/10"
                                    >
                                        <Minimize2 className="h-4 w-4" />
                                        Minimize
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex h-full min-h-[520px] flex-col items-center justify-center p-8 text-center text-white">
                                <Video className="mb-4 h-12 w-12 text-white/60" />
                                <h2 className="text-xl font-bold">{isFinal ? 'Meeting is closed' : 'Meeting has not started'}</h2>
                                <p className="mt-2 max-w-md text-sm text-white/70">
                                    {isFinal
                                        ? 'This consultation is no longer active. Open Clinical Notes to review or update the diagnosis.'
                                        : 'Start the meeting from this page when you are ready. Public Jitsi may ask the veterinarian to log in as moderator before the room opens.'}
                                </p>
                                {canUseRoom && (
                                    <Button onClick={startConsultation} disabled={isStarting} className="mt-6 gap-2 bg-[#155dfc] hover:bg-[#0d4acf]">
                                        {isStarting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
                                        Start Meeting
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>
                    </section>
                    {isClinicalPanelOpen && (
                        <aside
                            id="online-consult-clinical-panel"
                            className="w-full shrink-0 border-t border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900 2xl:h-full 2xl:w-[34rem] 2xl:border-l 2xl:border-t-0"
                            aria-label="Clinical consultation notes"
                        >
                <section className="h-full overflow-y-auto bg-slate-50 p-4 dark:bg-slate-900 sm:p-5" aria-label="Clinical consultation form">
                    <div className="mx-auto max-w-3xl space-y-5">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-600 dark:text-blue-400">Clinical record</p>
                                <h2 className="mt-1 text-lg font-black text-slate-950 dark:text-white">Document the consultation</h2>
                                <p className="mt-1 text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">
                                    Record the assessment first, then the care plan discussed with the owner.
                                </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                                <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                                    <CheckCircle className="size-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                                    {lastAutosavedAt ? `Saved ${formatDisplayDateTime(lastAutosavedAt)}` : 'Drafts save automatically'}
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setIsClinicalPanelOpen(false)}
                                    className="shrink-0 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                                    aria-label="Hide clinical notes"
                                >
                                    <PanelRightClose className="size-4" aria-hidden="true" />
                                </Button>
                            </div>
                        </div>

                        <dl className="grid overflow-hidden rounded-xl border border-slate-200 bg-white text-sm dark:border-slate-700 dark:bg-slate-950 md:grid-cols-2 2xl:grid-cols-1">
                            <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800 md:border-r 2xl:border-r-0">
                                <dt className="text-[10px] font-black uppercase tracking-wider text-slate-400">Pet</dt>
                                <dd className="mt-1 truncate font-bold text-slate-900 dark:text-slate-100">{consultation.petName || 'Not set'}</dd>
                            </div>
                            <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                                <dt className="text-[10px] font-black uppercase tracking-wider text-slate-400">Owner</dt>
                                <dd className="mt-1 truncate font-bold text-slate-900 dark:text-slate-100">{consultation.ownerName || 'Not set'}</dd>
                            </div>
                            <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800 md:border-b-0 md:border-r 2xl:border-b 2xl:border-r-0">
                                <dt className="text-[10px] font-black uppercase tracking-wider text-slate-400">Booking</dt>
                                <dd className="mt-1 truncate font-bold text-slate-900 dark:text-slate-100">{consultation.bookingNumber || `#${consultation.bookingId}`}</dd>
                            </div>
                            <div className="px-4 py-3">
                                <dt className="text-[10px] font-black uppercase tracking-wider text-slate-400">Species</dt>
                                <dd className="mt-1 truncate font-bold text-slate-900 dark:text-slate-100">{consultation.petSpecies || 'Not set'}</dd>
                            </div>
                        </dl>

                        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950" aria-labelledby="assessment-heading">
                            <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/80 sm:px-5">
                                <div className="flex items-center gap-2">
                                    <Stethoscope className="size-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                                    <h3 id="assessment-heading" className="text-sm font-black text-slate-900 dark:text-slate-100">Assessment</h3>
                                </div>
                                <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">Clinical findings and guidance based on the remote consultation.</p>
                            </div>
                            <div className="space-y-5 p-4 sm:p-5">
                                <ClinicalTextareaField
                                    id="online-consult-diagnosis"
                                    label="Primary diagnosis"
                                    helper="State the principal assessment supported by the consultation."
                                    icon={ClipboardList}
                                    value={diagnosisForm.diagnosis}
                                    onChange={(event) => updateDiagnosisField('diagnosis', event.target.value)}
                                    placeholder="Enter the primary diagnosis or clinical assessment..."
                                    required
                                    error={diagnosisError}
                                    className="min-h-[160px]"
                                />
                                <div className="border-t border-slate-100 pt-5 dark:border-slate-800">
                                    <ClinicalTextareaField
                                        id="online-consult-recommendations"
                                        label="Recommendations and follow-up"
                                        helper="Include monitoring instructions, follow-up timing, tests, or referral advice."
                                        icon={FileText}
                                        value={diagnosisForm.recommendations}
                                        onChange={(event) => updateDiagnosisField('recommendations', event.target.value)}
                                        placeholder="Document owner instructions and the recommended next steps..."
                                        className="min-h-[130px]"
                                    />
                                </div>
                            </div>
                        </section>

                        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950" aria-labelledby="care-plan-heading">
                            <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/80 sm:px-5">
                                <div className="flex items-center gap-2">
                                    <Pill className="size-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                                    <h3 id="care-plan-heading" className="text-sm font-black text-slate-900 dark:text-slate-100">Care plan</h3>
                                </div>
                                <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">Keep treatment and medication directions specific and easy to review.</p>
                            </div>
                            <div className="grid gap-5 p-4 sm:p-5">
                                <ClinicalTextareaField
                                    id="online-consult-treatment"
                                    label="Treatment plan"
                                    helper="Document care provided or planned after the consultation."
                                    icon={Stethoscope}
                                    value={diagnosisForm.treatment}
                                    onChange={(event) => updateDiagnosisField('treatment', event.target.value)}
                                    placeholder="Describe the treatment plan..."
                                    className="min-h-[125px]"
                                />
                                <ClinicalTextareaField
                                    id="online-consult-medications"
                                    label="Medication instructions"
                                    helper="Include medicine, dose, route, frequency, and duration when applicable."
                                    icon={Pill}
                                    value={diagnosisForm.medications}
                                    onChange={(event) => updateDiagnosisField('medications', event.target.value)}
                                    placeholder="Example: Medicine, dose, route, frequency, duration..."
                                    className="min-h-[125px]"
                                />
                            </div>
                        </section>

                        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950" aria-labelledby="internal-notes-heading">
                            <div className="p-4 sm:p-5">
                                <ClinicalTextareaField
                                    id="online-consult-notes"
                                    label="Internal clinic notes"
                                    helper="Add operational context for clinic staff. This is separate from owner instructions."
                                    icon={FileText}
                                    value={diagnosisForm.notes}
                                    onChange={(event) => updateDiagnosisField('notes', event.target.value)}
                                    placeholder="Optional internal notes..."
                                    className="min-h-[100px]"
                                />
                            </div>
                        </section>

                        <div className="sticky bottom-0 z-10 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg shadow-slate-950/5 backdrop-blur dark:border-slate-700 dark:bg-slate-950/95 sm:flex-row sm:items-center sm:justify-between">
                            <p className="px-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                                Primary diagnosis is required to complete the consultation.
                            </p>
                            <div className="flex flex-col gap-2 sm:flex-row">
                                {!isFinal && (
                                    <Button
                                        variant="outline"
                                        onClick={endWithoutDiagnosis}
                                        disabled={isSaving}
                                        className="border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
                                    >
                                        <PhoneOff className="mr-2 h-4 w-4" />
                                        End Call Only
                                    </Button>
                                )}
                                <Button onClick={saveDiagnosis} disabled={isSaving} className="bg-[#155dfc] hover:bg-[#0d4acf]">
                                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                                    {isFinal ? 'Save Diagnosis' : 'Save Diagnosis & Complete'}
                                </Button>
                            </div>
                        </div>
                    </div>
                </section>
                        </aside>
                    )}
                </div>
            </div>
        </div>
    );
}
