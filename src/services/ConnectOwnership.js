import { apiFetch, readJsonResponse } from './apiClient';

export async function linkPetService(userId, sharableId) {
    try {
        const token = localStorage.getItem("authToken");
        const response = await apiFetch('/pet_ownership/link', {
            apiPrefix: true,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ userId, sharableId }),
        });

        if (!response.ok) {
            let errorMessage = 'Failed to link pet';
            const errorData = await readJsonResponse(response);
            errorMessage = errorData.message || errorMessage;
            throw new Error(errorMessage);
        }

        return await readJsonResponse(response);
    } catch (error) {
        console.error('Error in linkPetService:', error);
        throw error;
    }
}

export async function getUserPetsService(userId) {
    try {
        const token = localStorage.getItem("authToken");
        const response = await apiFetch(`/users/${userId}/pets`, {
            apiPrefix: true,
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch user pets');
        }

        return await response.json();
    } catch (error) {
        console.error('Error in getUserPetsService:', error);
        throw error;
    }
}
