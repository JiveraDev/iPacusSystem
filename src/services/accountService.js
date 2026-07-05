import { apiRequest, deleteRequest, patchJson, postJson } from './apiClient';

export function fetchAccounts() {
    return apiRequest('/accounts', { apiPrefix: true });
}

export function createAccount(payload) {
    return postJson('/accounts/create', payload, { apiPrefix: true });
}

export function updateAccountStatus(userId, payload) {
    return patchJson(`/accounts/${userId}/status`, payload, { apiPrefix: true });
}

function currentUserRole() {
    try {
        const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
        return user?.role || '';
    } catch {
        return '';
    }
}

export function updatePersonnelAccountDetails(userId, payload) {
    return patchJson(`/accounts/${userId}/profile`, {
        ...payload,
        role: currentUserRole()
    }, { apiPrefix: true });
}

export function deleteAccount(userId, payload) {
    return deleteRequest(`/accounts/${userId}`, {
        apiPrefix: true,
        body: JSON.stringify({
            ...payload,
            role: currentUserRole()
        })
    });
}

export function fetchPetOwnerAccounts() {
    const query = new URLSearchParams({ role: currentUserRole() });
    return apiRequest(`/pet-owner-accounts?${query.toString()}`, { apiPrefix: true });
}

export function updatePetOwnerStatus(userId, payload) {
    return patchJson(`/pet-owner-accounts/${userId}/status`, {
        ...payload,
        role: currentUserRole()
    }, { apiPrefix: true });
}

export function removePetOwnerOwnership(userId, petId) {
    const query = new URLSearchParams({ role: currentUserRole() });
    return apiRequest(`/pet-owner-accounts/${userId}/pets/${petId}?${query.toString()}`, {
        method: 'DELETE',
        apiPrefix: true
    });
}
