import { createElement } from 'react';
import { ArrowLeft, ChevronRight } from 'lucide-react';

import { Button } from '../../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import DashboardPageHeader from '../shared/DashboardPageHeader.jsx';

export function ServicePageShell({ children, className = '' }) {
    return (
        <div data-service-page className={`mx-auto w-full max-w-7xl min-w-0 space-y-6 pb-8 lg:space-y-8 ${className}`}>
            {children}
        </div>
    );
}

export function ServicePageHeader({
    icon,
    title,
    description,
    onBack,
    action = null,
}) {
    const navigation = (
        <nav aria-label="Service breadcrumb" className="flex min-w-0 items-center gap-1.5 text-xs font-bold">
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onBack}
                    className="-ml-2 min-h-8 shrink-0 px-2 py-1 text-slate-500 shadow-none hover:bg-blue-50 hover:text-blue-800 dark:text-slate-400 dark:hover:bg-blue-950/40 dark:hover:text-blue-200"
                >
                    <ArrowLeft className="size-3.5" aria-hidden="true" />
                    Care directory
                </Button>
                <ChevronRight className="size-3.5 shrink-0 text-slate-300 dark:text-slate-600" aria-hidden="true" />
                <span className="truncate text-slate-600 dark:text-slate-300" aria-current="page">{title}</span>
        </nav>
    );

    return (
        <DashboardPageHeader
            icon={icon}
            title={title}
            description={description}
            navigation={navigation}
            actions={action}
        />
    );
}

export function ServiceSummaryCard({ icon, title, children }) {
    return (
        <Card className="gap-0 overflow-hidden">
            <span className="h-0.5 w-full bg-gradient-to-r from-[#155dfc] via-blue-400 to-blue-100 dark:to-blue-950" aria-hidden="true" />
            <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                        {createElement(icon, { className: 'size-5', 'aria-hidden': true })}
                    </span>
                    <div className="min-w-0">
                        <p className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                            Service overview
                        </p>
                        <CardTitle className="mt-0.5 text-left text-lg">{title}</CardTitle>
                    </div>
                </div>
            </CardHeader>
            <CardContent>{children}</CardContent>
        </Card>
    );
}
