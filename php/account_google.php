<?php

require_once __DIR__ . '/google_auth_helpers.php';

$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
$currentUser = ipawcus_require_current_api_user($pdo);
$currentUserId = (int)($currentUser['user_id'] ?? 0);

if ($currentUserId <= 0) {
    googleAuthJsonResponse(401, [
        'message' => 'Please log in again to manage connected accounts.',
        'code' => 'API_AUTH_REQUIRED',
    ]);
}

try {
    googleAuthRequireSchema($pdo);

    $connectionStmt = $pdo->prepare("
        SELECT provider_email, linked_at, last_login_at
        FROM user_auth_identities
        WHERE user_id = ? AND provider = ?
        LIMIT 1
    ");
    $connectionStmt->execute([$currentUserId, GOOGLE_AUTH_PROVIDER]);
    $connection = $connectionStmt->fetch(PDO::FETCH_ASSOC);

    if ($method === 'GET') {
        googleAuthJsonResponse(200, [
            'linked' => (bool)$connection,
            'provider' => GOOGLE_AUTH_PROVIDER,
            'providerEmail' => $connection['provider_email'] ?? null,
            'linkedAt' => $connection['linked_at'] ?? null,
            'lastLoginAt' => $connection['last_login_at'] ?? null,
        ]);
    }

    if ($method !== 'POST') {
        header('Allow: GET, POST');
        googleAuthJsonResponse(405, [
            'message' => 'This connected-account endpoint accepts GET and POST requests.',
            'code' => 'METHOD_NOT_ALLOWED',
        ]);
    }

    googleAuthRequireTrustedOrigin();
    $input = googleAuthReadJsonInput();
    $profile = googleAuthVerifyCredential(trim((string)($input['credential'] ?? '')));
    $account = googleAuthFetchUser($pdo, $currentUserId);

    if (!$account) {
        googleAuthJsonResponse(404, [
            'message' => 'The current iPawcus account could not be found.',
            'code' => 'ACCOUNT_NOT_FOUND',
        ]);
    }

    if (strtolower(trim((string)$account['mail_Address'])) !== $profile['email']) {
        googleAuthJsonResponse(409, [
            'message' => 'Choose the Google account with the same email address as this iPawcus account.',
            'code' => 'GOOGLE_EMAIL_MISMATCH',
        ]);
    }

    $subjectStmt = $pdo->prepare("
        SELECT user_id
        FROM user_auth_identities
        WHERE provider = ? AND provider_subject = ?
        LIMIT 1
    ");
    $subjectStmt->execute([GOOGLE_AUTH_PROVIDER, $profile['subject']]);
    $subjectUserId = (int)($subjectStmt->fetchColumn() ?: 0);

    if ($subjectUserId > 0 && $subjectUserId !== $currentUserId) {
        googleAuthJsonResponse(409, [
            'message' => 'This Google account is already connected to another iPawcus user.',
            'code' => 'GOOGLE_ALREADY_CONNECTED',
        ]);
    }

    if ($connection) {
        $sameConnectionStmt = $pdo->prepare("
            SELECT COUNT(*)
            FROM user_auth_identities
            WHERE user_id = ? AND provider = ? AND provider_subject = ?
        ");
        $sameConnectionStmt->execute([$currentUserId, GOOGLE_AUTH_PROVIDER, $profile['subject']]);
        if ((int)$sameConnectionStmt->fetchColumn() === 0) {
            googleAuthJsonResponse(409, [
                'message' => 'This iPawcus user is already connected to a different Google account.',
                'code' => 'IPAWCUS_ACCOUNT_ALREADY_CONNECTED',
            ]);
        }

        $updateStmt = $pdo->prepare("
            UPDATE user_auth_identities
            SET provider_email = ?
            WHERE user_id = ? AND provider = ?
        ");
        $updateStmt->execute([$profile['email'], $currentUserId, GOOGLE_AUTH_PROVIDER]);
    } else {
        $insertStmt = $pdo->prepare("
            INSERT INTO user_auth_identities
                (user_id, provider, provider_subject, provider_email, linked_at)
            VALUES (?, ?, ?, ?, NOW())
        ");
        $insertStmt->execute([
            $currentUserId,
            GOOGLE_AUTH_PROVIDER,
            $profile['subject'],
            $profile['email'],
        ]);
    }

    googleAuthJsonResponse(200, [
        'status' => 'linked',
        'linked' => true,
        'provider' => GOOGLE_AUTH_PROVIDER,
        'providerEmail' => $profile['email'],
        'message' => 'Google is now connected to this iPawcus account.',
    ]);
} catch (Throwable $error) {
    error_log('Google account connection failed: ' . $error->getMessage());
    googleAuthJsonResponse(500, [
        'message' => 'The Google account connection is temporarily unavailable. Please try again.',
        'code' => 'GOOGLE_CONNECTION_UNAVAILABLE',
    ]);
}
