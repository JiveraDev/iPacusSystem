<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/workflow_guard_helpers.php';

header('Content-Type: application/json');
header('Cache-Control: no-store');

try {
    ipawcus_guard_current_user($pdo);

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        // Older clients must not restore branch visits in their calendars.
        // Keep historical rows intact; clinic acceptance now controls bookings.
        echo json_encode(['schedules' => []]);
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'POST' && $_SERVER['REQUEST_METHOD'] !== 'PATCH') {
        http_response_code(405);
        echo json_encode(['message' => 'Method not allowed.']);
        exit;
    }

    http_response_code(409);
    echo json_encode(['message' => 'Visit publishing has been replaced by per-clinic booking preferences. In-clinic appointments follow the clinic operating schedule.']);
    exit;

} catch (Throwable $e) {
    http_response_code($e instanceof InvalidArgumentException ? 422 : 500);
    echo json_encode(['message' => $e->getMessage()]);
}
