# PHP Test Files

These files are kept out of the live `php/` backend folder because they are debug, manual test, or one-time setup helpers.

Do not upload this folder as part of the production API unless you intentionally need a specific helper for troubleshooting. The included `.htaccess` blocks direct browser access on Apache/Hostinger if the folder is uploaded by mistake.

## Files

- `debug_bookings.php` - lists booking/debug database data.
- `debug_db.php` - describes the `bookings` table.
- `debug_queues.php` - describes the `queues` table.
- `mail_test.php` - manual SMTP test helper.
- `test_notification_reminders.php` - manual reminder dry-run/send helper.
- `update_schema_home_service.php` - archived one-time home-service schema helper.
- `rooms_setup.sql` - archived boarding room setup SQL.
- `vet_schedules.sql` - archived veterinarian schedule table SQL.

## Runtime Replacement

The live reminder sender remains in:

```bash
POST /notifications/reminders/run
```

The live mail queue worker remains in:

```bash
php php/mail_queue_worker.php --limit=50
```
