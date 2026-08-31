<?php

/**
 * Shared HTTP error protection for the PHP API.
 *
 * Raw server errors belong in the PHP error log. API clients receive a stable,
 * non-technical message and a reference ID that can be matched to that log.
 */

if (!function_exists('ipawcus_error_response_is_http')) {
    function ipawcus_error_response_is_http(): bool
    {
        return PHP_SAPI !== 'cli' && PHP_SAPI !== 'phpdbg';
    }

    function ipawcus_error_response_reference_id(): string
    {
        if (!empty($GLOBALS['ipawcus_error_response_reference_id'])) {
            return (string)$GLOBALS['ipawcus_error_response_reference_id'];
        }

        try {
            $suffix = strtoupper(bin2hex(random_bytes(6)));
        } catch (Throwable $error) {
            $suffix = strtoupper(substr(hash('sha256', uniqid('', true) . microtime(true)), 0, 12));
        }

        $referenceId = 'IPW-' . gmdate('Ymd') . '-' . $suffix;
        $GLOBALS['ipawcus_error_response_reference_id'] = $referenceId;

        return $referenceId;
    }

    function ipawcus_error_response_request_context(): string
    {
        $method = strtoupper(trim((string)($_SERVER['REQUEST_METHOD'] ?? 'HTTP')));
        $uri = (string)($_SERVER['REQUEST_URI'] ?? ($_SERVER['SCRIPT_NAME'] ?? 'unknown'));
        $path = parse_url($uri, PHP_URL_PATH);

        return trim($method . ' ' . ($path ?: 'unknown'));
    }

    function ipawcus_error_response_log(string $message): void
    {
        $normalized = preg_replace('/[\r\n]+/', ' ', trim($message)) ?? trim($message);
        if (strlen($normalized) > 8000) {
            $normalized = substr($normalized, 0, 8000) . ' [truncated]';
        }

        error_log(sprintf(
            '[iPawcus API] [%s] [%s] %s',
            ipawcus_error_response_reference_id(),
            ipawcus_error_response_request_context(),
            $normalized
        ));
    }

    function ipawcus_error_response_log_throwable(Throwable $error, string $context = 'Uncaught exception'): void
    {
        $details = sprintf(
            '%s: %s: %s in %s:%d',
            $context,
            get_class($error),
            $error->getMessage(),
            $error->getFile(),
            $error->getLine()
        );
        $trace = trim($error->getTraceAsString());

        ipawcus_error_response_log($details . ($trace !== '' ? ' | Stack: ' . $trace : ''));
    }

    function ipawcus_error_response_public_message(int $statusCode): string
    {
        return $statusCode >= 400
            ? 'We could not complete this request right now. Please try again.'
            : 'The request completed, but some information is temporarily unavailable.';
    }

    function ipawcus_error_response_contains_technical_details(string $value): bool
    {
        $value = trim($value);
        if ($value === '') {
            return false;
        }

        $patterns = [
            '/\bSQLSTATE(?:\[[A-Z0-9]+\])?/i',
            '/\b(?:PDOException|PDO|mysqli?|MySQL server)\b/i',
            '/\b(?:base table or view not found|doesn\'t exist in engine|does not exist in engine|unknown database|unknown column)\b/i',
            '/\btable\s+[\'"`]?[^\s\'"`]+[\'"`]?\s+(?:does not exist|doesn\'t exist|is missing|was not found|not found)\b/i',
            '/\b(?:database|table|column|schema)\b.{0,120}\b(?:missing|not found|does not exist|doesn\'t exist|not installed|migration|required columns?)\b/i',
            '/\b(?:missing|required)\b.{0,120}\b(?:database|table|column|schema)\b/i',
            '/\b(?:schema|database)\s+migration\b/i',
            '/\b(?:[a-z0-9]+_[a-z0-9_]*\.[a-z0-9_]+|[a-z0-9_]+\.[a-z0-9]+_[a-z0-9_]*)\b/i',
            '/\b(?:run|apply|restore|install)\b.{0,160}\b(?:DDL|migration|[^\s]+\.sql)\b/i',
            '~\bDDL[\\/]|\bphpTestfiles[\\/].*\.sql\b~i',
            '/\b(?:integrity constraint violation|foreign key constraint|duplicate entry|deadlock found|lock wait timeout|data too long for column|incorrect string value)\b/i',
            '/\b(?:SQL syntax|syntax error in query|query failed|general error:\s*\d+|access denied for user|could not find driver)\b/i',
            '/\b(?:server has gone away|lost connection|connection refused|connection timed out|getaddrinfo failed|no connection could be made)\b/i',
            '/\b(?:Fatal error|Parse error|Uncaught|Stack trace|TypeError|ParseError|ArgumentCountError)\b/i',
            '/\b(?:Warning|Notice|Deprecated):\s/i',
            '/\b(?:Undefined variable|Undefined array key|Undefined property|Call to undefined (?:function|method)|Class [^\r\n]+ not found|Trying to access array offset)\b/i',
            '/\bArgument #\d+\b.{0,160}\bmust be of type\b|\bReturn value\b.{0,160}\bmust be of type\b/i',
            '/\b(?:invalid parameter number|number of bound variables does not match|already an active transaction|no active transaction)\b/i',
            '/\b(?:failed to open stream|failed opening required|failed opening .* for inclusion|autoload file .* not found)\b/i',
            '/\b(?:SMTP|OpenSSL|cURL)\b.{0,160}\b(?:error|failed|failure|exception|unavailable)\b/i',
            '/\bMalformed UTF-8 characters\b/i',
            '/(?:^|\s)#\d+\s+.*(?:\.php|\[internal function\])/i',
            '/\b(?:thrown|called) in\s+.+\s+on line\s+\d+\b/i',
            '~(?:[A-Za-z]:\\\\|/)(?:[^\s:]+[\\/])+[^\s:]+\.php(?::\d+|\s+on line\s+\d+)~i',
            '/\b(?:master key|encryption key|API access token|PAYMENT_DETAILS_KEY|OTP secret)\b.{0,100}\b(?:missing|not configured|required)\b/i',
            '/\b(?:DB_HOST|DB_PORT|DB_NAME|DB_USER|DB_PASSWORD|PAYMENT_DETAILS_KEY|MAIL_DEBUG)\b/',
            '/\b(?:payment detail encryption|web mail queue processing)\b.{0,100}\b(?:not configured|not securely configured|unavailable)\b/i',
        ];

        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $value) === 1) {
                return true;
            }
        }

        return false;
    }

    function ipawcus_error_response_is_list(array $value): bool
    {
        $expected = 0;
        foreach ($value as $key => $_item) {
            if ($key !== $expected) {
                return false;
            }
            $expected++;
        }

        return true;
    }

    function ipawcus_error_response_is_error_key(string $key): bool
    {
        return in_array(strtolower($key), [
            'message',
            'error',
            'errors',
            'reason',
            'detail',
            'details',
            'warning',
            'warnings',
            'summary',
            'action',
            'code',
            'missing_data',
            'diagnostic',
            'diagnostics',
        ], true);
    }

    function ipawcus_error_response_is_private_diagnostic_key(string $key): bool
    {
        $normalizedKey = strtolower((string)(preg_replace('/[^a-z0-9]+/i', '', $key) ?? $key));

        return in_array($normalizedKey, [
            'sql',
            'query',
            'statement',
            'trace',
            'stack',
            'stacktrace',
            'exception',
            'errorinfo',
            'debug',
            'file',
            'line',
            'missingcolumns',
            'missingtables',
            'table',
            'column',
            'database',
            'schema',
            'ddl',
            'migration',
            'requiredsql',
            'requiredstatussql',
        ], true);
    }

    function ipawcus_error_response_log_value(string $key, $value, array &$redacted): void
    {
        $encoded = is_string($value)
            ? $value
            : json_encode($value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
        $redacted[] = $key . '=' . substr((string)$encoded, 0, 2000);
    }

    function ipawcus_error_response_sanitize_array(
        array $payload,
        int $statusCode,
        array &$redacted,
        bool $diagnosticContext = false
    ): array {
        foreach ($payload as $key => $value) {
            $stringKey = is_string($key) ? $key : '';
            $childDiagnosticContext = $diagnosticContext
                || ($stringKey !== '' && ipawcus_error_response_is_error_key($stringKey));

            if ($stringKey !== ''
                && ipawcus_error_response_is_private_diagnostic_key($stringKey)) {
                ipawcus_error_response_log_value($stringKey, $value, $redacted);
                unset($payload[$key]);
                continue;
            }

            if (is_array($value)) {
                $payload[$key] = ipawcus_error_response_sanitize_array(
                    $value,
                    $statusCode,
                    $redacted,
                    $childDiagnosticContext
                );
                continue;
            }

            if (!is_string($value)) {
                continue;
            }

            $shouldInspect = $statusCode >= 400 || $childDiagnosticContext;
            if (!$shouldInspect || !ipawcus_error_response_contains_technical_details($value)) {
                continue;
            }

            ipawcus_error_response_log_value($stringKey !== '' ? $stringKey : 'value', $value, $redacted);
            $payload[$key] = strtolower($stringKey) === 'code'
                ? 'internal_error'
                : ipawcus_error_response_public_message($statusCode);
        }

        return $payload;
    }

    function ipawcus_error_response_sanitize_payload(array $payload, int $statusCode, array &$redacted = []): array
    {
        $payload = ipawcus_error_response_sanitize_array($payload, $statusCode, $redacted);
        if (empty($redacted)) {
            return $payload;
        }

        if (!ipawcus_error_response_is_list($payload)) {
            $payload['referenceId'] = ipawcus_error_response_reference_id();
            if ($statusCode >= 400) {
                if (!array_key_exists('success', $payload) && !array_key_exists('ok', $payload)) {
                    $payload['success'] = false;
                }
                $payload['code'] = 'internal_error';
                if (!isset($payload['message']) && !isset($payload['error'])) {
                    $payload['message'] = ipawcus_error_response_public_message($statusCode);
                }
            }
        }

        return $payload;
    }

    function ipawcus_error_response_filter_json(string $output): string
    {
        $trimmed = trim($output);
        if ($trimmed === '') {
            return $output;
        }

        $statusCode = http_response_code();
        if (!is_int($statusCode) || $statusCode < 100) {
            $statusCode = 200;
        }

        $looksLikeJson = $trimmed[0] === '{' || $trimmed[0] === '[';
        if (!$looksLikeJson) {
            $isJsonResponse = false;
            foreach (headers_list() as $headerLine) {
                if (stripos($headerLine, 'Content-Type:') === 0
                    && stripos($headerLine, 'json') !== false) {
                    $isJsonResponse = true;
                    break;
                }
            }

            if (($statusCode >= 400 || $isJsonResponse)
                && ipawcus_error_response_contains_technical_details($trimmed)) {
                $safeStatusCode = $statusCode >= 400 ? $statusCode : 500;
                if ($statusCode < 400) {
                    http_response_code($safeStatusCode);
                }
                $redacted = [];
                ipawcus_error_response_log_value('body', $trimmed, $redacted);
                ipawcus_error_response_log(
                    'Suppressed technical details from malformed API response: ' . implode(' | ', $redacted)
                );

                if (!headers_sent()) {
                    header('Content-Type: application/json; charset=utf-8');
                    header('X-Error-Reference-ID: ' . ipawcus_error_response_reference_id());
                    header_remove('Content-Length');
                }

                return (string)json_encode([
                    'success' => false,
                    'code' => 'internal_error',
                    'message' => ipawcus_error_response_public_message($safeStatusCode),
                    'referenceId' => ipawcus_error_response_reference_id(),
                ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
            }

            return $output;
        }

        $payload = json_decode($trimmed, true);
        if (!is_array($payload) || json_last_error() !== JSON_ERROR_NONE) {
            if (ipawcus_error_response_contains_technical_details($trimmed)) {
                $safeStatusCode = $statusCode >= 400 ? $statusCode : 500;
                if ($statusCode < 400) {
                    http_response_code($safeStatusCode);
                }
                $redacted = [];
                ipawcus_error_response_log_value('body', $trimmed, $redacted);
                ipawcus_error_response_log(
                    'Suppressed technical details from malformed JSON response: ' . implode(' | ', $redacted)
                );

                if (!headers_sent()) {
                    header('Content-Type: application/json; charset=utf-8');
                    header('X-Error-Reference-ID: ' . ipawcus_error_response_reference_id());
                    header_remove('Content-Length');
                }

                return (string)json_encode([
                    'success' => false,
                    'code' => 'internal_error',
                    'message' => ipawcus_error_response_public_message($safeStatusCode),
                    'referenceId' => ipawcus_error_response_reference_id(),
                ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
            }

            return $output;
        }

        $redacted = [];
        $sanitized = ipawcus_error_response_sanitize_payload($payload, $statusCode, $redacted);
        if (empty($redacted)) {
            return $output;
        }

        ipawcus_error_response_log(
            'Suppressed technical details from JSON response: ' . implode(' | ', $redacted)
        );

        if (!headers_sent()) {
            header('X-Error-Reference-ID: ' . ipawcus_error_response_reference_id());
            header_remove('Content-Length');
        }

        $encoded = json_encode(
            $sanitized,
            JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE
        );

        return is_string($encoded) ? $encoded : $output;
    }

    function ipawcus_error_response_is_binary_media_route(): bool
    {
        if (defined('IPAWCUS_DISABLE_ERROR_OUTPUT_BUFFER') && IPAWCUS_DISABLE_ERROR_OUTPUT_BUFFER) {
            return true;
        }

        $scriptName = strtolower(basename((string)($_SERVER['SCRIPT_NAME'] ?? '')));
        if ($scriptName === 'upload_media.php') {
            return true;
        }

        $requestPath = strtolower((string)(parse_url((string)($_SERVER['REQUEST_URI'] ?? ''), PHP_URL_PATH) ?: ''));

        return preg_match('#/(?:api/)?uploads/media(?:/|$)#', $requestPath) === 1
            || str_ends_with($requestPath, '/upload_media.php');
    }

    function ipawcus_error_response_discard_own_buffer(): void
    {
        $bufferLevel = (int)($GLOBALS['ipawcus_error_response_buffer_level'] ?? 0);
        if ($bufferLevel <= 0) {
            return;
        }

        while (ob_get_level() >= $bufferLevel) {
            @ob_end_clean();
        }

        unset($GLOBALS['ipawcus_error_response_buffer_level']);
    }

    function ipawcus_error_response_rollback_transaction(): void
    {
        $connection = $GLOBALS['pdo'] ?? null;
        if ($connection instanceof PDO && $connection->inTransaction()) {
            try {
                $connection->rollBack();
            } catch (Throwable $rollbackError) {
                ipawcus_error_response_log_throwable($rollbackError, 'Rollback after API error failed');
            }
        }
    }

    function ipawcus_error_response_emit_internal_error(): void
    {
        ipawcus_error_response_rollback_transaction();
        ipawcus_error_response_discard_own_buffer();

        if (!headers_sent()) {
            header('Content-Type: application/json; charset=utf-8');
            header('Cache-Control: no-store, max-age=0');
            header('X-Error-Reference-ID: ' . ipawcus_error_response_reference_id());
            header_remove('Content-Length');
        }

        http_response_code(500);
        echo json_encode([
            'success' => false,
            'code' => 'internal_error',
            'message' => ipawcus_error_response_public_message(500),
            'referenceId' => ipawcus_error_response_reference_id(),
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    }

    function ipawcus_error_response_handle_exception(Throwable $error): void
    {
        $GLOBALS['ipawcus_error_response_terminal_error_handled'] = true;
        ipawcus_error_response_log_throwable($error);
        ipawcus_error_response_emit_internal_error();
    }

    function ipawcus_error_response_handle_shutdown(): void
    {
        if (!empty($GLOBALS['ipawcus_error_response_terminal_error_handled'])) {
            return;
        }

        $lastError = error_get_last();
        if (!is_array($lastError) || !in_array((int)($lastError['type'] ?? 0), [
            E_ERROR,
            E_PARSE,
            E_CORE_ERROR,
            E_COMPILE_ERROR,
            E_USER_ERROR,
            E_RECOVERABLE_ERROR,
        ], true)) {
            return;
        }

        $GLOBALS['ipawcus_error_response_terminal_error_handled'] = true;
        ipawcus_error_response_log(sprintf(
            'Fatal PHP error: %s in %s:%d',
            (string)($lastError['message'] ?? 'Unknown fatal error'),
            (string)($lastError['file'] ?? 'unknown'),
            (int)($lastError['line'] ?? 0)
        ));
        ipawcus_error_response_emit_internal_error();
    }

    function ipawcus_error_response_bootstrap(): void
    {
        if (!ipawcus_error_response_is_http()
            || !empty($GLOBALS['ipawcus_error_response_bootstrapped'])) {
            return;
        }

        $GLOBALS['ipawcus_error_response_bootstrapped'] = true;
        error_reporting(E_ALL);
        ini_set('display_errors', '0');
        ini_set('display_startup_errors', '0');
        ini_set('log_errors', '1');

        if (!headers_sent()) {
            header('X-Request-ID: ' . ipawcus_error_response_reference_id());
        }

        set_exception_handler('ipawcus_error_response_handle_exception');
        register_shutdown_function('ipawcus_error_response_handle_shutdown');

        if (!ipawcus_error_response_is_binary_media_route()) {
            ob_start('ipawcus_error_response_filter_json');
            $GLOBALS['ipawcus_error_response_buffer_level'] = ob_get_level();
        }
    }
}

ipawcus_error_response_bootstrap();
