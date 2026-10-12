import { useRef, useState } from 'react';
import { Loader2, Stethoscope } from 'lucide-react';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { fetchVetPresence, updateVetPresence } from '../../services/vetPresenceService';
import { toast } from '../../reusecomponent/toast.jsx';
import { Button } from '../../ui/button';
import VetPresenceDisplay from './VetPresenceDisplay.jsx';

export default function VetPresenceSign({ editable = false, variant = 'home', scheduleHref, branchId = '' }) {
    const [presence, setPresence] = useState(null);
    const [error, setError] = useState(false);
    const [saving, setSaving] = useState(false);
    const requestVersion = useRef(0);
    const savingRef = useRef(false);

    const refresh = async () => {
        if (savingRef.current) return;
        const version = ++requestVersion.current;
        try {
            const next = await fetchVetPresence(branchId);
            if (version !== requestVersion.current) return;
            setPresence(next);
            setError(false);
        } catch {
            if (version === requestVersion.current) setError(true);
        }
    };
    useAutoRefresh(refresh, { refreshKey: `vet-presence:${branchId}` });

    const toggle = async () => {
        if (!presence || savingRef.current || error) return;
        savingRef.current = true;
        requestVersion.current += 1;
        setSaving(true);
        try {
            const next = await updateVetPresence(!(presence.adminIsIn ?? presence.isIn));
            setPresence(next);
            setError(false);
            toast.success((next.adminIsIn ?? next.isIn) ? 'Vet setting saved as in. The public sign also follows clinic hours and lunch.' : 'Vet status updated: the vet is out for today.');
        } catch (failure) {
            setError(true);
            toast.error(failure);
        } finally {
            savingRef.current = false;
            setSaving(false);
        }
    };

    const known = presence && !error;
    const adminIsIn = Boolean(presence?.adminIsIn ?? presence?.isIn);
    const title = error ? 'Vet status unavailable' : !presence ? 'Checking vet status...' : presence.status === 'closed' ? 'Clinic is closed' : presence.status === 'lunch' ? 'Vet appointments on lunch break' : presence.isIn ? 'Vet is in' : 'Vet is out';
    const tone = !known || presence.status === 'closed' ? 'text-slate-600 dark:text-slate-300' : presence.isIn ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300';

    if (!editable) {
        return <VetPresenceDisplay presence={presence} error={error} variant={variant} onRetry={refresh} scheduleHref={scheduleHref} />;
    }

    return (
        <section aria-label="Today's vet status" className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
                <Stethoscope className={`mt-0.5 size-5 shrink-0 ${tone}`} aria-hidden="true" />
                <div className="min-w-0">
                    <p role="status" className={`text-sm font-semibold ${tone}`}>{title}</p>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                        The daily setting resets to “in” at midnight Manila. The public sign shows closed outside clinic hours and pauses vet availability during lunch.
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Lunch period: 12:00–1:00 PM. Vet appointments pause; grooming remains bookable.</p>
                </div>
            </div>
            {error ? (
                <Button type="button" variant="outline" onClick={refresh} className="shrink-0">Retry status</Button>
            ) : editable && (
                <button type="button" role="switch" aria-checked={adminIsIn} aria-label="Daily vet presence setting" aria-busy={saving}
                    disabled={!known || saving} onClick={toggle}
                    className="inline-flex min-h-11 shrink-0 items-center gap-3 self-start rounded-md px-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60 dark:text-slate-200 dark:hover:bg-slate-800 sm:self-auto">
                    {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                    <span>{!presence ? 'Loading...' : adminIsIn ? 'In / On' : 'Out / Off'}</span>
                    <span aria-hidden="true" className={`inline-flex h-7 w-12 items-center rounded-full p-1 ${adminIsIn ? 'bg-emerald-600' : 'bg-slate-500'}`}>
                        <span className={`size-5 rounded-full bg-white ${adminIsIn ? 'translate-x-5' : ''}`} />
                    </span>
                </button>
            )}
        </section>
    );
}
