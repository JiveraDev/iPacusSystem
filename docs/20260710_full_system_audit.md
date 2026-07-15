# iPawcus Full System Audit

Date: 2026-07-10  
Scope: React/Vite frontend, PHP API, database migrations, public/static assets, Hostinger deployment operations, and current working-tree changes.  
Guide reference: Elementor comprehensive website audit guide: https://elementor.com/blog/guide-to-comprehensive-website-audit/

## Executive Summary

The system is functional and has improved recently in co-parent approval, reports, date inputs, role routing, mail queueing, auto-refresh behavior, and database read performance. Build, lint, dependency audit, and PHP syntax checks passed during this audit.

The highest risks before production are not normal UI bugs. They are deployment/security items:

1. Production-looking credentials exist in `.env.example.production`; rotate those values and replace the file with placeholders only.
2. The PHP API currently sends permissive CORS headers and enables `display_errors` in `php/index.php`.
3. Uploaded media is partly protected by `/uploads/media/...`, but `.htaccess` also serves upload directories directly.
4. Access tokens can be placed in media query strings, which can leak into logs/history/referrers.
5. Hostinger mail queue requires a scheduled cron job; the DB script alone does not send queued email.

## Audit Evidence

- Frontend dependency audit: `npm audit --json` and `npm audit --omit=dev --json` reported 0 vulnerabilities.
- Frontend validation already passed after performance changes: `npm run lint`, `npm run build`.
- PHP validation: all PHP files under `php/` passed `php -l`.
- Whitespace validation: `git diff --check` reported only existing CRLF conversion warnings, no whitespace errors.
- Project inventory: 328 files across `src`, `php`, `public`, `docs`, and `DDL`, totaling about 14.46 MB.

## Critical Findings

### C1. Production-Looking Secrets In Example Env

Evidence: `.env.example.production` contains live-looking DB, mail, OTP, notification, VAPID, master-key, and third-party API values.

Risk: If committed or deployed publicly, anyone with repository or file access can use those credentials. If uploaded to Hostinger public root, it may be retrievable unless blocked.

Fix:
- Rotate DB password, mail password, OTP secret, notification reminder key, VAPID keys, Geoapify key, and master key.
- Replace `.env.example.production` with placeholders only.
- Add `.env.*` deny rules to `.htaccess`, not only `.env`.
- Keep real values only in Hostinger environment/config.

### C2. Production API Exposes Broad CORS And PHP Errors

Evidence: `php/index.php` sets `Access-Control-Allow-Origin: *` and `ini_set('display_errors', 1)`. `php/upload.php` and `php/delete_upload.php` also set broad CORS.

Risk: Browser clients from any origin can call the API if they have a token. Displayed PHP errors can leak SQL, filesystem paths, and internal state.

Fix:
- Set CORS to `FRONTEND_ORIGIN=https://ipawcus.com`.
- Disable `display_errors` in production and log errors instead.
- Return generic API errors to users.

### C3. Uploaded Media Can Bypass Protected Reader

Evidence: `.htaccess` rewrites direct paths like `payments`, `concerns`, `signatures`, `diagnosis`, `boarding_documents`, and `inventory_receipts` to `public/...`. The protected media reader exists at `php/upload_media.php`, but direct static URLs can bypass role checks.

Risk: Payment proofs, signatures, concerns, diagnosis attachments, and boarding documents may be viewable by URL if the path is known.

Fix:
- Stop serving sensitive upload directories directly.
- Serve sensitive files only through `/uploads/media/{path}` with token checks.
- Keep public only for truly public assets such as logo/favicon/QR if required.

### C4. Access Tokens In Media Query Strings

Evidence: `src/lib/image.js` appends `access_token` to media URLs.

Risk: Tokens in URLs can appear in logs, browser history, screenshots, referrers, reverse proxies, and support tooling.

Fix:
- Fetch protected images with `Authorization: Bearer ...` and render as object URLs.
- Or issue short-lived signed media URLs that cannot be reused broadly.

### C5. Debug Files And Debug Routes Need Production Cleanup

Evidence: debug helpers were moved to `phpTestfiles/`. The live API route `/queues/debug` has been removed from `php/index.php`.

Risk: Debug files at document root can leak internal state if deployed. Protected debug routes still increase attack surface.

Fix:
- Remove root debug files from deployment.
- Keep debug endpoints behind an environment flag like `DEBUG_TOOLS_ENABLED=1`.
- Deny debug files in `.htaccess`.

