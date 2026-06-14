import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function ServerDownPage({ message, isRetrying, onRetry }) {
    return (
        <div className="min-h-screen bg-slate-50 text-slate-950">
            <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-6 py-12">
                <div className="mb-6 flex size-16 items-center justify-center rounded-full bg-red-50 text-red-600 ring-1 ring-red-100">
                    <AlertTriangle className="size-8" />
                </div>

                <p className="mb-3 text-sm font-black uppercase tracking-wide text-red-600">
                    iPawcus connection
                </p>
                <h1 className="text-4xl font-black leading-tight text-slate-950 sm:text-5xl">
                    Server is down
                </h1>
                <p className="mt-4 max-w-2xl text-base font-medium leading-7 text-slate-600 sm:text-lg">
                    {message || 'The server or database is not responding, so iPawcus cannot be accessed right now.'}
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

                    <span className="text-sm font-semibold text-slate-500">
                        This page will unlock after PHP and the database respond again.
                    </span>
                </div>
            </main>
        </div>
    );
}
