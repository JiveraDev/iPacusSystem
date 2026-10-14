import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'tmp', 'project-audit');
mkdirSync(output, { recursive: true });
const results = [];
const php = process.env.IPAWCUS_PHP_BINARY || 'php';
function run(label, command, args) {
    const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', windowsHide: true });
    const passed = !result.error && result.status === 0;
    writeFileSync(path.join(output, `${label}.log`), `${result.stdout || ''}${result.stderr || ''}${result.error ? result.error.message : ''}`);
    results.push({ check: label, passed });
    console.log(`${passed ? 'PASS' : 'FAIL'}: ${label}`);
}
function files(directory, extension) {
    return readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap(entry => {
        const relative = path.join(directory, entry.name);
        return entry.isDirectory() ? files(relative, extension) : entry.name.endsWith(extension) ? [relative] : [];
    });
}

run('frontend-tests', process.execPath, ['--test', ...files('src', '.test.js')]);
run('sandbox-schema-extraction', process.execPath, ['--test', 'scripts/tests/sandbox-schema.test.mjs']);
run('lint', process.execPath, ['node_modules/eslint/bin/eslint.js', '.']);
run('build', process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--configLoader', 'native']);
for (const file of [...files('php', '.php'), ...files('phpTestfiles', '.php'), ...files('scripts', '.php')]) {
    run(`syntax-${file.replace(/[\\/]/g, '-')}`, php, ['-l', file]);
}
for (const file of [
    'phpTestfiles/test_shared_booking_calendar.php',
    'phpTestfiles/test_veterinarian_booking_todos.php',
    'phpTestfiles/test_api_error_response.php',
    'scripts/tests/clinic-rules-regression.php',
    'scripts/tests/grooming-rules-regression.php',
    'scripts/tests/reports-regression.php',
    'scripts/tests/report-presentation-regression.php',
    'scripts/tests/mail-smtp-session.php',
    'scripts/tests/role-access-regression.php',
    'scripts/tests/google-auth-regression.php',
]) run(`regression-${path.basename(file, '.php')}`, php, [file]);
run('google-malformed-credential', php, ['scripts/tests/google-auth-regression.php', '--malformed']);
for (const scenario of ['missing-audience', 'wrong-audience', 'missing-expiry', 'expired']) {
    run(`google-${scenario}`, php, ['scripts/tests/google-auth-regression.php', `--${scenario}`]);
}
run('local-api-router', process.execPath, ['scripts/tests/local-api-router.mjs']);
writeFileSync(path.join(output, 'summary.json'), JSON.stringify(results, null, 2) + '\n');
console.log(`Results: ${results.filter(result => result.passed).length}/${results.length} checks passed. Logs: tmp/project-audit`);
process.exitCode = results.every(result => result.passed) ? 0 : 1;
