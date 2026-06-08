const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

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
    const normalizedBaseUrl = API_BASE_URL.replace(/\/+$/, "");
    const loginUrl = normalizedBaseUrl.endsWith("/api")
        ? `${normalizedBaseUrl}/login`
        : `${normalizedBaseUrl}/api/login`;

    const response = await fetch(loginUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));

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
        token: data.access_token
    };
}
