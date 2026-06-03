<?php
require_once __DIR__ . '/db.php';

header('Content-Type: application/json');

function petMedicalColumnExists(PDO $pdo, string $tableName, string $columnName): bool
{
    $stmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = ?
          AND column_name = ?
    ");
    $stmt->execute([$tableName, $columnName]);

    return (int)$stmt->fetchColumn() > 0;
}

$petId = $_GET['petId'] ?? null;
if (!$petId) {
    http_response_code(400);
    echo json_encode(['message' => 'Pet ID is required.']);
    exit;
}

// Convert sharable ID to numeric ID if needed
if (strpos($petId, 'PET-') === 0) {
    $stmt = $pdo->prepare("SELECT pet_id FROM pets_information WHERE pet_sharable_ID = ? LIMIT 1");
    $stmt->execute([$petId]);
    $petNumericId = $stmt->fetchColumn();
    if (!$petNumericId) {
        http_response_code(404);
        echo json_encode(['message' => 'Pet not found.']);
        exit;
    }
} else {
    $petNumericId = $petId;
}

$method = $_SERVER['REQUEST_METHOD'];

try {
    if ($method === 'GET') {
        // Fetch vaccinations
        $hasLicense = petMedicalColumnExists($pdo, 'pet_vaccinations', 'vax_veterinarian_license');
        $hasNotes = petMedicalColumnExists($pdo, 'pet_vaccinations', 'vax_notes');
        $hasVetUserId = petMedicalColumnExists($pdo, 'pet_vaccinations', 'vax_veterinarian_user_id');
        $hasSourceDiagnosis = petMedicalColumnExists($pdo, 'pet_vaccinations', 'source_diagnosis_id');

        $vaxStmt = $pdo->prepare("
            SELECT
                vax_id as id,
                vax_name as name,
                vax_date as date,
                vax_next_due as nextDue,
                vax_applicator as applicator,
                " . ($hasLicense ? "vax_veterinarian_license" : "NULL") . " as veterinarianLicense,
                " . ($hasNotes ? "vax_notes" : "NULL") . " as notes,
                " . ($hasVetUserId ? "vax_veterinarian_user_id" : "NULL") . " as veterinarianUserId,
                " . ($hasSourceDiagnosis ? "source_diagnosis_id" : "NULL") . " as sourceDiagnosisId,
                vax_status as status
            FROM pet_vaccinations
            WHERE pet_id = ?
            ORDER BY vax_date DESC, vax_id DESC
        ");
        $vaxStmt->execute([$petNumericId]);
        $vaccinations = $vaxStmt->fetchAll(PDO::FETCH_ASSOC);

        // Fetch allergies
        $allergyStmt = $pdo->prepare("SELECT allergy_id as id, allergen, severity FROM pet_allergies WHERE pet_id = ?");
        $allergyStmt->execute([$petNumericId]);
        $allergies = $allergyStmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode([
            'vaccinations' => $vaccinations,
            'allergies' => $allergies
        ]);

    } elseif ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        $type = $input['type'] ?? null; // 'vaccination' or 'allergy'
        $action = $input['action'] ?? 'add'; // 'add' or 'delete'

        if ($type === 'vaccination') {
            if ($action === 'add') {
                $columns = ['pet_id', 'vax_name', 'vax_date', 'vax_next_due', 'vax_applicator', 'vax_status'];
                $values = [
                    $petNumericId,
                    $input['name'],
                    $input['date'],
                    $input['nextDue'],
                    $input['applicator'] ?? null,
                    $input['status'] ?? 'completed'
                ];

                if (petMedicalColumnExists($pdo, 'pet_vaccinations', 'vax_veterinarian_license')) {
                    $columns[] = 'vax_veterinarian_license';
                    $values[] = $input['veterinarianLicense'] ?? $input['licenseNumber'] ?? null;
                }

                if (petMedicalColumnExists($pdo, 'pet_vaccinations', 'vax_notes')) {
                    $columns[] = 'vax_notes';
                    $values[] = $input['notes'] ?? null;
                }

                $placeholders = implode(', ', array_fill(0, count($columns), '?'));
                $sql = "INSERT INTO pet_vaccinations (" . implode(', ', $columns) . ") VALUES ({$placeholders})";
                $stmt = $pdo->prepare($sql);
                $stmt->execute($values);
                echo json_encode(['success' => true, 'id' => $pdo->lastInsertId()]);
            } elseif ($action === 'delete') {
                $stmt = $pdo->prepare("DELETE FROM pet_vaccinations WHERE vax_id = ? AND pet_id = ?");
                $stmt->execute([$input['id'], $petNumericId]);
                echo json_encode(['success' => true]);
            }
        } elseif ($type === 'allergy') {
            if ($action === 'add') {
                $sql = "INSERT INTO pet_allergies (pet_id, allergen, severity) VALUES (?, ?, ?)";
                $stmt = $pdo->prepare($sql);
                $stmt->execute([
                    $petNumericId,
                    $input['allergen'],
                    $input['severity'] ?? 'Known'
                ]);
                echo json_encode(['success' => true, 'id' => $pdo->lastInsertId()]);
            } elseif ($action === 'delete') {
                $stmt = $pdo->prepare("DELETE FROM pet_allergies WHERE allergy_id = ? AND pet_id = ?");
                $stmt->execute([$input['id'], $petNumericId]);
                echo json_encode(['success' => true]);
            }
        } else {
            http_response_code(400);
            echo json_encode(['message' => 'Invalid record type.']);
        }
    } else {
        http_response_code(405);
        echo json_encode(['message' => 'Method not allowed.']);
    }
} catch (PDOException $e) {
    // If tables don't exist, return empty arrays on GET instead of 500
    if ($method === 'GET' && strpos($e->getMessage(), "doesn't exist") !== false) {
        echo json_encode(['vaccinations' => [], 'allergies' => []]);
    } else {
        http_response_code(500);
        echo json_encode(['message' => 'Database error: ' . $e->getMessage()]);
    }
}
