import { useCallback, useMemo, useState } from 'react';
import {
    Building2,
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    Clock3,
    DoorOpen,
    Loader2,
    Stethoscope,
} from 'lucide-react';

import { Button } from '../../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Label } from '../../ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../../ui/select';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { fetchBookingAvailability } from '../../services/bookingAvailabilityService';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FALLBACK_SERVICES = [
    { key: 'general-checkup', label: 'General Check-up' },
    { key: 'vaccination', label: 'Vaccination' },
    { key: 'parasite-control', label: 'Parasite Control' },
    { key: 'grooming', label: 'Grooming' },
    { key: 'dental', label: 'Dental Check-up' },
    { key: 'surgery', label: 'Surgery' },
    { key: 'lab-testing', label: 'Laboratory Testing' },
    { key: 'online-consultation', label: 'Online Consultation' },
    { key: 'home-service', label: 'Home Service' },
    { key: 'special-services', label: 'Special Services' },
    { key: 'boarding', label: 'Pet Hotel and Boarding', mode: 'rooms' },
];

function localDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function monthKey(date) {
    return localDateKey(date).slice(0, 7);
}

function parseMonth(value) {
    const [year, month] = String(value || '').split('-').map(Number);
    return new Date(year || new Date().getFullYear(), Math.max(0, (month || 1) - 1), 1);
}

function shiftMonth(value, amount) {
    const date = parseMonth(value);
    date.setMonth(date.getMonth() + amount);
    return monthKey(date);
}

function longDate(value) {
    const [year, month, day] = String(value || '').split('-').map(Number);
    if (!year || !month || !day) return 'Selected date';
    return new Intl.DateTimeFormat('en-PH', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    }).format(new Date(year, month - 1, day));
}

function dayStatusClasses(day) {
    if (!day?.isOpen || day.status === 'closed') {
        return 'bg-slate-200 dark:bg-slate-700';
    }
    if (day.status === 'available') {
        return 'bg-emerald-500';
    }
    return 'bg-amber-500';
}

