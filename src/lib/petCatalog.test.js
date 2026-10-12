import assert from 'node:assert/strict';
import test from 'node:test';
import { PET_BREEDS_BY_SPECIES, PET_SPECIES_OPTIONS, petBreedOptions } from './petCatalog.js';
import { isPetBreedText, isPetSpeciesText } from './petInputValidation.js';

test('pet autocomplete catalog provides breeds for every known species', () => {
    assert.deepEqual(PET_SPECIES_OPTIONS, ['Dog', 'Cat', 'Bird', 'Rabbit', 'Hamster', 'Guinea Pig', 'Reptile', 'Other']);
    PET_SPECIES_OPTIONS.forEach((species) => {
        assert.equal(isPetSpeciesText(species), true);
        assert.equal(petBreedOptions(species), PET_BREEDS_BY_SPECIES[species]);
        assert.ok(petBreedOptions(species).length > 0);
        petBreedOptions(species).forEach((breed) => assert.equal(isPetBreedText(breed), true));
    });
    assert.equal(petBreedOptions('dog'), PET_BREEDS_BY_SPECIES.Dog);
    assert.deepEqual(petBreedOptions('Database typo'), []);
});
