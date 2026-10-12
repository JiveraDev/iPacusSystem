<?php
require_once __DIR__ . '/../../php/vet_presence_helpers.php';
require_once __DIR__ . '/../../php/booking_slot_helpers.php';
require_once __DIR__ . '/../../php/role_access.php';

$checks = 0;
function check_rule(bool $condition, string $label): void
{
    global $checks;
    if (!$condition) throw new RuntimeException($label);
    $checks++;
    echo "PASS: {$label}\n";
}

$now = new DateTimeImmutable('2026-09-06 23:59:59', new DateTimeZone('Asia/Manila'));
check_rule(vet_presence_state(null, $now)['isIn'] === true, 'Vet defaults to in when no override exists');
check_rule(vet_presence_state(['date' => '2026-09-06', 'isIn' => false], $now)['isIn'] === false, 'Out override persists throughout its Manila day');
check_rule(vet_presence_state(['date' => '2026-09-06', 'isIn' => false], $now->modify('+1 second'))['isIn'] === true, 'Override resets at midnight');
check_rule(vet_presence_state(null, $now)['resetsAt'] === '2026-09-07T00:00:00+08:00', 'Reset timestamp is midnight Manila');
check_rule(vet_presence_state(['date' => '2026-09-06', 'isIn' => false], new DateTimeImmutable('2026-09-06T16:00:00Z'))['isIn'] === true, 'Reset is independent of the server timezone');
check_rule(vet_presence_state(['date' => '2026-09-07', 'isIn' => false], $now)['isIn'] === true, 'Only the current day can override the default');

$hours = ['opens_at' => '08:00:00', 'closes_at' => '18:00:00', 'is_closed' => 0];
foreach ([
    ['2026-10-12 00:00:00', false, 'closed'],
    ['2026-10-12 07:59:59', false, 'closed'],
    ['2026-10-12 08:00:00', false, 'in'],
    ['2026-10-12 11:59:59', false, 'in'],
    ['2026-10-12 12:00:00', false, 'lunch'],
    ['2026-10-12 12:59:59', false, 'lunch'],
    ['2026-10-12 13:00:00', false, 'in'],
    ['2026-10-12 17:59:59', false, 'in'],
    ['2026-10-12 18:00:00', false, 'closed'],
    ['2026-10-12 20:00:00', false, 'closed'],
    ['2026-10-11 10:00:00', false, 'closed'],
    ['2026-10-12 10:00:00', true, 'closed'],
] as [$dateTime, $closure, $status]) {
    $time = new DateTimeImmutable($dateTime, new DateTimeZone('Asia/Manila'));
    $clinic = vet_presence_operating_state($hours, $closure, $time);
    $state = vet_presence_response(null, $clinic, $time);
    check_rule($state['status'] === $status && $state['isIn'] === ($status === 'in'), "Public sign follows clinic availability at {$dateTime}" . ($closure ? ' (closure)' : ''));
    check_rule($state['adminIsIn'] === true, 'Clinic closure does not alter the admin daily setting');
}
$daytime = new DateTimeImmutable('2026-10-12 10:00:00', new DateTimeZone('Asia/Manila'));
check_rule(vet_presence_response(['date' => '2026-10-12', 'isIn' => false], vet_presence_operating_state($hours, false, $daytime), $daytime)['status'] === 'out', 'Admin out override applies during clinic hours');
check_rule(!vet_presence_operating_state(null, false, $daytime)['isOpen'], 'Missing operating hours do not claim the clinic is open');
check_rule(!vet_presence_operating_state([...$hours, 'is_closed' => 1], false, $daytime)['isOpen'], 'A configured closed weekday overrides the open times');
check_rule(vet_presence_operating_state($hours, false, new DateTimeImmutable('2026-10-12T00:00:00Z'))['isOpen'], 'Operating hours use Manila time independently of the server timezone');
check_rule(!vet_presence_response(null, vet_presence_operating_state($hours, false, $now->modify('+1 second')), $now->modify('+1 second'))['isIn'], 'Midnight reset cannot display in while the clinic is closed');

foreach ([
    ['general-checkup', '11:30', false], ['general-checkup', '12:00', true],
    ['general-checkup', '12:30', true], ['general-checkup', '13:00', false],
    ['online-consultation', '11:00', false], ['online-consultation', '11:30', false],
    ['online-consultation', '12:00', false], ['online-consultation', '12:30', false],
    ['online-consultation', '13:00', false], ['home-service', '11:00', false],
    ['home-service', '12:00', true], ['home-service', '13:00', false],
    ['vaccination', '12:00 PM', true], ['boarding', '12:00', false],
    ['grooming', '12:00', false], ['grooming', '12:30', false],
] as [$service, $time, $blocked]) {
    check_rule(booking_slot_overlaps_lunch($service, $time) === $blocked, "Lunch overlap: {$service} at {$time}");
    try {
        booking_slot_assert_aligned($service, $time);
        check_rule(!$blocked, "Server accepts allowed slot: {$service} at {$time}");
    } catch (InvalidArgumentException $error) {
        check_rule($blocked && str_contains($error->getMessage(), 'Lunch period'), "Server rejects lunch slot: {$service} at {$time}");
    }
}

check_rule(ipawcus_route_access_policy('/vet-presence', 'GET') === ['public' => true], 'Visitors can read the sign without login');
$writePolicy = ipawcus_route_access_policy('/vet-presence', 'PATCH');
check_rule(empty($writePolicy['public']), 'Status writes are not public');
check_rule($writePolicy['roles'] === ['admin', 'super_admin'], 'Only admin roles may write the status');
echo "{$checks} checks passed.\n";
