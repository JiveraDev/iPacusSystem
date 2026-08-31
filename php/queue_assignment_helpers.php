<?php

function vetQueueAssignmentsTableExists(PDO $pdo): bool
{
    $stmt = $pdo->query("SHOW TABLES LIKE 'vet_queue_assignments'");

    return (bool)$stmt->fetchColumn();
}

function requireVetQueueAssignmentsTable(PDO $pdo): void
{
    if (!vetQueueAssignmentsTableExists($pdo)) {
        throw new RuntimeException('The veterinarian queue-assignment schema is missing. Restore the repository baseline DDL, then run DDL/20260723_01_backend_integrity_schema.sql.');
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
