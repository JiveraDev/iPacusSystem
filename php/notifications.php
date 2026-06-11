<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/notification_helpers.php';

header('Content-Type: application/json');

function notifications_input(): array
{
    return json_decode(file_get_contents('php://input'), true) ?: [];
}

function notifications_user_id(array $input = []): int
{
    return (int)($_GET['userId'] ?? $_GET['user_id'] ?? $input['user_id'] ?? $input['userId'] ?? 0);
}

function notifications_error(int $status, string $message): void
{
    http_response_code($status);
    echo json_encode(['success' => false, 'message' => $message]);
    exit;
}

function notifications_reminder_authorized(array $input): bool
{
    $expectedKey = trim((string)(getenv('NOTIFICATION_REMINDER_KEY') ?: ''));

    if ($expectedKey === '') {
        return true;
    }

    $providedKey = trim((string)(
        $_SERVER['HTTP_X_NOTIFICATION_REMINDER_KEY']
        ?? $_GET['reminderKey']
        ?? $input['reminderKey']
        ?? $input['reminder_key']
        ?? ''
    ));

    return hash_equals($expectedKey, $providedKey);
}

function notifications_pet_redirect($petId): ?string
{
    $numericPetId = (int)$petId;
    return $numericPetId > 0 ? "/dashboard/my-pets/{$numericPetId}" : null;
}

function notifications_lookup_pet_id(PDO $pdo, string $sql, int $id): ?int
{
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$id]);
    $petId = (int)($stmt->fetchColumn() ?: 0);

    return $petId > 0 ? $petId : null;
}

function notifications_resolve_pet_redirect(PDO $pdo, array $notification): ?string
{
    $existingPath = trim((string)($notification['redirect_path'] ?? ''));
    if (str_starts_with($existingPath, '/dashboard/my-pets/')) {
        return $existingPath;
    }

    $dedupeKey = trim((string)($notification['dedupe_key'] ?? ''));
    if ($dedupeKey === '') {
        return null;
    }

    try {
        if (
            preg_match('/^booking-(?:submitted|confirmed|cancelled|rescheduled)-(\d+)/', $dedupeKey, $matches)
            || preg_match('/^booking-reminder-[^-]+-(\d+)-/', $dedupeKey, $matches)
        ) {
            return notifications_pet_redirect(notifications_lookup_pet_id(
                $pdo,
                'SELECT pet_id FROM bookings WHERE booking_id = ? LIMIT 1',
                (int)$matches[1]
            ));
        }

        if (preg_match('/^queue-update-(\d+)-/', $dedupeKey, $matches)) {
            return notifications_pet_redirect(notifications_lookup_pet_id(
                $pdo,
                'SELECT pet_id FROM queues WHERE queue_id = ? LIMIT 1',
                (int)$matches[1]
            ));
        }

        if (preg_match('/^diagnosis-completed-(\d+)/', $dedupeKey, $matches)) {
            return notifications_pet_redirect(notifications_lookup_pet_id(
                $pdo,
                'SELECT pet_id FROM vet_diagnoses WHERE diagnosis_id = ? LIMIT 1',
                (int)$matches[1]
            ));
        }

        if (preg_match('/^visit-invoice-ready-(\d+)/', $dedupeKey, $matches)) {
            return notifications_pet_redirect(notifications_lookup_pet_id(
                $pdo,
                'SELECT pet_id FROM visits WHERE visit_id = ? LIMIT 1',
                (int)$matches[1]
            ));
        }

        if (preg_match('/^visit-payment-(\d+)/', $dedupeKey, $matches)) {
            return notifications_pet_redirect(notifications_lookup_pet_id(
                $pdo,
                'SELECT v.pet_id FROM visit_payments vp JOIN visits v ON v.visit_id = vp.visit_id WHERE vp.payment_id = ? LIMIT 1',
                (int)$matches[1]
            ));
        }
    } catch (Throwable $error) {
        error_log('Notification pet redirect lookup failed: ' . $error->getMessage());
    }

    return null;
}

