import { apiRequest, patchJson, postJson } from './apiClient';

export async function linkPetService(userId, sharableId) {
    try {
        return await postJson('/pet_ownership/link', { userId, sharableId }, {
            apiPrefix: true,
        });
    } catch (error) {
        console.error('Error in linkPetService:', error);
        throw error;
    }
}

export async function fetchCoparentRequest(requestId) {
    const data = await apiRequest(`/pet_ownership/coparent-requests/${requestId}`, {
        apiPrefix: true
    });

    return data.request;
}

export async function decideCoparentRequest(requestId, action, note = '') {
    return patchJson(`/pet_ownership/coparent-requests/${requestId}`, { action, note }, {
        apiPrefix: true,
    });
}

export async function getUserPetsService(userId) {
    try {
        return await apiRequest(`/users/${userId}/pets`, {
            apiPrefix: true
        });
    } catch (error) {
        console.error('Error in getUserPetsService:', error);
        throw error;
    }
}
