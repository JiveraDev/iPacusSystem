<?php

function clinical_intake_update(PDO $pdo, int $intakeId, string $status, array $fields): void
{
    if (!in_array($status, ['in_progress', 'completed'], true)) {
        throw new InvalidArgumentException('Invalid examination status.');
    }

    // Native prepared parameters and SQL literals can use different collations.
    // Status is already validated; choose the timestamp expression in PHP so
    // saving never depends on a string comparison between those collations.
    $completedAtSql = $status === 'completed' ? 'COALESCE(completed_at, NOW())' : 'NULL';
    $stmt = $pdo->prepare("UPDATE clinical_intakes SET
        chief_complaint = ?, symptoms = ?, major_symptoms = ?, physical_exam = ?,
        vital_signs = ?, attachments = ?, status = ?,
        completed_at = {$completedAtSql}
        WHERE intake_id = ?");
    $stmt->execute([
        $fields['chief_complaint'],
        $fields['symptoms'],
        $fields['major_symptoms'],
        $fields['physical_exam'],
        $fields['vital_signs'],
        $fields['attachments'],
        $status,
        $intakeId,
    ]);
}
