import { apiRequest } from './apiClient';

function getCurrentUser() {
    try {
        return JSON.parse(localStorage.getItem('currentUser') || '{}');
    } catch {
        return {};
    }
}

function getUserRole(user = getCurrentUser()) {
    return user?.role || user?.user_role || '';
}

export function fetchPetMediaMonitoring(params = {}, options = {}) {
    const user = params.user || getCurrentUser();
    const query = new URLSearchParams();
    query.set('role', getUserRole(user));
    if (params.range) {
        query.set('range', params.range);
    }
    if (params.startDate || params.start_date) {
        query.set('start_date', params.startDate || params.start_date);
    }
    if (params.endDate || params.end_date) {
        query.set('end_date', params.endDate || params.end_date);
    }

    return apiRequest(`/pet-media-monitoring?${query.toString()}`, options);
}
