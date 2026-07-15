<?php
require_once __DIR__ . '/../php/db.php';
require_once __DIR__ . '/../php/notification_helpers.php';

function reminder_test_is_cli(): bool
{
    return PHP_SAPI === 'cli';
}

function reminder_test_args(): array
{
    if (!reminder_test_is_cli()) {
        return $_GET;
    }

    $args = [];
    foreach (array_slice($_SERVER['argv'] ?? [], 1) as $arg) {
        if (!str_starts_with($arg, '--')) {
            continue;
        }

        $pair = explode('=', substr($arg, 2), 2);
        $args[$pair[0]] = $pair[1] ?? '1';
    }

    return $args;
}

function reminder_test_json(array $payload, int $status = 200): void
{
    if (!reminder_test_is_cli()) {
        http_response_code($status);
        header('Content-Type: application/json');
    }

    echo json_encode($payload, JSON_PRETTY_PRINT) . PHP_EOL;
    exit;
}

function reminder_test_authorized(array $args): bool
{
    if (reminder_test_is_cli()) {
        return true;
    }

    $expectedKey = trim((string)(getenv('NOTIFICATION_REMINDER_KEY') ?: ''));
    if ($expectedKey === '') {
        return false;
    }

    $providedKey = trim((string)(
        $_SERVER['HTTP_X_NOTIFICATION_REMINDER_KEY']
        ?? $args['reminderKey']
        ?? $args['reminder_key']
        ?? ''
    ));

    return $providedKey !== '' && hash_equals($expectedKey, $providedKey);
}

function reminder_test_bool($value, bool $default = false): bool
{
    if ($value === null || $value === '') {
        return $default;
    }

    if (is_bool($value)) {
        return $value;
    }

    return in_array(strtolower(trim((string)$value)), ['1', 'true', 'yes', 'on'], true);
}

