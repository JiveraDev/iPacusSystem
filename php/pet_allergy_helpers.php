<?php

function pet_allergy_table_exists(PDO $pdo): bool
{
    static $cache = [];

    $connectionId = spl_object_id($pdo);
    if (array_key_exists($connectionId, $cache)) {
        return $cache[$connectionId];
    }

    $stmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM information_schema.tables
        WHERE table_schema = DATABASE()
          AND table_name = 'pet_allergies'
    ");
    $stmt->execute();
    $cache[$connectionId] = (int)$stmt->fetchColumn() > 0;

    return $cache[$connectionId];
}

function pet_allergy_column_exists(PDO $pdo, string $columnName): bool
{
    static $cache = [];

    $connectionId = spl_object_id($pdo);
    $cacheKey = $connectionId . ':' . $columnName;
    if (array_key_exists($cacheKey, $cache)) {
        return $cache[$cacheKey];
    }

    $stmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 'pet_allergies'
          AND column_name = ?
    ");
    $stmt->execute([$columnName]);
    $cache[$cacheKey] = (int)$stmt->fetchColumn() > 0;

    return $cache[$cacheKey];
}

function pet_allergy_clean_text($value): string
{
    return trim(preg_replace('/\s+/u', ' ', (string)($value ?? '')) ?? '');
}

function pet_allergy_compare_text($value): string
{
    return strtolower(pet_allergy_clean_text($value));
}

function pet_allergy_forget_cache(PDO $pdo, int $petId): void
{
    $connectionId = spl_object_id($pdo);
    unset($GLOBALS['pet_allergy_entry_cache'][$connectionId][$petId]);
}

function pet_allergy_normalized_entries(PDO $pdo, int $petId): array
{
    if ($petId <= 0 || !pet_allergy_table_exists($pdo)) {
        return [];
    }

    $connectionId = spl_object_id($pdo);
    if (isset($GLOBALS['pet_allergy_entry_cache'][$connectionId])
        && array_key_exists($petId, $GLOBALS['pet_allergy_entry_cache'][$connectionId])) {
        return $GLOBALS['pet_allergy_entry_cache'][$connectionId][$petId];
    }

    $reactionSelect = pet_allergy_column_exists($pdo, 'reaction') ? 'reaction' : 'NULL AS reaction';
    $sourceSelect = pet_allergy_column_exists($pdo, 'source')
        ? 'source'
        : (pet_allergy_column_exists($pdo, 'source_type') ? 'source_type AS source' : 'NULL AS source');
    $verificationSelect = pet_allergy_column_exists($pdo, 'verification_status')
        ? 'verification_status'
        : 'NULL AS verification_status';
    $verifiedAtSelect = pet_allergy_column_exists($pdo, 'verified_at')
        ? 'verified_at'
        : 'NULL AS verified_at';
    $stmt = $pdo->prepare("
        SELECT
            allergy_id,
            allergen,
            severity,
            {$reactionSelect},
            {$sourceSelect},
            {$verificationSelect},
            {$verifiedAtSelect}
        FROM pet_allergies
        WHERE pet_id = ?
        ORDER BY allergy_id ASC
    ");
    $stmt->execute([$petId]);

    $entries = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $allergen = pet_allergy_clean_text($row['allergen'] ?? '');
        if ($allergen === '') {
            continue;
        }

        $entries[] = [
            'id' => (int)$row['allergy_id'],
            'allergen' => $allergen,
            'severity' => pet_allergy_clean_text($row['severity'] ?? '') ?: 'Known',
            'reaction' => pet_allergy_clean_text($row['reaction'] ?? ''),
            'recordSource' => $row['source'] ?? null,
            'verificationStatus' => $row['verification_status'] ?? null,
            'verifiedAt' => $row['verified_at'] ?? null,
            'source' => 'normalized',
            'isLegacy' => false,
        ];
    }

    $GLOBALS['pet_allergy_entry_cache'][$connectionId][$petId] = $entries;

    return $entries;
}

function pet_allergy_effective_entries(PDO $pdo, int $petId, $legacyValue = null): array
{
    $entries = pet_allergy_normalized_entries($pdo, $petId);
    $legacyText = pet_allergy_clean_text($legacyValue);

    if ($legacyText === '') {
        return $entries;
    }

    $normalizedSummary = implode('; ', array_column($entries, 'allergen'));
    $legacyComparison = pet_allergy_compare_text($legacyText);
    $legacyAlreadyRepresented = $normalizedSummary !== ''
        && pet_allergy_compare_text($normalizedSummary) === $legacyComparison;

    if (!$legacyAlreadyRepresented) {
        foreach ($entries as $entry) {
            if (pet_allergy_compare_text($entry['allergen'] ?? '') === $legacyComparison) {
                $legacyAlreadyRepresented = true;
                break;
            }
        }
    }

    if (!$legacyAlreadyRepresented) {
        $entries[] = [
            'id' => 'legacy-' . $petId,
            'allergen' => $legacyText,
            'severity' => 'Known',
            'reaction' => '',
            'recordSource' => 'legacy',
            'verificationStatus' => 'needs_review',
            'verifiedAt' => null,
            'source' => 'legacy',
            'isLegacy' => true,
        ];
    }

    return $entries;
}

