import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const viteEntry = path.join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js');
const phpBinary = process.env.IPAWCUS_PHP_BINARY || 'php';
const children = [];
let isStopping = false;

function startProcess(label, command, args) {
    const child = spawn(command, args, {
        cwd: projectRoot,
        stdio: 'inherit',
        windowsHide: true,
    });

    children.push(child);

    child.on('error', (error) => {
        if (isStopping) return;
        console.error(`[iPawcus] ${label} could not start: ${error.message}`);
        stopAll(1);
    });

    child.on('exit', (code, signal) => {
        if (isStopping) return;
        const reason = signal ? `signal ${signal}` : `exit code ${code ?? 1}`;
        console.error(`[iPawcus] ${label} stopped unexpectedly (${reason}).`);
        stopAll(code ?? 1);
    });

    return child;
}

function stopAll(exitCode = 0) {
    if (isStopping) return;
    isStopping = true;

    children.forEach((child) => {
        if (!child.killed) child.kill();
    });

    const exitTimer = setTimeout(() => process.exit(exitCode), 150);
    exitTimer.unref();
}

async function localApiIsHealthy() {
    try {
        const response = await fetch('http://localhost:8000/php/index.php/health', {
            signal: AbortSignal.timeout(1500),
        });
        return response.ok;
    } catch {
        return false;
    }
}

if (await localApiIsHealthy()) {
    console.log('[iPawcus] Reusing the healthy PHP API at http://localhost:8000/php/index.php');
} else {
    console.log('[iPawcus] Starting the local PHP API at http://localhost:8000/php/index.php');
    startProcess('PHP API', phpBinary, ['-S', 'localhost:8000', '-t', projectRoot]);
}

console.log('[iPawcus] Starting the Vite frontend at http://localhost:5173/');
startProcess('Vite frontend', process.execPath, [viteEntry, '--strictPort']);

process.on('SIGINT', () => stopAll(0));
process.on('SIGTERM', () => stopAll(0));
