import { getServiceDisplayName } from './serviceLabels.js';

const normalize = value => String(value || '').trim().toLowerCase();

export function vetBookingService(booking) {
    return booking.isOnlineConsultation ? 'Online consultation' : getServiceDisplayName(booking.service || booking.type, 'Appointment');
}

export function bookingDateKey(value) {
    const key = String(value || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return '';
    const parsed = new Date(`${key}T00:00:00Z`);
    return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== key ? '' : key;
}

export function bookingPreviewSelection(search) {
    const query = new URLSearchParams(search || '');
    const date = bookingDateKey(query.get('date'));
    const rawId = query.get('booking') || '';
    const id = /^\d+$/.test(rawId) ? Number(rawId) : 0;
    return { date, bookingId: date && Number.isSafeInteger(id) && id > 0 ? String(id) : '' };
}

export function queueScheduleDate(item) {
    return bookingDateKey(item.related_booking_date || item.booking_date || item.timestamp);
}

export function assignedVetBookings(bookings, veterinarianId, approvedOnly = true) {
    if (!veterinarianId) return [];
    const unique = new Map();
    for (const booking of bookings) {
        if (String(booking.veterinarianId || '') !== String(veterinarianId)) continue;
        const status = normalize(booking.status);
        if (!(approvedOnly ? ['confirmed', 'approved'] : ['pending', 'confirmed', 'approved']).includes(status)) continue;
        if (['grooming', 'pet grooming', 'boarding'].includes(normalize(booking.type)) || booking.hotelBoardingType) continue;
        if (!bookingDateKey(booking.date)) continue;
        unique.set(String(booking.id), booking);
    }
    return [...unique.values()];
}

export function filterVetBookings(bookings, search = '', branchId = 'all') {
    const query = normalize(search);
    return bookings.filter(booking => (branchId === 'all' || String(booking.branchId) === String(branchId))
        && (!query || normalize([booking.bookingNumber, booking.petName, booking.ownerName, booking.service,
            booking.type, booking.branchName, booking.petSpecies, booking.petBreed].join(' ')).includes(query)));
}

export function bookingsForDate(bookings, date) {
    return bookings.filter(booking => bookingDateKey(booking.date) === date)
        .sort((left, right) => String(left.time || '').localeCompare(String(right.time || '')) || Number(left.id) - Number(right.id));
}

export function nextBookedDate(bookings, today) {
    return bookings.map(booking => bookingDateKey(booking.date)).filter(date => date > today).sort()[0] || '';
}

export function nextBookingDayLabel(date, today) {
    if (!date) return 'No upcoming bookings';
    const tomorrow = new Date(`${today}T00:00:00Z`);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    if (date === tomorrow.toISOString().slice(0, 10)) return 'Tomorrow';
    const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
    return `Next ${weekday}`;
}

export function isBookingScheduleTask(task) {
    return ['vet_booking', 'booking', 'online_consultation'].includes(task.source)
        && !['cancelled', 'canceled', 'rejected'].includes(normalize(task.status));
}

export function bookingScheduleCount(tasks) {
    return new Set(tasks.filter(isBookingScheduleTask).map(task => task.bookingId
        ? `booking-${task.bookingId}` : `${task.source}-${task.sourceId ?? task.id}`)).size;
}
