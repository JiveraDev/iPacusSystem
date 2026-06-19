<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/consent_record_helpers.php';

header('Content-Type: application/json');

function consent_form_records_input(): array
{
    $input = json_decode(file_get_contents('php://input'), true);

    return is_array($input) ? $input : [];
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
    exit;
}

try {
    $input = consent_form_records_input();
    $recordId = consent_record_save($pdo, $input, true);

    echo json_encode([
        'success' => true,
        'message' => 'Consent record saved.',
        'consent_record_id' => $recordId,
    ]);
} catch (RuntimeException $e) {
    http_response_code(409);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage(),
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to save consent record: ' . $e->getMessage(),
    ]);
}
