const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export async function linkPetService(userId, sharableId) {
    try {
        const token = localStorage.getItem("authToken");
        const response = await fetch(`${API_BASE_URL}/api/pet_ownership/link`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ userId, sharableId }),
        });

        if (!response.ok) {
            let errorMessage = 'Failed to link pet';
            try {
                const errorData = await response.json();
                errorMessage = errorData.message || errorMessage;
            } catch (e) {
                console.error('Could not read error response');
            }
            throw new Error(errorMessage);
        }

        return await response.json();
    } catch (error) {
        console.error('Error in linkPetService:', error);
        throw error;
    }
}

export async function getUserPetsService(userId) {
    try {
        const token = localStorage.getItem("authToken");
        const response = await fetch(`${API_BASE_URL}/api/users/${userId}/pets`, {
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
