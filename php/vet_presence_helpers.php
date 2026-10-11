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

function vet_presence_operating_state(?array $hours, bool $hasClosure, ?DateTimeImmutable $now = null): array
{
    $timezone = new DateTimeZone('Asia/Manila');
    $now = ($now ?? new DateTimeImmutable('now', $timezone))->setTimezone($timezone);
    $time = $now->format('H:i:s');
    $opensAt = (string)($hours['opens_at'] ?? '');
    $closesAt = (string)($hours['closes_at'] ?? '');
    $isOpen = (int)$now->format('N') !== 7
        && !$hasClosure
        && $hours !== null
        && empty($hours['is_closed'])
        && $opensAt !== '' && $closesAt !== ''
        && $time >= $opensAt && $time < $closesAt;
    return [
        'isOpen' => $isOpen,
        'isLunch' => $isOpen && $time >= '12:00:00' && $time < '13:00:00',
        'opensAt' => $opensAt ?: null,
        'closesAt' => $closesAt ?: null,
    ];
}

function vet_presence_response(?array $saved, array $clinic, ?DateTimeImmutable $now = null): array
{
    $state = vet_presence_state($saved, $now);
    $state['adminIsIn'] = $state['isIn'];
    $state['clinic'] = $clinic;
    $state['status'] = !$clinic['isOpen'] ? 'closed'
        : (!$state['adminIsIn'] ? 'out' : (!empty($clinic['isLunch']) ? 'lunch' : 'in'));
    $state['isIn'] = $state['status'] === 'in';
    return $state;
}

function vet_presence_clinic(PDO $pdo, ?int $branchId, DateTimeImmutable $now): array
{
    $filter = $branchId ? ' AND branch_id = ?' : '';
    $stmt = $pdo->prepare("SELECT branch_id, branch_name FROM branches
        WHERE status = 'active' AND branch_code IN ('MAIN', 'ENRIQUEZ') {$filter}
        ORDER BY is_main DESC, branch_name LIMIT 1");
    $stmt->execute($branchId ? [$branchId] : []);
    $branch = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$branch) throw new InvalidArgumentException('The selected clinic is unavailable.');

    $timezone = new DateTimeZone('Asia/Manila');
    $now = $now->setTimezone($timezone);
    $hoursStmt = $pdo->prepare('SELECT opens_at, closes_at, is_closed FROM branch_operating_hours WHERE branch_id = ? AND day_of_week = ? LIMIT 1');
    $hoursStmt->execute([(int)$branch['branch_id'], (int)$now->format('N')]);
    $hours = $hoursStmt->fetch(PDO::FETCH_ASSOC);
    $closureStmt = $pdo->prepare('SELECT COUNT(*) FROM branch_closures WHERE branch_id = ? AND closure_date = ?');
    $closureStmt->execute([(int)$branch['branch_id'], $now->format('Y-m-d')]);

    return [
        'id' => (int)$branch['branch_id'],
        'name' => (string)$branch['branch_name'],
        ...vet_presence_operating_state($hours ?: null, (int)$closureStmt->fetchColumn() > 0, $now),
    ];
}
