import { createElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Activity,
    AlertTriangle,
    Building2,
    CalendarDays,
    CreditCard,
    PawPrint,
    Radio,
    Stethoscope,
    Wifi,
} from 'lucide-react';

import logo from '../../assets/circular_logo.png';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { normalizeVisibleBranchCode } from '../../services/branchService';
import { fetchStatusDisplay } from '../../services/statusDisplayService';

const SECTION_LIMIT = 10;
const RESIZE_STORAGE_KEY = 'ipawcus-tv-status-left-column';
const DEFAULT_LEFT_COLUMN_PERCENT = 36;
const MIN_LEFT_COLUMN_PERCENT = 28;
const MAX_LEFT_COLUMN_PERCENT = 58;

function getInitialBranchCode() {
    if (typeof window === 'undefined') {
        return 'MAIN';
    }

    return normalizeVisibleBranchCode(
        new URLSearchParams(window.location.search).get('branch')
    );
}

const STATUS_TONES = {
    serving: {
        section: 'border-blue-200/80 bg-blue-50/70',
        headerIcon: 'bg-blue-600 text-white shadow-blue-200/80',
        count: 'bg-blue-600 text-white',
        item: 'border-blue-100 bg-white',
        accent: 'bg-blue-600',
        meta: 'text-blue-700',
        empty: 'border-blue-200 bg-white/80 text-blue-400',
    },
    payment: {
        section: 'border-amber-200/80 bg-amber-50/70',
        headerIcon: 'bg-amber-500 text-white shadow-amber-200/80',
        count: 'bg-amber-500 text-white',
        item: 'border-amber-100 bg-white',
        accent: 'bg-amber-500',
        meta: 'text-amber-700',
        empty: 'border-amber-200 bg-white/80 text-amber-500',
    },
    waiting: {
        section: 'border-cyan-200/80 bg-cyan-50/70',
        headerIcon: 'bg-cyan-600 text-white shadow-cyan-200/80',
        count: 'bg-cyan-600 text-white',
        item: 'border-cyan-100 bg-white',
        accent: 'bg-cyan-500',
        meta: 'text-cyan-700',
        empty: 'border-cyan-200 bg-white/80 text-cyan-500',
    },
};

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function getStoredLeftColumnPercent() {
    if (typeof window === 'undefined') {
        return DEFAULT_LEFT_COLUMN_PERCENT;
    }

    const storedValue = Number(window.localStorage.getItem(RESIZE_STORAGE_KEY));
    if (!Number.isFinite(storedValue)) {
        return DEFAULT_LEFT_COLUMN_PERCENT;
    }

    return clamp(storedValue, MIN_LEFT_COLUMN_PERCENT, MAX_LEFT_COLUMN_PERCENT);
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
        return 'Booking';
    }

    if (item.type === 'queue') {
        return 'Queue';
    }

    return '';
}

function WaitingListItem({ item, position }) {
    const label = sourceLabel(item);

    return (
        <article className="group relative flex min-h-16 items-center gap-4 overflow-hidden rounded-xl border border-cyan-100 bg-white px-4 py-3 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-cyan-200 hover:shadow-md">
            <span className="absolute inset-y-0 left-0 w-1 bg-cyan-500" aria-hidden="true" />
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-cyan-50 text-lg font-black text-cyan-700">
                {position}
            </span>
            <p className="min-w-0 flex-1 truncate text-2xl font-black text-slate-950">{item.petName}</p>
            {label && (
                <span className="shrink-0 rounded-md bg-slate-100 px-2.5 py-1 text-xs font-black uppercase tracking-wide text-slate-500">
                    {label}
                </span>
            )}
        </article>
    );
}

function StatusItem({ item, showVeterinarian = false, tone = 'serving' }) {
    const time = formatTime(item.time);
    const species = item.species ? ` ${item.species}` : '';
    const veterinarianName = String(item.veterinarianName || '').trim();
    const toneClasses = STATUS_TONES[tone] || STATUS_TONES.serving;

    return (
        <article className={`group relative grid min-h-24 grid-cols-1 items-center gap-3 overflow-hidden rounded-xl border p-4 pl-5 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-md sm:grid-cols-[1fr,auto] sm:gap-4 ${toneClasses.item}`}>
            <span className={`absolute inset-y-0 left-0 w-1.5 ${toneClasses.accent}`} aria-hidden="true" />
            <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <p className="truncate text-3xl font-black text-slate-950">{item.petName}</p>
                    {item.petStatus && item.petStatus !== 'Healthy' && (
                        <span className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-black uppercase tracking-wide text-rose-700">
                            {item.petStatus}
                        </span>
                    )}
                </div>
                <p className="mt-1 truncate text-lg font-bold text-slate-600">{item.service}{species}</p>
                {showVeterinarian && veterinarianName && (
                    <p className="mt-1 truncate text-base font-bold text-slate-500">{veterinarianName}</p>
                )}
                <p className={`mt-1 text-sm font-black uppercase tracking-wide ${toneClasses.meta}`}>Ref {item.reference}</p>
            </div>
            <div className="flex min-w-28 flex-col items-start gap-2 sm:items-end">
                {time && (
                    <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-black uppercase text-slate-700">
                        {time}
                    </p>
                )}
            </div>
        </article>
    );
}

