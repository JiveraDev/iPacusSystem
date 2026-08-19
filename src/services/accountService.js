import { apiRequest, deleteRequest, patchJson, postJson } from './apiClient';
import { sanitizeErrorPayload } from '../lib/errorPresentation.js';

export function fetchAccounts() {
    return apiRequest('/accounts', { apiPrefix: true });
}

export function fetchVeterinarians() {
    return apiRequest('/veterinarians', { apiPrefix: true });
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

export async function fetchPetOwnerAccounts() {
    const query = new URLSearchParams({ role: currentUserRole() });
    const data = await apiRequest(`/pet-owner-accounts?${query.toString()}`, { apiPrefix: true });
    return sanitizeErrorPayload(
        data,
        'Pet owner account information could not be loaded.',
        { context: 'Legacy pet owner account diagnostics were removed from the API payload.' }
    );
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
