<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/booking_maintenance.php';
require_once __DIR__ . '/booking_queue_helpers.php';
require_once __DIR__ . '/workflow_guard_helpers.php';

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

function normalizePriceLabel(?string $value): ?string
{
    if ($value === null) {
        return null;
    }

    $label = trim($value);
    if ($label === '') {
        return null;
    }

    $pesoSign = html_entity_decode('&#8369;', ENT_QUOTES, 'UTF-8');
    $label = str_replace([$pesoSign, '$'], 'PHP ', $label);
    $label = preg_replace('/\bphp\b/i', 'PHP', $label) ?? $label;
    $label = preg_replace('/\s*-\s*/', ' - ', $label) ?? $label;
    $label = preg_replace('/\s+/', ' ', $label) ?? $label;
    $label = trim($label);

    return $label !== '' ? $label : null;
}

function decodeJsonArray($value): array
{
    if ($value === null || $value === '') {
        return [];
    }

    $decoded = json_decode((string)$value, true);

    return json_last_error() === JSON_ERROR_NONE && is_array($decoded) ? $decoded : [];
}

try {
    autoCancelOverdueBookings($pdo);

    $currentApiUser = ipawcus_guard_current_user($pdo);
    $currentApiRole = ipawcus_guard_role($currentApiUser);
    $currentApiUserId = ipawcus_guard_user_id($currentApiUser);
    $userId = $_GET['userId'] ?? null;
    $bookingId = $_GET['bookingId'] ?? null;
    $params = [];
    $hasBookingPets = tableExists($pdo, 'booking_pets');
    $hasBoardingAssignments = tableExists($pdo, 'boarding_assignments');
    $multiPetSelect = $hasBookingPets
        ? "multi.pet_ids AS booked_pet_ids, multi.pet_names AS booked_pet_names,"
        : "NULL AS booked_pet_ids, NULL AS booked_pet_names,";
    $multiPetJoin = $hasBookingPets
        ? "LEFT JOIN (
                SELECT
                    bp.booking_id,
                    GROUP_CONCAT(bp.pet_id ORDER BY bp.pet_id SEPARATOR ',') AS pet_ids,
                    GROUP_CONCAT(p2.pet_name ORDER BY p2.pet_name SEPARATOR ', ') AS pet_names
                FROM booking_pets bp
                JOIN pets_information p2 ON p2.pet_id = bp.pet_id
                GROUP BY bp.booking_id
           ) multi ON multi.booking_id = b.booking_id"
        : "";
    $boardingAssignmentSelect = $hasBoardingAssignments
        ? "board.assignment_id AS boarding_assignment_id,
           board.room_type AS boarding_room_type,
           board.room_number AS boarding_room_number,
           board.status AS boarding_assignment_status,
           board.reserved_at AS boarding_reserved_at,
           board.actual_check_in_at AS boarding_actual_check_in_at,
           board.actual_check_out_at AS boarding_actual_check_out_at,
           board.desired_check_out_date AS boarding_desired_check_out_date,"
        : "NULL AS boarding_assignment_id,
           NULL AS boarding_room_type,
           NULL AS boarding_room_number,
           NULL AS boarding_assignment_status,
           NULL AS boarding_reserved_at,
           NULL AS boarding_actual_check_in_at,
           NULL AS boarding_actual_check_out_at,
           NULL AS boarding_desired_check_out_date,";
    $boardingAssignmentJoin = $hasBoardingAssignments
        ? "LEFT JOIN (
                SELECT ba.*
                FROM boarding_assignments ba
                JOIN (
                    SELECT booking_id, MAX(assignment_id) AS assignment_id
                    FROM boarding_assignments
                    GROUP BY booking_id
                ) latest ON latest.assignment_id = ba.assignment_id
           ) board ON board.booking_id = b.booking_id"
        : "";

    // Fetch bookings joined with users and pets for full context
    $sql = "SELECT b.*, 
                   p.pet_name,
                   p.pet_species,
                   p.pet_breed,
                   p.pet_sharable_ID,
                   p.pet_BDAY,
                   p.pet_gender,
                   p.pet_status,
                   p.pet_age,
                   p.pet_weight,
                   p.pet_microchip,
                   p.pet_Temp_owner,
                   p.pet_allergies,
                   p.pet_color_marking,
                   p.setpetImage_url, 
                   u.first_Name,
                   u.last_Name,
                   u.mail_Address,
                   u.personal_Address,
                   u.phoneNumber,
                   u.emergencyNumber,
                   u.birthdate,
                   u.setProfilePic_url,
                   v.first_Name as vet_first_name, v.last_Name as vet_last_name,
                   {$multiPetSelect}
                   {$boardingAssignmentSelect}
                   1 as select_marker
            FROM bookings b
            LEFT JOIN pets_information p ON b.pet_id = p.pet_id
            JOIN users u ON b.user_id = u.user_id
            LEFT JOIN users v ON b.veterinarian_id = v.user_id
            {$multiPetJoin}
            {$boardingAssignmentJoin}";

    $where = [];
    if ($bookingId) {
        $where[] = "b.booking_id = ?";
        $params[] = $bookingId;
    }

    if ($currentApiRole === 'pet_owner') {
        if ($userId && (int)$userId !== $currentApiUserId) {
            http_response_code(403);
            echo json_encode(['message' => 'You can only view booking records under your own account.']);
            exit;
        }

        $ownerScopeSql = "
            (
                b.user_id = ?
                OR EXISTS (
                    SELECT 1
                    FROM pet_ownership po
                    WHERE po.pet_id = b.pet_id
                      AND po.user_id = ?
                )
        ";
        $params[] = $currentApiUserId;
        $params[] = $currentApiUserId;

        if ($hasBookingPets) {
            $ownerScopeSql .= "
                OR EXISTS (
                    SELECT 1
                    FROM booking_pets bp_scope
                    JOIN pet_ownership po_scope ON po_scope.pet_id = bp_scope.pet_id
                    WHERE bp_scope.booking_id = b.booking_id
                      AND po_scope.user_id = ?
                )
            ";
            $params[] = $currentApiUserId;
        }

        $ownerScopeSql .= ")";
        $where[] = $ownerScopeSql;
    } elseif ($userId) {
        $where[] = "b.user_id = ?";
        $params[] = $userId;
    }

    if (!empty($where)) {
        $sql .= " WHERE " . implode(' AND ', $where);
    }

    $sql .= " ORDER BY b.created_at DESC";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $bookings = $stmt->fetchAll();

    $specialServiceItemsByBooking = [];
    if (!empty($bookings) && tableExists($pdo, 'special_service_booking_items')) {
        $bookingIds = array_values(array_unique(array_map(function ($booking) {
            return (int)$booking['booking_id'];
        }, $bookings)));

        if (!empty($bookingIds)) {
            $placeholders = implode(',', array_fill(0, count($bookingIds), '?'));
            $itemsStmt = $pdo->prepare("
                SELECT
                    sbi.booking_id,
                    sbi.sequence_no,
                    sbi.special_service_id,
                    sbi.custom_service_title,
                    sbi.custom_service_description,
                    sbi.custom_service_details,
                    sc.service_code,
                    sc.service_title,
                    sc.service_description,
                    sc.service_details,
                    sc.price_label,
                    sc.duration_label,
                    sc.max_pets
                FROM special_service_booking_items sbi
                LEFT JOIN special_service_catalog sc ON sc.special_service_id = sbi.special_service_id
                WHERE sbi.booking_id IN ({$placeholders})
                ORDER BY sbi.booking_id ASC, sbi.sequence_no ASC, sbi.booking_special_service_id ASC
            ");
            $itemsStmt->execute($bookingIds);
            foreach ($itemsStmt->fetchAll(PDO::FETCH_ASSOC) as $item) {
                $bookingId = (int)$item['booking_id'];
                if (!isset($specialServiceItemsByBooking[$bookingId])) {
                    $specialServiceItemsByBooking[$bookingId] = [];
                }

                $specialServiceItemsByBooking[$bookingId][] = [
                    'id' => $item['special_service_id'] !== null ? (int)$item['special_service_id'] : null,
                    'serviceCode' => $item['service_code'] ?? null,
                    'serviceTitle' => $item['service_title'] ?? $item['custom_service_title'] ?? 'Special Service',
                    'serviceDescription' => $item['service_description'] ?? $item['custom_service_description'] ?? null,
                    'serviceDetails' => $item['service_details'] ?? $item['custom_service_details'] ?? null,
                    'priceLabel' => normalizePriceLabel($item['price_label'] ?? null),
                    'durationLabel' => $item['duration_label'] ?? null,
                    'maxPets' => $item['max_pets'] !== null ? (int)$item['max_pets'] : null,
                    'sequenceNo' => (int)$item['sequence_no'],
                ];
            }
        }
    }

    $formattedBookings = array_map(function($b) use ($specialServiceItemsByBooking) {
        $isRegistered = $b['registered_status'] === 'Registered' || (!empty($b['pet_id']) && !empty($b['pet_name']));
        $isHomeService = (bool)$b['is_home_service'];
        $isOnlineConsultation = (bool)$b['is_online_consultation'];
        $hasCancellationRequest = !empty($b['notes']) && preg_match('/\[Cancellation Request\]/i', $b['notes']) === 1;
        $specialServiceItems = [];
        if (!empty($specialServiceItemsByBooking[(int)$b['booking_id']])) {
            $specialServiceItems = $specialServiceItemsByBooking[(int)$b['booking_id']];
        }
        $addOns = null;
        if (!empty($b['add_ons'])) {
            $decodedAddOns = json_decode($b['add_ons'], true);
            $addOns = json_last_error() === JSON_ERROR_NONE ? $decodedAddOns : $b['add_ons'];
        }
        $boardingAssignment = null;
        if (!empty($b['boarding_assignment_id'])) {
            $roomType = (string)($b['boarding_room_type'] ?? '');
            $roomParts = explode('-', $roomType, 2);
            $assignmentFacility = $roomParts[0] ?? ($b['hotel_boarding_type'] ?? null);
            $assignmentSize = $roomParts[1] ?? ($b['room_size'] ?? null);
            $roomNumber = (int)$b['boarding_room_number'];
            $roomLabel = trim(ucfirst((string)$assignmentSize) . ' ' . ($assignmentFacility === 'hotel' ? 'Room' : 'Kennel') . ' #' . $roomNumber);

            $boardingAssignment = [
                'assignmentId' => (int)$b['boarding_assignment_id'],
                'roomType' => $roomType,
                'hotelBoardingType' => $assignmentFacility,
                'roomSize' => $assignmentSize,
                'roomNumber' => $roomNumber,
                'roomLabel' => $roomLabel,
                'status' => $b['boarding_assignment_status'],
                'reservedAt' => $b['boarding_reserved_at'],
                'actualCheckInAt' => $b['boarding_actual_check_in_at'],
                'actualCheckOutAt' => $b['boarding_actual_check_out_at'],
                'desiredCheckOutDate' => $b['boarding_desired_check_out_date'] ?: ($b['check_out_date'] ?? null),
            ];
        }
        
        // Extract services/topics from notes
        $serviceName = $b['service_type'];
        if ($b['service_type'] === 'boarding' && !empty($b['hotel_boarding_type'])) {
            $serviceName = $b['hotel_boarding_type'] === 'hotel' ? 'Pet Hotel Boarding' : 'Kennel Boarding';
            if (!empty($b['room_size'])) {
                $roomLabel = ucfirst($b['room_size']);
                $serviceName .= ' - ' . $roomLabel . ($b['hotel_boarding_type'] === 'hotel' ? ' Room' : ' Kennel');
            }
        } elseif ($b['service_type'] === 'special services' && !empty($specialServiceItems)) {
            $serviceName = implode(' + ', array_map(function ($item) {
                return $item['serviceTitle'] ?? 'Special Service';
            }, $specialServiceItems));
        } elseif ($b['notes']) {
            if ($isHomeService && preg_match('/\[Services: (.*?)\]/', $b['notes'], $matches)) {
                $serviceName = $matches[1];
            } elseif ($isOnlineConsultation && preg_match('/\[Topic: (.*?)\]/', $b['notes'], $matches)) {
                $serviceName = $matches[1];
            }
        }

        return [
            'id' => $b['booking_id'],
            'userId' => $b['user_id'],
            'bookingNumber' => $b['booking_number'],
            'petId' => $b['pet_id'],
            'petShareableId' => $b['pet_sharable_ID'],
            'petIds' => $b['booked_pet_ids'] ? array_map('intval', explode(',', $b['booked_pet_ids'])) : ($b['pet_id'] ? [(int)$b['pet_id']] : []),
            'petName' => $b['booked_pet_names'] ?: ($isRegistered ? $b['pet_name'] : $b['unregistered_pet_name']),
            'petSpecies' => $isRegistered ? $b['pet_species'] : $b['petType'],
            'petBreed' => $isRegistered ? $b['pet_breed'] : $b['unregistered_pet_breed'],
            'petProfileImage' => $b['setpetImage_url'],
            'petBirthDate' => $isRegistered ? $b['pet_BDAY'] : null,
            'petGender' => $isRegistered ? $b['pet_gender'] : null,
            'petStatus' => $isRegistered ? $b['pet_status'] : null,
            'petAge' => $isRegistered ? $b['pet_age'] : $b['unregistered_pet_age'],
            'petWeight' => $isRegistered ? $b['pet_weight'] : $b['unregistered_pet_weight'],
            'petMicrochipId' => $isRegistered ? $b['pet_microchip'] : null,
            'petColor' => $isRegistered ? $b['pet_color_marking'] : null,
            'petAllergies' => $isRegistered ? $b['pet_allergies'] : null,
            'petTempOwner' => $isRegistered ? $b['pet_Temp_owner'] : null,
            'ownerName' => $b['first_Name'] . ' ' . $b['last_Name'],
            'ownerEmail' => $b['mail_Address'],
            'ownerPhone' => $b['phoneNumber'],
            'ownerEmergencyNumber' => $b['emergencyNumber'],
            'ownerAddress' => $b['personal_Address'],
            'ownerBirthdate' => $b['birthdate'],
            'ownerProfileImage' => $b['setProfilePic_url'],
            'type' => $b['service_type'],
            'service' => $serviceName,
            'date' => $b['booking_date'],
            'time' => $b['booking_time'],
            'status' => $b['status'],
            'price' => $b['price'],
            'notes' => bookingCleanVisibleNotes($b['notes'] ?? ''),
            'hasCancellationRequest' => $hasCancellationRequest,
            'isHomeService' => $isHomeService,
            'address' => $b['address'],
            'paymentProof' => $b['payment_proof_url'],
            'paymentMethod' => $b['payment_method'] ?? null,
            'paymentReference' => $b['payment_reference'] ?? null,
            'isOnlineConsultation' => $isOnlineConsultation,
            'veterinarianId' => $b['veterinarian_id'],
            'veterinarian' => $b['vet_first_name'] ? "Dr. {$b['vet_first_name']} {$b['vet_last_name']}" : "Unassigned",
            'hotelBoardingType' => $b['hotel_boarding_type'] ?? null,
            'checkInDate' => $b['check_in_date'] ?? null,
            'checkOutDate' => $b['check_out_date'] ?? null,
            'roomSize' => $b['room_size'] ?? null,
            'boardingAssignment' => $boardingAssignment,
            'addOns' => $addOns,
            'specialServiceItems' => $specialServiceItems,
            'emergencyContact' => $b['emergency_contact'] ?? null,
            'image_Booking_Concern_Path' => $b['Image_Booking_Concern_Path'],
            'signaturePath' => $b['signature_path'],
            'consentForms' => decodeJsonArray($b['consent_forms'] ?? null),
            'consentStatus' => $b['consent_status'] ?? null,
            'isRegistered' => $isRegistered,
            'createdAt' => $b['created_at']
        ];
    }, $bookings);

    echo json_encode($formattedBookings);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['message' => 'Failed to fetch bookings: ' . $e->getMessage()]);
}
