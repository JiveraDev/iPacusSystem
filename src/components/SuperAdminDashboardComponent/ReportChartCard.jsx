import {
    ArcElement,
    BarElement,
    CategoryScale,
    Chart as ChartJS,
    Filler,
    Legend,
    LinearScale,
    LineElement,
    PointElement,
    Tooltip
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { X } from 'lucide-react';
import { Card, CardContent } from '../../ui/card';
import { Button } from '../../ui/button';
import { formatPhpCurrency } from '../../lib/currency';
import { formatReportDateLabel } from '../../lib/date';
import { useTheme } from '../../hooks/useTheme';

ChartJS.register(
    ArcElement,
    BarElement,
    CategoryScale,
    Filler,
    Legend,
    LinearScale,
    LineElement,
    PointElement,
    Tooltip
);
gsap.registerPlugin(useGSAP);

const palette = ['#155dfc', '#60a5fa', '#93c5fd', '#2563eb', '#7c3aed', '#0891b2', '#e9a23b', '#475569'];

function lineGradient(context, color) {
    const { chart } = context;
    const { ctx, chartArea } = chart;

    if (!chartArea) {
        return `${color}26`;
    }

    const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
    gradient.addColorStop(0, `${color}4d`);
    gradient.addColorStop(0.6, `${color}18`);
    gradient.addColorStop(1, `${color}00`);

    return gradient;
}

function hasChartData(chart) {
    return Array.isArray(chart?.labels)
        && chart.labels.length > 0
        && Array.isArray(chart?.datasets)
        && chart.datasets.some(dataset => Array.isArray(dataset.data) && dataset.data.some(value => Number(value) > 0));
}

function isWholeNumber(value) {
    const number = Number(value);

    return Number.isFinite(number) && Math.abs(number - Math.round(number)) < 0.000001;
}

function chartUsesWholeNumbers(chart) {
    const values = (Array.isArray(chart?.datasets) ? chart.datasets : [])
        .flatMap(dataset => Array.isArray(dataset.data) ? dataset.data : [])
        .map(Number)
        .filter(Number.isFinite);

    return values.length > 0 && values.every(isWholeNumber);
}

function formatChartNumber(value, { forceWhole = false } = {}) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
        return value;
    }

    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: forceWhole || isWholeNumber(number) ? 0 : 2
    }).format(number);
}

function getTooltipValue(context) {
    if (context.parsed && typeof context.parsed === 'object') {
        return context.parsed.y ?? context.parsed.r ?? context.raw;
    }

    return context.parsed ?? context.raw;
}

function buildChartData(chart) {
    const labels = Array.isArray(chart?.labels)
        ? chart.labels.map(label => formatReportDateLabel(label, { fallback: String(label ?? '') }))
        : [];
    const datasets = Array.isArray(chart?.datasets) ? chart.datasets : [];

    return {
        labels,
        datasets: datasets.map((dataset, datasetIndex) => {
            const color = palette[datasetIndex % palette.length];
            const isDoughnut = chart?.type === 'doughnut' || chart?.type === 'pie';
            const isLine = chart?.type === 'line';

            return {
                ...dataset,
                borderColor: dataset.borderColor || color,
                backgroundColor: dataset.backgroundColor || (isDoughnut ? palette : (isLine ? (context) => lineGradient(context, color) : `${color}33`)),
                pointBackgroundColor: dataset.pointBackgroundColor || color,
                pointBorderColor: '#ffffff',
                pointBorderWidth: isLine ? 2 : 0,
                pointRadius: isLine ? 2 : 0,
                pointHoverRadius: isLine ? 4 : 0,
                pointHitRadius: isLine ? 14 : 0,
                borderWidth: isLine ? 2 : 1,
                borderRadius: chart?.type === 'bar' ? 6 : 0,
                tension: dataset.tension ?? 0.38,
                fill: dataset.fill ?? isLine
            };
        })
    };
}

