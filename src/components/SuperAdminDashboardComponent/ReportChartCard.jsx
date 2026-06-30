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
import { Card, CardContent } from '../../ui/card';
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

const palette = ['#155dfc', '#0f9f6e', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2', '#ea580c', '#475569'];

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
                pointRadius: isLine ? 3 : 0,
                pointHoverRadius: isLine ? 5 : 0,
                borderWidth: isLine ? 3 : 1,
                borderRadius: chart?.type === 'bar' ? 8 : 0,
                tension: dataset.tension ?? 0.38,
                fill: dataset.fill ?? isLine
            };
        })
    };
}

export default function ReportChartCard({ title, summary, chart, compact = false }) {
    const { isDark } = useTheme();
    const chartData = buildChartData(chart);
    const forceWholeNumberTicks = chartUsesWholeNumbers(chart);
    const axisTextColor = isDark ? '#cbd5e1' : '#64748b';
    const legendTextColor = isDark ? '#e2e8f0' : '#334155';
    const gridColor = isDark ? '#334155' : '#e2e8f0';
    const options = {
        responsive: true,
        maintainAspectRatio: false,
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
                ticks: { color: axisTextColor, maxRotation: 0, autoSkip: true },
                grid: { display: false }
            },
            y: {
                ticks: {
                    color: axisTextColor,
                    precision: forceWholeNumberTicks ? 0 : undefined,
                    callback: (value) => formatChartNumber(value, { forceWhole: forceWholeNumberTicks })
                },
                grid: { color: gridColor },
                beginAtZero: true
            }
        }
    };
    const heightClass = compact ? 'h-56' : 'h-72';
    const chartType = chart?.type || 'bar';
    const hasData = hasChartData(chart);
    const ChartComponent = chartType === 'line' ? Line : (chartType === 'doughnut' || chartType === 'pie' ? Doughnut : Bar);

    return (
        <Card className="overflow-hidden border-slate-200 bg-gradient-to-br from-white via-white to-slate-50 shadow-sm dark:border-slate-700 dark:bg-none dark:bg-slate-900">
            <CardContent className="space-y-4 p-5">
                <div>
                    <h3 className="text-base font-black text-slate-950 dark:text-white">{title}</h3>
                    {summary ? <p className="mt-1 text-sm font-semibold leading-6 text-slate-500 dark:text-slate-300">{summary}</p> : null}
                </div>
                <div className={heightClass}>
                    {hasData ? (
                        <ChartComponent data={chartData} options={options} />
                    ) : (
                        <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            No chart data for this date range.
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
