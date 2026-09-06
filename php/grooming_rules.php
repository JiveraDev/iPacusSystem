<?php

function grooming_is_service($service): bool
{
    return in_array(strtolower(trim((string)$service)), ['grooming', 'pet grooming'], true);
}

function grooming_validate_details(array $input): array
{
    $result = [];
    foreach (['package', 'addOns', 'ownerRequest', 'emergencyContact', 'pickupPerson', 'belongings', 'allergies', 'coat', 'handling', 'intakeNotes', 'internalNotes', 'ownerSummary', 'productsUsed', 'approvalNote', 'pickupNote'] as $field) {
        if (isset($input[$field]) && !is_string($input[$field])) throw new InvalidArgumentException('Enter text in ' . $field . '.');
        $result[$field] = trim((string)($input[$field] ?? ''));
        if (strlen($result[$field]) > 3000) throw new InvalidArgumentException('A note is too long. Keep each field under 3,000 characters.');
    }
    foreach (['coat' => ['unknown', 'clear', 'tangled', 'matted', 'review'], 'handling' => ['unknown', 'settled', 'nervous', 'sensitive', 'support']] as $field => $allowed) {
        $result[$field] = $result[$field] ?: 'unknown';
        if (!in_array($result[$field], $allowed, true)) throw new InvalidArgumentException('Choose a valid ' . $field . ' assessment.');
    }
    $duration = filter_var($input['durationMinutes'] ?? 60, FILTER_VALIDATE_INT);
    if ($duration === false || $duration < 30 || $duration > 480 || $duration % 30 !== 0) throw new InvalidArgumentException('Choose a grooming duration in 30-minute steps, from 30 minutes to 8 hours.');
    $result['durationMinutes'] = $duration;
    $quote = $input['agreedTotal'] ?? '';
    if ($quote !== '' && (!is_numeric($quote) || !is_finite((float)$quote) || (float)$quote < 0 || (float)$quote > 100000)) throw new InvalidArgumentException('Enter a valid agreed total from 0 to 100,000.');
    $result['agreedTotal'] = $quote === '' ? '' : round((float)$quote, 2);
    $result['ownerApproved'] = ($input['ownerApproved'] ?? false) === true;
    $result['intakeConfirmed'] = ($input['intakeConfirmed'] ?? false) === true;
    $result['tasks'] = [];
    if (isset($input['tasks']) && !is_array($input['tasks'])) throw new InvalidArgumentException('Review the service checklist.');
    foreach (['bath', 'dry', 'brush', 'trim', 'nails', 'cleanup'] as $task) {
        $entry = $input['tasks'][$task] ?? [];
        if (!is_array($entry)) throw new InvalidArgumentException('Review the service checklist.');
        $status = $entry['status'] ?? 'not_started';
        if (!in_array($status, ['not_started', 'done', 'skipped', 'stopped'], true)) throw new InvalidArgumentException('Choose a valid checklist status.');
        if (isset($entry['reason']) && !is_string($entry['reason'])) throw new InvalidArgumentException('Enter text for the checklist reason.');
        $reason = trim((string)($entry['reason'] ?? ''));
        if (strlen($reason) > 500) throw new InvalidArgumentException('Keep checklist reasons under 500 characters.');
        if (in_array($status, ['skipped', 'stopped'], true) && $reason === '') throw new InvalidArgumentException('Add a reason for each skipped or stopped task.');
        $result['tasks'][$task] = ['status' => $status, 'reason' => $reason];
    }
    return $result;
}

function grooming_assert_transition(string $from, string $to, array $details, string $performer, ?string $reviewOutcome): void
{
    $transitions = [
        'scheduled' => ['checked_in', 'cancelled', 'no_show'],
        'checked_in' => ['in_progress', 'cancelled'],
        'in_progress' => ['ready', 'cancelled'],
        'vet_review' => ['in_progress', 'cancelled'],
        'ready' => ['released'],
        'released' => [], 'cancelled' => [], 'no_show' => [],
    ];
    if (!isset($transitions[$from]) || ($from !== $to && !in_array($to, $transitions[$from], true))) throw new InvalidArgumentException('This status change is not available. Refresh the job and review its progress.');
    if (in_array($from, ['released', 'cancelled', 'no_show'], true)) throw new InvalidArgumentException('This job is closed. Its recorded history cannot be overwritten.');
    if ($from === 'vet_review' && $to === 'in_progress' && $reviewOutcome !== 'resume') throw new InvalidArgumentException('Wait for the assigned vet to clear this grooming job before resuming.');
    if (in_array($to, ['in_progress', 'ready', 'released'], true)) {
        if ($performer === '' || empty($details['package']) || empty($details['intakeConfirmed'])) throw new InvalidArgumentException('Assign the staff member, select a package, and confirm the intake before starting.');
        if (empty($details['ownerApproved']) || empty($details['approvalNote']) || $details['agreedTotal'] === '') throw new InvalidArgumentException('Record the agreed total and owner approval before starting grooming.');
    }
    if ($from !== $to && in_array($to, ['in_progress', 'ready'], true) && ($details['coat'] ?? '') === 'review' && $reviewOutcome !== 'resume') throw new InvalidArgumentException('Request a vet review for the recorded coat concern before continuing grooming.');
    if (in_array($to, ['ready', 'released'], true)) {
        if (empty($details['ownerSummary'])) throw new InvalidArgumentException('Write the owner summary before marking the pet ready.');
        if (empty($details['ownerApproved']) || empty($details['approvalNote']) || $details['agreedTotal'] === '') throw new InvalidArgumentException('Record the agreed total and owner approval before completing grooming.');
        foreach ($details['tasks'] as $task) {
            if ($task['status'] === 'not_started') throw new InvalidArgumentException('Complete the checklist or mark unused tasks as skipped with a reason.');
        }
    }
    if ($to === 'released' && (empty($details['pickupPerson']) || empty($details['pickupNote']))) throw new InvalidArgumentException('Record the authorized pickup person and handover confirmation.');
}
