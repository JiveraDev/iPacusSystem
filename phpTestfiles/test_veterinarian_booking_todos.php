<?php
// Run without a database: php phpTestfiles/test_veterinarian_booking_todos.php
require_once __DIR__ . '/../php/veterinarian_booking_todo_helpers.php';

$checks = 0;
function check($expected, $actual, string $label): void
{
    global $checks;
    $checks++;
    if ($expected !== $actual) throw new RuntimeException($label . ': expected ' . json_encode($expected) . ', got ' . json_encode($actual));
}
$booking = ['booking_id' => 42, 'booking_number' => 'BK-42', 'pet_id' => 5,
    'booking_date' => '2026-10-12', 'booking_time' => '09:00:00', 'status' => 'confirmed',
    'service_type' => 'vaccination', 'pet_name' => 'Milo', 'owner_name' => 'Pet Owner',
    'branch_id' => 2, 'branch_name' => 'Pet Corner'];
$task = veterinarian_booking_todo($booking);
check(42, $task['bookingId'], 'Calendar preserves actual booking identifier');
check('vet_booking', $task['source'], 'Physical booking has its own task source');
check('2026-10-12 09:00:00', $task['startAt'], 'Future appointment keeps its actual booked date');
check('2026-10-12 09:30:00', $task['endAt'], 'Standard medical appointment lasts 30 minutes');
check('/dashboard/vet/my-list?date=2026-10-12&booking=42', $task['redirectPath'], 'Future booking opens the correct day preview');
check(2, $task['branchId'], 'Bookings from every assigned clinic keep location metadata');
check(false, $task['editable'], 'Calendar does not make booked appointments editable as personal tasks');
check('pending', veterinarian_booking_todo(array_merge($booking, ['status' => 'pending']))['status'], 'Pending reservations also appear in To-dos');
foreach (['cancelled', 'canceled', 'rejected', 'completed'] as $status) {
    check(null, veterinarian_booking_todo(array_merge($booking, ['status' => $status])), $status . ' is excluded from active booking tasks');
}
foreach (['grooming', 'boarding'] as $service) {
    check(null, veterinarian_booking_todo(array_merge($booking, ['service_type' => $service])), $service . ' does not add a vet appointment task');
}
check('2026-10-12 10:00:00', veterinarian_booking_todo(array_merge($booking, ['is_home_service' => 1]))['endAt'], 'Home visits last one hour');
$online = array_merge($booking, ['is_online_consultation' => 1]);
check('online_consultation', veterinarian_booking_todo($online)['source'], 'Calls preserve their separate task category');
check('2026-10-12 10:00:00', veterinarian_booking_todo($online)['endAt'], 'Pending calls reserve one hour even before a call record exists');
check('/dashboard/vet/online-consultations', veterinarian_booking_todo($online)['redirectPath'], 'Call task opens online consultations, not the physical list');
$call = array_merge($online, ['online_consultation_id' => 7, 'scheduled_start' => '2026-10-13 14:00:00', 'scheduled_end' => '2026-10-13 15:00:00', 'consultation_status' => 'vet_ready']);
check('2026-10-13 14:00:00', veterinarian_booking_todo($call)['startAt'], 'Calls use actual scheduled call times');
check('2026-10-13 15:00:00', veterinarian_booking_todo($call)['endAt'], 'Calls preserve scheduled duration');
check(42, veterinarian_booking_todo($call)['bookingId'], 'Call and booking are counted once using the same booking identifier');
check(null, veterinarian_booking_todo(array_merge($call, ['consultation_status' => 'completed'])), 'A finished call is not duplicated as a new scheduled booking');
check(null, veterinarian_booking_todo(array_merge($call, ['consultation_status' => 'cancelled'])), 'Cancelled call records are not shown as active bookings');
check('Unknown pet', veterinarian_booking_todo(array_merge($booking, ['pet_id' => null, 'pet_name' => null, 'unregistered_pet_name' => 'Unknown pet']))['petName'], 'Unregistered bookings retain their pet name');
echo 'PASS: ' . $checks . " veterinarian booking To-do checks.\n";
