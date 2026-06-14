import { apiRequest, patchJson, postJson } from './apiClient';

function queryString(params = {}) {
    const query = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            query.set(key, value);
        }
    });

    const value = query.toString();
    return value ? `?${value}` : '';
}

export function fetchRecordUpdateRequests(params = {}) {
    return apiRequest(`/record-update-requests${queryString(params)}`);
}

export function createRecordUpdateRequest(payload) {
    return postJson('/record-update-requests', payload);
}

export function updateRecordUpdateRequest(requestId, payload) {
    return patchJson(`/record-update-requests/${requestId}`, payload);
}
