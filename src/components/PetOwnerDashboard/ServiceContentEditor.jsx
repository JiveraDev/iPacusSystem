import { useState } from 'react';
import { Loader2, Pencil, Plus, Save, ShieldCheck, Trash2 } from 'lucide-react';

import { Button } from '../../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Textarea } from '../../ui/textarea';
import { parseIncludedItems, includedItemsText } from '../../lib/servicePriceProjections';
import { toast } from '../../reusecomponent/toast.jsx';

function normalizeRole(role) {
    return String(role || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function currentUserCanEditServiceContent() {
    try {
        const user = JSON.parse(window.localStorage.getItem('currentUser') || '{}');
        return ['admin', 'super_admin', 'superadmin'].includes(normalizeRole(user.role || user.user_role));
    } catch {
        return false;
    }
}

function EditContentButton({ children, onClick }) {
    return (
        <Button type="button" variant="outline" size="sm" onClick={onClick} className="gap-2">
            <Pencil className="size-4" aria-hidden="true" />
            {children}
        </Button>
    );
}

function cloneRows(rows) {
    return Array.isArray(rows) ? rows.map((row) => ({ ...row })) : [];
}

function buildProjectionDraft(config, detailKey, priceFields, instructionKey, matrixConfig) {
    const detail = config?.serviceDetails?.[detailKey] || {};
    return {
        title: detail.title || '',
        includedTitle: detail.includedTitle || '',
        includedItems: includedItemsText(detail.includedItems),
        duration: detail.duration || '',
        reviewNote: detail.reviewNote || '',
        instruction: instructionKey ? config?.instructions?.[instructionKey] || '' : '',
        prices: Object.fromEntries(priceFields.map((field) => [field.key, config?.servicePrices?.[field.key] || ''])),
        matrix: matrixConfig ? cloneRows(config?.[matrixConfig.key]) : []
    };
}

export function ServiceProjectionEditor({
    config,
    detailKey,
    instructionKey,
    matrixConfig = null,
    onSave,
    priceFields = []
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [draft, setDraft] = useState(() => buildProjectionDraft(
        config,
        detailKey,
        priceFields,
        instructionKey,
        matrixConfig
    ));

    if (!currentUserCanEditServiceContent()) {
        return null;
    }

    const startEditing = () => {
        setDraft(buildProjectionDraft(config, detailKey, priceFields, instructionKey, matrixConfig));
        setIsEditing(true);
    };

    const updateMatrixCell = (rowIndex, field, value) => {
        setDraft((current) => ({
            ...current,
            matrix: current.matrix.map((row, index) => index === rowIndex ? { ...row, [field]: value } : row)
        }));
    };

    const saveChanges = async () => {
        const includedItems = parseIncludedItems(draft.includedItems);
        if (!draft.title.trim() || !draft.includedTitle.trim() || includedItems.length === 0 || !draft.duration.trim()) {
            toast.error('Complete the service title, inclusions, and duration before saving.');
            return;
        }

        const nextConfig = {
            ...config,
            serviceDetails: {
                ...config.serviceDetails,
                [detailKey]: {
                    ...config.serviceDetails[detailKey],
                    title: draft.title.trim(),
                    includedTitle: draft.includedTitle.trim(),
                    includedItems,
                    duration: draft.duration.trim(),
                    reviewNote: draft.reviewNote.trim()
                }
            },
            servicePrices: {
                ...config.servicePrices,
                ...Object.fromEntries(Object.entries(draft.prices).map(([key, value]) => [key, value.trim()]))
            }
        };

        if (instructionKey) {
            nextConfig.instructions = {
                ...config.instructions,
                [instructionKey]: draft.instruction.trim()
            };
        }

        if (matrixConfig) {
            nextConfig[matrixConfig.key] = cloneRows(draft.matrix);
        }

        setIsSaving(true);
        try {
            await onSave(nextConfig);
            setIsEditing(false);
            toast.success(`${draft.title.trim()} content updated.`);
        } catch (error) {
            console.error('Service content could not be saved:', error);
            toast.error(error?.message || 'Service content could not be saved. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <>
            <div className="mb-4 flex justify-end border-b border-slate-100 pb-4 dark:border-slate-800">
                <EditContentButton onClick={startEditing}>Edit this service content</EditContentButton>
            </div>
            <Dialog open={isEditing} onOpenChange={(open) => !isSaving && setIsEditing(open)}>
                <DialogContent className="max-w-4xl" showClose={!isSaving}>
                    <DialogHeader>
                        <div className="flex items-start gap-3">
                            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                                <ShieldCheck className="size-5" aria-hidden="true" />
                            </span>
                            <div>
                                <DialogTitle className="dark:text-white">Edit this service page</DialogTitle>
                                <DialogDescription className="mt-1 dark:text-slate-300">Update the content shown to pet owners. Changes are shared after the server confirms the save.</DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                    <Label htmlFor={`${detailKey}-display-title`}>Service title</Label>
                    <Input
                        id={`${detailKey}-display-title`}
                        value={draft.title}
                        onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor={`${detailKey}-included-title`}>Inclusions heading</Label>
                    <Input
                        id={`${detailKey}-included-title`}
                        value={draft.includedTitle}
                        onChange={(event) => setDraft({ ...draft, includedTitle: event.target.value })}
                    />
                </div>
                <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor={`${detailKey}-included-items`}>Included items (one per line)</Label>
                    <Textarea
                        id={`${detailKey}-included-items`}
                        rows={5}
                        value={draft.includedItems}
                        onChange={(event) => setDraft({ ...draft, includedItems: event.target.value })}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor={`${detailKey}-duration`}>Duration</Label>
                    <Input
                        id={`${detailKey}-duration`}
                        value={draft.duration}
                        onChange={(event) => setDraft({ ...draft, duration: event.target.value })}
                    />
                </div>
                {priceFields.map((field) => (
                    <div key={field.key} className="space-y-2">
                        <Label htmlFor={`${detailKey}-${field.key}`}>{field.label}</Label>
                        <Input
                            id={`${detailKey}-${field.key}`}
                            value={draft.prices[field.key] || ''}
                            onChange={(event) => setDraft({
                                ...draft,
                                prices: { ...draft.prices, [field.key]: event.target.value }
                            })}
                        />
                    </div>
                ))}
                {instructionKey && (
                    <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor={`${detailKey}-price-instruction`}>Price or booking instruction</Label>
                        <Textarea
                            id={`${detailKey}-price-instruction`}
                            rows={2}
                            value={draft.instruction}
                            onChange={(event) => setDraft({ ...draft, instruction: event.target.value })}
                            placeholder="Optional supporting instruction"
                        />
                    </div>
                )}
                <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor={`${detailKey}-review-note`}>Booking review note</Label>
                    <Textarea
                        id={`${detailKey}-review-note`}
                        rows={3}
                        value={draft.reviewNote}
                        onChange={(event) => setDraft({ ...draft, reviewNote: event.target.value })}
                    />
                </div>
                    </div>

                    {matrixConfig && draft.matrix.length > 0 && (
                <div className="mt-5 space-y-3 border-t border-slate-200 pt-4 dark:border-slate-700">
                    <h5 className="text-sm font-black text-slate-950 dark:text-white">{matrixConfig.label}</h5>
                    <div className="space-y-3">
                        {draft.matrix.map((row, rowIndex) => (
                            <div key={`${row[matrixConfig.identityField]}-${rowIndex}`} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900 sm:grid-cols-5">
                                {matrixConfig.columns.map((column) => (
                                    <div key={column.key} className={`space-y-1.5 ${column.wide ? 'sm:col-span-1' : ''}`}>
                                        <Label htmlFor={`${detailKey}-matrix-${rowIndex}-${column.key}`} className="text-xs">{column.label}</Label>
                                        <Input
                                            id={`${detailKey}-matrix-${rowIndex}-${column.key}`}
                                            value={row[column.key] || ''}
                                            onChange={(event) => updateMatrixCell(rowIndex, column.key, event.target.value)}
                                        />
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
                    )}

                    <DialogFooter className="border-t border-slate-200 pt-4 dark:border-slate-700">
                        <Button type="button" variant="outline" onClick={() => setIsEditing(false)} disabled={isSaving}>Cancel</Button>
                        <Button type="button" onClick={saveChanges} disabled={isSaving}>
                            {isSaving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
                            {isSaving ? 'Saving...' : 'Save service content'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

function createCustomHomeServiceId() {
    return `custom-${Date.now()}`;
}

export function HomeServicesContentEditor({ config, onSave }) {
    const [isEditing, setIsEditing] = useState(false);
    const [draft, setDraft] = useState([]);
    const [isSaving, setIsSaving] = useState(false);

    if (!currentUserCanEditServiceContent()) {
        return null;
    }

    const startEditing = () => {
        setDraft(cloneRows(config.homeServices).filter((service) => service.id !== 'outside-lucena'));
        setIsEditing(true);
    };

    const updateRow = (index, field, value) => {
        setDraft((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row));
    };

    const addRow = () => {
        setDraft((current) => [
            ...current,
            {
                id: createCustomHomeServiceId(),
                name: 'New Home Service',
                description: 'Describe what is included',
                price: 'Price confirmed after review'
            }
        ]);
    };

    const removeCustomRow = (id) => {
        setDraft((current) => current.filter((row) => row.id !== id));
    };

    const saveChanges = async () => {
        if (draft.some((row) => !row.name.trim() || !row.description.trim() || !row.price.trim())) {
            toast.error('Every home service needs a name, description, and price.');
            return;
        }

        const hiddenLocationRow = config.homeServices.find((service) => service.id === 'outside-lucena');
        setIsSaving(true);
        try {
            await onSave({
                ...config,
                homeServices: [
                    ...draft.map((row) => ({
                        ...row,
                        name: row.name.trim(),
                        description: row.description.trim(),
                        price: row.price.trim()
                    })),
                    ...(hiddenLocationRow ? [hiddenLocationRow] : [])
                ]
            });
            setIsEditing(false);
            toast.success('Home Services content updated.');
        } catch (error) {
            console.error('Home Services content could not be saved:', error);
            toast.error(error?.message || 'Home Services content could not be saved. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <>
            <div className="flex justify-end">
                <EditContentButton onClick={startEditing}>Edit Home Services content</EditContentButton>
            </div>
            <Dialog open={isEditing} onOpenChange={(open) => !isSaving && setIsEditing(open)}>
                <DialogContent className="max-w-5xl" showClose={!isSaving}>
                    <DialogHeader>
                        <div className="flex items-start gap-3">
                            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                                <ShieldCheck className="size-5" aria-hidden="true" />
                            </span>
                            <div>
                                <DialogTitle className="dark:text-white">Edit Home Services cards</DialogTitle>
                                <DialogDescription className="mt-1 dark:text-slate-300">Edit what pet owners see and add another home-service option here.</DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="grid gap-3 lg:grid-cols-2">
                {draft.map((row, index) => (
                    <div key={row.id} className="space-y-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                        <div className="flex items-center justify-between gap-3">
                            <span className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Home service {index + 1}</span>
                            {row.id.startsWith('custom-') && (
                                <Button type="button" variant="ghost" size="sm" onClick={() => removeCustomRow(row.id)} className="text-rose-700 hover:bg-rose-50 hover:text-rose-800">
                                    <Trash2 className="size-4" />
                                    Remove
                                </Button>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor={`home-service-name-${row.id}`}>Name</Label>
                            <Input id={`home-service-name-${row.id}`} value={row.name} onChange={(event) => updateRow(index, 'name', event.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor={`home-service-description-${row.id}`}>Description</Label>
                            <Textarea id={`home-service-description-${row.id}`} rows={2} value={row.description || ''} onChange={(event) => updateRow(index, 'description', event.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor={`home-service-price-${row.id}`}>Price</Label>
                            <Input id={`home-service-price-${row.id}`} value={row.price} onChange={(event) => updateRow(index, 'price', event.target.value)} />
                        </div>
                    </div>
                ))}
                    </div>

                    <DialogFooter className="justify-between border-t border-slate-200 pt-4 dark:border-slate-700 sm:justify-between">
                        <Button type="button" variant="outline" onClick={addRow} disabled={isSaving}>
                            <Plus className="size-4" aria-hidden="true" />
                            Add home service
                        </Button>
                        <div className="flex flex-col-reverse gap-2 sm:flex-row">
                            <Button type="button" variant="outline" onClick={() => setIsEditing(false)} disabled={isSaving}>Cancel</Button>
                            <Button type="button" onClick={saveChanges} disabled={isSaving}>
                                {isSaving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
                                {isSaving ? 'Saving...' : 'Save Home Services'}
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

function cloneBoardingRooms(rooms) {
    return Object.fromEntries(Object.entries(rooms || {}).map(([type, rows]) => [
        type,
        (rows || []).map((row) => ({ ...row, features: [...(row.features || [])] }))
    ]));
}

export function PetHotelContentEditor({ config, onSave }) {
    const [isEditing, setIsEditing] = useState(false);
    const [draftRooms, setDraftRooms] = useState(() => cloneBoardingRooms(config.boardingRooms));
    const [draftAddOns, setDraftAddOns] = useState(() => cloneRows(config.boardingAddOns));
    const [isSaving, setIsSaving] = useState(false);

    if (!currentUserCanEditServiceContent()) {
        return null;
    }

    const startEditing = () => {
        setDraftRooms(cloneBoardingRooms(config.boardingRooms));
        setDraftAddOns(cloneRows(config.boardingAddOns));
        setIsEditing(true);
    };

    const updateRoom = (type, index, field, value) => {
        setDraftRooms((current) => ({
            ...current,
            [type]: current[type].map((room, roomIndex) => roomIndex === index ? { ...room, [field]: value } : room)
        }));
    };

    const updateAddOn = (index, field, value) => {
        setDraftAddOns((current) => current.map((addOn, addOnIndex) => addOnIndex === index ? { ...addOn, [field]: value } : addOn));
    };

    const saveChanges = async () => {
        const allRooms = Object.values(draftRooms).flat();
        if (allRooms.some((room) => !room.name.trim() || !room.capacity.trim() || !Number.isFinite(Number(room.pricePerDay)) || Number(room.pricePerDay) < 0 || room.features.length === 0)) {
            toast.error('Complete every room or kennel name, capacity, price, and feature list.');
            return;
        }
        if (draftAddOns.some((addOn) => !addOn.name.trim() || !Number.isFinite(Number(addOn.price)) || Number(addOn.price) < 0)) {
            toast.error('Complete every boarding add-on name and price.');
            return;
        }

        setIsSaving(true);
        try {
            await onSave({
                ...config,
                boardingRooms: Object.fromEntries(Object.entries(draftRooms).map(([type, rows]) => [
                    type,
                    rows.map((room) => ({
                        ...room,
                        name: room.name.trim(),
                        capacity: room.capacity.trim(),
                        pricePerDay: Number(room.pricePerDay),
                        features: room.features.map((feature) => feature.trim()).filter(Boolean)
                    }))
                ])),
                boardingAddOns: draftAddOns.map((addOn) => ({
                    ...addOn,
                    name: addOn.name.trim(),
                    price: Number(addOn.price)
                }))
            });
            setIsEditing(false);
            toast.success('Pet Hotel and boarding content updated.');
        } catch (error) {
            console.error('Pet Hotel content could not be saved:', error);
            toast.error(error?.message || 'Pet Hotel content could not be saved. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <>
            <EditContentButton onClick={startEditing}>Edit boarding content</EditContentButton>
            <Dialog open={isEditing} onOpenChange={(open) => !isSaving && setIsEditing(open)}>
                <DialogContent className="max-w-6xl" showClose={!isSaving}>
                    <DialogHeader>
                        <div className="flex items-start gap-3">
                            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                                <ShieldCheck className="size-5" aria-hidden="true" />
                            </span>
                            <div>
                                <DialogTitle className="dark:text-white">Edit Pet Hotel and boarding</DialogTitle>
                                <DialogDescription className="mt-1 dark:text-slate-300">Update the room, kennel, feature, and add-on content shown to pet owners.</DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="space-y-5">

                {Object.entries(draftRooms).map(([type, rooms]) => (
                    <div key={type} className="space-y-3">
                        <h5 className="text-sm font-black capitalize text-slate-950 dark:text-white">{type === 'hotel' ? 'Pet Hotel rooms' : 'Boarding kennels'}</h5>
                        <div className="grid gap-3 lg:grid-cols-3">
                            {rooms.map((room, index) => (
                                <div key={`${type}-${room.id}`} className="space-y-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                                    <div className="space-y-2">
                                        <Label htmlFor={`${type}-${room.id}-name`}>Name</Label>
                                        <Input id={`${type}-${room.id}-name`} value={room.name} onChange={(event) => updateRoom(type, index, 'name', event.target.value)} />
                                    </div>
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label htmlFor={`${type}-${room.id}-capacity`}>Capacity</Label>
                                            <Input id={`${type}-${room.id}-capacity`} value={room.capacity} onChange={(event) => updateRoom(type, index, 'capacity', event.target.value)} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor={`${type}-${room.id}-price`}>Price per day</Label>
                                            <Input id={`${type}-${room.id}-price`} type="number" min="0" value={room.pricePerDay} onChange={(event) => updateRoom(type, index, 'pricePerDay', event.target.value)} />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor={`${type}-${room.id}-features`}>Features (one per line)</Label>
                                        <Textarea
                                            id={`${type}-${room.id}-features`}
                                            rows={4}
                                            value={room.features.join('\n')}
                                            onChange={(event) => updateRoom(type, index, 'features', parseIncludedItems(event.target.value))}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}

                <div className="space-y-3">
                    <h5 className="text-sm font-black text-slate-950 dark:text-white">Boarding add-ons</h5>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {draftAddOns.map((addOn, index) => (
                            <div key={addOn.id} className="space-y-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                                <div className="space-y-2">
                                    <Label htmlFor={`${addOn.id}-name`}>Name</Label>
                                    <Input id={`${addOn.id}-name`} value={addOn.name} onChange={(event) => updateAddOn(index, 'name', event.target.value)} />
                                </div>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor={`${addOn.id}-price`}>Price</Label>
                                        <Input id={`${addOn.id}-price`} type="number" min="0" value={addOn.price} onChange={(event) => updateAddOn(index, 'price', event.target.value)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor={`${addOn.id}-billing`}>Billing</Label>
                                        <Select value={addOn.billing} onValueChange={(value) => updateAddOn(index, 'billing', value)}>
                                            <SelectTrigger id={`${addOn.id}-billing`}><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="day">Per day</SelectItem>
                                                <SelectItem value="stay">Per stay</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                    </div>

                    <DialogFooter className="border-t border-slate-200 pt-4 dark:border-slate-700">
                        <Button type="button" variant="outline" onClick={() => setIsEditing(false)} disabled={isSaving}>Cancel</Button>
                        <Button type="button" onClick={saveChanges} disabled={isSaving}>
                            {isSaving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
                            {isSaving ? 'Saving...' : 'Save boarding content'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
