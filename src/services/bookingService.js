import { apiRequest, getStoredApiUser, patchJson, postJson } from './apiClient';
import { assertPetOwnerActionAllowed } from '../lib/accountStatus.js';

function assertBookableDate(payload = {}) {
    const value = payload.booking_date || payload.bookingDate || payload.date || payload.new_date || payload.newDate;
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    if (date.getDay() === 0) {
        throw new Error('The clinic is closed on Sundays. Select a Monday-to-Saturday schedule.');
    }
}

export function fetchBookings(options = {}) {
    return apiRequest('/bookings', options);
}

export function fetchBookingById(bookingId, options = {}) {
    const params = new URLSearchParams({ bookingId });
    return apiRequest(`/bookings?${params.toString()}`, options);
}

export function fetchBookingBillingContext(bookingId, options = {}) {
    return apiRequest(`/bookings/${bookingId}/billing-context`, options);
}

export function reviewBookingPayment(bookingId, payload = {}, options = {}) {
    return postJson(`/bookings/${bookingId}/payment-review`, payload, options);
}

export function postBookingPaymentRefund(bookingId, payload, options = {}) {
    return postJson(`/bookings/${bookingId}/payment-refunds`, payload, options);
}

export function fetchUserBookings(userId, options = {}) {
    return apiRequest(`/users/${userId}/bookings`, options);
}

export function createBooking(payload, options = {}) {
    assertPetOwnerActionAllowed(getStoredApiUser(), 'create a booking');
    assertBookableDate(payload);
    return postJson('/bookings', payload, options);
}

export function updateBookingStatus(bookingId, payload, options = {}) {
    return patchJson(`/bookings/${bookingId}/status`, payload, options);
}

export function updateBookingSchedule(bookingId, payload, options = {}) {
    assertBookableDate(payload);
    return patchJson(`/bookings/${bookingId}/schedule`, payload, options);
}

export function receiveBooking(bookingId, payload = {}, options = {}) {
    return postJson(`/bookings/${bookingId}/receive`, payload, options);
}
