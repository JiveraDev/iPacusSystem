import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '../../ui/card';

const currencyFormatter = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 2
});

function formatKpiValue(value, format) {
    if (format === 'currency') {
        return currencyFormatter.format(Number(value || 0));
    }

    return new Intl.NumberFormat('en-PH').format(Number(value || 0));
}

function trendConfig(direction) {
    if (direction === 'up') {
        return { icon: TrendingUp, label: 'Up', className: 'bg-emerald-50 text-emerald-700' };
    }

    if (direction === 'down') {
        return { icon: TrendingDown, label: 'Down', className: 'bg-red-50 text-red-700' };
    }

    return { icon: Minus, label: 'No change', className: 'bg-slate-100 text-slate-600' };
}

export default function ReportKpiCard({ label, value, format, direction = 'neutral', percentageChange, comparisonLabel, comparisonText, onSelectChart, targetTitle }) {
    const trend = trendConfig(direction);
    const TrendIcon = trend.icon;
    const hasComparison = Boolean(comparisonLabel) && direction !== 'neutral';
    const supportingText = comparisonText || (hasComparison
        ? `${trend.label}${percentageChange !== null && percentageChange !== undefined ? ` ${Math.abs(percentageChange)}%` : ''} vs previous range`
        : 'No quick-range comparison');
    const isInteractive = typeof onSelectChart === 'function';
    const handleKeyDown = (event) => {
        if (!isInteractive || !['Enter', ' '].includes(event.key)) {
            return;
        }

        event.preventDefault();
        onSelectChart();
    };

    return (
        <Card
            role={isInteractive ? 'button' : undefined}
            tabIndex={isInteractive ? 0 : undefined}
            aria-label={isInteractive ? `${label}. View related details${targetTitle ? `: ${targetTitle}` : ''}.` : undefined}
            title={isInteractive && targetTitle ? `View ${targetTitle}` : undefined}
            onClick={isInteractive ? onSelectChart : undefined}
            onKeyDown={handleKeyDown}
            className={`border-slate-200 shadow-sm transition duration-200 dark:border-slate-700 dark:bg-slate-900 ${
                isInteractive
                    ? 'cursor-pointer hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#155dfc]/40'
                    : ''
            }`}
        >
            <CardContent className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-300">{label}</p>
                    <p className="mt-2 truncate text-2xl font-black text-slate-950 dark:text-white">{formatKpiValue(value, format)}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                        {supportingText}
                    </p>
                </div>
                <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${trend.className}`} title={comparisonLabel || undefined}>
                    <TrendIcon className="size-5" />
                </div>
            </CardContent>
        </Card>
    );
}
