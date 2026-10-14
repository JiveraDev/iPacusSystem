import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { once } from 'node:events';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const probe = net.createServer();
probe.listen(0, '127.0.0.1');
await once(probe, 'listening');
const port = probe.address().port;
await new Promise(resolve => probe.close(resolve));
const child = spawn(process.env.IPAWCUS_PHP_BINARY || 'php', ['-S', `127.0.0.1:${port}`, '-t', root, 'scripts/local-api-router.php'], { cwd: root, windowsHide: true, stdio: 'ignore' });
const exit = once(child, 'exit');
let spawnError;
child.on('error', error => { spawnError = error; });
const origin = `http://127.0.0.1:${port}`;
try {
    let ready = false;
    for (let attempt = 0; attempt < 40; attempt++) {
        if (spawnError) throw spawnError;
        try {
            const response = await fetch(`${origin}/env`, { signal: AbortSignal.timeout(500) });
            assert.equal(response.status, 404);
            ready = true;
            break;
        } catch {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    assert.ok(ready, 'Local PHP router must start');
    for (const resource of ['/.env', '/env', '/vendor/autoload.php', '/tmp/project-audit/summary.json', '/php/get_accounts.php', '/scripts/check-google-auth.php', '/phpTestfiles/debug_db.php']) {
        const response = await fetch(origin + resource);
        assert.equal(response.status, 404, `${resource} must not be served`);
    }
    const health = await fetch(`${origin}/php/index.php/health`, { signal: AbortSignal.timeout(10000) });
    assert.ok([200, 503].includes(health.status), 'Health must reach the API controller');
    const payload = await health.json();
    if (health.status === 503) assert.equal(payload.code, 'database_unavailable');
    console.log(`PASS: Local API router protects seven private paths; controller health returned ${health.status}.`);
} finally {
    child.kill();
    await exit;
}
