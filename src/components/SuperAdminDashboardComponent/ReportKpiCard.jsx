import {
    Activity,
    CalendarDays,
    CircleDollarSign,
    ClipboardCheck,
    Minus,
    PackageSearch,
    Stethoscope,
    TrendingDown,
    TrendingUp,
    UsersRound
} from 'lucide-react';
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
        return { icon: TrendingUp, label: 'Up', className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200' };
    }

    if (direction === 'down') {
        return { icon: TrendingDown, label: 'Down', className: 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-200' };
    }

    return { icon: Minus, label: 'No change', className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' };
}

function kpiVisual(label) {
    const normalized = String(label || '').toLowerCase();

    if (normalized.includes('sales') || normalized.includes('paid') || normalized.includes('balance')) {
        return { icon: CircleDollarSign, className: 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200' };
    }
    if (normalized.includes('appointment')) {
        return { icon: CalendarDays, className: 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200' };
    }
    if (normalized.includes('queue')) {
        return { icon: UsersRound, className: 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200' };
    }
    if (normalized.includes('consult') || normalized.includes('clinic')) {
        return { icon: Stethoscope, className: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-200' };
    }
    if (normalized.includes('stock') || normalized.includes('expiry')) {
        return { icon: PackageSearch, className: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200' };
    }
    if (normalized.includes('completed')) {
        return { icon: ClipboardCheck, className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200' };
    }

    return { icon: Activity, className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200' };
}

export default function ReportKpiCard({ label, value, format, direction = 'neutral', percentageChange, comparisonLabel, comparisonText, onSelectChart, targetTitle }) {
    const trend = trendConfig(direction);
    const visual = kpiVisual(label);
    const TrendIcon = trend.icon;
    const VisualIcon = visual.icon;
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
            className={`group relative overflow-hidden border-slate-200 bg-gradient-to-br from-white via-white to-blue-50/45 shadow-sm transition duration-200 dark:border-slate-700 dark:bg-none dark:bg-slate-900 ${
                isInteractive
                    ? 'cursor-pointer hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500/40'
                    : ''
            }`}
        >
            <CardContent className="flex h-full flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-3">
                    <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${visual.className}`}>
                        <VisualIcon className="size-5" />
                    </div>
                    <div className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${trend.className}`} title={comparisonLabel || undefined}>
                        <TrendIcon className="size-4" />
                    </div>
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-300">{label}</p>
                    <p className="mt-1.5 truncate text-2xl font-black tracking-tight text-slate-950 dark:text-white">{formatKpiValue(value, format)}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                        {supportingText}
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}
