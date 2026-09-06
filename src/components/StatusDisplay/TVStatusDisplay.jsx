import { createElement, useCallback, useEffect, useMemo, useState } from 'react';
import {
    Activity,
    AlertTriangle,
    Building2,
    CalendarDays,
    CheckCircle2,
    ChevronRight,
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
    serving: 6,
    waiting: 12,
    payment: 6,
};

const PANEL_TONES = {
    serving: {
        eyebrow: 'text-sky-300',
        icon: 'border-sky-300/25 bg-sky-300/10 text-sky-300',
        count: 'bg-sky-300 text-slate-950',
        edge: 'bg-sky-400',
        avatar: 'bg-sky-400/[0.12] text-sky-300 ring-sky-300/20',
        meta: 'text-sky-300',
        glow: 'from-sky-400/10',
    },
    waiting: {
        eyebrow: 'text-teal-300',
        icon: 'border-teal-300/25 bg-teal-300/10 text-teal-300',
        count: 'bg-teal-300 text-slate-950',
        edge: 'bg-teal-400',
        avatar: 'bg-teal-400/[0.12] text-teal-300 ring-teal-300/20',
        meta: 'text-teal-300',
        glow: 'from-teal-400/10',
    },
    payment: {
        eyebrow: 'text-amber-300',
        icon: 'border-amber-300/25 bg-amber-300/10 text-amber-300',
        count: 'bg-amber-300 text-slate-950',
        edge: 'bg-amber-400',
        avatar: 'bg-amber-400/[0.12] text-amber-300 ring-amber-300/20',
        meta: 'text-amber-300',
        glow: 'from-amber-400/10',
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
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    }).format(value);
}

function formatTime(value) {
    if (!value) {
        return '';
    }

    const normalized = String(value).replace(' ', 'T');
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return new Intl.DateTimeFormat('en-PH', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    }).format(date);
}

function normalizeItems(items = []) {
    return Array.isArray(items) ? items : [];
}

function sourceLabel(item) {
    if (item.type === 'booking') {
        return 'Scheduled';
    }

    if (item.type === 'queue') {
        return 'Walk-in';
    }

    return '';
}

function petInitial(name) {
    return String(name || 'P').trim().charAt(0).toUpperCase() || 'P';
}

function Metric({ icon, label, value, detail, tone }) {
    const toneClasses = {
        sky: 'border-sky-300/15 bg-sky-300/[0.07] text-sky-300',
        teal: 'border-teal-300/15 bg-teal-300/[0.07] text-teal-300',
        amber: 'border-amber-300/15 bg-amber-300/[0.07] text-amber-300',
        emerald: 'border-emerald-300/15 bg-emerald-300/[0.07] text-emerald-300',
    }[tone];

    return (
        <div className={`tv-board-enter flex min-w-0 items-center gap-3 rounded-2xl border px-4 py-3 ${toneClasses}`}>
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.04]">
                {createElement(icon, { className: 'size-5', 'aria-hidden': true })}
            </span>
            <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                    <strong className="text-3xl font-black leading-none text-white tabular-nums">{value}</strong>
                    <span className="truncate text-xs font-black uppercase tracking-[0.16em] text-slate-300">{label}</span>
                </div>
                <p className="mt-1 truncate text-xs font-semibold text-slate-500">{detail}</p>
            </div>
        </div>
    );
}

