import { useCallback, useMemo, useState } from 'react';
import { Calendar, Clock, Image as ImageIcon, ListFilter, Loader2, MessageSquare, RefreshCw, Search, User, Video, X } from 'lucide-react';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Card, CardContent } from '../../ui/card';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { toast } from '../../reusecomponent/toast.jsx';
import { useDashboardUser, useNavigate } from '../dashboardRouter.jsx';
import { formatDisplayDateTime } from '../../lib/date';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { fetchOnlineConsultations, startOnlineConsultation } from '../../services/onlineConsultationService';
import ProtectedImage from '../shared/ProtectedImage.jsx';
import { PhotoViewer } from '../../ui/photo-viewer';

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

function normalizeText(value) {
    return String(value || '').toLowerCase().trim();
}

function consultationDate(consultation) {
    const value = consultation.scheduledStart || consultation.scheduled_start || consultation.bookingDate || consultation.booking_date;
    if (!value) return null;

    const date = new Date(String(value).replace(' ', 'T'));
    return Number.isNaN(date.getTime()) ? null : date;
}

function consultationMatchesDateFilter(consultation, filter) {
    const date = consultationDate(consultation);
    if (!date) return false;

    if (filter === 'all') return true;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (filter === 'today') {
        return date >= today && date < tomorrow;
    }

    if (filter === 'upcoming') {
        return date >= today;
    }

    if (filter === 'next-7-days') {
        const end = new Date(today);
        end.setDate(end.getDate() + 7);
        return date >= today && date < end;
    }

    if (filter === 'past') {
        return date < today;
    }

    return true;
}

function consultationMatchesSearch(consultation, query) {
    if (!query) return true;

    return normalizeText([
        consultation.petName,
        consultation.ownerName,
        consultation.bookingNumber,
        consultation.bookingId,
        consultation.status,
        consultation.notes
    ].join(' ')).includes(query);
}

