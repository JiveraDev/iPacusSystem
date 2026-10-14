# Google identity integration and testing

Updated: 2026-10-14.

October 14 update: Google prerequisites pass against the new isolated database. Stop the interactive sandbox, then run `npm.cmd run sandbox:google`. This includes real schema checks without contacting the original database. Actual Google authentication still needs the sandbox origin authorized in Google Cloud. See [database sandbox](database_sandbox.md).

The normal `.env` connection now also passes the basic prerequisite probe, but the deeper export comparison found missing primary/unique keys, foreign keys and auto-increment settings. Treat registration/session/linking as unverified until the schema import is completed. [Configured database findings](20261014_database_verification.md).

## Configuration

PHP loads root `.env`; Vite loads `.env` plus mode-specific overrides. Restart both processes after editing configuration. The supplied local `env` file was copied into `.env`; the original remains intact and both are ignored. Local frontend origins were added to `.env`.

```dotenv
VITE_GOOGLE_CLIENT_ID=YOUR_WEB_CLIENT_ID.apps.googleusercontent.com
GOOGLE_CLIENT_ID=YOUR_WEB_CLIENT_ID.apps.googleusercontent.com
FRONTEND_ORIGIN=http://localhost:5173,http://127.0.0.1:5173
```

Both client IDs must identify the same Google web application. Register the exact frontend origins in Google Cloud's authorized JavaScript origins, including the actual scheme and port. Production needs its HTTPS origin configured in Google Cloud and `FRONTEND_ORIGIN`. This project uses the JavaScript credential callback rather than a redirect/code exchange; no client secret belongs in frontend code.

Install dependencies with `composer install`. Review and apply `DDL/20260917_01_google_identity.sql` together with the email-verification and access-token migrations appropriate to the current database. The identity migration alone does not add every prerequisite user/session column. Google-only registration inserts a NULL password; the user column must permit that. No migration was applied during this audit.

Use [Google's server verification guide](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token) and [JavaScript reference](https://developers.google.com/identity/gsi/web/reference/js-reference) when changing verification or button behavior. Identity is keyed by verified `sub`, not an email alone. The server uses the Google PHP verifier, and custom JSON callbacks are protected with the application's trusted-origin check.

## Connected flow

1. `GoogleContinueButton` loads Google's identity script and renders its button.
2. The callback sends the credential to `/auth/google` using the shared API client.
3. PHP verifies the credential and looks up the provider subject.
4. An existing linked identity receives an access token and its existing account role.
5. An existing unlinked account with that email receives `GOOGLE_LINK_REQUIRED`; sign in normally and connect from Profile.
6. A new identity receives a short-lived onboarding token. Completing required contact fields and terms creates a pet-owner account and consumes that token transactionally.
7. `/account/google` checks or connects the signed-in user's identity; a mismatched email or conflicting identity is rejected.

Malformed and not-yet-valid JWT exceptions now return `401 GOOGLE_CREDENTIAL_INVALID`. Unexpected installation/network errors retain endpoint error handling. Onboarding expiry uses the database clock, matching the database's expiry comparison.

After signature verification, the application explicitly requires its configured audience, a future numeric expiry and a recognized Google issuer. Regression fixtures cover missing/wrong audience and missing/expired expiry as well as invalid/malformed credentials. These fixtures do not establish that a real Google login works.

## Repeatable checks

```powershell
npm.cmd run check:google
php scripts/tests/google-auth-regression.php
php scripts/tests/google-auth-regression.php --malformed
npm.cmd run check
```

The readiness probe checks configuration, matching IDs, PHP extensions, Composer verifier, local database reachability and prerequisite schema without modifying records or printing credentials. It refuses database probes for a non-local host. The regression uses a CLI-only verifier fixture; it does not validate Google's real signed tokens or create sessions.

October 13 result: local configuration, IDs, trusted origin, extensions and verifier pass. Database readiness fails, and the controller health endpoint returns `503 database_unavailable`. Real Google sign-in is therefore still unverified.

## Browser scenarios once the local database is ready

| Scenario | Expected result |
| --- | --- |
| New Google user | Complete owner profile/terms, then access only owner workflows |
| Existing password user, unlinked | Receive link-required guidance without silently merging accounts |
| Same-email connection from Profile | Link to the current account and preserve its role |
| Different-email connection | Reject with `GOOGLE_EMAIL_MISMATCH` |
| Identity already linked elsewhere | Reject the conflicting link |
| Returning owner/admin/super-admin/vet | Preserve database role; navigate to permitted workflows |
| Deactivated staff profile | Reject sign-in |
| Archived account | Preserve documented archive-as-list-marker behavior |
| Expired/reused onboarding token | Reject without duplicate accounts |
| Invalid credential/wrong audience/unverified email | Reject without issuing an access token |
| Untrusted Origin | Reject the request |
| Blocked Google script, slow load, repeated click | Useful retry/error state; no duplicate submission |
| Logout and subsequent sign-in | Clear local session and reset Google auto-selection |
| Narrow screen and light/dark themes | Readable button, errors, loading state and keyboard focus |

Use localhost frontend port 5173 for the default setup. A different port requires updates in both the server origin allowlist and Google Cloud. Apache staging must also verify popup headers and private-file restrictions.