function PanelHeader({ icon, eyebrow, title, count, tone }) {
    const toneClasses = PANEL_TONES[tone];

    return (
        <div className="flex items-center justify-between gap-4 border-b border-white/[0.08] px-5 py-4">
            <div className="flex min-w-0 items-center gap-3">
                <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl border ${toneClasses.icon}`}>
                    {createElement(icon, { className: 'size-5', 'aria-hidden': true })}
                </span>
                <div className="min-w-0">
                    <p className={`text-[10px] font-black uppercase tracking-[0.22em] ${toneClasses.eyebrow}`}>{eyebrow}</p>
                    <h2 className="truncate text-xl font-black tracking-tight text-white 2xl:text-2xl">{title}</h2>
                </div>
            </div>
            <span className={`min-w-11 rounded-xl px-3 py-2 text-center text-lg font-black tabular-nums ${toneClasses.count}`}>
                {count}
            </span>
        </div>
    );
}

function EmptyPanel({ icon, title, detail }) {
    return (
        <div className="flex min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.025] px-5 text-center">
            <span className="mb-3 flex size-12 items-center justify-center rounded-full bg-white/[0.05] text-slate-500">
                {createElement(icon, { className: 'size-6', 'aria-hidden': true })}
            </span>
            <p className="text-base font-extrabold text-slate-300">{title}</p>
            <p className="mt-1 text-sm font-medium text-slate-500">{detail}</p>
        </div>
    );
}

function MoreItems({ count }) {
    if (count <= 0) {
        return null;
    }

    return (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-xs font-extrabold uppercase tracking-[0.12em] text-slate-400">
            <UsersRound className="size-4" aria-hidden="true" />
            {count} more {count === 1 ? 'patient' : 'patients'} tracked at reception
        </div>
    );
}

function ServingCard({ item, index }) {
    const tone = PANEL_TONES.serving;
    const time = formatTime(item.time);
    const veterinarianName = String(item.veterinarianName || '').trim();

    return (
        <article
            className="tv-status-row group relative overflow-hidden rounded-2xl border border-white/[0.09] bg-[#132238] p-4 pl-5 shadow-[0_14px_38px_-28px_rgba(56,189,248,0.65)]"
            style={{ '--tv-row-delay': `${Math.min(index, 5) * 45}ms` }}
        >
            <span className={`absolute inset-y-0 left-0 w-1 ${tone.edge}`} aria-hidden="true" />
            <div className="flex items-start gap-3">
                <span className={`flex size-12 shrink-0 items-center justify-center rounded-xl text-xl font-black ring-1 ${tone.avatar}`}>
                    {petInitial(item.petName)}
                </span>
                <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className="truncate text-2xl font-black tracking-tight text-white 2xl:text-3xl">{item.petName}</p>
                            <p className="mt-0.5 truncate text-sm font-bold text-slate-400">{item.service}</p>
                        </div>
                        <span className="shrink-0 rounded-lg bg-sky-300/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-sky-300">
                            {item.stage || 'In service'}
                        </span>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.07] pt-3">
                        <div className="flex min-w-0 items-center gap-2">
                            <span className={`text-sm font-black uppercase tracking-[0.12em] ${tone.meta}`}>{item.reference}</span>
                            {veterinarianName && (
                                <span className="truncate text-xs font-semibold text-slate-500">with {veterinarianName}</span>
                            )}
                        </div>
                        {time && (
                            <span className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
                                <Clock3 className="size-3.5" aria-hidden="true" />
                                {time}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </article>
    );
}

function WaitingRow({ item, index }) {
    const tone = PANEL_TONES.waiting;
    const label = sourceLabel(item);
    const time = formatTime(item.time);

    return (
        <article
            className="tv-status-row group relative flex min-w-0 items-center gap-3 overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.035] px-3 py-3"
            style={{ '--tv-row-delay': `${Math.min(index, 7) * 35}ms` }}
        >
            <span className={`absolute inset-y-0 left-0 w-0.5 ${tone.edge}`} aria-hidden="true" />
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-teal-300 text-lg font-black text-slate-950 tabular-nums">
                {index + 1}
            </span>
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <p className="truncate text-lg font-black text-white 2xl:text-xl">{item.petName}</p>
                    {label && (
                        <span className="shrink-0 rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-slate-400">
                            {label}
                        </span>
                    )}
                </div>
                <p className="mt-0.5 truncate text-xs font-bold text-slate-500">
                    {item.service}{item.species ? ` · ${item.species}` : ''}
                </p>
            </div>
            <div className="shrink-0 text-right">
                <p className={`text-xs font-black uppercase tracking-wide ${tone.meta}`}>{item.reference}</p>
                {time && <p className="mt-1 text-[11px] font-bold text-slate-500">{time}</p>}
            </div>
            <ChevronRight className="size-4 shrink-0 text-slate-600" aria-hidden="true" />
        </article>
    );
}

function PaymentCard({ item, index }) {
    const tone = PANEL_TONES.payment;
    const time = formatTime(item.time);

    return (
        <article
            className="tv-status-row group relative overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.035] px-4 py-3.5 pl-5"
            style={{ '--tv-row-delay': `${Math.min(index, 5) * 45}ms` }}
        >
            <span className={`absolute inset-y-0 left-0 w-1 ${tone.edge}`} aria-hidden="true" />
            <div className="flex items-center gap-3">
                <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl text-lg font-black ring-1 ${tone.avatar}`}>
                    {petInitial(item.petName)}
                </span>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-xl font-black text-white">{item.petName}</p>
                    <p className="mt-0.5 truncate text-xs font-bold text-slate-500">{item.service}</p>
                </div>
                <div className="shrink-0 text-right">
                    <p className={`text-sm font-black uppercase tracking-wide ${tone.meta}`}>{item.reference}</p>
                    {time && <p className="mt-1 text-[11px] font-bold text-slate-500">Updated {time}</p>}
                </div>
            </div>
        </article>
    );
}

