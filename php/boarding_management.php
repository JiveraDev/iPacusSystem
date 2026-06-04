<?php
require_once __DIR__ . '/db.php';

header('Content-Type: application/json');

function boarding_table_exists(PDO $pdo, string $tableName): bool
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

function boarding_json_input(): array
{
    return json_decode(file_get_contents('php://input'), true) ?: [];
}

function boarding_error(int $statusCode, string $message): void
{
    global $pdo;

    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    http_response_code($statusCode);
    echo json_encode(['message' => $message]);
    exit;
}

function require_boarding_tables(PDO $pdo, array $tableNames): void
{
    $missingTables = array_values(array_filter($tableNames, fn($tableName) => !boarding_table_exists($pdo, $tableName)));

    if (!empty($missingTables)) {
        boarding_error(
            500,
            'Boarding database schema is missing: ' . implode(', ', $missingTables) . '. Run DDL/boarding_management_migration_20260603.sql first.'
        );
    }
}

function normalize_room_type(?string $facilityType, ?string $roomSize): string
{
    $type = strtolower(trim((string)$facilityType));
    $size = strtolower(trim((string)$roomSize));

    if (!in_array($type, ['hotel', 'boarding'], true)) {
        boarding_error(400, 'Invalid hotel or boarding type.');
    }

    if (!in_array($size, ['small', 'medium', 'large'], true)) {
        boarding_error(400, 'Invalid room or kennel size.');
    }

    return $type . '-' . $size;
}

function split_room_type(string $roomType): array
{
    $parts = explode('-', $roomType, 2);

    return [
        'hotel_boarding_type' => $parts[0] ?? '',
        'room_size' => $parts[1] ?? '',
    ];
}

function room_type_label(string $roomType): string
{
    $parts = split_room_type($roomType);
    $facility = $parts['hotel_boarding_type'] === 'hotel' ? 'Hotel Room' : 'Kennel';

    return ucfirst($parts['room_size']) . ' ' . $facility;
}

function get_room_capacity(PDO $pdo, string $roomType): int
{
    $stmt = $pdo->prepare("SELECT COALESCE(SUM(total_capacity), 0) FROM rooms WHERE room_type = ?");
    $stmt->execute([$roomType]);

    return max(0, (int)$stmt->fetchColumn());
}

function get_maintenance_room_numbers(PDO $pdo, string $roomType): array
{
    $stmt = $pdo->prepare("
        SELECT room_number
        FROM room_unit_statuses
        WHERE room_type = ?
          AND status = 'maintenance'
    ");
    $stmt->execute([$roomType]);

    return array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));
}

function get_unavailable_room_numbers(PDO $pdo, string $roomType, string $checkInDate, string $checkOutDate, int $excludeBookingId = 0): array
{
    $stmt = $pdo->prepare("
        SELECT DISTINCT ba.room_number
        FROM boarding_assignments ba
        JOIN bookings b ON b.booking_id = ba.booking_id
        WHERE ba.room_type = ?
          AND ba.status IN ('reserved', 'occupied')
          AND b.status <> 'cancelled'
          AND ba.booking_id <> ?
          AND COALESCE(DATE(ba.actual_check_in_at), b.check_in_date) < ?
          AND COALESCE(ba.desired_check_out_date, b.check_out_date) > ?
    ");
    $stmt->execute([$roomType, $excludeBookingId, $checkOutDate, $checkInDate]);

    return array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));
}

function get_available_room_numbers(PDO $pdo, string $roomType, string $checkInDate, string $checkOutDate, int $excludeBookingId = 0): array
{
    $capacity = get_room_capacity($pdo, $roomType);
    if ($capacity <= 0) {
        return [];
    }

    $blocked = array_flip(array_merge(
        get_maintenance_room_numbers($pdo, $roomType),
        get_unavailable_room_numbers($pdo, $roomType, $checkInDate, $checkOutDate, $excludeBookingId)
    ));

    $available = [];
    for ($roomNumber = 1; $roomNumber <= $capacity; $roomNumber += 1) {
        if (!isset($blocked[$roomNumber])) {
            $available[] = $roomNumber;
        }
    }

    return $available;
}

function fetch_boarding_booking(PDO $pdo, int $bookingId, bool $forUpdate = false): array
{
    $sql = "
        SELECT *
        FROM bookings
        WHERE booking_id = ?
        LIMIT 1
    ";
    if ($forUpdate) {
        $sql .= " FOR UPDATE";
    }

    $stmt = $pdo->prepare($sql);
    $stmt->execute([$bookingId]);
    $booking = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$booking) {
        boarding_error(404, 'Booking not found.');
    }

    if (($booking['service_type'] ?? '') !== 'boarding') {
        boarding_error(400, 'This action is only available for pet hotel or boarding bookings.');
    }

    if (($booking['status'] ?? '') === 'cancelled') {
        boarding_error(409, 'Cancelled bookings cannot be assigned or checked in.');
    }

    return $booking;
}

function fetch_active_assignment(PDO $pdo, int $bookingId, bool $forUpdate = false): ?array
{
    $sql = "
        SELECT *
        FROM boarding_assignments
        WHERE booking_id = ?
          AND status IN ('reserved', 'occupied')
        ORDER BY assignment_id DESC
        LIMIT 1
    ";
    if ($forUpdate) {
        $sql .= " FOR UPDATE";
    }

    $stmt = $pdo->prepare($sql);
    $stmt->execute([$bookingId]);
    $assignment = $stmt->fetch(PDO::FETCH_ASSOC);

    return $assignment ?: null;
}

