<?php
require_once __DIR__ . '/config.php';

const IPAWCUS_RUNTIME_MEDIA_DIRECTORIES = [
    'boarding_documents',
    'concerns',
    'diagnosis',
    'inventory_items',
    'inventory_receipts',
    'invoices',
    'payment_qr',
    'payments',
    'pet_profile_images',
    'signatures',
    'uploads',
];

function ipawcus_runtime_media_root(bool $create = false): string
{
    static $resolvedRoot = null;

    if ($resolvedRoot === null) {
        $configuredRoot = trim((string)(getenv('IPAWCUS_RUNTIME_MEDIA_ROOT') ?: ''));
        if ($configuredRoot !== '') {
            $isAbsolute = str_starts_with($configuredRoot, '/')
                || preg_match('/^[A-Za-z]:[\\\\\/]/', $configuredRoot) === 1;
            $resolvedRoot = $isAbsolute
                ? $configuredRoot
                : dirname(__DIR__) . DIRECTORY_SEPARATOR . $configuredRoot;
        } else {
            $projectRoot = str_replace('\\', '/', dirname(__DIR__));
            $publicHtmlPosition = stripos($projectRoot, '/public_html');

            if ($publicHtmlPosition !== false) {
                $publicHtmlRoot = substr(
                    $projectRoot,
                    0,
                    $publicHtmlPosition + strlen('/public_html')
                );
                $deploymentRelativePath = trim(substr($projectRoot, strlen($publicHtmlRoot)), '/');

                if ($deploymentRelativePath === '') {
                    throw new RuntimeException(
                        'Runtime media cannot be protected inside a Git deployment rooted at public_html. '
                        . 'Deploy the application to a child directory such as public_html/set, or configure '
                        . 'IPAWCUS_RUNTIME_MEDIA_ROOT to a persistent directory.'
                    );
                }

                // Keep uploads inside public_html as Hostinger recommends, but outside
                // the Git-managed child directory that is replaced during deployment.
                $resolvedRoot = $publicHtmlRoot . '/ipawcus_runtime_media';
            } else {
                // Local development keeps using the repository public directory.
                $resolvedRoot = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'public';
            }
        }

        $resolvedRoot = rtrim($resolvedRoot, "/\\");
    }

    if ($create && !is_dir($resolvedRoot) && !mkdir($resolvedRoot, 0755, true) && !is_dir($resolvedRoot)) {
        throw new RuntimeException('The runtime media directory could not be created.');
    }

    if ($create) {
        $accessFile = $resolvedRoot . DIRECTORY_SEPARATOR . '.htaccess';
        if (!is_file($accessFile)) {
            $accessRules = "Options -Indexes\n"
                . "<IfModule mod_authz_core.c>\nRequire all denied\n</IfModule>\n"
                . "<IfModule !mod_authz_core.c>\nDeny from all\n</IfModule>\n";
            @file_put_contents($accessFile, $accessRules, LOCK_EX);
        }
    }

    return $resolvedRoot;
}

function ipawcus_runtime_media_directory(string $directory, bool $create = false): string
{
    $directory = trim(str_replace('\\', '/', $directory), '/');
    if (!in_array($directory, IPAWCUS_RUNTIME_MEDIA_DIRECTORIES, true)) {
        throw new InvalidArgumentException('Unsupported runtime media directory.');
    }

    $path = ipawcus_runtime_media_root($create) . DIRECTORY_SEPARATOR . $directory;
    if ($create && !is_dir($path) && !mkdir($path, 0755, true) && !is_dir($path)) {
        throw new RuntimeException('The requested runtime media directory could not be created.');
    }

    return $path;
}

function ipawcus_runtime_media_path(string $relativePath): string
{
    $relativePath = ltrim(str_replace('\\', '/', $relativePath), '/');
    if ($relativePath === '' || str_contains($relativePath, '..') || preg_match('/[\x00-\x1F\x7F]/', $relativePath)) {
        throw new InvalidArgumentException('Invalid runtime media path.');
    }

    $segments = explode('/', $relativePath);
    ipawcus_runtime_media_directory($segments[0] ?? '');

    return ipawcus_runtime_media_root() . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $relativePath);
}
