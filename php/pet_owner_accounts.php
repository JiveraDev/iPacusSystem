<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/account_status_helpers.php';
require_once __DIR__ . '/pet_allergy_helpers.php';
require_once __DIR__ . '/notification_helpers.php';

header('Content-Type: application/json');

function owner_accounts_input(): array
{
    $body = json_decode(file_get_contents('php://input'), true);
    return is_array($body) ? array_merge($_GET, $body) : $_GET;
}

function owner_accounts_json(array $payload, int $statusCode = 200): void
{
    http_response_code($statusCode);
    echo json_encode($payload);
    exit;
}

function owner_accounts_normalize_role($role): string
{
    return strtolower(str_replace([' ', '-'], '_', trim((string)$role)));
}

function owner_accounts_require_super_admin(array $payload): void
{
    $role = owner_accounts_normalize_role($payload['role'] ?? ($_SERVER['HTTP_X_USER_ROLE'] ?? ''));
    if (!in_array($role, ['super_admin', 'superadmin'], true)) {
        owner_accounts_json(['success' => false, 'message' => 'Only Super Admin can manage pet owner accounts.'], 403);
    }
}

function owner_accounts_column_exists(PDO $pdo, string $table, string $column): bool
{
    $stmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = ?
          AND column_name = ?
    ");
    $stmt->execute([$table, $column]);
    return (int)$stmt->fetchColumn() > 0;
}

function owner_accounts_required_status_sql(): string
{
    return 'Run the approved archive-status deployment SQL before archiving accounts.';
}

function owner_accounts_status_supported(PDO $pdo): bool
{
    return owner_accounts_column_exists($pdo, 'users', 'account_status');
}

