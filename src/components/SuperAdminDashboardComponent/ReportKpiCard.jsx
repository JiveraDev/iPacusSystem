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

export default function ReportKpiCard({ label, value, format, direction = 'neutral', percentageChange, comparisonLabel, comparisonText, onSelectChart, targetTitle, compact = false, isSelected = false }) {
    const trend = trendConfig(direction);
    const visual = kpiVisual(label);
    const TrendIcon = trend.icon;
    const VisualIcon = visual.icon;
    const supportingText = comparisonText || (comparisonLabel
        ? direction === 'neutral'
            ? 'No change'
            : `${trend.label}${percentageChange !== null && percentageChange !== undefined ? ` ${Math.abs(percentageChange)}%` : ''}`
        : 'Current range');
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
            petHover={false}
            role={isInteractive ? 'button' : undefined}
            tabIndex={isInteractive ? 0 : undefined}
            aria-pressed={isInteractive ? isSelected : undefined}
            aria-label={isInteractive ? `${label}. View related details${targetTitle ? `: ${targetTitle}` : ''}.` : undefined}
            title={isInteractive && targetTitle ? `View ${targetTitle}` : undefined}
            onClick={isInteractive ? onSelectChart : undefined}
            onKeyDown={handleKeyDown}
            className={`group relative h-full overflow-hidden rounded-xl border-slate-200 bg-white shadow-sm transition-[transform,background-color,border-color,box-shadow] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] dark:border-slate-700 dark:bg-slate-900 ${isSelected ? 'border-blue-500 bg-blue-50/50 ring-1 ring-blue-500/20 dark:border-blue-400 dark:bg-blue-950/30' : ''} ${
                isInteractive
                    ? 'cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:border-blue-600 dark:hover:bg-blue-950/20'
                    : ''
            }`}
        >
            {isSelected ? <span aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5 bg-blue-600 dark:bg-blue-400" /> : null}
            <CardContent className={`flex h-full flex-col ${compact ? 'min-h-[104px] gap-2 p-3' : 'gap-3 p-4'}`}>
                {compact ? (
                    <div className="flex min-w-0 items-start gap-2">
                        <span className={`flex size-7 shrink-0 items-center justify-center rounded-md ${visual.className}`}><VisualIcon className="size-4" /></span>
                        <p className="min-w-0 truncate whitespace-nowrap text-[11px] font-bold leading-7 text-slate-600 dark:text-slate-200 sm:text-xs" title={label}>{label}</p>
                    </div>
                ) : (
                    <div className="flex items-start justify-between gap-3">
                        <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${visual.className}`}>
                            <VisualIcon className="size-5" />
                        </div>
                        <div className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${trend.className}`} title={trend.label}>
                            <TrendIcon className="size-4" />
                        </div>
                    </div>
                )}
                <div className="min-w-0 flex-1">
                    {!compact ? <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-300">{label}</p> : null}
                    <p className={`truncate font-black tabular-nums tracking-tight text-slate-950 dark:text-white ${compact ? 'text-lg sm:text-xl' : 'mt-1.5 text-2xl'}`}>{formatKpiValue(value, format)}</p>
                    <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400" title={supportingText}>
                        {comparisonLabel && direction !== 'neutral' ? <TrendIcon className="size-3.5 shrink-0" aria-hidden="true" /> : null}
                        <span className="truncate">{supportingText}</span>
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}
