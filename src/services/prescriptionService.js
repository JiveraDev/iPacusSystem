import { apiRequest, patchJson, postJson } from './apiClient';

export function fetchPrescriptions(params = {}, options = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            query.set(key, String(value));
        }
    });
    const suffix = query.toString();
    return apiRequest(`/prescriptions${suffix ? `?${suffix}` : ''}`, options);
}

export function startPrescriptionPlan(planId, payload, options = {}) {
    return postJson(`/prescriptions/${planId}/start`, payload, options);
}

export function createPrescriptionPlan(petId, payload, options = {}) {
    return postJson(`/pets/${petId}/prescriptions`, payload, options);
}

export function completePrescriptionItem(itemId, options = {}) {
    return postJson(`/prescription-items/${itemId}/complete`, {}, options);
}

export function updatePrescriptionOccurrence(occurrenceId, payload, options = {}) {
    return patchJson(`/prescription-occurrences/${occurrenceId}`, payload, options);
}
