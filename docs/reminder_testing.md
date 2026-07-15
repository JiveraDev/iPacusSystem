# Reminder Testing

Use this note when validating schedule reminders without changing production code.

## Runner

The normal app endpoint is:

```bash
POST /notifications/reminders/run
```

The local test helper is:

```bash
php phpTestfiles/test_notification_reminders.php
```

By default, the helper is a dry run. It lists reminder candidates, their slot, the user preference checked, and whether the notification would send.

## Dry Run

```bash
php phpTestfiles/test_notification_reminders.php --section=all
php phpTestfiles/test_notification_reminders.php --section=bookings
php phpTestfiles/test_notification_reminders.php --section=todos
```

Useful options:

```bash
--limit=50
--section=all|bookings|todos
```

Browser access is blocked unless `NOTIFICATION_REMINDER_KEY` is set and passed:

```text
phpTestfiles/test_notification_reminders.php?section=all&reminderKey=YOUR_KEY
```

## Send Real Reminders

Only use this when you intentionally want notifications inserted and email/push behavior triggered according to the existing notification settings:

```bash
php phpTestfiles/test_notification_reminders.php --run=1
php phpTestfiles/test_notification_reminders.php --run=1 --section=bookings
php phpTestfiles/test_notification_reminders.php --run=1 --section=todos
```

Browser send test:

```text
phpTestfiles/test_notification_reminders.php?run=1&reminderKey=YOUR_KEY
```

## Settings Checked

Reminder sending is controlled per user by `notification_preferences`:

| Setting | Purpose |
| --- | --- |
| `schedule_reminders` | Main schedule reminder category. |
| `reminder_24h` | About 24 hours before the schedule. |
| `reminder_same_day` | Same-day reminder. |
| `reminder_2h` | About 2 hours before the schedule. |

The current slot logic lives in [notification_helpers.php](../php/notification_helpers.php):

| Function | What to edit |
| --- | --- |
| `notification_booking_reminder_slot` | Booking 24h, same-day, and 2h timing. |
| `notification_todo_reminder_slot` | TODO/follow-up/boarding task overdue, 24h, same-day, and 2h timing. |
| `notification_fetch_todo_reminder_tasks` | Which TODO-like records are included. |
| `notification_run_booking_reminders` | Which confirmed bookings are included. |

## Dedupe Behavior

Reminder notifications use dedupe keys. Re-running the sender for the same booking/task and same scheduled time should not create duplicates.

To retest the same exact reminder after it already sent, use a staging database or remove only the specific test notification row from `user_notifications` by its dedupe key.
