<?php

require_once __DIR__ . '/../../php/mail_helpers.php';

function mail_session_assert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$sockets = stream_socket_pair(STREAM_PF_INET, STREAM_SOCK_STREAM, STREAM_IPPROTO_IP);
if ($sockets === false) {
    throw new RuntimeException('This PHP build cannot create a local socket pair for the SMTP session test.');
}

[$clientSocket, $serverSocket] = $sockets;
$responses = implode('', array_fill(0, 2, "250 sender ok\r\n250 recipient ok\r\n354 send data\r\n250 queued\r\n"));
fwrite($serverSocket, $responses);

$config = [
    'fromAddress' => 'clinic@example.com',
    'fromName' => 'Clinic',
    'replyTo' => '',
];

for ($messageNumber = 1; $messageNumber <= 2; $messageNumber++) {
    $result = mail_smtp_send_on_session(
        $clientSocket,
        'owner@example.com',
        "Scheduled task {$messageNumber}",
        '<p>Reminder</p>',
        'Reminder',
        $config
    );
    mail_session_assert(($result['success'] ?? false) === true, 'The reusable SMTP session must accept each message.');
}

stream_set_blocking($serverSocket, false);
$commands = stream_get_contents($serverSocket) ?: '';
mail_smtp_close_session($clientSocket, false);
fclose($serverSocket);

mail_session_assert(substr_count($commands, 'MAIL FROM:<clinic@example.com>') === 2, 'Both messages must use the same open SMTP session.');
mail_session_assert(substr_count($commands, 'RCPT TO:<owner@example.com>') === 2, 'Both recipients must be sent on the reusable session.');
mail_session_assert(substr_count($commands, "\r\n.\r\n") === 2, 'Both SMTP message bodies must be terminated correctly.');

echo "Reusable SMTP session tests passed.\n";
