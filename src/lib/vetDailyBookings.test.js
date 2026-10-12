import assert from 'node:assert/strict';
import test from 'node:test';
import { clinicTodayDate } from './date.js';
import { assignedVetBookings, bookingDateKey, bookingPreviewSelection, bookingScheduleCount, bookingsForDate, filterVetBookings, nextBookedDate, nextBookingDayLabel, queueScheduleDate } from './vetDailyBookings.js';

const booking = (id, date, overrides = {}) => ({ id, date, veterinarianId: 11, type: 'vaccination', status: 'confirmed', time: '09:00:00', branchId: 1, ...overrides });

test('My List shows only the selected vet’s approved medical bookings', () => {
    const approved = booking(1, '2026-10-05');
    const rows = [approved, approved, booking(2, '2026-10-05', { status: 'pending' }),
        booking(3, '2026-10-05', { veterinarianId: 12 }), booking(4, '2026-10-05', { status: 'cancelled' }),
        booking(5, '2026-10-05', { type: 'boarding' }), booking(6, '2026-10-05', { type: 'grooming' })];
    assert.deepEqual(assignedVetBookings(rows, 11), [approved]);
    assert.equal(assignedVetBookings(rows, 11, false).length, 2);
    assert.deepEqual(assignedVetBookings(rows, null), []);
});

test('today excludes yesterday and all future dates while preserving time order', () => {
    const rows = [booking(1, '2026-10-04'), booking(2, '2026-10-05', { time: '10:00:00' }), booking(3, '2026-10-06'), booking(4, '2026-10-05')];
    assert.deepEqual(bookingsForDate(rows, '2026-10-05').map(row => row.id), [4, 2]);
});

test('next button says Tomorrow only when tomorrow really has approved bookings', () => {
    const rows = [booking(1, '2026-10-05'), booking(2, '2026-10-06'), booking(3, '2026-10-07')];
    const next = nextBookedDate(rows, '2026-10-05');
    assert.equal(next, '2026-10-06');
    assert.equal(nextBookingDayLabel(next, '2026-10-05'), 'Tomorrow');
});

test('next button skips unbooked days, Sunday and gaps between schedules', () => {
    const rows = [booking(1, '2026-10-05'), booking(2, '2026-10-12'), booking(3, '2026-10-20')];
    assert.equal(nextBookedDate(rows, '2026-10-10'), '2026-10-12');
    assert.equal(nextBookingDayLabel('2026-10-12', '2026-10-10'), 'Next Monday');
    assert.equal(nextBookingDayLabel('2026-10-20', '2026-10-12'), 'Next Tuesday');
    assert.equal(nextBookedDate(rows, '2026-10-21'), '');
    assert.equal(nextBookingDayLabel('', '2026-10-21'), 'No upcoming bookings');
});

test('next-day labels work across month and year boundaries', () => {
    assert.equal(nextBookingDayLabel('2027-01-01', '2026-12-31'), 'Tomorrow');
    assert.equal(nextBookingDayLabel('2026-11-01', '2026-10-31'), 'Tomorrow');
});

test('queue dates follow appointment dates, not the day the queue entry was created', () => {
    assert.equal(queueScheduleDate({ timestamp: '2026-10-04 15:00:00', related_booking_date: '2026-10-05' }), '2026-10-05');
    assert.equal(queueScheduleDate({ timestamp: '2026-10-05 15:00:00' }), '2026-10-05');
    assert.equal(bookingDateKey('2026-02-30'), '');
    assert.equal(bookingDateKey('not a date'), '');
});

test('today uses Philippine time even when the browser is in another timezone', () => {
    assert.equal(clinicTodayDate(new Date('2026-10-04T16:00:00Z')), '2026-10-05');
    assert.equal(clinicTodayDate(new Date('2026-10-04T15:59:59Z')), '2026-10-04');
});

test('clinic and search filters do not hide other assigned sites by default', () => {
    const rows = [booking(1, '2026-10-05', { petName: 'Milo', branchName: 'Main' }), booking(2, '2026-10-05', { petName: 'Coco', branchId: 2 })];
    assert.equal(filterVetBookings(rows).length, 2);
    assert.equal(filterVetBookings(rows, '', '2')[0].id, 2);
    assert.equal(filterVetBookings(rows, 'milo')[0].id, 1);
});

test('daily counts include calls but exclude personal/follow-up tasks and duplicate booking rows', () => {
    const tasks = [
        { source: 'vet_booking', bookingId: 1 },
        { source: 'vet_booking', bookingId: 1, petId: 2 },
        { source: 'online_consultation', bookingId: 2 },
        { source: 'booking', sourceId: 3 },
        { source: 'personal', sourceId: 4 },
        { source: 'vet_follow_up', sourceId: 5 },
        { source: 'vet_booking', bookingId: 6, status: 'cancelled' },
    ];
    assert.equal(bookingScheduleCount(tasks), 3);
    assert.equal(bookingScheduleCount([]), 0);
});

test('booking-preview links preserve the actual appointment date and booking ID', () => {
    assert.deepEqual(bookingPreviewSelection('?date=2026-10-07&booking=42'), { date: '2026-10-07', bookingId: '42' });
    assert.deepEqual(bookingPreviewSelection('?booking=0042&date=2026-10-07'), { date: '2026-10-07', bookingId: '42' });
});

test('Back and Forward selections change the preview without retaining the previous booking', () => {
    const searches = ['?date=2026-10-07&booking=42', '?date=2026-10-12&booking=51', '?date=2026-10-07&booking=42', ''];
    assert.deepEqual(searches.map(bookingPreviewSelection), [
        { date: '2026-10-07', bookingId: '42' },
        { date: '2026-10-12', bookingId: '51' },
        { date: '2026-10-07', bookingId: '42' },
        { date: '', bookingId: '' },
    ]);
});

test('invalid preview values cannot select a booking or open an invalid date', () => {
    assert.deepEqual(bookingPreviewSelection('?date=2026-02-30&booking=42'), { date: '', bookingId: '' });
    assert.deepEqual(bookingPreviewSelection('?date=2026-10-07&booking=-42'), { date: '2026-10-07', bookingId: '' });
    assert.deepEqual(bookingPreviewSelection('?date=2026-10-07&booking=9007199254740992'), { date: '2026-10-07', bookingId: '' });
    assert.deepEqual(bookingPreviewSelection('?booking=42'), { date: '', bookingId: '' });
});
