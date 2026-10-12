<?php
/** Synthetic presentation fixtures. No database connection or client records are used. */

function report_fixture_range(): array
{
    $today = new DateTimeImmutable('today', new DateTimeZone('Asia/Manila'));
    $start = $today->modify('-7 days');
    $end = $today->modify('+7 days');
    return [
        'range' => 'custom',
        'start_date' => $start->format('Y-m-d'),
        'end_date' => $end->format('Y-m-d'),
        'start_datetime' => $start->format('Y-m-d') . ' 00:00:00',
        'end_datetime' => $end->format('Y-m-d') . ' 23:59:59',
        'label' => $start->format('F j, Y') . ' to ' . $end->format('F j, Y'),
    ];
}

function report_fixture(string $type, array $rows, array $totals, array $extra = []): array
{
    $titles = reports_title_map();
    // Match the report builders' data contract while keeping fixture facts explicit.
    foreach ($rows as $index => &$row) {
        switch ($type) {
            case 'invoice_receipt':
                $row['posted_at'] = $row['payment_date'] . ' 09:00:00';
                break;
            case 'queue':
                $totals['wait_sample_count'] = $totals['measured_wait_count'] ?? 0;
                $totals['missing_receive_count'] = count(array_filter($rows, static fn($entry) => empty($entry['received_at'])));
                break;
            case 'consultation':
                $row['source_reference'] = 'TEST-CONSULT-' . ($index + 1);
                $row['finalized_at'] = ($row['record_status'] ?? '') === 'finalized' ? $row['consultation_date'] : null;
                break;
            case 'follow_up':
                $row['reminder_status'] = str_contains($row['reminder_status'], 'past due') ? 'past due' : ($row['reminder_status'] === 'upcoming' ? 'pending' : $row['reminder_status']);
                $row['days_past_due'] = $row['reminder_status'] === 'past due' ? 1 : 0;
                $row['consultation_date'] = report_fixture_range()['start_datetime'];
                $row['source_reference'] = 'TEST-CONSULT-' . $row['diagnosis_id'];
                break;
            case 'emr_request':
                $row['request_id'] = $index + 51;
                $row['requested_at'] = $row['submitted_at'];
                $row['updated_at'] = $row['completed_at'] ?? $row['requested_at'];
                $row['assigned_veterinarian_user_id'] = $row['assigned_veterinarian'] === 'Unassigned' ? null : 202;
                unset($row['submitted_at'], $row['created_at']);
                break;
            case 'inventory_status':
                $row['expired_stock'] = $row['expiry_status'] === 'expired' ? 3 : 0;
                $row['near_expiry_stock'] = $row['expiry_status'] === 'near_expiry' ? $row['stock_level'] : 0;
                break;
            case 'stock_movement':
                $row['batch_id'] = $row['item_id'] + 100;
                break;
            case 'medicine_product_sales':
                $row['item_id'] = 101 + $index;
                break;
            case 'confinement_pet_hotel':
                $row['booking_id'] = 81 + $index;
                $row['assignment_id'] = 181 + $index;
                $row['planned_admission'] = $row['planned_admission_date'];
                $row['planned_release'] = $row['planned_release_date'];
                $row['actual_admission'] = $row['actual_check_in_at'];
                $row['actual_release'] = $row['actual_check_out_at'];
                unset($row['planned_admission_date'], $row['planned_release_date'], $row['actual_check_in_at'], $row['actual_check_out_at']);
                if ($row['stay_status'] === 'active') $row['stay_status'] = 'occupied';
                break;
            case 'consent_form':
                if (isset($row['status'])) {
                    $row['requested_at'] = $row['requested_date'] . ' 08:00:00';
                    $row['event_at'] = $row['signed_at'] ?? $row['requested_at'];
                    $row['document_available'] = $row['status'] === 'signed';
                    $row['document_status'] = $row['document_available'] ? 'available' : 'not uploaded';
                    $row['legacy_signature'] = false;
                }
                break;
            case 'veterinarian_activity':
                $row['veterinarian_user_id'] = 201 + $index;
                $row['finalized_cases'] = $row['finalized_records'];
                $row['unfinalized_cases'] = $row['legacy_records'];
                unset($row['recorded_consultations'], $row['finalized_records'], $row['legacy_records']);
                break;
        }
    }
    unset($row);
    if ($type === 'queue') unset($totals['measured_wait_count']);
    if ($type === 'medicine_product_sales' && isset($totals['total_product_billed_value'])) {
        $totals['total_billed_value'] = $totals['total_product_billed_value'];
        unset($totals['total_product_billed_value']);
    }
    if ($type === 'sales' && isset($totals['transaction_count'])) $totals['collection_days'] = count($rows);
    if (isset($extra['payment_methods'])) {
        foreach ($extra['payment_methods'] as &$method) $method['transaction_count'] = $method['receipt_count'] + $method['refund_count'];
        unset($method);
    }
    $keys = array_keys($rows[0] ?? []);
    return array_replace([
        'type' => $type,
        'title' => $titles[$type],
        'columns' => array_map(static fn($key) => ['key' => $key, 'label' => reports_humanize_key($key)], $keys),
        'rows' => $rows,
        'totals' => $totals,
        'summary' => ['text' => 'An obsolete generic summary that must be replaced.', 'bullets' => []],
        'chart' => reports_empty_chart(),
        'missing_data' => [],
        'date_range' => array_intersect_key(report_fixture_range(), array_flip(['start_date', 'end_date', 'label'])),
        'generated_at' => (new DateTimeImmutable('now', new DateTimeZone('Asia/Manila')))->format('Y-m-d H:i:s'),
    ], $extra);
}