export default function ApprovedOnlineConsultation() {
    const navigate = useNavigate();
    const dashboardUser = useDashboardUser();
    const currentUser = useMemo(() => dashboardUser || getStoredUser(), [dashboardUser]);
    const vetId = getUserId(currentUser);
    const [consultations, setConsultations] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [actionId, setActionId] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [dateFilter, setDateFilter] = useState('upcoming');
    const [statusFilter, setStatusFilter] = useState('active');
    const [viewerImage, setViewerImage] = useState(null);

    const loadConsultations = useCallback(async ({ isAutoRefresh = false } = {}) => {
        if (!vetId) {
            setIsLoading(false);
            return;
        }

        if (!isAutoRefresh) {
            setIsLoading(true);
        }
        try {
            const data = await fetchOnlineConsultations({ vetId });

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

    const filteredConsultations = useMemo(() => {
        const query = normalizeText(searchQuery);

        return consultations.filter((consultation) => {
            if (!consultationMatchesDateFilter(consultation, dateFilter)) {
                return false;
            }

            const status = normalizeText(consultation.status);
            if (statusFilter === 'active' && ['completed', 'cancelled'].includes(status)) {
                return false;
            }
            if (statusFilter !== 'all' && statusFilter !== 'active' && status !== statusFilter) {
                return false;
            }

            return consultationMatchesSearch(consultation, query);
        }).sort((left, right) => {
            const leftDate = consultationDate(left)?.getTime() || 0;
            const rightDate = consultationDate(right)?.getTime() || 0;
            const bothClosed = ['completed', 'cancelled'].includes(normalizeText(left.status))
                && ['completed', 'cancelled'].includes(normalizeText(right.status));

            return bothClosed ? rightDate - leftDate : leftDate - rightDate;
        });
    }, [consultations, dateFilter, searchQuery, statusFilter]);

    const scheduledConsultations = filteredConsultations.filter((consultation) => !['completed', 'cancelled'].includes(String(consultation.status || '').toLowerCase()));
    const completedConsultations = filteredConsultations.filter((consultation) => String(consultation.status || '').toLowerCase() === 'completed');
    const cancelledConsultations = filteredConsultations.filter((consultation) => String(consultation.status || '').toLowerCase() === 'cancelled');
    const filtersAreActive = Boolean(searchQuery || dateFilter !== 'upcoming' || statusFilter !== 'active');

    const clearFilters = () => {
        setSearchQuery('');
        setDateFilter('upcoming');
        setStatusFilter('active');
    };

    const openDiagnosisPage = (consultationId) => {
        navigate(`/dashboard/vet/online-consultations/${consultationId}/diagnosis`);
    };

    const startConsultation = async (consultation) => {
        setActionId(consultation.id);
        try {
            const updated = await startOnlineConsultation(consultation.id);

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
                        {consultation.discussionTopic && (
                            <div className="max-w-3xl rounded-lg border border-blue-100 bg-blue-50 p-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                                    Discussion Topics
                                </p>
                                <p className="mt-1 text-sm font-semibold text-blue-950">
                                    {consultation.discussionTopic}
                                </p>
                            </div>
                        )}
                        {consultation.notes && (
                            <p className="max-w-3xl whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                                {consultation.notes}
                            </p>
                        )}
                        {Array.isArray(consultation.concernImages) && consultation.concernImages.length > 0 && (
                            <div className="max-w-3xl">
                                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    <ImageIcon className="h-4 w-4" />
                                    Concern Images
                                </div>
                                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                                    {consultation.concernImages.map((path, index) => (
                                        <button
                                            key={`${path}-${index}`}
                                            type="button"
                                            onClick={() => setViewerImage({ src: path, alt: `Concern image ${index + 1}` })}
                                            className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155dfc]"
                                            aria-label={`View concern image ${index + 1}`}
                                        >
                                            <ProtectedImage
                                                src={path}
                                                alt={`Concern image ${index + 1}`}
                                                className="aspect-square w-full object-cover transition-transform hover:scale-105"
                                            />
                                        </button>
                                    ))}
                                </div>
                            </div>
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

            <Card className="border-slate-200 shadow-none">
                <CardContent className="grid gap-4 p-4 lg:grid-cols-[minmax(16rem,1fr)_14rem_14rem_auto] lg:items-end">
                    <div className="space-y-1.5">
                        <Label htmlFor="online-consult-search" className="text-xs font-semibold text-slate-600">Search bookings</Label>
                        <Input
                            id="online-consult-search"
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            placeholder="Pet, owner, or booking number"
                            leftIcon={<Search className="size-4" />}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-slate-600">Appointment date</Label>
                        <Select value={dateFilter} onValueChange={setDateFilter}>
                            <SelectTrigger className="w-full">
                                <Calendar className="mr-2 size-4 text-slate-400" />
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="upcoming">All upcoming</SelectItem>
                                <SelectItem value="today">Today</SelectItem>
                                <SelectItem value="next-7-days">Next 7 days</SelectItem>
                                <SelectItem value="past">Past appointments</SelectItem>
                                <SelectItem value="all">All dates</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-slate-600">Consultation status</Label>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-full">
                                <ListFilter className="mr-2 size-4 text-slate-400" />
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="active">All active</SelectItem>
                                <SelectItem value="scheduled">Scheduled</SelectItem>
                                <SelectItem value="vet_ready">Vet ready</SelectItem>
                                <SelectItem value="in_progress">In progress</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                                <SelectItem value="all">Every status</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <Button type="button" variant="outline" onClick={clearFilters} disabled={!filtersAreActive} className="gap-2">
                        <X className="size-4" />
                        Reset
                    </Button>
                </CardContent>
            </Card>

            <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg font-bold text-slate-900">Upcoming & active</h2>
                    <span className="text-sm font-semibold text-slate-500">{scheduledConsultations.length}</span>
                </div>
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
                ) : completedConsultations.length === 0 && cancelledConsultations.length === 0 ? (
                    <Card>
                        <CardContent className="flex flex-col items-center p-8 text-center text-slate-500">
                            <Video className="mb-3 size-8 text-slate-400" />
                            <p className="font-semibold text-slate-700">No consultations match these filters</p>
                            <p className="mt-1 text-sm">Try another date or status.</p>
                            {filtersAreActive && (
                                <Button type="button" variant="outline" size="sm" onClick={clearFilters} className="mt-4">
                                    Clear filters
                                </Button>
                            )}
                        </CardContent>
                    </Card>
                ) : null}
            </section>

            {completedConsultations.length > 0 && (
                <section className="space-y-3">
                    <h2 className="text-lg font-bold text-slate-900">Completed</h2>
                    <div className="space-y-3">
                        {completedConsultations.map(renderConsultationCard)}
                    </div>
                </section>
            )}
            {cancelledConsultations.length > 0 && (
                <section className="space-y-3">
                    <h2 className="text-lg font-bold text-slate-900">Cancelled</h2>
                    <div className="space-y-3">
                        {cancelledConsultations.map(renderConsultationCard)}
                    </div>
                </section>
            )}
            <PhotoViewer
                src={viewerImage?.src}
                alt={viewerImage?.alt}
                open={Boolean(viewerImage)}
                onOpenChange={(open) => {
                    if (!open) setViewerImage(null);
                }}
            />
        </div>
    );
}
