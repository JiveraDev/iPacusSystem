import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { bookingPreviewSelection } from '../lib/vetDailyBookings.js';

// Exercise the real route declarations and matcher without needing a JSX
// renderer. These declarations are plain JavaScript before the provider.
const source = readFileSync(new URL('./dashboardRouter.jsx', import.meta.url), 'utf8');
const start = source.indexOf('const DEBUG_BYPASS');
const end = source.indexOf('function DashboardRouterProvider');
assert.ok(start >= 0 && end > start, 'The router matcher must be available for this integration test.');
const router = runInNewContext(`${source.slice(start, end)}; ({ getRouteMatch, normalizePath })`);
const match = target => JSON.parse(JSON.stringify(router.getRouteMatch(target)));

test('To-dos View booking links resolve to My List with their date and booking parameters', () => {
    const target = '/dashboard/vet/my-list?date=2026-10-07&booking=42';
    assert.equal(match(target).path, '/dashboard/vet/my-list');
    assert.deepEqual(match(target).params, {});
});

test('query values containing slashes do not become route segments', () => {
    assert.equal(match('/dashboard/vet/my-list?date=2026-10-07&return=/dashboard/todos').path, '/dashboard/vet/my-list');
});

test('hash fragments and query strings both leave screen selection unchanged', () => {
    assert.equal(match('/dashboard/vet/my-list#bookings').path, '/dashboard/vet/my-list');
    assert.equal(match('/dashboard/vet/my-list?date=2026-10-07#bookings').path, '/dashboard/vet/my-list');
});

test('dynamic route parameters exclude query strings and hash fragments', () => {
    const route = match('/dashboard/vet/online-consultations/51/diagnosis?booking=42#prescription');
    assert.equal(route.path, '/dashboard/vet/online-consultations/:onlineConsultationId/diagnosis');
    assert.deepEqual(route.params, { onlineConsultationId: '51' });
    assert.deepEqual(match('/dashboard/my-pets/7?tab=records').params, { petId: '7' });
});

test('query links keep the same permissions as their base route', () => {
    assert.deepEqual(match('/dashboard/vet/my-list?booking=42').allowedRoles, match('/dashboard/vet/my-list').allowedRoles);
    assert.deepEqual(match('/dashboard/accounts?user=11').allowedRoles, match('/dashboard/accounts').allowedRoles);
});

test('navigation normalization preserves parameters for the destination screen', () => {
    const target = '/dashboard/vet/my-list?date=2026-10-07&booking=42#bookings';
    assert.equal(router.normalizePath(target), target);
    assert.equal(router.normalizePath('/dashboard/home'), '/dashboard');
    assert.equal(router.normalizePath(''), '/dashboard');
});

test('unrecognized paths still use the original dashboard fallback', () => {
    assert.equal(match('/dashboard/not-a-screen?booking=42').path, '/dashboard');
});

test('the complete To-do link routes to My List and selects the requested preview', () => {
    const target = '/dashboard/vet/my-list?date=2026-10-07&booking=42#bookings';
    const location = new URL(router.normalizePath(target), 'http://localhost');
    assert.equal(match(target).path, '/dashboard/vet/my-list');
    assert.deepEqual(bookingPreviewSelection(location.search), { date: '2026-10-07', bookingId: '42' });
});

test('the actual My List listeners update on navigation and Back/Forward, then clean up', () => {
    const page = readFileSync(new URL('./VetrinarianComponents/VetMylistinService.jsx', import.meta.url), 'utf8');
    const listenerStart = page.indexOf('const syncBookingPreview =');
    const listenerEnd = page.indexOf('    }, []);', listenerStart);
    assert.ok(listenerStart >= 0 && listenerEnd > listenerStart, 'My List must synchronize booking-preview navigation.');
    const listeners = new Map();
    const selection = { date: '', bookingId: '' };
    const window = {
        location: { search: '' },
        addEventListener: (name, callback) => listeners.set(name, callback),
        removeEventListener: (name, callback) => {
            if (listeners.get(name) === callback) listeners.delete(name);
        },
    };
    const cleanup = runInNewContext(`(() => { ${page.slice(listenerStart, listenerEnd)} })()`, {
        window, bookingPreviewSelection,
        setBookingViewerDate: value => { selection.date = value; },
        setPreviewBookingId: value => { selection.bookingId = value; },
    });
    window.location.search = '?date=2026-10-07&booking=42';
    listeners.get('ipawcus:dashboard-route-change')();
    assert.deepEqual(selection, { date: '2026-10-07', bookingId: '42' });
    window.location.search = '?date=2026-10-12&booking=51';
    listeners.get('popstate')();
    assert.deepEqual(selection, { date: '2026-10-12', bookingId: '51' });
    window.location.search = '';
    listeners.get('popstate')();
    assert.deepEqual(selection, { date: '', bookingId: '' });
    cleanup();
    assert.equal(listeners.size, 0);
});
