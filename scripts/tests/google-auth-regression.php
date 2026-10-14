<?php
namespace Google {
    // CLI-only fixture: no Google calls, signed-in session, or real identity.
    class Client {
        public function __construct(array $options) {}
        public function verifyIdToken(string $credential) {
            if ($credential === 'malformed') throw new \UnexpectedValueException('Malformed JWT');
            $payload = ['aud' => 'test.apps.googleusercontent.com', 'exp' => time() + 300, 'iss' => 'https://accounts.google.com', 'sub' => 'fixture', 'email' => 'fixture@example.com', 'email_verified' => true];
            if ($credential === 'missing-audience') { unset($payload['aud']); return $payload; }
            if ($credential === 'wrong-audience') { $payload['aud'] = 'other.apps.googleusercontent.com'; return $payload; }
            if ($credential === 'missing-expiry') { unset($payload['exp']); return $payload; }
            if ($credential === 'expired') { $payload['exp'] = time() - 1; return $payload; }
            return false;
        }
    }
}
namespace {
    if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
    class GoogleFixturePDO extends PDO { public function __construct() {} }
    $GLOBALS['pdo'] = new GoogleFixturePDO();
    require_once __DIR__ . '/../../php/google_auth_helpers.php';
    putenv('GOOGLE_CLIENT_ID=test.apps.googleusercontent.com');
    register_shutdown_function(static function (): void {
        if (http_response_code() !== 401) {
            fwrite(STDERR, "FAIL: Invalid Google credential must return 401.\n");
            exit(1);
        }
    });
    googleAuthVerifyCredential(ltrim($argv[1] ?? 'invalid', '-'));
    throw new RuntimeException('Invalid credential was accepted');
}
