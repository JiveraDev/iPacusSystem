import { useCallback, useMemo, useState } from 'react';
import { AlertTriangle, Eye, ImageIcon, LayoutGrid, Loader2, RefreshCw, Table2 } from 'lucide-react';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { PhotoViewer } from '../../ui/photo-viewer';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { useDashboardUser } from '../dashboardRouter.jsx';
import { fetchPetMediaMonitoring } from '../../services/petMediaMonitoringService';
import { REPORT_QUICK_RANGES } from '../../services/reportService';
import DashboardPageHeader from '../shared/DashboardPageHeader';
import ProtectedImage from '../shared/ProtectedImage.jsx';
import ReportDateInput from './ReportDateInput';

const SOURCE_OPTIONS = [
    { value: 'all', label: 'All Sources' },
    { value: 'diagnosis', label: 'Diagnosis Uploads' },
    { value: 'booking', label: 'Pet Owner Uploads' },
    { value: 'queue', label: 'Queue Uploads' },
    { value: 'boarding', label: 'Boarding Images' }
];

function normalizeRole(role) {
    return String(role || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function canAccessMediaMonitoring(user) {
    return ['super_admin', 'superadmin', 'veterinarian'].includes(normalizeRole(user?.role));
}

function sourceLabel(value) {
    return SOURCE_OPTIONS.find(option => option.value === value)?.label || value || 'Image';
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
    } else if (value === 'this_quarter') {
        const quarterStartMonth = Math.floor(today.getMonth() / 3) * 3;
        start = new Date(today.getFullYear(), quarterStartMonth, 1);
        end = new Date(today.getFullYear(), quarterStartMonth + 3, 0);
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
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState('cards');
    const [viewer, setViewer] = useState(null);
    const selectedRangeLabel = useMemo(() => (
        REPORT_QUICK_RANGES.find(item => item.value === range)?.label || 'This Month'
    ), [range]);
    const visibleDateRange = useMemo(() => (
        range === 'custom'
            ? { start: customStart, end: customEnd }
            : quickRangeDates(range)
    ), [customEnd, customStart, range]);
    const handleCustomStartChange = (value) => {
        setRange('custom');
        setCustomStart(value);
    };
    const handleCustomEndChange = (value) => {
        setRange('custom');
        setCustomEnd(value);
    };

    const loadMedia = useCallback(async ({ isAutoRefresh = false } = {}) => {
        if (!canAccessMediaMonitoring(user)) {
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
        enabled: canAccessMediaMonitoring(user),
        refreshKey: `pet-media-monitoring:${range}:${customStart}:${customEnd}`
    });

    const media = useMemo(() => {
        const rows = Array.isArray(mediaData?.media) ? mediaData.media : [];
        const query = searchQuery.trim().toLowerCase();

        return rows.filter(item => {
            const matchesSource = sourceFilter === 'all' || item.source === sourceFilter;
            const searchable = [
                item.petName,
                item.ownerName,
                item.serviceName,
                item.label,
                item.name,
                item.bookingNumber,
                item.queueNumber,
                item.uploadedBy
            ].join(' ').toLowerCase();
            const matchesSearch = !query || searchable.includes(query);

            return matchesSource && matchesSearch;
        });
    }, [mediaData, searchQuery, sourceFilter]);

    if (!canAccessMediaMonitoring(user)) {
        return (
            <div className="rounded-xl border border-red-200 bg-red-50 p-6">
                <h1 className="text-xl font-black text-red-900">Media monitoring is restricted</h1>
                <p className="mt-2 text-sm font-semibold text-red-700">Only Super Admin and Veterinarian accounts can open pet media monitoring.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <DashboardPageHeader
                title="Pet Media Monitoring"
                description="Diagnosis images, prescription images, pet owner uploads, queue uploads, and boarding images."
                layout="stacked"
                toolbar={(
                    <div className="grid w-full gap-2 rounded-lg border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-950/60 sm:grid-cols-2 lg:grid-cols-[minmax(11rem,13rem)_minmax(10rem,11rem)_minmax(10rem,11rem)_minmax(8rem,max-content)] lg:items-end">
                        <div className="min-w-0">
                            <Label className="mb-1 block text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-300">Date Range</Label>
                            <Select value={range} onValueChange={setRange}>
                                <SelectTrigger className="w-full">
                                    <SelectValue displayValue={selectedRangeLabel} />
                                </SelectTrigger>
                                <SelectContent>
                                    {REPORT_QUICK_RANGES.map(item => (
                                        <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <ReportDateInput
                            label="Start"
                            value={visibleDateRange.start}
                            onChange={handleCustomStartChange}
                        />
                        <ReportDateInput
                            label="End"
                            value={visibleDateRange.end}
                            onChange={handleCustomEndChange}
                        />
                        <Button type="button" variant="outline" onClick={() => loadMedia()} disabled={isLoading} className="h-10 w-full justify-center gap-2 whitespace-nowrap px-3">
                            {isLoading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                            Refresh
                        </Button>
                    </div>
                )}
            />

            {errorMessage ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">{errorMessage}</div>
            ) : null}

            {Array.isArray(mediaData?.missing_data) && mediaData.missing_data.length ? (
                <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
                    <AlertTriangle className="mt-0.5 size-5 shrink-0" />
                    <div>{mediaData.missing_data.map(note => <p key={note}>{note}</p>)}</div>
                </div>
            ) : null}

            <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[14rem_minmax(0,1fr)_auto] lg:items-center">
                <Select value={sourceFilter} onValueChange={(value) => {
                    setSourceFilter(value);
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
                <Input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search pet, owner, service, booking, queue, diagnosis, or file name"
                />
                <div className="inline-flex w-full rounded-lg border border-slate-200 bg-slate-50 p-1 lg:w-auto" aria-label="Media display mode">
                    <Button
                        type="button"
                        size="sm"
                        variant={viewMode === 'cards' ? 'default' : 'ghost'}
                        onClick={() => setViewMode('cards')}
                        aria-pressed={viewMode === 'cards'}
                        className="flex-1 gap-2 lg:flex-none"
                    >
                        <LayoutGrid className="size-4" />
                        Cards
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        variant={viewMode === 'table' ? 'default' : 'ghost'}
                        onClick={() => setViewMode('table')}
                        aria-pressed={viewMode === 'table'}
                        className="flex-1 gap-2 lg:flex-none"
                    >
                        <Table2 className="size-4" />
                        Table
                    </Button>
                </div>
            </div>

            {isLoading && !mediaData ? (
                <div className="flex min-h-[24rem] items-center justify-center rounded-xl border border-slate-200 bg-white">
                    <Loader2 className="size-8 animate-spin text-[#155dfc]" />
                </div>
            ) : (
                <section className="min-w-0">
                        {media.length === 0 ? (
                            <div className="flex min-h-[24rem] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
                                <div>
                                    <ImageIcon className="mx-auto mb-3 size-10 text-slate-300" />
                                    <p className="font-black text-slate-900">No images found</p>
                                    <p className="mt-1 text-sm font-semibold text-slate-500">Try another source filter or search term.</p>
                                </div>
                            </div>
                        ) : viewMode === 'table' ? (
                            <MediaTable media={media} onPreview={setViewer} />
                        ) : (
                            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
                                {media.map(item => (
                                    <MediaCard key={item.id} item={item} onPreview={setViewer} />
                                ))}
                            </div>
                        )}
                    </section>
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

function MediaCard({ item, onPreview }) {
    const src = item.url || item.path || '';

    return (
        <article className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <button
                type="button"
                onClick={() => onPreview({ src, alt: item.label || item.name || 'Pet media' })}
                className="group block w-full bg-slate-100 text-left focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#155dfc]"
                aria-label={`View ${item.label || item.name || 'pet media'}`}
            >
                <div className="aspect-[4/3] overflow-hidden">
                    <ProtectedImage
                        src={src}
                        alt={item.label || item.name || 'Pet media'}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                        fallbackClassName="h-full w-full"
                    />
                </div>
            </button>
            <div className="space-y-2.5 p-3">
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    <Badge className={`border-0 text-[10px] ${sourceTone(item.source)}`}>{sourceLabel(item.source)}</Badge>
                    {item.status ? <Badge className="border-0 bg-slate-100 text-[10px] text-slate-700">{item.status}</Badge> : null}
                </div>
                <div>
                    <p className="line-clamp-2 text-sm font-black leading-5 text-slate-950">{item.label || item.name || 'Pet media'}</p>
                    <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-500">{item.name || 'Image file'}</p>
                </div>
                <dl className="grid gap-1.5 text-[11px] font-semibold text-slate-500">
                    <Detail label="Pet" value={item.petName} />
                    <Detail label="Owner" value={item.ownerName} />
                    <Detail label="Service" value={item.serviceName || 'N/A'} />
                    <Detail label="Date" value={formatDate(item.createdAt)} />
                </dl>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onPreview({ src, alt: item.label || item.name || 'Pet media' })}
                    className="h-8 w-full gap-1.5 text-xs"
                >
                    <Eye className="size-3.5" />
                    View
                </Button>
            </div>
        </article>
    );
}

function MediaTable({ media, onPreview }) {
    return (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
                <table className="min-w-[960px] w-full text-left text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500">
                        <tr>
                            <th className="px-4 py-3">Media</th>
                            <th className="px-4 py-3">Source</th>
                            <th className="px-4 py-3">Pet / Owner</th>
                            <th className="px-4 py-3">Service</th>
                            <th className="px-4 py-3">Uploaded</th>
                            <th className="px-4 py-3 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {media.map(item => {
                            const src = item.url || item.path || '';
                            const title = item.label || item.name || 'Pet media';

                            return (
                                <tr key={item.id} className="align-middle transition hover:bg-blue-50/40">
                                    <td className="px-4 py-3">
                                        <div className="flex min-w-0 items-center gap-3">
                                            <button
                                                type="button"
                                                onClick={() => onPreview({ src, alt: title })}
                                                className="size-14 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 focus:outline-none focus:ring-2 focus:ring-[#155dfc]"
                                                aria-label={`View ${title}`}
                                            >
                                                <ProtectedImage
                                                    src={src}
                                                    alt={title}
                                                    className="size-full object-cover"
                                                    fallbackClassName="size-full"
                                                />
                                            </button>
                                            <div className="min-w-0">
                                                <p className="max-w-xs truncate font-black text-slate-900">{title}</p>
                                                <p className="mt-0.5 max-w-xs truncate text-xs font-semibold text-slate-500">{item.name || 'Image file'}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex flex-wrap gap-1.5">
                                            <Badge className={`border-0 ${sourceTone(item.source)}`}>{sourceLabel(item.source)}</Badge>
                                            {item.status ? <Badge className="border-0 bg-slate-100 text-slate-700">{item.status}</Badge> : null}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <p className="font-bold text-slate-800">{item.petName || 'N/A'}</p>
                                        <p className="mt-0.5 text-xs font-semibold text-slate-500">{item.ownerName || 'N/A'}</p>
                                    </td>
                                    <td className="max-w-56 px-4 py-3 font-semibold text-slate-700">
                                        <p className="truncate">{item.serviceName || 'N/A'}</p>
                                    </td>
                                    <td className="px-4 py-3">
                                        <p className="font-semibold text-slate-700">{formatDate(item.createdAt)}</p>
                                        {item.uploadedBy ? <p className="mt-0.5 text-xs font-semibold text-slate-500">By {item.uploadedBy}</p> : null}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => onPreview({ src, alt: title })}
                                            className="gap-1.5"
                                        >
                                            <Eye className="size-4" />
                                            View
                                        </Button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function Detail({ label, value }) {
    return (
        <div className="grid grid-cols-[3.25rem_minmax(0,1fr)] gap-1.5">
            <dt className="text-slate-400">{label}</dt>
            <dd className="truncate text-slate-700">{value || 'N/A'}</dd>
        </div>
    );
}
