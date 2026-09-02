const ROLE_LABELS = Object.freeze({
    admin: 'Admin',
    owner: 'Pet Owner',
    petowner: 'Pet Owner',
    pet_owner: 'Pet Owner',
    superadmin: 'Super Admin',
    super_admin: 'Super Admin',
    vet: 'Veterinarian',
    veterinarian: 'Veterinarian'
});

export function formatRoleLabel(value, fallback = '') {
    const source = String(value || '').trim();
    if (!source) return fallback;

    const normalized = source.toLowerCase().replace(/[\s-]+/g, '_');
    if (ROLE_LABELS[normalized]) return ROLE_LABELS[normalized];

    return source
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase()
        .replace(/\b\w/g, (character) => character.toUpperCase());
}
