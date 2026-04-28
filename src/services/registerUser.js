const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export async function registerUser(payload) {
    const normalizedBaseUrl = (API_BASE_URL).replace(/\/+$/, "");
    const registerUrl = normalizedBaseUrl.endsWith("/api")
        ? `${normalizedBaseUrl}/register`
        : `${normalizedBaseUrl}/api/register`;

    const response = await fetch(registerUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        // Handle validation errors specifically if they exist
        if (data.errors) {
            const firstError = Object.values(data.errors)[0][0];
            throw new Error(firstError);
        }
        throw new Error(data.message || `Registration failed with status ${response.status}`);
    }

    return data;
}
