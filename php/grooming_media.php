<?php
require_once __DIR__ . '/config.php';

function grooming_default_photo_directory(): string
{
    // Prefer a sibling of the actual document root. This matters when the app
    // is deployed to public_html/set: a sibling of `set` would still be public,
    // while a sibling of `public_html` is private.
    $documentRoot = trim((string)($_SERVER['DOCUMENT_ROOT'] ?? ''));
    $resolvedDocumentRoot = $documentRoot !== '' ? realpath($documentRoot) : false;
    if ($resolvedDocumentRoot !== false) {
        $normalizedDocumentRoot = str_replace('\\', '/', $resolvedDocumentRoot);
        if (preg_match('#^(.*?)/public_html(?:/|$)#i', $normalizedDocumentRoot, $match) === 1) {
            return $match[1] . DIRECTORY_SEPARATOR . 'ipawcus-private-grooming-media';
        }
        return dirname($resolvedDocumentRoot) . DIRECTORY_SEPARATOR . 'ipawcus-private-grooming-media';
    }

    $applicationRoot = realpath(dirname(__DIR__)) ?: dirname(__DIR__);
    $normalizedApplicationRoot = str_replace('\\', '/', $applicationRoot);
    if (preg_match('#^(.*?)/public_html(?:/|$)#i', $normalizedApplicationRoot, $match) === 1) {
        return $match[1] . DIRECTORY_SEPARATOR . 'ipawcus-private-grooming-media';
    }

    return dirname($applicationRoot) . DIRECTORY_SEPARATOR . 'ipawcus-private-grooming-media';
}

function grooming_website_roots(): array
{
    $roots = [];
    foreach ([dirname(__DIR__), $_SERVER['DOCUMENT_ROOT'] ?? ''] as $candidate) {
        if (trim((string)$candidate) === '') continue;
        $resolvedCandidate = realpath((string)$candidate);
        if ($resolvedCandidate === false) continue;

        $normalizedCandidate = rtrim(str_replace('\\', '/', $resolvedCandidate), '/');
        $roots[strtolower($normalizedCandidate)] = $normalizedCandidate;
        // A subdirectory can be Apache's document root while its parent
        // public_html is still reachable from the primary domain.
        if (preg_match('#^(.*?/public_html)(?:/|$)#i', $normalizedCandidate, $match) === 1) {
            $publicHtmlRoot = rtrim($match[1], '/');
            $roots[strtolower($publicHtmlRoot)] = $publicHtmlRoot;
        }
    }

    return array_values($roots);
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

function grooming_photo_filename(string $petName, string $category, string $extension): string
{
    $petToken = trim($petName);
    if (function_exists('iconv')) {
        $asciiPetName = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $petToken);
        if ($asciiPetName !== false) $petToken = $asciiPetName;
    }
    $petToken = strtolower($petToken);
    $petToken = trim((string)preg_replace('/[^a-z0-9]+/', '-', $petToken), '-');
    $petToken = substr($petToken ?: 'pet', 0, 48);
    $safeCategory = in_array($category, ['before', 'after'], true) ? $category : 'photo';
    $safeExtension = in_array($extension, ['jpg', 'png', 'webp'], true) ? $extension : 'jpg';

    return $petToken
        . '-' . $safeCategory
        . '-' . date('Ymd-His')
        . '-' . bin2hex(random_bytes(4))
        . '.' . $safeExtension;
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
    if ($root === '' || preg_match('/^[A-Za-z]:$/', $root) === 1) {
        throw new InvalidArgumentException('The grooming photo storage path cannot be a filesystem root.');
    }
    // Resolve the nearest existing ancestor so a symlink cannot make a new
    // directory appear private while actually placing it in the website tree.
    $resolved = grooming_resolved_future_path($root);
    foreach (grooming_website_roots() as $publicRoot) {
        $publicPath = strtolower(rtrim(str_replace('\\', '/', $publicRoot), '/'));
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
