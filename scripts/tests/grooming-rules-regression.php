<?php
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../../php/grooming_rules.php';
require_once __DIR__ . '/../../php/role_access.php';
require_once __DIR__ . '/../../php/grooming_media.php';

$passed = 0;
function check(bool $condition, string $label): void {
    global $passed;
    if (!$condition) throw new RuntimeException('FAIL: ' . $label);
    $passed++;
}
function rejects(callable $test, string $label): void {
    try { $test(); } catch (InvalidArgumentException $e) { check($e->getMessage() !== '', $label); return; }
    throw new RuntimeException('FAIL (accepted invalid input): ' . $label);
}
check(grooming_is_service(' Grooming '), 'Normalized grooming service');
check(grooming_is_service('Pet Grooming'), 'Legacy grooming label');
check(!grooming_is_service('consultation'), 'Clinical service is distinct');
$details = grooming_validate_details(['package' => 'Bath', 'catalogServiceId' => 1, 'intakeConfirmed' => true, 'ownerApproved' => true, 'completionConfirmed' => true, 'approvalNote' => 'Owner agreed at intake', 'agreedTotal' => '600.50', 'ownerSummary' => 'Bath and brushing completed.', 'pickupPerson' => 'Owner', 'pickupNote' => 'Identity confirmed; belongings returned.']);
check($details['agreedTotal'] === 600.5, 'Numeric quote normalized');
check($details['catalogServiceIds'] === [1], 'Legacy catalog selection is preserved as a selection list');
$multipleServices = grooming_validate_details(['package' => 'Bath, Nail trim', 'catalogServiceIds' => [3, 1, 3], 'intakeConfirmed' => true, 'ownerApproved' => true]);
check($multipleServices['catalogServiceIds'] === [3, 1] && $multipleServices['catalogServiceId'] === 3, 'Multiple catalog selections are normalized and deduplicated');
rejects(fn() => grooming_validate_details(['catalogServiceIds' => '1,2']), 'Catalog selections must be an array');
rejects(fn() => grooming_validate_details(['catalogServiceIds' => [1, 'invalid']]), 'Every catalog selection must be valid');
check($details['tasks'] === [], 'Removed checklist stays empty for legacy storage compatibility');
foreach ([['scheduled', 'checked_in'], ['checked_in', 'in_progress'], ['in_progress', 'ready']] as [$from, $to]) {
    grooming_assert_transition($from, $to, $details, 'Care team member', null);
    check(true, "Valid transition $from to $to");
}
foreach ([['scheduled', 'ready'], ['scheduled', 'released'], ['checked_in', 'released'], ['in_progress', 'scheduled'], ['ready', 'in_progress'], ['released', 'released'], ['cancelled', 'scheduled'], ['no_show', 'no_show']] as [$from, $to]) rejects(fn() => grooming_assert_transition($from, $to, $details, 'Staff', null), "Reject $from to $to");
foreach ([null, 'pending', 'stop', 'consultation', 'cancelled'] as $outcome) rejects(fn() => grooming_assert_transition('vet_review', 'in_progress', $details, 'Staff', $outcome), 'Review clearance required');
grooming_assert_transition('vet_review', 'in_progress', $details, 'Staff', 'resume');
check(true, 'Explicit vet clearance permits resume');
rejects(fn() => grooming_assert_transition('checked_in', 'in_progress', $details, '', null), 'Performer required');
foreach (['package' => '', 'intakeConfirmed' => false, 'ownerApproved' => false] as $key => $value) rejects(fn() => grooming_assert_transition('checked_in', 'in_progress', array_replace($details, [$key => $value]), 'Staff', null), "Intake requires $key");
rejects(fn() => grooming_assert_transition('checked_in', 'in_progress', array_replace($details, ['coat' => 'review']), 'Staff', null), 'Coat concern requires vet review');
grooming_assert_transition('in_progress', 'ready', array_replace($details, ['ownerSummary' => '']), 'Staff', null);
check(true, 'A second written summary is not required to finish');
rejects(fn() => grooming_assert_transition('in_progress', 'ready', grooming_validate_details([]), 'Staff', null), 'Finish action confirmation is required');
rejects(fn() => grooming_assert_transition('ready', 'released', $details, 'Staff', null), 'Routine status edits cannot bypass payment-controlled pickup');
foreach ([-1, 'NaN', INF, 100001] as $quote) rejects(fn() => grooming_validate_details(['agreedTotal' => $quote]), 'Invalid money rejected');
foreach ([0, 31, 600, 'tomorrow'] as $duration) rejects(fn() => grooming_validate_details(['durationMinutes' => $duration]), 'Invalid duration rejected');
check(grooming_validate_details(['tasks' => ['bath' => ['status' => 'done']]])['tasks'] === [], 'Legacy checklist submissions are discarded');
rejects(fn() => grooming_validate_details(['package' => []]), 'Malformed text rejected');
check(grooming_validate_details(['ownerApproved' => 'false'])['ownerApproved'] === false, 'Consent cannot be truthy text');
check(grooming_handler_name(['user_id' => 5, 'first_Name' => 'Clinic', 'last_Name' => 'Admin']) === 'Clinic Admin', 'Authenticated handler name is automatic');
check(grooming_default_pickup_person(['grooming_owner_name' => ' Maria Santos '], ['user_id' => 5, 'first_Name' => 'Clinic', 'last_Name' => 'Admin']) === 'Maria Santos', 'Pickup defaults to the booking owner name');
check(grooming_default_pickup_person(['grooming_owner_name' => ''], ['user_id' => 5, 'first_Name' => 'Clinic', 'last_Name' => 'Admin']) === 'Clinic Admin', 'Pickup falls back to the authenticated clinic administrator');
check(grooming_validate_details(['assistantName' => ' Nurse Ana '])['assistantName'] === 'Nurse Ana', 'Assisting nurse is stored separately');
check(grooming_validate_details([])['assistantName'] === '', 'No assisting nurse is required');
rejects(fn() => grooming_validate_details(['assistantName' => []]), 'Malformed assisting nurse name rejected');
foreach ([1, 99999, 'bad price', null] as $submittedPrice) {
    check(grooming_form_details(['agreedTotal' => $submittedPrice], [])['agreedTotal'] === '', 'New-job client price is ignored');
    check(grooming_form_details(['agreedTotal' => $submittedPrice], ['agreedTotal' => 600])['agreedTotal'] === 600.0, 'Historical invoice snapshot cannot be repriced by the form');
}
$noPrice = grooming_validate_details(['package' => 'Bath', 'catalogServiceId' => 1, 'intakeConfirmed' => true, 'ownerApproved' => true, 'completionConfirmed' => true]);
grooming_assert_transition('checked_in', 'in_progress', $noPrice, 'Admin', null);
grooming_assert_transition('in_progress', 'ready', $noPrice, 'Admin', null);
check(true, 'Grooming start and finish need no manually entered price');
$simple = grooming_validate_details(['package' => 'Bath and brush', 'catalogServiceId' => 1, 'agreedTotal' => 600, 'intakeConfirmed' => true, 'ownerApproved' => true]);
grooming_assert_transition('checked_in', 'in_progress', $simple, 'Nurse', null);
check(true, 'Simple intake needs no written approval note');
rejects(fn() => grooming_assert_transition('in_progress', 'ready', $simple, 'Nurse', null), 'Finish still requires explicit completion confirmation');
$simple['completionConfirmed'] = true;
grooming_assert_transition('in_progress', 'ready', $simple, 'Nurse', null);
check(true, 'Finish button completes grooming without a checklist');
check($simple['tasks'] === [], 'Simple completion does not invent task records');
check(grooming_completion_summary($simple) === 'Grooming visit finished. Service: Bath and brush.', 'Routine summary needs no extra note taking');
check(grooming_completion_summary(array_replace($simple, ['ownerSummary' => 'Existing owner instructions'])) === 'Existing owner instructions', 'Existing owner summaries preserved');
check(!str_contains(grooming_completion_summary(array_replace($simple, ['internalNotes' => 'Private concern'])), 'Private concern'), 'Private notes never copied into owner summary');
$simple['pickupPerson'] = 'Owner';
rejects(fn() => grooming_assert_transition('ready', 'released', $simple, 'Nurse', null), 'Pickup still requires explicit handover confirmation');
$simple['pickupConfirmed'] = true;
rejects(fn() => grooming_assert_transition('ready', 'released', $simple, 'Nurse', null), 'Even confirmed pickup cannot bypass payment-controlled release');
rejects(fn() => grooming_assert_transition('ready', 'released', array_replace($simple, ['pickupPerson' => '']), 'Nurse', null), 'Pickup person still required');
foreach (['completionConfirmed', 'pickupConfirmed'] as $key) check(!grooming_validate_details([$key => 'true'])[$key], 'Confirmation requires a real boolean');
foreach (['pending', 'stop', 'consultation'] as $outcome) rejects(fn() => grooming_assert_transition('vet_review', 'in_progress', $simple, 'Nurse', $outcome), 'Simple flow cannot bypass vet clearance');
rejects(fn() => grooming_assert_transition('in_progress', 'ready', array_replace($simple, ['coat' => 'review']), 'Nurse', null), 'Simple completion does not bypass recorded coat concern');
check(in_array('grooming', ipawcus_admin_feature_keys(), true), 'Grooming feature permission registered');
check(ipawcus_admin_feature_for_mutation('/grooming', 'POST') === 'grooming', 'Mutation permission mapped');
$storage = getenv('IPAWCUS_GROOMING_MEDIA_ROOT');
putenv('IPAWCUS_GROOMING_MEDIA_ROOT');
$defaultStorage = grooming_photo_directory();
check(str_replace('\\', '/', $defaultStorage) === str_replace('\\', '/', grooming_default_photo_directory()), 'Missing storage setting uses the private sibling directory');
check(!str_starts_with(strtolower(str_replace('\\', '/', $defaultStorage)), strtolower(str_replace('\\', '/', realpath(__DIR__ . '/../..'))) . '/'), 'Default photo storage remains outside the application');
putenv('IPAWCUS_GROOMING_MEDIA_ROOT=' . realpath(__DIR__ . '/../..') . '/public/grooming_photos');
rejects(fn() => grooming_photo_directory(), 'Public-folder storage forbidden');
$storage === false ? putenv('IPAWCUS_GROOMING_MEDIA_ROOT') : putenv('IPAWCUS_GROOMING_MEDIA_ROOT=' . $storage);
echo "PASS: $passed grooming regression checks. No database or files were changed.\n";
