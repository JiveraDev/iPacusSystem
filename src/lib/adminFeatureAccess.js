export const ADMIN_FEATURE_GROUPS = [
    {
        id: 'patient-care',
        label: 'Patient care',
        description: 'Pet records, registration, bookings, and owner requests.',
        features: [
            { key: 'pets', label: 'Pets Directory', description: 'Review linked pets and their clinic information.' },
            { key: 'pet_register', label: 'Pet Registration', description: 'Register pets and update pet profiles.' },
            { key: 'bookings', label: 'Booking Management', description: 'Review, schedule, approve, and update bookings.' },
            { key: 'record_requests', label: 'Record Update Requests', description: 'Review owner requests and payment proofs.' },
        ],
    },
    {
        id: 'clinic-operations',
        label: 'Clinic operations',
        description: 'Daily queues, boarding, sales, and stock workflows.',
        features: [
            { key: 'boarding', label: 'Boarding', description: 'Manage kennel rooms, stays, care, and availability.' },
            { key: 'queue', label: 'Queue', description: 'Manage clinic queues and patient assignments.' },
            { key: 'pos', label: 'Point of Sale', description: 'Create clinic sales and manage visit billing.' },
            { key: 'inventory', label: 'Inventory', description: 'Add, receive, transfer, adjust, and archive stock.' },
        ],
    },
    {
        id: 'service-content',
        label: 'Services and documents',
        description: 'Client-facing services, pricing, and consent materials.',
        features: [
            { key: 'services', label: 'Services', description: 'Edit content shown on service booking pages.' },
            { key: 'service_catalog', label: 'Service Catalog', description: 'Manage clinic service records and availability.' },
            { key: 'consent', label: 'Consent Files', description: 'Create and update reusable consent documents.' },
        ],
    },
];

export const ADMIN_FEATURES = ADMIN_FEATURE_GROUPS.flatMap((group) => group.features);
export const ADMIN_FEATURE_KEYS = ADMIN_FEATURES.map((feature) => feature.key);

export function defaultAdminFeaturePermissions() {
    return Object.fromEntries(ADMIN_FEATURE_KEYS.map((key) => [key, true]));
}

export function normalizeAdminFeaturePermissions(value) {
    const defaults = defaultAdminFeaturePermissions();
    const source = value && typeof value === 'object' ? value : {};

    ADMIN_FEATURE_KEYS.forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
            defaults[key] = Boolean(source[key]);
        }
    });

    return defaults;
}

export function getAdminFeatureForDashboardPath(path) {
    const normalized = String(path || '').replace(/\/+$/, '') || '/dashboard';

    if (normalized.startsWith('/dashboard/service-catalog')) return 'service_catalog';
    if (normalized.startsWith('/dashboard/services')) return 'services';
    if (normalized.startsWith('/dashboard/pet-register')) return 'pet_register';
    if (normalized.startsWith('/dashboard/my-pets')) return 'pets';
    if (normalized.startsWith('/dashboard/record-requests')) return 'record_requests';
    if (normalized.startsWith('/dashboard/bookings')) return 'bookings';
    if (normalized.startsWith('/dashboard/boarding')) return 'boarding';
    if (normalized.startsWith('/dashboard/queue')) return 'queue';
    if (normalized.startsWith('/dashboard/pos')) return 'pos';
    if (normalized.startsWith('/dashboard/inventory')) return 'inventory';
    if (normalized.startsWith('/dashboard/consent')) return 'consent';

    return null;
}
