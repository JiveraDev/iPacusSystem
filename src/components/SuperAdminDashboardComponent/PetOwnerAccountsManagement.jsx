import { useMemo, useState } from 'react';
import { Archive, LayoutGrid, List, Loader2, Mail, MapPin, PawPrint, Phone, RefreshCw, RotateCcw, Search, ShieldAlert, X } from 'lucide-react';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Card, CardContent } from '../../ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { toast } from '../../reusecomponent/toast.jsx';
import { fetchPetOwnerAccounts, updatePetOwnerStatus } from '../../services/accountService';
import { updatePetStatus } from '../../services/petService';
import DashboardPageHeader from '../shared/DashboardPageHeader';
import ProtectedImage from '../shared/ProtectedImage.jsx';

function ownerName(owner) {
    return `${owner.first_Name || ''} ${owner.last_Name || ''}`.trim() || owner.mail_Address || 'Pet Owner';
}

function isArchived(owner) {
    return ['archived', 'deactivated'].includes(String(owner.account_status || 'active').toLowerCase());
}

function ownerInitials(owner) {
    return ownerName(owner)
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part[0]?.toUpperCase())
        .join('') || 'PO';
}

function ownerProfileImage(owner) {
    return owner?.setProfilePic_url || owner?.profileImage || owner?.profile_image || owner?.setProfilePicUrl || '';
}

function cleanValue(value, fallback = 'N/A') {
    if (value === null || value === undefined || String(value).trim() === '') {
        return fallback;
    }

    return String(value);
}

function formatDate(value) {
    if (!value) return 'N/A';

    const text = String(value).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
        return cleanValue(value);
    }

    const date = new Date(`${text}T00:00:00`);
    return Number.isNaN(date.getTime())
        ? cleanValue(value)
        : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatWeight(value) {
    if (value === null || value === undefined || String(value).trim() === '') {
        return 'N/A';
    }

    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) {
        return cleanValue(value);
    }

    return `${number % 1 === 0 ? number.toFixed(0) : number.toFixed(2)} kg`;
}

function summarizePetField(pets, key) {
    const counts = pets.reduce((summary, pet) => {
        const value = cleanValue(pet[key], '').trim();
        if (!value) return summary;
        summary[value] = (summary[value] || 0) + 1;
        return summary;
    }, {});

    const entries = Object.entries(counts);
    if (!entries.length) return 'N/A';

    return entries
        .map(([label, count]) => `${label}: ${count}`)
        .join(', ');
}

function petStatusClass(status) {
    const normalized = String(status || '').toLowerCase();
    if (normalized === 'deceased') return 'border-0 bg-slate-100 text-slate-700';
    if (normalized === 'emergency') return 'border-0 bg-red-50 text-red-700';
    return 'border-0 bg-emerald-50 text-emerald-700';
}

function OwnerAvatar({ owner, className }) {
    const [failed, setFailed] = useState(false);
    const image = failed ? null : ownerProfileImage(owner);

    if (image) {
        return (
            <ProtectedImage
                src={image}
                alt={`${ownerName(owner)} profile`}
                className={className}
                fallbackClassName={className}
                onLoadError={() => setFailed(true)}
            />
        );
    }

    return (
        <div className={`${className} flex items-center justify-center bg-emerald-50 text-emerald-700`}>
            <span className="font-black">{ownerInitials(owner)}</span>
        </div>
    );
}

function PetAvatar({ pet, className }) {
    const [failed, setFailed] = useState(false);
    const image = failed ? null : pet?.setpetImage_url;

    if (image) {
        return (
            <ProtectedImage
                src={image}
                alt={`${pet?.pet_name || 'Pet'} profile`}
                className={className}
                fallbackClassName={className}
                onLoadError={() => setFailed(true)}
            />
        );
    }

    return (
        <div className={`${className} flex items-center justify-center bg-slate-100 text-slate-400`}>
            <PawPrint className="size-8" />
        </div>
    );
}

