<?php
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../../php/db.php';
require_once __DIR__ . '/../../php/inventory_invoice_helpers.php';

if (!in_array(strtolower(getenv('DB_HOST') ?: 'localhost'), ['localhost', '127.0.0.1', '::1'], true)) {
    fwrite(STDERR, "Run these temporary-table checks only on a local database.\n");
    exit(1);
}

$checks = 0;
function deletion_check(bool $condition, string $label): void
{
    global $checks;
    if (!$condition) throw new RuntimeException('FAIL: ' . $label);
    $checks++;
}

// Check the real schema read-only; all writes below use connection-local tables.
$column = $pdo->query("SHOW COLUMNS FROM visit_charges LIKE 'item_id'")->fetch();
deletion_check(($column['Null'] ?? '') === 'YES', 'Existing schema supports detaching invoice links without a migration');
$pdo->exec("CREATE TEMPORARY TABLE visit_charges (
    charge_id INT PRIMARY KEY, visit_id INT NOT NULL,
    charge_type VARCHAR(30), item_id INT NULL, description VARCHAR(255) NOT NULL,
    quantity DECIMAL(10,2), unit_price DECIMAL(10,2), subtotal DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB");
$pdo->exec('CREATE TEMPORARY TABLE inventory_items (item_id INT PRIMARY KEY, item_name VARCHAR(150)) ENGINE=InnoDB');
$pdo->exec('CREATE TEMPORARY TABLE visit_payments (payment_id INT PRIMARY KEY, visit_id INT, amount DECIMAL(10,2), payment_status VARCHAR(20)) ENGINE=InnoDB');
$pdo->exec("INSERT INTO inventory_items VALUES (1, 'Renamed product'), (2, 'Unrelated product')");
$pdo->exec("INSERT INTO visit_payments VALUES (1, 10, 250, 'verified'), (2, 11, 0, 'pending'), (3, 12, 50, 'refunded')");
$insert = $pdo->prepare("INSERT INTO visit_charges
    (charge_id, visit_id, charge_type, item_id, description, quantity, unit_price, subtotal, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, '2026-01-01 10:00:00', '2026-01-02 10:00:00')");
foreach ([
    [1, 10, 'medication', 1, 'Original billed product name', 2, 125, 250],
    [2, 11, 'retail_product', 1, ' ', 1.5, 20, 30],
    [3, 12, 'consumable', 1, 'Included supply', 1, 0, 0],
    [4, 13, 'medication', 2, 'Other product', 1, 80, 80],
    [5, 10, 'service', null, 'Consultation', 1, 100, 100],
] as $row) $insert->execute($row);

$before = $pdo->query('SELECT * FROM visit_charges ORDER BY charge_id')->fetchAll();
$paymentsBefore = $pdo->query('SELECT * FROM visit_payments ORDER BY payment_id')->fetchAll();
try {
    inventoryDetachInvoiceReferences($pdo, 1, 'Renamed product');
    throw new RuntimeException('Missing transaction was accepted');
} catch (LogicException $error) {
    deletion_check(true, 'Invoice unlinking requires an enclosing transaction');
}

// A failed inventory delete/audit must restore every invoice reference.
$pdo->beginTransaction();
inventoryDetachInvoiceReferences($pdo, 1, 'Renamed product');
$pdo->exec('DELETE FROM inventory_items WHERE item_id = 1');
$pdo->rollBack();
deletion_check($pdo->query('SELECT * FROM visit_charges ORDER BY charge_id')->fetchAll() === $before, 'Rollback restores invoice links and descriptions');
deletion_check((int)$pdo->query('SELECT COUNT(*) FROM inventory_items WHERE item_id = 1')->fetchColumn() === 1, 'Rollback restores product');

$pdo->beginTransaction();
$ids = inventoryDetachInvoiceReferences($pdo, 1, 'Renamed product');
deletion_check($ids === [1, 2, 3], 'Audit receives every preserved charge ID');
deletion_check(inventoryDetachInvoiceReferences($pdo, 999, 'Unused') === [], 'No invoice links is a normal deletion case');
$pdo->exec('DELETE FROM inventory_items WHERE item_id = 1');
$pdo->commit();

$after = $pdo->query('SELECT * FROM visit_charges ORDER BY charge_id')->fetchAll();
deletion_check(count($after) === count($before), 'No invoice lines deleted');
foreach ($after as $index => $charge) {
    $expected = $before[$index];
    if ($index < 3) {
        $expected['item_id'] = null;
        if ($index === 1) $expected['description'] = 'Renamed product';
    }
    deletion_check($charge === $expected, 'Only the intended link and legacy blank description changed for charge ' . $charge['charge_id']);
}
deletion_check((int)$pdo->query('SELECT COUNT(*) FROM inventory_items WHERE item_id = 1')->fetchColumn() === 0, 'Product permanently removed, not archived');
deletion_check($pdo->query('SELECT * FROM visit_payments ORDER BY payment_id')->fetchAll() === $paymentsBefore, 'Paid, unpaid and refunded payment records untouched');
$retained = $pdo->query('SELECT vc.charge_id, vc.description, vc.subtotal FROM visit_charges vc LEFT JOIN inventory_items ii ON ii.item_id = vc.item_id ORDER BY vc.charge_id')->fetchAll();
deletion_check(count($retained) === 5 && $retained[0]['description'] === 'Original billed product name', 'Invoice and medical-history LEFT JOIN keeps deleted-product charges visible');
deletion_check((float)$pdo->query('SELECT SUM(subtotal) FROM visit_charges')->fetchColumn() === 460.0, 'Invoice totals unchanged');

echo "PASS: $checks invoice-preserving inventory deletion checks. Only temporary fixtures were changed.\n";
