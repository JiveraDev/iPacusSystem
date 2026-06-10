import { apiRequest, postJson } from './apiClient';

export function fetchVetSchedules(userId) {
    const params = new URLSearchParams({ userId });
    return apiRequest(`/vet_schedules?${params.toString()}`, { apiPrefix: true });
}

export function updateVetSchedules(payload) {
    return postJson('/vet_schedules', payload, { apiPrefix: true });
}
