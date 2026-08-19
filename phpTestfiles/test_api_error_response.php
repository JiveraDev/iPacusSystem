<?php

require_once __DIR__ . '/../php/api_error_response.php';

if (ipawcus_error_response_is_http()) {
    $mode = trim((string)getenv('IPAWCUS_ERROR_TEST_HTTP_MODE'));
    header('Content-Type: application/json');
    http_response_code(500);

    if ($mode === 'json') {
        echo json_encode([
            'message' => "SQLSTATE[42S02]: Base table or view not found: Table 'ipawcus_system.users' doesn't exist in engine",
        ]);
        exit;
    }

    if ($mode === 'malformed') {
        echo "Fatal error: Uncaught PDOException: SQLSTATE[42S02] in C:\\app\\php\\login.php:182";
        exit;
    }

    throw new RuntimeException('SQLSTATE[42S02]: users table is missing.');
}

function api_error_test_assert(bool $condition, string $message): void
{
    if (!$condition) {
        fwrite(STDERR, "FAIL: {$message}\n");
        exit(1);
    }
}

function api_error_test_sanitize(array $payload, int $status, array &$redacted): array
{
    $redacted = [];
    return ipawcus_error_response_sanitize_payload($payload, $status, $redacted);
}

$redacted = [];
$sqlPayload = api_error_test_sanitize([
    'message' => "SQLSTATE[42S02]: Base table or view not found: 1932 Table 'ipawcus_system.users' doesn't exist in engine",
], 500, $redacted);
api_error_test_assert($sqlPayload['message'] === ipawcus_error_response_public_message(500), 'SQLSTATE message must be replaced.');
api_error_test_assert(($sqlPayload['code'] ?? '') === 'internal_error', 'Sanitized error must use internal_error code.');
api_error_test_assert(preg_match('/^IPW-\d{8}-[A-F0-9]{12}$/', (string)($sqlPayload['referenceId'] ?? '')) === 1, 'Reference ID must be safe and stable.');
api_error_test_assert(count($redacted) === 1, 'Suppressed SQL detail must be available for server logging.');

$redacted = [];
$validationPayload = api_error_test_sanitize([
    'message' => 'Booking date and time must not be in the past.',
], 422, $redacted);
api_error_test_assert($validationPayload['message'] === 'Booking date and time must not be in the past.', 'Normal validation message must be preserved.');
api_error_test_assert($redacted === [], 'Normal validation must not be marked as technical.');

$redacted = [];
$schemaPayload = api_error_test_sanitize([
    'success' => false,
    'message' => 'Run DDL/20260808_01_payment_integrity.sql before reviewing booking payments.',
    'missingColumns' => ['payment_status', 'reviewed_at'],
    'table' => 'booking_payment_submissions',
    'requiredSql' => 'DDL/20260808_01_payment_integrity.sql',
    'required_status_sql' => 'ALTER TABLE users ADD COLUMN account_status VARCHAR(32)',
], 409, $redacted);
api_error_test_assert($schemaPayload['message'] === ipawcus_error_response_public_message(409), 'Schema instruction must be replaced.');
api_error_test_assert(!array_key_exists('missingColumns', $schemaPayload), 'Missing-column names must be removed.');
api_error_test_assert(!array_key_exists('table', $schemaPayload), 'Table name must be removed from an error response.');
api_error_test_assert(!array_key_exists('requiredSql', $schemaPayload), 'Required SQL path must be removed from an error response.');
api_error_test_assert(!array_key_exists('required_status_sql', $schemaPayload), 'Snake-case required SQL must be removed from an error response.');
api_error_test_assert(($schemaPayload['success'] ?? true) === false, 'Sanitized error must remain unsuccessful.');

$redacted = [];
$partialPayload = api_error_test_sanitize([
    'success' => true,
    'missing_data' => [
        'users table is missing; staff monitoring is unavailable.',
        'Add users.last_seen_at before online presence can be reported.',
    ],
], 200, $redacted);
api_error_test_assert(
    ($partialPayload['missing_data'][0] ?? '') === ipawcus_error_response_public_message(200),
    'Technical partial-data detail must be replaced without changing successful status.'
);
api_error_test_assert(
    ($partialPayload['missing_data'][1] ?? '') === ipawcus_error_response_public_message(200),
    'Database identifiers in diagnostic messages must be replaced.'
);
api_error_test_assert(($partialPayload['success'] ?? false) === true, 'Partial successful response must remain successful.');

$redacted = [];
$successfulDiagnostic = api_error_test_sanitize([
    'success' => true,
    'missingColumns' => ['private_schema_column'],
    'required_status_sql' => 'ALTER TABLE users ADD COLUMN account_status VARCHAR(32)',
], 200, $redacted);
api_error_test_assert(!array_key_exists('missingColumns', $successfulDiagnostic), 'Private diagnostic keys must also be removed from successful responses.');
api_error_test_assert(!array_key_exists('required_status_sql', $successfulDiagnostic), 'Successful responses must not expose required SQL.');
api_error_test_assert(($successfulDiagnostic['success'] ?? false) === true, 'Removing diagnostics must not change successful status.');

$redacted = [];
$ordinarySuccess = api_error_test_sanitize([
    'success' => true,
    'message' => 'Pet registered successfully.',
], 201, $redacted);
api_error_test_assert($ordinarySuccess['message'] === 'Pet registered successfully.', 'Successful user message must be preserved.');

$originalScriptName = $_SERVER['SCRIPT_NAME'] ?? null;
$originalRequestUri = $_SERVER['REQUEST_URI'] ?? null;
$_SERVER['SCRIPT_NAME'] = '/php/index.php';
$_SERVER['REQUEST_URI'] = '/api/uploads/media/payments/example.jpg';
api_error_test_assert(ipawcus_error_response_is_binary_media_route(), 'Nested media routes must skip response buffering.');
if ($originalScriptName === null) {
    unset($_SERVER['SCRIPT_NAME']);
} else {
    $_SERVER['SCRIPT_NAME'] = $originalScriptName;
}
if ($originalRequestUri === null) {
    unset($_SERVER['REQUEST_URI']);
} else {
    $_SERVER['REQUEST_URI'] = $originalRequestUri;
}

fwrite(STDOUT, "PASS: API error response sanitizer\n");
