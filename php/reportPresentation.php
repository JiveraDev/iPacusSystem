<?php
// Report-specific reading and presentation. All figures come from the report's
// own rows; these helpers never connect to the database or generate outside text.

function reports_presentation_number($value): string
{
    $number = (float)$value;
    return number_format($number, abs($number - round($number)) > 0.00001 ? 2 : 0);
}

function reports_presentation_money($value): string
{
    return 'PHP ' . number_format((float)$value, 2);
}

function reports_presentation_sum(array $rows, string $key): float
{
    return array_sum(array_map(static fn($row) => is_numeric($row[$key] ?? null) ? (float)$row[$key] : 0.0, $rows));
}

function reports_presentation_column(string $key, string $label, string $format = 'text', float $width = 1, array $secondary = []): array
{
    return ['key' => $key, 'label' => $label, 'format' => $format, 'width' => $width,
        'primary' => in_array($key, ['item_name', 'pet_name', 'service_name', 'veterinarian_name', 'request_number', 'booking_number', 'queue_number', 'receipt_number'], true),
        'secondary_keys' => $secondary];
}

function reports_presentation_section(string $id, string $title, array $columns, array $rows, string $description = '', array $footer = [], array $details = [], string $empty = ''): array
{
    return ['id' => $id, 'title' => $title, 'description' => $description,
        'columns' => $columns, 'rows' => array_values($rows), 'footer' => $footer,
        'row_details' => $details, 'empty_message' => $empty ?: 'No matching records.'];
}

function reports_presentation_date($value): string
{
    if (!$value) return 'not recorded';
    try {
        return (new DateTimeImmutable((string)$value, new DateTimeZone(REPORTS_TIMEZONE)))->format('M j, Y');
    } catch (Exception $exception) {
        return 'not recorded';
    }
}

function reports_presentation_days($from, $to): ?int
{
    if (!$from || !$to) return null;
    try {
        $start = new DateTimeImmutable((string)$from, new DateTimeZone(REPORTS_TIMEZONE));
        $end = new DateTimeImmutable((string)$to, new DateTimeZone(REPORTS_TIMEZONE));
        return (int)$start->setTime(0, 0)->diff($end->setTime(0, 0))->format('%r%a');
    } catch (Exception $exception) {
        return null;
    }
}

function reports_presentation_names(array $rows, string $nameKey): string
{
    $names = array_values(array_unique(array_filter(array_map(static fn($row) => trim((string)($row[$nameKey] ?? '')), $rows))));
    $shown = array_slice($names, 0, 3);
    $text = implode(', ', $shown);
    return count($names) > 3 ? $text . ' and ' . (count($names) - 3) . ' others' : $text;
}

function reports_presentation_leaders(array $rows, string $key): array
{
    if (!$rows) return [];
    $highest = max(array_map(static fn($row) => (float)($row[$key] ?? 0), $rows));
    if ($highest <= 0) return [];
    return array_values(array_filter($rows, static fn($row) => abs((float)($row[$key] ?? 0) - $highest) < 0.00001));
}

function reports_presentation_status($value): string
{
    return strtolower(trim(str_replace(['_', '-'], ' ', (string)$value)));
}

function reports_presentation_result(string $executive, array $discussion, array $sections, string $scope, int $count, string $unit, array $actions = [], string $orientation = 'landscape'): array
{
    return ['executive' => $executive, 'discussion' => $discussion, 'sections' => $sections,
        'scope' => $scope, 'count' => $count, 'unit' => $unit, 'actions' => $actions, 'orientation' => $orientation];
}

function reports_present_report(array $report, array $range, array $filters): array
{
    $rows = is_array($report['rows'] ?? null) ? $report['rows'] : [];
    $totals = is_array($report['totals'] ?? null) ? $report['totals'] : [];
    $missing = array_values(array_filter($report['missing_data'] ?? []));
    $generated = $report['generated_at'] ?? (new DateTimeImmutable('now', new DateTimeZone(REPORTS_TIMEZONE)))->format('Y-m-d H:i:s');
    $today = substr($generated, 0, 10);
    $type = $report['type'] ?? '';
    $data = match ($type) {
        'sales' => reports_present_sales($report, $rows, $totals),
        'billing' => reports_present_billing($rows, $totals),
        'invoice_receipt' => reports_present_receipts($rows),
        'service_utilization' => reports_present_services($rows),
        'appointment' => reports_present_appointments($rows, $today),
        'queue' => reports_present_queue($rows),
        'consultation' => reports_present_consultations($rows),
        'follow_up' => reports_present_followups($rows, $today),
        'emr_request' => reports_present_requests($rows, $today),
        'inventory_status' => reports_present_inventory($rows, $generated),
        'stock_movement' => reports_present_movements($rows),
        'medicine_product_sales' => reports_present_products($rows),
        'confinement_pet_hotel' => reports_present_stays($rows),
        'consent_form' => reports_present_consents($rows, $totals),
        'veterinarian_activity' => reports_present_veterinarians($rows),
        default => reports_presentation_result('Report data is unavailable.', [], [], '', 0, 'records'),
    };
    $sourceFailure = array_filter($missing, static fn($note) => preg_match('/Missing table:|could not be loaded|cannot be calculated|unavailable|no .* available/i', (string)$note));
    if ($sourceFailure && !$rows) {
        $data['executive'] = 'The ' . strtolower($report['title'] ?? 'report') . ' could not be completed because its source data is unavailable.';
        $data['discussion'] = ['An empty result here does not establish that no activity occurred. The unavailable sources are listed in Data Notes.'];
        $data['actions'] = [];
        foreach ($data['sections'] as &$section) $section['empty_message'] = 'Source data is unavailable. See Data Notes.';
        unset($section);
    } elseif ($sourceFailure) {
        $data['discussion'][] = 'These findings cover the records that could be loaded. Some source data is unavailable, so the figures may be incomplete; see Data Notes.';
    }
    $filterSummary = reports_filter_summary($filters);
    if (in_array($type, ['sales', 'billing', 'invoice_receipt'], true)) {
        $filterSummary[] = ['label' => 'Payment methods', 'value' => 'All payment methods'];
    }
    $report['summary'] = [
        'text' => $data['executive'], 'executive_text' => $data['executive'],
        'discussion' => array_values(array_filter($data['discussion'])),
        'operational_context' => '', 'scope_note' => $data['scope'],
        'record_count' => $data['count'], 'record_unit' => $data['unit'],
        'filters' => $filterSummary, 'breakdowns' => [], 'bullets' => [],
        'management_actions' => array_values(array_unique($data['actions'])),
    ];
    $report['sections'] = $data['sections'];
    $report['print_orientation'] = $data['orientation'];
    return $report;
}

