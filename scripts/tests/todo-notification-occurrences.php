<?php

require_once __DIR__ . '/../../php/notification_helpers.php';

putenv('NOTIFICATION_OCCURRENCE_WINDOW_MINUTES=15');

function todo_notification_assert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$now = new DateTimeImmutable('2026-10-01 10:00:00', notification_clinic_timezone());

$started = notification_todo_occurrence_slots([
    'status' => 'pending',
    'start_at' => '2026-10-01 09:55:00',
    'end_at' => '2026-10-01 10:30:00',
], $now);
todo_notification_assert(array_column($started, 'slug') === ['started'], 'A pending task must emit one started occurrence.');

$ended = notification_todo_occurrence_slots([
    'status' => 'pending',
    'start_at' => '2026-10-01 09:00:00',
    'end_at' => '2026-10-01 09:58:00',
], $now);
todo_notification_assert(array_column($ended, 'slug') === ['ended'], 'A task must emit one ended occurrence at its scheduled end.');

$completed = notification_todo_occurrence_slots([
    'status' => 'completed',
    'start_at' => '2026-10-01 09:55:00',
    'end_at' => '2026-10-01 09:58:00',
    'completion_at' => '2026-10-01 09:59:00',
], $now);
todo_notification_assert(array_column($completed, 'slug') === ['started', 'ended'], 'A quickly completed task must retain both its start and completion occurrences.');

$completedWithoutEnd = notification_todo_occurrence_slots([
    'status' => 'completed',
    'start_at' => '2026-10-01 09:00:00',
    'end_at' => null,
    'completion_at' => '2026-10-01 09:59:00',
], $now);
todo_notification_assert(array_column($completedWithoutEnd, 'slug') === ['ended'], 'A completed task without a scheduled end must emit an ended occurrence.');

$cancelled = notification_todo_occurrence_slots([
    'status' => 'cancelled',
    'start_at' => '2026-10-01 09:55:00',
    'end_at' => '2026-10-01 09:58:00',
], $now);
todo_notification_assert($cancelled === [], 'Cancelled tasks must not emit occurrence notifications.');

$activeReminder = notification_todo_reminder_slot(
    '2026-10-01 09:55:00',
    $now,
    '2026-10-01 10:30:00'
);
todo_notification_assert($activeReminder === null, 'A newly started task must not also be marked overdue.');

$overdueReminder = notification_todo_reminder_slot(
    '2026-10-01 09:00:00',
    $now,
    '2026-10-01 09:40:00'
);
todo_notification_assert(($overdueReminder['slug'] ?? null) === 'overdue', 'An unfinished task may become overdue after the end occurrence grace window.');

$rows = notification_todo_email_rows([
    'title' => 'Give medication',
    'category' => 'Personal Task',
    'start_at' => '2026-10-01 09:55:00',
    'end_at' => '2026-10-01 10:30:00',
    'completion_at' => '2026-10-01 09:59:00',
    'pet_name' => 'Milo',
    'details' => 'One tablet',
]);
todo_notification_assert($rows['Task'] === 'Give medication', 'Email rows must retain the task title.');
todo_notification_assert($rows['Pet'] === 'Milo', 'Email rows must retain the related pet.');
todo_notification_assert($rows['Ends'] === 'October 1, 2026 at 10:30 AM', 'Email rows must include the scheduled end.');
todo_notification_assert($rows['Completed'] === 'October 1, 2026 at 9:59 AM', 'Email rows must include the actual completion time.');

$dedupeTask = [
    'source' => 'personal',
    'source_id' => 42,
    'title' => 'Give medication',
    'start_at' => '2026-10-01 09:55:00',
];
$dedupeSlot = ['slug' => 'started'];
$originalDedupeKey = notification_todo_occurrence_dedupe_key($dedupeTask, $dedupeSlot);
$dedupeTask['start_at'] = '2026-10-01 10:15:00';
todo_notification_assert(
    notification_todo_occurrence_dedupe_key($dedupeTask, $dedupeSlot) === $originalDedupeKey,
    'Editing a schedule after notification must not duplicate the same task phase.'
);

echo "TODO notification occurrence tests passed.\n";
