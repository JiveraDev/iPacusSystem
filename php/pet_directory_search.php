<?php

function pet_directory_table_exists(PDO $pdo, string $tableName): bool
{
    static $cache = [];
    $key = spl_object_id($pdo) . ':' . $tableName;
    if (array_key_exists($key, $cache)) {
        return $cache[$key];
    }

    $stmt = $pdo->prepare("\n        SELECT COUNT(*)\n        FROM information_schema.tables\n        WHERE table_schema = DATABASE()\n          AND table_name = ?\n    ");
    $stmt->execute([$tableName]);
    $cache[$key] = (int)$stmt->fetchColumn() > 0;

    return $cache[$key];
}

function pet_directory_column_exists(PDO $pdo, string $tableName, string $columnName): bool
{
    static $cache = [];
    $key = spl_object_id($pdo) . ':' . $tableName . ':' . $columnName;
    if (array_key_exists($key, $cache)) {
        return $cache[$key];
    }

    $stmt = $pdo->prepare("\n        SELECT COUNT(*)\n        FROM information_schema.columns\n        WHERE table_schema = DATABASE()\n          AND table_name = ?\n          AND column_name = ?\n    ");
    $stmt->execute([$tableName, $columnName]);
    $cache[$key] = (int)$stmt->fetchColumn() > 0;

    return $cache[$key];
}

function pet_directory_clean_text($value): string
{
    $text = strip_tags((string)($value ?? ''));
    $text = preg_replace('/\s+/u', ' ', $text) ?? $text;

    return trim($text);
}

function pet_directory_contains($value, string $query): bool
{
    $text = pet_directory_clean_text($value);
    if ($text === '') {
        return false;
    }

    return function_exists('mb_stripos')
        ? mb_stripos($text, $query, 0, 'UTF-8') !== false
        : stripos($text, $query) !== false;
}

function pet_directory_snippet($value, string $query, int $limit = 210): string
{
    $text = pet_directory_clean_text($value);
    if ($text === '') {
        return '';
    }

    $length = function_exists('mb_strlen') ? mb_strlen($text, 'UTF-8') : strlen($text);
    if ($length <= $limit) {
        return $text;
    }

    $position = function_exists('mb_stripos')
        ? mb_stripos($text, $query, 0, 'UTF-8')
        : stripos($text, $query);
    $position = $position === false ? 0 : (int)$position;
    $start = max(0, $position - (int)floor($limit / 3));
    $snippet = function_exists('mb_substr')
        ? mb_substr($text, $start, $limit, 'UTF-8')
        : substr($text, $start, $limit);

    return ($start > 0 ? '…' : '') . rtrim($snippet) . ($start + $limit < $length ? '…' : '');
}

function pet_directory_pet(array $row): array
{
    return [
        'id' => $row['pet_sharable_ID'] ?? '',
        'db_id' => (int)($row['pet_id'] ?? 0),
        'petName' => $row['pet_name'] ?? 'Unnamed Pet',
        'name' => $row['pet_name'] ?? 'Unnamed Pet',
        'species' => $row['pet_species'] ?? '',
        'breed' => $row['pet_breed'] ?? '',
        'birthDate' => $row['pet_BDAY'] ?? null,
        'gender' => $row['pet_gender'] ?? '',
        'status' => $row['pet_status'] ?? '',
        'age' => $row['pet_age'] ?? '',
        'tempOwnerName' => $row['pet_Temp_owner'] ?? '',
        'ownerName' => pet_directory_clean_text($row['owner_names'] ?? ''),
        'profileImage' => $row['setpetImage_url'] ?? '',
        'isArchived' => (int)($row['is_archived'] ?? 0) === 1,
        'searchMatches' => [],
        'searchScore' => 0,
    ];
}

function pet_directory_add_match(array &$results, array $row, array $match, int $score): void
{
    $petId = (int)($row['pet_id'] ?? 0);
    $text = pet_directory_clean_text($match['text'] ?? '');
    if ($petId <= 0 || $text === '') {
        return;
    }

    if (!isset($results[$petId])) {
        $results[$petId] = pet_directory_pet($row);
    }

    $match['text'] = $text;
    $dedupeKey = strtolower(implode('|', [
        $match['category'] ?? '',
        $match['targetType'] ?? '',
        $match['sourceId'] ?? '',
        $match['itemId'] ?? '',
        $text,
    ]));

    foreach ($results[$petId]['searchMatches'] as $existing) {
        if (($existing['_dedupeKey'] ?? '') === $dedupeKey) {
            return;
        }
    }

    $results[$petId]['searchMatches'][] = [
        ...$match,
        '_dedupeKey' => $dedupeKey,
    ];
    $results[$petId]['searchScore'] = max((int)$results[$petId]['searchScore'], $score);
}

