import { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, CalendarClock, Loader2 } from 'lucide-react';
import { Label } from '../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { fetchBranches } from '../../services/branchService';

function formatVisit(visit) {
    const start = new Date(String(visit.startsAt).replace(' ', 'T'));
    const end = new Date(String(visit.endsAt).replace(' ', 'T'));
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return visit.veterinarianName;
    }

    const dateLabel = start.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
    const startLabel = start.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
    const endLabel = end.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
    return `${visit.veterinarianName} - ${dateLabel}, ${startLabel} - ${endLabel}`;
}

function normalizeServiceKey(value) {
    const normalized = String(value || '').trim().toLowerCase();
    const aliases = {
        consultation: 'General Check-up',
        'general check-up': 'General Check-up',
        'lab-testing': 'lab-testing',
        laboratory: 'lab-testing',
        'parasite-control': 'parasite-control',
        'home-service': 'home-service',
        'special services': 'special services',
    };
    return aliases[normalized] || normalized;
}

export default function BranchBookingSelect({ service, date, value, onChange, required = true, assignedOnly = false }) {
    const [branches, setBranches] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const onChangeRef = useRef(onChange);
    const serviceKey = normalizeServiceKey(service);

    useEffect(() => {
        onChangeRef.current = onChange;
    }, [onChange]);

    useEffect(() => {
        let active = true;
        fetchBranches({ service: serviceKey, date, assignedOnly })
            .then((data) => {
                if (!active) return;
                setError('');
                const nextBranches = Array.isArray(data?.branches) ? data.branches : [];
                setBranches(nextBranches);
                const currentExists = nextBranches.some((branch) => String(branch.id) === String(value || ''));
                if (!currentExists) {
                    const defaultBranch = nextBranches.find((branch) => branch.isMain) || nextBranches[0];
                    onChangeRef.current(defaultBranch ? String(defaultBranch.id) : '');
                }
            })
            .catch((requestError) => {
                if (active) setError(requestError.message || 'Could not load clinic branches.');
            })
            .finally(() => {
                if (active) setIsLoading(false);
            });

        return () => {
            active = false;
        };
    }, [serviceKey, date, value, assignedOnly]);

    const selectedBranch = useMemo(
        () => branches.find((branch) => String(branch.id) === String(value || '')),
        [branches, value]
    );
    const selectedService = selectedBranch?.services?.find((entry) => entry.key === serviceKey);
    const relevantVisits = (selectedBranch?.vetVisits || []).filter((visit) => (
        !visit.serviceKeys?.length || visit.serviceKeys.includes(serviceKey)
    ));

    return (
        <div className="space-y-2">
            <Label htmlFor={`branch-${serviceKey}`} className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                Clinic location {required ? '*' : ''}
            </Label>
            <Select value={String(value || '')} onValueChange={onChange} disabled={isLoading || !branches.length}>
                <SelectTrigger id={`branch-${serviceKey}`} aria-invalid={Boolean(error)}>
                    <SelectValue
                        placeholder={isLoading ? 'Loading locations...' : 'Select a clinic location'}
                        displayValue={selectedBranch?.name}
                    />
                </SelectTrigger>
                <SelectContent>
                    {branches.map((branch) => (
                        <SelectItem key={branch.id} value={String(branch.id)}>
                            {branch.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            {isLoading ? (
                <p className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Loading branch availability...
                </p>
            ) : error ? (
                <p className="text-xs font-medium text-red-600 dark:text-red-400">{error}</p>
            ) : selectedBranch ? (
                <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                    <p>{selectedBranch.address}</p>
                    {selectedService?.availabilityMode === 'vet_visit' && (
                        relevantVisits.length ? (
                            <div className="flex items-start gap-2 rounded-md bg-slate-50 p-2 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" />
                                <div>
                                    <p className="font-semibold">Available during these veterinarian visits:</p>
                                    {relevantVisits.map((visit) => <p key={visit.id}>{formatVisit(visit)}</p>)}
                                </div>
                            </div>
                        ) : (
                            <p className="font-medium text-amber-700 dark:text-amber-300">No veterinarian visit is published for the selected date.</p>
                        )
                    )}
                </div>
            ) : null}
        </div>
    );
}
