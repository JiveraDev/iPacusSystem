import { useEffect } from 'react';

const STORAGE_PREFIX = 'ipawcus:session-form-draft:';
const SAVE_DELAY_MS = 120;
const SAVE_INTERVAL_MS = 1000;
const RESTORE_DELAYS_MS = [0, 250, 800, 1800];

const STAFF_ROLES = new Set([
    'admin',
    'veterinarian',
    'vet',
    'super_admin',
    'superadmin',
]);

const PET_OWNER_BOOKING_ROUTES = [
    /^\/dashboard\/consult\/booking\/?$/,
    /^\/dashboard\/services\/(general-checkup|parasite-control|surgery|vaccination|grooming|dental-checkup|home-services|pet-hotel|special-services)\/?$/,
];

const BLOCKED_FIELD_PATTERN = /(password|passcode|otp|one.?time|token|secret|signature|payment|card|cvv|cvc|proof|receipt|bank|gcash|maya|account.?number|access.?key|private.?key|upload|attachment|file)/i;
const TRANSIENT_CONTROL_PATTERN = /(^|\b)(search|filter|sort|pagination|page.?size|date.?range)(\b|$)/i;
const BLOCKED_INPUT_TYPES = new Set(['button', 'file', 'hidden', 'image', 'password', 'reset', 'submit']);

function normalizeRole(role) {
    return String(role || '')
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, '_');
}

function userIdentifier(user) {
    return String(user?.user_id || user?.userId || user?.id || user?.email || 'unknown');
}

function shouldPersistRoute(role, path) {
    const normalizedRole = normalizeRole(role);
    if (STAFF_ROLES.has(normalizedRole)) {
        return String(path || '').startsWith('/dashboard');
    }

    if (!['pet_owner', 'petowner'].includes(normalizedRole)) {
        return false;
    }

    return PET_OWNER_BOOKING_ROUTES.some((pattern) => pattern.test(String(path || '')));
}

function draftKey(user, path) {
    return `${STORAGE_PREFIX}${encodeURIComponent(userIdentifier(user))}:${encodeURIComponent(path)}`;
}

function canUseSessionStorage() {
    try {
        const testKey = `${STORAGE_PREFIX}test`;
        window.sessionStorage.setItem(testKey, '1');
        window.sessionStorage.removeItem(testKey);
        return true;
    } catch {
        return false;
    }
}

function fieldDescriptor(field) {
    return [
        field.getAttribute('data-session-draft-key'),
        field.name,
        field.id,
        field.getAttribute('autocomplete'),
        field.getAttribute('aria-label'),
        field.placeholder,
    ].filter(Boolean).join(' ');
}

function isPersistableField(field) {
    if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement)) {
        return false;
    }

    if (field.closest('[data-session-persist="off"]') || field.dataset.sessionPersist === 'off') {
        return false;
    }

    const descriptor = fieldDescriptor(field);
    if (
        String(field.getAttribute('role') || '').toLowerCase() === 'searchbox'
        || (field instanceof HTMLInputElement && String(field.type || '').toLowerCase() === 'search')
        || TRANSIENT_CONTROL_PATTERN.test(descriptor)
        || field.closest('[role="search"], [data-filter-bar]')
    ) {
        return false;
    }

    const isSessionSelect = field instanceof HTMLInputElement && field.dataset.sessionPersist === 'select';
    if (
        field instanceof HTMLInputElement
        && BLOCKED_INPUT_TYPES.has(String(field.type || 'text').toLowerCase())
        && !isSessionSelect
    ) {
        return false;
    }

    return !BLOCKED_FIELD_PATTERN.test(descriptor);
}

function getFields(root) {
    return Array.from(root.querySelectorAll('input, textarea, select')).filter(isPersistableField);
}

function stableFieldName(field) {
    return field.getAttribute('data-session-draft-key') || field.name || field.id || '';
}

function fieldIdentity(field, fields, fieldIndex) {
    const tag = field.tagName.toLowerCase();
    const type = field instanceof HTMLInputElement ? String(field.type || 'text').toLowerCase() : tag;
    const stableName = stableFieldName(field);

    if (!stableName) {
        return `${tag}:${type}:position:${fieldIndex}`;
    }

    let occurrence = 0;
    for (let index = 0; index < fieldIndex; index += 1) {
        if (stableFieldName(fields[index]) === stableName) {
            occurrence += 1;
        }
    }

    return `${tag}:${type}:${stableName}:${occurrence}`;
}

function readFieldValue(field) {
    if (field instanceof HTMLInputElement && ['checkbox', 'radio'].includes(field.type)) {
        return { kind: 'checked', value: field.checked };
    }

    if (field instanceof HTMLSelectElement && field.multiple) {
        return {
            kind: 'multiple',
            value: Array.from(field.selectedOptions).map((option) => option.value),
        };
    }

    return { kind: 'value', value: field.value };
}

function setNativeProperty(field, property, value) {
    const prototype = field instanceof HTMLInputElement
        ? HTMLInputElement.prototype
        : field instanceof HTMLTextAreaElement
            ? HTMLTextAreaElement.prototype
            : HTMLSelectElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, property)?.set;

    if (setter) {
        setter.call(field, value);
    } else {
        field[property] = value;
    }
}

