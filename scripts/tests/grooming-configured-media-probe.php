<?php
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once __DIR__ . '/../../php/grooming_media.php';

$probe = null;
try {
    $directory = grooming_photo_directory(true);
    $probe = $directory . DIRECTORY_SEPARATOR . 'ipawcus-grooming-write-probe-' . bin2hex(random_bytes(6)) . '.tmp';
    $payload = 'grooming-storage-ok';

    if (file_put_contents($probe, $payload, LOCK_EX) === false) {
        throw new RuntimeException('The configured directory could not accept a test file.');
    }
    if (file_get_contents($probe) !== $payload) {
        throw new RuntimeException('The test file could not be read back correctly.');
    }

    echo "PASS: configured grooming directory created, wrote, and read a temporary probe file.\n";
} finally {
    if ($probe !== null && is_file($probe) && !unlink($probe)) {
        fwrite(STDERR, "WARNING: the temporary grooming storage probe could not be removed.\n");
        exit(1);
    }
}
