# Pet Intake error trace

Traced on 2026-10-19 using the supplied screenshots, source code, and the isolated database sandbox. The deployed database and production logs were not accessed.

| Symptom | Cause and evidence | Correction |
| --- | --- | --- |
| `/api/pet-catalog` returns 500 | `php/pet_catalog.php` selected `pet_species` and `pet_breed` from `pet_catalog_options`. That table defines `species` and `breed`. The original query reproduced SQLSTATE 42S22 / driver 1054 in the sandbox. | Read the actual catalog columns. The corrected endpoint returns 200. |
| `/clinical-intakes` returns 503, including for Super Admin | `clinical_intake_require_schema()` rejects requests when `clinical_intakes` is absent. The supplied export used by the sandbox omits this table. The missing table reproduced the 503. This check applies to all roles. | Install the existing intake migration on any affected application database. The page now checks setup before receiving a booking and offering examination actions. |
| The notification hides the reason | The original setup error contained a SQL filename. The shared API error filter replaces technical details with a generic message and `internal_error`. | Keep installation instructions in the server log and return a safe setup message with a stable error code. The page displays a setup notice. |
| Pet Intake is missing from Admin Access | The frontend feature list omitted it; its sidebar entry, dashboard path mapping, and clinical mutations reused the `queue` key. | Add the independent `pet_intake` key to frontend and backend. Existing accounts inherit their previous Queue choice until a separate intake choice is saved. |
| Regular Admin cannot load the veterinarian selector | Pet Intake requested `/accounts`, which is restricted to Super Admin. | Use the existing `/veterinarians` endpoint. Verified Admin receives 200 there and 403 from `/accounts`. |
| Save draft and Complete examination return PATCH 500 | The native prepared update used `CASE WHEN ? = 'completed'`. Changing the sandbox connection to `utf8mb4_unicode_ci` while native parameters use `utf8mb4_general_ci` reproduced error 1267, an illegal mix of collations, for both statuses. | `php/clinical_intake_storage.php` selects the timestamp expression using the validated status in PHP and keeps all clinical data parameterized. No collation or table migration is needed for this fix. |

## Deployment repair

Deploy the source changes and matching frontend build together. In the database used by the deployed PHP application, verify whether `clinical_intakes` exists. If absent, apply [the existing intake migration](../DDL/20261004_01_clinical_intakes.sql). It creates the intake table, indexes, and foreign keys without replacing existing tables. Review any migration failure before retrying; its referenced queue, booking, pet, and user tables must exist.

The separate permission does not require a new permissions-table migration: the existing `feature_key` column stores string keys. Super Admin can configure it under **Accounts → Admin Access → Patient care → Pet Intake**. Queue assignment, booking reception, and consent actions retain their existing separate permissions.

The migration was applied only to the isolated sandbox during this investigation. Deployment and production database repair remain outstanding. A production 503 with a different error code, such as `database_unavailable`, requires checking the corresponding production log rather than assuming the intake table is missing.

For the follow-up PATCH 500 fix, deploy **both** `php/clinical_intakes.php` and the new `php/clinical_intake_storage.php` together. This backend-only change does not require another SQL migration or a frontend rebuild. The live exception was not retrieved, so the collation failure is a reproduced source defect consistent with both failing saves, rather than a production-log confirmation.

## Verification

- `npm run check`: 203/203 checks passed, including frontend tests, lint, production build, PHP syntax, database-free regressions, and local API routing.
- `npm run sandbox:test` includes `scripts/tests/pet-intake-db-regression.php`. That regression uses temporary tables to verify the real catalog query, compatibility/independence of Queue and Pet Intake permissions, and draft/completion updates under matching and differing connection collations. It verifies clinical text, Unicode, JSON fields, clearing the completion time on draft, and preserving the first completion time when re-saving.
- Real browser/API checks with synthetic Admin and Super Admin accounts: receive confirmed booking, start examination, and save draft all returned 200 after installing the migration in the sandbox. Completing without consent remained disabled.
- Follow-up browser/API checks for both roles: save draft → capture a signature → upload its signed consent PDF → save the consent record → Complete examination. Draft, consent record, and completion requests all returned 200; a separate GET confirmed `completed` status and a persisted completion timestamp. Screenshots: `tmp/pet-intake-trace/admin-completed.png` and `superadmin-completed.png`.
- The Admin Access dialog shows a separate Pet Intake choice. Disabling it causes intake POST to return 403. Enabling it while Queue is disabled allows intake POST (200) and still rejects queue assignment (403). Saved permission values were restored afterward.
- With the table absent, the real setup check returned 503 with `schemaReady: false` and `clinical_intake_schema_missing`; the page displayed setup guidance and offered no start actions. Checked at 390, 768, 1920, and 2560 pixel widths in both themes, with no document overflow.
- Dashboard and DashboardRouter debug bypass logic was preserved.

Screenshots and investigation scripts are in ignored `tmp/pet-intake-trace/`. These checks cover the reported failures and standard draft/consent/completion workflow; they do not certify every clinical scenario or the live deployment. Browser resizing also produced ResizeObserver notifications; those are separate from the reproduced database update failure.

The browser follow-up found that the local PHP server could emit an upload startup notice before API error handling ran, corrupting the JSON upload response. The sandbox launcher now disables rendered PHP startup errors before accepting requests, matching the existing production `.user.ini`; server logging remains enabled.
