import { createElement, useCallback, useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, Camera, ImageIcon, Loader2, RefreshCw, ShieldCheck, Stethoscope } from 'lucide-react';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Card, CardContent } from '../../ui/card';
import { Input } from '../../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { PhotoViewer } from '../../ui/photo-viewer';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { resolveImageUrl } from '../../lib/image';
import { useDashboardUser } from '../dashboardRouter.jsx';
import { fetchPetMediaMonitoring } from '../../services/petMediaMonitoringService';

const SOURCE_OPTIONS = [
    { value: 'all', label: 'All Sources' },
    { value: 'consent', label: 'Consent Images' },
    { value: 'diagnosis', label: 'Diagnosis Uploads' },
    { value: 'booking', label: 'Booking Images' },
    { value: 'queue', label: 'Queue Images' },
    { value: 'boarding', label: 'Boarding Images' }
];

const DATE_RANGE_OPTIONS = [
    { value: 'today', label: 'Today' },
    { value: 'this_week', label: 'This Week' },
    { value: 'this_month', label: 'This Month' },
    { value: 'this_year', label: 'This Year' },
    { value: 'custom', label: 'Custom Date Range' }
];

function normalizeRole(role) {
    return String(role || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function isSuperAdmin(user) {
    return ['super_admin', 'superadmin'].includes(normalizeRole(user?.role));
}

function sourceLabel(value) {
    return SOURCE_OPTIONS.find(option => option.value === value)?.label || value || 'Image';
}

function dateRangeLabel(value) {
    return DATE_RANGE_OPTIONS.find(option => option.value === value)?.label || 'This Month';
}

function dateInputValue(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

function clinicToday() {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric'
    }).formatToParts(new Date()).reduce((values, part) => {
        if (part.type !== 'literal') {
            values[part.type] = Number(part.value);
        }
        return values;
    }, {});

    return new Date(parts.year, parts.month - 1, parts.day);
}

function quickRangeDates(value) {
    const today = clinicToday();
    let start = new Date(today);
    let end = new Date(today);

    if (value === 'this_week') {
        const weekday = today.getDay();
        const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
        start = new Date(today.getFullYear(), today.getMonth(), today.getDate() + mondayOffset);
        end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
    } else if (value === 'this_year') {
        start = new Date(today.getFullYear(), 0, 1);
        end = new Date(today.getFullYear(), 11, 31);
    } else if (value !== 'today') {
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    }

    return {
        start: dateInputValue(start),
        end: dateInputValue(end)
    };
}

function sourceTone(source) {
    if (source === 'consent') return 'bg-emerald-50 text-emerald-700';
    if (source === 'diagnosis') return 'bg-blue-50 text-blue-700';
    if (source === 'boarding') return 'bg-violet-50 text-violet-700';
    if (source === 'queue') return 'bg-amber-50 text-amber-700';

    return 'bg-slate-100 text-slate-700';
}

function formatDate(value) {
    if (!value) return 'No date';
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleString();
}

export default function PetMediaMonitoring() {
    const user = useDashboardUser();
    const [mediaData, setMediaData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');
    const [range, setRange] = useState('this_month');
    const [customStart, setCustomStart] = useState(() => quickRangeDates('this_month').start);
    const [customEnd, setCustomEnd] = useState(() => quickRangeDates('this_month').end);
    const [sourceFilter, setSourceFilter] = useState('all');
    const [selectedPetId, setSelectedPetId] = useState('all');
    const [viewer, setViewer] = useState(null);

    const loadMedia = useCallback(async ({ isAutoRefresh = false } = {}) => {
        if (!isSuperAdmin(user)) {
            setIsLoading(false);
            return;
        }

        if (!isAutoRefresh) {
            setIsLoading(true);
        }
        setErrorMessage('');

        try {
            if (range === 'custom' && (!customStart || !customEnd || customStart > customEnd)) {
                setErrorMessage('Use a valid custom date range where Start is before or equal to End.');
                return;
            }

            const data = await fetchPetMediaMonitoring({
                user,
                range,
                startDate: range === 'custom' ? customStart : undefined,
                endDate: range === 'custom' ? customEnd : undefined
            });
            setMediaData(data);
        } catch (error) {
            setErrorMessage(error.message || 'Pet media monitoring could not be loaded.');
        } finally {
            setIsLoading(false);
        }
    }, [customEnd, customStart, range, user]);

    useAutoRefresh(loadMedia, {
        enabled: isSuperAdmin(user),
        refreshKey: `pet-media-monitoring:${range}:${customStart}:${customEnd}`
    });

    const visibleDateRange = range === 'custom'
        ? { start: customStart, end: customEnd }
        : quickRangeDates(range);

    const media = useMemo(() => {
        const rows = Array.isArray(mediaData?.media) ? mediaData.media : [];

        return rows.filter(item => {
            const matchesSource = sourceFilter === 'all' || item.source === sourceFilter;
            const matchesPet = selectedPetId === 'all' || String(item.petId || 'unlinked') === selectedPetId;

            return matchesSource && matchesPet;
        });
    }, [mediaData, selectedPetId, sourceFilter]);

    const petGroups = useMemo(() => {
        const rows = Array.isArray(mediaData?.media) ? mediaData.media : [];
        const groups = new Map();

        rows
            .filter(item => sourceFilter === 'all' || item.source === sourceFilter)
            .forEach(item => {
                const key = String(item.petId || 'unlinked');
                const existing = groups.get(key) || {
                    petId: item.petId,
                    petName: item.petName || 'Unlinked Pet',
                    ownerName: item.ownerName || 'Unknown Owner',
                    petSpecies: item.petSpecies || '',
                    petBreed: item.petBreed || '',
                    mediaCount: 0
                };
                existing.mediaCount += 1;
                groups.set(key, existing);
            });

        return Array.from(groups.values()).sort((a, b) => b.mediaCount - a.mediaCount || a.petName.localeCompare(b.petName));
    }, [mediaData, sourceFilter]);

    const totals = mediaData?.totals || {};
    const allFilteredCount = petGroups.reduce((sum, pet) => sum + pet.mediaCount, 0);

    if (!isSuperAdmin(user)) {
        return (
            <div className="rounded-xl border border-red-200 bg-red-50 p-6">
                <h1 className="text-xl font-black text-red-900">Media monitoring is restricted</h1>
                <p className="mt-2 text-sm font-semibold text-red-700">Only Super Admin accounts can open pet media monitoring.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_46%,#f0fdf4_100%)] p-5 shadow-sm">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                    <div>
                        <div className="mb-3 flex w-fit items-center gap-2 rounded-full border border-emerald-100 bg-white/85 px-3 py-1 text-xs font-black uppercase tracking-wide text-emerald-700">
                            <ShieldCheck className="size-3.5" />
                            Super Admin Monitoring
                        </div>
                        <h1 className="text-3xl font-black tracking-tight text-slate-950">Pet Media Monitoring</h1>
                        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
                            Consent copies, booking and queue concern images, diagnosis uploads, and boarding images.
                        </p>
                    </div>

                    <div className="grid gap-3 rounded-xl border border-slate-200 bg-white/90 p-3 shadow-sm sm:grid-cols-[11rem_12rem_9rem_9rem_auto]">
                        <Select value={range} onValueChange={(value) => {
                            setRange(value);
                            setSelectedPetId('all');
                        }}>
                            <SelectTrigger>
                                <SelectValue displayValue={dateRangeLabel(range)} />
                            </SelectTrigger>
                            <SelectContent>
                                {DATE_RANGE_OPTIONS.map(option => (
                                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={sourceFilter} onValueChange={(value) => {
                            setSourceFilter(value);
                            setSelectedPetId('all');
                        }}>
                            <SelectTrigger>
                                <SelectValue displayValue={sourceLabel(sourceFilter)} />
                            </SelectTrigger>
                            <SelectContent>
                                {SOURCE_OPTIONS.map(option => (
                                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <div className="relative">
                            <CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                            <Input
                                type="date"
                                value={visibleDateRange.start}
                                onChange={(event) => setCustomStart(event.target.value)}
                                disabled={range !== 'custom'}
                                className="pl-9"
                            />
                        </div>
                        <Input
                            type="date"
                            value={visibleDateRange.end}
                            onChange={(event) => setCustomEnd(event.target.value)}
                            disabled={range !== 'custom'}
                        />
                        <Button type="button" variant="outline" onClick={() => loadMedia()} disabled={isLoading} className="gap-2">
                            {isLoading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                            Refresh
                        </Button>
                    </div>
                </div>
            </div>

            {errorMessage ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">{errorMessage}</div>
            ) : null}

            {Array.isArray(mediaData?.missing_data) && mediaData.missing_data.length ? (
                <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
                    <AlertTriangle className="mt-0.5 size-5 shrink-0" />
                    <div>{mediaData.missing_data.map(note => <p key={note}>{note}</p>)}</div>
                </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <Metric icon={ImageIcon} label="Images" value={totals.images || 0} />
                <Metric icon={Camera} label="Pets With Media" value={totals.pets || 0} />
                <Metric icon={ShieldCheck} label="Consent" value={totals.consent || 0} />
                <Metric icon={Stethoscope} label="Diagnosis" value={totals.diagnosis || 0} />
                <Metric icon={Camera} label="Filtered" value={allFilteredCount} />
            </div>

            {isLoading && !mediaData ? (
                <div className="flex min-h-[24rem] items-center justify-center rounded-xl border border-slate-200 bg-white">
                    <Loader2 className="size-8 animate-spin text-[#155dfc]" />
                </div>
            ) : (
                <div className="grid gap-5 xl:grid-cols-[21rem_1fr]">
                    <aside className="space-y-3">
                        <button
                            type="button"
                            onClick={() => setSelectedPetId('all')}
                            className={`w-full rounded-xl border p-4 text-left transition ${selectedPetId === 'all' ? 'border-[#155dfc] bg-blue-50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                        >
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="font-black text-slate-950">All Pet Media</p>
                                    <p className="mt-1 text-xs font-semibold text-slate-500">Grouped monitoring view</p>
                                </div>
                                <Badge className="border-0 bg-slate-900 text-white">{allFilteredCount}</Badge>
                            </div>
                        </button>

                        <div className="max-h-[38rem] space-y-2 overflow-y-auto pr-1">
                            {petGroups.map(pet => {
                                const key = String(pet.petId || 'unlinked');
                                return (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => setSelectedPetId(key)}
                                        className={`w-full rounded-xl border p-4 text-left transition ${selectedPetId === key ? 'border-[#155dfc] bg-blue-50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="truncate font-black text-slate-950">{pet.petName}</p>
                                                <p className="mt-1 truncate text-xs font-semibold text-slate-500">{pet.ownerName}</p>
                                                <p className="mt-1 truncate text-xs font-semibold text-slate-400">
                                                    {[pet.petSpecies, pet.petBreed].filter(Boolean).join(' / ') || 'No pet type'}
                                                </p>
                                            </div>
                                            <Badge className="border-0 bg-slate-100 text-slate-700">{pet.mediaCount}</Badge>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </aside>

                    <section className="min-w-0">
                        {media.length === 0 ? (
                            <div className="flex min-h-[24rem] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
                                <div>
                                    <ImageIcon className="mx-auto mb-3 size-10 text-slate-300" />
                                    <p className="font-black text-slate-900">No images found</p>
                                    <p className="mt-1 text-sm font-semibold text-slate-500">Try another source filter or search term.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                                {media.map(item => (
                                    <MediaCard key={item.id} item={item} onPreview={setViewer} />
                                ))}
                            </div>
                        )}
                    </section>
                </div>
            )}

            <PhotoViewer
                open={Boolean(viewer)}
                src={viewer?.src || ''}
                alt={viewer?.alt || 'Pet media'}
                onOpenChange={(open) => !open && setViewer(null)}
            />
        </div>
    );
}

function Metric({ icon, label, value }) {
    return (
        <Card className="border-slate-200 bg-white shadow-sm">
            <CardContent className="flex items-center justify-between gap-4 p-4">
                <div>
                    <p className="text-xs font-black uppercase tracking-wide text-slate-400">{label}</p>
                    <p className="mt-1 text-2xl font-black text-slate-950">{value}</p>
                </div>
                <div className="flex size-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                    {icon ? createElement(icon, { className: 'size-5' }) : null}
                </div>
            </CardContent>
        </Card>
    );
}

function MediaCard({ item, onPreview }) {
    const src = resolveImageUrl(item.url || item.path || '');

    return (
        <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <button
                type="button"
                onClick={() => onPreview({ src, alt: item.label || item.name || 'Pet media' })}
                className="group block w-full bg-slate-100 text-left"
            >
                <div className="aspect-[4/3] overflow-hidden">
                    <img
                        src={src}
                        alt={item.label || item.name || 'Pet media'}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                        loading="lazy"
                    />
                </div>
            </button>
            <div className="space-y-3 p-4">
                <div className="flex flex-wrap items-center gap-2">
                    <Badge className={`border-0 ${sourceTone(item.source)}`}>{sourceLabel(item.source)}</Badge>
                    {item.status ? <Badge className="border-0 bg-slate-100 text-slate-700">{item.status}</Badge> : null}
                </div>
                <div>
                    <p className="line-clamp-2 font-black text-slate-950">{item.label || item.name || 'Pet media'}</p>
                    <p className="mt-1 truncate text-xs font-semibold text-slate-500">{item.name || 'Image file'}</p>
                </div>
                <dl className="grid gap-2 text-xs font-semibold text-slate-500">
                    <Detail label="Pet" value={item.petName} />
                    <Detail label="Owner" value={item.ownerName} />
                    <Detail label="Service" value={item.serviceName || 'N/A'} />
                    <Detail label="Date" value={formatDate(item.createdAt)} />
                    {item.uploadedBy ? <Detail label="By" value={item.uploadedBy} /> : null}
                </dl>
                <a
                    href={src}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex text-xs font-black uppercase tracking-wide text-[#155dfc] hover:underline"
                >
                    Open original
                </a>
            </div>
        </article>
    );
}

function Detail({ label, value }) {
    return (
        <div className="grid grid-cols-[4.5rem_1fr] gap-2">
            <dt className="text-slate-400">{label}</dt>
            <dd className="truncate text-slate-700">{value || 'N/A'}</dd>
        </div>
    );
}
