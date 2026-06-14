import { apiRequest, patchJson, postJson } from './apiClient';

export function fetchAccounts() {
    return apiRequest('/accounts', { apiPrefix: true });
}

export function createAccount(payload) {
    return postJson('/accounts/create', payload, { apiPrefix: true });
}

export function updateAccountStatus(userId, payload) {
    return patchJson(`/accounts/${userId}/status`, payload, { apiPrefix: true });
}
