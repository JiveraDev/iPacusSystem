import { apiRequest, postJson } from './apiClient';

export function fetchVisits() {
    return apiRequest('/visits');
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
