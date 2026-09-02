const PHILIPPINE_LOCALE = 'en-PH';
const CLINIC_TIME_ZONE = 'Asia/Manila';

export const CONSENT_TEMPLATE_CODES = [
    { code: '&date&', key: 'date', label: 'Current date', group: 'Date and time', example: 'August 4, 2026', automatic: true },
    { code: '&day&', key: 'day', label: 'Day of the month', group: 'Date and time', example: '4th', automatic: true },
    { code: '&month&', key: 'month', label: 'Current month', group: 'Date and time', example: 'August', automatic: true },
    { code: '&year&', key: 'year', label: 'Current year', group: 'Date and time', example: '2026', automatic: true },
    { code: '&time&', key: 'time', label: 'Current time', group: 'Date and time', example: '2:30 PM', automatic: true },
    { code: '&signed_at&', key: 'signedAt', label: 'Signing date and time', group: 'Date and time', example: 'August 4, 2026, 2:30 PM', automatic: true },
    { code: '&owner_name&', key: 'ownerName', label: 'Pet owner name', group: 'Owner', example: 'Juan Dela Cruz' },
    { code: '&owner_address&', key: 'ownerAddress', label: 'Pet owner address', group: 'Owner', example: 'Lucena City, Quezon' },
    { code: '&owner_phone&', key: 'ownerPhone', label: 'Pet owner phone', group: 'Owner', example: '+63 9XX XXX XXXX' },
    { code: '&pet_name&', key: 'petName', label: 'Pet name', group: 'Patient', example: 'Bantay' },
    { code: '&pet_species&', key: 'petSpecies', label: 'Pet species', group: 'Patient', example: 'Dog' },
    { code: '&pet_breed&', key: 'petBreed', label: 'Pet breed', group: 'Patient', example: 'Aspin' },
    { code: '&veterinarian_name&', key: 'veterinarianName', label: 'Veterinarian name', group: 'Veterinary service', example: 'Dr. Maria Santos' },
    { code: '&veterinarian_license&', key: 'veterinarianLicense', label: 'Veterinarian license', group: 'Veterinary service', example: 'PRC 0123456' },
    { code: '&service_name&', key: 'serviceName', label: 'Service name', group: 'Veterinary service', example: 'Vaccination' },
    { code: '&branch_name&', key: 'branchName', label: 'Clinic branch', group: 'Veterinary service', example: 'VFC Pet Corner Main Enriquez St.' },
    { code: '&booking_number&', key: 'bookingNumber', label: 'Booking number', group: 'References', example: 'BK-2026-0012' },
    { code: '&queue_number&', key: 'queueNumber', label: 'Queue number', group: 'References', example: 'Q-0012' },
    { code: '&clinic_name&', key: 'clinicName', label: 'Clinic name', group: 'References', example: 'Vetfocus Care Animal Clinic', automatic: true }
];

const CODE_BY_TOKEN = new Map(CONSENT_TEMPLATE_CODES.map((item) => [item.code.toLowerCase(), item]));
const BLANK_RUN_PATTERN = /_{3,}/g;
const TOKEN_PATTERN = /&[a-z][a-z0-9_]*&/gi;

function validDate(value) {
    const date = value instanceof Date ? value : new Date(value || Date.now());
    return Number.isNaN(date.getTime()) ? new Date() : date;
}

function ordinalDay(day) {
    const remainder = day % 100;
    if (remainder >= 11 && remainder <= 13) return `${day}th`;
    return `${day}${({ 1: 'st', 2: 'nd', 3: 'rd' })[day % 10] || 'th'}`;
}

function firstValue(...values) {
    const match = values.find((value) => value !== undefined && value !== null && String(value).trim() !== '');
    return match === undefined ? '' : String(match).trim();
}

