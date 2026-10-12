import { Clock3, Pill, Plus, Trash2 } from 'lucide-react';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Checkbox } from '../../ui/checkbox';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Textarea } from '../../ui/textarea';
import {
    defaultTimeSlots,
    PRESCRIPTION_DURATION_UNITS,
    PRESCRIPTION_FREQUENCIES,
    PRESCRIPTION_ROUTES,
    prescriptionLine
} from '../../lib/prescriptions';

const DAYS = [
    ['0', 'Sun'], ['1', 'Mon'], ['2', 'Tue'], ['3', 'Wed'], ['4', 'Thu'], ['5', 'Fri'], ['6', 'Sat']
];

function numberValue(value, fallback = 1) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
}

export default function PrescriptionEditor({
    draft,
    setDraft,
    items,
    onAdd,
    onRemove,
    addLabel = 'Add Medication',
    embedded = false,
    readOnly = false
}) {
    const update = (field, value) => setDraft((current) => ({ ...current, [field]: value }));
    const setScheduleType = (scheduleType) => {
        const frequency = scheduleType === 'weekly' ? 'per week'
            : scheduleType === 'monthly' ? 'per month'
                : scheduleType === 'as_needed' ? 'as needed'
                    : 'per day';
        setDraft((current) => ({
            ...current,
            scheduleType,
            frequency,
            timeSlots: scheduleType === 'interval_hours' || scheduleType === 'as_needed'
                ? []
                : (current.timeSlots?.length ? current.timeSlots : defaultTimeSlots(current.times))
        }));
    };
    const setTimes = (value) => {
        const times = Math.max(1, Math.min(24, numberValue(value, 1)));
        setDraft((current) => ({
            ...current,
            times,
            timeSlots: ['times_daily', 'weekly', 'monthly'].includes(current.scheduleType)
                ? defaultTimeSlots(times)
                : current.timeSlots
        }));
    };
    const setTimeSlot = (index, value) => {
        setDraft((current) => ({
            ...current,
            timeSlots: defaultTimeSlots(current.times).map((fallback, slotIndex) => (
                slotIndex === index ? value : (current.timeSlots?.[slotIndex] || fallback)
            ))
        }));
    };
    const toggleDay = (day, checked) => {
        setDraft((current) => ({
            ...current,
            daysOfWeek: checked
                ? [...new Set([...(current.daysOfWeek || []), Number(day)])].sort()
                : (current.daysOfWeek || []).filter((value) => Number(value) !== Number(day))
        }));
    };

    return (
        <div className={`space-y-4 ${embedded ? '' : 'rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/40'}`}>
            {readOnly && <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Issued prescriptions are read-only. Use Add prescription below for another course.</p>}
            {!readOnly && <>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="space-y-2 md:col-span-2">
                    <Label className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Medicine / Item</Label>
                    <Input
                        value={draft.medicine}
                        onChange={(event) => update('medicine', event.target.value)}
                        placeholder="e.g. Amoxicillin"
                        aria-label="Medicine or item"
                        className="bg-white dark:bg-slate-900"
                    />
                </div>
                <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Dose</Label>
                    <Input value={draft.dose || ''} onChange={(event) => update('dose', event.target.value)} placeholder="e.g. 5 mL" className="bg-white dark:bg-slate-900" />
                </div>
                <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Route</Label>
                    <Select value={draft.route || 'Oral'} onValueChange={(value) => update('route', value)}>
                        <SelectTrigger className="bg-white dark:bg-slate-900"><SelectValue placeholder="Route" /></SelectTrigger>
                        <SelectContent>{PRESCRIPTION_ROUTES.map((route) => <SelectItem key={route} value={route}>{route}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <div className="space-y-2 sm:col-span-2 xl:col-span-1">
                    <Label className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Schedule method</Label>
                    <Select value={draft.scheduleType || 'times_daily'} onValueChange={setScheduleType}>
                        <SelectTrigger className="bg-white dark:bg-slate-900"><SelectValue placeholder="Schedule" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="times_daily">Times per day</SelectItem>
                            <SelectItem value="interval_hours">Every N hours</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                            <SelectItem value="as_needed">As needed</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                {draft.scheduleType === 'interval_hours' ? (
                    <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Every hours</Label>
                        <Input type="number" min="1" max="168" value={draft.intervalHours || 8} onChange={(event) => update('intervalHours', numberValue(event.target.value, 8))} className="bg-white dark:bg-slate-900" />
                    </div>
                ) : draft.scheduleType !== 'as_needed' ? (
                    <>
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Occurrences</Label>
                            <Input type="number" min="1" max="24" value={draft.times} onChange={(event) => setTimes(event.target.value)} className="bg-white dark:bg-slate-900" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Frequency</Label>
                            <Select value={draft.frequency} onValueChange={(value) => update('frequency', value)} disabled>
                                <SelectTrigger className="bg-white dark:bg-slate-900"><SelectValue /></SelectTrigger>
                                <SelectContent>{PRESCRIPTION_FREQUENCIES.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                    </>
                ) : null}
                <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Duration</Label>
                    <Input type="number" min="0" value={draft.durationNumber} onChange={(event) => update('durationNumber', numberValue(event.target.value, 1))} disabled={draft.scheduleType === 'as_needed'} className="bg-white dark:bg-slate-900" />
                </div>
                <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Duration unit</Label>
                    <Select value={draft.scheduleType === 'as_needed' ? 'as needed' : draft.durationUnit} onValueChange={(value) => update('durationUnit', value)} disabled={draft.scheduleType === 'as_needed'}>
                        <SelectTrigger className="bg-white dark:bg-slate-900"><SelectValue /></SelectTrigger>
                        <SelectContent>{PRESCRIPTION_DURATION_UNITS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
            </div>

            {['times_daily', 'weekly', 'monthly'].includes(draft.scheduleType) && (
                <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                    <Label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        <Clock3 className="size-3.5" /> Recommended times
                    </Label>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {defaultTimeSlots(draft.times).map((fallback, index) => (
                            <Input key={index} type="time" value={draft.timeSlots?.[index] || fallback} onChange={(event) => setTimeSlot(index, event.target.value)} aria-label={`Dose time ${index + 1}`} />
                        ))}
                    </div>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">The owner reviews these times before starting. Exact interval schedules remain anchored to the first dose.</p>
                </div>
            )}

            {draft.scheduleType === 'weekly' && (
                <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Days of week</Label>
                    <div className="flex flex-wrap gap-2">
                        {DAYS.map(([value, label]) => (
                            <label key={value} className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                                <Checkbox checked={(draft.daysOfWeek || []).includes(Number(value))} onCheckedChange={(checked) => toggleDay(value, checked)} />
                                {label}
                            </label>
                        ))}
                    </div>
                </div>
            )}

            <div className="grid gap-3 sm:grid-cols-[12rem_minmax(0,1fr)_auto] sm:items-end">
                <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Recommended start</Label>
                    <Input type="date" value={draft.recommendedStartDate || ''} onChange={(event) => update('recommendedStartDate', event.target.value)} className="bg-white dark:bg-slate-900" />
                </div>
                <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Instructions / Notes</Label>
                    <Textarea value={draft.instructions || ''} onChange={(event) => update('instructions', event.target.value)} placeholder="Clinical directions for the owner" className="min-h-20 bg-white dark:bg-slate-900" />
                </div>
                <Button type="button" onClick={onAdd} className="gap-2 bg-[#155dfc] text-white hover:bg-[#0d4acf] sm:mb-0.5">
                    <Plus className="size-4" /> {addLabel}
                </Button>
            </div>

            </>}
            {items.length > 0 && (
                <div className="space-y-2">
                    {items.map((item, index) => (
                        <div key={item.id || item.itemId || index} className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <Pill className="size-4 text-[#155dfc]" />
                                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{prescriptionLine(item)}</p>
                                    {item.scheduleType === 'interval_hours' && <Badge className="border-0 bg-amber-50 text-amber-700">Exact interval</Badge>}
                                </div>
                                {item.instructions && <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{item.instructions}</p>}
                            </div>
                            {!readOnly && <div className="flex shrink-0 gap-1">
                                <Button type="button" variant="ghost" size="sm" onClick={() => onRemove(item.id || item.itemId)} className="gap-1.5 text-red-600 hover:bg-red-50 hover:text-red-700">
                                    <Trash2 className="size-3.5" /> Remove
                                </Button>
                            </div>}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
