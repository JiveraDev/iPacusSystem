import { apiFetch } from './apiClient';

export async function addPetService(petData) {
    try {
        const token = localStorage.getItem("authToken");
        const response = await apiFetch('/pet_information', {
            apiPrefix: true,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(petData),
        });

        if (!response.ok) {
            let errorMessage = 'Failed to add pet';
            const errorResponse = response.clone();
            try {
                const errorData = await response.json();
                errorMessage = errorData.message || errorMessage;
            } catch {
                // If it's not JSON, try text
                try {
                    const textError = await errorResponse.text();
                    console.error('Server returned non-JSON error:', textError);
                } catch {
                    console.error('Could not read error response');
                }
            }
            throw new Error(errorMessage);
        }

        return await response.json();
} catch (error) {
        console.error('Error in addPetService:', error);
        throw error;
    }
}
