<?php

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/auth_access_helpers.php';

const GOOGLE_AUTH_PROVIDER = 'google';
const GOOGLE_AUTH_ONBOARDING_TTL_MINUTES = 15;

function googleAuthJsonResponse(int $statusCode, array $payload): void
{
    http_response_code($statusCode);
    echo json_encode($payload);
    exit;
}

function googleAuthRequirePost(): void
{
    if (strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? '')) !== 'POST') {
        header('Allow: POST');
        googleAuthJsonResponse(405, [
            'message' => 'This Google authentication endpoint only accepts POST requests.',
            'code' => 'METHOD_NOT_ALLOWED',
        ]);
    }
}

function googleAuthNormalizeOrigin(string $value): string
{
    $parts = parse_url(trim($value));
    if (!is_array($parts) || empty($parts['scheme']) || empty($parts['host'])) {
        return '';
    }

    $scheme = strtolower((string)$parts['scheme']);
    $host = strtolower((string)$parts['host']);
    $port = isset($parts['port']) ? ':' . (int)$parts['port'] : '';

    return $scheme . '://' . $host . $port;
}

function googleAuthRequestOrigin(): string
{
    $origin = trim((string)($_SERVER['HTTP_ORIGIN'] ?? ''));
    if ($origin !== '') {
        return googleAuthNormalizeOrigin($origin);
    }

    return googleAuthNormalizeOrigin((string)($_SERVER['HTTP_REFERER'] ?? ''));
}

function googleAuthServerOrigin(): string
{
    $forwardedProto = trim(explode(',', (string)($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? ''))[0] ?? '');
    $scheme = strtolower($forwardedProto);
    if (!in_array($scheme, ['http', 'https'], true)) {
        $scheme = (!empty($_SERVER['HTTPS']) && strtolower((string)$_SERVER['HTTPS']) !== 'off') ? 'https' : 'http';
    }

    $host = trim((string)($_SERVER['HTTP_HOST'] ?? ''));
    return $host === '' ? '' : googleAuthNormalizeOrigin($scheme . '://' . $host);
}

function googleAuthRequireTrustedOrigin(): void
{
    $requestOrigin = googleAuthRequestOrigin();
    $allowedOrigins = [];
    $configuredOrigins = preg_split('/\s*,\s*/', (string)(getenv('FRONTEND_ORIGIN') ?: ''), -1, PREG_SPLIT_NO_EMPTY);

    foreach ($configuredOrigins ?: [] as $configuredOrigin) {
        $normalized = googleAuthNormalizeOrigin($configuredOrigin);
        if ($normalized !== '') {
            $allowedOrigins[] = $normalized;
        }
    }

    $serverOrigin = googleAuthServerOrigin();
    if ($serverOrigin !== '') {
        $allowedOrigins[] = $serverOrigin;
    }

    $allowedOrigins = array_values(array_unique($allowedOrigins));
    if ($requestOrigin === '' || !in_array($requestOrigin, $allowedOrigins, true)) {
        googleAuthJsonResponse(403, [
            'message' => 'Google sign-in could not verify the requesting website.',
            'code' => 'GOOGLE_ORIGIN_REJECTED',
        ]);
    }
}

function googleAuthReadJsonInput(): array
{
    $input = json_decode((string)file_get_contents('php://input'), true);
    if (!is_array($input)) {
        googleAuthJsonResponse(400, [
            'message' => 'A valid JSON request is required.',
            'code' => 'INVALID_JSON',
        ]);
    }

    return $input;
}

function googleAuthRequireLibrary(): void
{
    $autoloadPath = dirname(__DIR__) . '/vendor/autoload.php';
    if (!is_file($autoloadPath)) {
        throw new RuntimeException('Google authentication dependencies are not installed.');
    }

    require_once $autoloadPath;
    if (!class_exists('Google\\Client')) {
        throw new RuntimeException('The Google authentication verifier is unavailable.');
    }
}