function report_fixture_reports(): array
{
    $today = new DateTimeImmutable('today', new DateTimeZone('Asia/Manila'));
    $past = $today->modify('-1 day')->format('Y-m-d');
    $date = $today->format('Y-m-d');
    $future = $today->modify('+1 day')->format('Y-m-d');
    $longTreatment = 'The chart records oral medication twice daily for five days, with food. The owner was asked to monitor appetite, water intake, energy, and any vomiting. The veterinarian documented a return visit if symptoms persist and a planned reassessment after treatment. Medication administration and response have not yet been verified in a subsequent consultation. This complete treatment note should remain readable in the preview and exported record.';

    return [
        'sales' => report_fixture('sales', [
            ['date' => $past, 'payment_methods' => 'Cash, GCash', 'service_sales' => 80.0, 'product_sales' => 20.0, 'total_sales' => 100.0, 'paid_amount' => 100.0, 'balance' => 0.0, 'gross_receipts' => 100.0, 'refund_amount' => 0.0, 'receipt_count' => 2, 'refund_count' => 0, 'collection_count' => 2],
            ['date' => $date, 'payment_methods' => 'Cash', 'service_sales' => -120.0, 'product_sales' => -30.0, 'total_sales' => -150.0, 'paid_amount' => -150.0, 'balance' => 0.0, 'gross_receipts' => 0.0, 'refund_amount' => 150.0, 'receipt_count' => 0, 'refund_count' => 1, 'collection_count' => 1],
        ], ['total_visits' => 3, 'total_sales' => -50.0, 'service_sales' => -40.0, 'product_sales' => -10.0, 'paid_amount' => -50.0, 'unpaid_balance' => 0.0, 'gross_receipts' => 100.0, 'refund_amount' => 150.0, 'receipt_count' => 2, 'refund_count' => 1, 'collection_count' => 3, 'transaction_count' => 3, 'most_used_payment_method' => 'Cash'], [
            'payment_methods' => [
                ['payment_method' => 'Cash', 'receipt_count' => 1, 'refund_count' => 1, 'gross_receipts' => 60.0, 'refund_amount' => 150.0, 'net_collections' => -90.0],
                ['payment_method' => 'GCash', 'receipt_count' => 1, 'refund_count' => 0, 'gross_receipts' => 40.0, 'refund_amount' => 0.0, 'net_collections' => 40.0],
            ],
        ]),
        'billing' => report_fixture('billing', [
            ['source_id' => 11, 'source_reference' => 'VIS-000011', 'source_label' => 'Visit', 'visit_date' => $past, 'owner_name' => 'Test Client A', 'pet_name' => 'Milo', 'charges_summary' => 'Consultation and diagnostics', 'payment_methods' => 'Cash', 'total_bill' => 900.0, 'paid_amount' => 200.0, 'balance' => 700.0, 'billing_status' => 'partial'],
            ['source_id' => 12, 'source_reference' => 'VIS-000012', 'source_label' => 'Visit', 'visit_date' => $date, 'owner_name' => 'Test Client B', 'pet_name' => 'Luna', 'charges_summary' => 'Vaccine', 'payment_methods' => 'GCash', 'total_bill' => 500.0, 'paid_amount' => 100.0, 'balance' => 400.0, 'billing_status' => 'partial'],
            ['source_id' => 13, 'source_reference' => 'VIS-000013', 'source_label' => 'Visit', 'visit_date' => $date, 'owner_name' => 'Test Client C', 'pet_name' => 'Pepper', 'charges_summary' => 'Consultation', 'payment_methods' => 'Cash', 'total_bill' => 200.0, 'paid_amount' => 200.0, 'balance' => 0.0, 'billing_status' => 'paid'],
        ], ['total_visits' => 3, 'total_sales' => 1600.0, 'service_sales' => 1600.0, 'product_sales' => 0.0, 'paid_amount' => 500.0, 'unpaid_balance' => 1100.0, 'unpaid_or_partial_count' => 2]),
        'invoice_receipt' => report_fixture('invoice_receipt', [
            ['invoice_number' => 'INV-000011', 'receipt_number' => 'OR-000001', 'payment_date' => $past, 'client_name' => 'Test Client A', 'pet_name' => 'Milo', 'payment_method' => 'Cash', 'payment_status' => 'verified', 'reference_number' => '', 'amount_paid' => 60.0, 'processed_by' => 'Test Cashier'],
            ['invoice_number' => 'INV-000012', 'receipt_number' => 'OR-000002', 'payment_date' => $past, 'client_name' => 'Test Client B', 'pet_name' => 'Luna', 'payment_method' => 'GCash', 'payment_status' => 'verified', 'reference_number' => 'TEST-GCASH-002', 'amount_paid' => 40.0, 'processed_by' => 'Test Cashier'],
            ['invoice_number' => 'INV-000011', 'receipt_number' => 'RF-000001', 'payment_date' => $date, 'client_name' => 'Test Client A', 'pet_name' => 'Milo', 'payment_method' => 'Cash', 'payment_status' => 'refunded', 'reference_number' => 'TEST-REFUND-001', 'amount_paid' => -150.0, 'processed_by' => 'Unassigned'],
        ], ['total_records' => 3, 'total_paid' => -50.0, 'gross_receipts' => 100.0, 'refund_amount' => 150.0, 'receipt_count' => 2, 'refund_count' => 1]),
        'service_utilization' => report_fixture('service_utilization', [
            ['service_name' => 'Consultation', 'service_type' => 'consultation', 'usage_count' => 3, 'distinct_visits' => 3, 'total_quantity' => 3.0, 'total_revenue' => 600.0],
            ['service_name' => 'Vaccination', 'service_type' => 'vaccination', 'usage_count' => 3, 'distinct_visits' => 2, 'total_quantity' => 3.0, 'total_revenue' => 300.0],
            ['service_name' => 'Pet hotel', 'service_type' => 'boarding', 'usage_count' => 0, 'distinct_visits' => 0, 'total_quantity' => 0.0, 'total_revenue' => 0.0],
        ], ['total_services' => 6, 'unique_services' => 3, 'most_used_service' => 'Consultation', 'least_used_service' => 'Pet hotel']),
        'appointment' => report_fixture('appointment', [
            ['booking_id' => 21, 'booking_number' => 'BOOK-000021', 'booking_date' => $past, 'booking_time' => '09:00:00', 'client_name' => 'Test Client A', 'pet_name' => 'Milo', 'service_type' => 'consultation', 'status' => 'completed', 'notes' => 'Rescheduled before visit', 'price' => 200.0],
            ['booking_id' => 22, 'booking_number' => 'BOOK-000022', 'booking_date' => $past, 'booking_time' => '10:00:00', 'client_name' => 'Test Client B', 'pet_name' => 'Luna', 'service_type' => 'vaccination', 'status' => 'confirmed', 'notes' => '', 'price' => 500.0],
            ['booking_id' => 23, 'booking_number' => 'BOOK-000023', 'booking_date' => $future, 'booking_time' => '11:00:00', 'client_name' => 'Test Client C', 'pet_name' => 'Pepper', 'service_type' => 'consultation', 'status' => 'pending', 'notes' => '', 'price' => 200.0],
        ], ['total_appointments' => 3, 'pending' => 1, 'confirmed' => 1, 'completed' => 1, 'cancelled' => 0, 'missed_rescheduled' => 1, 'completion_rate' => 33.3]),
        'queue' => report_fixture('queue', [
            ['queue_id' => 31, 'queue_number' => 'Q-001', 'queue_date' => $past, 'queued_at' => $past . ' 09:00:00', 'received_at' => $past . ' 09:15:00', 'client_name' => 'Test Client A', 'pet_name' => 'Milo', 'service_name' => 'Consultation', 'priority' => 'regular', 'status' => 'completed', 'assignment_status' => 'completed', 'veterinarian_name' => 'Dr. Test A', 'waiting_minutes' => 15],
            ['queue_id' => 32, 'queue_number' => 'Q-002', 'queue_date' => $past, 'queued_at' => $past . ' 09:10:00', 'received_at' => null, 'client_name' => 'Test Client B', 'pet_name' => 'Luna', 'service_name' => 'Vaccination', 'priority' => 'regular', 'status' => 'completed', 'assignment_status' => 'completed', 'veterinarian_name' => 'Dr. Test B', 'waiting_minutes' => null],
            ['queue_id' => 33, 'queue_number' => 'Q-003', 'queue_date' => $date, 'queued_at' => $date . ' 09:10:00', 'received_at' => null, 'client_name' => 'Test Client C', 'pet_name' => 'Pepper', 'service_name' => 'Consultation', 'priority' => 'urgent', 'status' => 'waiting', 'assignment_status' => null, 'veterinarian_name' => null, 'waiting_minutes' => null],
        ], ['total_queue_entries' => 3, 'waiting' => 1, 'in-progress' => 0, 'completed' => 2, 'cancelled' => 0, 'average_waiting_minutes' => 15.0, 'measured_wait_count' => 1]),
        'consultation' => report_fixture('consultation', [
            ['consultation_type' => 'Face-to-face', 'consultation_date' => $past . ' 09:20:00', 'pet_name' => 'Milo', 'pet_species' => 'Dog', 'veterinarian_name' => 'Dr. Test A', 'service_name' => 'Consultation', 'diagnosis' => 'Recorded gastrointestinal symptoms; provisional diagnosis pending reassessment.', 'treatment' => $longTreatment, 'follow_up_date' => $future, 'notes' => 'Owner has a written treatment plan.', 'record_status' => 'finalized'],
            ['consultation_type' => 'Online', 'consultation_date' => $date . ' 10:00:00', 'pet_name' => 'Luna', 'pet_species' => 'Cat', 'veterinarian_name' => 'Dr. Test B', 'service_name' => 'online consultation', 'diagnosis' => 'Skin irritation documented in submitted photographs.', 'treatment' => 'An in-person examination was advised.', 'follow_up_date' => null, 'notes' => '', 'record_status' => 'legacy'],
        ], ['total_consultations' => 2, 'face_to_face' => 1, 'online' => 1, 'finalized_records' => 1, 'legacy_records' => 1]),
        'follow_up' => report_fixture('follow_up', [
            ['diagnosis_id' => 41, 'follow_up_date' => $past, 'pet_name' => 'Milo', 'pet_species' => 'Dog', 'owner_name' => 'Test Client A', 'veterinarian_name' => 'Dr. Test A', 'reason' => 'Reassessment of recorded symptoms', 'reminder_status' => 'past due; completion unverified'],
            ['diagnosis_id' => 42, 'follow_up_date' => $date, 'pet_name' => 'Luna', 'pet_species' => 'Cat', 'owner_name' => 'Test Client B', 'veterinarian_name' => 'Dr. Test B', 'reason' => 'Medication review', 'reminder_status' => 'due today'],
            ['diagnosis_id' => 43, 'follow_up_date' => $future, 'pet_name' => 'Pepper', 'pet_species' => 'Dog', 'owner_name' => 'Test Client C', 'veterinarian_name' => 'Dr. Test A', 'reason' => 'Scheduled wound review', 'reminder_status' => 'upcoming'],
        ], ['total_follow_ups' => 3, 'past_due' => 1, 'due_today' => 1, 'pending' => 1, 'upcoming' => 1]),
        'emr_request' => report_fixture('emr_request', [
            ['request_number' => 'REQ-000051', 'requested_date' => $past, 'submitted_at' => $past . ' 08:00:00', 'created_at' => $past . ' 08:00:00', 'owner_name' => 'Test Client A', 'pet_name' => 'Milo', 'pet_species' => 'Dog', 'status' => 'pending', 'payment_status' => 'pending', 'assigned_veterinarian' => 'Unassigned', 'reviewed_at' => null, 'completed_at' => null],
            ['request_number' => 'REQ-000052', 'requested_date' => $past, 'submitted_at' => $past . ' 09:00:00', 'created_at' => $past . ' 09:00:00', 'owner_name' => 'Test Client B', 'pet_name' => 'Luna', 'pet_species' => 'Cat', 'status' => 'completed', 'payment_status' => 'verified', 'assigned_veterinarian' => 'Dr. Test B', 'reviewed_at' => $past . ' 09:30:00', 'completed_at' => $date . ' 09:00:00'],
        ], ['total_requests' => 2, 'pending' => 1, 'completed' => 1]),
        'inventory_status' => report_fixture('inventory_status', [
            ['item_id' => 61, 'item_name' => 'Test amoxicillin', 'category' => 'medication', 'sku' => 'TEST-MED-01', 'unit' => 'tablet', 'stock_level' => 2, 'on_hand_stock' => 2, 'reorder_level' => 10, 'nearest_expiry' => $future, 'expiry_warning_days' => 30, 'stock_status' => 'low_stock', 'expiry_status' => 'near_expiry', 'attention_status' => 'low_stock, near_expiry'],
            ['item_id' => 62, 'item_name' => 'Test saline', 'category' => 'consumable', 'sku' => 'TEST-CON-02', 'unit' => 'bottle', 'stock_level' => 0, 'on_hand_stock' => 0, 'reorder_level' => 5, 'nearest_expiry' => null, 'expiry_warning_days' => 30, 'stock_status' => 'out_of_stock', 'expiry_status' => 'ok', 'attention_status' => 'out_of_stock'],
            ['item_id' => 63, 'item_name' => 'Test supplement', 'category' => 'medication', 'sku' => 'TEST-MED-03', 'unit' => 'bottle', 'stock_level' => 20, 'on_hand_stock' => 23, 'reorder_level' => 5, 'nearest_expiry' => $past, 'expiry_warning_days' => 30, 'stock_status' => 'ok', 'expiry_status' => 'expired', 'attention_status' => 'expired'],
            ['item_id' => 64, 'item_name' => 'Test food', 'category' => 'retail_product', 'sku' => 'TEST-RET-04', 'unit' => 'bag', 'stock_level' => 10, 'on_hand_stock' => 10, 'reorder_level' => 5, 'nearest_expiry' => null, 'expiry_warning_days' => 30, 'stock_status' => 'ok', 'expiry_status' => 'ok', 'attention_status' => 'ok'],
            ['item_id' => 65, 'item_name' => 'Test unmeasured item', 'category' => 'consumable', 'sku' => 'TEST-CON-05', 'unit' => 'box', 'stock_level' => null, 'on_hand_stock' => null, 'reorder_level' => 5, 'nearest_expiry' => null, 'expiry_warning_days' => 30, 'stock_status' => 'unknown', 'expiry_status' => 'unknown', 'attention_status' => 'unknown'],
        ], ['total_items' => 5, 'low_stock' => 1, 'out_of_stock' => 1, 'near_expiry' => 1, 'expired' => 1, 'items_requiring_attention' => 3], ['snapshot_at' => $date . ' 12:00:00']),
        'stock_movement' => report_fixture('stock_movement', [
            ['movement_id' => 71, 'item_id' => 62, 'movement_date' => $past, 'movement_at' => $past . ' 08:00:00', 'created_at' => $past . ' 08:00:00', 'item_name' => 'Test saline', 'category' => 'consumable', 'unit' => 'bottle', 'location_id' => 1, 'location_name' => 'Test storeroom', 'movement_type' => 'receipt', 'quantity_change' => 20, 'quantity_before' => 100, 'quantity_after' => 120, 'reference_type' => 'purchase', 'reference_id' => 1, 'performed_by_name' => 'Test Stock Clerk', 'remarks' => 'Delivery checked'],
            ['movement_id' => 72, 'item_id' => 62, 'movement_date' => $date, 'movement_at' => $date . ' 08:00:00', 'created_at' => $date . ' 08:00:00', 'item_name' => 'Test saline', 'category' => 'consumable', 'unit' => 'bottle', 'location_id' => 1, 'location_name' => 'Test storeroom', 'movement_type' => 'issue', 'quantity_change' => -7, 'quantity_before' => 120, 'quantity_after' => 113, 'reference_type' => 'visit', 'reference_id' => 11, 'performed_by_name' => 'Test Stock Clerk', 'remarks' => 'Issued to treatment'],
            ['movement_id' => 73, 'item_id' => 61, 'movement_date' => $date, 'movement_at' => $date . ' 09:00:00', 'created_at' => $date . ' 09:00:00', 'item_name' => 'Test amoxicillin', 'category' => 'medication', 'unit' => 'tablet', 'location_id' => 1, 'location_name' => 'Test storeroom', 'movement_type' => 'adjustment', 'quantity_change' => -2, 'quantity_before' => 12, 'quantity_after' => 10, 'reference_type' => 'count', 'reference_id' => 2, 'performed_by_name' => 'Test Stock Clerk', 'remarks' => 'Count corrected'],
        ], ['total_movements' => 3, 'received_items' => 20, 'used_sold_adjusted_out' => 9]),
        'medicine_product_sales' => report_fixture('medicine_product_sales', [
            ['item_name' => 'Test vaccine', 'category' => 'medication', 'unit' => 'bottle', 'quantity_sold' => 2.0, 'billed_value' => 400.0, 'total_sales' => 200.0, 'remaining_stock' => 10],
            ['item_name' => 'Test food', 'category' => 'retail_product', 'unit' => 'bag', 'quantity_sold' => 6.0, 'billed_value' => 100.0, 'total_sales' => 100.0, 'remaining_stock' => 3],
        ], ['top_selling_item' => 'Test vaccine', 'total_quantity_sold' => 8.0, 'total_product_revenue' => 300.0, 'total_product_billed_value' => 500.0]),
        'confinement_pet_hotel' => report_fixture('confinement_pet_hotel', [
            ['booking_number' => 'BOOK-000081', 'pet_name' => 'Milo', 'pet_species' => 'Dog', 'hotel_boarding_type' => 'confinement', 'planned_admission_date' => $past, 'planned_release_date' => $future, 'actual_check_in_at' => $past . ' 09:00:00', 'actual_check_out_at' => null, 'admission_date' => $past . ' 09:00:00', 'release_date' => $future, 'duration_days' => 3, 'room_type' => 'small', 'room_number' => 'C-01', 'stay_status' => 'active', 'booking_status' => 'confirmed', 'total_charge' => 900.0, 'paid_amount' => 300.0, 'balance' => 600.0],
            ['booking_number' => 'BOOK-000082', 'pet_name' => 'Luna', 'pet_species' => 'Cat', 'hotel_boarding_type' => 'hotel', 'planned_admission_date' => $future, 'planned_release_date' => $today->modify('+3 days')->format('Y-m-d'), 'actual_check_in_at' => null, 'actual_check_out_at' => null, 'admission_date' => $future, 'release_date' => $today->modify('+3 days')->format('Y-m-d'), 'duration_days' => 3, 'room_type' => 'small', 'room_number' => null, 'stay_status' => 'reserved', 'booking_status' => 'confirmed', 'total_charge' => 600.0, 'paid_amount' => 0.0, 'balance' => 600.0],
        ], ['total_stays' => 2, 'total_charge' => 1500.0, 'total_paid' => 300.0, 'total_balance' => 1200.0]),
        'consent_form' => report_fixture('consent_form', [
            ['consent_record_id' => 91, 'consent_type' => 'Treatment consent', 'client_name' => 'Test Client A', 'pet_name' => 'Milo', 'service' => 'Consultation', 'status' => 'pending', 'source' => 'booking', 'source_reference' => 'BOOK-000021', 'requested_date' => $past, 'signed_at' => null, 'released_at' => null],
            ['consent_record_id' => 92, 'consent_type' => 'Boarding consent', 'client_name' => 'Test Client B', 'pet_name' => 'Luna', 'service' => 'Pet hotel', 'status' => 'signed', 'source' => 'manual', 'source_reference' => 'CONSENT-000092', 'requested_date' => $date, 'signed_at' => $date . ' 09:00:00', 'released_at' => null],
        ], ['total_records' => 2, 'signed' => 1, 'pending' => 1, 'released' => 0, 'cancelled' => 0]),
        'veterinarian_activity' => report_fixture('veterinarian_activity', [
            ['veterinarian_name' => 'Dr. Test A', 'face_to_face_consultations' => 2, 'online_consultations' => 1, 'follow_ups' => 5, 'scheduled_follow_ups' => 5, 'completed_cases' => 3, 'recorded_consultations' => 3, 'finalized_records' => 2, 'legacy_records' => 1],
            ['veterinarian_name' => 'Dr. Test B', 'face_to_face_consultations' => 1, 'online_consultations' => 2, 'follow_ups' => 1, 'scheduled_follow_ups' => 1, 'completed_cases' => 3, 'recorded_consultations' => 3, 'finalized_records' => 3, 'legacy_records' => 0],
        ], ['most_active_veterinarian' => 'Dr. Test A', 'total_consultations_handled' => 6, 'total_scheduled_follow_ups' => 6]),
    ];
}

