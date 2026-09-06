<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/grooming_helpers.php';
header('Content-Type: application/json');
header('Cache-Control: no-store');
$user = ipawcus_guard_current_user($pdo);
$role = ipawcus_guard_role($user);
$actor = ipawcus_guard_user_id($user);
$admin = ipawcus_guard_is_admin_role($role);
if (!in_array($role, ['admin', 'super_admin', 'veterinarian', 'pet_owner'], true)) ipawcus_guard_error(403, 'Your account cannot access grooming records.');
if ($role === 'admin' && !(ipawcus_admin_feature_permissions($pdo, $actor)['grooming'] ?? true)) ipawcus_guard_error(403, 'Your account does not have Grooming Management access.');
grooming_require_schema($pdo);
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$id = (int)($_GET['bookingId'] ?? 0);
$reviewsOnly = ($_GET['view'] ?? '') === 'reviews';

if ($method === 'GET' && $id <= 0) {
    $scope = ''; $params = [];
    if ($role === 'pet_owner') { $scope = ' AND b.user_id = ? AND j.published_at IS NOT NULL'; $params[] = $actor; }
    elseif ($role !== 'super_admin') {
        $branchIds = branch_user_ids($pdo, $actor);
        $scope = $branchIds ? ' AND b.branch_id IN (' . implode(',', array_fill(0, count($branchIds), '?')) . ')' : ' AND 1 = 0';
        $params = $branchIds;
    }
    if ($role === 'veterinarian') {
        $scope .= ' AND EXISTS (SELECT 1 FROM grooming_reviews own_review WHERE own_review.booking_id = b.booking_id AND own_review.veterinarian_id = ?';
        if ($reviewsOnly) $scope .= " AND own_review.outcome = 'pending' AND j.status = 'vet_review'";
        $scope .= ')'; $params[] = $actor;
    }
    $stmt = $pdo->prepare("SELECT b.booking_id, b.booking_number, b.branch_id, b.user_id, b.booking_date, b.booking_time, b.status AS booking_status,
        COALESCE(p.pet_name, b.unregistered_pet_name, 'Pet') AS pet_name,
        CONCAT(u.first_Name, ' ', u.last_Name) AS owner_name, br.branch_name,
        COALESCE(j.status, 'scheduled') AS status, j.performed_by, COALESCE(j.version, 0) AS version, j.published_at,
        (SELECT COUNT(*) FROM grooming_reviews r WHERE r.booking_id = b.booking_id AND r.outcome = 'pending') AS pending_reviews
        FROM bookings b JOIN users u ON u.user_id = b.user_id LEFT JOIN pets_information p ON p.pet_id = b.pet_id
        LEFT JOIN branches br ON br.branch_id = b.branch_id LEFT JOIN grooming_jobs j ON j.booking_id = b.booking_id
        WHERE LOWER(TRIM(b.service_type)) IN ('grooming', 'pet grooming') AND (b.status = 'confirmed' OR j.booking_id IS NOT NULL)
        {$scope}
        ORDER BY b.booking_date DESC, b.booking_time ASC");
    $stmt->execute($params);
    $items = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $item) {
        if ($role === 'pet_owner') {
            if ((int)$item['user_id'] !== $actor || !$item['published_at']) continue;
        }
        if ($item['booking_status'] === 'cancelled') $item['status'] = 'cancelled';
        if (!$admin && $role !== 'pet_owner') {
            $check = $pdo->prepare('SELECT * FROM grooming_reviews WHERE booking_id = ? AND veterinarian_id = ? ORDER BY review_id DESC LIMIT 1');
            $check->execute([(int)$item['booking_id'], $actor]);
            $review = $check->fetch(PDO::FETCH_ASSOC);
            if (!$review || ($reviewsOnly && $review['outcome'] !== 'pending')) continue;
            $item['review'] = $review;
        }
        if ($role === 'pet_owner') unset($item['pending_reviews'], $item['performed_by'], $item['user_id'], $item['version']);
        $items[] = $item;
    }
    echo json_encode(['items' => $items]);
    exit;
}

