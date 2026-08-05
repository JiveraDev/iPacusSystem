import { apiRequest, deleteRequest, patchJson, postJson } from './apiClient';

export function fetchRoomAvailability(params) {
    const query = params instanceof URLSearchParams
        ? params.toString()
        : new URLSearchParams(params).toString();

    return apiRequest(`/rooms/availability?${query}`);
}

function withQuery(path, params = {}) {
    const query = new URLSearchParams(params).toString();
    return `${path}${query ? `?${query}` : ''}`;
}

export function fetchBoardingRooms(params = {}) {
    return apiRequest(withQuery('/boarding/rooms', params));
}

export function fetchBoardingMonitoring(params = {}) {
    return apiRequest(withQuery('/boarding/monitoring', params));
}

export function createBoardingRooms(payload) {
    return postJson('/boarding/rooms', payload);
}

export function updateBoardingRoom(payload) {
    return patchJson('/boarding/rooms', payload);
}

export function assignBoardingRoom(bookingId, payload) {
    return postJson(`/boarding/bookings/${bookingId}/assign-room`, payload);
}

export function directBoardingCheckIn(payload) {
    return postJson('/boarding/direct-check-in', payload);
}

export function checkInBoardingBooking(bookingId, payload = {}) {
    return postJson(`/boarding/bookings/${bookingId}/check-in`, payload);
}

export function checkOutBoardingBooking(bookingId, payload = {}) {
    return postJson(`/boarding/bookings/${bookingId}/check-out`, payload);
}

export function updateDesiredCheckOut(bookingId, payload) {
    return patchJson(`/boarding/bookings/${bookingId}/desired-check-out`, payload);
}

export function createBoardingObservation(payload) {
    return postJson('/boarding/observations', payload);
}

export function createBoardingTask(payload) {
    return postJson('/boarding/tasks', payload);
}

export function completeBoardingTask(taskId, payload = {}) {
    return patchJson(`/boarding/tasks/${taskId}/complete`, payload);
}

export function fetchBoardingDocuments(params = {}) {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/boarding/documents${query ? `?${query}` : ''}`);
}

export function createBoardingDocument(payload) {
    return postJson('/boarding/documents', payload);
}

export function fetchBoardingMaterials(params = {}) {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/boarding/materials${query ? `?${query}` : ''}`);
}

export function createBoardingMaterial(payload) {
    return postJson('/boarding/materials', payload);
}

export function removeBoardingMaterial(usageId) {
    return deleteRequest(`/boarding/materials/${usageId}`);
}
