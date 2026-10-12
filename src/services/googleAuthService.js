import { apiRequest, postJson } from './apiClient.js';

const GOOGLE_AUTH_TIMEOUT_MS = 30000;

export function authenticateWithGoogle(credential) {
    return postJson('/auth/google', { credential }, {
        apiPrefix: true,
        timeoutMs: GOOGLE_AUTH_TIMEOUT_MS
    });
}

export function completeGoogleRegistration(payload) {
    return postJson('/auth/google/complete', payload, {
        apiPrefix: true,
        timeoutMs: GOOGLE_AUTH_TIMEOUT_MS
    });
}

export function getGoogleConnectionStatus(options = {}) {
    return apiRequest('/account/google', { apiPrefix: true, ...options });
}

export function connectGoogleAccount(credential) {
    return postJson('/account/google', { credential }, {
        apiPrefix: true,
        timeoutMs: GOOGLE_AUTH_TIMEOUT_MS
    });
}

export function resetGoogleIdentitySession() {
    try {
        window.google?.accounts?.id?.disableAutoSelect?.();
        window.google?.accounts?.id?.cancel?.();
    } catch {
        // Local logout must still finish when Google is blocked or unavailable.
    }
}
