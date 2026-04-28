const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

/**
 * Fetches detailed information for a single pet by its sharable ID.
 * @param {string} petId - The sharable ID of the pet (e.g., PET-1-IPAWCUS)
 * @returns {Promise<Object>} The pet data
 */
export async function findPetService(petId) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/pet_information/${petId}`);
        
        if (!response.ok) {
            let errorMessage = 'Failed to fetch pet details';
            try {
                const errorData = await response.json();
                errorMessage = errorData.message || errorMessage;
            } catch (e) {
                // Ignore parsing errors
            }
            throw new Error(errorMessage);
        }

        return await response.json();
    } catch (error) {
        console.error('Error in findPetService:', error);
        throw error;
    }
}
