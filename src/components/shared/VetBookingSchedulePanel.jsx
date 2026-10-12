import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, CalendarClock, Loader2 } from 'lucide-react';
import { Button } from '../../ui/button';
import { Checkbox } from '../../ui/checkbox';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { fetchVetBookingSchedule, saveVetBookingSchedule } from '../../services/vetBookingScheduleService';

const EMPTY = { clinics: [], canAssignClinics: false };

function normalizeSchedule(data) {
    return {
        clinics: Array.isArray(data.clinics) ? data.clinics : [],
        canAssignClinics: Boolean(data.canAssignClinics),
    };
}

export default function VetBookingSchedulePanel({ veterinarianId, disabled = false, onSavingChange, onSaved }) {
    const [schedule, setSchedule] = useState(EMPTY);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [hasSaved, setHasSaved] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [saveError, setSaveError] = useState('');
    const mutationGeneration = useRef(0);
    const savePending = useRef(false);
    useEffect(() => { onSavingChange?.(isSaving); }, [isSaving, onSavingChange]);
    const load = useCallback(async () => {
        if (!veterinarianId || savePending.current) return;
        const generation = mutationGeneration.current;
        try {
            const next = normalizeSchedule(await fetchVetBookingSchedule(veterinarianId));
            if (generation !== mutationGeneration.current) return;
            setSchedule(next);
            setLoadError('');
        } catch (loadError) {
            if (generation !== mutationGeneration.current) return;
            setLoadError(loadError.message || 'Clinic booking preferences could not be loaded.');
        } finally {
            setIsLoading(false);
        }
    }, [veterinarianId]);
    useAutoRefresh(load, { enabled: Boolean(veterinarianId) && !isSaving, refreshKey: `vet-booking-schedule-${veterinarianId}` });

    const updateClinic = async (id, patch) => {
        if (disabled || isLoading || loadError || savePending.current || !veterinarianId) return;
        const previous = schedule;
        const proposed = {
            ...schedule,
            clinics: schedule.clinics.map(clinic => clinic.id === id ? { ...clinic, ...patch } : clinic),
        };
        const assigned = proposed.clinics.filter(clinic => clinic.assigned);
        if (!assigned.length) {
            setSaveError('Keep at least one clinic assigned to this veterinarian.');
            return;
        }
        savePending.current = true;
        mutationGeneration.current += 1;
        setSchedule(proposed);
        setIsSaving(true);
        setHasSaved(false);
        setSaveError('');
        let didSave = false;
        try {
            const primary = assigned.find(clinic => clinic.isPrimary) || assigned[0];
            const payload = {
                clinics: assigned.map(({ id, acceptsBookings }) => ({ id, acceptsBookings })),
                ...(schedule.canAssignClinics && Object.hasOwn(patch, 'assigned')
                    ? { assignedBranchIds: assigned.map(clinic => clinic.id), primaryBranchId: primary?.id }
                    : {}),
            };
            const next = normalizeSchedule(await saveVetBookingSchedule(veterinarianId, payload));
            setSchedule(next);
            setHasSaved(true);
            didSave = true;
        } catch (saveError) {
            setSchedule(previous);
            setSaveError(saveError.message || 'This clinic preference could not be saved. Try again.');
        } finally {
            savePending.current = false;
            setIsSaving(false);
        }
        if (didSave) onSaved?.();
    };
    const controlsDisabled = disabled || isSaving || isLoading || Boolean(loadError);
    const error = saveError || loadError;

    return (
        <section className="space-y-4 border-t border-slate-200 pt-5 dark:border-slate-700" aria-label="Clinic booking preferences">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <h3 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-100"><CalendarClock className="size-4 text-blue-600 dark:text-blue-300" />Clinic Booking Preferences</h3>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Turn booking acceptance on or off separately for each assigned clinic. In-clinic appointments automatically follow that clinic’s operating schedule.</p>
                </div>
                {!isLoading && <p role="status" aria-live="polite" className="flex min-h-5 shrink-0 items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">{isSaving ? <><Loader2 className="size-3.5 animate-spin" />Saving...</> : (!saveError && hasSaved ? 'Saved' : 'Saves automatically')}</p>}
            </div>
            {isLoading && <p role="status" className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400"><Loader2 className="size-4 animate-spin" />Loading clinic preferences...</p>}
            {error && <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-red-600 dark:text-red-300"><AlertCircle className="size-4 shrink-0" /><p className="min-w-0 flex-1">{error}</p>{loadError && <Button type="button" variant="outline" size="sm" disabled={isLoading || isSaving} onClick={load}>Retry</Button>}</div>}
            {!isLoading && !loadError && !schedule.clinics.length && <p className="text-sm text-slate-500 dark:text-slate-400">Ask Super Admin to assign your clinic locations before choosing where to accept bookings.</p>}
            {schedule.clinics.length > 0 && (
                <>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {schedule.clinics.map(clinic => (
                            <div key={clinic.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                                <div className="min-w-0">
                                    {schedule.canAssignClinics ? <label className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200"><Checkbox checked={clinic.assigned} disabled={controlsDisabled} onCheckedChange={checked => updateClinic(clinic.id, { assigned: Boolean(checked), acceptsBookings: checked ? clinic.acceptsBookings : false })} aria-label={`Assign ${clinic.name}`} />{clinic.name}</label> : <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{clinic.name}</p>}
                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{clinic.assigned ? 'Assigned clinic' : 'Not assigned'}{clinic.isPrimary ? ' · Primary location' : ''}</p>
                                </div>
                                {clinic.assigned && <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300"><Checkbox checked={clinic.acceptsBookings} disabled={controlsDisabled} onCheckedChange={checked => updateClinic(clinic.id, { acceptsBookings: Boolean(checked) })} aria-label={`Accept bookings at ${clinic.name}`} />Accept bookings</label>}
                            </div>
                        ))}
                    </div>
                </>
            )}
        </section>
    );
}
