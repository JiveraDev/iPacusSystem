# Notification Delivery and Security Audit

Audit date: 2026-07-27

This is a source-code audit of the current in-app, browser-push, queued-email, and direct-email paths. It distinguishes what is emitted today from recommended coverage. It does not claim that an event was delivered unless the relevant worker, credentials, browser subscription, and database schema are operating.

## Executive result

- Pet Owners have the broadest coverage. Booking, queue, appointment-reminder, billing, and diagnosis events can use in-app, push, and email.
- Veterinarian, Admin, and Super Admin operational events are mostly in-app and push only.
- Email and push are best-effort after the business transaction commits. There is no transactional notification outbox, so a helper/schema/runtime failure before `user_notifications` is written can permanently lose the event.
- The mail queue retries email only after an event successfully exists. Browser push has no retry worker.
- Reminder generation depends on an external scheduler calling the reminder endpoint.
- Security fixes made during this audit are listed below. Required credential rotation, history cleanup, an outbox, and protected-file deployment rules remain operator/architecture work.

## Channel legend

| Code | Meaning |
| --- | --- |
| I | Stored in `user_notifications` and shown in the notification center when enabled |
| P | Browser push attempted when VAPID is configured, the category is enabled, push is enabled, and an active subscription exists |
| E | Notification-template email, normally queued and preference-controlled |
| D | Direct transactional email outside `user_notifications` |
| — | Not currently emitted on that channel |

## Shared delivery behavior

| Concern | Current behavior | Source |
| --- | --- | --- |
| Preferences | Email and in-app default on; browser push defaults off. Categories: booking, schedule, payment, diagnosis, queue, boarding, and ownership. | `php/notification_helpers.php`, `src/components/shared/NotificationPreferencesCard.jsx` |
| In-app persistence | Unique key is `(user_id, dedupe_key)`. Duplicate events update the existing row. | `notification_create()` in `php/notification_helpers.php`; `user_notifications` DDL |
| Email dispatch | An event must provide `email_subject` and `email_html`. When `MAIL_QUEUE_ENABLED=1`, it is inserted into `mail_queue`; otherwise SMTP is synchronous. | `notification_create_event()`, `notification_send_email_if_enabled()`, `php/mail_helpers.php` |
| Email retries | Queue attempts default to 3, delayed by 30–3,600 seconds; stale `sending` rows reset after 10 minutes. Final failures remain failed. | `mail_queue_claim()`, `mail_queue_mark_failed()`, `mail_queue_reset_stale()` |
| Push dispatch | An empty Web Push wake-up is sent synchronously. The service worker then loads the protected latest-notification API using the current account context. | `notification_send_push_if_enabled()`, `public/ipawcus-push-sw.js` |
| Push retries | None. Failed delivery is recorded on the notification/subscription and only retried if the same domain event is emitted again. | `php/notification_helpers.php` |
| Reminder execution | `POST /notifications/reminders/run` scans confirmed bookings and scheduled TODO sources. It must be called by cron/Task Scheduler. | `php/notifications.php`, `notification_run_booking_reminders()`, `notification_run_todo_reminders()` |
| Role fan-out | Role names are normalized. Admin/Super Admin fan-out now excludes accounts marked deactivated when `users.account_status` exists. | `notification_fetch_users_by_roles()` |
| Recipient identity | Direct events generally use the booking/queue/request owner, assigned veterinarian, or every matching staff role. Booking/queue events do not automatically fan out to all co-owners. | Event helpers below |

## Current event matrix: Pet Owner

