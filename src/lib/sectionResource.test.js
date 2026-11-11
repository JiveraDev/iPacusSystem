import test from 'node:test';
import assert from 'node:assert/strict';
import { createSectionResource } from './sectionResource.js';
import { requireArray } from './errorPolicy.js';

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}

test('independent resources publish success while a sibling is still pending or failed', async () => {
    const pending = deferred();
    const bookings = createSectionResource(() => pending.promise, { initialData: [] });
    const queues = createSectionResource(async () => [{ id: 7 }]);
    const bookingLoad = bookings.refresh();
    assert.equal(await queues.refresh(), true);
    assert.deepEqual(queues.getSnapshot().data, [{ id: 7 }]);
    assert.equal(bookings.getSnapshot().loading, true);
    pending.reject(new Error('Unavailable'));
    assert.equal(await bookingLoad, false);
    assert.equal(bookings.getSnapshot().hasData, false);
    assert.ok(bookings.getSnapshot().error);
    assert.equal(queues.getSnapshot().error, null);
});

test('a background failure retains eligible data, marks it stale, and successful retry clears the error', async () => {
    let fail = false;
    const resource = createSectionResource(async () => {
        if (fail) throw new Error('Unavailable');
        return [1];
    }, { now: () => '2026-10-16T00:00:00Z' });
    await resource.refresh();
    fail = true;
    assert.equal(await resource.refresh({ isAutoRefresh: true }), false);
    assert.deepEqual(resource.getSnapshot().data, [1]);
    assert.equal(resource.getSnapshot().stale, true);
    assert.equal(resource.getSnapshot().lastSuccess, '2026-10-16T00:00:00Z');
    fail = false;
    assert.equal(await resource.refresh(), true);
    assert.equal(resource.getSnapshot().error, null);
    assert.equal(resource.getSnapshot().stale, false);
});

for (const status of [401, 403, 404]) {
    test(`HTTP ${status} clears previously loaded protected records`, async () => {
        let deny = false;
        const resource = createSectionResource(async () => {
            if (deny) throw Object.assign(new Error('Denied'), { status });
            return [{ privateRecord: 3 }];
        }, { initialData: [] });
        await resource.refresh();
        deny = true;
        await resource.refresh();
        assert.deepEqual(resource.getSnapshot().data, []);
        assert.equal(resource.getSnapshot().hasData, false);
        assert.equal(resource.getSnapshot().stale, false);
        assert.equal(resource.getSnapshot().lastSuccess, null);
    });
}

test('simultaneous retries share a GET and malformed payloads are errors rather than empty results', async () => {
    const pending = deferred();
    let calls = 0;
    const resource = createSectionResource(() => { calls += 1; return pending.promise; }, { validate: requireArray });
    const first = resource.refresh();
    assert.equal(resource.refresh(), first);
    pending.resolve({ error: 'incompatible payload' });
    assert.equal(await first, false);
    assert.equal(calls, 1);
    assert.equal(resource.getSnapshot().error.data.code, 'invalid_response');
    assert.equal(resource.getSnapshot().hasData, false);
});

test('disposal cancels the request and ignores late responses after navigation', async () => {
    const pending = deferred();
    let signal;
    let successes = 0;
    const resource = createSectionResource(options => { signal = options.signal; return pending.promise; }, {
        onSuccess: () => { successes += 1; },
    });
    const request = resource.refresh();
    await Promise.resolve();
    resource.dispose();
    assert.equal(signal.aborted, true);
    pending.resolve(['old pet']);
    assert.equal(await request, false);
    assert.equal(resource.getSnapshot().hasData, false);
    assert.equal(successes, 0);
});

test('StrictMode reactivation ignores the obsolete request and accepts the new result', async () => {
    const first = deferred();
    const second = deferred();
    let calls = 0;
    const resource = createSectionResource(() => (++calls === 1 ? first.promise : second.promise));
    const obsolete = resource.refresh();
    await Promise.resolve();
    resource.dispose();
    resource.activate();
    const current = resource.refresh();
    second.resolve(['new pet']);
    await current;
    first.resolve(['old pet']);
    await obsolete;
    assert.deepEqual(resource.getSnapshot().data, ['new pet']);
});

test('a confirmed mutation update cannot be overwritten by an older refresh', async () => {
    const pending = deferred();
    const resource = createSectionResource(() => pending.promise, { initialData: [] });
    const request = resource.refresh();
    resource.updateData([{ status: 'cancelled' }]);
    pending.resolve([{ status: 'waiting' }]);
    await request;
    assert.deepEqual(resource.getSnapshot().data, [{ status: 'cancelled' }]);
});

test('request cancellation is quiet and clears loading indicators', async () => {
    const resource = createSectionResource(async () => { throw new DOMException('Cancelled', 'AbortError'); });
    await resource.refresh();
    assert.equal(resource.getSnapshot().error, null);
    assert.equal(resource.getSnapshot().loading, false);
    assert.equal(resource.getSnapshot().refreshing, false);
});
