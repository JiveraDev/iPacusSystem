import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { AlertTriangle, BarChart3, CalendarClock, ChevronLeft, ChevronRight, FileText, Loader2, PackageSearch, RefreshCw } from 'lucide-react';
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
import DashboardPageHeader from '../shared/DashboardPageHeader';
import ReportChartCard from './ReportChartCard';
import ReportDateInput from './ReportDateInput';
import ReportKpiCard from './ReportKpiCard';

gsap.registerPlugin(useGSAP);

const GENERAL_CHART_IDS = [
    'revenue_diagnosis_trend',
    'sales_trend',
    'revenue_breakdown',
    'queue_booking_trend',
    'appointment_status',
    'online_appointment_trend',
    'consultation_type',
    'boarding_trend',
    'service_utilization',
    'medicine_product_sales',
    'veterinarian_activity',
    'animal_distribution',
    'billing_mix',
    'inventory_alerts'
];
const CHART_ROTATION_MS = 15000;

const KPI_CHART_TARGETS = {
    'Total Sales': 'revenue_diagnosis_trend',
    'Total Appointments': 'queue_booking_trend',
    'Completed Appointments': 'queue_booking_trend',
    'Missed / Rescheduled': 'queue_booking_trend',
    'Total Queue Visits': 'queue_booking_trend',
    'Total Consultations': 'consultation_type',
    'Online Consultations': 'consultation_type',
    'Clinic Visits': 'revenue_diagnosis_trend'
};

const KPI_TABLE_TARGETS = {
    'Restocking Needed': 'report-table-inventory-attention',
    'Near Expiry Items': 'report-table-inventory-attention'
};