| Workflow and exact events | Current channels | Recipient resolution | Emitters / templates | Recommended adjustment |
| --- | --- | --- | --- | --- |
| Booking `booking_submitted`, `booking_confirmed`, `booking_cancelled`, `booking_rescheduled` | I / P / E | `bookings.user_id` | `notification_send_booking_event()`; `php/add_booking.php`, `php/update_booking_status.php`, `php/update_booking_schedule.php`, `php/booking_maintenance.php`, `php/boarding_management.php` | Keep. Decide whether approved co-parents should also receive schedule-critical events. |
| Booking reminders `booking_schedule_reminder` at ~24h, same day, ~2h | I / P / E | `bookings.user_id` | `notification_run_booking_reminders()` via `POST /notifications/reminders/run` | P0: monitor the scheduler and alert on missed runs. Set one explicit Manila timezone across PHP and DB. |
| Queue `queue_created`, `queue_in_progress`, `queue_received`, `queue_completed`, `queue_cancelled` | I / P / E | `queues.user_id` | `notification_send_queue_event()`; `php/add_to_queue.php`, `php/assign_queue_vet.php`, `php/receive_booking.php`, `php/receive_queue.php`, `php/update_queue_status.php`, `php/vet_diagnoses.php`, `php/booking_maintenance.php` | Keep. Make transition dedupe keys deterministic from an event/transition record. |
| Owner TODO/follow-up/boarding-task reminders `todo_schedule_reminder` | I / P / — | Task owner resolved by source query | `notification_fetch_todo_reminder_tasks()`, `notification_send_todo_reminder()` | P1: add email only if product policy wants TODO email; avoid emailing high-frequency boarding tasks by default. |
| Online consultation `online_consultation_vet_ready`, `online_consultation_completed` | I / P / — | `online_consultations.owner_user_id` | `notification_send_online_consultation_event()`; `php/online_consultations.php` | P1: email schedule/ready/cancel/no-show changes that could cause a missed appointment. |
| Diagnosis `diagnosis_completed` | I / P / E | Owner derived from queue or booking | `notification_send_diagnosis_event()`; `php/vet_diagnoses.php` | Keep, but minimize sensitive clinical text in email and link to the authenticated record. |
| Record update `record_update_request_completed`, `medical_record_updated` | I / P / — | Request owner or pet summary owner | `php/record_update_requests.php`, `php/pet_medical_records.php` | P1: email completion of owner-paid record-update requests. |
| Boarding `boarding_checked_in`, `boarding_checked_out` | I / P / — | `bookings.user_id` | `notification_send_boarding_event()`; `php/boarding_management.php` | P1: optional check-in/out email. Product decision: daily summary vs urgent-only observations. |
| Billing `invoice_ready`, `payment_received` | I / P / E | `visits.owner_user_id`; walk-in visits are excluded | `notification_send_visit_event()`; `php/visit_billing.php`, `php/vet_diagnoses.php`, `php/online_consultations.php` | Keep. Add delivery monitoring because receipts and balances are financially important. |
| Ownership `coparent_request_pending` | I / P / E (email forced) | Primary owner | `coparent_notify_request_created()` in `php/coparent_request_helpers.php` | Keep forced decision email. |
| Ownership `coparent_request_submitted`, `coparent_request_approved`, `coparent_request_declined` | I / P / — | Requesting user | `coparent_notify_requester_pending()`, `coparent_notify_requester_result()` | P1: email final approval/decline if the requester may not revisit the app. |
| Account removal `account_removed` | I / P / E | Removed user | `php/delete_account.php` | Treat as security mail and force email; account-status toggles in `php/pet_owner_accounts.php` still need equivalent notice. |
| Requested medical-record copy | — / — / D | Authenticated requesting owner email | `php/pet_medical_records.php` (`email_copy`) | Keep as explicit user-requested mail; audit access and attachment retention. |
| Registration verification, password reset/change | — / — / D | Submitted/verified account email | `php/auth_otp_helpers.php`, auth endpoints | Keep synchronous security delivery with rate-limit and delivery monitoring. |

## Current event matrix: Veterinarian

