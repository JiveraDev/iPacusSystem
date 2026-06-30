const MONTH_ABBREVIATIONS = [
    'JAN',
    'FEB',
    'MAR',
    'APR',
    'MAY',
    'JUN',
    'JUL',
    'AUG',
    'SEP',
    'OCT',
    'NOV',
    'DEC'
];

function referenceDateParts(value) {
    const date = value ? new Date(value) : new Date();
    const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
    return {
        month: MONTH_ABBREVIATIONS[safeDate.getMonth()],
        day: String(safeDate.getDate()).padStart(2, '0')
    };
}

export function formatQueueReference(queue) {
    if (!queue) return '';
    if (queue.queue_reference) return String(queue.queue_reference);
    if (queue.queueReference) return String(queue.queueReference);

    const queueNumber = queue.queue_number || queue.queueNumber;
    if (!queueNumber) return '';

    const { month, day } = referenceDateParts(
        queue.timestamp
        || queue.date
        || queue.serviceDate
        || queue.finalizedAt
        || queue.updatedAt
        || queue.createdAt
        || queue.created_at
    );
    return `Q-${queueNumber}${month}${day}`;
}
