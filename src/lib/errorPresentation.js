export const DEFAULT_ERROR_MESSAGE = 'We could not complete your request. Please try again.';

const HTTP_STATUS_MESSAGES = {
    400: 'Some information is missing or invalid. Review it and try again.',
    401: 'Your session has expired. Log in again to continue.',
    403: 'You do not have permission to do that. Ask an administrator if you need access.',
    404: 'We could not find that record. It may have been removed or changed.',
    405: 'This action is not available right now. Refresh the page and try again.',
    408: 'The request took too long. Check your connection and try again.',
    409: 'This record was changed elsewhere or is already in use. Refresh and try again.',
    413: 'The selected file is too large. Choose a smaller file and try again.',
    415: 'This file type is not supported. Choose one of the allowed file types.',
    422: 'Some information needs your attention. Review the form and try again.',
    429: 'Too many attempts were made. Wait a moment, then try again.',
    500: 'The server could not complete this request. Please try again shortly.',
    502: 'The service is temporarily unavailable. Please try again shortly.',
    503: 'The service is temporarily unavailable. Please try again shortly.',
    504: 'The server took too long to respond. Please try again shortly.',
};

const GENERIC_MESSAGE_REPLACEMENTS = new Map([
    ['an error occurred', DEFAULT_ERROR_MESSAGE],
    ['authentication required', HTTP_STATUS_MESSAGES[401]],
    ['bad request', HTTP_STATUS_MESSAGES[400]],
    ['conflict', HTTP_STATUS_MESSAGES[409]],
    ['error deleting form', 'The form could not be deleted. Please try again.'],
    ['error saving changes', 'Your changes could not be saved. Review them and try again.'],
    ['error updating pet status', 'The pet status could not be updated. Please try again.'],
    ['forbidden', HTTP_STATUS_MESSAGES[403]],
    ['internal server error', HTTP_STATUS_MESSAGES[500]],
    ['payload too large', HTTP_STATUS_MESSAGES[413]],
    ['request timeout', HTTP_STATUS_MESSAGES[408]],
    ['not found', HTTP_STATUS_MESSAGES[404]],
    ['request aborted', 'The request was cancelled. You can try again when you are ready.'],
    ['request cancelled', 'The request was cancelled. You can try again when you are ready.'],
    ['service unavailable', HTTP_STATUS_MESSAGES[503]],
    ['session expired', HTTP_STATUS_MESSAGES[401]],
    ['too many requests', HTTP_STATUS_MESSAGES[429]],
    ['unauthorized', HTTP_STATUS_MESSAGES[401]],
    ['unsupported media type', HTTP_STATUS_MESSAGES[415]],
    ['update failed', 'The changes could not be saved. Review them and try again.'],
    ['upload failed', 'The file could not be uploaded. Check the file and try again.'],
    ['validation failed', HTTP_STATUS_MESSAGES[422]],
]);

const KNOWN_TECHNICAL_PRESENTATIONS = [
    {
        pattern: /\b(?:NetworkError|Failed to fetch|ERR_NETWORK|ECONN(?:REFUSED|RESET)|Load failed)\b/i,
        message: 'We could not reach the server. Check your connection and try again.',
    },
    {
        pattern: /\b(?:request timed out|timeout|timed out)\b/i,
        message: HTTP_STATUS_MESSAGES[408],
    },
    {
        pattern: /\b(?:Unexpected token\b[^\n]*\bJSON|JSON\.parse)\b/i,
        message: 'The server returned an unreadable response. Refresh the page and try again.',
    },
];

