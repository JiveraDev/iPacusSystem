import assert from 'node:assert/strict';
import test from 'node:test';
import { formatDetailedActivityNarrative } from './activityNarrative.mjs';

test('names the staff member and registered pet', () => {
    assert.equal(formatDetailedActivityNarrative({
        actor_name: 'Admin1',
        action_label: 'Registered pet',
        action_key: 'POST:/pet_information',
        action_details: [{ label: 'Pet name', value: 'Dallas' }],
        target_type: 'pets',
        target_id: 41,
    }), 'Admin1 registered Dallas');
});

test('describes stock-in using quantity, unit, and product name', () => {
    assert.equal(formatDetailedActivityNarrative({
        actor_name: 'Admin1',
        action_label: 'Recorded stock in',
        action_key: 'POST:/inventory/stock-in',
        action_details: [
            { label: 'Quantity', value: '10' },
            { label: 'Unit', value: 'box' },
            { label: 'Item', value: 'Biogesic' },
        ],
    }), 'Admin1 stocked in 10 boxes of Biogesic');
});

test('uses a readable named subject for ordinary actions', () => {
    assert.equal(formatDetailedActivityNarrative({
        actor_name: 'Dr. Reyes',
        action_label: 'Saved diagnosis',
        action_details: [{ label: 'Pet name', value: 'Buddy' }],
        target_type: 'vet-diagnoses',
        target_id: 72,
    }), 'Dr. Reyes saved diagnosis — Buddy');
});

test('retains an immutable reference when no subject name is available', () => {
    assert.equal(formatDetailedActivityNarrative({
        actor_name: 'Super Admin',
        action_label: 'Changed account status to inactive',
        target_type: 'accounts',
        target_id: 18,
    }), 'Super Admin changed account status to inactive — accounts #18');
});

