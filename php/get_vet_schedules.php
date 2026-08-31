<?php
require_once __DIR__ . '/db.php';

header("Content-Type: application/json");

$userId = $_GET['userId'] ?? null;

if (!$userId) {
    http_response_code(400);
    echo json_encode(['message' => 'Veterinarian ID (userId) is required.']);
    exit;
}

try {
    $stmt = $pdo->prepare("
        SELECT s.*
        FROM vet_schedules s
        INNER JOIN (
            SELECT MAX(schedule_id) AS schedule_id
            FROM vet_schedules
            WHERE user_id = ?
            GROUP BY day_of_week, time_slot
        ) latest ON latest.schedule_id = s.schedule_id
        ORDER BY s.day_of_week, s.schedule_id
    ");
    $stmt->execute([$userId]);
    $schedules = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode($schedules);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['message' => 'Failed to fetch schedules: ' . $e->getMessage()]);
}