| Workflow and exact events | Current channels | Recipient resolution | Emitters | Recommended adjustment |
| --- | --- | --- | --- | --- |
| Assigned booking `booking_assigned_to_vet`, `vet_booking_cancelled`, `vet_booking_rescheduled`; online appointment confirmation | I / P / — | `bookings.veterinarian_id` | `notification_send_booking_event()` | P1: email only critical same-day assignment/cancellation changes; avoid routine inbox noise. |
| Queue assignment `queue_assigned_to_vet` | I / P / — | Explicit assigned veterinarian | `notification_send_queue_assignment_to_vet()` from receive/assign endpoints | P0 operationally: add escalation if assignment is unread/unreceived for a configured interval. |
| Online consultation `online_consultation_owner_joined`, `online_consultation_diagnosis_saved` | I / P / — | Assigned veterinarian | `notification_send_online_consultation_event()` | P1: add ready/no-show/cancelled coverage and escalation. |
| Scheduled online consultation and follow-up reminders | I / P / — | Assigned veterinarian from consultation/diagnosis | TODO reminder source queries | P1: optional email for next-day appointments; ensure Manila timezone. |
| Record request `record_update_request_assigned` | I / P / — | Assigned veterinarian | `notification_send_record_update_request_event()` | P0 operationally: overdue escalation because requests may be paid/urgent. |
| Diagnosis save `diagnosis_saved_by_vet` | I / P / — | Diagnosis veterinarian | `notification_send_diagnosis_event()` | Confirmation is useful; email is not normally needed. |
| Account removal and password reset/change | I / P / E for removal; D for security codes | Target veterinarian | `php/delete_account.php`, `php/auth_otp_helpers.php` | Keep. Ensure deactivated profiles cannot retain active push access. |

## Current event matrix: Admin

| Workflow and exact events | Current channels | Recipient resolution | Emitters | Recommended adjustment |
| --- | --- | --- | --- | --- |
| Clinic booking review/approval/cancel/reschedule | I / P / — | Every active Admin and Super Admin | `notification_send_booking_event()` | P0: assignment/escalation rules; broadcasting every event to every staff account will not scale. |
| Clinic queue create/in-progress/receive/complete/cancel | I / P / — | Every active Admin and Super Admin | `notification_send_queue_event()` | Keep dashboard/push; consider shift/on-duty recipients instead of all accounts. |
| Record request submitted/started/completed | I / P / — | Every active Admin and Super Admin | `notification_send_record_update_request_staff_event()` | Add overdue/escalation monitoring, not routine email. |
| Boarding check-in/check-out | I / P / — | Every active Admin and Super Admin | `notification_send_boarding_event()` | Add urgent observation/task exceptions; avoid emailing routine care logs. |
| Online/clinic diagnosis completed | I / P / — | Every active Admin and Super Admin | online and diagnosis helpers | Usually dashboard-only; add exception alerts for unresolved billing/clinical follow-up. |
| Account removal when Admin is target | I / P / E | Removed account | `php/delete_account.php` | Keep as security notice. |
| Password reset/change | — / — / D | Account email | Auth OTP endpoints | Keep. |

## Current event matrix: Super Admin

Super Admin receives the Admin clinic-event rows above.

| Additional workflow | Current channels | Recipient resolution | Source | Recommended adjustment |
| --- | --- | --- | --- | --- |
| Account-removal audit `account_removed_audit` | I / P / E | Every active Super Admin | `php/delete_account.php` | Keep, but route to a durable audit log as well as notification delivery. |
| Payment-method settings OTP | — / — / D | Authenticated Super Admin account email | `POST /payment-methods/otp`, `php/payment_methods.php`, `php/auth_otp_helpers.php` | Keep synchronous and rate-limited; monitor failures. |
| Password reset/change | — / — / D | Account email | Auth OTP endpoints | Keep. |
| System problem report | — / — / D | Configured maintenance/report recipient, not role-derived | `php/system_problem_report.php` | Use a monitored operational mailbox/ticket system and redact sensitive diagnostics. |

