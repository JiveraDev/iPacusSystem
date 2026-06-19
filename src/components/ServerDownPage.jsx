import { AlertTriangle, RefreshCw } from 'lucide-react';

const MAINTENANCE_MESSAGE = 'This site is temporarily unavailable due to maintenance. Please try again in a moment.';

export default function ServerDownPage({ isRetrying, onRetry }) {
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

                    <span className="text-sm font-semibold text-slate-500">
                        We will reopen the app automatically once service is restored.
                    </span>
                </div>
            </main>
        </div>
    );
}
