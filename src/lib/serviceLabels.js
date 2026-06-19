const SERVICE_LABELS = {
    'General Check-up': 'General Check-up',
    'general-checkup': 'General Check-up',
    'general check-up': 'General Check-up',
    'general checkup': 'General Check-up'
};

function getServiceDisplayName(value, fallback = 'Service') {
    const rawValue = String(value || '').trim();
    if (!rawValue) return fallback;

    return SERVICE_LABELS[rawValue.toLowerCase()] || rawValue;
}

export { getServiceDisplayName };
