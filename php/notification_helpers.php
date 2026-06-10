<?php

require_once __DIR__ . '/mail_helpers.php';

function notification_column_exists(PDO $pdo, string $tableName, string $columnName): bool
{
    $stmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = ?
          AND column_name = ?
    ");
    $stmt->execute([$tableName, $columnName]);

    return (int)$stmt->fetchColumn() > 0;
}

function notification_ensure_schema(PDO $pdo): void
{
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS notification_preferences (
            user_id INT NOT NULL PRIMARY KEY,
            email_enabled TINYINT(1) NOT NULL DEFAULT 1,
            in_app_enabled TINYINT(1) NOT NULL DEFAULT 1,
            booking_updates TINYINT(1) NOT NULL DEFAULT 1,
            schedule_reminders TINYINT(1) NOT NULL DEFAULT 1,
            payment_updates TINYINT(1) NOT NULL DEFAULT 1,
            diagnosis_updates TINYINT(1) NOT NULL DEFAULT 1,
            queue_updates TINYINT(1) NOT NULL DEFAULT 1,
            boarding_updates TINYINT(1) NOT NULL DEFAULT 1,
            reminder_24h TINYINT(1) NOT NULL DEFAULT 1,
            reminder_2h TINYINT(1) NOT NULL DEFAULT 1,
            reminder_same_day TINYINT(1) NOT NULL DEFAULT 1,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT notification_preferences_user_fk
                FOREIGN KEY (user_id) REFERENCES users(user_id)
                ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS user_notifications (
            notification_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            type VARCHAR(80) NOT NULL DEFAULT 'system',
            category VARCHAR(80) NOT NULL DEFAULT 'system',
            title VARCHAR(180) NOT NULL,
            message TEXT NULL,
            redirect_path VARCHAR(255) NULL,
            in_app_visible TINYINT(1) NOT NULL DEFAULT 1,
            dedupe_key VARCHAR(180) NULL,
            email_subject VARCHAR(180) NULL,
            email_status ENUM('not_sent','sent','failed','skipped') NOT NULL DEFAULT 'not_sent',
            email_sent_at DATETIME NULL,
            email_error TEXT NULL,
            read_at DATETIME NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            KEY user_notifications_user_created_idx (user_id, created_at),
            KEY user_notifications_user_read_idx (user_id, read_at),
            UNIQUE KEY user_notifications_dedupe_unique (user_id, dedupe_key),
            CONSTRAINT user_notifications_user_fk
                FOREIGN KEY (user_id) REFERENCES users(user_id)
                ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    ");

    if (!notification_column_exists($pdo, 'user_notifications', 'in_app_visible')) {
        $pdo->exec("
            ALTER TABLE user_notifications
            ADD COLUMN in_app_visible TINYINT(1) NOT NULL DEFAULT 1 AFTER redirect_path
        ");
    }
}

function notification_bool($value, bool $default = true): int
{
    if ($value === null || $value === '') {
        return $default ? 1 : 0;
    }

    if (is_bool($value)) {
        return $value ? 1 : 0;
    }

    return in_array(strtolower((string)$value), ['1', 'true', 'yes', 'on'], true) ? 1 : 0;
}

function notification_default_preferences(): array
{
    return [
        'email_enabled' => 1,
        'in_app_enabled' => 1,
        'booking_updates' => 1,
        'schedule_reminders' => 1,
        'payment_updates' => 1,
        'diagnosis_updates' => 1,
        'queue_updates' => 1,
        'boarding_updates' => 1,
        'reminder_24h' => 1,
        'reminder_2h' => 1,
        'reminder_same_day' => 1,
    ];
}

function notification_normalize_preferences(array $row): array
{
    $defaults = notification_default_preferences();
    $preferences = [];

    foreach ($defaults as $key => $defaultValue) {
        $preferences[$key] = notification_bool($row[$key] ?? $defaultValue, (bool)$defaultValue);
    }

    return $preferences;
}

function notification_fetch_preferences(PDO $pdo, int $userId): array
{
    notification_ensure_schema($pdo);

    $stmt = $pdo->prepare("SELECT * FROM notification_preferences WHERE user_id = ? LIMIT 1");
    $stmt->execute([$userId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row) {
        $defaults = notification_default_preferences();
        notification_save_preferences($pdo, $userId, $defaults);
        return $defaults;
    }

    return notification_normalize_preferences($row);
}

function notification_save_preferences(PDO $pdo, int $userId, array $preferences): array
{
    notification_ensure_schema($pdo);

    $defaults = notification_default_preferences();
    $normalized = [];

    foreach ($defaults as $key => $defaultValue) {
        $normalized[$key] = notification_bool($preferences[$key] ?? $defaultValue, (bool)$defaultValue);
    }

    $columns = array_keys($normalized);
    $insertColumns = implode(', ', array_merge(['user_id'], $columns));
    $placeholders = implode(', ', array_fill(0, count($columns) + 1, '?'));
    $updates = implode(', ', array_map(fn($column) => "{$column} = VALUES({$column})", $columns));
    $values = array_merge([$userId], array_values($normalized));

    $stmt = $pdo->prepare("
        INSERT INTO notification_preferences ({$insertColumns})
        VALUES ({$placeholders})
        ON DUPLICATE KEY UPDATE {$updates}
    ");
    $stmt->execute($values);

    return $normalized;
}

function notification_category_enabled(array $preferences, string $category): bool
{
    $categoryKey = in_array($category, array_keys(notification_default_preferences()), true)
        ? $category
        : 'in_app_enabled';

    return notification_bool($preferences[$categoryKey] ?? 1) === 1;
}

function notification_fetch_user(PDO $pdo, int $userId): ?array
{
    $stmt = $pdo->prepare("
        SELECT user_id, mail_Address, first_Name, last_Name
        FROM users
        WHERE user_id = ?
        LIMIT 1
    ");
    $stmt->execute([$userId]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    return $user ?: null;
}

function notification_user_name(?array $user): string
{
    if (!$user) {
        return 'there';
    }

    $name = trim((string)(($user['first_Name'] ?? '') . ' ' . ($user['last_Name'] ?? '')));
    return $name !== '' ? $name : 'there';
}

function notification_create(PDO $pdo, array $payload): ?int
{
    notification_ensure_schema($pdo);

    $userId = (int)($payload['user_id'] ?? 0);
    if ($userId <= 0) {
        return null;
    }

    $preferences = notification_fetch_preferences($pdo, $userId);
    $category = trim((string)($payload['category'] ?? 'system')) ?: 'system';
    $forceInApp = !empty($payload['force_in_app']);

    if (!notification_category_enabled($preferences, $category)) {
        return null;
    }

    $inAppVisible = $forceInApp || notification_bool($preferences['in_app_enabled'] ?? 1) === 1;

    $stmt = $pdo->prepare("
        INSERT INTO user_notifications (
            user_id,
            type,
            category,
            title,
            message,
            redirect_path,
            in_app_visible,
            dedupe_key,
            email_subject,
            read_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            notification_id = LAST_INSERT_ID(notification_id),
            type = VALUES(type),
            category = VALUES(category),
            title = VALUES(title),
            message = VALUES(message),
            redirect_path = VALUES(redirect_path),
            in_app_visible = VALUES(in_app_visible),
            email_subject = VALUES(email_subject),
            read_at = CASE WHEN VALUES(in_app_visible) = 1 THEN read_at ELSE COALESCE(read_at, NOW()) END,
            updated_at = CURRENT_TIMESTAMP
    ");
    $stmt->execute([
        $userId,
        trim((string)($payload['type'] ?? 'system')) ?: 'system',
        $category,
        trim((string)($payload['title'] ?? 'Notification')),
        trim((string)($payload['message'] ?? '')),
        trim((string)($payload['redirect_path'] ?? '')) ?: null,
        $inAppVisible ? 1 : 0,
        trim((string)($payload['dedupe_key'] ?? '')) ?: null,
        trim((string)($payload['email_subject'] ?? '')) ?: null,
        $inAppVisible ? null : date('Y-m-d H:i:s'),
    ]);

    return (int)$pdo->lastInsertId();
}

function notification_email_template(string $title, string $intro, array $rows = [], ?array $cta = null, ?string $summary = null): string
{
    $safeTitle = htmlspecialchars($title, ENT_QUOTES, 'UTF-8');
    $safeIntro = nl2br(htmlspecialchars($intro, ENT_QUOTES, 'UTF-8'));
    $rowsHtml = '';
    $summaryHtml = '';

    if ($summary !== null && trim($summary) !== '') {
        $safeSummary = nl2br(htmlspecialchars(trim($summary), ENT_QUOTES, 'UTF-8'));
        $summaryHtml = "
            <div style=\"margin: 0 0 18px; border-radius: 10px; border: 1px solid #bfdbfe; background: #eff6ff; padding: 14px 16px;\">
                <p style=\"margin: 0 0 4px; color: #1d4ed8; font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase;\">Notification Summary</p>
                <p style=\"margin: 0; color: #0f172a; font-size: 15px; font-weight: 700; line-height: 1.5;\">{$safeSummary}</p>
            </div>
        ";
    }

    foreach ($rows as $label => $value) {
        if ($value === null || $value === '') {
            continue;
        }

        $safeLabel = htmlspecialchars((string)$label, ENT_QUOTES, 'UTF-8');
        $safeValue = nl2br(htmlspecialchars((string)$value, ENT_QUOTES, 'UTF-8'));
        $rowsHtml .= "
            <tr>
                <td style=\"padding: 10px 12px; color: #64748b; font-weight: 700; width: 38%; border-bottom: 1px solid #e2e8f0;\">{$safeLabel}</td>
                <td style=\"padding: 10px 12px; color: #0f172a; font-weight: 600; border-bottom: 1px solid #e2e8f0;\">{$safeValue}</td>
            </tr>
        ";
    }

    $ctaHtml = '';
    if ($cta && !empty($cta['label']) && !empty($cta['url'])) {
        $safeLabel = htmlspecialchars((string)$cta['label'], ENT_QUOTES, 'UTF-8');
        $safeUrl = htmlspecialchars((string)$cta['url'], ENT_QUOTES, 'UTF-8');
        $ctaHtml = "
            <p style=\"margin: 24px 0 0;\">
                <a href=\"{$safeUrl}\" style=\"display: inline-block; border-radius: 8px; background: #155dfc; color: #ffffff; font-weight: 700; padding: 12px 18px; text-decoration: none;\">{$safeLabel}</a>
            </p>
        ";
    }

    return "
        <div style=\"margin: 0; padding: 0; background: #f8fafc; font-family: Arial, sans-serif; color: #0f172a;\">
            <div style=\"max-width: 640px; margin: 0 auto; padding: 28px 16px;\">
                <div style=\"border-radius: 14px; overflow: hidden; border: 1px solid #e2e8f0; background: #ffffff;\">
                    <div style=\"background: #155dfc; padding: 22px 24px;\">
                        <p style=\"margin: 0; color: #bfdbfe; font-size: 12px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase;\">iPawcus Veterinary Clinic</p>
                        <h1 style=\"margin: 8px 0 0; color: #ffffff; font-size: 24px; line-height: 1.25;\">{$safeTitle}</h1>
                    </div>
                    <div style=\"padding: 24px;\">
                        <p style=\"margin: 0 0 18px; color: #334155; font-size: 15px; line-height: 1.6;\">{$safeIntro}</p>
                        {$summaryHtml}
                        <table style=\"width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;\">{$rowsHtml}</table>
                        {$ctaHtml}
                        <p style=\"margin: 24px 0 0; color: #64748b; font-size: 12px; line-height: 1.5;\">This message was sent based on your notification preferences. You can update those preferences in your iPawcus profile.</p>
                    </div>
                </div>
            </div>
        </div>
    ";
}

function notification_send_email_if_enabled(PDO $pdo, int $userId, string $category, string $subject, string $html, string $text, ?int $notificationId = null): array
{
    $preferences = notification_fetch_preferences($pdo, $userId);

    if (notification_bool($preferences['email_enabled'] ?? 1) !== 1 || !notification_category_enabled($preferences, $category)) {
        if ($notificationId) {
            $stmt = $pdo->prepare("UPDATE user_notifications SET email_status = 'skipped' WHERE notification_id = ?");
            $stmt->execute([$notificationId]);
        }
        return ['success' => true, 'skipped' => true];
    }

    $user = notification_fetch_user($pdo, $userId);
    $email = trim((string)($user['mail_Address'] ?? ''));

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        if ($notificationId) {
            $stmt = $pdo->prepare("UPDATE user_notifications SET email_status = 'failed', email_error = ? WHERE notification_id = ?");
            $stmt->execute(['Recipient email is missing or invalid.', $notificationId]);
        }
        return ['success' => false, 'message' => 'Recipient email is missing or invalid.'];
    }

    try {
        $result = send_smtp_email($email, $subject, $html, $text, ['toName' => notification_user_name($user)]);

        if ($notificationId) {
            $stmt = $pdo->prepare("
                UPDATE user_notifications
                SET email_status = 'sent',
                    email_sent_at = NOW(),
                    email_error = NULL
                WHERE notification_id = ?
            ");
            $stmt->execute([$notificationId]);
        }

        return $result;
    } catch (Throwable $e) {
        if ($notificationId) {
            $stmt = $pdo->prepare("UPDATE user_notifications SET email_status = 'failed', email_error = ? WHERE notification_id = ?");
            $stmt->execute([$e->getMessage(), $notificationId]);
        }

        error_log('Notification email failed: ' . $e->getMessage());
        return ['success' => false, 'message' => $e->getMessage()];
    }
}

function notification_create_event(PDO $pdo, array $payload): ?int
{
    notification_ensure_schema($pdo);

    $existingNotification = null;
    $dedupeKey = trim((string)($payload['dedupe_key'] ?? ''));
    $userId = (int)($payload['user_id'] ?? 0);

    if ($userId > 0 && $dedupeKey !== '') {
        $existingStmt = $pdo->prepare("
            SELECT notification_id, email_status
            FROM user_notifications
            WHERE user_id = ?
              AND dedupe_key = ?
            LIMIT 1
        ");
        $existingStmt->execute([$userId, $dedupeKey]);
        $existingNotification = $existingStmt->fetch(PDO::FETCH_ASSOC) ?: null;
    }

    $notificationId = notification_create($pdo, $payload);
    $effectiveNotificationId = $notificationId ?: ($existingNotification ? (int)$existingNotification['notification_id'] : null);
    $emailAlreadyHandled = $existingNotification
        && in_array((string)$existingNotification['email_status'], ['sent', 'skipped'], true);

    if (!$emailAlreadyHandled && !empty($payload['email_subject']) && !empty($payload['email_html'])) {
        notification_send_email_if_enabled(
            $pdo,
            (int)$payload['user_id'],
            (string)($payload['category'] ?? 'system'),
            (string)$payload['email_subject'],
            (string)$payload['email_html'],
            (string)($payload['email_text'] ?? ''),
            $effectiveNotificationId
        );
    }

    return $notificationId;
}

function notification_format_datetime(?string $date, ?string $time): string
{
    $date = trim((string)$date);
    $time = trim((string)$time);

    if ($date === '') {
        return 'Not set';
    }

    $timestamp = strtotime(trim($date . ' ' . $time));
    if ($timestamp === false) {
        return trim($date . ' ' . $time);
    }

    return date('F j, Y', $timestamp) . ($time !== '' ? ' at ' . date('g:i A', $timestamp) : '');
}

function notification_service_name(array $booking): string
{
    $service = trim((string)($booking['service_type'] ?? 'Booking'));
    return ucwords(str_replace(['_', '-'], ' ', $service));
}

function notification_fetch_booking(PDO $pdo, int $bookingId): ?array
{
    $stmt = $pdo->prepare("
        SELECT
            b.*,
            u.mail_Address,
            u.first_Name,
            u.last_Name,
            p.pet_name
        FROM bookings b
        JOIN users u ON u.user_id = b.user_id
        LEFT JOIN pets_information p ON p.pet_id = b.pet_id
        WHERE b.booking_id = ?
        LIMIT 1
    ");
    $stmt->execute([$bookingId]);
    $booking = $stmt->fetch(PDO::FETCH_ASSOC);

    return $booking ?: null;
}

function notification_send_booking_event(PDO $pdo, int $bookingId, string $event, array $context = []): void
{
    $booking = notification_fetch_booking($pdo, $bookingId);
    if (!$booking) {
        return;
    }

    $ownerUserId = (int)$booking['user_id'];
    $petName = trim((string)($booking['pet_name'] ?? $booking['unregistered_pet_name'] ?? 'your pet'));
    $bookingNumber = (string)$booking['booking_number'];
    $serviceName = notification_service_name($booking);
    $schedule = notification_format_datetime($booking['booking_date'] ?? null, $booking['booking_time'] ?? null);
    $redirectPath = !empty($booking['is_online_consultation'])
        ? "/dashboard/consult/confirmation/{$bookingId}"
        : '/dashboard/todos';

    $title = 'Booking update';
    $message = "Booking {$bookingNumber} has been updated.";
    $subject = "iPawcus booking update - {$bookingNumber}";
    $intro = "Hello " . notification_user_name($booking) . ", your booking has been updated.";
    $type = 'booking_update';
    $dedupeKey = null;
    $reason = 'There was an update to this booking.';

    if ($event === 'submitted') {
        $title = 'Booking received';
        $message = "{$bookingNumber} for {$petName} was received and is waiting for admin review.";
        $subject = "We received your iPawcus booking - {$bookingNumber}";
        $intro = "Hello " . notification_user_name($booking) . ", your booking request was received. Clinic staff will review the details and notify you when it is confirmed.";
        $type = 'booking_submitted';
        $dedupeKey = "booking-submitted-{$bookingId}";
        $reason = 'Your booking request was submitted for admin review.';
    } elseif ($event === 'confirmed') {
        $title = 'Booking confirmed';
        $message = "{$bookingNumber} for {$petName} is confirmed for {$schedule}.";
        $subject = "Your iPawcus booking is confirmed - {$bookingNumber}";
        $intro = "Hello " . notification_user_name($booking) . ", your appointment has been confirmed. Please arrive 10 minutes before the scheduled time.";
        $type = 'booking_confirmed';
        $dedupeKey = "booking-confirmed-{$bookingId}";
        $reason = 'Clinic staff approved and confirmed this booking.';
    } elseif ($event === 'cancelled') {
        $title = 'Booking cancelled';
        $message = "{$bookingNumber} for {$petName} has been cancelled.";
        $subject = "Your iPawcus booking was cancelled - {$bookingNumber}";
        $intro = "Hello " . notification_user_name($booking) . ", your booking has been cancelled. If payment proof was submitted, clinic staff will coordinate the return process manually.";
        $type = 'booking_cancelled';
        $dedupeKey = "booking-cancelled-{$bookingId}-" . time();
        $reason = 'This booking was cancelled.';
    } elseif ($event === 'rescheduled') {
        $oldSchedule = notification_format_datetime($context['old_date'] ?? null, $context['old_time'] ?? null);
        $title = 'Booking rescheduled';
        $message = "{$bookingNumber} for {$petName} moved from {$oldSchedule} to {$schedule}.";
        $subject = "Your iPawcus booking was rescheduled - {$bookingNumber}";
        $intro = "Hello " . notification_user_name($booking) . ", your booking schedule was adjusted. Reminders will now follow the updated date and time.";
        $type = 'booking_rescheduled';
        $dedupeKey = "booking-rescheduled-{$bookingId}-" . md5($oldSchedule . '|' . $schedule . '|' . microtime(true));
        $reason = !empty($context['reason']) ? $context['reason'] : 'The clinic adjusted this booking schedule.';
    }

    $rows = [
        'Reason' => $reason,
        'Booking Number' => $bookingNumber,
        'Pet' => $petName,
        'Service' => $serviceName,
        'Schedule' => $schedule,
    ];

    if (!empty($context['reason'])) {
        $rows['Reason'] = $context['reason'];
    }

    if (!empty($context['cancellation_message'])) {
        $rows['Cancellation Note'] = $context['cancellation_message'];
    }

    $emailSummary = "Pet: {$petName} | Booking: {$bookingNumber}";
    $emailHtml = notification_email_template($title, $intro, $rows, null, $emailSummary);
    $emailText = trim($intro . "\n\nSummary: {$emailSummary}\n\n" . implode("\n", array_map(
        fn($key, $value) => "{$key}: {$value}",
        array_keys($rows),
        array_values($rows)
    )));

    notification_create_event($pdo, [
        'user_id' => $ownerUserId,
        'type' => $type,
        'category' => 'booking_updates',
        'title' => $title,
        'message' => $message,
        'redirect_path' => $redirectPath,
        'dedupe_key' => $dedupeKey,
        'email_subject' => $subject,
        'email_html' => $emailHtml,
        'email_text' => $emailText,
    ]);
}

function notification_booking_schedule_datetime(array $booking): ?DateTimeImmutable
{
    $date = trim((string)($booking['booking_date'] ?? ''));
    $time = trim((string)($booking['booking_time'] ?? ''));

    if ($date === '' || $time === '') {
        return null;
    }

    try {
        return new DateTimeImmutable(trim($date . ' ' . $time));
    } catch (Throwable $e) {
        return null;
    }
}

function notification_booking_reminder_slot(array $booking, DateTimeImmutable $now): ?array
{
    $scheduledAt = notification_booking_schedule_datetime($booking);

    if (!$scheduledAt || $scheduledAt <= $now) {
        return null;
    }

    $secondsUntil = $scheduledAt->getTimestamp() - $now->getTimestamp();
    $sameDay = $scheduledAt->format('Y-m-d') === $now->format('Y-m-d');

    if ($secondsUntil <= 2 * 60 * 60) {
        return [
            'slug' => '2h',
            'preference' => 'reminder_2h',
            'title' => 'Appointment starts soon',
            'lead' => 'within about 2 hours',
        ];
    }

    if ($sameDay) {
        return [
            'slug' => 'same-day',
            'preference' => 'reminder_same_day',
            'title' => 'Appointment today',
            'lead' => 'today',
        ];
    }

    if ($secondsUntil <= 24 * 60 * 60) {
        return [
            'slug' => '24h',
            'preference' => 'reminder_24h',
            'title' => 'Appointment tomorrow',
            'lead' => 'in about 24 hours',
        ];
    }

    return null;
}

function notification_send_booking_reminder(PDO $pdo, array $booking, array $slot): ?int
{
    $ownerUserId = (int)($booking['user_id'] ?? 0);
    if ($ownerUserId <= 0) {
        return null;
    }

    $preferences = notification_fetch_preferences($pdo, $ownerUserId);
    if (notification_bool($preferences[$slot['preference']] ?? 1) !== 1) {
        return null;
    }

    $bookingId = (int)$booking['booking_id'];
    $scheduledAt = notification_booking_schedule_datetime($booking);
    if (!$scheduledAt) {
        return null;
    }

    $petName = trim((string)($booking['pet_name'] ?? $booking['unregistered_pet_name'] ?? 'your pet'));
    $bookingNumber = trim((string)($booking['booking_number'] ?? ('Booking #' . $bookingId)));
    $serviceName = notification_service_name($booking);
    $schedule = notification_format_datetime($booking['booking_date'] ?? null, $booking['booking_time'] ?? null);
    $redirectPath = !empty($booking['is_online_consultation'])
        ? "/dashboard/consult/confirmation/{$bookingId}"
        : '/dashboard/todos';
    $title = $slot['title'];
    $message = "{$bookingNumber} for {$petName} is scheduled {$slot['lead']}.";
    $intro = "Hello " . notification_user_name($booking) . ", this is a reminder for your iPawcus appointment {$slot['lead']}.";
    $reason = "This appointment is scheduled {$slot['lead']}.";
    $rows = [
        'Reason' => $reason,
        'Booking Number' => $bookingNumber,
        'Pet' => $petName,
        'Service' => $serviceName,
        'Schedule' => $schedule,
    ];
    $emailSummary = "Pet: {$petName} | Booking: {$bookingNumber} | Reminder: {$slot['lead']}";
    $emailHtml = notification_email_template($title, $intro, $rows, null, $emailSummary);
    $emailText = trim($intro . "\n\nSummary: {$emailSummary}\n\n" . implode("\n", array_map(
        fn($key, $value) => "{$key}: {$value}",
        array_keys($rows),
        array_values($rows)
    )));

    return notification_create_event($pdo, [
        'user_id' => $ownerUserId,
        'type' => 'booking_schedule_reminder',
        'category' => 'schedule_reminders',
        'title' => $title,
        'message' => $message,
        'redirect_path' => $redirectPath,
        'dedupe_key' => "booking-reminder-{$slot['slug']}-{$bookingId}-" . $scheduledAt->format('YmdHi'),
        'email_subject' => "{$title} - {$bookingNumber}",
        'email_html' => $emailHtml,
        'email_text' => $emailText,
    ]);
}

function notification_run_booking_reminders(PDO $pdo): array
{
    notification_ensure_schema($pdo);

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
        LIMIT 200
    ");
    $stmt->execute();

    $now = new DateTimeImmutable('now');
    $checked = 0;
    $processed = 0;
    $skipped = 0;

    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $booking) {
        $checked++;
        $slot = notification_booking_reminder_slot($booking, $now);

        if (!$slot) {
            $skipped++;
            continue;
        }

        $notificationId = notification_send_booking_reminder($pdo, $booking, $slot);
        if ($notificationId) {
            $processed++;
        } else {
            $skipped++;
        }
    }

    return [
        'checked' => $checked,
        'processed' => $processed,
        'skipped' => $skipped,
    ];
}

function notification_fetch_queue(PDO $pdo, int $queueId): ?array
{
    $stmt = $pdo->prepare("
        SELECT
            q.*,
            p.pet_name,
            p.pet_species,
            u.first_Name,
            u.last_Name,
            u.mail_Address
        FROM queues q
        JOIN users u ON u.user_id = q.user_id
        LEFT JOIN pets_information p ON p.pet_id = q.pet_id
        WHERE q.queue_id = ?
        LIMIT 1
    ");
    $stmt->execute([$queueId]);
    $queue = $stmt->fetch(PDO::FETCH_ASSOC);

    return $queue ?: null;
}

function notification_send_queue_event(PDO $pdo, int $queueId, string $event, array $context = []): void
{
    $queue = notification_fetch_queue($pdo, $queueId);
    if (!$queue || empty($queue['user_id'])) {
        return;
    }

    $ownerUserId = (int)$queue['user_id'];
    $petName = trim((string)($queue['pet_name'] ?? 'your pet'));
    $queueNumber = '#' . (int)$queue['queue_number'];
    $serviceName = trim((string)($queue['service_name'] ?? 'Clinic queue')) ?: 'Clinic queue';
    $status = trim((string)($queue['status'] ?? 'waiting'));
    $reason = trim((string)($context['reason'] ?? ''));
    $title = 'Queue update';
    $message = "{$petName} has a queue update for {$queueNumber}.";
    $subject = "Queue update for {$petName} - {$queueNumber}";
    $intro = "Hello " . notification_user_name($queue) . ", there is an update for your pet's clinic queue.";
    $type = 'queue_update';
    $dedupeKey = "queue-update-{$queueId}-{$event}-" . time();

    if ($event === 'created') {
        $title = 'Queue created';
        $message = "{$petName} was added to queue {$queueNumber}.";
        $subject = "Queue created for {$petName} - {$queueNumber}";
        $intro = "Hello " . notification_user_name($queue) . ", your pet has been added to the clinic queue.";
        $type = 'queue_created';
        $reason = $reason !== '' ? $reason : 'A queue entry was created for clinic service.';
        $dedupeKey = "queue-created-{$queueId}";
    } elseif ($event === 'in_progress') {
        $title = 'Queue approved';
        $message = "{$petName} is now in progress for queue {$queueNumber}.";
        $subject = "Queue approved for {$petName} - {$queueNumber}";
        $intro = "Hello " . notification_user_name($queue) . ", your pet's queue entry is now in progress.";
        $type = 'queue_in_progress';
        $reason = $reason !== '' ? $reason : 'Clinic staff approved this queue entry.';
    } elseif ($event === 'received') {
        $vetName = trim((string)($context['veterinarian_name'] ?? 'the veterinarian'));
        $title = 'Pet received by veterinarian';
        $message = "{$petName} from queue {$queueNumber} was received by {$vetName}.";
        $subject = "Veterinarian received {$petName} - {$queueNumber}";
        $intro = "Hello " . notification_user_name($queue) . ", the veterinarian has received your pet from the queue.";
        $type = 'queue_received';
        $reason = $reason !== '' ? $reason : "Your pet was received by {$vetName}.";
    } elseif (in_array($event, ['completed', 'done'], true)) {
        $title = 'Queue completed';
        $message = "{$petName}'s queue {$queueNumber} is completed.";
        $subject = "Queue completed for {$petName} - {$queueNumber}";
        $intro = "Hello " . notification_user_name($queue) . ", your pet's queue service has been completed.";
        $type = 'queue_completed';
        $reason = $reason !== '' ? $reason : 'Clinic staff marked this queue service as completed.';
    } elseif ($event === 'cancelled') {
        $title = 'Queue cancelled';
        $message = "{$petName}'s queue {$queueNumber} was cancelled.";
        $subject = "Queue cancelled for {$petName} - {$queueNumber}";
        $intro = "Hello " . notification_user_name($queue) . ", your pet's queue entry was cancelled.";
        $type = 'queue_cancelled';
        $reason = $reason !== '' ? $reason : 'Clinic staff cancelled this queue entry.';
    }

    $rows = [
        'Reason' => $reason,
        'Pet' => $petName,
        'Queue Number' => $queueNumber,
        'Service' => $serviceName,
        'Status' => ucwords(str_replace('-', ' ', $status)),
    ];
    $emailSummary = "Pet: {$petName} | Queue: {$queueNumber}";
    $emailHtml = notification_email_template($title, $intro, $rows, null, $emailSummary);
    $emailText = trim($intro . "\n\nSummary: {$emailSummary}\n\n" . implode("\n", array_map(
        fn($key, $value) => "{$key}: {$value}",
        array_keys($rows),
        array_values($rows)
    )));

    notification_create_event($pdo, [
        'user_id' => $ownerUserId,
        'type' => $type,
        'category' => 'queue_updates',
        'title' => $title,
        'message' => $message,
        'redirect_path' => '/dashboard/todos',
        'dedupe_key' => $dedupeKey,
        'email_subject' => $subject,
        'email_html' => $emailHtml,
        'email_text' => $emailText,
    ]);
}

function notification_fetch_visit_summary(PDO $pdo, int $visitId): ?array
{
    $stmt = $pdo->prepare("
        SELECT
            v.*,
            p.pet_name,
            p.pet_species,
            u.first_Name,
            u.last_Name,
            u.mail_Address,
            b.booking_number,
            q.queue_number,
            COALESCE(charges.total_charges, 0) AS total_charges,
            COALESCE(payments.total_paid, 0) AS total_paid
        FROM visits v
        JOIN pets_information p ON p.pet_id = v.pet_id
        JOIN users u ON u.user_id = v.owner_user_id
        LEFT JOIN bookings b ON b.booking_id = v.booking_id
        LEFT JOIN queues q ON q.queue_id = v.queue_id
        LEFT JOIN (
            SELECT visit_id, SUM(subtotal) AS total_charges
            FROM visit_charges
            GROUP BY visit_id
        ) charges ON charges.visit_id = v.visit_id
        LEFT JOIN (
            SELECT visit_id, SUM(amount) AS total_paid
            FROM visit_payments
            WHERE payment_status = 'verified'
            GROUP BY visit_id
        ) payments ON payments.visit_id = v.visit_id
        WHERE v.visit_id = ?
        LIMIT 1
    ");
    $stmt->execute([$visitId]);
    $visit = $stmt->fetch(PDO::FETCH_ASSOC);

    return $visit ?: null;
}

function notification_money($amount): string
{
    return 'PHP ' . number_format((float)$amount, 2);
}

function notification_send_visit_event(PDO $pdo, int $visitId, string $event, array $context = []): void
{
    $visit = notification_fetch_visit_summary($pdo, $visitId);
    if (!$visit) {
        return;
    }

    $ownerUserId = (int)$visit['owner_user_id'];
    $petName = (string)($visit['pet_name'] ?? 'your pet');
    $total = (float)($visit['total_charges'] ?? 0);
    $paid = (float)($visit['total_paid'] ?? 0);
    $balance = max(0, $total - $paid);
    $reference = $visit['booking_number'] ?: ($visit['queue_number'] ? 'Queue #' . $visit['queue_number'] : 'Visit #' . $visitId);
    $redirectPath = '/dashboard/todos';

    if ($event === 'payment_received') {
        $amount = (float)($context['amount'] ?? 0);
        $invoice = trim((string)($context['reference_number'] ?? ''));
        $title = 'Payment received';
        $message = notification_money($amount) . " payment was recorded for {$petName}.";
        $subject = "Payment received for {$petName}";
        $intro = "Hello " . notification_user_name($visit) . ", your payment has been recorded by the clinic.";
        $reason = 'A clinic staff member recorded a payment for this visit.';
        $rows = [
            'Reason' => $reason,
            'Pet' => $petName,
            'Reference' => $reference,
            'Payment Amount' => notification_money($amount),
            'Invoice / Receipt' => $invoice,
            'Remaining Balance' => notification_money($balance),
        ];
        $dedupeKey = !empty($context['payment_id']) ? 'visit-payment-' . (int)$context['payment_id'] : null;
        $type = 'payment_received';
    } else {
        if ($total <= 0) {
            return;
        }

        $title = 'Invoice ready';
        $message = "An invoice for {$petName} is ready. Balance: " . notification_money($balance) . ".";
        $subject = "Invoice ready for {$petName}";
        $intro = "Hello " . notification_user_name($visit) . ", the clinic prepared billing details for the recent visit.";
        $reason = 'Billing details were prepared and there is a remaining balance.';
        $rows = [
            'Reason' => $reason,
            'Pet' => $petName,
            'Reference' => $reference,
            'Total Charges' => notification_money($total),
            'Paid' => notification_money($paid),
            'Balance' => notification_money($balance),
        ];
        $dedupeKey = "visit-invoice-ready-{$visitId}";
        $type = 'invoice_ready';
    }

    $emailSummary = "Pet: {$petName} | Reference: {$reference} | Reason: {$reason}";
    $emailHtml = notification_email_template($title, $intro, $rows, null, $emailSummary);
    $emailText = trim($intro . "\n\nSummary: {$emailSummary}\n\n" . implode("\n", array_map(
        fn($key, $value) => "{$key}: {$value}",
        array_keys($rows),
        array_values($rows)
    )));

    notification_create_event($pdo, [
        'user_id' => $ownerUserId,
        'type' => $type,
        'category' => 'payment_updates',
        'title' => $title,
        'message' => $message,
        'redirect_path' => $redirectPath,
        'dedupe_key' => $dedupeKey,
        'email_subject' => $subject,
        'email_html' => $emailHtml,
        'email_text' => $emailText,
    ]);
}

function notification_fetch_diagnosis_summary(PDO $pdo, int $diagnosisId): ?array
{
    $stmt = $pdo->prepare("
        SELECT
            vd.*,
            p.pet_name,
            p.pet_species,
            owner.user_id AS owner_user_id,
            owner.first_Name,
            owner.last_Name,
            owner.mail_Address,
            b.booking_number,
            q.queue_number
        FROM vet_diagnoses vd
        JOIN pets_information p ON p.pet_id = vd.pet_id
        LEFT JOIN queues q ON q.queue_id = vd.queue_id
        LEFT JOIN bookings b ON b.booking_id = vd.booking_id
        LEFT JOIN users owner ON owner.user_id = COALESCE(q.user_id, b.user_id)
        WHERE vd.diagnosis_id = ?
        LIMIT 1
    ");
    $stmt->execute([$diagnosisId]);
    $diagnosis = $stmt->fetch(PDO::FETCH_ASSOC);

    return $diagnosis ?: null;
}

function notification_send_diagnosis_event(PDO $pdo, int $diagnosisId): void
{
    $diagnosis = notification_fetch_diagnosis_summary($pdo, $diagnosisId);
    if (!$diagnosis || empty($diagnosis['owner_user_id'])) {
        return;
    }

    $ownerUserId = (int)$diagnosis['owner_user_id'];
    $petName = (string)($diagnosis['pet_name'] ?? 'your pet');
    $serviceName = trim((string)($diagnosis['service_name'] ?? 'Clinic visit')) ?: 'Clinic visit';
    $notes = trim((string)($diagnosis['notes'] ?? ''));
    $followUp = trim((string)($diagnosis['follow_up_date'] ?? ''));
    $reference = $diagnosis['booking_number'] ?: ($diagnosis['queue_number'] ? 'Queue #' . $diagnosis['queue_number'] : 'Diagnosis #' . $diagnosisId);
    $title = 'Diagnosis completed';
    $message = "A diagnosis record for {$petName} is now available.";

    if ($followUp !== '') {
        $message .= " Follow-up: " . notification_format_datetime($followUp, null) . ".";
    }

    $intro = "Hello " . notification_user_name($diagnosis) . ", the veterinarian completed a diagnosis record for {$petName}.";
    $rows = [
        'Pet' => $petName,
        'Reference' => $reference,
        'Service' => $serviceName,
        'Notes' => $notes !== '' ? $notes : 'No notes were added.',
        'Follow-up Date' => $followUp !== '' ? notification_format_datetime($followUp, null) : '',
    ];
    $emailSummary = "Pet: {$petName} | Reference: {$reference}";
    $emailHtml = notification_email_template($title, $intro, $rows, null, $emailSummary);
    $emailText = trim($intro . "\n\nSummary: {$emailSummary}\n\n" . implode("\n", array_map(
        fn($key, $value) => "{$key}: {$value}",
        array_keys($rows),
        array_values($rows)
    )));

    notification_create_event($pdo, [
        'user_id' => $ownerUserId,
        'type' => 'diagnosis_completed',
        'category' => 'diagnosis_updates',
        'title' => $title,
        'message' => $message,
        'redirect_path' => '/dashboard/my-pets/' . (int)$diagnosis['pet_id'],
        'dedupe_key' => "diagnosis-completed-{$diagnosisId}",
        'email_subject' => "Diagnosis completed for {$petName}",
        'email_html' => $emailHtml,
        'email_text' => $emailText,
    ]);
}
