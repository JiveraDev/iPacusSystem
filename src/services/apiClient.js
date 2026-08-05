export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
export const SERVER_STATUS_EVENT = 'ipawcus:server-status-change';
export const AUTH_MESSAGE_KEY = 'ipawcus-auth-message';
export const AUTH_EMAIL_KEY = 'ipawcus-auth-email';
export const AUTH_EXPIRES_AT_KEY = 'ipawcus-auth-expires-at';

const DATABASE_UNAVAILABLE_MESSAGE = 'The iPawcus database is temporarily unavailable. The clinic may be performing maintenance. Please try again in a moment.';
const OFFLINE_MESSAGE = 'Your device appears to be offline. Check your internet connection, then try again.';
const REQUEST_TIMEOUT_MESSAGE = 'iPawcus took too long to respond. Check your connection and try again.';
const SERVER_UNREACHABLE_MESSAGE = 'We could not reach the iPawcus server. Check your connection or try again shortly.';
const SERVER_UNAVAILABLE_MESSAGE = 'iPawcus is temporarily unavailable. Please try again in a moment.';
const DEFAULT_GET_TIMEOUT_MS = 15000;
const DEFAULT_MUTATION_TIMEOUT_MS = 120000;
const DEFAULT_GET_RETRY_COUNT = 1;
const GET_RETRY_DELAY_MS = 600;
const AUTH_REQUIRED_CODE = 'api_auth_required';
const AUTH_EXPIRED_MESSAGE = 'Please log in again to continue.';
const LOGIN_ROUTE = '/landing/login';
const inFlightGetRequests = new Map();

let serverStatus = {
    isDown: false,
    kind: '',
    message: '',
    code: '',
    status: 0,
    requestPath: '',
    requestMethod: '',
    checkedAt: ''
};
let isRedirectingToLogin = false;

export class ApiError extends Error {
    constructor(message, details = {}) {
        super(message);
        this.name = 'ApiError';
        this.status = details.status || 0;
        this.data = details.data || {};
    }
}