function report_fixture_edge_cases(): array
{
    $fixtures = report_fixture_reports();
    $noActivity = $fixtures['service_utilization'];
    foreach ($noActivity['rows'] as &$row) {
        $row['usage_count'] = 0;
        $row['distinct_visits'] = 0;
        $row['total_quantity'] = 0.0;
        $row['total_revenue'] = 0.0;
    }
    unset($row);
    $noActivity['totals']['total_services'] = 0;
    $noActivity['totals']['most_used_service'] = 'Consultation';

    $unmeasuredQueue = $fixtures['queue'];
    foreach ($unmeasuredQueue['rows'] as &$row) {
        $row['received_at'] = null;
        $row['waiting_minutes'] = null;
    }
    unset($row);
    $unmeasuredQueue['totals']['average_waiting_minutes'] = null;
    $unmeasuredQueue['totals']['wait_sample_count'] = 0;
    $unmeasuredQueue['totals']['missing_receive_count'] = count($unmeasuredQueue['rows']);

    $templates = report_fixture('consent_form', [
        ['file_id' => 101, 'file_name' => 'Test treatment consent template.pdf', 'file_type' => 'application/pdf', 'file_size' => 4096, 'category' => 'treatment', 'uploaded_date' => report_fixture_range()['start_date'], 'consent_status' => 'template_available'],
    ], ['total_files' => 1, 'signed' => null, 'pending' => null], [
        'template_mode' => true,
        'missing_data' => ['Uploaded files are templates; client consent tracking is unavailable.'],
    ]);

    $fractionalStock = $fixtures['inventory_status'];
    $fractionalStock['rows'] = [$fractionalStock['rows'][0]];
    $fractionalStock['rows'][0] = array_replace($fractionalStock['rows'][0], ['stock_level' => 0.75, 'on_hand_stock' => 1.25, 'reorder_level' => 1.5, 'expired_stock' => 0.5, 'near_expiry_stock' => 0.25, 'expiry_status' => 'expired']);
    $fractionalStock['totals'] = ['total_items' => 1, 'low_stock' => 1, 'out_of_stock' => 0, 'expired' => 1, 'near_expiry' => 1];

    $unknownStock = $fixtures['inventory_status'];
    $unknownStock['rows'] = [$unknownStock['rows'][4]];
    $unknownStock['rows'][0]['expired_stock'] = null;
    $unknownStock['rows'][0]['near_expiry_stock'] = null;
    $unknownStock['totals'] = ['total_items' => 1, 'low_stock' => 0, 'out_of_stock' => 0, 'expired' => 0, 'near_expiry' => 0];
    $unknownStock['missing_data'] = ['Stock and expiry status cannot be calculated because batch data is unavailable.'];

    $partialStock = $fractionalStock;
    $partialStock['rows'][0]['stock_status'] = 'unknown';
    $partialStock['rows'][0]['stock_level'] = null;
    $partialStock['totals']['low_stock'] = 0;

    $fractionalMovements = $fixtures['stock_movement'];
    $fractionalMovements['rows'] = array_slice($fractionalMovements['rows'], 0, 2);
    $fractionalMovements['rows'][0] = array_replace($fractionalMovements['rows'][0], ['unit' => 'mL', 'quantity_before' => 10.0, 'quantity_change' => 1.25, 'quantity_after' => 11.25]);
    $fractionalMovements['rows'][1] = array_replace($fractionalMovements['rows'][1], ['unit' => 'mL', 'quantity_before' => 11.25, 'quantity_change' => -0.5, 'quantity_after' => 10.75]);
    $fractionalMovements['totals'] = ['total_movements' => 2];

    $fractionalProducts = $fixtures['medicine_product_sales'];
    $fractionalProducts['rows'] = [array_replace($fractionalProducts['rows'][0], ['unit' => 'vial', 'quantity_sold' => 0.5, 'remaining_stock' => 1.25, 'billed_value' => 30.0, 'total_sales' => 15.0])];
    $fractionalProducts['totals'] = ['total_product_revenue' => 15.0, 'total_billed_value' => 30.0];

    return [
        'service_without_activity' => $noActivity,
        'queue_without_measured_waits' => $unmeasuredQueue,
        'consent_templates_only' => $templates,
        'fractional_stock' => $fractionalStock,
        'stock_measurements_unavailable' => $unknownStock,
        'stock_unknown_with_expiry_alert' => $partialStock,
        'fractional_movements' => $fractionalMovements,
        'fractional_products' => $fractionalProducts,
        'unavailable_sales' => reports_blank_report('sales', ['Required collection tables are unavailable.']),
        'empty_sales' => report_fixture('sales', [], ['total_sales' => 0.0, 'paid_amount' => 0.0, 'total_visits' => 0, 'service_sales' => 0.0, 'product_sales' => 0.0, 'receipt_count' => 0, 'refund_count' => 0, 'gross_receipts' => 0.0, 'refund_amount' => 0.0]),
    ];
}

// Run directly to produce a browser fixture artifact, or include for regression checks.
if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {
    require_once __DIR__ . '/../../php/reports_common.php';
    $range = report_fixture_range();
    $enrich = static fn($report) => reports_enrich_report($report, $range, []);
    $pack = [
        'synthetic' => true,
        'generated_at' => date(DATE_ATOM),
        'range' => $range,
        'reports' => array_map($enrich, report_fixture_reports()),
        'edge_cases' => array_map($enrich, report_fixture_edge_cases()),
    ];
    $json = json_encode($pack, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    $arguments = $argv ?? [];
    $outputIndex = array_search('--output', $arguments, true);
    if ($outputIndex !== false && isset($arguments[$outputIndex + 1])) {
        $path = $arguments[$outputIndex + 1];
        if (file_put_contents($path, $json . "\n") === false) {
            throw new RuntimeException('Could not write the fixture artifact.');
        }
        echo "Synthetic report fixtures written to {$path}\n";
    } else {
        echo $json . "\n";
    }
}
