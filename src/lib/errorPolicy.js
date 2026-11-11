import { getUserFacingErrorMessage } from './errorPresentation.js';

export function isCancelledRequest(error) {
    return error?.name === 'AbortError' || error?.data?.code === 'request_cancelled';
}

export function classifyError(error, { method = 'GET' } = {}) {
    const status = Number(error?.status || 0);
    const code = String(error?.data?.code || '');
    if (isCancelledRequest(error)) return { kind: 'cancelled', retryable: false, clearData: false };
    if (status === 401 || status === 403) return { kind: 'access', retryable: false, clearData: true };
    if (status === 404) return { kind: 'missing', retryable: false, clearData: true };
    if (status === 409) return { kind: 'conflict', retryable: false, clearData: false };
    if (status === 400 || status === 422) return { kind: 'validation', retryable: false, clearData: false };
    if (method.toUpperCase() !== 'GET' && (!status || code === 'mutation_result_unknown')) {
        return { kind: 'uncertain', retryable: false, clearData: false };
    }
    return { kind: status === 429 ? 'rate_limit' : 'unavailable', retryable: true, clearData: false };
}

export function sectionErrorMessage(error, fallback = 'This information could not be loaded. Please try again.') {
    return getUserFacingErrorMessage(error, fallback);
}

export function invalidResponse() {
    const error = new Error('The server returned unreadable information. Please try again.');
    error.data = { code: 'invalid_response' };
    return error;
}

export function requireArray(value) {
    if (!Array.isArray(value)) throw invalidResponse();
    return value;
}

export function requireObject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalidResponse();
    return value;
}
