<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/workflow_guard_helpers.php';
require_once __DIR__ . '/branch_helpers.php';
require_once __DIR__ . '/notification_helpers.php';

header('Content-Type: application/json');

function vet_visit_normalize_services($value): array
{
    if (!is_array($value)) {
        return [];
    }
    $allowed = ['vaccination', 'lab-testing', 'parasite-control'];
    return array_values(array_unique(array_filter(array_map(
        static fn($item) => branch_service_key((string)$item),
        $value
    ), static fn($item) => in_array($item, $allowed, true))));
}

function vet_visit_parse_date(string $value): ?DateTimeImmutable
{
    $date = DateTimeImmutable::createFromFormat('!Y-m-d', trim($value));
    $errors = DateTimeImmutable::getLastErrors();
    $hasErrors = is_array($errors) && ($errors['warning_count'] > 0 || $errors['error_count'] > 0);

    return $date && !$hasErrors && $date->format('Y-m-d') === trim($value) ? $date : null;
}

function vet_visit_range_occurrences(
    DateTimeImmutable $startDate,
    DateTimeImmutable $endDate,
    string $dailyStartTime,
    string $dailyEndTime
): array {
    $occurrences = [];
    $skippedSundays = 0;

    for ($date = $startDate; $date <= $endDate; $date = $date->modify('+1 day')) {
        if ((int)$date->format('N') === 7) {
            $skippedSundays++;
            continue;
        }

        $dateValue = $date->format('Y-m-d');
        $occurrences[] = [
            'startsAt' => $dateValue . ' ' . $dailyStartTime,
            'endsAt' => $dateValue . ' ' . $dailyEndTime,
        ];
    }

    return ['occurrences' => $occurrences, 'skippedSundays' => $skippedSundays];
}

try {
    branch_require_schema($pdo);
    $currentUser = ipawcus_guard_current_user($pdo);
    $role = ipawcus_guard_role($currentUser);
    $currentUserId = ipawcus_guard_user_id($currentUser);

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $branchId = isset($_GET['branchId']) && is_numeric($_GET['branchId']) ? (int)$_GET['branchId'] : null;
        $veterinarianId = isset($_GET['veterinarianId']) && is_numeric($_GET['veterinarianId'])
            ? (int)$_GET['veterinarianId']
            : null;
        $from = trim((string)($_GET['from'] ?? date('Y-m-d')));
        $to = trim((string)($_GET['to'] ?? date('Y-m-d', strtotime('+90 days'))));
        $where = ["DATE(schedule.starts_at) BETWEEN ? AND ?", "b.branch_code IN ('MAIN', 'ENRIQUEZ')"];
        $params = [$from, $to];
        if ($branchId) {
            $where[] = 'schedule.branch_id = ?';
            $params[] = $branchId;
        }
        if ($veterinarianId) {
            $where[] = 'schedule.veterinarian_user_id = ?';
            $params[] = $veterinarianId;
        }
        $stmt = $pdo->prepare("
            SELECT schedule.*, b.branch_code, b.branch_name,
                   CONCAT(u.first_Name, ' ', u.last_Name) AS veterinarian_name
            FROM veterinarian_branch_schedules schedule
            JOIN branches b ON b.branch_id = schedule.branch_id
            JOIN users u ON u.user_id = schedule.veterinarian_user_id
            WHERE " . implode(' AND ', $where) . "
            ORDER BY schedule.starts_at, b.branch_name, veterinarian_name
        ");
        $stmt->execute($params);
        $rows = array_map(static function (array $row): array {
            $services = json_decode((string)($row['service_keys'] ?? ''), true);
            return [
                'id' => (int)$row['visit_schedule_id'],
                'branchId' => (int)$row['branch_id'],
                'branchCode' => $row['branch_code'],
                'branchName' => $row['branch_name'],
                'veterinarianUserId' => (int)$row['veterinarian_user_id'],
                'veterinarianName' => trim((string)$row['veterinarian_name']),
                'startsAt' => $row['starts_at'],
                'endsAt' => $row['ends_at'],
                'serviceKeys' => is_array($services) ? $services : [],
                'appointmentCapacity' => $row['appointment_capacity'] !== null ? (int)$row['appointment_capacity'] : null,
                'notes' => $row['notes'],
                'status' => $row['status'],
            ];
        }, $stmt->fetchAll(PDO::FETCH_ASSOC));
        echo json_encode(['schedules' => $rows]);
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'POST' && $_SERVER['REQUEST_METHOD'] !== 'PATCH') {
        http_response_code(405);
        echo json_encode(['message' => 'Method not allowed.']);
        exit;
    }

    http_response_code(409);
    echo json_encode(['message' => 'Visit publishing has been replaced by clinic booking preferences and weekly working hours. Manage your schedule in your veterinarian profile.']);
    exit;

} catch (Throwable $e) {
    http_response_code($e instanceof InvalidArgumentException ? 422 : 500);
    echo json_encode(['message' => $e->getMessage()]);
}