function reports_present_sales(array $report, array $rows, array $totals): array
{
    $gross = (float)($totals['gross_receipts'] ?? reports_presentation_sum($rows, 'gross_receipts'));
    $refunds = (float)($totals['refund_amount'] ?? reports_presentation_sum($rows, 'refund_amount'));
    $net = (float)($totals['total_sales'] ?? reports_presentation_sum($rows, 'total_sales'));
    $events = (int)($totals['transaction_count'] ?? reports_presentation_sum($rows, 'receipt_count') + reports_presentation_sum($rows, 'refund_count'));
    usort($rows, static fn($a, $b) => strcmp((string)$a['date'], (string)$b['date']));
    $methods = $report['payment_methods'] ?? [];
    $executive = $rows
        ? 'Net collections were ' . reports_presentation_money($net) . ' across ' . count($rows) . ' collection days. Receipts totalled ' . reports_presentation_money($gross) . ', with ' . reports_presentation_money($refunds) . ' in processed refunds.'
        : 'No verified receipts or processed refunds were recorded in this period.';
    $discussion = [];
    $leaders = reports_presentation_leaders($rows, 'total_sales');
    if ($leaders) $discussion[] = (count($leaders) > 1 ? 'The highest daily net collections were shared by ' : 'The highest daily net collections were on ') . reports_presentation_names($leaders, 'date') . ', at ' . reports_presentation_money($leaders[0]['total_sales']) . ' per day.';
    if ($rows) $discussion[] = 'Of the net collected amount, ' . reports_presentation_money($totals['service_sales'] ?? 0) . ' was allocated to services and ' . reports_presentation_money($totals['product_sales'] ?? 0) . ' to medicines and products. These allocations follow the charge mix of the linked bills; they are not separate new payments.';
    $methodLeaders = reports_presentation_leaders($methods, 'receipt_count');
    if ($methodLeaders) $discussion[] = reports_presentation_names($methodLeaders, 'payment_method') . (count($methodLeaders) > 1 ? ' shared the highest receipt count, with ' : ' had the most receipts, with ') . reports_presentation_number($methodLeaders[0]['receipt_count']) . (count($methodLeaders) > 1 ? ' each.' : '.') . ' Receipt frequency and collected value are shown separately below.';
    if ($net < 0) $discussion[] = 'Refunds exceeded receipts in this period, leaving negative net collections. A refund can relate to a payment made in an earlier period.';
    if (!$rows) $discussion[] = 'The selected payment and refund dates contain no matching collection events. This does not describe the number of bills issued or appointments handled.';
    $columns = [reports_presentation_column('date', 'Collection date', 'date', 1.2), reports_presentation_column('receipt_count', 'Receipts', 'number', .7), reports_presentation_column('gross_receipts', 'Gross receipts', 'currency'), reports_presentation_column('refund_amount', 'Refunds', 'currency'), reports_presentation_column('total_sales', 'Net collections', 'currency'), reports_presentation_column('service_sales', 'Service allocation', 'currency'), reports_presentation_column('product_sales', 'Product allocation', 'currency')];
    $footer = ['date' => 'Period total', 'receipt_count' => reports_presentation_sum($rows, 'receipt_count'), 'gross_receipts' => $gross, 'refund_amount' => $refunds, 'total_sales' => $net, 'service_sales' => $totals['service_sales'] ?? 0, 'product_sales' => $totals['product_sales'] ?? 0];
    $sections = [reports_presentation_section('daily_collections', 'Daily Collections', $columns, $rows, 'Verified receipts and processed refunds, grouped by their posting date.', $footer, [], 'No collections or refunds fall within these dates.')];
    $sections[] = reports_presentation_section('payment_methods', 'Collections by Payment Method', [reports_presentation_column('payment_method', 'Payment method', 'text', 1.6), reports_presentation_column('receipt_count', 'Receipts', 'number'), reports_presentation_column('refund_count', 'Refunds', 'number'), reports_presentation_column('gross_receipts', 'Gross receipts', 'currency'), reports_presentation_column('refund_amount', 'Refund value', 'currency'), reports_presentation_column('net_collections', 'Net collections', 'currency')], $methods, 'Refund counts are separate from receipt counts.', [], [], 'No payment-method activity was recorded.');
    return reports_presentation_result($executive, $discussion, $sections, 'Collection and refund posting dates define this period. All payment methods are included; open bills are covered by the Billing Report.', $events, 'collection events');
}

function reports_present_billing(array $rows, array $totals): array
{
    $open = []; $settled = [];
    foreach ($rows as $row) {
        $row['billing_reference'] = $row['source_reference'] ?? $row['visit_number'] ?? $row['visit_id'] ?? $row['source_id'] ?? 'Not recorded';
        if ((float)($row['balance'] ?? 0) > .005) $open[] = $row; else $settled[] = $row;
    }
    usort($open, static fn($a, $b) => ((float)$b['balance'] <=> (float)$a['balance']) ?: strcmp((string)$a['visit_date'], (string)$b['visit_date']));
    $balance = reports_presentation_sum($open, 'balance');
    $executive = $rows ? count($rows) . ' billing records contain ' . reports_presentation_money($totals['total_sales'] ?? reports_presentation_sum($rows, 'total_bill')) . ' in charges. ' . count($open) . ' remain unsettled, with ' . reports_presentation_money($balance) . ' outstanding.' : 'No billing records match the selected dates and filters.';
    $discussion = [];
    $actions = [];
    if ($open) {
        $top = array_slice($open, 0, 3);
        $discussion[] = 'The ' . count($top) . ' largest open balances account for ' . reports_presentation_money(reports_presentation_sum($top, 'balance')) . ' of the outstanding amount. The largest is ' . reports_presentation_money($open[0]['balance']) . ' for ' . ($open[0]['owner_name'] ?? 'the recorded client') . ' (' . ($open[0]['pet_name'] ?? 'pet not recorded') . ').';
        $actions[] = 'Check the payment history and remaining balance for ' . reports_presentation_names($top, 'billing_reference') . ' before contacting the clients.';
    } elseif ($rows) $discussion[] = 'The included records have no remaining balance. Refunded and zero-value records remain visible with their recorded settlement status.';
    $discussion[] = 'Paid amounts show the current settlement of these billing records and can include payments posted after the billing period. The collection report uses payment dates instead. A bill date alone does not establish when payment became overdue.';
    $columns = [reports_presentation_column('billing_reference', 'Billing reference', 'text', 1.2, ['source_label']), reports_presentation_column('visit_date', 'Bill / visit date', 'date'), reports_presentation_column('owner_name', 'Client / pet', 'text', 1.5, ['pet_name']), reports_presentation_column('total_bill', 'Billed', 'currency'), reports_presentation_column('paid_amount', 'Net paid', 'currency'), reports_presentation_column('balance', 'Balance', 'currency'), reports_presentation_column('billing_status', 'Settlement', 'status')];
    $sections = [];
    foreach ([['open_balances', 'Open Balances', $open], ['settled_bills', 'Settled and Refunded Records', $settled]] as [$id, $title, $records]) {
        $sections[] = reports_presentation_section($id, $title, $columns, $records, $id === 'open_balances' ? 'Largest outstanding amounts first.' : 'Records with no remaining balance.', ['billing_reference' => 'Subtotal', 'total_bill' => reports_presentation_sum($records, 'total_bill'), 'paid_amount' => reports_presentation_sum($records, 'paid_amount'), 'balance' => reports_presentation_sum($records, 'balance')], [['key' => 'charges_summary', 'label' => 'Charges']], 'No ' . ($id === 'open_balances' ? 'open balances' : 'settled or refunded records') . ' match this scope.');
    }
    return reports_presentation_result($executive, $discussion, $sections, 'Bills and linked billing sources selected by their report dates; settlement reflects currently posted payments and refunds.', count($rows), 'billing records', $actions);
}

function reports_present_receipts(array $rows): array
{
    $receipts = []; $refunds = [];
    foreach ($rows as $row) {
        $row['event_type'] = strtolower((string)($row['event_type'] ?? '')) === 'refund' || (float)($row['amount_paid'] ?? 0) < 0 ? 'Refund' : 'Receipt';
        $row['posted_at'] = $row['posted_at'] ?? $row['payment_date'] ?? null;
        if ($row['event_type'] === 'Refund') $refunds[] = $row; else $receipts[] = $row;
    }
    $gross = reports_presentation_sum($receipts, 'amount_paid');
    $returned = -reports_presentation_sum($refunds, 'amount_paid');
    $executive = $rows ? count($receipts) . ' receipt entries total ' . reports_presentation_money($gross) . '. ' . count($refunds) . ' refund entries reduce this by ' . reports_presentation_money($returned) . ', leaving ' . reports_presentation_money($gross - $returned) . ' net.' : 'No payment receipts or processed refunds match this period.';
    $unassigned = array_filter($rows, static fn($row) => in_array(trim((string)($row['processed_by'] ?? '')), ['', 'Unassigned'], true));
    $missingRefs = array_filter($rows, static fn($row) => trim((string)($row['reference_number'] ?? '')) === '' && !in_array(strtolower((string)($row['payment_method'] ?? '')), ['cash'], true));
    $discussion = ['Receipt and refund references identify entries in this system. They are derived from visit, payment, booking, or request IDs and do not establish that an official invoice or receipt was issued.'];
    if ($rows) $discussion[] = count($missingRefs) . ' non-cash entries have no external payment reference recorded; ' . count($unassigned) . ' entries have no processor name. These are documentation checks, not evidence that a payment is invalid.';
    $columns = [reports_presentation_column('posted_at', 'Posted at', 'datetime', 1.3), reports_presentation_column('receipt_number', 'Receipt / refund', 'text', 1.3, ['invoice_number']), reports_presentation_column('client_name', 'Client / pet', 'text', 1.5, ['pet_name']), reports_presentation_column('payment_method', 'Method', 'text'), reports_presentation_column('reference_number', 'External reference', 'text', 1.3), reports_presentation_column('amount_paid', 'Amount', 'currency'), reports_presentation_column('processed_by', 'Processed by', 'text', 1.3)];
    $sections = [reports_presentation_section('payment_register', 'Receipt Register', $columns, $receipts, 'Original positive payment entries, including payments subsequently refunded.', ['receipt_number' => 'Gross receipts', 'amount_paid' => $gross], [['key' => 'payment_status', 'label' => 'Current payment status']], 'No receipt entries match these dates.'), reports_presentation_section('refund_register', 'Processed Refunds', $columns, $refunds, 'Refunds are shown as negative amounts on their processing dates.', ['receipt_number' => 'Refund total', 'amount_paid' => -$returned], [], 'No processed refunds match these dates.')];
    $actions = $missingRefs || $unassigned ? ['Review the entries with missing external references or processor names against their linked payment records.'] : [];
    return reports_presentation_result($executive, $discussion, $sections, 'Verified payment and processed refund dates; linked booking and record-update payments are included where available.', count($rows), 'payment and refund entries', $actions);
}