function sanitizeDiagnosticPath(path = '') {
    let pathname = String(path || '').split(/[?#]/, 1)[0];

    try {
        if (/^https?:\/\//i.test(pathname)) {
            pathname = new URL(pathname).pathname;
        }
    } catch {
        pathname = '';
    }

    const sanitizedSegments = pathname
        .split('/')
        .map((segment) => {
            if (/^\d+$/.test(segment)
                || /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(segment)
                || segment.length > 48) {
                return ':id';
            }

            return segment;
        });

    return sanitizedSegments.join('/').slice(0, 240);
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
        || serverStatus.kind !== nextSnapshot.kind
        || serverStatus.message !== nextSnapshot.message
        || serverStatus.code !== nextSnapshot.code
        || serverStatus.status !== nextSnapshot.status
        || serverStatus.requestPath !== nextSnapshot.requestPath
        || serverStatus.requestMethod !== nextSnapshot.requestMethod;

    serverStatus = nextSnapshot;

    if (hasChanged) {
        dispatchServerStatus();
    }
}

function browserIsOffline() {
    return typeof navigator !== 'undefined' && navigator.onLine === false;
}

function unavailablePresentation(code, status, incomingMessage = '') {
    if (browserIsOffline() || code === 'client_offline') {
        return {
            kind: 'offline',
            code: 'client_offline',
            message: OFFLINE_MESSAGE
        };
    }

    if (code === 'database_unavailable') {
        return {
            kind: 'maintenance',
            code,
            message: incomingMessage || DATABASE_UNAVAILABLE_MESSAGE
        };
    }

    if (code === 'request_timeout') {
        return {
            kind: 'timeout',
            code,
            message: REQUEST_TIMEOUT_MESSAGE
        };
    }

    if (code === 'server_unreachable' || status === 0) {
        return {
            kind: 'connection',
            code: code || 'server_unreachable',
            message: SERVER_UNREACHABLE_MESSAGE
        };
    }

    return {
        kind: 'service',
        code: code || 'server_unavailable',
        message: SERVER_UNAVAILABLE_MESSAGE
    };
}

function getUnavailableDetails(error, details = {}) {
    const data = details.data || error?.data || {};
    const status = details.status || error?.status || 0;
    const code = data.code || details.code || (status === 0 ? 'server_unreachable' : 'server_unavailable');
    const presentation = unavailablePresentation(code, status, data.message || error?.message || '');
    const incomingPath = sanitizeDiagnosticPath(details.requestPath);
    const preserveOriginalPath = serverStatus.isDown
        && incomingPath === '/health'
        && serverStatus.requestPath
        && serverStatus.requestPath !== '/health';
    const requestPath = preserveOriginalPath
        ? serverStatus.requestPath
        : (incomingPath || serverStatus.requestPath);
    const requestMethod = String(
        preserveOriginalPath
            ? serverStatus.requestMethod
            : (details.requestMethod || serverStatus.requestMethod || '')
    ).toUpperCase().slice(0, 12);

    return {
        isDown: true,
        ...presentation,
        status,
        requestPath,
        requestMethod
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
    const code = details?.data?.code || details?.code || error?.data?.code || '';

    // A single slow request is transient and must not replace the whole app
    // with the server-unavailable screen. GET requests retry below and
    // GET-backed screens continue their normal quiet refresh cycle.
    if (code === 'request_timeout') {
        return;
    }

    updateServerStatus(getUnavailableDetails(error, details));
}

export function reportServerAvailable() {
    if (!serverStatus.isDown) {
        return;
    }

    updateServerStatus({
        isDown: false,
        kind: '',
        message: '',
        code: '',
        status: 0,
        requestPath: '',
        requestMethod: ''
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

export function clearStoredAuthSession() {
    if (typeof window === 'undefined') {
        return;
    }

    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration('/').then((registration) => {
            const worker = registration?.active
                || registration?.waiting
                || registration?.installing
                || navigator.serviceWorker.controller;

            worker?.postMessage({ type: 'IPAWCUS_PUSH_CONTEXT_CLEAR' });
        }).catch(() => {});
    }

    window.localStorage.removeItem('authToken');
    window.localStorage.removeItem(AUTH_EXPIRES_AT_KEY);
    window.localStorage.removeItem('currentUser');
}

export function isStoredAuthTokenExpired() {
    if (typeof window === 'undefined' || !getStoredAuthToken()) {
        return false;
    }

    const expiresAt = window.localStorage.getItem(AUTH_EXPIRES_AT_KEY);
    if (!expiresAt) {
        return false;
    }

    const expiresAtMs = Date.parse(expiresAt);
    return !Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now();
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

function getUserEmail(user) {
    return String(user?.email || user?.mail_Address || '').trim();
}

function isPublicRequestPath(path) {
    const normalizedPath = `/${String(path || '').split('?')[0].replace(/^\/+/, '')}`;

    return [
        '/login',
        '/register',
        '/users',
        '/health',
        '/self-service/access',
        '/status-display',
        '/tv-status',
        '/notifications/reminders/run'
    ].includes(normalizedPath) || normalizedPath.startsWith('/auth/');
}

export function expireStoredAuthSession(message = AUTH_EXPIRED_MESSAGE, options = {}) {
    if (typeof window === 'undefined') {
        return;
    }

    const loginEmail = getUserEmail(getStoredApiUser());
    clearStoredAuthSession();

    if (loginEmail) {
        window.sessionStorage.setItem(AUTH_EMAIL_KEY, loginEmail);
    }

    window.sessionStorage.setItem(AUTH_MESSAGE_KEY, message || AUTH_EXPIRED_MESSAGE);

    if (options.redirect === false) {
        return;
    }

    if (isRedirectingToLogin) {
        return;
    }

    isRedirectingToLogin = true;

    if (window.location.pathname !== LOGIN_ROUTE) {
        window.location.assign(LOGIN_ROUTE);
    }
}

function enforceStoredAuthExpiration(path) {
    if (isPublicRequestPath(path) || !isStoredAuthTokenExpired()) {
        return;
    }

    expireStoredAuthSession(AUTH_EXPIRED_MESSAGE);
    throw new ApiError(AUTH_EXPIRED_MESSAGE, {
        status: 401,
        data: { code: AUTH_REQUIRED_CODE }
    });
}

function handleAuthRequired(data = {}) {
    if (data.code !== AUTH_REQUIRED_CODE) {
        return;
    }

    expireStoredAuthSession(data.message || AUTH_EXPIRED_MESSAGE);
}

export async function readJsonResponse(response, fallback = {}) {
    return response.json().catch(() => fallback);
}

function getApiRequestMethod(options = {}) {
    return String(options.method || 'GET').toUpperCase();
}

function canDedupeApiRequest(options = {}) {
    return getApiRequestMethod(options) === 'GET'
        && options.body === undefined
        && !options.signal
        && options.dedupe !== false;
}

function getDedupeHeadersKey(headers) {
    const requestHeaders = new Headers(headers || {});

    return Array.from(requestHeaders.entries())
        .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
        .map(([key, value]) => `${key}:${value}`)
        .join('&');
}

function getDedupeRequestKey(path, options = {}) {
    const user = getStoredApiUser();
    const userId = user?.id || user?.user_id || user?.userId || '';
    const role = user?.role || user?.user_role || '';
    const apiScope = options.apiPrefix ? 'api' : 'direct';

    return [
        apiScope,
        getApiRequestMethod(options),
        String(path),
        getStoredAuthToken(),
        userId,
        role,
        getDedupeHeadersKey(options.headers)
    ].join('|');
}

export async function apiFetch(path, options = {}) {
    const {
        apiPrefix = false,
        headers,
        body,
        signal,
        timeoutMs,
        suppressServerUnavailable = false,
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

    enforceStoredAuthExpiration(path);
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
            const errorData = await readJsonResponse(response.clone(), {});

            if (errorData.code === 'database_unavailable') {
                reportServerUnavailable(new ApiError(errorData.message || DATABASE_UNAVAILABLE_MESSAGE, {
                    status: response.status,
                    data: errorData
                }), {
                    status: response.status,
                    data: errorData,
                    requestPath: path,
                    requestMethod: method
                });
            } else if (!suppressServerUnavailable && path === '/health') {
                reportServerUnavailable(new ApiError(SERVER_UNAVAILABLE_MESSAGE, {
                    status: response.status,
                    data: { ...errorData, code: errorData.code || 'server_unavailable' }
                }), {
                    status: response.status,
                    data: { ...errorData, code: errorData.code || 'server_unavailable' },
                    requestPath: path,
                    requestMethod: method
                });
            }
        } else {
            reportServerAvailable();
        }

        if (response.status === 401) {
            const authData = await readJsonResponse(response.clone(), {});
            handleAuthRequired(authData);
        }

        return response;
    } catch (error) {
        if (timeoutController?.signal.aborted && !signal?.aborted) {
            const timeoutError = new ApiError(REQUEST_TIMEOUT_MESSAGE, {
                status: 0,
                data: { code: 'request_timeout' }
            });
            if (!suppressServerUnavailable) {
                reportServerUnavailable(timeoutError, { requestPath: path, requestMethod: method });
            }
            throw timeoutError;
        }

        if (!signal?.aborted) {
            const connectionError = error instanceof ApiError
                ? error
                : new ApiError(browserIsOffline() ? OFFLINE_MESSAGE : SERVER_UNREACHABLE_MESSAGE, {
                    status: 0,
                    data: { code: browserIsOffline() ? 'client_offline' : 'server_unreachable' }
                });

            if (!suppressServerUnavailable) {
                reportServerUnavailable(connectionError, { requestPath: path, requestMethod: method });
            }
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

function waitForTransientRetry(attempt) {
    return new Promise((resolve) => {
        window.setTimeout(resolve, GET_RETRY_DELAY_MS * Math.max(1, attempt));
    });
}

function isTransientConnectionError(error) {
    const code = String(error?.data?.code || '');

    return code === 'request_timeout' || code === 'server_unreachable';
}

async function performApiRequest(path, options = {}) {
    const {
        transientRetryCount,
        ...requestOptions
    } = options;
    const method = getApiRequestMethod(requestOptions);
    const retryCount = method === 'GET'
        ? (Number.isFinite(Number(transientRetryCount))
            ? Math.max(0, Number(transientRetryCount))
            : DEFAULT_GET_RETRY_COUNT)
        : 0;
    let attempt = 0;

    while (true) {
        try {
            const response = await apiFetch(path, {
                ...requestOptions,
                suppressServerUnavailable: Boolean(requestOptions.suppressServerUnavailable) || attempt < retryCount
            });
            const data = await readJsonResponse(response);

            if (!response.ok) {
                const error = new ApiError(data.message || data.error || `Request failed with status ${response.status}`, {
                    status: response.status,
                    data
                });

                if (data.code === 'database_unavailable') {
                    reportServerUnavailable(error, {
                        status: response.status,
                        data,
                        requestPath: path,
                        requestMethod: method
                    });
                }

                handleAuthRequired(data);

                throw error;
            }

            reportServerAvailable();
            return data;
        } catch (error) {
            const canRetry = attempt < retryCount
                && !requestOptions.signal?.aborted
                && isTransientConnectionError(error);

            if (!canRetry) {
                throw error;
            }

            attempt += 1;
            await waitForTransientRetry(attempt);
        }
    }
}

export async function apiRequest(path, options = {}) {
    if (!canDedupeApiRequest(options)) {
        return performApiRequest(path, options);
    }

    const dedupeKey = getDedupeRequestKey(path, options);
    const existingRequest = inFlightGetRequests.get(dedupeKey);

    if (existingRequest) {
        return existingRequest;
    }

    const request = performApiRequest(path, options);
    inFlightGetRequests.set(dedupeKey, request);

    try {
        return await request;
    } finally {
        inFlightGetRequests.delete(dedupeKey);
    }
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
        reportServerUnavailable(error, { requestPath: '/health', requestMethod: 'GET' });
        throw error;
    } catch (error) {
        const data = error?.data || {};
        const healthError = error instanceof ApiError
            ? new ApiError(data.code === 'database_unavailable' ? (data.message || DATABASE_UNAVAILABLE_MESSAGE) : (error.message || SERVER_UNAVAILABLE_MESSAGE), {
                status: error.status,
                data: { ...data, code: data.code || 'server_unavailable' }
            })
            : error;

        reportServerUnavailable(healthError, { requestPath: '/health', requestMethod: 'GET' });
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
