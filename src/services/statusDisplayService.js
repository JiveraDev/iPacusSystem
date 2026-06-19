import { apiRequest } from './apiClient';

export function fetchStatusDisplay(options = {}) {
    return apiRequest('/status-display', {
        timeoutMs: 12000,
        ...options
    });
}