function reports_present_services(array $rows): array
{
    $used = []; $unused = []; $uses = reports_presentation_sum($rows, 'usage_count');
    foreach ($rows as $row) {
        $row['usage_share'] = $uses > 0 ? round((float)$row['usage_count'] / $uses * 100, 1) : null;
        if ((float)$row['usage_count'] > 0) $used[] = $row; else $unused[] = $row;
    }
    usort($used, static fn($a, $b) => (float)$b['usage_count'] <=> (float)$a['usage_count']);
    $leaders = reports_presentation_leaders($used, 'usage_count');
    $billed = reports_presentation_sum($rows, 'total_revenue');
    $executive = $used ? reports_presentation_number($uses) . ' service charge entries were recorded across ' . count($used) . ' services, with ' . reports_presentation_money($billed) . ' in billed value. ' . reports_presentation_names($leaders, 'service_name') . (count($leaders) > 1 ? ' shared the most recorded uses.' : ' had the most recorded uses.') : 'No service charge entries were recorded in this period.';
    $discussion = [];
    if ($leaders) $discussion[] = 'The leading ' . (count($leaders) > 1 ? 'services each had ' : 'service had ') . reports_presentation_number($leaders[0]['usage_count']) . ' charge entries (' . reports_presentation_number($leaders[0]['usage_share']) . '% of recorded uses' . (count($leaders) > 1 ? ' each' : '') . '). Charge entries, billed quantities, and distinct visits measure different things and are listed separately.';
    if ($unused) $discussion[] = count($unused) . ' active catalog services have no matching charges: ' . reports_presentation_names($unused, 'service_name') . '. This records an absence of charges in the selected scope; it does not explain why a service was unused.';
    $discussion[] = 'Billed value comes from service charge lines. It is not verified cash collection, and a charge entry alone does not confirm that a procedure was completed.';
    $columns = [reports_presentation_column('service_name', 'Service', 'text', 2, ['service_type']), reports_presentation_column('usage_count', 'Charge entries', 'number'), reports_presentation_column('distinct_visits', 'Distinct visits', 'number'), reports_presentation_column('total_quantity', 'Billed quantity', 'quantity'), reports_presentation_column('usage_share', 'Share of uses', 'percent'), reports_presentation_column('total_revenue', 'Billed value', 'currency', 1.3)];
    $sections = [reports_presentation_section('service_activity', 'Recorded Service Activity', $columns, $used, 'Ordered by recorded charge entries. Quantities are specific to each service.', ['service_name' => 'Recorded total', 'usage_count' => $uses, 'total_revenue' => $billed], [], 'No recorded service charges match this scope.'), reports_presentation_section('unused_services', 'Services with No Recorded Use', [reports_presentation_column('service_name', 'Catalog service', 'text', 2), reports_presentation_column('service_type', 'Service type')], $unused, 'Active catalog entries without matching charges.', [], [], 'Every listed catalog service has recorded use, or no catalog entries are available.')];
    return reports_presentation_result($executive, $discussion, $sections, 'Service charge creation dates determine activity; active catalog services with zero use remain visible.', (int)$uses, 'service charge entries');
}

function reports_present_appointments(array $rows, string $today): array
{
    $past = []; $current = []; $future = []; $services = []; $unresolved = []; $completed = 0; $cancelled = 0;
    foreach ($rows as $row) {
        $status = reports_presentation_status($row['status'] ?? 'pending');
        $completed += $status === 'completed' ? 1 : 0;
        $cancelled += $status === 'cancelled' ? 1 : 0;
        $service = $row['service_type'] ?? 'Service not recorded';
        if (!isset($services[$service])) $services[$service] = ['service_name' => $service, 'total' => 0, 'pending' => 0, 'confirmed' => 0, 'completed' => 0, 'cancelled' => 0, 'other' => 0];
        $services[$service]['total']++;
        $services[$service][array_key_exists($status, $services[$service]) ? $status : 'other']++;
        if (($row['booking_date'] ?? '') < $today) {
            $past[] = $row;
            if (in_array($status, ['pending', 'confirmed'], true)) $unresolved[] = $row;
        } elseif (($row['booking_date'] ?? '') > $today) $future[] = $row; else $current[] = $row;
    }
    $order = static fn($a, $b) => strcmp(($a['booking_date'] ?? '') . ($a['booking_time'] ?? ''), ($b['booking_date'] ?? '') . ($b['booking_time'] ?? ''));
    usort($past, $order); usort($current, $order); usort($future, $order);
    $executive = $rows ? count($rows) . ' appointments are scheduled in this range: ' . $completed . ' marked completed and ' . $cancelled . ' cancelled. ' . count($unresolved) . ' earlier bookings still show pending or confirmed status; ' . count($future) . ' are scheduled after today.' : 'No appointments match the selected schedule and filters.';
    $discussion = [];
    if ($past) {
        $pastCompleted = count(array_filter($past, static fn($row) => reports_presentation_status($row['status']) === 'completed'));
        $discussion[] = 'Among the ' . count($past) . ' bookings dated before ' . reports_presentation_date($today) . ', ' . $pastCompleted . ' are marked completed (' . reports_presentation_number($pastCompleted / count($past) * 100) . '%). Upcoming bookings are excluded from this share because their scheduled dates have not arrived.';
    }
    if ($unresolved) $discussion[] = 'The earlier bookings ' . reports_presentation_names($unresolved, 'booking_number') . ' still need a status check. Their current status alone does not prove that the owner missed the appointment.';
    if ($current || $future) $discussion[] = count($current) . ' bookings fall today and ' . count($future) . ' fall after today. Their recorded status describes the current schedule, rather than a final attendance result.';
    $discussion[] = 'Rescheduling notes remain attached to individual bookings. They are not added to the status totals: a rescheduled booking can later be completed or cancelled.';
    $summaryColumns = [reports_presentation_column('service_name', 'Service', 'text', 2), reports_presentation_column('total', 'Scheduled', 'number'), reports_presentation_column('pending', 'Pending', 'number'), reports_presentation_column('confirmed', 'Confirmed', 'number'), reports_presentation_column('completed', 'Completed', 'number'), reports_presentation_column('cancelled', 'Cancelled', 'number'), reports_presentation_column('other', 'Other status', 'number')];
    $columns = [reports_presentation_column('booking_number', 'Booking', 'text', 1.3), reports_presentation_column('booking_date', 'Scheduled date', 'date'), reports_presentation_column('booking_time', 'Time', 'time', .8), reports_presentation_column('client_name', 'Client / pet', 'text', 1.5, ['pet_name']), reports_presentation_column('service_type', 'Service', 'text', 1.3), reports_presentation_column('status', 'Status', 'status')];
    $sections = [reports_presentation_section('appointment_outcomes', 'Bookings by Service and Status', $summaryColumns, array_values($services), 'Each booking contributes to one current status only.')];
    foreach ([['earlier_bookings', 'Earlier Appointments', $past], ['today_bookings', 'Today\'s Appointments', $current], ['upcoming_bookings', 'Upcoming Appointments', $future]] as [$id, $title, $records]) {
        $sections[] = reports_presentation_section($id, $title, $columns, $records, 'Ordered by scheduled date and time.', [], [['key' => 'rescheduled_annotation', 'label' => 'Schedule change'], ['key' => 'notes', 'label' => 'Booking notes']], 'No ' . strtolower($title) . ' match the selected scope.');
    }
    return reports_presentation_result($executive, $discussion, $sections, 'Scheduled booking dates define the range. Status is current at generation; earlier, today, and upcoming dates are separated.', count($rows), 'appointments', $unresolved ? ['Review ' . reports_presentation_names($unresolved, 'booking_number') . ' and record their actual outcome.'] : []);
}

