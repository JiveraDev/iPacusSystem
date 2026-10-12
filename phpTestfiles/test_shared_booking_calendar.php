<?php
// Run: php phpTestfiles/test_shared_booking_calendar.php (no database needed).
require_once __DIR__ . '/../php/booking_slot_helpers.php';

$checks = 0;
function expectSame($expected, $actual, string $label): void
{
    global $checks;
    ++$checks;
    if ($expected !== $actual) {
        throw new RuntimeException($label . ': expected ' . json_encode($expected) . ', got ' . json_encode($actual));
    }
}
function bookingRow(int $id, ?int $vet, string $service = 'vaccination', string $time = '09:00:00', int $branch = 1, string $status = 'pending'): array
{
    return ['booking_id' => $id, 'veterinarian_id' => $vet, 'service_type' => $service,
        'booking_date' => '2026-10-05', 'booking_time' => $time, 'branch_id' => $branch, 'status' => $status];
}
$roster = [];
foreach ([11, 12, 13] as $vet) {
    $roster[] = ['veterinarian_user_id' => $vet, 'veterinarian_name' => 'Vet ' . $vet,
        'branch_id' => 1, 'day_of_week' => 1, 'starts_at' => '08:00:00', 'ends_at' => '18:00:00'];
}
$onlineSchedules = [];
foreach ([11, 12, 13] as $vet) {
    foreach (['09:00 AM', '12:00 PM', '05:30 PM'] as $time) {
        $onlineSchedules[] = ['user_id' => $vet, 'day_of_week' => 'monday', 'time_slot' => $time, 'is_available' => 1];
    }
}
function capacity(array $bookings = [], string $service = 'general-checkup', string $time = '09:00:00', ?int $vet = null, int $exclude = 0, ?array $selections = null): array
{
    global $roster, $onlineSchedules;
    return clinic_booking_capacity_from_rows($roster, $bookings, $selections ?? $onlineSchedules, 1, '2026-10-05', $time, $service, $vet, $exclude);
}
expectSame(3, capacity()['availableCount'], 'Three vets provide three simultaneous appointments');
expectSame(3, capacity()['capacity'], 'Capacity comes from unique accepting clinic vets');
$sameService = [];
foreach ([11, 12, 13] as $index => $vet) {
    $sameService[] = bookingRow($index + 1, $vet);
    expectSame(2 - $index, capacity($sameService, 'vaccination')['availableCount'], 'Same service consumes one vet per booking');
    expectSame(2 - $index, capacity($sameService, 'dental')['availableCount'], 'All medical services share remaining capacity');
}
$mixed = [bookingRow(1, 11, 'vaccination'), bookingRow(2, 12, 'dental'), bookingRow(3, 13, 'surgery')];
expectSame(0, capacity($mixed, 'lab-testing')['availableCount'], 'Three mixed services fill the shared time');
expectSame(0, capacity([bookingRow(1, 11)], 'surgery', '09:00', 11)['availableCount'], 'Cannot book a busy specific vet');
expectSame(1, capacity([bookingRow(1, 11)], 'surgery', '09:00', 12)['availableCount'], 'Same time, another vet is available');
expectSame(1, capacity($mixed, 'vaccination', '09:00', 11, 1)['availableCount'], 'Rescheduling excludes only the current booking');
expectSame(2, capacity([bookingRow(1, 11, 'surgery', '09:00', 2)])['availableCount'], 'Another clinic also reserves the same vet');
expectSame(0, capacity([], 'surgery', '09:00', 99)['availableCount'], 'An unscheduled vet cannot be selected');
expectSame(3, capacity([bookingRow(1, 11, 'grooming'), bookingRow(2, 12, 'boarding')])['availableCount'], 'Grooming and boarding do not consume medical capacity');
foreach (['cancelled', 'canceled', 'rejected'] as $status) {
    expectSame(3, capacity([bookingRow(1, 11, 'surgery', '09:00', 1, $status)])['availableCount'], $status . ' frees capacity');
}
expectSame(2, capacity([bookingRow(1, 11, 'surgery', '09:00', 1, 'confirmed')])['availableCount'], 'Confirmed bookings reserve capacity');
expectSame(2, capacity([bookingRow(1, 11, 'surgery', '09:00', 1, 'completed')])['availableCount'], 'Completed appointment retains its original interval');
expectSame(2, capacity([bookingRow(1, 11, 'online-consultation')], 'surgery', '09:30')['availableCount'], 'Online consultation reserves a full hour');
expectSame(3, capacity([bookingRow(1, 11, 'online-consultation')], 'surgery', '10:00')['availableCount'], 'Next appointment may start exactly when the hour ends');
expectSame(2, capacity([bookingRow(1, 11, 'home-service')], 'surgery', '09:30')['availableCount'], 'Home service shares the vet for its full hour');
expectSame(2, capacity([array_merge(bookingRow(1, 11, 'consultation'), ['is_online_consultation' => 1])], 'surgery', '09:30')['availableCount'], 'Stored online flag determines full duration');
expectSame(2, capacity([array_merge(bookingRow(1, 11, 'vaccination'), ['is_home_service' => 1])], 'surgery', '09:30')['availableCount'], 'Stored home-service flag determines full duration');
expectSame(2, capacity([bookingRow(1, 11, 'surgery', '09:30')], 'online-consultation', '09:00')['availableCount'], 'Long appointment cannot span an occupied later half-hour');
expectSame(3, capacity([bookingRow(1, 11)], 'surgery', '09:30')['availableCount'], 'Adjacent standard appointments do not overlap');
expectSame(3, capacity([], 'online-consultation', '17:30')['availableCount'], 'Selected call may finish after physical clinic closing');
expectSame(0, capacity([], 'home-service', '17:30')['availableCount'], 'On-site/home duration must fit clinic hours');
expectSame(3, capacity([], 'surgery', '17:30')['availableCount'], 'Half-hour fits the shift end exactly');
expectSame(0, clinic_booking_capacity_from_rows($roster, [], [], 1, '2026-10-06', '09:00', 'surgery')['availableCount'], 'No hours on another weekday');
expectSame(0, clinic_booking_capacity_from_rows($roster, [], [], 2, '2026-10-05', '09:00', 'surgery')['availableCount'], 'Assignments at another clinic are not working presence here');
expectSame(3, capacity([], 'surgery', '09:00', null, 0, [])['availableCount'], 'Physical appointments do not need online selections or extra working hours');
expectSame(0, capacity([], 'online-consultation', '09:00', null, 0, [])['availableCount'], 'No selected online starts means no call availability');
expectSame(2, capacity([bookingRow(1, null)])['availableCount'], 'Legacy unassigned booking still consumes capacity');
expectSame(0, capacity([bookingRow(1, null), bookingRow(2, null), bookingRow(3, null)])['availableCount'], 'Legacy bookings cannot silently overbook capacity');
expectSame(2, capacity([bookingRow(1, null), bookingRow(2, null, 'dental', '09:30')], 'online-consultation')['availableCount'], 'Adjacent anonymous reservations use peak concurrency');
expectSame(3, capacity([bookingRow(1, null, 'surgery', '09:00', 2)])['availableCount'], 'Anonymous reservations are local to their clinic');
$duplicateRoster = [...$roster, $roster[0]];
expectSame(3, clinic_booking_capacity_from_rows($duplicateRoster, [], [], 1, '2026-10-05', '09:00', 'surgery')['capacity'], 'Duplicate shifts do not double-count a vet');
expectSame(false, booking_slot_overlaps_lunch('online-consultation', '11:30'), 'Calls are independent of physical clinic lunch');
expectSame(true, booking_slot_overlaps_lunch('home-service', '11:30'), 'Home appointments still cannot cross clinic lunch');
expectSame(true, booking_slot_overlaps_lunch('surgery', '12:00'), 'On-site lunch remains blocked');
expectSame(3, capacity([], 'online-consultation', '12:00')['availableCount'], 'Selected noon calls remain bookable');
expectSame(false, booking_slot_overlaps_lunch('surgery', '11:30'), 'Half-hour can finish at noon');
expectSame(false, booking_slot_overlaps_lunch('surgery', '13:00'), 'Appointment can start after lunch');
expectSame(false, booking_slot_overlaps_lunch('grooming', '12:00'), 'Grooming remains available during lunch');
expectSame(booking_slot_lock_name(1, 'surgery', '2026-10-05', '09:00'), booking_slot_lock_name(2, 'online-consultation', '2026-10-06', '09:30', 12), 'Medical writes serialize across service, date and clinic');
expectSame(false, booking_slot_lock_name(1, 'surgery', '2026-10-05', '09:00') === booking_slot_lock_name(1, 'grooming', '2026-10-05', '09:00'), 'Grooming keeps its independent lock');
// Online roster has no clinic/day/hours fields: eligibility comes only from
// active vets and their separate online selections.
$onlineVets = array_map(static fn($row) => ['veterinarian_user_id' => $row['veterinarian_user_id'], 'veterinarian_name' => $row['veterinarian_name']], $roster);
expectSame(3, clinic_booking_capacity_from_rows($onlineVets, [], $onlineSchedules, 2, '2026-10-05', '09:00', 'online-consultation')['availableCount'], 'Calls do not require assignments or acceptance at a clinic');
expectSame(3, clinic_booking_capacity_from_rows($onlineVets, [], $onlineSchedules, 1, '2026-10-05', '17:30', 'online-consultation')['availableCount'], 'Calls do not need physical hours rows');
expectSame(0, capacity([], 'online-consultation', '09:30')['availableCount'], 'Unselected online starts are unavailable even while physical clinic is open');
expectSame(1, capacity([], 'online-consultation', '09:00', 12)['availableCount'], 'Owner can choose a specific vet for calls');
expectSame(0, capacity([bookingRow(1, 12, 'dental', '09:30', 2)], 'online-consultation', '09:00', 12)['availableCount'], 'A call cannot overlap this vet at another physical clinic');
expectSame(3, capacity([bookingRow(1, 11, 'dental', '08:30')], 'online-consultation')['availableCount'], 'A call can start exactly after an on-site appointment');
expectSame(0, capacity([], 'online-consultation', '09:00', 99)['availableCount'], 'An unknown vet cannot be selected for calls');
expectSame(0, clinic_booking_capacity_from_rows($onlineVets, [], $onlineSchedules, 1, '2026-10-06', '09:00', 'online-consultation')['availableCount'], 'A selection applies only on its chosen weekday');
$otherDay = [['user_id' => 11, 'day_of_week' => 'Tuesday', 'time_slot' => '09:00', 'is_available' => 1]];
expectSame(1, clinic_booking_capacity_from_rows($onlineVets, [], $otherDay, 1, '2026-10-06', '09:00', 'online-consultation')['availableCount'], 'Online weekday selection ignores on-site roster weekday');
expectSame(false, clinic_booking_online_slot_selected($otherDay, 12, '2026-10-06', '09:00'), 'Online slots belong to their individual vet');
expectSame(true, clinic_booking_online_slot_selected($otherDay, 11, '2026-10-06', '09:00 AM'), 'Legacy online times normalize across formats');
expectSame(false, clinic_booking_online_slot_selected([array_merge($otherDay[0], ['is_available' => 0])], 11, '2026-10-06', '09:00'), 'Disabled online slots are never offered');
expectSame(['09:00:00', '12:00:00', '17:30:00'], clinic_booking_online_times($onlineSchedules, '2026-10-05'), 'Online time list is sorted and deduplicated across vets');
expectSame([], clinic_booking_online_times($onlineSchedules, '2026-10-05', 99), 'Online time list respects owner selected vet');
expectSame([], clinic_booking_online_times($onlineSchedules, '2026-10-06'), 'Online time list respects weekday');
expectSame('12:00:00', booking_slot_assert_aligned('online-consultation', '12:00 PM'), 'Call validation permits selected lunch-time starts');
$wideRoster = array_map(static fn($row) => array_merge($row, ['starts_at' => '09:00:00', 'ends_at' => '17:00:00']), $roster);
expectSame(0, clinic_booking_capacity_from_rows($wideRoster, [], [], 1, '2026-10-05', '08:30', 'vaccination')['availableCount'], 'On-site slots respect clinic opening');
expectSame(0, clinic_booking_capacity_from_rows($wideRoster, [], [], 1, '2026-10-05', '17:00', 'vaccination')['availableCount'], 'On-site duration respects clinic closing');
expectSame(3, clinic_booking_capacity_from_rows($wideRoster, [], $onlineSchedules, 1, '2026-10-05', '17:30', 'online-consultation')['availableCount'], 'Physical opening and closing never constrain a selected call');

