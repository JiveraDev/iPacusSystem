import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Building2,
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    Clock3,
    Hotel,
    Loader2,
    Stethoscope,
} from 'lucide-react';

import { Button } from '../../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import Label from './BookingFieldLabel.jsx';
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
import BoardingRoomAvailability, { BoardingAvailabilityLegend } from './BoardingRoomAvailability.jsx';

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

            const resolvedBranchId = String(response?.selected?.branchId || '');
            if (!lockedBranchId && resolvedBranchId !== branchId) {
                setBranchId(resolvedBranchId);
            }
            if (!lockedBranchId && resolvedBranchId !== String(selectedBranchId || '')) {
                onBranchChange?.(resolvedBranchId);
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
    const slots = details.slots || [];
    const selectedService = services.find((item) => item.key === service);
    const isBoarding = service === 'boarding' || selectedService?.mode === 'rooms';
    const isOnlineConsultation = service === 'online-consultation';
    const isSharedMedical = availability?.schedulingMode === 'shared_veterinarian';
    const selectedBranch = branches.find((branch) => String(branch.id) === effectiveBranchId);
    const selectedVet = veterinarians.find((vet) => String(vet.id) === veterinarianId);
    const selectedVeterinarianName = selectedVet?.name || availability?.selected?.veterinarianName || '';
    const availableSlots = slots.filter((slot) => slot.available);
    const commonVeterinarianName = selectedVeterinarianName || (availableSlots.length && availableSlots.every((slot) => slot.veterinarianName && slot.veterinarianName === availableSlots[0].veterinarianName)
        ? availableSlots[0].veterinarianName
        : '');
    const slotGroups = [
        { label: 'Morning', slots: slots.filter((slot) => Number(slot.time.split(':')[0]) < 12) },
        { label: 'Afternoon', slots: slots.filter((slot) => Number(slot.time.split(':')[0]) >= 12 && Number(slot.time.split(':')[0]) < 17) },
        { label: 'Evening', slots: slots.filter((slot) => Number(slot.time.split(':')[0]) >= 17) },
    ].filter((group) => group.slots.length);
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
                        <CardTitle className="dark:text-slate-100">{title}</CardTitle>
                        <CardDescription className="dark:text-slate-400">{description}</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div data-session-persist="off" data-filter-bar className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {showServiceFilter && (
                        <div>
                            <Label className="mb-1.5" help="Choose the care you need. Pet Hotel Boarding shows rooms; other services show appointment start times.">Service</Label>
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

                    {allowBranchSelection && !isOnlineConsultation && !lockedBranchId && (
                        <div>
                            <Label className="mb-1.5" help="Choose a clinic to see appointment times or rooms. Medical clinics appear when an assigned, active vet accepts bookings there.">Clinic</Label>
                            <Select value={effectiveBranchId} onValueChange={handleBranchChange} searchable={false} disabled={isLoading || !branches.length}>
                                <SelectTrigger aria-label="Availability clinic">
                                    <Building2 className="text-blue-600 dark:text-blue-300" />
                                    <SelectValue placeholder="Select clinic" displayValue={selectedBranch?.name || (isLoading ? 'Loading clinics...' : branches.length ? 'Select clinic' : 'No clinics available')} />
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
                            <Label className="mb-1.5" help="Choose a preferred vet or view all available vets. A selected vet follows you into the booking form.">Veterinarian</Label>
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

                {availability?.message && !isLoading && !errorMessage && <p role="status" className="text-sm text-slate-600 dark:text-slate-300">{availability.message}</p>}

                {errorMessage ? (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300" role="alert">
                        {errorMessage}
                    </div>
                ) : (
                    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
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
                                            <span aria-hidden="true" className={`mt-1 size-1.5 rounded-full ${status.label === 'Available' ? 'bg-emerald-500' : status.label === 'Full' ? 'bg-amber-500' : 'bg-slate-400 dark:bg-slate-600'}`} />
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

                        <div className="min-w-0 rounded-lg border border-slate-200 p-3 dark:border-slate-800 sm:p-4">
                            <div className="mb-4 flex items-start justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
                                <div className="min-w-0">
                                    <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                                        {isBoarding ? <Hotel className="size-4 text-slate-500" /> : <Clock3 className="size-4 text-slate-500" />}
                                        {isBoarding ? 'Choose a room' : isOnlineConsultation ? 'Online consultation times' : 'Appointment times'}
                                    </h3>
                                    <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{longDate(selectedDate)}</p>
                                    {isBoarding && selectedBranch?.name && <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">{selectedBranch.name}</p>}
                                    {!isBoarding && commonVeterinarianName && (
                                        <p className="mt-2 flex items-start gap-1.5 text-xs leading-5 text-slate-600 dark:text-slate-300">
                                            <Stethoscope className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                                            <span>With {commonVeterinarianName}</span>
                                        </p>
                                    )}
                                    {!isBoarding && !isLoading && selectedDay && (
                                        <p className={`mt-2 text-xs font-medium ${selectedDayStatus.labelClassName}`}>
                                            {availableSlots.length ? `${availableSlots.length} time${availableSlots.length === 1 ? '' : 's'} available` : selectedDayStatus.label}
                                        </p>
                                    )}
                                </div>
                                {isLoading && <Loader2 className="size-4 animate-spin text-slate-400" aria-label="Loading availability" />}
                            </div>

                            {isBoarding ? (
                                <div className="space-y-4">
                                    <BoardingAvailabilityLegend showOwnStays={boardingStays.length > 0} />
                                    <BoardingRoomAvailability
                                        rooms={details.rooms || []}
                                        stays={boardingStays.filter((stay) => String(stay.branchId) === effectiveBranchId && stayCoversDate(stay, selectedDate))}
                                        loading={isLoading}
                                        onOpenStay={onOpenBoardingStay}
                                        onSelectRoom={onSelectRoom ? (room) => onSelectRoom({ service, date: selectedDate, room, branchId: Number(effectiveBranchId) }) : undefined}
                                    />
                                </div>
                            ) : (
                                <div className="max-h-[32rem] space-y-4 overflow-y-auto pr-1">
                                    {slots.length ? slotGroups.map((group) => (
                                        <section key={group.label}>
                                            <h4 className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">{group.label}</h4>
                                            <div className="grid grid-cols-[repeat(auto-fit,minmax(11.5rem,1fr))] gap-2">
                                    {group.slots.map((slot) => {
                                        const slotVeterinarianName = slot.veterinarianName || selectedVeterinarianName;

                                        return (
                                            <button
                                                key={slot.time}
                                                type="button"
                                                disabled={isLoading || !slot.available || !onSelectSlot}
                                                aria-label={`${slot.label}${slotVeterinarianName ? `, with ${slotVeterinarianName}` : ''}: ${bookingSlotStatusLabel(slot, isSharedMedical || isOnlineConsultation)}`}
                                                onClick={() => onSelectSlot?.({
                                                    service,
                                                    date: selectedDate,
                                                    time: slot.time,
                                                    branchId: Number(effectiveBranchId),
                                                    veterinarianId: slot.veterinarianId || (veterinarianId ? Number(veterinarianId) : (isOnlineConsultation ? slot.availableVeterinarians?.[0]?.id || null : null)),
                                                    veterinarianName: slotVeterinarianName || (isOnlineConsultation ? slot.availableVeterinarians?.[0]?.name || '' : ''),
                                                })}
                                                className={`group flex min-h-14 min-w-0 flex-col justify-center gap-1.5 rounded-lg border px-3 py-3 text-left transition-colors enabled:hover:border-blue-500 enabled:hover:bg-blue-50/50 enabled:active:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-default dark:enabled:hover:bg-blue-950/30 dark:enabled:active:bg-blue-950/60 dark:focus-visible:ring-offset-slate-900 ${slot.available ? 'border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900' : 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60'}`}
                                            >
                                                <span className="flex w-full flex-wrap items-center justify-between gap-x-2 gap-y-1">
                                                    <span className="whitespace-nowrap text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">{slot.label}</span>
                                                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${slot.available ? 'text-emerald-700 dark:text-emerald-300' : slot.status === 'booked' ? 'text-amber-700 dark:text-amber-300' : 'text-slate-500 dark:text-slate-400'}`}>
                                                        <span aria-hidden="true" className={`size-1.5 shrink-0 rounded-full ${slot.available ? 'bg-emerald-500' : slot.status === 'booked' ? 'bg-amber-500' : 'bg-slate-400'}`} />
                                                        {slot.available && (isSharedMedical || isOnlineConsultation) ? `${Number(slot.availableCount) || 0} available` : bookingSlotStatusLabel(slot)}
                                                    </span>
                                                </span>
                                                {slotVeterinarianName && slotVeterinarianName !== commonVeterinarianName && <span className="break-words text-xs leading-5 text-slate-500 dark:text-slate-400">{slotVeterinarianName}</span>}
                                            </button>
                                        );
                                    })}
                                            </div>
                                        </section>
                                    )) : (
                                        <div className="flex flex-col items-center gap-2 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                                            <Clock3 className="size-5" aria-hidden="true" />
                                            <p>{isLoading ? 'Checking appointment times…' : isOnlineConsultation ? 'No online calls are scheduled for this date. Choose another date or veterinarian.' : (isSharedMedical
                                                ? 'No veterinarian appointment is available for this date.'
                                                : 'No appointment times are available for this date.')}</p>
                                        </div>
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
