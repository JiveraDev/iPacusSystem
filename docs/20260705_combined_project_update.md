# 2026-07-05 Combined Project Update

This note combines the current scheduling, date-input, account-directory, report, and medical-record notification changes into one release document.

## Suggested Commit Message

```text
feat: improve scheduling calendar, date inputs, account controls, and owner notifications

Redesign the TODO schedule into a calendar-app style experience with month,
week, day, and agenda views, slot/range task creation, stored end times, and
responsive calendar styling.

Standardize project date fields through the shared Mantine-backed input,
refresh report date controls, add safer account removal with master-key
verification and notifications, and notify pet owners only when medical
records actually change.
```

## Update Scope

- Frontend scheduling and TODO calendar behavior.
- Shared project date picker and report date filters.
- Super Admin account directory interaction and account removal workflow.
- Pet medical record owner notification behavior.
- Backend account delete route, account list filtering, and notification support.
- Dependency and app-provider setup for Mantine, Day.js, and React Big Calendar.

## Scheduling Calendar

- Replaced the old hand-built TODO month grid and side agenda with `react-big-calendar`.
- Added calendar views:
  - Month
  - Week
  - Day
  - Agenda
- Removed the redundant selected-day footer that showed visible item counts and a second Add Task button.
- Calendar events now show directly in the calendar surface.
- Clicking an existing editable personal task opens it for editing.
- Clicking clinic-owned tasks opens the schedule/day dialog without allowing source edits.
- Selecting a calendar slot opens the task dialog with the selected date and start time already filled.
- Dragging a time range fills start date, start time, end date, and end time.
- Month-view date selection defaults to a reasonable 9:00 AM start when the calendar only provides a date.
- Multi-day month selection stores a date range with a default working-day end.
- Personal TODOs now send and store `endAt` so the selected range is persisted through `pet_owner_todos.end_at`.
- Calendar events render with stored end times when available.
- Slot hover, selected slot, and selected-day styling were added for a more familiar calendar-app feel.

Changed files:

- `src/components/PetOwnerDashboard/Todos.jsx`
- `src/index.css`
- `src/services/todoService.js` already supported `endAt` payloads through generic JSON posting.
- `php/pet_owner_todos.php` already accepts `endAt` and persists it to `end_at`.

## Shared Date Picker

- Added Mantine provider and styles at the app root.
- Updated shared `Input` so `type="date"` renders with Mantine `DatePickerInput`.
- Preserved existing form behavior by keeping changed values as `YYYY-MM-DD`.
- Preserved `name`, `id`, `required`, `disabled`, `readOnly`, `min`, and `max` behavior for existing forms.
- Added a consistent calendar icon position so date icons no longer overlap the input text on small screens.
- Date fields across booking, pet registration/profile, inventory, account creation, diagnosis, service booking, TODOs, and reports now share the same behavior when they use `src/ui/input.jsx`.

Changed files:

- `src/main.jsx`
- `src/ui/input.jsx`
- `src/components/SuperAdminDashboardComponent/ReportDateInput.jsx`
- `src/components/SuperAdminDashboardComponent/SuperAdminReportCenter.jsx`
- `src/components/SuperAdminDashboardComponent/SuperAdminReportsDashboard.jsx`

New dependencies:

- `@mantine/core`
- `@mantine/dates`
- `@mantine/hooks`
- `dayjs`
- `react-big-calendar`

## Report Date Controls

- Report Center and Reports Dashboard custom date filters now use the shared date picker wrapper.
- Calendar icons are aligned through the shared input rather than local one-off styles.
- Date values remain API-safe as `YYYY-MM-DD`.

## Account Directory

- The Account Directory table now uses the row itself as the view activator.
- The separate action column was removed from the desktop table to reduce visual clutter.
- A delete/remove account workflow was added for Super Admin.
- Removal requires master-key verification.
- Super Admin accounts cannot be removed from this action.
- The current signed-in actor cannot remove their own account.
- Removed accounts are soft-deactivated instead of physically deleted.
- Deactivated staff are filtered out of the active account directory.
- Removed users and Super Admin auditors receive notifications.

Changed files:

