<?php

function vetQueueAssignmentsTableExists(PDO $pdo): bool
{
    $stmt = $pdo->query("SHOW TABLES LIKE 'vet_queue_assignments'");

    return (bool)$stmt->fetchColumn();
}

function requireVetQueueAssignmentsTable(PDO $pdo): void
{
    if (!vetQueueAssignmentsTableExists($pdo)) {
        throw new RuntimeException('Missing vet_queue_assignments table. Run vet_queue_assignments_migration.sql before using veterinarian receive/return.');
    }
}

function normalizeVetName(?array $user, string $fallback = ''): string
{
    $fullName = trim(sprintf(
        '%s %s',
        $user['first_Name'] ?? '',
        $user['last_Name'] ?? ''
    ));

    return $fullName !== '' ? $fullName : ($fallback !== '' ? $fallback : 'Veterinarian');
}