function reminder_test_booking_candidates(PDO $pdo, int $limit): array
{
    $limit = max(1, min(200, $limit));
    $stmt = $pdo->prepare("
        SELECT
            b.*,
            u.first_Name,
            u.last_Name,
            u.mail_Address,
            p.pet_name
        FROM bookings b
        JOIN users u ON u.user_id = b.user_id
        LEFT JOIN pets_information p ON p.pet_id = b.pet_id
        WHERE b.status = 'confirmed'
          AND b.booking_date IS NOT NULL
          AND b.booking_time IS NOT NULL
          AND STR_TO_DATE(CONCAT(b.booking_date, ' ', b.booking_time), '%Y-%m-%d %H:%i:%s') > NOW()
          AND STR_TO_DATE(CONCAT(b.booking_date, ' ', b.booking_time), '%Y-%m-%d %H:%i:%s') <= DATE_ADD(NOW(), INTERVAL 24 HOUR)
        ORDER BY b.booking_date ASC, b.booking_time ASC
        LIMIT {$limit}
    ");
    $stmt->execute();

    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

function reminder_test_preference_enabled(PDO $pdo, int $userId, ?array $slot): bool
{
    if ($userId <= 0 || !$slot) {
        return false;
    }

    $preferences = notification_fetch_preferences($pdo, $userId);
    return notification_bool($preferences[$slot['preference']] ?? 1) === 1;
}

function reminder_test_describe_booking(PDO $pdo, array $booking, DateTimeImmutable $now): array
{
    $slot = notification_booking_reminder_slot($booking, $now);
    $scheduledAt = notification_booking_schedule_datetime($booking);
    $userId = (int)($booking['user_id'] ?? 0);
    $preferenceEnabled = reminder_test_preference_enabled($pdo, $userId, $slot);

    return [
        'source' => 'booking',
        'id' => (int)($booking['booking_id'] ?? 0),
        'userId' => $userId,
        'petName' => trim((string)($booking['pet_name'] ?? $booking['unregistered_pet_name'] ?? '')),
        'service' => notification_service_name($booking),
        'startAt' => $scheduledAt ? $scheduledAt->format(DateTimeInterface::ATOM) : null,
        'slot' => $slot['slug'] ?? null,
        'preference' => $slot['preference'] ?? null,
        'preferenceEnabled' => $preferenceEnabled,
        'wouldSend' => (bool)($slot && $preferenceEnabled),
    ];
}

function reminder_test_describe_todo(PDO $pdo, array $task, DateTimeImmutable $now): array
{
    $slot = notification_todo_reminder_slot($task['start_at'] ?? null, $now);
    $startAt = notification_task_datetime($task['start_at'] ?? null);
    $userId = (int)($task['user_id'] ?? 0);
    $preferenceEnabled = reminder_test_preference_enabled($pdo, $userId, $slot);

    return [
        'source' => trim((string)($task['source'] ?? 'todo')),
        'id' => (int)($task['source_id'] ?? 0),
        'userId' => $userId,
        'title' => trim((string)($task['title'] ?? '')),
        'petName' => trim((string)($task['pet_name'] ?? '')),
        'startAt' => $startAt ? $startAt->format(DateTimeInterface::ATOM) : null,
        'slot' => $slot['slug'] ?? null,
        'preference' => $slot['preference'] ?? null,
        'preferenceEnabled' => $preferenceEnabled,
        'wouldSend' => (bool)($slot && $preferenceEnabled),
    ];
}

$args = reminder_test_args();

if (!reminder_test_authorized($args)) {
    reminder_test_json([
        'success' => false,
        'message' => 'Reminder test runner requires NOTIFICATION_REMINDER_KEY for browser access. CLI access is allowed.',
    ], 403);
}

try {
    notification_ensure_schema($pdo);

    $section = strtolower(trim((string)($args['section'] ?? 'all')));
    if (!in_array($section, ['all', 'bookings', 'todos'], true)) {
        $section = 'all';
    }

    $limit = max(1, min(200, (int)($args['limit'] ?? 50)));
    $run = reminder_test_bool($args['run'] ?? $args['send'] ?? null, false);

    if ($run) {
        $bookings = in_array($section, ['all', 'bookings'], true)
            ? notification_run_booking_reminders($pdo)
            : ['checked' => 0, 'processed' => 0, 'skipped' => 0];
        $todos = in_array($section, ['all', 'todos'], true)
            ? notification_run_todo_reminders($pdo)
            : ['checked' => 0, 'processed' => 0, 'skipped' => 0];

        reminder_test_json([
            'success' => true,
            'mode' => 'send',
            'section' => $section,
            'reminders' => [
                'checked' => (int)($bookings['checked'] ?? 0) + (int)($todos['checked'] ?? 0),
                'processed' => (int)($bookings['processed'] ?? 0) + (int)($todos['processed'] ?? 0),
                'skipped' => (int)($bookings['skipped'] ?? 0) + (int)($todos['skipped'] ?? 0),
                'bookings' => $bookings,
                'todos' => $todos,
            ],
        ]);
    }

    $now = new DateTimeImmutable('now');
    $bookings = [];
    $todos = [];

    if (in_array($section, ['all', 'bookings'], true)) {
        foreach (reminder_test_booking_candidates($pdo, $limit) as $booking) {
            $bookings[] = reminder_test_describe_booking($pdo, $booking, $now);
        }
    }

    if (in_array($section, ['all', 'todos'], true)) {
        foreach (array_slice(notification_fetch_todo_reminder_tasks($pdo), 0, $limit) as $task) {
            $todos[] = reminder_test_describe_todo($pdo, $task, $now);
        }
    }

    reminder_test_json([
        'success' => true,
        'mode' => 'dry-run',
        'section' => $section,
        'now' => $now->format(DateTimeInterface::ATOM),
        'settings' => [
            'slots' => ['24h', 'same-day', '2h', 'overdue'],
            'preferences' => ['schedule_reminders', 'reminder_24h', 'reminder_same_day', 'reminder_2h'],
            'sendCommand' => reminder_test_is_cli()
                ? 'php phpTestfiles/test_notification_reminders.php --run=1'
                : 'GET phpTestfiles/test_notification_reminders.php?run=1&reminderKey=YOUR_KEY',
        ],
        'candidates' => [
            'bookings' => $bookings,
            'todos' => $todos,
        ],
    ]);
} catch (Throwable $error) {
    reminder_test_json([
        'success' => false,
        'message' => $error->getMessage(),
    ], 500);
}
