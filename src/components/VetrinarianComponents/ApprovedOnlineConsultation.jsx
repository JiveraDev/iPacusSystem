import { useCallback, useMemo, useState } from 'react';
import { Calendar, Clock, Loader2, MessageSquare, RefreshCw, User, Video } from 'lucide-react';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Card, CardContent } from '../../ui/card';
import { toast } from '../../reusecomponent/toast.jsx';
import { useDashboardUser, useNavigate } from '../dashboardRouter.jsx';
import { formatDisplayDateTime } from '../../lib/date';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';

const API_BASE = import.meta.env.VITE_API_BASE_URL;

function getUserId(user) {
    return user?.id || user?.user_id || user?.userId || '';
}

function getStoredUser() {
    try {
        return JSON.parse(localStorage.getItem('currentUser') || '{}');
    } catch {
        return {};
    }
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

    if (normalized === 'cancelled') {
        return <Badge className="bg-red-50 text-red-700 border border-red-200">Cancelled</Badge>;
    }

    return <Badge className="bg-amber-50 text-amber-700 border border-amber-200">Scheduled</Badge>;
}

export default function ApprovedOnlineConsultation() {
    const navigate = useNavigate();
    const dashboardUser = useDashboardUser();
    const currentUser = useMemo(() => dashboardUser || getStoredUser(), [dashboardUser]);
    const vetId = getUserId(currentUser);
    const [consultations, setConsultations] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [actionId, setActionId] = useState(null);

    const loadConsultations = useCallback(async ({ isAutoRefresh = false } = {}) => {
        if (!vetId) {
            setIsLoading(false);
            return;
        }

        if (!isAutoRefresh) {
            setIsLoading(true);
        }
        try {
            const response = await fetch(`${API_BASE}/online-consultations?vetId=${encodeURIComponent(vetId)}`);
            const data = await response.json().catch(() => []);

            if (!response.ok) {
                throw new Error(data.message || 'Failed to load online consultations');
            }

            setConsultations(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Failed to load online consultations:', error);
            toast.error(error.message || 'Failed to load online consultations');
        } finally {
            setIsLoading(false);
        }
    }, [vetId]);

    useAutoRefresh(loadConsultations, {
        enabled: Boolean(vetId),
        refreshKey: vetId
    });

    const scheduledConsultations = consultations.filter((consultation) => !['completed', 'cancelled'].includes(consultation.status));
    const completedConsultations = consultations.filter((consultation) => consultation.status === 'completed');

    const openDiagnosisPage = (consultationId) => {
        navigate(`/dashboard/vet/online-consultations/${consultationId}/diagnosis`);
    };

    const startConsultation = async (consultation) => {
        setActionId(consultation.id);
        try {
            const response = await fetch(`${API_BASE}/online-consultations/${consultation.id}/start`, {
                method: 'POST'
            });
            const updated = await response.json().catch(() => null);

            if (!response.ok) {
                throw new Error(updated?.message || 'Failed to start consultation');
            }

            toast.success('Consultation started. Waiting for the pet owner to join.');
            openDiagnosisPage(updated?.id || consultation.id);
        } catch (error) {
            console.error('Failed to start consultation:', error);
            toast.error(error.message || 'Failed to start consultation');
        } finally {
            setActionId(null);
        }
    };

    const renderConsultationCard = (consultation) => (
        <Card key={consultation.id} className="border-slate-200">
            <CardContent className="p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-3">
                            <h3 className="text-xl font-bold text-slate-900">{consultation.petName || 'Unnamed Pet'}</h3>
                            {getStatusBadge(consultation.status)}
                        </div>
                        <div className="grid gap-3 text-sm text-slate-600 md:grid-cols-2">
                            <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-[#155dfc]" />
                                <span>{consultation.ownerName || 'Pet owner'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-[#155dfc]" />
                                <span>{formatDisplayDateTime(consultation.scheduledStart)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-[#155dfc]" />
                                <span>1 hour session</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <MessageSquare className="h-4 w-4 text-[#155dfc]" />
                                <span>{consultation.bookingNumber || `Booking #${consultation.bookingId}`}</span>
                            </div>
                        </div>
                        {consultation.notes && (
                            <p className="max-w-3xl whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                                {consultation.notes}
                            </p>
                        )}
                    </div>

                    <div className="flex flex-wrap gap-2 lg:justify-end">
                        {consultation.status === 'completed' ? (
                            <Button
                                variant="outline"
                                onClick={() => openDiagnosisPage(consultation.id)}
                                className="gap-2"
                            >
                                <MessageSquare className="h-4 w-4" />
                                View Diagnosis
                            </Button>
                        ) : (
                            <Button
                                onClick={() => startConsultation(consultation)}
                                disabled={actionId === consultation.id}
                                className="gap-2 bg-[#155dfc] hover:bg-[#0d4acf]"
                            >
                                {actionId === consultation.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
                                {consultation.status === 'scheduled' ? 'Start Consultation' : 'Resume Consultation'}
                            </Button>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );

    if (!vetId) {
        return (
            <Card>
                <CardContent className="p-8 text-center text-slate-600">
                    Could not identify the current veterinarian account. Please log in again.
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Online Consultations</h1>
                    <p className="text-sm text-slate-500">Approved sessions assigned to you. Start a session to open the consultation workspace.</p>
                </div>
                <Button variant="outline" onClick={loadConsultations} disabled={isLoading} className="gap-2">
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Refresh
                </Button>
            </div>

            <section className="space-y-3">
                <h2 className="text-lg font-bold text-slate-900">Scheduled</h2>
                {isLoading ? (
                    <Card>
                        <CardContent className="flex items-center justify-center gap-3 p-8 text-slate-500">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            Loading online consultations...
                        </CardContent>
                    </Card>
                ) : scheduledConsultations.length > 0 ? (
                    <div className="space-y-3">
                        {scheduledConsultations.map(renderConsultationCard)}
                    </div>
                ) : (
                    <Card>
                        <CardContent className="p-8 text-center text-slate-500">
                            No approved online consultations assigned to you yet.
                        </CardContent>
                    </Card>
                )}
            </section>

            {completedConsultations.length > 0 && (
                <section className="space-y-3">
                    <h2 className="text-lg font-bold text-slate-900">Completed</h2>
                    <div className="space-y-3">
                        {completedConsultations.map(renderConsultationCard)}
                    </div>
                </section>
            )}
        </div>
    );
}
