<?php
/**
 * Simple helper to load .env file into getenv(), $_ENV, and $_SERVER.
 */
if (!function_exists('setLoadedEnvValue')) {
    function setLoadedEnvValue(string $name, string $value): void
    {
        putenv(sprintf('%s=%s', $name, $value));
        $_ENV[$name] = $value;
        $_SERVER[$name] = $value;
    }
}

if (!function_exists('syncExistingEnvValue')) {
    function syncExistingEnvValue(string $name): bool
    {
        $value = getenv($name);
        if ($value !== false) {
            $_ENV[$name] = $value;
            $_SERVER[$name] = $value;
            return true;
        }

        if (array_key_exists($name, $_ENV)) {
            setLoadedEnvValue($name, (string)$_ENV[$name]);
            return true;
        }

        if (array_key_exists($name, $_SERVER)) {
            setLoadedEnvValue($name, (string)$_SERVER[$name]);
            return true;
        }

        return false;
    }
}

if (!function_exists('parseEnvValue')) {
    function parseEnvValue(string $value): string
    {
        $value = trim($value);

        if ($value === '') {
            return '';
        }

        $quote = $value[0];
        if (($quote === '"' || $quote === "'") && substr($value, -1) === $quote) {
            $value = substr($value, 1, -1);

            if ($quote === '"') {
                $value = strtr($value, [
                    '\\n' => "\n",
                    '\\r' => "\r",
                    '\\t' => "\t",
                    '\\"' => '"',
                    '\\\\' => '\\',
                ]);
            }

            return $value;
        }

        return trim((string)preg_replace('/\s+#.*$/', '', $value));
    }
}

if (!function_exists('loadEnv')) {
    function loadEnv(string $path, bool $overrideExisting = false): void
    {
        if (!is_readable($path)) {
            return;
        }

        $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        foreach ($lines as $line) {
            $line = trim((string)$line);
            $line = preg_replace('/^\xEF\xBB\xBF/', '', $line);

            if ($line === '' || str_starts_with(ltrim($line), '#')) {
                continue;
            }

            if (str_starts_with($line, 'export ')) {
                $line = trim(substr($line, 7));
            }

            if (strpos($line, '=') === false) {
                continue;
            }

            [$name, $value] = explode('=', $line, 2);
            $name = trim($name);

            if (!preg_match('/^[A-Za-z_][A-Za-z0-9_]*$/', $name)) {
                continue;
            }

            if (!$overrideExisting && syncExistingEnvValue($name)) {
                continue;
            }

            setLoadedEnvValue($name, parseEnvValue($value));
        }
    }
}

// Load from project root
loadEnv(__DIR__ . '/../.env');
