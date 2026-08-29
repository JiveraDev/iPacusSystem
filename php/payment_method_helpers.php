<?php

function ipawcus_payment_method_key($value): string
{
    $key = strtolower(trim((string)$value));
    $key = preg_replace('/[^a-z0-9_]+/', '_', $key);
    return trim((string)$key, '_');
}

function ipawcus_payment_method_is_allowed(PDO $pdo, $value, bool $allowCash = true): bool
{
    $key = ipawcus_payment_method_key($value);
    if ($allowCash && $key === 'cash') {
        return true;
    }
    if ($key === '') {
        return false;
    }

    try {
        $stmt = $pdo->prepare(
            'SELECT COUNT(*) FROM payment_methods WHERE method_key = ? AND is_active = 1'
        );
        $stmt->execute([$key]);
        return (int)$stmt->fetchColumn() > 0;
    } catch (Throwable $error) {
        error_log('Payment method availability check failed: ' . $error->getMessage());
        return false;
    }
}

function ipawcus_payment_method_require(PDO $pdo, $value, bool $allowCash = true): string
{
    $key = ipawcus_payment_method_key($value);
    if (!ipawcus_payment_method_is_allowed($pdo, $key, $allowCash)) {
        throw new InvalidArgumentException('Select an active payment method.');
    }
    return $key;
}
