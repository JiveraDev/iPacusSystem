import { apiRequest } from './apiClient';

export function fetchVetBookingSchedule(veterinarianId, params = {}) {
    const query = new URLSearchParams({ veterinarianId: String(veterinarianId) });
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
    });
    return apiRequest(`/veterinarian-booking-schedule?${query}`);
}

export function saveVetBookingSchedule(veterinarianId, payload) {
    return apiRequest('/veterinarian-booking-schedule', {
        method: 'PUT',
        body: JSON.stringify({ veterinarianId, ...payload }),
    });
}
