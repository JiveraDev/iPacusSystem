import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '../../ui/input';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { fetchBookingAvailability } from '../../services/bookingAvailabilityService';

function dateKey(value) {
    if (value instanceof Date) return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
    return String(value || '').slice(0, 10);
}

export default function BookingDateInput({ service, branchId, veterinarianId, excludeBookingId, value, onChange, excludeDate, disabled, requireClinic = true, ...props }) {
    const isOnline = String(service || '').toLowerCase().includes('online');
    const canLoad = Boolean(service) && (isOnline || Boolean(branchId) || !requireClinic) && !disabled;
    const valueMonth = dateKey(value).slice(0, 7);
    const [navigation, setNavigation] = useState(() => ({ month: valueMonth || dateKey(new Date()).slice(0, 7), valueMonth }));
    const month = valueMonth && navigation.valueMonth !== valueMonth ? valueMonth : navigation.month;
    const requestKey = [service, branchId, veterinarianId, excludeBookingId, month].join(':');
    const currentRequest = useRef(requestKey);
    useEffect(() => { currentRequest.current = requestKey; }, [requestKey]);
    const [result, setResult] = useState({ key: '', days: [], error: '' });
    const load = useCallback(async () => {
        try {
            const data = await fetchBookingAvailability({ service, branchId, veterinarianId, excludeBookingId, month });
            if (currentRequest.current !== requestKey) return;
            const clinicMatches = isOnline || (!branchId && !requireClinic) || String(data.selected?.branchId || '') === String(branchId || '');
            setResult({ key: requestKey, days: clinicMatches ? data.days || [] : [], error: '' });
        } catch (error) {
            if (currentRequest.current !== requestKey) return;
            setResult({ key: requestKey, days: [], error: error.message || 'Available booking dates could not be loaded.' });
        }
    }, [branchId, excludeBookingId, isOnline, month, requestKey, requireClinic, service, veterinarianId]);
    useAutoRefresh(load, { enabled: canLoad, refreshKey: requestKey });
    const days = useMemo(() => new Map(result.key === requestKey ? result.days.map(day => [day.date, day]) : []), [requestKey, result]);
    const error = result.key === requestKey ? result.error : '';
    const loading = canLoad && result.key !== requestKey;

    return (
        <div className="min-w-0">
            <Input
                {...props}
                type="date"
                value={value}
                onChange={onChange}
                disabled={disabled || (requireClinic && !isOnline && !branchId)}
                date={`${month}-01`}
                onDateChange={date => setNavigation({ month: dateKey(date).slice(0, 7), valueMonth })}
                excludeDate={date => Boolean(excludeDate?.(date)) || !days.get(dateKey(date))?.availableCount}
                getDayProps={date => ({ title: days.get(dateKey(date))?.availableCount ? `${days.get(dateKey(date)).availableCount} appointment starts available` : 'No appointments available' })}
                aria-busy={loading}
            />
            {(loading || error) && <p className={`mt-1.5 text-xs ${error ? 'text-red-600 dark:text-red-300' : 'text-slate-500 dark:text-slate-400'}`} role={error ? 'alert' : 'status'}>
                {error || 'Checking available dates...'}
            </p>}
        </div>
    );
}
