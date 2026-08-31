<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/workflow_guard_helpers.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'PATCH') {
    ipawcus_guard_error(405, 'Method not allowed.');
}

$petId = $_GET['petId'] ?? null;
if (!$petId) {
    ipawcus_guard_error(400, 'Pet ID is required.');
}

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    ipawcus_guard_error(400, 'Invalid request payload.');
}

$currentUser = ipawcus_guard_current_user($pdo);
$currentRole = ipawcus_guard_role($currentUser);
$currentUserId = ipawcus_guard_user_id($currentUser);
$idColumn = str_starts_with((string)$petId, 'PET-') ? 'pet_sharable_ID' : 'pet_id';
$hasArchiveAction = array_key_exists('isArchived', $input)
    || array_key_exists('is_archived', $input)
    || in_array(strtolower(trim((string)($input['action'] ?? ''))), ['archive', 'restore'], true);

try {
    if ($hasArchiveAction) {
        if (!ipawcus_guard_is_admin_role($currentRole)) {
            ipawcus_guard_error(403, 'Only Admin or Super Admin can archive or restore pets.');
        }

        $action = strtolower(trim((string)($input['action'] ?? '')));
        $isArchived = $action === 'archive'
            || filter_var($input['isArchived'] ?? $input['is_archived'] ?? false, FILTER_VALIDATE_BOOL);
        $reason = trim((string)($input['reason'] ?? ''));
        $stmt = $pdo->prepare("
            UPDATE pets_information
            SET is_archived = ?,
                archived_at = ?,
                archived_by_user_id = ?,
                archive_reason = ?
            WHERE {$idColumn} = ?
        ");
        $stmt->execute([
            $isArchived ? 1 : 0,
            $isArchived ? date('Y-m-d H:i:s') : null,
            $isArchived ? $currentUserId : null,
            $isArchived ? ($reason !== '' ? $reason : 'Archived by clinic staff') : null,
            $petId,
        ]);
        if ($stmt->rowCount() === 0) {
            $check = $pdo->prepare("SELECT pet_id FROM pets_information WHERE {$idColumn} = ? LIMIT 1");
            $check->execute([$petId]);
            if (!$check->fetchColumn()) {
                ipawcus_guard_error(404, 'Pet was not found.');
            }
        }

        echo json_encode([
            'success' => true,
            'isArchived' => $isArchived,
            'message' => $isArchived ? 'Pet archived.' : 'Pet restored.',
        ]);
        exit;
    }

    $newStatus = trim((string)($input['status'] ?? ''));
    if (!in_array($newStatus, ['Healthy', 'Emergency', 'Deceased'], true)) {
        ipawcus_guard_error(422, 'Select a valid pet health status.');
    }
    if (!ipawcus_guard_is_clinic_role($currentRole)) {
        ipawcus_guard_error(403, 'Only clinic personnel can change a pet health status.');
    }

    $stmt = $pdo->prepare("SELECT pet_status FROM pets_information WHERE {$idColumn} = ? LIMIT 1");
    $stmt->execute([$petId]);
    $currentStatus = $stmt->fetchColumn();
    if ($currentStatus === false) {
        ipawcus_guard_error(404, 'Pet was not found.');
    }
    if ((string)$currentStatus === $newStatus) {
        echo json_encode(['success' => true, 'unchanged' => true, 'message' => 'Pet status is already current.']);
        exit;
    }

    $update = $pdo->prepare("UPDATE pets_information SET pet_status = ? WHERE {$idColumn} = ?");
    $update->execute([$newStatus, $petId]);
    echo json_encode(['success' => true, 'unchanged' => false, 'message' => 'Pet status updated.']);
} catch (Throwable $error) {
    http_response_code(500);
    echo json_encode(['message' => 'Pet status could not be updated.']);
}
