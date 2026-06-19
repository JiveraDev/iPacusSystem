import { useMemo, useState } from 'react';
import { Ban, CheckCircle, LayoutGrid, List, Loader2, Mail, MapPin, PawPrint, Phone, RefreshCw, Search, ShieldAlert, Trash2, UserRound } from 'lucide-react';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Card, CardContent } from '../../ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { toast } from '../../reusecomponent/toast.jsx';
import { fetchPetOwnerAccounts, removePetOwnerOwnership, updatePetOwnerStatus } from '../../services/accountService';
import { resolveImageUrl } from '../../lib/image';

function ownerName(owner) {
    return `${owner.first_Name || ''} ${owner.last_Name || ''}`.trim() || owner.mail_Address || 'Pet Owner';
}

function isDeactivated(owner) {
    return String(owner.account_status || 'active').toLowerCase() === 'deactivated';
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
    return resolveImageUrl(owner?.setProfilePic_url || owner?.profileImage || owner?.profile_image || owner?.setProfilePicUrl);
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
            <img
                src={image}
                alt=""
                className={className}
                onError={() => setFailed(true)}
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
    const image = failed ? null : resolveImageUrl(pet?.setpetImage_url);

    if (image) {
        return (
            <img
                src={image}
                alt=""
                className={className}
                onError={() => setFailed(true)}
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
    const [requiredSql, setRequiredSql] = useState('');
    const [search, setSearch] = useState('');
    const [selectedOwner, setSelectedOwner] = useState(null);
    const [pendingStatusOwner, setPendingStatusOwner] = useState(null);
    const [pendingOwnership, setPendingOwnership] = useState(null);
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
            setRequiredSql(data.required_status_sql || '');
        } catch (error) {
            toast.error(error.message || 'Failed to load pet owner accounts.');
        } finally {
            setIsLoading(false);
        }
    };

    useAutoRefresh(loadOwners);

    const filteredOwners = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return owners;

        return owners.filter(owner => [
            ownerName(owner),
            owner.mail_Address,
            owner.phoneNumber,
            owner.personal_Address,
            ...(owner.pets || []).map(pet => `${pet.pet_name} ${pet.pet_species} ${pet.pet_breed}`)
        ].filter(Boolean).join(' ').toLowerCase().includes(query));
    }, [owners, search]);

    const handleToggleStatus = async () => {
        if (!pendingStatusOwner) return;

        setIsSaving(true);
        try {
            const nextStatus = isDeactivated(pendingStatusOwner) ? 'active' : 'deactivated';
            await updatePetOwnerStatus(pendingStatusOwner.user_id, {
                account_status: nextStatus,
                reason
            });
            toast.success(nextStatus === 'deactivated' ? 'Pet owner deactivated.' : 'Pet owner reactivated.');
            setSelectedOwner(current => (
                current?.user_id === pendingStatusOwner.user_id
                    ? { ...current, account_status: nextStatus }
                    : current
            ));
            setPendingStatusOwner(null);
            setReason('');
            loadOwners();
        } catch (error) {
            toast.error(error.message || 'Could not update pet owner status.');
            if (error.data?.required_sql) {
                setStatusSupported(false);
                setRequiredSql(error.data.required_sql);
            }
        } finally {
            setIsSaving(false);
        }
    };

    const handleRemoveOwnership = async () => {
        if (!pendingOwnership) return;

        setIsSaving(true);
        try {
            await removePetOwnerOwnership(pendingOwnership.owner.user_id, pendingOwnership.pet.pet_id);
            toast.success('Pet ownership removed.');
            setPendingOwnership(null);
            setSelectedOwner(null);
            loadOwners();
        } catch (error) {
            toast.error(error.message || 'Could not remove ownership.');
        } finally {
            setIsSaving(false);
        }
    };

    const StatusBadge = ({ owner }) => (
        <Badge className={isDeactivated(owner) ? 'border-0 bg-red-50 text-red-700' : 'border-0 bg-emerald-50 text-emerald-700'}>
            {isDeactivated(owner) ? 'Deactivated' : 'Active'}
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
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-[linear-gradient(135deg,#f8fbff_0%,#ffffff_48%,#f0fdf4_100%)] p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <div className="mb-3 flex w-fit items-center gap-2 rounded-full border border-emerald-100 bg-white/80 px-3 py-1 text-xs font-black uppercase tracking-wide text-emerald-700">
                            <UserRound className="size-3.5" />
                            Owner Account Control
                        </div>
                        <h1 className="text-3xl font-black tracking-tight text-slate-950">Pet Owners</h1>
                        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
                            Review owner accounts, owned pets, booking/queue activity, account status, and ownership links.
                        </p>
                    </div>
                    <Button type="button" variant="outline" onClick={() => loadOwners()} disabled={isLoading} className="gap-2 bg-white">
                        {isLoading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                        Refresh
                    </Button>
                </div>
            </div>

            {!statusSupported ? (
                <Card className="border-amber-200 bg-amber-50 shadow-none">
                    <CardContent className="space-y-3 p-4">
                        <div className="flex gap-3 text-amber-900">
                            <ShieldAlert className="mt-0.5 size-5 shrink-0" />
                            <div>
                                <h2 className="font-black">Database change required for pet owner deactivation</h2>
                                <p className="mt-1 text-sm font-semibold leading-6">
                                    Ownership removal works now. To deactivate owner login accounts, run this SQL yourself:
                                </p>
                            </div>
                        </div>
                        <pre className="overflow-x-auto rounded-lg bg-white p-3 text-xs font-semibold text-slate-700">{requiredSql}</pre>
                    </CardContent>
                </Card>
            ) : null}

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="relative min-w-0 flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                    <Input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search owner, email, address, pet name, animal type, or breed"
                        className="h-11 bg-white pl-10"
                    />
                </div>
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
                        List / Table
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

                                <div className="grid grid-cols-3 gap-3">
                                    <div className="rounded-xl bg-slate-50 p-3">
                                        <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">Pets</p>
                                        <p className="mt-1 text-xl font-black text-slate-950">{owner.pet_count}</p>
                                    </div>
                                    <div className="rounded-xl bg-slate-50 p-3">
                                        <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">Bookings</p>
                                        <p className="mt-1 text-xl font-black text-slate-950">{owner.booking_count}</p>
                                    </div>
                                    <div className="rounded-xl bg-slate-50 p-3">
                                        <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">Queues</p>
                                        <p className="mt-1 text-xl font-black text-slate-950">{owner.queue_count}</p>
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
                                    <th className="px-4 py-3 font-black">Activity</th>
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
                                                    <p className="truncate text-xs font-semibold text-slate-500">Owner ID #{owner.user_id}</p>
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
                                            <div className="grid min-w-[10rem] grid-cols-3 gap-2 text-center">
                                                <div>
                                                    <p className="text-xs font-black text-slate-950">{owner.pet_count}</p>
                                                    <p className="text-[10px] font-bold uppercase text-slate-400">Pets</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs font-black text-slate-950">{owner.booking_count}</p>
                                                    <p className="text-[10px] font-bold uppercase text-slate-400">Bookings</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs font-black text-slate-950">{owner.queue_count}</p>
                                                    <p className="text-[10px] font-bold uppercase text-slate-400">Queues</p>
                                                </div>
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
                <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                    {selectedOwner ? (
                        <>
                            <DialogHeader className="text-left">
                                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-[linear-gradient(135deg,#f8fbff_0%,#ffffff_44%,#f0fdf4_100%)] p-5">
                                    <div className="flex flex-col gap-5 md:flex-row md:items-start">
                                        <OwnerAvatar owner={selectedOwner} className="size-24 shrink-0 rounded-2xl object-cover text-2xl shadow-sm" />
                                        <div className="min-w-0 flex-1">
                                            <div className="mb-2 flex flex-wrap items-center gap-2">
                                                <StatusBadge owner={selectedOwner} />
                                                <Badge className="border-0 bg-blue-50 text-[#155dfc]">Owner ID #{selectedOwner.user_id}</Badge>
                                            </div>
                                            <DialogTitle className="text-2xl font-black tracking-tight text-slate-950">{ownerName(selectedOwner)}</DialogTitle>
                                            <DialogDescription className="mt-1 text-sm font-semibold leading-6 text-slate-600">
                                                Pet owner profile, linked pets, activity summary, and account controls.
                                            </DialogDescription>
                                            <div className="mt-4 grid gap-2 text-sm font-semibold text-slate-600 md:grid-cols-2">
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
                                    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                        <ProfileDetail label="Owned Pets" value={selectedOwner.pet_count} />
                                        <ProfileDetail label="Bookings" value={selectedOwner.booking_count} />
                                        <ProfileDetail label="Queues" value={selectedOwner.queue_count} />
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
                                            className={isDeactivated(selectedOwner) ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50' : 'border-red-200 text-red-700 hover:bg-red-50'}
                                        >
                                            {isDeactivated(selectedOwner) ? <CheckCircle className="mr-2 size-4" /> : <Ban className="mr-2 size-4" />}
                                            {isDeactivated(selectedOwner) ? 'Reactivate Account' : 'Deactivate Account'}
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
                                                        <Badge className={petStatusClass(pet.pet_status)}>{cleanValue(pet.pet_status)}</Badge>
                                                    </div>
                                                    <p className="mt-1 truncate text-sm font-semibold text-slate-500">
                                                        {cleanValue(pet.pet_species)} / {cleanValue(pet.pet_breed)}
                                                    </p>
                                                    <p className="mt-1 text-xs font-bold text-slate-400">
                                                        Pet ID #{pet.pet_id}{pet.pet_sharable_ID ? ` / ${pet.pet_sharable_ID}` : ''}
                                                    </p>
                                                </div>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className="border-red-200 text-red-700 hover:bg-red-50 lg:shrink-0"
                                                onClick={() => setPendingOwnership({ owner: selectedOwner, pet })}
                                            >
                                                <Trash2 className="mr-2 size-4" />
                                                Remove Ownership
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
                                <DialogTitle>{isDeactivated(pendingStatusOwner) ? 'Reactivate pet owner?' : 'Deactivate pet owner?'}</DialogTitle>
                                <DialogDescription>
                                    {isDeactivated(pendingStatusOwner)
                                        ? 'The owner will be allowed to log in again.'
                                        : 'The owner will be blocked from logging in once the status column exists.'}
                                </DialogDescription>
                            </DialogHeader>
                            {!isDeactivated(pendingStatusOwner) ? (
                                <Textarea
                                    value={reason}
                                    onChange={(event) => setReason(event.target.value)}
                                    placeholder="Reason for deactivation"
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

            <Dialog open={Boolean(pendingOwnership)} onOpenChange={(open) => !open && setPendingOwnership(null)}>
                <DialogContent className="max-w-md">
                    {pendingOwnership ? (
                        <>
                            <DialogHeader>
                                <DialogTitle>Remove ownership?</DialogTitle>
                                <DialogDescription>
                                    This unlinks {pendingOwnership.pet.pet_name} from {ownerName(pendingOwnership.owner)}. The pet record itself is not deleted.
                                </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setPendingOwnership(null)} disabled={isSaving}>Cancel</Button>
                                <Button type="button" className="bg-red-600 hover:bg-red-700" onClick={handleRemoveOwnership} disabled={isSaving}>
                                    {isSaving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                                    Remove
                                </Button>
                            </DialogFooter>
                        </>
                    ) : null}
                </DialogContent>
            </Dialog>
        </div>
    );
}
