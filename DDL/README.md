# Database DDL Export

Run this from the project root:

```bash
php DDL/export_database_ddl.php
```

It reads the database connection from `.env` and writes a timestamped file like:

```text
DDL/database_ddl_20260530_213000.sql
```

Optional commands:

```bash
php DDL/export_database_ddl.php --output DDL/current_schema.sql
php DDL/export_database_ddl.php --include-views
```

## Manual Migrations

- `20260710_deployment_required_all.sql` bundles all required July 10 deployed-server SQL in the correct order.
- `20260709_coparent_requests.sql` adds the co-parent approval request table and ownership metadata columns.
- `20260710_mail_queue.sql` adds queued email delivery for notifications and owner-facing email jobs.
- `20260710_performance_indexes.sql` adds indexes for high-traffic dashboard, booking, queue, POS, report, inventory, online consultation, and record-request reads.
