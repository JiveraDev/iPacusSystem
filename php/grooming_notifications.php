<?php
require_once __DIR__ . '/notification_helpers.php';

function grooming_notify(PDO $pdo, array $booking, array $job, string $action, string $status, array $input, ?array $review): void
{
    $id = (int)$booking['booking_id'];
    $payload = [
        'type' => 'grooming_update', 'category' => 'booking_updates', 'force_in_app' => true,
        'branch_id' => (int)$booking['branch_id'],
        'dedupe_key' => 'grooming-' . $id . '-' . $action . '-' . ((int)$job['version'] + 1),
    ];
    if ($action === 'request_review') {
        $payload += ['user_id' => (int)$input['veterinarianId'], 'title' => 'Grooming review requested', 'message' => 'A grooming job is paused for your assessment. Open Grooming reviews in your Approved List.', 'redirect_path' => '/dashboard/vet/approved-queue'];
    } elseif ($action === 'review') {
        $payload += ['user_id' => (int)$review['requested_by'], 'title' => 'Vet assessment recorded', 'message' => 'The veterinarian has reviewed your grooming concern. Check the assessment before continuing the job.', 'redirect_path' => '/dashboard/grooming'];
    } elseif ($action === 'publish') {
        $payload += ['user_id' => (int)$booking['user_id'], 'title' => 'Grooming summary shared', 'message' => 'Your pet’s grooming summary is ready. Open Grooming summaries on Home to see it.', 'redirect_path' => '/dashboard'];
    } elseif ($action === 'save' && $status !== $job['status'] && $status === 'ready') {
        $payload += ['user_id' => (int)$booking['user_id'], 'title' => 'Your pet is ready for pickup', 'message' => 'Grooming is complete. Please contact the clinic for pickup and payment arrangements.', 'redirect_path' => '/dashboard'];
    } elseif ($action === 'save' && $status !== $job['status'] && in_array($status, ['cancelled', 'no_show'], true)) {
        $payload += ['user_id' => (int)$booking['user_id'], 'title' => 'Grooming booking closed', 'message' => 'The clinic has closed this grooming booking. Contact the clinic about rescheduling or any payment arrangements.', 'redirect_path' => '/dashboard'];
    } else return;
    // In-app only; concern text and clinical assessment are never sent in a notification.
    notification_create($pdo, $payload);
}
