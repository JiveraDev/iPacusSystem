const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export async function registerUser(payload) {
    const normalizedBaseUrl = (API_BASE_URL).replace(/\/+$/, "");
    const usersUrl = normalizedBaseUrl.endsWith("/api")
        ? `${normalizedBaseUrl}/users`
        : `${normalizedBaseUrl}/api/users`;

    const response = await fetch(usersUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.message || `Registration failed with status ${response.status}`);
    }

    return data;
}
