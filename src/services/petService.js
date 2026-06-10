import { apiRequest, patchJson, postJson } from './apiClient';

export function fetchUserPets(userId) {
    return apiRequest(`/users/${userId}/pets`);
}

export function fetchAllPets() {
    return apiRequest('/pet_information', { apiPrefix: true });
}

export function fetchPetDetails(petId) {
    return apiRequest(`/pet_information/${petId}`, { apiPrefix: true });
}

export function updatePetDetails(petId, payload) {
    return patchJson(`/pet_information/${petId}`, payload, { apiPrefix: true });
}

export function updatePetStatus(petId, payload) {
    return patchJson(`/pet_information/${petId}/status`, payload, { apiPrefix: true });
}

export function fetchPetQueues(petId) {
    return apiRequest(`/pets/${petId}/queues`);
}

export function fetchPetBookings(petId) {
    return apiRequest(`/pets/${petId}/bookings`);
}

export function cancelPetOverdueActivity(petId) {
    return postJson(`/pets/${petId}/overdue/cancel`, {});
}

export function fetchPetMedicalRecords(petId) {
    return apiRequest(`/pets/${petId}/medical`);
}

export function savePetMedicalRecord(petId, payload) {
    return postJson(`/pets/${petId}/medical`, payload);
}