function pet_directory_profile_matches(PDO $pdo, string $query, string $like, array &$results): void
{
    $stmt = $pdo->prepare("\n        SELECT\n            p.*,\n            (\n                SELECT GROUP_CONCAT(\n                    DISTINCT NULLIF(TRIM(CONCAT_WS(' ', u.first_Name, u.last_Name)), '')\n                    ORDER BY po.link_id ASC\n                    SEPARATOR ', '\n                )\n                FROM pet_ownership po\n                JOIN users u ON u.user_id = po.user_id\n                WHERE po.pet_id = p.pet_id\n            ) AS owner_names\n        FROM pets_information p\n        WHERE COALESCE(p.pet_sharable_ID, '') <> 'PET-WALK-IN-SALE'\n          AND (\n              LOWER(CONCAT_WS(' ',\n                  p.pet_name, p.pet_sharable_ID, p.pet_species, p.pet_breed,\n                  p.pet_gender, p.pet_status, p.pet_Temp_owner, p.pet_allergies\n              )) LIKE ?\n              OR EXISTS (\n                  SELECT 1\n                  FROM pet_ownership po_search\n                  JOIN users owner_search ON owner_search.user_id = po_search.user_id\n                  WHERE po_search.pet_id = p.pet_id\n                    AND LOWER(CONCAT_WS(' ', owner_search.first_Name, owner_search.last_Name, owner_search.mail_Address)) LIKE ?\n              )\n          )\n        ORDER BY p.pet_name, p.pet_id\n        LIMIT 60\n    ");
    $stmt->execute([$like, $like]);

    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $profileFields = [
            ['Pet name', $row['pet_name'] ?? '', 'profile', 110],
            ['Clinic ID', $row['pet_sharable_ID'] ?? '', 'profile', 105],
            ['Owner', trim((string)(($row['owner_names'] ?? '') ?: ($row['pet_Temp_owner'] ?? ''))), 'profile', 90],
            ['Species', $row['pet_species'] ?? '', 'profile', 72],
            ['Breed', $row['pet_breed'] ?? '', 'profile', 72],
            ['Status', $row['pet_status'] ?? '', 'profile', 74],
        ];

        foreach ($profileFields as [$label, $value, $targetType, $score]) {
            if (!pet_directory_contains($value, $query)) {
                continue;
            }

            $normalizedValue = strtolower(pet_directory_clean_text($value));
            $normalizedQuery = strtolower($query);
            $exactBonus = $normalizedValue === $normalizedQuery ? 20 : (str_starts_with($normalizedValue, $normalizedQuery) ? 10 : 0);
            pet_directory_add_match($results, $row, [
                'id' => 'profile-' . (int)$row['pet_id'] . '-' . strtolower(str_replace(' ', '-', $label)),
                'category' => $label,
                'text' => pet_directory_snippet($value, $query),
                'targetType' => $targetType,
            ], $score + $exactBonus);
        }

        if (pet_directory_contains($row['pet_allergies'] ?? '', $query)) {
            pet_directory_add_match($results, $row, [
                'id' => 'legacy-allergy-' . (int)$row['pet_id'],
                'category' => 'Allergy',
                'text' => pet_directory_snippet($row['pet_allergies'], $query),
                'targetType' => 'allergies',
            ], 92);
        }
    }
}

function pet_directory_allergy_matches(PDO $pdo, string $query, string $like, array &$results): void
{
    if (!pet_directory_table_exists($pdo, 'pet_allergies')) {
        return;
    }

    $reactionSelect = pet_directory_column_exists($pdo, 'pet_allergies', 'reaction')
        ? 'pa.reaction'
        : "''";
    $stmt = $pdo->prepare("\n        SELECT p.*, pa.allergy_id, pa.allergen, pa.severity, {$reactionSelect}\n        FROM pet_allergies pa\n        JOIN pets_information p ON p.pet_id = pa.pet_id\n        WHERE LOWER(CONCAT_WS(' ', pa.allergen, pa.severity, {$reactionSelect})) LIKE ?\n        ORDER BY pa.allergy_id DESC\n        LIMIT 120\n    ");
    $stmt->execute([$like]);

    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $text = implode(' — ', array_filter([
            pet_directory_clean_text($row['allergen'] ?? ''),
            pet_directory_clean_text($row['reaction'] ?? ''),
            pet_directory_clean_text($row['severity'] ?? ''),
        ]));
        pet_directory_add_match($results, $row, [
            'id' => 'allergy-' . (int)$row['allergy_id'],
            'category' => 'Allergy',
            'text' => pet_directory_snippet($text, $query),
            'targetType' => 'allergies',
            'sourceId' => (int)$row['allergy_id'],
        ], 96);
    }
}

