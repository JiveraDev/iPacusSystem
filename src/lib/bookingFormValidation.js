import { toast } from '../reusecomponent/toast.jsx';

const activeHighlights = new Map();
const MAX_BOOKING_FILES = 5;
const MAX_BOOKING_FILE_BYTES = 8 * 1024 * 1024;

const ERROR_LABELS = {
    missing: 'Required field',
    selection: 'Selection required',
    invalid: 'Invalid value',
    range: 'Value out of range',
    upload: 'Upload issue',
    unavailable: 'Unavailable selection',
};

function resolveFieldElement(fieldId) {
    if (!fieldId || typeof document === 'undefined') return null;
    return document.getElementById(fieldId);
}

function resolveVisualElement(element) {
    if (!element) return null;
    if (element instanceof HTMLInputElement && element.type === 'file') {
        return element.parentElement || document.querySelector(`label[for="${element.id}"]`) || element;
    }
    return element;
}

export function clearBookingFieldError(fieldId) {
    const active = activeHighlights.get(fieldId);
    if (!active) return;

    active.visualElement.classList.remove('booking-field-invalid');
    active.visualElement.removeAttribute('data-booking-validation-id');
    active.element.removeAttribute('data-booking-invalid');
    active.element.removeAttribute('aria-invalid');
    active.element.removeEventListener('input', active.clear);
    active.element.removeEventListener('change', active.clear);
    active.visualElement.removeEventListener('click', active.clear);
    active.observer?.disconnect();
    activeHighlights.delete(fieldId);
}

export function clearAllBookingFieldErrors() {
    [...activeHighlights.keys()].forEach(clearBookingFieldError);
}