function StatusSection({ title, icon, items, emptyLabel, tone = 'serving', className = '', limit = SECTION_LIMIT, showVeterinarian = false, compactList = false }) {
    const visibleItems = normalizeItems(items).slice(0, limit);
    const toneClasses = STATUS_TONES[tone] || STATUS_TONES.serving;

    return (
        <section className={`min-h-0 rounded-2xl border p-4 shadow-[0_18px_45px_-32px_rgba(15,23,42,0.45)] ${toneClasses.section} ${className}`}>
            <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className={`rounded-xl p-2.5 shadow-lg ${toneClasses.headerIcon}`}>
                        {createElement(icon, { className: 'size-6' })}
                    </div>
                    <h2 className="text-xl font-black text-slate-950 sm:text-2xl">{title}</h2>
                </div>
                <span className={`min-w-11 rounded-lg px-3 py-1 text-center text-lg font-black shadow-sm ${toneClasses.count}`}>
                    {visibleItems.length}
                </span>
            </div>

            <div className="grid gap-3">
                {visibleItems.length > 0 ? (
                    visibleItems.map((item, index) => compactList ? (
                        <WaitingListItem key={item.id} item={item} position={index + 1} />
                    ) : (
                        <StatusItem key={item.id} item={item} showVeterinarian={showVeterinarian} tone={tone} />
                    ))
                ) : (
                    <div className={`flex min-h-24 items-center justify-center rounded-xl border border-dashed text-xl font-bold ${toneClasses.empty}`}>
                        {emptyLabel}
                    </div>
                )}
            </div>
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
    const [leftColumnPercent, setLeftColumnPercent] = useState(getStoredLeftColumnPercent);
    const layoutRef = useRef(null);

    useEffect(() => {
        document.title = 'iPawcus TV Status';
    }, []);

    useEffect(() => {
        const timerId = window.setInterval(() => setClock(new Date()), 1000);
        return () => window.clearInterval(timerId);
    }, []);

    useEffect(() => {
        window.localStorage.setItem(RESIZE_STORAGE_KEY, String(leftColumnPercent));
    }, [leftColumnPercent]);

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

    const nowServing = useMemo(() => {
        return normalizeItems(sections.queue).filter((item) => (
            ['In Service', 'Diagnosis Done'].includes(item.stage)
        ));
    }, [sections.queue]);

    const waiting = useMemo(() => {
        const queueWaiting = normalizeItems(sections.queue).filter((item) => (
            !['In Service', 'Diagnosis Done'].includes(item.stage)
        ));
        return [...queueWaiting, ...normalizeItems(sections.bookings)];
    }, [sections.bookings, sections.queue]);

    const billing = normalizeItems(sections.billing);
    const generatedAt = statusData?.generatedAt ? formatTime(statusData.generatedAt) : '';
    const selectedBranchCode = branches.find((branch) => (
        String(branch.code) === String(branchCode) || String(branch.id) === String(branchCode)
    ))?.code || normalizeVisibleBranchCode(branchCode);

    const resizeColumns = useCallback((clientX) => {
        const layout = layoutRef.current;
        if (!layout) {
            return;
        }

        const rect = layout.getBoundingClientRect();
        if (rect.width <= 0) {
            return;
        }

        const nextPercent = ((clientX - rect.left) / rect.width) * 100;
        setLeftColumnPercent(clamp(nextPercent, MIN_LEFT_COLUMN_PERCENT, MAX_LEFT_COLUMN_PERCENT));
    }, []);

    const startColumnResize = useCallback((event) => {
        event.preventDefault();
        resizeColumns(event.clientX);

        const handlePointerMove = (moveEvent) => {
            resizeColumns(moveEvent.clientX);
        };

        const handlePointerUp = () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };

        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp, { once: true });
    }, [resizeColumns]);

    return (
        <div className="theme-static-light relative flex min-h-screen flex-col overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 text-slate-950">
            <div className="pointer-events-none absolute -left-24 top-40 size-80 rounded-full bg-blue-300/20 blur-3xl" aria-hidden="true" />
            <div className="pointer-events-none absolute -right-28 bottom-16 size-96 rounded-full bg-cyan-300/25 blur-3xl" aria-hidden="true" />

            <header className="relative overflow-hidden bg-gradient-to-r from-[#0b2f6b] via-[#155dfc] to-[#0789b8] px-6 py-5 text-white shadow-xl">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(255,255,255,0.22),transparent_30%)]" aria-hidden="true" />
                <div className="relative mx-auto flex max-w-[2400px] flex-wrap items-center justify-between gap-5">
                    <div className="flex items-center gap-4">
                        <img src={logo} alt="iPawcus" className="size-14 shrink-0 rounded-full border-2 border-white/50 bg-white object-contain shadow-lg sm:size-16" />
                        <div>
                            <div className="mb-1 flex items-center gap-2 text-sm font-black uppercase tracking-[0.18em] text-cyan-100">
                                <Radio className="size-4" />
                                Live clinic status
                            </div>
                            <p className="mb-1 text-sm font-bold text-blue-100">{statusData?.branch?.name || 'VFC Pharmacy / Main Clinic'}</p>
                            <h1 className="text-2xl font-black leading-tight text-white sm:text-3xl xl:whitespace-nowrap xl:text-4xl">
                                iPawcus <span className="font-normal text-cyan-200">&infin;</span> Vetfocus Animal Care Clinic
                            </h1>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-stretch justify-end gap-3">
                        <label className="flex min-w-64 flex-col justify-center rounded-2xl border border-white/20 bg-white/10 px-4 py-3 shadow-lg backdrop-blur-sm">
                            <span className="mb-1 flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-cyan-100">
                                <Building2 className="size-4" aria-hidden="true" />
                                Display location
                            </span>
                            <select
                                value={selectedBranchCode}
                                onChange={handleBranchChange}
                                className="w-full rounded-lg border border-white/30 bg-white px-3 py-2 text-sm font-black text-slate-900 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-200"
                                aria-label="Select TV display location"
                            >
                                {branches.length > 0 ? branches.map((branch) => (
                                    <option key={branch.id || branch.code} value={branch.code || branch.id}>
                                        {branch.name}
                                    </option>
                                )) : (
                                    <option value={branchCode}>{statusData?.branch?.name || 'VFC Pharmacy / Main Clinic'}</option>
                                )}
                            </select>
                        </label>
                        <div className="rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-right shadow-lg backdrop-blur-sm">
                            <p className="text-4xl font-black leading-none text-white sm:text-5xl">{formatClock(clock)}</p>
                            <p className="mt-2 flex items-center justify-end gap-2 text-lg font-bold text-blue-100">
                                <CalendarDays className="size-5" />
                                {formatDate(clock)}
                            </p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="relative z-10 mx-auto grid w-full max-w-[2400px] flex-1 gap-5 p-5">
                {error && (
                    <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-5 py-4 text-rose-900 shadow-sm">
                        <AlertTriangle className="size-7 shrink-0" />
                        <p className="text-xl font-black">{error}</p>
                    </div>
                )}

                {isInitialLoading && !statusData ? (
                    <div className="flex min-h-[55vh] items-center justify-center rounded-2xl border border-blue-100 bg-white/90 shadow-xl">
                        <div className="text-center">
                            <Activity className="mx-auto size-14 animate-pulse text-blue-600" />
                            <p className="mt-4 text-2xl font-black text-slate-800">Loading live status</p>
                            <p className="mt-2 font-bold text-slate-500">Connecting to the clinic queue</p>
                        </div>
                    </div>
                ) : (
                    <div
                        ref={layoutRef}
                        className="grid min-h-0 gap-5 xl:grid-cols-[minmax(18rem,var(--tv-left-column))_0.75rem_minmax(24rem,1fr)]"
                        style={{ '--tv-left-column': `${leftColumnPercent}%` }}
                    >
                        <div className="grid min-h-0 gap-5">
                            <StatusSection
                                title="Now Serving"
                                icon={Stethoscope}
                                items={nowServing}
                                emptyLabel="No pets in service"
                                tone="serving"
                                showVeterinarian
                            />
                            <StatusSection
                                title="For Payment"
                                icon={CreditCard}
                                items={billing}
                                emptyLabel="No pets for payment"
                                tone="payment"
                            />
                        </div>
                        <button
                            type="button"
                            aria-label="Resize display columns"
                            className="hidden cursor-col-resize touch-none rounded-full border border-blue-200 bg-white/80 shadow-sm transition hover:border-blue-300 hover:bg-white xl:flex xl:min-h-full xl:items-center xl:justify-center"
                            onPointerDown={startColumnResize}
                            onDoubleClick={() => setLeftColumnPercent(DEFAULT_LEFT_COLUMN_PERCENT)}
                        >
                            <span className="h-14 w-1 rounded-full bg-blue-300" aria-hidden="true" />
                        </button>
                        <StatusSection
                            title="Waiting and Scheduled"
                            icon={PawPrint}
                            items={waiting}
                            emptyLabel="No waiting pets"
                            tone="waiting"
                            limit={16}
                            compactList
                        />
                    </div>
                )}
            </main>

            <footer className="relative z-10 border-t border-blue-100 bg-white/85 px-6 py-4 text-sm font-bold uppercase text-slate-500 backdrop-blur">
                <div className="mx-auto flex max-w-[2400px] flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <span className="relative flex size-3">
                            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                            <span className="relative inline-flex size-3 rounded-full bg-emerald-500" />
                        </span>
                        <Wifi className="size-5 text-emerald-600" />
                        <span className="text-slate-700">Live status</span>
                    </div>
                    <span>{generatedAt ? `Updated ${generatedAt}` : 'Waiting for update'}</span>
                </div>
            </footer>
        </div>
    );
}
