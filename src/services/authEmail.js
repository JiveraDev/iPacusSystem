import { apiFetch } from './apiClient';

async function postAuth(path, payload) {
    const response = await apiFetch(path, {
        apiPrefix: true,
        method: "POST",
        suppressServerUnavailable: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.message || `Request failed with status ${response.status}`);
    }

    return data;
}

export function verifyEmail(payload) {
    return postAuth("/auth/verify-email", payload);
}

export function resendVerificationCode(payload) {
    return postAuth("/auth/resend-verification", payload);
}

export function requestPasswordReset(payload) {
    return postAuth("/auth/forgot-password", payload);
}

export function verifyPasswordResetCode(payload) {
    return postAuth("/auth/verify-reset-code", payload);
}

export function resetPasswordWithOtp(payload) {
    return postAuth("/auth/reset-password", payload);
}
