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

export function fetchPetMedicalRecords(petId, options = {}) {
    const ownerQuery = options.ownerOnly ? '?owner=1' : '';
    return apiRequest(`/pets/${petId}/medical${ownerQuery}`);
}

export function emailPetMedicalRecords(petId) {
    return postJson(`/pets/${petId}/medical`, { action: 'email_copy' });
}

export function savePetMedicalRecord(petId, payload) {
    return postJson(`/pets/${petId}/medical`, payload);
}

export function createPetMedicalRecordGroup(petId, payload) {
    return postJson(`/pets/${petId}/medical`, { ...payload, action: 'create_group' });
}

export function updatePetMedicalRecordGroup(petId, payload) {
    return postJson(`/pets/${petId}/medical`, { ...payload, action: 'update_group' });
}

export function deletePetMedicalRecordGroup(petId, groupId, payload = {}) {
    return postJson(`/pets/${petId}/medical`, { ...payload, groupId, action: 'delete_group' });
}

export function addPetMedicalRecordGroupItem(petId, payload) {
    return postJson(`/pets/${petId}/medical`, { ...payload, action: 'add_item' });
}

export function updatePetMedicalRecordGroupItem(petId, payload) {
    return postJson(`/pets/${petId}/medical`, { ...payload, action: 'update_item' });
}

export function removePetMedicalRecordGroupItem(petId, itemId, payload = {}) {
    return postJson(`/pets/${petId}/medical`, { ...payload, itemId, action: 'remove_item' });
}