function fetch_latest_assignment(PDO $pdo, int $bookingId): ?array
{
    $stmt = $pdo->prepare("
        SELECT *
        FROM boarding_assignments
        WHERE booking_id = ?
        ORDER BY assignment_id DESC
        LIMIT 1
    ");
    $stmt->execute([$bookingId]);
    $assignment = $stmt->fetch(PDO::FETCH_ASSOC);

    return $assignment ?: null;
}

function assignment_response(PDO $pdo, int $bookingId): array
{
    $stmt = $pdo->prepare("
        SELECT
            ba.*,
            b.booking_number,
            b.check_in_date,
            b.check_out_date,
            b.price,
            b.status AS booking_status,
            COALESCE(p.pet_name, b.unregistered_pet_name, 'Pet') AS pet_name,
            COALESCE(p.pet_species, b.petType, 'Pet') AS pet_species,
            CONCAT(u.first_Name, ' ', u.last_Name) AS owner_name
        FROM boarding_assignments ba
        JOIN bookings b ON b.booking_id = ba.booking_id
        LEFT JOIN pets_information p ON p.pet_id = b.pet_id
        JOIN users u ON u.user_id = b.user_id
        WHERE ba.booking_id = ?
        ORDER BY ba.assignment_id DESC
        LIMIT 1
    ");
    $stmt->execute([$bookingId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row) {
        return [];
    }

    $roomParts = split_room_type($row['room_type']);

    return [
        'assignmentId' => (int)$row['assignment_id'],
        'bookingId' => (int)$row['booking_id'],
        'bookingNumber' => $row['booking_number'],
        'roomType' => $row['room_type'],
        'hotelBoardingType' => $roomParts['hotel_boarding_type'],
        'roomSize' => $roomParts['room_size'],
        'roomNumber' => (int)$row['room_number'],
        'roomLabel' => room_type_label($row['room_type']) . ' #' . $row['room_number'],
        'status' => $row['status'],
        'reservedAt' => $row['reserved_at'],
        'actualCheckInAt' => $row['actual_check_in_at'],
        'actualCheckOutAt' => $row['actual_check_out_at'],
        'desiredCheckOutDate' => $row['desired_check_out_date'] ?: $row['check_out_date'],
        'checkInDate' => $row['check_in_date'],
        'checkOutDate' => $row['check_out_date'],
        'price' => $row['price'],
        'petName' => $row['pet_name'],
        'petSpecies' => $row['pet_species'],
        'ownerName' => $row['owner_name'],
        'bookingStatus' => $row['booking_status'],
    ];
}

function upsert_assignment(PDO $pdo, array $booking, string $roomType, int $roomNumber, string $status): void
{
    $bookingId = (int)$booking['booking_id'];
    $assignment = fetch_active_assignment($pdo, $bookingId, true);
    $desiredOut = $booking['check_out_date'] ?? null;

    if ($assignment) {
        if (($assignment['status'] ?? '') === 'occupied' && $status === 'reserved') {
            boarding_error(409, 'This booking is already checked in and cannot be moved back to reserved.');
        }

        $stmt = $pdo->prepare("
            UPDATE boarding_assignments
            SET room_type = ?,
                room_number = ?,
                status = ?,
                reserved_at = COALESCE(reserved_at, NOW()),
                desired_check_out_date = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE assignment_id = ?
        ");
        $stmt->execute([$roomType, $roomNumber, $status, $desiredOut, (int)$assignment['assignment_id']]);
        return;
    }

    $stmt = $pdo->prepare("
        INSERT INTO boarding_assignments (
            booking_id,
            room_type,
            room_number,
            status,
            reserved_at,
            desired_check_out_date
        ) VALUES (?, ?, ?, ?, NOW(), ?)
    ");
    $stmt->execute([$bookingId, $roomType, $roomNumber, $status, $desiredOut]);
}

function assign_room_action(PDO $pdo): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        boarding_error(405, 'Method not allowed.');
    }

    $input = boarding_json_input();
    $bookingId = isset($_GET['bookingId']) ? (int)$_GET['bookingId'] : 0;
    if ($bookingId <= 0) {
        boarding_error(400, 'Booking ID is required.');
    }

    $pdo->beginTransaction();
    try {
        $booking = fetch_boarding_booking($pdo, $bookingId, true);
        $roomType = normalize_room_type($booking['hotel_boarding_type'] ?? null, $booking['room_size'] ?? null);
        $checkIn = (string)($booking['check_in_date'] ?? '');
        $checkOut = (string)($booking['check_out_date'] ?? '');

        if ($checkIn === '' || $checkOut === '' || strtotime($checkOut) <= strtotime($checkIn)) {
            boarding_error(400, 'Booking stay dates are invalid.');
        }

        $availableRooms = get_available_room_numbers($pdo, $roomType, $checkIn, $checkOut, $bookingId);
        $requestedRoom = isset($input['room_number']) && $input['room_number'] !== ''
            ? (int)$input['room_number']
            : null;
        $roomNumber = $requestedRoom ?: ($availableRooms[0] ?? 0);

        if ($roomNumber <= 0 || !in_array($roomNumber, $availableRooms, true)) {
            boarding_error(409, 'Selected room or kennel is not available for this stay.');
        }

        upsert_assignment($pdo, $booking, $roomType, $roomNumber, 'reserved');

        $stmt = $pdo->prepare("UPDATE bookings SET status = 'confirmed' WHERE booking_id = ?");
        $stmt->execute([$bookingId]);

        $pdo->commit();

        echo json_encode([
            'message' => 'Booking approved and room reserved.',
            'assignment' => assignment_response($pdo, $bookingId),
        ]);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        boarding_error(500, 'Failed to assign room: ' . $e->getMessage());
    }
}

function check_in_action(PDO $pdo): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        boarding_error(405, 'Method not allowed.');
    }

    $bookingId = isset($_GET['bookingId']) ? (int)$_GET['bookingId'] : 0;
    if ($bookingId <= 0) {
        boarding_error(400, 'Booking ID is required.');
    }

    $pdo->beginTransaction();
    try {
        $booking = fetch_boarding_booking($pdo, $bookingId, true);
        $roomType = normalize_room_type($booking['hotel_boarding_type'] ?? null, $booking['room_size'] ?? null);
        $checkIn = (string)($booking['check_in_date'] ?? date('Y-m-d'));
        $checkOut = (string)($booking['check_out_date'] ?? '');
        if ($checkOut === '') {
            boarding_error(400, 'Check-out date is required before check-in.');
        }

        $assignment = fetch_active_assignment($pdo, $bookingId, true);
        if (!$assignment) {
            $availableRooms = get_available_room_numbers($pdo, $roomType, $checkIn, $checkOut, $bookingId);
            $roomNumber = $availableRooms[0] ?? 0;
            if ($roomNumber <= 0) {
                boarding_error(409, 'No room or kennel is available for this stay.');
            }
            upsert_assignment($pdo, $booking, $roomType, $roomNumber, 'reserved');
            $assignment = fetch_active_assignment($pdo, $bookingId, true);
        }

        if (!$assignment) {
            boarding_error(500, 'Unable to create room assignment.');
        }

        $maintenanceRooms = get_maintenance_room_numbers($pdo, (string)$assignment['room_type']);
        if (in_array((int)$assignment['room_number'], $maintenanceRooms, true)) {
            boarding_error(409, 'This room or kennel is under maintenance.');
        }

        $stmt = $pdo->prepare("
            UPDATE boarding_assignments
            SET status = 'occupied',
                actual_check_in_at = COALESCE(actual_check_in_at, NOW()),
                desired_check_out_date = COALESCE(desired_check_out_date, ?),
                updated_at = CURRENT_TIMESTAMP
            WHERE assignment_id = ?
        ");
        $stmt->execute([$checkOut, (int)$assignment['assignment_id']]);

        $bookingStmt = $pdo->prepare("UPDATE bookings SET status = 'confirmed' WHERE booking_id = ?");
        $bookingStmt->execute([$bookingId]);

        $pdo->commit();

        echo json_encode([
            'message' => 'Pet checked in successfully.',
            'assignment' => assignment_response($pdo, $bookingId),
        ]);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        boarding_error(500, 'Failed to check in pet: ' . $e->getMessage());
    }
}

function desired_check_out_action(PDO $pdo): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'PATCH') {
        boarding_error(405, 'Method not allowed.');
    }

    $input = boarding_json_input();
    $bookingId = isset($_GET['bookingId']) ? (int)$_GET['bookingId'] : 0;
    $newCheckOut = $input['check_out_date'] ?? $input['desired_check_out_date'] ?? null;

    if ($bookingId <= 0 || !$newCheckOut) {
        boarding_error(400, 'Booking ID and check_out_date are required.');
    }

    $pdo->beginTransaction();
    try {
        $booking = fetch_boarding_booking($pdo, $bookingId, true);
        $assignment = fetch_active_assignment($pdo, $bookingId, true);
        if (!$assignment) {
            boarding_error(404, 'Room assignment not found.');
        }

        $startDate = $assignment['actual_check_in_at']
            ? substr((string)$assignment['actual_check_in_at'], 0, 10)
            : (string)$booking['check_in_date'];

        if (strtotime((string)$newCheckOut) <= strtotime($startDate)) {
            boarding_error(400, 'Desired out date must be after check-in date.');
        }

        $available = get_available_room_numbers(
            $pdo,
            (string)$assignment['room_type'],
            $startDate,
            (string)$newCheckOut,
            $bookingId
        );

        if (!in_array((int)$assignment['room_number'], $available, true)) {
            boarding_error(409, 'This desired out date conflicts with another room reservation.');
        }

        $stmt = $pdo->prepare("
            UPDATE bookings
            SET check_out_date = ?
            WHERE booking_id = ?
        ");
        $stmt->execute([$newCheckOut, $bookingId]);

        $assignmentStmt = $pdo->prepare("
            UPDATE boarding_assignments
            SET desired_check_out_date = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE assignment_id = ?
        ");
        $assignmentStmt->execute([$newCheckOut, (int)$assignment['assignment_id']]);

        $pdo->commit();

        echo json_encode([
            'message' => 'Desired out date updated.',
            'assignment' => assignment_response($pdo, $bookingId),
        ]);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        boarding_error(500, 'Failed to update desired out date: ' . $e->getMessage());
    }
}

function check_out_action(PDO $pdo): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        boarding_error(405, 'Method not allowed.');
    }

    $bookingId = isset($_GET['bookingId']) ? (int)$_GET['bookingId'] : 0;
    if ($bookingId <= 0) {
        boarding_error(400, 'Booking ID is required.');
    }

    $pdo->beginTransaction();
    try {
        fetch_boarding_booking($pdo, $bookingId, true);
        $assignment = fetch_active_assignment($pdo, $bookingId, true);
        if (!$assignment) {
            boarding_error(404, 'Room assignment not found.');
        }

        $stmt = $pdo->prepare("
            UPDATE boarding_assignments
            SET status = 'checked_out',
                actual_check_out_at = NOW(),
                updated_at = CURRENT_TIMESTAMP
            WHERE assignment_id = ?
        ");
        $stmt->execute([(int)$assignment['assignment_id']]);

        $bookingStmt = $pdo->prepare("UPDATE bookings SET status = 'completed' WHERE booking_id = ?");
        $bookingStmt->execute([$bookingId]);

        $pdo->commit();

        echo json_encode(['message' => 'Pet checked out successfully.']);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        boarding_error(500, 'Failed to check out pet: ' . $e->getMessage());
    }
}

function get_active_assignments_by_room(PDO $pdo): array
{
    $multiPetExpression = 'NULL';
    $multiPetJoin = '';
    if (boarding_table_exists($pdo, 'booking_pets')) {
        $multiPetExpression = 'multi.pet_names';
        $multiPetJoin = "
            LEFT JOIN (
                SELECT
                    bp.booking_id,
                    GROUP_CONCAT(p2.pet_name ORDER BY p2.pet_name SEPARATOR ', ') AS pet_names
                FROM booking_pets bp
                JOIN pets_information p2 ON p2.pet_id = bp.pet_id
                GROUP BY bp.booking_id
            ) multi ON multi.booking_id = b.booking_id
        ";
    }

    $stmt = $pdo->query("
        SELECT
            ba.*,
            b.booking_number,
            b.pet_id,
            b.check_in_date,
            b.check_out_date,
            b.price,
            b.status AS booking_status,
            COALESCE({$multiPetExpression}, p.pet_name, b.unregistered_pet_name, 'Pet') AS pet_name,
            COALESCE(p.pet_species, b.petType, 'Pet') AS pet_species,
            COALESCE(p.pet_breed, b.unregistered_pet_breed, '') AS pet_breed,
            CONCAT(u.first_Name, ' ', u.last_Name) AS owner_name
        FROM boarding_assignments ba
        JOIN bookings b ON b.booking_id = ba.booking_id
        LEFT JOIN pets_information p ON p.pet_id = b.pet_id
        JOIN users u ON u.user_id = b.user_id
        {$multiPetJoin}
        WHERE ba.status IN ('reserved', 'occupied')
          AND b.status <> 'cancelled'
        ORDER BY FIELD(ba.status, 'occupied', 'reserved'), ba.assignment_id DESC
    ");

    $assignments = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $assignment) {
        $key = $assignment['room_type'] . '-' . $assignment['room_number'];
        if (!isset($assignments[$key])) {
            $assignments[$key] = $assignment;
        }
    }

    return $assignments;
}

function rooms_action(PDO $pdo): void
{
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $filterType = $_GET['type'] ?? $_GET['hotel_boarding_type'] ?? null;
        $filterSize = $_GET['size'] ?? $_GET['room_size'] ?? null;
        $checkIn = $_GET['check_in_date'] ?? null;
        $checkOut = $_GET['check_out_date'] ?? null;
        $excludeBookingId = isset($_GET['booking_id']) ? (int)$_GET['booking_id'] : 0;

        $roomTypes = ['hotel-small', 'hotel-medium', 'hotel-large', 'boarding-small', 'boarding-medium', 'boarding-large'];
        if ($filterType && $filterSize) {
            $roomTypes = [normalize_room_type($filterType, $filterSize)];
        } elseif ($filterType && in_array($filterType, ['hotel', 'boarding'], true)) {
            $roomTypes = array_values(array_filter($roomTypes, fn($roomType) => str_starts_with($roomType, $filterType . '-')));
        }

        $activeAssignments = get_active_assignments_by_room($pdo);
        $units = [];
        $summaries = [];

        foreach ($roomTypes as $roomType) {
            $capacity = get_room_capacity($pdo, $roomType);
            $maintenanceNumbers = get_maintenance_room_numbers($pdo, $roomType);
            $maintenanceLookup = array_flip($maintenanceNumbers);
            $availableForStay = null;
            if ($checkIn && $checkOut && strtotime($checkOut) > strtotime($checkIn)) {
                $availableForStay = array_flip(get_available_room_numbers($pdo, $roomType, $checkIn, $checkOut, $excludeBookingId));
            }

            $parts = split_room_type($roomType);
            $summary = [
                'roomType' => $roomType,
                'roomLabel' => room_type_label($roomType),
                'hotel_boarding_type' => $parts['hotel_boarding_type'],
                'room_size' => $parts['room_size'],
                'total' => $capacity,
                'available' => 0,
                'reserved' => 0,
                'occupied' => 0,
                'maintenance' => 0,
            ];

            for ($roomNumber = 1; $roomNumber <= $capacity; $roomNumber += 1) {
                $key = $roomType . '-' . $roomNumber;
                $assignment = $activeAssignments[$key] ?? null;
                $status = 'available';

                if (isset($maintenanceLookup[$roomNumber])) {
                    $status = 'maintenance';
                } elseif ($assignment) {
                    $status = $assignment['status'] === 'occupied' ? 'occupied' : 'reserved';
                }

                $summary[$status] += 1;
                $unit = [
                    'id' => $roomType . '-' . $roomNumber,
                    'roomType' => $roomType,
                    'roomLabel' => room_type_label($roomType) . ' #' . $roomNumber,
                    'hotelBoardingType' => $parts['hotel_boarding_type'],
                    'roomSize' => $parts['room_size'],
                    'roomNumber' => $roomNumber,
                    'status' => $status,
                    'availableForStay' => $availableForStay === null ? $status === 'available' : isset($availableForStay[$roomNumber]),
                    'assignment' => null,
                ];

                if ($assignment) {
                    $unit['assignment'] = [
                        'assignmentId' => (int)$assignment['assignment_id'],
                        'bookingId' => (int)$assignment['booking_id'],
                        'bookingNumber' => $assignment['booking_number'],
                        'status' => $assignment['status'],
                        'petId' => $assignment['pet_id'] !== null ? (int)$assignment['pet_id'] : null,
                        'petName' => $assignment['pet_name'],
                        'petSpecies' => $assignment['pet_species'],
                        'petBreed' => $assignment['pet_breed'],
                        'ownerName' => $assignment['owner_name'],
                        'checkInDate' => $assignment['check_in_date'],
                        'checkOutDate' => $assignment['check_out_date'],
                        'desiredCheckOutDate' => $assignment['desired_check_out_date'] ?: $assignment['check_out_date'],
                        'actualCheckInAt' => $assignment['actual_check_in_at'],
                        'actualCheckOutAt' => $assignment['actual_check_out_at'],
                        'price' => $assignment['price'],
                        'bookingStatus' => $assignment['booking_status'],
                    ];
                }

                $units[] = $unit;
            }

            $summaries[] = $summary;
        }

        echo json_encode([
            'rooms' => $summaries,
            'units' => $units,
        ]);
        return;
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = boarding_json_input();
        $roomType = $input['room_type'] ?? normalize_room_type($input['hotel_boarding_type'] ?? $input['type'] ?? null, $input['room_size'] ?? $input['size'] ?? null);
        $quantity = max(1, (int)($input['quantity'] ?? 1));
        $description = trim((string)($input['description'] ?? room_type_label($roomType)));

        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare("SELECT room_id, total_capacity FROM rooms WHERE room_type = ? ORDER BY room_id ASC LIMIT 1 FOR UPDATE");
            $stmt->execute([$roomType]);
            $room = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($room) {
                $update = $pdo->prepare("UPDATE rooms SET total_capacity = total_capacity + ?, description = COALESCE(NULLIF(?, ''), description) WHERE room_id = ?");
                $update->execute([$quantity, $description, (int)$room['room_id']]);
            } else {
                $insert = $pdo->prepare("INSERT INTO rooms (room_type, total_capacity, description) VALUES (?, ?, ?)");
                $insert->execute([$roomType, $quantity, $description]);
            }

            $pdo->commit();

            echo json_encode([
                'message' => $quantity === 1 ? 'Room added.' : 'Rooms added.',
                'roomType' => $roomType,
                'totalCapacity' => get_room_capacity($pdo, $roomType),
            ]);
        } catch (Exception $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            boarding_error(500, 'Failed to add room: ' . $e->getMessage());
        }
        return;
    }

    if ($_SERVER['REQUEST_METHOD'] === 'PATCH') {
        $input = boarding_json_input();
        $roomType = $input['room_type'] ?? normalize_room_type($input['hotel_boarding_type'] ?? $input['type'] ?? null, $input['room_size'] ?? $input['size'] ?? null);
        $roomNumber = (int)($input['room_number'] ?? 0);
        $status = strtolower(trim((string)($input['status'] ?? '')));
        $notes = trim((string)($input['notes'] ?? ''));

        if ($roomNumber <= 0 || !in_array($status, ['available', 'maintenance'], true)) {
            boarding_error(400, 'Room number and a valid status are required.');
        }

        if ($roomNumber > get_room_capacity($pdo, $roomType)) {
            boarding_error(404, 'Room or kennel not found.');
        }

        if ($status === 'maintenance') {
            $activeStmt = $pdo->prepare("
                SELECT b.booking_number
                FROM boarding_assignments ba
                JOIN bookings b ON b.booking_id = ba.booking_id
                WHERE ba.room_type = ?
                  AND ba.room_number = ?
                  AND ba.status IN ('reserved', 'occupied')
                  AND b.status <> 'cancelled'
                LIMIT 1
            ");
            $activeStmt->execute([$roomType, $roomNumber]);
            $activeBooking = $activeStmt->fetchColumn();
            if ($activeBooking) {
                boarding_error(409, "Room has active booking {$activeBooking} and cannot be marked for maintenance.");
            }

            $stmt = $pdo->prepare("
                INSERT INTO room_unit_statuses (room_type, room_number, status, notes)
                VALUES (?, ?, 'maintenance', ?)
                ON DUPLICATE KEY UPDATE status = VALUES(status), notes = VALUES(notes)
            ");
            $stmt->execute([$roomType, $roomNumber, $notes]);
        } else {
            $stmt = $pdo->prepare("DELETE FROM room_unit_statuses WHERE room_type = ? AND room_number = ?");
            $stmt->execute([$roomType, $roomNumber]);
        }

        echo json_encode(['message' => 'Room status updated.']);
        return;
    }

    boarding_error(405, 'Method not allowed.');
}

function resolve_boarding_pet_id(PDO $pdo, $petId): ?int
{
    $value = trim((string)$petId);
    if ($value === '') {
        return null;
    }

    if (is_numeric($value)) {
        $stmt = $pdo->prepare("SELECT pet_id FROM pets_information WHERE pet_id = ? LIMIT 1");
        $stmt->execute([(int)$value]);
        $resolved = $stmt->fetchColumn();
        if ($resolved !== false) {
            return (int)$resolved;
        }
    }

    $stmt = $pdo->prepare("SELECT pet_id FROM pets_information WHERE pet_sharable_ID = ? LIMIT 1");
    $stmt->execute([$value]);
    $resolved = $stmt->fetchColumn();

    return $resolved !== false ? (int)$resolved : null;
}

function direct_check_in_action(PDO $pdo): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        boarding_error(405, 'Method not allowed.');
    }

    $input = boarding_json_input();
    $petId = resolve_boarding_pet_id($pdo, $input['pet_id'] ?? null);
    $roomType = normalize_room_type($input['hotel_boarding_type'] ?? $input['type'] ?? null, $input['room_size'] ?? $input['size'] ?? null);
    $checkOut = $input['check_out_date'] ?? $input['desired_check_out_date'] ?? null;
    $emergencyContact = trim((string)($input['emergency_contact'] ?? 'Walk-in check-in'));
    $notes = trim((string)($input['notes'] ?? ''));
    $price = isset($input['price']) ? (float)$input['price'] : 0;
    $requestedRoom = isset($input['room_number']) && $input['room_number'] !== '' ? (int)$input['room_number'] : null;

    if (!$petId) {
        boarding_error(400, 'Please select a registered pet.');
    }

    $today = (string)$pdo->query("SELECT CURDATE()")->fetchColumn();
    $nowTime = (string)$pdo->query("SELECT CURTIME()")->fetchColumn();
    if (!$checkOut || strtotime((string)$checkOut) <= strtotime($today)) {
        boarding_error(400, 'Desired out date must be after today.');
    }

    $ownerStmt = $pdo->prepare("SELECT user_id FROM pet_ownership WHERE pet_id = ? ORDER BY link_id DESC LIMIT 1");
    $ownerStmt->execute([$petId]);
    $ownerId = (int)($ownerStmt->fetchColumn() ?: 0);
    if ($ownerId <= 0 && isset($input['user_id'])) {
        $ownerId = (int)$input['user_id'];
    }
    if ($ownerId <= 0) {
        boarding_error(409, 'This pet has no linked owner account. Link an owner before direct check-in.');
    }

    $pdo->beginTransaction();
    try {
        $availableRooms = get_available_room_numbers($pdo, $roomType, $today, (string)$checkOut);
        $roomNumber = $requestedRoom ?: ($availableRooms[0] ?? 0);
        if ($roomNumber <= 0 || !in_array($roomNumber, $availableRooms, true)) {
            boarding_error(409, 'Selected room or kennel is not available.');
        }

        $parts = split_room_type($roomType);
        $bookingNumber = 'BK-' . strtoupper(bin2hex(random_bytes(4)));
        $fullNotes = trim("[Walk-in Boarding Check-in]\n" . $notes);
        $stmt = $pdo->prepare("
            INSERT INTO bookings (
                user_id,
                pet_id,
                booking_number,
                service_type,
                booking_date,
                booking_time,
                notes,
                registered_status,
                status,
                price,
                check_in_date,
                check_out_date,
                room_size,
                emergency_contact,
                hotel_boarding_type,
                created_at
            ) VALUES (?, ?, ?, 'boarding', ?, ?, ?, 'Registered', 'confirmed', ?, ?, ?, ?, ?, ?, NOW())
        ");
        $stmt->execute([
            $ownerId,
            $petId,
            $bookingNumber,
            $today,
            $nowTime,
            $fullNotes,
            $price,
            $today,
            $checkOut,
            $parts['room_size'],
            $emergencyContact,
            $parts['hotel_boarding_type'],
        ]);

        $bookingId = (int)$pdo->lastInsertId();

        if (boarding_table_exists($pdo, 'booking_pets')) {
            $petStmt = $pdo->prepare("INSERT IGNORE INTO booking_pets (booking_id, pet_id) VALUES (?, ?)");
            $petStmt->execute([$bookingId, $petId]);
        }

        $assignmentStmt = $pdo->prepare("
            INSERT INTO boarding_assignments (
                booking_id,
                room_type,
                room_number,
                status,
                reserved_at,
                actual_check_in_at,
                desired_check_out_date,
                notes
            ) VALUES (?, ?, ?, 'occupied', NOW(), NOW(), ?, ?)
        ");
        $assignmentStmt->execute([$bookingId, $roomType, $roomNumber, $checkOut, $notes]);

        $pdo->commit();

        echo json_encode([
            'message' => 'Walk-in pet checked in successfully.',
            'bookingId' => $bookingId,
            'bookingNumber' => $bookingNumber,
            'assignment' => assignment_response($pdo, $bookingId),
        ]);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        boarding_error(500, 'Failed to create direct check-in: ' . $e->getMessage());
    }
}

function fetch_assignment_for_monitoring(PDO $pdo, array $input): array
{
    $assignmentId = isset($input['assignment_id']) ? (int)$input['assignment_id'] : 0;
    $bookingId = isset($input['booking_id']) ? (int)$input['booking_id'] : 0;

    if ($assignmentId > 0) {
        $stmt = $pdo->prepare("
            SELECT ba.*, b.pet_id
            FROM boarding_assignments ba
            JOIN bookings b ON b.booking_id = ba.booking_id
            WHERE ba.assignment_id = ?
            LIMIT 1
        ");
        $stmt->execute([$assignmentId]);
    } elseif ($bookingId > 0) {
        $stmt = $pdo->prepare("
            SELECT ba.*, b.pet_id
            FROM boarding_assignments ba
            JOIN bookings b ON b.booking_id = ba.booking_id
            WHERE ba.booking_id = ?
              AND ba.status IN ('reserved', 'occupied')
            ORDER BY ba.assignment_id DESC
            LIMIT 1
        ");
        $stmt->execute([$bookingId]);
    } else {
        boarding_error(400, 'Please select a room or pet assignment.');
    }

    $assignment = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$assignment) {
        boarding_error(404, 'Room assignment not found.');
    }

    return $assignment;
}

function boarding_documents_schema_ready(PDO $pdo): bool
{
    return boarding_table_exists($pdo, 'boarding_documents');
}

function boarding_document_missing_message(): string
{
    return 'Boarding document schema is missing. Run DDL/visit_service_payment_migration_20260604.sql first.';
}

function boarding_document_nullable_text($value): ?string
{
    $text = trim((string)($value ?? ''));
    return $text === '' ? null : $text;
}

function boarding_fetch_document_subject(PDO $pdo, array $input): array
{
    $assignmentId = isset($input['assignment_id']) ? (int)$input['assignment_id'] : 0;
    $bookingId = isset($input['booking_id']) ? (int)$input['booking_id'] : 0;

    if ($assignmentId > 0) {
        $stmt = $pdo->prepare("
            SELECT
                ba.assignment_id,
                ba.booking_id,
                b.pet_id
            FROM boarding_assignments ba
            JOIN bookings b ON b.booking_id = ba.booking_id
            WHERE ba.assignment_id = ?
            LIMIT 1
        ");
        $stmt->execute([$assignmentId]);
        $subject = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($subject) {
            return $subject;
        }
    }

    if ($bookingId > 0) {
        $stmt = $pdo->prepare("
            SELECT
                ba.assignment_id,
                b.booking_id,
                b.pet_id
            FROM bookings b
            LEFT JOIN boarding_assignments ba ON ba.booking_id = b.booking_id
            WHERE b.booking_id = ?
            ORDER BY ba.assignment_id DESC
            LIMIT 1
        ");
        $stmt->execute([$bookingId]);
        $subject = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($subject) {
            return $subject;
        }
    }

    boarding_error(404, 'Boarding booking or assignment was not found.');
}

function boarding_format_document(array $document): array
{
    return [
        'documentId' => (int)$document['document_id'],
        'assignmentId' => $document['assignment_id'] !== null ? (int)$document['assignment_id'] : null,
        'bookingId' => (int)$document['booking_id'],
        'bookingNumber' => $document['booking_number'] ?? '',
        'petId' => $document['pet_id'] !== null ? (int)$document['pet_id'] : null,
        'petName' => $document['pet_name'] ?? 'Pet',
        'ownerName' => trim((string)($document['owner_name'] ?? '')),
        'documentType' => $document['document_type'],
        'title' => $document['title'],
        'documentPath' => $document['document_path'],
        'url' => '/' . ltrim((string)$document['document_path'], '/'),
        'fileName' => $document['file_name'] ?? '',
        'mimeType' => $document['mime_type'] ?? '',
        'notes' => $document['notes'] ?? '',
        'uploadedByUserId' => $document['uploaded_by_user_id'] !== null ? (int)$document['uploaded_by_user_id'] : null,
        'uploadedByName' => $document['uploaded_by_name'] ?? '',
        'createdAt' => $document['created_at'],
    ];
}

function boarding_fetch_documents(PDO $pdo, array $filters = []): array
{
    if (!boarding_documents_schema_ready($pdo)) {
        return [];
    }

    $conditions = [];
    $params = [];
    foreach ([
        ['assignment_id', 'bd.assignment_id'],
        ['booking_id', 'bd.booking_id'],
        ['pet_id', 'bd.pet_id'],
    ] as [$key, $column]) {
        if (isset($filters[$key]) && $filters[$key] !== '' && $filters[$key] !== null) {
            $conditions[] = "{$column} = ?";
            $params[] = (int)$filters[$key];
        }
    }

    $whereSql = $conditions ? 'WHERE ' . implode(' AND ', $conditions) : '';
    $stmt = $pdo->prepare("
        SELECT
            bd.*,
            b.booking_number,
            COALESCE(p.pet_name, b.unregistered_pet_name, 'Pet') AS pet_name,
            CONCAT(u.first_Name, ' ', u.last_Name) AS owner_name
        FROM boarding_documents bd
        JOIN bookings b ON b.booking_id = bd.booking_id
        LEFT JOIN pets_information p ON p.pet_id = bd.pet_id
        JOIN users u ON u.user_id = b.user_id
        {$whereSql}
        ORDER BY bd.created_at DESC, bd.document_id DESC
        LIMIT 200
    ");
    $stmt->execute($params);

    return array_map('boarding_format_document', $stmt->fetchAll(PDO::FETCH_ASSOC));
}

function boarding_documents_action(PDO $pdo): void
{
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        if (!boarding_documents_schema_ready($pdo)) {
            echo json_encode([
                'schemaReady' => false,
                'message' => boarding_document_missing_message(),
                'documents' => []
            ]);
            return;
        }

        echo json_encode([
            'schemaReady' => true,
            'documents' => boarding_fetch_documents($pdo, [
                'assignment_id' => $_GET['assignmentId'] ?? $_GET['assignment_id'] ?? null,
                'booking_id' => $_GET['bookingId'] ?? $_GET['booking_id'] ?? null,
                'pet_id' => $_GET['petId'] ?? $_GET['pet_id'] ?? null,
            ])
        ]);
        return;
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        boarding_error(405, 'Method not allowed.');
    }

    if (!boarding_documents_schema_ready($pdo)) {
        boarding_error(409, boarding_document_missing_message());
    }

    $input = boarding_json_input();
    $documentPath = boarding_document_nullable_text($input['document_path'] ?? $input['documentPath'] ?? null);
    $title = boarding_document_nullable_text($input['title'] ?? null);
    if (!$documentPath || !$title) {
        boarding_error(400, 'Document title and document_path are required.');
    }

    $allowedTypes = ['monitoring_report', 'boarding_history', 'checkout_summary', 'diagnosis_reference', 'other'];
    $documentType = strtolower(trim((string)($input['document_type'] ?? $input['documentType'] ?? 'monitoring_report')));
    if (!in_array($documentType, $allowedTypes, true)) {
        $documentType = 'monitoring_report';
    }

    $subject = boarding_fetch_document_subject($pdo, $input);
    $stmt = $pdo->prepare("
        INSERT INTO boarding_documents (
            assignment_id,
            booking_id,
            pet_id,
            document_type,
            title,
            document_path,
            file_name,
            mime_type,
            notes,
            uploaded_by_user_id,
            uploaded_by_name
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");
    $stmt->execute([
        $subject['assignment_id'] !== null ? (int)$subject['assignment_id'] : null,
        (int)$subject['booking_id'],
        $subject['pet_id'] !== null ? (int)$subject['pet_id'] : null,
        $documentType,
        $title,
        ltrim($documentPath, '/'),
        boarding_document_nullable_text($input['file_name'] ?? $input['fileName'] ?? null),
        boarding_document_nullable_text($input['mime_type'] ?? $input['mimeType'] ?? null),
        boarding_document_nullable_text($input['notes'] ?? null),
        isset($input['uploaded_by_user_id']) ? (int)$input['uploaded_by_user_id'] : (isset($input['uploadedByUserId']) ? (int)$input['uploadedByUserId'] : null),
        boarding_document_nullable_text($input['uploaded_by_name'] ?? $input['uploadedByName'] ?? null),
    ]);

    echo json_encode([
        'message' => 'Boarding document saved.',
        'documentId' => (int)$pdo->lastInsertId()
    ]);
}

function monitoring_action(PDO $pdo): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        boarding_error(405, 'Method not allowed.');
    }

    $tasksStmt = $pdo->query("
        SELECT
            bt.*,
            b.booking_number,
            COALESCE(p.pet_name, b.unregistered_pet_name, 'Pet') AS pet_name,
            COALESCE(p.pet_species, b.petType, 'Pet') AS pet_species,
            CONCAT(u.first_Name, ' ', u.last_Name) AS owner_name
        FROM boarding_tasks bt
        JOIN bookings b ON b.booking_id = bt.booking_id
        LEFT JOIN pets_information p ON p.pet_id = bt.pet_id
        JOIN users u ON u.user_id = b.user_id
        WHERE bt.status <> 'cancelled'
        ORDER BY
            CASE
                WHEN bt.status = 'pending' AND bt.due_at < NOW() THEN 0
                WHEN bt.status = 'pending' THEN 1
                ELSE 2
            END,
            bt.due_at ASC
        LIMIT 200
    ");

    $tasks = array_map(function ($task) {
        $status = $task['status'];
        if ($status === 'pending' && strtotime((string)$task['due_at']) < time()) {
            $status = 'overdue';
        }

        return [
            'taskId' => (int)$task['task_id'],
            'assignmentId' => $task['assignment_id'] !== null ? (int)$task['assignment_id'] : null,
            'bookingId' => (int)$task['booking_id'],
            'bookingNumber' => $task['booking_number'],
            'petId' => $task['pet_id'] !== null ? (int)$task['pet_id'] : null,
            'petName' => $task['pet_name'],
            'petSpecies' => $task['pet_species'],
            'ownerName' => $task['owner_name'],
            'roomType' => $task['room_type'],
            'roomNumber' => (int)$task['room_number'],
            'roomLabel' => room_type_label($task['room_type']) . ' #' . $task['room_number'],
            'taskType' => $task['task_type'],
            'dueAt' => $task['due_at'],
            'status' => $status,
            'assignedTo' => $task['assigned_to'],
            'notes' => $task['notes'],
            'completedAt' => $task['completed_at'],
        ];
    }, $tasksStmt->fetchAll(PDO::FETCH_ASSOC));

    $observationsStmt = $pdo->query("
        SELECT
            bo.*,
            b.booking_number,
            COALESCE(p.pet_name, b.unregistered_pet_name, 'Pet') AS pet_name,
            COALESCE(p.pet_species, b.petType, 'Pet') AS pet_species,
            CONCAT(u.first_Name, ' ', u.last_Name) AS owner_name
        FROM boarding_observations bo
        JOIN bookings b ON b.booking_id = bo.booking_id
        LEFT JOIN pets_information p ON p.pet_id = bo.pet_id
        JOIN users u ON u.user_id = b.user_id
        ORDER BY bo.observed_at DESC
        LIMIT 100
    ");

    $observations = array_map(function ($observation) {
        return [
            'observationId' => (int)$observation['observation_id'],
            'assignmentId' => $observation['assignment_id'] !== null ? (int)$observation['assignment_id'] : null,
            'bookingId' => (int)$observation['booking_id'],
            'bookingNumber' => $observation['booking_number'],
            'petId' => $observation['pet_id'] !== null ? (int)$observation['pet_id'] : null,
            'petName' => $observation['pet_name'],
            'petSpecies' => $observation['pet_species'],
            'ownerName' => $observation['owner_name'],
            'roomType' => $observation['room_type'],
            'roomNumber' => (int)$observation['room_number'],
            'roomLabel' => room_type_label($observation['room_type']) . ' #' . $observation['room_number'],
            'observationType' => $observation['observation_type'],
            'notes' => $observation['notes'],
            'observedAt' => $observation['observed_at'],
        ];
    }, $observationsStmt->fetchAll(PDO::FETCH_ASSOC));

    $documentSchemaReady = boarding_documents_schema_ready($pdo);

    echo json_encode([
        'tasks' => $tasks,
        'observations' => $observations,
        'documentSchemaReady' => $documentSchemaReady,
        'documents' => $documentSchemaReady ? boarding_fetch_documents($pdo) : [],
    ]);
}

function observation_action(PDO $pdo): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        boarding_error(405, 'Method not allowed.');
    }

    $input = boarding_json_input();
    $allowedTypes = ['eating', 'bathing', 'playing', 'behavior', 'other'];
    $type = strtolower(trim((string)($input['observation_type'] ?? '')));
    $notes = trim((string)($input['notes'] ?? ''));

    if (!in_array($type, $allowedTypes, true)) {
        boarding_error(400, 'Invalid observation type.');
    }

    if ($notes === '') {
        boarding_error(400, 'Observation notes are required.');
    }

    $assignment = fetch_assignment_for_monitoring($pdo, $input);
    $petId = isset($input['pet_id']) && $input['pet_id'] !== '' ? (int)$input['pet_id'] : (int)($assignment['pet_id'] ?? 0);

    $stmt = $pdo->prepare("
        INSERT INTO boarding_observations (
            assignment_id,
            booking_id,
            pet_id,
            room_type,
            room_number,
            observation_type,
            notes,
            created_by_user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ");
    $stmt->execute([
        (int)$assignment['assignment_id'],
        (int)$assignment['booking_id'],
        $petId > 0 ? $petId : null,
        $assignment['room_type'],
        (int)$assignment['room_number'],
        $type,
        $notes,
        isset($input['created_by_user_id']) ? (int)$input['created_by_user_id'] : null,
    ]);

    echo json_encode(['message' => 'Observation recorded.']);
}

function task_action(PDO $pdo): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        boarding_error(405, 'Method not allowed.');
    }

    $input = boarding_json_input();
    $allowedTypes = ['feeding', 'bathing', 'playing', 'medication', 'inspection', 'other'];
    $type = strtolower(trim((string)($input['task_type'] ?? '')));
    $dueAt = trim((string)($input['due_at'] ?? ''));
    $assignedTo = trim((string)($input['assigned_to'] ?? ''));
    $notes = trim((string)($input['notes'] ?? ''));

    if (!in_array($type, $allowedTypes, true)) {
        boarding_error(400, 'Invalid task type.');
    }

    if ($dueAt === '' || strtotime($dueAt) === false) {
        boarding_error(400, 'A valid due date and time is required.');
    }

    $assignment = fetch_assignment_for_monitoring($pdo, $input);
    $petId = isset($input['pet_id']) && $input['pet_id'] !== '' ? (int)$input['pet_id'] : (int)($assignment['pet_id'] ?? 0);
    $normalizedDueAt = date('Y-m-d H:i:s', strtotime($dueAt));

    $stmt = $pdo->prepare("
        INSERT INTO boarding_tasks (
            assignment_id,
            booking_id,
            pet_id,
            room_type,
            room_number,
            task_type,
            due_at,
            assigned_to,
            notes,
            created_by_user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");
    $stmt->execute([
        (int)$assignment['assignment_id'],
        (int)$assignment['booking_id'],
        $petId > 0 ? $petId : null,
        $assignment['room_type'],
        (int)$assignment['room_number'],
        $type,
        $normalizedDueAt,
        $assignedTo !== '' ? $assignedTo : null,
        $notes !== '' ? $notes : null,
        isset($input['created_by_user_id']) ? (int)$input['created_by_user_id'] : null,
    ]);

    echo json_encode(['message' => 'Task scheduled.']);
}

function task_complete_action(PDO $pdo): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'PATCH' && $_SERVER['REQUEST_METHOD'] !== 'POST') {
        boarding_error(405, 'Method not allowed.');
    }

    $taskId = isset($_GET['taskId']) ? (int)$_GET['taskId'] : 0;
    if ($taskId <= 0) {
        boarding_error(400, 'Task ID is required.');
    }

    $stmt = $pdo->prepare("
        UPDATE boarding_tasks
        SET status = 'completed',
            completed_at = NOW(),
            updated_at = CURRENT_TIMESTAMP
        WHERE task_id = ?
          AND status = 'pending'
    ");
    $stmt->execute([$taskId]);

    echo json_encode(['message' => 'Task marked complete.']);
}

try {
    require_boarding_tables($pdo, [
        'rooms',
        'room_unit_statuses',
        'boarding_assignments',
        'boarding_observations',
        'boarding_tasks',
    ]);

    $action = $_GET['action'] ?? '';
    switch ($action) {
        case 'rooms':
            rooms_action($pdo);
            break;
        case 'assign-room':
            assign_room_action($pdo);
            break;
        case 'check-in':
            check_in_action($pdo);
            break;
        case 'check-out':
            check_out_action($pdo);
            break;
        case 'desired-check-out':
            desired_check_out_action($pdo);
            break;
        case 'direct-check-in':
            direct_check_in_action($pdo);
            break;
        case 'monitoring':
            monitoring_action($pdo);
            break;
        case 'documents':
            boarding_documents_action($pdo);
            break;
        case 'observation':
            observation_action($pdo);
            break;
        case 'task':
            task_action($pdo);
            break;
        case 'task-complete':
            task_complete_action($pdo);
            break;
        default:
            boarding_error(404, 'Boarding action not found.');
    }
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    boarding_error(500, 'Boarding management failed: ' . $e->getMessage());
}
