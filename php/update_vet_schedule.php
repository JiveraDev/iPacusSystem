<?php
require_once __DIR__ . '/db.php';

header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);

$userId = $input['user_id'] ?? null;
$day = $input['day'] ?? null;
$time = $input['time'] ?? null;
$isAvailable = filter_var($input['is_available'] ?? true, FILTER_VALIDATE_BOOLEAN) ? 1 : 0;

if (!$userId || !$day || !$time) {
    http_response_code(400);
    echo json_encode(['message' => 'Missing required schedule information.']);
    exit;
}

try {
    $existingStmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM vet_schedules
        WHERE user_id = ? AND day_of_week = ? AND time_slot = ?
    ");
    $existingStmt->execute([$userId, $day, $time]);

    if ((int)$existingStmt->fetchColumn() > 0) {
        $stmt = $pdo->prepare("
            UPDATE vet_schedules
            SET is_available = ?
            WHERE user_id = ? AND day_of_week = ? AND time_slot = ?
        ");
        $stmt->execute([$isAvailable, $userId, $day, $time]);
    } else {
        $stmt = $pdo->prepare("
            INSERT INTO vet_schedules (user_id, day_of_week, time_slot, is_available)
            VALUES (?, ?, ?, ?)
        ");
        $stmt->execute([$userId, $day, $time, $isAvailable]);
    }

    echo json_encode(['message' => 'Schedule updated successfully.']);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['message' => 'Failed to update schedule: ' . $e->getMessage()]);
}