## Workflows with no complete notification contract

| Workflow gap | Current state | Recommendation |
| --- | --- | --- |
| Boarding observations | Stored, but ordinary/urgent observation creation has no dedicated event | Define urgent categories and notify owner/on-duty staff only for clinically appropriate exceptions; optionally send one daily owner summary. |
| Boarding task assignment/completion | Owner reminders are generated from pending task due dates, but assigned staff and completion transitions have no dedicated contract | Add on-duty staff assignment/escalation events; do not expose internal routine notes automatically to owners. |
| Online consultation cancellation/no-show | No dedicated online-state template | Add owner + assigned-vet events and email for schedule-critical changes. |
| Queue reassignment | New vet can receive assignment; prior vet has no explicit removal/reassignment event | Add deterministic reassignment events to both veterinarians. |
| Pet-owner account deactivate/reactivate | `php/pet_owner_accounts.php` changes status without a matching notification/email | Add forced security email and Super Admin audit event. |
| Inventory, room maintenance, low stock, service-material exception | No notification-center contract | Add role-targeted operational events only after defining thresholds and on-duty recipients. |
| Failed notification delivery | Failures are stored/logged but do not create staff alerts | Add metrics/dashboard alerts and a dead-letter review workflow. |

## Reliability and deduplication findings

1. **P0 — transactional outbox required for guaranteed delivery.** Most domain endpoints commit first, then call `notification_send_*` inside `try/catch`. If PHP stops, schema validation fails, or the helper throws before `user_notifications` is inserted, the domain change succeeds and the notification is permanently absent. Add a notification-outbox row in the same database transaction as each domain change; have an idempotent worker create channel jobs, with retry, dead-letter, and monitoring.
2. **The mail queue is not a domain-event outbox.** It protects SMTP delivery only after a notification event and email payload have already been created.
3. **Push is synchronous and has no retry queue.** Slow push endpoints can delay domain responses; transient 429/5xx failures are not retried. Move push delivery to an asynchronous job with exponential backoff and expiry.
4. **Deduplication is partly strong, partly time-based.** The unique `(user_id, dedupe_key)` index is good, but cancellation/reschedule/queue helpers use `time()`, `microtime()`, or mutable strings in some keys. Add an immutable transition/event ID and derive every channel idempotency key from it.
5. **Reminder processing needs an execution ledger.** Current dedupe prevents duplicate rows, but the API's `processed` count can include an existing deduped row. Store scheduler runs, last-success time, duration, checked count, created count, and error count.
6. **Timezone is implicit.** PHP and database `NOW()` must both use Asia/Manila or reminder windows can drift.

## Security findings and fixes made in this audit

| Finding | Resolution |
| --- | --- |
| Reminder endpoint allowed execution when `NOTIFICATION_REMINDER_KEY` was missing | Fixed fail-closed in `php/notifications.php`. A configured key is now mandatory. |
| Admin could target another user's push subscription, preferences, and read state | Fixed: Admin cross-user access remains available only for read-only list/preferences/status requests; all mutations are self-only. |
| Service worker called protected notification/read APIs without a bearer token | Fixed in `src/services/pushNotificationService.js` and `public/ipawcus-push-sw.js`; authenticated context is stored for the bound subscription account. |
| Push account context could survive logout/account switching | Fixed with explicit and central context clearing. The worker retains only the subscription-account binding and will not use a different account's token. |
| Notification click accepted an absolute cross-origin redirect | Fixed: targets are constrained to the service worker's application origin with `/dashboard` fallback. |
| Bearer token could be sent to an arbitrary API origin | Fixed: worker API requests are limited to same-origin or the API origin explicitly supplied by app configuration. |
| Push subscription endpoint accepted arbitrary URLs | Fixed baseline validation: HTTPS/443 hostname only, no credentials, local/internal/IP hosts rejected, size limited. `PUSH_ENDPOINT_ALLOWED_HOSTS` provides a production suffix allowlist. |
| Push status exposed the server CA bundle filesystem path | Removed; clients receive only the setup boolean. |
| Web-enabled mail queue worker had no authorization | Fixed: CLI remains preferred; web mode now also requires `MAIL_QUEUE_WORKER_KEY` in `X-Mail-Queue-Worker-Key`. |
| Role fan-out included deactivated staff | Fixed when `users.account_status` exists. |
| Production example contained credential-like values | Replaced with placeholders in `.env.example.production`. |

