import { apiRequest, postJson } from './apiClient';

export function fetchVisits(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') query.set(key, value);
    });
    const suffix = query.toString();
    return apiRequest(`/visits${suffix ? `?${suffix}` : ''}`);
}

export function createVisit(payload) {
    return postJson('/visits', payload);
}

export function saveVisitCharges(visitId, payload) {
    return postJson(`/visits/${visitId}/charges`, payload);
}

export function postVisitPayment(visitId, payload) {
    return postJson(`/visits/${visitId}/payments`, payload);
}

export function postVisitRefund(visitId, payload) {
    return postJson(`/visits/${visitId}/refunds`, payload);
}