try {
    notification_ensure_schema($pdo);

    $method = $_SERVER['REQUEST_METHOD'];
    $action = $_GET['action'] ?? 'list';

    if ($action === 'push-public-key') {
        if ($method !== 'GET') {
            notifications_error(405, 'Method not allowed.');
        }

        echo json_encode([
            'success' => true,
            'push' => notification_push_config_status(),
        ]);
        exit;
    }

    if ($action === 'push-status') {
        if ($method !== 'GET') {
            notifications_error(405, 'Method not allowed.');
        }

        $userId = notifications_user_id();
        if ($userId <= 0) {
            notifications_error(400, 'userId is required.');
        }

        echo json_encode([
            'success' => true,
            'push' => notification_push_user_status($pdo, $userId),
        ]);
        exit;
    }

    if ($action === 'push-subscribe') {
        if ($method !== 'POST') {
            notifications_error(405, 'Method not allowed.');
        }

        $input = notifications_input();
        $userId = notifications_user_id($input);
        if ($userId <= 0 || !is_array($input['subscription'] ?? null)) {
            notifications_error(400, 'user_id and subscription are required.');
        }

        $result = notification_push_save_subscription(
            $pdo,
            $userId,
            $input['subscription'],
            trim((string)($input['userAgent'] ?? $_SERVER['HTTP_USER_AGENT'] ?? ''))
        );

        echo json_encode([
            'success' => true,
            'push' => array_merge(notification_push_user_status($pdo, $userId), $result),
        ]);
        exit;
    }

    if ($action === 'push-unsubscribe') {
        if ($method !== 'POST') {
            notifications_error(405, 'Method not allowed.');
        }

        $input = notifications_input();
        $userId = notifications_user_id($input);
        if ($userId <= 0) {
            notifications_error(400, 'user_id is required.');
        }

        echo json_encode([
            'success' => true,
            'push' => notification_push_disable_subscription(
                $pdo,
                $userId,
                trim((string)($input['endpoint'] ?? ''))
            ),
        ]);
        exit;
    }

    if ($action === 'preferences') {
        if ($method === 'GET') {
            $userId = notifications_user_id();
            if ($userId <= 0) {
                notifications_error(400, 'userId is required.');
            }

            echo json_encode([
                'success' => true,
                'preferences' => notification_fetch_preferences($pdo, $userId),
            ]);
            exit;
        }

        if ($method === 'POST' || $method === 'PATCH') {
            $input = notifications_input();
            $userId = notifications_user_id($input);
            if ($userId <= 0) {
                notifications_error(400, 'user_id is required.');
            }

            $preferences = $input['preferences'] ?? $input;
            if (!is_array($preferences)) {
                notifications_error(400, 'preferences must be an object.');
            }

            echo json_encode([
                'success' => true,
                'preferences' => notification_save_preferences($pdo, $userId, $preferences),
            ]);
            exit;
        }

        notifications_error(405, 'Method not allowed.');
    }

    if ($action === 'read') {
        if ($method !== 'PATCH' && $method !== 'POST') {
            notifications_error(405, 'Method not allowed.');
        }

        $input = notifications_input();
        $userId = notifications_user_id($input);
        $notificationId = (int)($_GET['notificationId'] ?? $input['notification_id'] ?? $input['notificationId'] ?? 0);

        if ($userId <= 0 || $notificationId <= 0) {
            notifications_error(400, 'user_id and notification_id are required.');
        }

        $stmt = $pdo->prepare("
            UPDATE user_notifications
            SET read_at = COALESCE(read_at, NOW())
            WHERE notification_id = ?
              AND user_id = ?
        ");
        $stmt->execute([$notificationId, $userId]);

        echo json_encode(['success' => true]);
        exit;
    }

    if ($action === 'read-all') {
        if ($method !== 'POST') {
            notifications_error(405, 'Method not allowed.');
        }

        $input = notifications_input();
        $userId = notifications_user_id($input);
        if ($userId <= 0) {
            notifications_error(400, 'user_id is required.');
        }

        $stmt = $pdo->prepare("
            UPDATE user_notifications
            SET read_at = COALESCE(read_at, NOW())
            WHERE user_id = ?
              AND in_app_visible = 1
              AND read_at IS NULL
        ");
        $stmt->execute([$userId]);

        echo json_encode(['success' => true]);
        exit;
    }

    if ($action === 'run-reminders') {
        if ($method !== 'POST') {
            notifications_error(405, 'Method not allowed.');
        }

        $input = notifications_input();
        if (!notifications_reminder_authorized($input)) {
            notifications_error(403, 'Reminder runner is not authorized.');
        }

        echo json_encode([
            'success' => true,
            'reminders' => notification_run_booking_reminders($pdo),
        ]);
        exit;
    }

    if ($method === 'GET') {
        $userId = notifications_user_id();
        if ($userId <= 0) {
            notifications_error(400, 'userId is required.');
        }

        $limit = max(1, min(50, (int)($_GET['limit'] ?? 15)));
        $stmt = $pdo->prepare("
            SELECT
                notification_id,
                user_id,
                type,
                category,
                title,
                message,
                redirect_path,
                dedupe_key,
                email_status,
                email_sent_at,
                push_status,
                push_sent_at,
                read_at,
                created_at
            FROM user_notifications
            WHERE user_id = ?
              AND in_app_visible = 1
            ORDER BY created_at DESC, notification_id DESC
            LIMIT {$limit}
        ");
        $stmt->execute([$userId]);
        $notifications = array_map(function ($notification) use ($pdo) {
            $petRedirectPath = notifications_resolve_pet_redirect($pdo, $notification);

            return [
                'notificationId' => (int)$notification['notification_id'],
                'userId' => (int)$notification['user_id'],
                'type' => $notification['type'],
                'category' => $notification['category'],
                'title' => $notification['title'],
                'message' => $notification['message'],
                'redirectPath' => $petRedirectPath ?: $notification['redirect_path'],
                'petRedirectPath' => $petRedirectPath,
                'emailStatus' => $notification['email_status'],
                'emailSentAt' => $notification['email_sent_at'],
                'pushStatus' => $notification['push_status'],
                'pushSentAt' => $notification['push_sent_at'],
                'readAt' => $notification['read_at'],
                'createdAt' => $notification['created_at'],
            ];
        }, $stmt->fetchAll(PDO::FETCH_ASSOC));

        $unreadStmt = $pdo->prepare("SELECT COUNT(*) FROM user_notifications WHERE user_id = ? AND in_app_visible = 1 AND read_at IS NULL");
        $unreadStmt->execute([$userId]);
        $unreadCount = (int)$unreadStmt->fetchColumn();

        $summaryStmt = $pdo->prepare("
            SELECT
                category,
                COUNT(*) AS total_count,
                SUM(CASE WHEN read_at IS NULL THEN 1 ELSE 0 END) AS unread_count
            FROM user_notifications
            WHERE user_id = ?
              AND in_app_visible = 1
              AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            GROUP BY category
            ORDER BY unread_count DESC, total_count DESC, category ASC
        ");
        $summaryStmt->execute([$userId]);
        $categorySummary = array_map(function ($row) {
            return [
                'category' => $row['category'],
                'total' => (int)$row['total_count'],
                'unread' => (int)$row['unread_count'],
            ];
        }, $summaryStmt->fetchAll(PDO::FETCH_ASSOC));

        echo json_encode([
            'success' => true,
            'notifications' => $notifications,
            'unreadCount' => $unreadCount,
            'summary' => [
                'unreadCount' => $unreadCount,
                'visibleCount' => count($notifications),
                'categories' => $categorySummary,
            ],
        ]);
        exit;
    }

    notifications_error(405, 'Method not allowed.');
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Notification request failed: ' . $e->getMessage(),
    ]);
}
