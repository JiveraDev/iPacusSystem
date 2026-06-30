export const PET_OWNER_CONSENT_CONTEXTS = [
    { value: 'online-consultation', label: 'Online Consultation' },
    { value: 'boarding', label: 'Boarding' },
    { value: 'home-service', label: 'Home Service' }
];

export function parseConsentContexts(value) {
    if (Array.isArray(value)) {
        return value.map((item) => String(item || '').trim()).filter(Boolean);
    }

    if (typeof value !== 'string' || value.trim() === '') {
        return [];
    }

    try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
            return parsed.map((item) => String(item || '').trim()).filter(Boolean);
        }
    } catch {
        // Fall through to comma-separated parsing for older data.
    }

    return value.split(',').map((item) => item.trim()).filter(Boolean);
}

export function normalizeConsentTemplate(file) {
    const contexts = parseConsentContexts(file.pet_owner_contexts || file.petOwnerContexts);

    return {
        id: String(file.file_id || file.id || ''),
        title: file.file_name || file.title || 'Consent Form',
        content: file.content || '',
        category: file.category || 'General',
        petOwnerContexts: contexts,
        pet_owner_contexts: JSON.stringify(contexts)
    };
}

export function hasConsentContext(file, context) {
    return parseConsentContexts(file.petOwnerContexts || file.pet_owner_contexts).includes(context);
}

export function pickConsentForContext(templates, context) {
    return templates.find((template) => hasConsentContext(template, context)) || null;
}