function reports_present_queue(array $rows): array
{
    $counts = ['waiting' => 0, 'in progress' => 0, 'completed' => 0, 'cancelled' => 0]; $waits = []; $flow = [];
    foreach ($rows as &$row) {
        $status = reports_presentation_status($row['status'] ?? '');
        if (isset($counts[$status])) $counts[$status]++;
        $wait = $row['waiting_minutes'] ?? null;
        if (!is_numeric($wait) || (float)$wait < 0) $row['waiting_minutes'] = null; else $waits[] = (float)$wait;
        $key = ($row['queue_date'] ?? substr($row['queued_at'] ?? '', 0, 10)) . '|' . ($row['service_name'] ?? 'Not recorded');
        if (!isset($flow[$key])) $flow[$key] = ['queue_date' => $row['queue_date'] ?? null, 'service_name' => $row['service_name'] ?? 'Not recorded', 'entries' => 0, 'waiting' => 0, 'in_progress' => 0, 'completed' => 0, 'cancelled' => 0, 'measured_handoffs' => 0, '_waits' => []];
        $flow[$key]['entries']++;
        $statusKey = str_replace(' ', '_', $status);
        if (isset($flow[$key][$statusKey])) $flow[$key][$statusKey]++;
        if ($row['waiting_minutes'] !== null) { $flow[$key]['measured_handoffs']++; $flow[$key]['_waits'][] = (float)$row['waiting_minutes']; }
    }
    unset($row);
    foreach ($flow as &$group) {
        $group['average_wait'] = $group['_waits'] ? round(array_sum($group['_waits']) / count($group['_waits']), 1) : null;
        unset($group['_waits']);
    }
    unset($group);
    sort($waits);
    $average = $waits ? round(array_sum($waits) / count($waits), 1) : null;
    $median = $waits ? ($waits[(int)floor((count($waits) - 1) / 2)] + $waits[(int)floor(count($waits) / 2)]) / 2 : null;
    $executive = $rows ? count($rows) . ' queue entries were recorded. ' . $counts['completed'] . ' are marked completed; ' . $counts['waiting'] . ' remain waiting and ' . $counts['in progress'] . ' are in progress.' : 'No queue entries match the selected arrival dates and filters.';
    if ($average !== null) $executive .= ' Measured waiting time averaged ' . reports_presentation_number($average) . ' minutes across ' . count($waits) . ' entries.';
    $discussion = [$waits ? 'Valid arrival-to-receive measurements cover ' . count($waits) . ' of ' . count($rows) . ' entries. The median is ' . reports_presentation_number($median) . ' minutes; the longest measured interval is ' . reports_presentation_number(max($waits)) . ' minutes. Other entries have no valid recorded handoff interval.' : 'No valid arrival-to-receive intervals are available. Waiting time is unknown for these records and is not reported as zero.'];
    $discussion[] = 'The receiving timestamp belongs to the selected veterinarian assignment. Where a queue entry was reassigned, this may describe the later handoff rather than its first receive time. Waiting figures alone do not establish the cause of a delay.';
    usort($rows, static fn($a, $b) => strcmp((string)($a['queued_at'] ?? ''), (string)($b['queued_at'] ?? '')));
    $columns = [reports_presentation_column('queue_number', 'Queue / service', 'text', 1.3, ['service_name', 'priority']), reports_presentation_column('queued_at', 'Arrived', 'datetime', 1.3), reports_presentation_column('client_name', 'Client / pet', 'text', 1.5, ['pet_name']), reports_presentation_column('status', 'Queue status', 'status'), reports_presentation_column('veterinarian_name', 'Veterinarian', 'text', 1.3), reports_presentation_column('received_at', 'Received', 'datetime', 1.3), reports_presentation_column('waiting_minutes', 'Measured wait (min)', 'number')];
    $sections = [reports_presentation_section('queue_flow', 'Queue Flow by Day and Service', [reports_presentation_column('queue_date', 'Arrival date', 'date'), reports_presentation_column('service_name', 'Service', 'text', 1.6), reports_presentation_column('entries', 'Entries', 'number'), reports_presentation_column('completed', 'Completed', 'number'), reports_presentation_column('waiting', 'Waiting', 'number'), reports_presentation_column('in_progress', 'In progress', 'number'), reports_presentation_column('measured_handoffs', 'Measured handoffs', 'number'), reports_presentation_column('average_wait', 'Average wait (min)', 'number')], array_values($flow)), reports_presentation_section('queue_handoffs', 'Queue and Veterinarian Handoffs', $columns, $rows, 'Arrival order; unrecorded receive times remain blank.', [], [['key' => 'assignment_status', 'label' => 'Assignment status']], 'No queue entries match this scope.')];
    return reports_presentation_result($executive, $discussion, $sections, 'Queue arrival dates determine inclusion. Status and the selected assignment reflect current records.', count($rows), 'queue entries', ($counts['waiting'] + $counts['in progress']) > 0 ? ['Check the ' . ($counts['waiting'] + $counts['in progress']) . ' waiting or in-progress entries against the current queue before closing their records.'] : []);
}

function reports_present_consultations(array $rows): array
{
    $face = 0; $online = 0; $followups = 0; $gaps = 0; $workload = [];
    foreach ($rows as &$row) {
        $channel = $row['consultation_type'] ?? 'Not recorded';
        if (strtolower($channel) === 'online') $online++; else $face++;
        if (!empty($row['follow_up_date'])) $followups++;
        if (trim((string)($row['diagnosis'] ?? '')) === '' || trim((string)($row['treatment'] ?? '')) === '') $gaps++;
        $row['record_reference'] = $row['source_reference'] ?? $row['diagnosis_id'] ?? $row['record_id'] ?? null;
        $key = $channel . '|' . ($row['veterinarian_name'] ?? 'Unassigned');
        if (!isset($workload[$key])) $workload[$key] = ['consultation_type' => $channel, 'veterinarian_name' => $row['veterinarian_name'] ?? 'Unassigned', 'record_count' => 0, 'with_follow_up' => 0];
        $workload[$key]['record_count']++;
        if (!empty($row['follow_up_date'])) $workload[$key]['with_follow_up']++;
    }
    unset($row);
    $executive = $rows ? count($rows) . ' clinical records are included: ' . $face . ' face-to-face and ' . $online . ' online. ' . $followups . ' contain a follow-up date.' : 'No documented consultations match the selected dates, channel, and veterinarian filters.';
    $discussion = [];
    if ($rows) $discussion[] = $gaps . ' records have no diagnosis or treatment text in at least one of those fields. This describes the documentation available to this report; it does not establish whether care was provided.';
    if ($followups) $discussion[] = 'The recorded follow-up dates are included beside the original clinical notes. They identify planned reassessment dates, rather than confirmed return visits.';
    $discussion[] = 'The register preserves the recorded diagnosis and treatment wording. Record volume and channel mix describe documented workload; they do not measure recovery, case complexity, or quality of care.';
    $sections = [reports_presentation_section('clinical_workload', 'Recorded Consultations by Channel and Veterinarian', [reports_presentation_column('veterinarian_name', 'Veterinarian', 'text', 2), reports_presentation_column('consultation_type', 'Channel'), reports_presentation_column('record_count', 'Clinical records', 'number'), reports_presentation_column('with_follow_up', 'With follow-up date', 'number')], array_values($workload)), reports_presentation_section('clinical_register', 'Consultation Records and Clinical Notes', [reports_presentation_column('consultation_date', 'Recorded date', 'datetime', 1.3), reports_presentation_column('pet_name', 'Patient', 'text', 1.3, ['pet_species', 'owner_name']), reports_presentation_column('consultation_type', 'Channel'), reports_presentation_column('veterinarian_name', 'Veterinarian / service', 'text', 1.6, ['service_name']), reports_presentation_column('follow_up_date', 'Follow-up date', 'date'), reports_presentation_column('record_status', 'Record status', 'status')], $rows, 'Diagnosis and treatment are shown in full beneath each record.', [], [['key' => 'record_reference', 'label' => 'Source reference'], ['key' => 'diagnosis', 'label' => 'Diagnosis / assessment'], ['key' => 'treatment', 'label' => 'Treatment recorded'], ['key' => 'notes', 'label' => 'Clinical notes']], 'No clinical records match this scope.')];
    return reports_presentation_result($executive, $discussion, $sections, 'Clinical finalization dates are used where recorded, with source-date fallbacks for legacy records. Online and face-to-face records remain distinct.', count($rows), 'clinical records');
}

