const SERVICE_LABELS = {
    wellness: 'General Check-Up',
    'general check-up': 'General Check-Up',
    'general checkup': 'General Check-Up'
};

function getServiceDisplayName(value, fallback = 'Service') {
    const rawValue = String(value || '').trim();
    if (!rawValue) return fallback;

    return SERVICE_LABELS[rawValue.toLowerCase()] || rawValue;
}

export { getServiceDisplayName };
