import assert from 'node:assert/strict';
import test from 'node:test';
import { prescriptionPlansForView } from './prescriptions.js';

const course = {
    planId: 1,
    status: 'active',
    items: [
        { itemId: 11, medicine: 'Medicine A', status: 'completed' },
        { itemId: 12, medicine: 'Medicine B', status: 'active' },
        { itemId: 13, medicine: 'Medicine C', status: 'pending_start' }
    ],
    occurrences: [
        { itemId: 11, status: 'taken' },
        { itemId: 12, status: 'pending' },
        { itemId: 12, status: 'cancelled' }
    ]
};

test('finishing one medicine keeps the other medicines active', () => {
    const active = prescriptionPlansForView([course]);
    assert.deepEqual(active[0].items.map((item) => item.medicine), ['Medicine B', 'Medicine C']);
    assert.deepEqual(active[0].occurrences, [{ itemId: 12, status: 'pending' }]);
    assert.equal(course.items.length, 3, 'the original clinical record is preserved');
});

test('history contains finished medicine and its recorded doses', () => {
    const history = prescriptionPlansForView([course], { history: true });
    assert.deepEqual(history[0].items.map((item) => item.medicine), ['Medicine A']);
    assert.deepEqual(history[0].occurrences, [{ itemId: 11, status: 'taken' }]);
});

test('a finished course leaves Active but remains in History', () => {
    const finished = { ...course, status: 'completed', items: [course.items[0]] };
    assert.deepEqual(prescriptionPlansForView([finished]), []);
    assert.equal(prescriptionPlansForView([finished], { history: true })[0].planId, 1);
});

test('adding another prescription preserves existing active medicines', () => {
    const extra = { planId: 2, status: 'issued', items: [{ itemId: 21, medicine: 'New medicine', status: 'pending_start' }] };
    const active = prescriptionPlansForView([course, extra]);
    assert.deepEqual(active.map((plan) => plan.planId), [1, 2]);
    assert.deepEqual(active[0].items.map((item) => item.itemId), [12, 13]);
});

test('the start prompt only contains medicines waiting to start', () => {
    const waiting = prescriptionPlansForView([course], { onlyNeedsStart: true });
    assert.deepEqual(waiting[0].items.map((item) => item.itemId), [13]);
    assert.deepEqual(waiting[0].occurrences, []);
});

test('legacy superseded and stopped courses cannot appear as active', () => {
    for (const status of ['superseded', 'stopped']) {
        const archived = { ...course, status };
        assert.deepEqual(prescriptionPlansForView([archived]), []);
        assert.equal(prescriptionPlansForView([archived], { history: true })[0].items.length, 3);
        assert.deepEqual(prescriptionPlansForView([archived], { onlyNeedsStart: true }), []);
    }
});

test('correcting a completed dose brings its medicine back to Active', () => {
    const reopened = { ...course, items: course.items.map((item) => ({ ...item, status: 'active' })) };
    assert.equal(prescriptionPlansForView([reopened])[0].items.length, 3);
    assert.deepEqual(prescriptionPlansForView([reopened], { history: true }), []);
});
