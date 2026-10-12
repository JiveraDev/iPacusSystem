export function groomingNextStep(status, reviewOutcome) {
    switch (status) {
        case 'scheduled': return { status: 'checked_in', label: 'Receive pet', hint: 'Receive the pet once, then add the required before photo.' };
        case 'checked_in': return { status: 'in_progress', label: 'Start grooming', hint: 'Confirm the service and add the before photo before starting.' };
        case 'vet_review': return reviewOutcome === 'resume'
            ? { status: 'in_progress', label: 'Resume grooming', hint: 'The vet has cleared this pet to continue.' }
            : null;
        case 'in_progress': return { status: 'ready', label: 'Finish grooming', hint: 'Add the required after photo. Finishing prepares the invoice and continues directly to POS.' };
        default: return null;
    }
}

export function groomingSavePayload(job, details, performer, status = job.status) {
    return {
        action: 'save', status, performedBy: performer,
        details: {
            ...details,
            ...(status === 'ready' && job.status === 'in_progress' ? { completionConfirmed: true } : {}),
        },
    };
}

export function groomingOptionDisplay(options, value, label = 'Selection') {
    const key = String(value ?? '').trim();
    if (!key) return '';

    const optionLabel = options && Object.prototype.hasOwnProperty.call(options, key)
        ? String(options[key] ?? '').trim()
        : '';
    return optionLabel || `${label} unavailable`;
}

export function groomingBookingReference(item = {}) {
    const bookingNumber = String(item.booking_number ?? item.bookingNumber ?? '').trim();
    if (bookingNumber) return bookingNumber;

    const serviceName = String(item.grooming_service ?? item.groomingService ?? '').trim();
    return serviceName && serviceName.toLowerCase() !== 'grooming service'
        ? `${serviceName} appointment`
        : 'Grooming appointment';
}
