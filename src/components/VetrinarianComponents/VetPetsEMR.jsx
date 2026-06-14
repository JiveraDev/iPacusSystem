import { createElement, useEffect, useMemo, useState } from 'react';
import {
    AlertCircle,
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    CheckCircle2,
    ClipboardList,
    Copy,
    FileText,
    Loader2,
    PawPrint,
    Pencil,
    Plus,
    Search,
    Stethoscope,
    Syringe,
    Trash2
} from 'lucide-react';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Card, CardContent } from '../../ui/card';
import { Checkbox } from '../../ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { PhotoViewer } from '../../ui/photo-viewer';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Textarea } from '../../ui/textarea';
import { toast } from '../../reusecomponent/toast.jsx';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { useDashboardUser } from '../dashboardRouter.jsx';
import { formatDisplayDate } from '../../lib/date';
import { resolveImageUrl } from '../../lib/image';
import {
    addPetMedicalRecordGroupItem,
    createPetMedicalRecordGroup,
    deletePetMedicalRecordGroup,
    fetchAllPets,
    fetchPetMedicalRecords,
    removePetMedicalRecordGroupItem,
    updatePetMedicalRecordGroup,
    updatePetMedicalRecordGroupItem
} from '../../services/petService';

function asArray(value) {
    return Array.isArray(value) ? value : [];
}

function userId(user) {
    return user?.user_id || user?.userId || user?.id || null;
}

function petLabel(pet) {
    return [pet?.petName || pet?.name, pet?.species, pet?.breed].filter(Boolean).join(' - ') || 'Select pet';
}

function recordKey(record) {
    return `${record.sourceType}:${record.sourceId}`;
}

function sourceLabel(record) {
    if (record.bookingNumber) return `Booking ${record.bookingNumber}`;
    if (record.queueNumber) return `Queue #${record.queueNumber}`;
    return record.sourceType === 'visit' ? `Visit #${record.sourceId}` : `Diagnosis #${record.sourceId}`;
}

function editorLabel(name) {
    const value = String(name || '').trim();
    if (!value) return '';

    return value.toLowerCase().startsWith('dr.') ? value : `Dr. ${value}`;
}

function imageUrl(attachment) {
    return resolveImageUrl(attachment?.url || attachment?.relativeUrl || '');
}

function isImage(attachment) {
    const mime = String(attachment?.mimeType || '').toLowerCase();
    const url = String(attachment?.url || attachment?.relativeUrl || '').toLowerCase();
    return mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp)$/i.test(url);
}

function prescriptionCount(record) {
    return asArray(record?.prescriptions).length
        + asArray(record?.customSections).reduce((count, section) => (
            count + asArray(section?.prescriptions || section?.prescription).length
        ), 0);
}

