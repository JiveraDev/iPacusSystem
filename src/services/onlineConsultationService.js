import { apiRequest, postJson } from './apiClient';

export function fetchOnlineConsultations(params = {}) {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/online-consultations${query ? `?${query}` : ''}`, { apiPrefix: true });
}

export function fetchOnlineConsultation(onlineConsultationId) {
    return apiRequest(`/online-consultations/${onlineConsultationId}`, { apiPrefix: true });
}

export function startOnlineConsultation(onlineConsultationId) {
    return postJson(`/online-consultations/${onlineConsultationId}/start`, {}, { apiPrefix: true });
}

export function joinOnlineConsultation(onlineConsultationId) {
    return postJson(`/online-consultations/${onlineConsultationId}/join`, {}, { apiPrefix: true });
}

export function endOnlineConsultation(onlineConsultationId) {
    return postJson(`/online-consultations/${onlineConsultationId}/end`, {}, { apiPrefix: true });
}

export function submitOnlineConsultationDiagnosis(onlineConsultationId, payload) {
    return postJson(`/online-consultations/${onlineConsultationId}/diagnosis`, payload, { apiPrefix: true });
}
