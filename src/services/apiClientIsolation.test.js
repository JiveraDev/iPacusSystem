import test from 'node:test';
import assert from 'node:assert/strict';
import { apiRequest, checkServerHealth, getServerStatusSnapshot } from './apiClient.js';

function browser(t, fetcher) {
    const values = new Map();
    const storage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
    const events = new EventTarget();
    t.mock.method(globalThis, 'fetch', fetcher);
    const original = globalThis.window;
    globalThis.window = { localStorage: storage, sessionStorage: storage, location: { pathname: '/landing', assign() {} },
        setTimeout, clearTimeout, dispatchEvent: event => events.dispatchEvent(event),
        addEventListener: (...args) => events.addEventListener(...args), removeEventListener: (...args) => events.removeEventListener(...args) };
    t.after(() => { if (original) globalThis.window = original; else delete globalThis.window; });
}

const isolated = { suppressServerUnavailable: true, transientRetryCount: 0 };

test('invalid JSON is a local request error, while intentional no-content is accepted', async t => {
    browser(t, async path => path.includes('empty') ? new Response(null, { status: 204 }) : new Response('<html>Broken</html>'));
    await assert.rejects(apiRequest('/malformed', isolated), error => error.data.code === 'invalid_response');
    assert.equal(await apiRequest('/empty', isolated), null);
    assert.equal(getServerStatusSnapshot().isDown, false);
});

test('a timed-out or disconnected write is not repeated and reports an uncertain result', async t => {
    let calls = 0;
    browser(t, async () => { calls += 1; throw new TypeError('Failed to fetch'); });
    await assert.rejects(apiRequest('/payment', { ...isolated, method: 'POST', body: '{}' }), error => error.data.code === 'mutation_result_unknown');
    assert.equal(calls, 1);
});

test('simultaneous identical reads are deduplicated', async t => {
    let calls = 0;
    browser(t, async () => { calls += 1; return Response.json([{ id: 1 }]); });
    const results = await Promise.all([apiRequest('/records', isolated), apiRequest('/records', isolated)]);
    assert.equal(calls, 1);
    assert.deepEqual(results, [[{ id: 1 }], [{ id: 1 }]]);
});

test('feature failures stay local; unrelated successful reads cannot clear a confirmed outage', async t => {
    let healthOk = true;
    browser(t, async path => path.includes('/health')
        ? Response.json({ ok: healthOk })
        : path.includes('broken') ? Response.json({ message: 'Unavailable' }, { status: 503 }) : Response.json([]));
    await assert.rejects(apiRequest('/broken', isolated));
    assert.equal(getServerStatusSnapshot().isDown, false);
    healthOk = false;
    await assert.rejects(checkServerHealth());
    assert.equal(getServerStatusSnapshot().isDown, false);
    await assert.rejects(checkServerHealth());
    assert.equal(getServerStatusSnapshot().isDown, true);
    await apiRequest('/working', isolated);
    assert.equal(getServerStatusSnapshot().isDown, true);
    healthOk = true;
    await checkServerHealth();
    assert.equal(getServerStatusSnapshot().isDown, false);
});
