# Isolated database sandbox

Created and verified: 2026-10-14.

The sandbox runs a real local MariaDB database, PHP API and Vite frontend. It imports **all 88 table definitions, indexes and foreign keys** from the supplied latest dump, `C:\Users\loren\Downloads\u813606159_new_ipawcus_sy.sql`. Source records, accounts, password hashes, tokens, Google identities and stored procedures are not imported. Seven synthetic users, two branches, two pets, service prices and veterinarian booking schedules are supplied instead.

## Run the application

```powershell
npm.cmd run sandbox
```

Open **http://127.0.0.1:5183/**. Keep the terminal open while using the app.

| Component | Sandbox address |
| --- | --- |
| Frontend | `http://127.0.0.1:5183/` |
| PHP controller | `http://127.0.0.1:8018/php/index.php` |
| MariaDB | `127.0.0.1:33308`, database `ipawcus_sandbox` |

All test accounts use password **`Sandbox-Test-2026!`**:

| Account | Role / branch |
| --- | --- |
| `owner@sandbox.invalid` | Owner of Sandbox Mochi |
| `other-owner@sandbox.invalid` | Unrelated owner of Sandbox Miso |
| `admin@sandbox.invalid` | Admin, MAIN branch |
| `other-admin@sandbox.invalid` | Admin, ENRIQUEZ branch |
| `vet@sandbox.invalid` | Active veterinarian, MAIN branch |
| `other-vet@sandbox.invalid` | Active veterinarian, ENRIQUEZ branch |
| `superadmin@sandbox.invalid` | Super Admin |

Fixture users are already email-verified. Many business lists initially remain empty: create bookings, rooms, inventory and care records through normal screens. This is a test fixture, not a copy of live business records. Existing dashboard/router debug bypasses remain unchanged; backend permissions are still exercised with real access tokens.

## Stop and preserve data

Press **Ctrl+C** in the launch terminal, or run this in another terminal:

```powershell
npm.cmd run sandbox:stop
```

Stopping retains the sandbox data. The next `sandbox` command resumes it. The explicit stop command authenticates to this instance before shutting down its database; the launcher then closes PHP and Vite. If the sandbox is already stopped, the explicit stop command reports a connection error rather than contacting another database.

## Tests

Stop the interactive sandbox before these commands. Each starts its own sandbox processes, runs checks and shuts them down:

```powershell
npm.cmd run sandbox:test
npm.cmd run sandbox:google
npm.cmd run check
```

Verified results:

- 45 real HTTP/API checks, including seven password logins, role gates, owner isolation, account-directory password-hash exclusion and unlinked Google status.
- Service-catalog database regression and grooming database regression pass using temporary tables.
- Grooming prerequisite schema and private media storage checks pass.
- Google configuration/dependency/schema readiness passes, including identity/onboarding/session tables, email verification and nullable passwords.
- Schema extraction regressions pass and exclude source records/routines, including dump tables with omitted engine clauses.
- Full default check runner passes 200/200 checks. Default checks remain independent of the sandbox.
- HTTP checks: frontend and both direct/proxied health endpoints return 200; Vite denies sandbox state files with 403 and PHP denies environment files with 404.

Logs are in ignored `tmp/db-sandbox/`; API results are in `smoke-results.json`. The normal `check` logs remain under `tmp/project-audit/`.

## Setup on another checkout

The sandbox was already created in this workspace. On a fresh checkout with XAMPP MariaDB installed:

```powershell
npm.cmd run sandbox:setup -- --dump "C:\path\to\latest-export.sql"
```

Setup extracts schema only. It refuses an existing data folder or state file and never drops/replaces an existing database. Do not rerun old migrations over this latest complete schema unless a specific migration is missing. There is no automatic reset/delete command; existing sandbox data is preserved.

`IPAWCUS_MARIADB_BIN` can select a MariaDB binary directory instead of `C:/xampp/mysql/bin`. The directory must contain `mysql_install_db.exe`, `mysqld.exe`, `mysql.exe` and `mysqladmin.exe`. `IPAWCUS_PHP_BINARY` can select PHP. No Windows service is registered. Ports must be free; existing services are not reused or stopped during startup.

## Isolation and integration limits

- MariaDB uses a separate `tmp/db-sandbox/data` directory and binds only to loopback. Its application user has privileges only on `ipawcus_sandbox`.
- The real root `.env` is unchanged. PHP skips loading it only when launched with the sandbox environment. The sandbox supplies its own connection, dummy master key, OTP secret, origins and storage settings.
- Uploads and activity logs use sandbox folders. Private grooming media uses a separate operating-system temporary directory outside the website tree.
- Email credentials, browser push keys, video integration and Geoapify are disabled. Mail may queue into sandbox tables, but real recipients are not contacted and no worker is launched.
- The existing public Google client IDs are reused. Actual Google login still requires authorizing `http://127.0.0.1:5183` or `http://localhost:5183` in Google Cloud. Google sign-in is not mocked; a real signed credential still goes through server verification. Fake IDs/tokens cannot log in.
- The export reports MariaDB 11.8.9; the installed test binary is MariaDB 10.4.32. These table definitions import successfully, but this does not certify identical production-version behavior. Stored routines and production media are deliberately absent.
- `sandbox:test` covers API smoke checks and selected regressions, not every booking/payment/clinical state transition or browser layout. Follow the [four-role audit checklist](20261013_project_audit.md) for deeper scenarios.
