import assert from 'node:assert/strict';
import test from 'node:test';
import { clearLandingBookingIntent, consumeLandingBookingRoute, landingBookingRoute, saveLandingBookingIntent } from './landingBookingIntent.js';
import {
    readBookingAvailabilitySelection,
    bookingSelectionDraftValue,
    preferredVeterinarianNote,
    readOwnerActiveBranch,
    saveBookingAvailabilitySelection,
    saveOwnerActiveBranch,
    updatePreferredVeterinarianNote,
} from './bookingAvailabilityNavigation.js';

const owner = { role: 'pet_owner' };
const intentKey = 'ipawcus:landing-booking-intent';
function setupStorage() {
    const values = new Map();
    globalThis.window = { sessionStorage: {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
        removeItem: (key) => values.delete(key),
    } };
    return values;
}

test('online consultation login opens the form once and preserves all calendar details', () => {
    setupStorage();
    assert.equal(saveLandingBookingIntent({ service: 'online-consultation', date: '2026-09-08', time: '13:30', branchId: 2, veterinarianId: 9, veterinarianName: 'Dr. Verti Ferst' }), true);
    assert.equal(landingBookingRoute(owner), '/dashboard/consult/booking');
    assert.equal(consumeLandingBookingRoute(owner), '/dashboard/consult/booking');
    assert.equal(landingBookingRoute(owner), null);
    const prefill = readBookingAvailabilitySelection('online-consultation');
    assert.equal(prefill.date, '2026-09-08');
    assert.equal(prefill.time, '13:30');
    assert.equal(prefill.branchId, 2);
    assert.equal(prefill.veterinarianId, 9);
    assert.equal(prefill.veterinarianName, 'Dr. Verti Ferst');
    assert.equal(preferredVeterinarianNote(prefill), 'Preferred vet: Dr. Verti Ferst');
});

test('service descriptions and boarding map to their matching forms', () => {
    for (const [service, route] of [
        ['general-checkup', '/dashboard/services/general-checkup'],
        ['vaccination', '/dashboard/services/vaccination'],
        ['grooming', '/dashboard/services/grooming'],
        ['boarding', '/dashboard/services/pet-hotel'],
        ['home-service', '/dashboard/services/home-services'],
        ['special-services', '/dashboard/services/special-services'],
    ]) {
        setupStorage();
        saveLandingBookingIntent({ service, date: '2026-09-09', room: { roomType: 'boarding-small' } });
        assert.equal(consumeLandingBookingRoute(owner), route);
        assert.equal(readBookingAvailabilitySelection(service).roomType, 'boarding-small');
    }
});

test('new description choice replaces a previous calendar choice', () => {
    setupStorage();
    saveLandingBookingIntent({ service: 'vaccination', date: '2026-09-09', time: '10:00' });
    saveLandingBookingIntent({ service: 'online-consultation' });
    assert.equal(consumeLandingBookingRoute(owner), '/dashboard/consult/booking');
    assert.equal(readBookingAvailabilitySelection('online-consultation').date, '');
});

test('Pet Hotel room selection keeps its chosen clinic through owner login', () => {
    setupStorage();
    saveOwnerActiveBranch(1);
    saveLandingBookingIntent({ service: 'boarding', branchId: 2, roomType: 'hotel-medium' });
    assert.equal(consumeLandingBookingRoute(owner), '/dashboard/services/pet-hotel');
    const selection = readBookingAvailabilitySelection('boarding');
    assert.equal(selection.branchId, 2);
    assert.equal(selection.roomType, 'hotel-medium');
    assert.equal(readOwnerActiveBranch(), 2);
});

test('admin and vet accounts never follow pet-owner landing destinations', () => {
    for (const role of ['admin', 'super_admin', 'veterinarian', '', 'unknown']) {
        setupStorage();
        saveLandingBookingIntent({ service: 'online-consultation' });
        assert.equal(consumeLandingBookingRoute({ role }), null);
        assert.equal(readBookingAvailabilitySelection(), null);
    }
});

test('invalid, external, expired and future-dated destinations are rejected', () => {
    const values = setupStorage();
    for (const intent of [
        { service: 'https://example.com', savedAt: Date.now() },
        { service: '/dashboard/accounts', savedAt: Date.now() },
        { service: 'constructor', savedAt: Date.now() },
        { service: '__proto__', savedAt: Date.now() },
        { service: 'online-consultation', savedAt: Date.now() - 31 * 60 * 1000 },
        { service: 'online-consultation', savedAt: Date.now() + 60000 },
        { service: 'online-consultation' },
    ]) {
        values.set(intentKey, JSON.stringify(intent));
        assert.equal(landingBookingRoute(owner), null);
    }
    values.set(intentKey, 'broken json');
    assert.equal(landingBookingRoute(owner), null);
});

test('ordinary login has no redirect, and explicit login clears old intent', () => {
    setupStorage();
    assert.equal(consumeLandingBookingRoute(owner), null);
    saveLandingBookingIntent({ service: 'grooming' });
    clearLandingBookingIntent();
    assert.equal(landingBookingRoute(owner), null);
});

test('disabled storage does not prevent login', () => {
    globalThis.window = { get sessionStorage() { throw new Error('Storage unavailable'); } };
    assert.equal(saveLandingBookingIntent({ service: 'online-consultation' }), false);
    assert.equal(consumeLandingBookingRoute(owner), null);
});

