import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarClock, Check, Clock3, History, Loader2, Pill, Play, Plus, RotateCcw, SkipForward } from 'lucide-react';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Checkbox } from '../../ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { toast } from '../../reusecomponent/toast.jsx';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { formatDisplayDateTime } from '../../lib/date';
import {
    createPrescriptionDraft,
    defaultTimeSlots,
    normalizePrescriptionDraft,
    prescriptionLine,
    prescriptionPlansForView,
    prescriptionScheduleLabel
} from '../../lib/prescriptions';
import {
    completePrescriptionItem,
    createPrescriptionPlan,
    fetchPrescriptions,
    startPrescriptionPlan,
    updatePrescriptionOccurrence
} from '../../services/prescriptionService';
import PrescriptionEditor from './PrescriptionEditor.jsx';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function todayInput() {
    const date = new Date();
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
}

function planBadge(status) {
    const styles = {
        issued: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300',
        partially_started: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
        active: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
        completed: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
        superseded: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
        stopped: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
    };
    return styles[status] || styles.issued;
}

function scheduleDraft(item) {
    const today = todayInput();
    const recommendedStart = item.recommendedStartDate && item.recommendedStartDate >= today
        ? item.recommendedStartDate
        : today;
    return {
        itemId: item.itemId,
        startDate: recommendedStart,
        timeSlots: item.timeSlots?.length ? item.timeSlots : defaultTimeSlots(item.times),
        daysOfWeek: item.daysOfWeek?.length ? item.daysOfWeek.map(Number) : []
    };
}

function dueState(occurrence) {
    if (occurrence.status === 'taken') return { label: 'Taken', className: 'bg-emerald-50 text-emerald-700' };
    if (occurrence.status === 'skipped') return { label: 'Skipped', className: 'bg-slate-100 text-slate-600' };
    if (occurrence.status === 'missed') return { label: 'Missed', className: 'bg-red-50 text-red-700' };
    return new Date(String(occurrence.dueAt).replace(' ', 'T')).getTime() < Date.now()
        ? { label: 'Missed', className: 'bg-red-50 text-red-700' }
        : { label: 'Upcoming', className: 'bg-blue-50 text-blue-700' };
}

