import { apiRequest, deleteRequest, patchJson } from './apiClient';

export function fetchConsentFiles() {
    return apiRequest('/consent_files');
}

export function createConsentFile(formData) {
    return apiRequest('/consent_files', {
        method: 'POST',
        body: formData
    });
}

export function updateConsentFile(fileId, payload) {
    return patchJson(`/consent_files/${fileId}`, payload);
}

export function deleteConsentFile(fileId) {
    return deleteRequest(`/consent_files/${fileId}`);
}
