import { useMemo, useState } from 'react';
import { ArrowLeft, Download, FileSpreadsheet, FileText, Loader2, Printer, Search } from 'lucide-react';
import { Button } from '../../ui/button';
import { Card, CardContent } from '../../ui/card';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { useDashboardUser, useNavigate } from '../dashboardRouter.jsx';
import { generateReport, REPORT_QUICK_RANGES, REPORT_TYPES } from '../../services/reportService';
import { formatReportDateLabel, formatReportDateRange } from '../../lib/date';
import ReportDateInput from './ReportDateInput';
import ReportPreview from './ReportPreview';

const PAYMENT_METHODS = [
    { value: 'cash', label: 'Cash' },
    { value: 'qrph', label: 'QRPH' },
    { value: 'gcash', label: 'GCash' },
    { value: 'maya', label: 'Maya' },
    { value: 'bank_transfer', label: 'Bank Transfer' }
];

const SERVICE_TYPES = [
    { value: 'consultation', label: 'Consultation' },
    { value: 'online-consultation', label: 'Online Consultation' },
    { value: 'vaccination', label: 'Vaccination' },
    { value: 'grooming', label: 'Grooming' },
    { value: 'dental', label: 'Dental' },
    { value: 'General Check-up', label: 'General Check-up' },
    { value: 'surgery', label: 'Surgery' },
    { value: 'kapon', label: 'Kapon' },
    { value: 'lab-testing', label: 'Lab Testing' },
    { value: 'parasite-control', label: 'Parasite Control' },
    { value: 'boarding', label: 'Boarding / Pet Hotel' },
    { value: 'home-service', label: 'Home Service' },
    { value: 'special services', label: 'Special Service' }
];

