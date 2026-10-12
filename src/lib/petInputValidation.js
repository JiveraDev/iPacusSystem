export const PET_INPUT_LIMITS = Object.freeze({
    name: 80,
    species: 50,
    breed: 80,
    age: 2,
    weight: 6,
    microchip: 15,
    colorMarkings: 120,
});

export const PET_INPUT_RANGES = Object.freeze({
    age: Object.freeze({ min: 0, max: 50 }),
    weight: Object.freeze({ min: 0.1, max: 300 }),
});

export const PET_NAME_PATTERN = /^[\p{L}\p{M} .'-]+$/u;
export const PET_BREED_PATTERN = /^[\p{L}\p{M}\p{N} .,'’/&()-]+$/u;
export const PET_MARKINGS_PATTERN = /^[\p{L}\p{M} ]*$/u;

export function normalizePetNameInput(value, maxLength = PET_INPUT_LIMITS.name) {
    return String(value || '')
        .replace(/[^\p{L}\p{M} .'-]/gu, '')
        .replace(/\s{2,}/g, ' ')
        .slice(0, maxLength);
}

export function normalizePetWeightInput(value) {
    const cleaned = String(value || '').replace(/[^\d.]/g, '');
    const dotIndex = cleaned.indexOf('.');
    const wholeSource = dotIndex === -1 ? cleaned : cleaned.slice(0, dotIndex);
    const whole = wholeSource.slice(0, 3);

    if (dotIndex === -1) return whole;

    const fraction = cleaned.slice(dotIndex + 1).replace(/\./g, '').slice(0, 2);
    return `${whole}.${fraction}`;
}

export function normalizePetBreedInput(value) {
    return String(value || '')
        .replace(/[^\p{L}\p{M}\p{N} .,'’/&()-]/gu, '')
        .replace(/\s{2,}/g, ' ')
        .slice(0, PET_INPUT_LIMITS.breed);
}

export function normalizePetMarkingsInput(value) {
    return String(value || '')
        .replace(/[^\p{L}\p{M} ]/gu, '')
        .replace(/\s{2,}/g, ' ')
        .slice(0, PET_INPUT_LIMITS.colorMarkings);
}

export function isPetNameText(value) {
    const text = String(value || '').trim();
    return Boolean(text) && text.length <= PET_INPUT_LIMITS.name && PET_NAME_PATTERN.test(text);
}

export function isPetBreedText(value) {
    const text = String(value || '').trim();
    return Boolean(text) && text.length <= PET_INPUT_LIMITS.breed && PET_BREED_PATTERN.test(text);
}

export function isPetSpeciesText(value) {
    const text = String(value || '').trim();
    return Boolean(text) && text.length <= PET_INPUT_LIMITS.species && PET_NAME_PATTERN.test(text);
}

export function isPetAgeText(value) {
    const text = String(value ?? '').trim();
    return /^\d{1,2}$/.test(text)
        && Number(text) >= PET_INPUT_RANGES.age.min
        && Number(text) <= PET_INPUT_RANGES.age.max;
}

export function isPetWeightText(value, { allowEmpty = true } = {}) {
    const text = String(value ?? '').trim();
    if (!text) return allowEmpty;
    return /^\d{1,3}(?:\.\d{1,2})?$/.test(text)
        && Number(text) >= PET_INPUT_RANGES.weight.min
        && Number(text) <= PET_INPUT_RANGES.weight.max;
}

export function isPetMicrochipText(value) {
    const text = String(value ?? '').trim();
    return !text || /^\d{1,15}$/.test(text);
}

export function isPetMarkingsText(value) {
    const text = String(value || '').trim();
    return text.length <= PET_INPUT_LIMITS.colorMarkings && PET_MARKINGS_PATTERN.test(text);
}
