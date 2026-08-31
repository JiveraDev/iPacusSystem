<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/branch_helpers.php';

header("Content-Type: application/json");

function tableExists(PDO $pdo, string $tableName): bool
{
    $stmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM information_schema.tables
        WHERE table_schema = DATABASE()
          AND table_name = ?
    ");
    $stmt->execute([$tableName]);
    return (int)$stmt->fetchColumn() > 0;
}

function parseRoomAvailabilityDate(?string $value): ?string
{
    $date = DateTimeImmutable::createFromFormat('!Y-m-d', trim((string)$value));
    $errors = DateTimeImmutable::getLastErrors();
    $hasErrors = is_array($errors) && ($errors['warning_count'] > 0 || $errors['error_count'] > 0);

    return $date && !$hasErrors ? $date->format('Y-m-d') : null;
}

$hotelBoardingType = $_GET['hotel_boarding_type'] ?? $_GET['type'] ?? null;
$hotelBoardingType = $hotelBoardingType !== null ? strtolower(trim((string)$hotelBoardingType)) : null;
$checkInDate = parseRoomAvailabilityDate($_GET['check_in_date'] ?? null);
$checkOutDate = parseRoomAvailabilityDate($_GET['check_out_date'] ?? null);
$branchId = isset($_GET['branch_id']) && is_numeric($_GET['branch_id'])
    ? (int)$_GET['branch_id']
    : branch_main_id($pdo);

$allowedTypes = ['hotel', 'boarding'];
if ($hotelBoardingType !== null && !in_array($hotelBoardingType, $allowedTypes, true)) {
    http_response_code(400);
    echo json_encode(['message' => 'Invalid hotel_boarding_type.']);
    exit;
}

if (!$checkInDate || !$checkOutDate) {
    http_response_code(422);
    echo json_encode(['message' => 'check_in_date and check_out_date must use YYYY-MM-DD format.']);
    exit;
}

if (strtotime($checkOutDate) <= strtotime($checkInDate)) {
    http_response_code(400);
    echo json_encode(['message' => 'check_out_date must be after check_in_date.']);
    exit;
}

try {
    if (!tableExists($pdo, 'rooms')) {
        http_response_code(500);
        echo json_encode(['message' => 'Room capacity table is missing. Run the room setup SQL from phpTestfiles/rooms_setup.sql first.']);
        exit;
    }

    $roomWhere = 'WHERE room.branch_id = ?';
    $roomParams = [$branchId];
    if ($hotelBoardingType !== null) {
        $roomTypes = array_map(
            static fn($size) => "{$hotelBoardingType}-{$size}",
            ['small', 'medium', 'large']
        );
        $roomWhere .= ' AND room.room_type IN (' . implode(',', array_fill(0, count($roomTypes), '?')) . ')';
        array_push($roomParams, ...$roomTypes);
    }

    $roomSql = "
        SELECT room.room_type,
               GREATEST(0, room.total_capacity - (
                   SELECT COUNT(*) FROM room_unit_statuses status
                   WHERE status.branch_id = room.branch_id
                     AND status.room_type = room.room_type
                     AND status.status = 'retired'
               )) AS total_capacity,
               room.description
        FROM rooms room
        {$roomWhere}
        ORDER BY FIELD(room_type, 'hotel-small', 'hotel-medium', 'hotel-large', 'boarding-small', 'boarding-medium', 'boarding-large')
    ";
    $roomStmt = $pdo->prepare($roomSql);
    $roomStmt->execute($roomParams);
    $rooms = $roomStmt->fetchAll(PDO::FETCH_ASSOC);

    $bookingSql = "
        SELECT hotel_boarding_type, room_size, COUNT(*) AS booked_count
        FROM bookings
        WHERE service_type = 'boarding'
          AND branch_id = ?
          AND hotel_boarding_type IS NOT NULL
          AND room_size IS NOT NULL
          AND check_in_date < ?
          AND check_out_date > ?
          AND status IN ('pending', 'confirmed')
          AND (? IS NULL OR hotel_boarding_type = ?)
        GROUP BY hotel_boarding_type, room_size
    ";
    $bookingStmt = $pdo->prepare($bookingSql);
    $bookingStmt->execute([$branchId, $checkOutDate, $checkInDate, $hotelBoardingType, $hotelBoardingType]);

    $bookedByType = [];
    foreach ($bookingStmt->fetchAll(PDO::FETCH_ASSOC) as $bookingCount) {
        $key = $bookingCount['hotel_boarding_type'] . '-' . $bookingCount['room_size'];
        $bookedByType[$key] = (int)$bookingCount['booked_count'];
    }

    $availability = array_map(function ($room) use ($bookedByType) {
        $parts = explode('-', $room['room_type'], 2);
        $type = $parts[0] ?? '';
        $size = $parts[1] ?? '';
        $total = (int)$room['total_capacity'];
        $booked = $bookedByType[$room['room_type']] ?? 0;
        $available = max(0, $total - $booked);

        return [
            'room_type' => $room['room_type'],
            'hotel_boarding_type' => $type,
            'room_size' => $size,
            'total_capacity' => $total,
            'booked_count' => $booked,
            'available_count' => $available,
            'available' => $available > 0,
            'description' => $room['description'],
        ];
    }, $rooms);

    echo json_encode([
        'check_in_date' => $checkInDate,
        'check_out_date' => $checkOutDate,
        'branch_id' => $branchId,
        'rooms' => $availability,
    ]);
} catch (Exception $e) {
    error_log('Room availability failed: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['message' => 'Failed to fetch room availability. Please try again or contact support if it continues.']);
}
