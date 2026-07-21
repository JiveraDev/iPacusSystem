<?php
require_once __DIR__ . '/../php/mail_helpers.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['message' => 'Method not allowed.']);
    exit;
}

if (!mail_env_bool('MAIL_TEST_ENABLED', false)) {
    http_response_code(404);
    echo json_encode(['message' => 'Mail test endpoint is disabled.']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true) ?: [];
$expectedKey = mail_env_value('MAIL_TEST_KEY');
$providedKey = $_SERVER['HTTP_X_MAIL_TEST_KEY'] ?? ($input['testKey'] ?? '');

if ($expectedKey === '' || !hash_equals($expectedKey, (string)$providedKey)) {
    http_response_code(403);
    echo json_encode(['message' => 'Invalid mail test key.']);
    exit;
}

$to = trim((string)($input['to'] ?? mail_env_value('MAIL_TEST_TO')));

if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['message' => 'A valid recipient email is required.']);
    exit;
}

$subject = 'iPawcus SMTP test';
$html = '
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
        <h1 style="font-size: 20px; margin: 0 0 12px;">iPawcus SMTP is configured</h1>
        <p>This is a test email from the Vetfocus Animal Care Clinic backend.</p>
        <p>If you received this message, the Hostinger SMTP credentials are working.</p>
    </div>
';
$text = "iPawcus SMTP is configured.\n\nThis is a test email from the Vetfocus Animal Care Clinic backend.";

try {
    send_smtp_email($to, $subject, $html, $text);

    echo json_encode([
        'success' => true,
        'message' => 'Test email sent.',
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => mail_env_bool('MAIL_DEBUG', false)
            ? $e->getMessage()
            : 'Failed to send test email. Enable MAIL_DEBUG=1 temporarily for details.',
    ]);
}
