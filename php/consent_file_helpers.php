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
        throw new RuntimeException('consent_files.pet_owner_contexts is missing. Run the approved consent-file deployment SQL before managing consent assignments.');
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
            break;
        }
    }

    return json_encode($normalized);
}

function consent_file_context_array($value): array
{
    $json = consent_file_normalize_contexts($value);
    $decoded = json_decode($json, true);

    return is_array($decoded) ? $decoded : [];
}

function consent_file_enforce_unique_context(PDO $pdo, string $contextsJson, int $currentFileId): void
{
    $contexts = consent_file_context_array($contextsJson);
    if (empty($contexts)) {
        return;
    }

    $selectedContext = $contexts[0];
    $stmt = $pdo->prepare("
        SELECT file_id, pet_owner_contexts
        FROM consent_files
        WHERE file_id <> ?
          AND pet_owner_contexts IS NOT NULL
          AND TRIM(pet_owner_contexts) <> ''
    ");
    $stmt->execute([$currentFileId]);

    $update = $pdo->prepare("UPDATE consent_files SET pet_owner_contexts = ? WHERE file_id = ?");
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $rowContexts = consent_file_context_array($row['pet_owner_contexts'] ?? '');
        if (!in_array($selectedContext, $rowContexts, true)) {
            continue;
        }

        $nextContexts = array_values(array_filter(
            $rowContexts,
            static fn($context) => $context !== $selectedContext
        ));
        $update->execute([json_encode($nextContexts), (int)$row['file_id']]);
    }
}
