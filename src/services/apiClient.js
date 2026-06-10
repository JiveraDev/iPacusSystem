export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export class ApiError extends Error {
    constructor(message, details = {}) {
        super(message);
        this.name = 'ApiError';
        this.status = details.status || 0;
        this.data = details.data || {};
    }
}

export function getApiUrl(path, { apiPrefix = false } = {}) {
    if (/^(https?:|data:|blob:)/i.test(path)) {
        return path;
    }

    const normalizedBaseUrl = String(API_BASE_URL).replace(/\/+$/, '');
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;

    if (!normalizedBaseUrl) {
        return apiPrefix ? `/api${normalizedPath}` : normalizedPath;
    }

    if (apiPrefix && !normalizedBaseUrl.endsWith('/api')) {
        return `${normalizedBaseUrl}/api${normalizedPath}`;
    }

    return `${normalizedBaseUrl}${normalizedPath}`;
}

export async function readJsonResponse(response, fallback = {}) {
    return response.json().catch(() => fallback);
}

export async function apiRequest(path, options = {}) {
    const {
        apiPrefix = false,
        headers,
        body,
        ...fetchOptions
    } = options;
    const requestHeaders = new Headers(headers || {});
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

    if (body !== undefined && !isFormData && !requestHeaders.has('Content-Type')) {
        requestHeaders.set('Content-Type', 'application/json');
    }

    const response = await fetch(getApiUrl(path, { apiPrefix }), {
        ...fetchOptions,
        body,
        headers: requestHeaders
    });
    const data = await readJsonResponse(response);

    if (!response.ok) {
        throw new ApiError(data.message || data.error || `Request failed with status ${response.status}`, {
            status: response.status,
            data
        });
    }

    return data;
}

export function jsonRequest(path, payload, options = {}) {
    return apiRequest(path, {
        ...options,
        body: JSON.stringify(payload)
    });
}

export function postJson(path, payload, options = {}) {
    return jsonRequest(path, payload, {
        method: 'POST',
        ...options
    });
}

export function patchJson(path, payload, options = {}) {
    return jsonRequest(path, payload, {
        method: 'PATCH',
        ...options
    });
}

export function deleteRequest(path, options = {}) {
    return apiRequest(path, {
        method: 'DELETE',
        ...options
    });
}
