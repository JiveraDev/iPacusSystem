import { postJson } from './apiClient';

async function postAuth(path, payload) {
    return postJson(path, payload, {
        apiPrefix: true,
        suppressServerUnavailable: true,
    });
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