test('a saved owner clinic does not choose the clinic for unrelated bookings', () => {
    setupStorage();
    saveOwnerActiveBranch(7);

    assert.equal(readOwnerActiveBranch(), 7);
    assert.equal(readBookingAvailabilitySelection('grooming'), null);
    assert.equal(readBookingAvailabilitySelection('boarding'), null);

    saveBookingAvailabilitySelection({ service: 'vaccination', branchId: 9 });
    assert.equal(readOwnerActiveBranch(), 9);
    assert.equal(readBookingAvailabilitySelection('vaccination').branchId, 9);
    assert.equal(readBookingAvailabilitySelection('parasite-control'), null);
});

test('missing or expired calendar selections never fall back to the saved owner clinic', () => {
    const values = setupStorage();
    saveOwnerActiveBranch(7);
    saveBookingAvailabilitySelection({ service: 'vaccination', date: '2026-10-12' });
    assert.equal(readBookingAvailabilitySelection('vaccination').branchId, null);
    const key = 'ipawcus:availability-booking-selection';
    values.set(key, JSON.stringify({ service: 'vaccination', branchId: 7, savedAt: Date.now() - 31 * 60 * 1000 }));
    assert.equal(readBookingAvailabilitySelection('vaccination'), null);
    values.set(key, 'broken json');
    assert.equal(readBookingAvailabilitySelection('vaccination'), null);
    assert.equal(readOwnerActiveBranch(), 7);
});

test('a new calendar selection wins over an older appointment draft without clearing other fields', () => {
    setupStorage();
    saveBookingAvailabilitySelection({ service: 'general-checkup', date: '2026-10-12', time: '08:30', branchId: 2, veterinarianId: 9, veterinarianName: 'Dr. Verti Ferst' });
    const selection = readBookingAvailabilitySelection('general-checkup');
    const base = { selection, path: '/dashboard/services/general-checkup', draftSavedAt: selection.savedAt - 1000 };
    const storedValue = { kind: 'value', value: 'old value' };
    for (const fieldId of ['date', 'time', 'branch-general-checkup']) {
        assert.equal(bookingSelectionDraftValue({ ...base, fieldId, storedValue }), null, `${fieldId} keeps the selected appointment`);
    }
    assert.deepEqual(bookingSelectionDraftValue({ ...base, fieldId: 'petName', storedValue }), storedValue);
    const notes = bookingSelectionDraftValue({ ...base, fieldId: 'notes', storedValue: { kind: 'value', value: 'Preferred vet: Dr. Previous\nLimping since yesterday.\nPlease call before the visit.' } });
    assert.equal(notes.value, 'Preferred vet: Dr. Verti Ferst\nLimping since yesterday.\nPlease call before the visit.');
});

test('calendar prefill protects the date and time controls for every appointment form', () => {
    for (const [service, route, dateId, timeId] of [
        ['vaccination', 'services/vaccination', 'date', 'time'],
        ['parasite-control', 'services/parasite-control', 'date', 'time'],
        ['dental', 'services/dental-checkup', 'date', 'time'],
        ['surgery', 'services/surgery', 'date', 'time'],
        ['grooming', 'services/grooming', 'date', 'time'],
        ['lab-testing', 'services/laboratory-testing', 'date', 'time'],
        ['online-consultation', 'consult/booking', 'selectedDate', 'online-consultation-time'],
        ['home-service', 'services/home-services', 'home-service-date', 'home-service-time'],
        ['special-services', 'services/special-services', 'serviceDate', 'special-service-time'],
    ]) {
        const base = { selection: { service, date: '2026-10-12', time: '08:30', savedAt: 200 }, path: `/dashboard/${route}`, draftSavedAt: 100, storedValue: { kind: 'value', value: 'old' } };
        assert.equal(bookingSelectionDraftValue({ ...base, fieldId: dateId }), null, `${service} date`);
        assert.equal(bookingSelectionDraftValue({ ...base, fieldId: timeId }), null, `${service} time`);
    }
});

test('newer client edits and drafts for another service are preserved', () => {
    const base = { selection: { service: 'vaccination', date: '2026-10-12', time: '08:30', savedAt: 200 }, path: '/dashboard/services/vaccination', draftSavedAt: 300, fieldId: 'date', storedValue: { kind: 'value', value: '2026-10-13' } };
    assert.deepEqual(bookingSelectionDraftValue(base), base.storedValue);
    assert.deepEqual(bookingSelectionDraftValue({ ...base, draftSavedAt: 100, path: '/dashboard/services/surgery' }), base.storedValue);
    assert.deepEqual(bookingSelectionDraftValue({ ...base, selection: { ...base.selection, date: '', time: '' }, draftSavedAt: 100 }), base.storedValue);
});

test('changing an online vet updates the preset note and preserves the client’s text', () => {
    assert.equal(updatePreferredVeterinarianNote('Preferred vet: Dr. A\nPlease discuss appetite.', 'Dr. A', 'Dr. B'), 'Preferred vet: Dr. B\nPlease discuss appetite.');
    assert.equal(updatePreferredVeterinarianNote('I would like Dr. A if possible.\nPlease discuss appetite.', 'Dr. A', 'Dr. B'), 'I would like Dr. A if possible.\nPlease discuss appetite.');
    assert.equal(updatePreferredVeterinarianNote('Please discuss appetite.', '', 'Dr. B'), 'Preferred vet: Dr. B\nPlease discuss appetite.');
    assert.equal(preferredVeterinarianNote(null), '');
});
