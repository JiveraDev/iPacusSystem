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

function buildChartData(chart) {
    const labels = Array.isArray(chart?.labels) ? chart.labels : [];
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
    const chartData = buildChartData(chart);
    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: compact ? 'bottom' : 'top',
                labels: {
                    boxWidth: 12,
                    color: '#334155',
                    font: { size: 11, weight: '600' }
                }
            },
            tooltip: {
                intersect: false,
                mode: 'index',
                callbacks: {
                    afterLabel: (context) => {
                        const breakdown = context.dataset?.breedBreakdown;
                        const label = context.label;

                        if (!breakdown || !breakdown[label]) {
                            return [];
                        }

                        return Object.entries(breakdown[label])
                            .sort((first, second) => Number(second[1]) - Number(first[1]))
                            .slice(0, 5)
                            .map(([breed, count]) => `${breed}: ${count}`);
                    }
                }
            }
        },
        scales: chart?.type === 'doughnut' || chart?.type === 'pie' ? undefined : {
            x: {
                ticks: { color: '#64748b', maxRotation: 0, autoSkip: true },
                grid: { display: false }
            },
            y: {
                ticks: { color: '#64748b' },
                grid: { color: '#e2e8f0' },
                beginAtZero: true
            }
        }
    };
    const heightClass = compact ? 'h-56' : 'h-72';
    const chartType = chart?.type || 'bar';
    const hasData = hasChartData(chart);
    const ChartComponent = chartType === 'line' ? Line : (chartType === 'doughnut' || chartType === 'pie' ? Doughnut : Bar);

    return (
        <Card className="overflow-hidden border-slate-200 bg-gradient-to-br from-white via-white to-slate-50 shadow-sm">
            <CardContent className="space-y-4 p-5">
                <div>
                    <h3 className="text-base font-black text-slate-950">{title}</h3>
                    {summary ? <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">{summary}</p> : null}
                </div>
                <div className={heightClass}>
                    {hasData ? (
                        <ChartComponent data={chartData} options={options} />
                    ) : (
                        <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm font-semibold text-slate-500">
                            No chart data for this date range.
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
