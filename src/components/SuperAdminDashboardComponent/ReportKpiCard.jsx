import { TrendingUp } from 'lucide-react';
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

export default function ReportKpiCard({ label, value, format }) {
    return (
        <Card className="border-slate-200 shadow-sm">
            <CardContent className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
                    <p className="mt-2 truncate text-2xl font-black text-slate-950">{formatKpiValue(value, format)}</p>
                </div>
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[#155dfc]">
                    <TrendingUp className="size-5" />
                </div>
            </CardContent>
        </Card>
    );
}
