<?php

require_once __DIR__ . '/notification_helpers.php';

function coparent_column_exists(PDO $pdo, string $table, string $column): bool
{
    if (!preg_match('/^[A-Za-z0-9_]+$/', $table) || !preg_match('/^[A-Za-z0-9_]+$/', $column)) {
        return false;
    }

    $stmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?
          AND COLUMN_NAME = ?
    ");
    $stmt->execute([$table, $column]);

    return (int)$stmt->fetchColumn() > 0;
}

function coparent_ensure_ownership_metadata(PDO $pdo): array
{
    $hasRelationship = coparent_column_exists($pdo, 'pet_ownership', 'relationship');
    $hasPrimary = coparent_column_exists($pdo, 'pet_ownership', 'is_primary');

    coparent_ensure_ownership_indexes($pdo);

    return [
        'relationship' => $hasRelationship,
        'is_primary' => $hasPrimary,
    ];
}

function coparent_table_exists(PDO $pdo, string $table): bool
{
    if (!preg_match('/^[A-Za-z0-9_]+$/', $table)) {
        return false;
    }

    $stmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?
    ");
    $stmt->execute([$table]);

    return (int)$stmt->fetchColumn() > 0;
}

function coparent_index_exists(PDO $pdo, string $table, string $indexName): bool
{
    $stmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?
          AND INDEX_NAME = ?
    ");
    $stmt->execute([$table, $indexName]);

    return (int)$stmt->fetchColumn() > 0;
}

