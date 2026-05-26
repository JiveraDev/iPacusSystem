<?php
require_once __DIR__ . '/db.php';

header('Content-Type: application/json');

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
        $vaxStmt = $pdo->prepare("SELECT vax_id as id, vax_name as name, vax_date as date, vax_next_due as nextDue, vax_applicator as applicator, vax_status as status FROM pet_vaccinations WHERE pet_id = ? ORDER BY vax_date DESC");
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
                $sql = "INSERT INTO pet_vaccinations (pet_id, vax_name, vax_date, vax_next_due, vax_applicator, vax_status) VALUES (?, ?, ?, ?, ?, ?)";
                $stmt = $pdo->prepare($sql);
                $stmt->execute([
                    $petNumericId,
                    $input['name'],
                    $input['date'],
                    $input['nextDue'],
                    $input['applicator'] ?? null,
                    $input['status'] ?? 'completed'
                ]);
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
