import { useState } from 'react';
import {
    AlertTriangle,
    Bug,
    CheckCircle2,
    Database,
    Mail,
    RefreshCw,
    ServerCrash,
    Timer,
    WifiOff
} from 'lucide-react';

import { sendMaintenanceProblemReport } from '../services/problemReportService.js';

const FAILURE_CONTENT = {
    maintenance: {
        eyebrow: 'iPawcus maintenance',
        title: 'iPawcus is temporarily unavailable',
        message: 'The iPawcus database is temporarily unavailable. The clinic may be performing maintenance. Please try again in a moment.',
        helper: 'Retry to check whether database service has been restored. If the issue continues, send a problem report.',
        Icon: Database
    },
    offline: {
        eyebrow: 'Connection issue',
        title: 'Your device is offline',
        message: 'Check your Wi-Fi or mobile data connection, then try again.',
        helper: 'Reconnect this device to the internet, then select Try again.',
        Icon: WifiOff
    },
    timeout: {
        eyebrow: 'Connection timeout',
        title: 'iPawcus is taking too long to respond',
        message: 'The request timed out before the server responded. Check your connection and try again.',
        helper: 'Retry once. If the delay continues while other sites work, send a problem report.',
        Icon: Timer
    },
    connection: {
        eyebrow: 'Server connection issue',
        title: 'We cannot reach iPawcus',
        message: 'Your device is online, but the iPawcus server could not be reached. Please try again shortly.',
        helper: 'Retry to reconnect. If the server remains unreachable, send a problem report.',
        Icon: ServerCrash
    },
    service: {
        eyebrow: 'Service error',
        title: 'iPawcus encountered a server error',
        message: 'The server could not complete its health check. Please try again in a moment.',
        helper: 'Retry the health check. If the error continues, send a problem report.',
        Icon: AlertTriangle
    }
};

function failureContent(serverStatus = {}) {
    const kind = FAILURE_CONTENT[serverStatus.kind] ? serverStatus.kind : 'service';
    const content = FAILURE_CONTENT[kind];

    return {
        ...content,
        kind,
        message: serverStatus.message || content.message
    };
}

export default function ServerDownPage({ isRetrying, onRetry, serverStatus }) {
    const [reportState, setReportState] = useState({
        status: 'idle',
        reportId: '',
        message: '',
        fallbackEmailUrl: '',
    });
    const content = failureContent(serverStatus);
    const StatusIcon = content.Icon;
    const canReportProblem = content.kind !== 'offline';

    const handleReportProblem = async () => {
        if (!canReportProblem || reportState.status === 'sending' || reportState.status === 'sent') {
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
            console.error('[iPawcus status] Problem report failed:', error);
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
                    <StatusIcon className="size-8" />
                </div>

                <p className="mb-3 text-sm font-black uppercase tracking-wide text-red-600">
                    {content.eyebrow}
                </p>
                <h1 className="text-4xl font-black leading-tight text-slate-950 sm:text-5xl">
                    {content.title}
                </h1>
                <p className="mt-4 max-w-2xl text-base font-medium leading-7 text-slate-600 sm:text-lg">
                    {content.message}
                </p>

                <div className="mt-8 flex flex-wrap items-center gap-3">
                    <button
                        type="button"
                        onClick={onRetry}
                        disabled={isRetrying}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#155dfc] px-5 text-sm font-black text-white transition hover:bg-[#0d4acf] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                        <RefreshCw className={`size-4 ${isRetrying ? 'animate-spin' : ''}`} />
                        {isRetrying ? 'Checking connection...' : 'Try again'}
                    </button>

                    {canReportProblem && (
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
                    )}

                </div>

                <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-500">
                    {content.helper}
                </p>

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
