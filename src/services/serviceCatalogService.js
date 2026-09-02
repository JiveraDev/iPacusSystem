import { apiRequest, deleteRequest, patchJson, postJson } from './apiClient';

export function fetchServiceCatalog({ includeInactive = false } = {}) {
    const query = includeInactive ? '?includeInactive=1' : '';
    return apiRequest(`/service-catalog${query}`);
}

export function saveServiceCatalogItem(serviceId, payload) {
    if (serviceId) {
        return patchJson(`/service-catalog/${serviceId}`, payload);
    }

    return postJson('/service-catalog', payload);
}

export function updateServiceCatalogMaterials(serviceId, payload) {
    return postJson(`/service-catalog/${serviceId}/materials`, payload);
}

export function deactivateServiceCatalogItem(serviceId) {
    return deleteRequest(`/service-catalog/${serviceId}`);
}

export function deleteServiceCatalogItem(serviceId) {
    return deleteRequest(`/service-catalog/${serviceId}?hardDelete=1`);
}

export function fetchServiceDisplaySettings() {
    return apiRequest('/service-display-settings');
}

export function saveServiceDisplaySettings(config) {
    return patchJson('/service-display-settings', { config });
}
