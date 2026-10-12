<?php

require_once __DIR__ . '/google_auth_helpers.php';
require_once __DIR__ . '/phone_number_helpers.php';

googleAuthRequirePost();
googleAuthRequireTrustedOrigin();
$input = googleAuthReadJsonInput();

$onboardingToken = trim((string)($input['onboardingToken'] ?? ''));
$firstName = trim((string)($input['firstName'] ?? ''));
$lastName = trim((string)($input['lastName'] ?? ''));
$address = trim((string)($input['address'] ?? ''));
$phoneNumber = $input['phoneNumber'] ?? '';
$emergencyContact = $input['emergencyContact'] ?? '';
$termsAccepted = filter_var($input['termsAccepted'] ?? false, FILTER_VALIDATE_BOOLEAN);

if ($onboardingToken === '' || $firstName === '' || $lastName === '' || $address === '' || !$phoneNumber) {
    googleAuthJsonResponse(400, [
        'message' => 'Complete all required personal information fields.',
        'code' => 'GOOGLE_ONBOARDING_INCOMPLETE',
    ]);
}

if (!$termsAccepted) {
    googleAuthJsonResponse(400, [
        'message' => 'Please accept the Terms of Use and General Service Conditions to register.',
        'code' => 'TERMS_REQUIRED',
    ]);
}

if (!preg_match("/^[\\p{L}\\p{M}]+(?: [\\p{L}\\p{M}]+)*$/u", $firstName)
    || !preg_match("/^[\\p{L}\\p{M}]+(?: [\\p{L}\\p{M}]+)*$/u", $lastName)) {
    googleAuthJsonResponse(422, [
        'message' => 'First and last names can only use letters and single spaces.',
        'code' => 'INVALID_NAME',
    ]);
}

$phoneNumber = rejectInvalidPhilippinePhoneNumber($phoneNumber, 'Phone number');
$emergencyContact = rejectInvalidPhilippinePhoneNumber($emergencyContact, 'Emergency contact', true);

try {
    googleAuthRequireSchema($pdo);
    $pdo->beginTransaction();

    $tokenStmt = $pdo->prepare("
        SELECT onboarding_id, provider_subject, email
        FROM google_auth_onboarding_tokens
        WHERE token_hash = ?
          AND consumed_at IS NULL
          AND expires_at > NOW()
        LIMIT 1
        FOR UPDATE
    ");
    $tokenStmt->execute([hash('sha256', $onboardingToken)]);
    $onboarding = $tokenStmt->fetch(PDO::FETCH_ASSOC);

    if (!$onboarding) {
        $pdo->rollBack();
        googleAuthJsonResponse(410, [
            'message' => 'This Google registration session expired. Continue with Google again.',
            'code' => 'GOOGLE_ONBOARDING_EXPIRED',
        ]);
    }

    $identityStmt = $pdo->prepare("
        SELECT user_id
        FROM user_auth_identities
        WHERE provider = ? AND provider_subject = ?
        LIMIT 1
    ");
    $identityStmt->execute([GOOGLE_AUTH_PROVIDER, $onboarding['provider_subject']]);
    if ($identityStmt->fetchColumn()) {
        $pdo->rollBack();
        googleAuthJsonResponse(409, [
            'message' => 'This Google account is already linked. Return to login and continue with Google again.',
            'code' => 'GOOGLE_ALREADY_LINKED',
        ]);
    }

    if (googleAuthFindUserByEmail($pdo, $onboarding['email'])) {
        $pdo->rollBack();
        googleAuthLinkRequiredResponse();
    }

    $insertUser = $pdo->prepare("
        INSERT INTO users
            (mail_Address, user_password, role, first_Name, last_Name, personal_Address, phoneNumber, emergencyNumber, email_verified_at)
        VALUES (?, NULL, 'pet_owner', ?, ?, ?, ?, ?, NOW())
    ");
    $insertUser->execute([
        $onboarding['email'],
        $firstName,
        $lastName,
        $address,
        $phoneNumber,
        $emergencyContact,
    ]);
    $userId = (int)$pdo->lastInsertId();

    $insertIdentity = $pdo->prepare("
        INSERT INTO user_auth_identities
            (user_id, provider, provider_subject, provider_email, linked_at, last_login_at)
        VALUES (?, ?, ?, ?, NOW(), NOW())
    ");
    $insertIdentity->execute([
        $userId,
        GOOGLE_AUTH_PROVIDER,
        $onboarding['provider_subject'],
        $onboarding['email'],
    ]);

    $consumeStmt = $pdo->prepare('UPDATE google_auth_onboarding_tokens SET consumed_at = NOW() WHERE onboarding_id = ?');
    $consumeStmt->execute([(int)$onboarding['onboarding_id']]);
    $pdo->commit();

    $user = googleAuthFetchUser($pdo, $userId);
    if (!$user) {
        throw new RuntimeException('The newly registered account could not be loaded.');
    }

    $response = googleAuthIssueSession($pdo, $user);
    $response['message'] = 'Your pet owner account was created with Google.';
    googleAuthJsonResponse(201, $response);
} catch (Throwable $error) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    googleAuthHandleSetupException($error);
    error_log('Google onboarding failed: ' . $error->getMessage());
    googleAuthJsonResponse(500, [
        'message' => 'Google registration could not be completed. Please try again.',
        'code' => 'GOOGLE_ONBOARDING_FAILED',
    ]);
}
