import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CalendarClock, FileText, Loader2, PackageSearch, ReceiptText, RefreshCw, Users } from 'lucide-react';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Card, CardContent } from '../../ui/card';
import { Label } from '../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { useDashboardUser, useNavigate } from '../dashboardRouter.jsx';
import { fetchReportsDashboard, REPORT_QUICK_RANGES } from '../../services/reportService';
import { formatPhpCurrency } from '../../lib/currency';
import { formatReportDateLabel } from '../../lib/date';
import ReportChartCard from './ReportChartCard';
import ReportDateInput from './ReportDateInput';
import ReportKpiCard from './ReportKpiCard';

const GENERAL_CHART_IDS = [
    'revenue_diagnosis_trend',
    'queue_booking_trend',
    'online_appointment_trend',
    'boarding_trend',
    'service_utilization',
    'animal_distribution',
    'revenue_breakdown',
    'inventory_alerts'
];

const KPI_CHART_TARGETS = {
    'Total Sales': 'revenue_diagnosis_trend',
    'Total Paid Amount': 'revenue_breakdown',
    'Total Appointments': 'queue_booking_trend',
    'Completed Appointments': 'queue_booking_trend',
    'Missed / Rescheduled': 'queue_booking_trend',
    'Total Queue Visits': 'queue_booking_trend',
    'Total Consultations': 'consultation_type',
    'Online Consultations': 'consultation_type',
    'Clinic Visits': 'revenue_diagnosis_trend'
};

const KPI_TABLE_TARGETS = {
    'Total Unpaid Balance': 'report-table-billing-attention',
    'Restocking Needed': 'report-table-inventory-attention',
    'Near Expiry Items': 'report-table-inventory-attention'
};

