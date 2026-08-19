<?php

function accountColumnExists(PDO $pdo, string $table, string $column): bool
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

function ensureAdminAccountStatusColumn(PDO $pdo): bool
{
    return accountColumnExists($pdo, 'admin_profiles', 'is_active');
}

function accountRevokeAccessTokens(PDO $pdo, int $userId): void
{
    if (
        $userId <= 0
        || !accountColumnExists($pdo, 'api_access_tokens', 'user_id')
        || !accountColumnExists($pdo, 'api_access_tokens', 'revoked_at')
    ) {
        return;
    }

    $stmt = $pdo->prepare('UPDATE api_access_tokens SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL');
    $stmt->execute([$userId]);
}