function SalesPointDetails({ date, details, reduceMotion, onClose }) {
    const panelRef = useRef(null);
    const groups = [
        { key: 'services', label: 'Services sold' },
        { key: 'materials', label: 'Materials sold' }
    ];
    useGSAP(() => {
        if (reduceMotion) {
            gsap.set(panelRef.current, { autoAlpha: 1, clearProps: 'transform' });
            return;
        }

        gsap.fromTo(panelRef.current, {
            autoAlpha: 0,
            y: 6,
        }, {
            autoAlpha: 1,
            y: 0,
            duration: 0.2,
            ease: 'power3.out',
            clearProps: 'transform,opacity,visibility',
        });
    }, { scope: panelRef, dependencies: [date, reduceMotion], revertOnUpdate: true });

    return (
        <aside ref={panelRef} className="absolute inset-x-1 bottom-1 z-20 overflow-hidden rounded-lg border border-slate-200 bg-white/95 shadow-lg shadow-slate-950/10 backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/95" aria-label={`Sales details for ${date}`}>
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-3 py-2 dark:border-slate-800">
                <div className="min-w-0">
                    <p className="truncate text-xs font-black text-slate-950 dark:text-white">{formatReportDateLabel(date, { fallback: date })}</p>
                </div>
                <Button type="button" variant="ghost" size="icon" className="size-7 rounded-md active:scale-[0.96] dark:text-slate-200 dark:hover:bg-slate-800" onClick={onClose} aria-label="Close sales details">
                    <X className="size-3.5" />
                </Button>
            </div>
            <div className="grid max-h-36 gap-3 overflow-y-auto overscroll-contain p-3 sm:grid-cols-2">
                {groups.map((group) => {
                    const items = Array.isArray(details?.[group.key]) ? details[group.key] : [];

                    return (
                        <section key={group.key} className="min-w-0">
                            <h4 className="text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">{group.label}</h4>
                            {items.length ? (
                                <div className="mt-1.5 space-y-1">
                                    {items.map((item) => (
                                        <div key={`${group.key}-${item.name}`} className="flex items-start justify-between gap-3 text-xs">
                                            <span className="min-w-0 truncate font-semibold text-slate-700 dark:text-slate-200" title={item.name}>{item.name}</span>
                                            <span className="shrink-0 font-black tabular-nums text-slate-950 dark:text-white">{formatPhpCurrency(item.amount)}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="mt-1.5 text-xs font-semibold text-slate-400 dark:text-slate-500">None</p>
                            )}
                        </section>
                    );
                })}
            </div>
        </aside>
    );
}

export default function ReportChartCard({ title, summary, chart, compact = false, stableHeight = false, eyebrow = '', actions = null }) {
    const rootRef = useRef(null);
    const progressiveLineActiveRef = useRef(true);
    const { isDark } = useTheme();
    const [reduceMotion, setReduceMotion] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const [selectedPointIndex, setSelectedPointIndex] = useState(null);
    useEffect(() => {
        const media = window.matchMedia('(prefers-reduced-motion: reduce)');
        const update = () => setReduceMotion(media.matches);
        media.addEventListener('change', update);
        return () => media.removeEventListener('change', update);
    }, []);
    useGSAP(() => {
        const heading = rootRef.current?.querySelector('[data-report-chart-heading]');
        const visual = rootRef.current?.querySelector('[data-report-chart-visual]');

        if (!heading || !visual) return;

        if (reduceMotion) {
            gsap.set([heading, visual], { autoAlpha: 1, clearProps: 'transform' });
            return;
        }

        const entrance = gsap.timeline({ defaults: { ease: 'power3.out' } });
        entrance.fromTo(heading, {
            autoAlpha: 0,
            y: 4,
        }, {
            autoAlpha: 1,
            y: 0,
            duration: 0.18,
            clearProps: 'transform,opacity,visibility',
        });
        entrance.fromTo(visual, {
            autoAlpha: 0,
            y: 5,
            scale: 0.99,
        }, {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            duration: 0.26,
            clearProps: 'transform,opacity,visibility',
        }, 0.04);
    }, { scope: rootRef, dependencies: [reduceMotion], revertOnUpdate: true });
    const chartData = buildChartData(chart);
    const forceWholeNumberTicks = chartUsesWholeNumbers(chart);
    const axisTextColor = isDark ? '#cbd5e1' : '#64748b';
    const legendTextColor = isDark ? '#e2e8f0' : '#334155';
    const gridColor = isDark ? '#334155' : '#e2e8f0';
    const pointDetails = chart?.pointDetails && typeof chart.pointDetails === 'object' ? chart.pointDetails : {};
    const hasPointDetails = Object.keys(pointDetails).length > 0;
    const activePointIndex = selectedPointIndex;
    const activePointLabel = activePointIndex === null ? '' : String(chart?.labels?.[activePointIndex] || '');
    const activePointDetails = activePointLabel ? pointDetails[activePointLabel] : null;
    const chartType = chart?.type || 'bar';
    const pointCount = Math.max(1, Array.isArray(chart?.labels) ? chart.labels.length : 1);
    const delayBetweenPoints = Math.max(2, Math.min(70, 720 / pointCount));
    const pointAnimationDuration = Math.max(80, Math.min(180, delayBetweenPoints * 1.5));
    const progressiveDelay = (axis) => (context) => {
        if (!progressiveLineActiveRef.current || context.type !== 'data') return 0;

        const startedKey = axis === 'x' ? 'xFlowStarted' : 'yFlowStarted';
        if (context[startedKey]) return 0;

        context[startedKey] = true;
        const pointIndex = Number(context.dataIndex ?? context.index ?? 0);
        return pointIndex * delayBetweenPoints;
    };
    const previousPointY = (context) => {
        if (!progressiveLineActiveRef.current) return undefined;

        const pointIndex = Number(context.dataIndex ?? context.index ?? 0);
        const yScale = context.chart.scales.y;
        if (pointIndex <= 0) return yScale?.getPixelForValue(0);

        const previousPoint = context.chart.getDatasetMeta(context.datasetIndex).data[pointIndex - 1];
        return previousPoint?.getProps(['y'], true)?.y ?? yScale?.getPixelForValue(0);
    };
    const chartAnimation = reduceMotion ? false : {
        duration: chartType === 'line' ? 320 : 440,
        easing: 'easeOutQuart',
        delay: (context) => chartType !== 'line' && context.type === 'data'
            ? Math.min((context.dataIndex * 18) + (context.datasetIndex * 28), 180)
            : 0,
        onComplete: () => {
            progressiveLineActiveRef.current = false;
        }
    };
    const progressiveLineAnimations = !reduceMotion && chartType === 'line' ? {
        x: {
            type: 'number',
            easing: 'linear',
            duration: pointAnimationDuration,
            from: (context) => progressiveLineActiveRef.current && context.type === 'data' ? Number.NaN : undefined,
            delay: progressiveDelay('x')
        },
        y: {
            type: 'number',
            easing: 'easeOutQuart',
            duration: pointAnimationDuration,
            from: previousPointY,
            delay: progressiveDelay('y')
        }
    } : undefined;
    const options = {
        responsive: true,
        maintainAspectRatio: false,
        animation: chartAnimation,
        animations: progressiveLineAnimations,
        interaction: { mode: 'index', intersect: false },
        transitions: {
            active: {
                animation: { duration: reduceMotion ? 0 : 120, easing: 'easeOutQuart' }
            }
        },
        onHover: hasPointDetails ? (event, elements) => {
            if (event?.native?.target) {
                event.native.target.style.cursor = elements.length ? 'pointer' : 'default';
            }
        } : undefined,
        onClick: hasPointDetails ? (_event, elements) => {
            const nextIndex = elements[0]?.index;
            if (nextIndex === undefined) return;
            setSelectedPointIndex((currentIndex) => currentIndex === nextIndex ? null : nextIndex);
        } : undefined,
        plugins: {
            legend: {
                position: compact ? 'bottom' : 'top',
                labels: {
                    boxWidth: 12,
                    color: legendTextColor,
                    font: { size: 11, weight: '600' }
                }
            },
            tooltip: {
                intersect: false,
                mode: 'index',
                callbacks: {
                    label: (context) => {
                        const label = context.dataset?.label ? `${context.dataset.label}: ` : '';

                        return `${label}${formatChartNumber(getTooltipValue(context))}`;
                    },
                    afterLabel: (context) => {
                        const breakdown = context.dataset?.breedBreakdown;
                        const label = context.label;

                        if (!breakdown || !breakdown[label]) {
                            return [];
                        }

                        return Object.entries(breakdown[label])
                            .sort((first, second) => Number(second[1]) - Number(first[1]))
                            .slice(0, 5)
                            .map(([breed, count]) => `${breed}: ${formatChartNumber(count, { forceWhole: true })}`);
                    }
                }
            }
        },
        scales: chart?.type === 'doughnut' || chart?.type === 'pie' ? undefined : {
            x: {
                ticks: { color: axisTextColor, maxRotation: 0, autoSkip: true, padding: 8 },
                grid: { display: false },
                border: { display: false }
            },
            y: {
                ticks: {
                    color: axisTextColor,
                    padding: 8,
                    precision: forceWholeNumberTicks ? 0 : undefined,
                    callback: (value) => formatChartNumber(value, { forceWhole: forceWholeNumberTicks })
                },
                grid: { color: gridColor, drawTicks: false },
                border: { display: false },
                beginAtZero: true
            }
        }
    };
    const heightClass = compact ? 'h-64' : 'h-72';
    const hasData = hasChartData(chart);
    const ChartComponent = chartType === 'line' ? Line : (chartType === 'doughnut' || chartType === 'pie' ? Doughnut : Bar);

    return (
        <div ref={rootRef} className="h-full">
            <Card petHover={false} className={`${stableHeight ? 'h-[360px] sm:h-[380px]' : 'h-full'} overflow-hidden rounded-xl border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900`}>
                <CardContent className="flex h-full flex-col gap-3 p-4 sm:p-5">
                    <div data-report-chart-heading className="flex min-w-0 items-start justify-between gap-3">
                        <div className="min-w-0">
                            {eyebrow ? <p className="mb-1 text-[11px] font-black uppercase tracking-[0.12em] text-blue-700 dark:text-blue-300">{eyebrow}</p> : null}
                            <h3 className={`${stableHeight ? 'line-clamp-2' : ''} text-base font-black leading-6 text-slate-950 dark:text-white`}>{title}</h3>
                            {summary ? <p className={`${stableHeight ? 'line-clamp-2' : ''} mt-1 text-xs font-semibold leading-5 text-slate-500 dark:text-slate-300 sm:text-sm`}>{summary}</p> : null}
                        </div>
                        {actions ? <div className="shrink-0">{actions}</div> : null}
                    </div>
                    <div
                        data-report-chart-visual
                        className={`${stableHeight ? 'min-h-0 flex-1' : heightClass} relative mt-auto w-full origin-center`}
                    >
                        {hasData ? (
                            <ChartComponent data={chartData} options={options} />
                        ) : (
                            <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                No chart data for this date range.
                            </div>
                        )}
                        {activePointDetails ? (
                            <SalesPointDetails
                                date={activePointLabel}
                                details={activePointDetails}
                                reduceMotion={reduceMotion}
                                onClose={() => {
                                    setSelectedPointIndex(null);
                                }}
                            />
                        ) : null}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
