import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, relative, resolve, sep } from 'node:path'
import { spawnSync } from 'node:child_process'

const DEFAULT_BRANCH = 'hostinger-deploy'
const DEFAULT_REMOTE = 'origin'
const WORKTREE_PREFIX = 'ipawcus-hostinger-deploy-'
const COMPOSER_FILES = ['composer.json', 'composer.lock']
const SERVER_CONFIG_FILES = ['.htaccess', '.user.ini']
const DEPLOY_SCRIPT_FILES = ['run-mail-worker.sh']
const RUNTIME_MEDIA_DIRECTORIES = [
    'boarding_documents',
    'concerns',
    'diagnosis',
    'inventory_items',
    'inventory_receipts',
    'invoices',
    'payments',
    'payment_qr',
    'pet_profile_images',
    'signatures',
    'uploads',
]

const HELP = `
Build iPawcus and publish a deployment-only Git branch for Hostinger.

Usage:
  npm run deploy:hostinger
  npm run deploy:hostinger:preview
  node scripts/deploy-hostinger.mjs [options]

Options:
  --branch <name>          Deployment branch (default: ${DEFAULT_BRANCH})
  --remote <name>          Git remote (default: ${DEFAULT_REMOTE})
  --message <text>         Deployment commit message
  --skip-build             Reuse the existing dist/ directory
  --dry-run                Build and stage a preview without fetching or pushing
  --help                    Show this help
`

function fail(message) {
    console.error(`\nDeployment stopped: ${message}`)
    process.exitCode = 1
    throw new Error(message)
}

function parseArguments(argv) {
    const options = {
        branch: DEFAULT_BRANCH,
        remote: DEFAULT_REMOTE,
        message: null,
        skipBuild: false,
        dryRun: false,
    }

    for (let index = 0; index < argv.length; index += 1) {
        const argument = argv[index]

        if (argument === '--help') {
            console.log(HELP.trim())
            process.exit(0)
        }

        if (argument === '--skip-build') {
            options.skipBuild = true
            continue
        }

        if (argument === '--dry-run') {
            options.dryRun = true
            continue
        }

        if (['--branch', '--remote', '--message'].includes(argument)) {
            const value = argv[index + 1]
            if (!value || value.startsWith('--')) {
                fail(`${argument} requires a value.`)
            }

            const key = argument.slice(2)
            options[key] = value
            index += 1
            continue
        }

        fail(`Unknown option: ${argument}`)
    }

    return options
}

