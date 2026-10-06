import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Building2,
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    Clock3,
    DoorOpen,
    Hotel,
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
import { bookingSlotStatusLabel } from '../../lib/bookingSlots';

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
    { key: 'boarding', label: 'Pet Hotel Boarding', mode: 'rooms' },
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

function dayStatusMeta(day) {
    if (!day?.isOpen || day.status === 'closed' || day.status === 'unavailable') {
        return {
            label: day?.isOpen && day.status === 'unavailable' ? 'No slots' : 'Closed',
            disabled: true,
            buttonClassName: 'border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-500',
            labelClassName: 'text-slate-500 dark:text-slate-500',
        };
    }
    if (day.status === 'available') {
        return {
            label: 'Available',
            disabled: false,
            buttonClassName: 'border-emerald-200 bg-emerald-50/70 text-slate-800 hover:border-emerald-400 hover:bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-slate-100',
            labelClassName: 'text-emerald-700 dark:text-emerald-300',
        };
    }

    return {
        label: 'Full',
        disabled: true,
        buttonClassName: 'border-amber-200 bg-amber-50/70 text-slate-700 dark:border-amber-900 dark:bg-amber-950/20 dark:text-slate-300',
        labelClassName: 'text-amber-700 dark:text-amber-300',
    };
}

function stayCoversDate(stay, date) {
    const startsOn = String(stay.checkInDate || stay.actualCheckInAt || '').slice(0, 10);
    const endsOn = String(stay.desiredCheckOutDate || stay.checkOutDate || '').slice(0, 10);

    return (!startsOn || date >= startsOn) && (!endsOn || date <= endsOn);
}

