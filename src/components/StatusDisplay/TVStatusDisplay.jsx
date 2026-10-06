import { createElement, useCallback, useEffect, useMemo, useState } from 'react';
import {
    Activity,
    AlertTriangle,
    Building2,
    CalendarDays,
    CheckCircle2,
    Clock3,
    CreditCard,
    MapPin,
    PawPrint,
    Radio,
    ReceiptText,
    Stethoscope,
    UsersRound,
    Wifi,
} from 'lucide-react';

import logo from '../../assets/circular_logo.png';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { normalizeVisibleBranchCode } from '../../services/branchService';
import { fetchStatusDisplay } from '../../services/statusDisplayService';

const DISPLAY_LIMITS = {
    serving: 5,
    waiting: 9,
    payment: 5,
};

const PANEL_TONES = {
    serving: {
        accent: 'bg-[#155dfc]',
        badge: 'bg-blue-50 text-[#155dfc] ring-blue-100 dark:bg-blue-950 dark:text-blue-300 dark:ring-blue-900',
        count: 'bg-[#155dfc] text-white',
        icon: 'bg-blue-50 text-[#155dfc] dark:bg-blue-950 dark:text-blue-300',
    },
    waiting: {
        accent: 'bg-cyan-500',
        badge: 'bg-cyan-50 text-cyan-700 ring-cyan-100 dark:bg-cyan-950 dark:text-cyan-300 dark:ring-cyan-900',
        count: 'bg-cyan-600 text-white',
        icon: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300',
    },
    payment: {
        accent: 'bg-amber-500',
        badge: 'bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-900',
        count: 'bg-amber-500 text-slate-950',
        icon: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    },
};

function getInitialBranchCode() {
    if (typeof window === 'undefined') {
        return 'MAIN';
    }

    return normalizeVisibleBranchCode(
        new URLSearchParams(window.location.search).get('branch')
    );
}

function formatClock(value = new Date()) {
    return new Intl.DateTimeFormat('en-PH', {
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
    }).format(value);
}

function formatDate(value = new Date()) {
    return new Intl.DateTimeFormat('en-PH', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
    }).format(value);
}

function formatTime(value) {
    if (!value) return '';

    const parsed = new Date(String(value).replace(' ', 'T'));
    if (Number.isNaN(parsed.getTime())) return String(value);

    return new Intl.DateTimeFormat('en-PH', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    }).format(parsed);
}

function normalizeItems(items) {
    return Array.isArray(items) ? items : [];
}

function sourceLabel(item) {
    return item?.type === 'booking' ? 'Scheduled' : 'Walk-in';
}

function petInitial(name) {
    return String(name || 'P').trim().charAt(0).toUpperCase() || 'P';
}

function Metric({ icon: Icon, label, value, detail, tone }) {
    const toneClasses = {
        blue: 'bg-blue-50 text-[#155dfc] dark:bg-blue-950/60 dark:text-blue-300',
        cyan: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300',
        amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
        emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
    }[tone];

    return (
        <article className="tv-board-enter flex min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${toneClasses}`}>
                {createElement(Icon, { className: 'size-5', 'aria-hidden': true })}
            </span>
            <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                    <strong className="text-3xl font-black leading-none text-slate-950 tabular-nums dark:text-white">{value}</strong>
                    <span className="truncate text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{label}</span>
                </div>
                <p className="mt-1 truncate text-[11px] font-semibold text-slate-400 dark:text-slate-500">{detail}</p>
            </div>
        </article>
    );
}