## High Findings

### H1. Route Policy Falls Back To All Roles

Evidence: `php/role_access.php` returns `['roles' => ipawcus_roles('all')]` for unmatched policies.

Risk: New endpoints can accidentally become available to all authenticated roles.

Fix: Change the default to deny by default, then explicitly allow each route.

### H2. File Upload Validation Is Too Light

Evidence: `php/upload.php` accepts uploaded image/file, sanitizes filename, and moves it. It does not enforce size, MIME sniffing allowlist, extension allowlist, image re-encoding, virus scanning, or private storage.

Risk: Oversized files, disguised files, executable content, and storage abuse.

Fix:
- Enforce max file size per upload type.
- Verify MIME with `finfo_file`, not only extension.
- Use allowlists per type.
- Store sensitive uploads outside public root.
- Use safer permissions than `0777`.

### H3. LocalStorage Token Storage Raises XSS Impact

Evidence: access token and user object are stored in `localStorage`.

Risk: Any XSS can steal long-lived API tokens.

Fix:
- Prefer secure, HttpOnly, SameSite cookies.
- If localStorage remains, add a strict CSP, reduce token TTL, add refresh-token rotation, and remove query-token media access.

### H4. No Visible Rate Limiting For Login

Evidence: OTP cooldown exists, but login itself does not show request throttling or lockout.

Risk: Brute-force password attempts against user accounts.

Fix:
- Add per-IP and per-email login throttling.
- Log failed attempts.
- Add temporary lockout or progressive delay.

### H5. Public SEO Metadata Is Thin

Evidence: `index.html` has only title and viewport. No meta description, canonical, Open Graph, Twitter metadata, robots.txt, or sitemap.xml were found in `public/`.

Risk: Public landing page is less discoverable and less readable when shared.

Fix:
- Add meta description, canonical URL, Open Graph image/title/description.
- Add `robots.txt` and `sitemap.xml` if public indexing is desired.
- Use `/favicon.svg` instead of a source asset path for the favicon.

### H6. Large Assets And Heavy Chunks

Evidence: largest app asset is `src/assets/vetImage.png` at about 2.35 MB. Build output includes large lazy chunks for report charting, TODO calendar, and the shared date/input bundle.

Risk: Slow first load and dashboard navigation on mobile or weak connections.

Fix:
- Convert large PNG/JPG assets to WebP/AVIF and size them for actual display.
- Lazy-load chart/calendar dependencies only on the pages that need them.
- Review the Mantine date bundle and calendar import boundaries.

### H7. Mail Queue Needs Hostinger Cron

Evidence: `mail_queue` and `php/mail_queue_worker.php` exist. Queued emails only send when the worker runs.

Risk: If Hostinger Cron is not configured, email rows stay `pending`.

Fix:
- In Hostinger hPanel > Advanced > Cron Jobs, run every minute:
  `php /home/YOUR_USER/domains/ipawcus.com/public_html/php/mail_queue_worker.php --limit=50`
- Monitor `mail_queue.status`, `attempts`, and `last_error`.

## Medium Findings

### M1. Runtime Schema Changes Should Become Ordered Migrations

Evidence: several helpers create/alter tables at runtime, including auth tokens, notification tables, consent records, medical records, and co-parent helpers.

Risk: Random submit requests can become slow or fail if the DB user lacks ALTER rights.

Fix: Move all runtime schema mutation into DDL scripts and use runtime checks only to report missing migrations.

### M2. Push Worker Notification Reads May Lack Authorization

Evidence: `public/ipawcus-push-sw.js` fetches `/notifications?...` without an Authorization header.

Risk: Push notification click/read behavior may fail in production after strict auth.

Fix: Either pass a safe worker token, use browser push payload content, or expose a narrowly scoped endpoint for service-worker notification reads.

### M3. Frontend Route Roles Are Broad In Some Areas

Evidence: `dashboardRouter.jsx` and `Dashboard.jsx` allow `ALL_ROLES` on several dashboard routes. Backend role access is stronger and should remain the real security boundary.

Risk: Users can navigate to screens they cannot use, creating confusing 403 states.

Fix: Tighten frontend route role arrays to match backend policies after validating each role workflow.

### M4. Accessibility Needs A Tool-Based Pass