function reports_present_followups(array $rows, string $today): array
{
    $past = []; $due = []; $upcoming = [];
    foreach ($rows as $row) {
        $days = reports_presentation_days($row['follow_up_date'] ?? null, $today);
        $row['days_past_due'] = $days !== null && $days > 0 ? $days : null;
        $row['days_until_due'] = $days !== null && $days < 0 ? -$days : null;
        if ($days !== null && $days > 0) { $row['reminder_status'] = 'Past due; completion unverified'; $past[] = $row; }
        elseif ($days === 0) { $row['reminder_status'] = 'Due today'; $due[] = $row; }
        else { $row['reminder_status'] = 'Upcoming'; $upcoming[] = $row; }
    }
    $order = static fn($a, $b) => strcmp((string)($a['follow_up_date'] ?? ''), (string)($b['follow_up_date'] ?? ''));
    usort($past, $order); usort($upcoming, $order);
    $executive = $rows ? count($rows) . ' follow-up dates fall in this range: ' . count($past) . ' past due, ' . count($due) . ' due today, and ' . count($upcoming) . ' upcoming. Completion of these follow-ups is not verified by this report.' : 'No scheduled follow-up dates match the selected scope.';
    $discussion = ['The groups are based on scheduled follow-up dates as of ' . reports_presentation_date($today) . '. A past date alone does not show whether the owner attended, the visit was rescheduled, or the veterinarian completed the reassessment.'];
    if ($past) $discussion[] = 'The oldest date is ' . reports_presentation_date($past[0]['follow_up_date']) . ' for ' . ($past[0]['pet_name'] ?? 'the recorded pet') . ', ' . $past[0]['days_past_due'] . ' days before today. Confirm the actual outcome before updating the follow-up record.';
    if ($due) $discussion[] = 'Today\'s scheduled follow-ups are for ' . reports_presentation_names($due, 'pet_name') . '. Their original reasons and veterinarian names are listed in the worklist.';
    $columns = [reports_presentation_column('follow_up_date', 'Scheduled follow-up', 'date', 1.2), reports_presentation_column('pet_name', 'Pet / owner', 'text', 1.6, ['pet_species', 'owner_name']), reports_presentation_column('veterinarian_name', 'Veterinarian', 'text', 1.3), reports_presentation_column('days_past_due', 'Days past date', 'number'), reports_presentation_column('days_until_due', 'Days until date', 'number'), reports_presentation_column('reminder_status', 'Schedule status', 'status', 1.6)];
    $details = [['key' => 'reason', 'label' => 'Recorded reason'], ['key' => 'source_reference', 'label' => 'Original consultation'], ['key' => 'consultation_date', 'label' => 'Consultation date', 'format' => 'date']];
    $sections = [];
    foreach ([['past_due_followups', 'Past-Due Dates — Completion Unverified', $past], ['due_today_followups', 'Follow-Ups Due Today', $due], ['upcoming_followups', 'Upcoming Follow-Up Dates', $upcoming]] as [$id, $title, $records]) $sections[] = reports_presentation_section($id, $title, $columns, $records, '', [], $details, 'No follow-up dates in this group.');
    $actions = [];
    if ($past) $actions[] = 'Check the clinical history for ' . reports_presentation_names($past, 'pet_name') . ' and contact the owners where the scheduled follow-up still needs arranging.';
    if ($due) $actions[] = 'Confirm today\'s arrangements for ' . reports_presentation_names($due, 'pet_name') . ' with the assigned veterinarians.';
    return reports_presentation_result($executive, $discussion, $sections, 'Scheduled follow-up dates define inclusion. Urgency is calculated at generation time; attendance and completion are unverified.', count($rows), 'scheduled follow-up dates', $actions);
}

function reports_present_requests(array $rows, string $today): array
{
    $open = []; $closed = []; $completed = []; $unassigned = []; $paymentReview = [];
    foreach ($rows as $row) {
        $row['requested_at'] = $row['requested_at'] ?? $row['submitted_at'] ?? $row['created_at'] ?? $row['requested_date'] ?? null;
        $status = reports_presentation_status($row['status'] ?? '');
        $isClosed = in_array($status, ['completed', 'rejected', 'cancelled'], true);
        $row['open_age_days'] = !$isClosed ? reports_presentation_days($row['requested_at'], $today) : null;
        $row['processing_days'] = $status === 'completed' ? reports_presentation_days($row['requested_at'], $row['completed_at'] ?? null) : null;
        if ($isClosed) $closed[] = $row; else {
            $open[] = $row;
            if (in_array(trim((string)($row['assigned_veterinarian'] ?? '')), ['', 'Unassigned'], true)) $unassigned[] = $row;
            if (in_array(reports_presentation_status($row['payment_status'] ?? ''), ['pending', 'submitted', 'under review', 'pending review'], true)) $paymentReview[] = $row;
        }
        if ($status === 'completed') $completed[] = $row;
    }
    usort($open, static fn($a, $b) => strcmp((string)($a['requested_at'] ?? ''), (string)($b['requested_at'] ?? '')));
    $executive = $rows ? count($rows) . ' medical-record update requests were submitted in this period. ' . count($completed) . ' are marked completed and ' . count($open) . ' remain open; ' . (count($closed) - count($completed)) . ' were rejected or cancelled.' : 'No medical-record update requests were submitted within this scope.';
    $discussion = [];
    if ($open) {
        $discussion[] = 'Among open requests, ' . count($unassigned) . ' have no veterinarian name recorded and ' . count($paymentReview) . ' have a payment review state. These checks can apply to the same request.';
        $discussion[] = 'The oldest open request is ' . ($open[0]['request_number'] ?? 'not identified') . ', submitted on ' . reports_presentation_date($open[0]['requested_at']) . '. Its age is ' . reports_presentation_number(max(0, $open[0]['open_age_days'] ?? 0)) . ' calendar days; no agreed completion deadline is assumed.';
    }
    $durations = array_values(array_filter(array_column($completed, 'processing_days'), static fn($value) => $value !== null && $value >= 0));
    if ($durations) $discussion[] = 'The ' . count($durations) . ' completed requests with valid submission and completion dates took an average of ' . reports_presentation_number(array_sum($durations) / count($durations)) . ' calendar days. A completion timestamp does not separately confirm that a copy was released to the owner.';
    $discussion[] = 'This is the current handling position of requests submitted in the selected period. Older open requests outside that submission range are not included.';
    $columns = [reports_presentation_column('request_number', 'Request', 'text', 1.3), reports_presentation_column('requested_at', 'Submitted', 'datetime', 1.3), reports_presentation_column('owner_name', 'Owner / pet', 'text', 1.5, ['pet_name']), reports_presentation_column('status', 'Request status', 'status', 1.4), reports_presentation_column('payment_status', 'Payment state', 'status'), reports_presentation_column('assigned_veterinarian', 'Assigned veterinarian', 'text', 1.3), reports_presentation_column('open_age_days', 'Open age (days)', 'number')];
    $closedColumns = array_slice($columns, 0, 6);
    $closedColumns[] = reports_presentation_column('completed_at', 'Completed', 'datetime', 1.3);
    $closedColumns[] = reports_presentation_column('processing_days', 'Processing days', 'number');
    $details = [['key' => 'reviewed_at', 'label' => 'Reviewed at', 'format' => 'datetime']];
    return reports_presentation_result($executive, $discussion, [reports_presentation_section('open_requests', 'Open Request Worklist', $columns, $open, 'Oldest submissions first.', [], $details, 'No open requests within this submission period.'), reports_presentation_section('closed_requests', 'Completed, Rejected and Cancelled Requests', $closedColumns, $closed, '', [], $details, 'No closed requests within this submission period.')], 'Request submission dates determine inclusion; payment, assignment, and handling states are current.', count($rows), 'medical-record requests', $unassigned || $paymentReview ? ['Review the open requests with payment or assignment checks, beginning with the oldest submission.'] : []);
}

