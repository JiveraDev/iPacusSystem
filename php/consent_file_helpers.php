<?php

function consent_file_column_exists(PDO $pdo, string $column): bool
{
    $stmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'consent_files'
          AND COLUMN_NAME = ?
    ");
    $stmt->execute([$column]);

    return (int)$stmt->fetchColumn() > 0;
}

function consent_file_ensure_schema(PDO $pdo): void
{
    if (!consent_file_column_exists($pdo, 'pet_owner_contexts')) {
        $pdo->exec("ALTER TABLE consent_files ADD COLUMN pet_owner_contexts TEXT NULL AFTER category");
    }
}

function consent_file_normalize_contexts($value): string
{
    $allowed = ['online-consultation', 'boarding', 'home-service'];
    $items = [];

    if (is_array($value)) {
        $items = $value;
    } elseif (is_string($value) && trim($value) !== '') {
        $decoded = json_decode($value, true);
        $items = is_array($decoded) ? $decoded : preg_split('/\s*,\s*/', $value);
    }

    $normalized = [];
    foreach ($items as $item) {
        $key = strtolower(trim((string)$item));
        if (in_array($key, $allowed, true) && !in_array($key, $normalized, true)) {
            $normalized[] = $key;
        }
    }

    return json_encode($normalized);
}