function googleAuthVerifyCredential(string $credential): array
{
    $clientId = trim((string)(getenv('GOOGLE_CLIENT_ID') ?: ''));
    if ($clientId === '') {
        throw new RuntimeException('Google authentication is not configured on the server.');
    }

    if ($credential === '') {
        googleAuthJsonResponse(400, [
            'message' => 'Google did not return a sign-in credential. Please try again.',
            'code' => 'GOOGLE_CREDENTIAL_MISSING',
        ]);
    }

    googleAuthRequireLibrary();
    $client = new Google\Client(['client_id' => $clientId]);
    $payload = $client->verifyIdToken($credential);

    if (!is_array($payload)) {
        googleAuthJsonResponse(401, [
            'message' => 'Google could not verify this sign-in. Please try again.',
            'code' => 'GOOGLE_CREDENTIAL_INVALID',
        ]);
    }

    $subject = trim((string)($payload['sub'] ?? ''));
    $email = strtolower(trim((string)($payload['email'] ?? '')));
    $emailVerified = filter_var($payload['email_verified'] ?? false, FILTER_VALIDATE_BOOLEAN);

    if ($subject === '' || $email === '' || !$emailVerified || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        googleAuthJsonResponse(401, [
            'message' => 'Google did not provide a verified email address for this account.',
            'code' => 'GOOGLE_EMAIL_UNVERIFIED',
        ]);
    }

    return [
        'subject' => $subject,
        'email' => $email,
        'firstName' => trim((string)($payload['given_name'] ?? '')),
        'lastName' => trim((string)($payload['family_name'] ?? '')),
        'pictureUrl' => trim((string)($payload['picture'] ?? '')),
    ];
}

function googleAuthRequireSchema(PDO $pdo): void
{
    $stmt = $pdo->prepare("\n        SELECT COUNT(*)\n        FROM information_schema.tables\n        WHERE table_schema = DATABASE()\n          AND table_name IN ('user_auth_identities', 'google_auth_onboarding_tokens')\n    ");
    $stmt->execute();

    if ((int)$stmt->fetchColumn() !== 2) {
        throw new RuntimeException('Google authentication database tables are missing.');
    }
}

function googleAuthColumnExists(PDO $pdo, string $tableName, string $columnName): bool
{
    static $cache = [];
    $cacheKey = $tableName . '.' . $columnName;
    if (array_key_exists($cacheKey, $cache)) {
        return $cache[$cacheKey];
    }

    $stmt = $pdo->prepare("\n        SELECT COUNT(*)\n        FROM information_schema.columns\n        WHERE table_schema = DATABASE()\n          AND table_name = ?\n          AND column_name = ?\n    ");
    $stmt->execute([$tableName, $columnName]);
    $cache[$cacheKey] = (int)$stmt->fetchColumn() > 0;

    return $cache[$cacheKey];
}

