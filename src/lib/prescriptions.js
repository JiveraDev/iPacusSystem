export const PRESCRIPTION_FREQUENCIES = [
    { value: 'per day', label: 'Per day' },
    { value: 'per week', label: 'Per week' },
    { value: 'per month', label: 'Per month' },
    { value: 'as needed', label: 'As needed' }
];

export const PRESCRIPTION_DURATION_UNITS = [
    { value: 'day', label: 'Day(s)' },
    { value: 'week', label: 'Week(s)' },
    { value: 'month', label: 'Month(s)' },
    { value: 'as needed', label: 'As needed' }
];

export const PRESCRIPTION_ROUTES = [
    'Oral',
    'Topical',
    'Otic (ear)',
    'Ophthalmic (eye)',
    'Subcutaneous',
    'Intramuscular',
    'Inhaled',
    'Other'
];

export function defaultTimeSlots(times = 1) {
    const count = Math.max(1, Number(times) || 1);
    if (count === 1) return ['08:00'];
    if (count === 2) return ['08:00', '20:00'];
    if (count === 3) return ['08:00', '13:00', '20:00'];
    if (count === 4) return ['08:00', '12:00', '16:00', '20:00'];
    return Array.from({ length: count }, (_, index) => {
        const hour = Math.min(23, 6 + Math.floor(index * (18 / Math.max(1, count - 1))));
        return `${String(hour).padStart(2, '0')}:00`;
    });
}

export function createPrescriptionDraft() {
    return {
        medicine: '',
        dose: '',
        route: 'Oral',
        times: 1,
        frequency: 'per day',
        scheduleType: 'times_daily',
        intervalHours: 8,
        timeSlots: ['08:00'],
        daysOfWeek: [],
        durationNumber: 1,
        durationUnit: 'week',
        recommendedStartDate: '',
        instructions: ''
    };
}

export function normalizePrescriptionDraft(item = {}) {
    const times = Math.max(1, Number(item.times ?? item.timesCount) || 1);
    const frequency = item.frequency || 'per day';
    const scheduleType = item.scheduleType || (
        frequency === 'per week' ? 'weekly'
            : frequency === 'per month' ? 'monthly'
                : frequency === 'as needed' ? 'as_needed'
                    : 'times_daily'
    );
    return {
        ...createPrescriptionDraft(),
        ...item,
        times,
        frequency,
        scheduleType,
        timeSlots: Array.isArray(item.timeSlots) && item.timeSlots.length ? item.timeSlots : defaultTimeSlots(times),
        daysOfWeek: Array.isArray(item.daysOfWeek) ? item.daysOfWeek.map(Number) : []
    };
}

export function prescriptionScheduleLabel(item = {}) {
    if (item.scheduleType === 'interval_hours') return `Every ${item.intervalHours || 8} hours`;
    if (item.scheduleType === 'as_needed' || item.frequency === 'as needed') return 'As needed';
    const count = Number(item.times) || 1;
    return `${count} time${count === 1 ? '' : 's'} ${item.frequency || 'per day'}`;
}

export function prescriptionLine(item = {}) {
    return [
        item.medicine || 'Medication',
        item.dose,
        item.route ? `via ${item.route}` : '',
        prescriptionScheduleLabel(item),
        item.durationUnit === 'as needed'
            ? 'as needed'
            : `for ${item.durationNumber || 1} ${item.durationUnit || 'week'}${Number(item.durationNumber || 1) === 1 ? '' : 's'}`
    ].filter(Boolean).join(' · ');
}

export function prescriptionPlansForView(plans = [], { history = false, onlyNeedsStart = false } = {}) {
    return plans.flatMap((plan) => {
        const retired = ['superseded', 'stopped'].includes(plan.status);
        const items = (plan.items || []).filter((item) => {
            const active = !retired && ['active', 'pending_start'].includes(item.status);
            if (onlyNeedsStart) return active && item.status === 'pending_start';
            return history ? !active : active;
        });
        if (!items.length) return [];
        const itemIds = new Set(items.map((item) => item.itemId));
        return [{ ...plan, items, occurrences: (plan.occurrences || []).filter((dose) => itemIds.has(dose.itemId) && dose.status !== 'cancelled') }];
    });
}
