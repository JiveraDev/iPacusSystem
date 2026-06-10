<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/notification_helpers.php';

header('Content-Type: application/json');

function visit_billing_input(): array
{
    return json_decode(file_get_contents('php://input'), true) ?: [];
}

function visit_billing_table_exists(PDO $pdo, string $tableName): bool
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

function visit_billing_schema_ready(PDO $pdo): bool
{
    foreach (['visits', 'visit_charges', 'visit_payments', 'service_catalog'] as $tableName) {
        if (!visit_billing_table_exists($pdo, $tableName)) {
            return false;
        }
    }

    return true;
}

function visit_billing_missing_message(): string
{
    return 'Visit billing schema is missing. Run DDL/visit_service_payment_migration_20260604.sql first.';
}

function visit_billing_error(int $statusCode, string $message): void
{
    global $pdo;

    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    http_response_code($statusCode);
    echo json_encode(['success' => false, 'message' => $message]);
    exit;
}

function visit_billing_require_schema(PDO $pdo): void
{
    if (!visit_billing_schema_ready($pdo)) {
        visit_billing_error(409, visit_billing_missing_message());
    }
}

function visit_billing_nullable_int($value): ?int
{
    if ($value === null || $value === '') {
        return null;
    }

    return is_numeric($value) ? (int)$value : null;
}

function visit_billing_nullable_text($value): ?string
{
    $text = trim((string)($value ?? ''));
    return $text === '' ? null : $text;
}

function visit_billing_allowed(string $value, array $allowed, string $fallback): string
{
    return in_array($value, $allowed, true) ? $value : $fallback;
}

function visit_billing_decode_json($value)
{
    if ($value === null || $value === '') {
        return null;
    }

    $decoded = json_decode((string)$value, true);

    return json_last_error() === JSON_ERROR_NONE ? $decoded : null;
}

function visit_billing_resolve_owner(PDO $pdo, ?int $ownerUserId, int $petId, ?int $queueId, ?int $bookingId): int
{
    if ($ownerUserId !== null && $ownerUserId > 0) {
        return $ownerUserId;
    }

    if ($queueId !== null && $queueId > 0) {
        $stmt = $pdo->prepare("SELECT user_id FROM queues WHERE queue_id = ? LIMIT 1");
        $stmt->execute([$queueId]);
        $owner = $stmt->fetchColumn();
        if ($owner) {
            return (int)$owner;
        }
    }

    if ($bookingId !== null && $bookingId > 0) {
        $stmt = $pdo->prepare("SELECT user_id FROM bookings WHERE booking_id = ? LIMIT 1");
        $stmt->execute([$bookingId]);
        $owner = $stmt->fetchColumn();
        if ($owner) {
            return (int)$owner;
        }
    }

    $stmt = $pdo->prepare("SELECT user_id FROM pet_ownership WHERE pet_id = ? ORDER BY link_id DESC LIMIT 1");
    $stmt->execute([$petId]);
    $owner = $stmt->fetchColumn();
    if ($owner) {
        return (int)$owner;
    }

    visit_billing_error(400, 'owner_user_id could not be resolved for this visit.');
}

function visit_billing_fetch_visit_id(PDO $pdo, array $input): ?int
{
    $visitId = visit_billing_nullable_int($input['visit_id'] ?? $input['visitId'] ?? null);
    if ($visitId !== null && $visitId > 0) {
        return $visitId;
    }

    $petId = visit_billing_nullable_int($input['pet_id'] ?? $input['petId'] ?? null);
    $queueId = visit_billing_nullable_int($input['queue_id'] ?? $input['queueId'] ?? null);
    $bookingId = visit_billing_nullable_int($input['booking_id'] ?? $input['bookingId'] ?? null);

    if ($petId !== null && $queueId !== null) {
        $stmt = $pdo->prepare("SELECT visit_id FROM visits WHERE pet_id = ? AND queue_id = ? LIMIT 1");
        $stmt->execute([$petId, $queueId]);
        $existing = $stmt->fetchColumn();
        if ($existing) {
            return (int)$existing;
        }
    }

    if ($petId !== null && $bookingId !== null) {
        $stmt = $pdo->prepare("SELECT visit_id FROM visits WHERE pet_id = ? AND booking_id = ? LIMIT 1");
        $stmt->execute([$petId, $bookingId]);
        $existing = $stmt->fetchColumn();
        if ($existing) {
            return (int)$existing;
        }
    }

    return null;
}