if ($method === 'GET') {
    $booking = grooming_booking($pdo, $id, $user);
    $stmt = $pdo->prepare('SELECT * FROM grooming_jobs WHERE booking_id = ?');
    $stmt->execute([$id]);
    $job = $stmt->fetch(PDO::FETCH_ASSOC) ?: ['booking_id' => $id, 'status' => 'scheduled', 'performed_by' => '', 'version' => 0, 'published_at' => null];
    if ($booking['status'] === 'cancelled') $job['status'] = 'cancelled';
    $details = isset($job['details_json']) ? json_decode($job['details_json'], true) : grooming_validate_details(['ownerRequest' => $booking['notes'] ?? '', 'allergies' => $booking['pet_allergies'] ?? '']);
    unset($job['details_json']);
    $stmt = $pdo->prepare('SELECT r.*, CONCAT(u.first_Name, \' \', u.last_Name) AS veterinarian_name FROM grooming_reviews r JOIN users u ON u.user_id = r.veterinarian_id WHERE booking_id = ? ORDER BY review_id DESC');
    $stmt->execute([$id]);
    $reviews = $stmt->fetchAll(PDO::FETCH_ASSOC);
    if (!$admin && $role !== 'pet_owner' && !array_filter($reviews, fn($r) => (int)$r['veterinarian_id'] === $actor)) ipawcus_guard_error(403, 'Only the assigned vet can view this grooming review.');
    $stmt = $pdo->prepare('SELECT * FROM grooming_photos WHERE booking_id = ? ORDER BY photo_id');
    $stmt->execute([$id]);
    $photos = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $stmt = $pdo->prepare('SELECT e.*, CONCAT(u.first_Name, \' \', u.last_Name) AS recorded_by FROM grooming_events e JOIN users u ON u.user_id = e.actor_id WHERE booking_id = ? ORDER BY event_id DESC LIMIT 100');
    $stmt->execute([$id]);
    $events = $stmt->fetchAll(PDO::FETCH_ASSOC);
    if ($role === 'pet_owner') {
        if (!$job['published_at']) ipawcus_guard_error(404, 'The grooming summary has not been shared yet.');
        $details = array_intersect_key($details, array_flip(['package', 'addOns', 'ownerSummary', 'tasks']));
        // Checklist reasons may be internal; only the reviewed summary is shared.
        unset($details['tasks']);
        $photos = array_values(array_filter($photos, fn($p) => $p['category'] !== 'concern' && (int)$p['share_with_owner'] === 1));
        $reviews = []; $events = [];
        unset($job['updated_by']);
        unset($job['performed_by'], $job['visit_id'], $job['version']);
    }
    $references = $admin ? array_values(array_filter(array_map('trim', explode(',', $booking['Image_Booking_Concern_Path'] ?? '')))) : [];
    $eligibleVets = [];
    if ($admin) {
        $candidates = $pdo->query('SELECT u.user_id, u.role, u.first_Name, u.last_Name FROM users u JOIN veterinarian_profiles v ON v.user_id = u.user_id WHERE v.is_active = 1 ORDER BY u.last_Name, u.first_Name')->fetchAll(PDO::FETCH_ASSOC);
        foreach ($candidates as $candidate) {
            if (ipawcus_guard_role($candidate) === 'veterinarian' && branch_user_can_access($pdo, $candidate, (int)$booking['branch_id'])) {
                $eligibleVets[] = array_intersect_key($candidate, array_flip(['user_id', 'first_Name', 'last_Name']));
            }
        }
    }
    echo json_encode(['job' => $job, 'details' => $details, 'petName' => $booking['grooming_pet_name'], 'bookingStatus' => $booking['status'], 'referencePhotos' => $references, 'reviews' => $reviews, 'photos' => $photos, 'events' => $events, 'eligibleVets' => $eligibleVets]);
    exit;
}

