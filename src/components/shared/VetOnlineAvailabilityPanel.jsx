import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Clock3, Loader2, Video } from 'lucide-react';
import { Button } from '../../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { fetchVetSchedules, updateVetSchedules } from '../../services/vetScheduleService';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const TIMES = Array.from({ length: 20 }, (_, index) => {
    const hour = 8 + Math.floor(index / 2);
    return `${String(hour % 12 || 12).padStart(2, '0')}:${index % 2 ? '30' : '00'} ${hour >= 12 ? 'PM' : 'AM'}`;
});
const TIME_GROUPS = [
    { label: 'Morning', times: TIMES.filter(time => time.endsWith('AM')) },
    { label: 'Afternoon', times: TIMES.filter(time => time.endsWith('PM')) },
];
const emptyAvailability = () => Object.fromEntries(DAYS.map(day => [day, []]));

function normalizeAvailability(rows) {
    const availability = emptyAvailability();
    for (const row of Array.isArray(rows) ? rows : []) {
        const day = String(row.day_of_week || '').toLowerCase().trim();
        if (!availability[day] || Number(row.is_available) !== 1) continue;
        const raw = String(row.time_slot || '').trim().toUpperCase();
        const match = raw.match(/^(\d{1,2}):(\d{2})(?::00)?(?:\s*(AM|PM))?$/);
        if (!match) continue;
        let hour = Number(match[1]);
        if (hour > 23 || (match[3] && (hour < 1 || hour > 12))) continue;
        if (match[3]) hour = hour % 12 + (match[3] === 'PM' ? 12 : 0);
        const time = `${String(hour % 12 || 12).padStart(2, '0')}:${match[2]} ${hour >= 12 ? 'PM' : 'AM'}`;
        if (TIMES.includes(time) && !availability[day].includes(time)) availability[day].push(time);
    }
    return availability;
}

function setTimeAvailability(availability, day, time, selected) {
    return {
        ...availability,
        [day]: selected
            ? [...availability[day].filter(value => value !== time), time]
            : availability[day].filter(value => value !== time),
    };
}

