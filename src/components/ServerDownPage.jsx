import { useState } from 'react';
import { AlertTriangle, Bug, CheckCircle2, Mail, RefreshCw } from 'lucide-react';

import { sendMaintenanceProblemReport } from '../services/problemReportService.js';

const MAINTENANCE_MESSAGE = 'This site is temporarily unavailable due to maintenance. Please try again in a moment.';

export default function ServerDownPage({ isRetrying, onRetry, serverStatus }) {
    const [reportState, setReportState] = useState({
        status: 'idle',
        reportId: '',
        message: '',
        fallbackEmailUrl: '',
    });

    const handleReportProblem = async () => {
        if (reportState.status === 'sending' || reportState.status === 'sent') {
            return;
        }

        setReportState({
            status: 'sending',
            reportId: '',
            message: '',
            fallbackEmailUrl: '',
        });

        try {
            const result = await sendMaintenanceProblemReport(serverStatus);
            setReportState({
                status: 'sent',
                reportId: result.reportId,
                message: 'Problem report sent to the iPawcus development team.',
                fallbackEmailUrl: result.fallbackEmailUrl,
            });
        } catch (error) {
            console.error('[iPawcus maintenance] Problem report failed:', error);
            setReportState({
                status: 'failed',
                reportId: error.reportId || '',
                message: error.message || 'The automatic problem report could not be sent.',
                fallbackEmailUrl: error.fallbackEmailUrl || '',
            });
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-950">
            <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-6 py-12">
                <div className="mb-6 flex size-16 items-center justify-center rounded-full bg-red-50 text-red-600 ring-1 ring-red-100">
                    <AlertTriangle className="size-8" />
                </div>

                <p className="mb-3 text-sm font-black uppercase tracking-wide text-red-600">
                    iPawcus maintenance
                </p>
                <h1 className="text-4xl font-black leading-tight text-slate-950 sm:text-5xl">
                    iPawcus is under maintenance
                </h1>
                <p className="mt-4 max-w-2xl text-base font-medium leading-7 text-slate-600 sm:text-lg">
                    {MAINTENANCE_MESSAGE}
                </p>

                <div className="mt-8 flex flex-wrap items-center gap-3">
                    <button
                        type="button"
                        onClick={onRetry}
                        disabled={isRetrying}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#155dfc] px-5 text-sm font-black text-white transition hover:bg-[#0d4acf] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                        <RefreshCw className={`size-4 ${isRetrying ? 'animate-spin' : ''}`} />
                        {isRetrying ? 'Checking server...' : 'Try again'}
                    </button>

                    <button
                        type="button"
                        onClick={handleReportProblem}
                        disabled={reportState.status === 'sending' || reportState.status === 'sent'}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-5 text-sm font-black text-slate-800 transition hover:border-slate-400 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-[#155dfc] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                        <Bug className="size-4" />
                        {reportState.status === 'sending'
                            ? 'Sending report...'
                            : reportState.status === 'sent'
                                ? 'Problem reported'
                                : 'Report problem'}
                    </button>

                    <span className="text-sm font-semibold text-slate-500">
                        We will reopen the app automatically once service is restored.
                    </span>
                </div>

                {reportState.status === 'sent' && (
                    <div role="status" className="mt-5 flex max-w-2xl items-start gap-3 border-l-4 border-emerald-500 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                        <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
                        <div>
                            <p className="font-bold">{reportState.message}</p>
                            <p className="mt-1 font-medium">Reference: {reportState.reportId}</p>
                        </div>
                    </div>
                )}

                {reportState.status === 'failed' && (
                    <div role="alert" className="mt-5 max-w-2xl border-l-4 border-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                        <p className="font-bold">{reportState.message}</p>
                        {reportState.reportId && (
                            <p className="mt-1 font-medium">Reference: {reportState.reportId}</p>
                        )}
                        {reportState.fallbackEmailUrl && (
                            <a
                                href={reportState.fallbackEmailUrl}
                                className="mt-3 inline-flex items-center gap-2 font-black text-[#155dfc] underline decoration-2 underline-offset-4"
                            >
                                <Mail className="size-4" />
                                Email report instead
                            </a>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}