function ProfileDetail({ label, value }) {
    return (
        <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">{label}</p>
            <p className="mt-1 break-words text-sm font-bold text-slate-800">{cleanValue(value)}</p>
        </div>
    );
}

export default function PetOwnerAccountsManagement() {
    const [owners, setOwners] = useState([]);
    const [statusSupported, setStatusSupported] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('active');
    const [selectedOwner, setSelectedOwner] = useState(null);
    const [pendingStatusOwner, setPendingStatusOwner] = useState(null);
    const [pendingPetArchive, setPendingPetArchive] = useState(null);
    const [reason, setReason] = useState('');
    const [viewMode, setViewMode] = useState('cards');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const loadOwners = async ({ isAutoRefresh = false } = {}) => {
        if (!isAutoRefresh) {
            setIsLoading(true);
        }
        try {
            const data = await fetchPetOwnerAccounts();
            setOwners(Array.isArray(data.owners) ? data.owners : []);
            setStatusSupported(Boolean(data.status_supported));
        } catch (error) {
            console.error('Failed to load pet owner accounts:', error);
            toast.error('Pet owner accounts could not be loaded. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    useAutoRefresh(loadOwners);

    const filteredOwners = useMemo(() => {
        const query = search.trim().toLowerCase();
        const statusOwners = owners.filter((owner) => (
            statusFilter === 'all' || (statusFilter === 'archived' ? isArchived(owner) : !isArchived(owner))
        ));
        if (!query) return statusOwners;

        return statusOwners.filter(owner => [
            ownerName(owner),
            owner.mail_Address,
            owner.phoneNumber,
            owner.personal_Address,
            ...(owner.pets || []).map(pet => `${pet.pet_name} ${pet.pet_species} ${pet.pet_breed}`)
        ].filter(Boolean).join(' ').toLowerCase().includes(query));
    }, [owners, search, statusFilter]);

    const handleToggleStatus = async () => {
        if (!pendingStatusOwner) return;

        setIsSaving(true);
        try {
            const nextStatus = isArchived(pendingStatusOwner) ? 'active' : 'archived';
            await updatePetOwnerStatus(pendingStatusOwner.user_id, {
                account_status: nextStatus,
                reason
            });
            toast.success(nextStatus === 'archived' ? 'Pet owner archived.' : 'Pet owner restored.');
            setSelectedOwner(current => (
                current?.user_id === pendingStatusOwner.user_id
                    ? { ...current, account_status: nextStatus }
                    : current
            ));
            setPendingStatusOwner(null);
            setReason('');
            loadOwners();
        } catch (error) {
            console.error('Failed to update pet owner status:', error);
            toast.error('The pet owner status could not be updated. Please try again.');
            if (error.data?.technicalDetailsHidden) {
                setStatusSupported(false);
            }
        } finally {
            setIsSaving(false);
        }
    };

    const handlePetArchive = async () => {
        if (!pendingPetArchive) return;

        setIsSaving(true);
        try {
            const pet = pendingPetArchive.pet;
            const nextArchived = !pet.is_archived;
            await updatePetStatus(pet.pet_sharable_ID || pet.pet_id, {
                action: nextArchived ? 'archive' : 'restore',
                isArchived: nextArchived,
            });
            toast.success(nextArchived ? 'Pet archived.' : 'Pet restored.');
            setPendingPetArchive(null);
            setSelectedOwner(null);
            loadOwners();
        } catch (error) {
            console.error('Failed to update pet archive status:', error);
            toast.error('The pet archive status could not be updated. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const StatusBadge = ({ owner }) => (
        <Badge className={isArchived(owner) ? 'border-0 bg-slate-100 text-slate-600' : 'border-0 bg-emerald-50 text-emerald-700'}>
            {isArchived(owner) ? 'Archived' : 'Active'}
        </Badge>
    );

    const openOwnerModal = (owner) => {
        setSelectedOwner(owner);
    };

    const handleSelectableOwnerKey = (event, owner) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openOwnerModal(owner);
        }
    };

    const beginStatusUpdate = (owner) => {
        setPendingStatusOwner(owner);
        setReason('');
    };

    const selectedPets = selectedOwner?.pets || [];
    const selectedPetSpeciesSummary = summarizePetField(selectedPets, 'pet_species');
    const selectedPetStatusSummary = summarizePetField(selectedPets, 'pet_status');

    return (
        <div className="space-y-6">
            <DashboardPageHeader
                title="Pet Owners"
                description="Review owner accounts, linked pets, activity, and reversible archive status."
                layout="stacked"
                actions={(
                    <Button type="button" variant="outline" onClick={() => loadOwners()} disabled={isLoading} className="h-10 justify-center gap-2 whitespace-nowrap">
                        {isLoading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                        Refresh
                    </Button>
                )}
            />

            {!statusSupported ? (
                <Card className="border-amber-200 bg-amber-50 shadow-none">
                    <CardContent className="space-y-3 p-4">
                        <div className="flex gap-3 text-amber-900">
                            <ShieldAlert className="mt-0.5 size-5 shrink-0" />
                            <div>
                                <h2 className="font-black">Pet owner archiving is temporarily unavailable</h2>
                                <p className="mt-1 text-sm font-semibold leading-6">
                                    Owner login access cannot be changed right now. Try again later or contact support.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ) : null}

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 flex-1">
                    <Input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search owner, email, address, pet name, animal type, or breed"
                        className="h-11 bg-white"
                        leftIcon={<Search className="size-4" />}
                    />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-11 w-full bg-white lg:w-44"><SelectValue placeholder="Account status" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="active">Active owners</SelectItem>
                        <SelectItem value="archived">Archived owners</SelectItem>
                        <SelectItem value="all">All owners</SelectItem>
                    </SelectContent>
                </Select>
                <div className="flex w-fit rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
                    <Button
                        type="button"
                        variant={viewMode === 'cards' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setViewMode('cards')}
                        className="gap-2"
                    >
                        <LayoutGrid className="size-4" />
                        Cards
                    </Button>
                    <Button
                        type="button"
                        variant={viewMode === 'table' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setViewMode('table')}
                        className="gap-2"
                    >
                        <List className="size-4" />
                        Table
                    </Button>
                </div>
            </div>

            {isLoading && !owners.length ? (
                <div className="flex min-h-[18rem] items-center justify-center rounded-xl border border-slate-200 bg-white">
                    <Loader2 className="size-8 animate-spin text-[#155dfc]" />
                </div>
            ) : viewMode === 'cards' ? (
                <div className="grid gap-4 xl:grid-cols-2">
                    {filteredOwners.map(owner => (
                        <Card
                            key={owner.user_id}
                            role="button"
                            tabIndex={0}
                            onClick={() => openOwnerModal(owner)}
                            onKeyDown={(event) => handleSelectableOwnerKey(event, owner)}
                            className="cursor-pointer overflow-hidden border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-emerald-300"
                        >
                            <CardContent className="space-y-4 p-5">
                                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                    <div className="flex min-w-0 items-center gap-3">
                                        <OwnerAvatar owner={owner} className="size-12 shrink-0 rounded-xl object-cover text-base" />
                                        <div className="min-w-0">
                                            <h2 className="truncate text-lg font-black text-slate-950">{ownerName(owner)}</h2>
                                            <p className="truncate text-sm font-semibold text-slate-500">{owner.mail_Address}</p>
                                        </div>
                                    </div>
                                    <StatusBadge owner={owner} />
                                </div>

                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="rounded-xl bg-slate-50 p-3">
                                        <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">Pets</p>
                                        <p className="mt-1 text-xl font-black text-slate-950">{owner.pet_count}</p>
                                    </div>
                                    <div className="rounded-xl bg-slate-50 p-3">
                                        <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">Status</p>
                                        <p className="mt-1 text-xl font-black text-slate-950">{isArchived(owner) ? 'Archived' : 'Active'}</p>
                                    </div>
                                </div>

                                <p className="text-xs font-bold text-slate-400">Select to manage pets, ownership, and account status.</p>
                            </CardContent>
                        </Card>
                    ))}
                    {!filteredOwners.length ? (
                        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm font-semibold text-slate-500 xl:col-span-2">
                            No pet owners match your search.
                        </div>
                    ) : null}
                </div>
            ) : (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                                <tr>
                                    <th className="px-4 py-3 font-black">Owner</th>
                                    <th className="px-4 py-3 font-black">Contact</th>
                                    <th className="px-4 py-3 font-black">Pets</th>
                                    <th className="px-4 py-3 font-black">Pet Count</th>
                                    <th className="px-4 py-3 font-black">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredOwners.length ? filteredOwners.map(owner => (
                                    <tr
                                        key={owner.user_id}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => openOwnerModal(owner)}
                                        onKeyDown={(event) => handleSelectableOwnerKey(event, owner)}
                                        className="cursor-pointer align-top transition hover:bg-emerald-50/50 focus:bg-emerald-50 focus:outline-none"
                                    >
                                        <td className="px-4 py-4">
                                            <div className="flex min-w-[14rem] items-center gap-3">
                                                <OwnerAvatar owner={owner} className="size-10 shrink-0 rounded-xl object-cover text-sm" />
                                                <div className="min-w-0">
                                                    <p className="truncate font-black text-slate-950">{ownerName(owner)}</p>
                                                    <p className="truncate text-xs font-semibold text-slate-500">{owner.mail_Address || 'Pet owner account'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <p className="max-w-[16rem] truncate font-semibold text-slate-700">{owner.mail_Address || 'No email'}</p>
                                            <p className="mt-1 max-w-[16rem] truncate text-xs font-semibold text-slate-500">{owner.phoneNumber || owner.emergencyNumber || 'No phone'}</p>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex flex-wrap gap-1.5">
                                                {(owner.pets || []).slice(0, 3).map(pet => (
                                                    <span key={pet.pet_id} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                                                        {pet.pet_name}
                                                    </span>
                                                ))}
                                                {(owner.pets || []).length > 3 ? (
                                                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-[#155dfc]">
                                                        +{owner.pets.length - 3}
                                                    </span>
                                                ) : null}
                                                {!owner.pets?.length ? <span className="text-xs font-semibold text-slate-400">No pets</span> : null}
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="min-w-[6rem]">
                                                <p className="text-sm font-black text-slate-950">{owner.pet_count}</p>
                                                <p className="text-[10px] font-bold uppercase text-slate-400">Pets</p>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <StatusBadge owner={owner} />
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-10 text-center text-sm font-semibold text-slate-500">
                                            No pet owners match your search.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <Dialog open={Boolean(selectedOwner)} onOpenChange={(open) => !open && setSelectedOwner(null)}>
                <DialogContent showClose={false} className="max-w-5xl max-h-[90vh] overflow-y-auto">
                    {selectedOwner ? (
                        <>
                            <DialogHeader className="text-left">
                                <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-[linear-gradient(135deg,#f8fbff_0%,#ffffff_44%,#f0fdf4_100%)] p-5 pr-16 dark:border-slate-700 dark:bg-none dark:bg-slate-900">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedOwner(null)}
                                        aria-label="Close pet owner profile"
                                        className="absolute right-3 top-3 z-10 inline-flex size-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-[#155dfc] focus:ring-offset-2 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                    >
                                        <X className="size-4" />
                                    </button>
                                    <div className="flex flex-col gap-5 md:flex-row md:items-start">
                                        <OwnerAvatar owner={selectedOwner} className="size-24 shrink-0 rounded-2xl object-cover text-2xl shadow-sm" />
                                        <div className="min-w-0 flex-1">
                                            <div className="mb-2 flex flex-wrap items-center gap-2">
                                                <StatusBadge owner={selectedOwner} />
                                                <Badge className="border-0 bg-blue-50 text-[#155dfc]">Pet Owner Account</Badge>
                                            </div>
                                            <DialogTitle className="text-2xl font-black tracking-tight text-slate-950 dark:text-white">{ownerName(selectedOwner)}</DialogTitle>
                                            <DialogDescription className="mt-1 text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">
                                                Pet owner profile, linked pets, and account controls.
                                            </DialogDescription>
                                            <div className="mt-4 grid gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300 md:grid-cols-2">
                                                <div className="flex min-w-0 items-center gap-2">
                                                    <Mail className="size-4 shrink-0 text-slate-400" />
                                                    <span className="truncate">{cleanValue(selectedOwner.mail_Address, 'No email')}</span>
                                                </div>
                                                <div className="flex min-w-0 items-center gap-2">
                                                    <Phone className="size-4 shrink-0 text-slate-400" />
                                                    <span className="truncate">{cleanValue(selectedOwner.phoneNumber || selectedOwner.emergencyNumber, 'No phone')}</span>
                                                </div>
                                                <div className="flex min-w-0 items-center gap-2 md:col-span-2">
                                                    <MapPin className="size-4 shrink-0 text-slate-400" />
                                                    <span className="truncate">{cleanValue(selectedOwner.personal_Address, 'No address')}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                                        <ProfileDetail label="Owned Pets" value={selectedOwner.pet_count} />
                                        <ProfileDetail label="Joined" value={formatDate(selectedOwner.created_at)} />
                                    </div>
                                </div>
                            </DialogHeader>

                            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
                                <div className="rounded-xl border border-slate-200 bg-white p-4">
                                    <div className="flex items-start gap-3">
                                        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                                            <PawPrint className="size-5" />
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="font-black text-slate-950">Pet Profile Summary</h3>
                                            <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">
                                                {selectedPets.length
                                                    ? `${selectedPets.length} linked pet${selectedPets.length === 1 ? '' : 's'}. Animal types: ${selectedPetSpeciesSummary}. Status: ${selectedPetStatusSummary}.`
                                                    : 'No pets are linked to this owner account.'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:flex-col lg:items-stretch">
                                        <div>
                                            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Account status</p>
                                            <div className="mt-2">
                                                <StatusBadge owner={selectedOwner} />
                                            </div>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            disabled={!statusSupported}
                                            onClick={() => beginStatusUpdate(selectedOwner)}
                                            className={isArchived(selectedOwner) ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}
                                        >
                                            {isArchived(selectedOwner) ? <RotateCcw className="mr-2 size-4" /> : <Archive className="mr-2 size-4" />}
                                            {isArchived(selectedOwner) ? 'Restore Account' : 'Archive Account'}
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            <div className="grid gap-3">
                                {(selectedOwner.pets || []).length ? selectedOwner.pets.map(pet => (
                                    <div key={pet.pet_id} className="rounded-xl border border-slate-200 bg-white p-4">
                                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                            <div className="flex min-w-0 gap-4">
                                                <PetAvatar pet={pet} className="size-20 shrink-0 rounded-2xl object-cover" />
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <h3 className="truncate text-lg font-black text-slate-950">{pet.pet_name}</h3>
                                                        {pet.is_archived
                                                            ? <Badge className="border-0 bg-slate-100 text-slate-600">Archived</Badge>
                                                            : <Badge className={petStatusClass(pet.pet_status)}>{cleanValue(pet.pet_status)}</Badge>}
                                                    </div>
                                                    <p className="mt-1 truncate text-sm font-semibold text-slate-500">
                                                        {cleanValue(pet.pet_species)} / {cleanValue(pet.pet_breed)}
                                                    </p>
                                                    {pet.pet_sharable_ID ? (
                                                        <p className="mt-1 text-xs font-bold text-slate-400">
                                                            Owner linking ID: {pet.pet_sharable_ID}
                                                        </p>
                                                    ) : null}
                                                </div>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className="border-slate-300 text-slate-700 hover:bg-slate-50 lg:shrink-0"
                                                onClick={() => setPendingPetArchive({ owner: selectedOwner, pet })}
                                            >
                                                {pet.is_archived ? <RotateCcw className="mr-2 size-4" /> : <Archive className="mr-2 size-4" />}
                                                {pet.is_archived ? 'Restore Pet' : 'Archive Pet'}
                                            </Button>
                                        </div>

                                        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                            <ProfileDetail label="Age" value={pet.pet_age} />
                                            <ProfileDetail label="Birthdate" value={formatDate(pet.pet_BDAY)} />
                                            <ProfileDetail label="Gender" value={pet.pet_gender} />
                                            <ProfileDetail label="Weight" value={formatWeight(pet.pet_weight)} />
                                            <ProfileDetail label="Microchip" value={pet.pet_microchip} />
                                            <ProfileDetail label="Allergies" value={pet.pet_allergies} />
                                            <ProfileDetail label="Color / Markings" value={pet.pet_color_marking} />
                                        </div>
                                    </div>
                                )) : (
                                    <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm font-semibold text-slate-500">
                                        <PawPrint className="mx-auto mb-2 size-8 text-slate-300" />
                                        No owned pets linked to this account.
                                    </div>
                                )}
                            </div>
                        </>
                    ) : null}
                </DialogContent>
            </Dialog>

            <Dialog open={Boolean(pendingStatusOwner)} onOpenChange={(open) => !open && setPendingStatusOwner(null)}>
                <DialogContent className="max-w-md">
                    {pendingStatusOwner ? (
                        <>
                            <DialogHeader>
                                <DialogTitle>{isArchived(pendingStatusOwner) ? 'Restore pet owner?' : 'Archive pet owner?'}</DialogTitle>
                                <DialogDescription>
                                    {isArchived(pendingStatusOwner)
                                        ? 'The owner will be allowed to log in again.'
                                        : 'The owner will be hidden from active lists and blocked from logging in.'}
                                </DialogDescription>
                            </DialogHeader>
                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                                <p className="text-sm text-slate-600">Pet owner account</p>
                                <p className="mt-1 font-semibold text-slate-900">{ownerName(pendingStatusOwner)}</p>
                                <p className="mt-1 break-words text-sm font-semibold text-slate-700">
                                    {cleanValue(pendingStatusOwner.mail_Address, 'No email')}
                                </p>
                            </div>
                            {!isArchived(pendingStatusOwner) ? (
                                <Textarea
                                    value={reason}
                                    onChange={(event) => setReason(event.target.value)}
                                    placeholder="Reason for archiving"
                                />
                            ) : null}
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setPendingStatusOwner(null)} disabled={isSaving}>Cancel</Button>
                                <Button type="button" onClick={handleToggleStatus} disabled={isSaving}>
                                    {isSaving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                                    Confirm
                                </Button>
                            </DialogFooter>
                        </>
                    ) : null}
                </DialogContent>
            </Dialog>

            <Dialog open={Boolean(pendingPetArchive)} onOpenChange={(open) => !open && setPendingPetArchive(null)}>
                <DialogContent className="max-w-md">
                    {pendingPetArchive ? (
                        <>
                            <DialogHeader>
                                <DialogTitle>{pendingPetArchive.pet.is_archived ? 'Restore pet?' : 'Archive pet?'}</DialogTitle>
                                <DialogDescription>
                                    {pendingPetArchive.pet.is_archived
                                        ? `${pendingPetArchive.pet.pet_name} will return to active pet lists.`
                                        : `${pendingPetArchive.pet.pet_name} will be hidden from active lists. Its medical and ownership records remain intact.`}
                                </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setPendingPetArchive(null)} disabled={isSaving}>Cancel</Button>
                                <Button type="button" onClick={handlePetArchive} disabled={isSaving}>
                                    {isSaving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                                    Confirm
                                </Button>
                            </DialogFooter>
                        </>
                    ) : null}
                </DialogContent>
            </Dialog>
        </div>
    );
}
