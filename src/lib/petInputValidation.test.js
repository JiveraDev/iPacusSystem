import assert from 'node:assert/strict';
import test from 'node:test';
import {
    isPetBreedText,
    isPetAgeText,
    isPetMicrochipText,
    isPetMarkingsText,
    isPetNameText,
    isPetWeightText,
    normalizePetMarkingsInput,
    normalizePetWeightInput,
} from './petInputValidation.js';

test('pet weight accepts only three whole digits and two decimal places', () => {
    assert.equal(normalizePetWeightInput('25.567 kg'), '25.56');
    assert.equal(normalizePetWeightInput('1234.56'), '123.56');
    assert.equal(normalizePetWeightInput('1.2.3'), '1.23');
});

test('pet identity fields accept names while rejecting unsupported characters and excess length', () => {
    assert.equal(isPetNameText("Buddy-Jr.'"), true);
    assert.equal(isPetNameText('Buddy <script>'), false);
    assert.equal(isPetNameText('A'.repeat(81)), false);
    assert.equal(isPetBreedText('Golden Retriever'), true);
});

test('pet numeric identifiers and measurements enforce their actual ranges and precision', () => {
    assert.equal(isPetAgeText('50'), true);
    assert.equal(isPetAgeText('51'), false);
    assert.equal(isPetWeightText('300.00'), true);
    assert.equal(isPetWeightText('300.01'), false);
    assert.equal(isPetWeightText('12.345'), false);
    assert.equal(isPetMicrochipText('123456789012345'), true);
    assert.equal(isPetMicrochipText('1234567890123456'), false);
    assert.equal(isPetMicrochipText('ABC123'), false);
});

test('color and markings accept letters and spaces only within the configured limit', () => {
    assert.equal(normalizePetMarkingsInput('Black & white / spot #1 <'), 'Black white spot ');
    assert.equal(isPetMarkingsText('Brown white tan left ear'), true);
    assert.equal(isPetMarkingsText('Brown #1'), false);
    assert.equal(isPetMarkingsText('A'.repeat(121)), false);
});
