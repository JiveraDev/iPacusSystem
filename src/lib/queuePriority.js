export const QUEUE_PRIORITY_OPTIONS = [
    { value: 'normal', label: 'Normal' },
    { value: 'urgent', label: 'Urgent' },
];

// Keep recognized stored values separate from the visible selector/filter options.
// This ensures an existing low-test queue record still displays correctly even
// though it is not available as a queue filter.
const KNOWN_QUEUE_PRIORITIES = ['normal', 'urgent', 'low-test'];

export function normalizeQueuePriority(value) {
    const normalized = String(value || '').trim().toLowerCase();
    return KNOWN_QUEUE_PRIORITIES.includes(normalized) ? normalized : 'normal';
}

export function getQueuePriorityLabel(value) {
    const normalized = normalizeQueuePriority(value);
    if (normalized === 'low-test') return 'Low-test';
    if (normalized === 'urgent') return 'Urgent';
    return 'Normal';
}
