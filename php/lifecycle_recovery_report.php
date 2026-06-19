<?php
require_once __DIR__ . '/db.php';

header('Content-Type: application/json');

function lifecycle_report_table_exists(PDO $pdo, string $tableName): bool
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

function lifecycle_report_schema_ready(PDO $pdo): bool
{
    foreach (['vet_diagnoses', 'queues', 'bookings', 'visits', 'visit_charges'] as $tableName) {
        if (!lifecycle_report_table_exists($pdo, $tableName)) {
            return false;
        }
    }

    return true;
}

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
        exit;
    }

    if (!lifecycle_report_schema_ready($pdo)) {
        echo json_encode([
            'success' => true,
            'schemaReady' => false,
            'message' => 'Diagnosis and visit billing schema is not fully available.',
            'queueIssues' => [],
            'bookingIssues' => [],
        ]);
        exit;
    }

    $queueStmt = $pdo->query("
        SELECT
            q.queue_id,
            q.queue_number,
            q.status AS queue_status,
            q.pet_id,
            p.pet_name,
            vd.diagnosis_id,
            v.visit_id,
            COALESCE(charges.charge_count, 0) AS charge_count,
            COALESCE(charges.total_charges, 0) AS total_charges
        FROM queues q
        JOIN vet_diagnoses vd ON vd.queue_id = q.queue_id
        LEFT JOIN visits v ON v.visit_id = (
            SELECT v2.visit_id
            FROM visits v2
            WHERE v2.diagnosis_id = vd.diagnosis_id
               OR v2.queue_id = q.queue_id
            ORDER BY v2.visit_id DESC
            LIMIT 1
        )
        LEFT JOIN (
            SELECT visit_id, COUNT(*) AS charge_count, SUM(subtotal) AS total_charges
            FROM visit_charges
            GROUP BY visit_id
        ) charges ON charges.visit_id = v.visit_id
        LEFT JOIN pets_information p ON p.pet_id = q.pet_id
        WHERE q.status = 'completed'
          AND (
              v.visit_id IS NULL
              OR COALESCE(charges.charge_count, 0) = 0
          )
        ORDER BY q.queue_id DESC
        LIMIT 200
    ");

    $bookingStmt = $pdo->query("
        SELECT
            b.booking_id,
            b.booking_number,
            b.status AS booking_status,
            b.pet_id,
            COALESCE(p.pet_name, b.unregistered_pet_name, 'Pet') AS pet_name,
            vd.diagnosis_id,
            v.visit_id,
            COALESCE(charges.charge_count, 0) AS charge_count,
            COALESCE(charges.total_charges, 0) AS total_charges
        FROM bookings b
        JOIN vet_diagnoses vd ON vd.booking_id = b.booking_id
        LEFT JOIN visits v ON v.visit_id = (
            SELECT v2.visit_id
            FROM visits v2
            WHERE v2.diagnosis_id = vd.diagnosis_id
               OR v2.booking_id = b.booking_id
            ORDER BY v2.visit_id DESC
            LIMIT 1
        )
        LEFT JOIN (
            SELECT visit_id, COUNT(*) AS charge_count, SUM(subtotal) AS total_charges
            FROM visit_charges
            GROUP BY visit_id
        ) charges ON charges.visit_id = v.visit_id
        LEFT JOIN pets_information p ON p.pet_id = b.pet_id
        WHERE b.status = 'completed'
          AND (
              v.visit_id IS NULL
              OR COALESCE(charges.charge_count, 0) = 0
          )
        ORDER BY b.booking_id DESC
        LIMIT 200
    ");

    $queueIssues = $queueStmt->fetchAll(PDO::FETCH_ASSOC);
    $bookingIssues = $bookingStmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'schemaReady' => true,
        'queueIssues' => $queueIssues,
        'bookingIssues' => $bookingIssues,
        'summary' => [
            'queueIssueCount' => count($queueIssues),
            'bookingIssueCount' => count($bookingIssues),
        ],
    ]);
} catch (Throwable $error) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to build lifecycle recovery report: ' . $error->getMessage(),
    ]);
}