function StatusPanel({ children, className = '', tone }) {
    const toneClasses = PANEL_TONES[tone];

    return (
        <section className={`tv-board-enter relative min-h-0 overflow-hidden rounded-[1.4rem] border border-white/[0.09] bg-[#0d1a2c]/95 shadow-[0_24px_70px_-45px_rgba(0,0,0,0.9)] ${className}`}>
            <div className={`pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b ${toneClasses.glow} to-transparent`} aria-hidden="true" />
            <div className="relative flex h-full min-h-0 flex-col">{children}</div>
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
            if (!isAutoRefresh) {
                setIsInitialLoading(false);
            }
        }
    }, [branchCode]);

    useAutoRefresh(loadStatus, {
        intervalMs: Math.max(4000, Number(statusData?.refreshSeconds || 8) * 1000),
        refreshKey: `${branchCode}:${statusData?.refreshSeconds || 'initial'}`,
    });

    const handleBranchChange = useCallback((event) => {
        const nextBranchCode = normalizeVisibleBranchCode(event.target.value);
        if (!nextBranchCode || nextBranchCode === branchCode) {
            return;
        }

        const nextUrl = new URL(window.location.href);
        nextUrl.searchParams.set('branch', nextBranchCode);
        window.history.replaceState({}, '', `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);

        setBranchCode(nextBranchCode);
        setStatusData(null);
        setError('');
        setIsInitialLoading(true);
    }, [branchCode]);

    const sections = statusData?.sections || {};

    const nowServing = useMemo(() => (
        normalizeItems(sections.queue).filter((item) => (
            ['In Service', 'Diagnosis Done'].includes(item.stage)
        ))
    ), [sections.queue]);

    const waiting = useMemo(() => {
        const queueWaiting = normalizeItems(sections.queue).filter((item) => (
            !['In Service', 'Diagnosis Done'].includes(item.stage)
        ));
        return [...queueWaiting, ...normalizeItems(sections.bookings)];
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
        <div className="tv-status-display relative min-h-screen overflow-hidden bg-[#07111f] text-white">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_-10%,rgba(56,189,248,0.14),transparent_32%),radial-gradient(circle_at_92%_8%,rgba(45,212,191,0.09),transparent_26%),linear-gradient(rgba(255,255,255,0.018)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.018)_1px,transparent_1px)] bg-[size:auto,auto,40px_40px,40px_40px]" aria-hidden="true" />
            <div className="tv-status-ambient pointer-events-none absolute -left-24 top-1/3 size-72 rounded-full bg-sky-500/10 blur-[100px]" aria-hidden="true" />

            <div className="relative z-10 flex min-h-screen flex-col">
                <header className="border-b border-white/[0.08] bg-[#091525]/90 px-4 py-4 backdrop-blur-xl sm:px-6 xl:px-8">
                    <div className="mx-auto flex w-full max-w-[2400px] flex-wrap items-center justify-between gap-4">
                        <div className="flex min-w-0 items-center gap-4">
                            <img
                                src={logo}
                                alt="iPawcus"
                                className="size-14 shrink-0 rounded-2xl bg-[#ffffff] object-contain p-1 shadow-[0_10px_35px_-16px_rgba(56,189,248,0.75)] sm:size-16"
                            />
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-sky-300 sm:text-xs">
                                    <Radio className="size-3.5" aria-hidden="true" />
                                    Live patient journey
                                </div>
                                <h1 className="mt-1 truncate text-xl font-black tracking-tight text-white sm:text-2xl 2xl:text-3xl">
                                    Clinic Status Board
                                </h1>
                                <p className="mt-1 hidden truncate text-xs font-semibold text-slate-500 sm:block">
                                    iPawcus · Vetfocus Animal Care Clinic
                                </p>
                            </div>
                        </div>

                        <div className="flex min-w-0 flex-1 items-center justify-end gap-3 sm:flex-none">
                            <label className="group hidden min-w-64 items-center gap-3 rounded-2xl border border-white/[0.09] bg-white/[0.04] px-3 py-2.5 transition-colors hover:bg-white/[0.06] md:flex">
                                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sky-300/10 text-sky-300">
                                    <Building2 className="size-4.5" aria-hidden="true" />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">Display location</span>
                                    <select
                                        value={selectedBranchCode}
                                        onChange={handleBranchChange}
                                        className="mt-0.5 w-full appearance-none truncate border-0 bg-transparent p-0 text-sm font-extrabold text-white outline-none focus:ring-0"
                                        aria-label="Select TV display location"
                                    >
                                        {branches.length > 0 ? branches.map((branch) => (
                                            <option className="bg-slate-900 text-white" key={branch.id || branch.code} value={branch.code || branch.id}>
                                                {branch.name}
                                            </option>
                                        )) : (
                                            <option className="bg-slate-900 text-white" value={branchCode}>{branchName}</option>
                                        )}
                                    </select>
                                </span>
                            </label>

                            <div className="flex items-center gap-3 rounded-2xl border border-white/[0.09] bg-white/[0.04] px-4 py-2.5 sm:px-5">
                                <div className="text-right">
                                    <p className="text-3xl font-black leading-none tracking-tight text-white tabular-nums sm:text-4xl 2xl:text-5xl">
                                        {formatClock(clock)}
                                    </p>
                                    <p className="mt-1.5 flex items-center justify-end gap-1.5 text-[10px] font-bold text-slate-400 sm:text-xs">
                                        <CalendarDays className="size-3.5 text-sky-300" aria-hidden="true" />
                                        {formatDate(clock)}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <label className="flex w-full items-center gap-3 rounded-xl border border-white/[0.09] bg-white/[0.04] px-3 py-2.5 md:hidden">
                            <Building2 className="size-4 shrink-0 text-sky-300" aria-hidden="true" />
                            <select
                                value={selectedBranchCode}
                                onChange={handleBranchChange}
                                className="w-full appearance-none truncate border-0 bg-transparent p-0 text-sm font-extrabold text-white outline-none focus:ring-0"
                                aria-label="Select TV display location"
                            >
                                {branches.length > 0 ? branches.map((branch) => (
                                    <option className="bg-slate-900 text-white" key={branch.id || branch.code} value={branch.code || branch.id}>
                                        {branch.name}
                                    </option>
                                )) : (
                                    <option className="bg-slate-900 text-white" value={branchCode}>{branchName}</option>
                                )}
                            </select>
                        </label>
                    </div>
                </header>

                <main className="mx-auto flex w-full max-w-[2400px] flex-1 flex-col gap-4 p-4 sm:p-5 xl:px-8 xl:py-5">
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.025] px-4 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sky-300/10 text-sky-300">
                                <MapPin className="size-4.5" aria-hidden="true" />
                            </span>
                            <div className="min-w-0">
                                <p className="truncate text-sm font-black text-white">{branchName}</p>
                                <p className="truncate text-[11px] font-semibold text-slate-500">{branchAddress}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-300">
                            <span className="relative flex size-2.5" aria-hidden="true">
                                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-300 opacity-50" />
                                <span className="relative inline-flex size-2.5 rounded-full bg-emerald-300" />
                            </span>
                            Connected · refreshes automatically
                        </div>
                    </div>

                    {error && (
                        <div className="flex items-center gap-3 rounded-2xl border border-rose-300/25 bg-rose-400/10 px-5 py-3.5 text-rose-100" role="alert">
                            <AlertTriangle className="size-6 shrink-0 text-rose-300" aria-hidden="true" />
                            <div>
                                <p className="font-black">Live update interrupted</p>
                                <p className="text-sm font-semibold text-rose-200/70">{error} Existing status remains visible while we reconnect.</p>
                            </div>
                        </div>
                    )}

                    {isInitialLoading && !statusData ? (
                        <div className="flex min-h-[58vh] flex-1 items-center justify-center rounded-[1.5rem] border border-white/[0.08] bg-white/[0.025]">
                            <div className="text-center">
                                <span className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-sky-300/10 text-sky-300">
                                    <Activity className="size-8 animate-pulse" aria-hidden="true" />
                                </span>
                                <p className="mt-5 text-2xl font-black text-white">Preparing the patient board</p>
                                <p className="mt-2 text-sm font-semibold text-slate-500">Connecting to today&apos;s clinic activity</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Today at a glance">
                                <Metric icon={UsersRound} label="Waiting" value={waiting.length} detail="Walk-ins and scheduled" tone="teal" />
                                <Metric icon={Stethoscope} label="In care" value={nowServing.length} detail="Currently with the team" tone="sky" />
                                <Metric icon={CreditCard} label="For payment" value={billing.length} detail="Please proceed to cashier" tone="amber" />
                                <Metric icon={CheckCircle2} label="Completed" value={completedToday} detail="Finished today" tone="emerald" />
                            </section>

                            <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-12">
                                <StatusPanel tone="serving" className="xl:col-span-5">
                                    <PanelHeader icon={Stethoscope} eyebrow="Currently in care" title="Now Serving" count={nowServing.length} tone="serving" />
                                    <div className="grid min-h-0 gap-3 p-4 2xl:grid-cols-2">
                                        {nowServing.length > 0 ? (
                                            nowServing.slice(0, DISPLAY_LIMITS.serving).map((item, index) => (
                                                <ServingCard key={item.id} item={item} index={index} />
                                            ))
                                        ) : (
                                            <EmptyPanel icon={Stethoscope} title="No patients in service" detail="The next patient will appear here." />
                                        )}
                                        <MoreItems count={Math.max(0, nowServing.length - DISPLAY_LIMITS.serving)} />
                                    </div>
                                </StatusPanel>

                                <StatusPanel tone="waiting" className="xl:col-span-4">
                                    <PanelHeader icon={PawPrint} eyebrow="Queue order" title="Waiting & Scheduled" count={waiting.length} tone="waiting" />
                                    <div className="grid min-h-0 gap-2.5 p-4 2xl:grid-cols-2">
                                        {waiting.length > 0 ? (
                                            waiting.slice(0, DISPLAY_LIMITS.waiting).map((item, index) => (
                                                <WaitingRow key={item.id} item={item} index={index} />
                                            ))
                                        ) : (
                                            <EmptyPanel icon={UsersRound} title="The waiting area is clear" detail="New arrivals will appear here." />
                                        )}
                                        <MoreItems count={Math.max(0, waiting.length - DISPLAY_LIMITS.waiting)} />
                                    </div>
                                </StatusPanel>

                                <StatusPanel tone="payment" className="xl:col-span-3">
                                    <PanelHeader icon={ReceiptText} eyebrow="Next step" title="For Payment" count={billing.length} tone="payment" />
                                    <div className="grid min-h-0 content-start gap-2.5 p-4">
                                        {billing.length > 0 ? (
                                            billing.slice(0, DISPLAY_LIMITS.payment).map((item, index) => (
                                                <PaymentCard key={item.id} item={item} index={index} />
                                            ))
                                        ) : (
                                            <EmptyPanel icon={CreditCard} title="No payments pending" detail="Payment calls will appear here." />
                                        )}
                                        <MoreItems count={Math.max(0, billing.length - DISPLAY_LIMITS.payment)} />
                                    </div>
                                </StatusPanel>
                            </div>
                        </>
                    )}
                </main>

                <footer className="border-t border-white/[0.08] bg-[#091525]/90 px-4 py-3 text-xs font-bold text-slate-500 sm:px-6 xl:px-8">
                    <div className="mx-auto flex w-full max-w-[2400px] flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <Wifi className="size-4 text-emerald-300" aria-hidden="true" />
                            <span>Please wait for your pet&apos;s name or reference number to be called.</span>
                        </div>
                        <span className="flex items-center gap-2 tabular-nums">
                            <Clock3 className="size-3.5" aria-hidden="true" />
                            {generatedAt ? `Last updated ${generatedAt}` : 'Waiting for first update'}
                        </span>
                    </div>
                </footer>
            </div>
        </div>
    );
}
