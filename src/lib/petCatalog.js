export const PET_BREEDS_BY_SPECIES = Object.freeze({
    Dog: Object.freeze([
        'Aspin (Askal)',
        'Beagle',
        'Chihuahua',
        'Dachshund',
        'French Bulldog',
        'German Shepherd',
        'Golden Retriever',
        'Labrador Retriever',
        'Pomeranian',
        'Poodle',
        'Pug',
        'Shih Tzu',
        'Siberian Husky',
        'Mixed Breed',
        'Other / Unknown',
    ]),
    Cat: Object.freeze([
        'Domestic Shorthair',
        'Domestic Longhair',
        'Persian',
        'Siamese',
        'British Shorthair',
        'Maine Coon',
        'Ragdoll',
        'Bengal',
        'Mixed Breed',
        'Other / Unknown',
    ]),
    Bird: Object.freeze([
        'Budgerigar',
        'Canary',
        'Cockatiel',
        'Finch',
        'Lovebird',
        'Parrot',
        'Other / Unknown',
    ]),
    Rabbit: Object.freeze([
        'Holland Lop',
        'Lionhead',
        'Mini Rex',
        'Netherland Dwarf',
        'New Zealand',
        'Mixed Breed',
        'Other / Unknown',
    ]),
    Hamster: Object.freeze([
        'Syrian',
        'Dwarf Campbell',
        'Winter White',
        'Roborovski',
        'Chinese Hamster',
        'Other / Unknown',
    ]),
    'Guinea Pig': Object.freeze([
        'Abyssinian',
        'American',
        'Peruvian',
        'Teddy',
        'Mixed Breed',
        'Other / Unknown',
    ]),
    Reptile: Object.freeze([
        'Ball Python',
        'Bearded Dragon',
        'Leopard Gecko',
        'Red-eared Slider',
        'Tortoise',
        'Other / Unknown',
    ]),
    Other: Object.freeze(['Other / Unknown']),
});

export const PET_SPECIES_OPTIONS = Object.freeze(Object.keys(PET_BREEDS_BY_SPECIES));

export function petBreedOptions(species) {
    const normalizedSpecies = String(species || '').trim().toLocaleLowerCase();
    const catalogSpecies = PET_SPECIES_OPTIONS.find(option => option.toLocaleLowerCase() === normalizedSpecies);

    return catalogSpecies ? PET_BREEDS_BY_SPECIES[catalogSpecies] : [];
}