const TECHNICAL_MESSAGE_PATTERNS = [
    /\bSQLSTATE(?:\[[^\]]+\])?/i,
    /\b(?:PDOException|mysqli_sql_exception|mysqli|PDO)\b/i,
    /\bbase table or view not found\b/i,
    /\btable\s+['"`]?.+?['"`]?\s+(?:does not exist|doesn't exist|not found|is missing)\b/i,
    /\bunknown column\b/i,
    /\b(?:column count doesn't match|data truncated for column)\b/i,
    /\b(?:integrity|foreign key|unique|check) constraint(?: violation| failed)?\b/i,
    /\bduplicate entry\b/i,
    /\b(?:server has gone away|deadlock found|lock wait timeout|access denied for user|connection refused)\b/i,
    /\b(?:syntax error|access violation)\b/i,
    /\b(?:stack trace|uncaught (?:exception|error)|fatal error|parse error)\b/i,
    /\b(?:undefined variable|undefined array key|undefined index|call to undefined|call to a member function|cannot redeclare|trying to access|failed to open stream|headers already sent|no such file or directory)\b/i,
    /\b(?:too few arguments|expects (?:parameter|exactly)|must be of type)\b/i,
    /\b(?:TypeError|ReferenceError|RangeError):/i,
    /\brequest failed(?: with status(?: code)?)?\s*[:(]?\s*\d{3}\b/i,
    /\bHTTP(?: error| status)?\s*[:(]?\s*\d{3}\b/i,
    /\b(?:Unexpected token\b[^\n]*\bJSON|JSON\.parse)\b/i,
    /\b(?:NetworkError|Failed to fetch|ERR_NETWORK|ECONN(?:REFUSED|RESET)|Load failed)\b/i,
    /(?:^|\s)#\d+\s+(?:\{|[A-Za-z_\\])/i,
    /\b(?:SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM|ALTER\s+TABLE|CREATE\s+TABLE|DROP\s+TABLE)\b/i,
    /\b(?:required_?sql|sql query|database query)\b/i,
    /\b(?:schema|database)\b.{0,80}\b(?:migration|required|not ready|missing|out of date)\b/i,
    /\bdatabase\b.{0,80}\b(?:column|table)s?\b/i,
    /\bmigration\b.{0,80}\b(?:required|pending|not installed|must be run|waiting)\b/i,
    /\b(?:migration|DDL)\b.{0,120}\.sql\b/i,
    /(?:[A-Za-z]:\\|\/(?:var|home|srv|opt|usr)\/)[^\n]+\.(?:php|js|jsx|ts|tsx)(?::\d+)?/i,
    /<\s*(?:!doctype|html|body|br|b|pre)\b/i,
];

const PRIVATE_ERROR_KEYS = /^(?:debug|exception|trace|stack|stacktrace|sql|query|required_?sql|required_?status_?sql|missing_?(?:columns?|tables?)|table|column|database|migration)$/i;

function extractMessage(value) {
    if (typeof value === 'string') {
        return value.trim();
    }

    if (value instanceof Error) {
        return String(value.message || '').trim();
    }

    if (value && typeof value === 'object') {
        const candidates = [
            value.userMessage,
            value.message,
            value.error,
            value.detail,
            value.errors,
        ];

        for (const candidate of candidates) {
            if (typeof candidate === 'string' && candidate.trim()) {
                return candidate.trim();
            }

            if (Array.isArray(candidate)) {
                const nestedMessage = candidate.map(extractMessage).find(Boolean);
                if (nestedMessage) {
                    return nestedMessage;
                }
            }

            if (candidate && typeof candidate === 'object') {
                const nestedMessage = Object.values(candidate).map(extractMessage).find(Boolean);
                if (nestedMessage) {
                    return nestedMessage;
                }
            }
        }
    }

    return '';
}

function extractStatus(value, options = {}) {
    const status = Number(options.status ?? value?.status ?? value?.response?.status);
    if (Number.isInteger(status) && status >= 400 && status <= 599) {
        return status;
    }

    const messageStatus = extractMessage(value).match(/\b(?:HTTP(?: error| status)?|status(?: code)?)\s*[:(]?\s*(\d{3})\b/i);
    const inferredStatus = Number(messageStatus?.[1]);
    return Number.isInteger(inferredStatus) && inferredStatus >= 400 && inferredStatus <= 599
        ? inferredStatus
        : 0;
}

function statusMessage(status) {
    if (HTTP_STATUS_MESSAGES[status]) {
        return HTTP_STATUS_MESSAGES[status];
    }

    if (status >= 500) {
        return HTTP_STATUS_MESSAGES[500];
    }

    return '';
}

function normalizeMessageKey(message) {
    return String(message || '')
        .trim()
        .replace(/[.!:]+$/, '')
        .toLowerCase();
}

function rewriteGenericFailure(message) {
    const exactReplacement = GENERIC_MESSAGE_REPLACEMENTS.get(normalizeMessageKey(message));
    if (exactReplacement) {
        return exactReplacement;
    }

    const normalizedMessage = String(message || '')
        .trim()
        .replace(/\s*[.!]?\s*please try again[.!]?$/i, '')
        .replace(/[.!]+$/, '');
    const failedToMatch = normalizedMessage.match(/^failed to\s+(.+)$/i);
    if (failedToMatch) {
        const action = failedToMatch[1];
        const recovery = /^load\b/i.test(action)
            ? 'Refresh the page or try again.'
            : 'Please try again.';
        return `We could not ${action}. ${recovery}`;
    }

    const couldNotMatch = normalizedMessage.match(/^could not\s+(.+)$/i);
    if (couldNotMatch) {
        const action = couldNotMatch[1];
        const recovery = /^load\b/i.test(action)
            ? ' Refresh the page or try again.'
            : ' Please try again.';
        return `We could not ${action}.${recovery}`;
    }

    return String(message || '').trim();
}

export function isTechnicalErrorMessage(value) {
    const message = extractMessage(value);
    return Boolean(message) && TECHNICAL_MESSAGE_PATTERNS.some((pattern) => pattern.test(message));
}

export function logHiddenTechnicalError(context, error) {
    console.error(`[iPawcus] ${context}`, error);
}

export function getUserFacingErrorMessage(
    error,
    fallback = DEFAULT_ERROR_MESSAGE,
    options = {}
) {
    if (error?.name === 'AbortError') {
        return GENERIC_MESSAGE_REPLACEMENTS.get('request cancelled');
    }

    const message = extractMessage(error);
    const status = extractStatus(error, options);
    const fallbackMessage = extractMessage(fallback);
    const safeFallback = fallbackMessage && !isTechnicalErrorMessage(fallbackMessage)
        ? rewriteGenericFailure(fallbackMessage)
        : (statusMessage(status) || DEFAULT_ERROR_MESSAGE);

    if (!message) {
        return statusMessage(status) || safeFallback;
    }

    const genericReplacement = GENERIC_MESSAGE_REPLACEMENTS.get(normalizeMessageKey(message));
    if (genericReplacement) {
        return genericReplacement;
    }

    const knownTechnicalPresentation = KNOWN_TECHNICAL_PRESENTATIONS.find(({ pattern }) => pattern.test(message));
    if (knownTechnicalPresentation) {
        if (options.log !== false) {
            logHiddenTechnicalError(
                options.context || 'Technical error hidden from the user interface.',
                error
            );
        }
        return knownTechnicalPresentation.message;
    }

    if (!isTechnicalErrorMessage(message)) {
        return rewriteGenericFailure(message);
    }

    if (options.log !== false) {
        logHiddenTechnicalError(
            options.context || 'Technical error hidden from the user interface.',
            error
        );
    }

    return statusMessage(status) || safeFallback;
}

export function getHttpErrorMessage(status, fallback = DEFAULT_ERROR_MESSAGE) {
    return statusMessage(Number(status)) || getUserFacingErrorMessage('', fallback);
}

function sanitizePayloadValue(value, fallback, seen) {
    if (typeof value === 'string') {
        return getUserFacingErrorMessage(value, fallback, { log: false });
    }

    if (Array.isArray(value)) {
        return value.map((item) => sanitizePayloadValue(item, fallback, seen));
    }

    if (!value || typeof value !== 'object' || seen.has(value)) {
        return value;
    }

    seen.add(value);
    const sanitized = {};

    Object.entries(value).forEach(([key, item]) => {
        if (PRIVATE_ERROR_KEYS.test(key)) {
            return;
        }

        sanitized[key] = sanitizePayloadValue(item, fallback, seen);
    });

    return sanitized;
}

function collectTechnicalPayloadDetails(value, path, details, seen) {
    if (typeof value === 'string') {
        if (isTechnicalErrorMessage(value)) {
            details.push({ path, value });
        }
        return;
    }

    if (Array.isArray(value)) {
        value.forEach((item, index) => {
            collectTechnicalPayloadDetails(item, `${path}[${index}]`, details, seen);
        });
        return;
    }

    if (!value || typeof value !== 'object' || seen.has(value)) {
        return;
    }

    seen.add(value);
    Object.entries(value).forEach(([key, item]) => {
        const itemPath = path ? `${path}.${key}` : key;
        if (PRIVATE_ERROR_KEYS.test(key)) {
            details.push({ path: itemPath, value: item });
            return;
        }

        collectTechnicalPayloadDetails(item, itemPath, details, seen);
    });
}

export function sanitizeErrorPayload(payload, fallback = DEFAULT_ERROR_MESSAGE, options = {}) {
    if (!payload || typeof payload !== 'object') {
        return {};
    }

    const technicalDetails = [];
    collectTechnicalPayloadDetails(payload, '', technicalDetails, new WeakSet());
    if (technicalDetails.length > 0 && options.log !== false) {
        logHiddenTechnicalError(
            options.context || 'Technical API response fields were removed from the client error.',
            technicalDetails
        );
    }

    const sanitized = sanitizePayloadValue(payload, fallback, new WeakSet());
    if (technicalDetails.length > 0 && sanitized && !Array.isArray(sanitized)) {
        sanitized.technicalDetailsHidden = true;
    }

    return sanitized;
}
