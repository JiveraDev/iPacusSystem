const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

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
        throw new Error(data.message || `Login failed with status ${response.status}`);
    }

    // Return both user and token
    return {
        user: data.user,
        token: data.access_token
    };
}