function owner_accounts_list(PDO $pdo): void
{
    $hasStatus = owner_accounts_status_supported($pdo);
    $hasDeactivatedAt = owner_accounts_column_exists($pdo, 'users', 'deactivated_at');
    $hasReason = owner_accounts_column_exists($pdo, 'users', 'deactivation_reason');
    $statusSelect = $hasStatus ? 'u.account_status' : "'active' AS account_status";
    $deactivatedAtSelect = $hasDeactivatedAt ? 'u.deactivated_at' : 'NULL AS deactivated_at';
    $reasonSelect = $hasReason ? 'u.deactivation_reason' : 'NULL AS deactivation_reason';

    $stmt = $pdo->query("
        SELECT
            u.user_id,
            u.first_Name,
            u.last_Name,
            u.mail_Address,
            u.phoneNumber,
            u.emergencyNumber,
            u.personal_Address,
            u.birthdate,
            u.created_at,
            u.setProfilePic_url,
            {$statusSelect},
            {$deactivatedAtSelect},
            {$reasonSelect},
            COUNT(DISTINCT CASE
                WHEN COALESCE(p.pet_sharable_ID, '') <> 'PET-WALK-IN-SALE' THEN po.pet_id
                ELSE NULL
            END) AS pet_count,
            COUNT(DISTINCT b.booking_id) AS booking_count,
            COUNT(DISTINCT q.queue_id) AS queue_count
        FROM users u
        LEFT JOIN pet_ownership po ON po.user_id = u.user_id
        LEFT JOIN pets_information p ON p.pet_id = po.pet_id
        LEFT JOIN bookings b ON b.user_id = u.user_id
        LEFT JOIN queues q ON q.user_id = u.user_id
        WHERE LOWER(TRIM(u.role)) IN ('pet owner', 'pet_owner')
        GROUP BY
            u.user_id,
            u.first_Name,
            u.last_Name,
            u.mail_Address,
            u.phoneNumber,
            u.emergencyNumber,
            u.personal_Address,
            u.birthdate,
            u.created_at,
            u.setProfilePic_url,
            account_status,
            deactivated_at,
            deactivation_reason
        ORDER BY u.created_at DESC, u.user_id DESC
    ");
    $owners = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $hasOwnershipRelationship = owner_accounts_column_exists($pdo, 'pet_ownership', 'relationship');
    $hasPrimaryOwnership = owner_accounts_column_exists($pdo, 'pet_ownership', 'is_primary');
    $relationshipSelect = $hasOwnershipRelationship
        ? 'po.relationship'
        : "'primary' AS relationship";
    $primarySelect = $hasPrimaryOwnership
        ? 'po.is_primary'
        : '1 AS is_primary';
    $primaryOrder = $hasPrimaryOwnership
        ? 'CASE WHEN po.is_primary = 1 THEN 0 ELSE 1 END,'
        : '';
    $relationshipOrder = $hasOwnershipRelationship
        ? "CASE WHEN po.relationship = 'primary' THEN 0 ELSE 1 END,"
        : '';

    $petsByOwner = [];
    $petStmt = $pdo->query("
        SELECT
            po.user_id,
            po.link_id,
            {$relationshipSelect},
            {$primarySelect},
            linked_owner.first_Name AS linked_owner_first_name,
            linked_owner.last_Name AS linked_owner_last_name,
            linked_owner.mail_Address AS linked_owner_email,
            p.pet_id,
            p.pet_sharable_ID,
            p.pet_name,
            p.pet_species,
            p.pet_breed,
            p.pet_status,
            p.pet_BDAY,
            p.pet_gender,
            p.pet_age,
            p.pet_weight,
            p.pet_microchip,
            p.pet_allergies,
            p.pet_color_marking,
            p.setpetImage_url,
            COALESCE(p.is_archived, 0) AS is_archived,
            p.archived_at,
            p.archive_reason
        FROM pet_ownership po
        JOIN users linked_owner ON linked_owner.user_id = po.user_id
        JOIN pets_information p ON p.pet_id = po.pet_id
        WHERE COALESCE(p.pet_sharable_ID, '') <> 'PET-WALK-IN-SALE'
        ORDER BY
            p.pet_name ASC,
            {$primaryOrder}
            {$relationshipOrder}
            po.link_id ASC
    ");
    $petRows = $petStmt->fetchAll(PDO::FETCH_ASSOC);
    $ownershipsByPet = [];

    foreach ($petRows as $pet) {
        $petId = (int)$pet['pet_id'];
        $relationship = strtolower(trim((string)($pet['relationship'] ?? '')));
        $isPrimary = (int)($pet['is_primary'] ?? 0) === 1 || $relationship === 'primary';
        $linkedOwnerName = trim((string)($pet['linked_owner_first_name'] ?? '') . ' ' . (string)($pet['linked_owner_last_name'] ?? ''));

        if (!isset($ownershipsByPet[$petId])) {
            $ownershipsByPet[$petId] = [];
        }
        $ownershipsByPet[$petId][] = [
            'userId' => (int)$pet['user_id'],
            'name' => $linkedOwnerName !== '' ? $linkedOwnerName : ((string)($pet['linked_owner_email'] ?? '') ?: 'Pet owner'),
            'email' => $pet['linked_owner_email'] ?? '',
            'relationship' => $isPrimary ? 'primary' : 'co_parent',
            'isPrimary' => $isPrimary,
        ];
    }

    foreach ($ownershipsByPet as &$petOwnerships) {
        $primaryAssigned = false;
        foreach ($petOwnerships as &$ownership) {
            if ($ownership['isPrimary'] && !$primaryAssigned) {
                $primaryAssigned = true;
                continue;
            }
            $ownership['isPrimary'] = false;
            $ownership['relationship'] = 'co_parent';
        }
        unset($ownership);

        if (!$primaryAssigned && !empty($petOwnerships)) {
            $petOwnerships[0]['isPrimary'] = true;
            $petOwnerships[0]['relationship'] = 'primary';
        }
    }
    unset($petOwnerships);

    foreach ($petRows as $pet) {
        $ownerId = (int)$pet['user_id'];
        $petId = (int)$pet['pet_id'];
        if (!isset($petsByOwner[$ownerId])) {
            $petsByOwner[$ownerId] = [];
        }
        $petOwnerships = $ownershipsByPet[$petId] ?? [];
        $primaryOwner = null;
        $coParents = [];
        foreach ($petOwnerships as $ownership) {
            if ($ownership['isPrimary'] && $primaryOwner === null) {
                $primaryOwner = $ownership;
            } else {
                $coParents[] = $ownership;
            }
        }
        $currentOwnership = null;
        foreach ($petOwnerships as $ownership) {
            if ((int)$ownership['userId'] === $ownerId) {
                $currentOwnership = $ownership;
                break;
            }
        }
        $petsByOwner[$ownerId][] = [
            'pet_id' => $petId,
            'pet_sharable_ID' => $pet['pet_sharable_ID'],
            'pet_name' => $pet['pet_name'],
            'pet_species' => $pet['pet_species'],
            'pet_breed' => $pet['pet_breed'],
            'pet_status' => $pet['pet_status'],
            'pet_BDAY' => $pet['pet_BDAY'],
            'pet_gender' => $pet['pet_gender'],
            'pet_age' => $pet['pet_age'],
            'pet_weight' => $pet['pet_weight'],
            'pet_microchip' => $pet['pet_microchip'],
            'pet_allergies' => pet_allergy_effective_text(
                $pdo,
                (int)$pet['pet_id'],
                $pet['pet_allergies'] ?? null
            ),
            'pet_color_marking' => $pet['pet_color_marking'],
            'setpetImage_url' => $pet['setpetImage_url'],
            'is_archived' => (int)($pet['is_archived'] ?? 0) === 1,
            'archived_at' => $pet['archived_at'] ?? null,
            'archive_reason' => $pet['archive_reason'] ?? '',
            'ownership_relationship' => $currentOwnership['relationship'] ?? 'co_parent',
            'is_primary_owner' => (bool)($currentOwnership['isPrimary'] ?? false),
            'owners' => $petOwnerships,
            'primary_owner' => $primaryOwner,
            'co_parents' => $coParents,
        ];
    }

    foreach ($owners as &$owner) {
        $owner['user_id'] = (int)$owner['user_id'];
        $owner['pet_count'] = (int)$owner['pet_count'];
        $owner['booking_count'] = (int)$owner['booking_count'];
        $owner['queue_count'] = (int)$owner['queue_count'];
        $owner['pets'] = $petsByOwner[$owner['user_id']] ?? [];
    }

    owner_accounts_json([
        'success' => true,
        'status_supported' => $hasStatus,
        'required_status_sql' => $hasStatus ? null : owner_accounts_required_status_sql(),
        'owners' => $owners,
    ]);
}

function owner_accounts_update_status(PDO $pdo, array $payload): void
{
    if (!owner_accounts_status_supported($pdo)) {
        owner_accounts_json([
            'success' => false,
            'message' => 'Database change required before pet owner archiving can be used.',
            'required_sql' => owner_accounts_required_status_sql(),
        ], 409);
    }

    $userId = (int)($_GET['userId'] ?? $payload['user_id'] ?? 0);
    $status = strtolower(trim((string)($payload['account_status'] ?? $payload['status'] ?? '')));
    $reason = trim((string)($payload['reason'] ?? $payload['deactivation_reason'] ?? ''));

    if ($status === 'deactivated') {
        $status = 'archived';
    }
    if ($userId <= 0 || !in_array($status, ['active', 'archived'], true)) {
        owner_accounts_json(['success' => false, 'message' => 'Valid user_id and account_status are required.'], 422);
    }

    $stmt = $pdo->prepare("SELECT user_id, first_Name, last_Name, mail_Address FROM users WHERE user_id = ? AND LOWER(TRIM(role)) IN ('pet owner', 'pet_owner') LIMIT 1");
    $stmt->execute([$userId]);
    $ownerAccount = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$ownerAccount) {
        owner_accounts_json(['success' => false, 'message' => 'Pet owner account not found.'], 404);
    }

    $sets = ['account_status = ?'];
    $params = [$status];

    if (owner_accounts_column_exists($pdo, 'users', 'deactivated_at')) {
        $sets[] = 'deactivated_at = ?';
        $params[] = $status === 'archived' ? date('Y-m-d H:i:s') : null;
    }

    if (owner_accounts_column_exists($pdo, 'users', 'deactivation_reason')) {
        $sets[] = 'deactivation_reason = ?';
        $params[] = $status === 'archived' ? ($reason ?: 'Archived by Super Admin') : null;
    }

    $params[] = $userId;
    $update = $pdo->prepare('UPDATE users SET ' . implode(', ', $sets) . ' WHERE user_id = ?');
    $update->execute($params);
    try {
        $ownerName = trim((string)(($ownerAccount['first_Name'] ?? '') . ' ' . ($ownerAccount['last_Name'] ?? '')))
            ?: trim((string)($ownerAccount['mail_Address'] ?? 'Pet owner'));
        $statusLabel = $status === 'archived' ? 'archived' : 'restored';
        notification_send_super_admin_governance_event($pdo, [
            'type' => 'pet_owner_account_status_updated',
            'category' => 'account_updates',
            'title' => 'Pet owner account status changed',
            'message' => "{$ownerName} was {$statusLabel}." . ($reason !== '' ? " Reason: {$reason}" : ''),
            'push_message' => "Pet owner {$ownerName} was {$statusLabel}.",
            'redirect_path' => '/dashboard/pet-owner-accounts',
            'dedupe_key' => 'pet-owner-account-status-' . $userId . '-' . $status . '-' . date('YmdHis'),
        ]);
    } catch (Throwable $notificationError) {
        error_log('Pet owner account status notification failed: ' . $notificationError->getMessage());
    }

    owner_accounts_json([
        'success' => true,
        'message' => $status === 'archived'
            ? 'Pet owner marked as archived. Access remains unchanged.'
            : 'Pet owner archive marker removed.',
    ]);
}

function owner_accounts_remove_ownership(PDO $pdo, array $payload): void
{
    $userId = (int)($_GET['userId'] ?? $payload['user_id'] ?? 0);
    $petId = (int)($_GET['petId'] ?? $payload['pet_id'] ?? 0);

    if ($userId <= 0 || $petId <= 0) {
        owner_accounts_json(['success' => false, 'message' => 'Valid user_id and pet_id are required.'], 422);
    }

    $stmt = $pdo->prepare("DELETE FROM pet_ownership WHERE user_id = ? AND pet_id = ?");
    $stmt->execute([$userId, $petId]);
    $ownershipRemoved = $stmt->rowCount() > 0;

    if ($ownershipRemoved) {
        $ownerStmt = $pdo->prepare("
            SELECT COALESCE(
                NULLIF(TRIM(CONCAT(COALESCE(u.first_Name, ''), ' ', COALESCE(u.last_Name, ''))), ''),
                u.mail_Address,
                ''
            ) AS owner_name
            FROM pet_ownership po
            JOIN users u ON u.user_id = po.user_id
            WHERE po.pet_id = ?
            ORDER BY po.link_id DESC
            LIMIT 1
        ");
        $ownerStmt->execute([$petId]);
        $remainingOwnerName = trim((string)$ownerStmt->fetchColumn());

        $updatePet = $pdo->prepare("UPDATE pets_information SET pet_Temp_owner = ? WHERE pet_id = ?");
        $updatePet->execute([$remainingOwnerName !== '' ? $remainingOwnerName : null, $petId]);
    }

    owner_accounts_json([
        'success' => true,
        'message' => $ownershipRemoved ? 'Pet ownership removed.' : 'Ownership link was not found.',
    ]);
}

try {
    $payload = owner_accounts_input();
    owner_accounts_require_super_admin($payload);
    $action = $_GET['action'] ?? $payload['action'] ?? 'list';
    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'GET') {
        owner_accounts_list($pdo);
    }

    if (($method === 'PATCH' || $method === 'POST') && $action === 'status') {
        owner_accounts_update_status($pdo, $payload);
    }

    if ($method === 'DELETE' && $action === 'ownership') {
        owner_accounts_remove_ownership($pdo, $payload);
    }

    owner_accounts_json(['success' => false, 'message' => 'Method not allowed.'], 405);
} catch (Throwable $e) {
    owner_accounts_json(['success' => false, 'message' => 'Pet owner accounts request failed: ' . $e->getMessage()], 500);
}
