export const PHILIPPINE_PHONE_PREFIX = '+639';
export const PHILIPPINE_PHONE_ERROR = 'Enter the full Philippine mobile number after +639.';

const PHILIPPINE_PHONE_PATTERN = /^(09\d{9}|639\d{9})$/;
const PHILIPPINE_PHONE_PREFIX_DIGITS = '639';

function getPhilippinePhoneDigits(value) {
    return String(value ?? '').replace(/\D/g, '');
}

export function isPhilippinePhonePrefixOnly(value) {
    const text = String(value ?? '').trim();
    const digits = getPhilippinePhoneDigits(value);

    return text === PHILIPPINE_PHONE_PREFIX || digits === PHILIPPINE_PHONE_PREFIX_DIGITS;
}

function getPhilippinePhoneTail(value) {
    const text = String(value ?? '').trimStart();
    const digits = getPhilippinePhoneDigits(value);

    if (
        !digits
        || (text.startsWith('+') && PHILIPPINE_PHONE_PREFIX_DIGITS.startsWith(digits))
        || digits === '6'
        || digits === '63'
        || digits === PHILIPPINE_PHONE_PREFIX_DIGITS
    ) {
        return '';
    }

    if (digits.startsWith('639')) {
        return digits.slice(3, 12);
    }

    if (digits.startsWith('09')) {
        return digits.slice(2, 11);
    }

    if (digits.startsWith('9') && digits.length >= 10) {
        return digits.slice(1, 10);
    }

    return digits.slice(0, 9);
}

export function normalizePhilippinePhoneInput(value) {
    return `${PHILIPPINE_PHONE_PREFIX}${getPhilippinePhoneTail(value)}`;
}

export function normalizePhilippinePhoneForSubmit(value, { optional = false } = {}) {
    if (optional && isPhilippinePhonePrefixOnly(value)) {
        return '';
    }

    return normalizePhilippinePhoneInput(value);
}

export function isValidPhilippinePhone(value, { optional = false } = {}) {
    const text = String(value ?? '').trimStart();
    const digits = getPhilippinePhoneDigits(value);

    if (optional && (digits === '' || isPhilippinePhonePrefixOnly(value))) {
        return true;
    }

    if (text.startsWith('+')) {
        return /^639\d{9}$/.test(digits);
    }

    return PHILIPPINE_PHONE_PATTERN.test(digits);
}

export function getPhilippinePhoneError(value, { optional = false, requiredMessage = '' } = {}) {
    const digits = getPhilippinePhoneDigits(value);

    if (digits === '' || isPhilippinePhonePrefixOnly(value)) {
        return optional ? '' : requiredMessage || PHILIPPINE_PHONE_ERROR;
    }

    return isValidPhilippinePhone(value, { optional }) ? '' : PHILIPPINE_PHONE_ERROR;
}
