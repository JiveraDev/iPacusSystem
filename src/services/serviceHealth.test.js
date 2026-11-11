import test from 'node:test';
import assert from 'node:assert/strict';
import { createServiceHealthCoordinator } from './serviceHealth.js';

test('a feature failure only schedules health verification and cannot declare an outage', async (t) => {
    const transitions = [];
    const health = createServiceHealthCoordinator({
        probe: async () => ({ ok: true }),
        onDown: () => transitions.push('down'), onUp: () => transitions.push('up'),
    });
    t.after(() => health.dispose());
    health.reportFailure();
    health.reportFailure();
    assert.deepEqual(transitions, []);
    await health.check();
    assert.deepEqual(transitions, ['up']);
});

test('two failed probes confirm an outage, and only a valid health success recovers it', async (t) => {
    const transitions = [];
    let response = { ok: false };
    const health = createServiceHealthCoordinator({
        probe: async () => response,
        onDown: () => transitions.push('down'), onUp: () => transitions.push('up'),
    });
    t.after(() => health.dispose());
    await assert.rejects(health.check());
    assert.deepEqual(transitions, []);
    await assert.rejects(health.check());
    assert.deepEqual(transitions, ['down']);
    response = { ok: true };
    await health.check();
    assert.deepEqual(transitions, ['down', 'up']);
    response = {};
    await assert.rejects(health.check());
    assert.deepEqual(transitions, ['down', 'up']);
});

test('concurrent callers share one probe and disposal prevents late status publication', async () => {
    let complete;
    let calls = 0;
    const transitions = [];
    const health = createServiceHealthCoordinator({
        probe: () => { calls += 1; return new Promise(resolve => { complete = resolve; }); },
        onDown: () => transitions.push('down'), onUp: () => transitions.push('up'),
    });
    const first = health.check();
    assert.equal(health.check(), first);
    await Promise.resolve();
    assert.equal(calls, 1);
    health.dispose();
    complete({ ok: true });
    await first;
    assert.deepEqual(transitions, []);
});

test('confirmation is scheduled automatically after the first failed probe', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    let calls = 0;
    let down = 0;
    const health = createServiceHealthCoordinator({
        probe: async () => { calls += 1; throw new Error('Down'); },
        onDown: () => { down += 1; }, onUp: () => {}, confirmationMs: 2000,
    });
    t.after(() => health.dispose());
    await assert.rejects(health.check());
    t.mock.timers.tick(1999);
    assert.equal(calls, 1);
    t.mock.timers.tick(1);
    await assert.rejects(health.check());
    assert.equal(calls, 2);
    assert.equal(down, 1);
});
