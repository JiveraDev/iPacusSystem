import { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, Loader2 } from 'lucide-react';
import { Label } from '../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { saveOwnerActiveBranch } from '../../lib/bookingAvailabilityNavigation.js';
import { fetchBranches } from '../../services/branchService';

function normalizeServiceKey(value) {
    const normalized = String(value || '').trim().toLowerCase();
    const aliases = {
        consultation: 'General Check-up',
        'general check-up': 'General Check-up',
        'general-checkup': 'General Check-up',
        'online-consultation': 'consultation',
        'special-services': 'special services',
        'lab-testing': 'lab-testing',
        laboratory: 'lab-testing',
        'parasite-control': 'parasite-control',
        'home-service': 'home-service',
        'special services': 'special services',
    };
    return aliases[normalized] || normalized;
}

export default function BranchBookingSelect({
    service,
    date,
    value,
    onChange,
    required = true,
    assignedOnly = false,
    locked = false,
    lockedBranchId = '',
    persistSelection = false,
}) {
    const [branches, setBranches] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const onChangeRef = useRef(onChange);
    const serviceKey = normalizeServiceKey(service);

    useEffect(() => {
        onChangeRef.current = (branchId) => {
            onChange(branchId);
            if (persistSelection) saveOwnerActiveBranch(branchId);
        };
    }, [onChange, persistSelection]);

    useEffect(() => {
        let active = true;
        fetchBranches({ service: serviceKey, date, assignedOnly })
            .then((data) => {
                if (!active) return;
                setError('');
                const nextBranches = Array.isArray(data?.branches) ? data.branches : [];
                setBranches(nextBranches);
                const desiredValue = lockedBranchId || value;
                const currentExists = nextBranches.some((branch) => String(branch.id) === String(desiredValue || ''));
                if (!currentExists) {
                    const defaultBranch = nextBranches.find((branch) => branch.isMain) || nextBranches[0];
                    onChangeRef.current(defaultBranch ? String(defaultBranch.id) : '');
                } else if (String(value || '') !== String(desiredValue || '')) {
                    onChangeRef.current(String(desiredValue));
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
    }, [serviceKey, date, value, assignedOnly, lockedBranchId]);

    const selectedBranch = useMemo(
        () => branches.find((branch) => String(branch.id) === String(value || '')),
        [branches, value]
    );
    const selectedService = selectedBranch?.services?.find((entry) => entry.key === serviceKey);


    return (
        <div className="space-y-2">
            <Label htmlFor={`branch-${serviceKey}`} className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                Clinic location {required ? '*' : ''}
            </Label>
            {locked ? (
                <div
                    id={`branch-${serviceKey}`}
                    className="flex min-h-10 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                    {isLoading ? 'Loading assigned location...' : selectedBranch?.name || 'Assigned clinic location'}
                </div>
            ) : (
                <Select value={String(value || '')} onValueChange={(branchId) => onChangeRef.current(branchId)} disabled={isLoading || !branches.length}>
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
            )}
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
                    {selectedService?.availabilityMode === 'vet_capacity' && (
                        <p>On-site medical appointments share vet capacity and follow this clinic’s operating schedule. Each vet chooses which assigned clinics can accept their bookings.</p>
                    )}
                </div>
            ) : null}
        </div>
    );
}
