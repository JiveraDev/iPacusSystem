<?php
// Pure report helpers only: no database connection or live records are needed.
require_once __DIR__ . '/../../php/reports_common.php';

function expect_same($actual, $expected, string $description): void
{
    if ($actual !== $expected) {
        throw new RuntimeException($description . ': ' . var_export($actual, true));
    }
    echo "PASS: {$description}\n";
}

expect_same(reports_filters(['payment_method' => 'cash']), [], 'Flat payment filters are ignored');
expect_same(
    reports_filters(['filters' => ['payment_method' => 'gcash', 'branch_id' => 2]]),
    ['branch_id' => 2],
    'Nested payment filters are ignored while branch scope remains'
);
expect_same(
    reports_filters(['filters' => '{"payment_method":"cash","service_type":"consultation"}']),
    ['service_type' => 'consultation'],
    'Previously saved JSON filters cannot restrict payment methods'
);
expect_same(
    reports_payment_method_labels('cash, gcash, maya, paymaya, bank_transfer, credit_card'),
    'Cash, GCash, Maya, Bank Transfer, Credit Card',
    'Payment methods remain distinct with readable, deduplicated labels'
);
expect_same(reports_payment_method_labels(''), 'No verified payment', 'Unpaid records are not labeled as cash');

$totals = reports_financial_totals([
    ['total_bill' => 100, 'service_sales' => 70, 'product_sales' => 30, 'paid_amount' => 100, 'balance' => 0, 'billing_status' => 'paid'],
    ['total_bill' => -20, 'service_sales' => -20, 'product_sales' => 0, 'paid_amount' => -20, 'balance' => 0, 'billing_status' => 'paid'],
]);
expect_same($totals['paid_amount'], 80.0, 'Refunds reduce net collections');
expect_same($totals['service_sales'] + $totals['product_sales'], $totals['total_sales'], 'Sales categories reconcile after refunds');