function reports_present_inventory(array $rows, string $generated): array
{
    $attention = []; $other = []; $unknown = []; $measurementGaps = []; $low = []; $out = []; $expired = []; $near = [];
    foreach ($rows as $row) {
        $stockStatus = $row['stock_status'] ?? 'unknown';
        $expiryStatus = $row['expiry_status'] ?? 'unknown';
        if ($stockStatus === 'unknown' || $expiryStatus === 'unknown' || ($row['stock_level'] ?? null) === null) $measurementGaps[] = $row;
        $isExpired = $expiryStatus === 'expired' || (float)($row['expired_stock'] ?? 0) > 0;
        $isNear = $expiryStatus === 'near_expiry' || (float)($row['near_expiry_stock'] ?? 0) > 0;
        $row['expiry_alert'] = $isExpired && $isNear ? 'expired; near expiry' : ($isExpired ? 'expired' : ($isNear ? 'near expiry' : $expiryStatus));
        if ($stockStatus === 'low_stock') $low[] = $row;
        if ($stockStatus === 'out_of_stock') $out[] = $row;
        if ($isExpired) $expired[] = $row;
        if ($isNear) $near[] = $row;
        $row['_priority'] = ($isExpired ? 100 : 0) + ($stockStatus === 'out_of_stock' ? 80 : 0) + ($stockStatus === 'low_stock' ? 40 : 0) + ($isNear ? 20 : 0);
        if ($row['_priority'] > 0) $attention[] = $row;
        elseif ($stockStatus === 'unknown' || $expiryStatus === 'unknown') $unknown[] = $row;
        else $other[] = $row;
    }
    usort($attention, static fn($a, $b) => ($b['_priority'] <=> $a['_priority']) ?: strcmp((string)($a['nearest_expiry'] ?? '9999'), (string)($b['nearest_expiry'] ?? '9999')));
    $executive = $rows ? 'The current inventory contains ' . count($rows) . ' active items. ' . count($attention) . ' distinct items have stock or expiry alerts: ' . count($out) . ' out of stock, ' . count($low) . ' low stock, ' . count($expired) . ' with expired stock, and ' . count($near) . ' with near-expiry stock.' : 'No active inventory items match the selected branch, category, and stock filters.';
    $discussion = ['This is a stock snapshot as of ' . reports_presentation_date($generated) . '. Changing the report period does not reconstruct past inventory. Stock alerts and expiry alerts can affect the same item, so their counts are not added together as separate items.'];
    if ($low) {
        $row = $low[0];
        $discussion[] = ($row['item_name'] ?? 'The first low-stock item') . ' has ' . reports_presentation_number($row['stock_level']) . ' usable ' . ($row['unit'] ?? 'units') . ' against a reorder level of ' . reports_presentation_number($row['reorder_level']) . '. Other low-stock items are listed with their own units and thresholds.';
    }
    if ($out) $discussion[] = 'No usable stock is recorded for ' . reports_presentation_names($out, 'item_name') . '. Physical stock may still be present when all remaining batches are expired.';
    if ($expired || $near) $discussion[] = 'Physical stock includes batches that may be excluded from usable stock. The expiry quantities identify those batches; the nearest expiry is a date reference, not the expiry date of every unit.';
    if ($measurementGaps) $discussion[] = count($measurementGaps) . ' items have unavailable stock or expiry measurements. Their missing quantities are not treated as verified zero stock, even where a separate expiry alert is known.';
    $columns = [reports_presentation_column('item_name', 'Item / SKU', 'text', 1.7, ['sku', 'category']), reports_presentation_column('unit', 'Unit', 'text', .7), reports_presentation_column('stock_level', 'Usable', 'quantity'), reports_presentation_column('on_hand_stock', 'Physical', 'quantity'), reports_presentation_column('reorder_level', 'Reorder level', 'quantity'), reports_presentation_column('nearest_expiry', 'Nearest expiry', 'date'), reports_presentation_column('stock_status', 'Stock state', 'status'), reports_presentation_column('expiry_alert', 'Expiry state', 'status', 1.3)];
    $details = [['key' => 'expired_stock', 'label' => 'Expired quantity', 'format' => 'quantity'], ['key' => 'near_expiry_stock', 'label' => 'Near-expiry quantity', 'format' => 'quantity']];
    $sections = [reports_presentation_section('inventory_attention', 'Stock and Expiry Attention List', $columns, $attention, 'Urgent stock and expiry states first. Quantities retain each item\'s unit.', [], $details, 'No measured stock or expiry alerts in this scope.'), reports_presentation_section('inventory_other', 'Other Active Inventory Items', $columns, $other, '', [], [], 'No other active items in this scope.')];
    if ($unknown) $sections[] = reports_presentation_section('inventory_unknown', 'Stock Measurements Unavailable', $columns, $unknown, 'Review source availability before drawing stock conclusions.');
    $actions = [];
    if ($out || $low) $actions[] = 'Review replenishment or branch-transfer options for ' . reports_presentation_names(array_merge($out, $low), 'item_name') . ' using their recorded units and reorder levels.';
    if ($expired) $actions[] = 'Check the expired batches for ' . reports_presentation_names($expired, 'item_name') . ' against the disposal or pull-out records.';
    if ($near) $actions[] = 'Review the batch expiry dates for ' . reports_presentation_names($near, 'item_name') . ' when planning stock use.';
    return reports_presentation_result($executive, $discussion, $sections, 'Current active branch inventory as of generation. The period selector does not supply historical stock balances.', count($rows), 'active inventory items', $actions);
}

function reports_present_movements(array $rows): array
{
    $groups = []; $types = []; $missingRefs = 0; $inconsistent = 0;
    foreach ($rows as &$row) {
        $row['created_at'] = $row['created_at'] ?? $row['movement_at'] ?? $row['movement_date'] ?? null;
        $row['movement_reference'] = $row['movement_id'] ?? null;
        $row['source_reference'] = trim((string)($row['reference_type'] ?? '') . (($row['reference_id'] ?? '') !== '' ? ' #' . $row['reference_id'] : ''));
        if ($row['source_reference'] === '') $missingRefs++;
        $qty = (float)($row['quantity_change'] ?? 0);
        if (is_numeric($row['quantity_before'] ?? null) && is_numeric($row['quantity_after'] ?? null) && abs((float)$row['quantity_before'] + $qty - (float)$row['quantity_after']) > .00001) $inconsistent++;
        $type = reports_presentation_status($row['movement_type'] ?? 'not recorded');
        $types[$type] = ($types[$type] ?? 0) + 1;
        $key = ($row['item_id'] ?? $row['item_name'] ?? '') . '|' . ($row['location_id'] ?? $row['location_name'] ?? '') . '|' . ($row['unit'] ?? '');
        if (!isset($groups[$key])) $groups[$key] = ['item_name' => $row['item_name'] ?? 'Not recorded', 'unit' => $row['unit'] ?? 'Not recorded', 'location_name' => $row['location_name'] ?? 'Not recorded', 'movement_count' => 0, 'incoming' => 0.0, 'outgoing' => 0.0, 'net_change' => 0.0];
        $groups[$key]['movement_count']++;
        $groups[$key]['incoming'] += max($qty, 0);
        $groups[$key]['outgoing'] += max(-$qty, 0);
        $groups[$key]['net_change'] += $qty;
    }
    unset($row);
    usort($rows, static fn($a, $b) => strcmp((string)$a['created_at'], (string)$b['created_at']) ?: ((int)($a['movement_id'] ?? 0) <=> (int)($b['movement_id'] ?? 0)));
    $executive = $rows ? count($rows) . ' stock movements are recorded across ' . count($groups) . ' item/location groups. ' . $missingRefs . ' have no source reference; ' . $inconsistent . ' have a before/change/after mismatch.' : 'No stock movements match the selected posting dates and filters.';
    $discussion = [];
    if ($types) {
        $parts = [];
        foreach ($types as $type => $count) $parts[] = $count . ' ' . $type;
        $discussion[] = 'Recorded movement types are ' . implode(', ', $parts) . '. Positive changes can include receipts, returns, or adjustments; negative changes can include issues, sales, disposals, or adjustments.';
    }
    $discussion[] = 'Incoming, outgoing, and net quantities are grouped by item, location, and unit. Bottles, tablets, bags, and other units are not combined into a single stock quantity. Ledger balances belong to the source batch or location shown on each movement.';
    if ($missingRefs || $inconsistent) $discussion[] = 'Entries with missing references or inconsistent balances need a source-record check. The ledger retains their processor names and remarks to support that review.';
    $columns = [reports_presentation_column('created_at', 'Posted / movement', 'datetime', 1.3, ['movement_reference']), reports_presentation_column('item_name', 'Item / location', 'text', 1.6, ['unit', 'location_name', 'batch_id']), reports_presentation_column('movement_type', 'Movement type', 'status'), reports_presentation_column('quantity_before', 'Before', 'quantity'), reports_presentation_column('quantity_change', 'Change', 'quantity'), reports_presentation_column('quantity_after', 'After', 'quantity'), reports_presentation_column('source_reference', 'Source reference', 'text', 1.3), reports_presentation_column('performed_by_name', 'Processed by', 'text', 1.3)];
    $sections = [reports_presentation_section('movement_summary', 'Movement by Item, Location and Unit', [reports_presentation_column('item_name', 'Item', 'text', 1.8), reports_presentation_column('location_name', 'Location', 'text', 1.3), reports_presentation_column('unit', 'Unit'), reports_presentation_column('movement_count', 'Movements', 'number'), reports_presentation_column('incoming', 'Incoming', 'quantity'), reports_presentation_column('outgoing', 'Outgoing', 'quantity'), reports_presentation_column('net_change', 'Net change', 'quantity')], array_values($groups)), reports_presentation_section('movement_audit', 'Stock Movement Audit Ledger', $columns, $rows, 'Posting order; original signed quantity changes are preserved.', [], [['key' => 'remarks', 'label' => 'Movement remarks']], 'No stock movements match this scope.')];
    return reports_presentation_result($executive, $discussion, $sections, 'Stock movement posting dates define the period. This ledger reports changes, rather than reconstructing a complete historical stocktake.', count($rows), 'stock movements', $missingRefs || $inconsistent ? ['Match the flagged ledger entries to their receipt, issue, adjustment, or reversal source records.'] : []);
}

