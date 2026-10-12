import { apiRequest } from './apiClient';

export function fetchStaffActivity({ scope = 'self', userId = '', role = '', branchId = '', module = 'major', from = '', offset = 0, limit = 25 } = {}) {
    const query = new URLSearchParams({ scope, offset: String(offset), limit: String(limit) });
    if (userId) query.set('userId', userId);
    if (role) query.set('role', role);
    if (branchId) query.set('branchId', branchId);
    if (module) query.set('module', module);
    if (from) query.set('from', from);
    return apiRequest(`/activity?${query.toString()}`, { apiPrefix: true });
}

export function fetchStaffActivityOptions() {
    return apiRequest('/activity/options', { apiPrefix: true });
}
