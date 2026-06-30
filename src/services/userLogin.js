import { apiFetch, readJsonResponse } from './apiClient';

export class LoginError extends Error {
    constructor(message, details = {}) {
        super(message);
        this.name = "LoginError";
        this.code = details.code || "";
        this.email = details.email || "";
        this.status = details.status || 0;
    }
}

export async function loginUser(payload) {
    const response = await apiFetch('/login', {
        apiPrefix: true,
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    const data = await readJsonResponse(response);

    if (!response.ok) {
        throw new LoginError(data.message || `Login failed with status ${response.status}`, {
            code: data.code,
            email: data.email,
            status: response.status,
        });
    }

    // Return both user and token
    return {
        user: data.user,
        token: data.access_token,
        expiresAt: data.expires_at || ''
    };
}
