import { apiFetch, readJsonResponse } from './apiClient';

export async function registerUser(payload) {
    const response = await apiFetch('/register', {
        apiPrefix: true,
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    const data = await readJsonResponse(response);

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
