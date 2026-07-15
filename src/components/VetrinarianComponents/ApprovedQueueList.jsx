import { useMemo, useState } from 'react';
import {
    AlertCircle,
    CalendarClock,
    CheckCircle2,
    ChevronDown,
    Clock,
    Loader2,
    RefreshCw,
    Search,
    Stethoscope,
    XCircle
} from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { toast } from '../../reusecomponent/toast.jsx';
import { calculateAge, formatDisplayDateTime } from '../../lib/date';
import { formatQueueReference } from '../../lib/referenceNumbers';
import { getServiceDisplayName } from '../../lib/serviceLabels';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { useDashboardUser } from '../dashboardRouter.jsx';
import {
    fetchBookings as fetchBookingsService,
    receiveBooking as receiveBookingService,
    updateBookingSchedule
} from '../../services/bookingService';
import { fetchQueues, receiveQueue as receiveQueueService } from '../../services/queueService';
const BOOKING_QUEUE_SOURCE = 'booking_management';

function normalize(value) {
    return String(value || '').trim().toLowerCase();
}

function isBookingQueue(item) {
    return normalize(item.queue_source) === BOOKING_QUEUE_SOURCE;
}

function toLocalDateKey(value) {
    if (!value) return '';

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return [
            value.getFullYear(),
            String(value.getMonth() + 1).padStart(2, '0'),
            String(value.getDate()).padStart(2, '0')
        ].join('-');
    }

    const rawValue = String(value).trim();
    const dateMatch = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})/);

    if (dateMatch) {
        return `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
    }

    const parsedDate = new Date(rawValue);

    if (Number.isNaN(parsedDate.getTime())) {
        return '';
    }

    return toLocalDateKey(parsedDate);
}

function getScheduleDateValue(item) {
    return item.booking_date
        || item.scheduled_date
        || item.appointment_date
        || item.date
        || item.timestamp;
}

function isScheduledForDate(item, dateKey) {
    return toLocalDateKey(getScheduleDateValue(item)) === dateKey;
}

function isApprovedQueue(item) {
    return normalize(item.status) === 'in-progress';
}

function isCompletedQueue(item) {
    const status = normalize(item.status);
    return status === 'completed' || status === 'done' || normalize(item.assignment_status) === 'completed';
}

function hasActiveVetAssignment(item) {
    return Number(item.has_active_assignment || 0) === 1 || normalize(item.assignment_status) === 'received';
}

function ownerName(item) {
    return item.owner_name || `${item.first_Name || ''} ${item.last_Name || ''}`.trim() || 'Unknown Owner';
}

function petAge(item) {
    return item.pet_age || calculateAge(item.pet_BDAY) || 'N/A';
}

function formatQueueTime(value) {
    return formatDisplayDateTime(value, undefined, { fallback: 'Not set' });
}

function formatScheduleTime(item) {
    const dateValue = getScheduleDateValue(item);

    if (item.booking_date && item.booking_time) {
        return formatDisplayDateTime(`${item.booking_date} ${item.booking_time}`, undefined, { fallback: 'Not set' });
    }

    return formatQueueTime(dateValue);
}

function formatBookingSchedule(booking) {
    return formatDisplayDateTime(booking.date, booking.time, { fallback: 'Not set' });
}

function queueBookingNumber(item) {
    const match = String(item.complaint || '').match(/\[Booking:\s*([^\]]+)\]/);
    return match ? match[1].trim() : '';
}

function bookingOwnerName(booking) {
    return booking.ownerName || 'Unknown Owner';
}

function isConfirmedBooking(booking) {
    return normalize(booking.status) === 'confirmed';
}

function isBoardingBooking(booking) {
    return normalize(booking.type) === 'boarding'
        || Boolean(booking.hotelBoardingType || booking.hotel_boarding_type);
}

function isSpecialServiceBooking(booking) {
    const type = normalize(booking.type);
    const service = normalize(booking.service);

    return type.includes('special') || service.includes('special');
}

function isHomeServiceBooking(booking) {
    const type = normalize(booking.type);
    const service = normalize(booking.service);

    return Boolean(booking.isHomeService) || type === 'home-service' || type === 'home_service' || service.includes('home service');
}

function isNormalPhysicalBooking(booking) {
    return isConfirmedBooking(booking)
        && !booking.isOnlineConsultation
        && !isHomeServiceBooking(booking)
        && !isBoardingBooking(booking)
        && !isSpecialServiceBooking(booking);
}

function isApprovedClinicOrHomeServiceBooking(booking) {
    return isConfirmedBooking(booking)
        && !booking.isOnlineConsultation
        && !isBoardingBooking(booking)
        && !isSpecialServiceBooking(booking);
}

function isAutoRescheduledBooking(booking) {
    return /\[Rescheduled\]|\[Lifecycle\]\s*Auto-rescheduled due to missed approved booking/i.test(String(booking.notes || ''));
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

export default function VetQueueList() {
    const dashboardUser = useDashboardUser();
    const currentUser = useMemo(() => dashboardUser || getStoredUser(), [dashboardUser]);
    const veterinarianUserId = getUserId(currentUser);
    const veterinarianName = getUserName(currentUser);
    const [queue, setQueue] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [expandedRows, setExpandedRows] = useState(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isBookingsLoading, setIsBookingsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');
    const [bookingsErrorMessage, setBookingsErrorMessage] = useState('');
    const [updatingQueueId, setUpdatingQueueId] = useState(null);
    const [updatingBookingId, setUpdatingBookingId] = useState(null);

    const loadQueue = async ({ isAutoRefresh = false } = {}) => {
        if (!isAutoRefresh) {
            setIsLoading(true);
            setErrorMessage('');
        }

        try {
            const data = await fetchQueues();

            setQueue(Array.isArray(data) ? data : []);
            return Array.isArray(data) ? data : [];
        } catch (error) {
            if (!isAutoRefresh) {
                setErrorMessage(error.message || 'Failed to load approved queue.');
            }
            return [];
        } finally {
            setIsLoading(false);
        }
    };

    const loadBookings = async ({ isAutoRefresh = false } = {}) => {
        if (!isAutoRefresh) {
            setIsBookingsLoading(true);
            setBookingsErrorMessage('');
        }

        try {
            const data = await fetchBookingsService();

            setBookings(Array.isArray(data) ? data : []);
            return Array.isArray(data) ? data : [];
        } catch (error) {
            if (!isAutoRefresh) {
                setBookingsErrorMessage(error.message || 'Failed to load approved bookings.');
            }
            return [];
        } finally {
            setIsBookingsLoading(false);
        }
    };

    useAutoRefresh(loadQueue, { refreshKey: 'approved-queue-list' });
    useAutoRefresh(loadBookings, { refreshKey: 'approved-bookings-list' });

    const todayKey = toLocalDateKey(new Date());

    const todayQueue = useMemo(() => {
        return queue.filter(item => isScheduledForDate(item, todayKey));
    }, [queue, todayKey]);

    const queueOnly = useMemo(() => {
        return todayQueue.filter(item => !isBookingQueue(item) || isApprovedQueue(item));
    }, [todayQueue]);

    const approvedQueue = useMemo(() => {
        return queueOnly
            .filter(isApprovedQueue)
            .filter(item => !hasActiveVetAssignment(item))
            .sort((a, b) => Number(a.queue_number || 0) - Number(b.queue_number || 0));
    }, [queueOnly]);

    const bookingQueueByKey = useMemo(() => {
        const mapped = new Map();

        queue.filter(isBookingQueue).forEach(item => {
            if (item.booking_id) {
                mapped.set(`id:${item.booking_id}`, item);
            }

            const bookingNumber = queueBookingNumber(item);
            if (bookingNumber) {
                mapped.set(`number:${bookingNumber}`, item);
            }
        });

        return mapped;
    }, [queue]);

    const getQueueForBooking = (booking) => {
        return bookingQueueByKey.get(`id:${booking.id}`)
            || bookingQueueByKey.get(`number:${booking.bookingNumber}`)
            || null;
    };

    const confirmedBookings = useMemo(() => {
        return bookings
            .filter(isApprovedClinicOrHomeServiceBooking)
            .filter(booking => {
                const bookingDate = toLocalDateKey(booking.date);
                if (isHomeServiceBooking(booking)) {
                    return !bookingDate || bookingDate >= todayKey;
                }
                return bookingDate === todayKey;
            })
            .filter(booking => !isAutoRescheduledBooking(booking))
            .sort((a, b) => {
                const leftDate = new Date(`${a.date || ''}T${a.time || '00:00:00'}`);
                const rightDate = new Date(`${b.date || ''}T${b.time || '00:00:00'}`);
                return leftDate - rightDate;
            });
    }, [bookings, todayKey]);

    const missedBookings = useMemo(() => {
        return bookings
            .filter(isNormalPhysicalBooking)
            .filter(booking => {
                const bookingDate = toLocalDateKey(booking.date);
                if (!bookingDate) return false;
                return bookingDate < todayKey || (bookingDate === todayKey && isAutoRescheduledBooking(booking));
            })
            .sort((a, b) => {
                const leftDate = new Date(`${a.date || ''}T${a.time || '00:00:00'}`);
                const rightDate = new Date(`${b.date || ''}T${b.time || '00:00:00'}`);
                return leftDate - rightDate;
            });
    }, [bookings, todayKey]);

    const filteredQueue = useMemo(() => {
        const query = normalize(searchQuery);

        if (!query) {
            return approvedQueue;
        }

        return approvedQueue.filter(item => {
            const searchableText = [
                formatQueueReference(item),
                item.pet_name,
                ownerName(item),
                getServiceDisplayName(item.service_name, ''),
                item.priority,
                item.complaint,
                item.pet_species,
                item.pet_breed
            ].join(' ');

            return normalize(searchableText).includes(query);
        });
    }, [approvedQueue, searchQuery]);

    const filteredConfirmedBookings = useMemo(() => {
        const query = normalize(searchQuery);

        if (!query) {
            return confirmedBookings;
        }

        return confirmedBookings.filter(booking => {
            const searchableText = [
                booking.bookingNumber,
                booking.petName,
                bookingOwnerName(booking),
                getServiceDisplayName(booking.service, ''),
                getServiceDisplayName(booking.type, ''),
                booking.notes,
                booking.date,
                booking.time,
                booking.petSpecies,
                booking.petBreed
            ].join(' ');

            return normalize(searchableText).includes(query);
        });
    }, [confirmedBookings, searchQuery]);

    const filteredMissedBookings = useMemo(() => {
        const query = normalize(searchQuery);

        if (!query) {
            return missedBookings;
        }

        return missedBookings.filter(booking => {
            const searchableText = [
                booking.bookingNumber,
                booking.petName,
                bookingOwnerName(booking),
                getServiceDisplayName(booking.service, ''),
                getServiceDisplayName(booking.type, ''),
                booking.notes,
                booking.date,
                booking.time,
                booking.petSpecies,
                booking.petBreed
            ].join(' ');

            return normalize(searchableText).includes(query);
        });
    }, [missedBookings, searchQuery]);

    const toggleRow = (id) => {
        setExpandedRows(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const receiveQueue = async (queueId) => {
        if (!veterinarianUserId) {
            toast.error('Could not identify the current veterinarian account.');
            return;
        }

        setUpdatingQueueId(queueId);

        try {
            const data = await receiveQueueService({
                queue_id: queueId,
                veterinarian_user_id: veterinarianUserId,
                veterinarian_name: veterinarianName
            });

            if (!data.success) {
                throw new Error(data.error || data.message || 'Failed to receive queue patient.');
            }

            const assignment = data.assignment || {};
            setQueue(currentQueue =>
                currentQueue.map(item =>
                    item.queue_id === queueId
                        ? {
                            ...item,
                            assignment_id: assignment.assignment_id,
                            assignment_status: assignment.status || 'received',
                            veterinarian_user_id: assignment.veterinarian_user_id || veterinarianUserId,
                            veterinarian_name: assignment.veterinarian_name || veterinarianName,
                            received_at: assignment.received_at || new Date().toISOString(),
                            has_active_assignment: 1
                        }
                        : item
                )
            );
            setExpandedRows(prev => {
                const next = new Set(prev);
                next.delete(queueId);
                return next;
            });
            toast.success('Patient received and moved to My List.');
        } catch (error) {
            toast.error(error.message || 'Failed to receive queue patient.');
        } finally {
            setUpdatingQueueId(null);
        }
    };

    const upsertQueueItem = (queueItem) => {
        if (!queueItem?.queue_id) return;

        setQueue(currentQueue => {
            const exists = currentQueue.some(item => Number(item.queue_id) === Number(queueItem.queue_id));

            if (exists) {
                return currentQueue.map(item =>
                    Number(item.queue_id) === Number(queueItem.queue_id) ? { ...item, ...queueItem } : item
                );
            }

            return [queueItem, ...currentQueue];
        });
    };

    const rescheduleBookingToday = async (booking) => {
        const actionKey = `${booking.id}:reschedule`;
        setUpdatingBookingId(actionKey);

        try {
            const data = await updateBookingSchedule(booking.id, {
                booking_date: todayKey,
                booking_time: booking.time,
                reason: 'Vet approved queue reschedule today',
                changed_by_user_id: veterinarianUserId || null
            });

            setBookings(currentBookings =>
                currentBookings.map(item =>
                    item.id === booking.id
                        ? { ...item, date: todayKey, onlineConsultation: data.onlineConsultation || item.onlineConsultation }
                        : item
                )
            );
            toast.success(`${booking.bookingNumber} rescheduled to today.`);
        } catch (error) {
            toast.error(error.message || 'Failed to reschedule booking for today.');
        } finally {
            setUpdatingBookingId(null);
        }
    };

    const receiveBooking = async (booking) => {
        if (!veterinarianUserId) {
            toast.error('Could not identify the current veterinarian account.');
            return;
        }

        if (toLocalDateKey(booking.date) !== todayKey) {
            toast.error('Reschedule this booking to today before receiving it.');
            return;
        }

        if (!booking.petId) {
            toast.error('Register this booking pet before receiving it for diagnosis.');
            return;
        }

        const actionKey = `${booking.id}:receive`;
        setUpdatingBookingId(actionKey);

        try {
            const data = await receiveBookingService(booking.id, {
                veterinarian_user_id: veterinarianUserId,
                veterinarian_name: veterinarianName,
                service_name: getServiceDisplayName(booking.service || booking.type, 'Booking')
            });

            if (!data.success) {
                throw new Error(data.message || data.error || 'Failed to receive booking.');
            }

            upsertQueueItem(data.queue);
            loadQueue({ isAutoRefresh: true });
            loadBookings({ isAutoRefresh: true });
            toast.success('Booking received and moved to My List.');
        } catch (error) {
            toast.error(error.message || 'Failed to receive booking.');
        } finally {
            setUpdatingBookingId(null);
        }
    };

    const renderBookingAction = (booking) => {
        const matchingQueue = getQueueForBooking(booking);
        const scheduledToday = toLocalDateKey(booking.date) === todayKey;
        const rescheduleActionKey = `${booking.id}:reschedule`;
        const receiveActionKey = `${booking.id}:receive`;
        const isUpdatingReschedule = updatingBookingId === rescheduleActionKey;
        const isUpdatingReceive = updatingBookingId === receiveActionKey;

        if (matchingQueue && isCompletedQueue(matchingQueue)) {
            return <Badge className="border-0 bg-green-50 text-green-700">Done</Badge>;
        }

        if (matchingQueue && hasActiveVetAssignment(matchingQueue)) {
            return (
                <Button type="button" size="sm" disabled className="h-8 bg-slate-200 px-3 text-xs font-bold text-slate-600">
                    <CheckCircle2 className="mr-1 size-3" />
                    Received
                </Button>
            );
        }

        if (!scheduledToday) {
            return (
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => rescheduleBookingToday(booking)}
                    disabled={isUpdatingReschedule}
                    className="h-8 border-[#155dfc] px-3 text-xs font-bold text-[#155dfc] hover:bg-blue-50"
                >
                    {isUpdatingReschedule ? (
                        <Loader2 className="mr-1 size-3 animate-spin" />
                    ) : (
                        <CalendarClock className="mr-1 size-3" />
                    )}
                    Resched Today
                </Button>
            );
        }

        if (!booking.petId) {
            return (
                <Button type="button" size="sm" disabled className="h-8 px-3 text-xs font-bold" title="Register this pet before receiving.">
                    Receive
                </Button>
            );
        }

        return (
            <Button
                type="button"
                size="sm"
                onClick={() => receiveBooking(booking)}
                disabled={isUpdatingReceive}
                className="h-8 bg-[#155dfc] px-3 text-xs font-bold text-white hover:bg-[#0d4acf]"
            >
                {isUpdatingReceive ? (
                    <Loader2 className="mr-1 size-3 animate-spin" />
                ) : (
                    <Stethoscope className="mr-1 size-3" />
                )}
                Receive
            </Button>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-[#101828]">Approved Queue List</h2>
                    <p className="text-sm font-medium text-slate-500">
                        Queue patients for today, current-date confirmed bookings, and missed physical bookings.
                    </p>
                </div>
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                        loadQueue();
                        loadBookings();
                    }}
                    disabled={isLoading || isBookingsLoading}
                    className="w-full gap-2 sm:w-auto"
                >
                    {isLoading || isBookingsLoading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                    Refresh
                </Button>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div>
                    <Input
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder="Search queue ID, pet, owner, service, or complaint"
                        className="h-10"
                        leftIcon={<Search className="size-4" />}
                    />
                </div>
            </div>

            {errorMessage && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
                    {errorMessage}
                </div>
            )}

            {bookingsErrorMessage && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
                    {bookingsErrorMessage}
                </div>
            )}

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <Table>
                    <TableHeader className="bg-slate-50">
                        <TableRow>
                            <TableHead className="w-10"></TableHead>
                            <TableHead className="w-28">Queue ID</TableHead>
                            <TableHead>Pet</TableHead>
                            <TableHead className="hidden md:table-cell">Owner</TableHead>
                            <TableHead className="hidden lg:table-cell">Service</TableHead>
                            <TableHead className="hidden xl:table-cell">Schedule / Approved Time</TableHead>
                            <TableHead>Priority</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={9} className="py-12 text-center text-slate-500">
                                    <span className="inline-flex items-center gap-2 font-semibold">
                                        <Loader2 className="size-4 animate-spin" />
                                        Loading approved queue...
                                    </span>
                                </TableCell>
                            </TableRow>
                        ) : filteredQueue.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={9} className="py-12 text-center text-slate-400">
                                    No approved queue patients found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredQueue.flatMap(item => {
                                const isExpanded = expandedRows.has(item.queue_id);

                                return [
                                    <TableRow key={item.queue_id} className={isExpanded ? 'bg-blue-50/40' : 'hover:bg-slate-50'}>
                                        <TableCell>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => toggleRow(item.queue_id)}
                                                className="h-8 w-8 p-0"
                                                aria-label={isExpanded ? 'Collapse queue details' : 'Expand queue details'}
                                            >
                                                <ChevronDown className={`size-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                            </Button>
                                        </TableCell>
                                        <TableCell className="font-black text-slate-800">{formatQueueReference(item)}</TableCell>
                                        <TableCell>
                                            <div>
                                                <p className="font-bold text-slate-900">{item.pet_name || 'Unknown Pet'}</p>
                                                <p className="text-xs font-medium text-slate-500">
                                                    {[item.pet_species, item.pet_breed].filter(Boolean).join(' - ') || 'No pet profile details'}
                                                </p>
                                            </div>
                                        </TableCell>
                                        <TableCell className="hidden md:table-cell font-medium text-slate-700">
                                            {ownerName(item)}
                                        </TableCell>
                                        <TableCell className="hidden lg:table-cell text-sm font-medium text-slate-600">
                                            {getServiceDisplayName(item.service_name, 'Queue')}
                                        </TableCell>
                                        <TableCell className="hidden xl:table-cell text-xs font-semibold text-slate-500">
                                            {formatScheduleTime(item)}
                                        </TableCell>
                                        <TableCell>{getPriorityBadge(item.priority)}</TableCell>
                                        <TableCell>{getStatusBadge(item.status)}</TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                type="button"
                                                size="sm"
                                                onClick={() => receiveQueue(item.queue_id)}
                                                disabled={updatingQueueId === item.queue_id}
                                                className="h-8 bg-[#155dfc] px-3 text-xs font-bold text-white hover:bg-[#0d4acf]"
                                            >
                                                {updatingQueueId === item.queue_id ? (
                                                    <Loader2 className="mr-1 size-3 animate-spin" />
                                                ) : (
                                                    <Stethoscope className="mr-1 size-3" />
                                                )}
                                                Receive
                                            </Button>
                                        </TableCell>
                                    </TableRow>,
                                    isExpanded && (
                                        <TableRow key={`${item.queue_id}-details`} className="bg-slate-50/60">
                                            <TableCell colSpan={9} className="p-0">
                                                <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
                                                    <DetailItem label="Complaint" value={item.complaint} className="md:col-span-2 xl:col-span-4" />
                                                    <DetailItem label="Owner Contact" value={item.contactNumber} />
                                                    <DetailItem label="Owner Type" value={item.owner_status} />
                                                    <DetailItem label="Address" value={item.address} className="md:col-span-2" />
                                                    <DetailItem label="Pet Age" value={petAge(item)} />
                                                    <DetailItem label="Pet Gender" value={item.pet_gender} />
                                                    <DetailItem label="Pet Weight" value={item.pet_weight ? `${item.pet_weight} kg` : ''} />
                                                    <DetailItem label="Source" value={getSourceLabel(item.queue_source)} />
                                                    <DetailItem label="Schedule / Approved Time" value={formatScheduleTime(item)} />
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )
                                ];
                            })
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className="flex flex-col gap-6">
            <div className="order-2 overflow-hidden rounded-xl border border-sky-200 bg-white shadow-sm">
                <div className="flex flex-col gap-1 border-b border-sky-100 bg-sky-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h3 className="text-base font-bold text-slate-900">Missed Bookings / Ready for Reschedule Today</h3>
                        <p className="text-xs font-semibold text-slate-500">
                            Normal physical bookings that missed their date or were auto-rescheduled to today.
                        </p>
                    </div>
                    <Badge className="w-fit border-0 bg-sky-100 text-sky-700">
                        {filteredMissedBookings.length} bookings
                    </Badge>
                </div>
                <Table>
                    <TableHeader className="bg-white">
                        <TableRow>
                            <TableHead className="w-32">Booking #</TableHead>
                            <TableHead>Pet</TableHead>
                            <TableHead className="hidden md:table-cell">Owner</TableHead>
                            <TableHead className="hidden lg:table-cell">Service</TableHead>
                            <TableHead className="hidden xl:table-cell">Desired Schedule</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isBookingsLoading ? (
                            <TableRow>
                                <TableCell colSpan={7} className="py-10 text-center text-slate-500">
                                    <span className="inline-flex items-center gap-2 font-semibold">
                                        <Loader2 className="size-4 animate-spin" />
                                        Loading missed bookings...
                                    </span>
                                </TableCell>
                            </TableRow>
                        ) : filteredMissedBookings.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="py-10 text-center text-slate-400">
                                    No missed bookings need reschedule.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredMissedBookings.map(booking => {
                                const scheduledToday = toLocalDateKey(booking.date) === todayKey;
                                const matchingQueue = getQueueForBooking(booking);

                                return (
                                    <TableRow key={`missed-${booking.id}`} className="hover:bg-slate-50">
                                        <TableCell className="font-black text-slate-800">{booking.bookingNumber}</TableCell>
                                        <TableCell>
                                            <div>
                                                <p className="font-bold text-slate-900">{booking.petName || 'Unknown Pet'}</p>
                                                <p className="text-xs font-medium text-slate-500">
                                                    {[booking.petSpecies, booking.petBreed].filter(Boolean).join(' - ') || 'No pet profile details'}
                                                </p>
                                            </div>
                                        </TableCell>
                                        <TableCell className="hidden md:table-cell font-medium text-slate-700">
                                            {bookingOwnerName(booking)}
                                        </TableCell>
                                        <TableCell className="hidden lg:table-cell text-sm font-medium text-slate-600">
                                            {getServiceDisplayName(booking.service || booking.type, 'Booking')}
                                        </TableCell>
                                        <TableCell className="hidden xl:table-cell text-xs font-semibold text-slate-500">
                                            {formatBookingSchedule(booking)}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap gap-2">
                                                {scheduledToday ? (
                                                    <Badge className="border-0 bg-sky-100 text-sky-700">Auto-rescheduled from previous date</Badge>
                                                ) : (
                                                    <Badge className="border-0 bg-amber-50 text-amber-700">Missed Booking - Ready for Reschedule</Badge>
                                                )}
                                                {matchingQueue && hasActiveVetAssignment(matchingQueue) && (
                                                    <Badge className="border-0 bg-slate-100 text-slate-700">Received</Badge>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {renderBookingAction(booking)}
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className="order-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col gap-1 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h3 className="text-base font-bold text-slate-900">Confirmed / Approved Bookings</h3>
                        <p className="text-xs font-semibold text-slate-500">
                            Today&apos;s confirmed clinic bookings and upcoming confirmed home-service bookings.
                        </p>
                    </div>
                    <Badge className="w-fit border-0 bg-emerald-100 text-emerald-700">
                        {filteredConfirmedBookings.length} bookings
                    </Badge>
                </div>
                <Table>
                    <TableHeader className="bg-white">
                        <TableRow>
                            <TableHead className="w-32">Booking #</TableHead>
                            <TableHead>Pet</TableHead>
                            <TableHead className="hidden md:table-cell">Owner</TableHead>
                            <TableHead className="hidden lg:table-cell">Service</TableHead>
                            <TableHead className="hidden xl:table-cell">Desired Schedule</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isBookingsLoading ? (
                            <TableRow>
                                <TableCell colSpan={7} className="py-12 text-center text-slate-500">
                                    <span className="inline-flex items-center gap-2 font-semibold">
                                        <Loader2 className="size-4 animate-spin" />
                                        Loading approved bookings...
                                    </span>
                                </TableCell>
                            </TableRow>
                        ) : filteredConfirmedBookings.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="py-12 text-center text-slate-400">
                                    No approved clinic or home-service bookings to show.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredConfirmedBookings.map(booking => {
                                const scheduledToday = toLocalDateKey(booking.date) === todayKey;
                                const matchingQueue = getQueueForBooking(booking);

                                return (
                                    <TableRow key={booking.id} className="hover:bg-slate-50">
                                        <TableCell className="font-black text-slate-800">{booking.bookingNumber}</TableCell>
                                        <TableCell>
                                            <div>
                                                <p className="font-bold text-slate-900">{booking.petName || 'Unknown Pet'}</p>
                                                <p className="text-xs font-medium text-slate-500">
                                                    {[booking.petSpecies, booking.petBreed].filter(Boolean).join(' - ') || 'No pet profile details'}
                                                </p>
                                            </div>
                                        </TableCell>
                                        <TableCell className="hidden md:table-cell font-medium text-slate-700">
                                            {bookingOwnerName(booking)}
                                        </TableCell>
                                        <TableCell className="hidden lg:table-cell text-sm font-medium text-slate-600">
                                            {getServiceDisplayName(booking.service || booking.type, 'Booking')}
                                        </TableCell>
                                        <TableCell className="hidden xl:table-cell text-xs font-semibold text-slate-500">
                                            {formatBookingSchedule(booking)}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap gap-2">
                                                <Badge className="border-0 bg-blue-50 text-blue-700">Approved</Badge>
                                                {isHomeServiceBooking(booking) && (
                                                    <Badge className="border-0 bg-violet-50 text-violet-700">Home Service</Badge>
                                                )}
                                                {scheduledToday && (
                                                    <Badge className="border-0 bg-emerald-50 text-emerald-700">Today</Badge>
                                                )}
                                                {matchingQueue && hasActiveVetAssignment(matchingQueue) && (
                                                    <Badge className="border-0 bg-slate-100 text-slate-700">Received</Badge>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {renderBookingAction(booking)}
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>
            </div>
        </div>
    );
}

function getStatusBadge(status) {
    const normalizedStatus = normalize(status);

    if (normalizedStatus === 'in-progress') {
        return (
            <Badge className="border-0 bg-blue-600 text-white">
                <Stethoscope className="mr-1 size-3" />
                Approved
            </Badge>
        );
    }

    if (normalizedStatus === 'completed' || normalizedStatus === 'done') {
        return (
            <Badge className="border-0 bg-green-600 text-white">
                <CheckCircle2 className="mr-1 size-3" />
                Done
            </Badge>
        );
    }

    if (normalizedStatus === 'cancelled') {
        return (
            <Badge className="border-0 bg-red-600 text-white">
                <XCircle className="mr-1 size-3" />
                Cancelled
            </Badge>
        );
    }

    return (
        <Badge className="border border-amber-200 bg-amber-50 text-amber-700">
            <Clock className="mr-1 size-3" />
            Waiting
        </Badge>
    );
}

function getPriorityBadge(priority) {
    return normalize(priority) === 'urgent' ? (
        <Badge className="border-0 bg-red-600 text-white">
            <AlertCircle className="mr-1 size-3" />
            Urgent
        </Badge>
    ) : (
        <Badge className="border-0 bg-slate-100 text-slate-700">Normal</Badge>
    );
}

function getSourceLabel(source) {
    const normalizedSource = normalize(source);
    if (normalizedSource === 'self_service') return 'Self-Service Queue';
    if (normalizedSource === 'booking_management') return 'Approved Booking';
    if (normalizedSource === 'register') return 'Pet Registration';
    if (normalizedSource === 'admin') return 'Admin Queue';
    return source || 'Admin Queue';
}

function DetailItem({ label, value, className = '' }) {
    return (
        <div className={`space-y-1 ${className}`}>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
            <p className="min-h-[1.25rem] break-words text-sm font-semibold text-slate-700">
                {value || <span className="text-slate-300">N/A</span>}
            </p>
        </div>
    );
}
