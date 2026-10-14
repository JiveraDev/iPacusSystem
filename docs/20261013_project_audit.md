# Project, integration and role-process audit

Reviewed: 2026-10-13. Branch: `master`; starting HEAD: `a7e9add1`. This review includes uncommitted changes. Existing `package-lock.json` edits were preserved.

## Coverage and evidence

October 14 follow-up: the supplied latest dump now powers a separate **88-table schema-only sandbox**, with synthetic users and separate MariaDB/API/frontend ports. Its health is 200, 45 real API checks and selected service-catalog/grooming database regressions pass, and Google prerequisite readiness passes. Default checks now pass 200/200. The original configured database remains untouched; these results do not certify production data or complete browser journeys. See [sandbox instructions](database_sandbox.md).

The review traced application login/onboarding, dashboard routes, shared API clients, the PHP dispatcher and role policy, and ownership/branch/assignment checks in booking, queue, clinical, profile, grooming and billing handlers. Existing capability documentation was used to locate wider reporting, inventory, boarding, media, consent, notification and deployment areas.

This is a broad source and regression review, not an exhaustive proof of every line or interaction. No authenticated browser, live Google account, SMTP delivery, push delivery, meeting session or production database was tested. Local database readiness failed. Every runtime item below remains a test requirement rather than a claimed success.

## Confirmed problems and changes

| Finding | Change and practical effect |
| --- | --- |
| Configuration supplied as `env`, not `.env` | Copied it to ignored local `.env`; PHP and Vite can load the settings. Original kept intact. Added localhost origins. |
| Legacy environment file could be committed or served | Ignore `env`/`tmp`; block environment variants in Apache and deny the legacy filename in Vite. |
| Legacy PHP files rely on controller authorization | Apache blocks direct handler execution; local PHP uses a controller-only router. API clients still use `php/index.php`. |
| Account directory serialized `u.*`, including password hashes | Remove `user_password` before returning all three directory groups. |
| Malformed Google JWT exceptions became server errors; required claims needed explicit checks | Reject malformed JWTs, missing/wrong audience, missing/expired expiry and invalid issuer with HTTP 401 after signature verification. |
| Google onboarding expiry used PHP time while validation used database time | Calculate expiry with database `NOW()` and the configured 15-minute TTL. |
| Grooming regression expected obsolete manual release | Test rejects manual `ready -> released`, including with pickup flags; current POS full-payment release remains authoritative. |
| Test infrastructure undocumented | Added `npm test`, `npm run check`, Google readiness, role-policy checks and temp logs. |
| Project documentation outdated | Updated README, AGENTS, docs index, capability addendum, role instructions, grooming/deployment guides; added integration and skill references. Historical dated reports retain their original evidence. |

The dashboard and dashboard-router debug bypasses were preserved. No SQL migration, seed, production write, mail send, skill installation or real deployment was performed.

## Automated and local verification

| Check | Result |
| --- | --- |
| Frontend lint | Pass |
| Vite production build | Pass; large chunks remain |
| Existing Node frontend tests | 87 pass |
| Original PHP syntax sweep | 174 files pass |
| Shared veterinarian booking calendar | 123 checks pass |
| Veterinarian booking TODOs | 24 checks pass |
| Clinic opening/lunch rules | 70 checks pass |
| Grooming rules after stale-test correction | 81 checks pass |
| Report presentation | 1,081 assertions pass |
| Report financial helper regression | Pass |
| API error sanitization | Pass |
| Reusable SMTP session fixture | Pass; no real message delivery |
| Four-role route-policy matrix | 110 checks pass, including backups; no database |
| Invalid/malformed Google credentials, missing/wrong audience and missing/expired expiry | Reject with 401 using CLI verifier fixture |
| Local API router | Seven private paths return 404; controller reached |
| Vite HTTP private-file checks | Root page 200; `env`, `.env`, temporary output and vendor paths 403 |
| Local controller health | 503 `database_unavailable` |
| Google readiness | Config/dependencies pass; database check fails |
| Composer manifest validation | Valid; missing-license metadata warning |
| Hostinger deployment preview | See deployment verification below |

Final `npm run check` result: **197/197 checks passed**, including 178 PHP syntax checks and the selected regression commands. These are runner checks, not 197 individual business scenarios; suite assertion counts are listed above. It writes logs and `summary.json` under ignored `tmp/project-audit/`. It executes database-free regressions, not arbitrary test files: several other PHP scripts require migrations, mutate data or send notifications. Run those only against appropriate disposable fixtures. Relative links in all 13 updated/added project Markdown files were checked with no broken targets.

