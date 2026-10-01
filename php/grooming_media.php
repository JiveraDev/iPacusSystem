<?php
require_once __DIR__ . '/config.php';

function grooming_default_photo_directory(): string
{
    // Keep the zero-configuration fallback beside the application directory,
    // never inside a web-served project folder. On shared hosting this resolves
    // to a private directory next to public_html; locally it resolves next to
    // the repository.
    $applicationRoot = realpath(dirname(__DIR__)) ?: dirname(__DIR__);
    return dirname($applicationRoot) . DIRECTORY_SEPARATOR . 'ipawcus-private-grooming-media';
}

function grooming_resolved_future_path(string $path): string
{
    $path = rtrim(str_replace('\\', '/', $path), '/');
    $existing = $path;
    $suffix = [];

    while (!file_exists($existing)) {
        $parent = dirname($existing);
        if ($parent === $existing) {
            throw new InvalidArgumentException('The grooming photo storage path cannot be resolved.');
        }
        array_unshift($suffix, basename($existing));
        $existing = $parent;
    }

    $resolved = realpath($existing);
    if ($resolved === false) {
        throw new InvalidArgumentException('The grooming photo storage path cannot be resolved.');
    }

    return rtrim(str_replace('\\', '/', $resolved), '/')
        . ($suffix ? '/' . implode('/', $suffix) : '');
}

function grooming_photo_directory(bool $create = false): string
{
    // Never store private grooming records in Vite's public/build assets.
    $configured = trim((string)(getenv('IPAWCUS_GROOMING_MEDIA_ROOT') ?: ''));
    $selected = $configured !== '' ? $configured : grooming_default_photo_directory();
    if (!(str_starts_with($selected, '/') || preg_match('/^[A-Za-z]:[\\\\\/]/', $selected))) {
        throw new InvalidArgumentException('IPAWCUS_GROOMING_MEDIA_ROOT must be an absolute path outside the website folder.');
    }
    $root = rtrim(str_replace('\\', '/', $selected), '/');
    // Resolve the nearest existing ancestor so a symlink cannot make a new
    // directory appear private while actually placing it in the website tree.
    $resolved = grooming_resolved_future_path($root);
    foreach ([dirname(__DIR__), $_SERVER['DOCUMENT_ROOT'] ?? ''] as $publicRoot) {
        if ($publicRoot === '' || !realpath($publicRoot)) continue;
        $publicPath = strtolower(rtrim(str_replace('\\', '/', realpath($publicRoot)), '/'));
        $photoPath = strtolower(rtrim(str_replace('\\', '/', $resolved), '/'));
        if ($photoPath === $publicPath || str_starts_with($photoPath, $publicPath . '/')) {
            throw new InvalidArgumentException('Grooming photos must be stored outside the website folder to protect private records.');
        }
    }
    if ($create && !is_dir($root) && !mkdir($root, 0750, true) && !is_dir($root)) {
        throw new RuntimeException('Grooming photo storage is unavailable.');
    }
    if ($create && !is_writable($root)) {
        throw new RuntimeException('Grooming photo storage is not writable by the server.');
    }
    return $root;
}
