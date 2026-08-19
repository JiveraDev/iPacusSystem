import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    AlertTriangle,
    ChevronLeft,
    ChevronRight,
    FileText,
    Folder,
    ImageIcon,
    LayoutGrid,
    List,
    Loader2,
    PawPrint,
    RefreshCw,
    Search,
    X
} from 'lucide-react';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { PhotoViewer } from '../../ui/photo-viewer';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { openProtectedDocument } from '../../hooks/useConsentDocumentSource';
import { useDashboardUser } from '../dashboardRouter.jsx';
import { fetchPetMediaMonitoring } from '../../services/petMediaMonitoringService';
import { fetchAllPets } from '../../services/petService';
import DashboardPageHeader from '../shared/DashboardPageHeader';
import ProtectedImage from '../shared/ProtectedImage.jsx';

function normalizeRole(role) {
    return String(role || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function canAccessMediaMonitoring(user) {
    return ['super_admin', 'superadmin', 'veterinarian'].includes(normalizeRole(user?.role));
}

function petId(pet) {
    return String(pet?.db_id || pet?.petId || pet?.pet_id || '');
}

function petName(pet) {
    return pet?.petName || pet?.name || 'Unnamed pet';
}

function petMetadata(pet) {
    return [
        pet?.id || pet?.pet_sharable_ID,
        pet?.species,
        pet?.breed,
        pet?.ownerName || pet?.tempOwnerName
    ].filter(Boolean).join(' / ');
}

function serviceName(item) {
    return String(item?.serviceName || '').trim() || 'General Records';
}

function isPdf(item) {
    const path = item?.url || item?.path || item?.name || '';
    return item?.kind === 'pdf'
        || item?.mediaType === 'pdf'
        || String(item?.mimeType || '').toLowerCase() === 'application/pdf'
        || /\.pdf(?:\?|$)/i.test(path);
}

function usefulFileName(item, title) {
    const name = String(item?.name || '').trim();
    if (!name) return '';

    const normalize = (value) => String(value || '')
        .replace(/\.[a-z0-9]{2,5}$/i, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '');
    if (normalize(name) === normalize(title)) return '';

    const generatedDocumentName = /^(?:prescription|consent|signed[-_ ]?consent|consent[-_ ]?document)[-_ ]?(?:\d{10,}|[a-f0-9]{12,})/i;
    return generatedDocumentName.test(name) ? '' : name;
}

function mediaDateGroup(item) {
    const date = new Date(item?.createdAt || '');
    if (Number.isNaN(date.getTime())) {
        return { key: 'undated', label: 'Date unavailable', timestamp: 0 };
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return {
        key: `${year}-${month}-${day}`,
        label: date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }),
        timestamp: new Date(year, date.getMonth(), date.getDate()).getTime()
    };
}

function groupMediaByServiceAndDate(media) {
    const services = new Map();

    media.forEach(item => {
        const service = serviceName(item);
        if (!services.has(service)) services.set(service, new Map());

        const dateGroup = mediaDateGroup(item);
        const dates = services.get(service);
        if (!dates.has(dateGroup.key)) dates.set(dateGroup.key, { ...dateGroup, items: [] });
        dates.get(dateGroup.key).items.push(item);
    });

    return [...services.entries()]
        .map(([service, dates]) => ({
            service,
            dates: [...dates.values()].sort((left, right) => right.timestamp - left.timestamp)
        }))
        .map(group => ({
            ...group,
            count: group.dates.reduce((total, date) => total + date.items.length, 0)
        }))
        .sort((left, right) => left.service.localeCompare(right.service));
}

export default function PetMediaMonitoring() {
    const user = useDashboardUser();
    const [pets, setPets] = useState([]);
    const [petSearch, setPetSearch] = useState('');
    const [isPetSearchOpen, setIsPetSearchOpen] = useState(false);
    const [selectedPetId, setSelectedPetId] = useState('');
    const [isLoadingPets, setIsLoadingPets] = useState(true);
    const [petLoadError, setPetLoadError] = useState('');
    const [mediaData, setMediaData] = useState(null);
    const [isLoadingMedia, setIsLoadingMedia] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [serviceFilter, setServiceFilter] = useState('all');
    const [viewMode, setViewMode] = useState('grid');
    const [viewer, setViewer] = useState(null);
    const [openingDocumentId, setOpeningDocumentId] = useState('');
    const mediaRequestIdRef = useRef(0);
    const selectedPetIdRef = useRef('');
    const selectedPet = useMemo(
        () => pets.find(pet => petId(pet) === String(selectedPetId)) || null,
        [pets, selectedPetId]
    );
    const loadPets = useCallback(async ({ isAutoRefresh = false } = {}) => {
        if (!canAccessMediaMonitoring(user)) {
            setIsLoadingPets(false);
            return;
        }
        if (!isAutoRefresh) setIsLoadingPets(true);
        setPetLoadError('');

        try {
            const data = await fetchAllPets();
            setPets(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Pet Media Monitoring pet directory failed to load:', error);
            if (!isAutoRefresh) setPetLoadError('The pet directory could not be loaded. Please try again.');
        } finally {
            if (!isAutoRefresh) setIsLoadingPets(false);
        }
    }, [user]);

    const loadMedia = useCallback(async ({ isAutoRefresh = false } = {}) => {
        if (!canAccessMediaMonitoring(user) || !selectedPetId) return;
        const requestedPetId = String(selectedPetId);
        const requestId = ++mediaRequestIdRef.current;
        if (!isAutoRefresh) setIsLoadingMedia(true);
        setErrorMessage('');

        try {
            const data = await fetchPetMediaMonitoring({
                user,
                petId: requestedPetId
            });
            if (mediaRequestIdRef.current !== requestId || selectedPetIdRef.current !== requestedPetId) return;
            setMediaData(data);
        } catch (error) {
            console.error(`Pet files and media failed to load for pet ${requestedPetId}:`, error);
            if (mediaRequestIdRef.current === requestId && selectedPetIdRef.current === requestedPetId && !isAutoRefresh) {
                setErrorMessage('This pet\'s files and media could not be loaded. Please try again.');
            }
        } finally {
            if (mediaRequestIdRef.current === requestId && selectedPetIdRef.current === requestedPetId) {
                setIsLoadingMedia(false);
            }
        }
    }, [selectedPetId, user]);

    useEffect(() => {
        selectedPetIdRef.current = String(selectedPetId);
    }, [selectedPetId]);

    useAutoRefresh(loadPets, {
        enabled: canAccessMediaMonitoring(user),
        refreshKey: 'pet-media-monitoring-pet-directory'
    });
    useAutoRefresh(loadMedia, {
        enabled: canAccessMediaMonitoring(user) && Boolean(selectedPetId),
        refreshKey: `pet-media-monitoring:${selectedPetId}`
    });

    const filteredPets = useMemo(() => {
        const query = petSearch.trim().toLowerCase();
        if (!query) return pets;

        return pets.filter(pet => [
            petName(pet),
            pet.id,
            pet.pet_sharable_ID,
            pet.db_id,
            pet.species,
            pet.breed,
            pet.ownerName,
            pet.tempOwnerName
        ].join(' ').toLowerCase().includes(query));
    }, [petSearch, pets]);
    const visiblePetOptions = filteredPets.slice(0, 10);

    const serviceOptions = useMemo(() => {
        const rows = Array.isArray(mediaData?.media) ? mediaData.media : [];
        return [...new Set(rows.map(serviceName))]
            .sort((left, right) => left.localeCompare(right));
    }, [mediaData]);

    useEffect(() => {
        if (serviceFilter !== 'all' && !serviceOptions.includes(serviceFilter)) {
            setServiceFilter('all');
        }
    }, [serviceFilter, serviceOptions]);

    const media = useMemo(() => {
        const rows = Array.isArray(mediaData?.media) ? mediaData.media : [];
        return serviceFilter === 'all'
            ? rows
            : rows.filter(item => serviceName(item) === serviceFilter);
    }, [mediaData, serviceFilter]);

    const mediaGroups = useMemo(() => groupMediaByServiceAndDate(media), [media]);

    const clearSelectedPet = (nextSearch = '') => {
        mediaRequestIdRef.current += 1;
        selectedPetIdRef.current = '';
        setSelectedPetId('');
        setPetSearch(nextSearch);
        setMediaData(null);
        setErrorMessage('');
        setServiceFilter('all');
        setViewer(null);
    };

    const selectPet = (pet) => {
        const nextPetId = petId(pet);
        if (!nextPetId) return;

        mediaRequestIdRef.current += 1;
        selectedPetIdRef.current = nextPetId;
        setSelectedPetId(nextPetId);
        setPetSearch(petName(pet));
        setIsPetSearchOpen(false);
        setMediaData(null);
        setErrorMessage('');
        setServiceFilter('all');
        setViewer(null);
        setIsLoadingMedia(true);
    };

    const refreshDirectoryAndMedia = async () => {
        await Promise.all([
            loadPets(),
            selectedPetId ? loadMedia() : Promise.resolve()
        ]);
    };

    const previewItem = async (item) => {
        const source = item?.url || item?.path || '';
        if (!source) return;
        if (!isPdf(item)) {
            setViewer({ src: source, alt: item.label || item.name || 'Pet media' });
            return;
        }

        setOpeningDocumentId(String(item.id));
        try {
            await openProtectedDocument(source);
        } catch (error) {
            console.error('Pet document preview failed:', error);
            setErrorMessage('The PDF preview could not be opened. Please try again.');
        } finally {
            setOpeningDocumentId('');
        }
    };

    if (!canAccessMediaMonitoring(user)) {
        return (
            <div className="rounded-xl border border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950/40">
                <h1 className="text-xl font-black text-red-900 dark:text-red-100">Media monitoring is restricted</h1>
                <p className="mt-2 text-sm font-semibold text-red-700 dark:text-red-200">Only Super Admin and Veterinarian accounts can open pet media monitoring.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <DashboardPageHeader
                title="Pet Files & Media"
                description="Select one pet to review its images, signed consent forms, prescriptions, invoices, and other PDF records."
                layout="stacked"
            />

            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <div className="grid gap-4 lg:grid-cols-[14rem_minmax(0,1fr)] lg:items-center">
                    <div>
                        <h2 className="flex items-center gap-2 text-base font-black text-slate-950 dark:text-white">
                            <PawPrint className="size-5 text-[#155dfc]" />
                            Find a pet
                        </h2>
                        <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">Search by pet name, clinic ID, species, breed, or owner.</p>
                    </div>
                    <div className="flex min-w-0 items-start gap-2">
                        <div
                            className="relative min-w-0 flex-1"
                            onBlur={(event) => {
                                if (!event.currentTarget.contains(event.relatedTarget)) setIsPetSearchOpen(false);
                            }}
                        >
                            <Label htmlFor="pet-media-pet-search" className="sr-only">Search and select a pet</Label>
                            <Input
                                id="pet-media-pet-search"
                                value={petSearch}
                                onChange={(event) => {
                                    const nextValue = event.target.value;
                                    if (selectedPetId) clearSelectedPet(nextValue);
                                    else setPetSearch(nextValue);
                                    setIsPetSearchOpen(true);
                                }}
                                onFocus={() => setIsPetSearchOpen(true)}
                                placeholder="Type to search and select a pet"
                                className="h-11 pr-11 text-base"
                                leftIcon={<Search className="size-4" />}
                            />
                            {petSearch ? (
                                <button
                                    type="button"
                                    onMouseDown={(event) => event.preventDefault()}
                                    onClick={() => {
                                        clearSelectedPet();
                                        setIsPetSearchOpen(true);
                                    }}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#155dfc] dark:hover:bg-slate-800 dark:hover:text-slate-200"
                                    aria-label="Clear selected pet"
                                >
                                    <X className="size-4" />
                                </button>
                            ) : null}

                            {isPetSearchOpen ? (
                                <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-80 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                                {isLoadingPets ? (
                                    <div className="flex items-center justify-center gap-2 p-5 text-sm font-semibold text-slate-500 dark:text-slate-400">
                                        <Loader2 className="size-4 animate-spin text-[#155dfc]" />
                                        Loading pets...
                                    </div>
                                ) : visiblePetOptions.length === 0 ? (
                                    <div className="p-5 text-center text-sm font-semibold text-slate-500 dark:text-slate-400">No pets match your search.</div>
                                ) : visiblePetOptions.map(pet => {
                                    const optionId = petId(pet);
                                    const isSelected = optionId === String(selectedPetId);

                                    return (
                                        <button
                                            key={optionId}
                                            type="button"
                                            onClick={() => selectPet(pet)}
                                            className={`flex w-full items-center justify-between gap-3 rounded-md p-3 text-left transition ${
                                                isSelected
                                                    ? 'bg-blue-50 dark:bg-blue-950/50'
                                                    : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                                            }`}
                                        >
                                            <span className="min-w-0">
                                                <span className="block truncate text-sm font-black text-slate-950 dark:text-white">{petName(pet)}</span>
                                                <span className="mt-1 block truncate text-xs font-semibold text-slate-500 dark:text-slate-400">{petMetadata(pet) || 'No additional details'}</span>
                                            </span>
                                            {isSelected ? <Badge className="shrink-0 border-0 bg-[#155dfc] text-white">Selected</Badge> : null}
                                        </button>
                                    );
                                })}
                                {filteredPets.length > visiblePetOptions.length ? (
                                    <div className="border-t border-slate-100 px-3 py-2 text-xs font-bold text-slate-400 dark:border-slate-800">
                                        Keep typing to narrow {filteredPets.length - visiblePetOptions.length} more results.
                                    </div>
                                ) : null}
                                </div>
                            ) : null}
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={refreshDirectoryAndMedia}
                            disabled={isLoadingPets || isLoadingMedia}
                            className="size-11 shrink-0"
                            aria-label={selectedPetId ? 'Refresh pet directory and selected pet files' : 'Refresh pet directory'}
                            title={selectedPetId ? 'Refresh pet directory and selected pet files' : 'Refresh pet directory'}
                        >
                            {isLoadingPets || isLoadingMedia
                                ? <Loader2 className="size-4 animate-spin" />
                                : <RefreshCw className="size-4" />}
                        </Button>
                    </div>
                </div>
                {petLoadError ? (
                    <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-800 dark:bg-red-950/40 dark:text-red-200">
                        <span>{petLoadError}</span>
                        <Button type="button" variant="outline" size="sm" onClick={() => loadPets()}>Retry</Button>
                    </div>
                ) : null}
            </section>

            {!selectedPetId ? (
                <div className="flex min-h-[22rem] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-8 text-center dark:border-slate-700 dark:bg-slate-900/40">
                    <div className="max-w-sm">
                        <PawPrint className="mx-auto mb-3 size-11 text-slate-300 dark:text-slate-600" />
                        <p className="font-black text-slate-900 dark:text-white">Select a pet first</p>
                        <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">Files and media stay hidden until you explicitly choose a pet.</p>
                    </div>
                </div>
            ) : (
                <>
                    <div className="flex flex-col gap-3 rounded-xl border border-blue-200 bg-blue-50/70 px-4 py-3 dark:border-blue-900 dark:bg-blue-950/30 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 flex-1">
                            <p className="text-xs font-black uppercase tracking-wide text-blue-600 dark:text-blue-300">Viewing records for</p>
                            <p className="mt-0.5 truncate text-lg font-black text-slate-950 dark:text-white">{petName(selectedPet)}</p>
                            {petMetadata(selectedPet) ? <p className="mt-0.5 truncate text-sm font-semibold text-slate-600 dark:text-slate-300">{petMetadata(selectedPet)}</p> : null}
                        </div>
                        <div className="w-full min-w-0 sm:w-64 sm:shrink-0">
                            <Label htmlFor="pet-media-service-filter" className="mb-1 block text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-300">Service</Label>
                            <Select value={serviceFilter} onValueChange={setServiceFilter}>
                                <SelectTrigger id="pet-media-service-filter" className="bg-white dark:bg-slate-900"><SelectValue displayValue={serviceFilter === 'all' ? 'All Services' : serviceFilter} /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Services</SelectItem>
                                    {serviceOptions.map(service => <SelectItem key={service} value={service}>{service}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {errorMessage ? (
                        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">{errorMessage}</div>
                    ) : null}
                    {Array.isArray(mediaData?.missing_data) && mediaData.missing_data.length ? (
                        <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                            <AlertTriangle className="mt-0.5 size-5 shrink-0" />
                            <div>{mediaData.missing_data.map(note => <p key={note}>{note}</p>)}</div>
                        </div>
                    ) : null}

                    <MediaFileExplorer
                        key={`${selectedPetId}:${serviceFilter}`}
                        groups={mediaGroups}
                        viewMode={viewMode}
                        onViewModeChange={setViewMode}
                        onPreview={previewItem}
                        openingDocumentId={openingDocumentId}
                        isLoading={isLoadingMedia && !mediaData}
                        emptyMessage={serviceFilter === 'all'
                            ? 'No files have been recorded for this pet yet.'
                            : 'No files match the selected service.'}
                    />
                </>
            )}

            <PhotoViewer open={Boolean(viewer)} src={viewer?.src || ''} alt={viewer?.alt || 'Pet media'} onOpenChange={(open) => !open && setViewer(null)} />
        </div>
    );
}

function MediaFileExplorer({
    groups,
    viewMode,
    onViewModeChange,
    onPreview,
    openingDocumentId,
    isLoading,
    emptyMessage
}) {
    const [selectedServiceName, setSelectedServiceName] = useState('');
    const [selectedDateKey, setSelectedDateKey] = useState('');
    const currentCrumbRef = useRef(null);
    const serviceButtonRefs = useRef(new Map());
    const dateButtonRefs = useRef(new Map());
    const pendingFocusRef = useRef('');
    const selectedGroup = selectedServiceName
        ? groups.find(group => group.service === selectedServiceName) || null
        : null;
    const selectedDate = selectedGroup && selectedDateKey
        ? selectedGroup.dates.find(date => date.key === selectedDateKey) || null
        : null;
    const level = selectedDate ? 'date' : selectedGroup ? 'service' : 'root';
    const isRoot = level === 'root';
    const folderCount = level === 'root' ? groups.length : selectedGroup?.dates.length || 0;
    const countLabel = level === 'date'
        ? `${selectedDate.items.length} file${selectedDate.items.length === 1 ? '' : 's'}`
        : `${folderCount} folder${folderCount === 1 ? '' : 's'}`;

    useEffect(() => {
        const target = pendingFocusRef.current;
        if (target === 'current') currentCrumbRef.current?.focus();
        if (target.startsWith('service:')) {
            serviceButtonRefs.current.get(target.slice('service:'.length))?.focus();
        }
        if (target.startsWith('date:')) {
            dateButtonRefs.current.get(target.slice('date:'.length))?.focus();
        }
        pendingFocusRef.current = '';
    }, [selectedDateKey, selectedServiceName]);

    useEffect(() => {
        if (!selectedServiceName) return;

        const missingService = !selectedGroup;
        const missingDate = Boolean(selectedGroup && selectedDateKey && !selectedDate);
        if (!missingService && !missingDate) return;

        const reconciliationTimer = window.setTimeout(() => {
            pendingFocusRef.current = 'current';
            setSelectedDateKey('');
            if (missingService) setSelectedServiceName('');
        }, 0);

        return () => window.clearTimeout(reconciliationTimer);
    }, [groups, selectedDate, selectedDateKey, selectedGroup, selectedServiceName]);

    const openService = (service) => {
        pendingFocusRef.current = 'current';
        setSelectedServiceName(service);
        setSelectedDateKey('');
    };

    const openDate = (dateKey) => {
        pendingFocusRef.current = 'current';
        setSelectedDateKey(dateKey);
    };

    const returnToDates = () => {
        pendingFocusRef.current = `date:${selectedDateKey}`;
        setSelectedDateKey('');
    };

    const returnToRoot = () => {
        pendingFocusRef.current = `service:${selectedServiceName}`;
        setSelectedDateKey('');
        setSelectedServiceName('');
    };

    const goBack = () => {
        if (level === 'date') returnToDates();
        if (level === 'service') returnToRoot();
    };

    const folders = level === 'service'
        ? selectedGroup.dates.map(date => ({
            key: date.key,
            label: date.label,
            detail: `${date.items.length} file${date.items.length === 1 ? '' : 's'}`,
            tone: 'date'
        }))
        : groups.map(group => ({
            key: group.service,
            label: group.service,
            detail: `${group.dates.length} date folder${group.dates.length === 1 ? '' : 's'} / ${group.count} file${group.count === 1 ? '' : 's'}`,
            tone: 'service'
        }));

    return (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900" aria-label="Pet file explorer">
            <header className="flex min-w-0 flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-2 py-2 dark:border-slate-700 dark:bg-slate-950 sm:px-3">
                <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={goBack}
                    disabled={isRoot}
                    className="size-9 shrink-0"
                    aria-label={level === 'date' ? `Back to ${selectedGroup.service}` : level === 'service' ? 'Back to all service folders' : 'Already at the files root'}
                    title={level === 'date' ? `Back to ${selectedGroup.service}` : level === 'service' ? 'Back to all service folders' : 'Files root'}
                >
                    <ChevronLeft className="size-4" />
                </Button>

                <nav className="min-w-0 flex-1" aria-label="Pet media folder path">
                    <ol className="flex min-w-0 items-center gap-1.5 text-sm">
                        <li className="min-w-0">
                            {isRoot ? (
                                <span
                                    ref={currentCrumbRef}
                                    tabIndex={-1}
                                    className="block truncate rounded px-1 font-black text-slate-900 outline-none focus:ring-2 focus:ring-[#155dfc] dark:text-white"
                                    aria-current="page"
                                >
                                    Files
                                </span>
                            ) : (
                                <button
                                    type="button"
                                    onClick={returnToRoot}
                                    className="block max-w-28 truncate rounded px-1 font-bold text-[#155dfc] hover:underline focus:outline-none focus:ring-2 focus:ring-[#155dfc] sm:max-w-48"
                                >
                                    Files
                                </button>
                            )}
                        </li>
                        {selectedGroup ? (
                            <>
                                <li aria-hidden="true"><ChevronRight className="size-4 shrink-0 text-slate-400" /></li>
                                <li className="min-w-0">
                                    {selectedDate ? (
                                        <button
                                            type="button"
                                            onClick={returnToDates}
                                            className="block max-w-36 truncate rounded px-1 font-bold text-[#155dfc] hover:underline focus:outline-none focus:ring-2 focus:ring-[#155dfc] sm:max-w-64"
                                        >
                                            {selectedGroup.service}
                                        </button>
                                    ) : (
                                        <span
                                            ref={currentCrumbRef}
                                            tabIndex={-1}
                                            className="block max-w-40 truncate rounded px-1 font-black text-slate-900 outline-none focus:ring-2 focus:ring-[#155dfc] dark:text-white sm:max-w-72"
                                            aria-current="page"
                                        >
                                            {selectedGroup.service}
                                        </span>
                                    )}
                                </li>
                            </>
                        ) : null}
                        {selectedDate ? (
                            <>
                                <li aria-hidden="true"><ChevronRight className="size-4 shrink-0 text-slate-400" /></li>
                                <li className="min-w-0">
                                    <span
                                        ref={currentCrumbRef}
                                        tabIndex={-1}
                                        className="block max-w-36 truncate rounded px-1 font-black text-slate-900 outline-none focus:ring-2 focus:ring-[#155dfc] dark:text-white sm:max-w-64"
                                        aria-current="page"
                                    >
                                        {selectedDate.label}
                                    </span>
                                </li>
                            </>
                        ) : null}
                    </ol>
                </nav>

                <span className="shrink-0 text-xs font-semibold text-slate-500 dark:text-slate-400" role="status" aria-live="polite" aria-atomic="true">
                    {isLoading ? 'Loading...' : countLabel}
                </span>
                <div className="flex shrink-0 gap-1" role="group" aria-label="Explorer display mode">
                    <Button
                        type="button"
                        size="icon"
                        variant={viewMode === 'grid' ? 'default' : 'ghost'}
                        onClick={() => onViewModeChange('grid')}
                        aria-label="Grid view"
                        aria-pressed={viewMode === 'grid'}
                        title="Grid view"
                        className="size-9"
                    >
                        <LayoutGrid className="size-4" />
                    </Button>
                    <Button
                        type="button"
                        size="icon"
                        variant={viewMode === 'list' ? 'default' : 'ghost'}
                        onClick={() => onViewModeChange('list')}
                        aria-label="List view"
                        aria-pressed={viewMode === 'list'}
                        title="List view"
                        className="size-9"
                    >
                        <List className="size-4" />
                    </Button>
                </div>
            </header>

            <div className="min-h-[18rem] p-3 sm:p-4">
                {isLoading ? (
                    <div className="flex min-h-[15rem] items-center justify-center gap-3 text-sm font-semibold text-slate-500 dark:text-slate-400">
                        <Loader2 className="size-6 animate-spin text-[#155dfc]" aria-hidden="true" />
                        Loading files...
                    </div>
                ) : groups.length === 0 ? (
                    <div className="flex min-h-[15rem] items-center justify-center text-center">
                        <div>
                            <ImageIcon className="mx-auto mb-3 size-10 text-slate-300 dark:text-slate-600" aria-hidden="true" />
                            <p className="font-black text-slate-900 dark:text-white">No files found</p>
                            <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">{emptyMessage}</p>
                        </div>
                    </div>
                ) : selectedDate ? (
                    <DateFiles
                        date={selectedDate}
                        viewMode={viewMode}
                        onPreview={onPreview}
                        openingDocumentId={openingDocumentId}
                    />
                ) : (
                    <ExplorerFolders
                        folders={folders}
                        viewMode={viewMode}
                        onOpen={level === 'service' ? openDate : openService}
                        registerButton={(key, node) => {
                            const refs = level === 'service' ? dateButtonRefs.current : serviceButtonRefs.current;
                            if (node) refs.set(key, node);
                            else refs.delete(key);
                        }}
                    />
                )}
            </div>
        </section>
    );
}

function ExplorerFolders({ folders, viewMode, onOpen, registerButton }) {
    if (viewMode === 'list') {
        return (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {folders.map(folder => (
                    <button
                        key={folder.key}
                        ref={(node) => registerButton(folder.key, node)}
                        type="button"
                        onClick={() => onOpen(folder.key)}
                        className="flex w-full min-w-0 items-center gap-3 px-2 py-3 text-left transition hover:bg-blue-50/60 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#155dfc] dark:hover:bg-blue-950/20"
                        aria-label={`${folder.label}, ${folder.detail}`}
                    >
                        <Folder className={`size-6 shrink-0 ${folder.tone === 'date' ? 'fill-amber-100 text-amber-500 dark:fill-amber-950' : 'fill-blue-100 text-[#155dfc] dark:fill-blue-950'}`} aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-black text-slate-900 dark:text-white">{folder.label}</span>
                            <span className="mt-0.5 block truncate text-xs font-semibold text-slate-500 dark:text-slate-400">{folder.detail}</span>
                        </span>
                        <ChevronRight className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
                    </button>
                ))}
            </div>
        );
    }

    return (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {folders.map(folder => (
                <button
                    key={folder.key}
                    ref={(node) => registerButton(folder.key, node)}
                    type="button"
                    onClick={() => onOpen(folder.key)}
                    className="group flex min-h-32 min-w-0 flex-col items-start rounded-lg border border-transparent p-3 text-left transition hover:border-blue-200 hover:bg-blue-50/70 focus:outline-none focus:ring-2 focus:ring-[#155dfc] dark:hover:border-blue-900 dark:hover:bg-blue-950/20"
                    aria-label={`${folder.label}, ${folder.detail}`}
                >
                    <Folder className={`mb-3 size-11 shrink-0 transition group-hover:scale-105 ${folder.tone === 'date' ? 'fill-amber-100 text-amber-500 dark:fill-amber-950' : 'fill-blue-100 text-[#155dfc] dark:fill-blue-950'}`} aria-hidden="true" />
                    <span className="line-clamp-2 text-sm font-black leading-5 text-slate-900 dark:text-white">{folder.label}</span>
                    <span className="mt-1 line-clamp-2 text-xs font-semibold text-slate-500 dark:text-slate-400">{folder.detail}</span>
                </button>
            ))}
        </div>
    );
}

function DateFiles({ date, viewMode, onPreview, openingDocumentId }) {
    if (viewMode === 'list') {
        return <MediaList media={date.items} onPreview={onPreview} openingDocumentId={openingDocumentId} />;
    }

    return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {date.items.map(item => (
                <MediaCard
                    key={item.id}
                    item={item}
                    onPreview={onPreview}
                    isOpening={openingDocumentId === String(item.id)}
                />
            ))}
        </div>
    );
}

function MediaPreview({ item }) {
    const source = item.url || item.path || '';
    const title = item.label || item.name || 'Pet file';

    if (isPdf(item)) {
        return (
            <div className="flex aspect-[4/3] flex-col items-center justify-center bg-slate-50 p-5 text-center dark:bg-slate-950">
                <span className="rounded-xl border border-red-100 bg-white p-3 shadow-sm dark:border-red-950 dark:bg-slate-900">
                    <FileText className="size-10 text-red-500" />
                </span>
            </div>
        );
    }

    return (
        <div className="aspect-[4/3] overflow-hidden">
            <ProtectedImage src={source} alt={title} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" fallbackClassName="h-full w-full" />
        </div>
    );
}

function MediaCard({ item, onPreview, isOpening }) {
    const title = item.label || item.name || 'Pet file';
    const document = isPdf(item);
    const fileName = usefulFileName(item, title);

    return (
        <article className="group relative min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:border-blue-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:hover:border-blue-700">
            <button
                type="button"
                onClick={() => onPreview(item)}
                disabled={isOpening}
                className="absolute inset-0 z-10 rounded-lg focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#155dfc] disabled:cursor-wait"
                aria-label={`${document ? 'Open PDF' : 'View image'} ${title}`}
                aria-busy={isOpening}
            >
                <span className="sr-only">{document ? 'Open PDF' : 'View image'} {title}</span>
            </button>
            {isOpening ? (
                <span className="pointer-events-none absolute right-2 top-2 z-20 rounded-full bg-white p-2 text-[#155dfc] shadow dark:bg-slate-900">
                    <Loader2 className="size-4 animate-spin" />
                </span>
            ) : null}
            <div className="bg-slate-100 text-left dark:bg-slate-950">
                <MediaPreview item={item} />
            </div>
            <div className="space-y-2.5 p-3">
                {item.status ? <Badge className="border-0 bg-slate-100 text-[10px] text-slate-700 dark:bg-slate-800 dark:text-slate-200">{item.status}</Badge> : null}
                <div>
                    <p className="line-clamp-2 text-sm font-black leading-5 text-slate-950 dark:text-white">{title}</p>
                    {fileName ? <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-500 dark:text-slate-400">{fileName}</p> : null}
                </div>
            </div>
        </article>
    );
}

function MediaList({ media, onPreview, openingDocumentId }) {
    return (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {media.map(item => {
                const document = isPdf(item);
                const title = item.label || item.name || 'Pet file';
                const fileName = usefulFileName(item, title);
                const opening = openingDocumentId === String(item.id);

                return (
                    <li key={item.id}>
                        <button
                            type="button"
                            onClick={() => onPreview(item)}
                            disabled={opening}
                            className="flex w-full min-w-0 items-center gap-3 px-2 py-3 text-left transition hover:bg-blue-50/60 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#155dfc] disabled:cursor-wait dark:hover:bg-blue-950/20"
                            aria-label={`${document ? 'Open PDF' : 'View image'} ${title}`}
                            aria-busy={opening}
                        >
                            <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-950">
                                {opening
                                    ? <Loader2 className="size-5 animate-spin text-[#155dfc]" />
                                    : document
                                        ? <FileText className="size-6 text-red-500" />
                                        : <ProtectedImage src={item.url || item.path || ''} alt="" className="size-full object-cover" fallbackClassName="size-full" />}
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-black text-slate-900 dark:text-white">{title}</span>
                                {fileName ? <span className="mt-0.5 block truncate text-xs font-semibold text-slate-500 dark:text-slate-400">{fileName}</span> : null}
                            </span>
                            {item.status ? <Badge className="shrink-0 border-0 bg-slate-100 text-[10px] text-slate-700 dark:bg-slate-800 dark:text-slate-200">{item.status}</Badge> : null}
                        </button>
                    </li>
                );
            })}
        </ul>
    );
}
