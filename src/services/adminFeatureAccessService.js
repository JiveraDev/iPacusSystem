import { apiRequest, jsonRequest } from './apiClient';

export function fetchAdminFeatureAccess(userId = '') {
    const query = new URLSearchParams();
    if (userId) query.set('userId', String(userId));
    const suffix = query.toString() ? `?${query.toString()}` : '';

    return apiRequest(`/admin-feature-access${suffix}`, { apiPrefix: true });
}

export function saveAdminFeatureAccess(userId, permissions) {
    return jsonRequest('/admin-feature-access', {
        userId: Number(userId),
        permissions,
    }, { method: 'PUT', apiPrefix: true });
}