## Four-role authority and interaction matrix

These permissions describe the central PHP route policy. A permitted role still needs resource ownership, branch, assignment and state checks in the handler. Several role groups include Super Admin, but individual handlers can impose additional clinical restrictions.

| Process | Pet owner | Admin | Veterinarian | Super Admin | Runtime checks still needed |
| --- | --- | --- | --- | --- | --- |
| Registration/login | Public owner registration; linked Google identity | Existing staff identity | Existing vet identity | Existing governance identity | OTP, staff inactivity, token expiry, Google role preservation |
| Profiles/Google link | Own profile and matching-email link | Own profile/link | Own profile/link | Own profile/link; governance account tools | Prevent another user's profile access; conflict/replay checks |
| Pets/shared ownership | Own pets; link/co-parent requests | Clinic pet registration | Clinical patient context | Oversight where permitted | Unrelated owner IDs, approval, withdrawn ownership |
| Booking submission | Own linked pets and available services | Assigned branch bookings | Review clinical bookings; no generic submission permission | Permitted clinic submission | Duplicate slots, stale availability, lunch, Sunday/closure, transfer |
| Booking/payment review | Submit proof; permitted own status requests | Review proof/status/refunds | Assigned care/schedule handling | Clinic review and oversight | Wrong branch/owner, duplicate proof, refund reconciliation |
| Queue reception | Self-service request, own queue visibility | Assign/reenter/manage branch queue | Receive assigned clinical patient | Permitted clinic operations | Double receive, stale assignment, urgent priority, branch boundaries |
| Diagnosis/prescriptions | View permitted records and dose actions | Operational record access | Clinical diagnosis and prescriptions | Vet-group routes where handlers allow | Assigned vet only, completed visits, concurrent edits, doses/history |
| Online consultation | Own consultation and meeting | Not in owner-or-vet route group | Assigned consultation | Included by route policy | Participant ownership, meeting JWT/access, disconnect/resume |
| Grooming | Own published summary/photos | Intake, start, finish, catalog and POS | Assigned review/clearance | Branch oversight/clinic handling | Evidence photos, paused care, full payment release, private notes |
| Boarding | Own hotel booking and stays | Room assignment, check-in/out, tasks/materials | Clinical confinement context | Operational oversight | Hotel versus confinement, occupancy collision, charges and discharge |
| Billing/inventory | Permitted own proof/documents | POS, charges, stock and payment operations | Clinical outputs feed billing | Permitted finance/stock oversight | Discounts, refunds, stock reversal, invoice persistence/redeploy |
| Reports/accounts/configuration | No governance access | Feature-limited operations | No governance access | Reports, staff, owner account review, payment settings | Export accuracy, permission toggles, inactive staff and audit history |
| Notifications/TODOs | Own feed and care schedule | Feed; generic TODO route excludes Admin | Personal/booking TODOs | Personal/oversight functions | Recipient privacy, deduplication, timezone, mail/push workers |
| Media/consent | Own authorized records | Branch workflow media/templates | Clinical attachments/review | Governance and allowed clinic media | Direct files, another owner's URL, MIME spoofing, consent signatures |

## Detailed end-to-end runtime checklist

Prepare two unrelated owners, an approved co-owner, two branch admins, two assigned vets and one super admin in a disposable database. Include an inactive staff profile, archived owner, incomplete profile and expired token. Use the actual role values from the database; changing local storage must not change API authority.