// The same vets accept bookings at two clinics. A booking consumes the vet,
// rather than just that clinic's slot, including during the pending stage.
$twoClinicRoster = [...$roster, ...array_map(static fn($row) => array_merge($row, ['branch_id' => 2]), $roster)];
foreach (['pending', 'confirmed'] as $status) {
    foreach ([[1, 2], [2, 1]] as [$bookedBranch, $requestedBranch]) {
        $reservations = [bookingRow(81, 11, 'vaccination', '09:00:00', $bookedBranch, $status)];
        $result = clinic_booking_capacity_from_rows($twoClinicRoster, $reservations, [], $requestedBranch, '2026-10-05', '09:00', 'dental');
        expectSame([12, 13], array_column($result['availableVeterinarians'], 'id'), $status . ' at clinic ' . $bookedBranch . ' removes only the booked vet from clinic ' . $requestedBranch);
        expectSame(0, clinic_booking_capacity_from_rows($twoClinicRoster, $reservations, [], $requestedBranch, '2026-10-05', '09:00', 'surgery', 11)['availableCount'], 'A selected vet cannot be double booked at the other clinic');
    }
}
$callAtOtherClinic = [bookingRow(82, 11, 'online-consultation', '09:00:00', 2)];
expectSame(0, clinic_booking_capacity_from_rows($twoClinicRoster, $callAtOtherClinic, [], 1, '2026-10-05', '09:30', 'vaccination', 11)['availableCount'], 'The second half-hour of a call blocks the same vet at another clinic');
expectSame(1, clinic_booking_capacity_from_rows($twoClinicRoster, $callAtOtherClinic, [], 1, '2026-10-05', '10:00', 'vaccination', 11)['availableCount'], 'Other-clinic availability returns at the end of the full call');
expectSame(0, clinic_booking_capacity_from_rows($twoClinicRoster, [bookingRow(83, 11, 'vaccination', '09:30:00', 1)], $onlineSchedules, 2, '2026-10-05', '09:00', 'online-consultation', 11)['availableCount'], 'A call at the other clinic cannot span a later physical appointment');
expectSame(1, clinic_booking_capacity_from_rows($twoClinicRoster, [bookingRow(84, 11, 'vaccination', '09:00:00', 1, 'cancelled')], [], 2, '2026-10-05', '09:00', 'dental', 11)['availableCount'], 'Cancellation releases the same vet across clinics');
expectSame(1, clinic_booking_capacity_from_rows($twoClinicRoster, [bookingRow(85, 11, 'vaccination', '09:00:00', 1)], [], 2, '2026-10-05', '09:00', 'dental', 11, 85)['availableCount'], 'Moving the current booking excludes only itself');
foreach ([1, 5] as $vetCount) {
    $dynamicRoster = array_map(static fn($id) => array_merge($roster[0], ['veterinarian_user_id' => $id]), range(21, 20 + $vetCount));
    expectSame($vetCount, clinic_booking_capacity_from_rows($dynamicRoster, [], [], 1, '2026-10-05', '09:00', 'vaccination')['availableCount'], 'Clinic capacity follows ' . $vetCount . ' accepting vets, not a fixed three');
}

