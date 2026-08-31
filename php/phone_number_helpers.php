<?php

function normalizePhilippinePhoneNumber($value): string
{
    $digits = philippinePhoneDigits($value);

    if (isPhilippinePhonePrefixOnly($value)) {
        return '';
    }

    if (str_starts_with($digits, '639')) {
        return substr($digits, 0, 12);
    }

    return substr($digits, 0, 11);
}

function philippinePhoneDigits($value): string
{
    return preg_replace('/\D+/', '', (string)($value ?? ''));
}

function isPhilippinePhonePrefixOnly($value): bool
{
    $text = trim((string)($value ?? ''));
    $digits = philippinePhoneDigits($value);

    return $text === '+639' || $digits === '639';
}

function isValidPhilippinePhoneNumber($value, bool $optional = false): bool
{
    $text = ltrim((string)($value ?? ''));
    $digits = philippinePhoneDigits($value);

    if ($optional && ($digits === '' || isPhilippinePhonePrefixOnly($value))) {
        return true;
    }

    if (str_starts_with($text, '+')) {
        return (bool)preg_match('/^639\d{9}$/', $digits);
    }

    return (bool)preg_match('/^(09\d{9}|639\d{9})$/', $digits);
}

function rejectInvalidPhilippinePhoneNumber($value, string $label = 'Phone number', bool $optional = false): string
{
    $digits = normalizePhilippinePhoneNumber($value);

    if (!isValidPhilippinePhoneNumber($value, $optional)) {
        http_response_code(400);
        echo json_encode([
            'message' => "{$label} must be a complete Philippine mobile number after +639.",
        ]);
        exit;
    }

    return $digits;
}
