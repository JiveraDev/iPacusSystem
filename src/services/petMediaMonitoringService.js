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
    if (params.petId || params.pet_id) {
        query.set('pet_id', String(params.petId || params.pet_id));
    }
    return apiRequest(`/pet-media-monitoring?${query.toString()}`, options);
}