export default function VetPetsEMR() {
    const currentUser = useDashboardUser();
    const currentUserId = userId(currentUser);
    const [pets, setPets] = useState([]);
    const [petSearch, setPetSearch] = useState('');
    const [selectedPetId, setSelectedPetId] = useState('');
    const [recordsData, setRecordsData] = useState(null);
    const [isLoadingPets, setIsLoadingPets] = useState(true);
    const [isLoadingRecords, setIsLoadingRecords] = useState(false);
    const [isPetSearchOpen, setIsPetSearchOpen] = useState(false);
    const [selectedGroupId, setSelectedGroupId] = useState('');
    const [groupDialogOpen, setGroupDialogOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState(null);
    const [groupDraft, setGroupDraft] = useState({ title: '', summary: '', visibleToOwner: true });
    const [editingItem, setEditingItem] = useState(null);
    const [itemDraft, setItemDraft] = useState({ title: '', summary: '', revisionNotes: '' });
    const [isPetPreviewOpen, setIsPetPreviewOpen] = useState(true);
    const [isServiceRecordsOpen, setIsServiceRecordsOpen] = useState(true);
    const [viewer, setViewer] = useState(null);

    const loadPets = async ({ isAutoRefresh = false } = {}) => {
        if (!isAutoRefresh) {
            setIsLoadingPets(true);
        }

        try {
            const data = await fetchAllPets();
            const nextPets = Array.isArray(data) ? data : [];
            setPets(nextPets);
            const requestedPetId = window.sessionStorage.getItem('vet-record-update-pet-id');
            if (requestedPetId) {
                window.sessionStorage.removeItem('vet-record-update-pet-id');
            }
            setSelectedPetId(current => current || requestedPetId || String(nextPets[0]?.db_id || nextPets[0]?.id || ''));
            return nextPets;
        } catch (error) {
            if (!isAutoRefresh) {
                toast.error(error.message || 'Failed to load pets.');
            }
            return [];
        } finally {
            if (!isAutoRefresh) {
                setIsLoadingPets(false);
            }
        }
    };

    const loadRecords = async ({ isAutoRefresh = false } = {}) => {
        if (!selectedPetId) return null;

        if (!isAutoRefresh) {
            setIsLoadingRecords(true);
        }

        try {
            const data = await fetchPetMedicalRecords(selectedPetId);
            if (data.success === false) {
                throw new Error(data.message || 'Medical records could not be loaded.');
            }
            setRecordsData(data);
            const groups = asArray(data.organizedRecords);
            setSelectedGroupId(current => (
                current && groups.some(group => String(group.groupId) === String(current))
                    ? current
                    : String(groups[0]?.groupId || '')
            ));
            return data;
        } catch (error) {
            if (!isAutoRefresh) {
                toast.error(error.message || 'Failed to load medical records.');
            }
            return null;
        } finally {
            if (!isAutoRefresh) {
                setIsLoadingRecords(false);
            }
        }
    };

    useEffect(() => {
        loadPets();
    }, []);

    useAutoRefresh(loadRecords, {
        enabled: Boolean(selectedPetId),
        refreshKey: `vet-pet-medical-records-${selectedPetId}`
    });

    const filteredPets = useMemo(() => {
        const query = petSearch.trim().toLowerCase();
        if (!query) return pets;

        return pets.filter(pet => [
            pet.petName,
            pet.name,
            pet.id,
            pet.db_id,
            pet.species,
            pet.breed,
            pet.tempOwnerName
        ].join(' ').toLowerCase().includes(query));
    }, [petSearch, pets]);

    const groups = asArray(recordsData?.organizedRecords);
    const serviceHistory = asArray(recordsData?.serviceHistory);
    const vaccinations = asArray(recordsData?.vaccinations);
    const selectedPet = recordsData?.pet || pets.find(pet => String(pet.db_id || pet.id) === String(selectedPetId));
    const selectedGroup = groups.find(group => String(group.groupId) === String(selectedGroupId));
    const visiblePetOptions = filteredPets.slice(0, 8);

    const selectPet = (pet) => {
        const nextPetId = String(pet?.db_id || pet?.id || '');
        if (!nextPetId) return;

        setPetSearch(pet.petName || pet.name || petLabel(pet));
        setIsPetSearchOpen(false);

        if (nextPetId !== String(selectedPetId)) {
            setSelectedPetId(nextPetId);
            setRecordsData(null);
            setSelectedGroupId('');
        }
    };

    const openCreateGroup = () => {
        setEditingGroup(null);
        setGroupDraft({
            title: `${selectedPet?.name || selectedPet?.petName || 'Pet'} Clinical Summary`,
            summary: '',
            visibleToOwner: true
        });
        setGroupDialogOpen(true);
    };

    const openEditGroup = (group) => {
        setEditingGroup(group);
        setGroupDraft({
            title: group.title || '',
            summary: group.summary || '',
            visibleToOwner: group.visibleToOwner !== false
        });
        setGroupDialogOpen(true);
    };

    const saveGroup = async () => {
        if (!selectedPetId) return;
        if (!groupDraft.title.trim()) {
            toast.error('Group title is required.');
            return;
        }

        try {
            if (editingGroup) {
                await updatePetMedicalRecordGroup(selectedPetId, {
                    groupId: editingGroup.groupId,
                    title: groupDraft.title,
                    summary: groupDraft.summary,
                    visibleToOwner: groupDraft.visibleToOwner,
                    userId: currentUserId
                });
                toast.success('Organized record updated.');
            } else {
                const data = await createPetMedicalRecordGroup(selectedPetId, {
                    title: groupDraft.title,
                    summary: groupDraft.summary,
                    visibleToOwner: groupDraft.visibleToOwner,
                    userId: currentUserId
                });
                if (data?.groupId) {
                    setSelectedGroupId(String(data.groupId));
                }
                toast.success('Organized record created.');
            }

            setGroupDialogOpen(false);
            await loadRecords({ isAutoRefresh: true });
        } catch (error) {
            toast.error(error.message || 'Failed to save organized record.');
        }
    };

    const removeGroup = async (group) => {
        if (!window.confirm(`Delete organized record "${group.title}"?`)) return;

        try {
            await deletePetMedicalRecordGroup(selectedPetId, group.groupId, { userId: currentUserId });
            toast.success('Organized record deleted.');
            await loadRecords({ isAutoRefresh: true });
        } catch (error) {
            toast.error(error.message || 'Failed to delete organized record.');
        }
    };

    const copyRecordToGroup = async (record, targetGroupId = selectedGroupId) => {
        if (!targetGroupId) {
            toast.error('Create or select an organized record first.');
            return;
        }

        try {
            await addPetMedicalRecordGroupItem(selectedPetId, {
                groupId: targetGroupId,
                sourceType: record.sourceType,
                sourceId: record.sourceId,
                title: record.title,
                summary: record.summary,
                userId: currentUserId
            });
            toast.success('Service record copied into the organized record.');
            await loadRecords({ isAutoRefresh: true });
        } catch (error) {
            toast.error(error.message || 'Failed to copy service record.');
        }
    };

    const openEditItem = (item) => {
        setEditingItem(item);
        setItemDraft({
            title: item.title || '',
            summary: item.summary || '',
            revisionNotes: item.revisionNotes || ''
        });
    };

    const saveItem = async () => {
        if (!editingItem) return;

        try {
            await updatePetMedicalRecordGroupItem(selectedPetId, {
                itemId: editingItem.itemId,
                title: itemDraft.title,
                summary: itemDraft.summary,
                revisionNotes: itemDraft.revisionNotes,
                userId: currentUserId
            });
            toast.success('Grouped summary updated.');
            setEditingItem(null);
            await loadRecords({ isAutoRefresh: true });
        } catch (error) {
            toast.error(error.message || 'Failed to update grouped summary.');
        }
    };

    const removeItem = async (item) => {
        try {
            await removePetMedicalRecordGroupItem(selectedPetId, item.itemId, { userId: currentUserId });
            toast.success('Service record removed from group.');
            await loadRecords({ isAutoRefresh: true });
        } catch (error) {
            toast.error(error.message || 'Failed to remove service record.');
        }
    };

    const handleDropOnGroup = (event, group) => {
        event.preventDefault();
        const rawRecord = event.dataTransfer.getData('application/json');
        if (!rawRecord) return;

        try {
            copyRecordToGroup(JSON.parse(rawRecord), group.groupId);
        } catch {
            toast.error('The dragged service record could not be read.');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <h2 className="text-2xl font-black text-slate-950">Medical Record Editor</h2>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                        Curate paid or finished service records into owner-ready organized summaries.
                    </p>
                </div>
                <Button onClick={openCreateGroup} disabled={!selectedPetId} className="gap-2 bg-[#155dfc] text-white hover:bg-[#0d4acf]">
                    <Plus className="size-4" />
                    New Organized Record
                </Button>
            </div>

            <section className="space-y-4">
                <Card className="border-slate-200">
                    <CardContent className="p-4">
                        <div className="grid gap-3 lg:grid-cols-[14rem_minmax(0,1fr)] lg:items-center">
                            <div>
                                <h3 className="text-base font-black text-slate-950">Find Pet</h3>
                                <p className="mt-1 text-xs font-semibold text-slate-500">Search by name, pet ID, breed, or owner.</p>
                            </div>

                            <div
                                className="relative"
                                onBlur={(event) => {
                                    if (!event.currentTarget.contains(event.relatedTarget)) {
                                        setIsPetSearchOpen(false);
                                    }
                                }}
                            >
                                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                                <Input
                                    value={petSearch}
                                    onChange={(event) => {
                                        setPetSearch(event.target.value);
                                        setIsPetSearchOpen(true);
                                    }}
                                    onFocus={() => setIsPetSearchOpen(true)}
                                    placeholder="Type to search pets"
                                    className="h-11 pl-9 text-base"
                                />

                                {isPetSearchOpen && (
                                    <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-72 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-xl">
                                        {isLoadingPets ? (
                                            <div className="flex items-center justify-center gap-2 p-5 text-sm font-semibold text-slate-500">
                                                <Loader2 className="size-4 animate-spin text-[#155dfc]" />
                                                Loading pets...
                                            </div>
                                        ) : visiblePetOptions.length === 0 ? (
                                            <div className="p-5 text-center text-sm font-semibold text-slate-400">
                                                No pets match your search.
                                            </div>
                                        ) : (
                                            visiblePetOptions.map((pet) => {
                                                const petId = String(pet.db_id || pet.id);
                                                const isSelected = petId === String(selectedPetId);
                                                const meta = [
                                                    pet.species,
                                                    pet.breed,
                                                    pet.id || pet.pet_sharable_ID,
                                                    pet.tempOwnerName || pet.ownerName
                                                ].filter(Boolean).join(' - ');

                                                return (
                                                    <button
                                                        key={petId}
                                                        type="button"
                                                        onMouseDown={(event) => {
                                                            event.preventDefault();
                                                            selectPet(pet);
                                                        }}
                                                        className={`flex w-full items-start justify-between gap-3 rounded-md p-3 text-left transition ${
                                                            isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'
                                                        }`}
                                                    >
                                                        <span className="min-w-0">
                                                            <span className="block truncate text-sm font-black text-slate-950">
                                                                {pet.petName || pet.name || 'Unnamed pet'}
                                                            </span>
                                                            {meta && (
                                                                <span className="mt-1 block truncate text-xs font-semibold text-slate-500">
                                                                    {meta}
                                                                </span>
                                                            )}
                                                        </span>
                                                        {isSelected && (
                                                            <Badge className="shrink-0 border-0 bg-[#155dfc] text-white">Selected</Badge>
                                                        )}
                                                    </button>
                                                );
                                            })
                                        )}
                                        {filteredPets.length > visiblePetOptions.length && (
                                            <div className="border-t border-slate-100 px-3 py-2 text-xs font-bold text-slate-400">
                                                Keep typing to narrow {filteredPets.length - visiblePetOptions.length} more result{filteredPets.length - visiblePetOptions.length === 1 ? '' : 's'}.
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {isPetPreviewOpen && (
                    <PetPreviewCard
                        pet={selectedPet}
                        groupsCount={groups.length}
                        serviceCount={serviceHistory.length}
                        addedCount={serviceHistory.filter(record => record.isAddedToOrganizedRecord).length}
                        onCollapse={() => setIsPetPreviewOpen(false)}
                    />
                )}
            </section>

            {!isPetPreviewOpen && (
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsPetPreviewOpen(true)}
                    aria-label="Show pet information"
                    aria-expanded={isPetPreviewOpen}
                    className="fixed right-0 top-28 z-40 flex h-20 w-11 flex-col items-center justify-center gap-2 rounded-l-lg rounded-r-none border-r-0 border-slate-200 bg-white p-0 shadow-lg hover:bg-slate-50"
                >
                    <ChevronLeft className="size-4" />
                    <PawPrint className="size-4 text-[#155dfc]" />
                </Button>
            )}

            {recordsData?.schemaReady === false && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
                    {recordsData.message || 'Medical record schema is not ready.'}
                </div>
            )}

            <VaccinationPanel vaccinations={vaccinations} />

            <section className={`grid min-h-[38rem] gap-5 ${isServiceRecordsOpen ? 'xl:grid-cols-[minmax(0,1fr)_24rem]' : 'xl:grid-cols-1'}`}>
                <main className="min-w-0 space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h3 className="text-lg font-black text-slate-950">Organized Medical Records</h3>
                            {selectedPet && (
                                <p className="text-sm font-semibold text-slate-500">
                                    {selectedPet.name || selectedPet.petName} - {selectedPet.species || 'Pet'} {selectedPet.ownerName ? `- ${selectedPet.ownerName}` : ''}
                                </p>
                            )}
                        </div>
                        {groups.length > 0 && (
                            <Select value={String(selectedGroupId)} onValueChange={setSelectedGroupId}>
                                <SelectTrigger className="w-full sm:w-72">
                                    <SelectValue placeholder="Target organized record" displayValue={selectedGroup?.title} />
                                </SelectTrigger>
                                <SelectContent>
                                    {groups.map((group) => (
                                        <SelectItem key={group.groupId} value={String(group.groupId)}>
                                            {group.title}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>

                    {isLoadingRecords ? (
                        <LoadingPanel />
                    ) : groups.length === 0 ? (
                        <EmptyPanel
                            icon={ClipboardList}
                            title="No organized records"
                            message="Create a group, then copy finished service records from the side panel."
                        />
                    ) : (
                        <div className="space-y-4">
                            {groups.map((group) => (
                                <RecordGroup
                                    key={group.groupId}
                                    group={group}
                                    selected={String(group.groupId) === String(selectedGroupId)}
                                    onSelect={() => setSelectedGroupId(String(group.groupId))}
                                    onDrop={(event) => handleDropOnGroup(event, group)}
                                    onEdit={() => openEditGroup(group)}
                                    onDelete={() => removeGroup(group)}
                                    onEditItem={openEditItem}
                                    onRemoveItem={removeItem}
                                    onPreview={setViewer}
                                />
                            ))}
                        </div>
                    )}
                </main>

                {isServiceRecordsOpen && (
                    <aside className="relative min-w-0 rounded-lg border border-slate-200 bg-white shadow-sm xl:sticky xl:top-6 xl:self-start">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setIsServiceRecordsOpen(false)}
                            aria-label="Hide service records"
                            aria-expanded={isServiceRecordsOpen}
                            className="absolute -left-4 top-5 z-10 size-8 rounded-full border-slate-200 bg-white p-0 shadow-md hover:bg-slate-50"
                        >
                            <ChevronRight className="size-4" />
                        </Button>

                        <div className="border-b border-slate-100 p-4 pl-6">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <h3 className="flex items-center gap-2 font-black text-slate-950">
                                        <ClipboardList className="size-5 text-[#155dfc]" />
                                        Service Records
                                    </h3>
                                    <p className="mt-1 text-xs font-semibold text-slate-500">Drag or copy into a group.</p>
                                </div>
                                <Badge className="border-0 bg-slate-100 text-slate-700">{serviceHistory.length}</Badge>
                            </div>
                        </div>

                        <div className="max-h-[34rem] space-y-3 overflow-y-auto p-4">
                            {serviceHistory.length === 0 ? (
                                <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-400">
                                    No paid or finished service records found for this pet.
                                </p>
                            ) : (
                                serviceHistory.map((record) => (
                                    <ServiceRecordCard
                                        key={recordKey(record)}
                                        record={record}
                                        disabled={!selectedGroupId}
                                        onCopy={() => copyRecordToGroup(record)}
                                        onPreview={setViewer}
                                    />
                                ))
                            )}
                        </div>
                    </aside>
                )}
            </section>

            {!isServiceRecordsOpen && (
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsServiceRecordsOpen(true)}
                    aria-label="Show service records"
                    aria-expanded={isServiceRecordsOpen}
                    className="fixed right-0 top-48 z-40 flex h-20 w-11 flex-col items-center justify-center gap-2 rounded-l-lg rounded-r-none border-r-0 border-slate-200 bg-white p-0 shadow-lg hover:bg-slate-50"
                >
                    <ChevronLeft className="size-4" />
                    <ClipboardList className="size-4 text-[#155dfc]" />
                    {serviceHistory.length > 0 && (
                        <span className="absolute -left-2 -top-2 flex size-6 items-center justify-center rounded-full bg-red-600 text-xs font-black text-white shadow-md">
                            {serviceHistory.length}
                        </span>
                    )}
                </Button>
            )}

            <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{editingGroup ? 'Edit Organized Record' : 'New Organized Record'}</DialogTitle>
                        <DialogDescription>
                            This is the owner-visible summary container. Service records copied into it keep their original diagnosis data.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Title</Label>
                            <Input value={groupDraft.title} onChange={(event) => setGroupDraft(current => ({ ...current, title: event.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label>Group Summary</Label>
                            <Textarea
                                value={groupDraft.summary}
                                onChange={(event) => setGroupDraft(current => ({ ...current, summary: event.target.value }))}
                                placeholder="Summarize this treatment group, condition, or service sequence."
                            />
                        </div>
                        <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-bold text-slate-700">
                            <Checkbox
                                checked={groupDraft.visibleToOwner}
                                onCheckedChange={(checked) => setGroupDraft(current => ({ ...current, visibleToOwner: checked }))}
                            />
                            Visible to pet owner print view
                        </label>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setGroupDialogOpen(false)}>Cancel</Button>
                        <Button onClick={saveGroup} className="bg-[#155dfc] text-white hover:bg-[#0d4acf]">Save</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={Boolean(editingItem)} onOpenChange={(open) => !open && setEditingItem(null)}>
                <DialogContent className="max-w-5xl">
                    <DialogHeader>
                        <DialogTitle>Modify Grouped Diagnosis Summary</DialogTitle>
                        <DialogDescription>
                            Edit the curated summary without changing the original diagnosis or billing record.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                        <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                            <h3 className="font-black text-slate-950">Source Diagnosis Sheet</h3>
                            <SourceRecordDetails record={editingItem?.sourceSnapshot} onPreview={setViewer} />
                        </div>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>Grouped Title</Label>
                                <Input value={itemDraft.title} onChange={(event) => setItemDraft(current => ({ ...current, title: event.target.value }))} />
                            </div>
                            <div className="space-y-2">
                                <Label>Owner Summary</Label>
                                <Textarea
                                    value={itemDraft.summary}
                                    onChange={(event) => setItemDraft(current => ({ ...current, summary: event.target.value }))}
                                    className="min-h-40"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Veterinarian Revision Notes</Label>
                                <Textarea
                                    value={itemDraft.revisionNotes}
                                    onChange={(event) => setItemDraft(current => ({ ...current, revisionNotes: event.target.value }))}
                                    placeholder="Explain changes, clarifications, or owner-facing revisions."
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingItem(null)}>Cancel</Button>
                        <Button onClick={saveItem} className="bg-[#155dfc] text-white hover:bg-[#0d4acf]">Save Revision</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <PhotoViewer
                open={Boolean(viewer)}
                src={viewer?.src || ''}
                alt={viewer?.alt || 'Medical record image'}
                onOpenChange={(open) => !open && setViewer(null)}
            />
        </div>
    );
}

function PetPreviewCard({ pet, groupsCount, serviceCount, addedCount, onCollapse }) {
    const imageSrc = resolveImageUrl(pet?.profileImage || pet?.setpetImage_url || '');
    const petName = pet?.name || pet?.petName || 'No pet selected';
    const ownerName = pet?.ownerName || pet?.tempOwnerName || 'N/A';
    const petId = pet?.id || pet?.pet_sharable_ID || pet?.dbId || pet?.db_id || 'N/A';

    return (
        <Card className="overflow-hidden border-slate-200">
            <div className="flex flex-col gap-4 border-b border-slate-100 bg-white p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                    <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                        {imageSrc ? (
                            <img src={imageSrc} alt={petName} className="h-full w-full object-cover" />
                        ) : (
                            <PawPrint className="size-8 text-slate-300" />
                        )}
                    </div>
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <h3 className="break-words text-lg font-black text-slate-950">{petName}</h3>
                            <Badge className="border-0 bg-blue-50 text-[#155dfc]">
                                {pet?.status || 'Active'}
                            </Badge>
                        </div>
                        <p className="mt-1 text-sm font-semibold text-slate-500">
                            {[pet?.species, pet?.breed].filter(Boolean).join(' - ') || 'Species not set'}
                        </p>
                        <p className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-400">Pet Information</p>
                    </div>
                </div>

                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onCollapse}
                    aria-label="Hide pet information"
                    className="h-9 w-full gap-2 sm:w-auto"
                >
                    <ChevronRight className="size-4" />
                    Hide
                </Button>
            </div>

            <CardContent className="p-4">
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
                    <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
                        <PreviewInfo label="Pet ID" value={petId} />
                        <PreviewInfo label="Owner" value={ownerName} />
                        <PreviewInfo label="Sex" value={pet?.gender || 'N/A'} />
                        <PreviewInfo label="Age" value={pet?.age || 'N/A'} />
                        <PreviewInfo label="Weight" value={pet?.weight ? `${pet.weight} kg` : 'N/A'} />
                        <PreviewInfo label="Microchip" value={pet?.microchipId || 'N/A'} />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <Stat label="Groups" value={groupsCount} />
                        <Stat label="Services" value={serviceCount} />
                        <Stat label="Added" value={addedCount} />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function VaccinationPanel({ vaccinations }) {
    return (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <header className="border-b border-slate-100 bg-slate-50 px-5 py-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                        <Syringe className="size-5 text-[#155dfc]" />
                        <h3 className="text-lg font-black text-slate-950">Vaccination Records</h3>
                    </div>
                    <Badge className="w-fit border-0 bg-blue-50 text-[#155dfc]">
                        {vaccinations.length} vaccine{vaccinations.length === 1 ? '' : 's'}
                    </Badge>
                </div>
            </header>

            {vaccinations.length === 0 ? (
                <div className="p-5 text-sm font-semibold text-slate-400">No vaccination records saved for this pet.</div>
            ) : (
                <div className="divide-y divide-slate-100">
                    {vaccinations.map((vaccine, index) => (
                        <div
                            key={vaccine.id || index}
                            className="grid gap-3 px-5 py-4 text-sm md:grid-cols-[minmax(0,1.2fr)_0.8fr_0.8fr_1fr_0.7fr] md:items-center"
                        >
                            <VaccineCell label="Vaccine" value={vaccine.name || 'Unnamed vaccine'} strong />
                            <VaccineCell label="Date Given" value={formatDisplayDate(vaccine.date)} />
                            <VaccineCell label="Next Due" value={formatDisplayDate(vaccine.nextDue)} highlight />
                            <VaccineCell label="Veterinarian" value={vaccine.applicator || vaccine.veterinarianName || 'N/A'} />
                            <div className="flex items-center justify-between gap-3 md:block">
                                <span className="text-xs font-black uppercase tracking-widest text-slate-400 md:hidden">Status</span>
                                <Badge className={`w-fit border-0 ${vaccine.status === 'pending' ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'}`}>
                                    {vaccine.status || 'completed'}
                                </Badge>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}

function VaccineCell({ label, value, strong = false, highlight = false }) {
    return (
        <div className="flex items-start justify-between gap-3 md:block">
            <span className="shrink-0 text-xs font-black uppercase tracking-widest text-slate-400 md:hidden">{label}</span>
            <span className={`min-w-0 break-words text-right md:text-left ${strong ? 'font-black text-slate-900' : 'font-semibold'} ${highlight ? 'text-[#155dfc]' : 'text-slate-700'}`}>
                {value || 'N/A'}
            </span>
        </div>
    );
}

function PreviewInfo({ label, value }) {
    return (
        <div className="min-w-0 rounded-lg border border-slate-100 bg-slate-50 p-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
            <p className="mt-1 truncate text-xs font-bold text-slate-800">{value || 'N/A'}</p>
        </div>
    );
}

function Stat({ label, value }) {
    return (
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-center">
            <p className="text-xl font-black text-slate-950">{value}</p>
            <p className="text-xs font-black uppercase tracking-widest text-slate-400">{label}</p>
        </div>
    );
}

function LoadingPanel() {
    return (
        <div className="flex min-h-80 items-center justify-center rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center gap-3 text-sm font-semibold text-slate-500">
                <Loader2 className="size-5 animate-spin text-[#155dfc]" />
                Loading medical records...
            </div>
        </div>
    );
}

function EmptyPanel({ icon, title, message }) {
    return (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-10 text-center">
            {createElement(icon, { className: 'mx-auto mb-4 size-12 text-slate-300' })}
            <h3 className="text-lg font-black text-slate-900">{title}</h3>
            <p className="mt-2 text-sm font-semibold text-slate-500">{message}</p>
        </div>
    );
}

function RecordGroup({ group, selected, onSelect, onDrop, onEdit, onDelete, onEditItem, onRemoveItem, onPreview }) {
    return (
        <article
            onDragOver={(event) => event.preventDefault()}
            onDrop={onDrop}
            className={`overflow-hidden rounded-xl border bg-white shadow-sm transition ${selected ? 'border-[#155dfc] ring-2 ring-blue-100' : 'border-slate-200'}`}
        >
            <header className="border-b border-slate-100 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <button type="button" onClick={onSelect} className="min-w-0 text-left">
                        <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-black text-slate-950">{group.title}</h3>
                            {selected && <Badge className="border-0 bg-blue-50 text-[#155dfc]">Target</Badge>}
                            {!group.visibleToOwner && <Badge className="border-0 bg-amber-50 text-amber-700">Internal</Badge>}
                        </div>
                        {group.summary && <p className="mt-2 whitespace-pre-wrap text-sm font-semibold text-slate-600">{group.summary}</p>}
                        {group.updatedByName && (
                            <p className="mt-2 text-xs font-black uppercase tracking-widest text-slate-400">
                                Edited by {editorLabel(group.updatedByName)}
                            </p>
                        )}
                    </button>
                    <div className="flex shrink-0 gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={onEdit} className="gap-1">
                            <Pencil className="size-3" />
                            Edit
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={onDelete} className="gap-1 border-red-200 text-red-600 hover:bg-red-50">
                            <Trash2 className="size-3" />
                            Delete
                        </Button>
                    </div>
                </div>
            </header>

            <div className="divide-y divide-slate-100">
                {asArray(group.items).length === 0 ? (
                    <div className="p-5 text-sm font-semibold text-slate-400">
                        Drop service records here or use Copy on the side panel.
                    </div>
                ) : (
                    group.items.map((item) => (
                        <GroupedItem
                            key={item.itemId}
                            item={item}
                            onEdit={() => onEditItem(item)}
                            onRemove={() => onRemoveItem(item)}
                            onPreview={onPreview}
                        />
                    ))
                )}
            </div>
        </article>
    );
}

function GroupedItem({ item, onEdit, onRemove, onPreview }) {
    const source = item.sourceSnapshot || {};
    const attachments = [...asArray(source.attachments), ...asArray(source.sourceUploads)];

    return (
        <section className="p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400">{formatDisplayDate(item.serviceDate || source.serviceDate)}</p>
                    <h4 className="mt-1 break-words text-base font-black text-slate-900">{item.title}</h4>
                    {item.updatedByName && (
                        <p className="mt-1 text-xs font-bold text-slate-400">Edited by {editorLabel(item.updatedByName)}</p>
                    )}
                    {item.summary && <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-600">{item.summary}</p>}
                    {item.revisionNotes && (
                        <p className="mt-2 rounded-lg border border-amber-100 bg-amber-50 p-2 text-sm font-semibold text-amber-800">{item.revisionNotes}</p>
                    )}
                </div>
                <div className="flex shrink-0 gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={onEdit} className="gap-1">
                        <Pencil className="size-3" />
                        Revise
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={onRemove} className="gap-1 border-red-200 text-red-600 hover:bg-red-50">
                        <Trash2 className="size-3" />
                        Remove
                    </Button>
                </div>
            </div>
            {attachments.length > 0 && (
                <AttachmentStrip attachments={attachments} onPreview={onPreview} />
            )}
        </section>
    );
}

function ServiceRecordCard({ record, disabled, onCopy, onPreview }) {
    const attachments = [...asArray(record.attachments), ...asArray(record.sourceUploads)];

    return (
        <article
            draggable
            onDragStart={(event) => {
                event.dataTransfer.setData('application/json', JSON.stringify(record));
                event.dataTransfer.effectAllowed = 'copy';
            }}
            className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                        <Badge className="border-0 bg-slate-100 text-slate-700">{sourceLabel(record)}</Badge>
                        {record.isAddedToOrganizedRecord && (
                            <Badge className="gap-1 border-0 bg-green-50 text-green-700">
                                <CheckCircle2 className="size-3" />
                                Added
                            </Badge>
                        )}
                    </div>
                    <h4 className="break-words text-sm font-black text-slate-950">{record.title || 'Service record'}</h4>
                    <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-slate-500">
                        <CalendarDays className="size-3" />
                        {formatDisplayDate(record.serviceDate)}
                    </p>
                </div>
                <Button type="button" size="sm" onClick={onCopy} disabled={disabled} className="h-8 gap-1 bg-[#155dfc] px-2 text-xs text-white hover:bg-[#0d4acf]">
                    <Copy className="size-3" />
                    Copy
                </Button>
            </div>
            {record.summary && (
                <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-xs font-semibold leading-5 text-slate-600">{record.summary}</p>
            )}
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-slate-500">
                {record.billingStatus && <span>Billing: {record.billingStatus}</span>}
                {prescriptionCount(record) > 0 && <span>{prescriptionCount(record)} Rx</span>}
                {attachments.length > 0 && <span>{attachments.length} file{attachments.length === 1 ? '' : 's'}</span>}
            </div>
            {attachments.length > 0 && <AttachmentStrip attachments={attachments.slice(0, 4)} onPreview={onPreview} compact />}
        </article>
    );
}

function AttachmentStrip({ attachments, onPreview, compact = false }) {
    return (
        <div className={`mt-3 grid gap-2 ${compact ? 'grid-cols-4' : 'grid-cols-2 sm:grid-cols-4'}`}>
            {attachments.map((attachment, index) => {
                const url = imageUrl(attachment);
                const canPreview = isImage(attachment);
                const title = attachment.name || 'Attachment';
                const tile = (
                    <div className="flex h-16 items-center justify-center bg-white">
                        {canPreview && url ? (
                            <img src={url} alt={title} className="h-full w-full object-cover" />
                        ) : (
                            <FileText className="size-5 text-slate-300" />
                        )}
                    </div>
                );

                if (!canPreview && url) {
                    return (
                        <a
                            key={attachment.id || `${url}-${index}`}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
                            title={title}
                        >
                            {tile}
                        </a>
                    );
                }

                return (
                    <button
                        key={attachment.id || `${url}-${index}`}
                        type="button"
                        onClick={() => canPreview && onPreview({ src: url, alt: title })}
                        disabled={!canPreview || !url}
                        className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
                        title={title}
                    >
                        {tile}
                    </button>
                );
            })}
        </div>
    );
}

function SourceRecordDetails({ record, onPreview }) {
    if (!record) {
        return <p className="text-sm font-semibold text-slate-500">No source snapshot is available for this grouped item.</p>;
    }

    const attachments = [...asArray(record.attachments), ...asArray(record.sourceUploads)];
    const prescriptions = [
        ...asArray(record.prescriptions),
        ...asArray(record.customSections).flatMap(section => asArray(section.prescriptions || section.prescription))
    ];

    return (
        <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
                <Detail label="Source" value={sourceLabel(record)} />
                <Detail label="Date" value={formatDisplayDate(record.serviceDate)} />
                <Detail label="Vet" value={record.veterinarianName || 'Clinic Team'} />
                <Detail label="Billing" value={record.billingStatus || record.status || 'N/A'} />
            </div>
            <TextBlock icon={Stethoscope} label="Diagnosis" value={record.diagnosis || record.summary} />
            <TextBlock icon={ClipboardList} label="Treatment" value={record.treatment} />
            <TextBlock icon={AlertCircle} label="Notes" value={record.notes} />
            {prescriptions.length > 0 && (
                <div className="rounded-lg border border-blue-100 bg-white p-3">
                    <p className="mb-2 font-black text-[#155dfc]">Prescriptions</p>
                    <div className="space-y-2">
                        {prescriptions.map((prescription, index) => (
                            <p key={prescription.id || index} className="rounded-md bg-blue-50 p-2 font-semibold text-slate-700">
                                {prescription.medicine || prescription.name || 'Medication'}
                            </p>
                        ))}
                    </div>
                </div>
            )}
            {attachments.length > 0 && <AttachmentStrip attachments={attachments} onPreview={onPreview} />}
        </div>
    );
}

function Detail({ label, value }) {
    return (
        <div className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-xs font-black uppercase tracking-widest text-slate-400">{label}</p>
            <p className="mt-1 break-words font-bold text-slate-800">{value || 'N/A'}</p>
        </div>
    );
}

function TextBlock({ icon, label, value }) {
    if (!value) return null;

    return (
        <div className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400">
                {createElement(icon, { className: 'size-4' })}
                {label}
            </div>
            <p className="whitespace-pre-wrap font-semibold leading-6 text-slate-700">{value}</p>
        </div>
    );
}