- `src/components/SuperAdminDashboardComponent/AccountManagement.jsx`
- `src/services/accountService.js`
- `php/delete_account.php`
- `php/get_accounts.php`
- `php/index.php`

Required environment variable:

```text
MASTER_KEY=your-master-key
```

The endpoint also accepts `VITE_MASTER_KEY` as a fallback, but production should prefer a backend-only `MASTER_KEY`.

## Medical Record Notifications

- Medical record updates now notify the pet owner only when meaningful record content changes.
- No notification is sent when the editor is saved without actual changes.
- The notification includes context for the changed medical record while avoiding duplicate noise.

Changed file:

- `php/pet_medical_records.php`

## Backend Routes

New or updated routes:

```text
DELETE /accounts/{userId}
GET    /users/{userId}/todos
POST   /todos
PATCH  /todos/{todoId}
DELETE /todos/{todoId}
```

The account removal route is exposed through `php/index.php` and implemented by `php/delete_account.php`.

## Database Notes

Before account removal can be used in a database that does not already have account status columns, apply:

```sql
ALTER TABLE users ADD COLUMN account_status ENUM('active','deactivated') NOT NULL DEFAULT 'active' AFTER role;
ALTER TABLE users ADD COLUMN deactivated_at DATETIME NULL AFTER account_status;
ALTER TABLE users ADD COLUMN deactivation_reason TEXT NULL AFTER deactivated_at;
```

For existing databases where `pet_owner_todos` was created before range scheduling support, confirm `end_at` exists. If it is missing, add:

```sql
ALTER TABLE pet_owner_todos ADD COLUMN end_at DATETIME NULL AFTER start_at;
```

Do not run duplicate `ALTER TABLE ... ADD COLUMN` statements on columns that already exist.

## Verification Completed

Frontend checks:

```text
npm run lint
npm run build
```

PHP syntax checks:

```text
php -l php/get_accounts.php
php -l php/index.php
php -l php/pet_medical_records.php
php -l php/delete_account.php
```

All commands completed successfully.

## Manual QA Checklist

- Open `/dashboard/todos`.
- Check Month, Week, Day, and Agenda calendar views.
- Click a day and confirm the task dialog preselects the clicked date.
- Drag a time range in Week or Day view and confirm start/end fields are prefilled.
- Save a personal task and confirm the event renders with the selected time range.
- Edit the saved task and confirm start/end values reload correctly.
- Confirm clinic-generated events cannot be modified like personal tasks.
- Check date fields in reports, booking forms, inventory forms, pet forms, and diagnosis forms at mobile and desktop widths.
- Open Account Directory and confirm table rows open account details.
- Test account removal with an incorrect master key and a valid master key.
- Confirm deactivated accounts disappear from active directory results.
- Confirm notification delivery for account removal and medical-record updates.
- Save a medical record with no content changes and confirm no owner notification is created.

## Deployment Notes

- Deploy frontend and backend together because the account removal UI depends on the new PHP route.
- Apply the database changes before enabling account removal in production.
- Confirm `MASTER_KEY` is set in the backend runtime environment.
- Keep existing debug bypass behavior in `Dashboard` and `dashboardRouter` unchanged unless a separate authorized hardening task explicitly changes it.
- Run the build in the deployment environment after dependency installation because `react-big-calendar`, Mantine, and Day.js are now required.

## Files Changed Or Added

Tracked changes:

- `package.json`
- `package-lock.json`
- `php/get_accounts.php`
- `php/index.php`
- `php/pet_medical_records.php`
- `src/components/PetOwnerDashboard/Todos.jsx`
- `src/components/SuperAdminDashboardComponent/AccountManagement.jsx`
- `src/components/SuperAdminDashboardComponent/SuperAdminReportCenter.jsx`
- `src/components/SuperAdminDashboardComponent/SuperAdminReportsDashboard.jsx`
- `src/index.css`
- `src/main.jsx`
- `src/services/accountService.js`
- `src/ui/input.jsx`

New files:

- `php/delete_account.php`
- `src/components/SuperAdminDashboardComponent/ReportDateInput.jsx`
- `docs/20260705_combined_project_update.md`
