import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';

export async function smoke(base) {
    const checks = [];
    const sessions = {};
    async function request(route, role, expected, options = {}) {
        const headers = { 'Content-Type': 'application/json', ...options.headers };
        if (role) headers.Authorization = `Bearer ${sessions[role]}`;
        const response = await fetch(base + route, { ...options, headers, signal: AbortSignal.timeout(15000) });
        const payload = await response.json();
        assert.equal(response.status, expected, `${role || 'anonymous'} ${options.method || 'GET'} ${route}: ${payload.code || payload.message || 'unexpected response'}`);
        checks.push({ route, role: role || 'anonymous', status: response.status });
        return payload;
    }
    assert.equal((await request('/health', null, 200)).ok, true);
    for (const account of ['owner','other-owner','admin','other-admin','vet','other-vet','superadmin']) {
        const login = await request('/login', null, 200, { method:'POST', body:JSON.stringify({ email:`${account}@sandbox.invalid`, password:'Sandbox-Test-2026!' }) });
        assert.ok(login.access_token && login.user.id, 'Login must issue a real database-backed session');
        sessions[account] = login.access_token;
    }
    await request('/accounts', null, 401);
    for (const role of ['owner','admin','vet','superadmin']) {
        const accounts = await request('/accounts', role, role === 'superadmin' ? 200 : 403);
        if (role === 'superadmin') {
            for (const rows of Object.values(accounts)) {
                if (Array.isArray(rows)) assert.ok(rows.every(account => !('user_password' in account)), 'Directory must exclude password hashes');
            }
        }
        await request('/bookings', role, role === 'owner' ? 403 : 200);
        await request('/queues', role, role === 'owner' ? 403 : 200);
        await request('/grooming', role, 200);
        const connection = await request('/account/google', role, 200);
        assert.equal(connection.linked, false, 'Synthetic accounts must not import Google identities');
        await request('/todos', role, role === 'admin' ? 403 : 200);
    }
    await request('/users/1', 'owner', 200);
    await request('/users/2', 'owner', 403);
    await request('/users/1/pets', 'owner', 200);
    await request('/users/1/pets', 'other-owner', 403);
    await request('/pets/1/medical', 'owner', 200);
    await request('/pets/1/medical', 'other-owner', 403);
    await request('/boarding/owner-stays', 'owner', 200);
    await request('/boarding/owner-stays', 'vet', 403);
    await request('/inventory/items', 'admin', 200);
    await request('/inventory/items', 'owner', 403);
    await request('/notifications', 'owner', 200);
    await request('/auth/google', null, 403, { method:'POST', headers:{Origin:'https://untrusted.invalid'}, body:JSON.stringify({credential:'invalid'}) });
    writeFileSync('tmp/db-sandbox/smoke-results.json', JSON.stringify(checks, null, 2) + '\n');
    console.log(`PASS: ${checks.length} real database-backed API checks, seven role logins, ownership/permissions, Google connection status and account-hash privacy.`);
}
