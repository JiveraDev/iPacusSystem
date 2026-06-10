import { apiRequest, patchJson } from './apiClient';

export function fetchProfile({ userId, role }) {
    const params = new URLSearchParams({
        userId,
        role: role || ''
    });

    return apiRequest(`/profile?${params.toString()}`, { apiPrefix: true });
}

export function updateProfile({ userId, role, payload }) {
    const params = new URLSearchParams({
        userId,
        role: role || ''
    });

    return patchJson(`/profile?${params.toString()}`, payload, { apiPrefix: true });
}
