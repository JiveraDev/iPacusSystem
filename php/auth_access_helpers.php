<?php

function ipawcus_access_normalize_role(?string $role): string
{
    $normalized = strtolower(str_replace([' ', '-'], '_', trim((string)$role)));

    return match ($normalized) {
        'superadmin' => 'super_admin',
        'petowner' => 'pet_owner',
        'owner' => 'pet_owner',
        'vet' => 'veterinarian',
        default => $normalized,
    };
}

function ipawcus_access_ensure_schema(PDO $pdo): void
{
    static $ensured = false;
    if ($ensured) {
        return;
    }

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS api_access_tokens (
            token_id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            token_hash CHAR(64) NOT NULL UNIQUE,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME NOT NULL,
            last_used_at DATETIME NULL,
            revoked_at DATETIME NULL,
            KEY api_access_tokens_user_idx (user_id),
            KEY api_access_tokens_expires_idx (expires_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");

    $ensured = true;
}

function ipawcus_access_token_hash(string $token): string
{
    return hash('sha256', $token);
}

function ipawcus_create_access_token(PDO $pdo, int $userId, int $ttlDays = 30): array
{
    ipawcus_access_ensure_schema($pdo);

    $token = bin2hex(random_bytes(32));
    $expiresAt = (new DateTimeImmutable('now'))->modify('+' . max(1, $ttlDays) . ' days');

    $cleanup = $pdo->prepare("
        UPDATE api_access_tokens
        SET revoked_at = NOW()
        WHERE user_id = ?
          AND expires_at < NOW()
          AND revoked_at IS NULL
    ");
    $cleanup->execute([$userId]);

    $stmt = $pdo->prepare("
        INSERT INTO api_access_tokens (user_id, token_hash, expires_at)
        VALUES (?, ?, ?)
    ");
    $stmt->execute([$userId, ipawcus_access_token_hash($token), $expiresAt->format('Y-m-d H:i:s')]);

    return [
        'token' => $token,
        'expires_at' => $expiresAt->format(DateTimeInterface::ATOM),
    ];
}

function ipawcus_read_authorization_header(): string
{
    $header = trim((string)($_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? ''));

    if ($header !== '') {
        return $header;
    }

    if (function_exists('apache_request_headers')) {
        $headers = apache_request_headers();
        foreach ($headers as $name => $value) {
            if (strtolower((string)$name) === 'authorization') {
                return trim((string)$value);
            }
        }
    }

    return '';
}

function ipawcus_request_access_token(): string
{
    $authorization = ipawcus_read_authorization_header();
    if (preg_match('/^Bearer\s+(.+)$/i', $authorization, $matches)) {
        return trim($matches[1]);
    }

    $headerToken = trim((string)($_SERVER['HTTP_X_ACCESS_TOKEN'] ?? ''));
    if ($headerToken !== '') {
        return $headerToken;
    }

    $queryToken = trim((string)($_GET['access_token'] ?? ''));
    if ($queryToken !== '') {
        return $queryToken;
    }

    return trim((string)($_COOKIE['ipawcus_api_token'] ?? ''));
}

function ipawcus_fetch_user_by_access_token(PDO $pdo, string $token): ?array
{
    if ($token === '') {
        return null;
    }

    ipawcus_access_ensure_schema($pdo);

    $stmt = $pdo->prepare("
        SELECT
            u.user_id,
            u.role,
            u.first_Name,
            u.last_Name,
            u.mail_Address,
            t.token_id
        FROM api_access_tokens t
        JOIN users u ON u.user_id = t.user_id
        WHERE t.token_hash = ?
          AND t.revoked_at IS NULL
          AND t.expires_at > NOW()
        LIMIT 1
    ");
    $stmt->execute([ipawcus_access_token_hash($token)]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        return null;
    }

    $update = $pdo->prepare("UPDATE api_access_tokens SET last_used_at = NOW() WHERE token_id = ?");
    $update->execute([(int)$user['token_id']]);
    unset($user['token_id']);

    $user['normalized_role'] = ipawcus_access_normalize_role($user['role'] ?? '');

    return $user;
}
