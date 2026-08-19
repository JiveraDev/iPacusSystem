import { apiRequest } from './apiClient';

export function fetchBookingAvailability(params = {}, options = {}) {
    const query = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            query.set(key, String(value));
        }
    });

    const suffix = query.toString();
    return apiRequest(`/booking-availability${suffix ? `?${suffix}` : ''}`, options);
}
