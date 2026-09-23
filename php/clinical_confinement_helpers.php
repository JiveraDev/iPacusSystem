<?php

require_once __DIR__ . '/reference_number_helpers.php';

function clinical_confinement_column_exists(PDO $pdo, string $column): bool
{
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'bookings' AND column_name = ?");
    $stmt->execute([$column]);
    return (int)$stmt->fetchColumn() > 0;
}

function clinical_confinement_require_schema(PDO $pdo): void
{
    foreach (['admission_type', 'source_visit_id', 'source_diagnosis_id', 'source_grooming_booking_id', 'billing_charge_id'] as $column) {
        if (!clinical_confinement_column_exists($pdo, $column)) {
            throw new InvalidArgumentException('Clinical confinement is not set up yet. Run DDL/20260923_01_clinical_confinement.sql.');
        }
    }
}

function clinical_confinement_text($value, int $maximum, string $label): string
{
    $text = trim((string)$value);
    if ($text === '') throw new InvalidArgumentException($label . ' is required.');
    if (strlen($text) > $maximum) throw new InvalidArgumentException($label . ' is too long.');
    return $text;
}

function clinical_confinement_date($value): string
{
    $date = trim((string)$value);
    $parsed = DateTimeImmutable::createFromFormat('!Y-m-d', $date, new DateTimeZone('Asia/Manila'));
    $errors = DateTimeImmutable::getLastErrors();
    if (!$parsed || (is_array($errors) && ($errors['warning_count'] || $errors['error_count']))) {
        throw new InvalidArgumentException('Choose a valid expected discharge date.');
    }
    $today = new DateTimeImmutable('today', new DateTimeZone('Asia/Manila'));
    if ($parsed <= $today) throw new InvalidArgumentException('Expected discharge must be after today.');
    return $parsed->format('Y-m-d');
}

function clinical_confinement_service(PDO $pdo, string $facility): array
{
    $stmt = $pdo->query("SELECT service_id, service_code, service_name, base_price FROM service_catalog WHERE service_type = 'boarding' AND is_active = 1 AND base_price > 0 ORDER BY service_id");
    $services = $stmt->fetchAll(PDO::FETCH_ASSOC);
    if ($facility === 'hotel') {
        foreach ($services as $service) {
            $search = strtolower(($service['service_code'] ?? '') . ' ' . ($service['service_name'] ?? ''));
            if (str_contains($search, 'hotel')) return $service;
        }
    } else {
        foreach ($services as $service) {
            $search = strtolower(($service['service_code'] ?? '') . ' ' . ($service['service_name'] ?? ''));
            if (str_contains($search, 'kennel')) return $service;
        }
        foreach ($services as $service) {
            $search = strtolower(($service['service_code'] ?? '') . ' ' . ($service['service_name'] ?? ''));
            if (str_contains($search, 'boarding') && !str_contains($search, 'hotel')) return $service;
        }
    }
    if (!empty($services)) return $services[0];
    throw new InvalidArgumentException('Set an active Boarding price in Service Catalog before recommending confinement.');
}

function clinical_confinement_stay_days(string $checkIn, string $checkOut): int
{
    $start = new DateTimeImmutable($checkIn);
    $end = new DateTimeImmutable($checkOut);
    return max(1, (int)$start->diff($end)->days);
}

/**
 * Creates or updates the one Boarding admission and one Boarding charge linked
 * to a clinical visit. The caller owns the surrounding database transaction.
 */