function pet_allergy_effective_text(PDO $pdo, int $petId, $legacyValue = null): ?string
{
    $entries = pet_allergy_effective_entries($pdo, $petId, $legacyValue);
    if (!$entries) {
        return null;
    }

    $seen = [];
    $labels = [];
    foreach ($entries as $entry) {
        $label = pet_allergy_clean_text($entry['allergen'] ?? '');
        $comparison = pet_allergy_compare_text($label);
        if ($comparison === '' || isset($seen[$comparison])) {
            continue;
        }

        $seen[$comparison] = true;
        $labels[] = $label;
    }

    return $labels ? implode('; ', $labels) : null;
}

function pet_allergy_sync_legacy_summary(PDO $pdo, int $petId): void
{
    if ($petId <= 0 || !pet_allergy_table_exists($pdo)) {
        return;
    }

    $entries = pet_allergy_normalized_entries($pdo, $petId);
    $summary = $entries ? implode('; ', array_column($entries, 'allergen')) : null;

    $stmt = $pdo->prepare("UPDATE pets_information SET pet_allergies = ? WHERE pet_id = ?");
    $stmt->execute([$summary, $petId]);
}

function pet_allergy_insert(
    PDO $pdo,
    int $petId,
    string $allergen,
    string $severity = 'Known',
    ?int $actorUserId = null,
    string $sourceType = 'legacy'
): int {
    $columns = ['pet_id', 'allergen', 'severity'];
    $values = [$petId, $allergen, $severity];

    $storedSource = $sourceType === 'legacy' ? 'legacy_import' : $sourceType;
    if (pet_allergy_column_exists($pdo, 'source')) {
        $columns[] = 'source';
        $values[] = $storedSource;
    } elseif (pet_allergy_column_exists($pdo, 'source_type')) {
        $columns[] = 'source_type';
        $values[] = $storedSource;
    }
    if ($actorUserId !== null && $actorUserId > 0 && pet_allergy_column_exists($pdo, 'created_by_user_id')) {
        $columns[] = 'created_by_user_id';
        $values[] = $actorUserId;
    }
    if ($actorUserId !== null && $actorUserId > 0 && pet_allergy_column_exists($pdo, 'updated_by_user_id')) {
        $columns[] = 'updated_by_user_id';
        $values[] = $actorUserId;
    }
    if (pet_allergy_column_exists($pdo, 'verification_status')) {
        $columns[] = 'verification_status';
        $values[] = $sourceType === 'clinical' ? 'verified' : 'needs_review';
    }
    if (
        $sourceType === 'clinical'
        && $actorUserId !== null
        && $actorUserId > 0
        && pet_allergy_column_exists($pdo, 'verified_by_user_id')
    ) {
        $columns[] = 'verified_by_user_id';
        $values[] = $actorUserId;
    }
    if ($sourceType === 'clinical' && pet_allergy_column_exists($pdo, 'verified_at')) {
        $columns[] = 'verified_at';
        $values[] = date('Y-m-d H:i:s');
    }

    $placeholders = implode(', ', array_fill(0, count($columns), '?'));
    $stmt = $pdo->prepare(
        'INSERT INTO pet_allergies (' . implode(', ', $columns) . ") VALUES ({$placeholders})"
    );
    $stmt->execute($values);
    pet_allergy_forget_cache($pdo, $petId);

    return (int)$pdo->lastInsertId();
}

function pet_allergy_import_legacy(
    PDO $pdo,
    int $petId,
    $legacyValue,
    ?int $actorUserId = null,
    string $sourceType = 'legacy'
): ?int
{
    $legacyText = pet_allergy_clean_text($legacyValue);
    if ($petId <= 0 || $legacyText === '' || !pet_allergy_table_exists($pdo)) {
        return null;
    }

    $entries = pet_allergy_normalized_entries($pdo, $petId);
    $summary = implode('; ', array_column($entries, 'allergen'));
    $comparison = pet_allergy_compare_text($legacyText);

    if ($summary !== '' && pet_allergy_compare_text($summary) === $comparison) {
        return null;
    }

    foreach ($entries as $entry) {
        if (pet_allergy_compare_text($entry['allergen'] ?? '') === $comparison) {
            return (int)$entry['id'];
        }
    }

    return pet_allergy_insert($pdo, $petId, $legacyText, 'Known', $actorUserId, $sourceType);
}

function pet_allergy_merge_from_legacy(
    PDO $pdo,
    int $petId,
    $legacyValue,
    ?int $actorUserId = null,
    string $sourceType = 'legacy'
): void
{
    if ($petId <= 0 || !pet_allergy_table_exists($pdo)) {
        return;
    }

    $legacyText = pet_allergy_clean_text($legacyValue);
    if ($legacyText !== '') {
        pet_allergy_import_legacy($pdo, $petId, $legacyText, $actorUserId, $sourceType);
    }

    pet_allergy_forget_cache($pdo, $petId);
    pet_allergy_sync_legacy_summary($pdo, $petId);
}
