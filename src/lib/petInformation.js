export function canEditPetInformation(role) {
    return ['admin', 'super_admin', 'superadmin', 'veterinarian', 'vet'].includes(String(role || '').trim().toLowerCase().replace(/[\s-]+/g, '_'));
}

export function petInformationDraft(pet = {}) {
    return Object.fromEntries(Object.entries({
        petName: pet.name ?? pet.petName, species: pet.species, breed: pet.breed,
        birthDate: pet.birthDate?.slice(0, 10), gender: pet.gender, weight: pet.weight,
        color: pet.color, microchipId: pet.microchipId,
    }).map(([key, value]) => [key, value == null ? '' : String(value)]));
}

export function petInformationChanges(original, draft) {
    // Explicit basic-information allowlist: never send ownership or clinical fields.
    return Object.fromEntries(Object.keys(petInformationDraft()).filter((key) => draft[key] !== original[key])
        .map((key) => [key, ['birthDate', 'weight', 'microchipId'].includes(key) && draft[key] === '' ? null : draft[key]]));
}
