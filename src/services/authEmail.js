const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

function authUrl(path) {
    const normalizedBaseUrl = API_BASE_URL.replace(/\/+$/, "");
    const apiBase = normalizedBaseUrl.endsWith("/api") ? normalizedBaseUrl : `${normalizedBaseUrl}/api`;

    return `${apiBase}${path}`;
}

async function postAuth(path, payload) {
    const response = await fetch(authUrl(path), {
        method: "POST",
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

export function resetPasswordWithOtp(payload) {
    return postAuth("/auth/reset-password", payload);
}
