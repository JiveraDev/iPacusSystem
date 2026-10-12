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
        veterinarianName: String(selection.veterinarianName || '').trim(),
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
        if (normalizedExpected && value.service !== normalizedExpected) {
            return null;
        }

        return {
            ...value,
            branchId: value.branchId || null,
        };
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

export function preferredVeterinarianNote(selection) {
    const name = String(selection?.veterinarianName || '').trim();
    return name ? `Preferred vet: ${name}` : '';
}

export function bookingSelectionDraftValue({ selection, path, draftSavedAt, fieldId, storedValue }) {
    if (!selection || (!selection.date && !selection.time) || Number(selection.savedAt) <= Number(draftSavedAt)
        || bookingRouteForAvailabilityService(selection.service) !== path) return storedValue;

    const id = String(fieldId || '').toLowerCase();
    const dateFields = ['date', 'selecteddate', 'home-service-date', 'servicedate', 'checkindate', 'checkoutdate'];
    const timeFields = ['time', 'online-consultation-time', 'home-service-time', 'special-service-time'];
    if ((selection.date && dateFields.includes(id))
        || (selection.time && timeFields.includes(id))
        || (selection.branchId && id.startsWith('branch-'))
        || (selection.veterinarianId && id === 'consult-veterinarian')) return null;

    const vetNote = preferredVeterinarianNote(selection);
    if (vetNote && ['notes', 'home-service-notes'].includes(id) && storedValue?.kind === 'value') {
        const notes = String(storedValue.value || '').split('\n').filter((line) => !line.startsWith('Preferred vet: ')).join('\n').trim();
        return { ...storedValue, value: [vetNote, notes].filter(Boolean).join('\n') };
    }
    return storedValue;
}

export function updatePreferredVeterinarianNote(notes, previousName, nextName) {
    const previous = preferredVeterinarianNote({ veterinarianName: previousName });
    const next = preferredVeterinarianNote({ veterinarianName: nextName });
    const lines = String(notes || '').split('\n');
    const index = previous ? lines.indexOf(previous) : -1;
    if (index >= 0) {
        if (next) lines[index] = next;
        else lines.splice(index, 1);
    } else if (!previous && next && !lines.includes(next)) {
        lines.unshift(next);
    }
    return lines.join('\n').trim();
}
