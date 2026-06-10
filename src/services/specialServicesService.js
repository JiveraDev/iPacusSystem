import { apiRequest, patchJson, postJson } from './apiClient';

export function fetchSpecialServices({ includeInactive = false } = {}) {
    const query = includeInactive ? '?includeInactive=1' : '';
    return apiRequest(`/special_services${query}`, { apiPrefix: true });
}

export function createSpecialService(payload) {
    return postJson('/special_services', payload, { apiPrefix: true });
}

export function updateSpecialService(specialServiceId, payload) {
    return patchJson(`/special_services/${specialServiceId}`, payload, { apiPrefix: true });
}