const KPI_ROUTE_TARGETS = {
    'Consent Forms': '/dashboard/consent'
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

function adjacentChartId(ids, currentId, direction) {
    if (!ids.length) return currentId;
    const index = ids.indexOf(currentId);
    return ids[((index < 0 ? 0 : index) + direction + ids.length) % ids.length];
}

function ChartNavigation({ label, onPrevious, onNext, disabled = false }) {
    return (
        <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800" aria-label={`${label} navigation`}>
            <Button type="button" variant="ghost" size="icon" className="size-8 rounded-md active:scale-[0.96] dark:text-slate-100 dark:hover:bg-slate-700" onClick={onPrevious} disabled={disabled} aria-label={`Previous ${label}`}>
                <ChevronLeft className="size-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="size-8 rounded-md active:scale-[0.96] dark:text-slate-100 dark:hover:bg-slate-700" onClick={onNext} disabled={disabled} aria-label={`Next ${label}`}>
                <ChevronRight className="size-4" />
            </Button>
        </div>
    );
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

function routeTargetForKpi(label) {
    return KPI_ROUTE_TARGETS[String(label || '').trim()] || '';
}

function attentionTableTargetId(title) {
    const normalizedTitle = String(title || '').toLowerCase();

    if (normalizedTitle.includes('inventory')) {
        return 'report-table-inventory-attention';
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

    if (normalizedTitle.includes('inventory')) {
        return {
            icon: PackageSearch,
            label: 'Stock',
            accentClass: 'border-l-red-400',
            iconClass: 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-200',
            emptyTitle: 'Inventory is clear',
            emptyText: 'No low-stock, out-of-stock, expired, or near-expiry items are in this range.'
        };
    }

    return {
        icon: CalendarClock,
        label: 'Follow-up',
        accentClass: 'border-l-blue-400',
        iconClass: 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200',
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
        return 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/70 dark:bg-red-500/15 dark:text-red-200';
    }

    if (['near_expiry', 'low_stock', 'partial', 'pending', 'unpaid'].includes(status)) {
        return 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/70 dark:bg-amber-500/15 dark:text-amber-200';
    }

    if (['paid', 'completed', 'done', 'ok', 'sent'].includes(status)) {
        return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-500/15 dark:text-emerald-200';
    }

    return 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200';
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
    const rootRef = useRef(null);
    const highlightTimerRef = useRef(null);
    const [range, setRange] = useState('this_month');
    const [customStart, setCustomStart] = useState(defaultMonthStart);
    const [customEnd, setCustomEnd] = useState(defaultMonthEnd);
    const [dashboard, setDashboard] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [highlightedTargetId, setHighlightedTargetId] = useState('');
    const [selectedKpiLabel, setSelectedKpiLabel] = useState('Total Sales');
    const [selectedTrendId, setSelectedTrendId] = useState('revenue_diagnosis_trend');
    const [selectedMixId, setSelectedMixId] = useState('animal_distribution');
    const [trendRotationReset, setTrendRotationReset] = useState(0);
    const [mixRotationReset, setMixRotationReset] = useState(0);

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

    useGSAP(() => {
        if (!dashboard) return;

        const items = gsap.utils.toArray('.report-motion-item');
        const kpiItems = gsap.utils.toArray('[data-report-kpi-item]');
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            gsap.set([...items, ...kpiItems], { autoAlpha: 1, clearProps: 'transform' });
            return;
        }

        const entrance = gsap.timeline();
        entrance.fromTo(items, {
            autoAlpha: 0,
            y: 8,
        }, {
            autoAlpha: 1,
            y: 0,
            duration: 0.24,
            stagger: 0.03,
            ease: 'power3.out',
            clearProps: 'transform,opacity,visibility',
        });
        entrance.fromTo(kpiItems, {
            autoAlpha: 0,
            y: 6,
            scale: 0.985,
        }, {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            duration: 0.22,
            stagger: 0.02,
            ease: 'power3.out',
            clearProps: 'transform,opacity,visibility',
        }, 0.05);
    }, { scope: rootRef, dependencies: [Boolean(dashboard)], revertOnUpdate: true });

    const charts = useMemo(() => {
        const chartItems = Array.isArray(dashboard?.charts) ? dashboard.charts : [];
        return GENERAL_CHART_IDS
            .map(chartId => chartItems.find(item => item.id === chartId))
            .filter(Boolean);
    }, [dashboard]);
    const fullWidthCharts = useMemo(() => charts.filter(chartItem => !isPieChartItem(chartItem)), [charts]);
    const pieCharts = useMemo(() => charts.filter(isPieChartItem), [charts]);
    const trendChartIdsKey = fullWidthCharts.map((chartItem) => chartItem.id).join('|');
    const mixChartIdsKey = pieCharts.map((chartItem) => chartItem.id).join('|');
    const chartById = useMemo(() => new Map(charts.map(chartItem => [chartItem.id, chartItem])), [charts]);
    const activeTrendChart = fullWidthCharts.find((chartItem) => chartItem.id === selectedTrendId) || fullWidthCharts[0];
    const activeMixChart = pieCharts.find((chartItem) => chartItem.id === selectedMixId) || pieCharts[0];
    const attentionTables = (dashboard?.summary_tables || []).filter((table) => !String(table?.title || '').toLowerCase().includes('billing'));
    const openAttentionCount = attentionTables.reduce(
        (count, table) => count + (Array.isArray(table.rows) ? table.rows.length : 0),
        0
    );
    useEffect(() => {
        const ids = trendChartIdsKey ? trendChartIdsKey.split('|') : [];
        if (ids.length < 2) return undefined;

        const timer = window.setInterval(() => {
            if (document.hidden) return;
            setSelectedTrendId((currentId) => ids[(ids.indexOf(currentId) + 1) % ids.length]);
            setSelectedKpiLabel((currentLabel) => ids.includes(KPI_CHART_TARGETS[currentLabel]) ? '' : currentLabel);
        }, CHART_ROTATION_MS);

        return () => window.clearInterval(timer);
    }, [selectedTrendId, trendChartIdsKey, trendRotationReset]);

    useEffect(() => {
        const ids = mixChartIdsKey ? mixChartIdsKey.split('|') : [];
        if (ids.length < 2) return undefined;

        const timer = window.setInterval(() => {
            if (document.hidden) return;
            setSelectedMixId((currentId) => ids[(ids.indexOf(currentId) + 1) % ids.length]);
            setSelectedKpiLabel((currentLabel) => ids.includes(KPI_CHART_TARGETS[currentLabel]) ? '' : currentLabel);
        }, CHART_ROTATION_MS);

        return () => window.clearInterval(timer);
    }, [mixChartIdsKey, mixRotationReset, selectedMixId]);
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
            behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
        });

        if (highlightTimerRef.current) {
            window.clearTimeout(highlightTimerRef.current);
        }

        highlightTimerRef.current = window.setTimeout(() => {
            setHighlightedTargetId('');
            highlightTimerRef.current = null;
        }, 1600);
    }, []);
    const selectChart = (chartItem, kpiLabel) => {
        if (!chartItem) return;
        setSelectedKpiLabel(kpiLabel);
        const isMix = isPieChartItem(chartItem);
        if (isMix) {
            setSelectedMixId(chartItem.id);
            setMixRotationReset((count) => count + 1);
        } else {
            setSelectedTrendId(chartItem.id);
            setTrendRotationReset((count) => count + 1);
        }
    };
    const moveChart = (kind, direction) => {
        const isMix = kind === 'mix';
        const ids = (isMix ? mixChartIdsKey : trendChartIdsKey).split('|').filter(Boolean);
        if (ids.length < 2) return;
        if (isMix) {
            setSelectedMixId((currentId) => adjacentChartId(ids, currentId, direction));
            setMixRotationReset((count) => count + 1);
        } else {
            setSelectedTrendId((currentId) => adjacentChartId(ids, currentId, direction));
            setTrendRotationReset((count) => count + 1);
        }
        setSelectedKpiLabel('');
    };
    if (!isSuperAdmin(user)) {
        return (
            <div className="rounded-xl border border-red-200 bg-red-50 p-6">
                <h1 className="text-xl font-black text-red-900">Reports are restricted</h1>
                <p className="mt-2 text-sm font-semibold text-red-700">Only Super Admin accounts can open the reports dashboard.</p>
            </div>
        );
    }

    return (
        <div ref={rootRef} className="mx-auto max-w-[1800px] space-y-4">
            <div className="report-motion-item">
                <DashboardPageHeader
                    title="Reports Dashboard"
                    description="Track clinic performance, patient activity, service demand, and inventory health."
                    icon={BarChart3}
                    layout="stacked"
                    petHover={false}
                    className="h-full overflow-hidden"
                    toolbar={(
                        <div className="flex w-full flex-col gap-3 border-t border-slate-100 pt-4 dark:border-slate-800 lg:flex-row lg:items-end lg:justify-between">
                            <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-3 lg:grid-cols-[minmax(11rem,13rem)_minmax(10rem,11rem)_minmax(10rem,11rem)]">
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
                            </div>
                            <div className="flex shrink-0 items-end justify-end gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    onClick={() => loadDashboard()}
                                    disabled={isLoading}
                                    className="size-10 shrink-0 active:scale-[0.96] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                                    aria-label="Refresh reports dashboard"
                                    title="Refresh reports dashboard"
                                >
                                    {isLoading ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" /> : <RefreshCw className="size-4" />}
                                </Button>
                                <Button type="button" onClick={() => navigate('/dashboard/reports/export')} className="h-10 flex-1 justify-center gap-2 whitespace-nowrap bg-[#155dfc] px-3 text-white active:scale-[0.97] hover:bg-[#0d4acf] sm:flex-none">
                                    <FileText className="size-4" />
                                    Report Center
                                </Button>
                            </div>
                        </div>
                    )}
                />
            </div>

            {error ? (
                <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800 dark:border-red-900/70 dark:bg-red-950/35 dark:text-red-200">{error}</div>
            ) : null}

            {isLoading && !dashboard ? (
                <div role="status" aria-label="Loading reports dashboard" className="flex min-h-[22rem] items-center justify-center rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
                    <Loader2 className="size-8 animate-spin text-blue-700 motion-reduce:animate-none dark:text-blue-300" />
                </div>
            ) : (
                <>
                    <div
                        role="list"
                        aria-label="Report key metrics"
                        className="report-motion-item grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                    >
                        {(dashboard?.kpis || []).map(kpi => {
                            const targetChartId = chartTargetForKpi(kpi.label, chartById);
                            const targetChart = targetChartId ? chartById.get(targetChartId) : null;
                            const targetTableId = tableTargetForKpi(kpi.label);
                            const targetRoute = routeTargetForKpi(kpi.label);
                            const targetTitle = targetChart?.title || (targetTableId ? 'Inventory Attention' : targetRoute ? 'Consent Files' : undefined);

                            return (
                                <div key={kpi.label} role="listitem" data-report-kpi-item className="min-w-0">
                                    <ReportKpiCard
                                        {...kpi}
                                        isSelected={selectedKpiLabel === kpi.label}
                                        targetTitle={targetTitle}
                                        onSelectChart={targetChart
                                            ? () => selectChart(targetChart, kpi.label)
                                            : targetTableId
                                                ? () => { setSelectedKpiLabel(kpi.label); scrollToTarget(targetTableId); }
                                                : targetRoute
                                                    ? () => navigate(targetRoute)
                                                    : undefined}
                                    />
                                </div>
                            );
                        })}
                    </div>

                    {Array.isArray(dashboard?.missing_data) && dashboard.missing_data.length ? (
                        <Card petHover={false} className="report-motion-item border-amber-200 bg-amber-50 shadow-none dark:border-amber-900/70 dark:bg-amber-950/30">
                            <CardContent className="flex gap-3 p-4 text-sm font-semibold leading-6 text-amber-900 dark:text-amber-100">
                                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-700 dark:text-amber-300" />
                                <div className="min-w-0">
                                    <p className="font-black">Some report data is unavailable</p>
                                    {dashboard.missing_data.slice(0, 4).map((note, index) => (
                                        <p key={`${note}-${index}`} className="font-semibold text-amber-800 dark:text-amber-200">{note}</p>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    ) : null}

                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(360px,1fr)] xl:items-stretch">
                        {activeTrendChart ? (
                            <section id="report-chart-trend" className={`report-motion-item min-w-0 scroll-mt-24 rounded-xl transition-shadow duration-200 ${highlightedTargetId === 'report-chart-trend' ? 'ring-4 ring-blue-500/30 ring-offset-2 ring-offset-white dark:ring-offset-slate-950' : ''}`} aria-label="Trend charts">
                                <div key={`${activeTrendChart.id}:${dashboard?.date_range?.start_date || ''}:${dashboard?.date_range?.end_date || ''}`} className="report-chart-switch">
                                    <ReportChartCard
                                        title={activeTrendChart.title}
                                        chart={activeTrendChart.chart}
                                        compact
                                        stableHeight
                                        eyebrow="Trends & performance"
                                        actions={<ChartNavigation label="trend graph" onPrevious={() => moveChart('trend', -1)} onNext={() => moveChart('trend', 1)} disabled={fullWidthCharts.length < 2} />}
                                    />
                                </div>
                            </section>
                        ) : null}

                        {activeMixChart ? (
                            <section id="report-chart-mix" className={`report-motion-item min-w-0 scroll-mt-24 rounded-xl transition-shadow duration-200 ${highlightedTargetId === 'report-chart-mix' ? 'ring-4 ring-blue-500/30 ring-offset-2 ring-offset-white dark:ring-offset-slate-950' : ''}`} aria-label="Distribution charts">
                                <div key={`${activeMixChart.id}:${dashboard?.date_range?.start_date || ''}:${dashboard?.date_range?.end_date || ''}`} className="report-chart-switch">
                                    <ReportChartCard
                                        title={activeMixChart.title}
                                        chart={activeMixChart.chart}
                                        compact
                                        stableHeight
                                        eyebrow="Distribution & mix"
                                        actions={<ChartNavigation label="distribution graph" onPrevious={() => moveChart('mix', -1)} onNext={() => moveChart('mix', 1)} disabled={pieCharts.length < 2} />}
                                    />
                                </div>
                            </section>
                        ) : null}
                    </div>

                    <section className="report-motion-item space-y-3">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-start gap-3">
                                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200">
                                    <PackageSearch className="size-4" />
                                </div>
                                <div className="min-w-0">
                                    <h2 className="text-base font-black text-slate-950 dark:text-white">Operational attention</h2>
                                    <p className="mt-0.5 text-sm font-semibold leading-5 text-slate-500 dark:text-slate-300">Stock records that need review.</p>
                                </div>
                            </div>
                            <Badge className="shrink-0 border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                                <span className="sm:hidden">{openAttentionCount} open</span>
                                <span className="hidden sm:inline">{pluralize(openAttentionCount, 'open item')}</span>
                            </Badge>
                        </div>
                        <div className="grid gap-4">
                            {attentionTables.map(table => {
                                const targetId = attentionTableTargetId(table?.title);

                                return (
                                    <div
                                        key={table.title}
                                        id={targetId}
                                        className={`scroll-mt-24 rounded-xl transition-shadow duration-200 ${
                                            highlightedTargetId === targetId
                                                ? 'ring-4 ring-blue-500/30 ring-offset-2 ring-offset-white dark:ring-offset-slate-950'
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
    const rows = allRows;
    const columns = Array.isArray(table?.columns) ? table.columns : [];
    const config = getAttentionConfig(table?.title);
    const Icon = config.icon;
    const canOpenInventoryRows = isInventoryAttentionTable(table?.title);
    const primaryColumn = columns.find(column => !isStatusColumn(column)) || columns[0];
    const supportingColumns = columns.filter(column => column.key !== primaryColumn?.key && !isStatusColumn(column));
    const statusColumns = columns.filter(isStatusColumn);

    const openInventoryRow = (row) => {
        if (!canOpenInventoryRows || !queueInventoryItemSelection(row)) {
            return;
        }

        navigate('/dashboard/inventory');
    };

    return (
        <div className={`overflow-hidden rounded-xl border border-slate-200 border-l-4 ${config.accentClass} bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900`}>
            <div className="flex flex-col gap-3 border-b border-slate-100 p-4 dark:border-slate-800 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                    <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${config.iconClass}`}>
                        <Icon className="size-4" />
                    </div>
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <h3 className="break-words text-base font-black text-slate-950 dark:text-white">{table?.title}</h3>
                            <Badge className="border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">{config.label}</Badge>
                        </div>
                        <p className="mt-1 text-sm font-semibold leading-5 text-slate-500 dark:text-slate-300">
                            {rows.length ? 'Review these records before closing the operating day.' : config.emptyText}
                        </p>
                    </div>
                </div>
                <Badge className={`${rows.length ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/70 dark:bg-amber-500/15 dark:text-amber-200' : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-500/15 dark:text-emerald-200'} self-start shrink-0 sm:self-auto`}>
                    {allRows.length ? pluralize(allRows.length, 'item') : 'Clear'}
                </Badge>
            </div>

            {rows.length && columns.length ? (
                <>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800 sm:hidden">
                        {rows.map((row, rowIndex) => {
                            const isInteractiveRow = canOpenInventoryRows && Boolean(row.item_id || row.itemId || row.id);
                            const MobileRow = isInteractiveRow ? 'button' : 'div';
                            const rowKey = row.id || row.visit_id || row.item_id || row.request_id || `${table?.title}-${rowIndex}`;
                            const primaryValue = formatAttentionValue(row[primaryColumn?.key], primaryColumn);

                            return (
                                <MobileRow
                                    key={rowKey}
                                    type={isInteractiveRow ? 'button' : undefined}
                                    onClick={isInteractiveRow ? () => openInventoryRow(row) : undefined}
                                    aria-label={isInteractiveRow ? `Open ${primaryValue} in inventory` : undefined}
                                    className={`flex w-full items-start gap-3 px-4 py-3 text-left ${isInteractiveRow ? 'transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 dark:hover:bg-slate-800/70' : ''}`}
                                >
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[10px] font-black uppercase tracking-wide text-slate-400 dark:text-slate-500">{primaryColumn?.label || 'Record'}</p>
                                        <p className={`${isCurrencyColumn(primaryColumn) ? 'font-black' : 'font-bold'} mt-1 break-words text-sm leading-5 text-slate-950 dark:text-white`}>
                                            {primaryValue}
                                        </p>
                                        {supportingColumns.length ? (
                                            <dl className="mt-2 grid gap-2">
                                                {supportingColumns.map(column => (
                                                    <div key={column.key} className="min-w-0">
                                                        <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">{column.label}</dt>
                                                        <dd className="mt-0.5 break-words text-xs font-semibold text-slate-600 dark:text-slate-300">{formatAttentionValue(row[column.key], column)}</dd>
                                                    </div>
                                                ))}
                                            </dl>
                                        ) : null}
                                    </div>
                                    <div className="flex shrink-0 items-center gap-2 pt-0.5">
                                        <div className="flex flex-col items-end gap-1.5">
                                            {statusColumns.map(column => (
                                                <Badge key={column.key} className={`${statusBadgeClass(row[column.key])} max-w-[9rem]`}>
                                                    <span className="truncate">{humanizeValue(row[column.key] || 'N/A')}</span>
                                                </Badge>
                                            ))}
                                        </div>
                                        {isInteractiveRow ? <ChevronRight className="size-4 text-slate-400" aria-hidden="true" /> : null}
                                    </div>
                                </MobileRow>
                            );
                        })}
                    </div>

                    <div className="hidden max-h-[23.5rem] overflow-auto sm:block">
                        <table className="min-w-full text-left text-sm">
                            <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500 shadow-[0_1px_0_0_rgb(226_232_240)] dark:bg-slate-800 dark:text-slate-300 dark:shadow-[0_1px_0_0_rgb(51_65_85)]">
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
                                            className={`h-12 align-middle transition-colors duration-150 hover:bg-slate-50/70 dark:hover:bg-slate-800/70 ${isInteractiveRow ? 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 focus-within:bg-blue-50 dark:focus-within:bg-slate-800' : ''}`}
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
                                                <td key={column.key} className="max-w-[14rem] px-3 py-2 text-slate-700 dark:text-slate-200">
                                                    {isStatusColumn(column) ? (
                                                        <Badge className={`${statusBadgeClass(row[column.key])} max-w-full`}>
                                                            <span className="truncate">{humanizeValue(row[column.key] || 'N/A')}</span>
                                                        </Badge>
                                                    ) : (
                                                        <span className={`${isCurrencyColumn(column) ? 'font-black text-slate-950 dark:text-white' : ''} block truncate`}>
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
                </>
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