## Required operator actions (not performed by this audit)

1. **P0: rotate every credential previously present in the tracked production example**, including database, SMTP, master/OTP/reminder, VAPID, and third-party keys. Updating the example does not revoke exposed values.
2. **P0: purge secrets from Git history** with an approved history-rewrite procedure, then invalidate old clones/build artifacts. Coordinate this because rewriting shared history is disruptive.
3. Set `MASTER_KEY` as a server-only variable. Remove the legacy `VITE_MASTER_KEY` fallback from PHP after deployments have the server key; never place master secrets in a `VITE_*` variable.
4. Configure and monitor:
   - `NOTIFICATION_REMINDER_KEY`
   - `MAIL_QUEUE_ENABLED=1`
   - CLI execution of `php php/mail_queue_worker.php`
   - `MAIL_QUEUE_WEB_ENABLED=0` unless a secured web runner is required
   - `MAIL_QUEUE_WORKER_KEY` if web mode is enabled
   - VAPID keys/subject and `PUSH_ENDPOINT_ALLOWED_HOSTS`
   - SMTP TLS with peer verification
5. Add the transactional outbox, channel job tables, dead-letter handling, worker heartbeat, and alerting before claiming no-lapse delivery.
6. Replace the full bearer token stored for service-worker API reads with a short-lived, scoped notification-read token when the auth architecture is extended.

## Upload and preview security note

The UI now prefers the authenticated `/api/uploads/media/...` route for protected runtime directories, and server-side ownership/role checks exist in `php/role_access.php` and `php/upload_media.php`. However, protected files are still physically written under `public/`. A web server can therefore serve a guessed direct `/signatures/...`, `/diagnosis/...`, or similar path before PHP authorization unless deployment rules deny/rewrite those directories. Treat this as P0 deployment hardening: move protected uploads outside the public document root or enforce equivalent Apache/Nginx deny-and-proxy rules. View/download buttons must keep using authenticated blob fetches and must not fall back to raw public URLs.

## Exact primary sources

- API/security: `php/notifications.php`, `php/index.php`, `php/role_access.php`
- Event creation/templates/recipient resolution: `php/notification_helpers.php`
- Email and queue: `php/mail_helpers.php`, `php/mail_queue_worker.php`, `DDL/20260710_mail_queue.sql`
- Push: `src/services/pushNotificationService.js`, `public/ipawcus-push-sw.js`
- Client APIs/settings/feed: `src/services/notificationService.js`, `src/hooks/useNotificationCenter.js`, `src/components/shared/NotificationPreferencesCard.jsx`
- Domain emitters: `php/add_booking.php`, `php/update_booking_status.php`, `php/update_booking_schedule.php`, `php/booking_maintenance.php`, `php/add_to_queue.php`, `php/assign_queue_vet.php`, `php/receive_booking.php`, `php/receive_queue.php`, `php/update_queue_status.php`, `php/boarding_management.php`, `php/online_consultations.php`, `php/vet_diagnoses.php`, `php/visit_billing.php`, `php/record_update_requests.php`, `php/pet_medical_records.php`, `php/coparent_request_helpers.php`, `php/delete_account.php`
- Direct security mail: `php/auth_otp_helpers.php`, `php/payment_methods.php`
- Upload access: `php/upload.php`, `php/upload_media.php`, `src/lib/image.js`