function visit_billing_update_status(PDO $pdo, int $visitId): void
{
    $chargeStmt = $pdo->prepare("SELECT COALESCE(SUM(subtotal), 0) FROM visit_charges WHERE visit_id = ?");
    $chargeStmt->execute([$visitId]);
    $total = (float)$chargeStmt->fetchColumn();

    $paymentStmt = $pdo->prepare("
        SELECT COALESCE(SUM(amount), 0)
        FROM visit_payments
        WHERE visit_id = ?
          AND payment_status = 'verified'
    ");
    $paymentStmt->execute([$visitId]);
    $paid = (float)$paymentStmt->fetchColumn();

    if ($total <= 0) {
        $status = 'unbilled';
    } elseif ($paid <= 0) {
        $status = 'unpaid';
    } elseif ($paid + 0.0001 < $total) {
        $status = 'partial';
    } else {
        $status = 'paid';
    }

    $stmt = $pdo->prepare("UPDATE visits SET billing_status = ? WHERE visit_id = ?");
    $stmt->execute([$status, $visitId]);
}

function visit_billing_save_charges(PDO $pdo, int $visitId, array $charges, bool $replace = true): void
{
    if ($replace) {
        $deleteStmt = $pdo->prepare("DELETE FROM visit_charges WHERE visit_id = ?");
        $deleteStmt->execute([$visitId]);
    }

    $allowedTypes = ['service', 'diagnostic', 'medication', 'consumable', 'retail_product', 'boarding', 'other'];
    $insertStmt = $pdo->prepare("
        INSERT INTO visit_charges (
            visit_id,
            charge_type,
            service_id,
            item_id,
            description,
            quantity,
            unit_price,
            subtotal,
            created_by_user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");

    foreach ($charges as $charge) {
        $description = visit_billing_nullable_text($charge['description'] ?? null);
        $quantity = (float)($charge['quantity'] ?? 1);
        $unitPrice = (float)($charge['unit_price'] ?? $charge['unitPrice'] ?? 0);

        if ($description === null) {
            continue;
        }

        if ($quantity <= 0) {
            visit_billing_error(400, 'Charge quantity must be greater than 0.');
        }

        if ($unitPrice < 0) {
            visit_billing_error(400, 'Charge price cannot be negative.');
        }

        $chargeType = visit_billing_allowed(
            trim((string)($charge['charge_type'] ?? $charge['chargeType'] ?? 'service')),
            $allowedTypes,
            'service'
        );
        $serviceId = visit_billing_nullable_int($charge['service_id'] ?? $charge['serviceId'] ?? null);
        $itemId = visit_billing_nullable_int($charge['item_id'] ?? $charge['itemId'] ?? null);
        $createdBy = visit_billing_nullable_int($charge['created_by_user_id'] ?? $charge['createdByUserId'] ?? null);
        $subtotal = round($quantity * $unitPrice, 2);

        $insertStmt->execute([
            $visitId,
            $chargeType,
            $serviceId,
            $itemId,
            $description,
            $quantity,
            $unitPrice,
            $subtotal,
            $createdBy
        ]);
    }

    visit_billing_update_status($pdo, $visitId);
}

function visit_billing_upsert_visit(PDO $pdo): void
{
    visit_billing_require_schema($pdo);

    $input = visit_billing_input();
    $petId = visit_billing_nullable_int($input['pet_id'] ?? $input['petId'] ?? null);
    if ($petId === null || $petId <= 0) {
        visit_billing_error(400, 'pet_id is required.');
    }

    $queueId = visit_billing_nullable_int($input['queue_id'] ?? $input['queueId'] ?? null);
    $bookingId = visit_billing_nullable_int($input['booking_id'] ?? $input['bookingId'] ?? null);
    $ownerUserId = visit_billing_resolve_owner(
        $pdo,
        visit_billing_nullable_int($input['owner_user_id'] ?? $input['ownerUserId'] ?? null),
        $petId,
        $queueId,
        $bookingId
    );
    $veterinarianUserId = visit_billing_nullable_int($input['veterinarian_user_id'] ?? $input['veterinarianUserId'] ?? null);
    $diagnosisId = visit_billing_nullable_int($input['diagnosis_id'] ?? $input['diagnosisId'] ?? null);
    $sourceType = visit_billing_allowed(
        trim((string)($input['source_type'] ?? $input['sourceType'] ?? ($queueId ? 'queue' : ($bookingId ? 'booking' : 'manual')))),
        ['queue', 'booking', 'walk_in', 'boarding', 'manual'],
        'manual'
    );
    $visitStatus = visit_billing_allowed(
        trim((string)($input['visit_status'] ?? $input['visitStatus'] ?? 'treatment_done')),
        ['waiting', 'in_consultation', 'treatment_done', 'completed', 'cancelled'],
        'treatment_done'
    );

    $charges = $input['charges'] ?? [];
    if (!is_array($charges)) {
        visit_billing_error(400, 'charges must be an array.');
    }

    $pdo->beginTransaction();
    try {
        $visitLookupInput = array_merge($input, [
            'pet_id' => $petId,
            'queue_id' => $queueId,
            'booking_id' => $bookingId,
        ]);
        $visitId = visit_billing_fetch_visit_id($pdo, $visitLookupInput);

        if ($visitId !== null) {
            $stmt = $pdo->prepare("
                UPDATE visits
                SET owner_user_id = ?,
                    veterinarian_user_id = ?,
                    queue_id = ?,
                    booking_id = ?,
                    diagnosis_id = COALESCE(?, diagnosis_id),
                    source_type = ?,
                    visit_status = ?
                WHERE visit_id = ?
            ");
            $stmt->execute([
                $ownerUserId,
                $veterinarianUserId,
                $queueId,
                $bookingId,
                $diagnosisId,
                $sourceType,
                $visitStatus,
                $visitId
            ]);
        } else {
            $stmt = $pdo->prepare("
                INSERT INTO visits (
                    pet_id,
                    owner_user_id,
                    veterinarian_user_id,
                    queue_id,
                    booking_id,
                    diagnosis_id,
                    source_type,
                    visit_status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $petId,
                $ownerUserId,
                $veterinarianUserId,
                $queueId,
                $bookingId,
                $diagnosisId,
                $sourceType,
                $visitStatus
            ]);
            $visitId = (int)$pdo->lastInsertId();
        }

        if (!empty($charges)) {
            visit_billing_save_charges($pdo, $visitId, $charges, true);
        } else {
            visit_billing_update_status($pdo, $visitId);
        }

        $pdo->commit();

        try {
            if (!empty($charges)) {
                notification_send_visit_event($pdo, $visitId, 'invoice_ready');
            }
        } catch (Throwable $notificationError) {
            error_log('Visit invoice notification failed: ' . $notificationError->getMessage());
        }

        echo json_encode([
            'success' => true,
            'message' => 'Visit billing saved.',
            'visit' => visit_billing_fetch_visit($pdo, $visitId)
        ]);
    } catch (Exception $e) {
        visit_billing_error(500, 'Failed to save visit billing: ' . $e->getMessage());
    }
}

function visit_billing_fetch_visit(PDO $pdo, int $visitId): ?array
{
    $hasDiagnosisTable = visit_billing_table_exists($pdo, 'vet_diagnoses');
    $diagnosisSelect = $hasDiagnosisTable
        ? ",
            vd.prescriptions AS diagnosis_prescriptions,
            vd.notes AS diagnosis_notes,
            vd.diagnosis AS diagnosis_summary"
        : ",
            NULL AS diagnosis_prescriptions,
            NULL AS diagnosis_notes,
            NULL AS diagnosis_summary";
    $diagnosisJoin = $hasDiagnosisTable
        ? "LEFT JOIN vet_diagnoses vd ON vd.diagnosis_id = v.diagnosis_id"
        : "";

    $stmt = $pdo->prepare("
        SELECT
            v.*,
            p.pet_name,
            p.pet_species,
            CONCAT(owner.first_Name, ' ', owner.last_Name) AS owner_name,
            CONCAT(vet.first_Name, ' ', vet.last_Name) AS veterinarian_name,
            q.queue_number,
            b.booking_number
            {$diagnosisSelect}
        FROM visits v
        JOIN pets_information p ON p.pet_id = v.pet_id
        JOIN users owner ON owner.user_id = v.owner_user_id
        LEFT JOIN users vet ON vet.user_id = v.veterinarian_user_id
        LEFT JOIN queues q ON q.queue_id = v.queue_id
        LEFT JOIN bookings b ON b.booking_id = v.booking_id
        {$diagnosisJoin}
        WHERE v.visit_id = ?
        LIMIT 1
    ");
    $stmt->execute([$visitId]);
    $visit = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$visit) {
        return null;
    }

    $chargesStmt = $pdo->prepare("
        SELECT
            vc.*,
            sc.service_name,
            ii.item_name
        FROM visit_charges vc
        LEFT JOIN service_catalog sc ON sc.service_id = vc.service_id
        LEFT JOIN inventory_items ii ON ii.item_id = vc.item_id
        WHERE vc.visit_id = ?
        ORDER BY vc.charge_id ASC
    ");
    $chargesStmt->execute([$visitId]);
    $charges = array_map(function ($charge) {
        return [
            'chargeId' => (int)$charge['charge_id'],
            'visitId' => (int)$charge['visit_id'],
            'chargeType' => $charge['charge_type'],
            'serviceId' => $charge['service_id'] !== null ? (int)$charge['service_id'] : null,
            'serviceName' => $charge['service_name'] ?? '',
            'itemId' => $charge['item_id'] !== null ? (int)$charge['item_id'] : null,
            'itemName' => $charge['item_name'] ?? '',
            'description' => $charge['description'],
            'quantity' => (float)$charge['quantity'],
            'unitPrice' => (float)$charge['unit_price'],
            'subtotal' => (float)$charge['subtotal'],
            'createdAt' => $charge['created_at'],
        ];
    }, $chargesStmt->fetchAll(PDO::FETCH_ASSOC));

    $paymentsStmt = $pdo->prepare("
        SELECT *
        FROM visit_payments
        WHERE visit_id = ?
        ORDER BY paid_at DESC, payment_id DESC
    ");
    $paymentsStmt->execute([$visitId]);
    $payments = array_map(function ($payment) {
        return [
            'paymentId' => (int)$payment['payment_id'],
            'visitId' => (int)$payment['visit_id'],
            'paymentMethod' => $payment['payment_method'],
            'paymentStatus' => $payment['payment_status'],
            'amount' => (float)$payment['amount'],
            'referenceNumber' => $payment['reference_number'],
            'proofUrl' => $payment['proof_url'],
            'notes' => $payment['notes'],
            'paidAt' => $payment['paid_at'],
            'receivedByUserId' => $payment['received_by_user_id'] !== null ? (int)$payment['received_by_user_id'] : null,
            'receivedByName' => $payment['received_by_name'],
        ];
    }, $paymentsStmt->fetchAll(PDO::FETCH_ASSOC));

    $total = array_reduce($charges, fn($sum, $charge) => $sum + (float)$charge['subtotal'], 0.0);
    $paid = array_reduce($payments, function ($sum, $payment) {
        return $payment['paymentStatus'] === 'verified' ? $sum + (float)$payment['amount'] : $sum;
    }, 0.0);

    return [
        'visitId' => (int)$visit['visit_id'],
        'petId' => (int)$visit['pet_id'],
        'petName' => $visit['pet_name'],
        'petSpecies' => $visit['pet_species'],
        'ownerUserId' => (int)$visit['owner_user_id'],
        'ownerName' => trim((string)$visit['owner_name']),
        'veterinarianUserId' => $visit['veterinarian_user_id'] !== null ? (int)$visit['veterinarian_user_id'] : null,
        'veterinarianName' => trim((string)($visit['veterinarian_name'] ?? '')),
        'queueId' => $visit['queue_id'] !== null ? (int)$visit['queue_id'] : null,
        'queueNumber' => $visit['queue_number'] !== null ? (int)$visit['queue_number'] : null,
        'bookingId' => $visit['booking_id'] !== null ? (int)$visit['booking_id'] : null,
        'bookingNumber' => $visit['booking_number'],
        'diagnosisId' => $visit['diagnosis_id'] !== null ? (int)$visit['diagnosis_id'] : null,
        'diagnosisSummary' => $visit['diagnosis_summary'] ?? '',
        'diagnosisNotes' => $visit['diagnosis_notes'] ?? '',
        'prescriptions' => visit_billing_decode_json($visit['diagnosis_prescriptions'] ?? null) ?: [],
        'sourceType' => $visit['source_type'],
        'visitStatus' => $visit['visit_status'],
        'billingStatus' => $visit['billing_status'],
        'createdAt' => $visit['created_at'],
        'updatedAt' => $visit['updated_at'],
        'charges' => $charges,
        'payments' => $payments,
        'totals' => [
            'charges' => round($total, 2),
            'paid' => round($paid, 2),
            'balance' => round(max(0, $total - $paid), 2),
        ],
    ];
}

function visit_billing_list(PDO $pdo): void
{
    if (!visit_billing_schema_ready($pdo)) {
        echo json_encode([
            'success' => true,
            'schemaReady' => false,
            'message' => visit_billing_missing_message(),
            'visits' => []
        ]);
        return;
    }

    $visitId = visit_billing_nullable_int($_GET['visitId'] ?? $_GET['visit_id'] ?? null);
    if ($visitId !== null) {
        echo json_encode([
            'success' => true,
            'schemaReady' => true,
            'visits' => array_filter([visit_billing_fetch_visit($pdo, $visitId)])
        ]);
        return;
    }

    $conditions = [];
    $params = [];
    foreach ([
        ['petId', 'pet_id', 'v.pet_id'],
        ['queueId', 'queue_id', 'v.queue_id'],
        ['bookingId', 'booking_id', 'v.booking_id'],
        ['diagnosisId', 'diagnosis_id', 'v.diagnosis_id'],
    ] as [$camel, $snake, $column]) {
        $value = visit_billing_nullable_int($_GET[$camel] ?? $_GET[$snake] ?? null);
        if ($value !== null) {
            $conditions[] = "{$column} = ?";
            $params[] = $value;
        }
    }

    $whereSql = $conditions ? 'WHERE ' . implode(' AND ', $conditions) : '';
    $stmt = $pdo->prepare("
        SELECT v.visit_id
        FROM visits v
        {$whereSql}
        ORDER BY v.created_at DESC, v.visit_id DESC
        LIMIT 100
    ");
    $stmt->execute($params);
    $visits = [];
    foreach ($stmt->fetchAll(PDO::FETCH_COLUMN) as $id) {
        $visit = visit_billing_fetch_visit($pdo, (int)$id);
        if ($visit) {
            $visits[] = $visit;
        }
    }

    echo json_encode([
        'success' => true,
        'schemaReady' => true,
        'visits' => $visits
    ]);
}

function visit_billing_replace_charges(PDO $pdo, int $visitId): void
{
    visit_billing_require_schema($pdo);
    if ($visitId <= 0) {
        visit_billing_error(400, 'Visit ID is required.');
    }

    $input = visit_billing_input();
    $charges = $input['charges'] ?? [];
    if (!is_array($charges)) {
        visit_billing_error(400, 'charges must be an array.');
    }

    $pdo->beginTransaction();
    try {
        visit_billing_save_charges($pdo, $visitId, $charges, true);
        $pdo->commit();

        echo json_encode([
            'success' => true,
            'message' => 'Visit charges saved.',
            'visit' => visit_billing_fetch_visit($pdo, $visitId)
        ]);
    } catch (Exception $e) {
        visit_billing_error(500, 'Failed to save visit charges: ' . $e->getMessage());
    }
}

function visit_billing_add_payment(PDO $pdo, int $visitId): void
{
    visit_billing_require_schema($pdo);
    if ($visitId <= 0) {
        visit_billing_error(400, 'Visit ID is required.');
    }

    $input = visit_billing_input();
    $amount = (float)($input['amount'] ?? 0);
    if ($amount <= 0) {
        visit_billing_error(400, 'Payment amount must be greater than 0.');
    }

    $paymentMethod = visit_billing_allowed(
        trim((string)($input['payment_method'] ?? $input['paymentMethod'] ?? 'cash')),
        ['cash', 'gcash', 'maya', 'bank_transfer', 'card', 'other'],
        'cash'
    );
    $paymentStatus = visit_billing_allowed(
        trim((string)($input['payment_status'] ?? $input['paymentStatus'] ?? 'verified')),
        ['pending', 'verified', 'failed', 'refunded', 'voided'],
        'verified'
    );

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare("
            INSERT INTO visit_payments (
                visit_id,
                payment_method,
                payment_status,
                amount,
                reference_number,
                proof_url,
                notes,
                paid_at,
                received_by_user_id,
                received_by_name
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $visitId,
            $paymentMethod,
            $paymentStatus,
            $amount,
            visit_billing_nullable_text($input['reference_number'] ?? $input['referenceNumber'] ?? null),
            visit_billing_nullable_text($input['proof_url'] ?? $input['proofUrl'] ?? null),
            visit_billing_nullable_text($input['notes'] ?? null),
            visit_billing_nullable_text($input['paid_at'] ?? $input['paidAt'] ?? null) ?: date('Y-m-d H:i:s'),
            visit_billing_nullable_int($input['received_by_user_id'] ?? $input['receivedByUserId'] ?? null),
            visit_billing_nullable_text($input['received_by_name'] ?? $input['receivedByName'] ?? null)
        ]);
        $paymentId = (int)$pdo->lastInsertId();

        visit_billing_update_status($pdo, $visitId);
        $pdo->commit();

        try {
            notification_send_visit_event($pdo, $visitId, 'payment_received', [
                'payment_id' => $paymentId,
                'amount' => $amount,
                'reference_number' => visit_billing_nullable_text($input['reference_number'] ?? $input['referenceNumber'] ?? null),
            ]);
        } catch (Throwable $notificationError) {
            error_log('Visit payment notification failed: ' . $notificationError->getMessage());
        }

        echo json_encode([
            'success' => true,
            'message' => 'Payment recorded.',
            'visit' => visit_billing_fetch_visit($pdo, $visitId)
        ]);
    } catch (Exception $e) {
        visit_billing_error(500, 'Failed to record payment: ' . $e->getMessage());
    }
}

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
$visitId = isset($_GET['visitId']) ? (int)$_GET['visitId'] : 0;

if ($method === 'GET') {
    visit_billing_list($pdo);
} elseif ($method === 'POST' && $action === 'charges') {
    visit_billing_replace_charges($pdo, $visitId);
} elseif ($method === 'POST' && $action === 'payments') {
    visit_billing_add_payment($pdo, $visitId);
} elseif ($method === 'POST') {
    visit_billing_upsert_visit($pdo);
} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
}
