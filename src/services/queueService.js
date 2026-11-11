import { apiRequest, getStoredApiUser, postJson } from './apiClient';
import { assertPetOwnerActionAllowed } from '../lib/accountStatus.js';
import { requireArray } from '../lib/errorPolicy.js';

export function fetchQueues(options = {}) {
    return apiRequest('/queues', options).then(requireArray);
}

export function fetchQueuePets() {
    return apiRequest('/queues/pets');
}

export function addQueueItem(payload, options = {}) {
    assertPetOwnerActionAllowed(getStoredApiUser(), 'join the self-service queue');
    return postJson('/queues', payload, options);
}

export function updateQueueStatus(payload, options = {}) {
    return postJson('/queues/status', payload, options);
}

export function assignQueueToVeterinarian(payload) {
    return postJson('/queues/assign', payload);
}

export function receiveQueue(payload) {
    return postJson('/queues/receive', payload);
}

export function returnQueue(payload) {
    return postJson('/queues/return', payload);
}

export function reenterQueue(payload) {
    return postJson('/queues/reenter', payload);
}
