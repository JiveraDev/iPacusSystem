# iPawcus clinic and pet-owner portal

Updated: 2026-10-14.

React 19, Vite 8, Tailwind CSS and PHP/MySQL support pet owners, administrators, veterinarians and super administrators. Features include pets and shared ownership, appointments, queues, clinical records, prescriptions, grooming, boarding, billing, inventory, consent, notifications and reporting.

## Start locally

1. Install JavaScript dependencies with `npm install` and PHP dependencies with `composer install`.
2. Configure the ignored root `.env`. PHP loads this exact filename; a file named `env` is not loaded. `.env.example.production` lists settings; supply your own values.
3. Start the local MySQL database and apply migrations appropriate to your database version. See [the SQL runbook](docs/deployed_server_sql_runbook.md). Review migration/seed effects before running them.
4. Run `npm run dev`. This launches PHP at port 8000 and Vite at port 5173. `.env.development` selects the local API.

In Windows PowerShell, use `npm.cmd` when execution policy blocks `npm.ps1`. `IPAWCUS_PHP_BINARY` selects a PHP executable for the development launcher and full check runner.

`npm run server` aliases `npm run php:dev` for the PHP API alone. Its obsolete reference to a missing Node server was corrected during the repeat audit.

## Run with an isolated test database

The latest supplied schema has been installed in a separate sandbox with 88 tables and synthetic users. Run `npm.cmd run sandbox` and open `http://127.0.0.1:5183/`. Use `owner@sandbox.invalid`, `admin@sandbox.invalid`, `vet@sandbox.invalid` or `superadmin@sandbox.invalid`, password `Sandbox-Test-2026!`. See [sandbox setup, isolation and tests](docs/database_sandbox.md). Stop with Ctrl+C or `npm.cmd run sandbox:stop`. The original `.env` and database are unchanged.

## Verification commands

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
npm.cmd run check
npm.cmd run check:google
npm.cmd run check:db
```

`check` runs frontend tests, lint, build, PHP syntax, selected database-free PHP regressions and the local API router test. Logs and a machine-readable summary go to ignored `tmp/project-audit/`. Google readiness is separate and intentionally fails when the local database or configuration is unavailable. Database-dependent and browser workflows require additional testing.

## Documentation

- [Current audit and four-role workflow checklist](docs/20261013_project_audit.md)
- [Configured database findings and Pet Hotel clinic selector](docs/20261014_database_verification.md)
- [Google integration setup and tests](docs/google_integration_testing.md)
- [Capability and process reference](docs/CURRENT_SYSTEM_CAPABILITIES.md)
- [User instructions](USER_INSTRUCTIONS_FOR_DIFFERENT_ROLES.md)
- [Installed skills](docs/installed_skills.md)
- [Documentation index](docs/README.md)
- [Deployment instructions](docs/hostinger_git_deployment.md)

## Structure and access

`src/components` contains screens, `src/ui` shared controls, `src/services` API clients, and `php/index.php` the API controller. SQL exports and migrations live in `DDL/`. Uploaded media has its own endpoint and access checks. `dist/` is generated output.

API requests must use the controller. Apache blocks direct PHP endpoint files, environment files, vendor, scripts, test files and temporary output. PHP's built-in server ignores `.htaccess`; development commands therefore use `scripts/local-api-router.php`. Restart old servers to apply this protection.

The dashboard and dashboard-router debug bypasses are intentionally preserved. PHP authorization, ownership, branch and assignment checks remain the data security boundary. Secrets must not use `VITE_` variables: those values are compiled into browser code.

## Verification on 2026-10-13

The full check runner passed 197/197 checks, including build, lint, 178 PHP syntax checks and the selected regressions. All 87 existing frontend tests passed. Added role-policy, Google failure and router checks are described in the audit. Hostinger preview completed with exit code 0; nothing was deployed. Local database readiness failed. Real Google login, SMTP delivery, push, video meetings and complete browser journeys remain unverified.
