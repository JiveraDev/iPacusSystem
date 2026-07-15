# Performance Optimization

Updated: 2026-07-10

This update reduces submit and dashboard lag in three places:

1. Mail queueing removes SMTP waits from notification-heavy submits.
2. Frontend GET de-duplication prevents repeated identical dashboard requests from stacking up.
3. Auto-refresh now pauses in hidden browser tabs and backs off after repeated failures.

## Database Index Migration

Run this from the project root:

```powershell
cmd /c "mysql -u YOUR_DB_USER -p YOUR_DB_NAME < DDL\20260710_performance_indexes.sql"
```

The migration adds indexes for common dashboard/report lookups across bookings, queues, visits, payments, inventory, online consultations, vet diagnoses, and record update requests.

## Mail Queue Worker

The queue worker must run on the backend server:

```powershell
php php\mail_queue_worker.php --limit=50
```

For production, run it every minute through Task Scheduler or cron. Use `--limit=25` if SMTP starts rate-limiting.

## Remaining Bottlenecks To Watch

- Large image or payment-proof uploads can still be slow.
- Heavy report ranges can still take longer if the date range is very wide.
- Local XAMPP or low-resource hosting can still bottleneck when many auto-refreshing dashboards are open.
