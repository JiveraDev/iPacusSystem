import { formatDisplayTime, formatReportDateLabel, formatReportDateRange } from './date';
import { formatPhpCurrency } from './currency';

const REPORT_RECORD_LABELS = {
    sales: 'Collection records',
    billing: 'Billing register',
    invoice_receipt: 'Payment and refund register',
    service_utilization: 'Service activity',
    appointment: 'Booking register',
    queue: 'Queue handoff register',
    consultation: 'Clinical record register',
    follow_up: 'Follow-up dates',
    emr_request: 'Medical record requests',
    inventory_status: 'Current stock and expiry',
    stock_movement: 'Stock movement audit',
    medicine_product_sales: 'Issued items and allocated collections',
    confinement_pet_hotel: 'Stay register',
    consent_form: 'Consent documentation',
    veterinarian_activity: 'Recorded clinical workload'
};

const REPORT_EMPTY_LABELS = {
    sales: 'No verified collections or processed refunds were recorded for this period.',
    billing: 'No bills match this period and the selected filters.',
    invoice_receipt: 'No payment or refund records match this period.',
    service_utilization: 'No service activity matches the selected filters.',
    appointment: 'No appointments are scheduled in this period with these filters.',
    queue: 'No queue entries match this period and the selected filters.',
    consultation: 'No consultation records match this period and the selected filters.',
    follow_up: 'No follow-up dates fall within this period with these filters.',
    emr_request: 'No medical record requests match this period.',
    inventory_status: 'No active inventory items match the selected filters.',
    stock_movement: 'No stock movements match this period and the selected filters.',
    medicine_product_sales: 'No issued medicine or product lines match this period.',
    confinement_pet_hotel: 'No stays overlap this period with the selected filters.',
    consent_form: 'No consent documentation matches this period.',
    veterinarian_activity: 'No veterinarian activity was recorded with these filters in this period.'
};

export function humanizeReportLabel(value) {
    return String(value ?? '').replaceAll('_', ' ').replaceAll('-', ' ').replace(/\s+/g, ' ').trim();
}

function hasValue(value) {
    return value !== null && value !== undefined && value !== '';
}

export function reportColumnFormat(column = {}) {
    if (column.format) return column.format;
    const key = String(column.key || '').toLowerCase();
    if (/_at$/.test(key)) return 'datetime';
    if (/(^|_)date($|_)/.test(key) || /expiry$/.test(key)) return 'date';
    if (/(^|_)time$/.test(key)) return 'time';
    if (/(^|_)status$/.test(key)) return 'status';
    if (/(rate|percent|share)$/.test(key)) return 'percent';
    if (/(sales|revenue|bill|balance|amount|charge|price|paid|value)$/.test(key)) return 'currency';
    if (/(count|quantity|stock|level|minutes|days)$/.test(key) || /^(before|after)$/.test(key)) return 'number';
    return 'text';
}

export function reportColumnAlignment(column = {}) {
    return column.align || (['currency', 'number', 'quantity', 'percent'].includes(reportColumnFormat(column)) ? 'right' : 'left');
}