const APPOINTMENT_STATUSES = [
    { value: 'pending', label: 'Pending' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' }
];

const QUEUE_STATUSES = [
    { value: 'waiting', label: 'Waiting' },
    { value: 'in-progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' }
];

const CONSULTATION_TYPES = [
    { value: 'face_to_face', label: 'Face-to-face' },
    { value: 'online', label: 'Online' }
];

const STOCK_STATUSES = [
    { value: 'ok', label: 'OK' },
    { value: 'low_stock', label: 'Low Stock' },
    { value: 'out_of_stock', label: 'Out of Stock' },
    { value: 'near_expiry', label: 'Near Expiry' },
    { value: 'expired', label: 'Expired' }
];

const INVENTORY_CATEGORIES = [
    { value: 'medicine', label: 'Medicine' },
    { value: 'product', label: 'Product' },
    { value: 'supply', label: 'Supply' },
    { value: 'vaccine', label: 'Vaccine' },
    { value: 'consumable', label: 'Consumable' }
];

const PET_TYPES = [
    { value: 'Dog', label: 'Dog' },
    { value: 'Cat', label: 'Cat' },
    { value: 'Bird', label: 'Bird' },
    { value: 'Rabbit', label: 'Rabbit' },
    { value: 'Other', label: 'Other' }
];

function normalizeRole(role) {
    return String(role || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function isSuperAdmin(user) {
    return ['super_admin', 'superadmin'].includes(normalizeRole(user?.role));
}

function dateInputValue(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

function defaultMonthStart() {
    const date = new Date();
    return dateInputValue(new Date(date.getFullYear(), date.getMonth(), 1));
}

function defaultMonthEnd() {
    const date = new Date();
    return dateInputValue(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

function clinicToday() {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric'
    }).formatToParts(new Date()).reduce((values, part) => {
        if (part.type !== 'literal') {
            values[part.type] = Number(part.value);
        }
        return values;
    }, {});

    return new Date(parts.year, parts.month - 1, parts.day);
}

function quickRangeDates(value) {
    const today = clinicToday();
    let start = new Date(today);
    let end = new Date(today);

    if (value === 'this_week') {
        const weekday = today.getDay();
        const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
        start = new Date(today.getFullYear(), today.getMonth(), today.getDate() + mondayOffset);
        end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
    } else if (value === 'this_quarter') {
        const quarterStartMonth = Math.floor(today.getMonth() / 3) * 3;
        start = new Date(today.getFullYear(), quarterStartMonth, 1);
        end = new Date(today.getFullYear(), quarterStartMonth + 3, 0);
    } else if (value === 'this_year') {
        start = new Date(today.getFullYear(), 0, 1);
        end = new Date(today.getFullYear(), 11, 31);
    } else if (value !== 'today') {
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    }

    return {
        start: dateInputValue(start),
        end: dateInputValue(end)
    };
}

function csvEscape(value) {
    const text = value === null || value === undefined ? '' : String(value);
    return `"${text.replaceAll('"', '""')}"`;
}

function isReportDateColumn(column) {
    const key = String(column?.key || '').toLowerCase();

    return key.includes('date') || key.endsWith('_at') || key.endsWith('at');
}

function formatCsvReportValue(value, column) {
    if (value === null || value === undefined || value === '') {
        return '';
    }

    if (isReportDateColumn(column)) {
        return formatReportDateLabel(value, { fallback: String(value) });
    }

    if (Array.isArray(value)) {
        return value.join(', ');
    }

    if (typeof value === 'object') {
        return JSON.stringify(value);
    }

    return value;
}

function exportReportCsv(report) {
    if (!report) return;

    const dateRangeLabel = formatReportDateRange(report.date_range?.start_date, report.date_range?.end_date, {
        fallback: report.date_range?.label || 'N/A'
    });
    const generatedAtLabel = formatReportDateLabel(report.generated_at, { fallback: report.generated_at || 'N/A' });

    const lines = [
        [report.title],
        ['Date Range', dateRangeLabel],
        ['Generated At', generatedAtLabel],
        ['Generated By', report.generated_by || 'Super Admin'],
        [],
        ['Summary'],
        [report.summary?.text || 'No summary available.'],
        [],
        ['Totals']
    ];

    Object.entries(report.totals || {}).forEach(([key, value]) => {
        lines.push([key.replaceAll('_', ' '), value]);
    });

    lines.push([]);
    lines.push((report.columns || []).map(column => column.label));
    (report.rows || []).forEach(row => {
        lines.push((report.columns || []).map(column => formatCsvReportValue(row[column.key], column)));
    });

    const csv = lines.map(line => line.map(csvEscape).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const startDate = report.date_range?.start_date || 'start';
    const endDate = report.date_range?.end_date || 'end';
    const reportName = String(report.title || 'Report').replace(/[^a-z0-9]+/gi, '');

    link.href = URL.createObjectURL(blob);
    link.download = `iPawcus_${reportName}_${startDate}_to_${endDate}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
}

function FilterSelect({ label, value, onChange, options, allowCustom = false }) {
    const selectedLabel = options.find(option => option.value === value)?.label || value || 'All';

    return (
        <div>
            <Label className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-300">{label}</Label>
            <Select
                value={value || 'all'}
                onValueChange={onChange}
                allowCustom={allowCustom}
                customOptionLabel={(text) => `Use "${text}"`}
                onCreateOption={onChange}
            >
                <SelectTrigger className="mt-1">
                    <SelectValue displayValue={selectedLabel} />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {options.map(option => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}

function getFilterConfig(reportType) {
    const filters = [];

    if (['sales', 'billing', 'invoice_receipt'].includes(reportType)) {
        filters.push({ key: 'payment_method', label: 'Payment Method', options: PAYMENT_METHODS });
    }

    if (['service_utilization', 'appointment'].includes(reportType)) {
        filters.push({ key: 'service_type', label: 'Service Type', options: SERVICE_TYPES });
    }

    if (reportType === 'appointment') {
        filters.push({ key: 'appointment_status', label: 'Appointment Status', options: APPOINTMENT_STATUSES });
    }

    if (reportType === 'queue') {
        filters.push({ key: 'queue_status', label: 'Queue Status', options: QUEUE_STATUSES });
    }

    if (reportType === 'consultation') {
        filters.push({ key: 'consultation_type', label: 'Consultation Type', options: CONSULTATION_TYPES });
    }

    if (['inventory_status', 'stock_movement', 'medicine_product_sales'].includes(reportType)) {
        filters.push({ key: 'inventory_category', label: 'Inventory Category', options: INVENTORY_CATEGORIES, allowCustom: true });
    }

    if (reportType === 'inventory_status') {
        filters.push({ key: 'stock_status', label: 'Stock Status', options: STOCK_STATUSES });
    }

    if (reportType === 'categorized_pet_cases') {
        filters.push({ key: 'pet_type', label: 'Animal Type', options: PET_TYPES, allowCustom: true });
    }

    return filters;
}

export default function SuperAdminReportCenter() {
    const user = useDashboardUser();
    const navigate = useNavigate();
    const [reportType, setReportType] = useState('sales');
    const [range, setRange] = useState('this_month');
    const [customStart, setCustomStart] = useState(defaultMonthStart);
    const [customEnd, setCustomEnd] = useState(defaultMonthEnd);
    const [filters, setFilters] = useState({});
    const [report, setReport] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const selectedReportLabel = useMemo(() => (
        REPORT_TYPES.find(item => item.value === reportType)?.label || 'Sales Report'
    ), [reportType]);
    const selectedRangeLabel = useMemo(() => (
        REPORT_QUICK_RANGES.find(item => item.value === range)?.label || 'This Month'
    ), [range]);
    const visibleDateRange = useMemo(() => (
        range === 'custom'
            ? { start: customStart, end: customEnd }
            : quickRangeDates(range)
    ), [customEnd, customStart, range]);
    const handleCustomStartChange = (value) => {
        setRange('custom');
        setCustomStart(value);
    };
    const handleCustomEndChange = (value) => {
        setRange('custom');
        setCustomEnd(value);
    };
    const filterConfig = useMemo(() => getFilterConfig(reportType), [reportType]);

    const updateFilter = (key, value) => {
        setFilters(current => {
            const next = { ...current };
            if (!value || value === 'all') {
                delete next[key];
            } else {
                next[key] = value;
            }
            return next;
        });
    };

    const previewReport = async () => {
        if (!isSuperAdmin(user)) {
            setError('Only Super Admin accounts can generate reports.');
            return;
        }

        setIsLoading(true);
        setError('');

        if (range === 'custom' && (!customStart || !customEnd || customStart > customEnd)) {
            setError('Use a valid custom date range where Start is before or equal to End.');
            setIsLoading(false);
            return;
        }

        try {
            const response = await generateReport({
                user,
                report_type: reportType,
                range,
                start_date: range === 'custom' ? customStart : undefined,
                end_date: range === 'custom' ? customEnd : undefined,
                filters
            });
            setReport(response.report);
        } catch (requestError) {
            setError(requestError.message || 'Report could not be generated.');
        } finally {
            setIsLoading(false);
        }
    };

    if (!isSuperAdmin(user)) {
        return (
            <div className="rounded-xl border border-red-200 bg-red-50 p-6">
                <h1 className="text-xl font-black text-red-900">Reports are restricted</h1>
                <p className="mt-2 text-sm font-semibold text-red-700">Only Super Admin accounts can open the Report Export & Print Center.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <style>
                {`@media print {
                    body * { visibility: hidden !important; }
                    .report-print-area, .report-print-area * { visibility: visible !important; }
                    .report-print-area { position: absolute !important; inset: 0 auto auto 0 !important; width: 100% !important; }
                    .report-print-hidden { display: none !important; }
                    table { page-break-inside: auto; }
                    tr { page-break-inside: avoid; page-break-after: auto; }
                }`}
            </style>

            <div className="report-print-hidden">
                <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <h1 className="text-2xl font-black text-slate-950 dark:text-white">Report Export & Print Center</h1>
                        <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-slate-500 dark:text-slate-300">
                            Generate detailed table reports, preview the output, print clean copies, and export CSV files.
                        </p>
                    </div>
                    <Button type="button" variant="outline" onClick={() => navigate('/dashboard/reports')} className="gap-2 self-start lg:self-auto">
                        <ArrowLeft className="size-4" />
                        Reports Dashboard
                    </Button>
                </div>

                <Card className="border-slate-200 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                    <CardContent className="space-y-5 p-5">
                        <div className="grid gap-4 lg:grid-cols-[minmax(16rem,1fr)]">
                            <div>
                                <Label className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-300">Report Type</Label>
                                <Select
                                    value={reportType}
                                    onValueChange={(value) => {
                                        setReportType(value);
                                        setFilters({});
                                        setReport(null);
                                    }}
                                >
                                    <SelectTrigger className="mt-1">
                                        <SelectValue displayValue={selectedReportLabel} />
                                    </SelectTrigger>
                                    <SelectContent className="max-w-[28rem]">
                                        {REPORT_TYPES.map(item => (
                                            <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid gap-3 rounded-xl border border-slate-200 bg-white/90 p-3 shadow-sm dark:border-slate-700 dark:bg-slate-950/70 sm:grid-cols-2 xl:grid-cols-[minmax(12rem,14rem)_minmax(11.5rem,12.5rem)_minmax(11.5rem,12.5rem)_auto]">
                            <div>
                                <Label className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-300">Date Range</Label>
                                <Select value={range} onValueChange={setRange}>
                                    <SelectTrigger className="mt-1">
                                        <SelectValue displayValue={selectedRangeLabel} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {REPORT_QUICK_RANGES.map(item => (
                                            <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <ReportDateInput
                                label="Start"
                                value={visibleDateRange.start}
                                onChange={handleCustomStartChange}
                            />

                            <ReportDateInput
                                label="End"
                                value={visibleDateRange.end}
                                onChange={handleCustomEndChange}
                            />

                            <div className="flex flex-wrap items-end gap-2 sm:col-span-2 xl:col-span-1">
                                <Button type="button" onClick={previewReport} disabled={isLoading} className="gap-2">
                                    {isLoading ? <Loader2 className="size-7 animate-spin" /> : <Search className="size-4" />}
                                    Preview Report
                                </Button>
                                <Button type="button" variant="outline" onClick={() => window.print()} disabled={!report} className="gap-2">
                                    <Printer className="size-4" />
                                    Print Report
                                </Button>
                            </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                            {filterConfig.length ? filterConfig.map(filter => (
                                <FilterSelect
                                    key={filter.key}
                                    label={filter.label}
                                    value={filters[filter.key] || ''}
                                    onChange={(value) => updateFilter(filter.key, value)}
                                    options={filter.options}
                                    allowCustom={filter.allowCustom}
                                />
                            )) : (
                                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                    No extra filters are needed for this report.
                                </div>
                            )}

                            {['consultation', 'follow_up', 'veterinarian_activity'].includes(reportType) ? (
                                <div>
                                    <Label className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-300">Veterinarian ID</Label>
                                    <Input
                                        value={filters.veterinarian || ''}
                                        onChange={(event) => updateFilter('veterinarian', event.target.value)}
                                        placeholder="Optional vet user ID"
                                        className="mt-1"
                                    />
                                </div>
                            ) : null}
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <Button type="button" variant="outline" onClick={() => exportReportCsv(report)} disabled={!report} className="gap-2">
                                <Download className="size-4" />
                                Export CSV
                            </Button>
                            <Button type="button" variant="outline" disabled className="gap-2">
                                <FileText className="size-4" />
                                Export PDF
                            </Button>
                            <Button type="button" variant="outline" disabled className="gap-2">
                                <FileSpreadsheet className="size-4" />
                                Export Excel
                            </Button>
                            <p className="flex items-center text-xs font-semibold text-slate-500 dark:text-slate-300">
                                PDF/Excel export can be added after dependency setup.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {error ? (
                    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">{error}</div>
                ) : null}
            </div>

            {isLoading && !report ? (
                <div className="flex min-h-[18rem] items-center justify-center rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
                    <Loader2 className="size-8 animate-spin text-[#155dfc]" />
                </div>
            ) : (
                <ReportPreview report={report} />
            )}
        </div>
    );
}
