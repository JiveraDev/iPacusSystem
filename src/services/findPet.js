import { apiFetch } from './apiClient';

/**
 * Fetches detailed information for a single pet by its sharable ID.
 * @param {string} petId - The sharable ID of the pet (e.g., PET-1-IPAWCUS)
 * @returns {Promise<Object>} The pet data
 */
export async function findPetService(petId) {
    try {
        const token = localStorage.getItem("authToken"); // Get token from local storage
        if (!token) {
            throw new Error("Authentication token not found.");
        }

        const response = await apiFetch(`/pet_information/${petId}`, {
            apiPrefix: true,
            headers: {
                'Authorization': `Bearer ${token}` // Add Authorization header
            }
        });
        
        if (!response.ok) {
            let errorMessage = 'Failed to fetch pet details';
            const errorResponse = response.clone();
            try {
                const errorData = await response.json();
                // Try to get a specific error message from the backend
                errorMessage = errorData.message || (errorData.errors ? Object.values(errorData.errors).flat()[0] : errorMessage);
            } catch {
                // If it's not JSON, try text
                try {
                    const textError = await errorResponse.text();
                    console.error('Server returned non-JSON error:', textError);
                    errorMessage = textError || errorMessage; // Use text error if available
                } catch {
                    console.error('Could not read error response');
                }
            }
            throw new Error(errorMessage);
        }

        return await response.json();
    } catch (error) {
        console.error('Error in findPetService:', error);
        throw error;
    }
}
