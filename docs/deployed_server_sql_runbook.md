# Deployed Server SQL Runbook

Updated: 2026-10-13

## October review: migration scope

The bundled July script below covers the July release, not every migration added afterward. Google identity support additionally requires `DDL/20260917_01_google_identity.sql` and the existing email-verification/access-token prerequisites. Review current database columns, including nullable `users.user_password`, before enabling Google-only onboarding. Later grooming, booking and inventory features have their own migrations; use their feature guides and the actual schema rather than assuming the July bundle is sufficient.

No migration was applied during the October review; local database readiness failed. See [the current audit](20261013_project_audit.md) and [Google integration tests](google_integration_testing.md). Validate on a disposable/staging database before production.

This is the deployment SQL list for the current iPawcus update.

## Required For July 10 Deployment

Run this single bundled file on the deployed database:

```text
DDL/20260710_deployment_required_all.sql
```

It contains these required migrations in order:

1. `DDL/20260709_coparent_requests.sql`
   - Adds co-parent approval requests.
   - Updates `pet_ownership` so one pet can have primary owner plus co-parents.
   - Adds ownership notification preference support.

2. `DDL/20260710_mail_queue.sql`
   - Adds `mail_queue`.
   - Adds `queued` to `user_notifications.email_status`.

3. `DDL/20260710_performance_indexes.sql`
   - Adds performance indexes for bookings, queues, POS, reports, inventory, online consultations, diagnoses, and record update requests.

## Hostinger / phpMyAdmin Run Method

In Hostinger phpMyAdmin:

1. Open the deployed database.
2. Open SQL tab.
3. Paste the full contents of:

```text
DDL/20260710_deployment_required_all.sql
```

4. Run it.

If you use SSH or a local MySQL client pointed to the deployed DB:

```powershell
cmd /c "mysql -u YOUR_DB_USER -p YOUR_DB_NAME < DDL\20260710_deployment_required_all.sql"
```

## Verification SQL

After running, verify the important tables and columns:

```sql
SHOW TABLES LIKE 'pet_coparent_requests';
SHOW TABLES LIKE 'mail_queue';

SHOW COLUMNS FROM pet_ownership LIKE 'relationship';
SHOW COLUMNS FROM pet_ownership LIKE 'is_primary';
SHOW COLUMNS FROM notification_preferences LIKE 'ownership_updates';
SHOW COLUMNS FROM user_notifications LIKE 'email_status';

SHOW INDEX FROM pet_ownership WHERE Key_name = 'pet_ownership_user_pet_unique';
SHOW INDEX FROM bookings WHERE Key_name = 'bookings_status_date_idx';
SHOW INDEX FROM queues WHERE Key_name = 'queues_status_timestamp_idx';
SHOW INDEX FROM visits WHERE Key_name = 'visits_created_idx';
SHOW INDEX FROM mail_queue WHERE Key_name = 'mail_queue_status_available_idx';
```

Check mail queue status:

```sql
SELECT status, COUNT(*)
FROM mail_queue
GROUP BY status;
```

## Required Non-SQL Step

Mail queue SQL only creates the table. Emails will not send until Hostinger Cron runs the worker.

Cron command:

```bash
php /home/YOUR_HOSTINGER_USER/domains/ipawcus.com/public_html/set/php/mail_queue_worker.php --limit=50
```

Run it every 1 minute.

## Optional Legacy SQL

Do not run these unless the deployed DB is older or missing those tables.

### If The DB Is Still Based On June 18

Run:

```text
DDL/realign_20260618_to_20260622.sql
```

This adds older schema columns like booking consent fields and account status fields.

### If `consent_form_records` Is Missing

Run:

```text
DDL/20260619_create_consent_form_records.sql
```

Skip it if this returns a table:

```sql
SHOW TABLES LIKE 'consent_form_records';
```

### Fresh Database Only

For a brand-new empty database only, import the current full schema:

```text
DDL/database_ddl_20260622_070744.sql
```

Do not run the full schema on an existing production database because it contains `DROP TABLE` statements.

### Do Not Run In Production

```text
DDL/inventory_test_seed.sql
```

This is seed/test inventory data only.
