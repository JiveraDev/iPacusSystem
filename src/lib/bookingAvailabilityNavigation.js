const STORAGE_KEY = 'ipawcus:availability-booking-selection';

const SERVICE_ROUTES = Object.freeze({
    'general-checkup': '/dashboard/services/general-checkup',
    vaccination: '/dashboard/services/vaccination',
    'parasite-control': '/dashboard/services/parasite-control',
    grooming: '/dashboard/services/grooming',
    dental: '/dashboard/services/dental-checkup',
    surgery: '/dashboard/services/surgery',
    'lab-testing': '/dashboard/services/laboratory-testing',
    'online-consultation': '/dashboard/consult/booking',
    'home-service': '/dashboard/services/home-services',
    'special-services': '/dashboard/services/special-services',
    boarding: '/dashboard/services/pet-hotel',
});

export function bookingRouteForAvailabilityService(service) {
    return SERVICE_ROUTES[String(service || '').trim().toLowerCase()] || '/dashboard/services';
}

export function saveBookingAvailabilitySelection(selection = {}) {
    if (typeof window === 'undefined') return;

    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
        service: String(selection.service || '').trim().toLowerCase(),
        date: String(selection.date || '').slice(0, 10),
        time: String(selection.time || '').slice(0, 5),
        branchId: selection.branchId || null,
        veterinarianId: selection.veterinarianId || null,
        roomType: selection.room?.roomType || selection.roomType || '',
        savedAt: Date.now(),
    }));
}

export function readBookingAvailabilitySelection(expectedService = '') {
    if (typeof window === 'undefined') return null;

    try {
        const value = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) || 'null');
        if (!value || Date.now() - Number(value.savedAt || 0) > 30 * 60 * 1000) {
            window.sessionStorage.removeItem(STORAGE_KEY);
            return null;
        }

        const normalizedExpected = String(expectedService || '').trim().toLowerCase();
        return normalizedExpected && value.service !== normalizedExpected ? null : value;
    } catch {
        window.sessionStorage.removeItem(STORAGE_KEY);
        return null;
    }
}

export function clearBookingAvailabilitySelection() {
    if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(STORAGE_KEY);
    }
}
