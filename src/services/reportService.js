import { apiRequest, postJson } from './apiClient';

function getCurrentUser() {
    try {
        return JSON.parse(localStorage.getItem('currentUser') || '{}');
    } catch {
        return {};
    }
}

function getUserRole(user = getCurrentUser()) {
    return user?.role || user?.user_role || '';
}

function getUserName(user = getCurrentUser()) {
    const firstName = user?.first_Name || user?.firstName || user?.first_name || '';
    const lastName = user?.last_Name || user?.lastName || user?.last_name || '';
    const fullName = `${firstName} ${lastName}`.trim();

    return fullName || user?.mail_Address || user?.email || 'Super Admin';
}

function buildQuery(params = {}) {
    const user = params.user || getCurrentUser();
    const query = new URLSearchParams();
    const add = (key, value) => {
        if (value !== undefined && value !== null && String(value).trim() !== '') {
            query.set(key, value);
        }
    };

    add('role', getUserRole(user));
    add('range', params.range);
    add('start_date', params.startDate || params.start_date);
    add('end_date', params.endDate || params.end_date);

    return query.toString();
}

export function fetchReportsDashboard(params = {}, options = {}) {
    const query = buildQuery(params);
    return apiRequest(`/reports/dashboard${query ? `?${query}` : ''}`, options);
}

export function generateReport(payload = {}, options = {}) {
    const user = payload.user || getCurrentUser();
    const { user: _user, ...reportPayload } = payload;

    return postJson('/reports/generate', {
        ...reportPayload,
        role: getUserRole(user),
        generated_by: getUserName(user)
    }, options);
}

export const REPORT_TYPES = [
    { value: 'sales', label: 'Sales Report' },
    { value: 'billing', label: 'Billing Report' },
    { value: 'invoice_receipt', label: 'Invoice and Receipt Report' },
    { value: 'service_utilization', label: 'Service Utilization Report' },
    { value: 'appointment', label: 'Appointment Report' },
    { value: 'queue', label: 'Queue Report' },
    { value: 'consultation', label: 'Consultation Report' },
    { value: 'follow_up', label: 'Follow-Up Check-Up Report' },
    { value: 'emr_request', label: 'EMR Request Report' },
    { value: 'inventory_status', label: 'Inventory Status Report' },
    { value: 'stock_movement', label: 'Stock Movement Report' },
    { value: 'medicine_product_sales', label: 'Medicine/Product Sales Report' },
    { value: 'confinement_pet_hotel', label: 'Confinement and Pet Hotel Report' },
    { value: 'consent_form', label: 'Consent Form Report' },
    { value: 'categorized_pet_cases', label: 'Categorized Pet Cases Report' },
    { value: 'veterinarian_activity', label: 'Veterinarian Activity Report' }
];

export const REPORT_QUICK_RANGES = [
    { value: 'today', label: 'Today' },
    { value: 'this_week', label: 'This Week' },
    { value: 'this_month', label: 'This Month' },
    { value: 'this_quarter', label: 'This Quarter' },
    { value: 'this_year', label: 'This Year' },
    { value: 'custom', label: 'Custom Date Range' }
];