function applyFieldValue(field, storedValue) {
    if (!storedValue || typeof storedValue !== 'object') {
        return;
    }

    if (storedValue.kind === 'checked' && field instanceof HTMLInputElement) {
        setNativeProperty(field, 'checked', Boolean(storedValue.value));
    } else if (storedValue.kind === 'multiple' && field instanceof HTMLSelectElement) {
        const selectedValues = new Set(Array.isArray(storedValue.value) ? storedValue.value.map(String) : []);
        Array.from(field.options).forEach((option) => {
            option.selected = selectedValues.has(String(option.value));
        });
    } else if (storedValue.kind === 'value') {
        setNativeProperty(field, 'value', String(storedValue.value ?? ''));
    } else {
        return;
    }

    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
}

function readStoredDraft(key) {
    try {
        const parsed = JSON.parse(window.sessionStorage.getItem(key) || 'null');
        return parsed?.version === 1 && parsed.fields && typeof parsed.fields === 'object'
            ? parsed
            : null;
    } catch {
        return null;
    }
}

function storeDraft(key, path, root) {
    const fields = getFields(root);
    if (fields.length === 0) {
        return null;
    }

    const values = {};
    fields.forEach((field, index) => {
        values[fieldIdentity(field, fields, index)] = readFieldValue(field);
    });

    try {
        const draft = {
            version: 1,
            path,
            savedAt: Date.now(),
            fields: values,
        };
        window.sessionStorage.setItem(key, JSON.stringify(draft));
        return draft;
    } catch {
        // Browser storage may be disabled or full. Form behavior must continue normally.
        return null;
    }
}

export function clearSessionFormDraftsForUser(user) {
    if (typeof window === 'undefined') {
        return;
    }

    const prefix = `${STORAGE_PREFIX}${encodeURIComponent(userIdentifier(user))}:`;
    try {
        Object.keys(window.sessionStorage)
            .filter((key) => key.startsWith(prefix))
            .forEach((key) => window.sessionStorage.removeItem(key));
    } catch {
        // Logout must continue even when browser storage is unavailable.
    }
}

export function useSessionFormPersistence({ user, path }) {
    const role = user?.role;
    const userId = userIdentifier(user);

    useEffect(() => {
        if (
            typeof window === 'undefined'
            || !shouldPersistRoute(role, path)
            || !canUseSessionStorage()
        ) {
            return undefined;
        }

        const root = document.querySelector('[data-dashboard-content]');
        if (!root) {
            return undefined;
        }

        const key = draftKey(user, path);
        let activeDraft = readStoredDraft(key);
        const userEditedFields = new WeakSet();
        const restoredFields = new WeakSet();
        let saveTimer = null;
        let submitted = false;
        const restoreTimers = [];

        const persist = () => {
            const nextDraft = storeDraft(key, path, root);
            if (nextDraft) {
                activeDraft = nextDraft;
            }
        };
        const schedulePersist = () => {
            window.clearTimeout(saveTimer);
            saveTimer = window.setTimeout(persist, SAVE_DELAY_MS);
        };
        const restore = () => {
            if (!activeDraft) {
                return;
            }

            const fields = getFields(root);
            fields.forEach((field, index) => {
                if (userEditedFields.has(field) || restoredFields.has(field)) {
                    return;
                }

                const storedValue = activeDraft.fields[fieldIdentity(field, fields, index)];
                if (storedValue) {
                    applyFieldValue(field, storedValue);
                    restoredFields.add(field);
                }
            });
        };
        const handleFieldChange = (event) => {
            if (event.isTrusted && isPersistableField(event.target)) {
                userEditedFields.add(event.target);
            }
            schedulePersist();
        };
        const handleSubmit = () => {
            submitted = true;
            schedulePersist();
        };
        const handleReset = () => {
            window.sessionStorage.removeItem(key);
        };

        root.addEventListener('input', handleFieldChange, true);
        root.addEventListener('change', handleFieldChange, true);
        root.addEventListener('submit', handleSubmit, true);
        root.addEventListener('reset', handleReset, true);

        RESTORE_DELAYS_MS.forEach((delay) => {
            restoreTimers.push(window.setTimeout(restore, delay));
        });

        const observer = new MutationObserver(() => {
            restoreTimers.push(window.setTimeout(restore, 80));
        });
        observer.observe(root, { childList: true, subtree: true });

        const intervalId = window.setInterval(persist, SAVE_INTERVAL_MS);

        return () => {
            window.clearTimeout(saveTimer);
            restoreTimers.forEach((timerId) => window.clearTimeout(timerId));
            window.clearInterval(intervalId);
            observer.disconnect();
            root.removeEventListener('input', handleFieldChange, true);
            root.removeEventListener('change', handleFieldChange, true);
            root.removeEventListener('submit', handleSubmit, true);
            root.removeEventListener('reset', handleReset, true);

            if (
                !window.location.pathname.startsWith('/dashboard')
                || (submitted && window.location.pathname !== path)
            ) {
                window.sessionStorage.removeItem(key);
            } else {
                persist();
            }
        };
    }, [path, role, user, userId]);
}
