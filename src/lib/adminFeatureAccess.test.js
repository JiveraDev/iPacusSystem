import test from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN_FEATURES, getAdminFeatureForDashboardPath, normalizeAdminFeaturePermissions } from './adminFeatureAccess.js';

test('Pet Intake is a separate Admin access choice for both dashboard routes', () => {
    assert.equal(ADMIN_FEATURES.filter(feature => feature.key === 'pet_intake').length, 1);
    assert.equal(getAdminFeatureForDashboardPath('/dashboard/pet-intake'), 'pet_intake');
    assert.equal(getAdminFeatureForDashboardPath('/dashboard/patient-intake/'), 'pet_intake');
    assert.equal(getAdminFeatureForDashboardPath('/dashboard/queue'), 'queue');
});

test('existing Admin permissions retain their previous Queue-based intake access', () => {
    assert.equal(normalizeAdminFeaturePermissions({ queue: false }).pet_intake, false);
    assert.equal(normalizeAdminFeaturePermissions({ queue: true }).pet_intake, true);
    assert.equal(normalizeAdminFeaturePermissions(null).pet_intake, true);
});

test('an explicit Pet Intake choice works independently from Queue', () => {
    const intakeOnly = normalizeAdminFeaturePermissions({ queue: false, pet_intake: true });
    assert.equal(intakeOnly.pet_intake, true);
    assert.equal(intakeOnly.queue, false);
    const queueOnly = normalizeAdminFeaturePermissions({ queue: true, pet_intake: false });
    assert.equal(queueOnly.pet_intake, false);
    assert.equal(queueOnly.queue, true);
});
