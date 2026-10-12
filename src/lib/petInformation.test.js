import assert from 'node:assert/strict';
import test from 'node:test';
import { canEditPetInformation, petInformationChanges, petInformationDraft } from './petInformation.js';

test('only clinic roles get the basic pet-information editor', () => {
    for (const role of ['admin', 'Super Admin', 'veterinarian', 'vet']) assert.equal(canEditPetInformation(role), true);
    for (const role of ['pet_owner', 'receptionist', '', null]) assert.equal(canEditPetInformation(role), false);
});

test('editor draft contains basic pet information only', () => {
    assert.deepEqual(petInformationDraft({
        name: 'Mochi', species: 'Dog', breed: 'Poodle', birthDate: '2024-01-02T00:00:00Z',
        gender: 'Female', weight: 4.2, color: 'White', microchipId: '123', ownerName: 'Owner', allergies: ['Chicken'],
    }), {
        petName: 'Mochi', species: 'Dog', breed: 'Poodle', birthDate: '2024-01-02', gender: 'Female',
        weight: '4.2', color: 'White', microchipId: '123',
    });
});

test('editor sends only changed basic fields and normalizes cleared optional values', () => {
    const original = petInformationDraft({ name: 'Mochi', species: 'Dog', breed: 'Poodle', microchipId: '123' });
    const changes = petInformationChanges(original, { ...original, breed: 'Toy Poodle', microchipId: '' });
    assert.deepEqual(changes, { breed: 'Toy Poodle', microchipId: null });
    assert.equal(Object.hasOwn(changes, 'ownerName'), false);
    assert.equal(Object.hasOwn(changes, 'allergies'), false);
});
