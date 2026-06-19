import { postJson } from './apiClient';

export function saveConsentFormRecord(payload, options = {}) {
    return postJson('/consent-form-records', payload, options);
}
