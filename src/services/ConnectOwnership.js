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

export async function fetchCoparentRequest(requestId) {
    const response = await apiFetch(`/pet_ownership/coparent-requests/${requestId}`, {
        apiPrefix: true,
        headers: {
            'Authorization': `Bearer ${localStorage.getItem("authToken")}`
        }
    });

    const data = await readJsonResponse(response);
    if (!response.ok) {
        throw new Error(data.message || 'Failed to load co-parent request');
    }

    return data.request;
}

export async function decideCoparentRequest(requestId, action, note = '') {
    const response = await apiFetch(`/pet_ownership/coparent-requests/${requestId}`, {
        apiPrefix: true,
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem("authToken")}`
        },
        body: JSON.stringify({ action, note }),
    });

    const data = await readJsonResponse(response);
    if (!response.ok) {
        throw new Error(data.message || 'Failed to update co-parent request');
    }

    return data;
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
