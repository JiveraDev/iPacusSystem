import { getApiUrl } from './apiClient.js';

const REPORT_TIMEOUT_MS = 30000;
const SUPPORT_EMAIL = 'support@vetfocuscare.com';

function sanitizePath(path = '') {
    return String(path || '')
        .split(/[?#]/, 1)[0]
        .split('/')
        .map((segment) => {
            if (/^\d+$/.test(segment)
                || /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(segment)
                || segment.length > 48) {
                return ':id';
            }

            return segment;
        })
        .join('/')
        .slice(0, 240);
}

function createReportId() {
    const timestamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
    const randomPart = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID().replace(/-/g, '').slice(0, 10)
        : Math.random().toString(36).slice(2, 12);

    return `IPW-${timestamp}-${randomPart.toUpperCase()}`;
}

function createPayload(serverStatus = {}) {
    const reportId = createReportId();

    return {
        reportId,
        failure: {
            code: String(serverStatus.code || 'server_unavailable').slice(0, 64),
            status: Number.isFinite(Number(serverStatus.status)) ? Number(serverStatus.status) : 0,
            apiPath: sanitizePath(serverStatus.requestPath || '/health'),
            method: String(serverStatus.requestMethod || 'GET').toUpperCase().slice(0, 12),
            detectedAt: String(serverStatus.checkedAt || '').slice(0, 40),
        },
        client: {
            reportedAt: new Date().toISOString(),
            siteHost: window.location.hostname.slice(0, 160),
            pagePath: sanitizePath(window.location.pathname),
            userAgent: navigator.userAgent.slice(0, 500),
            language: String(navigator.language || '').slice(0, 24),
            timeZone: String(Intl.DateTimeFormat().resolvedOptions().timeZone || '').slice(0, 64),
            online: navigator.onLine,
            viewportWidth: Math.max(0, Math.round(window.innerWidth || 0)),
            viewportHeight: Math.max(0, Math.round(window.innerHeight || 0)),
        },
    };
}

function createFallbackEmailUrl(payload) {
    const subject = `[iPawcus] Problem report ${payload.reportId}`;
    const body = [
        'An iPawcus maintenance failure occurred.',
        '',
        `Report ID: ${payload.reportId}`,
        `Failure code: ${payload.failure.code}`,
        `HTTP status: ${payload.failure.status || 'No response'}`,
        `API route: ${payload.failure.method} ${payload.failure.apiPath}`,
        `Page: ${payload.client.pagePath}`,
        `Detected at: ${payload.failure.detectedAt || payload.client.reportedAt}`,
        '',
        'No account, patient, credential, or medical information is included in this report.',
    ].join('\n');

    return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export async function sendMaintenanceProblemReport(serverStatus = {}) {
    const payload = createPayload(serverStatus);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), REPORT_TIMEOUT_MS);

    try {
        const response = await fetch(getApiUrl('/system/problem-report'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok || data.success !== true) {
            throw new Error(data.message || 'The automatic problem report could not be sent.');
        }

        return {
            reportId: String(data.reportId || payload.reportId),
            fallbackEmailUrl: createFallbackEmailUrl(payload),
        };
    } catch (error) {
        const reportError = new Error(
            error?.name === 'AbortError'
                ? 'The problem report request timed out.'
                : (error?.message || 'The automatic problem report could not be sent.')
        );
        reportError.reportId = payload.reportId;
        reportError.fallbackEmailUrl = createFallbackEmailUrl(payload);
        throw reportError;
    } finally {
        window.clearTimeout(timeoutId);
    }
}
