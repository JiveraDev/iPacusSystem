import assert from 'node:assert/strict';
import test from 'node:test';
import {
    groomingBookingReference,
    groomingNextStep,
    groomingOptionDisplay,
    groomingSavePayload,
} from './groomingWorkflow.js';

test('routine grooming follows the existing lifecycle, one next action at a time', () => {
    assert.equal(groomingNextStep('scheduled').status, 'checked_in');
    assert.equal(groomingNextStep('checked_in').status, 'in_progress');
    assert.equal(groomingNextStep('in_progress').status, 'ready');
    for (const status of ['ready', 'released', 'cancelled', 'no_show']) assert.equal(groomingNextStep(status), null);
});
test('a paused job needs explicit vet clearance', () => {
    for (const outcome of [undefined, 'pending', 'stop', 'consultation']) assert.equal(groomingNextStep('vet_review', outcome), null);
    assert.equal(groomingNextStep('vet_review', 'resume').label, 'Resume grooming');
});
test('saving a note does not confirm completion, pickup, intake or owner approval', () => {
    const payload = groomingSavePayload({ status: 'in_progress' }, { internalNotes: 'Sensitive skin' }, 'Nurse');
    assert.deepEqual(payload.details, { internalNotes: 'Sensitive skin' });
});
test('Finish explicitly confirms completion without a checklist or a payment', () => {
    const details = Object.freeze({ internalNotes: 'Clinic only' });
    const payload = groomingSavePayload({ status: 'in_progress' }, details, 'Nurse', 'ready');
    assert.deepEqual(payload.details, { ...details, completionConfirmed: true });
    assert.equal(payload.status, 'ready');
    assert.equal(Object.hasOwn(payload.details, 'tasks'), false);
    assert.equal(Object.hasOwn(payload, 'payment'), false);
});
test('ordinary saves never confirm pickup because full payment owns that transition', () => {
    const details = { approvalNote: 'Legacy approval' };
    const payload = groomingSavePayload({ status: 'ready' }, details, 'Nurse');
    assert.equal(payload.status, 'ready');
    assert.deepEqual(payload.details, details);
    assert.equal(Object.hasOwn(payload.details, 'pickupConfirmed'), false);
});
test('grooming selectors keep readable labels and never fall back to numeric option IDs', () => {
    assert.equal(groomingOptionDisplay({ 12: 'Dr. Reyes' }, 12, 'Veterinarian'), 'Dr. Reyes');
    assert.equal(groomingOptionDisplay({}, 12, 'Veterinarian'), 'Veterinarian unavailable');
    assert.equal(groomingOptionDisplay({}, '', 'Veterinarian'), '');
});
test('grooming booking references never expose a database booking ID', () => {
    assert.equal(groomingBookingReference({ booking_number: 'GRM-2026-0042', booking_id: 42 }), 'GRM-2026-0042');
    assert.equal(groomingBookingReference({ grooming_service: 'Full Groom', booking_id: 42 }), 'Full Groom appointment');
    assert.equal(groomingBookingReference({ booking_id: 42 }), 'Grooming appointment');
});
