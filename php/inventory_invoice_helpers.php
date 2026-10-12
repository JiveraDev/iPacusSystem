<?php

/**
 * Detach the live product reference, not the invoice line or its financial data.
 * The caller must lock the product and use the same transaction for deletion
 * and the audit write, so any later failure restores these links as well.
 *
 * @return int[] IDs retained for the inventory deletion audit.
 */
function inventoryDetachInvoiceReferences(PDO $pdo, int $itemId, string $itemName): array
{
    if (!$pdo->inTransaction()) {
        throw new LogicException('Invoice references must be detached inside the inventory deletion transaction.');
    }

    $charges = $pdo->prepare('SELECT charge_id FROM visit_charges WHERE item_id = ? ORDER BY charge_id FOR UPDATE');
    $charges->execute([$itemId]);
    $chargeIds = array_map('intval', $charges->fetchAll(PDO::FETCH_COLUMN));
    if (!$chargeIds) {
        return [];
    }

    // Existing descriptions are historical snapshots: never replace them with
    // today's product name. Only fill legacy blank descriptions before unlinking.
    // Keep invoice timestamps and all amounts unchanged.
    $detach = $pdo->prepare("
        UPDATE visit_charges
        SET description = CASE WHEN TRIM(COALESCE(description, '')) = '' THEN ? ELSE description END,
            item_id = NULL,
            updated_at = updated_at
        WHERE item_id = ?
    ");
    $detach->execute([trim($itemName) ?: 'Deleted inventory product', $itemId]);

    return $chargeIds;
}