function PanelHeader({ icon: Icon, eyebrow, title, count, tone }) {
    const styles = PANEL_TONES[tone];

    return (
        <header className="flex items-center justify-between gap-4 border-b border-slate-200 px-4 py-3.5 dark:border-slate-700 sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
                <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${styles.icon}`}>
                    {createElement(Icon, { className: 'size-5', 'aria-hidden': true })}
                </span>
                <div className="min-w-0">
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">{eyebrow}</p>
                    <h2 className="truncate text-xl font-black tracking-tight text-slate-950 dark:text-white 2xl:text-2xl">{title}</h2>
                </div>
            </div>
            <span className={`grid min-w-11 place-items-center rounded-xl px-3 py-2 text-lg font-black tabular-nums ${styles.count}`}>
                {count}
            </span>
        </header>
    );
}

function EmptyPanel({ icon: Icon, title, detail }) {
    return (
        <div className="flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-5 text-center dark:border-slate-700 dark:bg-slate-800/60">
            <span className="mb-3 flex size-11 items-center justify-center rounded-xl bg-white text-slate-400 shadow-sm dark:bg-slate-900 dark:text-slate-500">
                {createElement(Icon, { className: 'size-5', 'aria-hidden': true })}
            </span>
            <p className="font-black text-slate-700 dark:text-slate-200">{title}</p>
            <p className="mt-1 text-xs font-semibold text-slate-400 dark:text-slate-500">{detail}</p>
        </div>
    );
}

function MoreItems({ count }) {
    if (count <= 0) return null;

    return (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
            <UsersRound className="size-4" aria-hidden="true" />
            {count} more {count === 1 ? 'patient' : 'patients'} tracked at reception
        </div>
    );
}

function ServingCard({ item, index }) {
    const styles = PANEL_TONES.serving;
    const time = formatTime(item.time);
    const veterinarianName = String(item.veterinarianName || '').trim();

    return (
        <article
            className="tv-status-row relative overflow-hidden rounded-xl border border-slate-200 bg-white px-4 py-3.5 pl-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"
            style={{ '--tv-row-delay': `${Math.min(index, 5) * 40}ms` }}
        >
            <span className={`absolute inset-y-0 left-0 w-1 ${styles.accent}`} aria-hidden="true" />
            <div className="flex min-w-0 items-start gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-lg font-black text-[#155dfc] dark:bg-blue-950 dark:text-blue-300">
                    {petInitial(item.petName)}
                </span>
                <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                        <p className="truncate text-2xl font-black tracking-tight text-slate-950 dark:text-white">{item.reference}</p>
                        <span className={`shrink-0 rounded-lg px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] ring-1 ${styles.badge}`}>
                            {item.stage || 'In service'}
                        </span>
                    </div>
                    <p className="mt-1 truncate text-base font-black text-slate-700 dark:text-slate-200">{item.petName}</p>
                    <p className="mt-0.5 truncate text-xs font-semibold text-slate-400 dark:text-slate-500">
                        {item.service}{item.species ? ` · ${item.species}` : ''}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-3 border-t border-slate-100 pt-2 text-[11px] font-bold text-slate-400 dark:border-slate-800 dark:text-slate-500">
                        <span className="truncate">{veterinarianName ? `With ${veterinarianName}` : 'Clinic team'}</span>
                        {time ? <span className="shrink-0 tabular-nums">{time}</span> : null}
                    </div>
                </div>
            </div>
        </article>
    );
}

function WaitingRow({ item, index }) {
    const styles = PANEL_TONES.waiting;
    const time = formatTime(item.time);

    return (
        <article
            className="tv-status-row relative flex min-w-0 items-center gap-3 overflow-hidden rounded-xl border border-slate-200 bg-white px-3 py-3 pl-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
            style={{ '--tv-row-delay': `${Math.min(index, 8) * 32}ms` }}
        >
            <span className={`absolute inset-y-0 left-0 w-1 ${styles.accent}`} aria-hidden="true" />
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-cyan-50 text-sm font-black text-cyan-700 tabular-nums dark:bg-cyan-950 dark:text-cyan-300">
                {index + 1}
            </span>
            <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                    <p className="truncate text-lg font-black text-slate-950 dark:text-white">{item.reference}</p>
                    <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                        {sourceLabel(item)}
                    </span>
                </div>
                <p className="mt-0.5 truncate text-xs font-bold text-slate-500 dark:text-slate-400">
                    {item.petName} · {item.service}
                </p>
            </div>
            {time ? <span className="shrink-0 text-[10px] font-bold text-slate-400 tabular-nums dark:text-slate-500">{time}</span> : null}
        </article>
    );
}

function PaymentCard({ item, index }) {
    const styles = PANEL_TONES.payment;
    const time = formatTime(item.time);

    return (
        <article
            className="tv-status-row relative overflow-hidden rounded-xl border border-slate-200 bg-white px-4 py-3.5 pl-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"
            style={{ '--tv-row-delay': `${Math.min(index, 5) * 40}ms` }}
        >
            <span className={`absolute inset-y-0 left-0 w-1 ${styles.accent}`} aria-hidden="true" />
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="truncate text-xl font-black text-slate-950 dark:text-white">{item.reference}</p>
                    <p className="mt-1 truncate text-sm font-black text-slate-700 dark:text-slate-200">{item.petName}</p>
                    <p className="mt-0.5 truncate text-xs font-semibold text-slate-400 dark:text-slate-500">{item.service}</p>
                </div>
                <span className={`shrink-0 rounded-lg px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] ring-1 ${styles.badge}`}>
                    Cashier
                </span>
            </div>
            {time ? <p className="mt-2 border-t border-slate-100 pt-2 text-right text-[10px] font-bold text-slate-400 tabular-nums dark:border-slate-800 dark:text-slate-500">Updated {time}</p> : null}
        </article>
    );
}

function StatusPanel({ children, className = '' }) {
    return (
        <section className={`tv-board-enter min-h-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/70 shadow-sm dark:border-slate-700 dark:bg-slate-800/60 ${className}`}>
            <div className="flex h-full min-h-0 flex-col">{children}</div>
        </section>
    );
}

export default function TVStatusDisplay() {
    const [branchCode, setBranchCode] = useState(getInitialBranchCode);
    const [branches, setBranches] = useState([]);
    const [statusData, setStatusData] = useState(null);
    const [error, setError] = useState('');
    const [isInitialLoading, setIsInitialLoading] = useState(true);
    const [clock, setClock] = useState(() => new Date());

    useEffect(() => {
        document.title = 'iPawcus Patient Status';
    }, []);

    useEffect(() => {
        const timerId = window.setInterval(() => setClock(new Date()), 1000);
        return () => window.clearInterval(timerId);
    }, []);

    const loadStatus = useCallback(async ({ isAutoRefresh = false } = {}) => {
        try {
            const data = await fetchStatusDisplay({ branch: branchCode });
            setStatusData(data);
            if (Array.isArray(data?.branches) && data.branches.length > 0) {
                setBranches(data.branches);
            }
            setError('');
        } catch (loadError) {
            setError(loadError.message || 'Unable to load status display.');
        } finally {
            if (!isAutoRefresh) setIsInitialLoading(false);
        }
    }, [branchCode]);

    useAutoRefresh(loadStatus, {
        intervalMs: Math.max(4000, Number(statusData?.refreshSeconds || 8) * 1000),
        refreshKey: `${branchCode}:${statusData?.refreshSeconds || 'initial'}`,
    });

    const handleBranchChange = useCallback((event) => {
        const nextBranchCode = normalizeVisibleBranchCode(event.target.value);
        if (!nextBranchCode || nextBranchCode === branchCode) return;

        const nextUrl = new URL(window.location.href);
        nextUrl.searchParams.set('branch', nextBranchCode);
        window.history.replaceState({}, '', `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
        setBranchCode(nextBranchCode);
        setStatusData(null);
        setError('');
        setIsInitialLoading(true);
    }, [branchCode]);

    const sections = statusData?.sections || {};
    const nowServing = useMemo(() => normalizeItems(sections.queue).filter((item) => (
        ['In Service', 'Diagnosis Done'].includes(item.stage)
    )), [sections.queue]);
    const waiting = useMemo(() => {
        const waitingQueue = normalizeItems(sections.queue).filter((item) => item.stage === 'Waiting');
        return [...waitingQueue, ...normalizeItems(sections.bookings)];
    }, [sections.bookings, sections.queue]);
    const billing = normalizeItems(sections.billing);
    const completedToday = Number(statusData?.summary?.completedToday || 0);
    const generatedAt = statusData?.generatedAt ? formatTime(statusData.generatedAt) : '';
    const selectedBranchCode = branches.find((branch) => (
        String(branch.code) === String(branchCode) || String(branch.id) === String(branchCode)
    ))?.code || normalizeVisibleBranchCode(branchCode);
    const branchName = statusData?.branch?.name || 'VFC Pharmacy / Main Clinic';
    const branchAddress = statusData?.branch?.address || 'Vetfocus Animal Care Clinic';

    return (
        <div className="tv-status-display min-h-[100dvh] bg-[#eef3f8] text-slate-950 dark:bg-slate-950 dark:text-white xl:h-[100dvh] xl:overflow-hidden">
            <div className="flex min-h-[100dvh] flex-col xl:h-full">
                <header className="shrink-0 border-b border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:px-6 xl:px-8">
                    <div className="mx-auto flex w-full max-w-[2400px] flex-wrap items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                            <img src={logo} alt="iPawcus" className="size-12 shrink-0 rounded-xl object-contain sm:size-14" />
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] text-[#155dfc] sm:text-[10px]">
                                    <Radio className="size-3.5" aria-hidden="true" />
                                    Live clinic status
                                </div>
                                <h1 className="mt-0.5 truncate text-xl font-black tracking-tight text-slate-950 dark:text-white sm:text-2xl">Patient Status Board</h1>
                                <p className="mt-0.5 hidden truncate text-[11px] font-semibold text-slate-400 sm:block">iPawcus · Vetfocus Animal Care Clinic</p>
                            </div>
                        </div>

                        <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:flex-none">
                            <label className="hidden min-w-60 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 md:flex dark:border-slate-700 dark:bg-slate-800">
                                <Building2 className="size-4 shrink-0 text-[#155dfc]" aria-hidden="true" />
                                <span className="min-w-0 flex-1">
                                    <span className="block text-[8px] font-black uppercase tracking-[0.16em] text-slate-400">Display location</span>
                                    <select value={selectedBranchCode} onChange={handleBranchChange} className="mt-0.5 w-full appearance-none truncate border-0 bg-transparent p-0 text-xs font-black text-slate-800 outline-none dark:text-white" aria-label="Select TV display location">
                                        {branches.length ? branches.map((branch) => (
                                            <option key={branch.id || branch.code} value={branch.code || branch.id}>{branch.name}</option>
                                        )) : <option value={branchCode}>{branchName}</option>}
                                    </select>
                                </span>
                            </label>

                            <time className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-right dark:border-slate-700 dark:bg-slate-800" dateTime={clock.toISOString()}>
                                <strong className="block text-2xl font-black leading-none tracking-tight text-slate-950 tabular-nums dark:text-white sm:text-3xl">{formatClock(clock)}</strong>
                                <span className="mt-1 flex items-center justify-end gap-1.5 text-[9px] font-bold text-slate-400 sm:text-[10px]">
                                    <CalendarDays className="size-3" aria-hidden="true" />
                                    {formatDate(clock)}
                                </span>
                            </time>
                        </div>

                        <label className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 md:hidden dark:border-slate-700 dark:bg-slate-800">
                            <Building2 className="size-4 shrink-0 text-[#155dfc]" aria-hidden="true" />
                            <select value={selectedBranchCode} onChange={handleBranchChange} className="w-full appearance-none truncate border-0 bg-transparent p-0 text-xs font-black text-slate-800 outline-none dark:text-white" aria-label="Select TV display location">
                                {branches.length ? branches.map((branch) => (
                                    <option key={branch.id || branch.code} value={branch.code || branch.id}>{branch.name}</option>
                                )) : <option value={branchCode}>{branchName}</option>}
                            </select>
                        </label>
                    </div>
                </header>

                <main className="mx-auto flex w-full max-w-[2400px] min-h-0 flex-1 flex-col gap-3 p-3 sm:p-4 xl:px-6 xl:py-4">
                    <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm dark:border-slate-700 dark:bg-slate-900" aria-label="Selected clinic location">
                        <div className="flex min-w-0 items-center gap-3">
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#155dfc] dark:bg-blue-950 dark:text-blue-300"><MapPin className="size-4" aria-hidden="true" /></span>
                            <div className="min-w-0">
                                <p className="truncate text-sm font-black text-slate-900 dark:text-white">{branchName}</p>
                                <p className="truncate text-[10px] font-semibold text-slate-400">{branchAddress}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">
                            <span className="relative flex size-2.5" aria-hidden="true"><span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-40" /><span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" /></span>
                            Live · automatic refresh
                        </div>
                    </section>

                    {error ? (
                        <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-800 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200" role="alert">
                            <AlertTriangle className="size-5 shrink-0" aria-hidden="true" />
                            <div><p className="text-sm font-black">Live update interrupted</p><p className="text-xs font-semibold opacity-75">{error} Existing status remains visible while reconnecting.</p></div>
                        </div>
                    ) : null}

                    {isInitialLoading && !statusData ? (
                        <div className="flex min-h-[58vh] flex-1 items-center justify-center rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
                            <div className="text-center"><span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-blue-50 text-[#155dfc] dark:bg-blue-950 dark:text-blue-300"><Activity className="size-7 animate-pulse" aria-hidden="true" /></span><p className="mt-4 text-xl font-black">Preparing the patient board</p><p className="mt-1 text-xs font-semibold text-slate-400">Connecting to today&apos;s clinic activity</p></div>
                        </div>
                    ) : (
                        <>
                            <section className="grid grid-cols-2 gap-2.5 lg:grid-cols-4" aria-label="Today at a glance">
                                <Metric icon={UsersRound} label="Waiting" value={waiting.length} detail="Walk-ins and scheduled" tone="cyan" />
                                <Metric icon={Stethoscope} label="In care" value={nowServing.length} detail="Currently with the team" tone="blue" />
                                <Metric icon={CreditCard} label="For payment" value={billing.length} detail="Please proceed to cashier" tone="amber" />
                                <Metric icon={CheckCircle2} label="Completed" value={completedToday} detail="Finished today" tone="emerald" />
                            </section>

                            <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-12" aria-live="polite">
                                <StatusPanel className="xl:col-span-5">
                                    <PanelHeader icon={Stethoscope} eyebrow="Currently in care" title="Now Serving" count={nowServing.length} tone="serving" />
                                    <div className="grid min-h-0 content-start gap-2.5 overflow-y-auto p-3 sm:p-4 2xl:grid-cols-2">
                                        {nowServing.length ? nowServing.slice(0, DISPLAY_LIMITS.serving).map((item, index) => <ServingCard key={item.id} item={item} index={index} />) : <EmptyPanel icon={Stethoscope} title="No patients in service" detail="The next patient will appear here." />}
                                        <MoreItems count={Math.max(0, nowServing.length - DISPLAY_LIMITS.serving)} />
                                    </div>
                                </StatusPanel>

                                <StatusPanel className="xl:col-span-4">
                                    <PanelHeader icon={PawPrint} eyebrow="Queue order" title="Waiting & Scheduled" count={waiting.length} tone="waiting" />
                                    <div className="grid min-h-0 content-start gap-2 overflow-y-auto p-3 sm:p-4">
                                        {waiting.length ? waiting.slice(0, DISPLAY_LIMITS.waiting).map((item, index) => <WaitingRow key={item.id} item={item} index={index} />) : <EmptyPanel icon={UsersRound} title="The waiting area is clear" detail="New arrivals will appear here." />}
                                        <MoreItems count={Math.max(0, waiting.length - DISPLAY_LIMITS.waiting)} />
                                    </div>
                                </StatusPanel>

                                <StatusPanel className="xl:col-span-3">
                                    <PanelHeader icon={ReceiptText} eyebrow="Next step" title="For Payment" count={billing.length} tone="payment" />
                                    <div className="grid min-h-0 content-start gap-2.5 overflow-y-auto p-3 sm:p-4">
                                        {billing.length ? billing.slice(0, DISPLAY_LIMITS.payment).map((item, index) => <PaymentCard key={item.id} item={item} index={index} />) : <EmptyPanel icon={CreditCard} title="No payments pending" detail="Payment calls will appear here." />}
                                        <MoreItems count={Math.max(0, billing.length - DISPLAY_LIMITS.payment)} />
                                    </div>
                                </StatusPanel>
                            </div>
                        </>
                    )}
                </main>

                <footer className="shrink-0 border-t border-slate-200 bg-white px-4 py-2 text-[10px] font-bold text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 sm:px-6 xl:px-8">
                    <div className="mx-auto flex w-full max-w-[2400px] flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2"><Wifi className="size-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" /><span>Please wait for your pet&apos;s name or reference number to be called.</span></div>
                        <span className="flex items-center gap-1.5 tabular-nums"><Clock3 className="size-3.5" aria-hidden="true" />{generatedAt ? `Last updated ${generatedAt}` : 'Waiting for first update'}</span>
                    </div>
                </footer>
            </div>
        </div>
    );
}
