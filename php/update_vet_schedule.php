<?php
// Legacy per-service online slots no longer control medical availability.
header('Content-Type: application/json');
http_response_code($_SERVER['REQUEST_METHOD'] === 'POST' ? 409 : 405);
echo json_encode(['message' => 'Use Clinic Booking Schedule in your profile to set clinic preferences and working hours.']);
