export const DEFAULT_ERROR_MESSAGE = 'We could not complete your request. Please try again.';

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
    /\brequest failed(?: with status)?\s*[:(]?\s*\d{3}\b/i,
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
        const candidate = value.message ?? value.error ?? value.detail;
        if (typeof candidate === 'string') {
            return candidate.trim();
        }
    }

    return '';
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
    const message = extractMessage(error);
    const fallbackMessage = extractMessage(fallback);
    const safeFallback = fallbackMessage && !isTechnicalErrorMessage(fallbackMessage)
        ? fallbackMessage
        : DEFAULT_ERROR_MESSAGE;

    if (!message) {
        return safeFallback;
    }

    if (!isTechnicalErrorMessage(message)) {
        return message;
    }

    if (options.log !== false) {
        logHiddenTechnicalError(
            options.context || 'Technical error hidden from the user interface.',
            error
        );
    }

    return safeFallback;
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
