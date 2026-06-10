import { apiRequest, patchJson } from './apiClient';

export function fetchUser(userId) {
    return apiRequest(`/users/${userId}`, { apiPrefix: true });
}

export function updateUser(userId, payload) {
    return patchJson(`/users/${userId}`, payload, { apiPrefix: true });
}

export function updateUserPassword(userId, payload) {
    return patchJson(`/users/${userId}/password`, payload, { apiPrefix: true });
}