export default function VetOnlineAvailabilityPanel({ veterinarianId, disabled = false, onSavingChange }) {
    const [availability, setAvailability] = useState(emptyAvailability);
    const [isLoading, setIsLoading] = useState(true);
    const [pendingTimes, setPendingTimes] = useState(() => new Set());
    const [hasSaved, setHasSaved] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [saveError, setSaveError] = useState('');
    const [activeDay, setActiveDay] = useState(DAYS[0]);
    const mutationGeneration = useRef(0);
    const pendingTimesRef = useRef(new Set());
    const isSaving = pendingTimes.size > 0;

    useEffect(() => { onSavingChange?.(isSaving); }, [isSaving, onSavingChange]);
    const load = useCallback(async () => {
        if (!veterinarianId || pendingTimesRef.current.size) return;
        const generation = mutationGeneration.current;
        try {
            const next = normalizeAvailability(await fetchVetSchedules(veterinarianId));
            if (generation !== mutationGeneration.current) return;
            setAvailability(next);
            setLoadError('');
        } catch (loadError) {
            if (generation !== mutationGeneration.current) return;
            setLoadError(loadError.message || 'Online availability could not be loaded.');
        } finally {
            setIsLoading(false);
        }
    }, [veterinarianId]);
    useAutoRefresh(load, { enabled: Boolean(veterinarianId) && !isSaving, refreshKey: `vet-online-availability-${veterinarianId}` });

    const toggleTime = async (day, time) => {
        const key = `${day}-${time}`;
        if (disabled || isLoading || loadError || !veterinarianId || pendingTimesRef.current.has(key)) return;
        const selected = !availability[day].includes(time);
        mutationGeneration.current += 1;
        pendingTimesRef.current.add(key);
        setPendingTimes(new Set(pendingTimesRef.current));
        setHasSaved(false);
        setSaveError('');
        setAvailability(current => setTimeAvailability(current, day, time, selected));
        try {
            const result = await updateVetSchedules({
                user_id: veterinarianId,
                day_of_week: day,
                time_slot: time,
                is_available: selected ? 1 : 0,
            });
            const next = normalizeAvailability(result.schedules);
            // A response for one time must not overwrite another pending toggle.
            setAvailability(current => setTimeAvailability(current, day, time, next[day].includes(time)));
            setHasSaved(true);
        } catch (saveError) {
            setAvailability(current => setTimeAvailability(current, day, time, !selected));
            setSaveError(saveError.message || 'This online time could not be saved. Try again.');
        } finally {
            pendingTimesRef.current.delete(key);
            setPendingTimes(new Set(pendingTimesRef.current));
        }
    };
    const activeTimes = availability[activeDay] || [];
    const dayLabel = activeDay.charAt(0).toUpperCase() + activeDay.slice(1);
    const error = saveError || loadError;

    return (
        <section className="w-full max-w-5xl space-y-4 border-t border-slate-200 pt-5 dark:border-slate-700" aria-label="Online consultation availability">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <h3 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-100"><Video className="size-4 text-blue-600 dark:text-blue-300" />Online Consultation Availability</h3>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Tap a time to turn it on or off. Changes save automatically.</p>
                </div>
            </div>
            {isLoading && <p role="status" className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400"><Loader2 className="size-4 animate-spin" />Loading online schedule...</p>}
            {error && <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-red-600 dark:text-red-300"><AlertCircle className="size-4 shrink-0" /><p className="min-w-0 flex-1">{error}</p>{loadError && <Button type="button" variant="outline" size="sm" disabled={isLoading || isSaving} onClick={load}>Retry</Button>}</div>}
            {!isLoading && !loadError && (
                <Tabs value={activeDay} onValueChange={setActiveDay} className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                    <div className="border-b border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-950/40 sm:px-4">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                            <p className="font-semibold">Weekly schedule</p>
                            <p role="status" aria-live="polite" className="flex min-h-4 items-center gap-1.5">{isSaving ? <><Loader2 className="size-3.5 animate-spin" />Saving...</> : (!saveError && hasSaved ? 'Saved' : 'Saves automatically')}</p>
                        </div>
                        <TabsList role="group" aria-label="Choose an online consultation day" className="grid grid-cols-3 gap-2 overflow-visible bg-transparent p-0 dark:bg-transparent sm:grid-cols-6">
                            {DAYS.map(day => (
                                <TabsTrigger
                                    key={day}
                                    value={day}
                                    type="button"
                                    aria-pressed={activeDay === day}
                                    aria-label={`${day.charAt(0).toUpperCase() + day.slice(1)}, ${availability[day].length} start times selected`}
                                    className={`flex min-h-14 flex-col gap-0.5 rounded-lg border px-2 py-2 shadow-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 ${activeDay === day ? 'border-blue-600 bg-white text-blue-700 dark:border-blue-500 dark:bg-slate-800 dark:text-blue-300' : 'border-slate-200 bg-transparent text-slate-600 hover:bg-white dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'}`}
                                >
                                    <span className="text-sm font-semibold capitalize">{day.slice(0, 3)}</span>
                                    <span className="text-xs font-normal">{availability[day].length ? `${availability[day].length} times` : 'Not set'}</span>
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </div>
                    <TabsContent value={activeDay} role="region" aria-label={`${dayLabel} online start times`} className="space-y-5 p-3 sm:p-4 lg:p-5">
                        {TIME_GROUPS.map(group => (
                            <fieldset key={group.label} className="min-w-0">
                                <legend className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400"><Clock3 className="size-3.5" />{group.label}</legend>
                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                                    {group.times.map(time => {
                                        const isSelected = activeTimes.includes(time);
                                        const isPending = pendingTimes.has(`${activeDay}-${time}`);
                                        return (
                                            <Button
                                                key={`${activeDay}-${time}`}
                                                type="button"
                                                variant="outline"
                                                aria-label={`${dayLabel} ${time}`}
                                                aria-pressed={isSelected}
                                                aria-busy={isPending}
                                                disabled={disabled || isPending}
                                                onClick={() => toggleTime(activeDay, time)}
                                                className={`min-h-11 whitespace-nowrap px-2.5 py-2 font-medium transition-colors dark:focus-visible:ring-offset-slate-900 ${isSelected ? 'border-blue-600 bg-blue-600 text-white hover:border-blue-700 hover:bg-blue-700 active:bg-blue-800 dark:border-blue-500 dark:bg-blue-600 dark:text-white dark:hover:bg-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:border-blue-400 hover:bg-slate-50 active:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-blue-500 dark:hover:bg-slate-800 dark:active:bg-slate-700'}`}
                                            >
                                                {isPending && <Loader2 className="size-3.5 animate-spin" />}
                                                <span className="whitespace-nowrap text-xs sm:text-sm">{time}</span>
                                            </Button>
                                        );
                                    })}
                                </div>
                            </fieldset>
                        ))}
                    </TabsContent>
                    <div className="flex flex-col gap-3 border-t border-slate-200 px-3 py-3 dark:border-slate-700 sm:px-4">
                        <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">Each call lasts one hour. Existing appointments can block a selected start time.</p>
                    </div>
                </Tabs>
            )}
        </section>
    );
}