1. **Owner journey:** register -> verify email -> complete profile -> add/link pet -> book with branch/consent/proof -> see pending status -> admin reviews -> enter queue -> vet records clinical outcome -> admin bills -> owner views permitted records, prescriptions and notifications. Repeat with Google onboarding and an existing linked identity.
2. **Admin journey:** use assigned branch -> review booking/proof -> assign active branch vet -> manage intake/queue -> bill actual charges -> verify payment -> issue persistent invoice -> update stock. Disable an admin feature with Super Admin and verify that direct mutation attempts fail.
3. **Vet journey:** set availability -> open assigned approved bookings/My List -> receive patient -> diagnose/prescribe -> complete visit -> owner sees permitted clinical results. Another vet must not receive or overwrite assigned care. Check the next-booked-day and TODO date/booking links.
4. **Super Admin journey:** create/manage personnel -> set branch/feature permissions -> inspect owner accounts -> configure payment methods -> inspect audit history -> reconcile report exports against payments/refunds/stock. Archive is a list marker, not a security lock; staff inactivity is separate.
5. **Grooming:** intake and before photo -> active catalog service -> start -> request assigned-vet review if needed -> clearance -> after photo -> finish ready -> POS verifies full payment -> automatic release. Partial/unverified payment must not release; manual pickup flags must not bypass billing.
6. **Boarding:** select hotel type/size/date range -> verify capacity -> assign room -> check in -> observations/tasks/materials -> bill -> check out. Separately verify clinic-controlled confinement and clinical discharge responsibilities.
7. **Cross-user attacks:** attempt other owners' pet/profile/booking/medical/media IDs, another branch's booking/queue/inventory and another vet's assignments. Repeat using handcrafted authenticated HTTP requests, not only hidden menu buttons.
8. **Concurrency/recovery:** simultaneous slot booking, queue receiving, payment, prescription dose and stock edits; simulate timeout/double-click then refresh. Verify no duplicate records or orphaned uploads and calm recovery messages.
9. **Visual interaction:** keyboard-only forms/dialogs, light/dark contrast, loading/error/empty states, quiet auto-refresh and draft persistence at phone, tablet, 1080p and wide desktop sizes. No browser layout checks were performed here.
10. **External services:** real Google signed-token rejection/acceptance, SMTP worker delivery, push permission/subscriptions, Geoapify failures, Jitsi participant access and production health/routing.

## Remaining findings and constraints

- Local database connection/readiness fails. The schema, Google-only NULL password requirement, identity unique constraints and transactional writes cannot be confirmed until it is available.
- Some tracked environment examples contain concrete configuration instead of placeholders. Treat public API identifiers separately from server secrets; review and rotate any real secret already committed. No secret values are reproduced here.
- Existing archive behavior intentionally retains normal permissions and sessions. Optional admin feature lookup defaults to allowed on schema/lookup failure; this is separate from the central role gate.
- Broad frontend route/debug behavior remains as instructed. Central authorization is mandatory, and record-level runtime testing remains outstanding.
- The build still reports large ExcelJS/3D-related bundles and sizable images. Builds succeed; real-device performance and bundle splitting need a separate measured pass.
- GET views are expected to use the shared four-second auto-refresh hook. Its overlap/visibility/backoff behavior was inspected; complete screen-by-screen refresh verification remains a browser task.
- Backup modules and other historically documented features must not be assumed production-ready from source alone. Follow the capability reference's inactive/deployment-dependent labels.
- Apache rules were reviewed, but only the local PHP router was HTTP-tested. Verify Apache behavior and Hostinger outer-directory rewrites on staging.

## Deployment verification

The npm preview builds successfully. Its first sandboxed run failed while creating `.git/worktrees`, a filesystem permission restriction. The permitted retry staged the deployment, checked media/environment exclusions and executable mail-worker layout, completed the dry run and removed its temporary worktree. No fetch, commit or push occurred. PowerShell log redirection represented npm's stderr notices as `NativeCommandError`; the direct terminal retry of `npm.cmd run deploy:hostinger:preview -- --skip-build` exited successfully with code 0. Git remote authentication, push, Hostinger's webhook/build and production health remain untested.

## Repeat verification on October 13

The full runner again reported 197/197 checks passing. Hostinger preview again exited with code 0 and removed its temporary worktree; no fetch, commit, push or deployment occurred. Google configuration/dependency checks still pass, but local database readiness still fails. `git diff --check` passes and only the main worktree remains registered.

`npm ls --depth=0` also completed successfully: installed direct dependencies satisfy the manifest. `composer validate --no-check-publish` remains valid with the missing-license metadata warning. Dependency vulnerability scanning and live third-party connectivity are separate checks and were not performed in this repeat pass.

An additional npm script defect was found: `server` referenced nonexistent `server/userAddPetOwner.js`. It now aliases the existing `php:dev` command and uses the protected local API router. This alias change does not resolve the unavailable MySQL connection. Existing dashboard/router debug bypasses remain unchanged.

## Skills and documentation

See [installed skills](installed_skills.md) for the 11 repository skills and nine system/plugin entries exposed in this session. No skill was installed or edited. See [Google integration testing](google_integration_testing.md) for configuration and the Google-specific checklist. Older dated audit Markdown files remain historical; the docs index now points to this review.
