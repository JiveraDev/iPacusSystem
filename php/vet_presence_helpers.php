<?php

function vet_presence_state(?array $saved, ?DateTimeImmutable $now = null): array
{
    $timezone = new DateTimeZone('Asia/Manila');
    $now = ($now ?? new DateTimeImmutable('now', $timezone))->setTimezone($timezone);
    $today = $now->format('Y-m-d');
    return [
        'isIn' => ($saved['date'] ?? '') === $today ? ($saved['isIn'] ?? true) !== false : true,
        'date' => $today,
        'resetsAt' => $now->modify('tomorrow')->setTime(0, 0)->format(DateTimeInterface::ATOM),
        'timezone' => 'Asia/Manila',
    ];
}
