const SUBJECT_LABELS = [
    'pet name',
    'patient',
    'pet',
    'item',
    'product',
    'service name',
    'service',
    'booking number',
    'queue number',
    'room',
    'account name',
    'staff name',
    'owner name',
];

const QUANTITY_LABELS = ['quantity', 'total quantity'];
const UNIT_LABELS = ['unit', 'stock unit'];

function text(value) {
    return String(value ?? '').trim();
}

function normalized(value) {
    return text(value).toLowerCase().replaceAll('_', ' ').replaceAll('-', ' ');
}

function detailMap(activity) {
    const details = Array.isArray(activity?.action_details) ? activity.action_details : [];
    return new Map(details
        .filter((detail) => text(detail?.label) && text(detail?.value))
        .map((detail) => [normalized(detail.label), text(detail.value)]));
}

function firstDetail(details, labels) {
    for (const label of labels) {
        const value = details.get(label);
        if (value) return value;
    }
    return '';
}

function sentenceCaseAction(value) {
    const action = text(value).replace(/[.!?]+$/, '');
    return action ? `${action.charAt(0).toLowerCase()}${action.slice(1)}` : 'performed an activity';
}

function pluralUnit(unit, quantity) {
    const cleanUnit = text(unit);
    const numericQuantity = Number(quantity);
    if (!cleanUnit || !Number.isFinite(numericQuantity) || numericQuantity === 1) return cleanUnit;
    if (/s$/i.test(cleanUnit)) return cleanUnit;
    if (/(s|x|z|ch|sh)$/i.test(cleanUnit)) return `${cleanUnit}es`;
    if (/[^aeiou]y$/i.test(cleanUnit)) return `${cleanUnit.slice(0, -1)}ies`;
    return `${cleanUnit}s`;
}

function quantityPhrase(details) {
    const quantity = firstDetail(details, QUANTITY_LABELS);
    const unit = firstDetail(details, UNIT_LABELS);
    if (!quantity) return '';
    return unit ? `${quantity} ${pluralUnit(unit, quantity)}` : quantity;
}

function targetReference(activity) {
    const targetId = text(activity?.target_id);
    if (!targetId) return '';
    const targetType = normalized(activity?.target_type || 'record');
    return `${targetType || 'record'} #${targetId}`;
}

function subjectName(activity, details) {
    return firstDetail(details, SUBJECT_LABELS)
        || text(activity?.subject_name)
        || targetReference(activity);
}

function withActor(actor, phrase) {
    const safeActor = actor || 'A staff member';
    return `${safeActor} ${phrase}`.replace(/\s+/g, ' ').trim();
}

export function formatDetailedActivityNarrative(activity = {}) {
    const actor = text(activity.actor_name);
    const actionLabel = text(activity.action_label);
    const actionKey = normalized(activity.action_key);
    const requestPath = normalized(activity.request_path);
    const action = normalized(actionLabel);
    const details = detailMap(activity);
    const subject = subjectName(activity, details);
    const quantity = quantityPhrase(details);
    const item = firstDetail(details, ['item', 'product']);

    if (actionKey.includes('post:/pet information') || requestPath === '/pet information' || action === 'registered pet') {
        return withActor(actor, subject && !subject.includes('#') ? `registered ${subject}` : `registered ${subject || 'a pet'}`);
    }

    if (actionKey.includes('post:/inventory/stock in') || requestPath === '/inventory/stock in' || action === 'recorded stock in') {
        if (item && quantity) return withActor(actor, `stocked in ${quantity} of ${item}`);
        if (item) return withActor(actor, `recorded stock in for ${item}`);
        if (quantity) return withActor(actor, `stocked in ${quantity} across the recorded inventory items`);
    }

    if (actionKey.includes('post:/inventory/stock out') || requestPath === '/inventory/stock out' || action === 'recorded stock out') {
        if (item && quantity) return withActor(actor, `stocked out ${quantity} of ${item}`);
        if (item) return withActor(actor, `recorded stock out for ${item}`);
    }

    if (actionKey.includes('post:/inventory/transfer') || requestPath === '/inventory/transfer' || action === 'transferred inventory') {
        const source = firstDetail(details, ['source location']);
        const destination = firstDetail(details, ['destination location', 'location']);
        const route = [source ? `from ${source}` : '', destination ? `to ${destination}` : ''].filter(Boolean).join(' ');
        return withActor(actor, `transferred ${[quantity, item ? `of ${item}` : '', route].filter(Boolean).join(' ') || subject || 'inventory stock'}`);
    }

    const actionPhrase = sentenceCaseAction(actionLabel);
    const normalizedSubject = normalized(subject);
    const alreadyNamesSubject = normalizedSubject && normalized(actionPhrase).includes(normalizedSubject);
    return withActor(actor, `${actionPhrase}${subject && !alreadyNamesSubject ? ` — ${subject}` : ''}`);
}

