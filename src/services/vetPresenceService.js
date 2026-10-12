import { apiRequest, patchJson } from './apiClient';

export function fetchVetPresence(branchId) {
    const query = branchId ? `?branchId=${encodeURIComponent(branchId)}` : '';
    return apiRequest(`/vet-presence${query}`, { cache: 'no-store', suppressServerUnavailable: true });
}

export function updateVetPresence(isIn) {
    return patchJson('/vet-presence', { isIn });
}
