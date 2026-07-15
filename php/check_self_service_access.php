<?php
require_once __DIR__ . '/config.php';

header('Content-Type: application/json');

function getEnvValue($key, $default = '') {
    $val = getenv($key);
    if ($val !== false && $val !== null && $val !== '') return $val;
    if (isset($_ENV[$key]) && $_ENV[$key] !== '') return $_ENV[$key];
    if (isset($_SERVER[$key]) && $_SERVER[$key] !== '') return $_SERVER[$key];
    return $default;
}

function getClientIpAddress() {
    $forwarded = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? '';
    if (!empty($forwarded)) {
        $parts = explode(',', $forwarded);
        $firstIp = trim($parts[0]);
        if (filter_var($firstIp, FILTER_VALIDATE_IP)) {
            return $firstIp;
        }
    }

    $remoteAddr = $_SERVER['REMOTE_ADDR'] ?? '';
    if (filter_var($remoteAddr, FILTER_VALIDATE_IP)) {
        return $remoteAddr;
    }

    return '';
}

function getPublicIpForRestriction() {
    $mode = strtolower(trim((string)getEnvValue('RESTRICT_IP_MODE', 'auto')));
    $headerIp = trim((string)($_SERVER['HTTP_X_CLIENT_PUBLIC_IP'] ?? ''));

    if ($mode === 'public_wan') {
        return filter_var($headerIp, FILTER_VALIDATE_IP) ? $headerIp : '';
    }

    if (filter_var($headerIp, FILTER_VALIDATE_IP)) {
        return $headerIp;
    }

    return getClientIpAddress();
}

function ipMatchesRule($clientIp, $rule) {
    $rule = trim($rule);
    if ($rule === '') return false;

    if ($rule === $clientIp) return true;

    // Wildcard support, e.g. 192.168.1.*
    if (str_ends_with($rule, '*')) {
        $prefix = rtrim($rule, '*');
        return str_starts_with($clientIp, $prefix);
    }

    // CIDR support, e.g. 192.168.1.0/24
    if (strpos($rule, '/') !== false) {
        [$subnet, $maskBits] = explode('/', $rule, 2);
        $subnetLong = ip2long($subnet);
        $ipLong = ip2long($clientIp);
        $maskBits = (int)$maskBits;
        if ($subnetLong === false || $ipLong === false || $maskBits < 0 || $maskBits > 32) {
            return false;
        }
        $mask = $maskBits === 0 ? 0 : (-1 << (32 - $maskBits));
        return (($ipLong & $mask) === ($subnetLong & $mask));
    }

    return false;
}

function isIpAllowedForSelfService($clientIp, $allowedIps) {
    if ($clientIp === '') {
        return false;
    }
    foreach ($allowedIps as $allowedIp) {
        if (ipMatchesRule($clientIp, $allowedIp)) {
            return true;
        }
    }

    return false;
}

$clientIp = getPublicIpForRestriction();
$rawAllowed = getEnvValue('RESTRICT_IP_SELF_SERVICE_QUEUE', '');
$allowedIps = array_filter(array_map('trim', explode(',', $rawAllowed)));
if (empty($allowedIps)) {
    $allowedIps = ['127.0.0.1', '::1'];
}
$allowed = isIpAllowedForSelfService($clientIp, $allowedIps);

echo json_encode([
    'allowed' => $allowed,
    'client_ip' => $clientIp,
    'allowed_rules' => array_values($allowedIps),
]);
