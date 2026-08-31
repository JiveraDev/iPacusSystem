<?php

/**
 * Short-lived, signed receipts bind a freshly uploaded file to its uploader and
 * intended workflow scope (template plus booking or pet). Durable finalization
 * is represented by the booking/consent database records that reference it.
 */

function ipawcus_upload_receipt_base64url_encode(string $value): string
{
    return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
}

function ipawcus_upload_receipt_base64url_decode(string $value): ?string
{
    if ($value === '' || preg_match('/[^A-Za-z0-9_-]/', $value)) {
        return null;
    }

    $padding = strlen($value) % 4;
    if ($padding > 0) {
        $value .= str_repeat('=', 4 - $padding);
    }

    $decoded = base64_decode(strtr($value, '-_', '+/'), true);

    return is_string($decoded) ? $decoded : null;
}

function ipawcus_upload_receipt_secret(): string
{
    $secret = trim((string)(
        getenv('UPLOAD_RECEIPT_SECRET')
        ?: getenv('OTP_SECRET')
        ?: ''
    ));

    if (strlen($secret) < 24) {
        throw new RuntimeException('Upload receipt signing is not configured.');
    }

    return $secret;
}

function ipawcus_upload_receipt_normalize_path(string $path): ?string
{
    $parsedPath = parse_url(trim($path), PHP_URL_PATH);
    $cleanPath = ltrim(str_replace('\\', '/', is_string($parsedPath) ? $parsedPath : $path), '/');
    $cleanPath = preg_replace('#^(?:api/uploads/media/|public/)#i', '', $cleanPath);

    if (
        !is_string($cleanPath)
        || $cleanPath === ''
        || str_contains($cleanPath, '..')
        || preg_match('/[\x00-\x1F]/', $cleanPath)
        || !preg_match('#^[A-Za-z0-9._/-]+$#', $cleanPath)
    ) {
        return null;
    }

    return $cleanPath;
}

function ipawcus_upload_receipt_normalize_claims(array $claims): array
{
    $context = strtolower(trim((string)($claims['consent_context'] ?? $claims['consentContext'] ?? '')));
    $normalized = [];
    if ($context !== '' && preg_match('/^[a-z0-9-]{1,40}$/', $context)) {
        $normalized['consent_context'] = $context;
    }
    foreach (['consent_file_id', 'booking_id', 'pet_id'] as $key) {
        $camelKey = lcfirst(str_replace(' ', '', ucwords(str_replace('_', ' ', $key))));
        $value = $claims[$key] ?? $claims[$camelKey] ?? null;
        if ($value !== null && $value !== '' && is_numeric($value)) {
            $normalized[$key] = max(0, (int)$value);
        }
    }
    ksort($normalized);
    return $normalized;
}

function ipawcus_upload_receipt_issue(
    string $path,
    int $userId,
    string $uploadType,
    ?int $issuedAt = null,
    array $claims = []
): array
{
    $normalizedPath = ipawcus_upload_receipt_normalize_path($path);
    if ($normalizedPath === null || $userId <= 0 || trim($uploadType) === '') {
        throw new InvalidArgumentException('Upload receipt data is invalid.');
    }

    $issuedAt = $issuedAt ?? time();
    $ttlSeconds = max(300, min(86400, (int)(getenv('UPLOAD_RECEIPT_TTL_SECONDS') ?: 14400)));
    $payload = [
        'v' => 1,
        'path' => $normalizedPath,
        'user_id' => $userId,
        'upload_type' => trim($uploadType),
        'issued_at' => $issuedAt,
        'expires_at' => $issuedAt + $ttlSeconds,
        'nonce' => bin2hex(random_bytes(12)),
        'claims' => ipawcus_upload_receipt_normalize_claims($claims),
    ];
    $encodedPayload = ipawcus_upload_receipt_base64url_encode(json_encode($payload, JSON_UNESCAPED_SLASHES));
    $signature = hash_hmac('sha256', $encodedPayload, ipawcus_upload_receipt_secret(), true);

    return [
        'receipt' => $encodedPayload . '.' . ipawcus_upload_receipt_base64url_encode($signature),
        'expires_at' => $payload['expires_at'],
    ];
}

function ipawcus_upload_receipt_verify(
    string $receipt,
    string $path,
    int $userId,
    string $uploadType,
    ?int $now = null,
    array $expectedClaims = []
): bool {
    $parts = explode('.', trim($receipt));
    if (count($parts) !== 2) {
        return false;
    }

    [$encodedPayload, $encodedSignature] = $parts;
    $providedSignature = ipawcus_upload_receipt_base64url_decode($encodedSignature);
    $payloadJson = ipawcus_upload_receipt_base64url_decode($encodedPayload);
    if ($providedSignature === null || $payloadJson === null) {
        return false;
    }

    try {
        $expectedSignature = hash_hmac('sha256', $encodedPayload, ipawcus_upload_receipt_secret(), true);
    } catch (Throwable $exception) {
        error_log('Upload receipt verification is unavailable: ' . $exception->getMessage());
        return false;
    }

    if (!hash_equals($expectedSignature, $providedSignature)) {
        return false;
    }

    $payload = json_decode($payloadJson, true);
    $normalizedPath = ipawcus_upload_receipt_normalize_path($path);
    $now = $now ?? time();

    $claimsMatch = true;
    $normalizedExpectedClaims = ipawcus_upload_receipt_normalize_claims($expectedClaims);
    $receiptClaims = ipawcus_upload_receipt_normalize_claims(
        is_array($payload['claims'] ?? null) ? $payload['claims'] : []
    );
    foreach ($normalizedExpectedClaims as $key => $value) {
        if (!array_key_exists($key, $receiptClaims) || $receiptClaims[$key] !== $value) {
            $claimsMatch = false;
            break;
        }
    }

    return is_array($payload)
        && (int)($payload['v'] ?? 0) === 1
        && $normalizedPath !== null
        && hash_equals((string)($payload['path'] ?? ''), $normalizedPath)
        && (int)($payload['user_id'] ?? 0) === $userId
        && hash_equals((string)($payload['upload_type'] ?? ''), trim($uploadType))
        && (int)($payload['issued_at'] ?? 0) <= $now + 60
        && (int)($payload['expires_at'] ?? 0) >= $now
        && $claimsMatch;
}
