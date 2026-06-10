import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle, Loader2, PhoneOff, Video } from 'lucide-react';
import { useNavigate, useParams } from '../dashboardRouter.jsx';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { toast } from '../../reusecomponent/toast.jsx';
import { formatDisplayDateTime } from '../../lib/date';
import {
    endOnlineConsultation,
    fetchOnlineConsultation,
    startOnlineConsultation,
    submitOnlineConsultationDiagnosis
} from '../../services/onlineConsultationService';

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

export default function VetOnlineConsultDiagnosis() {
    const navigate = useNavigate();
    const { onlineConsultationId } = useParams();
    const [consultation, setConsultation] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isStarting, setIsStarting] = useState(false);
    const [diagnosisForm, setDiagnosisForm] = useState({
        diagnosis: '',
        recommendations: '',
        treatment: '',
        medications: '',
        notes: ''
    });

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
                setDiagnosisForm({
                    diagnosis: loaded.diagnosis || '',
                    recommendations: loaded.recommendations || '',
                    treatment: loaded.treatment || '',
                    medications: loaded.medications || '',
                    notes: loaded.diagnosisNotes || ''
                });
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

    const startConsultation = async () => {
        if (!consultation) return;

        setIsStarting(true);
        try {
            const updated = await startOnlineConsultation(consultation.id);

            setConsultation(updated);
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
            toast.error('Diagnosis is required.');
            return;
        }

        setIsSaving(true);
        try {
            const updated = await submitOnlineConsultationDiagnosis(consultation.id, diagnosisForm);

            setConsultation(updated);
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
            toast.success('Consultation marked completed.');
            navigate('/dashboard/vet/online-consultations');
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

    return (
        <div className="flex h-[calc(100vh-120px)] min-h-[680px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate('/dashboard/vet/online-consultations')}
                        className="gap-2"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back
                    </Button>
                    <div>
                        <div className="flex flex-wrap items-center gap-3">
                            <h1 className="text-xl font-bold text-slate-900">Consultation Diagnosis</h1>
                            {getStatusBadge(consultation.status)}
                        </div>
                        <p className="text-sm text-slate-500">
                            {consultation.petName || 'Unnamed Pet'} with {consultation.ownerName || 'Pet Owner'} - {formatDisplayDateTime(consultation.scheduledStart)}
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    {!callStarted && canUseRoom && (
                        <Button onClick={startConsultation} disabled={isStarting} className="gap-2 bg-[#155dfc] hover:bg-[#0d4acf]">
                            {isStarting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
                            Start Meeting
                        </Button>
                    )}
                </div>
            </div>

            <div className="grid flex-1 overflow-hidden lg:grid-cols-[minmax(0,1.1fr)_minmax(420px,0.9fr)]">
                <section className="flex min-h-[360px] flex-col bg-[#101828]">
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
                            <iframe
                                title="Jitsi online consultation"
                                src={consultation.meetingUrl}
                                allow="camera; microphone; fullscreen; display-capture; autoplay"
                                className="h-full min-h-[520px] w-full border-0"
                            />
                        ) : (
                            <div className="flex h-full min-h-[520px] flex-col items-center justify-center p-8 text-center text-white">
                                <Video className="mb-4 h-12 w-12 text-white/60" />
                                <h2 className="text-xl font-bold">{isFinal ? 'Meeting is closed' : 'Meeting has not started'}</h2>
                                <p className="mt-2 max-w-md text-sm text-white/70">
                                    {isFinal
                                        ? 'This consultation is no longer active. You can review or update the diagnosis on the right.'
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

                <section className="overflow-y-auto bg-[#f9fafb] p-5">
                    <div className="mb-5 rounded-xl border border-slate-200 bg-white p-4">
                        <div className="grid gap-3 text-sm sm:grid-cols-2">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Pet</p>
                                <p className="font-semibold text-slate-900">{consultation.petName || 'Not set'}</p>
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Owner</p>
                                <p className="font-semibold text-slate-900">{consultation.ownerName || 'Not set'}</p>
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Booking</p>
                                <p className="font-semibold text-slate-900">{consultation.bookingNumber || `#${consultation.bookingId}`}</p>
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Species</p>
                                <p className="font-semibold text-slate-900">{consultation.petSpecies || 'Not set'}</p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                            <Label className="mb-2 block text-sm font-semibold text-slate-900">
                                Diagnosis *
                            </Label>
                            <Textarea
                                value={diagnosisForm.diagnosis}
                                onChange={(event) => setDiagnosisForm({ ...diagnosisForm, diagnosis: event.target.value })}
                                placeholder="Enter diagnosis based on the online consultation..."
                                className="min-h-[170px] bg-slate-50"
                            />
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                            <Label className="mb-2 block text-sm font-semibold text-slate-900">
                                Recommendations
                            </Label>
                            <Textarea
                                value={diagnosisForm.recommendations}
                                onChange={(event) => setDiagnosisForm({ ...diagnosisForm, recommendations: event.target.value })}
                                placeholder="Follow-up instructions, monitoring, or care plan..."
                                className="min-h-[130px] bg-slate-50"
                            />
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="rounded-xl border border-slate-200 bg-white p-4">
                                <Label className="mb-2 block text-sm font-semibold text-slate-900">
                                    Treatment
                                </Label>
                                <Textarea
                                    value={diagnosisForm.treatment}
                                    onChange={(event) => setDiagnosisForm({ ...diagnosisForm, treatment: event.target.value })}
                                    placeholder="Treatment plan..."
                                    className="min-h-[110px] bg-slate-50"
                                />
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-white p-4">
                                <Label className="mb-2 block text-sm font-semibold text-slate-900">
                                    Medications
                                </Label>
                                <Textarea
                                    value={diagnosisForm.medications}
                                    onChange={(event) => setDiagnosisForm({ ...diagnosisForm, medications: event.target.value })}
                                    placeholder="Medication, dosage, and instructions..."
                                    className="min-h-[110px] bg-slate-50"
                                />
                            </div>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                            <Label className="mb-2 block text-sm font-semibold text-slate-900">
                                Internal Notes
                            </Label>
                            <Textarea
                                value={diagnosisForm.notes}
                                onChange={(event) => setDiagnosisForm({ ...diagnosisForm, notes: event.target.value })}
                                placeholder="Optional clinic notes..."
                                className="min-h-[90px] bg-slate-50"
                            />
                        </div>
                    </div>

                    <div className="sticky bottom-0 mt-5 flex flex-col gap-3 border-t border-slate-200 bg-[#f9fafb] py-4 sm:flex-row sm:justify-end">
                        {!isFinal && (
                            <Button variant="outline" onClick={endWithoutDiagnosis} disabled={isSaving}>
                                <PhoneOff className="mr-2 h-4 w-4" />
                                Mark Completed
                            </Button>
                        )}
                        <Button onClick={saveDiagnosis} disabled={isSaving} className="bg-[#155dfc] hover:bg-[#0d4acf]">
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                            {isFinal ? 'Save Diagnosis' : 'Save Diagnosis & Complete'}
                        </Button>
                    </div>
                </section>
            </div>
        </div>
    );
}
