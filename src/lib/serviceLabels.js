const SERVICE_LABELS = {
    'General Check-up': 'General Check-up',
    'general-checkup': 'General Check-up',
    'general check-up': 'General Check-up',
    'general checkup': 'General Check-up',
    'kennel boarding': 'Confinement Boarding',
    'pet hotel & kennel boarding': 'Pet Hotel & Confinement Boarding',
    'pet hotel and kennel boarding': 'Pet Hotel and Confinement Boarding'
};

function getServiceDisplayName(value, fallback = 'Service') {
    const rawValue = String(value || '').trim();
    if (!rawValue) return fallback;

    return SERVICE_LABELS[rawValue.toLowerCase()] || rawValue;
}

export { getServiceDisplayName };
