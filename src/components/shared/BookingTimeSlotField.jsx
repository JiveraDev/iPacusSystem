import { useEffect, useState } from 'react';
import { Clock3, Loader2 } from 'lucide-react';

import { Label } from '../../ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../../ui/select';
import { fetchBookingAvailability } from '../../services/bookingAvailabilityService';

function normalizeTime(value) {
    const match = String(value || '').match(/^(\d{1,2}):(\d{2})/);
    return match ? `${match[1].padStart(2, '0')}:${match[2]}` : '';
}

function formatTime(value) {
    const normalized = normalizeTime(value);
    if (!normalized) return '';
    const [hour, minute] = normalized.split(':').map(Number);
    const suffix = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${String(minute).padStart(2, '0')} ${suffix}`;
}

function formatDateLabel(value) {
    const match = String(value || '').slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return 'the selected date';

    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return new Intl.DateTimeFormat('en-PH', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
    }).format(date);
}

export default function BookingTimeSlotField({
    service,
    date,
    branchId,
    veterinarianId,
    value,
    onChange,
    label = 'Booking time',
    id = 'booking-time',
    required = true,
    disabled = false,
    allowCurrentValue = false,
    className = '',
}) {
    const [loadState, setLoadState] = useState({ key: '', slots: [], error: '' });
    const selectedValue = normalizeTime(value);
    const isOnline = String(service || '').toLowerCase().includes('online');
    const canLoad = Boolean(service && date && (!isOnline || veterinarianId));
    const requestKey = [service, date, branchId, veterinarianId].join(':');
    const isLoading = canLoad && loadState.key !== requestKey;
    const slots = canLoad && loadState.key === requestKey ? loadState.slots : [];
    const errorMessage = canLoad && loadState.key === requestKey ? loadState.error : '';

    useEffect(() => {
        if (!canLoad) {
            return undefined;
        }

        const controller = new AbortController();

        fetchBookingAvailability({
            service,
            date: String(date).slice(0, 10),
            month: String(date).slice(0, 7),
            detailsOnly: true,
            branchId,
            veterinarianId,
        }, { signal: controller.signal })
            .then((response) => {
                if (controller.signal.aborted) return;
                const nextSlots = Array.isArray(response?.details?.slots)
                    ? response.details.slots
                    : [];
                setLoadState({ key: requestKey, slots: nextSlots, error: '' });

                const selectedSlot = nextSlots.find((slot) => normalizeTime(slot.time) === selectedValue);
                if (selectedValue && !allowCurrentValue && (!selectedSlot || !selectedSlot.available)) {
                    onChange?.('');
                }
            })
            .catch((error) => {
                if (controller.signal.aborted) return;
                setLoadState({
                    key: requestKey,
                    slots: [],
                    error: error.message || 'Available times could not be loaded.',
                });
            });

        return () => controller.abort();
    }, [allowCurrentValue, branchId, canLoad, date, onChange, requestKey, selectedValue, service, veterinarianId]);

    const availableSlots = slots.filter((slot) => slot.available);
    const selectedDateLabel = formatDateLabel(date);
    const selectedLabel = slots.find((slot) => normalizeTime(slot.time) === selectedValue)?.label
        || formatTime(selectedValue);
    const currentValueIsListed = availableSlots.some((slot) => normalizeTime(slot.time) === selectedValue);
    const helperMessage = !date
        ? 'Select a date first.'
        : isOnline && !veterinarianId
            ? 'Select a veterinarian first.'
            : isLoading
                ? 'Checking available times...'
                : errorMessage
                    ? errorMessage
                    : availableSlots.length === 0
                        ? `Unavailable on ${selectedDateLabel}. Choose another date.`
                        : `${availableSlots.length} available ${availableSlots.length === 1 ? 'time' : 'times'} on ${selectedDateLabel}.`;
    const clockTone = errorMessage
        ? 'text-red-600 dark:text-red-400'
        : !isLoading && canLoad && availableSlots.length === 0
            ? 'text-amber-600 dark:text-amber-300'
            : 'text-blue-600 dark:text-blue-300';

    return (
        <div className={className}>
            <Label htmlFor={id} className="mb-1.5">
                {label}{required ? ' *' : ''}
            </Label>
            <Select
                value={selectedValue}
                onValueChange={onChange}
                disabled={disabled || !canLoad || isLoading || (slots.length === 0 && !allowCurrentValue)}
                searchable={false}
            >
                <SelectTrigger id={id} aria-label={label}>
                    {isLoading ? <Loader2 className="animate-spin text-blue-600 dark:text-blue-300" /> : <Clock3 className={clockTone} />}
                    <SelectValue placeholder="Select an available time" displayValue={selectedLabel} />
                </SelectTrigger>
                <SelectContent>
                    {allowCurrentValue && selectedValue && !currentValueIsListed && (
                        <SelectItem value={selectedValue}>{formatTime(selectedValue)} (current)</SelectItem>
                    )}
                    {slots.map((slot) => (
                        <SelectItem key={slot.time} value={normalizeTime(slot.time)} disabled={!slot.available}>
                            {slot.label} — {slot.available ? 'Available' : slot.status === 'booked' ? 'Booked' : 'Unavailable'}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <p
                className={`mt-1.5 text-xs ${errorMessage ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`}
                role={errorMessage ? 'alert' : undefined}
            >
                {helperMessage}
            </p>
        </div>
    );
}
