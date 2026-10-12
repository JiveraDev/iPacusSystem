import { apiRequest } from './apiClient';

export async function fetchPetCatalog() {
    return apiRequest('/pet-catalog', {
        apiPrefix: true,
        suppressServerUnavailable: true,
    });
}