function reports_present_products(array $rows): array
{
    $value = reports_presentation_sum($rows, 'total_sales');
    $billed = reports_presentation_sum($rows, 'billed_value');
    foreach ($rows as &$row) $row['value_share'] = $value > 0 ? round((float)$row['total_sales'] / $value * 100, 1) : null;
    unset($row);
    usort($rows, static fn($a, $b) => (float)$b['total_sales'] <=> (float)$a['total_sales']);
    $leaders = reports_presentation_leaders($rows, 'total_sales');
    $executive = $rows ? count($rows) . ' medicine/product item groups account for ' . reports_presentation_money($value) . ' in allocated net collected value.' : 'No issued medicine or product lines match the selected charge dates and filters.';
    if ($leaders) $executive .= ' ' . reports_presentation_names($leaders, 'item_name') . (count($leaders) > 1 ? ' share the highest collected value.' : ' has the highest collected value.');
    $discussion = [];
    if ($leaders) $discussion[] = 'The leading ' . (count($leaders) > 1 ? 'items each account for ' : 'item accounts for ') . reports_presentation_money($leaders[0]['total_sales']) . ' (' . reports_presentation_number($leaders[0]['value_share']) . '%' . (count($leaders) > 1 ? ' each' : '') . '). Issued quantities remain separate from the payment allocation, so an unpaid or refunded bill can reduce collected value without removing its issued quantities.';
    if ($rows) $discussion[] = 'The included lines carry ' . reports_presentation_money($billed) . ' in billed value. Net payments and processed refunds against their linked visits are allocated in proportion to the bill\'s charge lines. Those payments can fall outside the selected charge period.';
    $discussion[] = 'Quantities retain each item\'s unit and are not added across unlike items. Remaining stock is a current physical-stock reference, not stock at the end of the selected period. Collected value does not include purchase cost and cannot be read as profit.';
    $sections = [reports_presentation_section('issued_products', 'Issued Items and Allocated Collections', [reports_presentation_column('item_name', 'Medicine / product', 'text', 2, ['category']), reports_presentation_column('unit', 'Unit', 'text', .7), reports_presentation_column('quantity_sold', 'Quantity issued', 'quantity'), reports_presentation_column('billed_value', 'Billed value', 'currency'), reports_presentation_column('total_sales', 'Allocated net collected', 'currency', 1.3), reports_presentation_column('value_share', 'Value share', 'percent'), reports_presentation_column('remaining_stock', 'Current physical stock', 'quantity')], $rows, 'Ranked by allocated collected value; issued quantity is not a payment count.', ['item_name' => 'Value total', 'billed_value' => $billed, 'total_sales' => $value], [], 'No issued medicine/product lines match this scope.')];
    return reports_presentation_result($executive, $discussion, $sections, 'Charge-line creation dates define the period. Payment allocation reflects currently posted visit payments and refunds; stock is current.', count($rows), 'issued item groups');
}

function reports_present_stays(array $rows): array
{
    $hotel = []; $confinement = []; $other = []; $billing = []; $active = 0; $reserved = 0; $completed = 0; $missingRooms = [];
    foreach ($rows as &$row) {
        $row['planned_admission'] = $row['planned_admission'] ?? $row['planned_admission_date'] ?? null;
        $row['planned_release'] = $row['planned_release'] ?? $row['planned_release_date'] ?? null;
        $row['actual_admission'] = $row['actual_admission'] ?? $row['actual_check_in_at'] ?? null;
        $row['actual_release'] = $row['actual_release'] ?? $row['actual_check_out_at'] ?? null;
        $plannedDays = reports_presentation_days($row['planned_admission'], $row['planned_release']);
        $actualDays = reports_presentation_days($row['actual_admission'], $row['actual_release']);
        $row['planned_days'] = $plannedDays !== null && $plannedDays >= 0 ? $plannedDays + 1 : null;
        $row['actual_days'] = $actualDays !== null && $actualDays >= 0 ? $actualDays + 1 : null;
        $status = reports_presentation_status($row['stay_status'] ?? $row['booking_status'] ?? '');
        if (in_array($status, ['active', 'occupied', 'checked in', 'in progress', 'boarded'], true)) $active++;
        if (in_array($status, ['reserved', 'pending'], true)) $reserved++;
        if (in_array($status, ['completed', 'checked out', 'released'], true)) $completed++;
        if (in_array($status, ['active', 'occupied', 'checked in', 'in progress', 'boarded', 'reserved'], true) && empty($row['room_number'])) $missingRooms[] = $row;
        $type = reports_presentation_status($row['hotel_boarding_type'] ?? '');
        if ($type === 'boarding' || str_contains($type, 'confinement')) $confinement[] = $row;
        elseif (str_contains($type, 'hotel')) $hotel[] = $row;
        else $other[] = $row;
        $billing[] = $row;
    }
    unset($row);
    $balance = reports_presentation_sum($rows, 'balance');
    $executive = $rows ? count($rows) . ' stay records overlap this date range: ' . count($confinement) . ' confinement, ' . count($hotel) . ' hotel, and ' . count($other) . ' without a classified stay type. Current states include ' . $active . ' active, ' . $reserved . ' reserved/pending, and ' . $completed . ' completed stays.' : 'No confinement or pet hotel stays overlap the selected dates.';
    $discussion = [];
    if ($rows) $discussion[] = 'Whole-stay charges total ' . reports_presentation_money(reports_presentation_sum($rows, 'total_charge')) . ', with ' . reports_presentation_money(reports_presentation_sum($rows, 'paid_amount')) . ' recorded as paid and ' . reports_presentation_money($balance) . ' remaining. These amounts are attached to the included stays; they are not revenue earned or cash collected only within the selected dates.';
    if ($missingRooms) $discussion[] = count($missingRooms) . ' active or reserved stays have no room number recorded: ' . reports_presentation_names($missingRooms, 'booking_number') . '.';
    $discussion[] = 'Planned admission and release dates are shown separately from actual check-in and checkout. Actual duration is calculated only where both actual timestamps exist. Overlapping stay records do not establish an occupancy percentage without room capacity and daily occupancy data.';
    $columns = [reports_presentation_column('booking_number', 'Stay / pet', 'text', 1.4, ['pet_name', 'pet_species']), reports_presentation_column('planned_admission', 'Planned arrival', 'date'), reports_presentation_column('planned_release', 'Planned release', 'date'), reports_presentation_column('actual_admission', 'Actual check-in', 'datetime', 1.3), reports_presentation_column('actual_release', 'Actual checkout', 'datetime', 1.3), reports_presentation_column('room_number', 'Room / cage', 'text', 1, ['room_type']), reports_presentation_column('stay_status', 'Stay status', 'status')];
    $details = [['key' => 'planned_days', 'label' => 'Planned days', 'format' => 'number'], ['key' => 'actual_days', 'label' => 'Actual days', 'format' => 'number'], ['key' => 'booking_status', 'label' => 'Booking status', 'format' => 'status']];
    $sections = [reports_presentation_section('confinement_stays', 'Confinement Stays', $columns, $confinement, '', [], $details, 'No confinement stays overlap this period.'), reports_presentation_section('hotel_stays', 'Pet Hotel Stays', $columns, $hotel, '', [], $details, 'No pet hotel stays overlap this period.')];
    if ($other) $sections[] = reports_presentation_section('other_stays', 'Stays with Type Not Recorded', $columns, $other, '', [], $details);
    $sections[] = reports_presentation_section('stay_billing', 'Stay Charges and Settlement', [reports_presentation_column('booking_number', 'Stay reference', 'text', 1.3), reports_presentation_column('pet_name', 'Pet', 'text', 1.5), reports_presentation_column('hotel_boarding_type', 'Stay type', 'status'), reports_presentation_column('total_charge', 'Whole-stay charge', 'currency'), reports_presentation_column('paid_amount', 'Recorded paid', 'currency'), reports_presentation_column('balance', 'Remaining balance', 'currency')], $billing, '', ['booking_number' => 'Whole-stay totals', 'total_charge' => reports_presentation_sum($rows, 'total_charge'), 'paid_amount' => reports_presentation_sum($rows, 'paid_amount'), 'balance' => $balance]);
    $actions = [];
    if ($missingRooms) $actions[] = 'Confirm placement for ' . reports_presentation_names($missingRooms, 'booking_number') . ' against the current boarding assignments.';
    if ($balance > 0) $actions[] = 'Review the ' . reports_presentation_money($balance) . ' remaining stay balances against their linked billing records.';
    return reports_presentation_result($executive, $discussion, $sections, 'Stays overlapping the selected dates are included. Current stay states and whole-stay billing are shown; planned dates are distinct from actual dates.', count($rows), 'overlapping stay records', $actions);
}

