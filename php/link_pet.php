<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/coparent_request_helpers.php';

$input = json_decode(file_get_contents('php://input'), true);

$userId = $input['userId'] ?? null;
$sharableId = $input['sharableId'] ?? null;
$currentApiUserId = (int)($_SERVER['IPAWCUS_USER_ID'] ?? 0);
$currentApiRole = strtolower(trim((string)($_SERVER['IPAWCUS_USER_ROLE'] ?? '')));

if ($currentApiUserId > 0 && (int)$userId !== $currentApiUserId && !in_array($currentApiRole, ['admin', 'super_admin'], true)) {
    http_response_code(403);
    echo json_encode(['message' => 'You can only link pets to your own account.']);
    exit;
}

if (!$userId || !$sharableId) {
    http_response_code(400);
    echo json_encode(['message' => 'User ID and Pet Sharable ID are required.']);
    exit;
}

try {
    coparent_ensure_schema($pdo);
    $pdo->beginTransaction();

    // 1. Find pet by sharableId
    $stmt = $pdo->prepare("SELECT pet_id, pet_name FROM pets_information WHERE pet_sharable_ID = ? LIMIT 1");
    $stmt->execute([$sharableId]);
    $pet = $stmt->fetch();

    if (!$pet) {
        $pdo->rollBack();
        http_response_code(404);
        echo json_encode(['message' => 'Pet not found with the provided ID.']);
        exit;
    }

    $petId = $pet['pet_id'];

    // 2. Check if already linked
    $stmt = $pdo->prepare("SELECT link_id FROM pet_ownership WHERE user_id = ? AND pet_id = ? LIMIT 1");
    $stmt->execute([$userId, $petId]);
    if ($stmt->fetch()) {
        $pdo->rollBack();
        http_response_code(409);
        echo json_encode(['message' => 'This pet is already linked to your account.']);
        exit;
    }

    $ownershipColumns = coparent_ensure_ownership_metadata($pdo);
    $ownerCountStmt = $pdo->prepare("SELECT COUNT(*) FROM pet_ownership WHERE pet_id = ?");
    $ownerCountStmt->execute([$petId]);
    $hasExistingOwner = (int)$ownerCountStmt->fetchColumn() > 0;

    if ($hasExistingOwner) {
        $primaryOwner = coparent_find_primary_owner($pdo, (int)$petId);

        if (!$primaryOwner) {
            $pdo->rollBack();
            http_response_code(409);
            echo json_encode(['message' => 'This pet already has an owner, but the primary owner could not be found.']);
            exit;
        }

        if ((int)$primaryOwner['user_id'] === (int)$userId) {
            $pdo->rollBack();
            http_response_code(409);
            echo json_encode(['message' => 'This pet is already linked to your account.']);
            exit;
        }

        $request = coparent_create_or_refresh_request(
            $pdo,
            (int)$petId,
            (int)$userId,
            (int)$primaryOwner['user_id'],
            trim((string)($input['message'] ?? ''))
        );

        $pdo->commit();

        coparent_notify_request_created($pdo, $request);
        coparent_notify_requester_pending($pdo, $request);

        http_response_code(202);
        echo json_encode([
            'message' => 'This pet already has a primary owner. A co-parent request was sent for approval.',
            'requiresApproval' => true,
            'request' => $request,
        ]);
        exit;
    }

    $relationship = $hasExistingOwner ? 'co_parent' : 'primary';
    $isPrimary = $hasExistingOwner ? 0 : 1;

    // 3. Link pet. Only the first claimant is linked immediately.
    $columns = ['user_id', 'pet_id'];
    $placeholders = ['?', '?'];
    $params = [$userId, $petId];

    if ($ownershipColumns['relationship']) {
        $columns[] = 'relationship';
        $placeholders[] = '?';
        $params[] = $relationship;
    }

    if ($ownershipColumns['is_primary']) {
        $columns[] = 'is_primary';
        $placeholders[] = '?';
        $params[] = $isPrimary;
    }

    $stmt = $pdo->prepare("INSERT INTO pet_ownership (" . implode(', ', $columns) . ") VALUES (" . implode(', ', $placeholders) . ")");
    $stmt->execute($params);

    $stmtUser = $pdo->prepare("SELECT first_Name, last_Name FROM users WHERE user_id = ? LIMIT 1");
    $stmtUser->execute([$userId]);
    $user = $stmtUser->fetch();
    $fullName = $user ? trim($user['first_Name'] . ' ' . $user['last_Name']) : null;

    if (!$hasExistingOwner && $fullName) {
        $stmtUpdatePet = $pdo->prepare("UPDATE pets_information SET pet_Temp_owner = ? WHERE pet_id = ?");
        $stmtUpdatePet->execute([$fullName, $petId]);
    }

    $pdo->commit();

    echo json_encode([
        'message' => $hasExistingOwner ? 'Pet linked as co-parent.' : 'Pet linked successfully.',
        'ownerName' => $fullName ?? null,
        'relationship' => $relationship,
        'isCoParent' => $hasExistingOwner
    ]);

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['message' => 'Failed to link pet: ' . $e->getMessage()]);
}