function clinical_confinement_save(PDO $pdo, array $input): array
{
    clinical_confinement_require_schema($pdo);
    $visitId = (int)($input['visit_id'] ?? 0);
    $petId = (int)($input['pet_id'] ?? 0);
    $vetId = (int)($input['veterinarian_user_id'] ?? 0);
    $branchId = (int)($input['branch_id'] ?? 0);
    $diagnosisId = isset($input['diagnosis_id']) ? (int)$input['diagnosis_id'] : 0;
    $groomingBookingId = isset($input['grooming_booking_id']) ? (int)$input['grooming_booking_id'] : 0;
    if ($visitId <= 0 || $petId <= 0 || $vetId <= 0 || $branchId <= 0) {
        throw new InvalidArgumentException('The visit, pet, veterinarian, and branch are required for confinement.');
    }
    if (($diagnosisId > 0) === ($groomingBookingId > 0)) {
        throw new InvalidArgumentException('Confinement must come from either one diagnosis or one grooming review.');
    }

    $facility = strtolower(trim((string)($input['facility_type'] ?? 'boarding')));
    if (!in_array($facility, ['boarding', 'hotel'], true)) throw new InvalidArgumentException('Choose Kennel or Pet Hotel placement.');
    $roomSize = strtolower(trim((string)($input['room_size'] ?? 'small')));
    if (!in_array($roomSize, ['small', 'medium', 'large'], true)) throw new InvalidArgumentException('Choose a valid room size.');
    $reason = clinical_confinement_text($input['reason'] ?? '', 5000, 'Confinement reason');
    $careInstructions = trim((string)($input['care_instructions'] ?? ''));
    if (strlen($careInstructions) > 5000) throw new InvalidArgumentException('Care instructions are too long.');
    $checkIn = (new DateTimeImmutable('today', new DateTimeZone('Asia/Manila')))->format('Y-m-d');
    $checkOut = clinical_confinement_date($input['expected_discharge'] ?? null);

    $visitStmt = $pdo->prepare('SELECT visit_id, owner_user_id, pet_id, billing_status FROM visits WHERE visit_id = ? FOR UPDATE');
    $visitStmt->execute([$visitId]);
    $visit = $visitStmt->fetch(PDO::FETCH_ASSOC);
    if (!$visit || (int)$visit['pet_id'] !== $petId) throw new InvalidArgumentException('The clinical visit could not be linked to this pet.');
    $ownerId = (int)$visit['owner_user_id'];
    if ($ownerId <= 0) throw new InvalidArgumentException('Link the pet to an owner before recommending confinement.');

    $service = clinical_confinement_service($pdo, $facility);
    $days = clinical_confinement_stay_days($checkIn, $checkOut);
    $unitPrice = round((float)$service['base_price'], 2);
    $total = round($days * $unitPrice, 2);
    $description = 'Clinical confinement - ' . ($facility === 'hotel' ? 'Pet Hotel' : 'Kennel') . ' (' . $days . ' day' . ($days === 1 ? '' : 's') . ')';

    $sourceWhere = $diagnosisId > 0 ? 'source_diagnosis_id = ?' : 'source_grooming_booking_id = ?';
    $sourceId = $diagnosisId > 0 ? $diagnosisId : $groomingBookingId;
    $existingStmt = $pdo->prepare("SELECT * FROM bookings WHERE admission_type = 'confinement' AND {$sourceWhere} LIMIT 1 FOR UPDATE");
    $existingStmt->execute([$sourceId]);
    $booking = $existingStmt->fetch(PDO::FETCH_ASSOC);

    $overlapStmt = $pdo->prepare("
        SELECT booking_number
        FROM bookings overlapping
        WHERE overlapping.service_type = 'boarding'
          AND overlapping.status IN ('pending', 'confirmed')
          AND overlapping.booking_id <> ?
          AND (
              overlapping.pet_id = ?
              OR EXISTS (
                  SELECT 1
                  FROM booking_pets overlapping_pet
                  WHERE overlapping_pet.booking_id = overlapping.booking_id
                    AND overlapping_pet.pet_id = ?
              )
          )
          AND overlapping.check_in_date < ?
          AND overlapping.check_out_date > ?
        ORDER BY overlapping.booking_id
        LIMIT 1
        FOR UPDATE
    ");
    $overlapStmt->execute([(int)($booking['booking_id'] ?? 0), $petId, $petId, $checkOut, $checkIn]);
    $overlappingBookingNumber = trim((string)($overlapStmt->fetchColumn() ?: ''));
    if ($overlappingBookingNumber !== '') {
        throw new InvalidArgumentException("This pet already has an overlapping Boarding admission ({$overlappingBookingNumber}). Review that stay instead of creating another one.");
    }

    if ($booking && in_array((string)$visit['billing_status'], ['paid', 'refunded'], true)) {
        $same = (string)$booking['check_out_date'] === $checkOut
            && (string)$booking['hotel_boarding_type'] === $facility
            && (string)$booking['room_size'] === $roomSize
            && abs((float)$booking['price'] - $total) < 0.009;
        if (!$same) throw new InvalidArgumentException('This confinement invoice is already settled. Record extensions or placement changes in Boarding and POS.');
    }

    $notes = "[Clinical Confinement]\nVet recommendation: {$reason}";
    if ($careInstructions !== '') $notes .= "\nCare instructions: {$careInstructions}";
    if ($booking) {
        $bookingId = (int)$booking['booking_id'];
        if (!in_array($booking['status'], ['pending', 'confirmed'], true)) {
            throw new InvalidArgumentException('The linked confinement stay is already closed.');
        }
        $stmt = $pdo->prepare("UPDATE bookings SET source_visit_id = ?, referred_by_vet_user_id = ?, hotel_boarding_type = ?, room_size = ?, check_out_date = ?, price = ?, notes = ?, confinement_reason = ?, care_instructions = ? WHERE booking_id = ?");
        $stmt->execute([$visitId, $vetId, $facility, $roomSize, $checkOut, $total, $notes, $reason, $careInstructions ?: null, $bookingId]);
        $chargeId = (int)($booking['billing_charge_id'] ?? 0);
    } else {
        $bookingNumber = ipawcus_generate_booking_number($pdo, $checkIn);
        $stmt = $pdo->prepare("INSERT INTO bookings (user_id, pet_id, booking_number, branch_id, original_branch_id, service_type, booking_date, booking_time, status, price, notes, registered_status, check_in_date, check_out_date, room_size, emergency_contact, hotel_boarding_type, consent_status, admission_type, source_visit_id, source_diagnosis_id, source_grooming_booking_id, referred_by_vet_user_id, confinement_reason, care_instructions, owner_approval_status, created_at) VALUES (?, ?, ?, ?, ?, 'boarding', ?, CURTIME(), 'pending', ?, ?, 'Registered', ?, ?, ?, 'Clinical confinement', ?, 'pending', 'confinement', ?, ?, ?, ?, ?, ?, 'pending', NOW())");
        $stmt->execute([$ownerId, $petId, $bookingNumber, $branchId, $branchId, $checkIn, $total, $notes, $checkIn, $checkOut, $roomSize, $facility, $visitId, $diagnosisId ?: null, $groomingBookingId ?: null, $vetId, $reason, $careInstructions ?: null]);
        $bookingId = (int)$pdo->lastInsertId();
        $chargeId = 0;
        $petStmt = $pdo->prepare('INSERT IGNORE INTO booking_pets (booking_id, pet_id) VALUES (?, ?)');
        $petStmt->execute([$bookingId, $petId]);
    }

    if ($chargeId > 0) {
        $chargeExistsStmt = $pdo->prepare('SELECT charge_id FROM visit_charges WHERE charge_id = ? LIMIT 1 FOR UPDATE');
        $chargeExistsStmt->execute([$chargeId]);
        if ((int)($chargeExistsStmt->fetchColumn() ?: 0) > 0) {
            $chargeStmt = $pdo->prepare("UPDATE visit_charges SET visit_id = ?, charge_type = 'boarding', service_id = ?, item_id = NULL, description = ?, quantity = ?, unit_price = ?, subtotal = ?, created_by_user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE charge_id = ?");
            $chargeStmt->execute([$visitId, (int)$service['service_id'], $description, $days, $unitPrice, $total, $vetId, $chargeId]);
        } else {
            $chargeId = 0;
        }
    }
    if ($chargeId <= 0) {
        $chargeStmt = $pdo->prepare("INSERT INTO visit_charges (visit_id, charge_type, service_id, item_id, description, quantity, unit_price, subtotal, created_by_user_id) VALUES (?, 'boarding', ?, NULL, ?, ?, ?, ?, ?)");
        $chargeStmt->execute([$visitId, (int)$service['service_id'], $description, $days, $unitPrice, $total, $vetId]);
        $chargeId = (int)$pdo->lastInsertId();
        $pdo->prepare('UPDATE bookings SET billing_charge_id = ? WHERE booking_id = ?')->execute([$chargeId, $bookingId]);
    }

    visit_billing_update_status($pdo, $visitId);
    return [
        'bookingId' => $bookingId,
        'bookingNumber' => $bookingNumber ?? ($booking['booking_number'] ?? ''),
        'visitId' => $visitId,
        'chargeId' => $chargeId,
        'facilityType' => $facility,
        'roomSize' => $roomSize,
        'checkInDate' => $checkIn,
        'expectedDischarge' => $checkOut,
        'stayDays' => $days,
        'total' => $total,
        'ownerApprovalStatus' => $booking['owner_approval_status'] ?? 'pending',
    ];
}