function reports_present_consents(array $rows, array $totals): array
{
    $templatesOnly = array_key_exists('total_files', $totals) && !array_key_exists('total_records', $totals);
    if ($templatesOnly) {
        return reports_presentation_result(count($rows) . ' consent templates were uploaded in this period. Client signature and pending-consent counts are unavailable in this data mode.', ['These rows are reusable form templates, not client consent events. Their presence does not establish that a client signed a form or that a procedure has consent documentation.'], [reports_presentation_section('consent_templates', 'Uploaded Consent Templates', [reports_presentation_column('file_name', 'Template file', 'text', 2), reports_presentation_column('category', 'Category'), reports_presentation_column('file_type', 'File type'), reports_presentation_column('file_size', 'Size (bytes)', 'number'), reports_presentation_column('uploaded_date', 'Uploaded', 'date')], $rows, 'Template uploads only.', [], [], 'No consent templates were uploaded in this scope.')], 'Template upload dates define this mode; client consent tracking is unavailable.', count($rows), 'consent templates', [], 'portrait');
    }
    $counts = ['signed' => 0, 'pending' => 0, 'released' => 0, 'cancelled' => 0]; $pending = []; $legacy = 0; $missingSignedDate = 0;
    foreach ($rows as &$row) {
        $status = reports_presentation_status($row['status'] ?? '');
        if (isset($counts[$status])) $counts[$status]++;
        if ($status === 'pending') $pending[] = $row;
        if (str_contains((string)($row['source'] ?? ''), 'legacy')) $legacy++;
        if (in_array($status, ['signed', 'released'], true) && empty($row['signed_at'])) $missingSignedDate++;
        $row['record_reference'] = $row['source_reference'] ?? $row['consent_record_id'] ?? null;
        $row['requested_at'] = $row['requested_at'] ?? null;
    }
    unset($row);
    usort($rows, static fn($a, $b) => ((reports_presentation_status($b['status'] ?? '') === 'pending') <=> (reports_presentation_status($a['status'] ?? '') === 'pending')) ?: strcmp((string)($a['requested_at'] ?? $a['requested_date'] ?? ''), (string)($b['requested_at'] ?? $b['requested_date'] ?? '')));
    $executive = $rows ? count($rows) . ' client consent records are included: ' . $counts['signed'] . ' signed, ' . $counts['pending'] . ' pending, ' . $counts['released'] . ' released, and ' . $counts['cancelled'] . ' cancelled.' : 'No tracked client consent records match this period and scope.';
    $discussion = [];
    if ($pending) $discussion[] = 'Pending records are listed first. They concern ' . reports_presentation_names($pending, 'pet_name') . '; check their linked service and current documentation before treating them as ready.';
    if ($missingSignedDate) $discussion[] = $missingSignedDate . ' signed or released records have no signed timestamp recorded. Their recorded status is preserved, with the missing date left visible.';
    if ($legacy) $discussion[] = $legacy . ' records come from legacy booking or queue signatures. Their event dates are source-date approximations rather than separately recorded signature timestamps.';
    $discussion[] = 'The register describes tracked consent records, not the percentage of all procedures covered by consent. A pending record does not establish that a procedure was performed without consent.';
    $sections = [reports_presentation_section('consent_tracking', 'Client Consent Tracking Register', [reports_presentation_column('record_reference', 'Record / source', 'text', 1.3, ['source']), reports_presentation_column('client_name', 'Client / pet', 'text', 1.5, ['pet_name']), reports_presentation_column('consent_type', 'Form / service', 'text', 1.6, ['service']), reports_presentation_column('requested_at', 'Requested', 'datetime', 1.2), reports_presentation_column('signed_at', 'Signed', 'datetime', 1.2), reports_presentation_column('released_at', 'Released', 'datetime', 1.2), reports_presentation_column('status', 'Status', 'status')], $rows, 'Pending records first. Requested, signed, and released timestamps retain their own meaning.', [], [['key' => 'event_at', 'label' => 'Period selection event', 'format' => 'datetime'], ['key' => 'document_available', 'label' => 'Recorded document availability']], 'No tracked consent records match this scope.')];
    return reports_presentation_result($executive, $discussion, $sections, 'Available consent lifecycle event dates determine inclusion. Templates are excluded; legacy signatures retain their source-date limitations.', count($rows), 'client consent records', $pending ? ['Check the pending consent records against their linked bookings, queue entries, or services and record the documentation outcome.'] : []);
}

function reports_present_veterinarians(array $rows): array
{
    $cases = 0; $followups = 0; $finalized = 0; $legacy = 0;
    foreach ($rows as &$row) {
        $row['recorded_consultations'] = (int)($row['face_to_face_consultations'] ?? 0) + (int)($row['online_consultations'] ?? 0);
        $row['scheduled_follow_ups'] = (int)($row['scheduled_follow_ups'] ?? $row['follow_ups'] ?? 0);
        $row['finalized_cases'] = $row['finalized_cases'] ?? $row['finalized_records'] ?? null;
        $row['unfinalized_cases'] = $row['unfinalized_cases'] ?? $row['legacy_records'] ?? null;
        $cases += $row['recorded_consultations']; $followups += $row['scheduled_follow_ups'];
        $finalized += (int)($row['finalized_cases'] ?? 0); $legacy += (int)($row['unfinalized_cases'] ?? 0);
    }
    unset($row);
    foreach ($rows as &$row) $row['workload_share'] = $cases > 0 ? round($row['recorded_consultations'] / $cases * 100, 1) : null;
    unset($row);
    usort($rows, static fn($a, $b) => $b['recorded_consultations'] <=> $a['recorded_consultations']);
    $leaders = reports_presentation_leaders($rows, 'recorded_consultations');
    $executive = $rows ? $cases . ' consultation records are attributed across ' . count($rows) . ' veterinarian entries. ' . $followups . ' scheduled follow-up dates fall in this period.' : 'No veterinarian consultation or scheduled follow-up records match the selected scope.';
    if ($leaders) $executive .= ' ' . reports_presentation_names($leaders, 'veterinarian_name') . (count($leaders) > 1 ? ' share the highest recorded consultation count.' : ' has the highest recorded consultation count.');
    $discussion = [];
    if ($leaders) $discussion[] = 'The leading ' . (count($leaders) > 1 ? 'veterinarians each have ' : 'veterinarian has ') . $leaders[0]['recorded_consultations'] . ' recorded consultations (' . reports_presentation_number($leaders[0]['workload_share']) . '%' . (count($leaders) > 1 ? ' each' : '') . '). The channel columns show how that volume is divided between clinic and online records.';
    if ($finalized || $legacy) $discussion[] = $finalized . ' records have a finalization timestamp; ' . $legacy . ' use a created-date fallback without a finalization timestamp. These fallback records are not counted as verified finalized records.';
    $discussion[] = 'Scheduled follow-up dates are shown separately from consultation volume. They do not represent completed follow-up visits. Record counts describe documented workload and do not measure case complexity, hours worked, treatment outcomes, or clinical performance.';
    $sections = [reports_presentation_section('veterinarian_workload', 'Recorded Clinical Workload', [reports_presentation_column('veterinarian_name', 'Veterinarian', 'text', 2), reports_presentation_column('face_to_face_consultations', 'Clinic records', 'number'), reports_presentation_column('online_consultations', 'Online records', 'number'), reports_presentation_column('recorded_consultations', 'All consultations', 'number'), reports_presentation_column('workload_share', 'Volume share', 'percent'), reports_presentation_column('finalized_cases', 'Finalized records', 'number'), reports_presentation_column('unfinalized_cases', 'Created-date fallback', 'number'), reports_presentation_column('scheduled_follow_ups', 'Scheduled follow-ups', 'number')], $rows, 'Consultation volume and scheduled follow-up dates are separate measures.', ['veterinarian_name' => 'Recorded totals', 'face_to_face_consultations' => reports_presentation_sum($rows, 'face_to_face_consultations'), 'online_consultations' => reports_presentation_sum($rows, 'online_consultations'), 'recorded_consultations' => $cases, 'finalized_cases' => $finalized, 'unfinalized_cases' => $legacy, 'scheduled_follow_ups' => $followups], [], 'No recorded clinical workload matches this scope.')];
    return reports_presentation_result($executive, $discussion, $sections, 'Consultation finalization or created-date fallbacks define record volume. Follow-up totals use scheduled follow-up dates, not attendance.', count($rows), 'veterinarian entries');
}
