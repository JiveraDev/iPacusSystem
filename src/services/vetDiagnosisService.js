import { apiRequest, postJson } from './apiClient';

export function fetchVetDiagnoses(params = {}) {
    const query = params instanceof URLSearchParams
        ? params.toString()
        : new URLSearchParams(params).toString();

    return apiRequest(`/vet-diagnoses${query ? `?${query}` : ''}`);
}

export function fetchVetDiagnosis(diagnosisId) {
    return apiRequest(`/vet-diagnoses/${diagnosisId}`);
}

export function createVetDiagnosis(payload) {
    return postJson('/vet-diagnoses', payload);
}
