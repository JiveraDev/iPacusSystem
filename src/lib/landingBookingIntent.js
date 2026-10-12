import {
    bookingRouteForAvailabilityService,
    clearBookingAvailabilitySelection,
    saveBookingAvailabilitySelection,
} from './bookingAvailabilityNavigation.js';

const INTENT_KEY = 'ipawcus:landing-booking-intent';
const MAX_AGE_MS = 30 * 60 * 1000;

export function clearLandingBookingIntent() {
    try {
        window.sessionStorage.removeItem(INTENT_KEY);
    } catch { /* Storage may be disabled; normal login must still work. */ }
}

export function saveLandingBookingIntent(selection = {}) {
    const service = String(selection.service || '').trim().toLowerCase();
    if (bookingRouteForAvailabilityService(service) === '/dashboard/services') {
        clearLandingBookingIntent();
        return false;
    }
    try {
        saveBookingAvailabilitySelection({ ...selection, service });
        window.sessionStorage.setItem(INTENT_KEY, JSON.stringify({ service, savedAt: Date.now() }));
        return true;
    } catch {
        clearLandingBookingIntent();
        return false;
    }
}

export function landingBookingRoute(user) {
    const role = String(user?.role || '').trim().toLowerCase().replace(/[ -]/g, '_');
    if (!['pet_owner', 'petowner', 'owner'].includes(role)) return null;
    try {
        const intent = JSON.parse(window.sessionStorage.getItem(INTENT_KEY) || 'null');
        const age = Date.now() - Number(intent?.savedAt);
        if (!intent || !Number.isFinite(age) || age < 0 || age > MAX_AGE_MS) return null;
        // Derive the destination from known services, never from an arbitrary URL.
        const route = bookingRouteForAvailabilityService(intent.service);
        return route === '/dashboard/services' ? null : route;
    } catch {
        return null;
    }
}

export function consumeLandingBookingRoute(user) {
    const route = landingBookingRoute(user);
    clearLandingBookingIntent();
    // Keep the slot prefill for the destination form, but not for another role.
    if (!route) {
        try { clearBookingAvailabilitySelection(); } catch { /* No stored selection to restore. */ }
    }
    return route;
}