export default function ClinicAvailabilityCalendar({
    className = '',
    title = 'Clinic availability',
    description = 'Choose a date to see available and reserved appointment times.',
    initialService = 'general-checkup',
    lockedBranchId = '',
    allowBranchSelection = true,
    showServiceFilter = true,
    compact = false,
    onSelectSlot,
    onSelectRoom,
}) {
    const today = useMemo(() => new Date(), []);
    const [service, setService] = useState(initialService);
    const [month, setMonth] = useState(monthKey(today));
    const [selectedDate, setSelectedDate] = useState(localDateKey(today));
    const [branchId, setBranchId] = useState(String(lockedBranchId || ''));
    const [veterinarianId, setVeterinarianId] = useState('');
    const [availability, setAvailability] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');

    const loadAvailability = useCallback(async ({ isAutoRefresh = false } = {}) => {
        if (!isAutoRefresh) {
            setIsLoading(true);
            setErrorMessage('');
        }

        try {
            const response = await fetchBookingAvailability({
                service,
                month,
                date: selectedDate,
                branchId: lockedBranchId || branchId,
                veterinarianId,
            });
            setAvailability(response);

            const resolvedBranchId = response?.selected?.branchId;
            if (resolvedBranchId && !lockedBranchId && String(resolvedBranchId) !== branchId) {
                setBranchId(String(resolvedBranchId));
            }
            const resolvedVetId = response?.selected?.veterinarianId;
            const resolvedVetValue = resolvedVetId ? String(resolvedVetId) : '';
            if (resolvedVetValue !== veterinarianId) {
                setVeterinarianId(resolvedVetValue);
            }
        } catch (error) {
            if (!isAutoRefresh) {
                setErrorMessage(error.message || 'Availability could not be loaded.');
            }
            throw error;
        } finally {
            setIsLoading(false);
        }
    }, [branchId, lockedBranchId, month, selectedDate, service, veterinarianId]);

    useAutoRefresh(loadAvailability, {
        refreshKey: `${service}:${month}:${selectedDate}:${lockedBranchId || branchId}:${veterinarianId}`,
    });

    const services = availability?.filters?.services?.length
        ? availability.filters.services
        : FALLBACK_SERVICES;
    const branches = availability?.filters?.branches || [];
    const veterinarians = availability?.filters?.veterinarians || [];
    const days = availability?.days || [];
    const details = availability?.details || {};
    const selectedService = services.find((item) => item.key === service);
    const isBoarding = service === 'boarding' || selectedService?.mode === 'rooms';
    const isOnlineConsultation = service === 'online-consultation';
    const selectedBranch = branches.find((branch) => String(branch.id) === String(lockedBranchId || branchId));
    const selectedVet = veterinarians.find((vet) => String(vet.id) === veterinarianId);
    const selectedVeterinarianName = selectedVet?.name || availability?.selected?.veterinarianName || '';
    const firstWeekday = parseMonth(month).getDay();
    const calendarCells = [...Array(firstWeekday).fill(null), ...days];

    const handleMonthChange = (amount) => {
        const nextMonth = shiftMonth(month, amount);
        setMonth(nextMonth);
        setSelectedDate(`${nextMonth}-01`);
    };

    return (
        <Card className={className}>
            <CardHeader className={compact ? 'pb-0' : ''}>
                <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[#155dfc] dark:bg-blue-950/50 dark:text-blue-300">
                        <CalendarDays className="size-4" />
                    </span>
                    <div className="min-w-0">
                        <CardTitle>{title}</CardTitle>
                        <CardDescription>{description}</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div data-session-persist="off" data-filter-bar className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {showServiceFilter && (
                        <div>
                            <Label className="mb-1.5">Service</Label>
                            <Select
                                value={service}
                                onValueChange={(value) => {
                                    setService(value);
                                    setVeterinarianId('');
                                }}
                                searchable={false}
                            >
                                <SelectTrigger aria-label="Availability service">
                                    <Stethoscope className="text-slate-400" />
                                    <SelectValue placeholder="Select service" displayValue={selectedService?.label} />
                                </SelectTrigger>
                                <SelectContent>
                                    {services.map((item) => (
                                        <SelectItem key={item.key} value={item.key}>{item.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {allowBranchSelection && !lockedBranchId && branches.length > 1 && (
                        <div>
                            <Label className="mb-1.5">Location</Label>
                            <Select value={branchId} onValueChange={setBranchId} searchable={false}>
                                <SelectTrigger aria-label="Availability location">
                                    <Building2 className="text-slate-400" />
                                    <SelectValue placeholder="Select location" displayValue={selectedBranch?.name} />
                                </SelectTrigger>
                                <SelectContent>
                                    {branches.map((branch) => (
                                        <SelectItem key={branch.id} value={String(branch.id)}>{branch.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {veterinarians.length > 0 && (
                        <div>
                            <Label className="mb-1.5">Veterinarian</Label>
                            <Select
                                value={veterinarianId || (isOnlineConsultation ? '' : 'all')}
                                onValueChange={(value) => setVeterinarianId(value === 'all' ? '' : value)}
                                searchable={veterinarians.length > 8}
                            >
                                <SelectTrigger aria-label="Availability veterinarian">
                                    <Stethoscope className="text-slate-400" />
                                    <SelectValue
                                        placeholder="Select veterinarian"
                                        displayValue={selectedVet?.name || (!isOnlineConsultation ? 'All visiting veterinarians' : undefined)}
                                    />
                                </SelectTrigger>
                                <SelectContent>
                                    {!isOnlineConsultation && (
                                        <SelectItem value="all">All visiting veterinarians</SelectItem>
                                    )}
                                    {veterinarians.map((vet) => (
                                        <SelectItem key={vet.id} value={String(vet.id)}>{vet.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </div>

                {errorMessage ? (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300" role="alert">
                        {errorMessage}
                    </div>
                ) : (
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(240px,0.75fr)]">
                        <div className="min-w-0 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                            <div className="mb-3 flex items-center justify-between gap-2">
                                <Button type="button" variant="ghost" size="icon" onClick={() => handleMonthChange(-1)} aria-label="Previous month">
                                    <ChevronLeft />
                                </Button>
                                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                    {new Intl.DateTimeFormat('en-PH', { month: 'long', year: 'numeric' }).format(parseMonth(month))}
                                </p>
                                <Button type="button" variant="ghost" size="icon" onClick={() => handleMonthChange(1)} aria-label="Next month">
                                    <ChevronRight />
                                </Button>
                            </div>
                            <div className="grid grid-cols-7 gap-1 text-center">
                                {WEEKDAYS.map((weekday) => (
                                    <div key={weekday} className="py-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                                        {weekday}
                                    </div>
                                ))}
                                {calendarCells.map((day, index) => day ? (
                                    <button
                                        key={day.date}
                                        type="button"
                                        onClick={() => setSelectedDate(day.date)}
                                        aria-label={`${longDate(day.date)}: ${day.status}`}
                                        aria-pressed={selectedDate === day.date}
                                        className={`relative flex min-h-11 flex-col items-center justify-center rounded-md border text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155dfc] ${selectedDate === day.date
                                            ? 'border-[#155dfc] bg-blue-50 text-[#155dfc] dark:bg-blue-950/40 dark:text-blue-300'
                                            : 'border-transparent text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'}`}
                                    >
                                        <span>{Number(day.date.slice(-2))}</span>
                                        <span className={`mt-1 size-1.5 rounded-full ${dayStatusClasses(day)}`} aria-hidden="true" />
                                    </button>
                                ) : <span key={`blank-${index}`} aria-hidden="true" />)}
                            </div>
                            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                                <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-emerald-500" />Available</span>
                                <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-amber-500" />Booked/full</span>
                                <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-slate-300 dark:bg-slate-700" />Closed</span>
                            </div>
                        </div>

                        <div className="min-w-0 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                            <div className="mb-3 flex items-start justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
                                <div>
                                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{longDate(selectedDate)}</p>
                                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                                        {isBoarding
                                            ? 'Room availability'
                                            : isOnlineConsultation && selectedVeterinarianName
                                                ? `Online consultation times with ${selectedVeterinarianName}`
                                                : 'Appointment times'}
                                    </p>
                                </div>
                                {isLoading && <Loader2 className="size-4 animate-spin text-slate-400" aria-label="Loading availability" />}
                            </div>

                            {isBoarding ? (
                                <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                                    {(details.rooms || []).length ? details.rooms.map((room) => (
                                        <button
                                            key={room.roomType}
                                            type="button"
                                            disabled={room.available <= 0 || !onSelectRoom}
                                            onClick={() => onSelectRoom?.({ service, date: selectedDate, room, branchId: Number(lockedBranchId || branchId) })}
                                            className="flex w-full items-center justify-between gap-3 rounded-md bg-slate-50 px-3 py-2 text-left transition-colors enabled:hover:bg-slate-100 enabled:focus-visible:outline-none enabled:focus-visible:ring-2 enabled:focus-visible:ring-[#155dfc] disabled:cursor-default dark:bg-slate-800/70 dark:enabled:hover:bg-slate-800"
                                        >
                                            <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                                                <DoorOpen className="size-4 shrink-0 text-slate-400" />
                                                <span className="truncate">{room.label}</span>
                                            </span>
                                            <span className={`shrink-0 text-xs font-bold ${room.available > 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}`}>
                                                {room.available} of {room.total} available
                                            </span>
                                        </button>
                                    )) : (
                                        <p className="py-6 text-center text-sm text-slate-500">No rooms are configured for this date.</p>
                                    )}
                                </div>
                            ) : (
                                <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
                                    {(details.slots || []).length ? details.slots.map((slot) => {
                                        const slotVeterinarianName = slot.veterinarianName
                                            || (isOnlineConsultation ? selectedVeterinarianName : '');

                                        return (
                                            <button
                                                key={slot.time}
                                                type="button"
                                                disabled={!slot.available || !onSelectSlot}
                                                onClick={() => onSelectSlot?.({
                                                    service,
                                                    date: selectedDate,
                                                    time: slot.time,
                                                    branchId: Number(lockedBranchId || branchId),
                                                    veterinarianId: slot.veterinarianId || (veterinarianId ? Number(veterinarianId) : null),
                                                })}
                                                className="flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-2 text-left transition-colors enabled:hover:bg-slate-50 enabled:focus-visible:outline-none enabled:focus-visible:ring-2 enabled:focus-visible:ring-[#155dfc] disabled:cursor-default dark:enabled:hover:bg-slate-800/70"
                                            >
                                                <span className="inline-flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                                                    <span className={`size-2 shrink-0 rounded-full ${slot.available ? 'bg-emerald-500' : slot.status === 'booked' ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-700'}`} />
                                                    <Clock3 className="size-4 shrink-0 text-slate-400" />
                                                    <span className="min-w-0">
                                                        <span className="block">{slot.label}</span>
                                                        {slotVeterinarianName && (
                                                            <span className="block truncate text-xs font-medium text-slate-500 dark:text-slate-400">
                                                                With {slotVeterinarianName}
                                                            </span>
                                                        )}
                                                    </span>
                                                </span>
                                                <span className={`shrink-0 text-xs font-bold ${slot.available ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-500 dark:text-slate-400'}`}>
                                                    {slot.available ? 'Available' : slot.status === 'booked' ? 'Booked' : 'Unavailable'}
                                                </span>
                                            </button>
                                        );
                                    }) : (
                                        <p className="py-6 text-center text-sm text-slate-500">
                                            {service === 'online-consultation' && !veterinarianId
                                                ? 'No veterinarian has published online consultation times.'
                                                : 'No appointment times are available for this date.'}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
