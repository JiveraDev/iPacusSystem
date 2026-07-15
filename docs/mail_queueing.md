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

For development, this loop processes mail every 15 seconds:

```powershell
while ($true) { php php\mail_queue_worker.php --limit=25; Start-Sleep -Seconds 15 }
```

For production on Windows, add the worker command to Task Scheduler and run it every minute. If faster email delivery is needed, run the worker more often.

## Environment Settings

- `MAIL_QUEUE_ENABLED=1` queues notification and owner-facing emails. This is the default.
- `MAIL_QUEUE_ENABLED=0` sends those emails immediately inside the request.
- `MAIL_QUEUE_BATCH_SIZE=25` controls the default worker batch size.
- `MAIL_QUEUE_MAX_ATTEMPTS=3` controls retry attempts before a queued mail is marked failed.

Queued notifications use `email_status = queued`; the worker changes the status to `sent` or `failed`.