function normalizeRole(role) {
    return String(role || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function isSuperAdmin(user) {
    return ['super_admin', 'superadmin'].includes(normalizeRole(user?.role));
}

function isPieChartItem(chartItem) {
    const chartType = String(chartItem?.chart?.type || '').trim().toLowerCase();
    return chartType === 'pie' || chartType === 'doughnut';
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

function humanizeValue(value) {
    const normalized = String(value || '').trim().toLowerCase();
    const labels = {
        out_of_stock: 'Out of Stock',
        low_stock: 'Low Stock',
        near_expiry: 'Near Expiry',
        expired: 'Expired',
        unpaid: 'Unpaid',
        partial: 'Partial',
        paid: 'Paid',
        pending: 'Pending',
        completed: 'Completed',
        done: 'Done',
        ok: 'OK'
    };

    if (labels[normalized]) {
        return labels[normalized];
    }

    return String(value || '')
        .replaceAll('_', ' ')
        .replaceAll('-', ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, letter => letter.toUpperCase());
}

function pluralize(count, singular, plural = `${singular}s`) {
    return `${count} ${count === 1 ? singular : plural}`;
}

function chartTargetForKpi(label, chartById) {
    const targetId = KPI_CHART_TARGETS[String(label || '').trim()];
    return targetId && chartById.has(targetId) ? targetId : '';
}

function tableTargetForKpi(label) {
    return KPI_TABLE_TARGETS[String(label || '').trim()] || '';
}

function attentionTableTargetId(title) {
    const normalizedTitle = String(title || '').toLowerCase();

    if (normalizedTitle.includes('inventory')) {
        return 'report-table-inventory-attention';
    }

    if (normalizedTitle.includes('billing')) {
        return 'report-table-billing-attention';
    }

    return 'report-table-operational-attention';
}

function isInventoryAttentionTable(title) {
    return String(title || '').toLowerCase().includes('inventory');
}

function queueInventoryItemSelection(row) {
    const itemId = row?.item_id || row?.itemId || row?.id;

    if (!itemId) {
        return false;
    }

    try {
        sessionStorage.setItem('ipawcus-inventory-report-selection', JSON.stringify({
            itemId: String(itemId),
            itemName: row?.item_name || row?.name || '',
            source: 'reports'
        }));
    } catch {
        return false;
    }

    return true;
}

function getAttentionConfig(title) {
    const normalizedTitle = String(title || '').toLowerCase();

    if (normalizedTitle.includes('billing')) {
        return {
            icon: ReceiptText,
            label: 'Billing',
            accentClass: 'border-l-amber-400',
            iconClass: 'bg-amber-50 text-amber-700',
            emptyTitle: 'No pending billing',
            emptyText: 'All visible visits are paid or outside the selected date range.'
        };
    }

    if (normalizedTitle.includes('inventory')) {
        return {
            icon: PackageSearch,
            label: 'Stock',
            accentClass: 'border-l-red-400',
            iconClass: 'bg-red-50 text-red-700',
            emptyTitle: 'Inventory is clear',
            emptyText: 'No low-stock, out-of-stock, expired, or near-expiry items are in this range.'
        };
    }

    return {
        icon: CalendarClock,
        label: 'Follow-up',
        accentClass: 'border-l-blue-400',
        iconClass: 'bg-blue-50 text-blue-700',
        emptyTitle: 'No follow-ups due',
        emptyText: 'There are no follow-up records needing attention for this date range.'
    };
}

function isDateColumn(column) {
    const key = String(column?.key || '').toLowerCase();

    return key.includes('date') || key.includes('expiry') || key.endsWith('_at') || key.endsWith('at');
}

function isCurrencyColumn(column) {
    const key = String(column?.key || '').toLowerCase();

    return ['total_bill', 'paid', 'balance', 'amount_paid', 'total_paid', 'total_sales'].includes(key)
        || key.includes('revenue')
        || key.includes('amount');
}

function isStatusColumn(column) {
    return String(column?.key || '').toLowerCase().includes('status');
}

function statusBadgeClass(value) {
    const status = String(value || '').toLowerCase();

    if (['out_of_stock', 'expired', 'cancelled', 'failed', 'overdue'].includes(status)) {
        return 'border-red-200 bg-red-50 text-red-700';
    }

    if (['near_expiry', 'low_stock', 'partial', 'pending', 'unpaid'].includes(status)) {
        return 'border-amber-200 bg-amber-50 text-amber-800';
    }

    if (['paid', 'completed', 'done', 'ok', 'sent'].includes(status)) {
        return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    }

    return 'border-slate-200 bg-slate-50 text-slate-700';
}

function formatAttentionValue(value, column) {
    if (value === null || value === undefined || value === '') {
        return 'N/A';
    }

    if (isDateColumn(column)) {
        return formatReportDateLabel(value, { fallback: 'N/A' });
    }

    if (isCurrencyColumn(column)) {
        return formatPhpCurrency(value);
    }

    if (typeof value === 'number') {
        return Number.isInteger(value) ? String(value) : value.toLocaleString('en-US', { maximumFractionDigits: 2 });
    }

    if (Array.isArray(value)) {
        return value.join(', ');
    }

    if (typeof value === 'object') {
        return JSON.stringify(value);
    }

    return String(value);
}

export default function SuperAdminReportsDashboard() {
    const user = useDashboardUser();
    const navigate = useNavigate();
    const highlightTimerRef = useRef(null);
    const [range, setRange] = useState('this_month');
    const [customStart, setCustomStart] = useState(defaultMonthStart);
    const [customEnd, setCustomEnd] = useState(defaultMonthEnd);
    const [dashboard, setDashboard] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [highlightedTargetId, setHighlightedTargetId] = useState('');

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

    const loadDashboard = useCallback(async ({ isAutoRefresh = false } = {}) => {
        if (!isSuperAdmin(user)) {
            setIsLoading(false);
            return;
        }

        if (range === 'custom' && (!customStart || !customEnd || customStart > customEnd)) {
            setError('Use a valid custom date range where Start is before or equal to End.');
            setIsLoading(false);
            return;
        }

        if (!isAutoRefresh) {
            setIsLoading(true);
        }
        setError('');

        try {
            const data = await fetchReportsDashboard({
                user,
                range,
                startDate: range === 'custom' ? customStart : undefined,
                endDate: range === 'custom' ? customEnd : undefined
            });
            setDashboard(data);
        } catch (requestError) {
            setError(requestError.message || 'Reports dashboard could not be loaded.');
        } finally {
            setIsLoading(false);
        }
    }, [customEnd, customStart, range, user]);

    useAutoRefresh(loadDashboard, {
        enabled: isSuperAdmin(user),
        refreshKey: `${range}:${customStart}:${customEnd}`
    });

    useEffect(() => () => {
        if (highlightTimerRef.current) {
            window.clearTimeout(highlightTimerRef.current);
        }
    }, []);

    const charts = useMemo(() => {
        const chartItems = Array.isArray(dashboard?.charts) ? dashboard.charts : [];
        return GENERAL_CHART_IDS
            .map(chartId => chartItems.find(item => item.id === chartId))
            .filter(Boolean);
    }, [dashboard]);
    const fullWidthCharts = useMemo(() => charts.filter(chartItem => !isPieChartItem(chartItem)), [charts]);
    const pieCharts = useMemo(() => charts.filter(isPieChartItem), [charts]);
    const chartById = useMemo(() => new Map(charts.map(chartItem => [chartItem.id, chartItem])), [charts]);
    const scrollToTarget = useCallback((targetId) => {
        const target = document.getElementById(targetId);
        if (!target) {
            return;
        }

        setHighlightedTargetId(targetId);

        const headerOffset = 92;
        const top = target.getBoundingClientRect().top + window.scrollY - headerOffset;
        window.scrollTo({
            top: Math.max(top, 0),
            behavior: 'smooth'
        });

        if (highlightTimerRef.current) {
            window.clearTimeout(highlightTimerRef.current);
        }

        highlightTimerRef.current = window.setTimeout(() => {
            setHighlightedTargetId('');
            highlightTimerRef.current = null;
        }, 1600);
    }, []);

    if (!isSuperAdmin(user)) {
        return (
            <div className="rounded-xl border border-red-200 bg-red-50 p-6">
                <h1 className="text-xl font-black text-red-900">Reports are restricted</h1>
                <p className="mt-2 text-sm font-semibold text-red-700">Only Super Admin accounts can open the reports dashboard.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-[linear-gradient(135deg,#f8fbff_0%,#ffffff_44%,#f0fdf4_100%)] p-5 shadow-sm dark:border-slate-700 dark:bg-none dark:bg-slate-900">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-slate-950 dark:text-white">Reports Dashboard</h1>
                    <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">
                        Clinic performance, service activity, billing, inventory, and patient case overview
                    </p>
                </div>

                <div className="grid gap-3 rounded-xl border border-slate-200 bg-white/90 p-3 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-950/70 sm:grid-cols-2 xl:grid-cols-[minmax(12rem,14rem)_minmax(11.5rem,12.5rem)_minmax(11.5rem,12.5rem)_auto]">
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
                        <Button type="button" variant="outline" onClick={() => loadDashboard()} disabled={isLoading} className="gap-2">
                            {isLoading ? <Loader2 className="size-7 animate-spin" /> : <RefreshCw className="size-7" />}
                            Refresh
                        </Button>
                        <Button type="button" onClick={() => navigate('/dashboard/reports/export')} className="gap-2">
                            <FileText className="size-4" />
                            Report Center
                        </Button>
                    </div>
                </div>
            </div>
            </div>

            {error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">{error}</div>
            ) : null}

            {isLoading && !dashboard ? (
                <div className="flex min-h-[22rem] items-center justify-center rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
                    <Loader2 className="size-8 animate-spin text-[#155dfc]" />
                </div>
            ) : (
                <>
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        {(dashboard?.kpis || []).map(kpi => {
                            const targetChartId = chartTargetForKpi(kpi.label, chartById);
                            const targetChart = targetChartId ? chartById.get(targetChartId) : null;
                            const targetTableId = tableTargetForKpi(kpi.label);
                            const targetId = targetChart ? `report-chart-${targetChart.id}` : targetTableId;
                            const targetTitle = targetChart?.title || (
                                targetTableId === 'report-table-billing-attention'
                                    ? 'Pending Billing'
                                    : targetTableId ? 'Inventory Attention' : undefined
                            );

                            return (
                                <ReportKpiCard
                                    key={kpi.label}
                                    {...kpi}
                                    targetTitle={targetTitle}
                                    onSelectChart={targetId ? () => scrollToTarget(targetId) : undefined}
                                />
                            );
                        })}
                    </div>

                    {Array.isArray(dashboard?.missing_data) && dashboard.missing_data.length ? (
                        <Card className="border-amber-200 bg-amber-50 shadow-none">
                            <CardContent className="flex gap-3 p-4 text-sm font-semibold leading-6 text-amber-900">
                                <AlertTriangle className="mt-0.5 size-5 shrink-0" />
                                <div>
                                    {dashboard.missing_data.slice(0, 4).map((note, index) => (
                                        <p key={`${note}-${index}`}>{note}</p>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    ) : null}

                    {fullWidthCharts.length ? (
                        <section className="space-y-4">
                            <div>
                                <h2 className="text-lg font-black text-slate-950 dark:text-white">Movement, Revenue, and Utilization Charts</h2>
                                <p className="text-sm font-semibold text-slate-500 dark:text-slate-300">Line and bar charts span the full row for easier wide-screen reading.</p>
                            </div>
                            <div className="grid grid-cols-1 gap-4">
                                {fullWidthCharts.map(chartItem => (
                                    <div
                                        key={chartItem.id}
                                        id={`report-chart-${chartItem.id}`}
                                        className={`scroll-mt-24 rounded-xl transition duration-700 ${
                                            highlightedTargetId === `report-chart-${chartItem.id}`
                                                ? 'ring-4 ring-[#155dfc]/30 ring-offset-2 ring-offset-white dark:ring-offset-slate-950'
                                                : ''
                                        }`}
                                    >
                                        <ReportChartCard
                                            title={chartItem.title}
                                            summary={chartItem.summary}
                                            chart={chartItem.chart}
                                        />
                                    </div>
                                ))}
                            </div>
                        </section>
                    ) : null}

                    {pieCharts.length ? (
                        <section className="space-y-4">
                            <div>
                                <h2 className="text-lg font-black text-slate-950 dark:text-white">Service Mix and Clinic Resources</h2>
                                <p className="text-sm font-semibold text-slate-500 dark:text-slate-300">Pie and doughnut charts are grouped two per row on wider screens.</p>
                            </div>
                            <div className="grid gap-4 xl:grid-cols-2">
                                {pieCharts.map(chartItem => (
                                    <div
                                        key={chartItem.id}
                                        id={`report-chart-${chartItem.id}`}
                                        className={`scroll-mt-24 rounded-xl transition duration-700 ${
                                            highlightedTargetId === `report-chart-${chartItem.id}`
                                                ? 'ring-4 ring-[#155dfc]/30 ring-offset-2 ring-offset-white dark:ring-offset-slate-950'
                                                : ''
                                        }`}
                                    >
                                        <ReportChartCard
                                            title={chartItem.title}
                                            summary={chartItem.summary}
                                            chart={chartItem.chart}
                                        />
                                    </div>
                                ))}
                            </div>
                        </section>
                    ) : null}

                    <section className="space-y-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                            <div className="flex items-center gap-3">
                                <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">
                                    <Users className="size-5" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-black text-slate-950 dark:text-white">Operational Attention</h2>
                                    <p className="text-sm font-semibold text-slate-500 dark:text-slate-300">Billing and stock items that need review in the selected date range.</p>
                                </div>
                            </div>
                            <Badge className="border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                                {pluralize((dashboard?.summary_tables || []).reduce((count, table) => count + (Array.isArray(table.rows) ? table.rows.length : 0), 0), 'open item')}
                            </Badge>
                        </div>
                        <div className="grid gap-4 xl:grid-cols-2">
                            {(dashboard?.summary_tables || []).map(table => {
                                const targetId = attentionTableTargetId(table?.title);

                                return (
                                    <div
                                        key={table.title}
                                        id={targetId}
                                        className={`scroll-mt-24 rounded-xl transition duration-700 ${
                                            highlightedTargetId === targetId
                                                ? 'ring-4 ring-[#155dfc]/30 ring-offset-2 ring-offset-white dark:ring-offset-slate-950'
                                                : ''
                                        }`}
                                    >
                                        <OperationalAttentionCard table={table} />
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                </>
            )}
        </div>
    );
}

function OperationalAttentionCard({ table }) {
    const navigate = useNavigate();
    const allRows = Array.isArray(table?.rows) ? table.rows : [];
    const rows = allRows.slice(0, 5);
    const columns = Array.isArray(table?.columns) ? table.columns : [];
    const config = getAttentionConfig(table?.title);
    const Icon = config.icon;
    const canOpenInventoryRows = isInventoryAttentionTable(table?.title);

    const openInventoryRow = (row) => {
        if (!canOpenInventoryRows || !queueInventoryItemSelection(row)) {
            return;
        }

        navigate('/dashboard/inventory');
    };

    return (
        <div className={`overflow-hidden rounded-xl border border-slate-200 border-l-4 ${config.accentClass} bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900`}>
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-4 dark:border-slate-800">
                <div className="flex min-w-0 items-start gap-3">
                    <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${config.iconClass}`}>
                        <Icon className="size-4" />
                    </div>
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-base font-black text-slate-950 dark:text-white">{table?.title}</h3>
                            <Badge className="border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">{config.label}</Badge>
                        </div>
                        <p className="mt-1 text-sm font-semibold leading-5 text-slate-500 dark:text-slate-300">
                    {rows.length ? 'Review these records before closing the operating day.' : config.emptyText}
                        </p>
                    </div>
                </div>
                <Badge className={rows.length ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}>
                    {allRows.length ? pluralize(allRows.length, 'item') : 'Clear'}
                </Badge>
            </div>

            {rows.length && columns.length ? (
                <div className="overflow-x-auto scrollbar-hide">
                    <table className="min-w-full text-left text-sm">
                        <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                            <tr>
                                {columns.map(column => (
                                    <th key={column.key} className="whitespace-nowrap px-3 py-3 font-black">
                                        {column.label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {rows.map((row, rowIndex) => {
                                const isInteractiveRow = canOpenInventoryRows && Boolean(row.item_id || row.itemId || row.id);

                                return (
                                <tr
                                    key={row.id || row.visit_id || row.item_id || row.request_id || `${table?.title}-${rowIndex}`}
                                    className={`align-top hover:bg-slate-50/70 dark:hover:bg-slate-800/70 ${isInteractiveRow ? 'cursor-pointer focus-within:bg-blue-50/60 dark:focus-within:bg-slate-800' : ''}`}
                                    role={isInteractiveRow ? 'button' : undefined}
                                    tabIndex={isInteractiveRow ? 0 : undefined}
                                    onClick={() => openInventoryRow(row)}
                                    onKeyDown={(event) => {
                                        if (!isInteractiveRow) {
                                            return;
                                        }

                                        if (event.key === 'Enter' || event.key === ' ') {
                                            event.preventDefault();
                                            openInventoryRow(row);
                                        }
                                    }}
                                >
                                    {columns.map(column => (
                                        <td key={column.key} className="max-w-[14rem] px-3 py-3 text-slate-700 dark:text-slate-200">
                                            {isStatusColumn(column) ? (
                                                <Badge className={`${statusBadgeClass(row[column.key])} max-w-full`}>
                                                    <span className="truncate">{humanizeValue(row[column.key] || 'N/A')}</span>
                                                </Badge>
                                            ) : (
                                                <span className={`${isCurrencyColumn(column) ? 'font-black text-slate-950 dark:text-white' : ''} line-clamp-2`}>
                                                    {formatAttentionValue(row[column.key], column)}
                                                </span>
                                            )}
                                        </td>
                                    ))}
                                </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="flex min-h-36 items-center justify-center p-6 text-center">
                    <div>
                        <div className={`mx-auto flex size-10 items-center justify-center rounded-lg ${config.iconClass}`}>
                            <Icon className="size-5" />
                        </div>
                        <p className="mt-3 text-sm font-black text-slate-900 dark:text-white">{config.emptyTitle}</p>
                        <p className="mt-1 max-w-xs text-sm font-semibold leading-5 text-slate-500 dark:text-slate-300">{config.emptyText}</p>
                    </div>
                </div>
            )}
        </div>
    );
}
