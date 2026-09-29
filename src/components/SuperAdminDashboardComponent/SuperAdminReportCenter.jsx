import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, FileSpreadsheet, FileText, Loader2, Printer, Search } from 'lucide-react';
import { Button } from '../../ui/button';
import { Card, CardContent } from '../../ui/card';
import { Label } from '../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { useDashboardUser, useNavigate } from '../dashboardRouter.jsx';
import { generateReport, REPORT_QUICK_RANGES, REPORT_TYPES } from '../../services/reportService';
import DashboardPageHeader from '../shared/DashboardPageHeader';
import ReportDateInput from './ReportDateInput';
import ReportPreview from './ReportPreview';
import { fetchBranches, getBranchDisplayName } from '../../services/branchService';
import { exportReportExcel, exportReportPdf } from '../../lib/reportExport';
import { fetchVeterinarians } from '../../services/accountService';

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

function normalizeRole(role) {
    return String(role || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function isSuperAdmin(user) {
    return ['super_admin', 'superadmin'].includes(normalizeRole(user?.role));
}

function veterinarianId(veterinarian) {
    return String(veterinarian?.user_id || veterinarian?.userId || veterinarian?.id || '');
}

function veterinarianName(veterinarian) {
    const fullName = [
        veterinarian?.first_Name || veterinarian?.firstName,
        veterinarian?.last_Name || veterinarian?.lastName
    ].filter(Boolean).join(' ').trim();

    return fullName ? `Dr. ${fullName}` : veterinarian?.mail_Address || veterinarian?.email || 'Veterinarian';
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
        start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay());
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
    const [exportingFormat, setExportingFormat] = useState('');
    const [error, setError] = useState('');
    const [branches, setBranches] = useState([]);
    const [veterinarians, setVeterinarians] = useState([]);

    useEffect(() => {
        fetchBranches()
            .then(data => setBranches(Array.isArray(data?.branches) ? data.branches : []))
            .catch(requestError => console.error('Failed to load report branches:', requestError));
        fetchVeterinarians()
            .then(data => setVeterinarians(Array.isArray(data?.veterinarians) ? data.veterinarians : []))
            .catch(requestError => console.error('Failed to load report veterinarians:', requestError));
    }, []);

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

    const changeReportType = (value) => {
        setReportType(value);
        setFilters({});
        setReport(null);
        setError('');
    };

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
            const reportFilters = { ...filters };
            delete reportFilters.payment_method;
            const response = await generateReport({
                user,
                report_type: reportType,
                range,
                start_date: range === 'custom' ? customStart : undefined,
                end_date: range === 'custom' ? customEnd : undefined,
                filters: reportFilters
            });
            setReport(response.report);
        } catch (requestError) {
            setError(requestError.message || 'Report could not be generated.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleExport = async (format) => {
        if (!report || exportingFormat) return;

        setExportingFormat(format);
        setError('');
        try {
            if (format === 'pdf') {
                await exportReportPdf(report);
            } else {
                await exportReportExcel(report);
            }
        } catch (exportError) {
            console.error(`Failed to export ${format}:`, exportError);
            setError(`The ${format.toUpperCase()} file could not be generated. Please try again.`);
        } finally {
            setExportingFormat('');
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
        <div className="report-center-page space-y-6">
            <style>
                {`@media print {
                    @page { size: A4 portrait; margin: 10mm; }
                    html, body, #root {
                        width: 100% !important;
                        min-width: 0 !important;
                        max-width: none !important;
                        height: auto !important;
                        min-height: 0 !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        overflow: visible !important;
                        background: #ffffff !important;
                    }
                    body {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    body * { visibility: hidden !important; }
                    [data-slot="dashboard-mobile-header"],
                    [data-slot="dashboard-sidebar"] { display: none !important; }
                    [data-slot="dashboard-shell"],
                    [data-slot="dashboard-shell"] > div:last-of-type,
                    [data-slot="dashboard-shell"] > div:last-of-type > div:last-child,
                    [data-dashboard-content],
                    .report-center-page {
                        display: block !important;
                        position: static !important;
                        width: 100% !important;
                        min-width: 0 !important;
                        max-width: none !important;
                        height: auto !important;
                        min-height: 0 !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        overflow: visible !important;
                        transform: none !important;
                        background: #ffffff !important;
                    }
                    .report-print-area, .report-print-area * { visibility: visible !important; }
                    .report-print-area {
                        display: block !important;
                        position: static !important;
                        inset: auto !important;
                        box-sizing: border-box !important;
                        width: 100% !important;
                        min-width: 0 !important;
                        max-width: none !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        overflow: visible !important;
                        transform: none !important;
                        font-size: 9pt !important;
                        line-height: 1.35 !important;
                        background: #ffffff !important;
                        color: #0f172a !important;
                    }
                    .report-print-hidden { display: none !important; }
                    .report-standard-preview > .report-print-section.grid {
                        grid-template-columns: minmax(0, 1.35fr) minmax(0, 0.65fr) !important;
                    }
                    .report-print-section {
                        min-width: 0 !important;
                        max-width: 100% !important;
                        break-inside: avoid-page;
                        page-break-inside: avoid;
                    }
                    .report-table-wrap,
                    .report-print-area [class*="overflow-x-auto"] {
                        width: 100% !important;
                        min-width: 0 !important;
                        max-width: 100% !important;
                        overflow: visible !important;
                    }
                    .report-print-area table {
                        width: 100% !important;
                        min-width: 0 !important;
                        max-width: 100% !important;
                        table-layout: fixed !important;
                        border-collapse: collapse !important;
                        page-break-inside: auto;
                    }
                    .report-print-area thead { display: table-header-group !important; }
                    .report-print-area tfoot { display: table-footer-group !important; }
                    .report-print-area tr {
                        break-inside: avoid-page;
                        page-break-inside: avoid;
                        page-break-after: auto;
                    }
                    .report-print-area th,
                    .report-print-area td {
                        max-width: none !important;
                        padding: 5px !important;
                        white-space: normal !important;
                        overflow: visible !important;
                        overflow-wrap: anywhere !important;
                        word-break: break-word !important;
                        vertical-align: top !important;
                    }
                    .report-print-area .line-clamp-3 {
                        display: block !important;
                        overflow: visible !important;
                        -webkit-line-clamp: unset !important;
                    }
                }`}
            </style>

            <div className="report-print-hidden">
                <DashboardPageHeader
                    className="mb-4"
                    title="Report Export & Print Center"
                    description="Generate, preview, export, and print detailed clinic operational reports."
                    layout="stacked"
                    actions={(
                        <Button type="button" variant="outline" onClick={() => navigate('/dashboard/reports')} className="h-10 justify-center gap-2 whitespace-nowrap">
                            <ArrowLeft className="size-4" />
                            Reports Dashboard
                        </Button>
                    )}
                />

                <Card className="border-slate-200 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                    <CardContent className="space-y-5 p-5">
                        <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-950/60 sm:grid-cols-2 xl:grid-cols-[minmax(14rem,1fr)_minmax(11rem,13rem)_minmax(10rem,11rem)_minmax(10rem,11rem)_minmax(9rem,max-content)_minmax(9rem,max-content)] xl:items-end">
                            <div className="min-w-0">
                                <Label className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-300">Report Type</Label>
                                <Select
                                    value={reportType}
                                    onValueChange={changeReportType}
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

                            <div className="min-w-0">
                                <Label className="mb-1 block text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-300">Date Range</Label>
                                <Select value={range} onValueChange={setRange}>
                                    <SelectTrigger className="w-full">
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

                            <Button type="button" onClick={previewReport} disabled={isLoading} className="h-10 w-full justify-center gap-2 whitespace-nowrap bg-[#155dfc] px-3 text-white hover:bg-[#0d4acf]">
                                {isLoading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                                Preview Report
                            </Button>
                            <Button type="button" variant="outline" onClick={() => window.print()} disabled={!report} className="h-10 w-full justify-center gap-2 whitespace-nowrap px-3">
                                <Printer className="size-4" />
                                Print Report
                            </Button>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                            {reportType !== 'consent_form' && (
                                <div>
                                    <Label className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-300">Clinic Location</Label>
                                    <Select
                                        value={filters.branch_id || 'all'}
                                        onValueChange={(value) => {
                                            if (value === 'all') {
                                                setFilters(current => {
                                                    const next = { ...current };
                                                    delete next.branch_id;
                                                    delete next.branch_name;
                                                    return next;
                                                });
                                                return;
                                            }
                                            const branch = branches.find(item => String(item.id) === String(value));
                                            setFilters(current => ({
                                                ...current,
                                                branch_id: value,
                                                branch_name: branch?.name || value
                                            }));
                                        }}
                                    >
                                        <SelectTrigger className="mt-1">
                                            <SelectValue
                                                placeholder="All clinic locations"
                                                displayValue={!filters.branch_id
                                                    ? 'All clinic locations'
                                                    : getBranchDisplayName(branches, filters.branch_id)}
                                            />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All clinic locations</SelectItem>
                                            {branches.map(branch => (
                                                <SelectItem key={branch.id} value={String(branch.id)}>{branch.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
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
                                    <Label className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-300">Veterinarian</Label>
                                    <Select
                                        value={filters.veterinarian || 'all'}
                                        onValueChange={(value) => {
                                            if (value === 'all') {
                                                setFilters(current => {
                                                    const next = { ...current };
                                                    delete next.veterinarian;
                                                    delete next.veterinarian_name;
                                                    return next;
                                                });
                                                return;
                                            }

                                            const selectedVeterinarian = veterinarians.find(item => veterinarianId(item) === String(value));
                                            setFilters(current => ({
                                                ...current,
                                                veterinarian: value,
                                                veterinarian_name: veterinarianName(selectedVeterinarian)
                                            }));
                                        }}
                                    >
                                        <SelectTrigger className="mt-1">
                                            <SelectValue
                                                placeholder="All veterinarians"
                                                displayValue={!filters.veterinarian
                                                    ? 'All veterinarians'
                                                    : veterinarianName(veterinarians.find(item => veterinarianId(item) === String(filters.veterinarian)))}
                                            />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All veterinarians</SelectItem>
                                            {veterinarians.map(veterinarian => (
                                                <SelectItem key={veterinarianId(veterinarian)} value={veterinarianId(veterinarian)}>
                                                    {veterinarianName(veterinarian)}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            ) : null}
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <Button type="button" variant="outline" onClick={() => handleExport('pdf')} disabled={!report || Boolean(exportingFormat)} className="gap-2">
                                {exportingFormat === 'pdf' ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
                                {exportingFormat === 'pdf' ? 'Creating PDF...' : 'Export PDF'}
                            </Button>
                            <Button type="button" variant="outline" onClick={() => handleExport('excel')} disabled={!report || Boolean(exportingFormat)} className="gap-2">
                                {exportingFormat === 'excel' ? <Loader2 className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4" />}
                                {exportingFormat === 'excel' ? 'Creating Excel...' : 'Export Excel'}
                            </Button>
                            <p className="flex items-center text-xs font-semibold text-slate-500 dark:text-slate-300">
                                Files are created from the current report preview.
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