export default function ClinicAvailabilityCalendar({
    className = '',
    title = 'Clinic availability',
    description = 'Choose a date to see available and reserved appointment times.',
    initialService = 'general-checkup',
    lockedBranchId = '',
    selectedBranchId = '',
    allowBranchSelection = true,
    showServiceFilter = true,
    compact = false,
    boardingStays = [],
    onBranchChange,
    onBranchesChange,
    onOpenBoardingStay,
    onSelectSlot,
    onSelectRoom,
}) {
    const today = useMemo(() => new Date(), []);
    const [service, setService] = useState(initialService);
    const [month, setMonth] = useState(monthKey(today));
    const [selectedDate, setSelectedDate] = useState(localDateKey(today));
    const [branchId, setBranchId] = useState(String(lockedBranchId || selectedBranchId || ''));
    const [veterinarianId, setVeterinarianId] = useState('');
    const [availability, setAvailability] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');
    const effectiveBranchId = String(lockedBranchId || selectedBranchId || branchId || '');
    const requestKey = `${service}:${month}:${selectedDate}:${effectiveBranchId}:${veterinarianId}`;
    const currentRequest = useRef(requestKey);
    useEffect(() => { currentRequest.current = requestKey; }, [requestKey]);

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
                branchId: effectiveBranchId,
                veterinarianId,
                hotel_boarding_type: service === 'boarding' ? 'hotel' : undefined,
            });
            if (currentRequest.current !== requestKey) return;
            setAvailability(response);
            onBranchesChange?.(response?.filters?.branches || []);

            const resolvedBranchId = response?.selected?.branchId;
            if (resolvedBranchId && !lockedBranchId && !selectedBranchId && String(resolvedBranchId) !== branchId) {
                setBranchId(String(resolvedBranchId));
            }
            if (resolvedBranchId && !lockedBranchId && String(resolvedBranchId) !== String(selectedBranchId || '')) {
                onBranchChange?.(String(resolvedBranchId));
            }
            const resolvedVetId = response?.selected?.veterinarianId;
            const resolvedVetValue = resolvedVetId ? String(resolvedVetId) : '';
            if (resolvedVetValue !== veterinarianId) {
                setVeterinarianId(resolvedVetValue);
            }
        } catch (error) {
            if (currentRequest.current !== requestKey) return;
            if (!isAutoRefresh) {
                setErrorMessage(error.message || 'Availability could not be loaded.');
            }
            throw error;
        } finally {
            if (currentRequest.current === requestKey) setIsLoading(false);
        }
    }, [branchId, effectiveBranchId, lockedBranchId, month, onBranchChange, onBranchesChange, requestKey, selectedBranchId, selectedDate, service, veterinarianId]);

    useAutoRefresh(loadAvailability, {
        refreshKey: requestKey,
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
    const isSharedMedical = availability?.schedulingMode === 'shared_veterinarian';
    const selectedBranch = branches.find((branch) => String(branch.id) === effectiveBranchId);
    const selectedVet = veterinarians.find((vet) => String(vet.id) === veterinarianId);
    const selectedVeterinarianName = selectedVet?.name || availability?.selected?.veterinarianName || '';
    const selectedDay = days.find((day) => day.date === selectedDate);
    const selectedDayStatus = dayStatusMeta(selectedDay);
    const firstWeekday = parseMonth(month).getDay();
    const calendarCells = [...Array(firstWeekday).fill(null), ...days];

    const handleMonthChange = (amount) => {
        const nextMonth = shiftMonth(month, amount);
        setMonth(nextMonth);
        setSelectedDate(`${nextMonth}-01`);
    };

    const handleBranchChange = (value) => {
        setVeterinarianId('');
        setBranchId(value);
        onBranchChange?.(value);
    };

    return (
        <Card className={className}>
            <CardHeader className={compact ? 'pb-0' : ''}>
                <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[#155dfc] dark:bg-blue-950/50 dark:text-blue-300">
                        {initialService === 'boarding' ? <Hotel className="size-4" /> : <CalendarDays className="size-4" />}
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
                                    <Stethoscope className="text-blue-600 dark:text-blue-300" />
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

                    {allowBranchSelection && !isOnlineConsultation && !lockedBranchId && branches.length > 0 && (
                        <div>
                            <Label className="mb-1.5">Current clinic</Label>
                            <Select value={effectiveBranchId} onValueChange={handleBranchChange} searchable={false}>
                                <SelectTrigger aria-label="Current clinic for booking">
                                    <Building2 className="text-blue-600 dark:text-blue-300" />
                                    <SelectValue placeholder="Select clinic" displayValue={selectedBranch?.name} />
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
                                value={veterinarianId || 'all'}
                                onValueChange={(value) => setVeterinarianId(value === 'all' ? '' : value)}
                                searchable={veterinarians.length > 8}
                            >
                                <SelectTrigger aria-label="Availability veterinarian">
                                    <Stethoscope className="text-blue-600 dark:text-blue-300" />
                                    <SelectValue
                                        placeholder="Select veterinarian"
                                        displayValue={selectedVet?.name || 'All available veterinarians'}
                                    />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All available veterinarians</SelectItem>
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
                    <div className={`grid items-stretch gap-4 ${isBoarding ? 'lg:grid-cols-2' : 'lg:grid-cols-[minmax(0,1.25fr)_minmax(240px,0.75fr)]'}`}>
                        <div className="h-full min-w-0 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
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
                                {calendarCells.map((day, index) => {
                                    if (!day) return <span key={`blank-${index}`} aria-hidden="true" />;

                                    const status = dayStatusMeta(day);
                                    const isSelected = selectedDate === day.date;

                                    return (
                                        <button
                                            key={day.date}
                                            type="button"
                                            disabled={status.disabled}
                                            onClick={() => setSelectedDate(day.date)}
                                            aria-label={`${longDate(day.date)}: ${status.label}`}
                                            aria-pressed={isSelected}
                                            className={`relative flex min-h-14 min-w-0 flex-col items-center justify-center rounded-md border px-0.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155dfc] disabled:cursor-not-allowed ${isSelected
                                                ? 'border-[#155dfc] bg-blue-50 text-[#155dfc] ring-1 ring-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900'
                                                : status.buttonClassName}`}
                                        >
                                            <span>{Number(day.date.slice(-2))}</span>
                                            <span className={`mt-0.5 max-w-full truncate text-[8px] font-black leading-3 tracking-tight sm:text-[9px] ${status.labelClassName}`}>
                                                {status.label}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                                <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-emerald-500" />Available</span>
                                <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-amber-500" />Full</span>
                                <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-slate-300 dark:bg-slate-700" />Closed</span>
                            </div>
                        </div>

                        <div className="relative min-h-96 min-w-0 rounded-lg border border-slate-200 dark:border-slate-800">
                            <div className="absolute inset-0 flex min-h-0 flex-col p-3">
                            <div className="mb-3 flex shrink-0 items-start justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
                                <div className="min-w-0">
                                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{isBoarding ? 'Room map' : longDate(selectedDate)}</p>
                                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                                        {isBoarding
                                            ? `${longDate(selectedDate)}${selectedBranch?.name ? ` · ${selectedBranch.name}` : ''}`
                                            : isOnlineConsultation && selectedVeterinarianName
                                                ? `Online consultation times with ${selectedVeterinarianName}`
                                                : 'Appointment times'}
                                        </p>
                                    {selectedDay && !isBoarding && (
                                        <span className={`mt-1.5 inline-flex rounded-full px-2 py-0.5 text-[11px] font-black ${selectedDayStatus.labelClassName} ${selectedDayStatus.label === 'Available'
                                            ? 'bg-emerald-50 dark:bg-emerald-950/40'
                                            : selectedDayStatus.label === 'Full'
                                                ? 'bg-amber-50 dark:bg-amber-950/40'
                                                : 'bg-slate-100 dark:bg-slate-800'}`}
                                        >
                                            {selectedDayStatus.label}
                                        </span>
                                    )}
                                </div>
                                {isLoading && <Loader2 className="size-4 animate-spin text-slate-400" aria-label="Loading availability" />}
                            </div>

                            {isBoarding ? (
                                <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                                    <div className="mb-3 flex flex-wrap gap-x-3 gap-y-1 text-[0.62rem] font-bold text-slate-500 dark:text-slate-400">
                                        <span><span className="mr-1 inline-block size-2 rounded-full bg-emerald-500" />Available</span>
                                        <span><span className="mr-1 inline-block size-2 rounded-full bg-amber-500" />Reserved</span>
                                        <span><span className="mr-1 inline-block size-2 rounded-full bg-slate-400" />Occupied</span>
                                        {boardingStays.length > 0 && <span><span className="mr-1 inline-block size-2 rounded-full bg-blue-600" />Your Pet</span>}
                                        <span><span className="mr-1 inline-block size-2 rounded-full border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900" />Unavailable</span>
                                    </div>
                                    <div className="space-y-3">
                                    {(details.rooms || []).length ? details.rooms.map((room) => {
                                        const roomStays = boardingStays.filter((stay) => (
                                            String(stay.branchId) === effectiveBranchId
                                            && stay.roomSize === room.size
                                            && stayCoversDate(stay, selectedDate)
                                        ));
                                        const stayByNumber = new Map(roomStays.map((stay) => [Number(stay.roomNumber), stay]));
                                        const highestOwnedRoom = Math.max(0, ...roomStays.map((stay) => Number(stay.roomNumber || 0)));
                                        const occupied = Math.max(0, Number(room.occupied || 0));
                                        const reserved = Math.max(0, Number(room.reserved ?? Number(room.booked || 0) - occupied));
                                        const total = Math.max(0, Number(room.total || 0), highestOwnedRoom);
                                        const sizeCode = room.size === 'small' ? 'S' : room.size === 'medium' ? 'M' : 'L';
                                        let occupiedRemaining = Math.max(0, occupied - roomStays.filter((stay) => stay.status === 'occupied').length);
                                        let reservedRemaining = Math.max(0, reserved - roomStays.filter((stay) => stay.status === 'reserved').length);
                                        let availableRemaining = Math.max(0, Number(room.available || 0));

                                        return (
                                            <section key={room.roomType} className="rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 dark:border-slate-800 dark:bg-slate-900/50">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="flex min-w-0 items-center gap-2 text-xs font-black text-slate-800 dark:text-slate-100">
                                                        <DoorOpen className="size-3.5 shrink-0 text-blue-600 dark:text-blue-300" />
                                                        <span className="truncate">{room.label}</span>
                                                    </span>
                                                    <span className="shrink-0 text-[0.65rem] font-bold text-emerald-700 dark:text-emerald-300">{room.available} open</span>
                                                </div>
                                                <div className="mt-2 grid grid-cols-4 gap-1.5 sm:grid-cols-5 xl:grid-cols-4 2xl:grid-cols-5">
                                                    {Array.from({ length: total }, (_, index) => {
                                                        const roomNumber = index + 1;
                                                        const ownStay = stayByNumber.get(roomNumber);
                                                        let status = ownStay ? 'mine' : 'unavailable';
                                                        if (!ownStay && occupiedRemaining > 0) {
                                                            status = 'occupied';
                                                            occupiedRemaining -= 1;
                                                        } else if (!ownStay && reservedRemaining > 0) {
                                                            status = 'reserved';
                                                            reservedRemaining -= 1;
                                                        } else if (!ownStay && availableRemaining > 0) {
                                                            status = 'available';
                                                            availableRemaining -= 1;
                                                        }
                                                        const statusLabel = status === 'mine'
                                                            ? (ownStay.petNames || ownStay.petName || 'Your Pet')
                                                            : status === 'occupied'
                                                            ? 'Occupied'
                                                            : status === 'reserved'
                                                                ? 'Reserved'
                                                                : status === 'available'
                                                                    ? 'Available'
                                                                    : 'Unavailable';
                                                        const statusClassName = status === 'mine'
                                                            ? 'border-blue-600 bg-blue-600 text-white shadow-sm enabled:hover:bg-blue-700'
                                                            : status === 'occupied'
                                                            ? 'border-slate-300 bg-slate-200 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                                            : status === 'reserved'
                                                                ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200'
                                                                : status === 'available'
                                                                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800 enabled:hover:border-emerald-500 enabled:hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200'
                                                                    : 'border-slate-200 bg-white text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-600';

                                                        return (
                                                            <button
                                                                key={roomNumber}
                                                                type="button"
                                                                disabled={status === 'mine' ? !onOpenBoardingStay : status !== 'available' || !onSelectRoom}
                                                                onClick={() => status === 'mine'
                                                                    ? onOpenBoardingStay?.(ownStay)
                                                                    : onSelectRoom?.({ service, date: selectedDate, room, branchId: Number(effectiveBranchId) })}
                                                                className={`min-w-0 rounded-md border px-1.5 py-1.5 text-left transition-colors enabled:focus-visible:outline-none enabled:focus-visible:ring-2 enabled:focus-visible:ring-[#155dfc] disabled:cursor-default ${statusClassName}`}
                                                                aria-label={`${room.label} ${roomNumber}: ${statusLabel}`}
                                                            >
                                                                <span className="block text-[0.5rem] font-black uppercase opacity-70">H / {sizeCode}</span>
                                                                <span className="block text-xs font-black leading-tight">{sizeCode}{String(roomNumber).padStart(2, '0')}</span>
                                                                <span className="mt-0.5 block truncate text-[0.48rem] font-bold leading-tight">{statusLabel}</span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </section>
                                        );
                                    }) : (
                                        <p className="py-6 text-center text-sm text-slate-500">No rooms are configured for this date.</p>
                                    )}
                                    </div>
                                </div>
                            ) : (
                                <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
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
                                                    branchId: Number(effectiveBranchId),
                                                    veterinarianId: slot.veterinarianId || (veterinarianId ? Number(veterinarianId) : (isOnlineConsultation ? slot.availableVeterinarians?.[0]?.id || null : null)),
                                                })}
                                                className="flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-2 text-left transition-colors enabled:hover:bg-slate-50 enabled:focus-visible:outline-none enabled:focus-visible:ring-2 enabled:focus-visible:ring-[#155dfc] disabled:cursor-default dark:enabled:hover:bg-slate-800/70"
                                            >
                                                <span className="inline-flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                                                    <span className={`size-2 shrink-0 rounded-full ${slot.available ? 'bg-emerald-500' : slot.status === 'booked' ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-700'}`} />
                                                    <Clock3 className="size-4 shrink-0 text-blue-600 dark:text-blue-300" />
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
                                                    {bookingSlotStatusLabel(slot, isSharedMedical || isOnlineConsultation)}
                                                </span>
                                            </button>
                                        );
                                    }) : (
                                        <p className="py-6 text-center text-sm text-slate-500">
                                            {isOnlineConsultation ? 'No online calls are scheduled for this date. Choose another date or veterinarian.' : (isSharedMedical
                                                ? 'No veterinarian appointment is available for this date.'
                                                : 'No appointment times are available for this date.')}
                                        </p>
                                    )}
                                </div>
                            )}
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
