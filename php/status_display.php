<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/booking_maintenance.php';
require_once __DIR__ . '/reference_number_helpers.php';
require_once __DIR__ . '/branch_helpers.php';

header('Content-Type: application/json');

function status_display_table_exists(PDO $pdo, string $tableName): bool
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

function status_display_text($value, string $fallback = 'Unknown'): string
{
    $text = trim((string)($value ?? ''));
    return $text === '' ? $fallback : $text;
}

function status_display_service_label($value): string
{
    $service = status_display_text($value, 'Clinic Service');
    $normalized = strtolower(trim($service));
    if (in_array($normalized, ['general-checkup', 'general check-up', 'general checkup'], true)) {
        return 'General Check-up';
    }

    return ucwords(str_replace(['-', '_'], ' ', $service));
}

function status_display_reference(string $prefix, $value): string
{
    $text = trim((string)($value ?? ''));
    if ($text === '') {
        return $prefix . '-';
    }

    if (is_numeric($text)) {
        return $prefix . '-' . str_pad((string)(int)$text, 3, '0', STR_PAD_LEFT);
    }

    return $text;
}

function status_display_pet_name(array $row): string
{
    return status_display_text($row['pet_name'] ?? $row['unregistered_pet_name'] ?? null, 'Pet');
}

function status_display_queue_stage(array $row): string
{
    $billingStatus = strtolower((string)($row['billing_status'] ?? ''));
    $visitStatus = strtolower((string)($row['visit_status'] ?? ''));
    $queueStatus = strtolower((string)($row['queue_status'] ?? 'waiting'));
    $assignmentStatus = strtolower((string)($row['assignment_status'] ?? ''));
    $hasDiagnosis = !empty($row['diagnosis_id']);

    if ($billingStatus === 'paid') {
        return 'Payment Complete';
    }

    if (in_array($billingStatus, ['unpaid', 'partial'], true)) {
        return 'For Payment';
    }

    if ($visitStatus === 'treatment_done' || $hasDiagnosis) {
        return 'Diagnosis Done';
    }

    if ($queueStatus === 'in-progress' && $assignmentStatus === 'received') {
        return 'In Service';
    }

    if ($queueStatus === 'completed') {
        return 'Completed';
    }

    return 'Waiting';
}

function status_display_booking_stage(array $row): string
{
    $status = strtolower((string)($row['booking_status'] ?? 'pending'));
    $hasPayment = !empty($row['payment_proof_url']) || !empty($row['payment_method']) || !empty($row['payment_reference']);

    if ($status === 'confirmed') {
        return $hasPayment ? 'Confirmed' : 'Scheduled';
    }

    if ($status === 'completed') {
        return 'Completed';
    }

    if ($status === 'cancelled') {
        return 'Cancelled';
    }

    return $hasPayment ? 'Payment Submitted' : 'Awaiting Approval';
}

function status_display_billing_stage(array $row): string
{
    $billingStatus = strtolower((string)($row['billing_status'] ?? 'unbilled'));
    $visitStatus = strtolower((string)($row['visit_status'] ?? 'waiting'));

    if ($billingStatus === 'paid') {
        return 'Payment Complete';
    }

    if ($billingStatus === 'partial') {
        return 'Partial Payment';
    }

    if ($billingStatus === 'unpaid') {
        return 'For Payment';
    }

    if ($visitStatus === 'completed') {
        return 'Completed';
    }

    return 'Preparing Bill';
}

function status_display_public_pet(array $row): array
{
    return [
        'petName' => status_display_pet_name($row),
        'species' => status_display_text($row['pet_species'] ?? null, ''),
        'petStatus' => status_display_text($row['pet_status'] ?? null, 'Healthy'),
    ];
}

