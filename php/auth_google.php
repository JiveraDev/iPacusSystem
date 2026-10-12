<?php

require_once __DIR__ . '/google_auth_helpers.php';

googleAuthRequirePost();
googleAuthRequireTrustedOrigin();
$input = googleAuthReadJsonInput();

try {
    googleAuthRequireSchema($pdo);
    $profile = googleAuthVerifyCredential(trim((string)($input['credential'] ?? '')));

    $identityStmt = $pdo->prepare("
        SELECT user_id
        FROM user_auth_identities
        WHERE provider = ? AND provider_subject = ?
        LIMIT 1
    ");
    $identityStmt->execute([GOOGLE_AUTH_PROVIDER, $profile['subject']]);
    $linkedUserId = (int)($identityStmt->fetchColumn() ?: 0);

    if ($linkedUserId > 0) {
        $user = googleAuthFetchUser($pdo, $linkedUserId);
        if (!$user) {
            googleAuthJsonResponse(401, [
                'message' => 'The linked iPawcus account could not be found.',
                'code' => 'GOOGLE_LINK_INVALID',
            ]);
        }

        $updateStmt = $pdo->prepare("
            UPDATE user_auth_identities
            SET provider_email = ?, last_login_at = NOW()
            WHERE provider = ? AND provider_subject = ?
        ");
        $updateStmt->execute([$profile['email'], GOOGLE_AUTH_PROVIDER, $profile['subject']]);
        $session = googleAuthIssueSession($pdo, $user);
        googleAuthJsonResponse(200, $session);
    }

    if (googleAuthFindUserByEmail($pdo, $profile['email'])) {
        googleAuthLinkRequiredResponse();
    }

    $onboardingToken = googleAuthCreateOnboardingToken($pdo, $profile);
    googleAuthJsonResponse(200, [
        'status' => 'onboarding_required',
        'code' => 'GOOGLE_ONBOARDING_REQUIRED',
        'message' => 'Complete your personal information to finish creating your pet owner account.',
        'onboardingToken' => $onboardingToken,
        'profile' => [
            'email' => $profile['email'],
            'firstName' => $profile['firstName'],
            'lastName' => $profile['lastName'],
        ],
    ]);
} catch (Throwable $error) {
    googleAuthHandleSetupException($error);
    error_log('Google authentication failed: ' . $error->getMessage());
    googleAuthJsonResponse(500, [
        'message' => 'Google sign-in is temporarily unavailable. Please try again or use your password.',
        'code' => 'GOOGLE_AUTH_UNAVAILABLE',
    ]);
}
