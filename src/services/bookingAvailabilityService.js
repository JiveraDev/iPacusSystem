import { apiRequest } from './apiClient';
import { invalidResponse, requireObject } from '../lib/errorPolicy.js';

export function fetchBookingAvailability(params = {}, options = {}) {
    const query = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            query.set(key, String(value));
        }
    });

    const suffix = query.toString();
    return apiRequest(`/booking-availability${suffix ? `?${suffix}` : ''}`, options).then((response) => {
        requireObject(response);
        if (!response.filters || !Array.isArray(response.filters.branches) || !response.selected || !response.details
            || (!params.detailsOnly && !Array.isArray(response.days))) throw invalidResponse();
        return response;
    });
}
