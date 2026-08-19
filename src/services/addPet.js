import { postJson } from './apiClient';

export async function addPetService(petData) {
    try {
        return await postJson('/pet_information', petData, {
            apiPrefix: true,
        });
    } catch (error) {
        console.error('Error in addPetService:', error);
        throw error;
    }
}
