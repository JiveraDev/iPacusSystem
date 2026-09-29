import { useCallback, useMemo, useState } from 'react';
import {
    Calendar,
    CheckCircle2,
    Clock,
    History,
    Image as ImageIcon,
    ListFilter,
    Loader2,
    MessageSquare,
    PawPrint,
    RefreshCw,
    Search,
    User,
    Video,
    X,
    XCircle
} from 'lucide-react';
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
import DashboardPageHeader from '../shared/DashboardPageHeader.jsx';

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
        return <Badge className="border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-300">Vet ready</Badge>;
    }

    if (normalized === 'in_progress') {
        return <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">In progress</Badge>;
    }

    if (normalized === 'completed') {
        return <Badge className="border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">Completed</Badge>;
    }

    if (normalized === 'cancelled') {
        return <Badge className="border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">Cancelled</Badge>;
    }

    return <Badge className="border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300">Scheduled</Badge>;
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

function parseConsultationDate(value) {
    if (!value) return null;

    const date = new Date(String(value).replace(' ', 'T'));
    return Number.isNaN(date.getTime()) ? null : date;
}

function getSchedulePresentation(consultation) {
    const start = consultationDate(consultation);
    if (!start) {
        return {
            dayLabel: 'Date pending',
            monthLabel: '--',
            dateLabel: '--',
            timeLabel: 'Time not scheduled'
        };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const appointmentDay = new Date(start);
    appointmentDay.setHours(0, 0, 0, 0);
    const dayDifference = Math.round((appointmentDay.getTime() - today.getTime()) / 86400000);
    const end = parseConsultationDate(consultation.scheduledEnd || consultation.scheduled_end)
        || new Date(start.getTime() + (60 * 60 * 1000));
    const startTime = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const endTime = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

    let dayLabel = start.toLocaleDateString('en-US', { weekday: 'short' });
    if (dayDifference === 0) dayLabel = 'Today';
    if (dayDifference === 1) dayLabel = 'Tomorrow';

    return {
        dayLabel,
        monthLabel: start.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
        dateLabel: start.toLocaleDateString('en-US', { day: '2-digit' }),
        timeLabel: `${startTime} - ${endTime}`
    };
}

function getBookingLabel(consultation) {
    if (consultation.bookingNumber) return consultation.bookingNumber;
    if (consultation.bookingId) return `Booking #${consultation.bookingId}`;
    return 'Booking reference unavailable';
}

function getPetDetail(consultation) {
    return [consultation.petSpecies, consultation.petBreed].filter(Boolean).join(' · ');
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
        consultation.petSpecies,
        consultation.petBreed,
        consultation.discussionTopic,
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
    const [dateFilter, setDateFilter] = useState('all');
    const [activeView, setActiveView] = useState('upcoming');
    const [upcomingStatusFilter, setUpcomingStatusFilter] = useState('all');
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
            if (!isAutoRefresh) {
                toast.error(error.message || 'Online consultations could not be loaded. Refresh the page or try again.');
            }
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
            return consultationMatchesSearch(consultation, query);
        });
    }, [consultations, dateFilter, searchQuery]);

    const upcomingConsultations = useMemo(() => filteredConsultations
        .filter((consultation) => {
            const status = normalizeText(consultation.status);
            if (['completed', 'cancelled'].includes(status)) return false;
            return upcomingStatusFilter === 'all' || status === upcomingStatusFilter;
        })
        .sort((left, right) => (
            (consultationDate(left)?.getTime() || 0) - (consultationDate(right)?.getTime() || 0)
        )), [filteredConsultations, upcomingStatusFilter]);

    const allUpcomingConsultations = useMemo(() => filteredConsultations.filter((consultation) => (
        !['completed', 'cancelled'].includes(normalizeText(consultation.status))
    )), [filteredConsultations]);

    const completedConsultations = useMemo(() => filteredConsultations
        .filter((consultation) => normalizeText(consultation.status) === 'completed')
        .sort((left, right) => {
            const leftDate = parseConsultationDate(left.endedAt)?.getTime() || consultationDate(left)?.getTime() || 0;
            const rightDate = parseConsultationDate(right.endedAt)?.getTime() || consultationDate(right)?.getTime() || 0;
            return rightDate - leftDate;
        }), [filteredConsultations]);

    const cancelledConsultations = useMemo(() => filteredConsultations
        .filter((consultation) => normalizeText(consultation.status) === 'cancelled')
        .sort((left, right) => (
            (consultationDate(right)?.getTime() || 0) - (consultationDate(left)?.getTime() || 0)
        )), [filteredConsultations]);

    const activeConsultations = activeView === 'completed'
        ? completedConsultations
        : activeView === 'cancelled'
            ? cancelledConsultations
            : upcomingConsultations;
    const filtersAreActive = Boolean(
        searchQuery
        || dateFilter !== 'all'
        || (activeView === 'upcoming' && upcomingStatusFilter !== 'all')
    );

    const clearFilters = () => {
        setSearchQuery('');
        setDateFilter('all');
        setUpcomingStatusFilter('all');
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
            toast.error(error.message || 'The consultation could not be started. Check its status and try again.');
        } finally {
            setActionId(null);
        }
    };

    const renderConcernImages = (consultation, compact = false) => {
        const images = Array.isArray(consultation.concernImages) ? consultation.concernImages : [];
        if (images.length === 0) return null;

        return (
            <div className="flex items-center gap-2">
                <div className="flex -space-x-1.5">
                    {images.slice(0, compact ? 1 : 3).map((path, index) => (
                        <button
                            key={`${path}-${index}`}
                            type="button"
                            onClick={() => setViewerImage({ src: path, alt: `Concern image ${index + 1}` })}
                            className="relative size-9 overflow-hidden rounded-lg border-2 border-white bg-slate-100 shadow-sm transition-transform hover:z-10 hover:-translate-y-0.5 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 motion-reduce:transition-none dark:border-slate-900 dark:bg-slate-800"
                            aria-label={`View concern image ${index + 1} for ${consultation.petName || 'pet'}`}
                        >
                            <ProtectedImage
                                src={path}
                                alt=""
                                className="size-full object-cover"
                            />
                        </button>
                    ))}
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <ImageIcon className="size-3.5" aria-hidden="true" />
                    {images.length} {images.length === 1 ? 'image' : 'images'}
                </span>
            </div>
        );
    };

    const renderUpcomingConsultation = (consultation) => {
        const schedule = getSchedulePresentation(consultation);
        const status = normalizeText(consultation.status);
        const petDetail = getPetDetail(consultation);
        const isStarting = actionId === consultation.id;
        const isInProgress = status === 'in_progress' || status === 'vet_ready';

        return (
            <article
                key={consultation.id}
                className={`grid min-w-0 gap-4 px-4 py-5 transition-colors motion-reduce:transition-none sm:grid-cols-[5.25rem_minmax(0,1fr)] sm:px-5 xl:grid-cols-[5.25rem_minmax(13rem,1fr)_minmax(13rem,0.8fr)_auto] xl:items-center ${
                    isInProgress
                        ? 'bg-blue-50/45 hover:bg-blue-50/80 dark:bg-blue-950/15 dark:hover:bg-blue-950/25'
                        : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/35'
                }`}
            >
                <div className="flex items-center gap-3 sm:block sm:self-start sm:text-center xl:self-center">
                    <div className={`flex min-w-16 flex-col items-center overflow-hidden rounded-lg border ${
                        isInProgress
                            ? 'border-blue-200 bg-white dark:border-blue-800 dark:bg-slate-900'
                            : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/70'
                    }`}>
                        <span className={`w-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${
                            isInProgress
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                                : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                        }`}>
                            {schedule.monthLabel}
                        </span>
                        <span className="py-1.5 text-2xl font-black leading-none text-slate-950 dark:text-white">
                            {schedule.dateLabel}
                        </span>
                    </div>
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 sm:mt-1.5">{schedule.dayLabel}</p>
                </div>

                <div className="min-w-0 sm:col-start-2 xl:col-start-auto">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <h3 className="truncate text-base font-black text-slate-950 dark:text-white sm:text-lg">
                            {consultation.petName || 'Unnamed pet'}
                        </h3>
                        {getStatusBadge(consultation.status)}
                    </div>
                    <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                        <span className="inline-flex min-w-0 items-center gap-1.5">
                            <User className="size-3.5 shrink-0" aria-hidden="true" />
                            <span className="truncate">{consultation.ownerName || 'Pet owner'}</span>
                        </span>
                        {petDetail && (
                            <span className="inline-flex min-w-0 items-center gap-1.5">
                                <PawPrint className="size-3.5 shrink-0" aria-hidden="true" />
                                <span className="truncate">{petDetail}</span>
                            </span>
                        )}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm font-bold text-slate-700 dark:text-slate-200">
                        <span className="inline-flex items-center gap-1.5">
                            <Clock className="size-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                            {schedule.timeLabel}
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                            <MessageSquare className="size-4" aria-hidden="true" />
                            {getBookingLabel(consultation)}
                        </span>
                    </div>
                </div>

                <div className="min-w-0 sm:col-start-2 xl:col-start-auto">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                        Consultation focus
                    </p>
                    <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm font-semibold leading-5 text-slate-700 dark:text-slate-300">
                        {consultation.discussionTopic || consultation.notes || 'No concern notes were provided.'}
                    </p>
                    <div className="mt-2.5">{renderConcernImages(consultation)}</div>
                </div>

                <div className="sm:col-start-2 xl:col-start-auto">
                    <Button
                        onClick={() => startConsultation(consultation)}
                        disabled={isStarting}
                        className="w-full gap-2 bg-[#155dfc] hover:bg-[#0d4acf] sm:w-auto xl:w-44"
                    >
                        {isStarting
                            ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
                            : <Video className="size-4" />}
                        {status === 'scheduled' ? 'Start consultation' : 'Resume consultation'}
                    </Button>
                </div>
            </article>
        );
    };

    const renderHistoryConsultation = (consultation) => {
        const isCompleted = normalizeText(consultation.status) === 'completed';
        const eventDate = isCompleted
            ? consultation.endedAt || consultation.scheduledStart
            : consultation.scheduledStart;
        const petDetail = getPetDetail(consultation);

        return (
            <article
                key={consultation.id}
                className="grid min-w-0 gap-3 px-4 py-4 transition-colors hover:bg-slate-50/80 motion-reduce:transition-none sm:grid-cols-[2.5rem_minmax(0,1fr)_minmax(12rem,0.7fr)_auto] sm:items-center sm:px-5 dark:hover:bg-slate-800/35"
            >
                <span className={`flex size-9 items-center justify-center rounded-lg ${
                    isCompleted
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                        : 'bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-300'
                }`}>
                    {isCompleted
                        ? <CheckCircle2 className="size-4" aria-hidden="true" />
                        : <XCircle className="size-4" aria-hidden="true" />}
                </span>

                <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <h3 className="truncate text-sm font-black text-slate-950 dark:text-white sm:text-base">
                            {consultation.petName || 'Unnamed pet'}
                        </h3>
                        {getStatusBadge(consultation.status)}
                    </div>
                    <p className="mt-0.5 truncate text-xs font-semibold text-slate-500 dark:text-slate-400">
                        {consultation.ownerName || 'Pet owner'}{petDetail ? ` · ${petDetail}` : ''}
                    </p>
                </div>

                <div className="min-w-0 sm:col-start-auto">
                    <p className="truncate text-sm font-bold text-slate-700 dark:text-slate-200">
                        {formatDisplayDateTime(eventDate)}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                        <span>{getBookingLabel(consultation)}</span>
                        {renderConcernImages(consultation, true)}
                    </div>
                </div>

                <div className="sm:col-start-auto">
                    {isCompleted ? (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openDiagnosisPage(consultation.id)}
                            className="w-full gap-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 sm:w-auto"
                        >
                            <MessageSquare className="size-4" />
                            View diagnosis
                        </Button>
                    ) : (
                        <span className="block text-xs font-semibold text-slate-400 dark:text-slate-500 sm:text-right">No action needed</span>
                    )}
                </div>
            </article>
        );
    };

    const viewDetails = {
        upcoming: {
            icon: Video,
            title: 'Upcoming & active',
            description: 'Scheduled sessions and consultations already in progress.',
            emptyTitle: 'No upcoming consultations',
            emptyDescription: filtersAreActive
                ? 'No active sessions match the current search and filters.'
                : 'Newly approved online consultations will appear here.'
        },
        completed: {
            icon: CheckCircle2,
            title: 'Completed consultations',
            description: 'Finished sessions, ordered by the most recently completed.',
            emptyTitle: 'No completed consultations',
            emptyDescription: filtersAreActive
                ? 'No completed sessions match the current search and date filter.'
                : 'Completed sessions will be kept here for quick review.'
        },
        cancelled: {
            icon: XCircle,
            title: 'Cancelled consultations',
            description: 'Closed sessions that no longer require action.',
            emptyTitle: 'No cancelled consultations',
            emptyDescription: filtersAreActive
                ? 'No cancelled sessions match the current search and date filter.'
                : 'Cancelled sessions will appear here when applicable.'
        }
    }[activeView];
    const ActiveViewIcon = viewDetails.icon;

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
            <DashboardPageHeader
                icon={Video}
                title="Online Consultations"
                description="Approved sessions assigned to you. Start a session to open the consultation workspace."
                layout="stacked"
                actions={(
                    <Button
                        variant="outline"
                        onClick={loadConsultations}
                        disabled={isLoading}
                        className="gap-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                    >
                        {isLoading
                            ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                            : <RefreshCw className="h-4 w-4" />}
                        Refresh
                    </Button>
                )}
                toolbar={(
                <div className="grid gap-4 rounded-lg border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-950/60 md:grid-cols-[minmax(16rem,1fr)_14rem_auto] md:items-end">
                    <div className="space-y-1.5">
                        <Label htmlFor="online-consult-search" className="text-xs font-semibold text-slate-600 dark:text-slate-300">Search bookings</Label>
                        <Input
                            id="online-consult-search"
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            placeholder="Pet, owner, concern, or booking"
                            leftIcon={<Search className="size-4" />}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Appointment date</Label>
                        <Select value={dateFilter} onValueChange={setDateFilter}>
                            <SelectTrigger className="w-full">
                                <Calendar className="mr-2 size-4 text-slate-400" />
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All dates</SelectItem>
                                <SelectItem value="upcoming">Upcoming</SelectItem>
                                <SelectItem value="today">Today</SelectItem>
                                <SelectItem value="next-7-days">Next 7 days</SelectItem>
                                <SelectItem value="past">Past appointments</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={clearFilters}
                        disabled={!filtersAreActive}
                        className="gap-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                    >
                        <X className="size-4" />
                        Reset
                    </Button>
                </div>
                )}
            />

            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-950/[0.03] dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/10">
                <div className="border-b border-slate-200 bg-slate-50/80 p-2 dark:border-slate-800 dark:bg-slate-950/50">
                    <div
                        role="tablist"
                        aria-label="Consultation lists"
                        className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800/80 sm:inline-grid sm:min-w-[31rem]"
                    >
                        <button
                            type="button"
                            role="tab"
                            id="consultation-tab-upcoming"
                            aria-controls="consultation-list-panel"
                            aria-selected={activeView === 'upcoming'}
                            onClick={() => setActiveView('upcoming')}
                            className={`inline-flex min-h-10 min-w-0 items-center justify-center gap-2 rounded-md px-2.5 py-2 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 motion-reduce:transition-none sm:text-sm ${
                                activeView === 'upcoming'
                                    ? 'bg-white text-blue-700 shadow-sm dark:bg-slate-900 dark:text-blue-300'
                                    : 'text-slate-600 hover:bg-white/70 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-900/70 dark:hover:text-white'
                            }`}
                        >
                            <Video className="size-4 shrink-0" aria-hidden="true" />
                            <span className="truncate">Upcoming</span>
                            <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-black tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                {allUpcomingConsultations.length}
                            </span>
                        </button>
                        <button
                            type="button"
                            role="tab"
                            id="consultation-tab-completed"
                            aria-controls="consultation-list-panel"
                            aria-selected={activeView === 'completed'}
                            onClick={() => setActiveView('completed')}
                            className={`inline-flex min-h-10 min-w-0 items-center justify-center gap-2 rounded-md px-2.5 py-2 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 motion-reduce:transition-none sm:text-sm ${
                                activeView === 'completed'
                                    ? 'bg-white text-blue-700 shadow-sm dark:bg-slate-900 dark:text-blue-300'
                                    : 'text-slate-600 hover:bg-white/70 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-900/70 dark:hover:text-white'
                            }`}
                        >
                            <History className="size-4 shrink-0" aria-hidden="true" />
                            <span className="truncate">Completed</span>
                            <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-black tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                {completedConsultations.length}
                            </span>
                        </button>
                        <button
                            type="button"
                            role="tab"
                            id="consultation-tab-cancelled"
                            aria-controls="consultation-list-panel"
                            aria-selected={activeView === 'cancelled'}
                            onClick={() => setActiveView('cancelled')}
                            className={`inline-flex min-h-10 min-w-0 items-center justify-center gap-2 rounded-md px-2.5 py-2 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 motion-reduce:transition-none sm:text-sm ${
                                activeView === 'cancelled'
                                    ? 'bg-white text-blue-700 shadow-sm dark:bg-slate-900 dark:text-blue-300'
                                    : 'text-slate-600 hover:bg-white/70 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-900/70 dark:hover:text-white'
                            }`}
                        >
                            <XCircle className="size-4 shrink-0" aria-hidden="true" />
                            <span className="truncate">Cancelled</span>
                            <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-black tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                {cancelledConsultations.length}
                            </span>
                        </button>
                    </div>
                </div>

                <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <ActiveViewIcon className="size-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                            <h2 id="consultation-list-heading" className="text-base font-black text-slate-950 dark:text-white sm:text-lg">
                                {viewDetails.title}
                            </h2>
                        </div>
                        <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400 sm:text-sm">
                            {viewDetails.description}
                        </p>
                    </div>

                    {activeView === 'upcoming' && (
                        <div className="w-full shrink-0 sm:w-52">
                            <Label htmlFor="upcoming-status-filter" className="sr-only">Filter upcoming consultations by status</Label>
                            <Select value={upcomingStatusFilter} onValueChange={setUpcomingStatusFilter}>
                                <SelectTrigger id="upcoming-status-filter" className="w-full">
                                    <ListFilter className="mr-2 size-4 text-slate-400" />
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All active statuses</SelectItem>
                                    <SelectItem value="scheduled">Scheduled</SelectItem>
                                    <SelectItem value="vet_ready">Vet ready</SelectItem>
                                    <SelectItem value="in_progress">In progress</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </div>

                {isLoading ? (
                    <div role="status" className="divide-y divide-slate-100 dark:divide-slate-800">
                        <span className="sr-only">Loading online consultations...</span>
                        {[0, 1, 2].map((item) => (
                            <div key={item} className="grid gap-4 px-4 py-5 sm:grid-cols-[5.25rem_minmax(0,1fr)_10rem] sm:px-5">
                                <div className="h-16 rounded-lg bg-slate-100 motion-safe:animate-pulse dark:bg-slate-800" />
                                <div className="space-y-2">
                                    <div className="h-4 w-40 rounded bg-slate-100 motion-safe:animate-pulse dark:bg-slate-800" />
                                    <div className="h-3 w-64 max-w-full rounded bg-slate-100 motion-safe:animate-pulse dark:bg-slate-800" />
                                    <div className="h-3 w-52 max-w-full rounded bg-slate-100 motion-safe:animate-pulse dark:bg-slate-800" />
                                </div>
                                <div className="h-10 rounded-lg bg-slate-100 motion-safe:animate-pulse dark:bg-slate-800" />
                            </div>
                        ))}
                    </div>
                ) : activeConsultations.length > 0 ? (
                    <div
                        role="tabpanel"
                        id="consultation-list-panel"
                        aria-labelledby={`consultation-tab-${activeView}`}
                        className="divide-y divide-slate-100 dark:divide-slate-800"
                    >
                        {activeView === 'upcoming'
                            ? activeConsultations.map(renderUpcomingConsultation)
                            : activeConsultations.map(renderHistoryConsultation)}
                    </div>
                ) : (
                    <div
                        role="tabpanel"
                        id="consultation-list-panel"
                        aria-labelledby={`consultation-tab-${activeView}`}
                        className="flex flex-col items-center px-5 py-14 text-center"
                    >
                        <span className="flex size-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                            <ActiveViewIcon className="size-6" aria-hidden="true" />
                        </span>
                        <h3 className="mt-4 text-base font-black text-slate-800 dark:text-slate-100">{viewDetails.emptyTitle}</h3>
                        <p className="mt-1 max-w-md text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">
                            {viewDetails.emptyDescription}
                        </p>
                        {filtersAreActive && (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={clearFilters}
                                className="mt-5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                            >
                                Clear filters
                            </Button>
                        )}
                    </div>
                )}
            </section>
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