function highlightBookingField(error, shouldFocus) {
    const element = resolveFieldElement(error.fieldId);
    const visualElement = resolveVisualElement(element);
    if (!element || !visualElement) return;

    const clear = () => clearBookingFieldError(error.fieldId);
    element.setAttribute('aria-invalid', 'true');
    element.setAttribute('data-booking-invalid', 'true');
    visualElement.setAttribute('data-booking-validation-id', error.fieldId);
    visualElement.classList.add('booking-field-invalid');
    element.addEventListener('input', clear);
    element.addEventListener('change', clear);

    if (element.tagName === 'BUTTON' || !['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName)) {
        visualElement.addEventListener('click', clear, { once: true });
    }

    const observer = element.tagName === 'BUTTON' && typeof MutationObserver !== 'undefined'
        ? new MutationObserver(clear)
        : null;
    observer?.observe(element, { childList: true, characterData: true, subtree: true });
    activeHighlights.set(error.fieldId, { element, visualElement, clear, observer });

    if (shouldFocus) {
        visualElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        window.setTimeout(() => {
            if (typeof element.focus === 'function' && !(element instanceof HTMLInputElement && element.type === 'file')) {
                element.focus({ preventScroll: true });
            }
        }, 220);
    }
}

function errorSummary(error) {
    const state = error.type === 'missing' || error.type === 'selection'
        ? 'required'
        : error.type === 'upload'
            ? 'upload issue'
            : error.type === 'unavailable'
                ? 'unavailable'
                : 'invalid';
    return `${error.label} (${state})`;
}

export function reportBookingFormErrors(errors) {
    const validErrors = (Array.isArray(errors) ? errors : []).filter((error) => error?.message);
    if (validErrors.length === 0) return false;

    clearAllBookingFieldErrors();
    validErrors.forEach((error, index) => highlightBookingField(error, index === 0));

    if (validErrors.length === 1) {
        const error = validErrors[0];
        toast.error(`${ERROR_LABELS[error.type] || 'Check this field'} — ${error.message}`);
    } else {
        toast.error(`Fix ${validErrors.length} fields: ${validErrors.map(errorSummary).join(', ')}.`);
    }

    return true;
}

function numericRangeError(value, { fieldId, label, min, max, unit }) {
    if (String(value ?? '').trim() === '') return null;
    const number = Number(value);
    if (!Number.isFinite(number) || number < min || number > max) {
        return {
            fieldId,
            label,
            type: 'range',
            message: `${label} must be between ${min} and ${max}${unit ? ` ${unit}` : ''}.`,
        };
    }
    return null;
}

export function standardAppointmentBookingErrors({
    formData,
    isNewPet,
    branchRequired = false,
    branchFieldId = 'branch',
    today,
    fieldIds = {},
}) {
    const errors = [];
    const ids = {
        pet: fieldIds.pet || 'petSelect',
        petName: fieldIds.petName || 'petName',
        species: fieldIds.species || 'newPetSpecies',
        breed: fieldIds.breed || 'newPetBreed',
        age: fieldIds.age || 'newPetAge',
        weight: fieldIds.weight || 'newPetWeight',
        date: fieldIds.date || 'date',
        time: fieldIds.time || 'time',
        files: fieldIds.files || 'files',
    };
    const addMissing = (condition, fieldId, label, message) => {
        if (condition) errors.push({ fieldId, label, type: 'missing', message });
    };

    addMissing(!formData.petId, ids.pet, 'Pet', 'Select the pet for this booking.');

    if (isNewPet) {
        addMissing(!String(formData.petName || '').trim(), ids.petName, 'Pet name', "Enter the pet's name.");
        addMissing(!formData.newPetSpecies, ids.species, 'Species', "Select the pet's species.");
        addMissing(!String(formData.newPetBreed || '').trim(), ids.breed, 'Breed', "Enter the pet's breed.");
        addMissing(String(formData.newPetAge ?? '').trim() === '', ids.age, 'Age', "Enter the pet's age.");

        const ageError = numericRangeError(formData.newPetAge, {
            fieldId: ids.age, label: 'Pet age', min: 0, max: 50, unit: 'years'
        });
        const weightError = numericRangeError(formData.newPetWeight, {
            fieldId: ids.weight, label: 'Pet weight', min: 0.1, max: 300, unit: 'kg'
        });
        if (ageError) errors.push(ageError);
        if (weightError) errors.push(weightError);
    }

    addMissing(branchRequired && !formData.branchId, branchFieldId, 'Clinic location', 'Select a clinic location.');
    addMissing(!formData.date, ids.date, 'Appointment date', 'Select an appointment date.');
    if (formData.date && today && formData.date < today) {
        errors.push({
            fieldId: ids.date,
            label: 'Appointment date',
            type: 'range',
            message: 'Appointment date cannot be in the past.',
        });
    }
    addMissing(!formData.time, ids.time, 'Appointment time', 'Select an available appointment time.');

    const files = Array.isArray(formData.files) ? formData.files : [];
    if (files.length > MAX_BOOKING_FILES) {
        errors.push({
            fieldId: ids.files,
            label: 'Booking files',
            type: 'upload',
            message: `Upload no more than ${MAX_BOOKING_FILES} files.`,
        });
    } else if (files.some((file) => Number(file?.size || 0) > MAX_BOOKING_FILE_BYTES)) {
        errors.push({
            fieldId: ids.files,
            label: 'Booking files',
            type: 'upload',
            message: 'Each uploaded file must be 8 MB or smaller.',
        });
    } else if (files.some((file) => !(String(file?.type || '').startsWith('image/') || file?.type === 'application/pdf'))) {
        errors.push({
            fieldId: ids.files,
            label: 'Booking files',
            type: 'upload',
            message: 'Only image or PDF booking files are accepted.',
        });
    }

    return errors;
}

export function reportBookingSubmissionError(error, fieldIds = {}) {
    const rawMessage = String(error?.message || '').trim();
    const message = rawMessage && !/^(something went wrong|failed to submit booking|request failed|an error occurred during submission)[.!]?(\s+please try again[.!]?)?$/i.test(rawMessage)
        ? rawMessage
        : 'The form is complete, but the clinic server could not save this booking. Please retry.';
    const mappings = [
        { pattern: /transaction|reference/i, fieldId: fieldIds.transaction || 'referenceNumber', label: 'Transaction number', type: 'invalid' },
        { pattern: /payment proof|receipt|upload|file/i, fieldId: fieldIds.upload || 'receiptFile', label: 'Upload', type: 'upload' },
        { pattern: /time|slot|booked|availability/i, fieldId: fieldIds.time || 'time', label: 'Appointment time', type: 'unavailable' },
        { pattern: /date|day/i, fieldId: fieldIds.date || 'date', label: 'Appointment date', type: 'invalid' },
        { pattern: /branch|location/i, fieldId: fieldIds.branch || 'branch', label: 'Clinic location', type: 'selection' },
        { pattern: /veterinarian|\bvet\b/i, fieldId: fieldIds.veterinarian || 'veterinarian', label: 'Veterinarian', type: 'selection' },
        { pattern: /pet/i, fieldId: fieldIds.pet || 'petSelect', label: 'Pet', type: 'invalid' },
        { pattern: /address/i, fieldId: fieldIds.address || 'home-service-address', label: 'Service address', type: 'invalid' },
    ];
    const match = mappings.find((mapping) => mapping.pattern.test(message) && resolveFieldElement(mapping.fieldId));

    if (match) {
        reportBookingFormErrors([{ ...match, message }]);
        return;
    }

    toast.error(`Submission error — ${message}`);
}
