import { apiRequest, patchJson, postJson } from './apiClient';

export function fetchClinicalIntakes(params = {}, options = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
    });
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return apiRequest(`/clinical-intakes${suffix}`, options);
}

export function startClinicalIntake(payload, options = {}) {
    return postJson('/clinical-intakes', payload, options);
}

export function saveClinicalIntake(payload, options = {}) {
    return patchJson('/clinical-intakes', payload, options);
}