function googleAuthFetchUser(PDO $pdo, int $userId): ?array
{
    $accountStatusSelect = googleAuthColumnExists($pdo, 'users', 'account_status')
        ? "COALESCE(NULLIF(LOWER(account_status), ''), 'active') AS account_status,"
        : "'active' AS account_status,";

    $stmt = $pdo->prepare("\n        SELECT\n            user_id, mail_Address, role, first_Name, last_Name, personal_Address,\n            phoneNumber, emergencyNumber, setProfilePic_url, birthdate,\n            {$accountStatusSelect}\n            email_verified_at\n        FROM users\n        WHERE user_id = ?\n        LIMIT 1\n    ");
    $stmt->execute([$userId]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    return $user ?: null;
}

function googleAuthAssertUserCanSignIn(PDO $pdo, array $user): void
{
    $status = strtolower(trim((string)($user['account_status'] ?? 'active')));
    if (in_array($status, ['archived', 'deactivated'], true)) {
        googleAuthJsonResponse(403, [
            'message' => 'Account is archived. Contact the Super Admin if access should be restored.',
            'code' => 'ACCOUNT_INACTIVE',
        ]);
    }

    $role = ipawcus_access_normalize_role($user['role'] ?? '');
    $profileTable = match ($role) {
        'admin' => 'admin_profiles',
        'veterinarian' => 'veterinarian_profiles',
        default => '',
    };

    if ($profileTable !== '' && googleAuthColumnExists($pdo, $profileTable, 'is_active')) {
        $stmt = $pdo->prepare("SELECT is_active FROM {$profileTable} WHERE user_id = ? LIMIT 1");
        $stmt->execute([(int)$user['user_id']]);
        $isActive = $stmt->fetchColumn();
        if ($isActive !== false && (int)$isActive !== 1) {
            googleAuthJsonResponse(403, [
                'message' => 'This staff account is deactivated. Contact the Super Admin.',
                'code' => 'ACCOUNT_INACTIVE',
            ]);
        }
    }
}

function googleAuthPublicUser(array $user): array
{
    $status = strtolower(trim((string)($user['account_status'] ?? 'active')));

    return [
        'id' => (int)$user['user_id'],
        'email' => $user['mail_Address'],
        'role' => $user['role'],
        'firstName' => $user['first_Name'],
        'lastName' => $user['last_Name'],
        'address' => $user['personal_Address'],
        'phoneNumber' => $user['phoneNumber'],
        'emergencyNumber' => $user['emergencyNumber'],
        'profileImage' => $user['setProfilePic_url'],
        'birthdate' => $user['birthdate'],
        'accountStatus' => in_array($status, ['archived', 'deactivated'], true) ? 'archived' : 'active',
        'bookingRestricted' => false,
    ];
}

function googleAuthIssueSession(PDO $pdo, array $user): array
{
    googleAuthAssertUserCanSignIn($pdo, $user);
    $accessToken = ipawcus_create_access_token($pdo, (int)$user['user_id']);

    return [
        'status' => 'authenticated',
        'message' => 'Google sign-in successful.',
        'access_token' => $accessToken['token'],
        'token_type' => 'Bearer',
        'expires_at' => $accessToken['expires_at'],
        'user' => googleAuthPublicUser($user),
    ];
}

function googleAuthCreateOnboardingToken(PDO $pdo, array $profile): string
{
    $token = bin2hex(random_bytes(32));
    $tokenHash = hash('sha256', $token);
    $expiresAt = (new DateTimeImmutable('now'))
        ->modify('+' . GOOGLE_AUTH_ONBOARDING_TTL_MINUTES . ' minutes')
        ->format('Y-m-d H:i:s');

    $stmt = $pdo->prepare("
        INSERT INTO google_auth_onboarding_tokens
            (token_hash, provider_subject, email, first_name, last_name, picture_url, expires_at, consumed_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NOW())
        ON DUPLICATE KEY UPDATE
            token_hash = VALUES(token_hash),
            email = VALUES(email),
            first_name = VALUES(first_name),
            last_name = VALUES(last_name),
            picture_url = VALUES(picture_url),
            expires_at = VALUES(expires_at),
            consumed_at = NULL,
            created_at = NOW()
    ");
    $stmt->execute([
        $tokenHash,
        $profile['subject'],
        $profile['email'],
        $profile['firstName'],
        $profile['lastName'],
        $profile['pictureUrl'],
        $expiresAt,
    ]);

    return $token;
}

function googleAuthFindUserByEmail(PDO $pdo, string $email): ?array
{
    $stmt = $pdo->prepare('SELECT user_id, role FROM users WHERE LOWER(mail_Address) = LOWER(?) LIMIT 1');
    $stmt->execute([$email]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    return $user ?: null;
}

function googleAuthLinkRequiredResponse(): void
{
    googleAuthJsonResponse(409, [
        'message' => 'This email already has an iPawcus account. Log in with your password before linking Google.',
        'code' => 'GOOGLE_LINK_REQUIRED',
    ]);
}
