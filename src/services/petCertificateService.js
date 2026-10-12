import { apiRequest } from './apiClient';

export function fetchPetCertificates(petId, options = {}) {
    const refreshToken = Date.now();

    return apiRequest(`/pets/${encodeURIComponent(petId)}/certificates?refresh=${refreshToken}`, {
        cache: 'no-store',
        ...options
    });
}

export function issuePetMedicalCertificate(petId, payload) {
    return apiRequest(`/pets/${encodeURIComponent(petId)}/certificates`, {
        method: 'POST',
        body: JSON.stringify({
            action: 'issue',
            ...payload
        })
    });
}

export function markPetMedicalCertificateViewed(petId, certificateId) {
    return apiRequest(`/pets/${encodeURIComponent(petId)}/certificates`, {
        method: 'POST',
        body: JSON.stringify({
            action: 'mark_viewed',
            certificateId
        })
    });
}
