export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
export const SERVER_STATUS_EVENT = 'ipawcus:server-status-change';

const SERVER_UNAVAILABLE_MESSAGE = 'This site is temporarily unavailable due to maintenance. Please try again in a moment.';
const DEFAULT_GET_TIMEOUT_MS = 15000;
const DEFAULT_MUTATION_TIMEOUT_MS = 120000;

let serverStatus = {
    isDown: false,
    message: '',
    code: '',
    status: 0,
    checkedAt: ''
};

export class ApiError extends Error {
    constructor(message, details = {}) {
        super(message);
        this.name = 'ApiError';
        this.status = details.status || 0;
        this.data = details.data || {};
    }
}

function dispatchServerStatus() {
    if (typeof window === 'undefined') {
        return;
    }

    window.dispatchEvent(new CustomEvent(SERVER_STATUS_EVENT, {
        detail: getServerStatusSnapshot()
    }));
}

function updateServerStatus(nextStatus) {
    const nextSnapshot = {
        ...serverStatus,
        ...nextStatus,
        checkedAt: new Date().toISOString()
    };
    const hasChanged = serverStatus.isDown !== nextSnapshot.isDown
        || serverStatus.message !== nextSnapshot.message
        || serverStatus.code !== nextSnapshot.code
        || serverStatus.status !== nextSnapshot.status;

    serverStatus = nextSnapshot;

    if (hasChanged) {
        dispatchServerStatus();
    }
}

function getUnavailableDetails(error, details = {}) {
    const data = details.data || error?.data || {};
    const status = details.status || error?.status || 0;
    const code = data.code || details.code || (status === 0 ? 'server_unreachable' : 'server_unavailable');

    return {
        isDown: true,
        message: data.message || error?.message || SERVER_UNAVAILABLE_MESSAGE,
        code,
        status
    };
}

export function getServerStatusSnapshot() {
    return { ...serverStatus };
}

export function subscribeToServerStatus(listener) {
    if (typeof window === 'undefined') {
        return () => {};
    }

    const handleStatusChange = (event) => {
        listener(event.detail);
    };

    window.addEventListener(SERVER_STATUS_EVENT, handleStatusChange);
    return () => window.removeEventListener(SERVER_STATUS_EVENT, handleStatusChange);
}

export function reportServerUnavailable(error, details = {}) {
    updateServerStatus(getUnavailableDetails(error, details));
}

export function reportServerAvailable() {
    if (!serverStatus.isDown) {
        return;
    }

    updateServerStatus({
        isDown: false,
        message: '',
        code: '',
        status: 0
    });
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

export function getStoredApiUser() {
    if (typeof window === 'undefined') {
        return null;
    }

    try {
        return JSON.parse(window.localStorage.getItem('currentUser') || 'null');
    } catch {
        return null;
    }
}

export function getStoredAuthToken() {
    if (typeof window === 'undefined') {
        return '';
    }

    return window.localStorage.getItem('authToken') || '';
}

function applyCurrentUserHeaders(headers) {
    const token = getStoredAuthToken();
    const user = getStoredApiUser();
    const userId = user?.id || user?.user_id || user?.userId || '';
    const role = user?.role || user?.user_role || '';

    if (token && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
    }

    if (userId && !headers.has('X-User-Id')) {
        headers.set('X-User-Id', String(userId));
    }

    if (role && !headers.has('X-User-Role')) {
        headers.set('X-User-Role', String(role));
    }
}

export async function readJsonResponse(response, fallback = {}) {
    return response.json().catch(() => fallback);
}

export async function apiFetch(path, options = {}) {
    const {
        apiPrefix = false,
        headers,
        body,
        signal,
        timeoutMs,
        ...fetchOptions
    } = options;
    const requestHeaders = new Headers(headers || {});
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    const method = String(fetchOptions.method || 'GET').toUpperCase();
    const requestTimeoutMs = Number.isFinite(Number(timeoutMs))
        ? Number(timeoutMs)
        : (method === 'GET' ? DEFAULT_GET_TIMEOUT_MS : DEFAULT_MUTATION_TIMEOUT_MS);
    const timeoutController = requestTimeoutMs > 0 ? new AbortController() : null;
    let timeoutId = null;
    let signalAbortHandler = null;

    if (body !== undefined && !isFormData && !requestHeaders.has('Content-Type')) {
        requestHeaders.set('Content-Type', 'application/json');
    }

    applyCurrentUserHeaders(requestHeaders);

    if (timeoutController) {
        if (signal?.aborted) {
            timeoutController.abort(signal.reason);
        } else if (signal) {
            signalAbortHandler = () => timeoutController.abort(signal.reason);
            signal.addEventListener('abort', signalAbortHandler, { once: true });
        }

        timeoutId = window.setTimeout(() => {
            timeoutController.abort(new Error('Request timed out'));
        }, requestTimeoutMs);
    }

    try {
        const response = await fetch(getApiUrl(path, { apiPrefix }), {
            ...fetchOptions,
            body,
            headers: requestHeaders,
            signal: timeoutController ? timeoutController.signal : signal
        });

        if (response.status >= 500) {
            reportServerUnavailable(new ApiError(SERVER_UNAVAILABLE_MESSAGE, {
                status: response.status,
                data: { code: 'server_unavailable' }
            }), { status: response.status });
        } else {
            reportServerAvailable();
        }

        return response;
    } catch (error) {
        if (timeoutController?.signal.aborted && !signal?.aborted) {
            const timeoutError = new ApiError(SERVER_UNAVAILABLE_MESSAGE, {
                status: 0,
                data: { code: 'request_timeout' }
            });
            reportServerUnavailable(timeoutError);
            throw timeoutError;
        }

        if (!signal?.aborted) {
            const connectionError = error instanceof ApiError
                ? error
                : new ApiError(SERVER_UNAVAILABLE_MESSAGE, {
                    status: 0,
                    data: { code: 'server_unreachable' }
                });

            reportServerUnavailable(connectionError);
            throw connectionError;
        }

        throw error;
    } finally {
        if (timeoutId) {
            window.clearTimeout(timeoutId);
        }

        if (signal && signalAbortHandler) {
            signal.removeEventListener('abort', signalAbortHandler);
        }
    }
}

export async function apiRequest(path, options = {}) {
    const response = await apiFetch(path, options);
    const data = await readJsonResponse(response);

    if (!response.ok) {
        const error = new ApiError(data.message || data.error || `Request failed with status ${response.status}`, {
            status: response.status,
            data
        });

        if (response.status >= 500 || data.code === 'database_unavailable') {
            reportServerUnavailable(error, { status: response.status, data });
        }

        throw error;
    }

    reportServerAvailable();
    return data;
}

export async function checkServerHealth(options = {}) {
    try {
        const data = await apiRequest('/health', {
            timeoutMs: 10000,
            ...options
        });

        if (data?.ok === true) {
            return data;
        }

        const error = new ApiError(SERVER_UNAVAILABLE_MESSAGE, {
            status: 503,
            data: { code: 'server_unavailable' }
        });
        reportServerUnavailable(error);
        throw error;
    } catch (error) {
        const data = error?.data || {};
        const healthError = error instanceof ApiError
            ? new ApiError(data.code === 'database_unavailable' ? (data.message || SERVER_UNAVAILABLE_MESSAGE) : SERVER_UNAVAILABLE_MESSAGE, {
                status: error.status,
                data: { ...data, code: data.code || 'server_unavailable' }
            })
            : error;

        reportServerUnavailable(healthError);
        throw healthError;
    }
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