export function formatReportValue(value, column = {}, options = {}) {
    if (!hasValue(value)) return options.empty ?? '—';
    const type = reportColumnFormat(column);
    const numeric = Number(value);
    if (type === 'currency' && Number.isFinite(numeric)) {
        return formatPhpCurrency(numeric, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    if (['number', 'quantity', 'percent'].includes(type) && Number.isFinite(numeric)) {
        const formatted = numeric.toLocaleString('en-US', { maximumFractionDigits: type === 'percent' ? 1 : 2 });
        return type === 'percent' ? `${formatted}%` : formatted;
    }
    if (type === 'date') {
        return formatReportDateLabel(String(value).split(/[ T]/)[0], { fallback: String(value) });
    }
    if (type === 'datetime') return formatReportDateLabel(value, { fallback: String(value) });
    if (type === 'time') return formatDisplayTime(value, { fallback: String(value) });
    if (type === 'status') {
        return String(value).split(',').map(part => {
            const label = humanizeReportLabel(part);
            return label.charAt(0).toUpperCase() + label.slice(1);
        }).join(', ');
    }
    if (Array.isArray(value)) return value.map(item => formatReportValue(item, { format: 'text' })).join(', ');
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
}

export function reportSecondaryFields(column, row) {
    return (Array.isArray(column.secondary_keys) ? column.secondary_keys : [])
        .map(field => typeof field === 'string' ? { key: field } : field)
        .filter(field => field?.key && hasValue(row[field.key]))
        .map(field => ({ ...field, value: formatReportValue(row[field.key], field) }));
}

export function reportCellText(row, column) {
    const secondary = reportSecondaryFields(column, row).map(field => `${field.label ? `${field.label}: ` : ''}${field.value}`);
    return [formatReportValue(row[column.key], column), ...secondary].join('\n');
}

export function reportRowDetails(section, row) {
    return (Array.isArray(section.row_details) ? section.row_details : []).map(field => ({
        ...field,
        value: formatReportValue(row[field.key], field, { empty: 'Not recorded' })
    }));
}

export function getReportSections(report) {
    if (Array.isArray(report?.sections) && report.sections.length) {
        return report.sections.map((section, index) => ({
            ...section,
            id: section.id || `section-${index + 1}`,
            columns: Array.isArray(section.columns) ? section.columns : [],
            rows: Array.isArray(section.rows) ? section.rows : [],
            empty_message: section.empty_message || REPORT_EMPTY_LABELS[report.type] || 'No matching records are available.'
        }));
    }
    return [{
        id: 'records',
        title: REPORT_RECORD_LABELS[report?.type] || 'Record register',
        columns: Array.isArray(report?.columns) ? report.columns : [],
        rows: Array.isArray(report?.rows) ? report.rows : [],
        empty_message: REPORT_EMPTY_LABELS[report?.type] || 'No matching records are available.'
    }];
}

export function getReportNarrative(report) {
    const summary = report?.summary || {};
    const discussion = Array.isArray(summary.discussion)
        ? summary.discussion
        : [summary.discussion || summary.operational_context || summary.operationalContext];
    const actions = summary.management_actions || summary.managementActions;
    return {
        executive: summary.executive_text || summary.executiveText || summary.text || 'No findings are available for this report.',
        discussion: discussion.filter(Boolean),
        actions: Array.isArray(actions) ? actions.filter(Boolean) : [],
        scope: summary.scope_note || '',
        filters: Array.isArray(summary.filters) ? summary.filters : [],
        breakdowns: Array.isArray(summary.breakdowns) ? summary.breakdowns : [],
        missing: Array.isArray(report?.missing_data) ? report.missing_data.filter(Boolean) : []
    };
}

export function reportMetadata(report) {
    return {
        dateRange: formatReportDateRange(report.date_range?.start_date, report.date_range?.end_date, { fallback: report.date_range?.label || 'Not specified' }),
        generatedAt: formatReportDateLabel(report.generated_at, { fallback: report.generated_at || 'Not recorded' }),
        generatedBy: report.generated_by || 'Super Admin'
    };
}

export function getReportOrientation(report) {
    return report?.print_orientation === 'landscape' ? 'landscape' : 'portrait';
}

export function reportColumnWidths(columns) {
    const weights = columns.map(column => {
        const width = parseFloat(column.width);
        return Number.isFinite(width) && width > 0 ? width : (column.primary ? 1.5 : 1);
    });
    const total = weights.reduce((sum, width) => sum + width, 0);
    return weights.map(width => total ? width / total : 0);
}

export function excelReportValue(value, column = {}) {
    if (!hasValue(value)) return null;
    const type = reportColumnFormat(column);
    if (['currency', 'number', 'quantity', 'percent'].includes(type) && Number.isFinite(Number(value))) {
        return type === 'percent' ? Number(value) / 100 : Number(value);
    }
    if (type === 'time') {
        const match = String(value).match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
        if (match) return (Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3] || 0)) / 86400;
    }
    if (type === 'date' || type === 'datetime') {
        const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
        if (match) {
            return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]),
                type === 'date' ? 0 : Number(match[4] || 0), type === 'date' ? 0 : Number(match[5] || 0), type === 'date' ? 0 : Number(match[6] || 0)));
        }
    }
    return formatReportValue(value, column, { empty: '' });
}

export function excelReportNumberFormat(column = {}) {
    return {
        currency: '"PHP "#,##0.00;[Red]("PHP "#,##0.00)',
        number: '#,##0.##;[Red](#,##0.##)',
        quantity: '#,##0.##;[Red](#,##0.##)',
        percent: '0.0%',
        date: 'mmm d, yyyy',
        datetime: 'mmm d, yyyy h:mm AM/PM',
        time: 'h:mm AM/PM'
    }[reportColumnFormat(column)] || '@';
}
