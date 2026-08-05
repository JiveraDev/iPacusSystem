import { apiRequest } from './apiClient';

export function fetchStatusDisplay({ branch, ...options } = {}) {
    const query = branch ? `?branch=${encodeURIComponent(branch)}` : '';
    return apiRequest(`/status-display${query}`, {
        timeoutMs: 12000,
        ...options
    });
}