// An admin must not bypass the shared calendar by reassigning a booking after
// its start. Only the remaining interval matters for an active handover.
$handover = bookingRow(91, 12, 'home-service', '09:00:00', 1, 'confirmed');
$handoverNow = strtotime('2026-10-05 09:15:00');
$busyElsewhere = bookingRow(92, 11, 'dental', '09:30:00', 2);
expectSame(92, clinic_booking_handover_conflict($handover, [$busyElsewhere], 11, $handoverNow)['booking_id'], 'An ongoing handover cannot consume another clinic appointment');
expectSame(92, clinic_booking_handover_conflict($handover, [array_merge($busyElsewhere, ['service_type' => 'online-consultation'])], 11, $handoverNow)['booking_id'], 'An ongoing handover also protects overlapping online calls');
expectSame(null, clinic_booking_handover_conflict($handover, [$busyElsewhere], 13, $handoverNow), 'Admin can hand over to a different free vet');
expectSame(null, clinic_booking_handover_conflict($handover, [array_merge($busyElsewhere, ['status' => 'cancelled'])], 11, $handoverNow), 'Cancelled appointments do not block handover');
expectSame(null, clinic_booking_handover_conflict($handover, [array_merge($handover, ['veterinarian_id' => 11])], 11, $handoverNow), 'The booking being handed over cannot conflict with itself');
expectSame(null, clinic_booking_handover_conflict($handover, [bookingRow(93, 11, 'dental', '10:00:00', 2)], 11, $handoverNow), 'An appointment starting exactly after handover duration is allowed');
expectSame(null, clinic_booking_handover_conflict($handover, [bookingRow(94, 11, 'dental', '08:30:00', 2)], 11, $handoverNow), 'Earlier finished appointments do not block an active handover');
expectSame(null, clinic_booking_handover_conflict($handover, [$busyElsewhere], 11, strtotime('2026-10-05 10:00:00')), 'An expired booked interval does not invent new calendar occupancy');
expectSame(null, clinic_booking_handover_conflict($handover, [bookingRow(95, 11, 'dental', '09:00:00', 2)], 11, strtotime('2026-10-05 09:45:00')), 'Past overlap does not block a handover after the other appointment ends');
expectSame(null, clinic_booking_handover_conflict($handover, [array_merge($busyElsewhere, ['booking_date' => '2026-10-06'])], 11, $handoverNow), 'An appointment on another day is independent');

