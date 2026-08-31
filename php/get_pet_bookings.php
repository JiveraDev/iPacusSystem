<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/booking_maintenance.php';
require_once __DIR__ . '/booking_queue_helpers.php';
require_once __DIR__ . '/workflow_guard_helpers.php';
require_once __DIR__ . '/pet_allergy_helpers.php';
require_once __DIR__ . '/consent_record_helpers.php';

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

function normalizeServiceName(array $booking, array $specialServiceItems = []): string
{
    $serviceName = $booking['service_type'] ?? '';
    if (($booking['service_type'] ?? '') === 'boarding' && !empty($booking['hotel_boarding_type'])) {
        $serviceName = $booking['hotel_boarding_type'] === 'hotel' ? 'Pet Hotel Boarding' : 'Kennel Boarding';
        if (!empty($booking['room_size'])) {
            $serviceName .= ' - ' . ucfirst($booking['room_size']);
        }
    } elseif (($booking['service_type'] ?? '') === 'special services' && !empty($specialServiceItems)) {
        $serviceName = implode(' + ', array_map(function ($item) {
            return $item['serviceTitle'] ?? 'Special Service';
        }, $specialServiceItems));
    } elseif (!empty($booking['notes'])) {
        if ((bool)($booking['is_home_service'] ?? false) && preg_match('/\[Services: (.*?)\]/', $booking['notes'], $matches)) {
            $serviceName = $matches[1];
        } elseif ((bool)($booking['is_online_consultation'] ?? false) && preg_match('/\[Topic: (.*?)\]/', $booking['notes'], $matches)) {
            $serviceName = $matches[1];
        }
    }

    return $serviceName;
}

function resolveNumericPetId(PDO $pdo, string $petId): ?int
{
    if (strpos($petId, 'PET-') === 0) {
        $stmt = $pdo->prepare("SELECT pet_id FROM pets_information WHERE pet_sharable_ID = ? LIMIT 1");
        $stmt->execute([$petId]);
        $resolvedPetId = $stmt->fetchColumn();

        return $resolvedPetId ? (int)$resolvedPetId : null;
    }

    return (int)$petId > 0 ? (int)$petId : null;
}

$petId = $_GET['petId'] ?? null;

if (!$petId) {
    http_response_code(400);
    echo json_encode(['message' => 'Pet ID is required.']);
    exit;
}

