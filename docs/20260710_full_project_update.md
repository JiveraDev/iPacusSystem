# Full Project Update

Date: 2026-07-10

This document summarizes the current update batch, including UI changes, backend workflow changes, validation, and the database command needed for deployment.

## Database Command Needed

Run this migration for the co-parent approval workflow:

```powershell
cmd /c "mysql -u YOUR_DB_USER -p YOUR_DB_NAME < DDL\20260709_coparent_requests.sql"
```

Replace `YOUR_DB_USER` and `YOUR_DB_NAME` with the actual database credentials/name.

This migration is needed because the old `pet_ownership` table allowed only one owner per pet through a unique `pet_id` index. Co-parenting requires multiple owners for one pet.

The migration:

- Adds `pet_ownership.relationship`
- Adds `pet_ownership.is_primary`
- Backfills current owners
- Removes the old unique `pet_id` index
- Adds `pet_ownership_pet_idx`
- Adds `pet_ownership_user_pet_unique`
- Creates `pet_coparent_requests`
- Adds `notification_preferences.ownership_updates`

## Co-parent Workflow

- First pet linker becomes the primary owner.
- If another owner links the same Pet Registration ID, the pet is not linked immediately.
- A pending co-parent request is created.
- Primary owner receives an in-app notification and email.
- The email uses a button labeled `Review co-parent request`.
- Clicking the email button or notification opens a modal in `My Pets`.
- Primary owner can approve or decline.
- Approval links the requester as `co_parent`.
- The requester receives status notifications.
- The co-parent modal footer `Close` button was removed.

## Reports

- Reports Dashboard toolbar layout was redesigned.
- Date range controls were made cleaner and more responsive.
- Report Center action controls were improved.
- Payment method filter was removed from Report Center.
- POS/report dashboard financial matching was improved so paid visits inside the selected range are included correctly.

## Date Inputs

- Shared date input behavior now rejects free text.
- Manual date typing is limited to valid date formats.
- Invalid text no longer falls back to browser `Date` parsing.

## Payment Methods

- Super Admin email OTP bypass was removed.
- Payment method updates now require the valid 6-digit OTP.
- The old bypass checkbox/state/payload was removed.

## Account Management

- Added Active/Deactivated filtering.
- Deactivated accounts now appear in the account list.
- Reactivating an account restores `users.account_status = active`.

## Consent Management

- Pet-owner-readable consent assignment is now unique per service.
- Only one template can hold each pet-owner-readable service assignment at a time.
- Upload flow now shows selected TXT file preview and preloads an editable title from the filename.

## Booking and Home Service

- Booking payment sent to POS includes a PHP 50 booking fee.
- A pet can only have one active pending/confirmed booking for the same service type.
- Home service blocks past date/time selection.
- Home service is limited to 2 active bookings per day.
- Afternoon home service is limited to 3 pets per day.
- Confirmed home service bookings can appear in the approved booking list even when not limited to today.

## QRPH and Payment Proof

- Removed visible `View Larger` text from payment image areas.
- Home service confirmation QRPH image was enlarged.
- Home service payment confirmation checkboxes were removed.

## Veterinarian Pages

- Approved queue list now includes upcoming confirmed home service bookings.
- Veterinarian online consultations now have week filtering and search.
- Diagnosis vitals now restrict numeric fields to integer/decimal input.
- Additional consent preview is optional and shown by button.
- Signature submit now closes the consent sheet.
- My List Done section now supports card/table view and only shows Reopen.

## Record Update Requests

- Vet record update request actions were reduced to Details and Update.
- Removed unnecessary Open Medical Records button from the details modal.
- Added Finish Update workflow to notify the pet owner when the update is completed.
- Completion sends an owner notification.

## Medical Records

- Organized summary cleanup removes dragged/copied `Service:` lines.
- Source Diagnosis Sheet is the editable source in grouped records.
- Owner summary/pet notes were reduced in the edited medical record flow.

## TODO Agenda

- Agenda now focuses on upcoming schedules from today.
- Agenda navigation buttons are disabled.
- Agenda title includes month context.
- Empty message now says there are no upcoming schedules from today.

## Boarding

- Fixed room availability SQL collation issue by avoiding the problematic `LIKE` comparison.
- Room type matching now uses explicit room type lists.

## Modals and Call UI

- Dialog overlay was adjusted to remove noticeable white top/bottom outside bands.
- Minimized video call window is movable.

## Reminder Testing

- Added reminder test runner:

```text
phpTestfiles/test_notification_reminders.php
```

- Added reminder guide:

```text
docs/reminder_testing.md
```

The reminder runner supports dry-run and real send modes for booking and TODO reminders.

## Files Added

- `DDL/20260709_coparent_requests.sql`
- `php/coparent_request_helpers.php`
- `php/coparent_requests.php`
- `phpTestfiles/test_notification_reminders.php`
- `docs/reminder_testing.md`
- `docs/20260710_current_update_readme.md`
- `docs/20260710_full_project_update.md`

## Verification

Completed verification:

```bash
npm run lint
npm run build
php -l php/link_pet.php
php -l php/coparent_request_helpers.php
php -l php/coparent_requests.php
php -l php/notification_helpers.php
```

Additional PHP syntax checks were also run for the changed payment, account, booking, consent, reports, record update, room availability, and reminder files.

## Manual QA Checklist

- Run the DB migration.
- Test first owner pet linking.
- Test second owner co-parent request creation.
- Confirm primary owner receives email with button.
- Confirm notification click opens the same modal.
- Approve co-parent request.
- Confirm requester sees the pet in `My Pets`.
- Confirm `pet_ownership` has one primary row and one co-parent row.
- Retest payment method OTP save.
- Retest Report Center and Reports Dashboard.
- Retest booking to POS fee.
- Retest home service limits.
- Retest veterinarian approved list and online consultation filters.
- Retest record update Finish Update notification.
