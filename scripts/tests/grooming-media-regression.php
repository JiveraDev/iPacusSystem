<?php
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }

require_once __DIR__ . '/../../php/grooming_media.php';

$original = getenv('IPAWCUS_GROOMING_MEDIA_ROOT');
$originalDocumentRoot = $_SERVER['DOCUMENT_ROOT'] ?? null;
$testRoot = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR)
    . DIRECTORY_SEPARATOR
    . 'ipawcus-grooming-media-test-'
    . bin2hex(random_bytes(6));
$probe = $testRoot . DIRECTORY_SEPARATOR . 'write-probe.txt';
$hostFixture = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR)
    . DIRECTORY_SEPARATOR
    . 'ipawcus-grooming-host-layout-'
    . bin2hex(random_bytes(6));
$hostPublicRoot = $hostFixture . DIRECTORY_SEPARATOR . 'public_html';
$hostDocumentRoot = $hostPublicRoot . DIRECTORY_SEPARATOR . 'set';
$hostPrivateRoot = $hostFixture . DIRECTORY_SEPARATOR . 'ipawcus-private-grooming-media';
$passed = 0;

function media_check(bool $condition, string $label): void
{
    global $passed;
    if (!$condition) throw new RuntimeException('FAIL: ' . $label);
    $passed++;
}

try {
    putenv('IPAWCUS_GROOMING_MEDIA_ROOT=' . $testRoot);
    $resolved = grooming_photo_directory(true);
    media_check(is_dir($resolved), 'Private media directory is created recursively');
    media_check(is_writable($resolved), 'Private media directory is writable');
    media_check(file_put_contents($probe, 'grooming-media-probe', LOCK_EX) !== false, 'Private media file can be saved');
    media_check(file_get_contents($probe) === 'grooming-media-probe', 'Saved private media file can be read');
    $safeName = grooming_photo_filename('../Mílo / Puppy 🐾', 'before', 'jpg');
    media_check(
        preg_match('/^[a-z0-9-]+-before-\d{8}-\d{6}-[a-f0-9]{8}\.jpg$/', $safeName) === 1,
        'Generated photo name is portable and contains no path characters'
    );

    mkdir($hostDocumentRoot, 0750, true);
    putenv('IPAWCUS_GROOMING_MEDIA_ROOT');
    $_SERVER['DOCUMENT_ROOT'] = $hostDocumentRoot;
    media_check(
        str_replace('\\', '/', grooming_default_photo_directory()) === str_replace('\\', '/', $hostPrivateRoot),
        'Nested Hostinger app storage is a sibling of public_html, not a child of it'
    );
    media_check(grooming_photo_directory(true) === str_replace('\\', '/', $hostPrivateRoot), 'Host-style private fallback can be created');

    putenv('IPAWCUS_GROOMING_MEDIA_ROOT=' . $hostPublicRoot . DIRECTORY_SEPARATOR . 'private-grooming');
    try {
        grooming_photo_directory();
        throw new RuntimeException('FAIL: A sibling of the app inside public_html was accepted');
    } catch (InvalidArgumentException $error) {
        media_check(str_contains($error->getMessage(), 'outside the website folder'), 'All of public_html is rejected when the app document root is nested');
    }

    putenv('IPAWCUS_GROOMING_MEDIA_ROOT=' . realpath(__DIR__ . '/../..') . DIRECTORY_SEPARATOR . 'public' . DIRECTORY_SEPARATOR . 'grooming-photos');
    try {
        grooming_photo_directory();
        throw new RuntimeException('FAIL: Website-folder media path was accepted');
    } catch (InvalidArgumentException $error) {
        media_check(str_contains($error->getMessage(), 'outside the website folder'), 'Website-folder media path is rejected');
    }
} finally {
    if (is_file($probe)) unlink($probe);
    if (is_dir($testRoot)) rmdir($testRoot);
    if (is_dir($hostPrivateRoot)) rmdir($hostPrivateRoot);
    if (is_dir($hostDocumentRoot)) rmdir($hostDocumentRoot);
    if (is_dir($hostPublicRoot)) rmdir($hostPublicRoot);
    if (is_dir($hostFixture)) rmdir($hostFixture);
    if ($originalDocumentRoot === null) unset($_SERVER['DOCUMENT_ROOT']);
    else $_SERVER['DOCUMENT_ROOT'] = $originalDocumentRoot;
    $original === false
        ? putenv('IPAWCUS_GROOMING_MEDIA_ROOT')
        : putenv('IPAWCUS_GROOMING_MEDIA_ROOT=' . $original);
}

echo "PASS: {$passed} grooming media checks. Temporary files were removed.\n";
