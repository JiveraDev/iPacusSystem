import { spawn, spawnSync } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { tmpdir, homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'dotenv';
import { extractSchema } from './sandbox/schema.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directory = path.join(root, 'tmp', 'db-sandbox');
const stateFile = path.join(directory, 'state.json');
const stopRequest = path.join(directory, 'stop-requested');
const binaries = process.env.IPAWCUS_MARIADB_BIN || 'C:/xampp/mysql/bin';
const php = process.env.IPAWCUS_PHP_BINARY || 'php';
const action = process.argv[2] || 'start';
const port = 33308;
const apiPort = 8018;
const frontendPort = 5183;
const database = 'ipawcus_sandbox';
const processes = [];
let stopping = false;
let state;

async function freePort(selected) {
    const probe = createServer();
    probe.listen(selected, '127.0.0.1');
    try { await once(probe, 'listening'); }
    catch { throw new Error(`Port ${selected} is occupied. Stop the other process; sandbox will not reuse it.`); }
    await new Promise(resolve => probe.close(resolve));
}
function command(label, executable, args, input) {
    const result = spawnSync(executable, args, { cwd: root, windowsHide: true, encoding: 'utf8', input, maxBuffer: 16 * 1024 * 1024 });
    if (result.error || result.status !== 0) {
        writeFileSync(path.join(directory, `${label}-error.log`), `${result.error?.message || ''}\n${result.stderr || ''}`);
        throw new Error(`${label} failed; inspect ignored tmp/db-sandbox/${label}-error.log.`);
    }
    return result.stdout;
}
function client(sql) {
    return command('database-command', path.join(binaries, 'mysql.exe'), [`--defaults-file=${path.join(directory, 'root-client.ini')}`, '--batch', '--skip-column-names'], sql);
}
function child(label, executable, args, env = sandboxEnv(), visible = false) {
    const log = visible ? null : openSync(path.join(directory, `${label}.log`), 'a');
    const process = spawn(executable, args, { cwd: root, env, windowsHide: true, stdio: visible ? 'inherit' : ['ignore', log, log] });
    if (log !== null) closeSync(log);
    process.on('error', () => {});
    processes.push({ label, process });
    return process;
}
function sandboxEnv() {
    let google = {};
    if (existsSync(path.join(root, '.env'))) {
        const settings = parse(readFileSync(path.join(root, '.env')));
        google = { GOOGLE_CLIENT_ID: settings.GOOGLE_CLIENT_ID || '', VITE_GOOGLE_CLIENT_ID: settings.VITE_GOOGLE_CLIENT_ID || '' };
    }
    return {
        ...process.env, ...google,
        IPAWCUS_SANDBOX: '1', DB_HOST: '127.0.0.1', DB_PORT: String(port), DB_NAME: database,
        DB_USER: 'ipawcus_sandbox', DB_PASSWORD: state.password, DB_TIMEOUT: '3',
        FRONTEND_ORIGIN: `http://127.0.0.1:${frontendPort},http://localhost:${frontendPort}`,
        IPAWCUS_GOOGLE_TEST_ORIGIN: `http://127.0.0.1:${frontendPort}`,
        VITE_API_BASE_URL: `http://127.0.0.1:${apiPort}/php/index.php`,
        ENABLE_AUTH: '1', RESTRICT_IP_MODE: 'auto', RESTRICT_IP_SELF_SERVICE_QUEUE: '127.0.0.1,::1', VITE_PWAACTIVATOR: 'FALSE',
        VITE_GEOAPIFY_API_KEY: '',
        MAIL_HOST: '127.0.0.1', MAIL_PORT: '1', MAIL_USERNAME: '', MAIL_PASSWORD: '',
        MAIL_FROM_ADDRESS: 'test@sandbox.invalid', MAIL_FROM_NAME: 'iPawcus Sandbox', MAIL_QUEUE_ENABLED: '1', MAIL_DEBUG: '0',
        PUSH_VAPID_PUBLIC_KEY: '', VITE_PUSH_PUBLIC_KEY: '', PUSH_VAPID_PRIVATE_KEY: '',
        PUSH_VAPID_PRIVATE_KEY_BASE64: '', PUSH_VAPID_PRIVATE_KEY_PATH: '', PUSH_VAPID_PRIVATE_KEY_PEM: '',
        JAAS_APP_ID: '', JAAS_PRIVATE_KEY: '', JITSI_BASE_URL: '',
        OTP_SECRET: state.password, MASTER_KEY: 'SANDBOX-ONLY', VITE_MASTER_KEY: 'SANDBOX-ONLY',
        NOTIFICATION_REMINDER_KEY: state.password,
        IPAWCUS_RUNTIME_MEDIA_ROOT: path.join(directory, 'media'),
        IPAWCUS_ACTIVITY_LOG_DIR: path.join(directory, 'activity'),
        IPAWCUS_GROOMING_MEDIA_ROOT: state.privateMedia,
        IPAWCUS_SYSTEM_BACKUPS_ENABLED: '0',
        IPAWCUS_SANDBOX_LOGIN_PASSWORD: 'Sandbox-Test-2026!',
    };
}
async function startDatabase() {
    await freePort(port);
    if (existsSync(stopRequest)) unlinkSync(stopRequest);
    child('mariadb', path.join(binaries, 'mysqld.exe'), [
        '--no-defaults', `--basedir=${path.dirname(binaries)}`, `--datadir=${path.join(directory, 'data')}`,
        `--port=${port}`, '--bind-address=127.0.0.1', '--skip-log-bin', '--event-scheduler=OFF',
        '--default-time-zone=+08:00', '--max-allowed-packet=64M',
        `--pid-file=${path.join(directory, 'mariadb.pid')}`, `--log-error=${path.join(directory, 'mariadb-error.log')}`,
    ]);
    for (let attempt = 0; attempt < 60; attempt++) {
        const ready = spawnSync(path.join(binaries, 'mysqladmin.exe'), [`--defaults-file=${path.join(directory, 'root-client.ini')}`, '--connect-timeout=1', 'ping'], { windowsHide: true, stdio: 'ignore' });
        if (ready.status === 0) return;
        const dbProcess = processes.find(entry => entry.label === 'mariadb').process;
        if (dbProcess.exitCode !== null) throw new Error('Sandbox MariaDB stopped; inspect tmp/db-sandbox/mariadb-error.log.');
        await new Promise(resolve => setTimeout(resolve, 250));
    }
    throw new Error('Sandbox MariaDB startup timed out.');
}
async function stop() {
    if (stopping) return;
    stopping = true;
    for (const entry of processes.filter(entry => entry.label !== 'mariadb')) entry.process.kill();
    if (processes.some(entry => entry.label === 'mariadb')) {
        spawnSync(path.join(binaries, 'mysqladmin.exe'), [`--defaults-file=${path.join(directory, 'root-client.ini')}`, '--connect-timeout=2', 'shutdown'], { windowsHide: true, stdio: 'ignore', timeout: 5000 });
    }
    for (const entry of processes) {
        if (entry.process.exitCode === null) {
            const exited = once(entry.process, 'exit');
            entry.process.kill();
            await Promise.race([exited, new Promise(resolve => setTimeout(resolve, 2000))]);
        }
    }
}
async function startApi() {
    await freePort(apiPort);
    child('php-api', php, ['-d', 'date.timezone=Asia/Manila', '-d', 'upload_max_filesize=8M', '-d', 'post_max_size=10M', '-S', `127.0.0.1:${apiPort}`, '-t', root, 'scripts/local-api-router.php']);
    for (let attempt=0; attempt<40; attempt++) {
        try {
            const result = await fetch(`http://127.0.0.1:${apiPort}/php/index.php/health`, { signal: AbortSignal.timeout(1000) });
            if (result.ok && (await result.json()).ok) return;
        } catch { /* wait for controller startup */ }
        await new Promise(resolve => setTimeout(resolve, 200));
    }
    throw new Error('Sandbox API is not healthy; inspect tmp/db-sandbox/php-api.log.');
}
function prepareAvailability() {
    const result = spawnSync(php, ['scripts/sandbox/availability.php'], { cwd: root, env: sandboxEnv(), windowsHide: true, encoding:'utf8' });
    if (result.status !== 0) {
        writeFileSync(path.join(directory,'availability-error.log'), `${result.stdout || ''}${result.stderr || ''}`);
        throw new Error('Sandbox availability fixtures failed; inspect tmp/db-sandbox/availability-error.log.');
    }
}
try {
    if (!['setup','start','test','google','stop'].includes(action)) throw new Error('Use setup, start, test, google or stop.');
    mkdirSync(directory, { recursive: true });
    if (action === 'setup') {
        if (existsSync(stateFile) || existsSync(path.join(directory, 'data'))) throw new Error('Sandbox already exists; use npm run sandbox or sandbox:test. Existing databases are never overwritten.');
        const dumpFlag = process.argv.indexOf('--dump');
        const dumpPath = dumpFlag >= 0 ? process.argv[dumpFlag+1] : path.join(homedir(), 'Downloads', 'u813606159_new_ipawcus_sy.sql');
        const schema = extractSchema(readFileSync(dumpPath, 'utf8'));
        state = { database, port, password: randomBytes(24).toString('hex'), privateMedia: path.join(tmpdir(), `ipawcus-sandbox-private-${randomBytes(8).toString('hex')}`), tableCount: schema.tableNames.length, createdAt: new Date().toISOString(), ready: false };
        await freePort(port);
        writeFileSync(stateFile, JSON.stringify(state, null, 2));
        writeFileSync(path.join(directory, 'root-client.ini'), `[client]\nuser=root\npassword=${state.password}\nhost=127.0.0.1\nport=${port}\nprotocol=tcp\n`);
        writeFileSync(path.join(directory, 'schema.sql'), schema.sql);
        command('initialize', path.join(binaries, 'mysql_install_db.exe'), [`--datadir=${path.join(directory, 'data')}`, `--password=${state.password}`, `--port=${port}`]);
        await startDatabase();
        client(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;\nCREATE USER 'ipawcus_sandbox'@'127.0.0.1' IDENTIFIED BY '${state.password}';\nGRANT ALL PRIVILEGES ON \`${database}\`.* TO 'ipawcus_sandbox'@'127.0.0.1';\nUSE \`${database}\`;\n${schema.sql}`);
        mkdirSync(path.join(directory, 'media'), { recursive: true });
        mkdirSync(state.privateMedia, { recursive: true });
        const seed = spawnSync(php, ['-d','date.timezone=Asia/Manila','scripts/sandbox/seed.php'], { cwd: root, env: sandboxEnv(), windowsHide: true, encoding: 'utf8' });
        if (seed.status !== 0) {
            writeFileSync(path.join(directory,'seed-error.log'), `${seed.stdout || ''}${seed.stderr || ''}`);
            throw new Error('Synthetic seeding failed; inspect tmp/db-sandbox/seed-error.log.');
        }
        state.ready = true;
        prepareAvailability();
        writeFileSync(stateFile, JSON.stringify(state, null, 2));
        console.log(`Created ${schema.tableNames.length} tables with indexes/constraints from the latest dump; no source records or stored procedures imported.`);
        console.log(seed.stdout.trim());
    } else {
        state = JSON.parse(readFileSync(stateFile, 'utf8'));
        if (!state.ready || state.database !== database || state.port !== port) throw new Error('Sandbox setup is incomplete or configuration is invalid.');
        if (action === 'stop') {
            // Authenticate with this instance's random root secret before stopping it.
            client(`SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${database}';`);
            writeFileSync(stopRequest, '1');
            command('shutdown', path.join(binaries,'mysqladmin.exe'), [`--defaults-file=${path.join(directory,'root-client.ini')}`, '--connect-timeout=2', 'shutdown']);
            console.log('Stopped the sandbox database. Its launcher will close PHP and Vite; sandbox data is retained.');
        } else {
            await startDatabase();
            prepareAvailability();
            if (action === 'google') {
                const result = spawnSync(php, ['scripts/check-google-auth.php'], { cwd: root, env: sandboxEnv(), windowsHide: true, stdio: 'inherit' });
                process.exitCode = result.status || 0;
            } else {
                await startApi();
                if (action === 'test') {
                    const { smoke } = await import('./sandbox/smoke.mjs');
                    await smoke(`http://127.0.0.1:${apiPort}/php/index.php`);
                    for (const script of ['service-catalog-regression.php','grooming-db-regression.php','grooming-storage.php']) {
                        const result = spawnSync(php, [`scripts/tests/${script}`], { cwd:root, env:sandboxEnv(), windowsHide:true, encoding:'utf8' });
                        writeFileSync(path.join(directory,`${script}.log`), `${result.stdout || ''}${result.stderr || ''}`);
                        if (result.status !== 0) throw new Error(`Sandbox regression failed: ${script}; inspect its tmp/db-sandbox log.`);
                        console.log(`PASS: ${script}`);
                    }
                } else {
                    await freePort(frontendPort);
                    child('vite', process.execPath, [path.join(root,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port',String(frontendPort),'--strictPort','--mode','sandbox'], sandboxEnv(), true);
                    console.log(`\nSandbox: http://127.0.0.1:${frontendPort}/\nDatabase: 127.0.0.1:${port}/${database}\nLogin: owner/admin/vet/superadmin@sandbox.invalid\nPassword: Sandbox-Test-2026!\nCtrl+C stops the sandbox processes; data is retained.`);
                    await new Promise(resolve => {
                        process.once('SIGINT', resolve);
                        process.once('SIGTERM', resolve);
                        for (const entry of processes) entry.process.once('exit', () => {
                            if (!stopping) { process.exitCode = existsSync(stopRequest) ? 0 : 1; resolve(); }
                        });
                    });
                }
            }
        }
    }
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
} finally {
    await stop();
}