export default function PrescriptionPlanPanel({
    petId,
    canManage = false,
    allowStart = true,
    onlyNeedsStart = false,
    compact = false,
    title = 'Prescriptions',
    onChanged
}) {
    const [plans, setPlans] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [startPlan, setStartPlan] = useState(null);
    const [selectedItemIds, setSelectedItemIds] = useState([]);
    const [scheduleDrafts, setScheduleDrafts] = useState({});
    const [startedPlanId, setStartedPlanId] = useState(null);
    const [showAdd, setShowAdd] = useState(false);
    const [newPetId, setNewPetId] = useState('');
    const [newItems, setNewItems] = useState([]);
    const [newDraft, setNewDraft] = useState(createPrescriptionDraft);
    const [showHistory, setShowHistory] = useState(false);
    const [finishingItem, setFinishingItem] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const handledStartDeepLink = useRef(false);

    const loadPlans = async ({ isAutoRefresh = false } = {}) => {
        if (!isAutoRefresh) setIsLoading(true);
        try {
            const response = await fetchPrescriptions({ petId: petId || '', includeHistory: onlyNeedsStart ? 0 : 1 });
            setPlans(Array.isArray(response.plans) ? response.plans : []);
            setError('');
        } catch (loadError) {
            if (!isAutoRefresh) setError(loadError.message || 'Prescriptions could not be loaded.');
        } finally {
            if (!isAutoRefresh) setIsLoading(false);
        }
    };

    useAutoRefresh(loadPlans, {
        enabled: petId !== null,
        refreshKey: `prescriptions-${petId || 'owner'}-${canManage ? 'manage' : 'owner'}`
    });

    const visiblePlans = useMemo(() => prescriptionPlansForView(plans, { history: showHistory, onlyNeedsStart }), [onlyNeedsStart, plans, showHistory]);
    const recentlyStartedPlan = useMemo(
        () => plans.find((plan) => plan.planId === startedPlanId) || null,
        [plans, startedPlanId]
    );

    useEffect(() => {
        const requestedPlanId = Number(new URLSearchParams(window.location.search).get('prescription'));
        if (!requestedPlanId || startPlan || handledStartDeepLink.current) return;
        const plan = visiblePlans.find((candidate) => candidate.planId === requestedPlanId);
        if (allowStart && plan?.items.some((item) => item.status === 'pending_start')) {
            handledStartDeepLink.current = true;
            const pending = plan.items.filter((item) => item.status === 'pending_start');
            setStartPlan(plan);
            setSelectedItemIds(pending.map((item) => item.itemId));
            setScheduleDrafts(Object.fromEntries(pending.map((item) => [item.itemId, scheduleDraft(item)])));
        }
    }, [allowStart, startPlan, visiblePlans]);

    const openStart = (plan, itemId = null) => {
        const pending = plan.items.filter((item) => item.status === 'pending_start' && (!itemId || item.itemId === itemId));
        setStartPlan(plan);
        setSelectedItemIds(pending.map((item) => item.itemId));
        setScheduleDrafts(Object.fromEntries(plan.items.filter((item) => item.status === 'pending_start').map((item) => [item.itemId, scheduleDraft(item)])));
    };

    const updateSchedule = (itemId, field, value) => {
        setScheduleDrafts((current) => ({
            ...current,
            [itemId]: { ...current[itemId], [field]: value }
        }));
    };

    const submitStart = async () => {
        if (!startPlan || selectedItemIds.length === 0) {
            toast.error('Select at least one medication schedule to start.');
            return;
        }
        setIsSaving(true);
        try {
            const response = await startPrescriptionPlan(startPlan.planId, {
                itemIds: selectedItemIds,
                startAll: selectedItemIds.length === startPlan.items.filter((item) => item.status === 'pending_start').length,
                items: selectedItemIds.map((itemId) => scheduleDrafts[itemId])
            });
            toast.success(response.message || 'Medication schedule started.');
            setStartPlan(null);
            await loadPlans();
            setStartedPlanId(startPlan.planId);
            onChanged?.();
        } catch (saveError) {
            toast.error(saveError.message || 'Medication schedules could not be started.');
        } finally {
            setIsSaving(false);
        }
    };

    const changeOccurrence = async (occurrence, status) => {
        setIsSaving(true);
        try {
            const response = await updatePrescriptionOccurrence(occurrence.occurrenceId, { status });
            toast.success(response.message || 'Medication checklist updated.');
            await loadPlans({ isAutoRefresh: true });
            onChanged?.();
        } catch (saveError) {
            toast.error(saveError.message || 'Medication checklist could not be updated.');
        } finally {
            setIsSaving(false);
        }
    };

    const openAdd = () => {
        setNewPetId(String(petId));
        setNewItems([]);
        setNewDraft(createPrescriptionDraft());
        setShowAdd(true);
    };

    const addNewItem = () => {
        if (!newDraft.medicine.trim()) {
            toast.error('Enter the medication name before adding it.');
            return;
        }
        const next = normalizePrescriptionDraft({
            ...newDraft,
            id: `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            medicine: newDraft.medicine.trim()
        });
        setNewItems((current) => [...current, next]);
        setNewDraft(createPrescriptionDraft());
    };

    const submitNew = async () => {
        if (newPetId !== String(petId)) {
            toast.error('The selected pet changed. Close this form and open Add prescription for the correct pet.');
            return;
        }
        if (!petId || newItems.length === 0) {
            toast.error('Add at least one medication to the new prescription.');
            return;
        }
        setIsSaving(true);
        try {
            const response = await createPrescriptionPlan(petId, { items: newItems });
            toast.success(response.message || 'New prescription issued.');
            setShowAdd(false);
            setShowHistory(false);
            await loadPlans();
            onChanged?.();
        } catch (saveError) {
            toast.error(saveError.message || 'Prescription could not be issued.');
        } finally {
            setIsSaving(false);
        }
    };

    const finishItem = async () => {
        if (!finishingItem) return;
        setIsSaving(true);
        try {
            const response = await completePrescriptionItem(finishingItem.itemId);
            toast.success(response.message);
            setFinishingItem(null);
            await loadPlans({ isAutoRefresh: true });
            onChanged?.();
        } catch (saveError) {
            toast.error(saveError.message || 'Medication could not be marked finished.');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading && plans.length === 0) {
        return <div className="flex items-center gap-2 rounded-lg border border-slate-200 p-4 text-sm font-semibold text-slate-500 dark:border-slate-700"><Loader2 className="size-4 animate-spin" /> Loading prescriptions...</div>;
    }
    if (error) {
        return <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{error}</div>;
    }
    if (onlyNeedsStart && visiblePlans.length === 0 && !recentlyStartedPlan) return null;

    return (
        <section className="space-y-3" aria-label={title}>
            {!compact && (
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-white"><Pill className="size-4 text-[#155dfc]" /> {title}</h3>
                    {canManage && petId && <Button type="button" size="sm" variant="outline" onClick={openAdd} disabled={isSaving} className="gap-1.5"><Plus className="size-3.5" /> Add prescription</Button>}
                </div>
            )}
            {!onlyNeedsStart && (
                <div className="flex flex-wrap gap-2" role="group" aria-label="Prescription view">
                    <Button type="button" size="sm" variant={showHistory ? 'ghost' : 'outline'} aria-pressed={!showHistory} onClick={() => setShowHistory(false)}>Active</Button>
                    <Button type="button" size="sm" variant={showHistory ? 'outline' : 'ghost'} aria-pressed={showHistory} onClick={() => setShowHistory(true)} className="gap-1.5"><History className="size-3.5" /> History</Button>
                </div>
            )}
            {visiblePlans.length === 0 && (
                <div className="rounded-lg border border-dashed border-slate-200 p-4 text-center dark:border-slate-700">
                    <Pill className="mx-auto size-6 text-slate-300 dark:text-slate-500" />
                    <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">{showHistory ? 'No finished prescriptions yet.' : 'No active prescriptions.'}</p>
                </div>
            )}
            <div className="space-y-3">
                {visiblePlans.map((plan) => {
                    const pendingItems = plan.items.filter((item) => item.status === 'pending_start');
                    const activeOccurrences = compact ? plan.occurrences.slice(0, 3) : plan.occurrences;
                    const checklistReadOnly = ['superseded', 'stopped'].includes(plan.status);
                    return (
                        <article key={plan.planId} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <p className="font-black text-slate-950 dark:text-white">{plan.petName}</p>
                                        <Badge className={`border-0 ${planBadge(plan.status)}`}>{plan.status.replace(/_/g, ' ')}</Badge>
                                        <span className="text-xs font-bold text-slate-400">Rx #{plan.planId}</span>
                                    </div>
                                    <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                                        {plan.sourceLabel || 'Prescription'} · {plan.veterinarianName ? `Dr. ${plan.veterinarianName.replace(/^Dr\.\s*/i, '')}` : 'Clinic veterinarian'} · {formatDisplayDateTime(plan.issuedAt)}
                                    </p>
                                </div>
                                <div className="flex shrink-0 flex-wrap gap-2">
                                    {!showHistory && allowStart && pendingItems.length > 0 && (
                                        <Button type="button" size="sm" onClick={() => openStart(plan)} className="gap-1.5 bg-[#155dfc] text-white hover:bg-[#0d4acf]">
                                            <Play className="size-3.5" /> Start all
                                        </Button>
                                    )}
                                </div>
                            </div>

                            <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
                                {plan.items.map((item) => (
                                    <div key={item.itemId} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{prescriptionLine(item)}</p>
                                            {item.instructions && <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{item.instructions}</p>}
                                        </div>
                                        {!showHistory && allowStart && item.status === 'pending_start' ? (
                                            <Button type="button" size="sm" variant="outline" onClick={() => openStart(plan, item.itemId)} className="shrink-0 gap-1.5">
                                                <Play className="size-3.5" /> Start
                                            </Button>
                                        ) : !showHistory && item.status === 'active' && item.scheduleType === 'as_needed' && (allowStart || canManage) ? (
                                            <Button type="button" size="sm" variant="outline" onClick={() => setFinishingItem(item)} disabled={isSaving} className="shrink-0 gap-1.5"><Check className="size-3.5" /> Mark finished</Button>
                                        ) : (
                                            <Badge className="w-fit shrink-0 border-0 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">{item.status.replace(/_/g, ' ')}</Badge>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {activeOccurrences.length > 0 && (
                                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950">
                                    <p className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400"><CalendarClock className="size-3.5" /> Dose checklist</p>
                                    <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                                        {activeOccurrences.map((occurrence) => {
                                            const item = plan.items.find((candidate) => candidate.itemId === occurrence.itemId);
                                            const state = dueState(occurrence);
                                            const isDone = ['taken', 'skipped'].includes(occurrence.status);
                                            return (
                                                <div key={occurrence.occurrenceId} className="flex flex-col gap-2 rounded-md bg-white p-2.5 dark:bg-slate-900 sm:flex-row sm:items-center">
                                                    <Checkbox checked={occurrence.status === 'taken'} onCheckedChange={() => changeOccurrence(occurrence, occurrence.status === 'taken' ? 'pending' : 'taken')} disabled={isSaving || checklistReadOnly || occurrence.status === 'skipped'} aria-label={`Mark ${item?.medicine || 'medication'} taken`} />
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{item?.medicine || 'Medication'}</p>
                                                        <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{formatDisplayDateTime(occurrence.dueAt)}</p>
                                                    </div>
                                                    <Badge className={`w-fit border-0 ${state.className}`}>{state.label}</Badge>
                                                    {!isDone && !checklistReadOnly && (
                                                        <Button type="button" variant="ghost" size="sm" onClick={() => changeOccurrence(occurrence, 'skipped')} disabled={isSaving} className="gap-1 text-slate-500"><SkipForward className="size-3.5" /> Skip</Button>
                                                    )}
                                                    {occurrence.status === 'skipped' && !checklistReadOnly && (
                                                        <Button type="button" variant="ghost" size="sm" onClick={() => changeOccurrence(occurrence, 'pending')} disabled={isSaving} className="gap-1 text-slate-500"><RotateCcw className="size-3.5" /> Reopen</Button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </article>
                    );
                })}
            </div>

            <Dialog open={Boolean(startPlan)} onOpenChange={(open) => !open && setStartPlan(null)}>
                <DialogContent className="flex max-h-[88vh] max-w-3xl flex-col overflow-hidden p-0">
                    <DialogHeader className="border-b border-slate-200 px-5 pb-4 pt-5 dark:border-slate-700">
                        <DialogTitle className="flex items-center gap-2"><Play className="size-5 text-[#155dfc]" /> Start medication schedules</DialogTitle>
                        <DialogDescription>Review each item independently. Confirming creates the owner checklist and aligns reminders to these dates and times.</DialogDescription>
                    </DialogHeader>
                    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
                        {startPlan?.items.filter((item) => item.status === 'pending_start').map((item) => {
                            const checked = selectedItemIds.includes(item.itemId);
                            const schedule = scheduleDrafts[item.itemId] || scheduleDraft(item);
                            return (
                                <article key={item.itemId} className={`rounded-xl border p-4 transition-colors ${checked ? 'border-blue-200 bg-blue-50/40 dark:border-blue-900 dark:bg-blue-950/20' : 'border-slate-200 dark:border-slate-700'}`}>
                                    <label className="flex items-start gap-3">
                                        <Checkbox checked={checked} onCheckedChange={(value) => setSelectedItemIds((current) => value ? [...new Set([...current, item.itemId])] : current.filter((id) => id !== item.itemId))} />
                                        <span className="min-w-0">
                                            <span className="block text-sm font-black text-slate-900 dark:text-white">{item.medicine}{item.dose ? ` · ${item.dose}` : ''}</span>
                                            <span className="mt-0.5 block text-xs font-semibold text-slate-500 dark:text-slate-400">{prescriptionScheduleLabel(item)}{item.route ? ` · ${item.route}` : ''}</span>
                                        </span>
                                    </label>
                                    {checked && item.scheduleType !== 'as_needed' && (
                                        <div className="mt-4 grid gap-3 sm:grid-cols-[12rem_minmax(0,1fr)]">
                                            <div className="space-y-2">
                                                <Label>Start date</Label>
                                                <Input type="date" min={todayInput()} value={schedule.startDate} onChange={(event) => updateSchedule(item.itemId, 'startDate', event.target.value)} />
                                            </div>
                                            {item.scheduleType === 'interval_hours' ? (
                                                <div className="space-y-2">
                                                    <Label>First dose time</Label>
                                                    <Input
                                                        type="time"
                                                        value={schedule.timeSlots[0] || '08:00'}
                                                        onChange={(event) => updateSchedule(item.itemId, 'timeSlots', [event.target.value])}
                                                    />
                                                </div>
                                            ) : (
                                                <div className="space-y-2">
                                                    <Label>Daily times</Label>
                                                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                                        {schedule.timeSlots.map((slot, index) => (
                                                            <Input key={index} type="time" value={slot} onChange={(event) => updateSchedule(item.itemId, 'timeSlots', schedule.timeSlots.map((currentSlot, slotIndex) => slotIndex === index ? event.target.value : currentSlot))} />
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            {item.scheduleType === 'weekly' && (
                                                <div className="space-y-2 sm:col-span-2">
                                                    <Label>Weekly days</Label>
                                                    <div className="flex flex-wrap gap-2">
                                                        {DAY_NAMES.map((day, index) => (
                                                            <label key={day} className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-bold dark:border-slate-700 dark:bg-slate-900">
                                                                <Checkbox checked={schedule.daysOfWeek.includes(index)} onCheckedChange={(value) => updateSchedule(item.itemId, 'daysOfWeek', value ? [...new Set([...schedule.daysOfWeek, index])].sort() : schedule.daysOfWeek.filter((dayValue) => dayValue !== index))} /> {day}
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {checked && item.scheduleType === 'interval_hours' && <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-amber-700 dark:text-amber-300"><Clock3 className="size-3.5" /> The first dose starts at the selected date and the schedule repeats every {item.intervalHours || 8} hours.</p>}
                                    {checked && item.scheduleType === 'as_needed' && <p className="mt-3 text-xs font-semibold text-slate-500">As-needed medication is activated without automatic due reminders.</p>}
                                </article>
                            );
                        })}
                    </div>
                    <DialogFooter className="border-t border-slate-200 px-5 py-4 dark:border-slate-700">
                        <Button type="button" variant="outline" onClick={() => setStartPlan(null)}>Cancel</Button>
                        <Button type="button" onClick={submitStart} disabled={isSaving || selectedItemIds.length === 0} className="gap-2 bg-[#155dfc] text-white hover:bg-[#0d4acf]">
                            {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Confirm and create checklist
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={showAdd} onOpenChange={(open) => !isSaving && setShowAdd(open)}>
                <DialogContent className="flex max-h-[90vh] max-w-5xl flex-col overflow-hidden p-0">
                    <DialogHeader className="border-b border-slate-200 px-5 pb-4 pt-5 dark:border-slate-700">
                        <DialogTitle>Add prescription</DialogTitle>
                        <DialogDescription>Review the medicines before issuing. Directions are saved permanently after you issue this prescription.</DialogDescription>
                    </DialogHeader>
                    <div className="min-h-0 flex-1 overflow-y-auto p-5">
                        <PrescriptionEditor
                            draft={newDraft}
                            setDraft={setNewDraft}
                            items={newItems}
                            onAdd={addNewItem}
                            onRemove={(id) => setNewItems((current) => current.filter((item) => item.id !== id))}
                            embedded
                        />
                        {newDraft.medicine.trim() && <p className="mt-3 text-xs font-medium text-slate-500 dark:text-slate-400">Choose Add Medication to include this medicine before issuing.</p>}
                    </div>
                    <DialogFooter className="border-t border-slate-200 px-5 py-4 dark:border-slate-700">
                        <Button type="button" variant="outline" onClick={() => setShowAdd(false)} disabled={isSaving}>Cancel</Button>
                        <Button type="button" onClick={submitNew} disabled={isSaving || newItems.length === 0 || Boolean(newDraft.medicine.trim())} className="gap-2 bg-[#155dfc] text-white hover:bg-[#0d4acf]">
                            {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Issue prescription
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={Boolean(finishingItem)} onOpenChange={(open) => !open && !isSaving && setFinishingItem(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Finish {finishingItem?.medicine}</DialogTitle>
                        <DialogDescription>Mark this as-needed medication finished when the course is done according to the veterinarian’s directions. It will move to History.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setFinishingItem(null)} disabled={isSaving}>Cancel</Button>
                        <Button type="button" onClick={finishItem} disabled={isSaving} className="gap-2">{isSaving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Mark finished</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={Boolean(recentlyStartedPlan)} onOpenChange={(open) => !open && setStartedPlanId(null)}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><Check className="size-5 text-emerald-600" /> Medication checklist ready</DialogTitle>
                        <DialogDescription>The schedules are active. Each occurrence is also available in TODOs and the calendar.</DialogDescription>
                    </DialogHeader>
                    <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
                        {recentlyStartedPlan?.occurrences.slice(0, 12).map((occurrence) => {
                            const item = recentlyStartedPlan.items.find((candidate) => candidate.itemId === occurrence.itemId);
                            const isTaken = occurrence.status === 'taken';
                            return (
                                <label key={occurrence.occurrenceId} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                                    <Checkbox
                                        checked={isTaken}
                                        onCheckedChange={() => changeOccurrence(occurrence, isTaken ? 'pending' : 'taken')}
                                        disabled={isSaving || occurrence.status === 'skipped'}
                                    />
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-sm font-black text-slate-900 dark:text-white">{item?.medicine || 'Medication'}</span>
                                        <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400">{formatDisplayDateTime(occurrence.dueAt)}</span>
                                    </span>
                                    <Badge className={`border-0 ${dueState(occurrence).className}`}>{dueState(occurrence).label}</Badge>
                                </label>
                            );
                        })}
                        {recentlyStartedPlan?.occurrences.length === 0 && (
                            <p className="rounded-lg border border-dashed border-slate-200 p-4 text-sm font-semibold text-slate-500 dark:border-slate-700 dark:text-slate-400">This is an as-needed medication. Use the live prescription card to review its directions.</p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button type="button" onClick={() => setStartedPlanId(null)}>Done</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </section>
    );
}
