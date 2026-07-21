import { createElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Activity,
    AlertTriangle,
    CreditCard,
    PawPrint,
    Stethoscope,
    Wifi,
} from 'lucide-react';

import logo from '../../assets/circular_logo.png';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { fetchStatusDisplay } from '../../services/statusDisplayService';

const SECTION_LIMIT = 10;
const RESIZE_STORAGE_KEY = 'ipawcus-tv-status-left-column';
const DEFAULT_LEFT_COLUMN_PERCENT = 36;
const MIN_LEFT_COLUMN_PERCENT = 28;
const MAX_LEFT_COLUMN_PERCENT = 58;

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

function WaitingListItem({ item }) {
    const label = sourceLabel(item);

    return (
        <article className="flex min-h-16 items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="min-w-0 truncate text-2xl font-black text-slate-950">{item.petName}</p>
            {label && (
                <span className="shrink-0 text-sm font-black uppercase text-slate-400">
                    {label}
                </span>
            )}
        </article>
    );
}

function StatusItem({ item, showVeterinarian = false }) {
    const time = formatTime(item.time);
    const species = item.species ? ` ${item.species}` : '';
    const veterinarianName = String(item.veterinarianName || '').trim();

    return (
        <article className="grid min-h-24 grid-cols-[1fr,auto] items-center gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <p className="truncate text-3xl font-black text-slate-950">{item.petName}</p>
                    {item.petStatus && item.petStatus !== 'Healthy' && (
                        <span className="rounded-md border border-rose-100 bg-rose-50 px-2 py-1 text-sm font-black uppercase text-rose-700">
                            {item.petStatus}
                        </span>
                    )}
                </div>
                <p className="mt-1 truncate text-lg font-bold text-slate-600">{item.service}{species}</p>
                {showVeterinarian && veterinarianName && (
                    <p className="mt-1 truncate text-base font-bold text-slate-500">{veterinarianName}</p>
                )}
                <p className="mt-1 text-sm font-black uppercase text-slate-400">Ref {item.reference}</p>
            </div>
            <div className="flex min-w-28 flex-col items-end gap-2">
                {time && <p className="text-sm font-bold uppercase text-slate-500">{time}</p>}
            </div>
        </article>
    );
}

function StatusSection({ title, icon, items, emptyLabel, className = '', limit = SECTION_LIMIT, showVeterinarian = false, compactList = false }) {
    const visibleItems = normalizeItems(items).slice(0, limit);

    return (
        <section className={`min-h-0 rounded-lg border border-slate-200 bg-slate-50 p-4 ${className}`}>
            <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="rounded-md bg-white p-2 text-slate-800 shadow-sm">
                        {createElement(icon, { className: 'size-6' })}
                    </div>
                    <h2 className="text-2xl font-black text-slate-950">{title}</h2>
                </div>
                <span className="rounded-md bg-white px-3 py-1 text-lg font-black text-slate-700 shadow-sm">
                    {visibleItems.length}
                </span>
            </div>

            <div className="grid gap-3">
                {visibleItems.length > 0 ? (
                    visibleItems.map((item) => compactList ? (
                        <WaitingListItem key={item.id} item={item} />
                    ) : (
                        <StatusItem key={item.id} item={item} showVeterinarian={showVeterinarian} />
                    ))
                ) : (
                    <div className="flex min-h-24 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white text-xl font-bold text-slate-400">
                        {emptyLabel}
                    </div>
                )}
            </div>
        </section>
    );
}

export default function TVStatusDisplay() {
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
            const data = await fetchStatusDisplay();
            setStatusData(data);
            setError('');
        } catch (loadError) {
            setError(loadError.message || 'Unable to load status display.');
        } finally {
            if (!isAutoRefresh) {
                setIsInitialLoading(false);
            }
        }
    }, []);

    useAutoRefresh(loadStatus, {
        intervalMs: Math.max(4000, Number(statusData?.refreshSeconds || 8) * 1000),
        refreshKey: statusData?.refreshSeconds || 'initial',
    });

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
        <div className="min-h-screen bg-[#f5f7fb] text-slate-950">
            <header className="border-b border-slate-200 bg-white px-6 py-5">
                <div className="flex flex-wrap items-center justify-between gap-5">
                    <div className="flex items-center gap-4">
                        <img src={logo} alt="iPawcus" className="size-16 shrink-0 rounded-full bg-white object-contain" />
                        <div>
                            <h1 className="whitespace-nowrap text-4xl font-black leading-tight text-slate-950">
                                iPawcus <span className="font-normal">∞</span> Vetfocus Animal Care Clinic
                            </h1>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-5xl font-black leading-none text-slate-950">{formatClock(clock)}</p>
                        <p className="mt-2 text-lg font-bold text-slate-500">{formatDate(clock)}</p>
                    </div>
                </div>
            </header>

            <main className="grid gap-5 p-5">
                {error && (
                    <div className="flex items-center gap-3 rounded-lg border border-rose-200 bg-rose-50 px-5 py-4 text-rose-900">
                        <AlertTriangle className="size-7 shrink-0" />
                        <p className="text-xl font-black">{error}</p>
                    </div>
                )}

                {isInitialLoading && !statusData ? (
                    <div className="flex min-h-[55vh] items-center justify-center rounded-lg border border-slate-200 bg-white">
                        <div className="text-center">
                            <Activity className="mx-auto size-14 animate-pulse text-blue-600" />
                            <p className="mt-4 text-2xl font-black text-slate-700">Loading live status</p>
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
                                showVeterinarian
                            />
                            <StatusSection
                                title="For Payment"
                                icon={CreditCard}
                                items={billing}
                                emptyLabel="No pets for payment"
                            />
                        </div>
                        <button
                            type="button"
                            aria-label="Resize display columns"
                            className="hidden cursor-col-resize touch-none rounded-full border border-slate-200 bg-white shadow-sm transition hover:border-slate-300 hover:bg-slate-50 xl:flex xl:min-h-full xl:items-center xl:justify-center"
                            onPointerDown={startColumnResize}
                            onDoubleClick={() => setLeftColumnPercent(DEFAULT_LEFT_COLUMN_PERCENT)}
                        >
                            <span className="h-14 w-1 rounded-full bg-slate-300" aria-hidden="true" />
                        </button>
                        <StatusSection
                            title="Waiting and Scheduled"
                            icon={PawPrint}
                            items={waiting}
                            emptyLabel="No waiting pets"
                            limit={16}
                            compactList
                        />
                    </div>
                )}
            </main>

            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-6 py-4 text-sm font-bold uppercase text-slate-500">
                <div className="flex items-center gap-2">
                    <Wifi className="size-5 text-emerald-600" />
                    <span>Live status</span>
                </div>
                <span>{generatedAt ? `Updated ${generatedAt}` : 'Waiting for update'}</span>
            </footer>
        </div>
    );
}