function pet_directory_diagnosis_matches(PDO $pdo, string $query, string $like, array &$results): void
{
    if (!pet_directory_table_exists($pdo, 'vet_diagnoses')) {
        return;
    }

    $stmt = $pdo->prepare("\n        SELECT p.*, vd.*\n        FROM vet_diagnoses vd\n        JOIN pets_information p ON p.pet_id = vd.pet_id\n        WHERE LOWER(CONCAT_WS(' ',\n            vd.service_name, vd.chief_complaint, vd.major_symptoms, vd.symptoms,\n            vd.physical_exam, vd.diagnosis, vd.treatment, vd.lab_results, vd.notes,\n            vd.custom_sections\n        )) LIKE ?\n        ORDER BY COALESCE(vd.finalized_at, vd.created_at) DESC, vd.diagnosis_id DESC\n        LIMIT 180\n    ");
    $stmt->execute([$like]);

    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $fields = [
            ['Diagnosis', $row['diagnosis'] ?? '', 98],
            ['Symptoms', $row['symptoms'] ?? '', 96],
            ['Major symptoms', $row['major_symptoms'] ?? '', 96],
            ['Reason for visit', $row['chief_complaint'] ?? '', 92],
            ['Physical examination', $row['physical_exam'] ?? '', 84],
            ['Treatment', $row['treatment'] ?? '', 82],
            ['Laboratory result', $row['lab_results'] ?? '', 82],
            ['Clinical note', $row['notes'] ?? '', 78],
            ['Clinical section', $row['custom_sections'] ?? '', 76],
            ['Service', $row['service_name'] ?? '', 72],
        ];

        foreach ($fields as [$label, $value, $score]) {
            if (!pet_directory_contains($value, $query)) {
                continue;
            }

            pet_directory_add_match($results, $row, [
                'id' => 'diagnosis-' . (int)$row['diagnosis_id'] . '-' . strtolower(str_replace(' ', '-', $label)),
                'category' => $label,
                'text' => pet_directory_snippet($value, $query),
                'targetType' => 'diagnosis',
                'sourceId' => (int)$row['diagnosis_id'],
                'diagnosisId' => (int)$row['diagnosis_id'],
                'serviceDate' => $row['finalized_at'] ?? $row['created_at'] ?? null,
            ], $score);
        }
    }
}

function pet_directory_online_diagnosis_matches(PDO $pdo, string $query, string $like, array &$results): void
{
    if (!pet_directory_table_exists($pdo, 'online_consultation_diagnoses')
        || !pet_directory_table_exists($pdo, 'bookings')) {
        return;
    }

    $stmt = $pdo->prepare("\n        SELECT p.*, ocd.*\n        FROM online_consultation_diagnoses ocd\n        JOIN bookings b ON b.booking_id = ocd.booking_id\n        JOIN pets_information p ON p.pet_id = b.pet_id\n        WHERE LOWER(CONCAT_WS(' ',\n            ocd.diagnosis, ocd.recommendations, ocd.treatment, ocd.medications,\n            ocd.notes, ocd.symptoms, ocd.lab_tests\n        )) LIKE ?\n        ORDER BY COALESCE(ocd.finalized_at, ocd.created_at) DESC, ocd.diagnosis_id DESC\n        LIMIT 100\n    ");
    $stmt->execute([$like]);

    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $fields = [
            ['Online diagnosis', $row['diagnosis'] ?? '', 96],
            ['Online symptoms', $row['symptoms'] ?? '', 94],
            ['Recommendation', $row['recommendations'] ?? '', 82],
            ['Treatment', $row['treatment'] ?? '', 82],
            ['Medication', $row['medications'] ?? '', 82],
            ['Clinical note', $row['notes'] ?? '', 78],
            ['Laboratory result', $row['lab_tests'] ?? '', 80],
        ];

        foreach ($fields as [$label, $value, $score]) {
            if (!pet_directory_contains($value, $query)) {
                continue;
            }

            pet_directory_add_match($results, $row, [
                'id' => 'online-diagnosis-' . (int)$row['diagnosis_id'] . '-' . strtolower(str_replace(' ', '-', $label)),
                'category' => $label,
                'text' => pet_directory_snippet($value, $query),
                'targetType' => 'online-diagnosis',
                'sourceId' => (int)$row['diagnosis_id'],
                'onlineDiagnosisId' => (int)$row['diagnosis_id'],
                'bookingId' => (int)($row['booking_id'] ?? 0),
                'serviceDate' => $row['finalized_at'] ?? $row['created_at'] ?? null,
            ], $score);
        }
    }
}

