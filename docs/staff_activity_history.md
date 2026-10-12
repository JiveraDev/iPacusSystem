# Activity Log

Admins, veterinarians, and super admins have an **Activity Log** tab on their profiles. The organization-wide audit is available to Super Admins as the printable **Activity Log Report** in the Report Export & Print Center; it is intentionally not placed in Account Management.

## Install

1. Run `DDL/20260920_01_user_activity_log_file.sql` once against the production database. This adds only `users.activity_log_file`; it does not create an activity table.
2. Deploy the PHP and frontend changes.
3. Confirm the PHP process can write to the persistent runtime media directory. On the current Hostinger layout, logs are created in `public_html/ipawcus_runtime_media/staff_activity/user-<id>.jsonl`. The existing runtime media root and the activity subdirectory both deny direct web access.

`IPAWCUS_ACTIVITY_LOG_DIR` can override the log location with an absolute path if production storage differs. The `users.activity_log_file` value is a relative reference such as `staff_activity/user-42.jsonl`; the API validates that reference before reading.

The activity files are excluded from Git deployment and included in the system backup media scan. Keep an off-server backup of the persistent runtime media directory as well.

## Recorded events

- Successful authenticated POST, PUT, PATCH, and DELETE requests made by staff through the PHP API router.
- Staff sign-ins and dashboard page navigation. Browser reloads and automatic GET refreshes are not logged.
- The actor, role, exact time, action label, target ID when available, branch when it can be resolved from a record, normalized API route, successful response status, and a short operational summary.
- Selected non-sensitive action details when supplied, such as the new status, service type, dates and times, quantities, amounts, assignments, locations, and the number of records in a batch.
- Whether the action was planned in advance. A future date/time supplied with the action is recorded as planned; immediate activity without a future schedule is recorded as not planned. Older entries display **Planning not recorded**.

Complete request bodies are never written to activity files. Detail capture uses a fixed allow-list; passwords, access tokens, payment references, contact details, medical text, free-text notes and reasons, credentials, and uploaded-file paths are excluded. Account-wide actions are labeled **Organization-wide**; clinic actions without a reliable branch are labeled **Branch not recorded**. History starts after deployment; older actions cannot be reconstructed from the new files, and older entries will naturally show fewer details than entries recorded after this update.

Each activity row stays compact and shows its most useful summary first. **View details** reveals the complete safe detail set, exact timestamp, branch, record reference, normalized request, successful HTTP status, and unique log ID.

The shared Activity Log groups entries by day and supports time, log-type, and planning filters. The Super Admin report also filters by user, role, and branch, including separate choices for organization-wide and unresolved-branch records. It loads up to 250 matching entries per printable report page, with pagination for the remaining records. Printed reports include each entry's expanded safe details. Gaps of 30 minutes or longer between consecutive entries in the current filtered result are shown as quiet periods, and an ongoing quiet period is shown when the newest matching entry is at least 30 minutes old. These intervals are calculated from stored timestamps and do not create artificial heartbeat records. Successful actions are appended at request shutdown and open views refresh through the shared four-second auto-refresh interval.

The activity API authorizes every read: staff can retrieve their own history, while only super admins can retrieve everyone else's history. The file log provides operational history, but a person with server filesystem access can alter a file, so it is not a tamper-proof audit ledger.
