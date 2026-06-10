import { apiRequest, patchJson, postJson } from './apiClient';

export function fetchAccounts() {
    return apiRequest('/accounts');
}

export function createAccount(payload) {
    return postJson('/accounts/create', payload);
}

export function updateAccountStatus(userId, payload) {
    return patchJson(`/accounts/${userId}/status`, payload);
}