try {
    $currentApiUser = ipawcus_guard_current_user($pdo);
    $currentApiRole = ipawcus_guard_role($currentApiUser);
    $currentApiUserId = ipawcus_guard_user_id($currentApiUser);
    $numericPetId = resolveNumericPetId($pdo, (string)$petId);
    if ($currentApiRole === 'pet_owner' && ($numericPetId === null || !ipawcus_guard_pet_access($pdo, $numericPetId, $currentApiUserId))) {
        http_response_code(403);
        echo json_encode(['message' => 'You are not allowed to view bookings for this pet.']);
        exit;
    }

    if ($numericPetId !== null && $numericPetId > 0) {
        autoCancelOverdueBookingsDetailed($pdo, $numericPetId, true);
    }

    $hasBookingPets = tableExists($pdo, 'booking_pets');
    $whereColumn = strpos((string)$petId, 'PET-') === 0 ? 'p.pet_sharable_ID' : 'b.pet_id';
    $bookingPetJoin = $hasBookingPets
        ? "LEFT JOIN booking_pets bp ON bp.booking_id = b.booking_id"
        : "";
    $secondaryPetCondition = $hasBookingPets && strpos((string)$petId, 'PET-') !== 0 ? " OR bp.pet_id = ?" : "";
    $params = [$petId];
    if ($secondaryPetCondition) {
        $params[] = $petId;
    }

    $stmt = $pdo->prepare("
        SELECT DISTINCT
            b.booking_id,
            b.booking_number,
            b.user_id,
            b.pet_id,
            b.service_type,
            b.booking_date,
            b.booking_time,
            b.status,
            b.price,
            b.transport_fee,
            b.notes,
            b.is_home_service,
            b.is_online_consultation,
            b.address,
            b.payment_proof_url,
            b.signature_path,
            b.consent_forms,
            b.consent_status,
            b.Image_Booking_Concern_Path,
            b.registered_status,
            b.petType,
            b.unregistered_pet_name,
            b.unregistered_pet_breed,
            b.unregistered_pet_age,
            b.unregistered_pet_weight,
            b.hotel_boarding_type,
            b.check_in_date,
            b.check_out_date,
            b.room_size,
            b.add_ons,
            b.emergency_contact,
            b.veterinarian_id,
            b.created_at,
            p.pet_name,
            p.pet_species,
            p.pet_breed,
            p.pet_BDAY,
            p.pet_status,
            p.pet_gender,
            p.pet_weight,
            p.pet_microchip,
            p.pet_Temp_owner,
            p.pet_allergies,
            p.pet_color_marking,
            p.pet_sharable_ID,
            p.setpetImage_url,
            u.first_Name,
            u.last_Name,
            u.mail_Address,
            u.personal_Address,
            u.phoneNumber,
            u.emergencyNumber,
            u.birthdate,
            u.setProfilePic_url,
            v.first_Name AS vet_first_name,
            v.last_Name AS vet_last_name
        FROM bookings b
        LEFT JOIN pets_information p ON b.pet_id = p.pet_id
        JOIN users u ON b.user_id = u.user_id
        LEFT JOIN users v ON b.veterinarian_id = v.user_id
        {$bookingPetJoin}
        WHERE {$whereColumn} = ?{$secondaryPetCondition}
        ORDER BY b.booking_date DESC, b.booking_time DESC, b.created_at DESC
    ");
    $stmt->execute($params);
    $bookings = $stmt->fetchAll(PDO::FETCH_ASSOC);

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

    $formattedBookings = array_map(function($booking) use ($specialServiceItemsByBooking, $pdo) {
        $addOns = null;
        if (!empty($booking['add_ons'])) {
            $decodedAddOns = json_decode($booking['add_ons'], true);
            $addOns = json_last_error() === JSON_ERROR_NONE ? $decodedAddOns : $booking['add_ons'];
        }
        $specialServiceItems = $specialServiceItemsByBooking[(int)$booking['booking_id']] ?? [];
        $serviceName = normalizeServiceName($booking, $specialServiceItems);

        $isRegistered = $booking['registered_status'] === 'Registered' || (!empty($booking['pet_id']) && !empty($booking['pet_name']));
        $isHomeService = (bool)$booking['is_home_service']
            || strtolower(trim((string)($booking['service_type'] ?? ''))) === 'home-service';
        $isOnlineConsultation = (bool)$booking['is_online_consultation'];
        $onlineConsultationDetails = $isOnlineConsultation
            ? bookingOnlineConsultationNoteDetails($booking['notes'] ?? '')
            : null;
        $transportFee = (float)($booking['transport_fee'] ?? 0);
        $bookingPrice = (float)($booking['price'] ?? 0);
        if ($isHomeService && $bookingPrice <= max(50.0, $transportFee)) {
            $bookingPrice = 1400.0;
        }
        $consentForms = consent_record_forms_for_response($booking['consent_forms'] ?? null);
        $signedConsentDocumentPath = consent_record_first_signed_document_path($consentForms);
        $physicalConsentPath = consent_record_first_physical_document_path($consentForms);
        $legacyConsentSignaturePath = consent_record_first_legacy_signature_path($consentForms);
        $storedBookingSignaturePath = consent_record_nullable_text($booking['signature_path'] ?? null);
        if (
            $legacyConsentSignaturePath === null
            && $storedBookingSignaturePath !== null
            && $storedBookingSignaturePath !== $signedConsentDocumentPath
        ) {
            $legacyConsentSignaturePath = $storedBookingSignaturePath;
        }

        return [
            'id' => $booking['booking_id'],
            'userId' => $booking['user_id'],
            'bookingNumber' => $booking['booking_number'],
            'petId' => $booking['pet_id'],
            'petShareableId' => $booking['pet_sharable_ID'],
            'petName' => $booking['pet_name'] ?: $booking['unregistered_pet_name'],
            'petSpecies' => $isRegistered ? $booking['pet_species'] : $booking['petType'],
            'petBreed' => $isRegistered ? $booking['pet_breed'] : $booking['unregistered_pet_breed'],
            'petBirthDate' => $booking['pet_BDAY'] ?? null,
            'petGender' => $booking['pet_gender'] ?? null,
            'petStatus' => $booking['pet_status'] ?? null,
            'petAge' => $booking['pet_age'] ?? $booking['unregistered_pet_age'],
            'petWeight' => $booking['pet_weight'] ?? $booking['unregistered_pet_weight'],
            'petMicrochipId' => $booking['pet_microchip'] ?? null,
            'petColor' => $booking['pet_color_marking'] ?? null,
            'petAllergies' => $isRegistered
                ? pet_allergy_effective_text($pdo, (int)$booking['pet_id'], $booking['pet_allergies'] ?? null)
                : null,
            'petTempOwner' => $booking['pet_Temp_owner'] ?? null,
            'petProfileImage' => $booking['setpetImage_url'] ?? null,
            'ownerName' => trim(($booking['first_Name'] ?? '') . ' ' . ($booking['last_Name'] ?? '')),
            'ownerEmail' => $booking['mail_Address'] ?? null,
            'ownerPhone' => $booking['phoneNumber'] ?? null,
            'ownerEmergencyNumber' => $booking['emergencyNumber'] ?? null,
            'ownerAddress' => $booking['personal_Address'] ?? null,
            'ownerBirthdate' => $booking['birthdate'] ?? null,
            'ownerProfileImage' => $booking['setProfilePic_url'] ?? null,
            'type' => $booking['service_type'],
            'service' => $serviceName,
            'date' => $booking['booking_date'],
            'time' => $booking['booking_time'],
            'status' => $booking['status'],
            'price' => $bookingPrice,
            'transportFee' => (float)($booking['transport_fee'] ?? 0),
            'notes' => $onlineConsultationDetails['additionalNotes']
                ?? bookingCleanVisibleNotes($booking['notes'] ?? ''),
            'discussionTopic' => $onlineConsultationDetails['discussionTopic'] ?? null,
            'discussionTopics' => $onlineConsultationDetails['discussionTopics'] ?? [],
            'paymentSenderNumber' => $onlineConsultationDetails['paymentSenderNumber'] ?? null,
            'transactionReference' => $onlineConsultationDetails['transactionReference'] ?? null,
            'isRegistered' => $isRegistered,
            'isHomeService' => $isHomeService,
            'isOnlineConsultation' => $isOnlineConsultation,
            'address' => $booking['address'] ?? null,
            'paymentProof' => $booking['payment_proof_url'] ?? null,
            // Keep the existing field name for callers, while preventing a
            // legacy signature-only image from being presented as the form.
            'signaturePath' => $signedConsentDocumentPath,
            'consentDocumentPath' => $signedConsentDocumentPath,
            'legacyConsentSignaturePath' => $legacyConsentSignaturePath,
            'physicalConsentPath' => $physicalConsentPath,
            'consentForms' => $consentForms,
            'consentStatus' => $booking['consent_status'] ?? null,
            'image_Booking_Concern_Path' => $booking['Image_Booking_Concern_Path'] ?? null,
            'hotelBoardingType' => $booking['hotel_boarding_type'] ?? null,
            'checkInDate' => $booking['check_in_date'] ?? null,
            'checkOutDate' => $booking['check_out_date'] ?? null,
            'roomSize' => $booking['room_size'] ?? null,
            'addOns' => $addOns,
            'specialServiceItems' => $specialServiceItems,
            'emergencyContact' => $booking['emergency_contact'] ?? null,
            'veterinarianId' => $booking['veterinarian_id'] ?? null,
            'veterinarian' => !empty($booking['vet_first_name']) ? "Dr. {$booking['vet_first_name']} {$booking['vet_last_name']}" : null,
            'createdAt' => $booking['created_at']
        ];
    }, $bookings);

    echo json_encode($formattedBookings);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['message' => 'Failed to fetch pet bookings: ' . $e->getMessage()]);
}
