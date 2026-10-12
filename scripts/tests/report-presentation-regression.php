<?php
// Pure rendering/data-contract checks. Nothing connects to or changes the database.
require_once __DIR__ . '/../../php/reports_common.php';
require_once __DIR__ . '/report-fixtures.php';

set_error_handler(static function (int $severity, string $message, string $file, int $line): bool {
    if (!(error_reporting() & $severity)) return false;
    throw new ErrorException($message, 0, $severity, $file, $line);
});

$reportAssertionCount = 0;
function report_expect(bool $condition, string $description): void
{
    global $reportAssertionCount;
    if (!$condition) {
        throw new RuntimeException($description);
    }
    $reportAssertionCount++;
}

function report_narrative(array $report): string
{
    $summary = $report['summary'] ?? [];
    return json_encode([
        $summary['executive_text'] ?? '',
        $summary['text'] ?? '',
        $summary['discussion'] ?? [],
        $summary['management_actions'] ?? [],
        $summary['scope_note'] ?? '',
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

function report_sections_with_key(array $report, string $key): array
{
    return array_values(array_filter($report['sections'], static fn($section) => in_array($key, array_column($section['columns'], 'key'), true)));
}

function report_section_rows(array $report, string $key): array
{
    $sections = report_sections_with_key($report, $key);
    return array_merge([], ...array_map(static fn($section) => $section['rows'], $sections));
}

function report_find_row(array $rows, string $key, $value): array
{
    foreach ($rows as $row) if (($row[$key] ?? null) === $value) return $row;
    throw new RuntimeException("Expected fixture row {$key}={$value} is missing");
}

function report_expect_number($actual, float $expected, string $description): void
{
    report_expect(is_numeric($actual) && abs((float)$actual - $expected) < 0.00001, $description);
}

$range = report_fixture_range();
$fixtures = report_fixture_reports();
$presented = [];
$distinctSummaries = [];
$allowedFormats = ['text', 'number', 'integer', 'quantity', 'currency', 'money', 'percent', 'percentage', 'date', 'datetime', 'date_time', 'time', 'status', 'bytes', 'minutes', 'duration'];

foreach ($fixtures as $type => $fixture) {
    $report = reports_enrich_report($fixture, $range, []);
    $presented[$type] = $report;
    $summary = $report['summary'];
    report_expect(trim((string)($summary['executive_text'] ?? '')) !== '', "{$type}: Executive Summary is present");
    report_expect(trim((string)($summary['text'] ?? '')) !== '', "{$type}: dashboard caption is present");
    report_expect(is_array($summary['discussion'] ?? null) && count($summary['discussion']) > 0, "{$type}: Discussion is present");
    report_expect(trim((string)($summary['record_unit'] ?? '')) !== '', "{$type}: count has an explicit record unit");
    report_expect(is_int($summary['record_count'] ?? null), "{$type}: count is an integer");
    report_expect(strpos(report_narrative($report), 'obsolete generic summary') === false, "{$type}: legacy generic copy is replaced");
    report_expect(!preg_match('/valuable insights|enhance[s]? operational efficiency|use this report to/i', report_narrative($report)), "{$type}: generic advisory copy is removed");
    report_expect(is_array($report['sections'] ?? null) && count($report['sections']) > 0, "{$type}: report has named table sections");
    $ids = [];
    foreach ($report['sections'] as $section) {
        report_expect(trim((string)($section['id'] ?? '')) !== '', "{$type}: section has a stable ID");
        report_expect(trim((string)($section['title'] ?? '')) !== '', "{$type}: section has a useful heading");
        report_expect(is_array($section['rows'] ?? null), "{$type}: section rows are an array");
        report_expect(is_array($section['columns'] ?? null) && count($section['columns']) > 0, "{$type}: section defines columns");
        $ids[] = $section['id'];
        foreach ($section['columns'] as $column) {
            report_expect(isset($column['key'], $column['label']), "{$type}: columns define key and label");
            report_expect(isset($column['format']), "{$type}: every column declares its data format");
            report_expect(in_array($column['format'], $allowedFormats, true), "{$type}: column format is supported ({$column['format']})");
        }
    }
    report_expect(count($ids) === count(array_unique($ids)), "{$type}: section IDs are unique");
    $distinctSummaries[] = $summary['executive_text'];
    echo "PASS: {$type} has its own Executive Summary, Discussion, and table sections\n";
}

report_expect(count(array_unique($distinctSummaries)) === 15, 'Every populated report has a different Executive Summary');

$sales = $presented['sales'];
report_expect($sales['summary']['record_count'] === 3, 'Sales counts collection events rather than daily rows');
report_expect((float)$sales['totals']['total_sales'] === -50.0, 'Refund-heavy sales retain negative net collections');
report_expect(stripos(report_narrative($sales), 'refund') !== false, 'Sales discussion explains refunds');
report_expect(strpos(report_narrative($sales), '150') !== false && strpos(report_narrative($sales), '50') !== false, 'Sales discussion includes refund and net amounts');
report_expect(count(report_section_rows($sales, 'date')) >= 2, 'Daily collection dates remain available');

$billing = $presented['billing'];
$billingSections = report_sections_with_key($billing, 'balance');
report_expect(count($billingSections) >= 2, 'Open and settled billing records are in separate sections');
$hasOpen = false;
$hasSettled = false;
foreach ($billingSections as $section) {
    $balances = array_column($section['rows'], 'balance');
    if ($balances && min($balances) > 0) {
        $hasOpen = true;
        report_expect((float)$balances[0] === 700.0, 'Largest outstanding balance appears first');
    }
    if ($balances && max($balances) == 0) {
        $hasSettled = true;
    }
}
report_expect($hasOpen && $hasSettled, 'Billing partitions positive balances and settled rows');

$receiptRows = report_section_rows($presented['invoice_receipt'], 'amount_paid');
report_expect(in_array(-150.0, array_column($receiptRows, 'amount_paid'), true), 'Receipt register preserves the signed refund value');
report_expect((bool)preg_match('/internal|derived|system reference/i', report_narrative($presented['invoice_receipt'])), 'Derived payment IDs are described as internal references');

$serviceText = report_narrative($presented['service_utilization']);
report_expect(strpos($serviceText, 'Consultation') !== false && strpos($serviceText, 'Vaccination') !== false, 'Tied service leaders are both named');
report_expect((bool)preg_match('/tie|joint|each|share|same/i', $serviceText), 'Service discussion acknowledges tied counts');
report_expect(count(report_sections_with_key($presented['service_utilization'], 'service_name')) >= 2, 'Unused catalog services are separated from recorded use');

$appointment = $presented['appointment'];
report_expect(stripos(report_narrative($appointment), 'upcoming') !== false || stripos(report_narrative($appointment), 'future') !== false, 'Appointment discussion distinguishes future bookings');
report_expect(!preg_match('/missed\/rescheduled/i', json_encode($appointment['sections'])), 'Reschedule notes do not become mutually exclusive booking statuses');

$queue = $presented['queue'];
report_expect((float)$queue['totals']['average_waiting_minutes'] === 15.0, 'Measured waiting average excludes missing timestamps');
$queueRows = report_section_rows($queue, 'waiting_minutes');
report_expect(count(array_filter($queueRows, static fn($row) => array_key_exists('waiting_minutes', $row) && $row['waiting_minutes'] === null)) >= 2, 'Unknown waiting measurements remain unavailable rather than zero');
report_expect((bool)preg_match('/measur|recorded.*time|timing/i', report_narrative($queue)), 'Queue discussion states timing coverage');

$clinicalJson = json_encode($presented['consultation']['sections'], JSON_UNESCAPED_UNICODE);
report_expect(strpos($clinicalJson, 'Medication administration and response have not yet been verified') !== false, 'Full clinical notes survive section construction');
report_expect(!preg_match('/patients? recovered|successful treatment|improved care quality/i', report_narrative($presented['consultation'])), 'Consultation counts do not imply clinical outcomes');

$followText = report_narrative($presented['follow_up']);
report_expect((bool)preg_match('/past due|past-due/i', $followText), 'Follow-ups identify elapsed scheduled dates');
report_expect((bool)preg_match('/unverified|not confirm|completion.*unknown|does not establish/i', $followText), 'Past dates do not establish follow-up attendance');
report_expect(!preg_match('/\bmissed\b/i', $followText), 'Follow-up summary does not claim missed attendance');

report_expect(count(report_sections_with_key($presented['emr_request'], 'request_number')) >= 2, 'Open and completed EMR requests have separate worklists');
report_expect(!preg_match('/breach|sla|required turnaround/i', report_narrative($presented['emr_request'])), 'EMR discussion does not invent turnaround requirements');

$inventory = $presented['inventory_status'];
report_expect((bool)preg_match('/current|snapshot|generation/i', $inventory['summary']['scope_note']), 'Inventory scope states its current snapshot basis');
$attentionFound = false;
foreach (report_sections_with_key($inventory, 'item_name') as $section) {
    $names = array_column($section['rows'], 'item_name');
    if (in_array('Test amoxicillin', $names, true) && in_array('Test saline', $names, true) && in_array('Test supplement', $names, true) && !in_array('Test food', $names, true)) {
        $attentionFound = true;
        report_expect(count(array_unique($names)) === count($names), 'Overlapping stock/expiry alerts do not duplicate affected items');
    }
}
report_expect($attentionFound, 'Inventory worklist contains the three distinct alerted items');
report_expect(!preg_match('/4 (?:items|products).*attention/i', report_narrative($inventory)), 'Inventory summary does not add overlapping alert counts');

$movement = $presented['stock_movement'];
report_expect(count(report_sections_with_key($movement, 'unit')) > 0, 'Stock movement summary retains units');
report_expect(!preg_match('/stock-in quantity 20|stock-out.{0,25}quantity 9|29 units/i', report_narrative($movement)), 'Mixed stock units are not combined into a global quantity');
report_expect(stripos(json_encode($movement['sections']), 'reference') !== false, 'Stock movement audit includes its source reference');

$productText = report_narrative($presented['medicine_product_sales']);
report_expect(strpos($productText, 'Test vaccine') !== false, 'Product discussion names the value leader');
report_expect((bool)preg_match('/allocat|proportio/i', $productText), 'Product collected value explains payment allocation');
report_expect(!preg_match('/profit is|cash received.{0,20}300/i', $productText), 'Allocated product value is not called profit or period cash received');
report_expect(count(report_sections_with_key($presented['medicine_product_sales'], 'unit')) > 0, 'Issued product quantities retain their units');

$stayColumns = json_encode(array_map(static fn($section) => $section['columns'], $presented['confinement_pet_hotel']['sections']));
report_expect(stripos($stayColumns, 'planned') !== false && stripos($stayColumns, 'actual') !== false, 'Stay registers distinguish planned dates from actual dates');
report_expect((bool)preg_match('/whole.stay|full.stay|entire.stay|not.*period collection|billing/i', report_narrative($presented['confinement_pet_hotel'])), 'Stay financial totals explain their billing basis');

$legacyBoarding = $fixtures['confinement_pet_hotel'];
$legacyBoarding['rows'][0]['hotel_boarding_type'] = 'boarding';
$legacyBoarding = reports_enrich_report($legacyBoarding, $range, []);
$confinementSection = array_values(array_filter($legacyBoarding['sections'], static fn($section) => $section['id'] === 'confinement_stays'))[0];
report_expect(in_array($legacyBoarding['rows'][0]['booking_number'], array_column($confinementSection['rows'], 'booking_number'), true), 'Legacy boarding type is classified as confinement');

report_expect(strpos(json_encode($presented['consent_form']['sections']), 'pending') !== false, 'Pending client consents remain on the tracking worklist');
$vetText = report_narrative($presented['veterinarian_activity']);
report_expect(strpos($vetText, 'Dr. Test A') !== false && strpos($vetText, 'Dr. Test B') !== false, 'Tied veterinarian workloads name both veterinarians');
report_expect((bool)preg_match('/scheduled|follow-up dates/i', $vetText), 'Veterinarian follow-ups are described as scheduled dates');
report_expect(!preg_match('/completed follow-ups|most productive|best veterinarian/i', $vetText), 'Scheduled follow-ups and case counts do not imply completed care or productivity');

$edges = [];
foreach (report_fixture_edge_cases() as $name => $fixture) {
    $edges[$name] = reports_enrich_report($fixture, $range, []);
}
report_expect((bool)preg_match('/unavailable|cannot|could not/i', report_narrative($edges['unavailable_sales'])), 'Unavailable financial sources are distinguished from empty activity');
report_expect(report_narrative($edges['unavailable_sales']) !== report_narrative($edges['empty_sales']), 'Unavailable and empty sales have different explanations');
report_expect(!preg_match('/consultation (?:leads|is the most)|most used service is consultation/i', report_narrative($edges['service_without_activity'])), 'Zero usage does not identify a service leader');
report_expect($edges['queue_without_measured_waits']['totals']['average_waiting_minutes'] === null, 'No measured waits produces an unavailable average');
report_expect(!preg_match('/average.{0,20}0 (?:minute|min)/i', report_narrative($edges['queue_without_measured_waits'])), 'Missing queue measurements do not claim a zero-minute average');
$templateText = report_narrative($edges['consent_templates_only']);
report_expect(stripos($templateText, 'template') !== false, 'Consent fallback describes uploaded templates');
report_expect(!preg_match('/1 (?:signed|client consent)|signed.{0,10}1/i', $templateText), 'One template is not counted as signed client consent');

$daily = report_sections_with_key($sales, 'date')[0];
report_expect_number($daily['footer']['gross_receipts'], 100.0, 'Daily collection footer reconciles gross receipt value');
report_expect_number($daily['footer']['refund_amount'], 150.0, 'Daily collection footer reconciles refund value');
report_expect_number($daily['footer']['total_sales'], -50.0, 'Daily collection footer reconciles negative net value');
$methodRows = report_section_rows($sales, 'net_collections');
report_expect_number(array_sum(array_column($methodRows, 'net_collections')), -50.0, 'Payment-method net values reconcile to period net collections');
report_expect_number(array_sum(array_column($methodRows, 'receipt_count')), 2.0, 'Payment-method receipt counts exclude refunds');
report_expect_number(array_sum(array_column($methodRows, 'refund_count')), 1.0, 'Payment-method refund count is separate');
report_expect_number(array_sum(array_column($receiptRows, 'amount_paid')), -50.0, 'Receipt and refund registers reconcile to net signed amount');

$serviceRows = report_section_rows($presented['service_utilization'], 'usage_share');
foreach ($serviceRows as $row) report_expect_number($row['usage_share'], 50.0, 'Each tied service contributes half of the recorded charge entries');
report_expect_number(report_find_row($serviceRows, 'service_name', 'Vaccination')['distinct_visits'], 2.0, 'Distinct service visits remain separate from three charge entries');
$statusRows = report_section_rows($appointment, 'other');
report_expect_number(array_sum(array_column($statusRows, 'total')), 3.0, 'Appointment status summary counts each booking once');
foreach ($statusRows as $row) report_expect_number($row['pending'] + $row['confirmed'] + $row['completed'] + $row['cancelled'] + $row['other'], (float)$row['total'], 'Appointment statuses form a disjoint service subtotal');
$flowRows = report_section_rows($queue, 'measured_handoffs');
report_expect_number(array_sum(array_column($flowRows, 'entries')), 3.0, 'Queue flow groups preserve the three arrivals');
report_expect_number(array_sum(array_column($flowRows, 'measured_handoffs')), 1.0, 'Queue flow groups count only the measured handoff');

$movementRows = report_section_rows($movement, 'net_change');
$bottles = report_find_row($movementRows, 'unit', 'bottle');
report_expect_number($bottles['incoming'], 20.0, 'Bottle group has the measured incoming quantity');
report_expect_number($bottles['outgoing'], 7.0, 'Bottle group has the measured outgoing quantity');
report_expect_number($bottles['net_change'], 13.0, 'Bottle group net change reconciles incoming and outgoing');
$tablets = report_find_row($movementRows, 'unit', 'tablet');
report_expect_number($tablets['net_change'], -2.0, 'Tablet adjustment remains a separate quantity group');

$productRows = report_section_rows($presented['medicine_product_sales'], 'value_share');
report_expect_number(array_sum(array_column($productRows, 'billed_value')), 500.0, 'Issued-item billed values reconcile independently of payments');
report_expect_number(array_sum(array_column($productRows, 'total_sales')), 300.0, 'Issued-item allocated values reconcile independently of billed value');
report_expect_number(report_find_row($productRows, 'item_name', 'Test vaccine')['value_share'], 66.7, 'Value share uses allocated collected value');
$vetRows = report_section_rows($presented['veterinarian_activity'], 'recorded_consultations');
report_expect_number(array_sum(array_column($vetRows, 'recorded_consultations')), 6.0, 'Veterinarian consultation volume excludes scheduled follow-up dates');
report_expect_number(array_sum(array_column($vetRows, 'scheduled_follow_ups')), 6.0, 'Veterinarian scheduled dates remain a distinct total');
report_expect_number(array_sum(array_column($vetRows, 'finalized_cases')), 5.0, 'Finalized clinical records retain the canonical builder count');
report_expect_number(array_sum(array_column($vetRows, 'unfinalized_cases')), 1.0, 'Created-date fallback records retain the canonical builder count');
foreach ($vetRows as $row) report_expect_number($row['workload_share'], 50.0, 'Tied veterinarian shares use consultation counts');

$stayRows = report_section_rows($presented['confinement_pet_hotel'], 'actual_admission');
$reservedStay = report_find_row($stayRows, 'booking_number', 'BOOK-000082');
report_expect($reservedStay['actual_admission'] === null && $reservedStay['actual_release'] === null, 'A reserved stay does not copy planned dates into actual timestamps');
report_expect($reservedStay['actual_days'] === null, 'A reserved stay has no measured actual duration');
report_expect_number($reservedStay['planned_days'], 3.0, 'Planned stay duration uses its planned dates');
$requestRows = report_section_rows($presented['emr_request'], 'processing_days');
report_expect_number(report_find_row($requestRows, 'request_number', 'REQ-000052')['processing_days'], 1.0, 'EMR processing duration uses canonical submission and completion dates');

$fractionalRow = report_section_rows($edges['fractional_stock'], 'stock_level')[0];
foreach (['stock_level' => .75, 'on_hand_stock' => 1.25, 'reorder_level' => 1.5, 'expired_stock' => .5, 'near_expiry_stock' => .25] as $key => $quantity) report_expect_number($fractionalRow[$key], $quantity, "Fractional inventory {$key} is preserved");
report_expect(str_contains($fractionalRow['expiry_alert'], 'expired') && str_contains($fractionalRow['expiry_alert'], 'near expiry'), 'One inventory item can retain both measured expiry alerts');
$unknownRow = report_section_rows($edges['stock_measurements_unavailable'], 'stock_level')[0];
foreach (['stock_level', 'on_hand_stock', 'expired_stock', 'near_expiry_stock'] as $key) report_expect($unknownRow[$key] === null, "Unavailable inventory {$key} stays unknown");
report_expect($unknownRow['stock_status'] === 'unknown', 'Missing stock measurements do not become an out-of-stock classification');
$partialStockRows = report_section_rows($edges['stock_unknown_with_expiry_alert'], 'stock_level');
report_expect(count($partialStockRows) === 1 && $partialStockRows[0]['stock_level'] === null, 'A known expiry alert does not duplicate an item with unknown usable stock');
report_expect((bool)preg_match('/unavailable stock|stock.{0,25}unknown|unavailable.{0,25}measurement|missing quantities/i', report_narrative($edges['stock_unknown_with_expiry_alert'])), 'Inventory discussion acknowledges unknown stock even when expiry needs attention');
$fractionalMovementRow = report_section_rows($edges['fractional_movements'], 'net_change')[0];
report_expect_number($fractionalMovementRow['incoming'], 1.25, 'Fractional incoming stock is retained');
report_expect_number($fractionalMovementRow['outgoing'], .5, 'Fractional outgoing stock is retained');
report_expect_number($fractionalMovementRow['net_change'], .75, 'Fractional net stock reconciles');
$fractionalProductRow = report_section_rows($edges['fractional_products'], 'quantity_sold')[0];
report_expect_number($fractionalProductRow['quantity_sold'], .5, 'Fractional issued product quantity is retained');
report_expect_number($fractionalProductRow['remaining_stock'], 1.25, 'Fractional current product stock is retained');
report_expect_number($fractionalProductRow['value_share'], 100.0, 'A sole collected-value item has the correct percentage');
$sameNameLocations = $fixtures['stock_movement'];
$sameNameLocations['rows'] = array_slice($sameNameLocations['rows'], 0, 2);
$sameNameLocations['rows'][1]['location_id'] = 2;
$sameNameLocationReport = reports_enrich_report($sameNameLocations, $range, []);
report_expect(count(report_section_rows($sameNameLocationReport, 'net_change')) === 2, 'Separate location IDs retain separate balances even when their display names match');

foreach ($fixtures as $type => $fixture) {
    $empty = $fixture;
    $empty['rows'] = [];
    $empty['totals'] = array_map(static fn($value) => is_numeric($value) ? 0 : null, $fixture['totals']);
    unset($empty['payment_methods']);
    $report = reports_enrich_report($empty, $range, []);
    report_expect(trim((string)$report['summary']['executive_text']) !== '', "{$type}: empty period has an explanation");
    report_expect($report['summary']['record_count'] === 0, "{$type}: empty period reports zero records");
    $unavailable = $empty;
    $unavailable['missing_data'] = ['Required source data is unavailable.'];
    $failed = reports_enrich_report($unavailable, $range, []);
    report_expect((bool)preg_match('/unavailable|cannot|could not/i', report_narrative($failed)), "{$type}: unavailable sources are explained");
    report_expect($failed['summary']['executive_text'] !== $report['summary']['executive_text'], "{$type}: unavailable sources are not described as an empty period");
}

$partial = $fixtures['queue'];
$partial['missing_data'] = ['Some assignment source records could not be loaded.'];
$partialReport = reports_enrich_report($partial, $range, []);
report_expect($partialReport['summary']['record_count'] === 3, 'Partial source availability preserves loaded queue records');
report_expect((bool)preg_match('/incomplete|records that could be loaded|partial/i', report_narrative($partialReport)), 'Partial sources explain the limits of the findings');

$comparisonRange = $range;
$comparisonRange['label'] = 'the previous selected period';
$currentSales = $fixtures['sales'];
$currentSales['totals']['total_sales'] = 80.0;
$previousSales = $fixtures['sales'];
$previousSales['totals']['total_sales'] = 100.0;
$salesComparison = reports_comparison_summary($currentSales, $previousSales, $comparisonRange);
report_expect($salesComparison['rows'][0]['key'] === 'total_sales' && $salesComparison['rows'][0]['label'] === 'Net collections', 'Sales comparison leads with net collections');
report_expect($salesComparison['rows'][0]['direction'] === 'down', 'Collection decrease has the correct direction');
report_expect(strpos($salesComparison['rows'][0]['absolute_change'], '-') === false, 'Natural discussion uses an absolute decrease amount');
report_expect((bool)preg_match('/still open|incomplete period/i', $salesComparison['text']), 'An unfinished period states its comparison limit');

$currentAppointments = $fixtures['appointment'];
$currentAppointments['totals']['completion_rate'] = 70.0;
$previousAppointments = $fixtures['appointment'];
$previousAppointments['totals']['completion_rate'] = 60.0;
$appointmentComparison = reports_comparison_summary($currentAppointments, $previousAppointments, $comparisonRange);
$rateRows = array_values(array_filter($appointmentComparison['rows'], static fn($row) => $row['key'] === 'completion_rate'));
report_expect(count($rateRows) === 1 && $rateRows[0]['change'] === '+10.0 percentage points', 'Completion rates compare percentage-point changes');
report_expect($rateRows[0]['change_percent'] === null, 'Completion rate differences do not also claim relative percent growth');
report_expect((bool)preg_match('/status|settlement/i', $appointmentComparison['text']), 'Comparisons explain currently recorded status');

$unavailableComparison = $previousSales;
$unavailableComparison['missing_data'] = ['Payment records could not be loaded.'];
$failedComparison = reports_comparison_summary($currentSales, $unavailableComparison, $comparisonRange);
report_expect($failedComparison['rows'] === [], 'A failed source prevents numerical period comparisons');
report_expect(stripos($failedComparison['text'], 'unavailable') !== false, 'A failed comparison states source unavailability');

$stockComparison = reports_comparison_summary($fixtures['stock_movement'], $fixtures['stock_movement'], $comparisonRange);
report_expect(array_column($stockComparison['rows'], 'key') === ['total_movements'], 'Stock comparisons do not sum quantities with mixed units');
$followComparison = reports_comparison_summary($fixtures['follow_up'], $fixtures['follow_up'], $comparisonRange);
report_expect(array_column($followComparison['rows'], 'key') === ['total_follow_ups'], 'Follow-up comparisons count scheduled dates rather than completed attendance');
$inventoryComparison = reports_comparison_summary($fixtures['inventory_status'], $fixtures['inventory_status'], $comparisonRange);
report_expect($inventoryComparison['rows'] === [], 'Current inventory snapshots have no historical activity comparison');
$unknownComparison = reports_comparison_summary(['type' => 'unsupported', 'rows' => [1, 2], 'totals' => []], ['type' => 'unsupported', 'rows' => [1], 'totals' => []], $comparisonRange);
report_expect($unknownComparison['rows'] === [], 'Unsupported comparisons do not silently fall back to generic row counts');
$stayComparison = reports_comparison_summary($fixtures['confinement_pet_hotel'], $fixtures['confinement_pet_hotel'], $comparisonRange);
report_expect((bool)preg_match('/stay spanning|full charge|whole.stay/i', $stayComparison['text']), 'Stay comparisons explain overlapping cohorts and whole-stay charges');

echo "PASS: {$reportAssertionCount} report presentation assertions; no database access\n";