function pet_directory_organized_matches(PDO $pdo, string $query, string $like, array &$results): void
{
    if (!pet_directory_table_exists($pdo, 'pet_medical_record_groups')) {
        return;
    }

    $groupStmt = $pdo->prepare("\n        SELECT p.*, g.group_id, g.title AS group_title, g.summary AS group_summary\n        FROM pet_medical_record_groups g\n        JOIN pets_information p ON p.pet_id = g.pet_id\n        WHERE LOWER(CONCAT_WS(' ', g.title, g.summary)) LIKE ?\n        ORDER BY g.updated_at DESC, g.group_id DESC\n        LIMIT 80\n    ");
    $groupStmt->execute([$like]);
    foreach ($groupStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $text = pet_directory_contains($row['group_summary'] ?? '', $query)
            ? $row['group_summary']
            : $row['group_title'];
        pet_directory_add_match($results, $row, [
            'id' => 'organized-group-' . (int)$row['group_id'],
            'category' => 'Medical summary',
            'text' => pet_directory_snippet($text, $query),
            'targetType' => 'organized-group',
            'groupId' => (int)$row['group_id'],
        ], 84);
    }

    if (!pet_directory_table_exists($pdo, 'pet_medical_record_group_items')) {
        return;
    }

    $itemStmt = $pdo->prepare("\n        SELECT\n            p.*, g.group_id, i.item_id, i.source_type, i.source_id,\n            i.title AS item_title, i.summary AS item_summary, i.revision_notes, i.source_snapshot\n        FROM pet_medical_record_group_items i\n        JOIN pet_medical_record_groups g ON g.group_id = i.group_id\n        JOIN pets_information p ON p.pet_id = g.pet_id\n        WHERE LOWER(CONCAT_WS(' ', i.title, i.summary, i.revision_notes, i.source_snapshot)) LIKE ?\n        ORDER BY i.updated_at DESC, i.item_id DESC\n        LIMIT 120\n    ");
    $itemStmt->execute([$like]);
    foreach ($itemStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $candidates = [
            ['Medical summary', $row['item_summary'] ?? ''],
            ['Veterinarian revision', $row['revision_notes'] ?? ''],
            ['Clinical record', $row['source_snapshot'] ?? ''],
            ['Medical record', $row['item_title'] ?? ''],
        ];

        foreach ($candidates as [$label, $value]) {
            if (!pet_directory_contains($value, $query)) {
                continue;
            }

            pet_directory_add_match($results, $row, [
                'id' => 'organized-item-' . (int)$row['item_id'] . '-' . strtolower(str_replace(' ', '-', $label)),
                'category' => $label,
                'text' => pet_directory_snippet($value, $query),
                'targetType' => 'organized-item',
                'groupId' => (int)$row['group_id'],
                'itemId' => (int)$row['item_id'],
                'sourceType' => $row['source_type'] ?? '',
                'sourceId' => $row['source_id'] !== null ? (int)$row['source_id'] : null,
            ], 82);
            break;
        }
    }
}

function pet_directory_search(PDO $pdo, string $rawQuery): void
{
    try {
        $query = pet_directory_clean_text($rawQuery);
        $queryLength = function_exists('mb_strlen') ? mb_strlen($query, 'UTF-8') : strlen($query);
        if ($queryLength < 2) {
            echo json_encode([]);
            return;
        }
        if ($queryLength > 100) {
            $query = function_exists('mb_substr')
                ? mb_substr($query, 0, 100, 'UTF-8')
                : substr($query, 0, 100);
        }

        $like = '%' . strtolower($query) . '%';
        $results = [];

        pet_directory_profile_matches($pdo, $query, $like, $results);
        pet_directory_allergy_matches($pdo, $query, $like, $results);
        pet_directory_diagnosis_matches($pdo, $query, $like, $results);
        pet_directory_online_diagnosis_matches($pdo, $query, $like, $results);
        pet_directory_organized_matches($pdo, $query, $like, $results);

        $includeArchived = in_array(strtolower((string)($_GET['includeArchived'] ?? '')), ['1', 'true', 'yes'], true);
        $formatted = array_values(array_filter($results, static function (array $pet) use ($includeArchived): bool {
            return $includeArchived || empty($pet['isArchived']);
        }));
        foreach ($formatted as &$pet) {
            usort($pet['searchMatches'], function (array $left, array $right): int {
                return strcmp((string)($left['category'] ?? ''), (string)($right['category'] ?? ''));
            });
            $pet['searchMatches'] = array_map(function (array $match): array {
                unset($match['_dedupeKey']);
                return $match;
            }, array_slice($pet['searchMatches'], 0, 8));
        }
        unset($pet);

        usort($formatted, function (array $left, array $right): int {
            $scoreCompare = (int)$right['searchScore'] <=> (int)$left['searchScore'];
            return $scoreCompare !== 0
                ? $scoreCompare
                : strcasecmp((string)$left['name'], (string)$right['name']);
        });

        echo json_encode(array_slice($formatted, 0, 40));
    } catch (Throwable $error) {
        error_log('Pet directory clinical search failed: ' . $error->getMessage());
        http_response_code(500);
        echo json_encode(['message' => 'Pet health search is temporarily unavailable. Please try again.']);
    }
}