export function buildConsentTemplateContext(context = {}) {
    const signedDate = validDate(context.signedAt || context.signed_at || context.date || Date.now());
    const currentDate = validDate(context.date || signedDate);
    const currentDay = Number(currentDate.toLocaleDateString('en-US', {
        day: 'numeric',
        timeZone: CLINIC_TIME_ZONE
    }));

    return {
        date: currentDate.toLocaleDateString(PHILIPPINE_LOCALE, {
            month: 'long', day: 'numeric', year: 'numeric', timeZone: CLINIC_TIME_ZONE
        }),
        day: ordinalDay(currentDay),
        month: currentDate.toLocaleDateString(PHILIPPINE_LOCALE, { month: 'long', timeZone: CLINIC_TIME_ZONE }),
        year: currentDate.toLocaleDateString('en-US', { year: 'numeric', timeZone: CLINIC_TIME_ZONE }),
        time: currentDate.toLocaleTimeString(PHILIPPINE_LOCALE, {
            hour: 'numeric', minute: '2-digit', timeZone: CLINIC_TIME_ZONE
        }),
        signedAt: signedDate.toLocaleString(PHILIPPINE_LOCALE, {
            month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
            timeZone: CLINIC_TIME_ZONE
        }),
        ownerName: firstValue(context.ownerName, context.owner_name, context.signerName, context.signer_name),
        ownerAddress: firstValue(context.ownerAddress, context.owner_address, context.address),
        ownerPhone: firstValue(context.ownerPhone, context.owner_phone, context.phoneNumber, context.phone),
        petName: firstValue(context.petName, context.pet_name, context.patientName, context.patient_name),
        petSpecies: firstValue(context.petSpecies, context.pet_species, context.species),
        petBreed: firstValue(context.petBreed, context.pet_breed, context.breed),
        veterinarianName: firstValue(context.veterinarianName, context.veterinarian_name, context.vetName, context.vet_name),
        veterinarianLicense: firstValue(context.veterinarianLicense, context.veterinarian_license, context.licenseNumber, context.prc_license_number),
        serviceName: firstValue(context.serviceName, context.service_name, context.serviceType, context.service_type),
        branchName: firstValue(context.branchName, context.branch_name),
        bookingNumber: firstValue(context.bookingNumber, context.booking_number),
        queueNumber: firstValue(context.queueNumber, context.queue_number),
        clinicName: firstValue(context.clinicName, context.clinic_name, 'Vetfocus Care Animal Clinic')
    };
}

export function inspectConsentTemplate(content) {
    const source = String(content || '');
    const tokens = [...new Set(source.match(TOKEN_PATTERN) || [])];
    const supportedCodes = tokens.filter((token) => CODE_BY_TOKEN.has(token.toLowerCase()));
    const unknownCodes = tokens.filter((token) => !CODE_BY_TOKEN.has(token.toLowerCase()));
    const blankRuns = source.match(BLANK_RUN_PATTERN) || [];

    return { tokens, supportedCodes, unknownCodes, blankRuns };
}

export function resolveConsentTemplate(content, context = {}, { preview = false } = {}) {
    return resolveConsentTemplateSegments(content, context, { preview })
        .map((segment) => segment.text)
        .join('');
}

export function resolveConsentTemplateSegments(content, context = {}, { preview = false } = {}) {
    const values = buildConsentTemplateContext(context);
    const source = String(content || '');
    const segments = [];
    let cursor = 0;

    source.replace(TOKEN_PATTERN, (token, offset) => {
        if (offset > cursor) {
            segments.push({ text: source.slice(cursor, offset), emphasized: false, token: null });
        }

        const definition = CODE_BY_TOKEN.get(token.toLowerCase());
        const value = definition ? values[definition.key] : '';
        const resolvedValue = !definition
            ? token
            : value || (preview ? `[${definition.label}]` : '________________');

        segments.push({
            text: resolvedValue,
            emphasized: true,
            token,
            supported: Boolean(definition)
        });
        cursor = offset + token.length;

        return token;
    });

    if (cursor < source.length) {
        segments.push({ text: source.slice(cursor), emphasized: false, token: null });
    }

    return segments;
}

export function normalizeImportedConsentTemplate(content) {
    let normalized = String(content || '').replace(/\r\n/g, '\n');

    normalized = normalized.replace(
        /(for\s+(?:my\s+)?pet\s*,?\s*)_{3,}/gi,
        '$1&pet_name&'
    );
    normalized = normalized.replace(
        /this\s+_{3,}\s+day\s+of\s+_{3,}\s*,?\s*20_{3,}/gi,
        'this &day& day of &month&, &year&'
    );

    return normalized;
}

export function insertConsentCode(content, code, selectionStart, selectionEnd) {
    const source = String(content || '');
    const start = Number.isInteger(selectionStart) ? selectionStart : source.length;
    const end = Number.isInteger(selectionEnd) ? selectionEnd : start;
    const nextValue = `${source.slice(0, start)}${code}${source.slice(end)}`;

    return {
        value: nextValue,
        caret: start + code.length
    };
}