if ($method !== 'POST') ipawcus_guard_error(405, 'This grooming action is not available.');
$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input) || !is_string($input['action'] ?? 'save')) ipawcus_guard_error(422, 'The grooming request is incomplete. Refresh the record and try again.');
$id = (int)($input['bookingId'] ?? 0);
$action = $input['action'] ?? 'save';
if (!$admin && !($role === 'veterinarian' && $action === 'review')) ipawcus_guard_error(403, 'Only an administrator can manage grooming jobs.');
try {
    $pdo->beginTransaction();
    $booking = grooming_booking($pdo, $id, $user, true);
    if (!in_array($booking['status'], ['confirmed', 'completed'], true)) ipawcus_guard_error(409, 'This booking is no longer approved. Review it in Bookings.');
    $existing = $pdo->prepare('SELECT version FROM grooming_jobs WHERE booking_id = ?');
    $existing->execute([$id]);
    $existingVersion = (int)($existing->fetchColumn() ?: 0);
    if ((int)($input['version'] ?? -1) !== $existingVersion) ipawcus_guard_error(409, 'Another staff member updated this job. Reload it before saving your changes.');
    $job = grooming_ensure_job($pdo, $booking, $actor);
    $details = json_decode($job['details_json'], true) ?: [];
    $reviewStmt = $pdo->prepare('SELECT * FROM grooming_reviews WHERE booking_id = ? ORDER BY review_id DESC LIMIT 1 FOR UPDATE');
    $reviewStmt->execute([$id]);
    $latestReview = $reviewStmt->fetch(PDO::FETCH_ASSOC) ?: null;
    $nextStatus = $job['status'];
    $performer = $job['performed_by'];
    $visitId = $job['visit_id'];

    if ($action === 'save') {
        $nextStatus = (string)($input['status'] ?? $job['status']);
        $nextDetails = grooming_validate_details(is_array($input['details'] ?? null) ? $input['details'] : []);
        $performer = trim((string)($input['performedBy'] ?? ''));
        if (strlen($performer) > 120) throw new InvalidArgumentException('Keep the staff name under 120 characters.');
        if ($job['status'] === 'ready') {
            $nextDetails = array_merge($details, array_intersect_key($nextDetails, array_flip(['pickupPerson', 'pickupNote'])));
            $performer = $job['performed_by'];
        }
        grooming_assert_transition($job['status'], $nextStatus, $nextDetails, $performer, $latestReview['outcome'] ?? null);
        if (in_array(strtolower($booking['pet_status'] ?? ''), ['deceased', 'dead'], true) && !in_array($nextStatus, ['cancelled', 'no_show'], true)) throw new InvalidArgumentException('This pet is marked deceased. Review its record before proceeding.');
        $today = (new DateTimeImmutable('now', new DateTimeZone('Asia/Manila')))->format('Y-m-d');
        if ($job['status'] !== $nextStatus && $nextStatus === 'checked_in' && $booking['booking_date'] !== $today) throw new InvalidArgumentException('Check in on the booked date. Reschedule the booking first if needed.');
        if ($nextStatus === 'no_show' && $booking['booking_date'] > $today) throw new InvalidArgumentException('This booking is in the future. You cannot mark it as missed yet.');
        if ($nextStatus === 'ready' && $job['status'] !== 'ready') {
            if ((int)$booking['pet_id'] <= 0) throw new InvalidArgumentException('Link this booking to a registered pet before creating its invoice.');
            define('VISIT_BILLING_HELPERS_ONLY', true);
            define('VISIT_BILLING_THROW_ERRORS', true);
            require_once __DIR__ . '/visit_billing.php';
            $lookup = $pdo->prepare("SELECT visit_id FROM visits WHERE booking_id = ? AND visit_status <> 'cancelled' LIMIT 1 FOR UPDATE");
            $lookup->execute([$id]);
            $visitId = (int)($lookup->fetchColumn() ?: 0);
            if ($visitId > 0) {
                $sum = $pdo->prepare('SELECT COALESCE(SUM(quantity * unit_price), 0) FROM visit_charges WHERE visit_id = ?');
                $sum->execute([$visitId]);
                if (abs((float)$sum->fetchColumn() - (float)$nextDetails['agreedTotal']) > 0.009) throw new InvalidArgumentException('An invoice already exists with a different total. Reconcile it in Point-of-Sale before completing grooming.');
            } else {
                if ((float)$nextDetails['agreedTotal'] <= 0) throw new InvalidArgumentException('Enter a positive agreed total before creating the grooming invoice.');
                $price = $pdo->prepare('UPDATE bookings SET price = ? WHERE booking_id = ?');
                $price->execute([$nextDetails['agreedTotal'], $id]);
                $invoice = visit_billing_save_visit_payload($pdo, ['pet_id' => (int)$booking['pet_id'], 'booking_id' => $id, 'source_type' => 'booking', 'visit_status' => 'treatment_done', 'charges' => []]);
                $visitId = (int)$invoice['visitId'];
            }
        }
        $details = $nextDetails;
        if ($nextStatus === 'released') {
            $done = $pdo->prepare("UPDATE bookings SET status = 'completed' WHERE booking_id = ?");
            $done->execute([$id]);
        }
        if (in_array($nextStatus, ['cancelled', 'no_show'], true)) {
            if (empty($details['internalNotes'])) throw new InvalidArgumentException('Record why grooming was cancelled or missed.');
            $cancel = $pdo->prepare("UPDATE bookings SET status = 'cancelled' WHERE booking_id = ?");
            $cancel->execute([$id]);
            $pdo->prepare("UPDATE grooming_reviews SET outcome = 'cancelled' WHERE booking_id = ? AND outcome = 'pending'")->execute([$id]);
        }
    } elseif ($action === 'request_review') {
        if (!in_array($job['status'], ['checked_in', 'in_progress', 'vet_review'], true)) throw new InvalidArgumentException('Check in the pet before requesting vet review.');
        if (($latestReview['outcome'] ?? '') === 'pending') throw new InvalidArgumentException('A vet review is already pending for this job.');
        $reason = trim((string)($input['reason'] ?? ''));
        $vetId = (int)($input['veterinarianId'] ?? 0);
        if ($reason === '' || strlen($reason) > 3000) throw new InvalidArgumentException('Describe the concern in 3,000 characters or fewer.');
        $vetStmt = $pdo->prepare('SELECT * FROM users WHERE user_id = ?');
        $vetStmt->execute([$vetId]);
        $vet = $vetStmt->fetch(PDO::FETCH_ASSOC);
        $profileStmt = $pdo->prepare('SELECT is_active FROM veterinarian_profiles WHERE user_id = ?');
        $profileStmt->execute([$vetId]);
        if (!$vet || ipawcus_guard_role($vet) !== 'veterinarian' || (int)$profileStmt->fetchColumn() !== 1 || !branch_user_can_access($pdo, $vet, (int)$booking['branch_id'])) throw new InvalidArgumentException('Choose an active veterinarian assigned to this branch.');
        $insert = $pdo->prepare('INSERT INTO grooming_reviews (booking_id, veterinarian_id, requested_by, reason) VALUES (?, ?, ?, ?)');
        $insert->execute([$id, $vetId, $actor, $reason]);
        $nextStatus = 'vet_review';
    } elseif ($action === 'review') {
        if ($job['status'] !== 'vet_review' || !$latestReview || $latestReview['outcome'] !== 'pending' || (int)$latestReview['veterinarian_id'] !== $actor) ipawcus_guard_error(403, 'Only the assigned veterinarian can complete this pending review.');
        $outcome = $input['outcome'] ?? '';
        $notes = trim((string)($input['notes'] ?? ''));
        if (!in_array($outcome, ['resume', 'stop', 'consultation'], true) || $notes === '' || strlen($notes) > 5000) throw new InvalidArgumentException('Choose a review outcome and enter the vet assessment notes.');
        $update = $pdo->prepare('UPDATE grooming_reviews SET outcome = ?, review_notes = ?, reviewed_at = CURRENT_TIMESTAMP WHERE review_id = ?');
        $update->execute([$outcome, $notes, (int)$latestReview['review_id']]);
        // Review does not complete grooming, create a diagnosis, or charge a consultation.
    } elseif ($action === 'publish') {
        if (!in_array($job['status'], ['ready', 'released'], true)) throw new InvalidArgumentException('Finish grooming before sharing its summary.');
        $pdo->prepare('UPDATE grooming_jobs SET published_at = CURRENT_TIMESTAMP WHERE booking_id = ?')->execute([$id]);
    } else throw new InvalidArgumentException('This grooming action is not available.');

    $update = $pdo->prepare('UPDATE grooming_jobs SET status = ?, performed_by = ?, details_json = ?, visit_id = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP, updated_by = ? WHERE booking_id = ?');
    $update->execute([$nextStatus, $performer, json_encode($details), $visitId ?: null, $actor, $id]);
    grooming_event($pdo, $id, $actor, $action, ['from' => $job['status'], 'to' => $nextStatus, 'performedBy' => $performer, 'record' => $action === 'save' ? $details : array_intersect_key($input, array_flip(['reason', 'outcome', 'notes', 'veterinarianId']))]);
    $pdo->commit();
    try {
        require_once __DIR__ . '/grooming_notifications.php';
        grooming_notify($pdo, $booking, $job, $action, $nextStatus, $input, $latestReview);
    } catch (Throwable $notificationError) {
        error_log('Grooming notification failed: ' . $notificationError->getMessage());
    }
    echo json_encode(['success' => true, 'message' => 'Grooming record updated.']);
} catch (Throwable $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    if ($error instanceof InvalidArgumentException) ipawcus_guard_error(422, $error->getMessage());
    if ($error instanceof RuntimeException && !($error instanceof PDOException) && http_response_code() >= 400 && http_response_code() < 500) ipawcus_guard_error(http_response_code(), $error->getMessage());
    error_log('Grooming update failed: ' . $error->getMessage());
    ipawcus_guard_error(500, 'The grooming record could not be saved. Please try again.');
}
