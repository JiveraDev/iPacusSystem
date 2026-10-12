import { useCallback, useEffect, useRef, useState } from 'react';
import { Building2, Loader2 } from 'lucide-react';
import Label from './BookingFieldLabel.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { saveOwnerActiveBranch } from '../../lib/bookingAvailabilityNavigation.js';
import { fetchBranches } from '../../services/branchService';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';

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
    bookingOnly = true,
}) {
    const [result, setResult] = useState({ key: '', branches: [], error: '' });
    const onChangeRef = useRef(onChange);
    const desiredValueRef = useRef(lockedBranchId || value);
    const serviceKey = normalizeServiceKey(service);
    const acceptingOnly = bookingOnly && !locked && !assignedOnly;
    const requestKey = [serviceKey, date, assignedOnly, acceptingOnly].join(':');
    const currentRequest = useRef(requestKey);
    const requestSerial = useRef(0);

    useEffect(() => {
        currentRequest.current = requestKey;
        return () => { currentRequest.current = null; };
    }, [requestKey]);

    useEffect(() => {
        onChangeRef.current = (branchId) => {
            onChange(branchId);
            if (persistSelection) saveOwnerActiveBranch(branchId);
        };
    }, [onChange, persistSelection]);

    useEffect(() => {
        desiredValueRef.current = lockedBranchId || value;
    }, [lockedBranchId, value]);

    const loadBranches = useCallback(async () => {
        const serial = ++requestSerial.current;
        try {
            const data = await fetchBranches({ service: serviceKey, date, assignedOnly, bookingOnly: acceptingOnly });
            if (currentRequest.current !== requestKey || serial !== requestSerial.current) return;
            const nextBranches = Array.isArray(data?.branches) ? data.branches : [];
            setResult({ key: requestKey, branches: nextBranches, error: '' });
            const desiredValue = String(desiredValueRef.current || '');
            if (!nextBranches.some((branch) => String(branch.id) === desiredValue)) {
                const defaultBranch = nextBranches.find((branch) => branch.isMain) || nextBranches[0];
                const nextValue = defaultBranch ? String(defaultBranch.id) : '';
                if (nextValue !== desiredValue) onChangeRef.current(nextValue);
            } else if (lockedBranchId && String(value || '') !== desiredValue) {
                onChangeRef.current(desiredValue);
            }
        } catch (requestError) {
            if (currentRequest.current !== requestKey || serial !== requestSerial.current) return;
            setResult({ key: requestKey, branches: [], error: requestError.message || 'Could not load clinic branches.' });
            throw requestError;
        }
    }, [acceptingOnly, assignedOnly, date, lockedBranchId, requestKey, serviceKey, value]);

    useAutoRefresh(loadBranches, { refreshKey: requestKey });
    const isLoading = result.key !== requestKey;
    const branches = isLoading ? [] : result.branches;
    const error = isLoading ? '' : result.error;

    const selectedBranch = branches.find((branch) => String(branch.id) === String(value || ''));
    const selectedService = selectedBranch?.services?.find((entry) => entry.key === serviceKey);


    return (
        <div className="space-y-2">
            <Label htmlFor={`branch-${serviceKey}`} help={(
                <div className="space-y-2">
                    <p>{locked ? 'This is the clinic assigned to this booking.' : 'Choose the clinic where your pet will receive care. Medical booking choices include clinics with an assigned vet accepting bookings.'}</p>
                    {selectedBranch?.address && <p>{selectedBranch.address}</p>}
                    {selectedService?.availabilityMode === 'vet_capacity' && <p>On-site medical appointments share vet capacity and follow this clinic’s operating schedule. Each vet chooses which assigned clinics can accept their bookings.</p>}
                </div>
            )}>
                <Building2 className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                Clinic {required ? '*' : ''}
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
                            placeholder={isLoading ? 'Loading clinics...' : !branches.length ? 'No clinics available' : 'Select a clinic'}
                            displayValue={selectedBranch?.name || (isLoading ? 'Loading clinics...' : branches.length ? 'Select a clinic' : 'No clinics available')}
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
                <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">{error}</p>
            ) : !branches.length && !locked ? (
                <p role="status" className="text-xs text-slate-600 dark:text-slate-300">No clinics are accepting bookings for this service. Check again later or choose another service.</p>
            ) : null}
        </div>
    );
}
