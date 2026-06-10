import { apiRequest, patchJson, postJson } from './apiClient';

export function fetchBookings(options = {}) {
    return apiRequest('/bookings', options);
}

export function fetchBookingById(bookingId, options = {}) {
    const params = new URLSearchParams({ bookingId });
    return apiRequest(`/bookings?${params.toString()}`, options);
}

export function fetchUserBookings(userId, options = {}) {
    return apiRequest(`/users/${userId}/bookings`, options);
}

export function createBooking(payload, options = {}) {
    return postJson('/bookings', payload, options);
}

export function updateBookingStatus(bookingId, payload, options = {}) {
    return patchJson(`/bookings/${bookingId}/status`, payload, options);
}

export function updateBookingSchedule(bookingId, payload, options = {}) {
    return patchJson(`/bookings/${bookingId}/schedule`, payload, options);
}

export function receiveBooking(bookingId, payload = {}, options = {}) {
    return postJson(`/bookings/${bookingId}/receive`, payload, options);
}
