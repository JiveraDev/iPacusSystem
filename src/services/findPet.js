import { apiRequest } from './apiClient';

/**
 * Fetches detailed information for a single pet by its sharable ID.
 * @param {string} petId - The sharable ID of the pet (e.g., PET-1-IPAWCUS)
 * @returns {Promise<Object>} The pet data
 */
export async function findPetService(petId) {
    try {
        if (!localStorage.getItem("authToken")) {
            throw new Error("Authentication token not found.");
        }

        return await apiRequest(`/pet_information/${petId}`, {
            apiPrefix: true
        });
    } catch (error) {
        console.error('Error in findPetService:', error);
        throw error;
    }
}
