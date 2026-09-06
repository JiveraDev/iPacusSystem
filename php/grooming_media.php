<?php
require_once __DIR__ . '/config.php';

function grooming_photo_directory(bool $create = false): string
{
    // Never store private grooming records in Vite's public/build assets.
    $configured = trim((string)(getenv('IPAWCUS_GROOMING_MEDIA_ROOT') ?: ''));
    if ($configured === '' || !(str_starts_with($configured, '/') || preg_match('/^[A-Za-z]:[\\\\\/]/', $configured))) {
        throw new InvalidArgumentException('Photo storage needs setup. Ask the administrator to configure IPAWCUS_GROOMING_MEDIA_ROOT outside the website folder.');
    }
    $root = rtrim(str_replace('\\', '/', $configured), '/');
    // Require an existing, resolved parent so aliases cannot bypass the public-root check.
    $parent = realpath(dirname($root));
    if (!$parent) throw new InvalidArgumentException('The configured grooming photo storage parent folder does not exist.');
    $resolved = realpath($root) ?: $parent . '/' . basename($root);
    foreach ([dirname(__DIR__), $_SERVER['DOCUMENT_ROOT'] ?? ''] as $publicRoot) {
        if ($publicRoot === '' || !realpath($publicRoot)) continue;
        $publicPath = strtolower(rtrim(str_replace('\\', '/', realpath($publicRoot)), '/'));
        $photoPath = strtolower(str_replace('\\', '/', $resolved));
        if ($photoPath === $publicPath || str_starts_with($photoPath, $publicPath . '/')) {
            throw new InvalidArgumentException('Grooming photos must be stored outside the website folder to protect private records.');
        }
    }
    if ($create && !is_dir($root) && !mkdir($root, 0750, true) && !is_dir($root)) {
        throw new RuntimeException('Grooming photo storage is unavailable.');
    }
    return $root;
}