function status_display_queue_item(array $row): array
{
    return array_merge([
        'id' => 'queue-' . (int)$row['queue_id'],
        'reference' => ipawcus_format_queue_reference($row['queue_number'] ?? 0, $row['timestamp'] ?? null),
        'type' => 'queue',
        'stage' => status_display_queue_stage($row),
        'status' => status_display_text($row['queue_status'] ?? null, 'waiting'),
        'service' => status_display_service_label($row['service_name'] ?? null),
        'priority' => status_display_text($row['priority'] ?? null, 'normal'),
        'time' => $row['timestamp'] ?? null,
        'bookingNumber' => status_display_text($row['booking_number'] ?? null, ''),
        'veterinarianName' => status_display_text($row['veterinarian_name'] ?? null, ''),
    ], status_display_public_pet($row));
}

function status_display_booking_item(array $row): array
{
    return array_merge([
        'id' => 'booking-' . (int)$row['booking_id'],
        'reference' => status_display_text($row['booking_number'] ?? null, 'Booking'),
        'type' => 'booking',
        'stage' => status_display_booking_stage($row),
        'status' => status_display_text($row['booking_status'] ?? null, 'pending'),
        'service' => status_display_service_label($row['service_type'] ?? null),
        'priority' => 'normal',
        'time' => trim((string)($row['booking_date'] ?? '') . ' ' . (string)($row['booking_time'] ?? '')),
        'bookingNumber' => status_display_text($row['booking_number'] ?? null, ''),
    ], status_display_public_pet($row));
}

function status_display_billing_item(array $row): array
{
    return array_merge([
        'id' => 'visit-' . (int)$row['visit_id'],
        'reference' => status_display_text($row['booking_number'] ?? null, status_display_reference('V', $row['visit_id'] ?? null)),
        'type' => 'billing',
        'stage' => status_display_billing_stage($row),
        'status' => status_display_text($row['billing_status'] ?? null, 'unbilled'),
        'service' => status_display_service_label($row['service_name'] ?? $row['service_type'] ?? $row['source_type'] ?? null),
        'priority' => 'normal',
        'time' => $row['updated_at'] ?? $row['created_at'] ?? null,
        'bookingNumber' => status_display_text($row['booking_number'] ?? null, ''),
        'paidAmount' => (float)($row['paid_amount'] ?? 0),
        'totalAmount' => (float)($row['total_amount'] ?? 0),
    ], status_display_public_pet($row));
}