function coparent_single_pet_unique_indexes(PDO $pdo): array
{
    $stmt = $pdo->prepare("
        SELECT INDEX_NAME
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'pet_ownership'
          AND NON_UNIQUE = 0
          AND INDEX_NAME <> 'PRIMARY'
        GROUP BY INDEX_NAME
        HAVING COUNT(*) = 1
           AND MAX(COLUMN_NAME = 'pet_id') = 1
    ");
    $stmt->execute();

    return array_values(array_filter(array_map('strval', $stmt->fetchAll(PDO::FETCH_COLUMN))));
}

function coparent_ensure_ownership_indexes(PDO $pdo): void
{
    if (!coparent_index_exists($pdo, 'pet_ownership', 'pet_ownership_pet_idx')) {
        error_log('pet_ownership_pet_idx is missing; co-parent lookup will rely on application-level queries until deployment SQL is applied.');
    }

    $blockingIndexes = coparent_single_pet_unique_indexes($pdo);
    if ($blockingIndexes) {
        throw new RuntimeException(
            'pet_ownership still has a unique pet_id index that blocks co-parenting. Run the approved co-parent deployment SQL; runtime schema changes are disabled.'
        );
    }

    if (!coparent_index_exists($pdo, 'pet_ownership', 'pet_ownership_user_pet_unique')) {
        error_log('pet_ownership_user_pet_unique is missing; duplicate co-parent links are guarded in PHP until deployment SQL is applied.');
    }
}

function coparent_ensure_schema(PDO $pdo): void
{
    coparent_ensure_ownership_metadata($pdo);

    if (!coparent_table_exists($pdo, 'pet_coparent_requests')) {
        throw new RuntimeException('pet_coparent_requests table is missing. Run the approved co-parent deployment SQL before using co-parent requests.');
    }

    $requiredColumns = [
        'request_id',
        'pet_id',
        'requester_user_id',
        'primary_owner_user_id',
        'status',
        'request_token',
        'requester_message',
        'decision_note',
        'created_at',
        'updated_at',
        'decided_at',
    ];

    $missingColumns = [];
    foreach ($requiredColumns as $columnName) {
        if (!coparent_column_exists($pdo, 'pet_coparent_requests', $columnName)) {
            $missingColumns[] = $columnName;
        }
    }

    if (!empty($missingColumns)) {
        throw new RuntimeException(
            'pet_coparent_requests is missing required columns: ' . implode(', ', $missingColumns) . '. Run the approved co-parent deployment SQL.'
        );
    }
}

function coparent_user_display_name(array $row, string $prefix = ''): string
{
    $first = trim((string)($row[$prefix . 'first_Name'] ?? ''));
    $last = trim((string)($row[$prefix . 'last_Name'] ?? ''));
    $name = trim($first . ' ' . $last);
    $email = trim((string)($row[$prefix . 'mail_Address'] ?? ''));

    return $name !== '' ? $name : ($email !== '' ? $email : 'Pet owner');
}

function coparent_pet_display_name(array $row): string
{
    return trim((string)($row['pet_name'] ?? '')) ?: 'your pet';
}

function coparent_app_url(string $path): string
{
    if (preg_match('/^https?:\/\//i', $path)) {
        return $path;
    }

    $base = trim((string)(getenv('APP_URL') ?: getenv('FRONTEND_URL') ?: getenv('VITE_APP_URL') ?: ''));

    if ($base === '' && !empty($_SERVER['HTTP_HOST'])) {
        $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
            || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
        $base = ($isHttps ? 'https://' : 'http://') . $_SERVER['HTTP_HOST'];
    }

    $base = rtrim($base ?: '', '/');
    $normalizedPath = '/' . ltrim($path, '/');

    return $base !== '' ? $base . $normalizedPath : $normalizedPath;
}

function coparent_find_primary_owner(PDO $pdo, int $petId): ?array
{
    $columns = [
        'relationship' => coparent_column_exists($pdo, 'pet_ownership', 'relationship'),
        'is_primary' => coparent_column_exists($pdo, 'pet_ownership', 'is_primary'),
    ];
    $relationshipSelect = $columns['relationship'] ? 'po.relationship' : "'primary' AS relationship";
    $primarySelect = $columns['is_primary'] ? 'po.is_primary' : 'CASE WHEN po.link_id IS NOT NULL THEN 1 ELSE 0 END AS is_primary';
    $primaryOrder = $columns['is_primary'] ? 'CASE WHEN po.is_primary = 1 THEN 0 ELSE 1 END,' : '';
    $relationshipOrder = $columns['relationship'] ? "CASE WHEN po.relationship = 'primary' THEN 0 ELSE 1 END," : '';

    $stmt = $pdo->prepare("
        SELECT po.link_id, po.user_id, po.pet_id, {$relationshipSelect}, {$primarySelect}, u.first_Name, u.last_Name, u.mail_Address
        FROM pet_ownership po
        JOIN users u ON u.user_id = po.user_id
        WHERE po.pet_id = ?
        ORDER BY
            {$primaryOrder}
            {$relationshipOrder}
            po.link_id ASC
        LIMIT 1
    ");
    $stmt->execute([$petId]);
    $owner = $stmt->fetch(PDO::FETCH_ASSOC);

    return $owner ?: null;
}

function coparent_request_detail(PDO $pdo, int $requestId): ?array
{
    $stmt = $pdo->prepare("
        SELECT
            r.*,
            p.pet_name,
            p.pet_sharable_ID,
            p.pet_species,
            p.pet_breed,
            requester.first_Name AS requester_first_Name,
            requester.last_Name AS requester_last_Name,
            requester.mail_Address AS requester_mail_Address,
            owner.first_Name AS owner_first_Name,
            owner.last_Name AS owner_last_Name,
            owner.mail_Address AS owner_mail_Address
        FROM pet_coparent_requests r
        JOIN pets_information p ON p.pet_id = r.pet_id
        JOIN users requester ON requester.user_id = r.requester_user_id
        JOIN users owner ON owner.user_id = r.primary_owner_user_id
        WHERE r.request_id = ?
        LIMIT 1
    ");
    $stmt->execute([$requestId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row) {
        return null;
    }

    return [
        'requestId' => (int)$row['request_id'],
        'petId' => (int)$row['pet_id'],
        'petName' => coparent_pet_display_name($row),
        'petCode' => $row['pet_sharable_ID'] ?? '',
        'petSpecies' => $row['pet_species'] ?? '',
        'petBreed' => $row['pet_breed'] ?? '',
        'requesterUserId' => (int)$row['requester_user_id'],
        'requesterName' => coparent_user_display_name($row, 'requester_'),
        'requesterEmail' => $row['requester_mail_Address'] ?? '',
        'primaryOwnerUserId' => (int)$row['primary_owner_user_id'],
        'primaryOwnerName' => coparent_user_display_name($row, 'owner_'),
        'primaryOwnerEmail' => $row['owner_mail_Address'] ?? '',
        'status' => $row['status'],
        'requesterMessage' => $row['requester_message'] ?? '',
        'decisionNote' => $row['decision_note'] ?? '',
        'createdAt' => $row['created_at'],
        'updatedAt' => $row['updated_at'],
        'decidedAt' => $row['decided_at'],
    ];
}

function coparent_find_pending_request(PDO $pdo, int $petId, int $requesterUserId): ?array
{
    $stmt = $pdo->prepare("
        SELECT request_id
        FROM pet_coparent_requests
        WHERE pet_id = ?
          AND requester_user_id = ?
          AND status = 'pending'
        ORDER BY request_id DESC
        LIMIT 1
    ");
    $stmt->execute([$petId, $requesterUserId]);
    $requestId = (int)($stmt->fetchColumn() ?: 0);

    return $requestId > 0 ? coparent_request_detail($pdo, $requestId) : null;
}

function coparent_create_or_refresh_request(PDO $pdo, int $petId, int $requesterUserId, int $primaryOwnerUserId, string $message = ''): array
{
    $existing = coparent_find_pending_request($pdo, $petId, $requesterUserId);
    if ($existing) {
        $stmt = $pdo->prepare("
            UPDATE pet_coparent_requests
            SET primary_owner_user_id = ?,
                requester_message = ?,
                updated_at = NOW()
            WHERE request_id = ?
        ");
        $stmt->execute([$primaryOwnerUserId, trim($message), $existing['requestId']]);

        return coparent_request_detail($pdo, $existing['requestId']);
    }

    $token = bin2hex(random_bytes(24));
    $stmt = $pdo->prepare("
        INSERT INTO pet_coparent_requests
            (pet_id, requester_user_id, primary_owner_user_id, request_token, requester_message)
        VALUES (?, ?, ?, ?, ?)
    ");
    $stmt->execute([$petId, $requesterUserId, $primaryOwnerUserId, $token, trim($message)]);

    return coparent_request_detail($pdo, (int)$pdo->lastInsertId());
}

function coparent_insert_ownership(PDO $pdo, int $petId, int $requesterUserId): bool
{
    $alreadyLinked = $pdo->prepare("SELECT link_id FROM pet_ownership WHERE user_id = ? AND pet_id = ? LIMIT 1");
    $alreadyLinked->execute([$requesterUserId, $petId]);
    if ($alreadyLinked->fetch()) {
        return false;
    }

    $columns = [
        'relationship' => coparent_column_exists($pdo, 'pet_ownership', 'relationship'),
        'is_primary' => coparent_column_exists($pdo, 'pet_ownership', 'is_primary'),
    ];
    $insertColumns = ['user_id', 'pet_id'];
    $placeholders = ['?', '?'];
    $params = [$requesterUserId, $petId];

    if ($columns['relationship']) {
        $insertColumns[] = 'relationship';
        $placeholders[] = '?';
        $params[] = 'co_parent';
    }

    if ($columns['is_primary']) {
        $insertColumns[] = 'is_primary';
        $placeholders[] = '?';
        $params[] = 0;
    }

    $stmt = $pdo->prepare("INSERT INTO pet_ownership (" . implode(', ', $insertColumns) . ") VALUES (" . implode(', ', $placeholders) . ")");
    $stmt->execute($params);

    return true;
}

function coparent_notify_request_created(PDO $pdo, array $request): void
{
    $requestId = (int)$request['requestId'];
    $petName = $request['petName'];
    $requesterName = $request['requesterName'];
    $ownerUserId = (int)$request['primaryOwnerUserId'];
    $redirectPath = "/dashboard/my-pets?coparentRequest={$requestId}";
    $reviewUrl = coparent_app_url($redirectPath);
    $title = 'Co-parent request';
    $intro = "{$requesterName} is asking to be added as a co-parent for {$petName}. Review the request before granting access.";
    $rows = [
        'Pet' => $petName,
        'Requester' => $requesterName,
        'Requester Email' => $request['requesterEmail'] ?? '',
    ];
    $summary = "Pet: {$petName} | Requester: {$requesterName}";
    $emailHtml = notification_email_template($title, $intro, $rows, [
        'label' => 'Review co-parent request',
        'url' => $reviewUrl,
    ], $summary);
    $emailText = trim($intro . "\n\nPet: {$petName}\nRequester: {$requesterName}\nReview: {$reviewUrl}");

    notification_create_event($pdo, [
        'user_id' => $ownerUserId,
        'type' => 'coparent_request_pending',
        'category' => 'ownership_updates',
        'title' => $title,
        'message' => "{$requesterName} requested co-parent access to {$petName}.",
        'push_message' => "{$requesterName} requested co-parent access to {$petName}.",
        'redirect_path' => $redirectPath,
        'dedupe_key' => "coparent-request-pending-{$requestId}",
        'email_subject' => "Co-parent request for {$petName}",
        'email_html' => $emailHtml,
        'email_text' => $emailText,
        'force_in_app' => true,
        'force_email' => true,
    ]);
}

function coparent_notify_requester_result(PDO $pdo, array $request, string $status): void
{
    $petName = $request['petName'];
    $ownerName = $request['primaryOwnerName'];
    $requesterUserId = (int)$request['requesterUserId'];
    $approved = $status === 'approved';
    $title = $approved ? 'Co-parent request approved' : 'Co-parent request declined';
    $message = $approved
        ? "{$ownerName} approved your co-parent access to {$petName}."
        : "{$ownerName} declined your co-parent request for {$petName}.";

    notification_create_event($pdo, [
        'user_id' => $requesterUserId,
        'type' => $approved ? 'coparent_request_approved' : 'coparent_request_declined',
        'category' => 'ownership_updates',
        'title' => $title,
        'message' => $message,
        'push_message' => $message,
        'redirect_path' => $approved ? '/dashboard/my-pets' : '/dashboard/my-pets/add',
        'dedupe_key' => "coparent-request-{$status}-{$request['requestId']}",
        'force_in_app' => true,
    ]);
}

function coparent_notify_requester_pending(PDO $pdo, array $request): void
{
    $petName = $request['petName'];
    $ownerName = $request['primaryOwnerName'];

    notification_create_event($pdo, [
        'user_id' => (int)$request['requesterUserId'],
        'type' => 'coparent_request_submitted',
        'category' => 'ownership_updates',
        'title' => 'Co-parent request submitted',
        'message' => "{$petName} already has a primary owner. {$ownerName} was asked to approve your co-parent request.",
        'push_message' => "Your co-parent request for {$petName} was sent to {$ownerName}.",
        'redirect_path' => '/dashboard/my-pets/add',
        'dedupe_key' => "coparent-request-submitted-{$request['requestId']}",
        'force_in_app' => true,
    ]);
}