// The public calendar and booking selectors share this acceptance filter.
$clinics = [['id' => 1, 'name' => 'Main'], ['id' => 2, 'name' => 'Enriquez']];
foreach (['general-checkup', 'vaccination', 'parasite-control', 'dental', 'surgery', 'lab-testing', 'home-service', 'special-services'] as $service) {
    expectSame([1], array_column(clinic_booking_filter_branches($clinics, $service, $roster), 'id'), $service . ' hides a clinic with no accepting vet');
    expectSame([1, 2], array_column(clinic_booking_filter_branches($clinics, $service, $twoClinicRoster), 'id'), $service . ' offers every clinic with an accepting vet');
    expectSame([], clinic_booking_filter_branches($clinics, $service, []), $service . ' has no fallback clinic when acceptance is disabled everywhere');
}
$onlyOtherClinic = array_map(static fn($row) => array_merge($row, ['branch_id' => 2]), $roster);
expectSame([2], array_column(clinic_booking_filter_branches($clinics, 'vaccination', $onlyOtherClinic), 'id'), 'Turning off main acceptance selects the other eligible clinic');
expectSame([1, 2], array_column(clinic_booking_filter_branches($clinics, 'vaccination', $twoClinicRoster), 'id'), 'Turning main acceptance back on restores its clinic choice');
expectSame([1], array_column(clinic_booking_filter_branches($clinics, 'vaccination', $duplicateRoster), 'id'), 'Multiple vets and weekdays do not duplicate clinic choices');
foreach (['grooming', 'boarding', 'online-consultation'] as $service) {
    expectSame($clinics, clinic_booking_filter_branches($clinics, $service, []), $service . ' uses its independent booking rules');
}
expectSame([], clinic_booking_filter_branches([], 'vaccination', $twoClinicRoster), 'Vet acceptance cannot add a clinic that does not offer the service');

echo 'PASS: ' . $checks . " shared veterinarian calendar checks.\n";
