<?php

function clinical_record_nullable_text($value): ?string
{
    if ($value === null) {
        return null;
    }

    $text = trim((string)$value);

    return $text !== '' ? $text : null;
}

function clinical_record_normalized_text($value): string
{
    $text = clinical_record_nullable_text($value);

    return $text ?? '';
}

function clinical_record_text_length(string $value): int
{
    return function_exists('mb_strlen')
        ? mb_strlen($value, 'UTF-8')
        : strlen($value);
}

/**
 * Removes only high-confidence propagation duplicates.
 *
 * Two matching fields are preserved because a clinician may intentionally
 * repeat a finding. Three matching fields are collapsed only when Diagnosis
 * is one of them and the repeated text is short. Four or more exact matches
 * are treated as propagated form data. The authoritative Diagnosis value is
 * retained whenever present.
 */
function clinical_record_sanitize_repeated_fields(
    array $fields,
    array $preferredKeys = ['diagnosis']
): array {
    $cleaned = [];
    $keysByValue = [];

    foreach ($fields as $key => $value) {
        $cleaned[$key] = clinical_record_nullable_text($value);
        $normalized = clinical_record_normalized_text($value);
        if ($normalized !== '') {
            $keysByValue[$normalized][] = $key;
        }
    }

    foreach ($keysByValue as $normalized => $matchingKeys) {
        $matchCount = count($matchingKeys);
        if ($matchCount < 3) {
            continue;
        }

        $preferredWinner = null;
        foreach ($preferredKeys as $preferredKey) {
            if (in_array($preferredKey, $matchingKeys, true)) {
                $preferredWinner = $preferredKey;
                break;
            }
        }

        $isHighConfidencePropagation = $matchCount >= 4
            || ($preferredWinner !== null && clinical_record_text_length($normalized) <= 80);
        if (!$isHighConfidencePropagation) {
            continue;
        }

        $winner = $preferredWinner ?: $matchingKeys[0];
        foreach ($matchingKeys as $key) {
            if ($key !== $winner) {
                $cleaned[$key] = null;
            }
        }
    }

    return $cleaned;
}

function clinical_record_sanitize_response_record(
    array $record,
    array $fieldKeys = [
        'chiefComplaint',
        'majorSymptoms',
        'symptoms',
        'physicalExam',
        'diagnosis',
        'recommendations',
        'treatment',
        'medications',
        'labResults',
        'notes',
    ]
): array {
    $fields = [];
    foreach ($fieldKeys as $key) {
        if (array_key_exists($key, $record)) {
            $fields[$key] = $record[$key];
        }
    }

    $cleaned = clinical_record_sanitize_repeated_fields($fields);
    foreach ($cleaned as $key => $value) {
        $record[$key] = $value ?? '';
    }

    return $record;
}
