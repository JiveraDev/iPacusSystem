<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/mail_helpers.php';
require_once __DIR__ . '/notification_helpers.php';

function mail_queue_worker_limit(): int
{
    global $argv;

    $limit = (int)mail_env_value('MAIL_QUEUE_BATCH_SIZE', '25');

    if (PHP_SAPI === 'cli' && is_array($argv ?? null)) {
        foreach ($argv as $arg) {
            if (preg_match('/^--limit=(\d+)$/', (string)$arg, $matches)) {
                $limit = (int)$matches[1];
            }
        }
    }

    return max(1, min(100, $limit));
}

function mail_queue_worker_web_authorized(): bool
{
    $expectedKey = trim(mail_env_value('MAIL_QUEUE_WORKER_KEY'));
    if ($expectedKey === '') {
        return false;
    }

    $providedKey = trim((string)($_SERVER['HTTP_X_MAIL_QUEUE_WORKER_KEY'] ?? ''));

    return $providedKey !== '' && hash_equals($expectedKey, $providedKey);
}

if (PHP_SAPI !== 'cli') {
    header('Content-Type: application/json');

    if (!mail_env_bool('MAIL_QUEUE_WEB_ENABLED', false)) {
        http_response_code(404);
        echo json_encode(['message' => 'Mail queue worker is only available from CLI.']);
        exit;
    }

    if (trim(mail_env_value('MAIL_QUEUE_WORKER_KEY')) === '') {
        http_response_code(503);
        echo json_encode(['message' => 'Web mail queue processing is not securely configured.']);
        exit;
    }

    if (!mail_queue_worker_web_authorized()) {
        http_response_code(403);
        echo json_encode(['message' => 'Mail queue worker is not authorized.']);
        exit;
    }
}

try {
    $bookingReminders = [];
    try {
        $bookingReminders = notification_run_booking_reminders($pdo);
    } catch (Throwable $reminderError) {
        error_log('Booking reminder generation failed: ' . $reminderError->getMessage());
        $bookingReminders = [
            'success' => false,
            'message' => mail_env_bool('MAIL_DEBUG', false)
                ? $reminderError->getMessage()
                : 'Booking reminder generation failed.',
        ];
    }

    $todoReminders = [];
    try {
        $todoReminders = notification_run_todo_reminders($pdo);
    } catch (Throwable $reminderError) {
        error_log('TODO reminder generation failed: ' . $reminderError->getMessage());
        $todoReminders = [
            'success' => false,
            'message' => mail_env_bool('MAIL_DEBUG', false)
                ? $reminderError->getMessage()
                : 'TODO reminder generation failed.',
        ];
    }

    $reminders = [
        'success' => ($bookingReminders['success'] ?? true) !== false
            && ($todoReminders['success'] ?? true) !== false,
        'checked' => (int)($bookingReminders['checked'] ?? 0) + (int)($todoReminders['checked'] ?? 0),
        'processed' => (int)($bookingReminders['processed'] ?? 0) + (int)($todoReminders['processed'] ?? 0),
        'bookings' => $bookingReminders,
        'todos' => $todoReminders,
    ];

    $result = mail_process_queue($pdo, mail_queue_worker_limit());
    $result['reminders'] = $reminders;

    if (PHP_SAPI === 'cli') {
        echo sprintf(
            "Reminders: checked %d, processed %d | Mail queue: claimed %d, sent %d, failed %d\n",
            (int)($reminders['checked'] ?? 0),
            (int)($reminders['processed'] ?? 0),
            (int)$result['claimed'],
            (int)$result['sent'],
            (int)$result['failed']
        );
        exit(0);
    }

    echo json_encode($result);
} catch (Throwable $e) {
    if (PHP_SAPI === 'cli') {
        fwrite(STDERR, "Mail queue failed: {$e->getMessage()}\n");
        exit(1);
    }

    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => mail_env_bool('MAIL_DEBUG', false)
            ? $e->getMessage()
            : 'Mail queue processing failed.',
    ]);
}
