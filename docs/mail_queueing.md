# Mail Queueing

Updated: 2026-07-10

Mail queueing keeps submits fast by saving the main action first, inserting an email job into `mail_queue`, and returning the API response before SMTP runs.

## What Is Queued

- Notification emails from `notification_create_event`, including co-parent approval/result emails.
- Owner-facing medical record email copies.

OTP emails for forgot password, email verification, and payment settings stay direct so the user receives the code immediately.

## Database Migration

Run this from the project root:

```powershell
cmd /c "mysql -u YOUR_DB_USER -p YOUR_DB_NAME < DDL\20260710_mail_queue.sql"
```

The PHP helper also creates `mail_queue` if it is missing, but the migration is the clean production path.

## Worker Command

Run the worker from the project root:

```powershell
php php\mail_queue_worker.php --limit=25
```

For development, this loop processes mail every 10 seconds:

```powershell
while ($true) { php php\mail_queue_worker.php --limit=25; Start-Sleep -Seconds 10 }
```

For production Linux/Hostinger cron, run `scripts/run-mail-worker.sh` once per minute. The wrapper performs five checks at 10-second intervals and prevents overlapping wrapper runs when `flock` is available. For production on Windows, use Task Scheduler or a supervised worker loop and run the worker every 10 seconds when near-real-time delivery is required.

The queue reuses an authenticated SMTP session for a bounded set of messages instead of reconnecting for every email. Scheduled occurrence mail uses priority `9`; advance schedule reminders use priority `7`; routine mail keeps the default priority. This keeps task-start and task-end messages ahead of an ordinary mail backlog.

## Environment Settings

- `MAIL_QUEUE_ENABLED=1` queues notification and owner-facing emails. This is the default.
- `MAIL_QUEUE_ENABLED=0` sends those emails immediately inside the request.
- `MAIL_QUEUE_BATCH_SIZE=25` controls the default worker batch size.
- `MAIL_QUEUE_MAX_ATTEMPTS=3` controls retry attempts before a queued mail is marked failed.
- `MAIL_QUEUE_REUSE_SMTP=1` reuses one authenticated SMTP connection for a batch.
- `MAIL_SMTP_MAX_MESSAGES_PER_CONNECTION=20` limits how many messages are sent before reconnecting.

Queued notifications use `email_status = queued`; the worker changes the status to `sent` or `failed`.

The Hostinger cron worker is the only production queue processor. Email-producing API requests only add jobs to `mail_queue`; they do not open an SMTP connection or process mail after the response. Keep the cron active so it can deliver new messages and retry temporary SMTP failures. If the queue schema is unavailable, the notification records the queue error instead of bypassing the queue with direct SMTP.

## Measuring Delay

Run the PHP worker manually without `--quiet`. Its output includes:

- `oldest`: age of the oldest due message still waiting after the run.
- `max wait`: largest queue wait among messages claimed by that run.
- `SMTP connections`: connection count used for the batch. With reuse enabled this should be much lower than the sent count.
- `duration`: total queue processing time.

If queue wait is low but the email appears late in the recipient inbox, iPawcus handed it to SMTP promptly and the remaining delay is upstream. Check the SMTP account's delivery log and SPF/DKIM/DMARC status in that case.
