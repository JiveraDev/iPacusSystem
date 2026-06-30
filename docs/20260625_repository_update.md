# 2026-06-25 Repository Update

This note records the repository changes made after the June 20 documentation pass and the deployment issues identified while reconciling the docs with `master`.

## Repository Baseline

- Reviewed branch: `master`
- Reviewed HEAD: `07fe6fb` (`addjust the notification page for lower screen size (720 lower) added page for it.`, 2026-06-23)
- Commit count: 59
- Latest full DDL export: `DDL/database_ddl_20260622_070744.sql`
- June 18 to June 22 upgrade script: `DDL/realign_20260618_to_20260622.sql`

## Changes Since the June 20 Docs

### Standalone TV Display

Commit `0db1102` added a standalone deployment package under `Subdomain_folder`.

- `index.php` renders the display.
- `status.php` reads status data directly from the database.
- `assets/tv-display.css` and `assets/tv-display.js` provide the standalone UI.
- `.env.example` and `config.example.php` document placeholder configuration.
- The standalone display does not require the React build or the main PHP router.

The existing React routes `/status-display` and `/tv-status` remain available through the main application/API deployment.

### Responsive Notification Center

Commit `07fe6fb` added a dedicated dashboard notification page for smaller screens and refactored notification state into shared modules.

- Route: `/dashboard/notifications`
- Page: `src/components/shared/NotificationsPage.jsx`
- Shared feed: `src/components/shared/NotificationFeed.jsx`
- Shared state: `src/hooks/useNotificationCenter.js`
- Existing bell: `src/components/shared/NotificationBell.jsx`

The page supports all/unread filtering, grouped notifications, incremental loading, mark-read actions, redirect handling, and quiet refresh.

### Account and Profile Management

Super Admin account management can update staff position and employment status through:

```text
PATCH /accounts/{id}/profile
```

The route uses `php/update_account_profile.php` and is exposed through `src/services/accountService.js`.

### Reports and Lifecycle Updates

The latest commit also adjusted:

- Report chart presentation and date labels.
- Revenue/service chart data.
- Consent report compatibility with current and legacy booking/queue signatures.
- Queue expiration handling.
- Status-display lifecycle behavior.
- Admin and veterinarian profile forms.

## Database Alignment

The June 22 export contains 48 tables and now includes:

- `consent_form_records`
- `bookings.consent_forms`
- `bookings.consent_status`
- `users.account_status`
- `users.deactivated_at`
- `users.deactivation_reason`
- `users.last_seen_at`

However, the repository currently has two different `consent_form_records` definitions:

- `DDL/database_ddl_20260622_070744.sql` and `DDL/realign_20260618_to_20260622.sql` use a reduced definition with `signed_document_path`.
- `DDL/20260619_create_consent_form_records.sql` and `php/consent_record_helpers.php` use the richer audit definition with fields such as `visit_id`, `source`, `requested_at`, `signed_file_path`, `physical_file_path`, signer details, processor details, and notes.

`CREATE TABLE IF NOT EXISTS` does not add missing columns to an existing reduced table. Production deployment therefore needs an explicit schema reconciliation migration before consent ledger, report, and media-monitoring behavior can be considered reliable.

The June 22 export also keeps `visit_payments.payment_method` as:

```text
qrph, gcash, maya, bank_transfer
```

Add `cash` before enabling cash POS posting.

## Required Verification

- Import the June 22 full DDL into a clean database and exercise consent creation, reporting, and media monitoring.
- Upgrade a copy of the June 18 database with `realign_20260618_to_20260622.sql`, then compare it with the intended current schema.
- Test `/dashboard/notifications` above and below 720px viewport width.
- Verify notification filters, pagination, mark-all-read, item redirects, and auto-refresh.
- Verify Super Admin staff profile updates and rejection of unauthorized or non-admin targets.
- Test both React and standalone TV displays with privacy-sensitive fields checked.
- Run `npm run lint`, `npm run build`, and PHP syntax checks for changed endpoints before release.

Completed during the documentation update:

- `npm run lint`
- `npm run build`
- PHP syntax checks for `update_account_profile.php`, the main status endpoint, and both standalone TV PHP files
- `git diff --check`

## Security Follow-Up

- Do not commit production database, mail, API, OTP, reminder, or VAPID secrets in example files.
- Rotate exposed credentials and review Git history if real values were ever committed.
- Keep the current dashboard debug-bypass values unchanged until a separately authorized security-hardening task.
