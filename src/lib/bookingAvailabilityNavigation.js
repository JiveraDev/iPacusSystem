const STORAGE_KEY = 'ipawcus:availability-booking-selection';
const ACTIVE_BRANCH_KEY = 'ipawcus:owner-active-branch';

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
    const key = String(service || '').trim().toLowerCase();
    return Object.hasOwn(SERVICE_ROUTES, key) ? SERVICE_ROUTES[key] : '/dashboard/services';
}

export function saveOwnerActiveBranch(branchId) {
    if (typeof window === 'undefined') return;

    try {
        const normalizedBranchId = Number(branchId);
        if (normalizedBranchId > 0) {
            window.sessionStorage.setItem(ACTIVE_BRANCH_KEY, String(normalizedBranchId));
        } else {
            window.sessionStorage.removeItem(ACTIVE_BRANCH_KEY);
        }
    } catch {
        // Booking can continue when browser storage is unavailable.
    }
}

export function readOwnerActiveBranch() {
    if (typeof window === 'undefined') return null;

    try {
        const branchId = Number(window.sessionStorage.getItem(ACTIVE_BRANCH_KEY));
        return branchId > 0 ? branchId : null;
    } catch {
        return null;
    }
}

function activeBranchFallback(expectedService = '') {
    const branchId = readOwnerActiveBranch();
    if (!branchId) return null;

    return {
        service: String(expectedService || '').trim().toLowerCase(),
        date: '',
        time: '',
        branchId,
        veterinarianId: null,
        roomType: '',
        savedAt: Date.now(),
    };
}

export function saveBookingAvailabilitySelection(selection = {}) {
    if (typeof window === 'undefined') return;

    if (selection.branchId) {
        saveOwnerActiveBranch(selection.branchId);
    }

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
            return activeBranchFallback(expectedService);
        }

        const normalizedExpected = String(expectedService || '').trim().toLowerCase();
        if (normalizedExpected && value.service !== normalizedExpected) {
            return activeBranchFallback(normalizedExpected);
        }

        return {
            ...value,
            branchId: value.branchId || readOwnerActiveBranch(),
        };
    } catch {
        window.sessionStorage.removeItem(STORAGE_KEY);
        return activeBranchFallback(expectedService);
    }
}

export function clearBookingAvailabilitySelection() {
    if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(STORAGE_KEY);
    }
}