Evidence: many controls are custom buttons, icon buttons, dialogs, tables, cards, and overlays. Some aria labels exist, but coverage is not proven.

Risk: keyboard and screen-reader users may hit unlabeled icon controls, weak focus order, or modal focus traps.

Fix:
- Run axe/Playwright accessibility checks.
- Verify all icon-only buttons have aria labels.
- Verify dialogs trap focus and return focus to trigger.
- Check contrast in light and dark themes.

### M5. No Automated Functional Test Suite

Evidence: `package.json` has lint/build only; no test runner script.

Risk: high-risk flows rely on manual testing: booking, queue, POS, co-parent approvals, record updates, diagnosis, boarding, and payments.

Fix:
- Add smoke tests for login, role routing, booking creation, POS payment, co-parent request approval, and mail queue creation.
- Add PHP endpoint tests for authorization boundaries.

### M6. README And Deployment Docs Need Cleanup

Evidence: root README has encoding artifacts, references `tables.sql` that is not present, and contains old deployment notes.

Risk: deployment mistakes, wrong DB import, and confusion around Hostinger cron/API paths.

Fix:
- Replace root README setup with current DDL list.
- Add Hostinger deployment checklist.
- Separate local dev, Hostinger deployment, and Jitsi notes.

## Technical Health Scorecard

| Area | Status | Notes |
| --- | --- | --- |
| Build/lint | Good | `npm run lint` and `npm run build` passed after current changes. |
| PHP syntax | Good | All PHP endpoints passed `php -l`. |
| Dependency security | Good | `npm audit` reports 0 vulnerabilities. |
| Runtime performance | Improving | Mail queue, GET de-dupe, auto-refresh backoff, and indexes added. |
| Security posture | Needs work | Secrets, CORS, display errors, media access, token URLs. |
| Deployment readiness | Partial | Needs Hostinger Cron and env hardening. |
| SEO/public metadata | Weak | Missing robots/sitemap/meta/OG. |
| Accessibility proof | Unknown | Needs axe/manual keyboard testing. |
| Automated tests | Weak | No test framework configured. |
| Observability | Weak | No structured logs, request timing dashboard, or alerting. |

## Hostinger Deployment Checklist

1. Rotate leaked-looking credentials and update Hostinger environment/config.
2. Run required DB migrations:
   - `DDL/20260709_coparent_requests.sql`
   - `DDL/20260710_mail_queue.sql`
   - `DDL/20260710_performance_indexes.sql`
3. Configure Hostinger Cron every minute:
   - `php /home/YOUR_USER/domains/ipawcus.com/public_html/php/mail_queue_worker.php --limit=50`
4. Confirm queue health:
   ```sql
   SELECT status, COUNT(*) FROM mail_queue GROUP BY status;
   SELECT queue_id, to_email, subject, status, attempts, last_error, created_at, sent_at
   FROM mail_queue
   ORDER BY queue_id DESC
   LIMIT 10;
   ```
5. Set production PHP:
   - `display_errors=0`
   - `log_errors=1`
   - CORS restricted to `https://ipawcus.com`
6. Confirm sensitive uploads are not publicly accessible by direct URL.
7. Remove debug PHP files from deployed public root.
8. Add backup schedule for database and uploaded files.

## 24-Hour Action Plan

1. Rotate all credentials that appeared in `.env.example.production`.
2. Replace `.env.example.production` values with placeholders.
3. Configure Hostinger Cron for `mail_queue_worker.php`.
4. Disable PHP `display_errors` in production.
5. Remove direct deployment of root debug files.

## 7-Day Action Plan

1. Lock CORS to `FRONTEND_ORIGIN`.
2. Route sensitive upload directories through protected media endpoint only.
3. Remove access tokens from media query strings.
4. Add upload size/type validation.
5. Add login throttling.
6. Add SEO metadata, `robots.txt`, and `sitemap.xml` for public pages.

## 30-Day Action Plan

1. Move runtime schema mutation into ordered migrations.
2. Add Playwright smoke tests for core workflows.
3. Add accessibility checks with axe.
4. Add request timing logs and slow-query review.
5. Optimize heavy images and large dashboard chunks.
6. Add production backup and restore documentation.

## Notes

- I did not change the preserved dashboard/debug-bypass settings in `Dashboard.jsx` or `dashboardRouter.jsx`.
- This audit is based on local repository evidence and the requested audit-guide structure. It does not include an authenticated live production crawl.
