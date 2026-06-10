<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/booking_maintenance.php';

header('Content-Type: application/json');

function pet_overdue_resolve_pet_id(PDO $pdo, string $petId): ?int
{
    $petId = trim($petId);
    if ($petId === '') {
        return null;
    }

    if (strpos($petId, 'PET-') === 0) {
        $stmt = $pdo->prepare("SELECT pet_id FROM pets_information WHERE pet_sharable_ID = ? LIMIT 1");
        $stmt->execute([$petId]);
        $resolved = $stmt->fetchColumn();

        return $resolved ? (int)$resolved : null;
    }

    return (int)$petId > 0 ? (int)$petId : null;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['message' => 'Method not allowed.']);
    exit;
}

$petId = trim((string)($_GET['petId'] ?? ''));
$numericPetId = pet_overdue_resolve_pet_id($pdo, $petId);

if ($numericPetId === null || $numericPetId <= 0) {
    http_response_code(404);
    echo json_encode(['message' => 'Pet was not found for overdue cleanup.']);
    exit;
}

try {
    $bookingResult = autoCancelOverdueBookingsDetailed(
        $pdo,
        $numericPetId,
        true,
        'This non-boarding booking was cancelled because it is more than 7 days overdue.'
    );

    $queueResult = autoCancelStaleQueuesDetailed(
        $pdo,
        $numericPetId,
        true,
        'This queue entry was cancelled because it is more than 2 days old and was not completed.'
    );

    $total = (int)$bookingResult['count'] + (int)$queueResult['count'];

    echo json_encode([
        'success' => true,
        'message' => $total > 0
            ? "Cancelled {$total} overdue item(s)."
            : 'No overdue items needed cancellation.',
        'petId' => $numericPetId,
        'bookingsCancelled' => (int)$bookingResult['count'],
        'queuesCancelled' => (int)$queueResult['count'],
        'bookingIds' => $bookingResult['bookingIds'],
        'queueIds' => $queueResult['queueIds'],
    ]);
} catch (Throwable $error) {
    http_response_code(500);
    echo json_encode(['message' => 'Failed to cancel overdue pet activity: ' . $error->getMessage()]);
}