function run(command, args, settings = {}) {
    const result = spawnSync(command, args, {
        cwd: settings.cwd,
        encoding: 'utf8',
        shell: settings.shell ?? false,
        stdio: settings.capture ? 'pipe' : 'inherit',
        windowsHide: true,
    })

    if (result.error) {
        fail(`Could not run ${command}: ${result.error.message}`)
    }

    if (result.status !== 0 && !settings.allowFailure) {
        if (settings.capture) {
            const details = [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
            if (details) {
                console.error(details)
            }
        }
        fail(`${command} ${args.join(' ')} exited with code ${result.status}.`)
    }

    return result
}

function runNpm(args, settings = {}) {
    const npmEntryPoint = process.env.npm_execpath

    if (npmEntryPoint && existsSync(npmEntryPoint)) {
        return run(process.execPath, [npmEntryPoint, ...args], settings)
    }

    return run('npm', args, {
        ...settings,
        shell: process.platform === 'win32',
    })
}

function git(args, settings = {}) {
    return run('git', args, settings)
}

function gitOutput(args, cwd, allowFailure = false) {
    const result = git(args, { cwd, capture: true, allowFailure })
    return {
        status: result.status,
        stdout: (result.stdout ?? '').trim(),
        stderr: (result.stderr ?? '').trim(),
    }
}

function copyDirectoryContents(source, destination) {
    for (const entry of readdirSync(source, { withFileTypes: true })) {
        cpSync(join(source, entry.name), join(destination, entry.name), {
            recursive: true,
            force: true,
        })
    }
}

function copyDeploymentScripts(repositoryRoot, worktreePath) {
    const deployedScriptsDirectory = join(worktreePath, 'scripts')
    mkdirSync(deployedScriptsDirectory, { recursive: true })

    for (const file of DEPLOY_SCRIPT_FILES) {
        const source = join(repositoryRoot, 'scripts', file)
        const destination = join(deployedScriptsDirectory, file)
        const unixContents = readFileSync(source, 'utf8').replace(/\r\n?/g, '\n')

        writeFileSync(destination, unixContents, {
            encoding: 'utf8',
            mode: 0o755,
        })
    }
}

function assertSafeWorktree(worktreePath) {
    const resolvedTempDirectory = resolve(tmpdir())
    const resolvedWorktree = resolve(worktreePath)
    const expectedPrefix = `${resolvedTempDirectory}${sep}${WORKTREE_PREFIX}`

    if (!resolvedWorktree.startsWith(expectedPrefix)) {
        fail(`Refusing to clean unexpected worktree path: ${resolvedWorktree}`)
    }

    if (!existsSync(join(resolvedWorktree, '.git'))) {
        fail(`Temporary worktree is missing its .git marker: ${resolvedWorktree}`)
    }
}

function assertSafeTemporaryPath(worktreePath) {
    const resolvedTempDirectory = resolve(tmpdir())
    const resolvedWorktree = resolve(worktreePath)
    const expectedPrefix = `${resolvedTempDirectory}${sep}${WORKTREE_PREFIX}`

    if (!resolvedWorktree.startsWith(expectedPrefix)) {
        fail(`Refusing to remove unexpected temporary path: ${resolvedWorktree}`)
    }
}

function cleanWorktree(worktreePath) {
    assertSafeWorktree(worktreePath)

    for (const entry of readdirSync(worktreePath, { withFileTypes: true })) {
        if (entry.name === '.git') {
            continue
        }
        rmSync(join(worktreePath, entry.name), { recursive: true, force: true })
    }
}

function excludeRuntimeMediaDirectories(worktreePath) {
    for (const directory of RUNTIME_MEDIA_DIRECTORIES) {
        const builtCopy = join(worktreePath, directory)
        rmSync(builtCopy, { recursive: true, force: true })
    }

    console.log('Excluded runtime media; production uploads live outside the Git deployment directory.')
}

function validateRepository(root, options) {
    const distDirectory = join(root, 'dist')
    const phpDirectory = join(root, 'php')

    if (!existsSync(join(root, 'package.json'))) {
        fail('package.json was not found at the Git repository root.')
    }

    if (!existsSync(phpDirectory)) {
        fail('The php/ directory was not found.')
    }

    for (const file of COMPOSER_FILES) {
        if (!existsSync(join(root, file))) {
            fail(`${file} was not found at the Git repository root.`)
        }
    }

    for (const file of DEPLOY_SCRIPT_FILES) {
        if (!existsSync(join(root, 'scripts', file))) {
            fail(`scripts/${file} was not found at the Git repository root.`)
        }
    }

    if (options.skipBuild && !existsSync(distDirectory)) {
        fail('dist/ does not exist. Remove --skip-build so the frontend can be built.')
    }

    const branchCheck = gitOutput(['check-ref-format', '--branch', options.branch], root, true)
    if (branchCheck.status !== 0) {
        fail(`Invalid Git branch name: ${options.branch}`)
    }

    const remoteCheck = gitOutput(['remote', 'get-url', options.remote], root, true)
    if (remoteCheck.status !== 0) {
        fail(`Git remote "${options.remote}" does not exist.`)
    }
}

function summarizeStagedDeployment(worktreePath) {
    const shortStat = gitOutput(['diff', '--cached', '--shortstat'], worktreePath).stdout
    const statusLines = gitOutput(['status', '--short'], worktreePath).stdout
        .split(/\r?\n/)
        .filter(Boolean)

    console.log(`\nDeployment changes: ${shortStat || 'no file changes'}`)
    if (statusLines.length > 0) {
        console.log('Sample staged paths:')
        for (const line of statusLines.slice(0, 20)) {
            console.log(`  ${line}`)
        }
        if (statusLines.length > 20) {
            console.log(`  ...and ${statusLines.length - 20} more paths`)
        }
    }
}

function verifyProtectedDeploymentPaths(worktreePath) {
    const trackedPublicFiles = gitOutput(
        ['ls-files', '--', 'public'],
        worktreePath,
    ).stdout
    if (trackedPublicFiles) {
        fail('Refusing to deploy because public/ would be tracked by Git.')
    }

    const trackedEnvironmentFile = gitOutput(
        ['ls-files', '--', '.env'],
        worktreePath,
    ).stdout
    if (trackedEnvironmentFile) {
        fail('Refusing to deploy because .env would be tracked by Git.')
    }

    const trackedScripts = gitOutput(
        ['ls-files', '--', 'scripts'],
        worktreePath,
    ).stdout
        .split(/\r?\n/)
        .filter(Boolean)
    const expectedScripts = DEPLOY_SCRIPT_FILES.map(file => `scripts/${file}`)
    const unexpectedScripts = trackedScripts.filter(file => !expectedScripts.includes(file))
    const missingScripts = expectedScripts.filter(file => !trackedScripts.includes(file))

    if (unexpectedScripts.length > 0 || missingScripts.length > 0) {
        fail([
            unexpectedScripts.length > 0 ? `unexpected deployment scripts: ${unexpectedScripts.join(', ')}` : '',
            missingScripts.length > 0 ? `missing deployment scripts: ${missingScripts.join(', ')}` : '',
        ].filter(Boolean).join('; '))
    }

    for (const scriptPath of expectedScripts) {
        const scriptContents = readFileSync(join(worktreePath, scriptPath))
        if (scriptContents.includes(13)) {
            fail(`${scriptPath} must use Unix LF line endings for Hostinger.`)
        }

        const stagedEntry = gitOutput(
            ['ls-files', '--stage', '--', scriptPath],
            worktreePath,
        ).stdout
        if (!stagedEntry.startsWith('100755 ')) {
            fail(`${scriptPath} must be executable in the Hostinger deployment branch.`)
        }
    }
}

const options = parseArguments(process.argv.slice(2))
const repositoryResult = gitOutput(['rev-parse', '--show-toplevel'], process.cwd(), true)

if (repositoryResult.status !== 0) {
    fail('Run this command from inside the iPawcus Git repository.')
}

const repositoryRoot = resolve(repositoryResult.stdout)
const distDirectory = join(repositoryRoot, 'dist')
const phpDirectory = join(repositoryRoot, 'php')
let worktreePath = null
let worktreeRegistered = false

validateRepository(repositoryRoot, options)

try {
    console.log(`Preparing Hostinger deployment branch: ${options.remote}/${options.branch}`)

    if (!options.skipBuild) {
        console.log('\nBuilding the frontend...')
        runNpm(['run', 'build'], { cwd: repositoryRoot })
    }

    if (!existsSync(join(distDirectory, 'index.html'))) {
        fail('dist/index.html was not produced by the build.')
    }

    if (!options.dryRun) {
        console.log('\nFetching the latest remote branches...')
        git(['fetch', '--prune', options.remote], { cwd: repositoryRoot })
    } else {
        console.log('\nDry run: using local remote-tracking data; no fetch or push will occur.')
    }

    const remoteRef = `refs/remotes/${options.remote}/${options.branch}`
    const remoteBranch = gitOutput(['rev-parse', '--verify', '--quiet', remoteRef], repositoryRoot, true)
    const baseReference = remoteBranch.status === 0 ? remoteRef : 'HEAD'

    if (remoteBranch.status !== 0) {
        console.log(`Remote branch ${options.remote}/${options.branch} does not exist yet; it will be created.`)
    }

    worktreePath = mkdtempSync(join(tmpdir(), WORKTREE_PREFIX))
    git(['worktree', 'add', '--detach', worktreePath, baseReference], { cwd: repositoryRoot })
    worktreeRegistered = true
    cleanWorktree(worktreePath)
    console.log('Runtime media remains in public_html/ipawcus_runtime_media, outside this Git deployment directory.')

    copyDirectoryContents(distDirectory, worktreePath)
    cpSync(phpDirectory, join(worktreePath, 'php'), { recursive: true, force: true })
    for (const file of COMPOSER_FILES) {
        cpSync(join(repositoryRoot, file), join(worktreePath, file), { force: true })
    }

    copyDeploymentScripts(repositoryRoot, worktreePath)

    // Apache routing and PHP upload limits must ship with the deployed PHP API.
    for (const file of SERVER_CONFIG_FILES) {
        const source = join(repositoryRoot, file)
        if (existsSync(source)) {
            cpSync(source, join(worktreePath, file), { force: true })
        }
    }

    excludeRuntimeMediaDirectories(worktreePath)
    git(['-c', 'core.autocrlf=false', 'add', '--all'], { cwd: worktreePath })
    for (const file of DEPLOY_SCRIPT_FILES) {
        git(['update-index', '--chmod=+x', '--', `scripts/${file}`], { cwd: worktreePath })
    }
    verifyProtectedDeploymentPaths(worktreePath)
    summarizeStagedDeployment(worktreePath)

    const stagedDiff = gitOutput(['diff', '--cached', '--quiet'], worktreePath, true)
    if (stagedDiff.status === 0) {
        console.log('\nThe deployment branch already matches the current build and PHP files.')
        process.exitCode = 0
    } else if (options.dryRun) {
        console.log('\nDry run complete. Nothing was committed or pushed.')
        process.exitCode = 0
    } else {
        const timestamp = new Date().toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC')
        const commitMessage = options.message ?? `deploy: update Hostinger site (${timestamp})`
        git(['commit', '-m', commitMessage], { cwd: worktreePath })

        const commit = gitOutput(['rev-parse', '--short', 'HEAD'], worktreePath).stdout
        console.log(`\nPushing deployment commit ${commit}...`)
        git(['push', options.remote, `HEAD:refs/heads/${options.branch}`], { cwd: worktreePath })
        console.log(`\nHostinger deployment branch updated: ${options.remote}/${options.branch}`)
    }
} finally {
    if (worktreeRegistered && worktreePath) {
        const relativeWorktree = relative(repositoryRoot, worktreePath)
        console.log(`\nCleaning temporary worktree (${basename(worktreePath)})...`)
        const removal = gitOutput(['worktree', 'remove', '--force', worktreePath], repositoryRoot, true)
        if (removal.status !== 0) {
            console.warn(`Could not unregister temporary worktree ${relativeWorktree}: ${removal.stderr}`)
        }
        gitOutput(['worktree', 'prune'], repositoryRoot, true)
    } else if (worktreePath && existsSync(worktreePath)) {
        assertSafeTemporaryPath(worktreePath)
        rmSync(worktreePath, { recursive: true, force: true })
    }
}