try {
    runLifecycleMaintenance($pdo, null, false);
    $today = maintenance_today($pdo);
    $availableBranches = branch_fetch_catalog($pdo);
    $requestedBranch = trim((string)($_GET['branch'] ?? $_GET['branch_id'] ?? ''));
    if ($requestedBranch !== '' && ctype_digit($requestedBranch)) {
        $branch = branch_fetch($pdo, (int)$requestedBranch);
    } elseif ($requestedBranch !== '') {
        $requestedCode = strtoupper($requestedBranch);
        $branch = null;
        foreach ($availableBranches as $availableBranch) {
            if (strtoupper((string)($availableBranch['code'] ?? '')) === $requestedCode) {
                $branch = branch_fetch($pdo, (int)$availableBranch['id']);
                break;
            }
        }
    } else {
        $branch = branch_fetch($pdo, branch_main_id($pdo));
    }
    if (!$branch) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Clinic location was not found.']);
        exit;
    }
    $branchId = (int)$branch['branch_id'];
    $branchCatalog = array_map(static fn(array $catalogBranch): array => [
        'id' => (int)$catalogBranch['id'],
        'code' => $catalogBranch['code'],
        'name' => $catalogBranch['name'],
        'address' => $catalogBranch['address'],
    ], $availableBranches);
    $sections = [
        'queue' => [],
        'bookings' => [],
        'billing' => [],
        'completed' => [],
    ];

    if (status_display_table_exists($pdo, 'queues')) {
        $hasVetQueueAssignments = status_display_table_exists($pdo, 'vet_queue_assignments');
        $assignmentSelect = $hasVetQueueAssignments
            ? 'vqa.veterinarian_name, vqa.status AS assignment_status,'
            : 'NULL AS veterinarian_name, NULL AS assignment_status,';
        $assignmentJoin = $hasVetQueueAssignments
            ? "LEFT JOIN vet_queue_assignments vqa ON vqa.assignment_id = (
                SELECT latest_vqa.assignment_id
                FROM vet_queue_assignments latest_vqa
                WHERE latest_vqa.queue_id = q.queue_id
                  AND latest_vqa.status = 'received'
                ORDER BY latest_vqa.assignment_id DESC
                LIMIT 1
            )"
            : "";

        $stmt = $pdo->prepare("
            SELECT
                q.queue_id,
                q.queue_number,
                q.status AS queue_status,
                q.priority,
                q.service_name,
                q.timestamp,
                p.pet_name,
                p.pet_species,
                p.pet_status,
                b.booking_number,
                {$assignmentSelect}
                vd.diagnosis_id,
                v.visit_id,
                v.visit_status,
                v.billing_status,
                v.updated_at AS visit_updated_at
            FROM queues q
            JOIN pets_information p ON p.pet_id = q.pet_id
            LEFT JOIN bookings b ON b.booking_id = q.booking_id
            {$assignmentJoin}
            LEFT JOIN vet_diagnoses vd ON vd.queue_id = q.queue_id
            LEFT JOIN visits v ON v.visit_id = (
                SELECT latest_v.visit_id
                FROM visits latest_v
                WHERE latest_v.queue_id = q.queue_id
                   OR (q.booking_id IS NOT NULL AND latest_v.booking_id = q.booking_id)
                ORDER BY latest_v.visit_id DESC
                LIMIT 1
            )
            WHERE q.branch_id = ?
              AND ((
                    q.status IN ('waiting', 'in-progress')
                    AND DATE(q.timestamp) = ?
                )
               OR (q.status = 'completed' AND DATE(q.timestamp) = ?))
            ORDER BY
                FIELD(q.status, 'in-progress', 'waiting', 'completed', 'cancelled'),
                q.timestamp ASC
            LIMIT 30
        ");
        $stmt->execute([$branchId, $today, $today]);

        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $item = status_display_queue_item($row);
            if (($row['queue_status'] ?? '') === 'completed') {
                $sections['completed'][] = $item;
            } else {
                $sections['queue'][] = $item;
            }
        }
    }

    if (status_display_table_exists($pdo, 'bookings')) {
        $stmt = $pdo->prepare("
            SELECT
                b.booking_id,
                b.booking_number,
                b.service_type,
                b.booking_date,
                b.booking_time,
                b.status AS booking_status,
                b.payment_proof_url,
                b.payment_method,
                b.payment_reference,
                b.notes,
                b.unregistered_pet_name,
                p.pet_name,
                p.pet_species,
                p.pet_status
            FROM bookings b
            LEFT JOIN pets_information p ON p.pet_id = b.pet_id
            WHERE b.status = 'confirmed'
              AND b.branch_id = ?
              AND b.booking_date = ?
              AND COALESCE(b.notes, '') NOT LIKE '%[Lifecycle] Auto-rescheduled due to missed approved booking%'
              AND COALESCE(b.notes, '') NOT LIKE '%[Rescheduled]%'
              AND NOT EXISTS (
                  SELECT 1
                  FROM queues q
                  WHERE q.booking_id = b.booking_id
                    AND q.status IN ('waiting', 'in-progress')
              )
            ORDER BY b.booking_date ASC, b.booking_time ASC, b.booking_id ASC
            LIMIT 18
        ");
        $stmt->execute([$branchId, $today]);

        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $sections['bookings'][] = status_display_booking_item($row);
        }
    }

    if (status_display_table_exists($pdo, 'visits')) {
        $refundJoin = '';
        $refundAdjustment = '';
        if (status_display_table_exists($pdo, 'visit_payment_refunds')) {
            $refundJoin = "
                LEFT JOIN (
                    SELECT visit_id, SUM(amount) AS total_refunded
                    FROM visit_payment_refunds
                    WHERE refund_status = 'processed'
                    GROUP BY visit_id
                ) refunds ON refunds.visit_id = payment_rows.visit_id
            ";
            $refundAdjustment = ' - COALESCE(MAX(refunds.total_refunded), 0)';
        }
        $stmt = $pdo->prepare("
            SELECT
                v.visit_id,
                v.source_type,
                v.visit_status,
                v.billing_status,
                v.created_at,
                v.updated_at,
                p.pet_name,
                p.pet_species,
                p.pet_status,
                b.booking_number,
                b.service_type,
                q.queue_number,
                vd.service_name,
                COALESCE(charges.total_amount, 0) AS total_amount,
                COALESCE(payments.paid_amount, 0) AS paid_amount
            FROM visits v
            JOIN pets_information p ON p.pet_id = v.pet_id
            LEFT JOIN bookings b ON b.booking_id = v.booking_id
            LEFT JOIN queues q ON q.queue_id = v.queue_id
            LEFT JOIN vet_diagnoses vd ON vd.diagnosis_id = v.diagnosis_id
            LEFT JOIN (
                SELECT visit_id, SUM(subtotal) AS total_amount
                FROM visit_charges
                GROUP BY visit_id
            ) charges ON charges.visit_id = v.visit_id
            LEFT JOIN (
                SELECT
                    payment_rows.visit_id,
                    GREATEST(
                        SUM(CASE WHEN payment_rows.payment_status IN ('verified', 'refunded') THEN payment_rows.amount ELSE 0 END)
                        {$refundAdjustment},
                        0
                    ) AS paid_amount
                FROM visit_payments payment_rows
                {$refundJoin}
                GROUP BY payment_rows.visit_id
            ) payments ON payments.visit_id = v.visit_id
            WHERE v.visit_status <> 'cancelled'
              AND v.branch_id = ?
              AND (
                  v.billing_status IN ('unbilled', 'unpaid', 'partial')
                  OR (v.billing_status = 'paid' AND DATE(v.updated_at) = ?)
                  OR (v.visit_status = 'completed' AND DATE(v.updated_at) = ?)
              )
            ORDER BY
                FIELD(v.billing_status, 'partial', 'unpaid', 'unbilled', 'paid', 'refunded'),
                v.updated_at DESC
            LIMIT 24
        ");
        $stmt->execute([$branchId, $today, $today]);

        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $item = status_display_billing_item($row);
            if (($row['billing_status'] ?? '') === 'paid' || ($row['visit_status'] ?? '') === 'completed') {
                $sections['completed'][] = $item;
            } else {
                $sections['billing'][] = $item;
            }
        }
    }

    $summary = [
        'waiting' => count(array_filter($sections['queue'], fn($item) => strtolower($item['stage']) === 'waiting')),
        'inService' => count(array_filter($sections['queue'], fn($item) => in_array($item['stage'], ['In Service', 'Diagnosis Done'], true))),
        'forPayment' => count($sections['billing']),
        'upcoming' => count($sections['bookings']),
        'completedToday' => count($sections['completed']),
    ];

    echo json_encode([
        'success' => true,
        'generatedAt' => date(DATE_ATOM),
        'refreshSeconds' => 8,
        'branch' => [
            'id' => $branchId,
            'code' => $branch['branch_code'],
            'name' => $branch['branch_name'],
            'address' => $branch['address'],
        ],
        'branches' => $branchCatalog,
        'privacy' => [
            'ownerNamesShown' => false,
            'diagnosisTextShown' => false,
            'contactDetailsShown' => false,
        ],
        'summary' => $summary,
        'sections' => $sections,
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Unable to load TV status display.',
    ]);
}
